import type { Link } from "@/lib/prices/match";
import type { GameNames, ShopCode, ShopProduct } from "@/lib/prices/types";

const SAMPLE_SIZE = 20;

export type ShopOutcome = { shop: ShopCode; products: ShopProduct[] } | { shop: ShopCode; error: string };

export type DryRunReport = {
  games: number;
  gamesWithConfirmed: number;
  gamesWithOnlyCandidates: number;
  gamesWithNothing: number;
  shops: { shop: ShopCode; error: string | null; products: number; confirmed: number; candidates: number }[];
  /** Confirmed links to check against the shop by eye. */
  sample: { game: string; shop: ShopCode; title: string; price: number | null; url: string }[];
};

const firstItems = <T>(items: T[], n: number) => items.slice(0, n);

export function buildReport(
  games: GameNames[],
  outcomes: ShopOutcome[],
  links: Link[],
  pickSample: <T>(items: T[], n: number) => T[] = firstItems,
): DryRunReport {
  const confirmedGames = new Set(links.filter((link) => link.status === "confirmed").map((link) => link.bggId));
  const candidateGames = new Set(
    links.filter((link) => link.status === "candidate" && !confirmedGames.has(link.bggId)).map((link) => link.bggId),
  );
  const listed = new Set(games.map((game) => game.bggId));
  const count = (ids: Set<number>) => [...ids].filter((id) => listed.has(id)).length;

  const gameName = new Map(games.map((game) => [game.bggId, game.primaryName]));
  const productByKey = new Map<string, ShopProduct>();
  for (const outcome of outcomes) {
    if ("products" in outcome) for (const product of outcome.products) productByKey.set(`${product.shop}\u0000${product.externalId}`, product);
  }

  const confirmed = links.filter((link) => link.status === "confirmed");
  const sample = pickSample(confirmed, SAMPLE_SIZE).flatMap((link) => {
    const product = productByKey.get(`${link.shop}\u0000${link.externalId}`);
    if (!product) return [];
    return [
      {
        game: gameName.get(link.bggId) ?? String(link.bggId),
        shop: link.shop,
        title: product.title,
        price: product.price,
        url: product.url,
      },
    ];
  });

  return {
    games: games.length,
    gamesWithConfirmed: count(confirmedGames),
    gamesWithOnlyCandidates: count(candidateGames),
    gamesWithNothing: games.length - count(confirmedGames) - count(candidateGames),
    shops: outcomes.map((outcome) => ({
      shop: outcome.shop,
      error: "error" in outcome ? outcome.error : null,
      products: "products" in outcome ? outcome.products.length : 0,
      confirmed: links.filter((link) => link.shop === outcome.shop && link.status === "confirmed").length,
      candidates: links.filter((link) => link.shop === outcome.shop && link.status === "candidate").length,
    })),
    sample,
  };
}

export function formatReport(report: DryRunReport): string {
  const lines = [
    `Games: ${report.games}`,
    `  with a confirmed price:  ${report.gamesWithConfirmed}`,
    `  with only candidates:    ${report.gamesWithOnlyCandidates}`,
    `  with nothing:            ${report.gamesWithNothing}`,
    "",
    "Shops:",
  ];

  for (const shop of report.shops) {
    lines.push(
      shop.error === null
        ? `  ${shop.shop}: ${shop.products} products, ${shop.confirmed} confirmed, ${shop.candidates} candidates`
        : `  ${shop.shop}: FAILED — ${shop.error}`,
    );
  }

  if (report.sample.length > 0) {
    lines.push("", "Confirmed links to check by eye:");
    for (const item of report.sample) {
      const price = item.price === null ? "no price" : `${item.price} ₽`;
      lines.push(`  ${item.game} → [${item.shop}] ${item.title} — ${price}`, `    ${item.url}`);
    }
  }

  return lines.join("\n");
}
