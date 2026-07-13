import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createCacheStore } from "@/lib/cache/store";
import type { NormalizedGame } from "@/lib/bgg/types";

const game: NormalizedGame = {
  id: 1,
  rank: 10,
  title: "Test Game",
  year: 2020,
  description: "A test game.",
  geekRating: 7.8,
  averageRating: 8.1,
  numVoters: 1000,
  minPlayers: 1,
  maxPlayers: 6,
  playingTime: 90,
  weight: 2.5,
  categories: ["Adventure"],
  mechanics: ["Worker Placement"],
  playerRecommendations: {
    "1": { best: 1, recommended: 2, notRecommended: 3, verdict: "not-recommended" },
    "2": { best: 10, recommended: 4, notRecommended: 0, verdict: "best" },
    "3": { best: 2, recommended: 12, notRecommended: 1, verdict: "recommended" },
    "4": { best: 0, recommended: 7, notRecommended: 2, verdict: "recommended" },
    "5": { best: 0, recommended: 4, notRecommended: 5, verdict: "not-recommended" },
    "6": { best: 0, recommended: 3, notRecommended: 6, verdict: "not-recommended" },
    "6+": { best: 0, recommended: 1, notRecommended: 9, verdict: "not-recommended" },
  },
  bggUrl: "https://boardgamegeek.com/boardgame/1",
};

describe("SQLite cache store", () => {
  test("upserts games and can read them after reopening the database", () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "bgg-cache-")), "cache.sqlite");
    const firstStore = createCacheStore(dbPath);
    firstStore.upsertGames([game], "<items />");
    firstStore.close();

    const secondStore = createCacheStore(dbPath);
    const games = secondStore.getGames();
    secondStore.close();

    expect(games).toHaveLength(1);
    expect(games[0].title).toBe("Test Game");
    expect(games[0].categories).toEqual(["Adventure"]);
    expect(games[0].mechanics).toEqual(["Worker Placement"]);
    expect(games[0].playerRecommendations["2"].verdict).toBe("best");
  });

  test("prevents overlapping sync runs with a durable lock row", () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "bgg-cache-")), "cache.sqlite");
    const store = createCacheStore(dbPath);

    const first = store.tryStartSync();
    if (!first.started) throw new Error("Expected first sync to start");
    const second = store.tryStartSync();
    store.finishSync(first.syncRunId, "success", 0);
    const third = store.tryStartSync();
    store.close();

    expect(first.started).toBe(true);
    expect(second.started).toBe(false);
    expect(third.started).toBe(true);
  });
});
