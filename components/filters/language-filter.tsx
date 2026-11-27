"use client";

import { useLocale, useMessages } from "@/components/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { languageLabel } from "@/lib/labels";

type LanguageFilterProps = {
  languages: string[];
  value: string;
  onChange: (next: string) => void;
};

const ANY = "__any__";

export function LanguageFilter({ languages, value, onChange }: LanguageFilterProps) {
  const locale = useLocale();
  const t = useMessages();
  // A language from the URL that the data no longer has is still offered, so it can be seen and changed.
  const options = value !== "" && !languages.includes(value) ? [value, ...languages] : languages;

  return (
    <Select value={value || ANY} onValueChange={(next) => onChange(next === ANY ? "" : next)}>
      <SelectTrigger aria-label={t.editionLanguage} size="sm" className="w-full text-xs shadow-none">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{languageLabel("", locale)}</SelectItem>
        {options.map((language) => (
          <SelectItem key={language} value={language}>
            {languageLabel(language, locale)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
