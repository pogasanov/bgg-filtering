import type { Metadata } from "next";
import { matrixVerdicts, playerCounts, type MatrixSelection, type PlayerCount } from "./bgg/types";
import type { GameFilters } from "./filtering";
import { mechanicLabel } from "./i18n/mechanics";
import { collectionPath } from "./collections";
import { matrixCellLabel } from "./labels";
import { languageCode, viewHref } from "./language-path";
import { RUSSIAN } from "./url-state";
import { yearRangeLabel } from "./year-presets";

/** The public address of the site; canonical URLs, the sitemap and robots.txt are built on it. */
export const SITE_URL = "https://bg.gsnv.dev";
export const SITE_NAME = "Настолки по числу игроков";
export const SITE_DESCRIPTION =
  "Лучшие настолки с BoardGameGeek под ваш состав: на двоих, на троих, на шестерых — по голосам игроков. Фильтры по механикам и цены в магазинах.";

const DEFAULT_HEADING = "Лучшие настолки по числу игроков";
const HOME_TITLE = `${DEFAULT_HEADING} — по голосам BoardGameGeek`;

const playersPhrases: Record<PlayerCount, string> = {
  "1": "для одного",
  "2": "на двоих",
  "3": "на троих",
  "4": "на четверых",
  "5": "на пятерых",
  "6": "на шестерых",
  "6+": "на семерых и больше",
};

const languageNames = new Intl.DisplayNames(["ru"], { type: "language" });

/** The editions a view lists, as a phrase; null for the Russian ones, which the site opens on. */
export function editionsPhrase(language: string): string | null {
  if (language === RUSSIAN) return null;
  if (language === "") return "все издания";
  const code = languageCode(language);
  const name = code ? languageNames.of(code) : undefined;
  // "английский" → "английские издания"; a language without a known code keeps its BGG name.
  if (name?.endsWith("ий")) return `${name.slice(0, -2)}ие издания`;
  return `издания на языке ${language}`;
}

function sortedMatrix(matrix: MatrixSelection[]): MatrixSelection[] {
  return [...matrix].sort(
    (a, b) =>
      playerCounts.indexOf(a.playerCount) - playerCounts.indexOf(b.playerCount) ||
      matrixVerdicts.indexOf(a.verdict) - matrixVerdicts.indexOf(b.verdict),
  );
}

/**
 * The opening words for a view that reads as a phrase: exactly one player-count choice, or exactly
 * one mechanic and nothing from the matrix.
 */
function viewBase(matrix: MatrixSelection[], tags: string[]): string | null {
  if (matrix.length === 0 && tags.length === 1) return `Лучшие настолки с механикой «${mechanicLabel(tags[0], "ru")}»`;
  if (matrix.length !== 1) return null;
  const [{ playerCount, verdict }] = matrix;
  if (verdict === "best") return `Лучшие настолки ${playersPhrases[playerCount]}`;
  if (verdict === "recommended") return `Настолки, которые рекомендуют ${playersPhrases[playerCount]}`;
  return null;
}

/**
 * What a view shows, in words: the page's heading and the base of its title. Sorting changes the
 * order, not the set of games, so it is left out.
 */
export function viewHeading(filters: GameFilters): string {
  const base = viewBase(filters.matrix, filters.tags);
  const mechanicInBase = filters.matrix.length === 0 && filters.tags.length === 1;
  const parts = [
    ...(base ? [] : sortedMatrix(filters.matrix).map((selection) => matrixCellLabel(selection))),
    ...(mechanicInBase ? [] : filters.tags.map((tag) => mechanicLabel(tag, "ru"))),
    ...(filters.minYear !== null || filters.maxYear !== null ? [yearRangeLabel(filters.minYear, filters.maxYear)] : []),
    ...[editionsPhrase(filters.language)].filter((phrase) => phrase !== null),
    ...(filters.search.trim() ? [`«${filters.search.trim()}»`] : []),
  ];
  if (base) return parts.length > 0 ? `${base}: ${parts.join(", ")}` : base;
  return parts.length > 0 ? `${DEFAULT_HEADING}: ${parts.join(", ")}` : DEFAULT_HEADING;
}

export function viewTitle(filters: GameFilters, page: number): string {
  const heading = viewHeading(filters);
  if (heading === DEFAULT_HEADING && page <= 1) return HOME_TITLE;
  return page > 1 ? `${heading} — страница ${page}` : heading;
}

export function viewDescription(filters: GameFilters): string {
  const heading = viewHeading(filters);
  if (heading === DEFAULT_HEADING) return SITE_DESCRIPTION;
  const prices = filters.language === RUSSIAN ? ", и цены в российских магазинах" : "";
  return `${heading}. Игры из топа BoardGameGeek с опросом игроков о том, на сколько человек игра лучше всего${prices}.`;
}

/**
 * The view's own address, which search engines are asked to index: its collection page when it is
 * one ("/na-dvoih"), otherwise the filters and page without the sort.
 */
export function canonicalPath(filters: GameFilters, page: number): string {
  return collectionPath(filters, page) ?? viewHref({ ...filters, sort: "rank", sortDir: undefined }, page);
}

/** Title, description, canonical address and share texts of a list page. */
export function viewMetadata(filters: GameFilters, page: number): Metadata {
  const title = viewTitle(filters, page);
  const description = viewDescription(filters);
  const url = canonicalPath(filters, page);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    // Searches are endless and say nothing a list page does not: kept out of the index, links followed.
    ...(filters.search.trim() ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: "website", siteName: SITE_NAME, locale: "ru_RU", title, description, url },
    twitter: { card: "summary_large_image", title, description },
  };
}
