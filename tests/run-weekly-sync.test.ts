import { afterEach, describe, expect, test, vi } from "vitest";
import { replaceRankedGames, tryStartSync } from "@/lib/catalog/store";
import type { Db } from "@/lib/db/client";
import { runWeeklySync } from "@/lib/worker/run-weekly-sync";
import { makeGame, makeRanked, spyLog } from "./helpers/fixtures";
import { createTestDb } from "./helpers/test-db";

const NOW = new Date("2026-11-30T03:00:00.000Z");
const noSleep = async () => {};

let close: (() => Promise<void>) | undefined;

async function setup(rankedIds: number[]): Promise<Db> {
  const testDb = await createTestDb();
  close = testDb.close;
  await replaceRankedGames(testDb.db, rankedIds.map((id) => makeRanked(id)), NOW);
  return testDb.db;
}

afterEach(async () => {
  await close?.();
  close = undefined;
});

const allGood = async (ids: number[]) => ids.map((id) => makeGame(id));

describe("runWeeklySync", () => {
  test("revalidates and exits 0 on success", async () => {
    const db = await setup([1, 2]);
    const revalidate = vi.fn(async () => {});

    const result = await runWeeklySync({ db, fetchBatch: allGood, log: spyLog(), revalidate, sleep: noSleep });

    expect(result.outcome.status).toBe("success");
    expect(result.exitCode).toBe(0);
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  test("revalidates and exits 1 on partial", async () => {
    const db = await setup(Array.from({ length: 21 }, (_, index) => index + 1));
    const revalidate = vi.fn(async () => {});
    const fetchBatch = async (ids: number[]) => {
      if (ids.includes(21)) throw new Error("BGG request failed 503");
      return allGood(ids);
    };

    const result = await runWeeklySync({ db, fetchBatch, log: spyLog(), revalidate, sleep: noSleep });

    expect(result.outcome.status).toBe("partial");
    expect(result.exitCode).toBe(1);
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  test("does not revalidate and exits 1 on error", async () => {
    const db = await setup([1]);
    const revalidate = vi.fn(async () => {});
    const fetchBatch = async () => {
      throw new Error("down");
    };

    const result = await runWeeklySync({ db, fetchBatch, log: spyLog(), revalidate, sleep: noSleep });

    expect(result.outcome.status).toBe("error");
    expect(result.exitCode).toBe(1);
    expect(revalidate).not.toHaveBeenCalled();
  });

  test("exits 0 without revalidating when skipped", async () => {
    const db = await setup([1]);
    await tryStartSync(db, new Date());
    const revalidate = vi.fn(async () => {});

    const result = await runWeeklySync({ db, fetchBatch: allGood, log: spyLog(), revalidate, sleep: noSleep });

    expect(result.outcome.status).toBe("skipped");
    expect(result.exitCode).toBe(0);
    expect(revalidate).not.toHaveBeenCalled();
  });

  test("exits 1 when revalidation fails", async () => {
    const db = await setup([1]);
    const log = spyLog();
    const revalidate = vi.fn(async () => {
      throw new Error("Revalidation failed with 401");
    });

    const result = await runWeeklySync({ db, fetchBatch: allGood, log, revalidate, sleep: noSleep });

    expect(result.exitCode).toBe(1);
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining("Revalidation"), expect.any(Error), expect.anything());
  });

  test("warns when the database is over the size limit", async () => {
    const db = await setup([1]);
    const log = spyLog();

    await runWeeklySync({
      db,
      fetchBatch: allGood,
      log,
      revalidate: async () => {},
      sleep: noSleep,
      sizeWarningBytes: 1,
    });

    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("Database size"),
      expect.objectContaining({ bytes: expect.any(Number) }),
    );
  });
});
