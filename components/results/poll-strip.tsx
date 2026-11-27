"use client";

import { useLocale } from "@/components/locale";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { playerCountText } from "@/lib/labels";
import { decodePollCells, pollCellLabel, pollSummary, type PollCell } from "@/lib/poll";
import { cn } from "@/lib/utils";

// Solid fill, outlined fill and dot differ in shape as well as colour, so the strip reads without colour vision.
function cellClass(cell: PollCell) {
  return cn(
    "poll-cell",
    cell.verdict === "best" && "bg-poll-best text-poll-best-foreground",
    cell.verdict === "recommended" && "bg-poll-rec text-poll-rec-foreground",
    cell.verdict === "not-recommended" && "bg-poll-no text-poll-no-foreground ring-1 ring-poll-no-border ring-inset",
    cell.verdict === "unknown" && "text-muted-foreground/60",
    !cell.inRange && cell.verdict !== "unknown" && "opacity-40",
  );
}

/**
 * The poll verdict for each player count. One tooltip for the whole strip rather than one per
 * square: with thousands of rows, per-square tooltips and tab stops would swamp the page. The
 * squares are hidden from assistive technology; a one-line summary in the text speaks for them.
 */
type PollStripProps = {
  /** The cells as `encodePollCells` writes them: a short string keeps the page payload small. */
  cells: string;
  /**
   * Hoverable strips sit above the row link so the tooltip can open. On touch screens there is
   * no hover, so the strip steps aside and a tap on it opens the row like anywhere else.
   */
  hoverable?: boolean;
};

export function PollStrip({ cells: code, hoverable = true }: PollStripProps) {
  const locale = useLocale();
  const cells = decodePollCells(code);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span data-poll-strip className={cn("inline-flex gap-0.5", hoverable ? "relative z-10" : "pointer-events-none")}>
          <span className="sr-only">{pollSummary(cells, locale)}</span>
          {cells.map((cell) => (
            <span
              key={cell.playerCount}
              data-verdict={cell.verdict}
              data-in-range={cell.inRange}
              aria-hidden="true"
              className={cellClass(cell)}
            >
              {cell.verdict === "unknown" ? "·" : playerCountText(cell.playerCount)}
            </span>
          ))}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-none text-left">
        <ul className="grid gap-0.5 font-mono text-[11px]">
          {cells.map((cell) => (
            <li key={cell.playerCount}>{pollCellLabel(cell, locale)}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
