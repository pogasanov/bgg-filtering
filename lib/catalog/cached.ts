import { cacheLife, cacheTag } from "next/cache";
import { catalogFrame, type CatalogFrame } from "@/lib/games-view";
import { CATALOG_TAG, loadCatalog } from "./load";

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

/** The filter options, the game count and the update date: the part of the page no filter changes. */
export async function loadCatalogFrame(): Promise<CatalogFrame> {
  "use cache";
  cacheCatalogOutput();
  return catalogFrame(await loadCatalog());
}
