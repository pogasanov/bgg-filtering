# Year Range Filter Design

## Goal

Add one dual-handle year slider to the existing filter card so users can apply inclusive minimum and maximum publication-year bounds. Either bound can remain open.

## User interface

The filter card gains a `Year` control beneath the existing sort control. It uses the existing two-thumb Radix slider, giving the user a minimum-year handle and a maximum-year handle on one track without adding a dependency.

The slider uses an ordinal, data-aware scale rather than a linear calendar-year scale. Its positions are indices into the sorted distinct publication years in the currently loaded games. Empty spans of calendar time therefore consume no track space: a lone ancient game occupies one step, while the dense modern years retain useful precision.

One sentinel position is added before the first known-year index and one after the last:

- The minimum handle at the far-left sentinel means `No min`. Moving it one step right selects the oldest known year.
- The maximum handle at the far-right sentinel means `No max`. Moving it one step left selects the newest known year.

The handles cannot cross. The current selection is shown as text such as `No min – No max`, `2000 – No max`, or `2000 – 2020`. The slider retains Radix's accessible keyboard behavior.

If no games have a known year, the control is disabled and both bounds remain open.

## State and data flow

The app stores the selected bounds as actual publication years (`number | null`), where `null` represents the corresponding open endpoint. Both bounds start as `null` and are passed into the existing pure `filterGames` function with the other filters. Slider events produce ordinal positions, which are mapped to actual years before state is updated; selected years are mapped back to positions for rendering.

The sorted distinct year scale is recomputed from the loaded games. After a cache refresh, a selected year that no longer exists is reconciled to the closest remaining known year; an open bound remains open. If no known years remain, both bounds become open.

Year filtering is inclusive. A game with year 2000 passes a minimum bound of 2000 and a maximum bound of 2000. Year filtering combines with search, tag, and matrix filters using AND logic. Games whose year is unknown (`null`) always pass the year filter, even when one or both bounds are selected.

## Implementation boundaries

The year comparison remains in `lib/filtering.ts` so filtering semantics stay framework-independent and directly unit-testable. Pure helpers build the distinct-year scale and translate between slider positions and years. The slider state, labels, and Radix control remain in `components/bgg-app.tsx`, following the existing client-side filter pattern.

## Testing and verification

Filtering tests cover:

- no year bounds;
- a minimum bound only;
- a maximum bound only;
- both bounds together;
- inclusive endpoint matching;
- unknown-year games remaining visible;
- year bounds combining with existing filters.

Scale tests cover deduplication and ordering, sentinel mapping, exact year-to-position mapping, and reconciliation when the loaded year set changes. Component tests verify that an extreme outlier consumes one ordinal step rather than stretching the numeric slider domain.

The implementation is verified with the focused filtering tests, the full Vitest suite, TypeScript type checking, and a production build.

## Compatibility and scope

The design uses the existing Radix slider and project tooling, so no package is added. It does not add year text fields, URL persistence, tick labels for every year, or changes to sort behavior. The scale snaps only to publication years represented in the loaded collection; it does not offer empty calendar years.
