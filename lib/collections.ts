import { playerCounts, type PlayerCount } from "./bgg/types";
import type { GameFilters } from "./filtering";
import { mechanicNamesRu } from "./i18n/mechanics";
import { slugify } from "./translit";
import { defaultFilters, RUSSIAN } from "./url-state";

/**
 * Collections: catalog views with an address of their own, for the questions people ask a search
 * engine or an assistant ("настолки на двоих", "игры с размещением рабочих"). Each is the catalog with
 * one filter set, Russian editions, on a static page.
 */

/** "Best with N players", one per poll column. Served at "/<slug>" through a rewrite to /podborka/<slug>. */
export const playerCollections: { slug: string; playerCount: PlayerCount }[] = [
  { slug: "dlya-odnogo", playerCount: "1" },
  { slug: "na-dvoih", playerCount: "2" },
  { slug: "na-troih", playerCount: "3" },
  { slug: "na-chetveryh", playerCount: "4" },
  { slug: "na-pyateryh", playerCount: "5" },
  { slug: "na-shesteryh", playerCount: "6" },
  { slug: "na-bolshuyu-kompaniyu", playerCount: "6+" },
];

/** The internal route the player collections are rewritten to; visitors never see it. */
export const PLAYER_COLLECTION_ROUTE = "podborka";
/** The path prefix of mechanic collections ("/mehaniki/razmeshchenie-rabochih"). */
export const MECHANIC_COLLECTION_ROUTE = "mehaniki";
/**
 * Mechanic collections with fewer Russian-edition games are kept out of the index and the sitemap:
 * too thin to answer anything. Their pages still exist, for the links on game pages.
 */
export const MIN_MECHANIC_GAMES = 30;

export function playerCollectionFilters(playerCount: PlayerCount): GameFilters {
  return { ...defaultFilters, matrix: [{ playerCount, verdict: "best" }] };
}

export function playerCollectionPath(playerCount: PlayerCount): string {
  return `/${playerCollections.find((collection) => collection.playerCount === playerCount)!.slug}`;
}

export function playerCountFromSlug(slug: string): PlayerCount | null {
  return playerCollections.find((collection) => collection.slug === slug)?.playerCount ?? null;
}

export function mechanicCollectionFilters(mechanic: string): GameFilters {
  return { ...defaultFilters, tags: [mechanic] };
}

/** A mechanic's segment, from its Russian name when it has one, so the address reads in Russian. */
export function mechanicSlug(mechanic: string): string {
  return slugify(mechanicNamesRu[mechanic] ?? mechanic);
}

export function mechanicCollectionPath(mechanic: string): string {
  return `/${MECHANIC_COLLECTION_ROUTE}/${mechanicSlug(mechanic)}`;
}

/** The mechanic a segment stands for, among the catalog's mechanics; null when none. */
export function mechanicFromSlug(slug: string, mechanics: readonly string[]): string | null {
  return mechanics.find((mechanic) => mechanicSlug(mechanic) === slug) ?? null;
}

/**
 * The collection a view is, if it is exactly one: Russian editions, first page, no search or years,
 * and either one "best with N" choice or one mechanic. The sort does not matter.
 */
export function collectionPath(filters: GameFilters, page: number): string | null {
  if (page > 1 || filters.language !== RUSSIAN || filters.search.trim() || filters.minYear !== null || filters.maxYear !== null) {
    return null;
  }
  const { matrix, tags } = filters;
  if (matrix.length === 1 && tags.length === 0 && matrix[0].verdict === "best" && playerCounts.includes(matrix[0].playerCount)) {
    return playerCollectionPath(matrix[0].playerCount);
  }
  if (matrix.length === 0 && tags.length === 1) return mechanicCollectionPath(tags[0]);
  return null;
}
