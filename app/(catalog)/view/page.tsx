import { CachedCatalogResults, CatalogResults } from "@/components/results/catalog-results";
import { parseFilters, parsePage, serializeView } from "@/lib/url-state";

type PageProps = {
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
 * The filtered view. Visitors never see this path: next.config.ts rewrites "/" here whenever the
 * URL carries a filter or a sort, so the pages of the full list can stay static.
 */
export default async function ViewPage({ searchParams }: PageProps) {
  const params = toSearchParams(await searchParams);
  const filters = parseFilters(params);
  // Parsed and written back so equal views share one cache entry however the URL was spelled.
  const query = serializeView(filters, parsePage(params));

  // Free-text searches are endless and rarely repeat, so they are rendered without filling the cache.
  return filters.search.trim() ? <CatalogResults query={query} /> : <CachedCatalogResults query={query} />;
}
