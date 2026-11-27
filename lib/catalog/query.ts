import { and, asc, count, countDistinct, eq, inArray, max, or, sql, type SQL } from "drizzle-orm";
import { emptyPlayerRecommendations } from "@/lib/bgg/parser";
import type {
  ListedGame,
  MatrixSelection,
  PlayerCount,
  PlayerRecommendations,
  RecommendationVerdict,
  SortKey,
} from "@/lib/bgg/types";
import type { Db } from "@/lib/db/client";
import { gameLanguages, games, gameTags, playerRecommendations, rankedGames, syncRuns } from "@/lib/db/schema";
import { defaultSortDir, type GameFilters } from "@/lib/filtering";
import type { CatalogFrame, GamesView } from "@/lib/games-view";
import { clampPage, PAGE_SIZE, pageCount } from "@/lib/pagination";
import { bestOffer, isStale, salePercent, STALE_AFTER_DAYS, type GameOffer } from "@/lib/prices/offers";
import { getCurrentOffers } from "@/lib/prices/store";
import { shopCodes } from "@/lib/prices/types";
import { defaultFilters } from "@/lib/url-state";
import { buildYearScale } from "@/lib/year-scale";

/** The listed games are the ranked ones that have details: `games` joined with `ranked_games`. */
const isRanked = eq(rankedGames.bggId, games.bggId);

const sortColumns = {
  rank: games.rank,
  year: games.year,
  playingTime: games.playingTime,
  weight: games.weight,
  geekRating: games.geekRating,
  averageRating: games.averageRating,
  numVoters: games.numVoters,
} satisfies Record<Exclude<SortKey, "price">, unknown>;

/**
 * The lowest current price of a game among its confirmed shop links, as a scalar subquery.
 * With `inStockOnly` it is the price that can be paid today, matching `bestOffer`; without, the
 * lowest recent price in or out of stock, matching `lowestKnownOffer`. A shop not checked within
 * the staleness window never counts.
 */
function currentPrice(now: Date, inStockOnly: boolean): SQL {
  const freshSince = new Date(now.getTime() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const inStock = inStockOnly ? sql`AND h.available IS DISTINCT FROM false` : sql``;
  return sql`(
    SELECT min(h.price)
    FROM product_links l
    JOIN price_checks c ON c.shop = l.shop AND c.external_id = l.external_id
    JOIN LATERAL (
      SELECT price, available FROM price_history
      WHERE shop = l.shop AND external_id = l.external_id
      ORDER BY observed_at DESC LIMIT 1
    ) h ON true
    WHERE l.bgg_id = ${games.bggId} AND l.status = 'confirmed'
      AND h.price IS NOT NULL AND c.checked_at >= ${freshSince}::timestamptz ${inStock}
  )`;
}

/** The catalog order, which also breaks ties under any other sort. */
const catalogOrder = [sql`coalesce(${games.rank}, ${rankedGames.rank})`, asc(games.title), asc(games.bggId)];

function playerNumber(playerCount: PlayerCount): number {
  return playerCount === "6+" ? 7 : Number(playerCount);
}

function matchesSelection(selection: MatrixSelection): SQL {
  if (selection.verdict === "not-playable") {
    // Outside the game's known player range; an unknown bound never excludes a count.
    const count = playerNumber(selection.playerCount);
    return sql`(coalesce(${games.minPlayers} > ${count}, false) or coalesce(${games.maxPlayers} < ${count}, false))`;
  }
  return sql`exists (select 1 from ${playerRecommendations} where ${playerRecommendations.gameId} = ${games.bggId} and ${playerRecommendations.playerCount} = ${selection.playerCount} and ${playerRecommendations.verdict} = ${selection.verdict})`;
}

/** The tag filter offers BGG mechanics only; categories are stored but neither offered nor matched. */
const isMechanic = eq(gameTags.kind, "mechanic");

/**
 * The WHERE clause for the filters. Every filter narrows the list (AND); a game must have every selected
 * mechanic (AND); in the matrix, verdicts within one player-count row are alternatives and every row must match.
 */
export function filterCondition(filters: GameFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = [];

  const search = filters.search.trim().toLowerCase();
  if (search) {
    conditions.push(
      sql`(strpos(lower(${games.title}), ${search}) > 0 or strpos(lower(coalesce(${games.titleRu}, '')), ${search}) > 0)`,
    );
  }

  if (filters.language) {
    conditions.push(
      sql`exists (select 1 from ${gameLanguages} where ${gameLanguages.gameId} = ${games.bggId} and ${gameLanguages.name} = ${filters.language})`,
    );
  }

  // A game with an unknown year passes any year range.
  if (filters.minYear !== null) conditions.push(sql`(${games.year} is null or ${games.year} >= ${filters.minYear})`);
  if (filters.maxYear !== null) conditions.push(sql`(${games.year} is null or ${games.year} <= ${filters.maxYear})`);

  for (const tag of filters.tags) {
    conditions.push(
      sql`exists (select 1 from ${gameTags} where ${gameTags.gameId} = ${games.bggId} and ${isMechanic} and ${gameTags.name} = ${tag})`,
    );
  }

  const rows = new Map<PlayerCount, MatrixSelection[]>();
  for (const selection of filters.matrix) {
    rows.set(selection.playerCount, [...(rows.get(selection.playerCount) ?? []), selection]);
  }
  for (const selections of rows.values()) conditions.push(or(...selections.map(matchesSelection)));

  return and(...conditions);
}

function sortOrder(filters: GameFilters, now: Date): SQL[] {
  // Missing values go last whichever way the column is sorted.
  const direction = (filters.sortDir ?? defaultSortDir(filters.sort)) === "asc" ? sql`asc` : sql`desc`;
  if (filters.sort === "price") {
    return [
      sql`${currentPrice(now, true)} ${direction} nulls last`,
      // Among games nobody can buy today, those with a known price come before those with none.
      sql`(${currentPrice(now, false)} is null) asc`,
      ...catalogOrder,
    ];
  }
  return [sql`${sortColumns[filters.sort]} ${direction} nulls last`, ...catalogOrder];
}

async function countGames(db: Db, where: SQL | undefined): Promise<number> {
  const [row] = await db.select({ count: count() }).from(games).innerJoin(rankedGames, isRanked).where(where);
  return Number(row?.count ?? 0);
}

/** The ids of the listed games: what a per-game request is checked against before it may query anything. */
export async function queryListedIds(db: Db): Promise<number[]> {
  const rows = await db.select({ id: games.bggId }).from(games).innerJoin(rankedGames, isRanked);
  return rows.map((row) => row.id);
}

/** How many games pass the filters, over all pages. */
export function countFilteredGames(db: Db, filters: GameFilters): Promise<number> {
  return countGames(db, filterCondition(filters));
}

/** How many games the catalog lists under the default filters: the unfiltered pages' length. */
export function countCatalogGames(db: Db): Promise<number> {
  return countGames(db, filterCondition(defaultFilters));
}

/** Games per mechanic among the ranked games passing the condition. */
async function countTags(db: Db, where: SQL | undefined): Promise<Map<string, number>> {
  const rows = await db
    .select({ name: gameTags.name, count: countDistinct(gameTags.gameId) })
    .from(gameTags)
    .innerJoin(games, eq(games.bggId, gameTags.gameId))
    .innerJoin(rankedGames, isRanked)
    .where(and(isMechanic, where))
    .groupBy(gameTags.name);
  return new Map(rows.map((row) => [row.name, Number(row.count)]));
}

/**
 * Mechanic counts under every filter, the selected mechanics included: since a game must have all of
 * them, a count says how many games stay if that mechanic is added, and a selected one counts the list.
 */
export function tagCounts(db: Db, filters: GameFilters): Promise<Map<string, number>> {
  return countTags(db, filterCondition(filters));
}

const listedColumns = {
  id: games.bggId,
  rank: games.rank,
  title: games.title,
  titleRu: games.titleRu,
  year: games.year,
  thumbnailUrl: games.thumbnailUrl,
  geekRating: games.geekRating,
  averageRating: games.averageRating,
  numVoters: games.numVoters,
  minPlayers: games.minPlayers,
  maxPlayers: games.maxPlayers,
  playingTime: games.playingTime,
  weight: games.weight,
  bggUrl: games.bggUrl,
};

type GameRow = { [Key in keyof typeof listedColumns]: ListedGame[Key] };

/**
 * What the tracked shops ask for these games today, per game and in `shopCodes` order.
 * Staleness and sales are judged against `now`, once, so everything rendered from one query agrees.
 */
async function offersByGame(db: Db, ids: number[], now: Date): Promise<Map<number, GameOffer[]>> {
  const byGame = new Map<number, GameOffer[]>();
  for (const row of await getCurrentOffers(db, now, ids)) {
    const checkedAt = row.checkedAt.toISOString();
    byGame.set(row.bggId, [
      ...(byGame.get(row.bggId) ?? []),
      {
        shop: row.shop,
        url: row.url,
        price: row.price,
        oldPrice: row.oldPrice,
        available: row.available,
        checkedAt,
        stale: isStale(checkedAt, now),
        salePercent: salePercent(row.price, row.oldPrice, row.recentHigh),
      },
    ]);
  }
  for (const offers of byGame.values()) {
    offers.sort((a, b) => shopCodes.indexOf(a.shop) - shopCodes.indexOf(b.shop));
  }
  return byGame;
}

/** Adds tags, languages, poll results and shop offers to the game rows, keeping their order. */
async function withDetails(db: Db, rows: GameRow[], now: Date): Promise<ListedGame[]> {
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return [];

  const [offers, tagRows, languageRows, recommendationRows] = await Promise.all([
    offersByGame(db, ids, now),
    db
      .select({ gameId: gameTags.gameId, kind: gameTags.kind, name: gameTags.name })
      .from(gameTags)
      .where(inArray(gameTags.gameId, ids))
      .orderBy(asc(gameTags.name)),
    db
      .select({ gameId: gameLanguages.gameId, name: gameLanguages.name })
      .from(gameLanguages)
      .where(inArray(gameLanguages.gameId, ids))
      .orderBy(asc(gameLanguages.name)),
    db
      .select({
        gameId: playerRecommendations.gameId,
        playerCount: playerRecommendations.playerCount,
        best: playerRecommendations.bestVotes,
        recommended: playerRecommendations.recommendedVotes,
        notRecommended: playerRecommendations.notRecommendedVotes,
        verdict: playerRecommendations.verdict,
      })
      .from(playerRecommendations)
      .where(inArray(playerRecommendations.gameId, ids)),
  ]);

  const tagsByGame = new Map<number, { categories: string[]; mechanics: string[] }>();
  for (const row of tagRows) {
    const tags = tagsByGame.get(row.gameId) ?? { categories: [], mechanics: [] };
    (row.kind === "category" ? tags.categories : tags.mechanics).push(row.name);
    tagsByGame.set(row.gameId, tags);
  }
  const languagesByGame = new Map<number, string[]>();
  for (const row of languageRows) {
    languagesByGame.set(row.gameId, [...(languagesByGame.get(row.gameId) ?? []), row.name]);
  }
  const recommendationsByGame = new Map<number, PlayerRecommendations>();
  for (const row of recommendationRows) {
    const recommendations = recommendationsByGame.get(row.gameId) ?? emptyPlayerRecommendations();
    recommendations[row.playerCount as PlayerCount] = {
      best: row.best,
      recommended: row.recommended,
      notRecommended: row.notRecommended,
      verdict: row.verdict as RecommendationVerdict,
    };
    recommendationsByGame.set(row.gameId, recommendations);
  }

  return rows.map((row) => ({
    ...row,
    categories: tagsByGame.get(row.id)?.categories ?? [],
    mechanics: tagsByGame.get(row.id)?.mechanics ?? [],
    languages: languagesByGame.get(row.id) ?? [],
    playerRecommendations: recommendationsByGame.get(row.id) ?? emptyPlayerRecommendations(),
    offers: offers.get(row.id) ?? [],
    bestPrice: bestOffer(offers.get(row.id) ?? [])?.price ?? null,
  }));
}

/** One page of the games passing the filters. A page number past the end lands on the last page. */
export async function queryGamesView(
  db: Db,
  filters: GameFilters,
  requestedPage = 1,
  now: Date = new Date(),
): Promise<GamesView> {
  const where = filterCondition(filters);
  const [shown, total, counts] = await Promise.all([
    countGames(db, where),
    countGames(db, undefined),
    tagCounts(db, filters),
  ]);
  const page = clampPage(requestedPage, shown);
  const rows = await db
    .select(listedColumns)
    .from(games)
    .innerJoin(rankedGames, isRanked)
    .where(where)
    .orderBy(...sortOrder(filters, now))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return {
    games: await withDetails(db, rows as GameRow[], now),
    shown,
    total,
    page,
    pageCount: pageCount(shown),
    tagCounts: counts,
  };
}

/** What the filter rail offers and the counts with no filters: the part of the page no filter changes. */
export async function queryCatalogFrame(db: Db): Promise<CatalogFrame> {
  const [tagRows, languageRows, yearRows, total, counts, [status]] = await Promise.all([
    db
      .selectDistinct({ name: gameTags.name })
      .from(gameTags)
      .innerJoin(rankedGames, eq(rankedGames.bggId, gameTags.gameId))
      .innerJoin(games, isRanked)
      .where(isMechanic),
    db
      .selectDistinct({ name: gameLanguages.name })
      .from(gameLanguages)
      .innerJoin(rankedGames, eq(rankedGames.bggId, gameLanguages.gameId))
      .innerJoin(games, isRanked),
    db.selectDistinct({ year: games.year }).from(games).innerJoin(rankedGames, isRanked),
    countGames(db, undefined),
    tagCounts(db, defaultFilters),
    db
      .select({ updatedAt: max(syncRuns.finishedAt) })
      .from(syncRuns)
      .where(inArray(syncRuns.status, ["success", "partial"])),
  ]);

  return {
    facets: {
      // Sorted here rather than in SQL so the order does not depend on the database collation.
      allTags: tagRows.map((row) => row.name).sort(),
      allLanguages: languageRows.map((row) => row.name).sort(),
      yearScale: buildYearScale(yearRows.map((row) => row.year)),
    },
    status: {
      gameCount: total,
      updatedAt: status?.updatedAt ? new Date(status.updatedAt).toISOString() : null,
    },
    total,
    tagCounts: counts,
  };
}
