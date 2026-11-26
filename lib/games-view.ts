import type { ListedGame } from "./bgg/types";
import type { Catalog, CatalogStatus } from "./catalog/types";
import { filterGames, gameTags, tagCounts, type GameFilters } from "./filtering";
import { clampPage, pageCount, pageSlice } from "./pagination";
import { defaultFilters } from "./url-state";
import { buildYearScale } from "./year-scale";

/** What the filter controls offer. Depends on the catalog only, not on the filters. */
export type GameFacets = {
  allTags: string[];
  allLanguages: string[];
  yearScale: number[];
};

/** What the page frame shows around the results: the same for every set of filters. */
export type CatalogFrame = {
  facets: GameFacets;
  status: CatalogStatus;
  /** How many games the catalog holds. */
  total: number;
  /** The tag counts with no filters set, shown until a page brings the counts for its own filters. */
  tagCounts: Map<string, number>;
};

/** The results for one set of filters and one page number. */
export type GamesView = {
  /** The games on this page. */
  games: ListedGame[];
  /** How many games pass the filters, over all pages. */
  shown: number;
  /** How many games the catalog holds. */
  total: number;
  page: number;
  pageCount: number;
  tagCounts: Map<string, number>;
};

export function gameFacets(games: ListedGame[]): GameFacets {
  return {
    allTags: [...new Set(games.flatMap((game) => gameTags(game)))].sort(),
    allLanguages: [...new Set(games.flatMap((game) => game.languages))].sort(),
    yearScale: buildYearScale(games.map((game) => game.year)),
  };
}

export function catalogFrame(catalog: Catalog): CatalogFrame {
  return {
    facets: gameFacets(catalog.games),
    status: catalog.status,
    total: catalog.games.length,
    tagCounts: tagCounts(catalog.games, defaultFilters),
  };
}

/** Filters and sorts the games, then cuts one page. A page number past the end lands on the last page. */
export function gamesView(games: ListedGame[], filters: GameFilters, requestedPage = 1): GamesView {
  const matches = filterGames(games, filters);
  const page = clampPage(requestedPage, matches.length);
  return {
    games: pageSlice(matches, page),
    shown: matches.length,
    total: games.length,
    page,
    pageCount: pageCount(matches.length),
    tagCounts: tagCounts(games, filters),
  };
}
