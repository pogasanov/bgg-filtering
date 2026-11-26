import type { ReactNode } from "react";
import { AppFilterRail } from "@/components/filters/app-filter-rail";
import { GamesProvider } from "@/components/games-state";
import { BggAttribution, PoweredByBgg } from "@/components/powered-by-bgg";
import { SearchBar } from "@/components/search-bar";
import type { CatalogFrame } from "@/lib/games-view";
import { formatNumber } from "@/lib/labels";

type CatalogShellProps = {
  frame: CatalogFrame;
  /** The results for the current view. */
  children: ReactNode;
};

/**
 * The page frame. A server component: only the controls (the rail, the search bar, sorting) are
 * client components, sharing state through the provider.
 */
export function CatalogShell({ frame, children }: CatalogShellProps) {
  return (
    <GamesProvider facets={frame.facets} baseTagCounts={frame.tagCounts} status={frame.status}>
      <div className="min-h-screen lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-screen flex-col overflow-hidden border-r lg:flex">
          <div className="min-h-0 flex-1">
            <AppFilterRail />
          </div>
        </aside>

        <main className="min-w-0">
          <SearchBar />

          {children}

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
