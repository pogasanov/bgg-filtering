import { notFound } from "next/navigation";
import { CachedCatalogResults } from "@/components/results/catalog-results";
import { loadCatalogFrame } from "@/lib/catalog/cached";
import { languageFromSlug, languageSlug } from "@/lib/language-path";
import { defaultFilters, RUSSIAN, serializeView } from "@/lib/url-state";

// The first page of another language ("/en"), static like "/" is for Russian. Requests with filters
// are rewritten to /view/<language> in next.config.ts, further pages to /<language>/page/N.
export const ensureStatic = "navigation";

/** English is built ahead; any other language is built on its first request and kept. */
export function generateStaticParams() {
  return [{ lang: languageSlug("English") }];
}

export default async function LanguagePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const { facets } = await loadCatalogFrame();
  const language = languageFromSlug(lang, facets.allLanguages);
  // Russian has no prefix: "/ru" is redirected to "/" in next.config.ts.
  if (language === null || language === RUSSIAN) notFound();
  return <CachedCatalogResults query={serializeView({ ...defaultFilters, language }, 1)} />;
}
