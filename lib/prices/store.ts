import { eq, inArray, sql } from "drizzle-orm";
import { resultRows, type Db } from "@/lib/db/client";
import { priceChecks, priceHistory, priceRuns, productLinks, shopProducts } from "@/lib/db/schema";
import type { Link } from "@/lib/prices/match";
import { waitingCandidate } from "@/lib/prices/review";
import type { ShopCode, ShopProduct } from "@/lib/prices/types";

/** Rows per statement, to stay well under Postgres' limit of 65,535 bound parameters. */
const CHUNK = 500;

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) result.push(items.slice(start, start + size));
  return result;
}

const productKey = (shop: string, externalId: string) => `${shop}\u0000${externalId}`;
const linkKey = (bggId: number, shop: string, externalId: string) => `${bggId}\u0000${shop}\u0000${externalId}`;

/** Records every product a shop lists. A product seen before keeps its first-seen time. */
export async function saveCatalog(db: Db, products: ShopProduct[], now: Date): Promise<void> {
  for (const batch of chunks(products)) {
    await db
      .insert(shopProducts)
      .values(
        batch.map((product) => ({
          shop: product.shop,
          externalId: product.externalId,
          url: product.url,
          title: product.title,
          vendor: product.vendor,
          barcode: product.barcode,
          firstSeenAt: now,
          lastSeenAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: [shopProducts.shop, shopProducts.externalId],
        set: {
          url: sql`excluded.url`,
          title: sql`excluded.title`,
          vendor: sql`excluded.vendor`,
          barcode: sql`excluded.barcode`,
          lastSeenAt: sql`excluded.last_seen_at`,
        },
      });
  }
}

/**
 * Brings the stored automatic links in line with what the matcher proposes now.
 *
 * - The owner's decisions are never touched: a rejected link stays rejected, and a product
 *   the owner confirmed keeps its place, so nothing else is confirmed for that game and shop.
 * - An automatic link the matcher no longer proposes is dropped, but only for products
 *   looked at in this run (`seen`). A partial run says nothing about the rest.
 */
export async function saveLinks(
  db: Db,
  links: Link[],
  seen: ShopProduct[],
  now: Date,
): Promise<{ confirmed: number; candidates: number }> {
  const shops = [...new Set([...seen.map((product) => product.shop), ...links.map((link) => link.shop)])];
  if (shops.length === 0) return { confirmed: 0, candidates: 0 };
  const seenKeys = new Set(seen.map((product) => productKey(product.shop, product.externalId)));

  return db.transaction(async (tx) => {
    const existing = await tx.select().from(productLinks).where(inArray(productLinks.shop, shops));
    const existingByKey = new Map(existing.map((row) => [linkKey(row.bggId, row.shop, row.externalId), row]));
    const ownerConfirmed = new Set(
      existing
        .filter((row) => row.decidedBy === "owner" && row.status === "confirmed")
        .map((row) => `${row.bggId}\u0000${row.shop}`),
    );

    // What should be stored as automatic links after this run.
    const wanted = new Map<string, Link>();
    for (const link of links) {
      const stored = existingByKey.get(linkKey(link.bggId, link.shop, link.externalId));
      if (stored?.decidedBy === "owner") continue;
      if (link.status === "confirmed" && ownerConfirmed.has(`${link.bggId}\u0000${link.shop}`)) continue;
      wanted.set(linkKey(link.bggId, link.shop, link.externalId), link);
    }
    const newlyConfirmed = new Set(
      [...wanted.values()].filter((link) => link.status === "confirmed").map((link) => `${link.bggId}\u0000${link.shop}`),
    );

    const stale = existing.filter((row) => {
      if (row.decidedBy !== "auto") return false;
      const key = linkKey(row.bggId, row.shop, row.externalId);
      const next = wanted.get(key);
      if (next) return next.status !== row.status || next.reason !== row.reason;
      // No longer proposed: drop it if the product was looked at, or if it holds the
      // confirmed place another product is about to take.
      return (
        seenKeys.has(productKey(row.shop, row.externalId)) ||
        (row.status === "confirmed" && newlyConfirmed.has(`${row.bggId}\u0000${row.shop}`))
      );
    });
    const staleKeys = new Set(stale.map((row) => linkKey(row.bggId, row.shop, row.externalId)));

    for (const batch of chunks(stale)) {
      const tuples = sql.join(
        batch.map((row) => sql`(${row.bggId}, ${row.shop}, ${row.externalId})`),
        sql`, `,
      );
      await tx.execute(
        sql`DELETE FROM product_links WHERE decided_by = 'auto' AND (bgg_id, shop, external_id) IN (${tuples})`,
      );
    }

    const fresh = [...wanted.entries()].filter(([key]) => !existingByKey.has(key) || staleKeys.has(key)).map(([, link]) => link);
    for (const batch of chunks(fresh)) {
      await tx.insert(productLinks).values(
        batch.map((link) => ({
          bggId: link.bggId,
          shop: link.shop,
          externalId: link.externalId,
          status: link.status,
          reason: link.reason,
          decidedBy: "auto" as const,
          decidedAt: now,
        })),
      );
    }

    const stored = [...wanted.values()];
    return {
      confirmed: stored.filter((link) => link.status === "confirmed").length,
      candidates: stored.filter((link) => link.status === "candidate").length,
    };
  });
}

type LatestRow = { shop: string; external_id: string; price: number | null; old_price: number | null; available: boolean | null };

/**
 * Records today's price of every product that has a confirmed link. A history row is
 * written only when price, old price or stock differs from the last one stored; an
 * unchanged product just has its check time moved forward.
 */
export async function recordPrices(db: Db, products: ShopProduct[], now: Date): Promise<{ checked: number; changed: number }> {
  return db.transaction(async (tx) => {
    const confirmed = await tx
      .select({ shop: productLinks.shop, externalId: productLinks.externalId })
      .from(productLinks)
      .where(eq(productLinks.status, "confirmed"));
    const confirmedKeys = new Set(confirmed.map((row) => productKey(row.shop, row.externalId)));

    const tracked = new Map<string, ShopProduct>();
    for (const product of products) {
      const key = productKey(product.shop, product.externalId);
      if (confirmedKeys.has(key)) tracked.set(key, product);
    }
    if (tracked.size === 0) return { checked: 0, changed: 0 };

    const latest = resultRows<LatestRow>(
      await tx.execute(sql`
        SELECT DISTINCT ON (shop, external_id) shop, external_id, price, old_price, available
        FROM price_history
        ORDER BY shop, external_id, observed_at DESC
      `),
    );
    const latestByKey = new Map(latest.map((row) => [productKey(row.shop, row.external_id), row]));

    const changed = [...tracked.entries()]
      .filter(([key, product]) => {
        const last = latestByKey.get(key);
        return !last || last.price !== product.price || last.old_price !== product.oldPrice || last.available !== product.available;
      })
      .map(([, product]) => product);

    for (const batch of chunks(changed)) {
      await tx.insert(priceHistory).values(
        batch.map((product) => ({
          shop: product.shop,
          externalId: product.externalId,
          observedAt: now,
          price: product.price,
          oldPrice: product.oldPrice,
          available: product.available,
        })),
      );
    }

    for (const batch of chunks([...tracked.values()])) {
      await tx
        .insert(priceChecks)
        .values(batch.map((product) => ({ shop: product.shop, externalId: product.externalId, checkedAt: now })))
        .onConflictDoUpdate({
          target: [priceChecks.shop, priceChecks.externalId],
          set: { checkedAt: sql`excluded.checked_at` },
        });
    }

    return { checked: tracked.size, changed: changed.length };
  });
}

export type PriceRun = {
  shop: ShopCode;
  startedAt: Date;
  finishedAt: Date;
  productsSeen: number;
  pricesChanged: number;
  errorMessage: string | null;
};

export async function recordRun(db: Db, run: PriceRun): Promise<void> {
  await db.insert(priceRuns).values(run);
}

/** How far back a price counts as "recent" when deciding whether today's price is a sale. */
const RECENT_HIGH_DAYS = 30;

export type Offer = {
  bggId: number;
  shop: ShopCode;
  title: string;
  url: string;
  price: number | null;
  oldPrice: number | null;
  available: boolean | null;
  /** When the price or stock last changed. */
  changedAt: Date;
  /** When the product was last read successfully. */
  checkedAt: Date;
  /** The highest price it had in the 30 days before `now`, including the one in force when they began. */
  recentHigh: number | null;
};

type OfferRow = {
  bgg_id: number;
  shop: ShopCode;
  title: string;
  url: string;
  price: number | null;
  old_price: number | null;
  available: boolean | null;
  changed_at: Date | string;
  checked_at: Date | string;
  recent_high: number | null;
};

/**
 * The current price of every confirmed link that has been read at least once.
 * With `bggIds`, only for those games: a page of the site asks for its own rows.
 */
export async function getCurrentOffers(db: Db, now: Date = new Date(), bggIds?: number[]): Promise<Offer[]> {
  if (bggIds !== undefined && bggIds.length === 0) return [];
  const onlyGames = bggIds === undefined ? sql`` : sql`AND l.bgg_id IN (${sql.join(bggIds.map((id) => sql`${id}`), sql`, `)})`;
  const windowStart = new Date(now.getTime() - RECENT_HIGH_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const rows = resultRows<OfferRow>(
    await db.execute(sql`
      SELECT l.bgg_id, l.shop, p.title, p.url, h.price, h.old_price, h.available,
             h.observed_at AS changed_at, c.checked_at,
             GREATEST(
               (SELECT max(price) FROM price_history
                 WHERE shop = l.shop AND external_id = l.external_id AND observed_at >= ${windowStart}::timestamptz),
               (SELECT price FROM price_history
                 WHERE shop = l.shop AND external_id = l.external_id AND observed_at < ${windowStart}::timestamptz
                 ORDER BY observed_at DESC LIMIT 1)
             ) AS recent_high
      FROM product_links l
      JOIN shop_products p ON p.shop = l.shop AND p.external_id = l.external_id
      JOIN price_checks c ON c.shop = l.shop AND c.external_id = l.external_id
      JOIN LATERAL (
        SELECT price, old_price, available, observed_at
        FROM price_history
        WHERE shop = l.shop AND external_id = l.external_id
        ORDER BY observed_at DESC
        LIMIT 1
      ) h ON true
      WHERE l.status = 'confirmed' ${onlyGames}
      ORDER BY l.bgg_id, l.shop
    `),
  );

  return rows.map((row) => ({
    bggId: row.bgg_id,
    shop: row.shop,
    title: row.title,
    url: row.url,
    price: row.price,
    oldPrice: row.old_price,
    available: row.available,
    changedAt: new Date(row.changed_at),
    checkedAt: new Date(row.checked_at),
    recentHigh: row.recent_high,
  }));
}

/** How many links are waiting for the owner, for the run summary. */
export async function countCandidates(db: Db): Promise<number> {
  const [row] = resultRows<{ n: number }>(
    await db.execute(sql`SELECT count(*)::int AS n FROM product_links l WHERE ${waitingCandidate}`),
  );
  return row?.n ?? 0;
}
