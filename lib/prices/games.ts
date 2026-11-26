import { asc } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { games } from "@/lib/db/schema";
import { mergeNames } from "@/lib/prices/names";
import { shopByPublisherId } from "@/lib/prices/publishers";
import type { GameNames, ShopCode } from "@/lib/prices/types";

/**
 * The games to price, in rank order: every name BGG knows for each, and the tracked
 * shops whose publisher released it in Russian. Both come from the weekly BGG sync.
 */
export async function loadGamesForPricing(db: Db): Promise<GameNames[]> {
  const rows = await db
    .select({
      bggId: games.bggId,
      title: games.title,
      alternateNames: games.alternateNames,
      publisherIds: games.publisherIds,
    })
    .from(games)
    .orderBy(asc(games.rank), asc(games.bggId));

  return rows.map((row) => {
    const shops = new Set<ShopCode>();
    for (const id of row.publisherIds) {
      const shop = shopByPublisherId[id];
      if (shop) shops.add(shop);
    }
    return { ...mergeNames(row.bggId, row.title, row.alternateNames), publisherShops: [...shops].sort() };
  });
}
