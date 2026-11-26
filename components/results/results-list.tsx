"use client";

import { GameThumb } from "@/components/results/game-thumb";
import { PollStrip } from "@/components/results/poll-strip";
import { EmptyResults } from "@/components/results/results-table";
import type { NormalizedGame } from "@/lib/bgg/types";
import { formatNumber } from "@/lib/labels";

type ResultsListProps = {
  games: NormalizedGame[];
  onReset: () => void;
};

/** The phone layout of the results: fewer columns, same row-opens-BGG behaviour. */
export function ResultsList({ games, onReset }: ResultsListProps) {
  if (games.length === 0) return <EmptyResults onReset={onReset} />;

  return (
    <ul>
      {games.map((game) => (
        <li
          key={game.id}
          className="relative flex items-center gap-3 border-b px-4 py-2.5 [contain-intrinsic-size:auto_69px] [content-visibility:auto]"
        >
          <GameThumb url={game.thumbnailUrl} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <a
                href={game.bggUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
              >
                {game.title}
              </a>
              {game.year !== null ? (
                <span className="flex-none font-mono text-xs text-muted-foreground">{game.year}</span>
              ) : null}
            </div>
            <div className="mt-1.5">
              <PollStrip game={game} hoverable={false} />
            </div>
          </div>
          <div className="flex-none text-right font-mono tabular-nums">
            <div className="font-semibold">{formatNumber(game.geekRating, 2)}</div>
            <div className="text-xs text-muted-foreground">#{formatNumber(game.rank, 0)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
