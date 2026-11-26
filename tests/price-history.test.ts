import { afterEach, expect, test } from "vitest";
import type { Db } from "@/lib/db/client";
import { getGameHistory, parseGameId } from "@/lib/prices/history";
import { seedOffers } from "./helpers/seed-offers";
import { createTestDb } from "./helpers/test-db";

let close: (() => Promise<void>) | undefined;

async function setup(): Promise<Db> {
  const testDb = await createTestDb();
  close = testDb.close;
  return testDb.db;
}

afterEach(async () => {
  await close?.();
  close = undefined;
});

test("returns history for confirmed links only, oldest first, with the lowest price", async () => {
  const db = await setup();
  await seedOffers(db);

  const history = await getGameHistory(db, 1);

  expect(history.shops).toEqual([
    {
      shop: "lavkaigr",
      checkedAt: "2026-12-09T00:00:00.000Z",
      points: [
        { at: "2026-11-20T00:00:00.000Z", price: 2000, available: true },
        { at: "2026-12-08T00:00:00.000Z", price: 1700, available: true },
      ],
    },
  ]);
  expect(history.lowest).toEqual({ price: 1700, at: "2026-12-08T00:00:00.000Z", shop: "lavkaigr" });
});

test("a game without confirmed shops gives an empty history", async () => {
  const db = await setup();
  await seedOffers(db);

  expect(await getGameHistory(db, 2)).toEqual({ shops: [], lowest: null });
  expect(await getGameHistory(db, 999)).toEqual({ shops: [], lowest: null });
});

test("game ids must be positive integers", () => {
  expect(parseGameId("174430")).toBe(174430);
  for (const bad of ["", "abc", "1.5", "-3", "0", "1e3", " 7", "99999999999999999999"]) {
    expect(parseGameId(bad), bad).toBeNull();
  }
});
