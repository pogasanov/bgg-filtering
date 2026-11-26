import { XMLParser } from "fast-xml-parser";
import {
  type NormalizedGame,
  type PlayerCount,
  type PlayerRecommendation,
  type PlayerRecommendations,
  playerCounts,
} from "./types";
import { decodeEntities } from "@/lib/prices/html";
import { russianTitle } from "./russian-title";

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


function stringOrNull(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
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
    const versions = asArray(item.versions?.item);
    const languages = [
      ...new Set(
        versions.flatMap((version: any) =>
          asArray(version.link)
            .filter(
              (link: any) => link.type === "language" && link.value !== undefined && String(link.value).trim() !== "",
            )
            .map((link: any) => String(link.value)),
        ),
      ),
    ].sort();
    const names = asArray(item.name);
    const primaryName = names.find((name: any) => name.type === "primary") ?? names[0];
    const alternateNames = names
      .filter((name: any) => name !== primaryName && name.value !== undefined)
      // BGG double-encodes some names, leaving "&#039;" in the parsed value.
      .map((name: any) => decodeEntities(String(name.value)));
    const publisherIds = asArray(item.link)
      .filter((link: any) => link.type === "boardgamepublisher")
      .map((link: any) => Number(link.id))
      .filter((id: number) => Number.isInteger(id));
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
      titleRu: russianTitle(alternateNames),
      year: numberOrNull(item.yearpublished?.value),
      thumbnailUrl: stringOrNull(item.thumbnail),
      geekRating: numberOrNull(ratings.bayesaverage?.value),
      averageRating: numberOrNull(ratings.average?.value),
      numVoters: numberOrNull(ratings.usersrated?.value),
      minPlayers: numberOrNull(item.minplayers?.value),
      maxPlayers: numberOrNull(item.maxplayers?.value),
      playingTime: numberOrNull(item.playingtime?.value),
      weight: numberOrNull(ratings.averageweight?.value),
      categories,
      mechanics,
      languages,
      playerRecommendations,
      bggUrl: `https://boardgamegeek.com/boardgame/${item.id}`,
      alternateNames,
      publisherIds,
    };
  });
}
