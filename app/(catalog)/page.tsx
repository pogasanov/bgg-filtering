import { CachedCatalogResults } from "@/components/results/catalog-results";
import { viewMetadata } from "@/lib/seo";
import { defaultFilters } from "@/lib/url-state";

// The first page with no filters must never be rendered per request: the build fails if anything
// on this route, its layout included, needs the request. Its content is rebuilt every 12 hours and
// after each sync (see cacheCatalogOutput). Requests with filters are rewritten to /view in next.config.ts, further pages to /page/N.
export const ensureStatic = "navigation";

export const metadata = viewMetadata(defaultFilters, 1);

export default function Page() {
  return <CachedCatalogResults query="" />;
}
