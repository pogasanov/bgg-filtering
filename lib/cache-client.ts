import type { NormalizedGame } from "./bgg/types";
import type { CacheStatus } from "./cache/store";

type JsonResponse = { ok: boolean; json: () => Promise<unknown> };
type Fetcher = (url: string) => Promise<JsonResponse>;

/**
 * Loads the cached games and cache status for the browser. Rejects when either request fails,
 * so an error payload is never mistaken for data.
 */
export async function fetchCacheState(
  fetcher: Fetcher = (url) => fetch(url),
): Promise<{ games: NormalizedGame[]; status: CacheStatus }> {
  const [gamesResponse, statusResponse] = await Promise.all([fetcher("/api/games"), fetcher("/api/status")]);
  if (!gamesResponse.ok || !statusResponse.ok) throw new Error("Failed to load the cache state.");
  const { games } = (await gamesResponse.json()) as { games: NormalizedGame[] };
  const status = (await statusResponse.json()) as CacheStatus;
  return { games, status };
}
