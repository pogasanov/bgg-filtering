import type { MatrixSelection, NormalizedGame, PlayerCount, SortDir, SortKey } from "./bgg/types";

export type GameFilters = {
  search: string;
  language: string;
  tags: string[];
  matrix: MatrixSelection[];
  sort: SortKey;
  sortDir?: SortDir;
  minYear: number | null;
  maxYear: number | null;
};

export function gameTags(game: Pick<NormalizedGame, "categories" | "mechanics">): string[] {
  return [...new Set([...game.categories, ...game.mechanics])];
}

export function isNotPlayable(game: Pick<NormalizedGame, "minPlayers" | "maxPlayers">, playerCount: PlayerCount): boolean {
  const count = playerCount === "6+" ? 7 : Number(playerCount);
  if (game.minPlayers !== null && count < game.minPlayers) return true;
  if (game.maxPlayers !== null && count > game.maxPlayers) return true;
  return false;
}

export function defaultSortDir(sort: SortKey): SortDir {
  // Ranks and prices read best from the smallest; everything else from the largest.
  return sort === "rank" || sort === "price" ? "asc" : "desc";
}
