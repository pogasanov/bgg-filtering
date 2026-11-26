import { PersonalPrice } from "@/components/results/personal-price";
import { bestOffer, formatPrice, lowestKnownOffer, type GameOffer } from "@/lib/prices/offers";

/**
 * The price shown in the results: the cheapest offer that can be bought today, with the price
 * after a personal discount underneath where the shop gives one. When nothing is in stock, the
 * cheapest recent price is still shown, muted, so the game's cost stays visible.
 */
export function PriceCell({ offers }: { offers: GameOffer[] }) {
  const best = bestOffer(offers);
  if (best !== null) {
    return (
      <span className="inline-flex flex-col items-end leading-tight">
        {best.salePercent === null ? (
          <span>{formatPrice(best.price)}</span>
        ) : (
          <span className="whitespace-nowrap">
            <span className="text-[11px] text-muted-foreground">−{best.salePercent}%</span>{" "}
            <span className="font-semibold text-poll-best">{formatPrice(best.price)}</span>
          </span>
        )}
        <PersonalPrice shop={best.shop} price={best.price} />
      </span>
    );
  }

  const known = lowestKnownOffer(offers);
  if (known === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex flex-col items-end leading-tight text-muted-foreground">
      <span>{formatPrice(known.price)}</span>
      <span className="font-sans text-[11px]">нет в наличии</span>
    </span>
  );
}
