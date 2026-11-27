import type { MatrixSelection, MatrixVerdict, PlayerCount, SortKey } from "./bgg/types";
import { DEFAULT_LOCALE, intlLocale, type Locale } from "./i18n/locale";
import { messages } from "./i18n/messages";

// Every label takes the interface language; Russian, the default, is what the server renders.

export function verdictLabel(verdict: MatrixVerdict, locale: Locale = DEFAULT_LOCALE): string {
  const t = messages[locale];
  return {
    best: t.verdictBest,
    recommended: t.verdictRecommended,
    "not-recommended": t.verdictNotRecommended,
    "not-playable": t.verdictNotPlayable,
  }[verdict];
}

export function verdictShortLabel(verdict: MatrixVerdict, locale: Locale = DEFAULT_LOCALE): string {
  const t = messages[locale];
  return {
    best: t.verdictShortBest,
    recommended: t.verdictShortRecommended,
    "not-recommended": t.verdictShortNotRecommended,
    "not-playable": t.verdictShortNotPlayable,
  }[verdict];
}

export function sortLabel(key: SortKey, locale: Locale = DEFAULT_LOCALE): string {
  const t = messages[locale];
  return {
    rank: t.sortRank,
    year: t.sortYear,
    playingTime: t.sortPlayingTime,
    weight: t.sortWeight,
    geekRating: t.sortGeekRating,
    averageRating: t.sortAverageRating,
    numVoters: t.sortNumVoters,
    price: t.sortPrice,
  }[key];
}

/** What a visitor sees for a player count. BGG's "6+" bucket means more than six, so it reads "7+". */
export function playerCountText(count: PlayerCount): string {
  return count === "6+" ? "7+" : count;
}

export function playersLabel(count: PlayerCount, locale: Locale = DEFAULT_LOCALE): string {
  return messages[locale].players(playerCountText(count));
}

export function matrixCellLabel(selection: MatrixSelection, locale: Locale = DEFAULT_LOCALE): string {
  return `${playersLabel(selection.playerCount, locale)}: ${verdictLabel(selection.verdict, locale)}`;
}

/** The UTC calendar day, so the server render and the visitor's browser show the same text. */
export function formatUpdatedDate(iso: string | null, locale: Locale = DEFAULT_LOCALE): string {
  const t = messages[locale];
  if (!iso) return t.neverUpdated;
  return t.updatedOn(new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC" }).format(new Date(iso)));
}

/**
 * Fixed fraction digits so numbers in a column line up; "—" for missing values. Always in the
 * Russian style, whatever the interface language: most numbers are rendered on the server, which
 * does not know the visitor's choice, and a page must not mix "8,28" with "2,500".
 */
export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** A BGG language name as the filter shows it; an empty language means any. */
export function languageLabel(language: string, locale: Locale = DEFAULT_LOCALE): string {
  const t = messages[locale];
  if (language === "") return t.anyLanguage;
  return language === "Russian" ? t.russianLanguage : language;
}
