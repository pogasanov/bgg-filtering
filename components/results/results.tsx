import { Msg } from "@/components/locale";
import { Pagination } from "@/components/results/pagination";
import { AppResultsBar, PendingResults, SearchResultsTracker, TagCountsSync } from "@/components/results/results-controls";
import { ResultsList } from "@/components/results/results-list";
import { ResultsTable } from "@/components/results/results-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { defaultSortDir, type GameFilters } from "@/lib/filtering";
import type { GamesView } from "@/lib/games-view";
import { viewHeading } from "@/lib/seo";
import { SITE_SHOWS_PRICES } from "@/lib/i18n/locale";

type ResultsProps = {
  view: GamesView;
  filters: GameFilters;
};

/**
 * The (hidden) heading, the count bar, one page of games and the page links. The rows are rendered on the server.
 * Both layouts are in the markup and CSS shows one: the server cannot know the screen width,
 * and a page holds few enough rows for the hidden copy to be cheap.
 */
export function Results({ view, filters }: ResultsProps) {
  if (view.total === 0) {
    return (
      <div className="p-4">
        <Alert>
          <AlertTitle>
            <Msg id="noGamesTitle" />
          </AlertTitle>
          <AlertDescription>
            <Msg id="noGamesText" />
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Prices are from Russian shops: the Russian site shows them on every list, the English one never.
  const russian = SITE_SHOWS_PRICES;

  return (
    <>
      {/* For search engines and screen readers only: the page has no visible heading by design. */}
      <h1 className="sr-only">{viewHeading(filters)}</h1>
      <TagCountsSync counts={view.tagCounts} />
      <AppResultsBar shown={view.shown} total={view.total} />
      <SearchResultsTracker search={filters.search} language={filters.language} resultsCount={view.shown} />

      <PendingResults>
        <div className="hidden lg:block">
          <ResultsTable
            games={view.games}
            sort={filters.sort}
            sortDir={filters.sortDir ?? defaultSortDir(filters.sort)}
            russian={russian}
          />
        </div>
        <div className="lg:hidden">
          <ResultsList games={view.games} russian={russian} />
        </div>
      </PendingResults>

      <Pagination page={view.page} pageCount={view.pageCount} shown={view.shown} filters={filters} />
    </>
  );
}
