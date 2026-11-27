"use client";

import { Fragment } from "react";
import { useLocale } from "@/components/locale";
import { Toggle } from "@/components/ui/toggle";
import { matrixVerdicts, playerCounts, type MatrixSelection } from "@/lib/bgg/types";
import { matrixCellLabel, playerCountText, verdictShortLabel } from "@/lib/labels";

type MatrixGridProps = {
  value: MatrixSelection[];
  onChange: (next: MatrixSelection[]) => void;
};

/** Player count × verdict. State reads from fill alone: empty outline when off, solid when on. */
export function MatrixGrid({ value, onChange }: MatrixGridProps) {
  const locale = useLocale();
  const selected = new Set(value.map((item) => `${item.playerCount}:${item.verdict}`));

  function toggle(selection: MatrixSelection, pressed: boolean) {
    const key = `${selection.playerCount}:${selection.verdict}`;
    const rest = value.filter((item) => `${item.playerCount}:${item.verdict}` !== key);
    onChange(pressed ? [...rest, selection] : rest);
  }

  return (
    <div className="grid grid-cols-[1.5rem_repeat(4,1fr)] items-center gap-[3px]">
      <span />
      {matrixVerdicts.map((verdict) => (
        <span key={verdict} className="pb-0.5 text-center text-[10px] text-muted-foreground" aria-hidden="true">
          {verdictShortLabel(verdict, locale)}
        </span>
      ))}
      {playerCounts.map((playerCount) => (
        <Fragment key={playerCount}>
          <span className="font-mono text-xs text-muted-foreground" aria-hidden="true">
            {playerCountText(playerCount)}
          </span>
          {matrixVerdicts.map((verdict) => {
            const key = `${playerCount}:${verdict}`;
            return (
              <Toggle
                key={key}
                data-matrix-cell={key}
                variant="outline"
                size="sm"
                pressed={selected.has(key)}
                onPressedChange={(pressed) => toggle({ playerCount, verdict }, pressed)}
                aria-label={matrixCellLabel({ playerCount, verdict }, locale)}
                className="h-6 min-w-0 rounded-[4px] p-0 shadow-none data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:hover:bg-foreground/85"
              />
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
