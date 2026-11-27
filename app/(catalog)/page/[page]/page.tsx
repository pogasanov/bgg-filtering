import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CachedCatalogResults } from "@/components/results/catalog-results";
import { loadPageCount } from "@/lib/catalog/cached";
import { loadGameCount } from "@/lib/catalog/load";
import { pageCount } from "@/lib/pagination";
import { viewMetadata } from "@/lib/seo";
import { defaultFilters, serializeView } from "@/lib/url-state";

// Like the first page, the further pages of the unfiltered list are never rendered per request.
// Visitors see "/?page=N": next.config.ts rewrites it here while no filter or sort is set.
export const ensureStatic = "navigation";

type Props = { params: Promise<{ page: string }> };

/** Every page the catalog has now. A page that appears later is built on its first request and kept. */
export async function generateStaticParams() {
  // At least one entry is required; with an empty catalog, page 2 simply shows the first page.
  const last = Math.max(2, pageCount(await loadGameCount()));
  return Array.from({ length: last - 1 }, (_, index) => ({ page: String(index + 2) }));
}

/** The page number, or null when the path holds none. */
function pageNumber(page: string): number | null {
  return /^[1-9]\d*$/.test(page) ? Number(page) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = pageNumber((await params).page);
  return page === null ? {} : viewMetadata(defaultFilters, page);
}

export default async function UnfilteredPage({ params }: Props) {
  const page = pageNumber((await params).page);
  // A page past the end is not found, rather than a copy of the last page under another address.
  if (page === null || page > (await loadPageCount(""))) notFound();
  return <CachedCatalogResults query={serializeView(defaultFilters, page)} />;
}
