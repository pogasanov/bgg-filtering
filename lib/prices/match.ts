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
];
/** Stop words too short to be safe as stems. */
const exactStopWords: readonly string[] = ["доп"];

/** A name must be at least this long to match inside a longer title. */
const MIN_CONTAINED_NAME_LENGTH = 5;
const MAX_CANDIDATES_PER_GAME_AND_SHOP = 5;

export type LinkReason =
  | "exact-title"
  | "several-products"
  | "claimed-by-several-games"
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
  "title-contains-name": 4,
};

function isStopToken(token: string): boolean {
  return exactStopWords.includes(token) || stopWords.some((stem) => token.startsWith(stem));
}

const productKey = (product: ShopProduct) => `${product.shop}\u0000${product.externalId}`;

/**
 * Proposes links between games and shop products. A wrong price is worse than
 * no price, so only an unambiguous exact title is confirmed; anything weaker is
 * a candidate for the owner to judge, and most products get no link at all.
 */
export function matchProducts(games: GameNames[], products: ShopProduct[]): Link[] {
  // Titles that count as "the game itself": each name, and any two names joined
  // ("Apiary (Апиарий)" normalises to "apiary апиарий").
  const gamesByExactTitle = new Map<string, Set<number>>();
  const containedByFirstToken = new Map<string, ContainedName[]>();

  for (const game of games) {
    const names = [...new Set(game.names.map(normalizeTitle).filter((name) => name !== ""))];
    const exactTitles = new Set(names);
    for (const first of names) {
      for (const second of names) if (first !== second) exactTitles.add(`${first} ${second}`);
    }
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
      const title = normalizeTitle(product.title);
      return { product, title, tokens: title === "" ? [] : title.split(" ") };
    });

  const links = new Map<string, Link>();
  function propose(bggId: number, product: ShopProduct, status: Link["status"], reason: LinkReason) {
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
    if (items.length > 1) {
      for (const item of items) propose(bggId, item.product, "candidate", "several-products");
      continue;
    }
    const { product } = items[0];
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
