import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { queryCatalogFrame, queryGamesView } from "@/lib/catalog/query";
import { upsertGames } from "@/lib/catalog/store";
import type { Db } from "@/lib/db/client";
import { defaultFilters } from "@/lib/url-state";
import { storeCatalog } from "./helpers/catalog";
import { makeGame } from "./helpers/fixtures";
import { createTestDb } from "./helpers/test-db";

/** The defaults list only games with a Russian edition; these tests are about the whole catalog. */
const everyLanguage = { ...defaultFilters, language: "" };

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

    const view = await queryGamesView(db, { ...everyLanguage, minYear: 2000 }, 9);

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
      (await queryGamesView(db, { ...everyLanguage, search })).games.map((game) => game.id);

    expect(await ids("ORANGE")).toEqual([1]);
    expect(await ids("%")).toEqual([1]);
    expect(await ids("_")).toEqual([2]);
  });

  test("breaks ties in any sort by catalog rank", async () => {
    await storeCatalog(db, [makeGame(1, { rank: 3, weight: 2 }), makeGame(2, { rank: 1, weight: 2 }), makeGame(3, { rank: 2, weight: 3 })]);

    const view = await queryGamesView(db, { ...everyLanguage, sort: "weight", sortDir: "desc" });

    expect(view.games.map((game) => game.id)).toEqual([3, 2, 1]);
  });
});

describe("queryCatalogFrame", () => {
  test("offers the mechanics, languages and years of listed games only, with mechanic counts of the default (Russian) view", async () => {
    await storeCatalog(db, [
      makeGame(1, { year: 2020, categories: ["Economic"], mechanics: ["Worker Placement"], languages: ["German"] }),
      makeGame(2, { year: 1995, categories: ["Economic"], mechanics: ["Worker Placement"], languages: ["English", "German", "Russian"] }),
      makeGame(3, { year: null, categories: ["Card Game"], mechanics: ["Set Collection"], languages: ["Russian"] }),
    ]);
    // Details for a game outside the ranked list stay out of the frame.
    await upsertGames(db, [makeGame(99, { categories: ["Hidden"], languages: ["Klingon"], year: 1800 })], new Date());

    const frame = await queryCatalogFrame(db);

    expect(frame.facets).toEqual({
      // Categories are stored but not offered.
      allTags: ["Set Collection", "Worker Placement"],
      allLanguages: ["English", "German", "Russian"],
      yearScale: [1995, 2020],
    });
    expect(frame.total).toBe(3);
    expect(frame.status.gameCount).toBe(3);
    // Game 1 has no Russian edition, so its mechanics are not counted.
    expect(Object.fromEntries(frame.tagCounts)).toEqual({ "Set Collection": 1, "Worker Placement": 1 });
  });
});
