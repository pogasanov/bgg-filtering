"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { memo } from "react";
import { GameThumb } from "@/components/results/game-thumb";
import { PollStrip } from "@/components/results/poll-strip";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { NormalizedGame, SortDir, SortKey } from "@/lib/bgg/types";
import { gameTags } from "@/lib/filtering";
import { formatNumber, sortLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

type ResultsTableProps = {
  games: NormalizedGame[];
  sort: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onReset: () => void;
};

const COLUMN_COUNT = 10;
const headClass = "h-9 px-3 text-xs font-medium text-muted-foreground";
const numClass = "px-3 text-right font-mono tabular-nums";

export function playersRange(game: NormalizedGame): string {
  const { minPlayers, maxPlayers } = game;
  if (minPlayers === null && maxPlayers === null) return "—";
  if (minPlayers === null || maxPlayers === null || minPlayers === maxPlayers) return String(minPlayers ?? maxPlayers);
  return `${minPlayers}–${maxPlayers}`;
}

const METER_STEPS = [1, 2, 3, 4, 5];

/** BGG complexity runs from 1 to 5; the bars make a column of them scannable at a glance. */
function WeightMeter({ weight }: { weight: number }) {
  const filled = Math.round(weight);
  return (
    <span className="mr-1.5 inline-flex gap-0.5 align-[-1px]" aria-hidden="true">
      {METER_STEPS.map((step) => (
        <span
          key={step}
          data-meter-bar={step <= filled ? "on" : "off"}
          className={cn("h-[11px] w-[5px] rounded-[1px]", step <= filled ? "bg-meter" : "bg-border")}
        />
      ))}
    </span>
  );
}

export function EmptyResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <p className="text-sm text-muted-foreground">Ничего не найдено</p>
      <Button variant="outline" size="sm" onClick={onReset}>
        Сбросить фильтры
      </Button>
    </div>
  );
}

/** Memoised: with thousands of rows it must re-render only when its own props change, not on every keystroke. */
export const ResultsTable = memo(function ResultsTable({ games, sort, sortDir, onSort, onReset }: ResultsTableProps) {
  function sortHead(key: SortKey, label = sortLabels[key], align: "left" | "right" = "right") {
    const active = sort === key;
    const Arrow = sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
        className={cn(headClass, align === "right" && "text-right")}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSort(key)}
          className={cn("-mx-2 h-7 gap-1 px-2 text-xs font-medium", active ? "text-foreground" : "text-muted-foreground")}
        >
          {label}
          {active ? <Arrow className="size-3" aria-hidden="true" /> : null}
        </Button>
      </TableHead>
    );
  }

  return (
    <Table className="text-[13px]">
      <TableHeader className="bg-muted/50">
        <TableRow className="hover:bg-transparent">
          {sortHead("rank", "#")}
          <TableHead className={headClass}>Игра</TableHead>
          {sortHead("year")}
          <TableHead className={headClass}>Опрос</TableHead>
          <TableHead className={cn(headClass, "text-right")}>Игроки</TableHead>
          {sortHead("playingTime")}
          {sortHead("weight")}
          {sortHead("geekRating")}
          {sortHead("averageRating")}
          {sortHead("numVoters")}
        </TableRow>
      </TableHeader>
      <TableBody>
        {games.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={COLUMN_COUNT}>
              <EmptyResults onReset={onReset} />
            </TableCell>
          </TableRow>
        ) : null}
        {games.map((game) => {
          const tags = gameTags(game).slice(0, 4).join(" · ");
          return (
            <TableRow key={game.id} className="relative h-14">
              <TableCell className={cn(numClass, "text-muted-foreground")}>{formatNumber(game.rank, 0)}</TableCell>
              <TableCell className="max-w-0 w-full px-3 py-2">
                <div className="flex items-center gap-3">
                  <GameThumb url={game.thumbnailUrl} size={40} />
                  <div className="min-w-0">
                    {/* The link is stretched over the row so the whole row opens the BGG page. */}
                    <a
                      href={game.bggUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                    >
                      {game.title}
                    </a>
                    {tags ? <div className="truncate text-xs text-muted-foreground">{tags}</div> : null}
                  </div>
                </div>
              </TableCell>
              <TableCell className={cn(numClass, "text-muted-foreground")}>{game.year ?? "—"}</TableCell>
              <TableCell className="px-3">
                <PollStrip game={game} />
              </TableCell>
              <TableCell className={numClass}>{playersRange(game)}</TableCell>
              <TableCell className={numClass}>{game.playingTime === null ? "—" : `${game.playingTime}′`}</TableCell>
              <TableCell className={numClass}>
                {game.weight !== null ? <WeightMeter weight={game.weight} /> : null}
                {formatNumber(game.weight, 1)}
              </TableCell>
              <TableCell className={cn(numClass, "font-semibold")}>{formatNumber(game.geekRating, 2)}</TableCell>
              <TableCell className={numClass}>{formatNumber(game.averageRating, 2)}</TableCell>
              <TableCell className={cn(numClass, "text-muted-foreground")}>{formatNumber(game.numVoters, 0)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
});
