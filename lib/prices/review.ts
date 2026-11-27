import { sql, type SQL } from "drizzle-orm";
import { resultRows, type Db } from "@/lib/db/client";
import type { ShopCode } from "@/lib/prices/types";

/**
 * A candidate still waits for the owner unless the owner already chose a product for
 * that game in that shop: one product per game per shop, so the choice settles the rest.
 */
export const waitingCandidate: SQL = sql`
  l.status = 'candidate'
  AND NOT EXISTS (
    SELECT 1 FROM product_links o
    WHERE o.bgg_id = l.bgg_id AND o.shop = l.shop AND o.status = 'confirmed' AND o.decided_by = 'owner'
  )`;

export type ReviewItem = {
  bggId: number;
  gameTitle: string;
  titleRu: string | null;
  year: number | null;
  rank: number | null;
  bggUrl: string;
  shop: ShopCode;
  externalId: string;
  productTitle: string;
  productUrl: string;
  vendor: string | null;
  reason: string;
  /** Whether the game has a confirmed product in any shop, i.e. already shows a price. */
  gameHasPrice: boolean;
  /** The product this game is confirmed to in this shop now; confirming the candidate replaces it. */
  current: { title: string; url: string } | null;
};

type Row = {
  bgg_id: number;
  title: string;
  title_ru: string | null;
  year: number | null;
  rank: number | null;
  bgg_url: string;
  shop: ShopCode;
  external_id: string;
  product_title: string;
  product_url: string;
  vendor: string | null;
  reason: string;
  game_has_price: boolean;
  current_title: string | null;
  current_url: string | null;
};

/**
 * Candidates waiting for the owner. Games that show no price anywhere come first, since
 * a decision there adds a price to the site; then by BGG rank.
 */
export async function listReviewQueue(
  db: Db,
  filter: { shop?: ShopCode; withoutPrice?: boolean } = {},
): Promise<ReviewItem[]> {
  const result = await db.execute(sql`
    SELECT * FROM (
      SELECT
        g.bgg_id, g.title, g.title_ru, g.year, g.rank, g.bgg_url,
        l.shop, l.external_id, p.title AS product_title, p.url AS product_url, p.vendor, l.reason,
        EXISTS (SELECT 1 FROM product_links c WHERE c.bgg_id = l.bgg_id AND c.status = 'confirmed') AS game_has_price,
        cp.title AS current_title, cp.url AS current_url
      FROM product_links l
      JOIN games g ON g.bgg_id = l.bgg_id
      JOIN shop_products p ON p.shop = l.shop AND p.external_id = l.external_id
      LEFT JOIN product_links cl ON cl.bgg_id = l.bgg_id AND cl.shop = l.shop AND cl.status = 'confirmed'
      LEFT JOIN shop_products cp ON cp.shop = cl.shop AND cp.external_id = cl.external_id
      WHERE ${waitingCandidate}
        ${filter.shop ? sql`AND l.shop = ${filter.shop}` : sql``}
    ) q
    ${filter.withoutPrice ? sql`WHERE NOT q.game_has_price` : sql``}
    ORDER BY q.game_has_price, q.rank NULLS LAST, q.bgg_id, q.shop, q.external_id
  `);
  return resultRows<Row>(result).map((row) => ({
    bggId: row.bgg_id,
    gameTitle: row.title,
    titleRu: row.title_ru,
    year: row.year,
    rank: row.rank,
    bggUrl: row.bgg_url,
    shop: row.shop,
    externalId: row.external_id,
    productTitle: row.product_title,
    productUrl: row.product_url,
    vendor: row.vendor,
    reason: row.reason,
    gameHasPrice: row.game_has_price,
    current: row.current_title !== null && row.current_url !== null ? { title: row.current_title, url: row.current_url } : null,
  }));
}

export type LinkId = { bggId: number; shop: ShopCode; externalId: string };

async function decide(db: Db, link: LinkId, status: "confirmed" | "rejected", now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    const found = resultRows<{ ok: number }>(
      await tx.execute(sql`
        SELECT 1 AS ok FROM product_links l
        WHERE l.bgg_id = ${link.bggId} AND l.shop = ${link.shop} AND l.external_id = ${link.externalId}
          AND ${waitingCandidate}`),
    );
    if (found.length === 0) {
      throw new Error(`${link.shop} ${link.externalId} for game ${link.bggId} is not a waiting candidate`);
    }
    if (status === "confirmed") {
      // One product per game per shop: the owner's choice takes the place of the one confirmed before.
      await tx.execute(sql`
        DELETE FROM product_links
        WHERE bgg_id = ${link.bggId} AND shop = ${link.shop} AND status = 'confirmed'`);
    }
    await tx.execute(sql`
      UPDATE product_links
      SET status = ${status}, decided_by = 'owner', decided_at = ${now.toISOString()}
      WHERE bgg_id = ${link.bggId} AND shop = ${link.shop} AND external_id = ${link.externalId}`);
  });
}

/** The owner says this product is the game. Its price is read from the next run on. */
export function confirmCandidate(db: Db, link: LinkId, now: Date = new Date()): Promise<void> {
  return decide(db, link, "confirmed", now);
}

/** The owner says this product is not the game. The matcher never proposes it again. */
export function rejectCandidate(db: Db, link: LinkId, now: Date = new Date()): Promise<void> {
  return decide(db, link, "rejected", now);
}
