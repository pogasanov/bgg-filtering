import { Badge } from "@/components/ui/badge";
import type { GameHistory } from "@/lib/prices/history";
import { formatPrice, shopNames, type GameOffer } from "@/lib/prices/offers";
import { cn } from "@/lib/utils";

type ShopListProps = {
  offers: GameOffer[];
  lowest: GameHistory["lowest"];
  bggUrl: string;
};

const linkClass = "underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50";

function date(isoTime: string) {
  return new Date(isoTime).toLocaleDateString("ru-RU", { timeZone: "UTC" });
}

export function BggLink({ bggUrl }: { bggUrl: string }) {
  return (
    <a href={bggUrl} target="_blank" rel="noreferrer" className={cn(linkClass, "text-muted-foreground")}>
      Страница на BoardGameGeek
    </a>
  );
}

function OfferStatus({ offer }: { offer: GameOffer }) {
  // A price that has not been confirmed lately says when it was last seen instead of looking current.
  if (offer.stale) {
    return <span className="text-[11px]">{offer.checkedAt ? `проверено ${date(offer.checkedAt)}` : "не проверено"}</span>;
  }
  if (offer.available === false) return <span className="text-[11px] text-muted-foreground">нет в наличии</span>;
  if (offer.salePercent !== null) {
    return (
      <Badge variant="outline" className="rounded-[4px] border-poll-best px-1 py-0 font-mono text-[11px] text-poll-best">
        −{offer.salePercent}%
      </Badge>
    );
  }
  return null;
}

/** What each tracked shop asks for the game right now. Comes with the page, so it shows before the chart loads. */
export function ShopList({ offers, lowest, bggUrl }: ShopListProps) {
  return (
    <div className="grid content-start gap-3 text-[13px]">
      <ul className="grid gap-2">
        {offers.map((offer) => (
          <li key={offer.shop} className={cn("flex items-center gap-2", offer.stale && "text-muted-foreground")}>
            <span
              aria-hidden="true"
              className="size-2 flex-none rounded-full"
              style={{ backgroundColor: `var(--shop-${offer.shop})` }}
            />
            <a href={offer.url} target="_blank" rel="noreferrer" className={cn(linkClass, "mr-auto")}>
              {shopNames[offer.shop]}
            </a>
            <OfferStatus offer={offer} />
            <span
              className={cn(
                "font-mono tabular-nums",
                offer.available === false && !offer.stale && "text-muted-foreground",
                offer.price !== null && !offer.stale && offer.available !== false && "font-semibold",
              )}
            >
              {offer.price === null ? "нет цены" : formatPrice(offer.price)}
            </span>
          </li>
        ))}
      </ul>
      <div className="grid gap-1.5 border-t pt-3 text-xs text-muted-foreground">
        {lowest ? (
          <p>
            Минимум за всё время: <span className="font-mono text-foreground">{formatPrice(lowest.price)}</span> ·{" "}
            {shopNames[lowest.shop]}, {date(lowest.at)}
          </p>
        ) : null}
        <p>
          <BggLink bggUrl={bggUrl} />
        </p>
      </div>
    </div>
  );
}
