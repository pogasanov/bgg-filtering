const letters: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k",
  л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/**
 * A URL segment from a name in Russian or Latin letters: transliterated, lower case, words joined
 * by hyphens ("Дюна: Империя" → "dyuna-imperiya"). Letters of other scripts are dropped.
 */
export function slugify(text: string): string {
  return [...text.toLowerCase().normalize("NFKD").replace(/[̀-̂̄-ͯ]/g, "")]
    .map((char) => letters[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
