import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { queryGamesView, tagCounts as queryTagCounts } from "@/lib/catalog/query";
import type { Db } from "@/lib/db/client";
import { defaultSortDir, gameTags, type GameFilters } from "@/lib/filtering";
import type { NormalizedGame } from "@/lib/bgg/types";
import { storeCatalog } from "./helpers/catalog";
import { createTestDb } from "./helpers/test-db";

// Filtering and sorting run in Postgres; these tests pin their meaning on an in-process PGlite.
let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(() => close());

async function filterGames(games: NormalizedGame[], filters: GameFilters) {
  await storeCatalog(db, games);
  return (await queryGamesView(db, filters)).games;
}

async function tagCounts(games: NormalizedGame[], filters: GameFilters) {
  await storeCatalog(db, games);
  return queryTagCounts(db, filters);
}

function makeGame(overrides: Partial<NormalizedGame>): NormalizedGame {
  return {
    id: 1,
    rank: 1,
    title: "Base Game",
    ruNames: [],
    year: 2020,
    thumbnailUrl: null,
    geekRating: 8,
    averageRating: 8.2,
    numVoters: 100,
    minPlayers: 1,
    maxPlayers: 6,
    playingTime: 60,
    weight: 2,
    categories: [],
    mechanics: [],
    languages: [],
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
      rank: 1,
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
      rank: 2,
      title: "Adventure Guild",
      categories: ["Adventure"],
      mechanics: ["Worker Placement"],
      playerRecommendations: {
        ...makeGame({}).playerRecommendations,
        "2": { best: 1, recommended: 18, notRecommended: 2, verdict: "recommended" },
        "3": { best: 1, recommended: 18, notRecommended: 2, verdict: "recommended" },
        "6+": { best: 0, recommended: 0, notRecommended: 22, verdict: "not-recommended" },
      },
    }),
  ];

  test("empty matrix selection does not filter by player recommendations", async () => {
    expect(
      (await filterGames(games, {
        search: "",
        language: "",
        tags: [],
        matrix: [],
        sort: "rank",
        minYear: null,
        maxYear: null,
      })).map((game) => game.id),
    ).toEqual([1, 2]);
  });

  test("selected verdicts within one player-count row match with OR logic", async () => {
    const result = await filterGames(games, {
      search: "",
      language: "",
      tags: [],
      matrix: [
        { playerCount: "2", verdict: "best" },
        { playerCount: "2", verdict: "recommended" },
      ],
      sort: "rank",
      minYear: null,
      maxYear: null,
    });

    expect(result.map((g) => g.id)).toEqual([1, 2]);
  });

  test("search and tag filters combine with matrix filters using AND logic", async () => {
    const result = await filterGames(games, {
      search: "guild",
      language: "",
      tags: ["Worker Placement"],
      matrix: [{ playerCount: "3", verdict: "recommended" }],
      sort: "rank",
      minYear: null,
      maxYear: null,
    });

    expect(result.map((g) => g.id)).toEqual([2]);
  });

  test("not playable matches player counts outside known game limits", async () => {
    const boundedGames = [
      makeGame({ id: 10, minPlayers: 2, maxPlayers: 4 }),
      makeGame({ id: 11, minPlayers: 1, maxPlayers: 8 }),
      makeGame({ id: 12, minPlayers: null, maxPlayers: null }),
    ];

    const filterAt = async (playerCount: "1" | "5" | "6+") =>
      (await filterGames(boundedGames, {
        search: "",
        language: "",
        tags: [],
        matrix: [{ playerCount, verdict: "not-playable" }],
        sort: "rank",
        minYear: null,
        maxYear: null,
      })).map((game) => game.id);

    expect(await filterAt("1")).toEqual([10]);
    expect(await filterAt("5")).toEqual([10]);
    expect(await filterAt("6+")).toEqual([10]);
  });

  test("requires every selected player-count row to match", async () => {
    const boundedGames = [
      makeGame({ id: 20, minPlayers: 2, maxPlayers: 4 }),
      makeGame({ id: 21, minPlayers: 2, maxPlayers: 3 }),
    ];

    const result = await filterGames(boundedGames, {
      search: "",
      language: "",
      tags: [],
      matrix: [
        { playerCount: "1", verdict: "not-playable" },
        { playerCount: "4", verdict: "not-playable" },
      ],
      sort: "rank",
      minYear: null,
      maxYear: null,
    });

    expect(result.map((game) => game.id)).toEqual([21]);
  });

  test("filters by one translation language", async () => {
    const translatedGames = [
      makeGame({ id: 20, languages: ["English", "French"] }),
      makeGame({ id: 21, languages: ["English", "German"] }),
      makeGame({ id: 22, languages: [] }),
    ];

    const result = await filterGames(translatedGames, {
      search: "",
      language: "French",
      tags: [],
      matrix: [],
      sort: "rank",
      minYear: null,
      maxYear: null,
    });

    expect(result.map((game) => game.id)).toEqual([20]);
  });

  test("combines translation language with the other filters using AND logic", async () => {
    const result = await filterGames(
      [
        makeGame({ id: 30, title: "Guild One", mechanics: ["Worker Placement"], languages: ["French"] }),
        makeGame({ id: 31, title: "Guild Two", mechanics: ["Worker Placement"], languages: ["German"] }),
      ],
      {
        search: "guild",
        language: "French",
        tags: ["Worker Placement"],
        matrix: [],
        sort: "rank",
        minYear: null,
        maxYear: null,
      },
    );

    expect(result.map((game) => game.id)).toEqual([30]);
  });

  test("combines category and mechanic labels without duplicate React keys", () => {
    const game = makeGame({
      categories: ["Deduction", "Card Game"],
      mechanics: ["Deduction", "Memory"],
    });

    expect(gameTags(game)).toEqual(["Deduction", "Card Game", "Memory"]);
  });

  test.each([
    { label: "no bounds", minYear: null, maxYear: null, expected: [20, 21, 22, 23, 24] },
    { label: "minimum only", minYear: 2000, maxYear: null, expected: [21, 22, 23, 24] },
    { label: "maximum only", minYear: null, maxYear: 2020, expected: [20, 21, 22, 24] },
    { label: "both inclusive bounds", minYear: 2000, maxYear: 2020, expected: [21, 22, 24] },
  ])("applies each year-bound combination while keeping unknown years", async ({ minYear, maxYear, expected }) => {
    const datedGames = [
      makeGame({ id: 20, rank: 20, year: 1999 }),
      makeGame({ id: 21, rank: 21, year: 2000 }),
      makeGame({ id: 22, rank: 22, year: 2020 }),
      makeGame({ id: 23, rank: 23, year: 2021 }),
      makeGame({ id: 24, rank: 24, year: null }),
    ];

    const result = await filterGames(datedGames, {
      search: "",
      language: "",
      tags: [],
      matrix: [],
      sort: "rank",
      minYear,
      maxYear,
    });

    expect(result.map((game) => game.id)).toEqual(expected);
  });

  test("combines year bounds with the existing filters using AND logic", async () => {
    const strategyGames = [
      makeGame({ id: 30, rank: 30, title: "Strategy Classic", year: 1990, mechanics: ["Worker Placement"] }),
      makeGame({ id: 31, rank: 31, title: "Strategy Modern", year: 2020, mechanics: ["Worker Placement"] }),
    ];

    const result = await filterGames(strategyGames, {
      search: "strategy",
      language: "",
      tags: ["Worker Placement"],
      matrix: [],
      sort: "rank",
      minYear: 2000,
      maxYear: null,
    });

    expect(result.map((game) => game.id)).toEqual([31]);
  });
});

const base: GameFilters = { search: "", language: "", tags: [], matrix: [], sort: "rank", minYear: null, maxYear: null };

describe("sorting", () => {
  const weighted = [makeGame({ id: 1, weight: 2 }), makeGame({ id: 2, weight: 4 }), makeGame({ id: 3, weight: null })];

  test("sorts by a new key in its default direction", async () => {
    expect((await filterGames(weighted, { ...base, sort: "weight" })).map((x) => x.id)).toEqual([2, 1, 3]);
  });

  test("reverses direction and still keeps missing values last", async () => {
    expect((await filterGames(weighted, { ...base, sort: "weight", sortDir: "asc" })).map((x) => x.id)).toEqual([1, 2, 3]);
  });

  test("rank descending keeps unranked games last", async () => {
    const ranked = [makeGame({ id: 1, rank: 1 }), makeGame({ id: 2, rank: 5 }), makeGame({ id: 3, rank: null })];
    expect((await filterGames(ranked, { ...base, sort: "rank", sortDir: "desc" })).map((x) => x.id)).toEqual([2, 1, 3]);
  });

  test("default directions", () => {
    expect(defaultSortDir("rank")).toBe("asc");
    expect(defaultSortDir("numVoters")).toBe("desc");
  });
});

describe("mechanics", () => {
  const games = [
    makeGame({ id: 1, year: 2020, categories: ["Economic"], mechanics: ["Worker Placement", "Set Collection"] }),
    makeGame({ id: 2, year: 2020, categories: ["Economic"], mechanics: ["Set Collection"] }),
    makeGame({ id: 3, year: 1990, categories: ["Economic"], mechanics: ["Worker Placement"] }),
  ];

  test("a game must have every selected mechanic", async () => {
    expect((await filterGames(games, { ...base, tags: ["Worker Placement"] })).map((g) => g.id)).toEqual([1, 3]);
    expect((await filterGames(games, { ...base, tags: ["Worker Placement", "Set Collection"] })).map((g) => g.id)).toEqual([1]);
  });

  test("categories are not matched", async () => {
    expect(await filterGames(games, { ...base, tags: ["Economic"] })).toEqual([]);
  });

  test("counts games per mechanic under every filter, the selection included; categories are left out", async () => {
    const counts = await tagCounts(games, { ...base, minYear: 2000, tags: ["Worker Placement"] });
    // Only game 1 has Worker Placement after 2000, so adding Set Collection keeps one game.
    expect(counts.get("Set Collection")).toBe(1);
    expect(counts.get("Worker Placement")).toBe(1);
    expect(counts.has("Economic")).toBe(false);
    expect(counts.has("Deck Building")).toBe(false);
  });
});
