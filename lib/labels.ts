import type { MatrixSelection, MatrixVerdict, PlayerCount, SortKey } from "./bgg/types";

export const verdictLabels: Record<MatrixVerdict, string> = {
  best: "лучше всего",
  recommended: "рекомендуют",
  "not-recommended": "не рекомендуют",
  "not-playable": "нельзя играть",
};

export const verdictShortLabels: Record<MatrixVerdict, string> = {
  best: "Лучше",
  recommended: "Реком.",
  "not-recommended": "Не рек.",
  "not-playable": "Нельзя",
};

export const sortLabels: Record<SortKey, string> = {
  rank: "Ранг",
  year: "Год",
  playingTime: "Время",
  weight: "Сложность",
  geekRating: "Geek",
  averageRating: "Средний",
  numVoters: "Голосов",
  price: "Цена",
};

export function playersLabel(count: PlayerCount): string {
  if (count === "1") return "1 игрок";
  if (count === "2" || count === "3" || count === "4") return `${count} игрока`;
  return `${count} игроков`;
}

export function matrixCellLabel(selection: MatrixSelection): string {
  return `${playersLabel(selection.playerCount)}: ${verdictLabels[selection.verdict]}`;
}

const updatedDateFormat = new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC" });

/** The UTC calendar day, so the server render and the visitor's browser show the same text. */
export function formatUpdatedDate(iso: string | null): string {
  return iso ? `Обновлено ${updatedDateFormat.format(new Date(iso))}` : "Ещё не обновлялось";
}

/** Fixed fraction digits so numbers in a column line up; "—" for missing values. */
export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
