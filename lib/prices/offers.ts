import type { ShopCode } from "./types";

/** What one tracked shop currently asks for a game. Only confirmed links become offers. */
export type GameOffer = {
  shop: ShopCode;
  /** The shop's product page, linked as is. */
  url: string;
  /** Whole rubles; null when the shop showed no price. */
  price: number | null;
  oldPrice: number | null;
  /** null when the shop does not say; treated as in stock. */
  available: boolean | null;
  /** ISO time of the last successful check of this product; null if never checked. */
  checkedAt: string | null;
  /** Not checked recently enough to trust: shown greyed, never counted as a current price. */
  stale: boolean;
  /** Rounded percent off, or null when not on sale. */
  salePercent: number | null;
};

export const STALE_AFTER_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A price this far below its recent high counts as a sale even if the shop does not say so. */
const SALE_DROP = 0.1;

export const shopNames: Record<ShopCode, string> = {
  crowdgames: "CrowdGames",
  lavkaigr: "Лавка игр",
  gaga: "GaGa",
};

/**
 * Personal discounts the owner has in some shops, in percent. Display only: stored prices,
 * sorting and the best-offer choice all use the shop's own price.
 */
export const personalDiscounts: Partial<Record<ShopCode, number>> = {
  crowdgames: 15,
  lavkaigr: 10,
};

/** The price after the personal discount in that shop, in whole rubles; null when there is none. */
export function discountedPrice(shop: ShopCode, price: number | null): number | null {
  const percent = personalDiscounts[shop];
  if (price === null || percent === undefined) return null;
  return Math.round(price * (1 - percent / 100));
}

export function isStale(checkedAt: string | null, now: Date): boolean {
  if (checkedAt === null) return true;
  return now.getTime() - new Date(checkedAt).getTime() > STALE_AFTER_DAYS * DAY_MS;
}

/**
 * On sale when the shop shows a higher crossed-out price, or the price is at least 10% under
 * the highest it has been in the last 30 days. The discount is measured from the higher of the two.
 */
export function salePercent(price: number | null, oldPrice: number | null, recentHigh: number | null): number | null {
  if (price === null) return null;
  const shopSale = oldPrice !== null && oldPrice > price;
  const dropped = recentHigh !== null && price <= recentHigh * (1 - SALE_DROP);
  if (!shopSale && !dropped) return null;
  const reference = Math.max(shopSale ? oldPrice : 0, dropped ? recentHigh : 0);
  return Math.round((1 - price / reference) * 100);
}

export function inStock(offer: GameOffer): boolean {
  return offer.price !== null && offer.available !== false && !offer.stale;
}

function cheapest(offers: GameOffer[]): GameOffer | null {
  return offers.reduce<GameOffer | null>(
    (best, offer) => (best === null || (offer.price as number) < (best.price as number) ? offer : best),
    null,
  );
}

/** The lowest price that can actually be paid today. */
export function bestOffer(offers: GameOffer[]): GameOffer | null {
  return cheapest(offers.filter(inStock));
}

/** The lowest recent price whether or not it is in stock: what the game costs when it is available. */
export function lowestKnownOffer(offers: GameOffer[]): GameOffer | null {
  return cheapest(offers.filter((offer) => offer.price !== null && !offer.stale));
}

/** "1 390 ₽" with non-breaking spaces; built by hand so server and browser always agree. */
export function formatPrice(price: number | null): string {
  if (price === null) return "—";
  return `${String(price).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₽`;
}
