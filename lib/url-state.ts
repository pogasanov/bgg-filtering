import {
  matrixVerdicts,
  playerCounts,
  sortKeys,
  type MatrixSelection,
  type MatrixVerdict,
  type PlayerCount,
  type SortKey,
} from "./bgg/types";
import { defaultSortDir, type GameFilters } from "./filtering";

/** The Russian editions: the ones with Russian titles and shop prices. */
export const RUSSIAN = "Russian";
/** The edition language the site opens on: none chosen, every edition. */
export const DEFAULT_LANGUAGE = "";
/** The `lang` value older links wrote for "any language"; it means the default now. */
export const ANY_LANGUAGE_PARAM = "any";

export const defaultFilters: GameFilters = {
  search: "",
  language: DEFAULT_LANGUAGE,
  tags: [],
  matrix: [],
  sort: "rank",
  sortDir: "asc",
  minYear: null,
  maxYear: null,
};

function parseYear(value: string | null): number | null {
  if (value === null || !/^-?\d+$/.test(value)) return null;
  return Number(value);
}

/**
 * A list travels in a single query parameter, its items joined by a separator. A key repeated in the
 * query does not survive the "/" → "/view" rewrite in production: only its last value reaches the page.
 */
const MATRIX_SEPARATOR = ",";
/** Tag names contain commas ("I Cut, You Choose") but no pipes. */
const TAG_SEPARATOR = "|";

/** Every item of a list parameter. Repeated keys, as older links wrote them, are read as well. */
function listParam(params: URLSearchParams, key: string, separator: string): string[] {
  return params.getAll(key).flatMap((value) => value.split(separator));
}

function parseMatrix(values: string[]): MatrixSelection[] {
  const seen = new Set<string>();
  const selections: MatrixSelection[] = [];
  for (const value of values) {
    const separator = value.lastIndexOf(":");
    const playerCount = value.slice(0, separator) as PlayerCount;
    const verdict = value.slice(separator + 1) as MatrixVerdict;
    if (separator < 0 || !playerCounts.includes(playerCount) || !matrixVerdicts.includes(verdict)) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    selections.push({ playerCount, verdict });
  }
  return selections;
}

function parseLanguage(value: string | null): string {
  if (value === null || value === "" || value === ANY_LANGUAGE_PARAM) return DEFAULT_LANGUAGE;
  return value;
}

/** Reads filters from a query string. Anything unrecognised is ignored rather than rejected. */
export function parseFilters(params: URLSearchParams): GameFilters {
  const sortParam = params.get("sort") as SortKey | null;
  const sort = sortParam !== null && sortKeys.includes(sortParam) ? sortParam : "rank";
  const dirParam = params.get("dir");

  return {
    search: params.get("q") ?? "",
    language: parseLanguage(params.get("lang")),
    tags: [...new Set(listParam(params, "tag", TAG_SEPARATOR).filter((tag) => tag !== ""))],
    matrix: parseMatrix(listParam(params, "m", MATRIX_SEPARATOR)),
    sort,
    sortDir: dirParam === "asc" || dirParam === "desc" ? dirParam : defaultSortDir(sort),
    minYear: parseYear(params.get("ymin")),
    maxYear: parseYear(params.get("ymax")),
  };
}

/** Query string without the leading "?"; empty when every filter is at its default. */
export function serializeFilters(filters: GameFilters): string {
  const params = new URLSearchParams();
  if (filters.search.trim() !== "") params.set("q", filters.search);
  if (filters.language !== DEFAULT_LANGUAGE) params.set("lang", filters.language);
  if (filters.tags.length > 0) params.set("tag", filters.tags.join(TAG_SEPARATOR));
  if (filters.matrix.length > 0) {
    params.set("m", filters.matrix.map((selection) => `${selection.playerCount}:${selection.verdict}`).join(MATRIX_SEPARATOR));
  }
  if (filters.minYear !== null) params.set("ymin", String(filters.minYear));
  if (filters.maxYear !== null) params.set("ymax", String(filters.maxYear));
  if (filters.sort !== "rank") params.set("sort", filters.sort);
  const sortDir = filters.sortDir ?? defaultSortDir(filters.sort);
  if (sortDir !== defaultSortDir(filters.sort)) params.set("dir", sortDir);
  return params.toString();
}

/**
 * Every query parameter that filters or sorts the list. A request carrying any of them is answered
 * by the filtered view; a request with none gets a static page of the full list.
 */
export const filterParamKeys = ["q", "lang", "tag", "m", "ymin", "ymax", "sort", "dir"] as const;

/** The page number from a query string; anything that is not a positive whole number means the first page. */
export function parsePage(params: URLSearchParams): number {
  const value = params.get("page") ?? "";
  return /^[1-9]\d*$/.test(value) ? Number(value) : 1;
}

/** Query string for the filters and a page; the first page is left out, like every other default. */
export function serializeView(filters: GameFilters, page: number): string {
  const query = serializeFilters(filters);
  if (page <= 1) return query;
  return query ? `${query}&page=${page}` : `page=${page}`;
}
