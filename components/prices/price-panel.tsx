"use client";

import { useCallback, useEffect, useState } from "react";
import { PriceChanges } from "@/components/prices/price-changes";
import { Button } from "@/components/ui/button";
import { changeRows } from "@/lib/prices/changes";
import type { GameHistory } from "@/lib/prices/history";
import { formatPrice, shopNames, type GameOffer } from "@/lib/prices/offers";

export type HistoryState = { status: "loading" } | { status: "error" } | { status: "ready"; history: GameHistory };

const linkClass = "underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50";

function date(isoTime: string) {
  return new Date(isoTime).toLocaleDateString("ru-RU");
}

function BggLink({ bggUrl }: { bggUrl: string }) {
  return (
    <a href={bggUrl} target="_blank" rel="noreferrer" className={linkClass}>
      Страница на BoardGameGeek
    </a>
  );
}

/** The lowest price ever recorded, when prices were last refreshed, and the way out to BGG. */
function PanelFooter({ offers, lowest, bggUrl }: { offers: GameOffer[]; lowest: GameHistory["lowest"]; bggUrl: string }) {
  const checkTimes = offers.flatMap((offer) => (offer.checkedAt === null ? [] : [offer.checkedAt])).sort();
  const updatedAt = checkTimes[checkTimes.length - 1];

  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {lowest ? (
        <span>
          Минимум за всё время: <span className="font-mono text-foreground">{formatPrice(lowest.price)}</span> ·{" "}
          {shopNames[lowest.shop]}, {date(lowest.at)}
        </span>
      ) : null}
      {updatedAt ? <span>Цены обновлены {date(updatedAt)}</span> : null}
      <BggLink bggUrl={bggUrl} />
    </p>
  );
}

type PricePanelViewProps = {
  offers: GameOffer[];
  bggUrl: string;
  state: HistoryState;
  onRetry: () => void;
};

/** The panel's layout for a given load state. Kept free of fetching so every state can be rendered directly. */
export function PricePanelView({ offers, bggUrl, state, onRetry }: PricePanelViewProps) {
  if (offers.length === 0) {
    return (
      <div className="grid gap-2 px-4 py-4 text-[13px] text-muted-foreground">
        <p>Игра не найдена в отслеживаемых магазинах.</p>
        <p>
          <BggLink bggUrl={bggUrl} />
        </p>
      </div>
    );
  }

  return (
    <div className="grid max-w-3xl gap-3 px-4 py-3">
      {state.status === "ready" ? <PriceChanges rows={changeRows(state.history, offers)} /> : null}
      {state.status === "loading" ? (
        <div aria-busy="true" aria-label="Загрузка истории цен" className="h-16 animate-pulse rounded-md bg-muted/60" />
      ) : null}
      {state.status === "error" ? (
        <div role="alert" className="flex items-center gap-3 text-[13px] text-muted-foreground">
          <p>Не удалось загрузить историю цен</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Повторить
          </Button>
        </div>
      ) : null}
      <PanelFooter offers={offers} lowest={state.status === "ready" ? state.history.lowest : null} bggUrl={bggUrl} />
    </div>
  );
}

type PricePanelProps = {
  gameId: number;
  offers: GameOffer[];
  bggUrl: string;
};

/** Loads the game's price history when the panel is first shown. */
export function PricePanel({ gameId, offers, bggUrl }: PricePanelProps) {
  const [state, setState] = useState<HistoryState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const hasOffers = offers.length > 0;

  useEffect(() => {
    // Nothing to list for a game no tracked shop sells, so the request is not made at all.
    if (!hasOffers) return;
    const controller = new AbortController();
    fetch(`/api/games/${gameId}/prices`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Price history request failed: ${response.status}`);
        return response.json() as Promise<GameHistory>;
      })
      .then((history) => setState({ status: "ready", history }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [gameId, hasOffers, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((current) => current + 1);
  }, []);

  return <PricePanelView offers={offers} bggUrl={bggUrl} state={state} onRetry={retry} />;
}
