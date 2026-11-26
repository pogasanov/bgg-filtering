import type { GameOffer } from "@/lib/prices/offers";
import type { GameHistory } from "@/lib/prices/history";

export const NOW = new Date("2026-12-10T00:00:00.000Z");

export function offer(overrides: Partial<GameOffer> = {}): GameOffer {
  return {
    shop: "lavkaigr",
    url: "https://www.lavkaigr.ru/shop/p",
    price: 2000,
    oldPrice: null,
    available: true,
    checkedAt: "2026-12-09T05:00:00.000Z",
    stale: false,
    salePercent: null,
    ...overrides,
  };
}

/** Lavka Igr: in stock, out of stock, back cheaper. GaGa: one observation. */
export const sampleHistory: GameHistory = {
  lowest: { price: 1700, at: "2026-12-01T00:00:00.000Z", shop: "lavkaigr" },
  shops: [
    {
      shop: "lavkaigr",
      checkedAt: "2026-12-09T00:00:00.000Z",
      points: [
        { at: "2026-08-01T00:00:00.000Z", price: 2000, available: true },
        { at: "2026-11-20T00:00:00.000Z", price: 2000, available: false },
        { at: "2026-12-01T00:00:00.000Z", price: 1700, available: true },
      ],
    },
    {
      shop: "gaga",
      checkedAt: "2026-12-09T00:00:00.000Z",
      points: [{ at: "2026-12-05T00:00:00.000Z", price: 1900, available: true }],
    },
  ],
};
