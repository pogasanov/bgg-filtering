import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { upsertGames } from "@/lib/catalog/store";
import type { Db } from "@/lib/db/client";
import { loadGamesForPricing } from "@/lib/prices/games";
import { makeGame } from "./helpers/fixtures";
import { createTestDb } from "./helpers/test-db";

const NOW = new Date("2026-11-27T03:00:00.000Z");

let db: Db;
let close: () => Promise<void>;
beforeEach(async () => {
  ({ db, close } = await createTestDb());
});
afterEach(async () => {
  await close();
});

describe("loadGamesForPricing", () => {
  test("returns every stored game with all its names and its Russian publishers' shops, in rank order", async () => {
    await upsertGames(
      db,
      [
        makeGame(2, { rank: 2, title: "Citadels", alternateNames: ["Цитадели", "Ciudadelas"], publisherIds: [9325] }),
        makeGame(1, { rank: 1, title: "Wingspan", alternateNames: ["Крылья", "wingspan"], publisherIds: [23202, 34801, 29194] }),
      ],
      NOW,
    );

    expect(await loadGamesForPricing(db)).toEqual([
      { bggId: 1, primaryName: "Wingspan", names: ["Wingspan", "Крылья"], publisherShops: ["gaga", "lavkaigr"] },
      { bggId: 2, primaryName: "Citadels", names: ["Citadels", "Цитадели", "Ciudadelas"], publisherShops: [] },
    ]);
  });

  test("a later sync replaces the stored names and publishers", async () => {
    await upsertGames(db, [makeGame(1, { title: "Wingspan", alternateNames: ["Крылья"], publisherIds: [34801] })], NOW);
    await upsertGames(db, [makeGame(1, { title: "Wingspan", alternateNames: ["Крила"], publisherIds: [] })], NOW);

    expect(await loadGamesForPricing(db)).toEqual([
      { bggId: 1, primaryName: "Wingspan", names: ["Wingspan", "Крила"], publisherShops: [] },
    ]);
  });

  test("a game synced before names were kept has only its title and no known publishers", async () => {
    await upsertGames(db, [makeGame(1, { title: "Wingspan" })], NOW);
    expect(await loadGamesForPricing(db)).toEqual([{ bggId: 1, primaryName: "Wingspan", names: ["Wingspan"], publisherShops: [] }]);
  });
});
