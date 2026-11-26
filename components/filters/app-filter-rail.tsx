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
      allTags={state.allTags}
      tagCounts={state.tagCounts}
      allLanguages={state.allLanguages}
      yearScale={state.yearScale}
      status={state.status}
    />
  );
}
