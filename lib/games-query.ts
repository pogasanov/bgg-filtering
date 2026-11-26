import type { Catalog } from "./catalog/types";
import type { GameFilters } from "./filtering";
import { buildGamesView, gameFacets, matchGames, type GameFacets, type GameMatches, type GamesView } from "./games-view";
import { serializeFilters } from "./url-state";

/** How many filter combinations keep their result in memory; the least recently used one is dropped first. */
const MAX_CACHED_MATCHES = 200;

type Snapshot = {
  /** Identifies the catalog the results were computed from; a sync changes it. */
  version: string;
  facets: GameFacets;
  matches: Map<string, GameMatches>;
};

let snapshot: Snapshot | null = null;

function cachedMatches(current: Snapshot, catalog: Catalog, filters: GameFilters): GameMatches {
  // The serialised filters name the result: the same view always has the same query string.
  const key = serializeFilters(filters);
  const cached = current.matches.get(key);
  if (cached) {
    // Re-insert so the map order stays "least recently used first".
    current.matches.delete(key);
    current.matches.set(key, cached);
    return cached;
  }

  const matches = matchGames(catalog.games, filters);
  current.matches.set(key, matches);
  if (current.matches.size > MAX_CACHED_MATCHES) {
    current.matches.delete(current.matches.keys().next().value as string);
  }
  return matches;
}

/**
 * One page of the catalog for the filters. The catalog itself comes from the Next.js data cache;
 * this keeps what is computed from it (the filter options and the result of each filter combination)
 * in the server's memory, so a repeated view is not filtered, sorted and counted again.
 * A sync gives the catalog a new update time, which starts the results over.
 */
export function queryGames(catalog: Catalog, filters: GameFilters, page: number): GamesView {
  const version = `${catalog.status.updatedAt}|${catalog.games.length}`;
  if (snapshot?.version !== version) {
    snapshot = { version, facets: gameFacets(catalog.games), matches: new Map() };
  }
  return buildGamesView(
    catalog.games.length,
    snapshot.facets,
    cachedMatches(snapshot, catalog, filters),
    catalog.status,
    page,
  );
}
