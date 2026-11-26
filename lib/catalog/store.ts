import { emptyPlayerRecommendations } from "@/lib/bgg/parser";
import {
  playerCounts,
  type NormalizedGame,
  type PlayerCount,
  type PlayerRecommendations,
  type RecommendationVerdict,
  type TopRankItem,
} from "@/lib/bgg/types";
import type { Db } from "@/lib/db/client";
import type { Catalog, SyncRunResult } from "./types";

export const STALE_LOCK_MS = 6 * 60 * 60 * 1000;

/** Turns rows into one array per column, for `unnest` bulk inserts. */
function columns<Row extends unknown[]>(rows: Row[], width: number): unknown[][] {
  return Array.from({ length: width }, (_, index) => rows.map((row) => row[index]));
}

export async function replaceRankedGames(
  db: Db,
  items: TopRankItem[],
  importedAt: Date,
): Promise<{ ranked: number; removedGames: number }> {
  return db.transaction(async (tx) => {
    await tx.query("DELETE FROM ranked_games");
    if (items.length > 0) {
      const rows = items.map((item) => [
        item.id,
        item.rank,
        item.title,
        item.year,
        item.geekRating,
        item.averageRating,
        item.numVoters,
      ]);
      await tx.query(
        `INSERT INTO ranked_games (bgg_id, rank, title, year, geek_rating, average_rating, num_voters, imported_at)
         SELECT t.*, $8::timestamptz
         FROM unnest($1::int[], $2::int[], $3::text[], $4::int[], $5::float8[], $6::float8[], $7::int[]) AS t`,
        [...columns(rows, 7), importedAt],
      );
    }
    const removed = await tx.query(
      "DELETE FROM games WHERE bgg_id NOT IN (SELECT bgg_id FROM ranked_games) RETURNING bgg_id",
    );
    return { ranked: items.length, removedGames: removed.length };
  });
}

export async function getRankedGames(db: Db): Promise<TopRankItem[]> {
  return db.query<TopRankItem>(
    `SELECT bgg_id AS id, rank, title, year, geek_rating AS "geekRating",
            average_rating AS "averageRating", num_voters AS "numVoters"
     FROM ranked_games
     ORDER BY rank`,
  );
}

export async function upsertGames(db: Db, games: NormalizedGame[], updatedAt: Date): Promise<void> {
  if (games.length === 0) return;
  const ids = games.map((game) => game.id);
  const gameRows = games.map((game) => [
    game.id,
    game.rank,
    game.title,
    game.year,
    game.geekRating,
    game.averageRating,
    game.numVoters,
    game.minPlayers,
    game.maxPlayers,
    game.playingTime,
    game.weight,
    game.bggUrl,
  ]);
  const tagRows = games.flatMap((game) => [
    ...game.categories.map((name) => [game.id, "category", name]),
    ...game.mechanics.map((name) => [game.id, "mechanic", name]),
  ]);
  const languageRows = games.flatMap((game) => game.languages.map((name) => [game.id, name]));
  const recommendationRows = games.flatMap((game) =>
    playerCounts.map((count) => {
      const recommendation = game.playerRecommendations[count];
      return [
        game.id,
        count,
        recommendation.best,
        recommendation.recommended,
        recommendation.notRecommended,
        recommendation.verdict,
      ];
    }),
  );

  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO games (
         bgg_id, rank, title, year, geek_rating, average_rating, num_voters,
         min_players, max_players, playing_time, weight, bgg_url, updated_at
       )
       SELECT t.*, $13::timestamptz
       FROM unnest(
         $1::int[], $2::int[], $3::text[], $4::int[], $5::float8[], $6::float8[], $7::int[],
         $8::int[], $9::int[], $10::int[], $11::float8[], $12::text[]
       ) AS t
       ON CONFLICT (bgg_id) DO UPDATE SET
         rank = excluded.rank,
         title = excluded.title,
         year = excluded.year,
         geek_rating = excluded.geek_rating,
         average_rating = excluded.average_rating,
         num_voters = excluded.num_voters,
         min_players = excluded.min_players,
         max_players = excluded.max_players,
         playing_time = excluded.playing_time,
         weight = excluded.weight,
         bgg_url = excluded.bgg_url,
         updated_at = excluded.updated_at`,
      [...columns(gameRows, 12), updatedAt],
    );

    await tx.query("DELETE FROM game_tags WHERE game_id = ANY($1::int[])", [ids]);
    if (tagRows.length > 0) {
      await tx.query(
        `INSERT INTO game_tags (game_id, kind, name)
         SELECT * FROM unnest($1::int[], $2::text[], $3::text[])
         ON CONFLICT DO NOTHING`,
        columns(tagRows, 3),
      );
    }

    await tx.query("DELETE FROM game_languages WHERE game_id = ANY($1::int[])", [ids]);
    if (languageRows.length > 0) {
      await tx.query(
        `INSERT INTO game_languages (game_id, name)
         SELECT * FROM unnest($1::int[], $2::text[])
         ON CONFLICT DO NOTHING`,
        columns(languageRows, 2),
      );
    }

    await tx.query("DELETE FROM player_recommendations WHERE game_id = ANY($1::int[])", [ids]);
    await tx.query(
      `INSERT INTO player_recommendations (
         game_id, player_count, best_votes, recommended_votes, not_recommended_votes, verdict
       )
       SELECT * FROM unnest($1::int[], $2::text[], $3::int[], $4::int[], $5::int[], $6::text[])`,
      columns(recommendationRows, 6),
    );
  });
}

export async function tryStartSync(
  db: Db,
  now: Date,
  staleAfterMs = STALE_LOCK_MS,
): Promise<{ started: true; syncRunId: number } | { started: false; syncRunId: null }> {
  return db.transaction(async (tx) => {
    const stale = await tx.query<{ sync_run_id: number }>(
      "DELETE FROM sync_lock WHERE locked_at < $1 RETURNING sync_run_id",
      [new Date(now.getTime() - staleAfterMs)],
    );
    for (const { sync_run_id: staleRunId } of stale) {
      await tx.query(
        "UPDATE sync_runs SET status = 'error', error_message = 'stale lock released', finished_at = $2 WHERE id = $1",
        [staleRunId, now],
      );
    }

    const [run] = await tx.query<{ id: number }>(
      "INSERT INTO sync_runs (started_at, status) VALUES ($1, 'running') RETURNING id",
      [now],
    );
    const locked = await tx.query(
      `INSERT INTO sync_lock (id, sync_run_id, locked_at) VALUES (1, $1, $2)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [run.id, now],
    );
    if (locked.length === 0) {
      await tx.query("DELETE FROM sync_runs WHERE id = $1", [run.id]);
      return { started: false as const, syncRunId: null };
    }
    return { started: true as const, syncRunId: run.id };
  });
}

export async function finishSync(db: Db, syncRunId: number, result: SyncRunResult, now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query(
      `UPDATE sync_runs
       SET finished_at = $2, status = $3, fetched_count = $4, failed_ids = $5::int[], error_message = $6
       WHERE id = $1`,
      [syncRunId, now, result.status, result.fetchedCount, result.failedIds, result.errorMessage],
    );
    await tx.query("DELETE FROM sync_lock WHERE sync_run_id = $1", [syncRunId]);
  });
}

type GameRow = Omit<NormalizedGame, "categories" | "mechanics" | "languages" | "playerRecommendations">;

export async function getCatalog(db: Db): Promise<Catalog> {
  const gameRows = await db.query<GameRow>(
    `SELECT g.bgg_id AS id, g.rank, g.title, g.year, g.geek_rating AS "geekRating",
            g.average_rating AS "averageRating", g.num_voters AS "numVoters",
            g.min_players AS "minPlayers", g.max_players AS "maxPlayers",
            g.playing_time AS "playingTime", g.weight, g.bgg_url AS "bggUrl"
     FROM games g
     JOIN ranked_games r ON r.bgg_id = g.bgg_id
     ORDER BY COALESCE(g.rank, r.rank), g.title`,
  );
  const ids = gameRows.map((game) => game.id);

  const tagRows = await db.query<{ gameId: number; kind: "category" | "mechanic"; name: string }>(
    `SELECT game_id AS "gameId", kind, name FROM game_tags WHERE game_id = ANY($1::int[]) ORDER BY name`,
    [ids],
  );
  const languageRows = await db.query<{ gameId: number; name: string }>(
    `SELECT game_id AS "gameId", name FROM game_languages WHERE game_id = ANY($1::int[]) ORDER BY name`,
    [ids],
  );
  const recommendationRows = await db.query<{
    gameId: number;
    playerCount: PlayerCount;
    best: number;
    recommended: number;
    notRecommended: number;
    verdict: RecommendationVerdict;
  }>(
    `SELECT game_id AS "gameId", player_count AS "playerCount", best_votes AS best,
            recommended_votes AS recommended, not_recommended_votes AS "notRecommended", verdict
     FROM player_recommendations WHERE game_id = ANY($1::int[])`,
    [ids],
  );
  const [status] = await db.query<{ updatedAt: Date | null }>(
    `SELECT max(finished_at) AS "updatedAt" FROM sync_runs WHERE status IN ('success', 'partial')`,
  );

  const tagsByGame = new Map<number, { categories: string[]; mechanics: string[] }>();
  for (const row of tagRows) {
    const tags = tagsByGame.get(row.gameId) ?? { categories: [], mechanics: [] };
    (row.kind === "category" ? tags.categories : tags.mechanics).push(row.name);
    tagsByGame.set(row.gameId, tags);
  }
  const languagesByGame = new Map<number, string[]>();
  for (const row of languageRows) {
    languagesByGame.set(row.gameId, [...(languagesByGame.get(row.gameId) ?? []), row.name]);
  }
  const recommendationsByGame = new Map<number, PlayerRecommendations>();
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

  const games = gameRows.map((game) => ({
    ...game,
    categories: tagsByGame.get(game.id)?.categories ?? [],
    mechanics: tagsByGame.get(game.id)?.mechanics ?? [],
    languages: languagesByGame.get(game.id) ?? [],
    playerRecommendations: recommendationsByGame.get(game.id) ?? emptyPlayerRecommendations(),
  }));

  return {
    games,
    status: {
      gameCount: games.length,
      updatedAt: status?.updatedAt ? new Date(status.updatedAt).toISOString() : null,
    },
  };
}

export async function getDatabaseSizeBytes(db: Db): Promise<number> {
  const [row] = await db.query<{ bytes: number }>(
    "SELECT pg_database_size(current_database())::float8 AS bytes",
  );
  return Number(row.bytes);
}
