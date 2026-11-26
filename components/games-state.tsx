"use client";

import {
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { activeFilterChips, type FilterChip } from "@/lib/active-filters";
import type { ListedGame, SortKey } from "@/lib/bgg/types";
import { fetchCacheState } from "@/lib/cache-client";
import type { CacheStatus } from "@/lib/cache/store";
import { defaultSortDir, filterGames, gameTags, tagCounts, type GameFilters } from "@/lib/filtering";
import { formatNumber } from "@/lib/labels";
import { defaultFilters, serializeFilters } from "@/lib/url-state";
import { buildYearScale } from "@/lib/year-scale";

type GamesState = {
  games: ListedGame[];
  status: CacheStatus;
  /** What the controls show; changes at once. */
  filters: GameFilters;
  setFilters: Dispatch<SetStateAction<GameFilters>>;
  /** What the results show; lags behind `filters` while the list catches up. */
  deferredFilters: GameFilters;
  isStale: boolean;
  filteredGames: ListedGame[];
  chips: FilterChip[];
  allTags: string[];
  tagCounts: Map<string, number>;
  allLanguages: string[];
  yearScale: number[];
  resetFilters: () => void;
  sortBy: (key: SortKey) => void;
  syncing: boolean;
  syncError: string | null;
  sync: () => void;
};

type GamesProviderProps = {
  initialGames: ListedGame[];
  initialStatus: CacheStatus;
  initialFilters: GameFilters;
  children: ReactNode;
};

const SEARCH_URL_DELAY_MS = 300;

const GamesContext = createContext<GamesState | null>(null);

export function useGames(): GamesState {
  const state = useContext(GamesContext);
  if (!state) throw new Error("useGames must be used inside GamesProvider.");
  return state;
}

/**
 * Holds the games, the filters and the sync state for the interactive parts of the page.
 * It renders nothing itself: the page layout stays in server components and is passed through as children.
 */
export function GamesProvider({ initialGames, initialStatus, initialFilters, children }: GamesProviderProps) {
  const [games, setGames] = useState(initialGames);
  const [status, setStatus] = useState(initialStatus);
  const [filters, setFilters] = useState(initialFilters);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncing, startTransition] = useTransition();
  const writtenSearch = useRef(initialFilters.search);

  // The controls follow `filters` at once; the heavy part (filtering, counting, the result rows) follows
  // this deferred copy. React renders it in the background and drops a half-done render when the filters
  // change again, so fast typing or a slider drag costs one list update instead of one per step, and
  // the wait scales with the device instead of being a fixed timer.
  const deferredFilters = useDeferredValue(filters);
  const isStale = deferredFilters !== filters;

  const allTags = useMemo(() => [...new Set(games.flatMap((game) => gameTags(game)))].sort(), [games]);
  const allLanguages = useMemo(() => [...new Set(games.flatMap((game) => game.languages))].sort(), [games]);
  const yearScale = useMemo(() => buildYearScale(games.map((game) => game.year)), [games]);
  const filteredGames = useMemo(() => filterGames(games, deferredFilters), [games, deferredFilters]);
  const counts = useMemo(() => tagCounts(games, deferredFilters), [games, deferredFilters]);
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

  // Stable identities: the memoised results skip the urgent render only if their props do not change.
  const resetFilters = useCallback(() => {
    // Sorting is a view setting, not a filter: a reset keeps it.
    setFilters((current) => ({ ...defaultFilters, sort: current.sort, sortDir: current.sortDir }));
  }, []);

  const sortBy = useCallback((key: SortKey) => {
    setFilters((current) => {
      const currentDir = current.sortDir ?? defaultSortDir(current.sort);
      const nextDir = current.sort === key ? (currentDir === "asc" ? "desc" : "asc") : defaultSortDir(key);
      return { ...current, sort: key, sortDir: nextDir };
    });
  }, []);

  const sync = useCallback(() => {
    setSyncError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/sync", { method: "POST" });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          setSyncError(payload.error ?? "Синхронизация не удалась.");
        }
        const next = await fetchCacheState();
        setGames(next.games);
        setStatus(next.status);
      } catch {
        // Keep showing the data already on screen; a more specific sync error, if any, stays.
        setSyncError((current) => current ?? "Не удалось обновить данные: сервер не ответил.");
      }
    });
  }, []);

  const state: GamesState = {
    games,
    status,
    filters,
    setFilters,
    deferredFilters,
    isStale,
    filteredGames,
    chips,
    allTags,
    tagCounts: counts,
    allLanguages,
    yearScale,
    resetFilters,
    sortBy,
    syncing,
    syncError,
    sync,
  };

  return <GamesContext value={state}>{children}</GamesContext>;
}

/** The number of cached games; it changes after a sync, so it cannot be fixed by the server. */
export function GameCount() {
  return formatNumber(useGames().games.length, 0);
}
