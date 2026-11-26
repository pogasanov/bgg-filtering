import type { GameHistory } from "./history";
import type { GameOffer } from "./offers";
import { shopCodes, type ShopCode } from "./types";

/** One recorded change of a game's price or stock in one shop: a row of the panel's table. */
export type ChangeRow = {
  id: string;
  /** ISO time the shop was seen with this price and stock. */
  at: string;
  shop: ShopCode;
  /** The shop's product page; null if the shop is no longer among the game's current offers. */
  url: string | null;
  price: number | null;
  /** False when the shop listed the game as out of stock. */
  available: boolean;
  /** Percent against the same shop's previous price; null when there is nothing to compare or it did not move. */
  changePercent: number | null;
  /** The shop's latest row: what it asks today. */
  current: boolean;
  /** Set on a current row whose shop has not been checked lately; `checkedAt` says when it last was. */
  stale: boolean;
  checkedAt: string | null;
};

/** Every recorded change across the game's shops, newest first. */
export function changeRows(history: GameHistory, offers: GameOffer[]): ChangeRow[] {
  const offerByShop = new Map(offers.map((offer) => [offer.shop, offer]));
  const rows: ChangeRow[] = [];

  for (const shop of history.shops) {
    const offer = offerByShop.get(shop.shop);
    let previousPrice: number | null = null;
    shop.points.forEach((point, index) => {
      const current = index === shop.points.length - 1;
      const moved = point.price !== null && previousPrice !== null && point.price !== previousPrice;
      rows.push({
        id: `${shop.shop}:${point.at}`,
        at: point.at,
        shop: shop.shop,
        url: offer?.url ?? null,
        price: point.price,
        available: point.available !== false,
        changePercent: moved ? Math.round(((point.price as number) / (previousPrice as number) - 1) * 100) || null : null,
        current,
        stale: current && (offer?.stale ?? false),
        checkedAt: current ? shop.checkedAt : null,
      });
      if (point.price !== null) previousPrice = point.price;
    });
  }

  return rows.sort(
    (a, b) => Date.parse(b.at) - Date.parse(a.at) || shopCodes.indexOf(a.shop) - shopCodes.indexOf(b.shop),
  );
}
