/**
 * Collects today's prices from the tracked shops and stores them in the database.
 *
 *   pnpm prices:collect [--shops crowdgames,lavkaigr,gaga,hobbygames] [--from-cache]
 *
 * `--from-cache` stores the catalogues a `prices:dry-run` already saved under
 * data/price-cache instead of asking the shops again.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { closeDb, getDb } from "@/lib/db/client";
import { buildUserAgent } from "@/lib/prices/http";
import { refreshSite } from "@/lib/prices/refresh-site";
import { runPriceCollection } from "@/lib/prices/run-collection";
import { shopCodes, type ShopCode, type ShopProduct } from "@/lib/prices/types";

const CACHE_DIR = join(process.cwd(), "data", "price-cache");

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
  try {
    const summary = await runPriceCollection({
      db: getDb(),
      shops: options.shops,
      userAgent: buildUserAgent(process.env.PRICE_BOT_INFO_URL),
      log: console.log,
      readCatalogue: options.fromCache ? readCache : undefined,
    });
    if (summary.shops.some((shop) => shop.error !== null)) process.exitCode = 1;
    await refreshSite(
      { REVALIDATE_URL: process.env.REVALIDATE_URL, REVALIDATE_SECRET: process.env.REVALIDATE_SECRET },
      console.log,
    );
  } finally {
    await closeDb();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
