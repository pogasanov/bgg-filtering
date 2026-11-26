import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { createCacheStore } from "@/lib/cache/store";
import { queryGames } from "@/lib/games-query";
import { defaultFilters } from "@/lib/url-state";
import { pollGame } from "./fixtures";

function seededCache(count: number) {
  const dbPath = join(mkdtempSync(join(tmpdir(), "bgg-query-")), "cache.sqlite");
  const games = Array.from({ length: count }, (_, index) => ({
    ...pollGame,
    id: index + 1,
    rank: index + 1,
    title: `Game ${index + 1}`,
    year: index < 150 ? 2020 : 1990,
  }));
  const store = createCacheStore(dbPath);
  store.upsertGames(games, "<items />");
  store.close();
  return dbPath;
}

test("returns one page of the filtered games with the totals", () => {
  const dbPath = seededCache(250);
  const view = queryGames({ ...defaultFilters, minYear: 2000 }, 2, dbPath);
  expect(view.total).toBe(250);
  expect(view.shown).toBe(150);
  expect(view.pageCount).toBe(2);
  expect(view.page).toBe(2);
  expect(view.games).toHaveLength(50);
  expect(view.games[0].title).toBe("Game 101");
  expect(view.games[0]).not.toHaveProperty("description");
  expect(view.facets.allTags).toEqual(["Economic", "Worker Placement"]);
});

test("a page past the end lands on the last page", () => {
  const view = queryGames(defaultFilters, 99, seededCache(250));
  expect(view.page).toBe(3);
  expect(view.games).toHaveLength(50);
});

test("reuses the result for the same filters across pages and requests", () => {
  const dbPath = seededCache(250);
  const filters = { ...defaultFilters, minYear: 2000 };
  const first = queryGames(filters, 1, dbPath);
  const second = queryGames({ ...filters }, 2, dbPath);
  expect(second.tagCounts).toBe(first.tagCounts);
  expect(queryGames({ ...filters }, 1, dbPath).games[0]).toBe(first.games[0]);
});

test("drops the cached results when the stored games change", () => {
  const dbPath = seededCache(3);
  const before = queryGames(defaultFilters, 1, dbPath);
  const store = createCacheStore(dbPath);
  store.upsertGames([{ ...pollGame, id: 99, rank: 99, title: "Newcomer" }], "<items />");
  store.close();
  const after = queryGames(defaultFilters, 1, dbPath);
  expect(before.total).toBe(3);
  expect(after.total).toBe(4);
  expect(after.games.map((game) => game.title)).toContain("Newcomer");
});
