import { BggApp } from "@/components/bgg-app";
import { loadCatalog } from "@/lib/catalog/load";
import { parseFilters } from "@/lib/url-state";

export const dynamic = "force-dynamic";

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

export default async function Page({ searchParams }: PageProps) {
  // Filters come from the URL so a reloaded or shared link opens the same view.
  const initialFilters = parseFilters(toSearchParams(await searchParams));
  // Served from the Next.js data cache: a page view never queries the database.
  const catalog = await loadCatalog();
  return <BggApp initialGames={catalog.games} initialStatus={catalog.status} initialFilters={initialFilters} />;
}
