import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { Db } from "@/lib/db/client";
import type { Link } from "@/lib/prices/match";
import { getCurrentOffers, recordPrices, recordRun, saveCatalog, saveLinks } from "@/lib/prices/store";
import type { ShopCode, ShopProduct } from "@/lib/prices/types";
import { createTestDb, rows } from "./helpers/test-db";

const DAY1 = new Date("2026-11-27T03:00:00.000Z");
const DAY2 = new Date("2026-11-28T03:00:00.000Z");
const DAY3 = new Date("2026-11-29T03:00:00.000Z");

function product(externalId: string, overrides: Partial<ShopProduct> = {}): ShopProduct {
  return {
    shop: "lavkaigr",
    externalId,
    url: `https://shop.example/${externalId}`,
    title: `Product ${externalId}`,
    vendor: null,
    barcode: null,
    price: 1000,
    oldPrice: null,
    available: true,
    variantCount: 1,
    ...overrides,
  };
}

const link = (bggId: number, externalId: string, status: Link["status"] = "confirmed", shop: ShopCode = "lavkaigr"): Link => ({
  bggId,
  shop,
  externalId,
  status,
  reason: status === "confirmed" ? "exact-title" : "title-contains-name",
});

let db: Db;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
});
afterEach(async () => {
  await close();
});

const history = () =>
  rows<{ external_id: string; price: number | null; old_price: number | null; available: boolean | null }>(
    db,
    sql`SELECT external_id, price, old_price, available FROM price_history ORDER BY external_id, observed_at`,
  );
const linkRows = () =>
  rows<{ bgg_id: number; external_id: string; status: string; decided_by: string }>(
    db,
    sql`SELECT bgg_id, external_id, status, decided_by FROM product_links ORDER BY bgg_id, external_id`,
  );

describe("saveCatalog", () => {
  test("stores products and keeps the first-seen time when they are seen again", async () => {
    await saveCatalog(db, [product("a"), product("b")], DAY1);
    await saveCatalog(db, [product("a", { title: "Renamed", url: "https://shop.example/new" })], DAY2);

    const stored = await rows<{ external_id: string; title: string; url: string; first: Date; last: Date }>(
      db,
      sql`SELECT external_id, title, url, first_seen_at AS first, last_seen_at AS last FROM shop_products ORDER BY external_id`,
    );
    expect(stored.map((row) => [row.external_id, row.title, row.url])).toEqual([
      ["a", "Renamed", "https://shop.example/new"],
      ["b", "Product b", "https://shop.example/b"],
    ]);
    expect(new Date(stored[0].first).toISOString()).toBe(DAY1.toISOString());
    expect(new Date(stored[0].last).toISOString()).toBe(DAY2.toISOString());
    expect(new Date(stored[1].last).toISOString()).toBe(DAY1.toISOString());
  });

  test("handles an empty list and a catalogue larger than one statement's parameter limit", async () => {
    await saveCatalog(db, [], DAY1);
    const many = Array.from({ length: 2500 }, (_, index) => product(String(index)));
    await saveCatalog(db, many, DAY1);
    const [{ n }] = await rows<{ n: number }>(db, sql`SELECT count(*)::int AS n FROM shop_products`);
    expect(n).toBe(2500);
  });
});

describe("saveLinks", () => {
  const catalogue = [product("a"), product("b"), product("c")];

  test("stores confirmed links and candidates as automatic decisions", async () => {
    await saveCatalog(db, catalogue, DAY1);
    const result = await saveLinks(db, [link(1, "a"), link(1, "b", "candidate")], catalogue, DAY1);

    expect(result).toEqual({ confirmed: 1, candidates: 1 });
    expect(await linkRows()).toEqual([
      { bgg_id: 1, external_id: "a", status: "confirmed", decided_by: "auto" },
      { bgg_id: 1, external_id: "b", status: "candidate", decided_by: "auto" },
    ]);
  });

  test("never proposes again what the owner rejected", async () => {
    await saveCatalog(db, catalogue, DAY1);
    await saveLinks(db, [link(1, "a")], catalogue, DAY1);
    await db.execute(sql`UPDATE product_links SET status = 'rejected', decided_by = 'owner'`);

    await saveLinks(db, [link(1, "a")], catalogue, DAY2);
    expect(await linkRows()).toEqual([{ bgg_id: 1, external_id: "a", status: "rejected", decided_by: "owner" }]);
  });

  test("keeps the owner's confirmed product and does not confirm another for the same game and shop", async () => {
    await saveCatalog(db, catalogue, DAY1);
    await saveLinks(db, [link(1, "b", "candidate")], catalogue, DAY1);
    await db.execute(sql`UPDATE product_links SET status = 'confirmed', decided_by = 'owner'`);

    await saveLinks(db, [link(1, "a")], catalogue, DAY2);
    expect(await linkRows()).toEqual([{ bgg_id: 1, external_id: "b", status: "confirmed", decided_by: "owner" }]);
  });

  test("drops an automatic link the rules no longer propose", async () => {
    await saveCatalog(db, catalogue, DAY1);
    await saveLinks(db, [link(1, "a"), link(2, "b", "candidate")], catalogue, DAY1);
    await saveLinks(db, [link(2, "b", "candidate")], catalogue, DAY2);
    expect(await linkRows()).toEqual([{ bgg_id: 2, external_id: "b", status: "candidate", decided_by: "auto" }]);
  });

  test("leaves links of products that were not looked at in this run", async () => {
    await saveCatalog(db, catalogue, DAY1);
    await saveLinks(db, [link(1, "a"), link(2, "b")], catalogue, DAY1);
    await saveLinks(db, [], [product("a")], DAY2);
    expect(await linkRows()).toEqual([{ bgg_id: 2, external_id: "b", status: "confirmed", decided_by: "auto" }]);
  });

  test("moves an automatic link between candidate and confirmed as the rules decide", async () => {
    await saveCatalog(db, catalogue, DAY1);
    await saveLinks(db, [link(1, "a", "candidate")], catalogue, DAY1);
    await saveLinks(db, [link(1, "a")], catalogue, DAY2);
    expect(await linkRows()).toEqual([{ bgg_id: 1, external_id: "a", status: "confirmed", decided_by: "auto" }]);
  });

  test("replaces the automatically confirmed product when the rules pick a different one", async () => {
    await saveCatalog(db, catalogue, DAY1);
    await saveLinks(db, [link(1, "a")], catalogue, DAY1);
    await saveLinks(db, [link(1, "b")], catalogue, DAY2);
    expect(await linkRows()).toEqual([{ bgg_id: 1, external_id: "b", status: "confirmed", decided_by: "auto" }]);
  });
});

describe("recordPrices", () => {
  const a = product("a", { price: 5990 });

  async function setUp(products: ShopProduct[], links: Link[]) {
    await saveCatalog(db, products, DAY1);
    await saveLinks(db, links, products, DAY1);
  }

  test("writes the first observation of a confirmed product only", async () => {
    const products = [a, product("b"), product("c")];
    await setUp(products, [link(1, "a"), link(2, "b", "candidate")]);

    expect(await recordPrices(db, products, DAY1)).toEqual({ checked: 1, changed: 1 });
    expect(await history()).toEqual([{ external_id: "a", price: 5990, old_price: null, available: true }]);
  });

  test("writes nothing when nothing changed, but notes that the product was checked", async () => {
    await setUp([a], [link(1, "a")]);
    await recordPrices(db, [a], DAY1);

    expect(await recordPrices(db, [a], DAY2)).toEqual({ checked: 1, changed: 0 });
    expect(await history()).toHaveLength(1);
    const [check] = await rows<{ checked_at: Date }>(db, sql`SELECT checked_at FROM price_checks`);
    expect(new Date(check.checked_at).toISOString()).toBe(DAY2.toISOString());
  });

  test("writes one row for each change of price, old price or stock", async () => {
    await setUp([a], [link(1, "a")]);
    await recordPrices(db, [a], DAY1);
    await recordPrices(db, [{ ...a, price: 4490, oldPrice: 5990 }], DAY2);
    await recordPrices(db, [{ ...a, price: 4490, oldPrice: 5990, available: false }], DAY3);

    expect(await history()).toEqual([
      { external_id: "a", price: 5990, old_price: null, available: true },
      { external_id: "a", price: 4490, old_price: 5990, available: true },
      { external_id: "a", price: 4490, old_price: 5990, available: false },
    ]);
  });

  test("records a price that could not be read as a change to no price", async () => {
    await setUp([a], [link(1, "a")]);
    await recordPrices(db, [a], DAY1);
    expect(await recordPrices(db, [{ ...a, price: null }], DAY2)).toEqual({ checked: 1, changed: 1 });
    expect((await history()).at(-1)).toMatchObject({ price: null });
  });
});

describe("getCurrentOffers", () => {
  test("returns the latest price of every confirmed link", async () => {
    const a = product("a", { price: 5990 });
    const g = product("g", { shop: "gaga", price: 5790 });
    await saveCatalog(db, [a, g, product("c")], DAY1);
    await saveLinks(db, [link(1, "a"), link(1, "g", "confirmed", "gaga"), link(2, "c", "candidate")], [a, g, product("c")], DAY1);
    await recordPrices(db, [a, g], DAY1);
    await recordPrices(db, [{ ...a, price: 4490, oldPrice: 5990 }, g], DAY2);

    const offers = await getCurrentOffers(db);
    expect(offers).toEqual([
      {
        bggId: 1,
        shop: "gaga",
        title: "Product g",
        url: "https://shop.example/g",
        price: 5790,
        oldPrice: null,
        available: true,
        changedAt: DAY1,
        checkedAt: DAY2,
      },
      {
        bggId: 1,
        shop: "lavkaigr",
        title: "Product a",
        url: "https://shop.example/a",
        price: 4490,
        oldPrice: 5990,
        available: true,
        changedAt: DAY2,
        checkedAt: DAY2,
      },
    ]);
  });
});

describe("recordRun", () => {
  test("stores the outcome of a shop's run, including a failure", async () => {
    await recordRun(db, { shop: "gaga", startedAt: DAY1, finishedAt: DAY1, productsSeen: 41, pricesChanged: 29, errorMessage: null });
    await recordRun(db, { shop: "lavkaigr", startedAt: DAY1, finishedAt: DAY1, productsSeen: 0, pricesChanged: 0, errorMessage: "HTTP 403" });
    const runs = await rows<{ shop: string; products_seen: number; error_message: string | null }>(
      db,
      sql`SELECT shop, products_seen, error_message FROM price_runs ORDER BY id`,
    );
    expect(runs).toEqual([
      { shop: "gaga", products_seen: 41, error_message: null },
      { shop: "lavkaigr", products_seen: 0, error_message: "HTTP 403" },
    ]);
  });
});
