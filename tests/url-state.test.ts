import { expect, test } from "vitest";
import type { GameFilters } from "@/lib/filtering";
import { defaultFilters, parseFilters, serializeFilters } from "@/lib/url-state";

test("empty query gives defaults and defaults serialise to nothing", () => {
  expect(parseFilters(new URLSearchParams(""))).toEqual(defaultFilters);
  expect(serializeFilters(defaultFilters)).toBe("");
});

test("round-trips every field, including tags with URL-significant characters", () => {
  const filters: GameFilters = {
    search: "brass",
    language: "Russian",
    tags: ["Action / Dexterity", "Card Game, Trick-taking & More"],
    matrix: [
      { playerCount: "2", verdict: "best" },
      { playerCount: "6+", verdict: "not-playable" },
    ],
    sort: "weight",
    sortDir: "asc",
    minYear: 2015,
    maxYear: null,
  };
  expect(parseFilters(new URLSearchParams(serializeFilters(filters)))).toEqual(filters);
});

test("omits a default direction", () => {
  expect(serializeFilters({ ...defaultFilters, sort: "geekRating", sortDir: "desc" })).toBe("sort=geekRating");
});

test("ignores garbage and de-duplicates", () => {
  const parsed = parseFilters(
    new URLSearchParams("m=9:best&m=2:great&m=2:best&m=2:best&ymin=abc&ymax=20x0&sort=price&dir=sideways&tag=A&tag=A"),
  );
  expect(parsed).toEqual({ ...defaultFilters, matrix: [{ playerCount: "2", verdict: "best" }], tags: ["A"] });
});
