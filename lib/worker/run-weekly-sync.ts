import type { NormalizedGame } from "@/lib/bgg/types";
import { getDatabaseSizeBytes } from "@/lib/catalog/store";
import type { Db } from "@/lib/db/client";
import { runSync, type SyncLog, type SyncOutcome } from "@/lib/sync";

/** 800 MiB: a warning well before Neon Free's 1 GB storage limit blocks writes. */
export const SIZE_WARNING_BYTES = 838860800;

export type WeeklySyncDeps = {
  db: Db;
  fetchBatch: (ids: number[]) => Promise<NormalizedGame[]>;
  log: SyncLog;
  revalidate: () => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  sizeWarningBytes?: number;
};

export async function runWeeklySync(deps: WeeklySyncDeps): Promise<{ outcome: SyncOutcome; exitCode: 0 | 1 }> {
  const { db, fetchBatch, log, revalidate, sleep, sizeWarningBytes = SIZE_WARNING_BYTES } = deps;

  const outcome = await runSync({ db, fetchBatch, log, sleep });
  let exitCode: 0 | 1 = outcome.status === "success" || outcome.status === "skipped" ? 0 : 1;

  if (outcome.status === "success" || outcome.status === "partial") {
    try {
      await revalidate();
      log.info("Site revalidated", { syncRunId: outcome.syncRunId });
    } catch (error) {
      log.error("Revalidation failed", error, { syncRunId: outcome.syncRunId });
      exitCode = 1;
    }
  }

  const bytes = await getDatabaseSizeBytes(db);
  if (bytes > sizeWarningBytes) {
    log.warn("Database size is above the warning threshold", { bytes, thresholdBytes: sizeWarningBytes });
  } else {
    log.info("Database size", { bytes });
  }

  return { outcome, exitCode };
}
