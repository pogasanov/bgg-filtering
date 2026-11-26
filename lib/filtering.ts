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

function compareGames(sort: SortKey, dir: SortDir) {
  const sign = dir === "asc" ? 1 : -1;
  return (a: ListedGame, b: ListedGame) => {
    const left = a[sort];
    const right = b[sort];
    // Missing values go last whichever way the column is sorted.
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return (left - right) * sign;
  };
}

export function filterGames<Game extends ListedGame>(games: Game[], filters: GameFilters): Game[] {
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
    .sort(compareGames(filters.sort, filters.sortDir ?? defaultSortDir(filters.sort)));
}

/** Games per tag among those passing every filter except the tag selection itself. */
export function tagCounts(games: ListedGame[], filters: GameFilters): Map<string, number> {
  const counts = new Map<string, number>();
  for (const game of filterGames(games, { ...filters, tags: [] })) {
    for (const tag of gameTags(game)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return counts;
}
