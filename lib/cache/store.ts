import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { emptyPlayerRecommendations } from "@/lib/bgg/parser";
import { playerCounts, type NormalizedGame, type PlayerCount, type RecommendationVerdict } from "@/lib/bgg/types";

type SyncStart =
  | {
      started: true;
      syncRunId: number;
    }
  | {
      started: false;
      syncRunId: null;
    };

type StatusRow = {
  gameCount: number;
  cacheUpdatedAt: string | null;
  latestSyncStatus: string | null;
  latestSyncStartedAt: string | null;
  latestSyncFinishedAt: string | null;
  latestSyncFetchedCount: number | null;
  latestSyncError: string | null;
  syncLocked: number;
};

export type CacheStatus = {
  gameCount: number;
  cacheUpdatedAt: string | null;
  latestSync: {
    status: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    fetchedCount: number | null;
    error: string | null;
  };
  syncLocked: boolean;
};

export class CacheStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    const absolutePath = resolve(dbPath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    this.db = new Database(absolutePath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  close() {
    this.db.close();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        status TEXT NOT NULL,
        fetched_count INTEGER NOT NULL DEFAULT 0,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS sync_lock (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        sync_run_id INTEGER NOT NULL,
        locked_at TEXT NOT NULL,
        FOREIGN KEY (sync_run_id) REFERENCES sync_runs(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS rank_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        raw_payload TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS games (
        bgg_id INTEGER PRIMARY KEY,
        rank INTEGER,
        title TEXT NOT NULL,
        year INTEGER,
        description TEXT NOT NULL,
        geek_rating REAL,
        average_rating REAL,
        num_voters INTEGER,
        min_players INTEGER,
        max_players INTEGER,
        playing_time INTEGER,
        weight REAL,
        bgg_url TEXT NOT NULL,
        raw_xml TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS game_tags (
        game_id INTEGER NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('category', 'mechanic')),
        name TEXT NOT NULL,
        PRIMARY KEY (game_id, kind, name),
        FOREIGN KEY (game_id) REFERENCES games(bgg_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS player_recommendations (
        game_id INTEGER NOT NULL,
        player_count TEXT NOT NULL,
        best_votes INTEGER NOT NULL,
        recommended_votes INTEGER NOT NULL,
        not_recommended_votes INTEGER NOT NULL,
        verdict TEXT NOT NULL,
        PRIMARY KEY (game_id, player_count),
        FOREIGN KEY (game_id) REFERENCES games(bgg_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_games_rank ON games(rank);
      CREATE INDEX IF NOT EXISTS idx_game_tags_name ON game_tags(name);
      CREATE INDEX IF NOT EXISTS idx_player_recommendations_lookup
        ON player_recommendations(player_count, verdict);
    `);
  }

  tryStartSync(): SyncStart {
    const start = this.db.transaction(() => {
      const existingLock = this.db.prepare("SELECT id FROM sync_lock WHERE id = 1").get();
      if (existingLock) return { started: false as const, syncRunId: null };

      const now = new Date().toISOString();
      const result = this.db
        .prepare("INSERT INTO sync_runs (started_at, status) VALUES (?, 'running')")
        .run(now);
      const syncRunId = Number(result.lastInsertRowid);
      this.db.prepare("INSERT INTO sync_lock (id, sync_run_id, locked_at) VALUES (1, ?, ?)").run(syncRunId, now);
      return { started: true as const, syncRunId };
    });

    return start();
  }

  finishSync(syncRunId: number, status: "success" | "error", fetchedCount: number, errorMessage: string | null = null) {
    const finish = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE sync_runs
           SET finished_at = ?, status = ?, fetched_count = ?, error_message = ?
           WHERE id = ?`,
        )
        .run(new Date().toISOString(), status, fetchedCount, errorMessage, syncRunId);
      this.db.prepare("DELETE FROM sync_lock WHERE sync_run_id = ?").run(syncRunId);
    });

    finish();
  }

  insertRankSnapshot(source: string, rawPayload: string) {
    this.db
      .prepare("INSERT INTO rank_snapshots (source, fetched_at, raw_payload) VALUES (?, ?, ?)")
      .run(source, new Date().toISOString(), rawPayload);
  }

  upsertGames(games: NormalizedGame[], rawXmlByGameId: string | Record<number, string>) {
    const rawXmlFor = (id: number) => (typeof rawXmlByGameId === "string" ? rawXmlByGameId : rawXmlByGameId[id] ?? "");
    const upsert = this.db.transaction(() => {
      const now = new Date().toISOString();
      const gameStmt = this.db.prepare(`
        INSERT INTO games (
          bgg_id, rank, title, year, description, geek_rating, average_rating, num_voters,
          min_players, max_players, playing_time, weight, bgg_url, raw_xml, updated_at
        )
        VALUES (
          @id, @rank, @title, @year, @description, @geekRating, @averageRating, @numVoters,
          @minPlayers, @maxPlayers, @playingTime, @weight, @bggUrl, @rawXml, @updatedAt
        )
        ON CONFLICT(bgg_id) DO UPDATE SET
          rank = excluded.rank,
          title = excluded.title,
          year = excluded.year,
          description = excluded.description,
          geek_rating = excluded.geek_rating,
          average_rating = excluded.average_rating,
          num_voters = excluded.num_voters,
          min_players = excluded.min_players,
          max_players = excluded.max_players,
          playing_time = excluded.playing_time,
          weight = excluded.weight,
          bgg_url = excluded.bgg_url,
          raw_xml = excluded.raw_xml,
          updated_at = excluded.updated_at
      `);
      const deleteTagsStmt = this.db.prepare("DELETE FROM game_tags WHERE game_id = ?");
      const tagStmt = this.db.prepare("INSERT OR IGNORE INTO game_tags (game_id, kind, name) VALUES (?, ?, ?)");
      const deleteRecommendationsStmt = this.db.prepare("DELETE FROM player_recommendations WHERE game_id = ?");
      const recommendationStmt = this.db.prepare(`
        INSERT INTO player_recommendations (
          game_id, player_count, best_votes, recommended_votes, not_recommended_votes, verdict
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const game of games) {
        gameStmt.run({ ...game, rawXml: rawXmlFor(game.id), updatedAt: now });
        deleteTagsStmt.run(game.id);
        for (const category of game.categories) tagStmt.run(game.id, "category", category);
        for (const mechanic of game.mechanics) tagStmt.run(game.id, "mechanic", mechanic);
        deleteRecommendationsStmt.run(game.id);
        for (const count of playerCounts) {
          const recommendation = game.playerRecommendations[count];
          recommendationStmt.run(
            game.id,
            count,
            recommendation.best,
            recommendation.recommended,
            recommendation.notRecommended,
            recommendation.verdict,
          );
        }
      }
    });

    upsert();
  }

  getGames(): NormalizedGame[] {
    const gameRows = this.db
      .prepare(
        `SELECT
          bgg_id AS id, rank, title, year, description, geek_rating AS geekRating,
          average_rating AS averageRating, num_voters AS numVoters, min_players AS minPlayers,
          max_players AS maxPlayers, playing_time AS playingTime, weight, bgg_url AS bggUrl
        FROM games
        ORDER BY COALESCE(rank, 999999), title`,
      )
      .all() as Array<Omit<NormalizedGame, "categories" | "mechanics" | "playerRecommendations">>;
    const tagRows = this.db.prepare("SELECT game_id AS gameId, kind, name FROM game_tags ORDER BY name").all() as Array<{
      gameId: number;
      kind: "category" | "mechanic";
      name: string;
    }>;
    const recommendationRows = this.db
      .prepare(
        `SELECT game_id AS gameId, player_count AS playerCount, best_votes AS best,
          recommended_votes AS recommended, not_recommended_votes AS notRecommended, verdict
         FROM player_recommendations`,
      )
      .all() as Array<{
      gameId: number;
      playerCount: PlayerCount;
      best: number;
      recommended: number;
      notRecommended: number;
      verdict: RecommendationVerdict;
    }>;

    const tagsByGame = new Map<number, { categories: string[]; mechanics: string[] }>();
    for (const row of tagRows) {
      const tags = tagsByGame.get(row.gameId) ?? { categories: [], mechanics: [] };
      if (row.kind === "category") tags.categories.push(row.name);
      if (row.kind === "mechanic") tags.mechanics.push(row.name);
      tagsByGame.set(row.gameId, tags);
    }

    const recommendationsByGame = new Map<number, ReturnType<typeof emptyPlayerRecommendations>>();
    for (const row of recommendationRows) {
      const recommendations = recommendationsByGame.get(row.gameId) ?? emptyPlayerRecommendations();
      recommendations[row.playerCount] = {
        best: row.best,
        recommended: row.recommended,
        notRecommended: row.notRecommended,
        verdict: row.verdict,
      };
      recommendationsByGame.set(row.gameId, recommendations);
    }

    return gameRows.map((game) => ({
      ...game,
      categories: tagsByGame.get(game.id)?.categories ?? [],
      mechanics: tagsByGame.get(game.id)?.mechanics ?? [],
      playerRecommendations: recommendationsByGame.get(game.id) ?? emptyPlayerRecommendations(),
    }));
  }

  getStatus(): CacheStatus {
    const row = this.db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM games) AS gameCount,
          (SELECT MAX(updated_at) FROM games) AS cacheUpdatedAt,
          sr.status AS latestSyncStatus,
          sr.started_at AS latestSyncStartedAt,
          sr.finished_at AS latestSyncFinishedAt,
          sr.fetched_count AS latestSyncFetchedCount,
          sr.error_message AS latestSyncError,
          EXISTS(SELECT 1 FROM sync_lock WHERE id = 1) AS syncLocked
        FROM (SELECT 1) singleton
        LEFT JOIN sync_runs sr ON sr.id = (SELECT MAX(id) FROM sync_runs)`,
      )
      .get() as StatusRow;

    return {
      gameCount: row.gameCount,
      cacheUpdatedAt: row.cacheUpdatedAt,
      latestSync: {
        status: row.latestSyncStatus,
        startedAt: row.latestSyncStartedAt,
        finishedAt: row.latestSyncFinishedAt,
        fetchedCount: row.latestSyncFetchedCount,
        error: row.latestSyncError,
      },
      syncLocked: Boolean(row.syncLocked),
    };
  }
}

export function getDefaultCachePath() {
  return process.env.BGG_CACHE_PATH ?? "./data/bgg-cache.sqlite";
}

export function createCacheStore(dbPath = getDefaultCachePath()) {
  return new CacheStore(dbPath);
}
