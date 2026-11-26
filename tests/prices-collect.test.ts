import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { Db } from "@/lib/db/client";
import { storeCollection } from "@/lib/prices/collect";
import type { ShopOutcome } from "@/lib/prices/report";
import { getCurrentOffers } from "@/lib/prices/store";
import type { GameNames, ShopCode, ShopProduct } from "@/lib/prices/types";
import { createTestDb, rows } from "./helpers/test-db";

const DAY1 = new Date("2026-11-27T03:00:00.000Z");
const DAY2 = new Date("2026-11-28T03:00:00.000Z");

function product(shop: ShopCode, externalId: string, title: string, price: number | null = 1000): ShopProduct {
  return { shop, externalId, url: `https://${shop}.example/${externalId}`, title, vendor: null, barcode: null, price, oldPrice: null, available: true, variantCount: 1 };
}

const games: GameNames[] = [
  { bggId: 1, primaryName: "Wingspan", names: ["Wingspan", "Крылья"], publisherShops: ["lavkaigr"] },
  { bggId: 2, primaryName: "Citadels", names: ["Citadels", "Цитадели"], publisherShops: [] },
];

let db: Db;
let close: () => Promise<void>;
beforeEach(async () => {
  ({ db, close } = await createTestDb());
});
afterEach(async () => {
  await close();
});

describe("storeCollection", () => {
  test("stores catalogues, links and prices, and reports each shop", async () => {
    const outcomes: ShopOutcome[] = [
      { shop: "lavkaigr", products: [product("lavkaigr", "a", "Крылья", 5990), product("lavkaigr", "b", "Цитадели. Делюкс")] },
      { shop: "gaga", products: [product("gaga", "g", "Цитадели", 990)] },
    ];
    const summary = await storeCollection(db, games, outcomes, DAY1, DAY1);

    expect(summary.shops).toEqual([
      { shop: "lavkaigr", error: null, products: 2, confirmed: 1, candidates: 1, pricesChanged: 1 },
      { shop: "gaga", error: null, products: 1, confirmed: 1, candidates: 0, pricesChanged: 1 },
    ]);
    expect((await getCurrentOffers(db)).map((offer) => [offer.bggId, offer.shop, offer.price])).toEqual([
      [1, "lavkaigr", 5990],
      [2, "gaga", 990],
    ]);
    const runs = await rows<{ shop: string; products_seen: number; prices_changed: number }>(
      db,
      sql`SELECT shop, products_seen, prices_changed FROM price_runs ORDER BY id`,
    );
    expect(runs).toEqual([
      { shop: "lavkaigr", products_seen: 2, prices_changed: 1 },
      { shop: "gaga", products_seen: 1, prices_changed: 1 },
    ]);
  });

  test("a failed shop is recorded and keeps what was stored for it before", async () => {
    const lavka = [product("lavkaigr", "a", "Крылья", 5990)];
    await storeCollection(db, games, [{ shop: "lavkaigr", products: lavka }], DAY1, DAY1);

    const summary = await storeCollection(
      db,
      games,
      [{ shop: "lavkaigr", error: "ShopBlockedError: HTTP 403" }, { shop: "gaga", products: [product("gaga", "g", "Цитадели", 990)] }],
      DAY2,
      DAY2,
    );

    expect(summary.shops[0]).toMatchObject({ shop: "lavkaigr", error: "ShopBlockedError: HTTP 403", products: 0 });
    expect((await getCurrentOffers(db)).map((offer) => [offer.shop, offer.price])).toEqual([
      ["lavkaigr", 5990],
      ["gaga", 990],
    ]);
    const [run] = await rows<{ error_message: string | null }>(
      db,
      sql`SELECT error_message FROM price_runs WHERE shop = 'lavkaigr' ORDER BY id DESC LIMIT 1`,
    );
    expect(run.error_message).toBe("ShopBlockedError: HTTP 403");
  });

  test("a second day with the same prices adds no history", async () => {
    const outcome: ShopOutcome[] = [{ shop: "lavkaigr", products: [product("lavkaigr", "a", "Крылья", 5990)] }];
    await storeCollection(db, games, outcome, DAY1, DAY1);
    const summary = await storeCollection(db, games, outcome, DAY2, DAY2);

    expect(summary.shops[0].pricesChanged).toBe(0);
    const [{ n }] = await rows<{ n: number }>(db, sql`SELECT count(*)::int AS n FROM price_history`);
    expect(n).toBe(1);
  });
});
