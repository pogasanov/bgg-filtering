import { getDb, hasDatabaseUrl, type Db } from "@/lib/db/client";
import type { GameFilters } from "@/lib/filtering";
import { emptyCatalogFrame, emptyGamesView, type CatalogFrame, type GamesView } from "@/lib/games-view";
import { countCatalogGames, countFilteredGames, queryCatalogFrame, queryGame, queryGameNames, queryGamesView } from "./query";
import { EMPTY_HISTORY, getGameHistory, type GameHistory } from "@/lib/prices/history";
import type { ListedGame } from "@/lib/bgg/types";

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

/** How many games pass the filters, over all pages. */
export async function loadShownCount(filters: GameFilters): Promise<number> {
  const db = catalogDb();
  return db ? countFilteredGames(db, filters) : 0;
}

/** One game and its price history, for the game's page; null when the game is not listed. */
export async function loadGame(id: number): Promise<{ game: ListedGame; history: GameHistory } | null> {
  const db = catalogDb();
  if (!db) return null;
  const game = await queryGame(db, id);
  if (!game) return null;
  return { game, history: game.offers.length > 0 ? await getGameHistory(db, id) : EMPTY_HISTORY };
}

export async function loadGameNames(): Promise<{ id: number; title: string; titleRu: string | null }[]> {
  const db = catalogDb();
  return db ? queryGameNames(db) : [];
}
