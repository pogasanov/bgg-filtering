"use client";

import { FilterRail } from "@/components/filters/filter-rail";
import { useGames } from "@/components/games-state";

/** The filter rail wired to the page state. Rendered in the desktop sidebar and in the phone sheet. */
export function AppFilterRail() {
  const state = useGames();

  return (
    <FilterRail
      filters={state.filters}
      onChange={state.setFilters}
      allTags={state.facets.allTags}
      tagCounts={state.tagCounts}
      allLanguages={state.facets.allLanguages}
      yearScale={state.facets.yearScale}
      status={state.status}
      syncing={state.syncing}
      syncError={state.syncError}
      onSync={state.sync}
    />
  );
}
