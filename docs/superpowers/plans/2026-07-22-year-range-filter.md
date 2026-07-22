# Year Range Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an accessible dual-handle year slider that supports open minimum and maximum bounds while keeping games with unknown years visible.

**Architecture:** Extend the existing pure `filterGames` contract with nullable inclusive year bounds, then keep the data-derived slider domain and UI state inside `BggApp`. Render two overlapping native range inputs over one visual track and use sentinel positions immediately outside the known-year domain for `No min` and `No max`.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, native range inputs, Vitest, React server rendering for markup tests.

---

## File structure

- Modify `lib/filtering.ts`: add nullable year bounds to `GameFilters` and apply the inclusive year predicate.
- Modify `tests/filters.test.ts`: update existing filter fixtures and cover all year-bound semantics.
- Modify `components/bgg-app.tsx`: derive known-year limits, own selected-bound state, pass bounds into filtering, and render the dual-handle control.
- Modify `app/globals.css`: style two native range inputs as one accessible dual-handle slider.
- Create `tests/bgg-app.test.ts`: verify the initial slider domain, sentinels, accessible labels, endpoint labels, and no-year disabled state without adding a DOM-test dependency.

The workspace already has uncommitted edits in every modified existing file. Preserve them, review only the feature hunks, and do not stage or commit those files unless the user explicitly asks for a combined commit.

### Task 1: Inclusive year filtering

**Files:**
- Modify: `tests/filters.test.ts`
- Modify: `lib/filtering.ts`

- [ ] **Step 1: Add open bounds to every existing filter invocation**

In each existing `filterGames` options object in `tests/filters.test.ts`, add these two properties so the current tests continue to express an unbounded year range:

```ts
minYear: null,
maxYear: null,
```

For the compact call in `empty matrix selection does not filter by player recommendations`, use:

```ts
expect(
  filterGames(games, {
    search: "",
    tags: [],
    matrix: [],
    sort: "rank",
    minYear: null,
    maxYear: null,
  }).map((game) => game.id),
).toEqual([1, 2]);
```

- [ ] **Step 2: Write failing tests for open, one-sided, and inclusive bounds**

Add these tests inside the existing `describe("game filtering", ...)` block:

```ts
test.each([
  { label: "no bounds", minYear: null, maxYear: null, expected: [20, 21, 22, 23, 24] },
  { label: "minimum only", minYear: 2000, maxYear: null, expected: [21, 22, 23, 24] },
  { label: "maximum only", minYear: null, maxYear: 2020, expected: [20, 21, 22, 24] },
  { label: "both inclusive bounds", minYear: 2000, maxYear: 2020, expected: [21, 22, 24] },
])("applies $label while keeping unknown years", ({ minYear, maxYear, expected }) => {
  const datedGames = [
    makeGame({ id: 20, rank: 20, year: 1999 }),
    makeGame({ id: 21, rank: 21, year: 2000 }),
    makeGame({ id: 22, rank: 22, year: 2020 }),
    makeGame({ id: 23, rank: 23, year: 2021 }),
    makeGame({ id: 24, rank: 24, year: null }),
  ];

  const result = filterGames(datedGames, {
    search: "",
    tags: [],
    matrix: [],
    sort: "rank",
    minYear,
    maxYear,
  });

  expect(result.map((game) => game.id)).toEqual(expected);
});

test("combines year bounds with the existing filters using AND logic", () => {
  const strategyGames = [
    makeGame({ id: 30, rank: 30, title: "Strategy Classic", year: 1990, categories: ["Strategy"] }),
    makeGame({ id: 31, rank: 31, title: "Strategy Modern", year: 2020, categories: ["Strategy"] }),
  ];

  const result = filterGames(strategyGames, {
    search: "strategy",
    tags: ["Strategy"],
    matrix: [],
    sort: "rank",
    minYear: 2000,
    maxYear: null,
  });

  expect(result.map((game) => game.id)).toEqual([31]);
});
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
npm test -- tests/filters.test.ts
```

Expected: the new table-driven year test fails because `filterGames` does not yet use `minYear` or `maxYear`.

- [ ] **Step 4: Extend the filter contract and add the minimal predicate**

Replace the `GameFilters` declaration in `lib/filtering.ts` with:

```ts
export type GameFilters = {
  search: string;
  tags: string[];
  matrix: MatrixSelection[];
  sort: SortKey;
  minYear: number | null;
  maxYear: number | null;
};
```

Inside the `.filter((game) => { ... })` callback, immediately after the search check, insert:

```ts
if (game.year !== null) {
  if (filters.minYear !== null && game.year < filters.minYear) return false;
  if (filters.maxYear !== null && game.year > filters.maxYear) return false;
}
```

This deliberately allows `year: null` through and keeps endpoint comparisons inclusive.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
npm test -- tests/filters.test.ts
```

Expected: all filtering tests pass.

- [ ] **Step 6: Review the feature-only diff**

Run:

```bash
git diff -- lib/filtering.ts tests/filters.test.ts
```

Confirm the pre-existing not-playable and deduplicated-tag changes remain intact and that no unrelated lines were reverted.

### Task 2: Dual-handle slider markup and state

**Files:**
- Create: `tests/bgg-app.test.ts`
- Modify: `components/bgg-app.tsx`

- [ ] **Step 1: Write the failing markup tests**

Create `tests/bgg-app.test.ts` with:

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { BggApp } from "@/components/bgg-app";
import { emptyPlayerRecommendations } from "@/lib/bgg/parser";
import type { CacheStatus } from "@/lib/cache/store";
import type { NormalizedGame } from "@/lib/bgg/types";

const status: CacheStatus = {
  gameCount: 3,
  cacheUpdatedAt: null,
  latestSync: {
    status: null,
    startedAt: null,
    finishedAt: null,
    fetchedCount: null,
    error: null,
  },
  syncLocked: false,
};

function makeGame(id: number, year: number | null): NormalizedGame {
  return {
    id,
    rank: id,
    title: `Game ${id}`,
    year,
    description: "",
    geekRating: 8,
    averageRating: 8,
    numVoters: 100,
    minPlayers: 1,
    maxPlayers: 4,
    playingTime: 60,
    weight: 2,
    categories: [],
    mechanics: [],
    playerRecommendations: emptyPlayerRecommendations(),
    bggUrl: `https://boardgamegeek.com/boardgame/${id}`,
  };
}

function rangeInput(html: string, label: string): string {
  const input = html.match(new RegExp(`<input[^>]*aria-label="${label}"[^>]*>`))?.[0];
  expect(input).toBeDefined();
  return input ?? "";
}

describe("year range filter", () => {
  test("renders open sentinels around the known-year domain", () => {
    const html = renderToStaticMarkup(
      createElement(BggApp, {
        initialGames: [makeGame(1, 1995), makeGame(2, 2020), makeGame(3, null)],
        initialStatus: status,
      }),
    );

    const minimum = rangeInput(html, "Minimum publication year");
    expect(minimum).toContain('min="1994"');
    expect(minimum).toContain('max="2020"');
    expect(minimum).toContain('value="1994"');
    expect(minimum).toContain('aria-valuetext="No minimum year"');

    const maximum = rangeInput(html, "Maximum publication year");
    expect(maximum).toContain('min="1995"');
    expect(maximum).toContain('max="2021"');
    expect(maximum).toContain('value="2021"');
    expect(maximum).toContain('aria-valuetext="No maximum year"');

    expect(html).toContain("No min – No max");
    expect(html).toContain(">No min<");
    expect(html).toContain(">No max<");
  });

  test("disables both handles when no known years exist", () => {
    const html = renderToStaticMarkup(
      createElement(BggApp, {
        initialGames: [makeGame(1, null)],
        initialStatus: { ...status, gameCount: 1 },
      }),
    );

    expect(rangeInput(html, "Minimum publication year")).toContain('disabled=""');
    expect(rangeInput(html, "Maximum publication year")).toContain('disabled=""');
  });
});
```

- [ ] **Step 2: Run the markup test and verify RED**

Run:

```bash
npm test -- tests/bgg-app.test.ts
```

Expected: both tests fail because the accessible range inputs do not exist.

- [ ] **Step 3: Add state, derived limits, and filter data flow**

In `components/bgg-app.tsx`, change the React import to:

```ts
import { useEffect, useMemo, useState, useTransition } from "react";
```

Add the two bound states beside the other filter states:

```ts
const [minYear, setMinYear] = useState<number | null>(null);
const [maxYear, setMaxYear] = useState<number | null>(null);
```

After the `allTags` memo, add:

```ts
const yearLimits = useMemo(() => {
  const knownYears = games
    .map((game) => game.year)
    .filter((year): year is number => year !== null);

  if (knownYears.length === 0) return null;
  return {
    oldest: Math.min(...knownYears),
    newest: Math.max(...knownYears),
  };
}, [games]);

useEffect(() => {
  setMinYear((current) => {
    if (current === null || yearLimits === null) return null;
    return Math.min(Math.max(current, yearLimits.oldest), yearLimits.newest);
  });
  setMaxYear((current) => {
    if (current === null || yearLimits === null) return null;
    return Math.min(Math.max(current, yearLimits.oldest), yearLimits.newest);
  });
}, [yearLimits]);

const sliderMin = yearLimits ? yearLimits.oldest - 1 : 0;
const sliderMax = yearLimits ? yearLimits.newest + 1 : 1;
const minSliderValue = minYear ?? sliderMin;
const maxSliderValue = maxYear ?? sliderMax;
const sliderSpan = sliderMax - sliderMin;
const selectedStart = ((minSliderValue - sliderMin) / sliderSpan) * 100;
const selectedEnd = ((maxSliderValue - sliderMin) / sliderSpan) * 100;
const yearRangeLabel = `${minYear ?? "No min"} – ${maxYear ?? "No max"}`;
```

Replace the `filterGames` memo with:

```ts
const filteredGames = useMemo(
  () => filterGames(games, { search, tags: selectedTags, matrix, sort, minYear, maxYear }),
  [games, search, selectedTags, matrix, sort, minYear, maxYear],
);
```

Add these handlers beside `toggleTag`:

```ts
function updateMinYear(position: number) {
  if (!yearLimits) return;
  setMinYear(position === sliderMin ? null : Math.min(position, maxYear ?? yearLimits.newest));
}

function updateMaxYear(position: number) {
  if (!yearLimits) return;
  setMaxYear(position === sliderMax ? null : Math.max(position, minYear ?? yearLimits.oldest));
}
```

- [ ] **Step 4: Render the two handles as one control**

In the filter card, insert this block after the Sort label and before Categories + mechanics:

```tsx
<fieldset disabled={!yearLimits}>
  <legend className="sr-only">Year</legend>
  <div className="flex items-center justify-between gap-3">
    <span className="text-sm font-medium" aria-hidden="true">Year</span>
    <output className="text-xs text-[var(--muted-foreground)]">{yearRangeLabel}</output>
  </div>
  <div className="relative mt-3 h-5">
    <div className="absolute left-0 right-0 top-2 h-1 rounded-full bg-[var(--muted)]" aria-hidden="true" />
    <div
      className="absolute top-2 h-1 rounded-full bg-[var(--primary)]"
      style={{ left: `${selectedStart}%`, right: `${100 - selectedEnd}%` }}
      aria-hidden="true"
    />
    <input
      type="range"
      className="year-range-input"
      min={sliderMin}
      max={maxYear ?? yearLimits?.newest ?? sliderMax}
      step={1}
      value={minSliderValue}
      onChange={(event) => updateMinYear(Number(event.target.value))}
      disabled={!yearLimits}
      aria-label="Minimum publication year"
      aria-valuetext={minYear === null ? "No minimum year" : String(minYear)}
    />
    <input
      type="range"
      className="year-range-input"
      min={minYear ?? yearLimits?.oldest ?? sliderMin}
      max={sliderMax}
      step={1}
      value={maxSliderValue}
      onChange={(event) => updateMaxYear(Number(event.target.value))}
      disabled={!yearLimits}
      aria-label="Maximum publication year"
      aria-valuetext={maxYear === null ? "No maximum year" : String(maxYear)}
    />
  </div>
  <div className="mt-1 flex justify-between text-xs text-[var(--muted-foreground)]" aria-hidden="true">
    <span>No min</span>
    <span>No max</span>
  </div>
</fieldset>
```

- [ ] **Step 5: Run the markup test and verify GREEN**

Run:

```bash
npm test -- tests/bgg-app.test.ts
```

Expected: both slider markup tests pass.

- [ ] **Step 6: Run the filtering and markup tests together**

Run:

```bash
npm test -- tests/filters.test.ts tests/bgg-app.test.ts
```

Expected: both files pass with no warnings.

### Task 3: Slider presentation and browser behavior

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add the shared dual-range styles**

Append this CSS after the existing `button, input, select` rule:

```css
.year-range-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 1.25rem;
  margin: 0;
  appearance: none;
  background: transparent;
  pointer-events: none;
}

.year-range-input::-webkit-slider-runnable-track {
  height: 0.25rem;
  background: transparent;
}

.year-range-input::-webkit-slider-thumb {
  width: 1rem;
  height: 1rem;
  margin-top: -0.375rem;
  appearance: none;
  border: 2px solid var(--card);
  border-radius: 9999px;
  background: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
  cursor: pointer;
  pointer-events: auto;
}

.year-range-input::-moz-range-track {
  height: 0.25rem;
  background: transparent;
}

.year-range-input::-moz-range-thumb {
  width: 0.75rem;
  height: 0.75rem;
  border: 2px solid var(--card);
  border-radius: 9999px;
  background: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
  cursor: pointer;
  pointer-events: auto;
}

.year-range-input:focus-visible {
  outline: none;
}

.year-range-input:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 2px var(--card), 0 0 0 4px var(--ring);
}

.year-range-input:focus-visible::-moz-range-thumb {
  box-shadow: 0 0 0 2px var(--card), 0 0 0 4px var(--ring);
}

.year-range-input:disabled::-webkit-slider-thumb {
  cursor: not-allowed;
  opacity: 0.5;
}

.year-range-input:disabled::-moz-range-thumb {
  cursor: not-allowed;
  opacity: 0.5;
}
```

- [ ] **Step 2: Type-check the application**

Run:

```bash
npm run typecheck
```

Expected: TypeScript exits successfully. If an existing caller of `filterGames` was missed, add `minYear: null` and `maxYear: null` to that caller rather than making the new fields optional.

- [ ] **Step 3: Build the production application**

Run:

```bash
npm run build
```

Expected: Next.js completes a production build successfully.

- [ ] **Step 4: Review the UI feature diff without staging user changes**

Run:

```bash
git diff -- components/bgg-app.tsx app/globals.css tests/bgg-app.test.ts
```

Confirm both handles use the same visual track, the left sentinel reads `No min`, the right sentinel reads `No max`, and the pre-existing BGG attribution and tag-deduplication edits remain intact.

### Task 4: Full regression verification

**Files:**
- Verify only; no additional file changes expected.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: every Vitest file passes.

- [ ] **Step 2: Re-run static and production checks together**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands exit successfully with no TypeScript or Next.js build errors.

- [ ] **Step 3: Check whitespace and working-tree scope**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` reports no whitespace errors. The status includes the intended year-filter files plus the pre-existing user changes, with no generated build output staged or added.

- [ ] **Step 4: Summarize the uncommitted implementation**

Report the year-filter files changed, the exact verification commands that passed, and that overlapping pre-existing work was preserved. Do not create an implementation commit unless the user explicitly requests one, because the feature touches files that were already dirty before implementation began.
