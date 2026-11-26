"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FilterChip } from "@/lib/active-filters";
import type { GameFilters } from "@/lib/filtering";
import { formatNumber } from "@/lib/labels";

type ResultsBarProps = {
  shown: number;
  total: number;
  chips: FilterChip[];
  onChange: (next: GameFilters) => void;
  onReset: () => void;
  /** Extra controls placed right after the count (the phone sort control). */
  children?: ReactNode;
};

export function ResultsBar({ shown, total, chips, onChange, onReset, children }: ResultsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5">
      <output className="flex items-baseline gap-1.5 font-mono" aria-live="polite">
        <span className="text-xl font-semibold tracking-tight">{formatNumber(shown, 0)}</span>
        <span className="text-xs text-muted-foreground">из {formatNumber(total, 0)}</span>
      </output>
      {children}
      {chips.length > 0 ? (
        <>
          <ul className="order-last flex min-w-0 basis-full gap-1.5 overflow-x-auto lg:order-none lg:flex-1 lg:basis-0 lg:flex-wrap lg:overflow-visible">
            {chips.map((chip) => (
              <li key={chip.id} className="flex-none">
                <Badge variant="outline" className="gap-1 rounded-[4px] py-0.5 pr-0.5 pl-2 font-normal">
                  {chip.label}
                  <button
                    type="button"
                    onClick={() => onChange(chip.next)}
                    aria-label={`Убрать фильтр: ${chip.label}`}
                    className="rounded-sm p-0.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
          {/* With one chip its own cross does the same. */}
          {chips.length > 1 ? (
            <Button variant="ghost" size="sm" onClick={onReset} className="ml-auto h-7 flex-none text-xs text-muted-foreground">
              Сбросить всё
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
