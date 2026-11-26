import { notFound } from "next/navigation";
import { CachedCatalogResults, CatalogResults } from "@/components/results/catalog-results";
import { loadCatalogFrame } from "@/lib/catalog/cached";
import { languageFromSlug } from "@/lib/language-path";
import { parseFilters, parsePage, RUSSIAN, serializeView } from "@/lib/url-state";

type PageProps = {
  params: Promise<{ lang?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toSearchParams(record: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) params.append(key, item);
    }
  }
  return params;
}

/**
 * The filtered view. Visitors never see this path: next.config.ts rewrites "/" here, and "/<language>"
 * to "/view/<language>", whenever the URL carries a filter or a sort, so the pages of the full lists
 * can stay static.
 */
export default async function ViewPage({ params, searchParams }: PageProps) {
  const { lang = [] } = await params;
  if (lang.length > 1) notFound();
  const query = toSearchParams(await searchParams);
  const filters = parseFilters(query);
  if (lang.length === 1) {
    const { facets } = await loadCatalogFrame();
    const language = languageFromSlug(lang[0], facets.allLanguages);
    if (language === null || language === RUSSIAN) notFound();
    filters.language = language;
  }
  // Parsed and written back so equal views share one cache entry however the URL was spelled.
  const key = serializeView(filters, parsePage(query));

  // Free-text searches are endless and rarely repeat, so they are rendered without filling the cache.
  return filters.search.trim() ? <CatalogResults query={key} /> : <CachedCatalogResults query={key} />;
}
