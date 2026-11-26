import { matrixVerdicts, playerCounts } from "./bgg/types";
import type { GameFilters } from "./filtering";
import { languageLabel, matrixCellLabel } from "./labels";
import { yearRangeLabel } from "./year-presets";

export type FilterChip = {
  id: string;
  label: string;
  /** The filters with this one removed. */
  next: GameFilters;
};

/** One chip per active filter. Sorting is not a filter and never produces a chip. */
export function activeFilterChips(filters: GameFilters): FilterChip[] {
  const chips: FilterChip[] = [];

  const matrix = [...filters.matrix].sort(
    (a, b) =>
      playerCounts.indexOf(a.playerCount) - playerCounts.indexOf(b.playerCount) ||
      matrixVerdicts.indexOf(a.verdict) - matrixVerdicts.indexOf(b.verdict),
  );
  for (const selection of matrix) {
    chips.push({
      id: `m:${selection.playerCount}:${selection.verdict}`,
      label: matrixCellLabel(selection),
      next: {
        ...filters,
        matrix: filters.matrix.filter(
          (item) => !(item.playerCount === selection.playerCount && item.verdict === selection.verdict),
        ),
      },
    });
  }

  if (filters.minYear !== null || filters.maxYear !== null) {
    chips.push({
      id: "year",
      label: yearRangeLabel(filters.minYear, filters.maxYear),
      next: { ...filters, minYear: null, maxYear: null },
    });
  }

  for (const tag of filters.tags) {
    chips.push({ id: `tag:${tag}`, label: tag, next: { ...filters, tags: filters.tags.filter((item) => item !== tag) } });
  }

  // Russian is only the language the site opens on: like any other choice it is a filter, and clearing
  // it shows every language.
  if (filters.language !== "") {
    chips.push({ id: "lang", label: languageLabel(filters.language), next: { ...filters, language: "" } });
  }

  if (filters.search.trim() !== "") {
    chips.push({ id: "search", label: `«${filters.search.trim()}»`, next: { ...filters, search: "" } });
  }

  return chips;
}

export function activeFilterCount(filters: GameFilters): number {
  return activeFilterChips(filters).length;
}
