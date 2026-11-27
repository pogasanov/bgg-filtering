import type { Metadata } from "next";
import { matrixVerdicts, playerCounts, type MatrixSelection, type PlayerCount } from "./bgg/types";
import type { GameFilters } from "./filtering";
import { locales, SITE_LOCALE, SITE_URLS, type Locale } from "./i18n/locale";
import { mechanicLabel } from "./i18n/mechanics";
import { collectionPath } from "./collections";
import { matrixCellLabel } from "./labels";
import { languageCode, viewHref } from "./language-path";
import { DEFAULT_LANGUAGE } from "./url-state";
import { yearRangeLabel } from "./year-presets";

export { SITE_URLS };

/** The public address of this site; canonical URLs, the sitemap and robots.txt are built on it. */
export const SITE_URL = SITE_URLS[SITE_LOCALE];

type SiteTexts = {
  name: string;
  /** Other names the site goes by: search engines show one as its name, assistants match mentions to it. */
  alternateNames: string[];
  description: string;
  defaultHeading: string;
  homeTitle: string;
  ogLocale: string;
};

const siteTexts: Record<Locale, SiteTexts> = {
  en: {
    name: "My Next Board Game",
    alternateNames: ["mynextboardgame.com", "Best board games by player count"],
    description:
      "The best board games for your group size, from BoardGameGeek's player-count poll: best for two, for three, for six and more. Filter by mechanics and edition language.",
    defaultHeading: "Best board games by player count",
    homeTitle: "Best board games by player count — from BoardGameGeek votes",
    ogLocale: "en_US",
  },
  ru: {
    name: "Настолки по числу игроков",
    alternateNames: ["My Next Board Game", "ru.mynextboardgame.com"],
    description:
      "Лучшие настолки с BoardGameGeek под ваш состав: на двоих, на троих, на шестерых — по голосам игроков. Фильтры по механикам и цены в магазинах.",
    defaultHeading: "Лучшие настолки по числу игроков",
    homeTitle: "Лучшие настолки по числу игроков — по голосам BoardGameGeek",
    ogLocale: "ru_RU",
  },
};

export const SITE_NAME = siteTexts[SITE_LOCALE].name;
export const SITE_ALTERNATE_NAMES = siteTexts[SITE_LOCALE].alternateNames;
export const SITE_DESCRIPTION = siteTexts[SITE_LOCALE].description;
export const OG_LOCALE = siteTexts[SITE_LOCALE].ogLocale;

/**
 * The share image (app/opengraph-image.tsx), in the site's language. Named in every page's metadata
 * because a page's own openGraph replaces the one Next builds from the image file.
 */
export const SHARE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  type: "image/png",
  alt:
    SITE_LOCALE === "ru"
      ? "Настолки по числу игроков — лучшее с BoardGameGeek под ваш состав"
      : "My Next Board Game — the best of BoardGameGeek for your group size",
};

const ruPlayersPhrases: Record<PlayerCount, string> = {
  "1": "для одного",
  "2": "на двоих",
  "3": "на троих",
  "4": "на четверых",
  "5": "на пятерых",
  "6": "на шестерых",
  "6+": "на семерых и больше",
};

/** "Best solo board games", "Лучшие настолки на двоих": the name of a "best with N" collection. */
export function playerCollectionTitle(playerCount: PlayerCount, locale: Locale = SITE_LOCALE): string {
  if (locale === "ru") return `Лучшие настолки ${ruPlayersPhrases[playerCount]}`;
  if (playerCount === "1") return "Best solo board games";
  if (playerCount === "6+") return "Best board games for 7+ players";
  return `Best ${playerCount}-player board games`;
}

function recommendedTitle(playerCount: PlayerCount, locale: Locale): string {
  if (locale === "ru") return `Настолки, которые рекомендуют ${ruPlayersPhrases[playerCount]}`;
  if (playerCount === "1") return "Board games recommended for solo play";
  return `Board games recommended for ${playerCount === "6+" ? "7+" : playerCount} players`;
}

/** The editions a view lists, as a phrase; null for every edition, which the site opens on. */
export function editionsPhrase(language: string, locale: Locale = SITE_LOCALE): string | null {
  if (language === DEFAULT_LANGUAGE) return null;
  const code = languageCode(language);
  if (locale === "en") {
    const name = code ? new Intl.DisplayNames(["en"], { type: "language" }).of(code) : undefined;
    return `${name ?? language} editions`;
  }
  const name = code ? new Intl.DisplayNames(["ru"], { type: "language" }).of(code) : undefined;
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
function viewBase(matrix: MatrixSelection[], tags: string[], locale: Locale): string | null {
  if (matrix.length === 0 && tags.length === 1) {
    const mechanic = mechanicLabel(tags[0], locale);
    return locale === "ru" ? `Лучшие настолки с механикой «${mechanic}»` : `Best ${mechanic} board games`;
  }
  if (matrix.length !== 1) return null;
  const [{ playerCount, verdict }] = matrix;
  if (verdict === "best") return playerCollectionTitle(playerCount, locale);
  if (verdict === "recommended") return recommendedTitle(playerCount, locale);
  return null;
}

/**
 * What a view shows, in words: the page's heading and the base of its title. Sorting changes the
 * order, not the set of games, so it is left out.
 */
export function viewHeading(filters: GameFilters, locale: Locale = SITE_LOCALE): string {
  const base = viewBase(filters.matrix, filters.tags, locale);
  const mechanicInBase = filters.matrix.length === 0 && filters.tags.length === 1;
  const search = filters.search.trim();
  const parts = [
    ...(base ? [] : sortedMatrix(filters.matrix).map((selection) => matrixCellLabel(selection, locale))),
    ...(mechanicInBase ? [] : filters.tags.map((tag) => mechanicLabel(tag, locale))),
    ...(filters.minYear !== null || filters.maxYear !== null ? [yearRangeLabel(filters.minYear, filters.maxYear, locale)] : []),
    ...[editionsPhrase(filters.language, locale)].filter((phrase) => phrase !== null),
    ...(search ? [locale === "ru" ? `«${search}»` : `“${search}”`] : []),
  ];
  const head = base ?? siteTexts[locale].defaultHeading;
  return parts.length > 0 ? `${head}: ${parts.join(", ")}` : head;
}

export function viewTitle(filters: GameFilters, page: number, locale: Locale = SITE_LOCALE): string {
  const heading = viewHeading(filters, locale);
  if (heading === siteTexts[locale].defaultHeading && page <= 1) return siteTexts[locale].homeTitle;
  if (page <= 1) return heading;
  return `${heading} — ${locale === "ru" ? "страница" : "page"} ${page}`;
}

export function viewDescription(filters: GameFilters, locale: Locale = SITE_LOCALE): string {
  const heading = viewHeading(filters, locale);
  if (heading === siteTexts[locale].defaultHeading) return siteTexts[locale].description;
  // Only the Russian site shows prices (SITE_SHOWS_PRICES), so only its descriptions promise them.
  if (locale === "en") return `${heading}. Top BoardGameGeek games with the players' poll on the best player count.`;
  return `${heading}. Игры из топа BoardGameGeek с опросом игроков о том, на сколько человек игра лучше всего, и цены в российских магазинах.`;
}

/**
 * The view's own address on a site, which search engines are asked to index: its collection page
 * when it is one ("/best-2-player-board-games"), otherwise the filters and page without the sort.
 */
export function canonicalPath(filters: GameFilters, page: number, locale: Locale = SITE_LOCALE): string {
  return collectionPath(filters, page, locale) ?? viewHref({ ...filters, sort: "rank", sortDir: undefined }, page);
}

/**
 * The same page on each language's site, for hreflang: the English site is the default for
 * everyone else. `pathFor` gives the page's path on a site.
 */
export function languageAlternates(pathFor: (locale: Locale) => string): Record<string, string> {
  const urls = Object.fromEntries(locales.map((locale) => [locale, new URL(pathFor(locale), SITE_URLS[locale]).toString()]));
  return { ...urls, "x-default": urls.en };
}

/** Title, description, canonical address, the other language's address and share texts of a list page. */
export function viewMetadata(filters: GameFilters, page: number): Metadata {
  const title = viewTitle(filters, page);
  const description = viewDescription(filters);
  const url = canonicalPath(filters, page);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url, languages: languageAlternates((locale) => canonicalPath(filters, page, locale)) },
    // Searches are endless and say nothing a list page does not: kept out of the index, links followed.
    ...(filters.search.trim() ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: "website", siteName: SITE_NAME, locale: OG_LOCALE, title, description, url, images: [SHARE_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [SHARE_IMAGE] },
  };
}

/** The home page's WebSite record: the site's name for search results and the address it lives at. */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: SITE_ALTERNATE_NAMES,
    url: `${SITE_URL}/`,
    description: SITE_DESCRIPTION,
    inLanguage: SITE_LOCALE,
  };
}
