import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { upsertGames } from "@/lib/catalog/store";
import type { Db } from "@/lib/db/client";
import type { Link } from "@/lib/prices/match";
import { confirmCandidate, listReviewQueue, rejectCandidate } from "@/lib/prices/review";
import { countCandidates, saveCatalog, saveLinks } from "@/lib/prices/store";
import type { ShopCode, ShopProduct } from "@/lib/prices/types";
import { makeGame } from "./helpers/fixtures";
import { createTestDb, rows } from "./helpers/test-db";

const DAY1 = new Date("2026-11-27T03:00:00.000Z");
const DAY2 = new Date("2026-11-28T03:00:00.000Z");

function product(externalId: string, shop: ShopCode = "lavkaigr"): ShopProduct {
  return {
    shop,
    externalId,
    url: `https://${shop}.example/${externalId}`,
    title: `Product ${externalId}`,
    vendor: "Hobby World",
    barcode: null,
    price: 1000,
    oldPrice: null,
    available: true,
    variantCount: 1,
  };
}

const candidate = (bggId: number, externalId: string, shop: ShopCode = "lavkaigr"): Link => ({
  bggId,
  shop,
  externalId,
  status: "candidate",
  reason: "title-contains-name",
});
const confirmed = (bggId: number, externalId: string, shop: ShopCode = "lavkaigr"): Link => ({
  bggId,
  shop,
  externalId,
  status: "confirmed",
  reason: "exact-title",
});

let db: Db;
let close: () => Promise<void>;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  await upsertGames(
    db,
    [
      makeGame(1, { rank: 1, title: "Wingspan", year: 2019 }),
      makeGame(2, { rank: 2, title: "Citadels", year: 2000 }),
      makeGame(3, { rank: 3, title: "Azul", year: 2017 }),
    ],
    DAY1,
  );
});
afterEach(async () => {
  await close();
});

/** Stores a catalogue and the links the matcher would propose for it. */
async function store(products: ShopProduct[], links: Link[], now = DAY1) {
  await saveCatalog(db, products, now);
  await saveLinks(db, links, products, now);
}

const linkRows = () =>
  rows<{ bgg_id: number; shop: string; external_id: string; status: string; decided_by: string }>(
    db,
    sql`SELECT bgg_id, shop, external_id, status, decided_by FROM product_links ORDER BY bgg_id, shop, external_id`,
  );

describe("listReviewQueue", () => {
  test("shows the game, the product and why, with games that have no price first", async () => {
    await store(
      [product("w-ok"), product("w-cand"), product("a-cand"), product("a-cand", "gaga")],
      [confirmed(1, "w-ok"), candidate(1, "w-cand"), candidate(3, "a-cand"), candidate(3, "a-cand", "gaga")],
    );

    const queue = await listReviewQueue(db);

    expect(queue.map((item) => [item.bggId, item.shop, item.externalId])).toEqual([
      [3, "gaga", "a-cand"],
      [3, "lavkaigr", "a-cand"],
      [1, "lavkaigr", "w-cand"],
    ]);
    expect(queue[2]).toMatchObject({
      gameTitle: "Wingspan",
      year: 2019,
      rank: 1,
      productTitle: "Product w-cand",
      productUrl: "https://lavkaigr.example/w-cand",
      vendor: "Hobby World",
      reason: "title-contains-name",
      gameHasPrice: true,
      current: { title: "Product w-ok", url: "https://lavkaigr.example/w-ok" },
    });
    expect(queue[0]).toMatchObject({ gameTitle: "Azul", gameHasPrice: false, current: null });
  });

  test("filters by shop and by games without any price", async () => {
    await store(
      [product("w-ok"), product("w-cand"), product("a-cand"), product("a-cand", "gaga")],
      [confirmed(1, "w-ok"), candidate(1, "w-cand"), candidate(3, "a-cand"), candidate(3, "a-cand", "gaga")],
    );

    expect((await listReviewQueue(db, { shop: "gaga" })).map((item) => item.externalId)).toEqual(["a-cand"]);
    expect((await listReviewQueue(db, { withoutPrice: true })).map((item) => item.bggId)).toEqual([3, 3]);
  });
});

describe("confirmCandidate", () => {
  test("confirms the link as the owner's and replaces the product confirmed before", async () => {
    await store([product("w-ok"), product("w-cand")], [confirmed(1, "w-ok"), candidate(1, "w-cand")]);

    await confirmCandidate(db, { bggId: 1, shop: "lavkaigr", externalId: "w-cand" }, DAY2);

    expect(await linkRows()).toEqual([
      { bgg_id: 1, shop: "lavkaigr", external_id: "w-cand", status: "confirmed", decided_by: "owner" },
    ]);
  });

  test("survives the next run, and settles the game's other candidates in that shop", async () => {
    await store([product("w-ok"), product("w-cand"), product("w-other")], [
      confirmed(1, "w-ok"),
      candidate(1, "w-cand"),
      candidate(1, "w-other"),
    ]);
    await confirmCandidate(db, { bggId: 1, shop: "lavkaigr", externalId: "w-cand" }, DAY2);

    // The matcher proposes exactly what it did before.
    await store([product("w-ok"), product("w-cand"), product("w-other")], [
      confirmed(1, "w-ok"),
      candidate(1, "w-cand"),
      candidate(1, "w-other"),
    ], DAY2);

    const links = await linkRows();
    expect(links.filter((row) => row.status === "confirmed")).toEqual([
      { bgg_id: 1, shop: "lavkaigr", external_id: "w-cand", status: "confirmed", decided_by: "owner" },
    ]);
    expect(await listReviewQueue(db)).toEqual([]);
    expect(await countCandidates(db)).toBe(0);
  });

  test("refuses a link that is not a waiting candidate", async () => {
    await store([product("w-ok")], [confirmed(1, "w-ok")]);
    await expect(confirmCandidate(db, { bggId: 1, shop: "lavkaigr", externalId: "nope" }, DAY2)).rejects.toThrow(
      "not a waiting candidate",
    );
  });
});

describe("rejectCandidate", () => {
  test("rejects for good: the next run does not bring it back", async () => {
    await store([product("a-cand")], [candidate(3, "a-cand")]);

    await rejectCandidate(db, { bggId: 3, shop: "lavkaigr", externalId: "a-cand" }, DAY2);
    await store([product("a-cand")], [candidate(3, "a-cand")], DAY2);

    expect(await linkRows()).toEqual([
      { bgg_id: 3, shop: "lavkaigr", external_id: "a-cand", status: "rejected", decided_by: "owner" },
    ]);
    expect(await listReviewQueue(db)).toEqual([]);
  });
});
