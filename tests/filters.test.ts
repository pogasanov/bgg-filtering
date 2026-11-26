import { describe, expect, test } from "vitest";
import { defaultSortDir, filterGames, gameTags, tagCounts, type GameFilters } from "@/lib/filtering";
import type { ListedGame } from "@/lib/bgg/types";

function makeGame(overrides: Partial<ListedGame>): ListedGame {
  return {
    id: 1,
    rank: 1,
    title: "Base Game",
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
    offers: [],
    bestPrice: null,
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
        "2": { best: 1, recommended: 18, notRecommended: 2, verdict: "recommended" },
        "3": { best: 1, recommended: 18, notRecommended: 2, verdict: "recommended" },
        "6+": { best: 0, recommended: 0, notRecommended: 22, verdict: "not-recommended" },
      },
    }),
  ];

  test("empty matrix selection does not filter by player recommendations", () => {
    expect(
      filterGames(games, {
        search: "",
        language: "",
        tags: [],
        matrix: [],
        sort: "rank",
        minYear: null,
        maxYear: null,
      }).map((game) => game.id),
    ).toEqual([1, 2]);
  });

  test("selected verdicts within one player-count row match with OR logic", () => {
    const result = filterGames(games, {
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

  test("search and tag filters combine with matrix filters using AND logic", () => {
    const result = filterGames(games, {
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

  test("not playable matches player counts outside known game limits", () => {
    const boundedGames = [
      makeGame({ id: 10, minPlayers: 2, maxPlayers: 4 }),
      makeGame({ id: 11, minPlayers: 1, maxPlayers: 8 }),
      makeGame({ id: 12, minPlayers: null, maxPlayers: null }),
    ];

    const filterAt = (playerCount: "1" | "5" | "6+") =>
      filterGames(boundedGames, {
        search: "",
        language: "",
        tags: [],
        matrix: [{ playerCount, verdict: "not-playable" }],
        sort: "rank",
        minYear: null,
        maxYear: null,
      }).map((game) => game.id);

    expect(filterAt("1")).toEqual([10]);
    expect(filterAt("5")).toEqual([10]);
    expect(filterAt("6+")).toEqual([10]);
  });

  test("requires every selected player-count row to match", () => {
    const boundedGames = [
      makeGame({ id: 20, minPlayers: 2, maxPlayers: 4 }),
      makeGame({ id: 21, minPlayers: 2, maxPlayers: 3 }),
    ];

    const result = filterGames(boundedGames, {
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

  test("filters by one translation language", () => {
    const translatedGames = [
      makeGame({ id: 20, languages: ["English", "French"] }),
      makeGame({ id: 21, languages: ["English", "German"] }),
      makeGame({ id: 22, languages: [] }),
    ];

    const result = filterGames(translatedGames, {
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

  test("combines translation language with the other filters using AND logic", () => {
    const result = filterGames(
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
  ])("applies each year-bound combination while keeping unknown years", ({ minYear, maxYear, expected }) => {
    const datedGames = [
      makeGame({ id: 20, rank: 20, year: 1999 }),
      makeGame({ id: 21, rank: 21, year: 2000 }),
      makeGame({ id: 22, rank: 22, year: 2020 }),
      makeGame({ id: 23, rank: 23, year: 2021 }),
      makeGame({ id: 24, rank: 24, year: null }),
    ];

    const result = filterGames(datedGames, {
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

  test("combines year bounds with the existing filters using AND logic", () => {
    const strategyGames = [
      makeGame({ id: 30, rank: 30, title: "Strategy Classic", year: 1990, categories: ["Strategy"] }),
      makeGame({ id: 31, rank: 31, title: "Strategy Modern", year: 2020, categories: ["Strategy"] }),
    ];

    const result = filterGames(strategyGames, {
      search: "strategy",
      language: "",
      tags: ["Strategy"],
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

  test("sorts by a new key in its default direction", () => {
    expect(filterGames(weighted, { ...base, sort: "weight" }).map((x) => x.id)).toEqual([2, 1, 3]);
  });

  test("reverses direction and still keeps missing values last", () => {
    expect(filterGames(weighted, { ...base, sort: "weight", sortDir: "asc" }).map((x) => x.id)).toEqual([1, 2, 3]);
  });

  test("rank descending keeps unranked games last", () => {
    const ranked = [makeGame({ id: 1, rank: 1 }), makeGame({ id: 2, rank: 5 }), makeGame({ id: 3, rank: null })];
    expect(filterGames(ranked, { ...base, sort: "rank", sortDir: "desc" }).map((x) => x.id)).toEqual([2, 1, 3]);
  });

  test("default directions", () => {
    expect(defaultSortDir("rank")).toBe("asc");
    expect(defaultSortDir("numVoters")).toBe("desc");
  });
});

describe("tag counts", () => {
  test("counts games per tag under the other filters, ignoring the tag selection", () => {
    const games = [
      makeGame({ id: 1, year: 2020, categories: ["Economic"], mechanics: ["Worker Placement"] }),
      makeGame({ id: 2, year: 2020, categories: ["Economic"], mechanics: [] }),
      makeGame({ id: 3, year: 1990, categories: ["Economic"], mechanics: ["Worker Placement"] }),
    ];
    const counts = tagCounts(games, { ...base, minYear: 2000, tags: ["Worker Placement"] });
    expect(counts.get("Economic")).toBe(2);
    expect(counts.get("Worker Placement")).toBe(1);
    expect(counts.has("Deck Building")).toBe(false);
  });
});

describe("price sorting", () => {
  test("cheapest first by default, with priceless games last either way", () => {
    const games = [makeGame({ id: 1, bestPrice: 3000 }), makeGame({ id: 2, bestPrice: null }), makeGame({ id: 3, bestPrice: 900 })];
    expect(defaultSortDir("price")).toBe("asc");
    expect(filterGames(games, { ...base, sort: "price" }).map((item) => item.id)).toEqual([3, 1, 2]);
    expect(filterGames(games, { ...base, sort: "price", sortDir: "desc" }).map((item) => item.id)).toEqual([1, 3, 2]);
  });
});
