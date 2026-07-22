# Matrix Filter Semantics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require games to satisfy every selected player-count row while allowing alternative verdicts within the same row.

**Architecture:** Keep matrix matching inside the pure `filterGames` function. Group selections by `playerCount`; each group matches when one selected verdict matches, and a game remains only when every group matches.

**Tech Stack:** TypeScript, Vitest, Next.js

---

### Task 1: Group matrix selections by player count

**Files:**
- Modify: `tests/filters.test.ts`
- Modify: `lib/filtering.ts`

- [ ] **Step 1: Write the failing cross-row regression test**

Add a test with one game bounded to 2–4 players and another bounded to 2–3 players. Select `not-playable` at both 1 and 4 players, and assert that only the game bounded to 2–3 remains.

```ts
test("requires every selected player-count row to match", () => {
  const boundedGames = [
    makeGame({ id: 20, minPlayers: 2, maxPlayers: 4 }),
    makeGame({ id: 21, minPlayers: 2, maxPlayers: 3 }),
  ];

  const result = filterGames(boundedGames, {
    search: "",
    tags: [],
    matrix: [
      { playerCount: "1", verdict: "not-playable" },
      { playerCount: "4", verdict: "not-playable" },
    ],
    sort: "rank",
  });

  expect(result.map((game) => game.id)).toEqual([21]);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test tests/filters.test.ts`

Expected: FAIL because the current flat OR predicate returns games 20 and 21.

- [ ] **Step 3: Add same-row OR coverage**

Replace the old flat-OR test with a test where `best` and `recommended` are selected for the same player count and both matching games remain.

- [ ] **Step 4: Implement grouped matching**

Build a map from player count to its selected verdicts before filtering. For each game, require every player-count group to have at least one verdict that matches either the derived player bounds or the stored recommendation verdict.

- [ ] **Step 5: Run focused verification**

Run: `pnpm test tests/filters.test.ts`

Expected: all filter tests pass.

- [ ] **Step 6: Run complete verification**

Run: `pnpm test && pnpm typecheck && pnpm build`

Expected: all tests pass, TypeScript exits successfully, and the production build completes.
