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
    language: "German",
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
    new URLSearchParams("m=9:best&m=2:great&m=2:best&m=2:best&ymin=abc&ymax=20x0&sort=cost&dir=sideways&tag=A&tag=A"),
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
  const filters = { ...defaultFilters, language: "German" };
  expect(serializeView(defaultFilters, 1)).toBe("");
  expect(serializeView(defaultFilters, 2)).toBe("page=2");
  expect(serializeView(filters, 1)).toBe("lang=German");
  expect(serializeView(filters, 4)).toBe("lang=German&page=4");
});

test("Russian is the default language and any language has its own value", () => {
  expect(defaultFilters.language).toBe("Russian");
  expect(parseFilters(new URLSearchParams("")).language).toBe("Russian");
  expect(parseFilters(new URLSearchParams("lang=")).language).toBe("Russian");
  expect(serializeFilters({ ...defaultFilters, language: "Russian" })).toBe("");
  expect(serializeFilters({ ...defaultFilters, language: "" })).toBe("lang=any");
  expect(parseFilters(new URLSearchParams("lang=any")).language).toBe("");
  expect(parseFilters(new URLSearchParams("lang=German")).language).toBe("German");
});
