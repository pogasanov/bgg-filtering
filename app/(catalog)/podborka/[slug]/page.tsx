import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CachedCatalogResults } from "@/components/results/catalog-results";
import { playerCollectionFilters, playerCollections, playerCountFromSlug } from "@/lib/collections";
import { viewMetadata } from "@/lib/seo";
import { serializeView } from "@/lib/url-state";

// "Best with N players": the catalog with that one choice made, on a static page. Visitors see
// "/na-dvoih"; next.config.ts rewrites it here. Further pages and other filters use the usual view.
export const ensureStatic = "navigation";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return playerCollections.map(({ slug }) => ({ slug }));
}

async function filtersFor(params: Props["params"]) {
  const playerCount = playerCountFromSlug((await params).slug);
  return playerCount === null ? null : playerCollectionFilters(playerCount);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const filters = await filtersFor(params);
  return filters === null ? {} : viewMetadata(filters, 1);
}

export default async function PlayerCollectionPage({ params }: Props) {
  const filters = await filtersFor(params);
  if (filters === null) notFound();
  return <CachedCatalogResults query={serializeView(filters, 1)} />;
}
