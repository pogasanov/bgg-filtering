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

  const compact = text
    .replace(/[\s   ]+/g, "")
    .replace(/(руб\.?|р\.|₽)$/i, "");
  const match = /^(\d+)(?:[.,]0+)?$/.exec(compact);
  if (!match) return null;

  const value = Number(match[1]);
  return value > 0 ? value : null;
}
