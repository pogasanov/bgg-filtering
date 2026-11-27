import type { MetadataRoute } from "next";
import { loadCachedGameNames, loadCatalogFrame, loadPageCount } from "@/lib/catalog/cached";
import { mechanicCollectionPath, MIN_MECHANIC_GAMES, playerCollectionPath, playerCollections } from "@/lib/collections";
import type { GameFilters } from "@/lib/filtering";
import { gameName, gamePath } from "@/lib/game-page";
import { canonicalPath, SITE_URL } from "@/lib/seo";
import { defaultFilters, serializeView } from "@/lib/url-state";

/**
 * The pages of the full lists (Russian editions at "/", English at "/en", every edition at "/any",
 * each with all its pages), the collections, and every game's page. Other filtered views are
 * endless combinations and are left out.
 */
const LISTS: GameFilters[] = [defaultFilters, { ...defaultFilters, language: "English" }, { ...defaultFilters, language: "" }];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { status, tagCounts } = await loadCatalogFrame();
  const lastModified = status.updatedAt ? new Date(status.updatedAt) : undefined;
  const entries: MetadataRoute.Sitemap = [];
  for (const filters of LISTS) {
    const pages = await loadPageCount(serializeView(filters, 1));
    for (let page = 1; page <= pages; page++) {
      entries.push({ url: new URL(canonicalPath(filters, page), SITE_URL).toString(), lastModified });
    }
  }
  const url = (path: string) => new URL(path, SITE_URL).toString();
  for (const { playerCount } of playerCollections) entries.push({ url: url(playerCollectionPath(playerCount)), lastModified });
  for (const [mechanic, count] of [...tagCounts].sort(([a], [b]) => a.localeCompare(b))) {
    if (count >= MIN_MECHANIC_GAMES) entries.push({ url: url(mechanicCollectionPath(mechanic)), lastModified });
  }
  for (const game of await loadCachedGameNames()) entries.push({ url: url(gamePath(game.id, gameName(game))), lastModified });
  return entries;
}
