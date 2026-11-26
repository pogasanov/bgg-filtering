"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useLayoutEffect, type ReactNode } from "react";
import { useGames } from "@/components/games-state";
import { ResultsBar } from "@/components/results/results-bar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sortKeys, type SortDir, type SortKey } from "@/lib/bgg/types";
import { defaultSortDir } from "@/lib/filtering";
import { sortLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

// The interactive pieces inside the server-rendered results. Each one only reads or changes the filters.

/**
 * Hands the tag counts of the rendered results to the rail, which lives in the layout above the
 * page and so cannot receive them as props. Set before paint, so the rail and the rows change together.
 */
export function TagCountsSync({ counts }: { counts: Map<string, number> }) {
  const { setTagCounts } = useGames();
  useLayoutEffect(() => setTagCounts(counts), [counts, setTagCounts]);
  return null;
}

type AppResultsBarProps = {
  shown: number;
  total: number;
};

/** The count, the active filter chips and, on phones, the sort control. */
export function AppResultsBar({ shown, total }: AppResultsBarProps) {
  const { filters, setFilters, chips, resetFilters, sortBy } = useGames();
  const sortDir = filters.sortDir ?? defaultSortDir(filters.sort);
  const SortArrow = sortDir === "asc" ? ArrowUp : ArrowDown;

  return (
    <ResultsBar shown={shown} total={total} chips={chips} onChange={setFilters} onReset={resetFilters}>
      <div className="flex items-center gap-1 lg:hidden">
        <Select value={filters.sort} onValueChange={(value) => sortBy(value as SortKey)}>
          <SelectTrigger aria-label="Сортировка" size="sm" className="h-7 gap-1 text-xs shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortKeys.map((key) => (
              <SelectItem key={key} value={key}>
                {sortLabels[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          className="size-7 shadow-none"
          onClick={() => sortBy(filters.sort)}
          aria-label={sortDir === "asc" ? "По возрастанию, изменить порядок" : "По убыванию, изменить порядок"}
        >
          <SortArrow className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </ResultsBar>
  );
}

/** Dims the results only if the server takes a noticeable time to answer, so quick updates do not flicker. */
export function PendingResults({ children }: { children: ReactNode }) {
  const { isPending } = useGames();
  return (
    <div
      data-results
      aria-busy={isPending}
      className={cn("transition-opacity duration-200", isPending && "opacity-60 delay-200")}
    >
      {children}
    </div>
  );
}

type SortButtonProps = {
  sortKey: SortKey;
  label: string;
  /** The direction the results are sorted in, when this is the sorted column. */
  activeDir: SortDir | null;
};

export function SortButton({ sortKey, label, activeDir }: SortButtonProps) {
  const { sortBy } = useGames();
  const Arrow = activeDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => sortBy(sortKey)}
      className={cn("-mx-2 h-7 gap-1 px-2 text-xs font-medium", activeDir ? "text-foreground" : "text-muted-foreground")}
    >
      {label}
      {activeDir ? <Arrow className="size-3" aria-hidden="true" /> : null}
    </Button>
  );
}

export function ResetFiltersButton() {
  const { resetFilters } = useGames();
  return (
    <Button variant="outline" size="sm" onClick={resetFilters}>
      Сбросить фильтры
    </Button>
  );
}
