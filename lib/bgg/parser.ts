import { XMLParser } from "fast-xml-parser";
import {
  type NormalizedGame,
  type PlayerRecommendation,
  type PlayerRecommendations,
  playerCounts,
} from "./types";
import { decodeEntities } from "@/lib/prices/html";
import { russianCandidates } from "./russian-title";

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

type Votes = Pick<PlayerRecommendation, "best" | "recommended" | "notRecommended">;

function votesFromResults(resultsNode: unknown): Votes {
  const votes: Votes = { best: 0, recommended: 0, notRecommended: 0 };
  const results = asArray((resultsNode as { result?: unknown })?.result);

  for (const result of results as Array<{ value?: string; numvotes?: string | number }>) {
    const count = numberOrNull(result.numvotes) ?? 0;
    if (result.value === "Best") votes.best = count;
    if (result.value === "Recommended") votes.recommended = count;
    if (result.value === "Not Recommended") votes.notRecommended = count;
  }
  return votes;
}

function withVerdict(votes: Votes): PlayerRecommendation {
  const maxVotes = Math.max(votes.best, votes.recommended, votes.notRecommended);
  if (maxVotes === 0) return { ...votes, verdict: "unknown" };
  if (votes.best === maxVotes) return { ...votes, verdict: "best" };
  if (votes.recommended === maxVotes) return { ...votes, verdict: "recommended" };
  return { ...votes, verdict: "not-recommended" };
}

/**
 * BGG's poll has one row per player count up to the game's maximum, then one "N+" row for more than
 * that. Counts one to six map straight across. The "6+" bucket means seven or more: for each answer,
 * the most votes it got at any count from seven up. Adding the rows would count the same voters once
 * per row. When the poll stops at six, its "6+" row is all there is
 * on that. An "N+" row for a larger game is about counts past its maximum, so it is left out; a poll
 * that stops below six says nothing on seven or more.
 */
function playerRecommendationsFromPoll(poll: unknown): PlayerRecommendations {
  const recommendations = emptyPlayerRecommendations();
  const sevenOrMore: Votes = { best: 0, recommended: 0, notRecommended: 0 };
  let overSix: Votes | null = null;
  let hasSevenOrMore = false;

  for (const resultSet of asArray((poll as { results?: unknown })?.results)) {
    const text = String((resultSet as { numplayers?: unknown }).numplayers ?? "").trim();
    const votes = votesFromResults(resultSet);
    if (text === "1" || text === "2" || text === "3" || text === "4" || text === "5" || text === "6") {
      recommendations[text] = withVerdict(votes);
    } else if (text === "6+" || text === "6 or more") {
      overSix = votes;
    } else if (/^\d+$/.test(text) && Number(text) >= 7) {
      hasSevenOrMore = true;
      sevenOrMore.best = Math.max(sevenOrMore.best, votes.best);
      sevenOrMore.recommended = Math.max(sevenOrMore.recommended, votes.recommended);
      sevenOrMore.notRecommended = Math.max(sevenOrMore.notRecommended, votes.notRecommended);
    }
  }

  if (hasSevenOrMore) recommendations["6+"] = withVerdict(sevenOrMore);
  else if (overSix) recommendations["6+"] = withVerdict(overSix);
  return recommendations;
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
    const suggestedPlayersPoll = asArray(item.poll).find((poll: any) => poll.name === "suggested_numplayers");
    const playerRecommendations = playerRecommendationsFromPoll(suggestedPlayersPoll);

    return {
      id: Number(item.id),
      rank: numberOrNull(boardGameRank?.value),
      title: String(primaryName?.value ?? "Untitled"),
      ruNames: russianCandidates(alternateNames),
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
