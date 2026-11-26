import { afterEach, beforeEach, expect, test } from "vitest";
import { refreshRussianTitles } from "@/lib/catalog/russian-titles";
import { upsertGames } from "@/lib/catalog/store";
import type { Db } from "@/lib/db/client";
import { saveCatalog } from "@/lib/prices/store";
import type { ShopProduct } from "@/lib/prices/types";
import { makeGame } from "./helpers/fixtures";
import { createTestDb, rows } from "./helpers/test-db";
import { sql } from "drizzle-orm";

const NOW = new Date("2026-11-30T03:00:00.000Z");

function product(externalId: string, title: string): ShopProduct {
  return { shop: "lavkaigr", externalId, url: `https://lavkaigr.example/${externalId}`, title, vendor: null, barcode: null, price: 1000, oldPrice: null, available: true, variantCount: 1 };
}

let db: Db;
let close: () => Promise<void>;
beforeEach(async () => {
  ({ db, close } = await createTestDb());
});
afterEach(async () => {
  await close();
});

async function titles(): Promise<Record<number, string | null>> {
  const result = await rows<{ id: number; title: string | null }>(db, sql`select bgg_id as id, title_ru as title from games order by bgg_id`);
  return Object.fromEntries(result.map((row) => [row.id, row.title]));
}

test("chooses each game's Russian title from its candidates and the shop catalogues, and reports changes", async () => {
  await upsertGames(
    db,
    [
      makeGame(1, { ruNames: ["Коса", "Серп"] }),
      makeGame(2, { ruNames: ["Kinfire: Предания – Чертоги тщеславия"] }),
      makeGame(3, { ruNames: [] }),
    ],
    NOW,
  );

  expect(await refreshRussianTitles(db)).toBe(2);
  // Without shop evidence the longer of two unmarked names wins; here both are four letters, so the first.
  expect(await titles()).toEqual({ 1: "Коса", 2: "Kinfire: Предания – Чертоги тщеславия", 3: null });

  await saveCatalog(db, [product("s", "Серп. Захватчики из далеких земель")], NOW);
  expect(await refreshRussianTitles(db)).toBe(1);
  expect((await titles())[1]).toBe("Серп");

  expect(await refreshRussianTitles(db)).toBe(0);
});
