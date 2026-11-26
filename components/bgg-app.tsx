"use client";

import { ArrowDown, ArrowUp, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { FilterRail } from "@/components/filters/filter-rail";
import { BggAttribution } from "@/components/filters/rail-footer";
import { PoweredByBgg } from "@/components/powered-by-bgg";
import { ResultsBar } from "@/components/results/results-bar";
import { ResultsList } from "@/components/results/results-list";
import { ResultsTable } from "@/components/results/results-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsDesktop } from "@/components/use-is-desktop";
import { activeFilterChips } from "@/lib/active-filters";
import { sortKeys, type NormalizedGame, type SortKey } from "@/lib/bgg/types";
import { fetchCacheState } from "@/lib/cache-client";
import type { CacheStatus } from "@/lib/cache/store";
import { defaultSortDir, filterGames, gameTags, tagCounts, type GameFilters } from "@/lib/filtering";
import { formatNumber, sortLabels } from "@/lib/labels";
import { isSearchShortcut } from "@/lib/shortcuts";
import { defaultFilters, serializeFilters } from "@/lib/url-state";
import { buildYearScale } from "@/lib/year-scale";

type BggAppProps = {
  initialGames: NormalizedGame[];
  initialStatus: CacheStatus;
  initialFilters: GameFilters;
};

const SEARCH_URL_DELAY_MS = 300;

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function BggApp({ initialGames, initialStatus, initialFilters }: BggAppProps) {
  const [games, setGames] = useState(initialGames);
  const [status, setStatus] = useState(initialStatus);
  const [filters, setFilters] = useState(initialFilters);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);
  const writtenSearch = useRef(initialFilters.search);
  const isDesktop = useIsDesktop();

  const sortDir = filters.sortDir ?? defaultSortDir(filters.sort);
  const allTags = useMemo(() => [...new Set(games.flatMap((game) => gameTags(game)))].sort(), [games]);
  const allLanguages = useMemo(() => [...new Set(games.flatMap((game) => game.languages))].sort(), [games]);
  const yearScale = useMemo(() => buildYearScale(games.map((game) => game.year)), [games]);
  const filteredGames = useMemo(() => filterGames(games, filters), [games, filters]);
  const counts = useMemo(() => tagCounts(games, filters), [games, filters]);
  const chips = useMemo(() => activeFilterChips(filters), [filters]);

  // Keep the address bar in step with the filters so a reload or a copied link restores the view.
  // Typing in the search box is written after a pause; everything else at once.
  useEffect(() => {
    const delay = filters.search === writtenSearch.current ? 0 : SEARCH_URL_DELAY_MS;
    const timer = window.setTimeout(() => {
      writtenSearch.current = filters.search;
      const query = serializeFilters(filters);
      const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
      if (url !== window.location.pathname + window.location.search) window.history.replaceState(null, "", url);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isSearchShortcut(event, isTypingTarget(event.target))) return;
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function resetFilters() {
    // Sorting is a view setting, not a filter: a reset keeps it.
    setFilters((current) => ({ ...defaultFilters, sort: current.sort, sortDir: current.sortDir }));
  }

  function sortBy(key: SortKey) {
    setFilters((current) => {
      const currentDir = current.sortDir ?? defaultSortDir(current.sort);
      const nextDir = current.sort === key ? (currentDir === "asc" ? "desc" : "asc") : defaultSortDir(key);
      return { ...current, sort: key, sortDir: nextDir };
    });
  }

  async function refreshLocalState() {
    const next = await fetchCacheState();
    setGames(next.games);
    setStatus(next.status);
  }

  function sync() {
    setSyncError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/sync", { method: "POST" });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          setSyncError(payload.error ?? "Синхронизация не удалась.");
        }
        await refreshLocalState();
      } catch {
        // Keep showing the data already on screen; a more specific sync error, if any, stays.
        setSyncError((current) => current ?? "Не удалось обновить данные: сервер не ответил.");
      }
    });
  }

  const rail = (
    <FilterRail
      filters={filters}
      onChange={setFilters}
      allTags={allTags}
      tagCounts={counts}
      allLanguages={allLanguages}
      yearScale={yearScale}
      status={status}
      syncing={isPending}
      syncError={syncError}
      onSync={sync}
    />
  );

  const SortArrow = sortDir === "asc" ? ArrowUp : ArrowDown;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col overflow-hidden border-r lg:flex">
        <div className="flex items-baseline justify-between border-b px-4 py-3.5">
          <span className="text-sm font-semibold">Player-count finder</span>
          <span className="font-mono text-[11px] text-muted-foreground">{formatNumber(games.length, 0)} игр</span>
        </div>
        <div className="min-h-0 flex-1">{rail}</div>
      </aside>

      <main className="min-w-0">
        {/* Pinned so search and the phone filter button stay reachable; above the poll strips (z-10). */}
        <div data-search-bar className="sticky top-0 z-20 flex gap-2 border-b bg-background px-4 py-2.5">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              ref={searchRef}
              type="search"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Поиск по названию…"
              aria-label="Поиск по названию"
              aria-keyshortcuts="/ Control+K Meta+K"
              className="h-9 pr-10 pl-9 text-[13px] shadow-none md:text-[13px]"
            />
            <kbd
              className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border px-1.5 font-mono text-[11px] text-muted-foreground lg:block"
              aria-hidden="true"
            >
              /
            </kbd>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className="h-9 gap-1.5 shadow-none lg:hidden"
                aria-label={chips.length > 0 ? `Фильтры, активных: ${chips.length}` : "Фильтры"}
              >
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Фильтры
                {chips.length > 0 ? <span className="font-mono text-xs">{chips.length}</span> : null}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[320px] gap-0 overflow-hidden p-0 sm:max-w-[320px]">
              <SheetHeader className="border-b px-4 py-3.5">
                <SheetTitle className="text-sm">Фильтры</SheetTitle>
                <SheetDescription className="sr-only">Фильтры списка игр и синхронизация данных</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1">{rail}</div>
            </SheetContent>
          </Sheet>
        </div>

        {games.length === 0 ? (
          <div className="p-4">
            <Alert>
              <AlertTitle>Кэш пуст</AlertTitle>
              <AlertDescription>
                Добавьте BGG_TOKEN в .env.local, положите boardgames_ranks.csv в корень проекта и нажмите
                «Синхронизировать».
              </AlertDescription>
            </Alert>
          </div>
        ) : (
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

            {isDesktop ? (
              <ResultsTable
                games={filteredGames}
                sort={filters.sort}
                sortDir={sortDir}
                onSort={sortBy}
                onReset={resetFilters}
              />
            ) : (
              <ResultsList games={filteredGames} onReset={resetFilters} />
            )}
          </>
        )}

        {/* The rail is hidden on phones, so the required BGG mark gets a place that is always visible. */}
        <footer className="grid gap-2 border-t px-4 py-4 lg:hidden">
          <PoweredByBgg />
          <BggAttribution />
        </footer>
      </main>
    </div>
  );
}
