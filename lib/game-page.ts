import type { ListedGame, PlayerCount } from "./bgg/types";
import { SITE_LOCALE, type Locale } from "./i18n/locale";
import { playerCountText } from "./labels";
import { pollCells } from "./poll";
import { bestOffer, formatPrice, lowestKnownOffer } from "./prices/offers";
import { slugify } from "./translit";

/** The internal route of game pages; the Russian site shows it as is ("/igra/266192-krylya"), the English one as "/game". */
export const GAME_ROUTE = "igra";
const gamePrefixes: Record<Locale, string> = { en: "game", ru: GAME_ROUTE };

/** The public path prefix of game pages on a site. */
export function gamePrefix(locale: Locale = SITE_LOCALE): string {
  return gamePrefixes[locale];
}

/** The name a game is shown under: on the Russian site the Russian one where known, otherwise BGG's. */
export function gameName(game: Pick<ListedGame, "title" | "titleRu">, locale: Locale = SITE_LOCALE): string {
  return locale === "ru" ? (game.titleRu ?? game.title) : game.title;
}

/** A game page's last segment: the BGG id, which finds the game, and its name, for people and search engines. */
export function gameSlug(id: number, name: string): string {
  const slug = slugify(name);
  return slug ? `${id}-${slug}` : String(id);
}

/** A game page's address on a site. */
export function gamePath(id: number, name: string, locale: Locale = SITE_LOCALE): string {
  return `/${gamePrefix(locale)}/${gameSlug(id, name)}`;
}

/** The BGG id at the start of a game page's segment, or null. */
export function gameIdFromSlug(segment: string): number | null {
  const match = /^([1-9]\d{0,8})(?:-|$)/.exec(segment);
  return match ? Number(match[1]) : null;
}

/** "1", "1 и 2", "1, 2 и 4"; "1 and 2" in English. */
function countList(counts: PlayerCount[], locale: Locale): string {
  const texts = counts.map(playerCountText);
  const and = locale === "ru" ? "и" : "and";
  return texts.length > 1 ? `${texts.slice(0, -1).join(", ")} ${and} ${texts.at(-1)}` : texts.join("");
}

/** The player counts the poll gives a verdict for, within the game's range, by verdict. */
export function pollVerdicts(game: ListedGame) {
  const cells = pollCells(game).filter((cell) => cell.inRange);
  const counts = (verdict: string) => cells.filter((cell) => cell.verdict === verdict).map((cell) => cell.playerCount);
  return { best: counts("best"), recommended: counts("recommended"), notRecommended: counts("not-recommended") };
}

/**
 * The page's answer in one or two sentences: what the poll says about player counts and what the
 * game costs. This is the text search engines and assistants quote, so it states facts plainly.
 */
export function gameSummary(game: ListedGame, locale: Locale = SITE_LOCALE): string {
  const { best, recommended, notRecommended } = pollVerdicts(game);
  const name = gameName(game, locale);
  const list = (counts: PlayerCount[]) => countList(counts, locale);
  const buyable = bestOffer(game.offers);
  const known = buyable ? null : lowestKnownOffer(game.offers);

  if (locale === "en") {
    const parts = [
      ...(best.length ? [`is best with ${list(best)} players`] : []),
      ...(recommended.length ? [`recommended with ${list(recommended)}`] : []),
      ...(notRecommended.length ? [`not recommended with ${list(notRecommended)}`] : []),
    ];
    const poll = parts.length ? `According to the BGG player poll, ${name} ${parts.join(", ")}.` : `${name} has no player-count poll on BGG yet.`;
    if (buyable) return `${poll} In Russian shops from ${formatPrice(buyable.price)}.`;
    if (known) return `${poll} Out of stock in Russian shops now; last price ${formatPrice(known.price)}.`;
    return poll;
  }

  const parts = [
    ...(best.length ? [`лучше всего на ${list(best)}`] : []),
    ...(recommended.length ? [`рекомендуют на ${list(recommended)}`] : []),
    ...(notRecommended.length ? [`на ${list(notRecommended)} — не рекомендуют`] : []),
  ];
  const poll = parts.length
    ? `По опросу игроков BGG «${name}» ${parts.join(", ")}.`
    : `По числу игроков у «${name}» пока нет опроса на BGG.`;
  if (buyable) return `${poll} В магазинах от ${formatPrice(buyable.price)}.`;
  if (known) return `${poll} Сейчас нет в наличии, последняя цена ${formatPrice(known.price)}.`;
  return poll;
}
