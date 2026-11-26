import { REQUEST_SPACING_MS, THING_BATCH_SIZE } from "@/lib/bgg/client";
import type { NormalizedGame, TopRankItem } from "@/lib/bgg/types";
import { refreshRussianTitles } from "@/lib/catalog/russian-titles";
import { finishSync, getRankedGames, tryStartSync, upsertGames } from "@/lib/catalog/store";
import type { SyncRunResult } from "@/lib/catalog/types";
import type { Db } from "@/lib/db/client";

export type SyncLog = {
  info(message: string, attributes?: Record<string, unknown>): void;
  warn(message: string, attributes?: Record<string, unknown>): void;
  error(message: string, error: unknown, attributes?: Record<string, unknown>): void;
};

export type SyncOutcome = {
  status: "success" | "partial" | "error" | "skipped";
  syncRunId: number | null;
  fetchedCount: number;
  failedIds: number[];
};

export type SyncDeps = {
  db: Db;
  fetchBatch: (ids: number[]) => Promise<NormalizedGame[]>;
  log: SyncLog;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  batchSize?: number;
  spacingMs?: number;
};

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** XML API values are fresher than the imported CSV, so the CSV only fills gaps. */
export function withRankFallback(game: NormalizedGame, item: TopRankItem | undefined): NormalizedGame {
  if (!item) return game;
  return {
    ...game,
    rank: game.rank ?? item.rank,
    year: game.year ?? item.year,
    geekRating: game.geekRating ?? item.geekRating,
    averageRating: game.averageRating ?? item.averageRating,
    numVoters: game.numVoters ?? item.numVoters,
  };
}

function errorMessageFor(status: SyncRunResult["status"], failedIds: number[]): string | null {
  if (status === "success") return null;
  if (status === "partial") return `${failedIds.length} games failed to sync`;
  return "All batches failed";
}

export async function runSync(deps: SyncDeps): Promise<SyncOutcome> {
  const {
    db,
    fetchBatch,
    log,
    sleep = defaultSleep,
    now = () => new Date(),
    batchSize = THING_BATCH_SIZE,
    spacingMs = REQUEST_SPACING_MS,
  } = deps;

  const startedAt = now();
  const start = await tryStartSync(db, startedAt);
  if (!start.started) {
    log.warn("Sync skipped: another run holds the lock");
    return { status: "skipped", syncRunId: null, fetchedCount: 0, failedIds: [] };
  }
  const { syncRunId } = start;

  try {
    const ranked = await getRankedGames(db);
    if (ranked.length === 0) {
      const message = "No ranked games imported";
      await finishSync(db, syncRunId, { status: "error", fetchedCount: 0, failedIds: [], errorMessage: message }, now());
      log.error("Sync failed: no ranked games imported", new Error(message), { syncRunId });
      return { status: "error", syncRunId, fetchedCount: 0, failedIds: [] };
    }

    log.info("Sync started", { syncRunId, games: ranked.length });
    const rankedById = new Map(ranked.map((item) => [item.id, item]));
    let fetchedCount = 0;
    let succeededBatches = 0;
    const failedIds: number[] = [];

    for (let index = 0; index < ranked.length; index += batchSize) {
      if (index > 0) await sleep(spacingMs);
      const ids = ranked.slice(index, index + batchSize).map((item) => item.id);
      try {
        const games = (await fetchBatch(ids)).map((game) => withRankFallback(game, rankedById.get(game.id)));
        await upsertGames(db, games, now());
        fetchedCount += games.length;
        succeededBatches += 1;
        log.info("Batch synced", { syncRunId, ids, games: games.length });
      } catch (error) {
        failedIds.push(...ids);
        log.error("Batch failed", error, { syncRunId, ids });
      }
    }

    if (succeededBatches > 0) {
      const changed = await refreshRussianTitles(db);
      log.info("Russian titles refreshed", { syncRunId, changed });
    }

    const status: SyncRunResult["status"] =
      failedIds.length === 0 ? "success" : succeededBatches > 0 ? "partial" : "error";
    await finishSync(
      db,
      syncRunId,
      { status, fetchedCount, failedIds, errorMessage: errorMessageFor(status, failedIds) },
      now(),
    );
    log.info("Sync finished", {
      syncRunId,
      status,
      fetchedCount,
      failedIds,
      durationMs: now().getTime() - startedAt.getTime(),
    });
    return { status, syncRunId, fetchedCount, failedIds };
  } catch (error) {
    await finishSync(
      db,
      syncRunId,
      {
        status: "error",
        fetchedCount: 0,
        failedIds: [],
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      now(),
    ).catch(() => undefined);
    throw error;
  }
}
