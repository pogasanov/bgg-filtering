import { unstable_cache } from "next/cache";
import { CATALOG_TAG } from "@/lib/catalog/load";
import { queryListedIds } from "@/lib/catalog/query";
import { getDb, hasDatabaseUrl } from "@/lib/db/client";
import { EMPTY_HISTORY, getGameHistory, type GameHistory } from "./history";

const HALF_DAY = 12 * 60 * 60;
const options = { tags: [CATALOG_TAG], revalidate: HALF_DAY };

// The data cache: it outlives a single server instance, so reopening a row does not reach the
// database, and a sync or price run that invalidates CATALOG_TAG refreshes it.
const cachedHistory = unstable_cache(async (bggId: number) => getGameHistory(getDb(), bggId), ["game-prices"], options);

// A few thousand integers, read once per cache lifetime.
const cachedListedIds = unstable_cache(async () => queryListedIds(getDb()), ["listed-game-ids"], options);

/** One game's price history for the panel under its row. */
export async function loadGameHistory(bggId: number): Promise<GameHistory> {
  if (!hasDatabaseUrl()) return EMPTY_HISTORY;
  // Only listed games are looked up, so made-up ids cannot reach the database or fill the cache.
  const listed = (await cachedListedIds()).includes(bggId);
  return listed ? cachedHistory(bggId) : EMPTY_HISTORY;
}
