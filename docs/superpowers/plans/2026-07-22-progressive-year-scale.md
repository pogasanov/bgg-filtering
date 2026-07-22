# Progressive Year Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the year-range slider allocate one step per distinct publication year so isolated ancient games cannot compress modern years into an unusable portion of the track.

**Architecture:** Add a pure `lib/year-scale.ts` module that builds the sorted distinct year domain and maps between ordinal slider positions and real publication years. Keep `minYear` and `maxYear` as actual years in `BggApp`, translating only at the slider boundary so the filtering contract remains unchanged.

**Tech Stack:** TypeScript, React, Radix Slider, Vitest

---

### Task 1: Pure ordinal year scale

**Files:**
- Create: `lib/year-scale.ts`
- Create: `tests/year-scale.test.ts`

- [ ] **Step 1: Write the failing scale tests**

Create `tests/year-scale.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { buildYearScale, closestYear, positionForYear, yearAtPosition } from "@/lib/year-scale";

describe("year scale", () => {
  const scale = [-2200, 1995, 2020, 2025];

  test("sorts and deduplicates known years", () => {
    expect(buildYearScale([2025, null, -2200, 2020, 2025, 1995])).toEqual(scale);
  });

  test("maps ordinal positions to represented years", () => {
    expect(yearAtPosition(scale, 0)).toBeNull();
    expect(yearAtPosition(scale, 1)).toBe(-2200);
    expect(yearAtPosition(scale, 3)).toBe(2020);
    expect(yearAtPosition(scale, scale.length + 1)).toBeNull();
  });

  test("maps years to one-based ordinal positions", () => {
    expect(positionForYear(scale, -2200)).toBe(1);
    expect(positionForYear(scale, 2020)).toBe(3);
    expect(positionForYear([], 2020)).toBeNull();
  });

  test("reconciles missing years to the closest represented year", () => {
    expect(closestYear(scale, 2019)).toBe(2020);
    expect(closestYear([2000, 2020], 2010)).toBe(2000);
    expect(closestYear([], 2020)).toBeNull();
    expect(positionForYear(scale, 2019)).toBe(3);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run:

```bash
pnpm exec vitest run tests/year-scale.test.ts
```

Expected: FAIL because `@/lib/year-scale` does not exist.

- [ ] **Step 3: Implement the pure scale helpers**

Create `lib/year-scale.ts`:

```ts
export function buildYearScale(years: readonly (number | null)[]): number[] {
  return [...new Set(years.filter((year): year is number => year !== null))].sort(
    (left, right) => left - right,
  );
}

export function closestYear(years: readonly number[], target: number): number | null {
  if (years.length === 0) return null;

  return years.reduce((closest, candidate) =>
    Math.abs(candidate - target) < Math.abs(closest - target) ? candidate : closest,
  );
}

export function positionForYear(years: readonly number[], year: number): number | null {
  const resolvedYear = closestYear(years, year);
  return resolvedYear === null ? null : years.indexOf(resolvedYear) + 1;
}

export function yearAtPosition(years: readonly number[], position: number): number | null {
  return years[position - 1] ?? null;
}
```

- [ ] **Step 4: Run the focused test and confirm it passes**

Run:

```bash
pnpm exec vitest run tests/year-scale.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit the scale unit**

```bash
git add lib/year-scale.ts tests/year-scale.test.ts
git commit -m "feat: add ordinal year scale"
```

### Task 2: Integrate ordinal positions with the range slider

**Files:**
- Modify: `tests/bgg-app.test.ts:49-65`
- Modify: `components/bgg-app.tsx:25-122`

- [ ] **Step 1: Update the component test to require an ordinal domain**

In the existing `renders the open year domain as a two-thumb slider` test, replace the numeric-domain expectations with:

```ts
expect(html).toContain('aria-valuemin="0"');
expect(html).toContain('aria-valuemax="3"');
expect(html).not.toContain('aria-valuemin="1994"');
```

Add this test next to it:

```ts
test("gives an extreme year outlier only one ordinal step", () => {
  const html = renderToStaticMarkup(
    createElement(BggApp, {
      initialGames: [
        makeGame(1, -2200),
        makeGame(2, 2020),
        makeGame(3, 2021),
        makeGame(4, 2022),
      ],
      initialStatus: { ...status, gameCount: 4 },
    }),
  );

  expect(html).toContain('aria-valuemin="0"');
  expect(html).toContain('aria-valuemax="5"');
  expect(html).not.toContain('aria-valuemin="-2201"');
});
```

- [ ] **Step 2: Run the component test and confirm the linear-domain failure**

Run:

```bash
pnpm exec vitest run tests/bgg-app.test.ts
```

Expected: FAIL because the rendered minimum is still the oldest year minus one and the maximum is still the newest year plus one.

- [ ] **Step 3: Replace raw-year slider values with ordinal positions**

Add this import to `components/bgg-app.tsx`:

```ts
import { buildYearScale, closestYear, positionForYear, yearAtPosition } from "@/lib/year-scale";
```

Replace `yearLimits` with:

```ts
const yearScale = useMemo(
  () => buildYearScale(games.map((game) => game.year)),
  [games],
);
```

Replace the year reconciliation effect and slider-derived values with:

```ts
useEffect(() => {
  setMinYear((current) => (current === null ? null : closestYear(yearScale, current)));
  setMaxYear((current) => (current === null ? null : closestYear(yearScale, current)));
}, [yearScale]);

const sliderMin = 0;
const sliderMax = yearScale.length + 1;
const minSliderValue =
  minYear === null ? sliderMin : (positionForYear(yearScale, minYear) ?? sliderMin);
const maxSliderValue =
  maxYear === null ? sliderMax : (positionForYear(yearScale, maxYear) ?? sliderMax);
```

Replace `updateYearRange` with:

```ts
function updateYearRange([minimum, maximum]: number[]) {
  setMinYear(minimum === sliderMin ? null : yearAtPosition(yearScale, minimum));
  setMaxYear(maximum === sliderMax ? null : yearAtPosition(yearScale, maximum));
}
```

Change both year fieldset and Slider disabled expressions from `!yearLimits` to:

```tsx
yearScale.length === 0
```

Keep `minYear` and `maxYear` passed to `filterGames` unchanged.

- [ ] **Step 4: Run focused tests and confirm they pass**

Run:

```bash
pnpm exec vitest run tests/year-scale.test.ts tests/bgg-app.test.ts tests/filters.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 5: Run complete verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

Expected: the full test suite, TypeScript check, and production build pass; Git reports no whitespace errors.

- [ ] **Step 6: Commit the integration**

```bash
git add components/bgg-app.tsx tests/bgg-app.test.ts
git commit -m "feat: use progressive year slider scale"
```
