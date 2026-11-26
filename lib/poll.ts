import { playerCounts, type NormalizedGame, type PlayerCount, type RecommendationVerdict } from "./bgg/types";
import { isNotPlayable } from "./filtering";
import { playersLabel, verdictLabels } from "./labels";

export type PollCell = {
  playerCount: PlayerCount;
  verdict: RecommendationVerdict;
  /** False when the count is outside the game's min–max players. Independent of the verdict. */
  inRange: boolean;
  best: number;
  recommended: number;
  notRecommended: number;
};

export function pollCells(game: NormalizedGame): PollCell[] {
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

export function pollCellLabel(cell: PollCell): string {
  const players = playersLabel(cell.playerCount);
  const outOfRange = cell.inRange ? "" : " · вне диапазона игроков";
  const total = cell.best + cell.recommended + cell.notRecommended;
  if (cell.verdict === "unknown" || total === 0) return `${players}: нет данных${cell.inRange ? "" : outOfRange}`;

  const share = (votes: number) => `${votes} (${Math.round((votes / total) * 100)}%)`;
  return (
    `${players}: ${verdictLabels[cell.verdict]} — лучше ${share(cell.best)}, ` +
    `реком. ${share(cell.recommended)}, не рек. ${share(cell.notRecommended)}${outOfRange}`
  );
}

export function pollStripLabel(game: NormalizedGame): string {
  return pollCells(game).map(pollCellLabel).join("; ");
}
