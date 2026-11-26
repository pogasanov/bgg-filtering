import type { Get } from "@/lib/prices/types";

export const TESERA_ORIGIN = "https://api.tesera.ru";
/** How many search results are checked before giving up. Each costs one request. */
const MAX_CANDIDATES = 5;

export type TeseraNames = { alias: string; names: string[] };

type SearchResult = { alias?: unknown };
type GameDetail = { game?: { bggId?: unknown; alias?: unknown; title?: unknown; title2?: unknown; title3?: unknown } };

function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Finds a game on Tesera and returns its Russian and other names.
 * Tesera cannot be queried by BGG ID, so the search goes by name and a result
 * is accepted only when its own `bggId` equals the game's. No match is `null`.
 */
export async function findTeseraNames(get: Get, game: { bggId: number; primaryName: string }): Promise<TeseraNames | null> {
  if (!Number.isInteger(game.bggId) || game.bggId <= 0) return null;

  const searchUrl = `${TESERA_ORIGIN}/search/games?query=${encodeURIComponent(game.primaryName)}&limit=30`;
  const results = parseJson<SearchResult[]>(await get(searchUrl));
  if (!Array.isArray(results)) throw new Error(`Tesera search is unrecognised: ${searchUrl}`);

  const aliases = results
    .map((result) => result.alias)
    .filter((alias): alias is string => typeof alias === "string" && alias !== "")
    .slice(0, MAX_CANDIDATES);

  for (const alias of aliases) {
    let detail: GameDetail | null;
    try {
      detail = parseJson<GameDetail>(await get(`${TESERA_ORIGIN}/games/${encodeURIComponent(alias)}`));
    } catch {
      continue; // A stale search entry must not hide the right game further down.
    }
    if (detail?.game?.bggId !== game.bggId) continue;

    const { title, title2, title3 } = detail.game;
    const names = [title, title2, ...(typeof title3 === "string" ? title3.split(",") : [])]
      .filter((name): name is string => typeof name === "string")
      .map((name) => name.trim())
      .filter((name) => name !== "");
    return { alias, names };
  }

  return null;
}
