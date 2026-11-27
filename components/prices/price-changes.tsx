"use client";

import { useState } from "react";
import { useLocale, useMessages } from "@/components/locale";
import { PersonalPrice } from "@/components/results/personal-price";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PanelGame } from "@/components/prices/price-panel";
import { linkHost, track } from "@/lib/analytics";
import { intlLocale, type Locale } from "@/lib/i18n/locale";
import type { ChangeRow } from "@/lib/prices/changes";
import { formatPrice, shopNames } from "@/lib/prices/offers";
import { cn } from "@/lib/utils";

/** Prices change rarely, so the latest few rows are the whole story for most games. */
const VISIBLE_ROWS = 8;

const headClass = "h-8 px-3 text-xs font-medium text-muted-foreground first:pl-0 last:pr-0";
const cellClass = "px-3 py-1.5 first:pl-0 last:pr-0";

function day(isoTime: string, locale: Locale) {
  return new Date(isoTime).toLocaleDateString(intlLocale(locale), { day: "numeric", month: "short", year: "numeric" });
}

function Change({ row }: { row: ChangeRow }) {
  const locale = useLocale();
  const t = useMessages();
  // A price nobody has confirmed lately says when it was last seen instead of looking current.
  if (row.stale) {
    return <span className="font-sans text-xs">{row.checkedAt ? t.checkedOn(new Date(row.checkedAt).toLocaleDateString(intlLocale(locale))) : t.notChecked}</span>;
  }
  if (!row.available) return <span className="font-sans text-xs">{t.outOfStock}</span>;
  if (row.changePercent === null) return <span className="text-muted-foreground">—</span>;
  return row.changePercent < 0 ? (
    <span className="text-poll-best">−{Math.abs(row.changePercent)}%</span>
  ) : (
    <span className="text-destructive">+{row.changePercent}%</span>
  );
}

/**
 * The game's recorded price changes across its shops, newest first. Each row opens that shop's
 * product page. A table rather than a chart: prices move a few times a year, and a row says
 * exactly when and by how much.
 */
export function PriceChanges({ rows, game = {} }: { rows: ChangeRow[]; game?: PanelGame }) {
  const [showAll, setShowAll] = useState(false);
  const locale = useLocale();
  const t = useMessages();
  const visible = showAll ? rows : rows.slice(0, VISIBLE_ROWS);

  return (
    <div className="grid gap-2">
      <Table className="text-[13px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={headClass}>{t.columnDate}</TableHead>
            <TableHead className={headClass}>{t.columnShop}</TableHead>
            <TableHead className={cn(headClass, "text-right")}>{t.columnPrice}</TableHead>
            <TableHead className={cn(headClass, "text-right")}>{t.columnChange}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((row) => {
            const muted = row.stale || !row.available;
            return (
              <TableRow key={row.id} className={cn("relative", muted && "text-muted-foreground", row.current && !muted && "font-medium")}>
                <TableCell className={cn(cellClass, "font-mono tabular-nums")}>{day(row.at, locale)}</TableCell>
                <TableCell className={cellClass}>
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-2 flex-none rounded-full"
                      style={{ backgroundColor: `var(--shop-${row.shop})` }}
                    />
                    {row.url ? (
                      // Stretched over the row, so a click anywhere on it opens the product page.
                      <a
                        href={row.url}
                        onClick={() =>
                          track("outbound_link_clicked", {
                            destination: "shop",
                            placement: "price_history",
                            shop: row.shop,
                            shop_host: row.url ? linkHost(row.url) : null,
                            price: row.price,
                            available: row.available,
                            current: row.current,
                            game_id: game.gameId,
                            game_title: game.title,
                            url: row.url,
                          })
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="outline-none after:absolute after:inset-0 focus-visible:underline"
                      >
                        {shopNames[row.shop]}
                      </a>
                    ) : (
                      shopNames[row.shop]
                    )}
                  </span>
                </TableCell>
                <TableCell className={cn(cellClass, "text-right font-mono tabular-nums")}>
                  <span className="inline-flex flex-col items-end leading-tight">
                    {row.price === null ? <span className="font-sans text-xs">{t.noPrice}</span> : formatPrice(row.price)}
                    {row.current && row.available && !row.stale ? <PersonalPrice shop={row.shop} price={row.price} /> : null}
                  </span>
                </TableCell>
                <TableCell className={cn(cellClass, "text-right font-mono tabular-nums")}>
                  <Change row={row} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {!showAll && rows.length > VISIBLE_ROWS ? (
        <Button variant="ghost" size="sm" onClick={() => setShowAll(true)} className="h-7 justify-self-start px-2 text-xs text-muted-foreground">
          {t.showAll(rows.length)}
        </Button>
      ) : null}
    </div>
  );
}
