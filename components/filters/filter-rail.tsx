"use client";

import { FilterGroup } from "@/components/filters/filter-group";
import { LanguageFilter } from "@/components/filters/language-filter";
import { MatrixGrid } from "@/components/filters/matrix-grid";
import { RailFooter } from "@/components/filters/rail-footer";
import { TagFilter } from "@/components/filters/tag-filter";
import { YearFilter } from "@/components/filters/year-filter";
import type { CatalogStatus } from "@/lib/catalog/types";
import type { GameFilters } from "@/lib/filtering";
import { yearRangeLabel } from "@/lib/year-presets";

export type FilterRailProps = {
  filters: GameFilters;
  onChange: (next: GameFilters) => void;
  allTags: string[];
  tagCounts: Map<string, number>;
  allLanguages: string[];
  yearScale: number[];
  status: CatalogStatus;
};

/** The filter groups and the service footer. Used as the desktop rail and inside the phone sheet. */
export function FilterRail(props: FilterRailProps) {
  const { filters, onChange } = props;
  const yearActive = filters.minYear !== null || filters.maxYear !== null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Only the groups scroll; the footer with the BGG mark and sync stays in view. */}
      <div data-rail-scroll className="min-h-0 flex-1 overflow-y-auto [&>*:last-child]:border-b-0">
      <FilterGroup
        title="Игроки × вердикт"
        activeCount={filters.matrix.length}
        onClear={() => onChange({ ...filters, matrix: [] })}
      >
        <MatrixGrid value={filters.matrix} onChange={(matrix) => onChange({ ...filters, matrix })} />
      </FilterGroup>

      <FilterGroup
        title="Год"
        collapsible
        summary={yearActive ? yearRangeLabel(filters.minYear, filters.maxYear) : undefined}
        activeCount={yearActive ? 1 : 0}
        onClear={() => onChange({ ...filters, minYear: null, maxYear: null })}
      >
        <YearFilter
          minYear={filters.minYear}
          maxYear={filters.maxYear}
          yearScale={props.yearScale}
          onChange={(minYear, maxYear) => onChange({ ...filters, minYear, maxYear })}
        />
      </FilterGroup>

      <FilterGroup
        title="Категории и механики"
        collapsible
        activeCount={filters.tags.length}
        onClear={() => onChange({ ...filters, tags: [] })}
      >
        <TagFilter
          allTags={props.allTags}
          selected={filters.tags}
          counts={props.tagCounts}
          onChange={(tags) => onChange({ ...filters, tags })}
        />
      </FilterGroup>

      <FilterGroup
        title="Язык издания"
        collapsible
        defaultOpen={filters.language !== ""}
        summary={filters.language || undefined}
        activeCount={filters.language ? 1 : 0}
        onClear={() => onChange({ ...filters, language: "" })}
      >
        <LanguageFilter
          languages={props.allLanguages}
          value={filters.language}
          onChange={(language) => onChange({ ...filters, language })}
        />
      </FilterGroup>

      </div>

      <div data-rail-footer className="flex-none border-t">
        <RailFooter status={props.status} />
      </div>
    </div>
  );
}
