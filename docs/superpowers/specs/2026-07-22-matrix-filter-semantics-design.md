# Matrix Filter Semantics

## Goal

Make multiple player-count selections behave as simultaneous requirements. A game must satisfy every selected player-count row, while multiple selected verdicts within one row are alternatives.

## Behavior

- Group selected matrix cells by player count.
- Match selections within one player-count row using OR.
- Match the resulting player-count groups using AND.
- Evaluate `not-playable` from the game's known `minPlayers` and `maxPlayers` limits.
- Keep search and tag filters combined with the matrix using AND.

For example, selecting `not-playable` for 1 player and 4 players returns only games that cannot be played at either count. A game that cannot be played solo but supports four players does not match.

## Implementation

Update the pure `filterGames` matrix predicate to group selections by `playerCount`, then require every group to have at least one matching verdict. No UI or database changes are needed.

## Testing

Add regression coverage for a game that is unplayable at one selected count but playable at another. Preserve coverage showing that two verdicts selected in the same row are alternatives.
