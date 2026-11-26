export type YearPreset = {
  id: "pre2000" | "2000s" | "2010s" | "2020plus";
  label: string;
  min: number | null;
  max: number | null;
};

export const yearPresets: YearPreset[] = [
  { id: "pre2000", label: "до 2000", min: null, max: 1999 },
  { id: "2000s", label: "2000–2009", min: 2000, max: 2009 },
  { id: "2010s", label: "2010–2019", min: 2010, max: 2019 },
  { id: "2020plus", label: "2020+", min: 2020, max: null },
];

export function activeYearPreset(min: number | null, max: number | null): YearPreset["id"] | "custom" | null {
  if (min === null && max === null) return null;
  return yearPresets.find((preset) => preset.min === min && preset.max === max)?.id ?? "custom";
}

export function yearRangeLabel(min: number | null, max: number | null): string {
  if (min === null && max === null) return "любой";
  if (min === null) return `до ${max}`;
  if (max === null) return `с ${min}`;
  return `${min} — ${max}`;
}
