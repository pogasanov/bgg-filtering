import type { GameFilters } from "./filtering";
import { DEFAULT_LANGUAGE, RUSSIAN, serializeView } from "./url-state";

/**
 * Each edition language has its own address: every edition, the default, lives at "/", each
 * language under a prefix of its own ("/ru", "/en", "/de"). The prefix keeps the unfiltered pages of
 * each language static and cached, like the full list at "/". "/any", the old address of every
 * edition, redirects to "/".
 */
const languageCodes: Record<string, string> = {
  Russian: "ru",
  English: "en",
  German: "de",
  French: "fr",
  Spanish: "es",
  Italian: "it",
  Polish: "pl",
  Portuguese: "pt",
  Japanese: "ja",
  Chinese: "zh",
  Korean: "ko",
  Dutch: "nl",
  Czech: "cs",
  Ukrainian: "uk",
  Hungarian: "hu",
  Swedish: "sv",
  Finnish: "fi",
  Norwegian: "no",
  Danish: "da",
  Greek: "el",
  Turkish: "tr",
  Romanian: "ro",
  Bulgarian: "bg",
};

/** The old path segment for "any language", redirected to "/". */
export const ANY_LANGUAGE_SLUG = "any";

/** The ISO 639-1 code of a BGG language name, when the site knows it. */
export function languageCode(language: string): string | null {
  return languageCodes[language] ?? null;
}

/** The path segment of a language: its ISO code when it has one, otherwise its name in lower case. */
export function languageSlug(language: string): string {
  return (
    languageCodes[language] ??
    language
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}

/** The language a path segment stands for, among the languages the catalog has; null when none. */
export function languageFromSlug(slug: string, languages: readonly string[]): string | null {
  if (slug === ANY_LANGUAGE_SLUG) return "";
  return [RUSSIAN, ...languages].find((language) => languageSlug(language) === slug) ?? null;
}

/** The path the unfiltered list of a language lives at. */
export function languagePath(language: string): string {
  return language === DEFAULT_LANGUAGE ? "/" : `/${languageSlug(language)}`;
}

/** The public address of a view: the language as the path, every other filter and the page in the query. */
export function viewHref(filters: GameFilters, page = 1): string {
  const query = serializeView({ ...filters, language: DEFAULT_LANGUAGE }, page);
  const path = languagePath(filters.language);
  return query ? `${path}?${query}` : path;
}
