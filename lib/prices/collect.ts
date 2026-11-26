import type { Db } from "@/lib/db/client";
import { createShopGet } from "@/lib/prices/http";
import { matchProducts } from "@/lib/prices/match";
import type { ShopOutcome } from "@/lib/prices/report";
import { shopAdapters } from "@/lib/prices/shops";
import { selectGagaUrls } from "@/lib/prices/shops/gaga";
import { recordPrices, recordRun, saveCatalog, saveLinks } from "@/lib/prices/store";
import type { GameNames, ShopCode, ShopProduct } from "@/lib/prices/types";

/**
 * Reads what one shop sells. CrowdGames and Lavka Igr list their whole catalogue in a
 * few requests. GaGa can only be read one product page at a time, so it is asked only
 * for the games GaGa itself publishes, one page each, chosen by address.
 */
export async function fetchCatalogue(shop: ShopCode, games: GameNames[], userAgent: string): Promise<ShopProduct[]> {
  const adapter = shopAdapters.find((item) => item.code === shop);
  if (!adapter) throw new Error(`No adapter for ${shop}`);

  const get = createShopGet({ origin: adapter.origin, userAgent });
  if (shop !== "gaga") return adapter.listCatalog(get);

  const published = games.filter((game) => game.publisherShops?.includes("gaga"));
  return adapter.listCatalog(get, {
    select: (urls) => [...new Set(published.flatMap((game) => selectGagaUrls(urls, game.names)))],
  });
}

export type CollectionSummary = {
  shops: {
    shop: ShopCode;
    error: string | null;
    products: number;
    confirmed: number;
    candidates: number;
    pricesChanged: number;
  }[];
};

/**
 * Stores one collection run: the catalogues, the links the matcher proposes, and the
 * price of every confirmed product. A shop that failed is recorded as failed and
 * nothing stored for it earlier is touched.
 */
export async function storeCollection(
  db: Db,
  games: GameNames[],
  outcomes: ShopOutcome[],
  startedAt: Date,
  now: Date,
): Promise<CollectionSummary> {
  const products = outcomes.flatMap((outcome) => ("products" in outcome ? outcome.products : []));
  const links = matchProducts(games, products);

  await saveCatalog(db, products, now);
  await saveLinks(db, links, products, now);

  const shops: CollectionSummary["shops"] = [];
  for (const outcome of outcomes) {
    const failed = "error" in outcome;
    const prices = failed ? { changed: 0 } : await recordPrices(db, outcome.products, now);
    const summary = {
      shop: outcome.shop,
      error: failed ? outcome.error : null,
      products: failed ? 0 : outcome.products.length,
      confirmed: links.filter((link) => link.shop === outcome.shop && link.status === "confirmed").length,
      candidates: links.filter((link) => link.shop === outcome.shop && link.status === "candidate").length,
      pricesChanged: prices.changed,
    };
    await recordRun(db, {
      shop: outcome.shop,
      startedAt,
      finishedAt: now,
      productsSeen: summary.products,
      pricesChanged: summary.pricesChanged,
      errorMessage: summary.error,
    });
    shops.push(summary);
  }

  return { shops };
}
