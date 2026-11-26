/** Lowercases, folds ё to е, and turns everything that is not a letter or digit into single spaces. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Reads a price in whole rubles. Anything that is not a positive whole number
 * ("от 990", kopecks, zero, empty) is `null`: a missing price is better than a wrong one.
 */
export function parseRubles(text: string | number | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  if (typeof text === "number") return Number.isInteger(text) && text > 0 ? text : null;

  // One number only: plain digits or thousands grouped by spaces, optionally with
  // zero kopecks and a currency mark. "1.000" and "3 990 2 990" are refused,
  // because reading them as 1 or 39902990 would be a wrong price.
  const cleaned = text.replace(/[\s   ]+/g, " ").trim();
  const match = /^(\d{1,3}(?: \d{3})+|\d+)(?:[.,]0{1,2})?(?: ?(?:руб\.?|р\.|₽))?$/i.exec(cleaned);
  if (!match) return null;

  const value = Number(match[1].replace(/ /g, ""));
  return value > 0 ? value : null;
}
