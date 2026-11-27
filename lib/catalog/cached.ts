import { cacheLife, cacheTag } from "next/cache";
import type { CatalogFrame } from "@/lib/games-view";
import { pageCount } from "@/lib/pagination";
import { parseFilters } from "@/lib/url-state";
import { CATALOG_TAG, loadFrame, loadShownCount } from "./load";

const HOUR = 60 * 60;

/**
 * The lifetime of everything rendered from the catalog: rebuilt every 12 hours, and at once when
 * the weekly sync invalidates CATALOG_TAG. Call inside a `use cache` scope.
 */
export function cacheCatalogOutput() {
  // After 12 hours the next request still gets the cached output while a fresh one is built behind it.
  // An entry nobody asked for in a week is dropped and built on demand.
  cacheLife({ revalidate: 12 * HOUR, expire: 7 * 24 * HOUR });
  cacheTag(CATALOG_TAG);
}

/**
 * The filter options, the game count and the update date: the part of the page no filter changes.
 * Aggregated in Postgres and kept for the same 12 hours as the pages.
 */
export async function loadCatalogFrame(): Promise<CatalogFrame> {
  "use cache";
  cacheCatalogOutput();
  return loadFrame();
}

/**
 * How many pages the view in the query has (the query in `serializeView` form, its page ignored).
 * Cached like the pages, so checking a page number costs no query on a repeated view.
 */
export async function loadPageCount(query: string): Promise<number> {
  "use cache";
  cacheCatalogOutput();
  return pageCount(await loadShownCount(parseFilters(new URLSearchParams(query))));
}

