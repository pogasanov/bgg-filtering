import { notFound } from "next/navigation";
import { CachedCatalogResults } from "@/components/results/catalog-results";
import { loadCatalogFrame } from "@/lib/catalog/cached";
import { loadGameCount } from "@/lib/catalog/load";
import { languageFromSlug, languageSlug } from "@/lib/language-path";
import { pageCount } from "@/lib/pagination";
import { defaultFilters, RUSSIAN, serializeView } from "@/lib/url-state";

// The further pages of another language's unfiltered list. Visitors see "/en?page=N".
export const ensureStatic = "navigation";

/** Every English page the catalog has now; other languages and later pages are built on first request. */
export async function generateStaticParams() {
  const last = Math.max(2, pageCount(await loadGameCount()));
  return Array.from({ length: last - 1 }, (_, index) => ({ lang: languageSlug("English"), page: String(index + 2) }));
}

export default async function LanguageUnfilteredPage({ params }: { params: Promise<{ lang: string; page: string }> }) {
  const { lang, page } = await params;
  if (!/^[1-9]\d*$/.test(page)) notFound();
  const { facets } = await loadCatalogFrame();
  const language = languageFromSlug(lang, facets.allLanguages);
  if (language === null || language === RUSSIAN) notFound();
  return <CachedCatalogResults query={serializeView({ ...defaultFilters, language }, Number(page))} />;
}
