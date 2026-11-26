import { afterEach, describe, expect, test } from "vitest";
import { queryGamesView } from "@/lib/catalog/query";
import type { Db } from "@/lib/db/client";
import { priceChecks, priceHistory, productLinks, shopProducts } from "@/lib/db/schema";
import { defaultFilters } from "@/lib/url-state";
import { storeCatalog } from "./helpers/catalog";
import { makeGame } from "./helpers/fixtures";
import { seedOffers } from "./helpers/seed-offers";
import { createTestDb } from "./helpers/test-db";

/** The defaults list only games with a Russian edition; these tests are about the whole catalog. */
const everyLanguage = { ...defaultFilters, language: "" };

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

const DEC_10 = new Date("2026-12-10T00:00:00.000Z");

describe("offers on a page of games", () => {
  test("attaches current offers from confirmed links only", async () => {
    const db = await setup();
    await seedOffers(db);

    const view = await queryGamesView(db, everyLanguage, 1, DEC_10);
    const one = view.games.find((game) => game.id === 1)!;

    expect(one.offers).toEqual([
      {
        shop: "lavkaigr",
        url: "https://www.lavkaigr.ru/shop/l1",
        price: 1700,
        oldPrice: null,
        available: true,
        checkedAt: "2026-12-09T00:00:00.000Z",
        stale: false,
        salePercent: 15,
      },
    ]);
    expect(one.bestPrice).toBe(1700);
    expect(view.games.find((game) => game.id === 2)).toMatchObject({ offers: [], bestPrice: null });
  });

  test("a shop not checked for three days stops counting towards the best price", async () => {
    const db = await setup();
    await seedOffers(db);

    const one = (await queryGamesView(db, everyLanguage, 1, new Date("2026-12-13T00:00:00.000Z"))).games.find((game) => game.id === 1)!;

    expect(one.offers[0].stale).toBe(true);
    expect(one.bestPrice).toBeNull();
  });

  test("a price that has held for over a month is not a sale", async () => {
    const db = await setup();
    await seedOffers(db);

    const one = (await queryGamesView(db, everyLanguage, 1, new Date("2027-02-01T00:00:00.000Z"))).games.find((game) => game.id === 1)!;

    expect(one.offers[0].salePercent).toBeNull();
  });
});

describe("sorting by price", () => {
  /** 1: no shop. 2: 900 in stock. 3: 500 but out of stock. 4: 3000 in stock. 5: 100 as a candidate only. 6: 700 in stock but stale. */
  async function seedPrices(db: Db) {
    await storeCatalog(db, [1, 2, 3, 4, 5, 6].map((id) => makeGame(id)));
    const seen = new Date("2026-12-08T00:00:00.000Z");
    const fresh = new Date("2026-12-09T00:00:00.000Z");
    const products = [
      { id: "P2", game: 2, price: 900, available: true, status: "confirmed" as const, checked: fresh },
      { id: "P3", game: 3, price: 500, available: false, status: "confirmed" as const, checked: fresh },
      { id: "P4", game: 4, price: 3000, available: true, status: "confirmed" as const, checked: fresh },
      { id: "P5", game: 5, price: 100, available: true, status: "candidate" as const, checked: fresh },
      { id: "P6", game: 6, price: 700, available: true, status: "confirmed" as const, checked: new Date("2026-12-01T00:00:00.000Z") },
    ];
    await db.insert(shopProducts).values(
      products.map((p) => ({ shop: "lavkaigr" as const, externalId: p.id, url: `https://shop.example/${p.id}`, title: p.id, firstSeenAt: seen, lastSeenAt: seen })),
    );
    await db.insert(productLinks).values(
      products.map((p) => ({ bggId: p.game, shop: "lavkaigr" as const, externalId: p.id, status: p.status, reason: "test", decidedBy: "auto" as const, decidedAt: seen })),
    );
    await db.insert(priceHistory).values(
      products.map((p) => ({ shop: "lavkaigr" as const, externalId: p.id, observedAt: seen, price: p.price, oldPrice: null, available: p.available })),
    );
    await db.insert(priceChecks).values(products.map((p) => ({ shop: "lavkaigr" as const, externalId: p.id, checkedAt: p.checked })));
  }

  test("cheapest in-stock first by default, then out-of-stock, then games with no current price", async () => {
    const db = await setup();
    await seedPrices(db);

    const view = await queryGamesView(db, { ...everyLanguage, sort: "price", sortDir: undefined }, 1, DEC_10);

    expect(view.games.map((game) => game.id)).toEqual([2, 4, 3, 1, 5, 6]);
    expect(view.games.map((game) => game.bestPrice)).toEqual([900, 3000, null, null, null, null]);
  });

  test("descending keeps games without a price last", async () => {
    const db = await setup();
    await seedPrices(db);

    const view = await queryGamesView(db, { ...everyLanguage, sort: "price", sortDir: "desc" }, 1, DEC_10);

    expect(view.games.map((game) => game.id)).toEqual([4, 2, 3, 1, 5, 6]);
  });
});
