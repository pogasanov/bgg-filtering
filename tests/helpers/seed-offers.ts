import type { NormalizedGame, TopRankItem } from "@/lib/bgg/types";
import { replaceRankedGames, upsertGames } from "@/lib/catalog/store";
import type { Db } from "@/lib/db/client";
import { priceChecks, priceHistory, productLinks, shopProducts } from "@/lib/db/schema";
import { emptyPlayerRecommendations } from "@/lib/bgg/parser";

const SEEDED_AT = new Date("2026-11-20T00:00:00.000Z");

function game(id: number): NormalizedGame {
  return {
    id, rank: id, title: `Game ${id}`, year: 2020, thumbnailUrl: null, geekRating: 7.8, averageRating: 8.1, numVoters: 1000,
    minPlayers: 1, maxPlayers: 4, playingTime: 90, weight: 2.5, categories: [], mechanics: [], languages: [],
    playerRecommendations: emptyPlayerRecommendations(), bggUrl: `https://boardgamegeek.com/boardgame/${id}`,
  };
}

function ranked(id: number): TopRankItem {
  return { id, rank: id, title: `Game ${id}`, year: 2020, geekRating: 7, averageRating: 8, numVoters: 100 };
}

/** Game 1: a confirmed Lavka Igr product that went from 2000 to 1700, and a candidate CrowdGames one at 900. */
export async function seedOffers(db: Db): Promise<void> {
  await replaceRankedGames(db, [ranked(1), ranked(2)], SEEDED_AT);
  await upsertGames(db, [game(1), game(2)], SEEDED_AT);
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

