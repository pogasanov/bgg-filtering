import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { importRanks } from "@/lib/bgg/import-ranks";
import { getRankedGames, replaceRankedGames } from "@/lib/catalog/store";
import type { Db } from "@/lib/db/client";
import { makeRanked } from "./helpers/fixtures";
import { createTestDb } from "./helpers/test-db";

const NOW = new Date("2026-11-30T03:00:00.000Z");
const HEADER = "id,name,yearpublished,rank,bayesaverage,average,usersrated,is_expansion";

function writeCsv(rows: string[]): string {
  const path = join(mkdtempSync(join(tmpdir(), "bgg-ranks-")), "ranks.csv");
  writeFileSync(path, [HEADER, ...rows, ""].join("\n"));
  return path;
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

describe("importRanks", () => {
  test("imports the top N ranked base games", async () => {
    const db = await setup();
    const csvPath = writeCsv([
      "30,Third,2022,3,7.1,7.3,300,0",
      "20,Second,2021,2,7.2,7.4,400,0",
      "90,Expansion,2020,1,8.0,8.2,500,1",
      "10,First,2023,1,7.3,7.5,500,0",
    ]);

    const result = await importRanks(db, csvPath, 2, NOW);

    expect(result.ranked).toBe(2);
    expect((await getRankedGames(db)).map((item) => [item.id, item.rank])).toEqual([
      [10, 1],
      [20, 2],
    ]);
  });

  test("refuses a CSV with no ranked base games and keeps the old list", async () => {
    const db = await setup();
    await replaceRankedGames(db, [makeRanked(1)], NOW);
    const csvPath = writeCsv(["90,Expansion,2020,1,8.0,8.2,500,1"]);

    await expect(importRanks(db, csvPath, 500, NOW)).rejects.toThrow("contains no ranked base games");
    expect((await getRankedGames(db)).map((item) => item.id)).toEqual([1]);
  });
});
