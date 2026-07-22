import type { MatrixSelection, NormalizedGame, PlayerCount, SortKey } from "./bgg/types";

export type GameFilters = {
  search: string;
  language: string;
  tags: string[];
  matrix: MatrixSelection[];
  sort: SortKey;
  minYear: number | null;
  maxYear: number | null;
};

export function gameTags(game: NormalizedGame): string[] {
  return [...new Set([...game.categories, ...game.mechanics])];
}

function isNotPlayable(game: NormalizedGame, playerCount: PlayerCount): boolean {
  const count = playerCount === "6+" ? 7 : Number(playerCount);
  if (game.minPlayers !== null && count < game.minPlayers) return true;
  if (game.maxPlayers !== null && count > game.maxPlayers) return true;
  return false;
}

function numericSortValue(game: NormalizedGame, sort: SortKey): number {
  if (sort === "rank") return game.rank ?? Number.MAX_SAFE_INTEGER;
  if (sort === "year") return -(game.year ?? 0);
  return -(game[sort] ?? 0);
}

export function filterGames(games: NormalizedGame[], filters: GameFilters): NormalizedGame[] {
  const search = filters.search.trim().toLowerCase();
  const selectedTags = new Set(filters.tags);
  const matrixByPlayerCount = new Map<PlayerCount, MatrixSelection[]>();

  for (const selection of filters.matrix) {
    const selections = matrixByPlayerCount.get(selection.playerCount) ?? [];
    selections.push(selection);
    matrixByPlayerCount.set(selection.playerCount, selections);
  }

  return games
    .filter((game) => {
      if (search && !game.title.toLowerCase().includes(search)) return false;
      if (filters.language && !game.languages.includes(filters.language)) return false;

      if (game.year !== null) {
        if (filters.minYear !== null && game.year < filters.minYear) return false;
        if (filters.maxYear !== null && game.year > filters.maxYear) return false;
      }

      if (selectedTags.size > 0) {
        const tags = new Set(gameTags(game));
        if (![...selectedTags].some((tag) => tags.has(tag))) return false;
      }

      if (matrixByPlayerCount.size > 0) {
        return [...matrixByPlayerCount.values()].every((selections) =>
          selections.some((selection) =>
            selection.verdict === "not-playable"
              ? isNotPlayable(game, selection.playerCount)
              : game.playerRecommendations[selection.playerCount]?.verdict === selection.verdict,
          ),
        );
      }

      return true;
    })
    .sort((a, b) => numericSortValue(a, filters.sort) - numericSortValue(b, filters.sort));
}
