/**
 * Local check of the price collectors: fetches a little from each shop, matches
 * it against the cached top games, and prints what was found.
 *
 * By default it reads only a couple of pages per shop, enough to prove the
 * parsers work. `--full` reads whole catalogues (GaGa alone is about 3 hours).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { buildUserAgent, createShopGet } from "@/lib/prices/http";
import { matchProducts } from "@/lib/prices/match";
import { alternateNamesByGame, mergeNames } from "@/lib/prices/names";
import { buildReport, formatReport, type ShopOutcome } from "@/lib/prices/report";
import { shopAdapters } from "@/lib/prices/shops";
import { findTeseraNames, TESERA_ORIGIN, type TeseraNames } from "@/lib/prices/tesera";
import { shopCodes, type GameNames, type ShopCode, type ShopProduct } from "@/lib/prices/types";

const CACHE_DIR = join(process.cwd(), "data", "price-cache");
const DB_PATH = join(process.cwd(), "data", "bgg-cache.sqlite");
const GAGA_SAVE_EVERY = 50;

type Options = {
  shops: ShopCode[];
  refresh: boolean;
  lavkaPages: number | undefined;
  gagaLimit: number | undefined;
  teseraGames: number;
};
type CatalogCache = { complete: boolean; products: ShopProduct[] };

function parseArgs(argv: string[]): Options {
  const value = (flag: string) => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const count = (flag: string, fallback: number) => {
    const raw = value(flag);
    if (raw === undefined) return fallback;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${flag} needs a whole number, got "${raw}"`);
    return parsed;
  };

  const full = argv.includes("--full");
  const shops = (value("--shops") ?? shopCodes.join(",")).split(",").map((shop) => shop.trim());
  const unknown = shops.filter((shop) => !(shopCodes as readonly string[]).includes(shop));
  if (unknown.length > 0) throw new Error(`Unknown shop: ${unknown.join(", ")}. Known: ${shopCodes.join(", ")}`);

  return {
    shops: shops as ShopCode[],
    refresh: argv.includes("--refresh"),
    lavkaPages: full ? undefined : count("--lavka-pages", 2),
    gagaLimit: full ? undefined : count("--gaga-limit", 3),
    teseraGames: full ? Infinity : count("--tesera", 3),
  };
}

function readJson<T>(path: string): T | null {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : null;
}

function writeJson(path: string, data: unknown) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function loadGames(): { bggId: number; title: string; names: string[] }[] {
  if (!existsSync(DB_PATH)) {
    throw new Error(`No BGG cache at ${DB_PATH}. Sync BGG in the app first, or copy data/bgg-cache.sqlite here.`);
  }
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  try {
    const rows = db.prepare("SELECT bgg_id AS bggId, title, raw_xml AS rawXml FROM games ORDER BY rank").all() as {
      bggId: number;
      title: string;
      rawXml: string;
    }[];
    // A row's XML is its whole 20-game batch, so each distinct text is parsed once.
    const namesById = new Map<number, string[]>();
    for (const xml of new Set(rows.map((row) => row.rawXml))) {
      for (const [id, names] of alternateNamesByGame(xml)) namesById.set(id, names);
    }
    return rows.map((row) => ({ bggId: row.bggId, title: row.title, names: namesById.get(row.bggId) ?? [] }));
  } finally {
    db.close();
  }
}

async function addTeseraNames(games: { bggId: number; title: string }[], limit: number, userAgent: string) {
  const path = join(CACHE_DIR, "tesera.json");
  const cache = readJson<Record<string, TeseraNames | null>>(path) ?? {};
  const get = createShopGet({ origin: TESERA_ORIGIN, userAgent });
  let asked = 0;

  for (const game of games) {
    if (String(game.bggId) in cache) continue;
    if (asked >= limit) break;
    asked += 1;
    try {
      cache[game.bggId] = await findTeseraNames(get, { bggId: game.bggId, primaryName: game.title });
      console.log(`  tesera: ${game.title} → ${cache[game.bggId]?.names[0] ?? "not found"}`);
    } catch (error) {
      console.log(`  tesera: stopped at ${game.title}: ${error instanceof Error ? error.message : String(error)}`);
      break;
    }
  }

  if (asked > 0) writeJson(path, cache);
  return cache;
}

async function collect(shop: ShopCode, options: Options, userAgent: string): Promise<ShopOutcome> {
  const adapter = shopAdapters.find((item) => item.code === shop);
  if (!adapter) return { shop, error: "no adapter" };

  const path = join(CACHE_DIR, `${shop}.json`);
  const cached = options.refresh ? null : readJson<CatalogCache>(path);
  if (cached?.complete) {
    console.log(`  ${shop}: ${cached.products.length} products from ${path}`);
    return { shop, products: cached.products };
  }

  const limit = shop === "lavkaigr" ? options.lavkaPages : shop === "gaga" ? options.gagaLimit : undefined;
  const known = shop === "gaga" ? (cached?.products ?? []) : [];
  const get = createShopGet({ origin: adapter.origin, userAgent });

  try {
    const products = await adapter.listCatalog(get, {
      known,
      limit,
      checkpointEvery: GAGA_SAVE_EVERY,
      onProgress: (done, total) => {
        if (shop === "gaga" && done % GAGA_SAVE_EVERY === 0) console.log(`  gaga: ${done} of ${total ?? "?"} new pages`);
      },
      // A long crawl is saved as it goes, so an error hours in does not lose it.
      onCheckpoint: (soFar) => writeJson(path, { complete: false, products: soFar } satisfies CatalogCache),
    });
    writeJson(path, { complete: limit === undefined, products } satisfies CatalogCache);
    console.log(`  ${shop}: ${products.length} products${limit === undefined ? "" : ` (limited to ${limit})`}`);
    return { shop, products };
  } catch (error) {
    return { shop, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const userAgent = buildUserAgent(process.env.PRICE_BOT_INFO_URL);

  const rows = loadGames();
  console.log(`Games in the BGG cache: ${rows.length}`);

  const tesera = options.teseraGames > 0 ? await addTeseraNames(rows, options.teseraGames, userAgent) : {};
  const games: GameNames[] = rows.map((row) =>
    mergeNames(row.bggId, row.title, row.names, tesera[row.bggId]?.names ?? []),
  );

  console.log("Shops:");
  const outcomes: ShopOutcome[] = [];
  for (const shop of options.shops) outcomes.push(await collect(shop, options, userAgent));

  const products = outcomes.flatMap((outcome) => ("products" in outcome ? outcome.products : []));
  const links = matchProducts(games, products);
  const shuffled = <T>(items: T[], n: number) => [...items].sort(() => Math.random() - 0.5).slice(0, n);
  const report = buildReport(games, outcomes, links, shuffled);

  writeJson(join(CACHE_DIR, "links.json"), links);
  writeJson(join(CACHE_DIR, "report.json"), report);
  console.log(`\n${formatReport(report)}`);

  const partial = options.lavkaPages !== undefined || options.gagaLimit !== undefined;
  if (partial) console.log("\nCatalogues were read partially, so the game counts above are a parser check, not coverage.");
  if (report.shops.some((shop) => shop.error !== null)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
