"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useLayoutEffect, type ReactNode } from "react";
import { useGames } from "@/components/games-state";
import { useLocale, useMessages } from "@/components/locale";
import { ResultsBar } from "@/components/results/results-bar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sortKeys, type SortDir, type SortKey } from "@/lib/bgg/types";
import { SITE_SHOWS_PRICES } from "@/lib/i18n/locale";
import { normalizeSearch, searchProperties, track } from "@/lib/analytics";
import { defaultSortDir } from "@/lib/filtering";
import { sortLabel } from "@/lib/labels";
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

/** How long a search must stay unchanged to count as one the visitor meant, not a step while typing. */
const SEARCH_SETTLE_MS = 1500;
/** The last search reported in this tab, so paging or re-sorting the same results does not report it again. */
let lastReportedSearch = "";

/**
 * Reports a title search once its results are on screen and the visitor has stopped typing.
 * Rendered by the server with the results, so it knows how many games matched. Sent at once if
 * the tab is hidden first, so a search followed straight away by leaving is not lost.
 */
export function SearchResultsTracker({ search, language, resultsCount }: { search: string; language: string; resultsCount: number }) {
  const { filters } = useGames();
  // The visitor has typed on since these results were asked for; the newer results will report.
  const current = normalizeSearch(filters.search) === normalizeSearch(search);

  useEffect(() => {
    const key = `${language}|${normalizeSearch(search)}`;
    if (!current || normalizeSearch(search) === "" || key === lastReportedSearch) return;
    const report = () => {
      if (key === lastReportedSearch) return;
      lastReportedSearch = key;
      track("search_performed", searchProperties(search, resultsCount, language));
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") report();
    };
    const timer = window.setTimeout(report, SEARCH_SETTLE_MS);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [current, search, language, resultsCount]);

  return null;
}

type AppResultsBarProps = {
  shown: number;
  total: number;
};

/** The count, the active filter chips and, on phones, the sort control. */
export function AppResultsBar({ shown, total }: AppResultsBarProps) {
  const { filters, setFilters, chips, resetFilters, sortBy } = useGames();
  const locale = useLocale();
  const t = useMessages();
  const sortDir = filters.sortDir ?? defaultSortDir(filters.sort);
  const SortArrow = sortDir === "asc" ? ArrowUp : ArrowDown;

  return (
    <ResultsBar shown={shown} total={total} chips={chips} onChange={setFilters} onReset={resetFilters}>
      <div className="flex items-center gap-1 lg:hidden">
        <Select value={filters.sort} onValueChange={(value) => sortBy(value as SortKey)}>
          <SelectTrigger aria-label={t.sortAria} size="sm" className="h-7 gap-1 text-xs shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortKeys.filter((key) => key !== "price" || SITE_SHOWS_PRICES).map((key) => (
              <SelectItem key={key} value={key}>
                {sortLabel(key, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          className="size-7 shadow-none"
          onClick={() => sortBy(filters.sort)}
          aria-label={sortDir === "asc" ? t.sortAscending : t.sortDescending}
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
  /** Text in place of the column's sort name, the same in every language ("#"). */
  label?: string;
  /** The direction the results are sorted in, when this is the sorted column. */
  activeDir: SortDir | null;
};

export function SortButton({ sortKey, label, activeDir }: SortButtonProps) {
  const { sortBy } = useGames();
  const locale = useLocale();
  const Arrow = activeDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => sortBy(sortKey)}
      className={cn("-mx-2 h-7 gap-1 px-2 text-xs font-medium", activeDir ? "text-foreground" : "text-muted-foreground")}
    >
      {label ?? sortLabel(sortKey, locale)}
      {activeDir ? <Arrow className="size-3" aria-hidden="true" /> : null}
    </Button>
  );
}

export function ResetFiltersButton() {
  const { resetFilters } = useGames();
  const t = useMessages();
  return (
    <Button variant="outline" size="sm" onClick={resetFilters}>
      {t.resetFilters}
    </Button>
  );
}
