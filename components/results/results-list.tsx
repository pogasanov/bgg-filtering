import type { ReactNode } from "react";
import { BggLink, ExpandableListItem, RowToggle } from "@/components/results/expandable-row";
import { GameThumb } from "@/components/results/game-thumb";
import { PollStrip } from "@/components/results/poll-strip";
import { PriceCell } from "@/components/results/price-cell";
import { displayTitle, EmptyResults } from "@/components/results/results-table";
import type { ListedGame } from "@/lib/bgg/types";
import { formatNumber } from "@/lib/labels";

type ResultsListProps = {
  games: ListedGame[];
  /** The Russian view: Russian titles, prices, and a tap that opens the price panel instead of BGG. */
  russian: boolean;
};

/** The phone layout of the results: fewer columns, and the same row behaviour as the table. */
export function ResultsList({ games, russian }: ResultsListProps) {
  if (games.length === 0) return <EmptyResults />;

  return (
    <ul>
      {games.map((game) => {
        const title = displayTitle(game, russian);
        const content: ReactNode = (
          <>
            <GameThumb url={game.thumbnailUrl} size={48} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                {russian ? (
                  <RowToggle title={title} className="min-w-0 flex-1" />
                ) : (
                  <BggLink gameId={game.id} title={title} bggUrl={game.bggUrl} />
                )}
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
              {russian ? (
                <div className="text-xs">
                  <PriceCell offers={game.offers} />
                </div>
              ) : null}
            </div>
          </>
        );

        if (!russian) {
          return (
            <li
              key={game.id}
              className="relative flex items-center gap-3 border-b px-4 py-2.5 [contain-intrinsic-size:auto_69px] [content-visibility:auto]"
            >
              {content}
            </li>
          );
        }
        return (
          <ExpandableListItem key={game.id} gameId={game.id} title={title} offers={game.offers} bggUrl={game.bggUrl}>
            {content}
          </ExpandableListItem>
        );
      })}
    </ul>
  );
}
