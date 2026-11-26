import { expect, test } from "vitest";
import { bestOffer, discountedPrice, formatPrice, isStale, lowestKnownOffer, salePercent, shopNames } from "@/lib/prices/offers";
import { NOW, offer } from "./price-fixtures";

test("staleness is three days from the last successful check", () => {
  expect(isStale("2026-12-07T00:00:01.000Z", NOW)).toBe(false);
  expect(isStale("2026-12-06T23:59:59.000Z", NOW)).toBe(true);
  expect(isStale(null, NOW)).toBe(true);
});

test("sale comes from the shop's old price or a 10% drop from the 30-day high", () => {
  expect(salePercent(1800, 2000, null)).toBe(10);
  expect(salePercent(1780, null, 2000)).toBe(11);
  expect(salePercent(1801, null, 2000)).toBeNull();
  expect(salePercent(1500, 1600, 2000)).toBe(25);
  expect(salePercent(2000, 1500, null)).toBeNull();
  expect(salePercent(null, 2000, 2000)).toBeNull();
});

test("best offer is the cheapest one in stock and not stale", () => {
  const offers = [
    offer({ shop: "crowdgames", price: 1500, available: false }),
    offer({ shop: "lavkaigr", price: 1900 }),
    offer({ shop: "gaga", price: 1700, stale: true }),
    offer({ shop: "gaga", price: null }),
  ];
  expect(bestOffer(offers)?.shop).toBe("lavkaigr");
  expect(lowestKnownOffer(offers)?.shop).toBe("crowdgames");
  expect(bestOffer([offer({ available: null, price: 900 })])?.price).toBe(900);
  expect(bestOffer([offer({ stale: true })])).toBeNull();
  expect(lowestKnownOffer([offer({ stale: true })])).toBeNull();
  expect(bestOffer([])).toBeNull();
});

test("price formatting and shop names", () => {
  expect(formatPrice(1390)).toBe("1 390 ₽");
  expect(formatPrice(22990)).toBe("22 990 ₽");
  expect(formatPrice(690)).toBe("690 ₽");
  expect(formatPrice(null)).toBe("—");
  expect(shopNames).toEqual({ crowdgames: "CrowdGames", lavkaigr: "Лавка игр", gaga: "GaGa" });
});

test("personal discount: 15% at CrowdGames, 10% at Lavka, none elsewhere", () => {
  expect(discountedPrice("crowdgames", 2000)).toBe(1700);
  expect(discountedPrice("lavkaigr", 1390)).toBe(1251);
  expect(discountedPrice("gaga", 2000)).toBeNull();
  expect(discountedPrice("lavkaigr", null)).toBeNull();
});
