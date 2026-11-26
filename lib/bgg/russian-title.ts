const CYRILLIC = /[а-яё]/i;
/**
 * Marks of other Cyrillic languages: Ukrainian and Belarusian letters, Serbian and Macedonian
 * letters, an apostrophe inside a word (Ukrainian), and a hard sign not before е/ё/ю/я (Bulgarian).
 */
const NOT_RUSSIAN = /[іїєґўђјљњћџѓќѕ]|[а-яё]['’ʼ][а-яё]|ъ(?![еёюя])/i;
/** Letters Russian has and Ukrainian and Bulgarian do not. */
const RUSSIAN_ONLY = /[ыэё]/i;

/**
 * The Russian title among a game's BGG alternate names, or `null` when none looks Russian.
 * BGG does not say which language an alternate name is in, so it is guessed from the letters.
 * Names with a letter only Russian has are surely Russian, and the shortest of them is taken
 * (the others tend to be the same title with an edition added). Without one, a name could also
 * be Bulgarian or Ukrainian; the longest is taken, as those are usually the fuller Russian title.
 */
export function russianTitle(alternateNames: string[]): string | null {
  const candidates = alternateNames.map((name) => name.trim()).filter((name) => CYRILLIC.test(name) && !NOT_RUSSIAN.test(name));
  const sure = candidates.filter((name) => RUSSIAN_ONLY.test(name));
  if (sure.length > 0) return sure.reduce((best, name) => (name.length < best.length ? name : best));
  if (candidates.length > 0) return candidates.reduce((best, name) => (name.length > best.length ? name : best));
  return null;
}
