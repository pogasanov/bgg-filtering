import { AppFilterRail } from "@/components/filters/app-filter-rail";
import { GameCount, GamesProvider } from "@/components/games-state";
import { BggAttribution, PoweredByBgg } from "@/components/powered-by-bgg";
import { Results } from "@/components/results/results";
import { SearchBar } from "@/components/search-bar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ListedGame } from "@/lib/bgg/types";
import type { CatalogStatus } from "@/lib/catalog/types";
import type { GameFilters } from "@/lib/filtering";

type BggAppProps = {
  initialGames: ListedGame[];
  initialStatus: CatalogStatus;
  initialFilters: GameFilters;
};

/**
 * The page layout. A server component: only the provider and the parts that react to input
 * (the rail, the search bar, the results) are client components, and they share state through the provider.
 */
export function BggApp({ initialGames, initialStatus, initialFilters }: BggAppProps) {
  return (
    <GamesProvider initialGames={initialGames} initialStatus={initialStatus} initialFilters={initialFilters}>
      <div className="min-h-screen lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-screen flex-col overflow-hidden border-r lg:flex">
          <div className="flex items-baseline justify-between border-b px-4 py-3.5">
            <span className="text-sm font-semibold">Player-count finder</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              <GameCount /> игр
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <AppFilterRail />
          </div>
        </aside>

        <main className="min-w-0">
          <SearchBar />

          <Results
            emptyCache={
              <div className="p-4">
                <Alert>
                  <AlertTitle>Игр пока нет</AlertTitle>
                  <AlertDescription>Данные об играх ещё не загружены. Загляните чуть позже.</AlertDescription>
                </Alert>
              </div>
            }
          />

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
