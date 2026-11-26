import { CachedCatalogResults } from "@/components/results/catalog-results";

// The first page with no filters must never be rendered per request: the build fails if anything
// on this route, its layout included, needs the request. Its content is rebuilt every 12 hours and
// after each sync (see cacheCatalogOutput). Requests with filters are rewritten to /view in next.config.ts, further pages to /page/N.
export const ensureStatic = "navigation";

export default function Page() {
  return <CachedCatalogResults query="" />;
}
