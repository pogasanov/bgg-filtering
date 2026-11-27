import { playerCounts, type ListedGame, type PlayerCount, type RecommendationVerdict } from "./bgg/types";
import { isNotPlayable } from "./filtering";
import { DEFAULT_LOCALE, type Locale } from "./i18n/locale";
import { messages } from "./i18n/messages";
import { playerCountText, playersLabel, verdictLabel } from "./labels";

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

const summaryVerdicts = ["best", "recommended", "not-recommended"] as const;

/**
 * The poll in one short sentence of page text: the strip itself is colour and shape, which neither
 * screen readers nor search engines read. Only the counts the game supports are named.
 */
export function pollSummary(cells: PollCell[], locale: Locale = DEFAULT_LOCALE): string {
  const t = messages[locale];
  const parts = summaryVerdicts.flatMap((verdict) => {
    const counts = cells.filter((cell) => cell.inRange && cell.verdict === verdict).map((cell) => playerCountText(cell.playerCount));
    return counts.length > 0 ? [t.pollSummaryPart(verdictLabel(verdict, locale), counts.join(", "))] : [];
  });
  return t.pollSummary(parts.length > 0 ? parts.join("; ") : t.pollNoData);
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
