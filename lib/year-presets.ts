import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import { messages } from "./i18n/messages";

export type YearPreset = {
  id: "pre2000" | "2000s" | "2010s" | "2020plus";
  label: Record<Locale, string>;
  min: number | null;
  max: number | null;
};

export const yearPresets: YearPreset[] = [
  { id: "pre2000", label: { ru: "до 2000", en: "before 2000" }, min: null, max: 1999 },
  { id: "2000s", label: { ru: "2000–2009", en: "2000–2009" }, min: 2000, max: 2009 },
  { id: "2010s", label: { ru: "2010–2019", en: "2010–2019" }, min: 2010, max: 2019 },
  { id: "2020plus", label: { ru: "2020+", en: "2020+" }, min: 2020, max: null },
];

export function activeYearPreset(min: number | null, max: number | null): YearPreset["id"] | "custom" | null {
  if (min === null && max === null) return null;
  return yearPresets.find((preset) => preset.min === min && preset.max === max)?.id ?? "custom";
}

export function yearRangeLabel(min: number | null, max: number | null, locale: Locale = DEFAULT_LOCALE): string {
  const t = messages[locale];
  if (min === null && max === null) return t.yearAny;
  if (min === null) return t.yearBefore(max!);
  if (max === null) return t.yearFrom(min);
  return `${min} — ${max}`;
}
