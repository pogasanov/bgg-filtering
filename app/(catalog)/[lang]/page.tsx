import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CachedCatalogResults } from "@/components/results/catalog-results";
import { loadCatalogFrame } from "@/lib/catalog/cached";
import { ANY_LANGUAGE_SLUG, languageFromSlug, languageSlug } from "@/lib/language-path";
import { viewMetadata } from "@/lib/seo";
import { defaultFilters, RUSSIAN, serializeView } from "@/lib/url-state";

// The first page of another language ("/en"), static like "/" is for Russian. Requests with filters
// are rewritten to /view/<language> in next.config.ts, further pages to /<language>/page/N.
export const ensureStatic = "navigation";

type Props = { params: Promise<{ lang: string }> };

/** English and "any language" are built ahead; any other language is built on its first request and kept. */
export function generateStaticParams() {
  return [{ lang: languageSlug("English") }, { lang: ANY_LANGUAGE_SLUG }];
}

/** The language a prefix stands for; null for an unknown prefix and for Russian, which has none. */
async function prefixLanguage(params: Props["params"]): Promise<string | null> {
  const { lang } = await params;
  const { facets } = await loadCatalogFrame();
  const language = languageFromSlug(lang, facets.allLanguages);
  // Russian has no prefix: "/ru" is redirected to "/" in next.config.ts.
  return language === RUSSIAN ? null : language;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const language = await prefixLanguage(params);
  return language === null ? {} : viewMetadata({ ...defaultFilters, language }, 1);
}

export default async function LanguagePage({ params }: Props) {
  const language = await prefixLanguage(params);
  if (language === null) notFound();
  return <CachedCatalogResults query={serializeView({ ...defaultFilters, language }, 1)} />;
}
