# Anonymous Geekdo Sync Design

## Goal

Remove the `BGG_TOKEN` requirement while preserving the current 500-game sync and the information used by the player-count finder.

## Upstream data flow

The sync first requests the ranked browse pages at `https://boardgamegeek.com/browse/boardgame/page/{page}`. Each page contains 100 ranked games. The existing browse parser extracts the game ID and ranking summary, and the sync stops after collecting the requested limit of 500 unique games.

For every discovered game ID, the sync then requests these anonymous JSON endpoints in sequence:

- `https://api.geekdo.com/api/geekitems?objecttype=thing&objectid={id}` for title, year, description, player limits, playtime, categories, mechanics, and the canonical BGG URL.
- `https://api.geekdo.com/api/dynamicinfo?objecttype=thing&objectid={id}` for overall rank, Geek Rating, average rating, voter count, average weight, and summarized player-count recommendations.

All upstream requests pass through one throttled request helper. Requests start no less than 5.2 seconds apart, including transitions between browse pages and JSON endpoints. A complete initial 500-game sync therefore takes roughly 87 minutes.

## Normalization

The two JSON payloads are merged into the existing `NormalizedGame` shape. Ranking values from `dynamicinfo` take precedence, with the browse-page values used as fallbacks.

Geekdo's `userplayers.best` and `userplayers.recommended` ranges are expanded across the app's supported player counts. Counts inside a best range receive the `best` verdict. Remaining counts inside a recommended range receive `recommended`. Counts within the game's supported minimum and maximum player range but outside both summaries receive `not-recommended`. Counts beyond the published maximum, including `6+`, also receive `not-recommended`. The JSON response does not expose the underlying vote totals, so the three numeric vote fields remain zero.

Categories and mechanics come from `item.links.boardgamecategory` and `item.links.boardgamemechanic`. Playing time uses `maxplaytime`, falling back to `minplaytime`. The canonical link is preferred for `bggUrl`, with the standard board-game URL as a fallback.

## Caching and partial failure behavior

SQLite remains the source of truth. Raw browse HTML is stored as the rank snapshot. Each game's cached raw payload stores both JSON responses together so the source data remains inspectable.

If an individual game cannot be fetched after retries, the sync records the failure and continues with the next game. Successfully normalized games are written to the cache. The sync finishes with an error only when ranking discovery fails or no games can be normalized; otherwise it reports success with the number actually refreshed.

Transient `429`, `500`, `502`, `503`, and `504` responses are retried up to three times. The client honors `Retry-After` when supplied and otherwise uses increasing delays while still respecting the global 5.2-second request spacing. Other non-success responses fail that game immediately.

## User interface and configuration

`BGG_TOKEN` is removed from the environment example, setup instructions, empty-cache message, and sync validation. The existing Sync BGG control and filtering interface remain unchanged. Status reporting continues to show the number of games successfully cached.

## Testing

Parser tests cover representative `geekitems` and `dynamicinfo` payloads, missing optional fields, rank fallback behavior, and expansion of best/recommended player ranges. Client tests use injected fetch and timing dependencies to prove request URLs, global sequencing, retry behavior, and continuation after an individual-game failure without making live network requests.

Existing parser, cache, filtering, type-check, and production-build checks must continue to pass.

## Compatibility and risk

The Geekdo JSON endpoints are internal and may change without notice. Their parsing is isolated from transport and sync orchestration so payload changes can be repaired without changing the cache or UI. The ranked HTML parser remains isolated and is used only for discovering the current ranked IDs.
