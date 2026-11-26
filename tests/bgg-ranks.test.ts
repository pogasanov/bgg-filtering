import { describe, expect, test } from "vitest";
import { DEFAULT_RANKED_LIMIT, parseRanksCsv } from "@/lib/bgg/ranks";

const csv = `id,name,yearpublished,rank,bayesaverage,average,usersrated,is_expansion
3,"Third, Game",2022,3,7.1,7.3,300,0
2,"Second ""Edition""",2021,2,7.2,7.4,400,0
9,Expansion,2020,1,8.0,8.2,500,1
1,First,2023,1,7.3,7.5,500,0
8,Unranked,2019,,6.0,6.2,10,0
`;

describe("BGG ranks CSV", () => {
  test("returns ranked base games in rank order with CSV metadata", () => {
    expect(parseRanksCsv(csv, 2)).toEqual([
      {
        id: 1,
        rank: 1,
        title: "First",
        year: 2023,
        geekRating: 7.3,
        averageRating: 7.5,
        numVoters: 500,
      },
      {
        id: 2,
        rank: 2,
        title: 'Second "Edition"',
        year: 2021,
        geekRating: 7.2,
        averageRating: 7.4,
        numVoters: 400,
      },
    ]);
  });

  test("keeps the top 2500 ranked base games by default", () => {
    const rows = Array.from({ length: 2600 }, (_, index) => `${index + 1},Game ${index + 1},2020,${index + 1},7,7,100,0`);
    const items = parseRanksCsv([csv.split("\n")[0], ...rows].join("\n"));

    expect(DEFAULT_RANKED_LIMIT).toBe(2500);
    expect(items).toHaveLength(2500);
    expect(items.at(-1)?.rank).toBe(2500);
  });

  test("rejects CSV files without required ranking columns", () => {
    expect(() => parseRanksCsv("id,name\\n1,Game", 1)).toThrow(
      "BGG ranks CSV is missing required columns",
    );
  });
});
