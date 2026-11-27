/**
 * Walks through the links the matcher was not sure about, one at a time.
 *
 *   pnpm prices:review [--shop crowdgames|lavkaigr|gaga|hobbygames] [--without-price]
 *
 * y confirms the product as the game (its price shows from the next run on),
 * n rejects it for good, s skips it for now, q quits. Games that show no price
 * anywhere come first. `--without-price` shows only those.
 */
import { createInterface } from "node:readline";
import { closeDb, getDb } from "@/lib/db/client";
import { confirmCandidate, listReviewQueue, rejectCandidate, type ReviewItem } from "@/lib/prices/review";
import { shopCodes, type ShopCode } from "@/lib/prices/types";

const shopNames: Record<ShopCode, string> = {
  crowdgames: "CrowdGames",
  lavkaigr: "Lavka Igr",
  gaga: "GaGa",
  hobbygames: "Hobby Games",
};

const reasons: Record<string, string> = {
  "title-contains-name": "the product title contains the game's name and more (an expansion? another edition?)",
  "several-products": "the shop has several products with this title",
  "claimed-by-several-games": "this title fits more than one game",
  "name-within-another-game": "the game's name is part of another game's name",
  barcode: "same barcode as a product confirmed in another shop",
};

function parseArgs(argv: string[]): { shop?: ShopCode; withoutPrice: boolean } {
  const index = argv.indexOf("--shop");
  const shop = index === -1 ? undefined : argv[index + 1];
  if (shop !== undefined && !(shopCodes as readonly string[]).includes(shop)) {
    throw new Error(`Unknown shop: ${shop}. Known: ${shopCodes.join(", ")}`);
  }
  return { shop: shop as ShopCode | undefined, withoutPrice: argv.includes("--without-price") };
}

function describe(item: ReviewItem, left: number): string {
  const game = [item.gameTitle, item.titleRu && item.titleRu !== item.gameTitle ? `(${item.titleRu})` : null]
    .filter(Boolean)
    .join(" ");
  const facts = [item.year, item.rank === null ? null : `rank ${item.rank}`].filter(Boolean).join(", ");
  return [
    "",
    `── ${left} left ──────────────────────────────────────────`,
    `Game:     ${game}${facts ? ` — ${facts}` : ""}${item.gameHasPrice ? "" : "  [no price on the site yet]"}`,
    `          ${item.bggUrl}`,
    `Product:  ${item.productTitle}${item.vendor ? ` — ${item.vendor}` : ""}`,
    `          ${shopNames[item.shop]}: ${item.productUrl}`,
    `Why:      ${reasons[item.reason] ?? item.reason}`,
    ...(item.current ? [`Now:      linked to "${item.current.title}" — yes replaces it`, `          ${item.current.url}`] : []),
  ].join("\n");
}

async function main() {
  const filter = parseArgs(process.argv.slice(2));
  const db = getDb();
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  // Lines are read from an iterator so none is lost when input is piped, and Ctrl+D ends cleanly.
  const lines = prompt[Symbol.asyncIterator]();
  const ask = async (question: string): Promise<string> => {
    process.stdout.write(question);
    const next = await lines.next();
    return next.done ? "q" : next.value.trim().toLowerCase();
  };
  const counts = { confirmed: 0, rejected: 0, skipped: 0 };
  try {
    const queue = await listReviewQueue(db, filter);
    if (queue.length === 0) {
      console.log("Nothing waits for review.");
      return;
    }
    console.log(`${queue.length} candidates wait for review. y = it is this game, n = it is not, s = skip, q = quit.`);

    // Confirming a product settles the game's other candidates in that shop.
    const settled = new Set<string>();
    const pending = (item: ReviewItem) => !settled.has(`${item.bggId}\u0000${item.shop}`);

    for (const [index, item] of queue.entries()) {
      if (!pending(item)) continue;
      console.log(describe(item, queue.slice(index).filter(pending).length));

      let answer = "";
      while (!["y", "n", "s", "q"].includes(answer)) {
        answer = await ask("[y/n/s/q] ");
      }
      if (answer === "q") break;
      if (answer === "s") counts.skipped += 1;
      if (answer === "y") {
        await confirmCandidate(db, item);
        settled.add(`${item.bggId}\u0000${item.shop}`);
        counts.confirmed += 1;
      }
      if (answer === "n") {
        await rejectCandidate(db, item);
        counts.rejected += 1;
      }
    }

    const left = (await listReviewQueue(db, filter)).length;
    console.log(
      `\nConfirmed ${counts.confirmed}, rejected ${counts.rejected}, skipped ${counts.skipped}. ${left} still wait.` +
        (counts.confirmed > 0 ? " Confirmed prices show after the next price run." : ""),
    );
  } finally {
    prompt.close();
    await closeDb();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
