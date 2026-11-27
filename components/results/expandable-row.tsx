"use client";

import { ChevronRight } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { PricePanel } from "@/components/prices/price-panel";
import { TableCell, TableRow } from "@/components/ui/table";
import { track } from "@/lib/analytics";
import type { GameOffer } from "@/lib/prices/offers";
import { cn } from "@/lib/utils";

type RowState = { open: boolean; toggle: () => void; panelId: string };

const RowContext = createContext<RowState | null>(null);

type PanelData = {
  gameId: number;
  /** The title as shown, for analytics. */
  title: string;
  offers: GameOffer[];
  bggUrl: string;
};

/**
 * The game's title as the control that opens its price panel. Stretched over the whole row, so
 * a click anywhere on the row toggles it; it is also the row's single keyboard stop.
 */
export function RowToggle({ title, className }: { title: string; className?: string }) {
  const row = useContext(RowContext);
  if (row === null) throw new Error("RowToggle must be rendered inside an expandable row");

  return (
    <button
      type="button"
      onClick={row.toggle}
      aria-expanded={row.open}
      aria-controls={row.panelId}
      className={cn(
        "flex max-w-full min-w-0 cursor-pointer items-center gap-1 text-left font-medium outline-none after:absolute after:inset-0 focus-visible:underline",
        className,
      )}
    >
      <ChevronRight
        aria-hidden="true"
        className={cn("size-3.5 flex-none text-muted-foreground transition-transform", row.open && "rotate-90")}
      />
      <span className="truncate">{title}</span>
    </button>
  );
}

/**
 * The game's title as a link to its BGG page, for the views without prices. Stretched over the
 * whole row like the toggle, so a click anywhere on the row opens BGG.
 */
export function BggLink({ gameId, title, bggUrl, className }: { gameId: number; title: string; bggUrl: string; className?: string }) {
  return (
    <a
      href={bggUrl}
      onClick={() =>
        track("outbound_link_clicked", { destination: "bgg", placement: "results_title", game_id: gameId, game_title: title, url: bggUrl })
      }
      target="_blank"
      rel="noreferrer"
      className={cn("block truncate font-medium outline-none after:absolute after:inset-0 focus-visible:underline", className)}
    >
      {title}
    </a>
  );
}

/**
 * A results-table row that opens a price panel beneath itself. The cells are rendered on the
 * server and passed in; only the open state and the panel live in the browser. Each row keeps
 * its own state, so several can be open at once.
 */
/** Open state for a row; opening reports the price panel to analytics. */
function useRowOpen({ gameId, title, offers }: PanelData, layout: "table" | "list") {
  const [open, setOpen] = useState(false);
  const toggle = () => {
    if (!open) {
      track("price_history_opened", { game_id: gameId, game_title: title, offer_count: offers.length, layout });
    }
    setOpen(!open);
  };
  return [open, toggle] as const;
}

export function ExpandableTableRow({ colSpan, children, ...data }: PanelData & { colSpan: number; children: ReactNode }) {
  const { gameId, offers, bggUrl, title } = data;
  const [open, toggle] = useRowOpen(data, "table");
  const panelId = `prices-${gameId}`;

  return (
    <RowContext.Provider value={{ open, toggle, panelId }}>
      <TableRow data-expanded={open} className={cn("relative h-14", open && "border-b-0 bg-muted/30")}>
        {children}
      </TableRow>
      {open ? (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell id={panelId} colSpan={colSpan} className="p-0 whitespace-normal">
            <PricePanel gameId={gameId} title={title} offers={offers} bggUrl={bggUrl} />
          </TableCell>
        </TableRow>
      ) : null}
    </RowContext.Provider>
  );
}

/** The same for the phone list: the panel opens under the item. */
export function ExpandableListItem({ children, ...data }: PanelData & { children: ReactNode }) {
  const { gameId, offers, bggUrl, title } = data;
  const [open, toggle] = useRowOpen(data, "list");
  const panelId = `prices-m-${gameId}`;

  return (
    <RowContext.Provider value={{ open, toggle, panelId }}>
      {/* Closed items off screen are skipped by the browser; an open one holds a chart and must lay out normally. */}
      <li
        className={cn(
          "border-b",
          open ? "bg-muted/30" : "[contain-intrinsic-size:auto_69px] [content-visibility:auto]",
        )}
      >
        <div className="relative flex items-center gap-3 px-4 py-2.5">{children}</div>
        {open ? (
          <div id={panelId}>
            <PricePanel gameId={gameId} title={title} offers={offers} bggUrl={bggUrl} />
          </div>
        ) : null}
      </li>
    </RowContext.Provider>
  );
}
