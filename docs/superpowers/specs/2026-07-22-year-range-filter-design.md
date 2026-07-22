# Year Range Filter Design

## Goal

Add one dual-handle year slider to the existing filter card so users can apply inclusive minimum and maximum publication-year bounds. Either bound can remain open.

## User interface

The filter card gains a `Year` control beneath the existing sort control. It uses two overlapping native range inputs styled as one track, giving the user a minimum-year handle and a maximum-year handle on the same slider without adding a dependency.

The slider domain is derived from the known years in the currently loaded games. One sentinel position is added before the oldest known year and one after the newest known year:

- The minimum handle at the far-left sentinel means `No min`. Moving it one step right selects the oldest known year.
- The maximum handle at the far-right sentinel means `No max`. Moving it one step left selects the newest known year.

The handles cannot cross. The current selection is shown as text such as `No min – No max`, `2000 – No max`, or `2000 – 2020`. Each native input has an accessible label and retains native keyboard behavior.

If no games have a known year, the control is disabled and both bounds remain open.

## State and data flow

The app stores the selected bounds as `number | null`, where `null` represents the corresponding open endpoint. Both bounds start as `null` and are passed into the existing pure `filterGames` function with the other filters.

The oldest and newest known years are recomputed from the loaded games. After a cache refresh, if a selected bound falls outside the new domain, it is clamped to the nearest known year; an open bound remains open.

Year filtering is inclusive. A game with year 2000 passes a minimum bound of 2000 and a maximum bound of 2000. Year filtering combines with search, tag, and matrix filters using AND logic. Games whose year is unknown (`null`) always pass the year filter, even when one or both bounds are selected.

## Implementation boundaries

The year comparison remains in `lib/filtering.ts` so filtering semantics stay framework-independent and directly unit-testable. The slider state, data-derived limits, labels, and overlapping native inputs live in `components/bgg-app.tsx`, following the existing client-side filter pattern. Minimal shared styling required to render the two range inputs as a single control lives in `app/globals.css`.

Existing uncommitted changes in these files are outside this feature and must be preserved.

## Testing and verification

Filtering tests cover:

- no year bounds;
- a minimum bound only;
- a maximum bound only;
- both bounds together;
- inclusive endpoint matching;
- unknown-year games remaining visible;
- year bounds combining with existing filters.

The implementation is verified with the focused filtering tests, the full Vitest suite, TypeScript type checking, and a production build.

## Compatibility and scope

The design uses native range inputs and existing project tooling, so no package is added. It does not add year text fields, URL persistence, tick labels for every year, or changes to sort behavior.
