import { statSync } from "node:fs";
import type { ListedGame } from "./bgg/types";
import { createCacheStore, getDefaultCachePath, type CacheStatus } from "./cache/store";
import type { GameFilters } from "./filtering";
import { buildGamesView, gameFacets, matchGames, type GameFacets, type GameMatches, type GamesView } from "./games-view";
import { serializeFilters } from "./url-state";

/** How many filter combinations keep their result in memory; the least recently used one is dropped first. */
const MAX_CACHED_MATCHES = 200;

type Snapshot = {
  /** Changes whenever the database is written to, which makes the whole snapshot stale. */
  version: string;
  games: ListedGame[];
  status: CacheStatus;
  facets: GameFacets;
  matches: Map<string, GameMatches>;
};

let snapshot: Snapshot | null = null;

/**
 * Identifies the database contents by the size and modification time of its files. Every write lands in
 * the database or its write-ahead log, so this notices a sync from any process without opening the
 * database: on a large cache even counting the games takes longer than answering from memory.
 */
function databaseVersion(dbPath: string): string {
  return [dbPath, `${dbPath}-wal`]
    .map((path) => {
      const stats = statSync(path, { throwIfNoEntry: false });
      return stats ? `${path}:${stats.mtimeMs}:${stats.size}` : `${path}:none`;
    })
    .join("|");
}

function cachedMatches(current: Snapshot, filters: GameFilters): GameMatches {
  // The serialised filters name the result: the same view always has the same query string.
  const key = serializeFilters(filters);
  const cached = current.matches.get(key);
  if (cached) {
    // Re-insert so the map order stays "least recently used first".
    current.matches.delete(key);
    current.matches.set(key, cached);
    return cached;
  }

  const matches = matchGames(current.games, filters);
  current.matches.set(key, matches);
  if (current.matches.size > MAX_CACHED_MATCHES) {
    current.matches.delete(current.matches.keys().next().value as string);
  }
  return matches;
}

/**
 * One page of games for the filters. The games and the cache status are read from the database once
 * and kept in memory together with the result of each filter combination, so a repeated view costs
 * no database work at all. Any write to the database (a sync starting or finishing) starts over.
 */
export function queryGames(filters: GameFilters, page: number, dbPath = getDefaultCachePath()): GamesView {
  // Taken before reading: a write that lands during the read leaves a newer version on disk, and the next call reloads.
  const version = databaseVersion(dbPath);
  if (snapshot?.version !== version) {
    const store = createCacheStore(dbPath);
    try {
      const games = store.getListedGames();
      snapshot = { version, games, status: store.getStatus(), facets: gameFacets(games), matches: new Map() };
    } finally {
      store.close();
    }
  }
  return buildGamesView(snapshot.games.length, snapshot.facets, cachedMatches(snapshot, filters), snapshot.status, page);
}
