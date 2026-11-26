"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

type TagFilterProps = {
  allTags: string[];
  selected: string[];
  counts: Map<string, number>;
  onChange: (next: string[]) => void;
};

export function TagFilter({ allTags, selected, counts, onChange }: TagFilterProps) {
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const chosen = new Set(selected);
    // Selected tags stay listed even when the data no longer has them, so they can be unticked.
    return [...new Set([...selected, ...allTags])]
      .filter((tag) => needle === "" || tag.toLowerCase().includes(needle))
      .sort(
        (a, b) =>
          Number(chosen.has(b)) - Number(chosen.has(a)) ||
          (counts.get(b) ?? 0) - (counts.get(a) ?? 0) ||
          a.localeCompare(b),
      );
  }, [allTags, selected, counts, query]);

  function toggle(tag: string) {
    onChange(selected.includes(tag) ? selected.filter((item) => item !== tag) : [...selected, tag]);
  }

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Найти среди ${allTags.length}…`}
          aria-label="Поиск по категориям и механикам"
          className="h-8 pl-8 text-xs shadow-none md:text-xs"
        />
      </div>
      <ScrollArea className="h-64">
        <div className="pr-3">
          {options.length === 0 ? <p className="py-2 text-xs text-muted-foreground">Ничего не найдено</p> : null}
          {options.map((tag) => (
            <Label
              key={tag}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-[13px] font-normal hover:bg-muted"
            >
              <Checkbox
                checked={selected.includes(tag)}
                onCheckedChange={() => toggle(tag)}
                className="size-3.5 shadow-none"
              />
              <span className="min-w-0 flex-1 truncate">{tag}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{counts.get(tag) ?? 0}</span>
            </Label>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
