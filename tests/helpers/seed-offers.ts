import type { Db } from "@/lib/db/client";
import { priceChecks, priceHistory, productLinks, shopProducts } from "@/lib/db/schema";
import { storeCatalog } from "./catalog";
import { makeGame } from "./fixtures";

const SEEDED_AT = new Date("2026-11-20T00:00:00.000Z");

/** Game 1: a confirmed Lavka Igr product that went from 2000 to 1700, and a candidate CrowdGames one at 900. */
export async function seedOffers(db: Db): Promise<void> {
  await storeCatalog(db, [makeGame(1), makeGame(2)]);
  const seen = SEEDED_AT;
  await db.insert(shopProducts).values([
    { shop: "lavkaigr", externalId: "L1", url: "https://www.lavkaigr.ru/shop/l1", title: "Игра 1", firstSeenAt: seen, lastSeenAt: seen },
    { shop: "crowdgames", externalId: "C1", url: "https://www.crowdgames.ru/c1", title: "Игра 1", firstSeenAt: seen, lastSeenAt: seen },
  ]);
  await db.insert(productLinks).values([
    { bggId: 1, shop: "lavkaigr", externalId: "L1", status: "confirmed", reason: "exact", decidedBy: "auto", decidedAt: seen },
    { bggId: 1, shop: "crowdgames", externalId: "C1", status: "candidate", reason: "fuzzy", decidedBy: "auto", decidedAt: seen },
  ]);
  await db.insert(priceHistory).values([
    { shop: "lavkaigr", externalId: "L1", observedAt: seen, price: 2000, oldPrice: null, available: true },
    { shop: "lavkaigr", externalId: "L1", observedAt: new Date("2026-12-08T00:00:00.000Z"), price: 1700, oldPrice: null, available: true },
    { shop: "crowdgames", externalId: "C1", observedAt: seen, price: 900, oldPrice: null, available: true },
  ]);
  const checked = new Date("2026-12-09T00:00:00.000Z");
  await db.insert(priceChecks).values([
    { shop: "lavkaigr", externalId: "L1", checkedAt: checked },
    { shop: "crowdgames", externalId: "C1", checkedAt: checked },
  ]);
}

