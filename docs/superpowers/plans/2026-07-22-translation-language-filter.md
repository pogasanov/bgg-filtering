# Translation Language Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single optional language filter that matches games having a BoardGameGeek version in the selected language.

**Architecture:** Request version metadata in the existing BGG detail batches, normalize version languages onto `NormalizedGame`, and persist them in an additive SQLite child table. Keep filtering client-side by adding one exact-match language predicate and one dropdown populated from cached games.

**Tech Stack:** TypeScript, Next.js, React, fast-xml-parser, better-sqlite3, Vitest

---

## File map

- Modify `lib/bgg/types.ts`: add the normalized `languages` field.
- Modify `lib/bgg/parser.ts`: extract distinct sorted `boardgamelanguage` values from version records.
- Modify `lib/cache/store.ts`: migrate, replace, and read persisted game languages.
- Modify `lib/filtering.ts`: apply the optional exact-match language predicate.
- Modify `lib/bgg/client.ts`: request version metadata in existing detail requests.
- Modify `components/bgg-app.tsx`: maintain language state and render the single dropdown.
- Modify `tests/bgg-parser.test.ts`: cover present and absent version metadata.
- Modify `tests/cache-store.test.ts`: cover language round-tripping and stale-row replacement.
- Modify `tests/filters.test.ts`: cover empty, selected, and combined language filtering.
- Create `tests/bgg-client.test.ts`: cover the `versions=1` request parameter.
- Create `tests/bgg-app.test.ts`: cover the rendered dropdown and sorted unique options.

The target files already contain uncommitted user changes. Implementation commits are intentionally omitted so unrelated edits are not staged or claimed.

### Task 1: Normalize languages from BGG XML

**Files:**
- Modify: `tests/bgg-parser.test.ts`
- Modify: `lib/bgg/types.ts`
- Modify: `lib/bgg/parser.ts`

- [ ] **Step 1: Write failing parser assertions**

Add version metadata to `thingXml`:

```xml
<versions>
  <item type="boardgameversion" id="1001">
    <link type="boardgamelanguage" id="2184" value="English"/>
    <link type="boardgamelanguage" id="2187" value="French"/>
  </item>
  <item type="boardgameversion" id="1002">
    <link type="boardgamelanguage" id="2187" value="French"/>
    <link type="boardgamelanguage" id="2186" value="German"/>
  </item>
</versions>
```

Extend the existing object assertion with:

```ts
languages: ["English", "French", "German"],
```

Add an absent-metadata test:

```ts
test("returns no languages when version metadata is absent", () => {
  const parsed = parseThingXml(`
    <items>
      <item type="boardgame" id="1">
        <name type="primary" value="No Versions"/>
      </item>
    </items>
  `);

  expect(parsed[0].languages).toEqual([]);
});
```

- [ ] **Step 2: Run the parser test and verify RED**

Run: `pnpm vitest run tests/bgg-parser.test.ts`

Expected: FAIL because `languages` is `undefined`.

- [ ] **Step 3: Add the domain field and parser implementation**

Add to `NormalizedGame` after `mechanics`:

```ts
languages: string[];
```

In `parseThingXml`, derive languages before returning the game:

```ts
const versions = asArray(item.versions?.item);
const languages = [
  ...new Set(
    versions.flatMap((version: any) =>
      asArray(version.link)
        .filter((link: any) => link.type === "boardgamelanguage" && link.value !== undefined)
        .map((link: any) => String(link.value)),
    ),
  ),
].sort();
```

Return `languages` with `categories` and `mechanics`.

- [ ] **Step 4: Run the parser test and verify GREEN**

Run: `pnpm vitest run tests/bgg-parser.test.ts`

Expected: both parser tests PASS.

### Task 2: Persist languages in SQLite

**Files:**
- Modify: `tests/cache-store.test.ts`
- Modify: `lib/cache/store.ts`

- [ ] **Step 1: Write failing persistence assertions**

Add to the shared `game` fixture:

```ts
languages: ["English", "French"],
```

In the reopen test, add:

```ts
expect(games[0].languages).toEqual(["English", "French"]);
```

Add a replacement test:

```ts
test("replaces stored languages when a game is updated", () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), "bgg-cache-")), "cache.sqlite");
  const store = createCacheStore(dbPath);

  store.upsertGames([game], "<items />");
  store.upsertGames([{ ...game, languages: ["German"] }], "<items />");
  const games = store.getGames();
  store.close();

  expect(games[0].languages).toEqual(["German"]);
});
```

- [ ] **Step 2: Run the cache tests and verify RED**

Run: `pnpm vitest run tests/cache-store.test.ts`

Expected: FAIL because the returned game has no `languages` field.

- [ ] **Step 3: Add the language table and transactional writes**

Add to `migrate()`:

```sql
CREATE TABLE IF NOT EXISTS game_languages (
  game_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (game_id, name),
  FOREIGN KEY (game_id) REFERENCES games(bgg_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_languages_name ON game_languages(name);
```

Prepare and execute replacement statements inside `upsertGames`:

```ts
const deleteLanguagesStmt = this.db.prepare("DELETE FROM game_languages WHERE game_id = ?");
const languageStmt = this.db.prepare("INSERT OR IGNORE INTO game_languages (game_id, name) VALUES (?, ?)");

deleteLanguagesStmt.run(game.id);
for (const language of game.languages) languageStmt.run(game.id, language);
```

- [ ] **Step 4: Read languages into normalized games**

Exclude `languages` from the `gameRows` cast, query sorted language rows, group them, and add the grouped array to the returned game:

```ts
const languageRows = this.db
  .prepare("SELECT game_id AS gameId, name FROM game_languages ORDER BY name")
  .all() as Array<{ gameId: number; name: string }>;

const languagesByGame = new Map<number, string[]>();
for (const row of languageRows) {
  const languages = languagesByGame.get(row.gameId) ?? [];
  languages.push(row.name);
  languagesByGame.set(row.gameId, languages);
}

languages: languagesByGame.get(game.id) ?? [],
```

- [ ] **Step 5: Run the cache tests and verify GREEN**

Run: `pnpm vitest run tests/cache-store.test.ts`

Expected: all cache tests PASS.

### Task 3: Filter games by one language

**Files:**
- Modify: `tests/filters.test.ts`
- Modify: `lib/filtering.ts`

- [ ] **Step 1: Make fixtures explicit and write failing filter tests**

Add `languages: []` to `makeGame`. Add `language: ""` to every existing `filterGames` call. Add:

```ts
test("filters by one translation language", () => {
  const translatedGames = [
    makeGame({ id: 20, languages: ["English", "French"] }),
    makeGame({ id: 21, languages: ["English", "German"] }),
    makeGame({ id: 22, languages: [] }),
  ];

  const result = filterGames(translatedGames, {
    search: "",
    tags: [],
    matrix: [],
    language: "French",
    sort: "rank",
  });

  expect(result.map((game) => game.id)).toEqual([20]);
});

test("combines translation language with the other filters using AND logic", () => {
  const result = filterGames(
    [
      makeGame({ id: 30, title: "Guild One", mechanics: ["Worker Placement"], languages: ["French"] }),
      makeGame({ id: 31, title: "Guild Two", mechanics: ["Worker Placement"], languages: ["German"] }),
    ],
    {
      search: "guild",
      tags: ["Worker Placement"],
      matrix: [],
      language: "French",
      sort: "rank",
    },
  );

  expect(result.map((game) => game.id)).toEqual([30]);
});
```

- [ ] **Step 2: Run the filter tests and verify RED**

Run: `pnpm vitest run tests/filters.test.ts`

Expected: the selected-language test returns all three games.

- [ ] **Step 3: Add the filter field and exact-match predicate**

Add to `GameFilters`:

```ts
language: string;
```

Add after the search predicate:

```ts
if (filters.language && !game.languages.includes(filters.language)) return false;
```

- [ ] **Step 4: Run the filter tests and verify GREEN**

Run: `pnpm vitest run tests/filters.test.ts`

Expected: all filter tests PASS.

### Task 4: Request BGG version metadata

**Files:**
- Create: `tests/bgg-client.test.ts`
- Modify: `lib/bgg/client.ts`

- [ ] **Step 1: Write a failing request test**

Create:

```ts
import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchGameDetails } from "@/lib/bgg/client";

afterEach(() => vi.unstubAllGlobals());

describe("BGG client", () => {
  test("requests version metadata with game details", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('<items><item type="boardgame" id="1"><name type="primary" value="Test"/></item></items>'),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchGameDetails([1], "test-token");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://boardgamegeek.com/xmlapi2/thing?id=1&stats=1&versions=1",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run the client test and verify RED**

Run: `pnpm vitest run tests/bgg-client.test.ts`

Expected: FAIL because the actual URL lacks `versions=1`.

- [ ] **Step 3: Add the request parameter**

Change the detail URL to:

```ts
`${BGG_BASE}/xmlapi2/thing?id=${batchIds.join(",")}&stats=1&versions=1`
```

- [ ] **Step 4: Run the client test and verify GREEN**

Run: `pnpm vitest run tests/bgg-client.test.ts`

Expected: the client test PASS.

### Task 5: Render the single language dropdown

**Files:**
- Create: `tests/bgg-app.test.ts`
- Modify: `components/bgg-app.tsx`

- [ ] **Step 1: Write a failing render test**

Render `BggApp` with `react-dom/server`, one complete `NormalizedGame` fixture with `languages: ["German", "English", "German"]`, and a valid empty `CacheStatus`. Assert:

```ts
expect(html).toContain("Translation language");
expect(html).toContain('<option value="">Any language</option>');
expect(html.indexOf('value="English"')).toBeLessThan(html.indexOf('value="German"'));
expect(html.match(/value="German"/g)).toHaveLength(1);
```

- [ ] **Step 2: Run the UI test and verify RED**

Run: `pnpm vitest run tests/bgg-app.test.ts`

Expected: FAIL because the label and options are absent.

- [ ] **Step 3: Add dropdown state, options, and filtering input**

Add state and sorted unique options:

```ts
const [language, setLanguage] = useState("");
const allLanguages = useMemo(
  () => [...new Set(games.flatMap((game) => game.languages))].sort(),
  [games],
);
```

Pass `language` to `filterGames` and add it to the memo dependencies. Add after Sort:

```tsx
<label className="block text-sm font-medium">
  Translation language
  <Select className="mt-1 w-full" value={language} onChange={(event) => setLanguage(event.target.value)}>
    <option value="">Any language</option>
    {allLanguages.map((option) => (
      <option key={option} value={option}>
        {option}
      </option>
    ))}
  </Select>
</label>
```

- [ ] **Step 4: Run the UI test and verify GREEN**

Run: `pnpm vitest run tests/bgg-app.test.ts`

Expected: the UI test PASS.

### Task 6: Full verification

**Files:**
- Verify all modified and created files above.

- [ ] **Step 1: Run the complete test suite**

Run: `pnpm test`

Expected: all tests PASS with zero failures.

- [ ] **Step 2: Run TypeScript checking**

Run: `pnpm typecheck`

Expected: exit code 0 with no diagnostics.

- [ ] **Step 3: Run the production build**

Run: `pnpm build`

Expected: Next.js build exits 0.

- [ ] **Step 4: Review only the intended diff**

Run: `git diff --check && git status --short && git diff -- lib/bgg/types.ts lib/bgg/parser.ts lib/cache/store.ts lib/filtering.ts lib/bgg/client.ts components/bgg-app.tsx tests/bgg-parser.test.ts tests/cache-store.test.ts tests/filters.test.ts tests/bgg-client.test.ts tests/bgg-app.test.ts`

Expected: no whitespace errors; the diff contains the approved language-filter behavior while preserving pre-existing edits.
