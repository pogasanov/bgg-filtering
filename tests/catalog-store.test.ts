import { sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";
import {
  finishSync,
  getCatalog,
  replaceRankedGames,
  tryStartSync,
  upsertGames,
} from "@/lib/catalog/store";
import type { Db } from "@/lib/db/client";
import type { NormalizedGame, TopRankItem } from "@/lib/bgg/types";
import { seedOffers } from "./helpers/seed-offers";
import { createTestDb, rows } from "./helpers/test-db";

const NOW = new Date("2026-11-30T03:00:00.000Z");
const SIX_HOURS = 6 * 60 * 60 * 1000;

function game(id: number, overrides: Partial<NormalizedGame> = {}): NormalizedGame {
  return {
    id,
    rank: id,
    title: `Game ${id}`,
    year: 2020,
    thumbnailUrl: null,
    geekRating: 7.8,
    averageRating: 8.1,
    numVoters: 1000,
    minPlayers: 1,
    maxPlayers: 6,
    playingTime: 90,
    weight: 2.5,
    categories: ["Adventure"],
    mechanics: ["Worker Placement"],
    languages: ["English", "French"],
    playerRecommendations: {
      "1": { best: 1, recommended: 2, notRecommended: 3, verdict: "not-recommended" },
      "2": { best: 10, recommended: 4, notRecommended: 0, verdict: "best" },
      "3": { best: 2, recommended: 12, notRecommended: 1, verdict: "recommended" },
      "4": { best: 0, recommended: 7, notRecommended: 2, verdict: "recommended" },
      "5": { best: 0, recommended: 4, notRecommended: 5, verdict: "not-recommended" },
      "6": { best: 0, recommended: 3, notRecommended: 6, verdict: "not-recommended" },
      "6+": { best: 0, recommended: 1, notRecommended: 9, verdict: "not-recommended" },
    },
    bggUrl: `https://boardgamegeek.com/boardgame/${id}`,
    ...overrides,
  };
}

function ranked(id: number): TopRankItem {
  return { id, rank: id, title: `Game ${id}`, year: 2020, geekRating: 7, averageRating: 8, numVoters: 100 };
}

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

describe("catalog store", () => {
  test("shows only ranked games that have details", async () => {
    const db = await setup();
    await replaceRankedGames(db, [ranked(1), ranked(2)], NOW);
    await upsertGames(db, [game(1), game(3)], NOW);

    const catalog = await getCatalog(db);

    expect(catalog.games.map((item) => item.id)).toEqual([1]);
    expect(catalog.status.gameCount).toBe(1);
  });

  test("round-trips tags, languages and recommendations", async () => {
    const db = await setup();
    await replaceRankedGames(db, [ranked(1)], NOW);
    await upsertGames(db, [game(1)], NOW);

    const [stored] = (await getCatalog(db)).games;

    expect(stored.categories).toEqual(["Adventure"]);
    expect(stored.mechanics).toEqual(["Worker Placement"]);
    expect(stored.languages).toEqual(["English", "French"]);
    expect(stored.playerRecommendations["2"].verdict).toBe("best");
    expect(stored.geekRating).toBe(7.8);
  });

  test("round-trips the thumbnail URL", async () => {
    const db = await setup();
    await replaceRankedGames(db, [ranked(1), ranked(2)], NOW);
    await upsertGames(db, [game(1, { thumbnailUrl: "https://cf.geekdo-images.com/a/t.jpg" }), game(2)], NOW);

    const games = (await getCatalog(db)).games;

    expect(games.map((item) => item.thumbnailUrl)).toEqual(["https://cf.geekdo-images.com/a/t.jpg", null]);
  });

  test("replaces languages on update", async () => {
    const db = await setup();
    await replaceRankedGames(db, [ranked(1)], NOW);
    await upsertGames(db, [game(1, { languages: ["English", "French"] })], NOW);
    await upsertGames(db, [game(1, { languages: ["German"] })], NOW);

    expect((await getCatalog(db)).games[0].languages).toEqual(["German"]);
  });

  test("replaceRankedGames removes games that left the list", async () => {
    const db = await setup();
    await replaceRankedGames(db, [ranked(1), ranked(2)], NOW);
    await upsertGames(db, [game(1), game(2)], NOW);

    const result = await replaceRankedGames(db, [ranked(2)], NOW);

    expect(result).toEqual({ ranked: 1, removedGames: 1 });
    const [{ count }] = await rows<{ count: number }>(
      db,
      sql`select count(*)::int as count from game_tags where game_id = 1`,
    );
    expect(count).toBe(0);
  });

  test("tryStartSync refuses while a fresh lock is held", async () => {
    const db = await setup();
    const first = await tryStartSync(db, NOW);
    const second = await tryStartSync(db, new Date(NOW.getTime() + 60_000));

    expect(first.started).toBe(true);
    expect(second).toEqual({ started: false, syncRunId: null });
  });

  test("tryStartSync takes over a lock older than 6 hours", async () => {
    const db = await setup();
    const first = await tryStartSync(db, NOW);
    const second = await tryStartSync(db, new Date(NOW.getTime() + SIX_HOURS + 1000));

    expect(second.started).toBe(true);
    const [stuck] = await rows<{ status: string; error_message: string }>(
      db,
      sql`select status, error_message from sync_runs where id = ${first.syncRunId}`,
    );
    expect(stuck).toEqual({ status: "error", error_message: "stale lock released" });
  });

  test("finishSync releases the lock and stores failed ids", async () => {
    const db = await setup();
    const run = await tryStartSync(db, NOW);
    if (!run.started) throw new Error("expected the run to start");

    await finishSync(
      db,
      run.syncRunId,
      { status: "partial", fetchedCount: 18, failedIds: [5, 6], errorMessage: null },
      NOW,
    );

    expect(await rows(db, sql`select * from sync_lock`)).toEqual([]);
    const [stored] = await rows<{ failed_ids: number[]; status: string }>(
      db,
      sql`select failed_ids, status from sync_runs where id = ${run.syncRunId}`,
    );
    expect(stored).toEqual({ failed_ids: [5, 6], status: "partial" });
  });

  test("updatedAt is the latest success or partial finish", async () => {
    const db = await setup();
    const success = await tryStartSync(db, NOW);
    if (!success.started) throw new Error("expected the run to start");
    await finishSync(
      db,
      success.syncRunId,
      { status: "success", fetchedCount: 1, failedIds: [], errorMessage: null },
      new Date("2026-11-30T03:05:00.000Z"),
    );
    const failed = await tryStartSync(db, new Date("2026-12-07T03:00:00.000Z"));
    if (!failed.started) throw new Error("expected the run to start");
    await finishSync(
      db,
      failed.syncRunId,
      { status: "error", fetchedCount: 0, failedIds: [1], errorMessage: "boom" },
      new Date("2026-12-07T03:01:00.000Z"),
    );

    expect((await getCatalog(db)).status.updatedAt).toBe("2026-11-30T03:05:00.000Z");
  });
});

describe("catalog offers", () => {
  test("attaches current offers from confirmed links only", async () => {
    const db = await setup();
    await seedOffers(db);

    const catalog = await getCatalog(db, new Date("2026-12-10T00:00:00.000Z"));
    const one = catalog.games.find((item) => item.id === 1)!;

    expect(one.offers).toEqual([
      {
        shop: "lavkaigr",
        url: "https://www.lavkaigr.ru/shop/l1",
        price: 1700,
        oldPrice: null,
        available: true,
        checkedAt: "2026-12-09T00:00:00.000Z",
        stale: false,
        salePercent: 15,
      },
    ]);
    expect(one.bestPrice).toBe(1700);
    expect(catalog.games.find((item) => item.id === 2)).toMatchObject({ offers: [], bestPrice: null });
  });

  test("a shop not checked for three days stops counting towards the best price", async () => {
    const db = await setup();
    await seedOffers(db);

    const one = (await getCatalog(db, new Date("2026-12-13T00:00:00.000Z"))).games.find((item) => item.id === 1)!;

    expect(one.offers[0].stale).toBe(true);
    expect(one.bestPrice).toBeNull();
  });

  test("a price that has held for over a month is not a sale", async () => {
    const db = await setup();
    await seedOffers(db);

    const one = (await getCatalog(db, new Date("2027-02-01T00:00:00.000Z"))).games.find((item) => item.id === 1)!;

    expect(one.offers[0].salePercent).toBeNull();
  });
});
