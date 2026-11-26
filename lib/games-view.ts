import type { ListedGame } from "./bgg/types";
import type { CatalogStatus } from "./catalog/types";

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

/** The frame of a catalog with no games: a local run without a database. */
export function emptyCatalogFrame(): CatalogFrame {
  return {
    facets: { allTags: [], allLanguages: [], yearScale: [] },
    status: { gameCount: 0, updatedAt: null },
    total: 0,
    tagCounts: new Map(),
  };
}

export function emptyGamesView(): GamesView {
  return { games: [], shown: 0, total: 0, page: 1, pageCount: 1, tagCounts: new Map() };
}
