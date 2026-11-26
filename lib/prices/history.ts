import { sql } from "drizzle-orm";
import { resultRows, type Db } from "@/lib/db/client";
import { shopCodes, type ShopCode } from "./types";

/** One change in a product's price or stock. History stores changes only, so each holds until the next. */
export type PricePoint = { at: string; price: number | null; available: boolean | null };

export type ShopHistory = {
  shop: ShopCode;
  /** Oldest first. */
  points: PricePoint[];
  /** ISO time of the last successful check: how far the last point is known to hold. */
  checkedAt: string | null;
};

export type GameHistory = {
  /** Shops with a confirmed link, in `shopCodes` order. */
  shops: ShopHistory[];
  /** The lowest price ever recorded, the earliest on ties. */
  lowest: { price: number; at: string; shop: ShopCode } | null;
};

export const EMPTY_HISTORY: GameHistory = { shops: [], lowest: null };

type HistoryRow = {
  shop: ShopCode;
  observed_at: Date | string | null;
  price: number | null;
  available: boolean | null;
  checked_at: Date | string | null;
};

const iso = (value: Date | string) => new Date(value).toISOString();

/** A BGG id from a URL segment: a positive integer written in plain digits, or null. */
export function parseGameId(raw: string): number | null {
  if (!/^[1-9]\d{0,8}$/.test(raw)) return null;
  return Number(raw);
}

/** Price history of one game across its confirmed shop links. Candidate links never appear. */
export async function getGameHistory(db: Db, bggId: number): Promise<GameHistory> {
  const rows = resultRows<HistoryRow>(
    await db.execute(sql`
      SELECT l.shop, h.observed_at, h.price, h.available, c.checked_at
      FROM product_links l
      LEFT JOIN price_history h ON h.shop = l.shop AND h.external_id = l.external_id
      LEFT JOIN price_checks c ON c.shop = l.shop AND c.external_id = l.external_id
      WHERE l.bgg_id = ${bggId} AND l.status = 'confirmed'
      ORDER BY h.observed_at ASC
    `),
  );

  const byShop = new Map<ShopCode, ShopHistory>();
  let lowest: GameHistory["lowest"] = null;
  for (const row of rows) {
    const shop = byShop.get(row.shop) ?? {
      shop: row.shop,
      points: [],
      checkedAt: row.checked_at === null ? null : iso(row.checked_at),
    };
    byShop.set(row.shop, shop);
    if (row.observed_at === null) continue;
    const at = iso(row.observed_at);
    shop.points.push({ at, price: row.price, available: row.available });
    if (row.price !== null && (lowest === null || row.price < lowest.price)) {
      lowest = { price: row.price, at, shop: row.shop };
    }
  }

  return {
    shops: shopCodes.flatMap((code) => byShop.get(code) ?? []),
    lowest,
  };
}
