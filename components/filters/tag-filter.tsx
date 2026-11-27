"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocale, useMessages } from "@/components/locale";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mechanicLabel, mechanicMatches } from "@/lib/i18n/mechanics";

type TagFilterProps = {
  /** BGG mechanic names, in English: the names the URL and the database use. */
  allTags: string[];
  selected: string[];
  counts: Map<string, number>;
  onChange: (next: string[]) => void;
};

/** How many of the most common mechanics are listed before "more". */
export const TOP_MECHANICS = 10;

/**
 * The mechanics filter. The most common mechanics under the other filters come first and the rest
 * open on demand, so the rail stays short; a search finds a mechanic by its Russian or English name.
 * A game must have every selected mechanic, so the counts include the selection, and mechanics no game
 * in the current list has are left out: ticking one would empty the list.
 */
export function TagFilter({ allTags, selected, counts, onChange }: TagFilterProps) {
  const locale = useLocale();
  const t = useMessages();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const searching = query.trim() !== "";

  const options = useMemo(() => {
    const chosen = new Set(selected);
    // Selected mechanics stay listed even when the data no longer has them, so they can be unticked.
    return [...new Set([...selected, ...allTags])]
      .filter((tag) => chosen.has(tag) || (counts.get(tag) ?? 0) > 0)
      .filter((tag) => mechanicMatches(tag, query))
      .sort(
        (a, b) =>
          Number(chosen.has(b)) - Number(chosen.has(a)) ||
          (counts.get(b) ?? 0) - (counts.get(a) ?? 0) ||
          mechanicLabel(a, locale).localeCompare(mechanicLabel(b, locale), locale),
      );
  }, [allTags, selected, counts, query, locale]);

  // The selected ones are always in view, on top of the most common.
  const collapsedCount = selected.length + TOP_MECHANICS;
  const visible = searching || expanded ? options : options.slice(0, collapsedCount);
  const foldable = options.length - collapsedCount;

  function toggle(tag: string) {
    onChange(selected.includes(tag) ? selected.filter((item) => item !== tag) : [...selected, tag]);
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.mechanicsSearch}
          aria-label={t.mechanicsSearchAria}
          className="h-8 pl-8 text-xs shadow-none md:text-xs"
        />
      </div>

      {selected.length > 1 ? <p className="text-[11px] text-muted-foreground">{t.mechanicsAllOf}</p> : null}

      <div data-mechanics-list>
        {visible.length === 0 ? <p className="py-2 text-xs text-muted-foreground">{t.mechanicsNothing}</p> : null}
        {visible.map((tag) => {
          const label = mechanicLabel(tag, locale);
          return (
            <Label
              key={tag}
              data-mechanic={tag}
              title={label === tag ? undefined : tag}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-[13px] font-normal hover:bg-muted"
            >
              <Checkbox
                checked={selected.includes(tag)}
                onCheckedChange={() => toggle(tag)}
                className="size-3.5 shadow-none"
              />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{counts.get(tag) ?? 0}</span>
            </Label>
          );
        })}
      </div>

      {!searching && foldable > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="h-7 justify-self-start px-1 text-xs text-muted-foreground"
        >
          {expanded ? t.mechanicsLess : t.mechanicsMore(foldable)}
        </Button>
      ) : null}
    </div>
  );
}
