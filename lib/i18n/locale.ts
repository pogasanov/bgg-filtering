/** Interface languages. Each has a site of its own (lib/seo.ts, SITE_URLS), built in that language. */
export const locales = ["en", "ru"] as const;
export type Locale = (typeof locales)[number];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/**
 * The language this build speaks, fixed at build time: English for mynextboardgame.com, Russian for
 * ru.mynextboardgame.com. The pages are static, so the language is part of the build, not of a request.
 */
export const SITE_LOCALE: Locale = isLocale(process.env.NEXT_PUBLIC_SITE_LOCALE) ? process.env.NEXT_PUBLIC_SITE_LOCALE : "en";

/** The public address of each language's site. Both are built from the same code, each in its own language. */
export const SITE_URLS: Record<Locale, string> = {
  en: "https://mynextboardgame.com",
  ru: "https://ru.mynextboardgame.com",
};

/**
 * Shop prices are from Russian shops, so only the Russian site shows them, for every game it lists
 * whatever the edition filter; the English site shows none anywhere.
 */
export const SITE_SHOWS_PRICES = SITE_LOCALE === "ru";

/** The language text is written in when nothing else is asked for. */
export const DEFAULT_LOCALE: Locale = SITE_LOCALE;

/** The Intl locale for numbers and dates. */
export function intlLocale(locale: Locale): string {
  return locale === "ru" ? "ru-RU" : "en-GB";
}
