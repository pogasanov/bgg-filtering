import { Pagination } from "@/components/results/pagination";
import { AppResultsBar, PendingResults, TagCountsSync } from "@/components/results/results-controls";
import { ResultsList } from "@/components/results/results-list";
import { ResultsTable } from "@/components/results/results-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { defaultSortDir, type GameFilters } from "@/lib/filtering";
import type { GamesView } from "@/lib/games-view";

type ResultsProps = {
  view: GamesView;
  filters: GameFilters;
};

/**
 * The count bar, one page of games and the page links. The rows are rendered on the server.
 * Both layouts are in the markup and CSS shows one: the server cannot know the screen width,
 * and a page holds few enough rows for the hidden copy to be cheap.
 */
export function Results({ view, filters }: ResultsProps) {
  if (view.total === 0) {
    return (
      <div className="p-4">
        <Alert>
          <AlertTitle>Игр пока нет</AlertTitle>
          <AlertDescription>Данные об играх ещё не загружены. Загляните чуть позже.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <>
      <TagCountsSync counts={view.tagCounts} />
      <AppResultsBar shown={view.shown} total={view.total} />

      <PendingResults>
        <div className="hidden lg:block">
          <ResultsTable games={view.games} sort={filters.sort} sortDir={filters.sortDir ?? defaultSortDir(filters.sort)} />
        </div>
        <div className="lg:hidden">
          <ResultsList games={view.games} />
        </div>
      </PendingResults>

      <Pagination page={view.page} pageCount={view.pageCount} shown={view.shown} filters={filters} />
    </>
  );
}
