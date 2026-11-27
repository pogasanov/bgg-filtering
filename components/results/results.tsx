import { Pagination } from "@/components/results/pagination";
import { AppResultsBar, PendingResults, SearchResultsTracker, TagCountsSync } from "@/components/results/results-controls";
import { ResultsList } from "@/components/results/results-list";
import { ResultsTable } from "@/components/results/results-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { defaultSortDir, type GameFilters } from "@/lib/filtering";
import type { GamesView } from "@/lib/games-view";
import { canonicalPath, SITE_DESCRIPTION, viewHeading } from "@/lib/seo";
import { RUSSIAN } from "@/lib/url-state";

type ResultsProps = {
  view: GamesView;
  filters: GameFilters;
};

/**
 * The heading, the count bar, one page of games and the page links. The rows are rendered on the server.
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

  // Prices are for Russian editions only, so they are shown only while the list is of those.
  const russian = filters.language === RUSSIAN;
  const heading = viewHeading(filters);
  // The one line about what the site is, on the page people and search engines arrive at first.
  const intro = canonicalPath(filters, view.page) === "/";

  return (
    <>
      <header className="px-4 pt-3">
        <h1 className="text-[15px] font-semibold tracking-tight text-balance">{heading}</h1>
        {intro ? <p className="mt-0.5 max-w-prose text-xs text-muted-foreground">{SITE_DESCRIPTION}</p> : null}
      </header>
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
