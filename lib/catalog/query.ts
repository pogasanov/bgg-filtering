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
} satisfies Record<SortKey, unknown>;

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

/**
 * The WHERE clause for the filters. Every filter narrows the list (AND); selected tags match any of
 * them (OR); in the matrix, verdicts within one player-count row are alternatives and every row must match.
 */
export function filterCondition(filters: GameFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = [];

  const search = filters.search.trim().toLowerCase();
  if (search) conditions.push(sql`strpos(lower(${games.title}), ${search}) > 0`);

  if (filters.language) {
    conditions.push(
      sql`exists (select 1 from ${gameLanguages} where ${gameLanguages.gameId} = ${games.bggId} and ${gameLanguages.name} = ${filters.language})`,
    );
  }

  // A game with an unknown year passes any year range.
  if (filters.minYear !== null) conditions.push(sql`(${games.year} is null or ${games.year} >= ${filters.minYear})`);
  if (filters.maxYear !== null) conditions.push(sql`(${games.year} is null or ${games.year} <= ${filters.maxYear})`);

  if (filters.tags.length > 0) {
    conditions.push(
      sql`exists (select 1 from ${gameTags} where ${gameTags.gameId} = ${games.bggId} and ${inArray(gameTags.name, filters.tags)})`,
    );
  }

  const rows = new Map<PlayerCount, MatrixSelection[]>();
  for (const selection of filters.matrix) {
    rows.set(selection.playerCount, [...(rows.get(selection.playerCount) ?? []), selection]);
  }
  for (const selections of rows.values()) conditions.push(or(...selections.map(matchesSelection)));

  return and(...conditions);
}

function sortOrder(filters: GameFilters): SQL[] {
  const column = sortColumns[filters.sort];
  // Missing values go last whichever way the column is sorted.
  const direction = (filters.sortDir ?? defaultSortDir(filters.sort)) === "asc" ? sql`asc` : sql`desc`;
  return [sql`${column} ${direction} nulls last`, ...catalogOrder];
}

async function countGames(db: Db, where: SQL | undefined): Promise<number> {
  const [row] = await db.select({ count: count() }).from(games).innerJoin(rankedGames, isRanked).where(where);
  return Number(row?.count ?? 0);
}

/** How many games the catalog lists. */
export function countCatalogGames(db: Db): Promise<number> {
  return countGames(db, undefined);
}

/** Games per tag among the ranked games passing the condition. */
async function countTags(db: Db, where: SQL | undefined): Promise<Map<string, number>> {
  const rows = await db
    .select({ name: gameTags.name, count: countDistinct(gameTags.gameId) })
    .from(gameTags)
    .innerJoin(games, eq(games.bggId, gameTags.gameId))
    .innerJoin(rankedGames, isRanked)
    .where(where)
    .groupBy(gameTags.name);
  return new Map(rows.map((row) => [row.name, Number(row.count)]));
}

/** Tag counts under every filter except the tag selection itself. */
export function tagCounts(db: Db, filters: GameFilters): Promise<Map<string, number>> {
  return countTags(db, filterCondition({ ...filters, tags: [] }));
}

const listedColumns = {
  id: games.bggId,
  rank: games.rank,
  title: games.title,
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

/** Adds tags, languages and poll results to the game rows, keeping their order. */
async function withDetails(db: Db, rows: GameRow[]): Promise<ListedGame[]> {
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return [];

  const [tagRows, languageRows, recommendationRows] = await Promise.all([
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
  }));
}

/** One page of the games passing the filters. A page number past the end lands on the last page. */
export async function queryGamesView(db: Db, filters: GameFilters, requestedPage = 1): Promise<GamesView> {
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
    .orderBy(...sortOrder(filters))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return {
    games: await withDetails(db, rows as GameRow[]),
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
      .innerJoin(games, isRanked),
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
