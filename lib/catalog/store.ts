import { asc, eq, inArray, lt, notInArray, sql } from "drizzle-orm";
import { playerCounts, type NormalizedGame, type TopRankItem } from "@/lib/bgg/types";
import { resultRows, type Db } from "@/lib/db/client";
import {
  gameLanguages,
  games,
  gameTags,
  playerRecommendations,
  rankedGames,
  syncLock,
  syncRuns,
} from "@/lib/db/schema";
import type { SyncRunResult } from "./types";

export const STALE_LOCK_MS = 6 * 60 * 60 * 1000;

/**
 * For an upsert that overwrites the stored row: each listed property set to the incoming
 * row's value. Drizzle keys `set` by property name ("geekRating") while SQL's `excluded`
 * needs the column name ("geek_rating"); a key Drizzle does not know is silently ignored,
 * so the two are paired here from the table itself rather than written by hand.
 */
function excludedColumns<Key extends keyof typeof games.$inferInsert>(...keys: Key[]) {
  return Object.fromEntries(keys.map((key) => [key, sql.raw(`excluded."${games[key].name}"`)]));
}

export async function replaceRankedGames(
  db: Db,
  items: TopRankItem[],
  importedAt: Date,
): Promise<{ ranked: number; removedGames: number }> {
  return db.transaction(async (tx) => {
    await tx.delete(rankedGames);
    if (items.length > 0) {
      await tx.insert(rankedGames).values(
        items.map((item) => ({
          bggId: item.id,
          rank: item.rank,
          title: item.title,
          year: item.year,
          geekRating: item.geekRating,
          averageRating: item.averageRating,
          numVoters: item.numVoters,
          importedAt,
        })),
      );
    }
    const removed = await tx
      .delete(games)
      .where(notInArray(games.bggId, tx.select({ id: rankedGames.bggId }).from(rankedGames)))
      .returning({ id: games.bggId });
    return { ranked: items.length, removedGames: removed.length };
  });
}

export async function getRankedGames(db: Db): Promise<TopRankItem[]> {
  return db
    .select({
      id: rankedGames.bggId,
      rank: rankedGames.rank,
      title: rankedGames.title,
      year: rankedGames.year,
      geekRating: rankedGames.geekRating,
      averageRating: rankedGames.averageRating,
      numVoters: rankedGames.numVoters,
    })
    .from(rankedGames)
    .orderBy(asc(rankedGames.rank));
}

export async function upsertGames(db: Db, rows: NormalizedGame[], updatedAt: Date): Promise<void> {
  if (rows.length === 0) return;
  const ids = rows.map((game) => game.id);
  const tagRows = rows.flatMap((game) => [
    ...game.categories.map((name) => ({ gameId: game.id, kind: "category" as const, name })),
    ...game.mechanics.map((name) => ({ gameId: game.id, kind: "mechanic" as const, name })),
  ]);
  const languageRows = rows.flatMap((game) => game.languages.map((name) => ({ gameId: game.id, name })));
  const recommendationRows = rows.flatMap((game) =>
    playerCounts.map((count) => {
      const recommendation = game.playerRecommendations[count];
      return {
        gameId: game.id,
        playerCount: count,
        bestVotes: recommendation.best,
        recommendedVotes: recommendation.recommended,
        notRecommendedVotes: recommendation.notRecommended,
        verdict: recommendation.verdict,
      };
    }),
  );

  await db.transaction(async (tx) => {
    await tx
      .insert(games)
      .values(
        rows.map((game) => ({
          bggId: game.id,
          rank: game.rank,
          title: game.title,
          ruNames: game.ruNames,
          alternateNames: game.alternateNames ?? [],
          publisherIds: game.publisherIds ?? [],
          year: game.year,
          geekRating: game.geekRating,
          averageRating: game.averageRating,
          numVoters: game.numVoters,
          minPlayers: game.minPlayers,
          maxPlayers: game.maxPlayers,
          playingTime: game.playingTime,
          weight: game.weight,
          bggUrl: game.bggUrl,
          thumbnailUrl: game.thumbnailUrl,
          updatedAt,
        })),
      )
      .onConflictDoUpdate({
        target: games.bggId,
        set: excludedColumns(
          "rank",
          "title",
          "ruNames",
          "alternateNames",
          "publisherIds",
          "year",
          "geekRating",
          "averageRating",
          "numVoters",
          "minPlayers",
          "maxPlayers",
          "playingTime",
          "weight",
          "bggUrl",
          "thumbnailUrl",
          "updatedAt",
        ),
      });

    await tx.delete(gameTags).where(inArray(gameTags.gameId, ids));
    if (tagRows.length > 0) await tx.insert(gameTags).values(tagRows).onConflictDoNothing();

    await tx.delete(gameLanguages).where(inArray(gameLanguages.gameId, ids));
    if (languageRows.length > 0) await tx.insert(gameLanguages).values(languageRows).onConflictDoNothing();

    await tx.delete(playerRecommendations).where(inArray(playerRecommendations.gameId, ids));
    await tx.insert(playerRecommendations).values(recommendationRows);
  });
}

export async function tryStartSync(
  db: Db,
  now: Date,
  staleAfterMs = STALE_LOCK_MS,
): Promise<{ started: true; syncRunId: number } | { started: false; syncRunId: null }> {
  return db.transaction(async (tx) => {
    const stale = await tx
      .delete(syncLock)
      .where(lt(syncLock.lockedAt, new Date(now.getTime() - staleAfterMs)))
      .returning({ syncRunId: syncLock.syncRunId });
    if (stale.length > 0) {
      await tx
        .update(syncRuns)
        .set({ status: "error", errorMessage: "stale lock released", finishedAt: now })
        .where(
          inArray(
            syncRuns.id,
            stale.map((row) => row.syncRunId),
          ),
        );
    }

    const [run] = await tx.insert(syncRuns).values({ startedAt: now, status: "running" }).returning({ id: syncRuns.id });
    const locked = await tx
      .insert(syncLock)
      .values({ id: 1, syncRunId: run.id, lockedAt: now })
      .onConflictDoNothing()
      .returning({ id: syncLock.id });
    if (locked.length === 0) {
      await tx.delete(syncRuns).where(eq(syncRuns.id, run.id));
      return { started: false as const, syncRunId: null };
    }
    return { started: true as const, syncRunId: run.id };
  });
}

export async function finishSync(db: Db, syncRunId: number, result: SyncRunResult, now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(syncRuns)
      .set({
        finishedAt: now,
        status: result.status,
        fetchedCount: result.fetchedCount,
        failedIds: result.failedIds,
        errorMessage: result.errorMessage,
      })
      .where(eq(syncRuns.id, syncRunId));
    await tx.delete(syncLock).where(eq(syncLock.syncRunId, syncRunId));
  });
}

export async function getDatabaseSizeBytes(db: Db): Promise<number> {
  const [row] = resultRows<{ bytes: number }>(
    await db.execute(sql`select pg_database_size(current_database())::float8 as bytes`),
  );
  return Number(row.bytes);
}

