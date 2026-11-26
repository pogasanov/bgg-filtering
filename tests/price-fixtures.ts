import type { GameOffer } from "@/lib/prices/offers";

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
