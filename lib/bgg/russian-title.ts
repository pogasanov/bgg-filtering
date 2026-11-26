import { normalizeTitle } from "@/lib/prices/text";

const CYRILLIC = /[а-яё]/i;
/**
 * Marks of other Cyrillic languages: Ukrainian and Belarusian letters, Serbian and Macedonian
 * letters, an apostrophe inside a word (Ukrainian), a hard sign not before е/ё/ю/я (Bulgarian),
 * and Ukrainian endings and words that Russian spells differently ("-ння", "та", "з").
 */
const NOT_RUSSIAN = /[іїєґўђјљњћџѓќѕ]|[а-яё]['’ʼ][а-яё]|ъ(?![еёюя])|ння(?![а-яё])|(?<![а-яё])(?:та|з)(?![а-яё])/i;
/**
 * Marks of Russian that Ukrainian and Bulgarian lack: the letters ы, э, ё, and the adjective
 * endings -ый, -ой, -ая, -ое, -ые (Ukrainian writes -ий, -а, -е, -і).
 */
const RUSSIAN_ONLY = /[ыэё]|(?:ый|ой|ая|ое|ые)(?![а-яё])/i;

/**
 * The alternate names that may be Russian: Cyrillic, with no mark of another language,
 * de-duplicated. BGG does not say which language an alternate name is in.
 */
export function russianCandidates(alternateNames: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of alternateNames) {
    const name = raw.trim();
    const key = normalizeTitle(name);
    if (!CYRILLIC.test(name) || NOT_RUSSIAN.test(name) || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

/** Normalised titles, sorted, so the ones starting with a name can be found by binary search. */
export type ShopTitleIndex = string[];

export function buildShopTitleIndex(titles: string[]): ShopTitleIndex {
  return titles.map(normalizeTitle).filter((title) => title !== "").sort();
}

/** True when a shop sells something whose title starts with the name, as a whole word. */
function soldUnder(index: ShopTitleIndex, name: string): boolean {
  const key = normalizeTitle(name);
  if (key === "") return false;
  let low = 0;
  let high = index.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (index[mid] < key) low = mid + 1;
    else high = mid;
  }
  for (let i = low; i < index.length && index[i].startsWith(key); i++) {
    if (index[i].length === key.length || index[i][key.length] === " ") return true;
  }
  return false;
}

function shortest(names: string[]): string {
  return names.reduce((best, name) => (name.length < best.length ? name : best));
}

/** The shortest candidate the chosen name starts with, whole words: "Azul: Летний дворец" over "… Mini". */
function trimmed(chosen: string, candidates: string[]): string {
  const key = normalizeTitle(chosen);
  const prefixes = candidates.filter((name) => {
    const other = normalizeTitle(name);
    return other !== "" && (key === other || key.startsWith(`${other} `));
  });
  return shortest(prefixes);
}

export type RussianTitleEvidence = {
  /** Titles of the shop products confirmed as this game. */
  linkedTitles: string[];
  /** Every product title of the tracked Russian shops. */
  shopIndex: ShopTitleIndex;
};

/**
 * Picks the Russian title among the candidates, strongest evidence first:
 * 1. the name the game's own confirmed shop product is sold under;
 * 2. a name some Russian shop sells a product under;
 * 3. a name with a letter only Russian has (ы, э, ё);
 * 4. otherwise the longest name, as the others are usually short foreign or older titles.
 * Within a step the shortest name wins: the longer ones tend to add an edition or a subtitle.
 * A candidate the winner starts with replaces it, for the same reason.
 */
export function pickRussianTitle(candidates: string[], evidence: RussianTitleEvidence): string | null {
  if (candidates.length === 0) return null;
  return trimmed(strongest(candidates, evidence), candidates);
}

function strongest(candidates: string[], evidence: RussianTitleEvidence): string {
  const linked = evidence.linkedTitles.map(normalizeTitle);
  const inLinked = candidates.filter((name) => {
    const key = normalizeTitle(name);
    return key !== "" && linked.some((title) => ` ${title} `.includes(` ${key} `));
  });
  if (inLinked.length > 0) return shortest(inLinked);

  const sold = candidates.filter((name) => soldUnder(evidence.shopIndex, name));
  if (sold.length > 0) return shortest(sold);

  const sure = candidates.filter((name) => RUSSIAN_ONLY.test(name));
  if (sure.length > 0) return shortest(sure);

  return candidates.reduce((best, name) => (name.length > best.length ? name : best));
}
