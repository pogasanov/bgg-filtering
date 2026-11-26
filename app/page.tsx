import { BggApp } from "@/components/bgg-app";
import { queryGames } from "@/lib/games-query";
import { parseFilters, parsePage } from "@/lib/url-state";

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
  // The view lives in the URL: the server filters, sorts and cuts one page, so a reloaded or shared link opens the same view.
  const params = toSearchParams(await searchParams);
  const filters = parseFilters(params);
  return <BggApp view={queryGames(filters, parsePage(params))} filters={filters} />;
}
