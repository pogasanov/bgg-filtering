"use client";

import { useParams, useRouter, useSearchParams, useSelectedLayoutSegment } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
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
import type { SortKey } from "@/lib/bgg/types";
import type { CatalogStatus } from "@/lib/catalog/types";
import { defaultSortDir, type GameFilters } from "@/lib/filtering";
import type { GameFacets } from "@/lib/games-view";
import { languageFromSlug, viewHref } from "@/lib/language-path";
import { defaultFilters, parseFilters, RUSSIAN } from "@/lib/url-state";

type GamesState = {
  /** What the controls show. Changes at once; the server-rendered results follow through the URL. */
  filters: GameFilters;
  setFilters: Dispatch<SetStateAction<GameFilters>>;
  /** True while the server is rendering the results for the current filters. */
  isPending: boolean;
  chips: FilterChip[];
  facets: GameFacets;
  tagCounts: Map<string, number>;
  /** Called by the results with the tag counts for their own filters. */
  setTagCounts: (counts: Map<string, number>) => void;
  status: CatalogStatus;
  resetFilters: () => void;
  sortBy: (key: SortKey) => void;
};

type GamesProviderProps = {
  facets: GameFacets;
  /** The tag counts with no filters set. */
  baseTagCounts: Map<string, number>;
  status: CatalogStatus;
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
 * Holds the filter controls' state and sends it to the server through the URL: the server filters
 * the games and renders the result rows, so neither the games nor the filtering reach the browser.
 * It renders nothing itself; the page frame stays in server components and is passed through as children.
 *
 * It sits in the layout above the static pages of the full lists and the filtered view. A static
 * page must not read the query while it is prerendered, and there the filters are the defaults of
 * its language by definition; the language comes from the path, which a static page knows. Only a
 * document that was opened on the filtered view reads its first filters from the query. The choice is
 * made once, when the provider mounts, so moving between the routes later never swaps the tree
 * underneath the controls.
 */
export function GamesProvider(props: GamesProviderProps) {
  const [openedOnView] = useState(useSelectedLayoutSegment() === "view");
  const { lang } = useParams<{ lang?: string | string[] }>();
  const slug = Array.isArray(lang) ? lang[0] : lang;
  const [pathLanguage] = useState(() =>
    slug === undefined ? null : (languageFromSlug(slug, props.facets.allLanguages) ?? RUSSIAN),
  );
  return openedOnView ? (
    <UrlSeededState {...props} pathLanguage={pathLanguage} />
  ) : (
    <GamesState {...props} initialFilters={{ ...defaultFilters, language: pathLanguage ?? RUSSIAN }} />
  );
}

function UrlSeededState({ pathLanguage, ...props }: GamesProviderProps & { pathLanguage: string | null }) {
  const params = useSearchParams();
  const [initialFilters] = useState(() => {
    const filters = parseFilters(new URLSearchParams(params.toString()));
    return pathLanguage === null ? filters : { ...filters, language: pathLanguage };
  });
  return <GamesState {...props} initialFilters={initialFilters} />;
}

function GamesState({
  initialFilters,
  facets,
  baseTagCounts,
  status,
  children,
}: GamesProviderProps & { initialFilters: GameFilters }) {
  const router = useRouter();
  const [filters, setFilters] = useState(initialFilters);
  const [tagCounts, setTagCounts] = useState(baseTagCounts);
  const [isPending, startNavigation] = useTransition();
  // The last address asked of the router. Compared instead of the address bar, which lags behind a navigation in flight.
  const requestedHref = useRef(viewHref(initialFilters));
  const requestedSearch = useRef(initialFilters.search);

  const chips = useMemo(() => activeFilterChips(filters), [filters]);

  // Ask the server for the results whenever the filters change. The URL is replaced, not pushed, so a
  // reload or a copied link restores the view and the back button still leaves the page. A new set of
  // filters always starts on the first page. The language picks the path ("/", "/en"), the other
  // filters the query. Typing in the search box is sent after a pause; everything else at once.
  useEffect(() => {
    const href = viewHref(filters);
    if (href === requestedHref.current) return;
    const delay = filters.search === requestedSearch.current ? 0 : SEARCH_URL_DELAY_MS;
    const timer = window.setTimeout(() => {
      requestedHref.current = href;
      requestedSearch.current = filters.search;
      startNavigation(() => {
        router.replace(href, { scroll: false });
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [filters, router]);

  const resetFilters = useCallback(() => {
    // Every chip goes, the language included, so a reset shows every edition. Sorting is a view
    // setting, not a filter: a reset keeps it.
    setFilters((current) => ({ ...defaultFilters, language: "", sort: current.sort, sortDir: current.sortDir }));
  }, []);

  const sortBy = useCallback((key: SortKey) => {
    setFilters((current) => {
      const currentDir = current.sortDir ?? defaultSortDir(current.sort);
      const nextDir = current.sort === key ? (currentDir === "asc" ? "desc" : "asc") : defaultSortDir(key);
      return { ...current, sort: key, sortDir: nextDir };
    });
  }, []);

  const state: GamesState = {
    filters,
    setFilters,
    isPending,
    chips,
    facets,
    tagCounts,
    setTagCounts,
    status,
    resetFilters,
    sortBy,
  };

  return <GamesContext value={state}>{children}</GamesContext>;
}
