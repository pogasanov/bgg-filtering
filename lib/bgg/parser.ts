import { XMLParser } from "fast-xml-parser";
import {
  type NormalizedGame,
  type PlayerCount,
  type PlayerRecommendation,
  type PlayerRecommendations,
  playerCounts,
  type TopRankItem,
} from "./types";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  htmlEntities: true,
});

const emptyRecommendation = (): PlayerRecommendation => ({
  best: 0,
  recommended: 0,
  notRecommended: 0,
  verdict: "unknown",
});

export function emptyPlayerRecommendations(): PlayerRecommendations {
  return Object.fromEntries(playerCounts.map((count) => [count, emptyRecommendation()])) as PlayerRecommendations;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function numberOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === "" || value === "N/A") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function normalizePlayerCount(value: unknown): PlayerCount | null {
  const text = String(value ?? "").trim();
  if (text === "1" || text === "2" || text === "3" || text === "4" || text === "5" || text === "6") return text;
  if (text === "6+" || text === "6 or more") return "6+";
  return null;
}

function recommendationFromResults(resultsNode: unknown): PlayerRecommendation {
  const recommendation = emptyRecommendation();
  const results = asArray((resultsNode as { result?: unknown })?.result);

  for (const result of results as Array<{ value?: string; numvotes?: string | number }>) {
    const votes = numberOrNull(result.numvotes) ?? 0;
    if (result.value === "Best") recommendation.best = votes;
    if (result.value === "Recommended") recommendation.recommended = votes;
    if (result.value === "Not Recommended") recommendation.notRecommended = votes;
  }

  const maxVotes = Math.max(recommendation.best, recommendation.recommended, recommendation.notRecommended);
  if (maxVotes === 0) return recommendation;
  if (recommendation.best === maxVotes) return { ...recommendation, verdict: "best" };
  if (recommendation.recommended === maxVotes) return { ...recommendation, verdict: "recommended" };
  return { ...recommendation, verdict: "not-recommended" };
}

export function parseThingXml(xml: string): NormalizedGame[] {
  const parsed = xmlParser.parse(xml);
  const items = asArray(parsed?.items?.item);

  return items.map((item: any) => {
    const links = asArray(item.link);
    const categories = links.filter((link: any) => link.type === "boardgamecategory").map((link: any) => String(link.value)).sort();
    const mechanics = links.filter((link: any) => link.type === "boardgamemechanic").map((link: any) => String(link.value)).sort();
    const names = asArray(item.name);
    const primaryName = names.find((name: any) => name.type === "primary") ?? names[0];
    const ratings = item.statistics?.ratings ?? {};
    const ranks = asArray(ratings.ranks?.rank);
    const boardGameRank = ranks.find((rank: any) => rank.type === "subtype" && rank.name === "boardgame");
    const playerRecommendations = emptyPlayerRecommendations();
    const suggestedPlayersPoll = asArray(item.poll).find((poll: any) => poll.name === "suggested_numplayers");

    for (const resultSet of asArray((suggestedPlayersPoll as any)?.results)) {
      const count = normalizePlayerCount((resultSet as any).numplayers);
      if (count) playerRecommendations[count] = recommendationFromResults(resultSet);
    }

    return {
      id: Number(item.id),
      rank: numberOrNull(boardGameRank?.value),
      title: String(primaryName?.value ?? "Untitled"),
      year: numberOrNull(item.yearpublished?.value),
      description: stringOrEmpty(item.description),
      geekRating: numberOrNull(ratings.bayesaverage?.value),
      averageRating: numberOrNull(ratings.average?.value),
      numVoters: numberOrNull(ratings.usersrated?.value),
      minPlayers: numberOrNull(item.minplayers?.value),
      maxPlayers: numberOrNull(item.maxplayers?.value),
      playingTime: numberOrNull(item.playingtime?.value),
      weight: numberOrNull(ratings.averageweight?.value),
      categories,
      mechanics,
      playerRecommendations,
      bggUrl: `https://boardgamegeek.com/boardgame/${item.id}`,
    };
  });
}

export function parseTopRankRows(html: string): TopRankItem[] {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];

  return rows.flatMap((row) => {
    const linkMatch = [...row.matchAll(/href="\/boardgame\/(\d+)\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => ({ id: Number(match[1]), title: stripTags(match[2]) }))
      .find((match) => match.id && match.title);
    if (!linkMatch) return [];
    const { id, title } = linkMatch;
    if (!id || !title) return [];

    const rankMatch = row.match(/collection_rank[\s\S]*?(\d+)\s*<\/td>/i);
    const yearMatch = row.match(/\((\d{4})\)/);
    const numericCells = [...row.matchAll(/collection_bggrating[^>]*>\s*([0-9.]+|N\/A)\s*<\/td>/gi)].map((match) => match[1]);

    return [
      {
        id,
        rank: Number(rankMatch?.[1] ?? 0),
        title,
        year: yearMatch ? Number(yearMatch[1]) : null,
        geekRating: numberOrNull(numericCells[0]),
        averageRating: numberOrNull(numericCells[1]),
        numVoters: numberOrNull(numericCells[2]),
      },
    ];
  });
}
