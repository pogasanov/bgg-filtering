import type { MatrixSelection, NormalizedGame, SortKey } from "./bgg/types";

export type GameFilters = {
  search: string;
  tags: string[];
  matrix: MatrixSelection[];
  sort: SortKey;
};

function numericSortValue(game: NormalizedGame, sort: SortKey): number {
  if (sort === "rank") return game.rank ?? Number.MAX_SAFE_INTEGER;
  if (sort === "year") return -(game.year ?? 0);
  return -(game[sort] ?? 0);
}

export function filterGames(games: NormalizedGame[], filters: GameFilters): NormalizedGame[] {
  const search = filters.search.trim().toLowerCase();
  const selectedTags = new Set(filters.tags);

  return games
    .filter((game) => {
      if (search && !game.title.toLowerCase().includes(search)) return false;

      if (selectedTags.size > 0) {
        const gameTags = new Set([...game.categories, ...game.mechanics]);
        if (![...selectedTags].some((tag) => gameTags.has(tag))) return false;
      }

      if (filters.matrix.length > 0) {
        return filters.matrix.some((selection) => game.playerRecommendations[selection.playerCount]?.verdict === selection.verdict);
      }

      return true;
    })
    .sort((a, b) => numericSortValue(a, filters.sort) - numericSortValue(b, filters.sort));
}
