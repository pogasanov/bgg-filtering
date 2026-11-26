import { expect, test } from "vitest";
import { activeFilterChips, activeFilterCount } from "@/lib/active-filters";
import type { GameFilters } from "@/lib/filtering";
import { defaultFilters } from "@/lib/url-state";

test("one removable chip per active filter, in order", () => {
  const filters: GameFilters = {
    ...defaultFilters,
    search: "ark",
    language: "German",
    tags: ["Gone Tag"],
    matrix: [
      { playerCount: "4", verdict: "recommended" },
      { playerCount: "2", verdict: "best" },
    ],
    minYear: 2020,
  };
  const chips = activeFilterChips(filters);
  expect(chips.map((chip) => chip.label)).toEqual([
    "2 игрока: лучше всего", "4 игрока: рекомендуют", "с 2020", "Gone Tag", "German", "«ark»",
  ]);
  expect(chips[0].next.matrix).toEqual([{ playerCount: "4", verdict: "recommended" }]);
  expect(chips[2].next).toMatchObject({ minYear: null, maxYear: null });
  expect(chips[3].next.tags).toEqual([]);
  expect(chips[5].next.search).toBe("");
  expect(new Set(chips.map((chip) => chip.id)).size).toBe(chips.length);
});

test("nothing active means no chips", () => {
  expect(activeFilterCount(defaultFilters)).toBe(0);
  expect(activeFilterCount({ ...defaultFilters, sort: "weight" })).toBe(0);
});
