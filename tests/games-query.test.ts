import { expect, test } from "vitest";
import type { Catalog } from "@/lib/catalog/types";
import { queryGames } from "@/lib/games-query";
import { defaultFilters } from "@/lib/url-state";
import { pollGame } from "./fixtures";

function catalog(count: number, updatedAt: string): Catalog {
  const games = Array.from({ length: count }, (_, index) => ({
    ...pollGame,
    id: index + 1,
    rank: index + 1,
    title: `Game ${index + 1}`,
    year: index < 150 ? 2020 : 1990,
  }));
  return { games, status: { gameCount: count, updatedAt } };
}

test("returns one page of the filtered games with the totals", () => {
  const view = queryGames(catalog(250, "2026-11-01T00:00:00.000Z"), { ...defaultFilters, minYear: 2000 }, 2);
  expect(view.total).toBe(250);
  expect(view.shown).toBe(150);
  expect(view.pageCount).toBe(2);
  expect(view.page).toBe(2);
  expect(view.games).toHaveLength(50);
  expect(view.games[0].title).toBe("Game 101");
  expect(view.facets.allTags).toEqual(["Economic", "Worker Placement"]);
});

test("a page past the end lands on the last page", () => {
  const view = queryGames(catalog(250, "2026-11-02T00:00:00.000Z"), defaultFilters, 99);
  expect(view.page).toBe(3);
  expect(view.games).toHaveLength(50);
});

test("reuses the result for the same filters across pages and requests", () => {
  const filters = { ...defaultFilters, minYear: 2000 };
  // The data cache hands out a fresh copy of the catalog on every request.
  const first = queryGames(catalog(250, "2026-11-03T00:00:00.000Z"), filters, 1);
  const second = queryGames(catalog(250, "2026-11-03T00:00:00.000Z"), { ...filters }, 2);
  expect(second.tagCounts).toBe(first.tagCounts);
  expect(queryGames(catalog(250, "2026-11-03T00:00:00.000Z"), { ...filters }, 1).games[0]).toBe(first.games[0]);
});

test("drops the cached results when a sync updates the catalog", () => {
  const before = queryGames(catalog(3, "2026-11-04T00:00:00.000Z"), defaultFilters, 1);
  const synced = catalog(3, "2026-11-11T00:00:00.000Z");
  synced.games[0] = { ...synced.games[0], title: "Renamed" };
  const after = queryGames(synced, defaultFilters, 1);
  expect(before.games[0].title).toBe("Game 1");
  expect(after.games[0].title).toBe("Renamed");
});
