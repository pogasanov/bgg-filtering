import type { MetadataRoute } from "next";
import { loadCatalogFrame, loadPageCount } from "@/lib/catalog/cached";
import type { GameFilters } from "@/lib/filtering";
import { canonicalPath, SITE_URL } from "@/lib/seo";
import { defaultFilters, serializeView } from "@/lib/url-state";

/**
 * The pages of the full lists: Russian editions at "/", English at "/en" and every edition at
 * "/any", each with all its pages. Filtered views are endless combinations and are left out.
 */
const LISTS: GameFilters[] = [defaultFilters, { ...defaultFilters, language: "English" }, { ...defaultFilters, language: "" }];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { status } = await loadCatalogFrame();
  const lastModified = status.updatedAt ? new Date(status.updatedAt) : undefined;
  const entries: MetadataRoute.Sitemap = [];
  for (const filters of LISTS) {
    const pages = await loadPageCount(serializeView(filters, 1));
    for (let page = 1; page <= pages; page++) {
      entries.push({ url: new URL(canonicalPath(filters, page), SITE_URL).toString(), lastModified });
    }
  }
  return entries;
}
