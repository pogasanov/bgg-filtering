import { cacheCatalogOutput } from "@/lib/catalog/cached";
import { getDb, hasDatabaseUrl } from "@/lib/db/client";
import { EMPTY_HISTORY, getGameHistory, type GameHistory } from "./history";

/**
 * One game's price history, kept in the cache with the rest of the catalog output: reopening a
 * row does not reach the database, and a price run that invalidates the catalog refreshes it.
 */
export async function loadGameHistory(bggId: number): Promise<GameHistory> {
  "use cache";
  cacheCatalogOutput();
  if (!hasDatabaseUrl()) return EMPTY_HISTORY;
  return getGameHistory(getDb(), bggId);
}
