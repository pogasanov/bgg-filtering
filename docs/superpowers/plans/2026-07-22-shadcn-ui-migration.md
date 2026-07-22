# Shadcn UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every hand-written or native control in the BGG finder with current official shadcn/ui components and the default neutral theme without changing application behavior.

**Architecture:** Keep all BGG state and filtering orchestration in `BggApp`, while replacing its presentation primitives with generated local shadcn components. Install the new, non-conflicting primitives first; then overwrite the existing simplified primitives and migrate their call sites atomically so intermediate commits stay usable.

**Tech Stack:** Next.js, React 19, TypeScript, Tailwind CSS v4, shadcn/ui `new-york`, Radix primitives, Vitest.

---

## File Map

- `components.json`: declare the Tailwind v4, neutral, `new-york`, Lucide shadcn registry configuration.
- `app/globals.css`: own the standard shadcn theme tokens and base styles; remove the bespoke palette and native range styling.
- `components/ui/*.tsx`: generated shadcn primitives only, with no BGG-specific behavior.
- `components/bgg-app.tsx`: compose shadcn controls and adapt their event APIs to existing React state.
- `tests/shadcn-ui.test.ts`: verify the checked-in component foundation and theme configuration.
- `tests/bgg-app.test.ts`: verify the page renders the migrated accessible control structure while retaining open-year and empty-cache semantics.
- `package.json` and `package-lock.json`: record dependencies installed by the current shadcn CLI. Keep the unrelated untracked pnpm files untouched.

### Task 1: Install the shadcn foundation and non-conflicting primitives

**Files:**
- Create: `tests/shadcn-ui.test.ts`
- Create: `components/ui/alert.tsx`
- Create: `components/ui/checkbox.tsx`
- Create: `components/ui/label.tsx`
- Create: `components/ui/scroll-area.tsx`
- Create: `components/ui/separator.tsx`
- Create: `components/ui/slider.tsx`
- Create: `components/ui/table.tsx`
- Modify: `components.json`
- Modify: `app/globals.css`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Write the failing foundation test**

Create `tests/shadcn-ui.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const root = new URL("../", import.meta.url);

function read(relativePath: string) {
  const url = new URL(relativePath, root);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

describe("shadcn foundation", () => {
  test("checks in the generated supporting primitives", () => {
    const names = ["alert", "checkbox", "label", "scroll-area", "separator", "slider", "table"];

    for (const name of names) {
      expect(read(`components/ui/${name}.tsx`), `${name} should be generated`).toContain("data-slot=");
    }
  });

  test("uses the Tailwind v4 neutral shadcn theme", () => {
    const css = read("app/globals.css");
    const config = JSON.parse(read("components.json")) as {
      style: string;
      tailwind: { baseColor: string; config?: string };
      iconLibrary?: string;
    };

    expect(css).toContain('@import "tw-animate-css"');
    expect(css).toContain('@import "shadcn/tailwind.css"');
    expect(css).toContain("@theme inline");
    expect(css).toContain("--color-background: var(--background)");
    expect(css).not.toContain(".year-range-input");
    expect(config).toMatchObject({
      style: "new-york",
      tailwind: { baseColor: "neutral", config: "" },
      iconLibrary: "lucide",
    });
  });
});
```

- [ ] **Step 2: Run the foundation test and verify RED**

Run:

```bash
npm test -- tests/shadcn-ui.test.ts
```

Expected: FAIL because the supporting primitive files do not exist and `globals.css` still contains `.year-range-input`.

- [ ] **Step 3: Update the shadcn registry configuration**

Replace `components.json` with:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 4: Generate the supporting components and dependencies**

Run:

```bash
npx shadcn@latest add alert checkbox label scroll-area separator slider table --overwrite --yes
```

Expected: the seven `components/ui` files are created and the current registry dependencies are added to `package.json` and `package-lock.json`.

- [ ] **Step 5: Replace the bespoke global theme with the default neutral Tailwind v4 theme**

Replace app/globals.css with the complete light-theme stylesheet below:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

Do not retain the old radial background, custom teal/red variables, Arial override, or .year-range-input rules.

- [ ] **Step 6: Run the foundation test and verify GREEN**

Run:

```bash
npm test -- tests/shadcn-ui.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 7: Commit only the foundation files**

```bash
git add components.json app/globals.css components/ui/alert.tsx components/ui/checkbox.tsx components/ui/label.tsx components/ui/scroll-area.tsx components/ui/separator.tsx components/ui/slider.tsx components/ui/table.tsx tests/shadcn-ui.test.ts package.json package-lock.json
git commit -m "chore: install shadcn ui foundation"
```

### Task 2: Migrate `BggApp` to official shadcn controls

**Files:**
- Modify: `tests/bgg-app.test.ts`
- Modify: `components/bgg-app.tsx`
- Modify: `components/ui/badge.tsx`
- Modify: `components/ui/button.tsx`
- Modify: `components/ui/card.tsx`
- Modify: `components/ui/input.tsx`
- Modify: `components/ui/select.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Replace native-control assertions with failing shadcn composition assertions**

Remove `rangeInput`, keep the existing fixtures, and replace the three UI tests with:

```ts
function slotCount(html: string, slot: string) {
  return html.match(new RegExp(`data-slot="${slot}"`, "g"))?.length ?? 0;
}

describe("shadcn control composition", () => {
  test("renders the open year domain as a two-thumb slider", () => {
    const html = renderToStaticMarkup(
      createElement(BggApp, {
        initialGames: [makeGame(1, 1995), makeGame(2, 2020), makeGame(3, null)],
        initialStatus: status,
      }),
    );

    expect(slotCount(html, "slider")).toBe(1);
    expect(slotCount(html, "slider-thumb")).toBe(2);
    expect(html).toContain('aria-valuemin="1994"');
    expect(html).toContain('aria-valuemax="2021"');
    expect(html).toContain(">No min<");
    expect(html).toContain(">No max<");
    expect(html).not.toContain('class="year-range-input"');
  });

  test("disables the year slider when no known years exist", () => {
    const html = renderToStaticMarkup(
      createElement(BggApp, {
        initialGames: [makeGame(1, null)],
        initialStatus: { ...status, gameCount: 1 },
      }),
    );

    expect(slotCount(html, "slider")).toBe(1);
    expect(html).toContain('data-disabled=""');
  });

  test("renders shadcn form, matrix, and scrolling controls", () => {
    const game = { ...makeGame(1, 2024, ["German", "English", "German"]), categories: ["Strategy"] };
    const html = renderToStaticMarkup(
      createElement(BggApp, { initialGames: [game], initialStatus: { ...status, gameCount: 1 } }),
    );

    expect(html).toContain("Translation language");
    expect(html).toContain("Any language");
    expect(slotCount(html, "select-trigger")).toBe(2);
    expect(slotCount(html, "checkbox")).toBe(1);
    expect(slotCount(html, "scroll-area")).toBe(1);
    expect(slotCount(html, "table")).toBe(1);
    expect(html).not.toContain("<select");
    expect(html).not.toContain('type="checkbox"');
  });

  test("renders empty-cache guidance as an alert", () => {
    const html = renderToStaticMarkup(
      createElement(BggApp, { initialGames: [], initialStatus: { ...status, gameCount: 0 } }),
    );

    expect(slotCount(html, "alert")).toBe(1);
    expect(html).toContain("SQLite cache is empty");
  });
});
```

- [ ] **Step 2: Run the focused UI tests and verify RED**

Run:

```bash
npm test -- tests/bgg-app.test.ts
```

Expected: FAIL because the current page renders native selects, checkboxes, range inputs, and a native table rather than the shadcn slot structure.

- [ ] **Step 3: Overwrite the five simplified primitives with official shadcn output**

Run:

```bash
npx shadcn@latest add badge button card input select --overwrite --yes
```

Expected: the five existing files are replaced with current generated `new-york` implementations and any missing registry dependencies are recorded.

- [ ] **Step 4: Replace the `BggApp` UI imports**

Use this import set in `components/bgg-app.tsx`:

```tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
```

- [ ] **Step 5: Adapt sort and language selects without changing state semantics**

Use labeled shadcn selects. The language sentinel must never use an empty `SelectItem` value:

```tsx
<div className="grid gap-2">
  <Label htmlFor="sort">Sort</Label>
  <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
    <SelectTrigger id="sort" className="w-full">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="rank">BGG rank</SelectItem>
      <SelectItem value="geekRating">Geek Rating</SelectItem>
      <SelectItem value="averageRating">Average rating</SelectItem>
      <SelectItem value="year">Year</SelectItem>
    </SelectContent>
  </Select>
</div>

<div className="grid gap-2">
  <Label htmlFor="language">Translation language</Label>
  <Select value={language || "all"} onValueChange={(value) => setLanguage(value === "all" ? "" : value)}>
    <SelectTrigger id="language" className="w-full">
      <SelectValue placeholder="Any language" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Any language</SelectItem>
      {allLanguages.map((option) => (
        <SelectItem key={option} value={option}>{option}</SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

Keep the search state unchanged, but replace the wrapping native label with `Label htmlFor="game-search"` and set `id="game-search"` on `Input`.

- [ ] **Step 6: Replace the native range inputs with one two-thumb slider**

Replace `updateMinYear` and `updateMaxYear` with:

```ts
function updateYearRange([minimum, maximum]: number[]) {
  setMinYear(minimum === sliderMin ? null : minimum);
  setMaxYear(maximum === sliderMax ? null : maximum);
}
```

Replace both native range inputs with:

```tsx
<fieldset disabled={!yearLimits} className="grid gap-3">
  <legend className="sr-only">Year</legend>
  <div className="flex items-center justify-between gap-3">
    <span>Year</span>
    <output className="text-xs text-muted-foreground">{yearRangeLabel}</output>
  </div>
  <Slider
    aria-label="Publication year range"
    min={sliderMin}
    max={sliderMax}
    step={1}
    minStepsBetweenThumbs={1}
    value={[minSliderValue, maxSliderValue]}
    onValueChange={updateYearRange}
    disabled={!yearLimits}
  />
  <div className="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
    <span>No min</span>
    <span>No max</span>
  </div>
</fieldset>
```

- [ ] **Step 7: Replace tags, the matrix, and messages with shadcn compositions**

For each tag, use the controlled shadcn checkbox inside its label:

```tsx
<ScrollArea className="h-64 rounded-md border">
  <div className="space-y-1 p-2">
    {allTags.map((tag) => (
      <Label key={tag} className="flex items-center gap-2 rounded-md px-2 py-1.5 font-normal hover:bg-muted">
        <Checkbox checked={selectedTags.includes(tag)} onCheckedChange={() => toggleTag(tag)} />
        <span>{tag}</span>
      </Label>
    ))}
  </div>
</ScrollArea>
```

Replace native `table`, `thead`, `tbody`, `tr`, `th`, and `td` with `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, and `TableCell`. Preserve the same player rows, verdict columns, toggle handlers, button text, and selected variants.

Render the empty cache state as:

```tsx
<Alert>
  <AlertTitle>SQLite cache is empty</AlertTitle>
  <AlertDescription>
    Add BGG_TOKEN to .env.local and place boardgames_ranks.csv in the project root, then use Sync BGG.
  </AlertDescription>
</Alert>
```

Render `syncError` as:

```tsx
<Alert variant="destructive">
  <AlertTitle>Sync failed</AlertTitle>
  <AlertDescription>{syncError}</AlertDescription>
</Alert>
```

Use `Separator` between header/content and content/footer instead of border-only separators. Convert arbitrary token utilities such as `text-[var(--muted-foreground)]`, `bg-[var(--muted)]`, and `text-[var(--destructive)]` to `text-muted-foreground`, `bg-muted`, and `text-destructive`. Use `variant="outline"` for game metadata tags instead of overriding badge backgrounds.

- [ ] **Step 8: Run the focused UI tests and verify GREEN**

Run:

```bash
npm test -- tests/bgg-app.test.ts tests/shadcn-ui.test.ts
```

Expected: PASS, 6 tests across the two files.

- [ ] **Step 9: Run typechecking before committing**

Run:

```bash
npm run typecheck
```

Expected: exit 0 with no TypeScript errors.

- [ ] **Step 10: Commit only the migrated UI files**

```bash
git add components/bgg-app.tsx components/ui/badge.tsx components/ui/button.tsx components/ui/card.tsx components/ui/input.tsx components/ui/select.tsx tests/bgg-app.test.ts package.json package-lock.json
git commit -m "feat: migrate interface to shadcn ui"
```

### Task 3: Verify the complete migration

**Files:**
- Modify only if verification identifies a migration-specific defect.

- [ ] **Step 1: Run the full unit suite**

```bash
npm test
```

Expected: all test files pass with zero failures.

- [ ] **Step 2: Run TypeScript validation**

```bash
npm run typecheck
```

Expected: exit 0 with no diagnostics.

- [ ] **Step 3: Run the production build**

```bash
npm run build
```

Expected: Next.js completes the production build with exit 0.

- [ ] **Step 4: Review scope and working-tree preservation**

```bash
git status --short
git diff --check HEAD~2..HEAD
git diff --stat HEAD~2..HEAD
```

Expected: the migration commits contain only the files listed above; the unrelated pre-existing modified and untracked files remain present and unstaged.

- [ ] **Step 5: Record any verification-only fix**

If Task 3 identifies a BggApp composition defect, first add a failing regression assertion to tests/bgg-app.test.ts, then implement the minimum correction in components/bgg-app.tsx, rerun all three verification commands, and commit only those files:

```bash
git add tests/bgg-app.test.ts components/bgg-app.tsx
git commit -m "fix: correct shadcn migration regression"
```

If no correction was required, do not create an empty commit.

