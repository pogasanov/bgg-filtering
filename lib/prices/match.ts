import { normalizeTitle } from "@/lib/prices/text";
import type { GameNames, ShopCode, ShopProduct } from "@/lib/prices/types";

/**
 * Word stems that mark a product as something other than the base game.
 * Stems, because Russian inflects: "дополнение", "дополнения", "дополнением".
 */
export const stopWords: readonly string[] = [
  "дополнени",
  "расширени",
  "expansion",
  "промо",
  "promo",
  "протектор",
  "органайзер",
  "плеймат",
  "playmat",
  "коврик",
  "предзаказ",
  "набор",
  "миниатюр",
  "аксессуар",
  // Marked-down, damaged and second-hand listings of a game are not its price.
  "уцен",
  "комиссион",
  "мят",
];
/** Stop words too short to be safe as stems. */
const exactStopWords: readonly string[] = ["доп", "без"];

/** A name must be at least this long to match inside a longer title. */
const MIN_CONTAINED_NAME_LENGTH = 5;
const MAX_CANDIDATES_PER_GAME_AND_SHOP = 5;

export type LinkReason =
  | "exact-title"
  | "several-products"
  | "claimed-by-several-games"
  | "name-within-another-game"
  | "title-contains-name"
  | "barcode";

export type Link = {
  bggId: number;
  shop: ShopCode;
  externalId: string;
  status: "confirmed" | "candidate";
  reason: LinkReason;
};

type IndexedProduct = { product: ShopProduct; title: string; tokens: string[] };
type ContainedName = { bggId: number; tokens: string[] };

/** Lower is stronger; a pair of game and product keeps only its strongest link. */
const reasonRank: Record<LinkReason, number> = {
  "exact-title": 0,
  barcode: 1,
  "several-products": 2,
  "claimed-by-several-games": 3,
  "name-within-another-game": 4,
  "title-contains-name": 5,
};

function isStopToken(token: string): boolean {
  return exactStopWords.includes(token) || stopWords.some((stem) => token.startsWith(stem));
}

const hasCyrillic = (text: string) => /[а-я]/.test(text);


/** Words that turn a game's name into another edition of the same game rather than a different game. */
const editionWords: ReadonlySet<string> = new Set([
  "издание", "новое", "второе", "третье", "обновленное", "юбилейное", "коллекционное", "делюкс", "версия",
  "edition", "revised", "second", "third", "2nd", "3rd", "new", "anniversary", "deluxe", "big", "box", "2", "3",
]);

/** The tokens of `outer` left over after removing one occurrence of `inner`, or `null` when it does not occur. */
function tokensAround(outer: string[], inner: string[]): string[] | null {
  for (let start = 0; start + inner.length <= outer.length; start += 1) {
    if (inner.every((token, offset) => outer[start + offset] === token)) {
      return [...outer.slice(0, start), ...outer.slice(start + inner.length)];
    }
  }
  return null;
}

/** Shops prefix some titles with what the product is; the name starts after it. */
const GENERIC_PREFIX = /^настольная игра /;

const productKey = (product: ShopProduct) => `${product.shop}\u0000${product.externalId}`;

/**
 * Proposes links between games and shop products. A wrong price is worse than
 * no price, so only an unambiguous exact title is confirmed; anything weaker is
 * a candidate for the owner to judge, and most products get no link at all.
 */
export function matchProducts(games: GameNames[], products: ShopProduct[]): Link[] {
  // Titles that count as "the game itself": each name, and an original name joined
  // with a Russian one ("Apiary (Апиарий)" normalises to "apiary апиарий"). Two names
  // in the same script are not joined: "Dune" + "Imperium" would claim another game.
  const gamesByExactTitle = new Map<string, Set<number>>();
  const allNames: ContainedName[] = [];
  const publisherShopsByGame = new Map(games.map((game) => [game.bggId, game.publisherShops]));
  const containedByFirstToken = new Map<string, ContainedName[]>();

  for (const game of games) {
    const names = [...new Set(game.names.map(normalizeTitle).filter((name) => name !== ""))];
    const exactTitles = new Set(names);
    for (const first of names) {
      for (const second of names) {
        if (first !== second && hasCyrillic(first) !== hasCyrillic(second)) exactTitles.add(`${first} ${second}`);
      }
    }
    for (const name of names) allNames.push({ bggId: game.bggId, tokens: name.split(" ") });
    for (const title of exactTitles) {
      if (!gamesByExactTitle.has(title)) gamesByExactTitle.set(title, new Set());
      gamesByExactTitle.get(title)?.add(game.bggId);
    }
    for (const name of names) {
      if (name.length < MIN_CONTAINED_NAME_LENGTH) continue;
      const tokens = name.split(" ");
      if (!containedByFirstToken.has(tokens[0])) containedByFirstToken.set(tokens[0], []);
      containedByFirstToken.get(tokens[0])?.push({ bggId: game.bggId, tokens });
    }
  }

  // A product with several variants has no single price, so it is never matched.
  const indexed: IndexedProduct[] = products
    .filter((product) => product.variantCount === 1)
    .map((product) => {
      const title = normalizeTitle(product.title).replace(GENERIC_PREFIX, "");
      return { product, title, tokens: title === "" ? [] : title.split(" ") };
    });

  const links = new Map<string, Link>();
  // Only Russian editions are tracked. A title with no Russian in it is the Russian edition
  // only in its publisher's own shop ("Res Arcana" at GaGa); elsewhere it is an import,
  // a different product at a different price, and gets no link at all.
  function isImport(bggId: number, product: ShopProduct): boolean {
    const publisherShops = publisherShopsByGame.get(bggId);
    return publisherShops !== undefined && !hasCyrillic(product.title.toLowerCase()) && !publisherShops.includes(product.shop);
  }

  function propose(bggId: number, product: ShopProduct, status: Link["status"], reason: LinkReason) {
    if (isImport(bggId, product)) return;
    const key = `${bggId}\u0000${productKey(product)}`;
    const existing = links.get(key);
    if (existing && reasonRank[existing.reason] <= reasonRank[reason]) return;
    links.set(key, { bggId, shop: product.shop, externalId: product.externalId, status, reason });
  }

  // Exact titles. One game and one product in the shop confirms; anything else is a candidate.
  const soleClaims = new Map<string, IndexedProduct[]>();
  for (const item of indexed) {
    const claimants = [...(gamesByExactTitle.get(item.title) ?? [])];
    if (claimants.length > 1) {
      for (const bggId of claimants) propose(bggId, item.product, "candidate", "claimed-by-several-games");
    } else if (claimants.length === 1) {
      const key = `${claimants[0]}\u0000${item.product.shop}`;
      if (!soleClaims.has(key)) soleClaims.set(key, []);
      soleClaims.get(key)?.push(item);
    }
  }

  const confirmedProducts = new Set<string>();
  const confirmedBarcodes = new Map<string, { bggId: number; shop: ShopCode }[]>();
  for (const [key, items] of soleClaims) {
    const bggId = Number(key.split("\u0000")[0]);
    // A shop often lists the import under the original name next to the Russian edition.
    // The one product with a Russian title is the edition being tracked.
    const russian = items.filter((item) => hasCyrillic(item.title));
    const chosen = items.length === 1 ? items : russian.length === 1 ? russian : null;
    if (chosen === null) {
      for (const item of items) propose(bggId, item.product, "candidate", "several-products");
      continue;
    }
    const { product, tokens } = chosen[0];
    // "Агрикола" is one game's whole name and, with edition words added, another's
    // ("Агрикола. Новое издание"). The shop may mean either edition, so the owner decides.
    // A real subtitle ("Крылья: Азия") is a different game and raises no such doubt.
    const withinAnother = allNames.some((name) => {
      if (name.bggId === bggId || name.tokens.length <= tokens.length) return false;
      const extra = tokensAround(name.tokens, tokens);
      return extra !== null && extra.every((token) => editionWords.has(token));
    });
    if (withinAnother) {
      propose(bggId, product, "candidate", "name-within-another-game");
      continue;
    }
    if (isImport(bggId, product)) continue;
    propose(bggId, product, "confirmed", "exact-title");
    confirmedProducts.add(productKey(product));
    if (product.barcode) {
      if (!confirmedBarcodes.has(product.barcode)) confirmedBarcodes.set(product.barcode, []);
      confirmedBarcodes.get(product.barcode)?.push({ bggId, shop: product.shop });
    }
  }

  for (const item of indexed) {
    // A product confirmed for one game is not offered to another.
    if (confirmedProducts.has(productKey(item.product))) continue;

    // The same barcode as a product confirmed for the game in a different shop.
    for (const confirmed of item.product.barcode ? (confirmedBarcodes.get(item.product.barcode) ?? []) : []) {
      if (confirmed.shop !== item.product.shop) propose(confirmed.bggId, item.product, "candidate", "barcode");
    }

    // The title contains a game's name as whole words and nothing marks it as another product.
    const exactClaimants = gamesByExactTitle.get(item.title);
    for (let start = 0; start < item.tokens.length; start += 1) {
      for (const name of containedByFirstToken.get(item.tokens[start]) ?? []) {
        if (exactClaimants?.has(name.bggId)) continue;
        if (start + name.tokens.length > item.tokens.length) continue;
        if (!name.tokens.every((token, offset) => item.tokens[start + offset] === token)) continue;
        if (item.tokens.some((token) => isStopToken(token) && !name.tokens.includes(token))) continue;
        propose(name.bggId, item.product, "candidate", "title-contains-name");
      }
    }
  }

  return capCandidates([...links.values()], indexed);
}

function capCandidates(links: Link[], indexed: IndexedProduct[]): Link[] {
  const titleLength = new Map(indexed.map((item) => [productKey(item.product), item.title.length]));
  const lengthOf = (link: Link) => titleLength.get(`${link.shop}\u0000${link.externalId}`) ?? 0;

  const kept = links.filter((link) => link.status === "confirmed");
  const groups = new Map<string, Link[]>();
  for (const link of links) {
    if (link.status !== "candidate") continue;
    const key = `${link.bggId}\u0000${link.shop}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(link);
  }

  for (const group of groups.values()) {
    group.sort(
      (a, b) =>
        Number(b.reason === "barcode") - Number(a.reason === "barcode") ||
        lengthOf(a) - lengthOf(b) ||
        a.externalId.localeCompare(b.externalId),
    );
    kept.push(...group.slice(0, MAX_CANDIDATES_PER_GAME_AND_SHOP));
  }

  return kept;
}
