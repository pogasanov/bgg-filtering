import type { MatrixSelection, ListedGame, PlayerCount, SortDir, SortKey } from "./bgg/types";

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

export function gameTags(game: ListedGame): string[] {
  return [...new Set([...game.categories, ...game.mechanics])];
}

export function isNotPlayable(game: ListedGame, playerCount: PlayerCount): boolean {
  const count = playerCount === "6+" ? 7 : Number(playerCount);
  if (game.minPlayers !== null && count < game.minPlayers) return true;
  if (game.maxPlayers !== null && count > game.maxPlayers) return true;
  return false;
}

export function defaultSortDir(sort: SortKey): SortDir {
  return sort === "rank" ? "asc" : "desc";
}
