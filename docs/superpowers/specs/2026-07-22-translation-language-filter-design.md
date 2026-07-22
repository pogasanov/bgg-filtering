# Translation Language Filter Design

## Goal

Add a single optional filter that shows only board games with a BoardGameGeek version translated into the selected language.

## Data source

BoardGameGeek version metadata is the source of truth for translation languages. The existing XML API 2 `thing` request will include `versions=1` alongside `stats=1`. This returns version records within the same batched request, so the sync keeps its current request count and delay behavior while receiving a larger response.

Each version may contain one or more `boardgamelanguage` links. The parser will collect their displayed values across all versions, remove duplicates, and sort them. A game without version-language metadata will have an empty language list; alternate titles will not be used to infer a language.

Reference: <https://boardgamegeek.com/wiki/page/BGG_XML_API2>

## Domain model and persistence

`NormalizedGame` will gain a required `languages: string[]` property. The cache will persist this many-to-many data in a `game_languages` table keyed by game ID and language name. The schema initialization will create the table for both new and existing databases.

Each game upsert will replace that game's stored languages in the same transaction that replaces tags and player recommendations. Reads will group stored rows into each normalized game and return an empty array when an older cached game has no stored language rows.

Deploying the code does not invent language data for an existing cache. The user must run the normal BGG sync once to fetch version metadata and populate the selector.

## Filtering and interface

The filter state will hold one language string. An empty string means no translation-language restriction. A non-empty value requires an exact match in `game.languages`.

The language condition combines with title search, categories/mechanics, and the player recommendation matrix using AND logic. Existing OR behavior within the category/mechanic selection and within the recommendation matrix remains unchanged.

The Filters card will contain a `Translation language` select control. Its first option will be `Any language`; subsequent options will be the sorted unique languages found across the currently cached games. Syncing refreshes both the game data and the available options. If a selected language disappears after a sync, no game will match until the user chooses another option or `Any language`.

## Error handling and compatibility

Missing `versions`, missing version links, and malformed language entries are ignored and produce an empty or partial language list rather than failing the entire game parse. Language labels are preserved exactly as supplied by BoardGameGeek except for string conversion, deduplication, and sorting.

The change does not add API calls, alter batching, change authorization, or perform language inference. Existing caches remain readable because the schema change is additive.

## Testing and verification

Tests will be written before each production change and observed failing for the missing behavior. Coverage will include:

- parsing and deduplicating languages across version records;
- safely handling absent version metadata;
- creating and round-tripping the additive cache table;
- replacing stale language rows during an upsert;
- filtering by one selected language and combining it with existing filters;
- requesting version metadata from the BGG endpoint.

After the focused tests pass, verification will run the complete test suite, TypeScript type-check, and production build.
