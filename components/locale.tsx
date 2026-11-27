"use client";

import { createContext, useContext, type ReactNode } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { isLocale, locales, SITE_LOCALE, SITE_URLS, type Locale } from "@/lib/i18n/locale";
import { messages, type Messages, type TextKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

/**
 * The interface language is the site's: each language has a site of its own, built in it
 * (SITE_LOCALE). The switch moves to the same page on the other language's site.
 */
const LocaleContext = createContext<Locale>(SITE_LOCALE);

export function LocaleProvider({ children }: { children: ReactNode }) {
  return <LocaleContext value={SITE_LOCALE}>{children}</LocaleContext>;
}

/**
 * The same page on another language's site. Collections and game pages have an address of their
 * own in each language, which the page's hreflang link gives; every other page keeps its path and
 * query, the sort included.
 */
function alternateUrl(locale: Locale): string {
  const link = document.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${locale}"]`);
  if (link?.href && new URL(link.href).pathname !== window.location.pathname) return link.href;
  return new URL(window.location.pathname + window.location.search, SITE_URLS[locale]).toString();
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useMessages(): Messages {
  return messages[useLocale()];
}

/** Interface text for server components, which cannot read the visitor's language themselves. */
export function Msg({ id }: { id: TextKey }) {
  return <>{useMessages()[id]}</>;
}

const localeNames: Record<Locale, string> = { ru: "Русский", en: "English" };

/** Two-letter switch between the interface languages. */
export function LocaleSwitch({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useMessages();

  return (
    <ToggleGroup
      type="single"
      value={locale}
      onValueChange={(next) => {
        if (isLocale(next) && next !== locale) window.location.assign(alternateUrl(next));
      }}
      variant="outline"
      size="sm"
      aria-label={t.interfaceLanguage}
      className={cn("h-9 shadow-none", className)}
    >
      {locales.map((item) => (
        <ToggleGroupItem
          key={item}
          value={item}
          lang={item}
          aria-label={localeNames[item]}
          className="h-9 px-2.5 font-mono text-[11px] uppercase data-[state=on]:bg-foreground data-[state=on]:text-background"
        >
          {item}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
