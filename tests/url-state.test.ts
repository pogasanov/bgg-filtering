import { expect, test } from "vitest";
import type { GameFilters } from "@/lib/filtering";
import { defaultFilters, parseFilters, parsePage, serializeFilters, serializeView } from "@/lib/url-state";

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

test("reads the page number and treats anything else as the first page", () => {
  expect(parsePage(new URLSearchParams("page=3"))).toBe(3);
  for (const query of ["", "page=0", "page=-2", "page=1.5", "page=abc"]) {
    expect(parsePage(new URLSearchParams(query))).toBe(1);
  }
});

test("adds the page to the query only past the first page", () => {
  const filters = { ...defaultFilters, language: "Russian" };
  expect(serializeView(defaultFilters, 1)).toBe("");
  expect(serializeView(defaultFilters, 2)).toBe("page=2");
  expect(serializeView(filters, 1)).toBe("lang=Russian");
  expect(serializeView(filters, 4)).toBe("lang=Russian&page=4");
});
