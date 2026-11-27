import type { ListedGame, PlayerCount } from "./bgg/types";
import { playerCountText } from "./labels";
import { pollCells } from "./poll";
import { bestOffer, formatPrice, lowestKnownOffer } from "./prices/offers";
import { slugify } from "./translit";

/** The prefix of game pages ("/igra/266192-krylya"). */
export const GAME_ROUTE = "igra";

/** The name a game is shown under: the Russian one where known, as in the Russian catalog. */
export function gameName(game: Pick<ListedGame, "title" | "titleRu">): string {
  return game.titleRu ?? game.title;
}

/** A game page's address: the BGG id, which finds the game, and its name, for people and search engines. */
export function gamePath(id: number, name: string): string {
  const slug = slugify(name);
  return `/${GAME_ROUTE}/${slug ? `${id}-${slug}` : id}`;
}

/** The BGG id at the start of a game page's segment, or null. */
export function gameIdFromSlug(segment: string): number | null {
  const match = /^([1-9]\d{0,8})(?:-|$)/.exec(segment);
  return match ? Number(match[1]) : null;
}

/** "1", "1 и 2", "1, 2 и 4". */
function countList(counts: PlayerCount[]): string {
  const texts = counts.map(playerCountText);
  return texts.length > 1 ? `${texts.slice(0, -1).join(", ")} и ${texts.at(-1)}` : texts.join("");
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
export function gameSummary(game: ListedGame): string {
  const { best, recommended, notRecommended } = pollVerdicts(game);
  const parts = [
    ...(best.length ? [`лучше всего на ${countList(best)}`] : []),
    ...(recommended.length ? [`рекомендуют на ${countList(recommended)}`] : []),
    ...(notRecommended.length ? [`на ${countList(notRecommended)} — не рекомендуют`] : []),
  ];
  const poll = parts.length
    ? `По опросу игроков BGG «${gameName(game)}» ${parts.join(", ")}.`
    : `По числу игроков у «${gameName(game)}» пока нет опроса на BGG.`;

  const buyable = bestOffer(game.offers);
  if (buyable) return `${poll} В магазинах от ${formatPrice(buyable.price)}.`;
  const known = lowestKnownOffer(game.offers);
  if (known) return `${poll} Сейчас нет в наличии, последняя цена ${formatPrice(known.price)}.`;
  return poll;
}
