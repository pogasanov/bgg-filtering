import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { queryCatalogFrame, queryGamesView } from "@/lib/catalog/query";
import { upsertGames } from "@/lib/catalog/store";
import type { Db } from "@/lib/db/client";
import { defaultFilters } from "@/lib/url-state";
import { storeCatalog } from "./helpers/catalog";
import { makeGame } from "./helpers/fixtures";
import { createTestDb } from "./helpers/test-db";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(() => close());

describe("queryGamesView", () => {
  test("reads only the requested page and lands past-the-end pages on the last one", async () => {
    await storeCatalog(
      db,
      Array.from({ length: 250 }, (_, index) => makeGame(index + 1, { year: index < 200 ? 2020 : 1990 })),
    );

    const view = await queryGamesView(db, { ...defaultFilters, minYear: 2000 }, 9);

    expect(view).toMatchObject({ shown: 200, total: 250, page: 2, pageCount: 2 });
    expect(view.games.map((game) => game.id)).toEqual(Array.from({ length: 100 }, (_, index) => index + 101));
  });

  test("searches the title as plain text, ignoring case", async () => {
    await storeCatalog(db, [
      makeGame(1, { title: "100% Orange Juice" }),
      makeGame(2, { title: "Under_Water" }),
      makeGame(3, { title: "Plain" }),
    ]);

    const ids = async (search: string) =>
      (await queryGamesView(db, { ...defaultFilters, search })).games.map((game) => game.id);

    expect(await ids("ORANGE")).toEqual([1]);
    expect(await ids("%")).toEqual([1]);
    expect(await ids("_")).toEqual([2]);
  });

  test("breaks ties in any sort by catalog rank", async () => {
    await storeCatalog(db, [makeGame(1, { rank: 3, weight: 2 }), makeGame(2, { rank: 1, weight: 2 }), makeGame(3, { rank: 2, weight: 3 })]);

    const view = await queryGamesView(db, { ...defaultFilters, sort: "weight", sortDir: "desc" });

    expect(view.games.map((game) => game.id)).toEqual([3, 2, 1]);
  });
});

describe("queryCatalogFrame", () => {
  test("offers the tags, languages and years of listed games only, with unfiltered tag counts", async () => {
    await storeCatalog(db, [
      makeGame(1, { year: 2020, categories: ["Economic"], mechanics: ["Worker Placement"], languages: ["German"] }),
      makeGame(2, { year: 1995, categories: ["Economic"], mechanics: [], languages: ["English", "German"] }),
      makeGame(3, { year: null, categories: [], mechanics: ["Economic"], languages: [] }),
    ]);
    // Details for a game outside the ranked list stay out of the frame.
    await upsertGames(db, [makeGame(99, { categories: ["Hidden"], languages: ["Klingon"], year: 1800 })], new Date());

    const frame = await queryCatalogFrame(db);

    expect(frame.facets).toEqual({
      allTags: ["Economic", "Worker Placement"],
      allLanguages: ["English", "German"],
      yearScale: [1995, 2020],
    });
    expect(frame.total).toBe(3);
    expect(frame.status.gameCount).toBe(3);
    expect(Object.fromEntries(frame.tagCounts)).toEqual({ Economic: 3, "Worker Placement": 1 });
  });
});
