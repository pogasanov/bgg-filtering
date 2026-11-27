import type { Db } from "@/lib/db/client";
import { type CollectionSummary, fetchCatalogue, storeCollection } from "@/lib/prices/collect";
import { loadGamesForPricing } from "@/lib/prices/games";
import type { ShopOutcome } from "@/lib/prices/report";
import { countCandidates, getCurrentOffers } from "@/lib/prices/store";
import type { ShopCode, ShopProduct } from "@/lib/prices/types";

type RunOptions = {
  db: Db;
  shops: readonly ShopCode[];
  userAgent: string;
  log: (line: string) => void;
  /** Reads a shop's catalogue from somewhere other than the shop, e.g. a dry run's cache. */
  readCatalogue?: (shop: ShopCode) => ShopProduct[];
};

/**
 * One price run, shared by the local script and the Modal worker: read each shop's
 * catalogue, then store catalogues, links and prices. One shop failing never stops
 * the others; the failures come back in the summary.
 */
export async function runPriceCollection(options: RunOptions): Promise<CollectionSummary> {
  const { db, log } = options;
  const startedAt = new Date();
  const games = await loadGamesForPricing(db);
  if (games.every((game) => game.names.length === 1)) {
    throw new Error("No alternate names are stored yet. Run the BGG sync once, then try again.");
  }
  log(`Games: ${games.length}`);

  const outcomes: ShopOutcome[] = [];
  for (const shop of options.shops) {
    try {
      const products = options.readCatalogue
        ? options.readCatalogue(shop)
        : await fetchCatalogue(shop, games, options.userAgent);
      log(`  ${shop}: ${products.length} products${options.readCatalogue ? " (cached)" : ""}`);
      outcomes.push({ shop, products });
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      log(`  ${shop}: FAILED — ${message}`);
      outcomes.push({ shop, error: message });
    }
  }

  const summary = await storeCollection(db, games, outcomes, startedAt, new Date());
  for (const shop of summary.shops) {
    log(
      shop.error === null
        ? `  ${shop.shop}: ${shop.confirmed} confirmed, ${shop.candidates} candidates, ${shop.pricesChanged} prices changed`
        : `  ${shop.shop}: FAILED — ${shop.error}`,
    );
  }
  log(`  Russian titles changed: ${summary.russianTitlesChanged}`);
  const offers = await getCurrentOffers(db);
  log(
    `Stored: ${offers.length} current prices for ${new Set(offers.map((offer) => offer.bggId)).size} games; ` +
      `${await countCandidates(db)} candidates wait for review.`,
  );
  return summary;
}
