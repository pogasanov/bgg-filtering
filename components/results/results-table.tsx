import { BggLink, ExpandableTableRow, RowToggle } from "@/components/results/expandable-row";
import { GameThumb } from "@/components/results/game-thumb";
import { PollStrip } from "@/components/results/poll-strip";
import { PriceCell } from "@/components/results/price-cell";
import { ResetFiltersButton, SortButton } from "@/components/results/results-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ListedGame, SortDir, SortKey } from "@/lib/bgg/types";
import { gameTags } from "@/lib/filtering";
import { formatNumber, sortLabels } from "@/lib/labels";
import { cn } from "@/lib/utils";

type ResultsTableProps = {
  games: ListedGame[];
  sort: SortKey;
  sortDir: SortDir;
  /**
   * The Russian view: Russian titles, the price column, and a row that opens the price panel.
   * Otherwise the BGG titles, no prices, and a row that opens the game on BGG.
   */
  russian: boolean;
};

/** The title a row shows: the Russian one in the Russian view where the game has it. */
export function displayTitle(game: ListedGame, russian: boolean): string {
  return russian ? (game.titleRu ?? game.title) : game.title;
}
/** Gives way to the price column where the table would otherwise not fit. */
const narrowHidden = "hidden xl:table-cell";
const headClass = "h-9 px-3 text-xs font-medium text-muted-foreground";
const numClass = "px-3 text-right font-mono tabular-nums";

export function playersRange(game: ListedGame): string {
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

export function EmptyResults() {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <p className="text-sm text-muted-foreground">Ничего не найдено</p>
      <ResetFiltersButton />
    </div>
  );
}

/**
 * One page of games. The cells are rendered on the server; the sort buttons, the reset button, the
 * poll tooltips and, in the Russian view, the row toggle that opens the price panel are the interactive parts.
 */
export function ResultsTable({ games, sort, sortDir, russian }: ResultsTableProps) {
  const columnCount = russian ? 11 : 10;

  function sortHead(key: SortKey, label = sortLabels[key], className?: string) {
    const active = sort === key;
    return (
      <TableHead
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
        className={cn(headClass, "text-right", className)}
      >
        <SortButton sortKey={key} label={label} activeDir={active ? sortDir : null} />
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
          {sortHead("numVoters", undefined, russian ? narrowHidden : undefined)}
          {russian ? sortHead("price") : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {games.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columnCount}>
              <EmptyResults />
            </TableCell>
          </TableRow>
        ) : null}
        {games.map((game) => {
          const tags = gameTags(game).slice(0, 4).join(" · ");
          const title = displayTitle(game, russian);
          const cells = (
            <>
              <TableCell className={cn(numClass, "text-muted-foreground")}>{formatNumber(game.rank, 0)}</TableCell>
              <TableCell className="max-w-0 w-full px-3 py-2">
                <div className="flex items-center gap-3">
                  <GameThumb url={game.thumbnailUrl} size={40} />
                  <div className="min-w-0">
                    {russian ? <RowToggle title={title} /> : <BggLink gameId={game.id} title={title} bggUrl={game.bggUrl} />}
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
              <TableCell className={cn(numClass, russian && narrowHidden, "text-muted-foreground")}>
                {formatNumber(game.numVoters, 0)}
              </TableCell>
              {russian ? (
                <TableCell className={numClass}>
                  <PriceCell offers={game.offers} />
                </TableCell>
              ) : null}
            </>
          );
          if (!russian) {
            return (
              <TableRow key={game.id} className="relative h-14">
                {cells}
              </TableRow>
            );
          }
          return (
            <ExpandableTableRow
              key={game.id}
              gameId={game.id}
              title={title}
              offers={game.offers}
              bggUrl={game.bggUrl}
              colSpan={columnCount}
            >
              {cells}
            </ExpandableTableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
