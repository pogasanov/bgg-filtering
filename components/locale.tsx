"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DEFAULT_LOCALE, isLocale, locales, type Locale } from "@/lib/i18n/locale";
import { messages, type Messages, type TextKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

/**
 * The interface language lives in the browser, not in the URL or a cookie: the pages are static and
 * cached, so the server always renders Russian, and the visitor's choice is applied after hydration.
 * The path prefix ("/en") already means the edition language, a different thing.
 */
const STORAGE_KEY = "ui-locale";
const CHANGE_EVENT = "ui-locale-change";

function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function setStoredLocale(locale: Locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Storage can be blocked; the choice then lasts until the page is reloaded.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Outside the provider (tests, isolated renders) the interface is Russian.
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, readStoredLocale, () => DEFAULT_LOCALE);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <LocaleContext value={locale}>{children}</LocaleContext>;
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
        if (isLocale(next)) setStoredLocale(next);
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
