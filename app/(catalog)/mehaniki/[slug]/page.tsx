import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CachedCatalogResults } from "@/components/results/catalog-results";
import { loadCatalogFrame } from "@/lib/catalog/cached";
import { mechanicCollectionFilters, mechanicFromSlug, mechanicSlug, MIN_MECHANIC_GAMES } from "@/lib/collections";
import { viewMetadata } from "@/lib/seo";
import { serializeView } from "@/lib/url-state";

// The best games with one mechanic ("/mehaniki/razmeshchenie-rabochih"): the catalog with that
// mechanic chosen, on a static page. Further pages and other filters use the usual view.
export const ensureStatic = "navigation";

type Props = { params: Promise<{ slug: string }> };

/** The mechanics with enough Russian-edition games are built ahead; the rest on their first request. */
export async function generateStaticParams() {
  const { tagCounts } = await loadCatalogFrame();
  const slugs = [...tagCounts].filter(([, count]) => count >= MIN_MECHANIC_GAMES).map(([mechanic]) => ({ slug: mechanicSlug(mechanic) }));
  // At least one entry is required; with an empty catalog the page is simply not found.
  return slugs.length > 0 ? slugs : [{ slug: "kooperativ" }];
}

async function resolve(params: Props["params"]) {
  const { facets, tagCounts } = await loadCatalogFrame();
  const mechanic = mechanicFromSlug((await params).slug, facets.allTags);
  return mechanic === null ? null : { mechanic, count: tagCounts.get(mechanic) ?? 0 };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await resolve(params);
  if (found === null) return {};
  const metadata = viewMetadata(mechanicCollectionFilters(found.mechanic), 1);
  // A mechanic with a handful of Russian editions answers nothing: the page stays for links, out of the index.
  return found.count < MIN_MECHANIC_GAMES ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

export default async function MechanicCollectionPage({ params }: Props) {
  const found = await resolve(params);
  if (found === null) notFound();
  return <CachedCatalogResults query={serializeView(mechanicCollectionFilters(found.mechanic), 1)} />;
}
