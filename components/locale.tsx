"use client";

import { createContext, useContext, type ReactNode } from "react";
import { SITE_LOCALE, type Locale } from "@/lib/i18n/locale";
import { messages, type Messages, type TextKey } from "@/lib/i18n/messages";

/**
 * The interface language is the site's: each language has a site of its own, built in it
 * (SITE_LOCALE), with no switch: search engines find the other site through each page's hreflang links.
 */
const LocaleContext = createContext<Locale>(SITE_LOCALE);

export function LocaleProvider({ children }: { children: ReactNode }) {
  return <LocaleContext value={SITE_LOCALE}>{children}</LocaleContext>;
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
