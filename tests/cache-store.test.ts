import Database from "better-sqlite3";
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
    expect(games[0].languages).toEqual(["English", "French"]);
    expect(games[0].playerRecommendations["2"].verdict).toBe("best");
  });

  test("replaces stored languages when a game is updated", () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "bgg-cache-")), "cache.sqlite");
    const store = createCacheStore(dbPath);

    store.upsertGames([game], "<items />");
    store.upsertGames([{ ...game, languages: ["German"] }], "<items />");
    const games = store.getGames();
    store.close();

    expect(games[0].languages).toEqual(["German"]);
  });

  test("lists games without their descriptions", () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "bgg-cache-")), "cache.sqlite");
    const store = createCacheStore(dbPath);

    store.upsertGames([game], "<items />");
    const [full] = store.getGames();
    const [listed] = store.getListedGames();
    store.close();

    expect(listed).not.toHaveProperty("description");
    expect({ ...listed, description: game.description }).toEqual(full);
  });

  test("adds empty language storage when opening a legacy cache", () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "bgg-cache-")), "cache.sqlite");
    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE games (
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
      INSERT INTO games (
        bgg_id, rank, title, year, description, geek_rating, average_rating, num_voters,
        min_players, max_players, playing_time, weight, bgg_url, raw_xml, updated_at
      ) VALUES (
        1, 1, 'Legacy Game', 2020, '', 8, 8, 100,
        1, 4, 60, 2, 'https://boardgamegeek.com/boardgame/1', '<items />', '2026-07-22T00:00:00.000Z'
      );
    `);
    legacyDb.close();

    const store = createCacheStore(dbPath);
    const games = store.getGames();
    store.close();

    expect(games).toHaveLength(1);
    expect(games[0].languages).toEqual([]);
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

test("round-trips the thumbnail URL", () => {
  const store = createCacheStore(join(mkdtempSync(join(tmpdir(), "bgg-")), "c.sqlite"));
  store.upsertGames([{ ...game, thumbnailUrl: "https://cf.geekdo-images.com/a/t.jpg" }], "<xml/>");
  expect(store.getGames()[0].thumbnailUrl).toBe("https://cf.geekdo-images.com/a/t.jpg");
  store.close();
});

test("opens a cache file created before thumbnails existed", () => {
  const path = join(mkdtempSync(join(tmpdir(), "bgg-")), "old.sqlite");
  const old = new Database(path);
  old.exec(`CREATE TABLE games (bgg_id INTEGER PRIMARY KEY, rank INTEGER, title TEXT NOT NULL, year INTEGER,
    description TEXT NOT NULL, geek_rating REAL, average_rating REAL, num_voters INTEGER, min_players INTEGER,
    max_players INTEGER, playing_time INTEGER, weight REAL, bgg_url TEXT NOT NULL, raw_xml TEXT NOT NULL, updated_at TEXT NOT NULL);
    INSERT INTO games VALUES (7, 1, 'Old', 2000, '', 7, 7, 10, 2, 4, 60, 2, 'https://boardgamegeek.com/boardgame/7', '', '2026-01-01');`);
  old.close();
  const store = createCacheStore(path);
  expect(store.getGames()[0]).toMatchObject({ id: 7, thumbnailUrl: null });
  store.upsertGames([{ ...game, thumbnailUrl: "https://cf.geekdo-images.com/a/t.jpg" }], "<xml/>");
  expect(store.getGames().find((g) => g.id === 1)?.thumbnailUrl).toBe("https://cf.geekdo-images.com/a/t.jpg");
  store.close();
});
