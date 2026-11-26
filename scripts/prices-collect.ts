/**
 * Collects today's prices from the tracked shops and stores them in the database.
 *
 *   pnpm prices:collect [--shops crowdgames,lavkaigr,gaga] [--from-cache]
 *
 * `--from-cache` stores the catalogues a `prices:dry-run` already saved under
 * data/price-cache instead of asking the shops again.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { closeDb, getDb } from "@/lib/db/client";
import { fetchCatalogue, storeCollection } from "@/lib/prices/collect";
import { buildUserAgent } from "@/lib/prices/http";
import { loadLegacyGames } from "@/lib/prices/legacy-games";
import type { ShopOutcome } from "@/lib/prices/report";
import { countCandidates, getCurrentOffers } from "@/lib/prices/store";
import { shopCodes, type ShopCode, type ShopProduct } from "@/lib/prices/types";

const CACHE_DIR = join(process.cwd(), "data", "price-cache");
const LEGACY_DB = join(process.cwd(), "data", "bgg-cache.sqlite");

function parseArgs(argv: string[]): { shops: ShopCode[]; fromCache: boolean } {
  const index = argv.indexOf("--shops");
  const shops = (index === -1 ? shopCodes.join(",") : (argv[index + 1] ?? "")).split(",").map((shop) => shop.trim());
  const unknown = shops.filter((shop) => !(shopCodes as readonly string[]).includes(shop));
  if (unknown.length > 0) throw new Error(`Unknown shop: ${unknown.join(", ")}. Known: ${shopCodes.join(", ")}`);
  return { shops: shops as ShopCode[], fromCache: argv.includes("--from-cache") };
}

function readCache(shop: ShopCode): ShopProduct[] {
  const path = join(CACHE_DIR, `${shop}.json`);
  if (!existsSync(path)) throw new Error(`No cached catalogue at ${path}; run prices:dry-run first`);
  return (JSON.parse(readFileSync(path, "utf8")) as { products: ShopProduct[] }).products;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = new Date();
  const games = loadLegacyGames(LEGACY_DB);
  const userAgent = buildUserAgent(process.env.PRICE_BOT_INFO_URL);
  console.log(`Games: ${games.length}`);

  // One shop failing must not stop the others.
  const outcomes: ShopOutcome[] = [];
  for (const shop of options.shops) {
    try {
      const products = options.fromCache ? readCache(shop) : await fetchCatalogue(shop, games, userAgent);
      console.log(`  ${shop}: ${products.length} products${options.fromCache ? " (cached)" : ""}`);
      outcomes.push({ shop, products });
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.log(`  ${shop}: FAILED — ${message}`);
      outcomes.push({ shop, error: message });
    }
  }

  const db = getDb();
  try {
    const summary = await storeCollection(db, games, outcomes, startedAt, new Date());
    for (const shop of summary.shops) {
      console.log(
        shop.error === null
          ? `  ${shop.shop}: ${shop.confirmed} confirmed, ${shop.candidates} candidates, ${shop.pricesChanged} prices changed`
          : `  ${shop.shop}: FAILED — ${shop.error}`,
      );
    }
    const offers = await getCurrentOffers(db);
    console.log(
      `Stored: ${offers.length} current prices for ${new Set(offers.map((offer) => offer.bggId)).size} games; ` +
        `${await countCandidates(db)} candidates wait for review.`,
    );
    if (summary.shops.some((shop) => shop.error !== null)) process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
