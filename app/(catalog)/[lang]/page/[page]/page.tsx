import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CachedCatalogResults } from "@/components/results/catalog-results";
import { loadCatalogFrame, loadPageCount } from "@/lib/catalog/cached";
import { loadGameCount } from "@/lib/catalog/load";
import { languageFromSlug, languageSlug } from "@/lib/language-path";
import { pageCount } from "@/lib/pagination";
import { viewMetadata } from "@/lib/seo";
import { DEFAULT_LANGUAGE, defaultFilters, RUSSIAN, serializeView } from "@/lib/url-state";

// The further pages of one edition language's unfiltered list. Visitors see "/ru?page=N".
export const ensureStatic = "navigation";

type Props = { params: Promise<{ lang: string; page: string }> };

/**
 * Every page the whole catalog has now, in Russian and in English (an upper bound for each; a page
 * past a language's end is not found); other languages and later pages are built on first request.
 */
export async function generateStaticParams() {
  const last = Math.max(2, pageCount(await loadGameCount()));
  const pages = Array.from({ length: last - 1 }, (_, index) => String(index + 2));
  return [languageSlug(RUSSIAN), languageSlug("English")].flatMap((lang) => pages.map((page) => ({ lang, page })));
}

/** The language and page number the path stands for; null when either is not a real one. */
async function resolve(params: Props["params"]): Promise<{ language: string; page: number } | null> {
  const { lang, page } = await params;
  if (!/^[1-9]\d*$/.test(page)) return null;
  const { facets } = await loadCatalogFrame();
  const language = languageFromSlug(lang, facets.allLanguages);
  if (language === null || language === DEFAULT_LANGUAGE) return null;
  return { language, page: Number(page) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const view = await resolve(params);
  return view === null ? {} : viewMetadata({ ...defaultFilters, language: view.language }, view.page);
}

export default async function LanguageUnfilteredPage({ params }: Props) {
  const view = await resolve(params);
  if (view === null) notFound();
  const filters = { ...defaultFilters, language: view.language };
  // A page past the end is not found, rather than a copy of the last page under another address.
  if (view.page > (await loadPageCount(serializeView(filters, 1)))) notFound();
  return <CachedCatalogResults query={serializeView(filters, view.page)} />;
}
