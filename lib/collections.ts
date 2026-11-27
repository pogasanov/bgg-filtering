import { playerCounts, type PlayerCount } from "./bgg/types";
import type { GameFilters } from "./filtering";
import { SITE_LOCALE, type Locale } from "./i18n/locale";
import { mechanicNamesRu } from "./i18n/mechanics";
import { slugify } from "./translit";
import { DEFAULT_LANGUAGE, defaultFilters } from "./url-state";

/**
 * Collections: catalog views with an address of their own, for the questions people ask a search
 * engine or an assistant ("best 2 player board games", "настолки на двоих"). Each is the catalog with
 * one filter set, every edition, on a static page. Each site has its addresses in its own language.
 */

const playerSlugs: Record<Locale, Record<PlayerCount, string>> = {
  en: {
    "1": "best-solo-board-games",
    "2": "best-2-player-board-games",
    "3": "best-3-player-board-games",
    "4": "best-4-player-board-games",
    "5": "best-5-player-board-games",
    "6": "best-6-player-board-games",
    "6+": "best-board-games-for-7-plus-players",
  },
  ru: {
    "1": "dlya-odnogo",
    "2": "na-dvoih",
    "3": "na-troih",
    "4": "na-chetveryh",
    "5": "na-pyateryh",
    "6": "na-shesteryh",
    "6+": "na-bolshuyu-kompaniyu",
  },
};

/** "Best with N players", one per poll column, in a site's language. Served at "/<slug>" through a rewrite to /podborka/<slug>. */
export function playerCollectionsOf(locale: Locale): { slug: string; playerCount: PlayerCount }[] {
  return playerCounts.map((playerCount) => ({ slug: playerSlugs[locale][playerCount], playerCount }));
}

/** This site's player collections. */
export const playerCollections = playerCollectionsOf(SITE_LOCALE);

/** The internal route the player collections are rewritten to; visitors never see it. */
export const PLAYER_COLLECTION_ROUTE = "podborka";
/** The internal route of mechanic collections; the Russian site shows it as is, the English one as "/mechanics". */
export const MECHANIC_COLLECTION_ROUTE = "mehaniki";
const mechanicPrefixes: Record<Locale, string> = { en: "mechanics", ru: MECHANIC_COLLECTION_ROUTE };

/** The public path prefix of mechanic collections ("/mechanics/worker-placement", "/mehaniki/razmeshchenie-rabochih"). */
export function mechanicCollectionPrefix(locale: Locale = SITE_LOCALE): string {
  return mechanicPrefixes[locale];
}

/**
 * Mechanic collections with fewer games are kept out of the index and the sitemap: too thin to
 * answer anything. Their pages still exist, for the links on game pages.
 */
export const MIN_MECHANIC_GAMES = 30;

export function playerCollectionFilters(playerCount: PlayerCount): GameFilters {
  return { ...defaultFilters, matrix: [{ playerCount, verdict: "best" }] };
}

export function playerCollectionPath(playerCount: PlayerCount, locale: Locale = SITE_LOCALE): string {
  return `/${playerSlugs[locale][playerCount]}`;
}

export function playerCountFromSlug(slug: string, locale: Locale = SITE_LOCALE): PlayerCount | null {
  return playerCounts.find((playerCount) => playerSlugs[locale][playerCount] === slug) ?? null;
}

export function mechanicCollectionFilters(mechanic: string): GameFilters {
  return { ...defaultFilters, tags: [mechanic] };
}

/** A mechanic's segment, from its name in the site's language, so the address reads in it. */
export function mechanicSlug(mechanic: string, locale: Locale = SITE_LOCALE): string {
  return slugify(locale === "ru" ? (mechanicNamesRu[mechanic] ?? mechanic) : mechanic);
}

export function mechanicCollectionPath(mechanic: string, locale: Locale = SITE_LOCALE): string {
  return `/${mechanicCollectionPrefix(locale)}/${mechanicSlug(mechanic, locale)}`;
}

/** The mechanic a segment stands for, among the catalog's mechanics; null when none. */
export function mechanicFromSlug(slug: string, mechanics: readonly string[], locale: Locale = SITE_LOCALE): string | null {
  return mechanics.find((mechanic) => mechanicSlug(mechanic, locale) === slug) ?? null;
}

/**
 * The collection a view is, if it is exactly one: every edition, first page, no search or years,
 * and either one "best with N" choice or one mechanic. The sort does not matter.
 */
export function collectionPath(filters: GameFilters, page: number, locale: Locale = SITE_LOCALE): string | null {
  if (page > 1 || filters.language !== DEFAULT_LANGUAGE || filters.search.trim() || filters.minYear !== null || filters.maxYear !== null) {
    return null;
  }
  const { matrix, tags } = filters;
  if (matrix.length === 1 && tags.length === 0 && matrix[0].verdict === "best" && playerCounts.includes(matrix[0].playerCount)) {
    return playerCollectionPath(matrix[0].playerCount, locale);
  }
  if (matrix.length === 0 && tags.length === 1) return mechanicCollectionPath(tags[0], locale);
  return null;
}
