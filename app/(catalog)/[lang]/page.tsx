import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CachedCatalogResults } from "@/components/results/catalog-results";
import { loadCatalogFrame } from "@/lib/catalog/cached";
import { languageFromSlug, languageSlug } from "@/lib/language-path";
import { viewMetadata } from "@/lib/seo";
import { DEFAULT_LANGUAGE, defaultFilters, RUSSIAN, serializeView } from "@/lib/url-state";

// The first page of one edition language ("/ru", "/en"), static like "/" is for every edition. Requests with filters
// are rewritten to /view/<language> in next.config.ts, further pages to /<language>/page/N.
export const ensureStatic = "navigation";

type Props = { params: Promise<{ lang: string }> };

/** Russian and English are built ahead; any other language is built on its first request and kept. */
export function generateStaticParams() {
  return [{ lang: languageSlug(RUSSIAN) }, { lang: languageSlug("English") }];
}

/** The language a prefix stands for; null for an unknown prefix and for every edition, which has none. */
async function prefixLanguage(params: Props["params"]): Promise<string | null> {
  const { lang } = await params;
  const { facets } = await loadCatalogFrame();
  const language = languageFromSlug(lang, facets.allLanguages);
  // Every edition has no prefix: "/any" is redirected to "/" in next.config.ts.
  return language === DEFAULT_LANGUAGE ? null : language;
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
