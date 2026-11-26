"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { NormalizedGame } from "@/lib/bgg/types";
import { pollCellLabel, pollCells, pollStripLabel, type PollCell } from "@/lib/poll";
import { cn } from "@/lib/utils";

const cellBase = "flex size-4 items-center justify-center rounded-[3px] font-mono text-[9px] leading-none";

// Solid fill, outlined fill and dot differ in shape as well as colour, so the strip reads without colour vision.
function cellClass(cell: PollCell) {
  return cn(
    cellBase,
    cell.verdict === "best" && "bg-poll-best text-poll-best-foreground",
    cell.verdict === "recommended" && "bg-poll-rec text-poll-rec-foreground",
    cell.verdict === "not-recommended" && "bg-poll-no text-poll-no-foreground ring-1 ring-poll-no-border ring-inset",
    cell.verdict === "unknown" && "text-muted-foreground/60",
    !cell.inRange && cell.verdict !== "unknown" && "opacity-40",
  );
}

/**
 * The poll verdict for each player count. One tooltip for the whole strip rather than one per
 * square: with thousands of rows, per-square tooltips and tab stops would swamp the page.
 */
type PollStripProps = {
  game: NormalizedGame;
  /**
   * Hoverable strips sit above the row link so the tooltip can open. On touch screens there is
   * no hover, so the strip steps aside and a tap on it opens the row like anywhere else.
   */
  hoverable?: boolean;
};

export function PollStrip({ game, hoverable = true }: PollStripProps) {
  const cells = pollCells(game);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={pollStripLabel(game)}
          className={cn("inline-flex gap-0.5", hoverable ? "relative z-10" : "pointer-events-none")}
        >
          {cells.map((cell) => (
            <span
              key={cell.playerCount}
              data-verdict={cell.verdict}
              data-in-range={cell.inRange}
              aria-hidden="true"
              className={cellClass(cell)}
            >
              {cell.verdict === "unknown" ? "·" : cell.playerCount}
            </span>
          ))}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-none text-left">
        <ul className="grid gap-0.5 font-mono text-[11px]">
          {cells.map((cell) => (
            <li key={cell.playerCount}>{pollCellLabel(cell)}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
