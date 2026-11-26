import { Results } from "@/components/results/results";
import { cacheCatalogOutput } from "@/lib/catalog/cached";
import { loadGamesView } from "@/lib/catalog/load";
import { parseFilters, parsePage } from "@/lib/url-state";

type CatalogResultsProps = {
  /**
   * The view as a query string, in the canonical form `serializeView` writes. A string rather than
   * the filters object so the same view always makes the same cache key.
   */
  query: string;
};

/** One page of the catalog for the filters in the query: filtered and sorted in Postgres, rendered on the server. */
export async function CatalogResults({ query }: CatalogResultsProps) {
  const params = new URLSearchParams(query);
  const filters = parseFilters(params);
  const view = await loadGamesView(filters, parsePage(params));
  return <Results view={view} filters={filters} />;
}

/** The same, with the rendered output kept in the cache: a repeated view is not filtered and rendered again. */
export async function CachedCatalogResults({ query }: CatalogResultsProps) {
  "use cache";
  cacheCatalogOutput();
  return <CatalogResults query={query} />;
}
