import posthog from "posthog-js";
import type { GameFilters } from "./filtering";
import { defaultSortDir } from "./filtering";

/**
 * The product events sent to PostHog. Each name is fixed: insights and funnels are built on them.
 *
 * - filters_changed: the visitor changed the filters. Carries the whole resulting combination, so the
 *   last one in a session is where the visitor stopped, and `changed` names the filter groups touched.
 * - price_history_opened: a game's price panel was opened.
 * - outbound_link_clicked: a link to a shop's product page or to BoardGameGeek was followed.
 */
export type AnalyticsEvent = "filters_changed" | "price_history_opened" | "outbound_link_clicked";

/** The filter groups, as reported in `changed` and `filters_active`. Sorting counts as one, though it is not a filter. */
export type FilterGroup = "search" | "language" | "tags" | "matrix" | "years" | "sort";

function matrixValues(filters: GameFilters): string[] {
  return filters.matrix.map((selection) => `${selection.playerCount}:${selection.verdict}`).sort();
}

function sortValue(filters: GameFilters): string {
  return `${filters.sort}:${filters.sortDir ?? defaultSortDir(filters.sort)}`;
}

/** Each group's value in a comparable form. */
function groupValues(filters: GameFilters): Record<FilterGroup, string> {
  return {
    search: filters.search.trim(),
    language: filters.language,
    tags: [...filters.tags].sort().join("|"),
    matrix: matrixValues(filters).join(","),
    years: `${filters.minYear ?? ""}-${filters.maxYear ?? ""}`,
    sort: sortValue(filters),
  };
}

/** The groups whose values differ between two sets of filters. */
export function changedFilterGroups(previous: GameFilters, next: GameFilters): FilterGroup[] {
  const before = groupValues(previous);
  const after = groupValues(next);
  return (Object.keys(after) as FilterGroup[]).filter((group) => before[group] !== after[group]);
}

/**
 * The filters as flat event properties, easy to break down by in PostHog. `filters_combo` is one
 * readable string for the whole combination ("lang=Russian; m=2:best,3:best; tags=Cooperative"),
 * the default language included, so identical combinations always match.
 */
export function filterProperties(filters: GameFilters) {
  const search = filters.search.trim();
  const matrix = matrixValues(filters);
  const tags = [...filters.tags].sort();
  const active: FilterGroup[] = [];
  if (search !== "") active.push("search");
  if (filters.language !== "") active.push("language");
  if (tags.length > 0) active.push("tags");
  if (matrix.length > 0) active.push("matrix");
  if (filters.minYear !== null || filters.maxYear !== null) active.push("years");

  const parts: string[] = [`lang=${filters.language === "" ? "any" : filters.language}`];
  if (matrix.length > 0) parts.push(`m=${matrix.join(",")}`);
  if (tags.length > 0) parts.push(`tags=${tags.join("|")}`);
  if (filters.minYear !== null || filters.maxYear !== null) parts.push(`years=${filters.minYear ?? ""}-${filters.maxYear ?? ""}`);
  if (search !== "") parts.push(`q=${search}`);

  return {
    filter_search: search === "" ? null : search,
    filter_language: filters.language === "" ? "any" : filters.language,
    filter_tags: tags,
    filter_tag_count: tags.length,
    filter_matrix: matrix,
    filter_matrix_count: matrix.length,
    filter_min_year: filters.minYear,
    filter_max_year: filters.maxYear,
    filter_sort: sortValue(filters),
    filters_active: active,
    filters_active_count: active.length,
    filters_combo: parts.join("; "),
  };
}

/** Sends an event; does nothing when PostHog is off (no key, or not in a browser). */
export function track(event: AnalyticsEvent, properties: Record<string, unknown>): void {
  if (typeof window === "undefined" || !posthog.__loaded) return;
  posthog.capture(event, properties);
}

/**
 * Keeps the current filter combination on every later event of this browser session, so a price
 * panel opened or a shop visited can be broken down by the filters that led to it.
 */
export function rememberFilters(filters: GameFilters): void {
  if (typeof window === "undefined" || !posthog.__loaded) return;
  posthog.register_for_session(filterProperties(filters));
}

/** The host of a link, for grouping shop clicks; null for a malformed URL. */
export function linkHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
