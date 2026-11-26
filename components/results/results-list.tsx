import { ExpandableListItem, RowToggle } from "@/components/results/expandable-row";
import { GameThumb } from "@/components/results/game-thumb";
import { PollStrip } from "@/components/results/poll-strip";
import { PriceCell } from "@/components/results/price-cell";
import { EmptyResults } from "@/components/results/results-table";
import type { ListedGame } from "@/lib/bgg/types";
import { formatNumber } from "@/lib/labels";

type ResultsListProps = {
  games: ListedGame[];
};

/** The phone layout of the results: fewer columns, and the same tap-to-open price panel under the item. */
export function ResultsList({ games }: ResultsListProps) {
  if (games.length === 0) return <EmptyResults />;

  return (
    <ul>
      {games.map((game) => (
        <ExpandableListItem key={game.id} gameId={game.id} offers={game.offers} bggUrl={game.bggUrl}>
          <GameThumb url={game.thumbnailUrl} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <RowToggle title={game.title} className="min-w-0 flex-1" />
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
            <div className="text-xs">
              <PriceCell offers={game.offers} />
            </div>
          </div>
        </ExpandableListItem>
      ))}
    </ul>
  );
}
