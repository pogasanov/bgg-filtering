import { playerCounts, type ListedGame, type PlayerCount, type RecommendationVerdict } from "./bgg/types";
import { isNotPlayable } from "./filtering";
import { playerCountText, playersLabel, verdictLabels } from "./labels";

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

export function pollStripLabel(game: ListedGame): string {
  return pollCells(game).map(pollCellLabel).join("; ");
}

const summaryGroups: [RecommendationVerdict, string][] = [
  ["best", "лучше всего"],
  ["recommended", "рекомендуют"],
  ["not-recommended", "не рекомендуют"],
];

/**
 * The poll in one short sentence of page text: the strip itself is colour and shape, which neither
 * screen readers nor search engines read. Only the counts the game supports are named.
 */
export function pollSummary(cells: PollCell[]): string {
  const parts = summaryGroups.flatMap(([verdict, label]) => {
    const counts = cells.filter((cell) => cell.inRange && cell.verdict === verdict).map((cell) => playerCountText(cell.playerCount));
    return counts.length > 0 ? [`${label} на ${counts.join(", ")}`] : [];
  });
  return parts.length > 0 ? `Опрос: ${parts.join("; ")}` : "Опрос: нет данных";
}

const verdictCodes: Record<RecommendationVerdict, string> = { best: "b", recommended: "r", "not-recommended": "n", unknown: "u" };

/**
 * The cells as a short string for the browser ("r0.0.6.4 b1.10.4.0 …"): the strip is a client
 * component, and its props travel in the page once per row and layout.
 */
export function encodePollCells(cells: PollCell[]): string {
  return cells
    .map((cell) => `${verdictCodes[cell.verdict]}${cell.inRange ? 1 : 0}.${cell.best}.${cell.recommended}.${cell.notRecommended}`)
    .join(" ");
}

export function decodePollCells(code: string): PollCell[] {
  const verdictByCode = Object.fromEntries(Object.entries(verdictCodes).map(([verdict, short]) => [short, verdict]));
  return code.split(" ").map((part, index) => {
    const [head, best, recommended, notRecommended] = part.split(".");
    return {
      playerCount: playerCounts[index],
      verdict: (verdictByCode[head[0]] ?? "unknown") as RecommendationVerdict,
      inRange: head[1] === "1",
      best: Number(best),
      recommended: Number(recommended),
      notRecommended: Number(notRecommended),
    };
  });
}
