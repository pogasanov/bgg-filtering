"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";
import { useGames } from "@/components/games-state";
import { ResultsBar } from "@/components/results/results-bar";
import { ResultsList } from "@/components/results/results-list";
import { ResultsTable } from "@/components/results/results-table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsDesktop } from "@/components/use-is-desktop";
import { sortKeys, type SortKey } from "@/lib/bgg/types";
import { defaultSortDir } from "@/lib/filtering";
import { sortLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

type ResultsProps = {
  /** Shown instead of the results while the cache holds no games. Rendered by the server. */
  emptyCache: ReactNode;
};

/** The count bar and the filtered games: a table on desktop, a list on phones. */
export function Results({ emptyCache }: ResultsProps) {
  const { games, filters, setFilters, deferredFilters, isStale, filteredGames, chips, resetFilters, sortBy } =
    useGames();
  const isDesktop = useIsDesktop();

  if (games.length === 0) return emptyCache;

  const sortDir = filters.sortDir ?? defaultSortDir(filters.sort);
  const shownSortDir = deferredFilters.sortDir ?? defaultSortDir(deferredFilters.sort);
  const SortArrow = sortDir === "asc" ? ArrowUp : ArrowDown;

  return (
    <>
      <ResultsBar
        shown={filteredGames.length}
        total={games.length}
        chips={chips}
        onChange={setFilters}
        onReset={resetFilters}
      >
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

      {/* Dimmed only if the list is still catching up after a noticeable wait, so quick updates do not flicker. */}
      <div
        data-results
        aria-busy={isStale}
        className={cn("transition-opacity duration-200", isStale && "opacity-60 delay-200")}
      >
        {isDesktop ? (
          <ResultsTable
            games={filteredGames}
            sort={deferredFilters.sort}
            sortDir={shownSortDir}
            onSort={sortBy}
            onReset={resetFilters}
          />
        ) : (
          <ResultsList games={filteredGames} onReset={resetFilters} />
        )}
      </div>
    </>
  );
}
