"use client";

import { useMessages } from "@/components/locale";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { discountedPrice, formatPrice, personalDiscounts } from "@/lib/prices/offers";
import type { ShopCode } from "@/lib/prices/types";
import { cn } from "@/lib/utils";

/**
 * The price after the owner's personal discount in that shop, marked "с мпс"; hovering spells
 * out the discount. Raised above the row's stretched toggle so the hover reaches it.
 * Nothing when the shop gives no discount.
 */
export function PersonalPrice({ shop, price, className }: { shop: ShopCode; price: number | null; className?: string }) {
  const t = useMessages();
  const discounted = discountedPrice(shop, price);
  if (discounted === null) return null;
  const label = t.personalDiscount(personalDiscounts[shop] ?? 0);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={`${formatPrice(discounted)}, ${label.toLowerCase()}`}
          className={cn("relative z-10 cursor-help text-[11px] font-normal whitespace-nowrap text-muted-foreground", className)}
        >
          {formatPrice(discounted)} <span className="font-sans">{t.personalDiscountShort}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
