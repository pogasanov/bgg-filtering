import { playerCounts, type ListedGame, type PlayerCount, type RecommendationVerdict } from "./bgg/types";
import { isNotPlayable } from "./filtering";
import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import { messages } from "./i18n/messages";
import { playersLabel, verdictLabel } from "./labels";

export type PollCell = {
  playerCount: PlayerCount;
  verdict: RecommendationVerdict;
  /** False when the count is outside the game's min–max players. Independent of the verdict. */
  inRange: boolean;
  best: number;
  recommended: number;
  notRecommended: number;
};

export function pollCells(game: ListedGame): PollCell[] {
  return playerCounts.map((playerCount) => {
    const poll = game.playerRecommendations[playerCount];
    return {
      playerCount,
      verdict: poll?.verdict ?? "unknown",
      inRange: !isNotPlayable(game, playerCount),
      best: poll?.best ?? 0,
      recommended: poll?.recommended ?? 0,
      notRecommended: poll?.notRecommended ?? 0,
    };
  });
}

export function pollCellLabel(cell: PollCell, locale: Locale = DEFAULT_LOCALE): string {
  const t = messages[locale];
  const players = playersLabel(cell.playerCount, locale);
  const outOfRange = cell.inRange ? "" : ` · ${t.pollOutOfRange}`;
  const total = cell.best + cell.recommended + cell.notRecommended;
  if (cell.verdict === "unknown" || total === 0) return `${players}: ${t.pollNoData}${outOfRange}`;

  const share = (votes: number) => `${votes} (${Math.round((votes / total) * 100)}%)`;
  return (
    `${players}: ${verdictLabel(cell.verdict, locale)} — ${t.pollBest} ${share(cell.best)}, ` +
    `${t.pollRecommended} ${share(cell.recommended)}, ${t.pollNotRecommended} ${share(cell.notRecommended)}${outOfRange}`
  );
}

export function pollStripLabel(game: ListedGame, locale: Locale = DEFAULT_LOCALE): string {
  return pollCells(game)
    .map((cell) => pollCellLabel(cell, locale))
    .join("; ");
}
