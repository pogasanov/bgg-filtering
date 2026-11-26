"use client";

import { BggAttribution, PoweredByBgg } from "@/components/powered-by-bgg";
import type { CatalogStatus } from "@/lib/catalog/types";
import { formatUpdatedDate } from "@/lib/labels";

type RailFooterProps = {
  status: CatalogStatus;
};

/** Attribution and the date of the last weekly sync, out of the way at the bottom of the rail. */
export function RailFooter({ status }: RailFooterProps) {
  return (
    <div className="grid gap-2.5 px-4 py-4">
      <PoweredByBgg />
      <BggAttribution />
      <p className="text-[11px] text-muted-foreground">{formatUpdatedDate(status.updatedAt)}</p>
    </div>
  );
}
