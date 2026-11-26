import type { ListedGame } from "./bgg/types";
import type { CacheStatus } from "./cache/store";
import { filterGames, gameTags, tagCounts, type GameFilters } from "./filtering";
import { clampPage, pageCount, pageSlice } from "./pagination";
import { buildYearScale } from "./year-scale";

/** What the filter controls offer. Depends on the cached games only, not on the filters. */
export type GameFacets = {
  allTags: string[];
  allLanguages: string[];
  yearScale: number[];
};

/** Every game passing the filters, sorted, and the tag counts for the same filters. */
export type GameMatches = {
  games: ListedGame[];
  tagCounts: Map<string, number>;
};

/** Everything the page shows for one set of filters and one page number. */
export type GamesView = {
  /** The games on this page. */
  games: ListedGame[];
  /** How many games pass the filters, over all pages. */
  shown: number;
  /** How many games the cache holds. */
  total: number;
  page: number;
  pageCount: number;
  tagCounts: Map<string, number>;
  facets: GameFacets;
  status: CacheStatus;
};

export function gameFacets(games: ListedGame[]): GameFacets {
  return {
    allTags: [...new Set(games.flatMap((game) => gameTags(game)))].sort(),
    allLanguages: [...new Set(games.flatMap((game) => game.languages))].sort(),
    yearScale: buildYearScale(games.map((game) => game.year)),
  };
}

export function matchGames(games: ListedGame[], filters: GameFilters): GameMatches {
  return { games: filterGames(games, filters), tagCounts: tagCounts(games, filters) };
}

export function buildGamesView(
  total: number,
  facets: GameFacets,
  matches: GameMatches,
  status: CacheStatus,
  requestedPage: number,
): GamesView {
  const page = clampPage(requestedPage, matches.games.length);
  return {
    games: pageSlice(matches.games, page),
    shown: matches.games.length,
    total,
    page,
    pageCount: pageCount(matches.games.length),
    tagCounts: matches.tagCounts,
    facets,
    status,
  };
}

/** The view straight from a list of games, with nothing cached. */
export function gamesView(games: ListedGame[], status: CacheStatus, filters: GameFilters, page = 1): GamesView {
  return buildGamesView(games.length, gameFacets(games), matchGames(games, filters), status, page);
}
