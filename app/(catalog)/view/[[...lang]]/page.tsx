import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CachedCatalogResults, CatalogResults } from "@/components/results/catalog-results";
import { loadCatalogFrame, loadPageCount } from "@/lib/catalog/cached";
import { loadShownCount } from "@/lib/catalog/load";
import type { GameFilters } from "@/lib/filtering";
import { languageFromSlug } from "@/lib/language-path";
import { pageCount } from "@/lib/pagination";
import { viewMetadata } from "@/lib/seo";
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

/** The filters and page the request asks for; null when the language prefix is not a real one. */
async function resolve({ params, searchParams }: PageProps): Promise<{ filters: GameFilters; page: number } | null> {
  const { lang = [] } = await params;
  if (lang.length > 1) return null;
  const query = toSearchParams(await searchParams);
  const filters = parseFilters(query);
  if (lang.length === 1) {
    const { facets } = await loadCatalogFrame();
    const language = languageFromSlug(lang[0], facets.allLanguages);
    if (language === null || language === RUSSIAN) return null;
    filters.language = language;
  }
  return { filters, page: parsePage(query) };
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const view = await resolve(props);
  return view === null ? {} : viewMetadata(view.filters, view.page);
}

/**
 * The filtered view. Visitors never see this path: next.config.ts rewrites "/" here, and "/<language>"
 * to "/view/<language>", whenever the URL carries a filter or a sort, so the pages of the full lists
 * can stay static.
 */
export default async function ViewPage(props: PageProps) {
  const view = await resolve(props);
  if (view === null) notFound();
  const { filters, page } = view;
  // Parsed and written back so equal views share one cache entry however the URL was spelled.
  const key = serializeView(filters, page);
  // Free-text searches are endless and rarely repeat, so they are rendered without filling the cache.
  const search = filters.search.trim() !== "";

  // A page past the end is not found, rather than a copy of the last page under another address.
  if (page > 1) {
    const pages = search ? pageCount(await loadShownCount(filters)) : await loadPageCount(serializeView(filters, 1));
    if (page > pages) notFound();
  }

  return search ? <CatalogResults query={key} /> : <CachedCatalogResults query={key} />;
}
