import { getDb, hasDatabaseUrl, type Db } from "@/lib/db/client";
import type { GameFilters } from "@/lib/filtering";
import { emptyCatalogFrame, emptyGamesView, type CatalogFrame, type GamesView } from "@/lib/games-view";
import { countCatalogGames, queryCatalogFrame, queryGamesView } from "./query";

export const CATALOG_TAG = "bgg-catalog";

/**
 * The database the site reads. Without DATABASE_URL a local build renders an empty catalog;
 * on Vercel that is a misconfiguration.
 */
function catalogDb(): Db | null {
  if (hasDatabaseUrl()) return getDb();
  if (process.env.VERCEL === "1") throw new Error("DATABASE_URL is not set");
  return null;
}

/** One page of results, filtered and sorted in Postgres. Cache the rendered output, not this. */
export async function loadGamesView(filters: GameFilters, page: number): Promise<GamesView> {
  const db = catalogDb();
  return db ? queryGamesView(db, filters, page) : emptyGamesView();
}

/** The filter options and counts with no filters set. */
export async function loadFrame(): Promise<CatalogFrame> {
  const db = catalogDb();
  return db ? queryCatalogFrame(db) : emptyCatalogFrame();
}

export async function loadGameCount(): Promise<number> {
  const db = catalogDb();
  return db ? countCatalogGames(db) : 0;
}
