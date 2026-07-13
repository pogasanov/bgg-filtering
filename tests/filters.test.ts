import { describe, expect, test } from "vitest";
import { filterGames } from "@/lib/filtering";
import type { NormalizedGame } from "@/lib/bgg/types";

function makeGame(overrides: Partial<NormalizedGame>): NormalizedGame {
  return {
    id: 1,
    rank: 1,
    title: "Base Game",
    year: 2020,
    description: "",
    geekRating: 8,
    averageRating: 8.2,
    numVoters: 100,
    minPlayers: 1,
    maxPlayers: 6,
    playingTime: 60,
    weight: 2,
    categories: [],
    mechanics: [],
    playerRecommendations: {
      "1": { best: 0, recommended: 0, notRecommended: 0, verdict: "unknown" },
      "2": { best: 0, recommended: 0, notRecommended: 0, verdict: "unknown" },
      "3": { best: 0, recommended: 0, notRecommended: 0, verdict: "unknown" },
      "4": { best: 0, recommended: 0, notRecommended: 0, verdict: "unknown" },
      "5": { best: 0, recommended: 0, notRecommended: 0, verdict: "unknown" },
      "6": { best: 0, recommended: 0, notRecommended: 0, verdict: "unknown" },
      "6+": { best: 0, recommended: 0, notRecommended: 0, verdict: "unknown" },
    },
    bggUrl: "https://boardgamegeek.com/boardgame/1",
    ...overrides,
  };
}

describe("game filtering", () => {
  const games = [
    makeGame({
      id: 1,
      title: "Sky Team",
      categories: ["Aviation"],
      mechanics: ["Cooperative Game"],
      playerRecommendations: {
        ...makeGame({}).playerRecommendations,
        "2": { best: 40, recommended: 3, notRecommended: 0, verdict: "best" },
      },
    }),
    makeGame({
      id: 2,
      title: "Adventure Guild",
      categories: ["Adventure"],
      mechanics: ["Worker Placement"],
      playerRecommendations: {
        ...makeGame({}).playerRecommendations,
        "3": { best: 1, recommended: 18, notRecommended: 2, verdict: "recommended" },
        "6+": { best: 0, recommended: 0, notRecommended: 22, verdict: "not-recommended" },
      },
    }),
  ];

  test("empty matrix selection does not filter by player recommendations", () => {
    expect(filterGames(games, { search: "", tags: [], matrix: [], sort: "rank" }).map((g) => g.id)).toEqual([1, 2]);
  });

  test("selected matrix cells match with OR logic including 6+", () => {
    const result = filterGames(games, {
      search: "",
      tags: [],
      matrix: [
        { playerCount: "2", verdict: "best" },
        { playerCount: "6+", verdict: "not-recommended" },
      ],
      sort: "rank",
    });

    expect(result.map((g) => g.id)).toEqual([1, 2]);
  });

  test("search and tag filters combine with matrix filters using AND logic", () => {
    const result = filterGames(games, {
      search: "guild",
      tags: ["Worker Placement"],
      matrix: [{ playerCount: "3", verdict: "recommended" }],
      sort: "rank",
    });

    expect(result.map((g) => g.id)).toEqual([2]);
  });
});
