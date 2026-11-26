import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test, vi } from "vitest";
import { getCatalog, replaceRankedGames, tryStartSync } from "@/lib/catalog/store";
import type { Db } from "@/lib/db/client";
import { runSync, withRankFallback } from "@/lib/sync";
import { makeGame, makeRanked, spyLog } from "./helpers/fixtures";
import { createTestDb, rows } from "./helpers/test-db";

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

async function lockRows(db: Db) {
  return rows(db, sql`select * from sync_lock`);
}

describe("runSync", () => {
  test("writes every batch and reports success", async () => {
    const db = await setup([1, 2, 3]);
    const fetchBatch = vi.fn(async (ids: number[]) => ids.map((id) => makeGame(id)));

    const outcome = await runSync({ db, fetchBatch, log: spyLog(), sleep: noSleep, batchSize: 2, now: () => NOW });

    expect(outcome).toMatchObject({ status: "success", fetchedCount: 3, failedIds: [] });
    expect((await getCatalog(db)).games).toHaveLength(3);
    expect(await lockRows(db)).toEqual([]);
  });

  test("continues past a failed batch and reports partial", async () => {
    const db = await setup([1, 2, 3]);
    const log = spyLog();
    const fetchBatch = vi.fn(async (ids: number[]) => {
      if (ids.includes(3)) throw new Error("BGG request failed 503");
      return ids.map((id) => makeGame(id));
    });

    const outcome = await runSync({ db, fetchBatch, log, sleep: noSleep, batchSize: 2, now: () => NOW });

    expect(outcome).toMatchObject({ status: "partial", fetchedCount: 2, failedIds: [3] });
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledWith(expect.any(String), expect.any(Error), expect.objectContaining({ ids: [3] }));
    expect(await lockRows(db)).toEqual([]);
  });

  test("a database write failure counts as a failed batch", async () => {
    const db = await setup([1, 2, 3]);
    const fetchBatch = vi.fn(async (ids: number[]) =>
      ids.map((id) => makeGame(id, id === 3 ? { title: null as unknown as string } : {})),
    );

    const outcome = await runSync({ db, fetchBatch, log: spyLog(), sleep: noSleep, batchSize: 2, now: () => NOW });

    expect(outcome).toMatchObject({ status: "partial", fetchedCount: 2, failedIds: [3] });
    expect(await lockRows(db)).toEqual([]);
  });

  test("reports error when no batch succeeds", async () => {
    const db = await setup([1, 2]);
    const fetchBatch = vi.fn(async () => {
      throw new Error("down");
    });

    const outcome = await runSync({ db, fetchBatch, log: spyLog(), sleep: noSleep, now: () => NOW });

    expect(outcome.status).toBe("error");
    const [run] = await rows<{ status: string }>(db, sql`select status from sync_runs where id = ${outcome.syncRunId}`);
    expect(run.status).toBe("error");
    expect(await lockRows(db)).toEqual([]);
  });

  test("reports error when no ranked games are imported", async () => {
    const db = await setup([]);
    const fetchBatch = vi.fn();

    const outcome = await runSync({ db, fetchBatch, log: spyLog(), sleep: noSleep, now: () => NOW });

    expect(outcome.status).toBe("error");
    const [run] = await rows<{ error_message: string }>(
      db,
      sql`select error_message from sync_runs where id = ${outcome.syncRunId}`,
    );
    expect(run.error_message).toBe("No ranked games imported");
    expect(fetchBatch).not.toHaveBeenCalled();
  });

  test("skips while another run holds the lock", async () => {
    const db = await setup([1]);
    await tryStartSync(db, NOW);
    const fetchBatch = vi.fn();

    const outcome = await runSync({ db, fetchBatch, log: spyLog(), sleep: noSleep, now: () => NOW });

    expect(outcome).toEqual({ status: "skipped", syncRunId: null, fetchedCount: 0, failedIds: [] });
    expect(fetchBatch).not.toHaveBeenCalled();
  });

  test("waits the spacing between batches only", async () => {
    const db = await setup([1, 2, 3, 4, 5]);
    const sleep = vi.fn(async () => {});
    const fetchBatch = vi.fn(async (ids: number[]) => ids.map((id) => makeGame(id)));

    await runSync({ db, fetchBatch, log: spyLog(), sleep, batchSize: 2, now: () => NOW });

    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(5200);
  });
});

describe("withRankFallback", () => {
  test("XML values win and CSV fills gaps", () => {
    const merged = withRankFallback(
      makeGame(1, { rank: 5, geekRating: null }),
      makeRanked(1, { rank: 9, geekRating: 7.1 }),
    );

    expect(merged.rank).toBe(5);
    expect(merged.geekRating).toBe(7.1);
  });
});
