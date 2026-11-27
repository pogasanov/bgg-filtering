/** Interface languages. Russian is the default: the server always renders it, and a visitor can switch. */
export const locales = ["ru", "en"] as const;
export type Locale = (typeof locales)[number];

export const DEFAULT_LOCALE: Locale = "ru";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** The Intl locale for numbers and dates. */
export function intlLocale(locale: Locale): string {
  return locale === "ru" ? "ru-RU" : "en-GB";
}
