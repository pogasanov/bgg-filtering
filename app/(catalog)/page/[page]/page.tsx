import { notFound } from "next/navigation";
import { CachedCatalogResults } from "@/components/results/catalog-results";
import { loadGameCount } from "@/lib/catalog/load";
import { pageCount } from "@/lib/pagination";
import { defaultFilters, serializeView } from "@/lib/url-state";

// Like the first page, the further pages of the unfiltered list are never rendered per request.
// Visitors see "/?page=N": next.config.ts rewrites it here while no filter or sort is set.
export const ensureStatic = "navigation";

/** Every page the catalog has now. A page that appears later is built on its first request and kept. */
export async function generateStaticParams() {
  // At least one entry is required; with an empty catalog, page 2 simply shows the first page.
  const last = Math.max(2, pageCount(await loadGameCount()));
  return Array.from({ length: last - 1 }, (_, index) => ({ page: String(index + 2) }));
}

export default async function UnfilteredPage({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (!/^[1-9]\d*$/.test(page)) notFound();
  return <CachedCatalogResults query={serializeView(defaultFilters, Number(page))} />;
}
