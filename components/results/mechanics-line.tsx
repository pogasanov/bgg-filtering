"use client";

import { useLocale } from "@/components/locale";
import { mechanicLabel } from "@/lib/i18n/mechanics";

/** How many mechanics a row names; the line is cut to its width anyway. */
const SHOWN = 4;

/** A game's mechanics under its title, in the interface language and its alphabetical order. */
export function MechanicsLine({ names }: { names: string[] }) {
  const locale = useLocale();
  if (names.length === 0) return null;
  const labels = names.map((name) => mechanicLabel(name, locale)).sort((a, b) => a.localeCompare(b, locale));
  return (
    <div className="truncate text-xs text-muted-foreground">
      {labels.slice(0, SHOWN).join(" · ")}
    </div>
  );
}
