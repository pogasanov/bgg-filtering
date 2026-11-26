import { replaceRankedGames } from "@/lib/catalog/store";
import type { Db } from "@/lib/db/client";
import { loadTopRankItems } from "./ranks";

/** Replaces the stored top-N list with the ranked base games from a BGG ranks CSV dump. */
export async function importRanks(
  db: Db,
  csvPath: string,
  limit: number,
  now: Date,
): Promise<{ ranked: number; removedGames: number }> {
  const { items } = await loadTopRankItems(limit, csvPath);
  return replaceRankedGames(db, items, now);
}
