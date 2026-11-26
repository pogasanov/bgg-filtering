import { AppFilterRail } from "@/components/filters/app-filter-rail";
import { GamesProvider } from "@/components/games-state";
import { BggAttribution, PoweredByBgg } from "@/components/powered-by-bgg";
import { Results } from "@/components/results/results";
import { SearchBar } from "@/components/search-bar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { GameFilters } from "@/lib/filtering";
import type { GamesView } from "@/lib/games-view";
import { formatNumber } from "@/lib/labels";

type BggAppProps = {
  view: GamesView;
  /** The filters the view was built for. */
  filters: GameFilters;
};

/**
 * The page. A server component: the layout and the result rows are rendered here, and only the
 * controls (the rail, the search bar, sorting) are client components sharing state through the provider.
 */
export function BggApp({ view, filters }: BggAppProps) {
  return (
    <GamesProvider initialFilters={filters} facets={view.facets} tagCounts={view.tagCounts} status={view.status}>
      <div className="min-h-screen lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-screen flex-col overflow-hidden border-r lg:flex">
          <div className="flex items-baseline justify-between border-b px-4 py-3.5">
            <span className="text-sm font-semibold">Player-count finder</span>
            <span className="font-mono text-[11px] text-muted-foreground">{formatNumber(view.total, 0)} игр</span>
          </div>
          <div className="min-h-0 flex-1">
            <AppFilterRail />
          </div>
        </aside>

        <main className="min-w-0">
          <SearchBar />

          {view.total === 0 ? (
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
            <Results view={view} filters={filters} />
          )}

          {/* The rail is hidden on phones, so the required BGG mark gets a place that is always visible. */}
          <footer className="grid gap-2 border-t px-4 py-4 lg:hidden">
            <PoweredByBgg />
            <BggAttribution />
          </footer>
        </main>
      </div>
    </GamesProvider>
  );
}
