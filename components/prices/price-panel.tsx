"use client";

import { useCallback, useEffect, useState } from "react";
import { PriceChart } from "@/components/prices/price-chart";
import { BggLink, ShopList } from "@/components/prices/shop-list";
import { Button } from "@/components/ui/button";
import type { GameHistory } from "@/lib/prices/history";
import type { GameOffer } from "@/lib/prices/offers";

export type HistoryState = { status: "loading" } | { status: "error" } | { status: "ready"; history: GameHistory };

type PricePanelViewProps = {
  offers: GameOffer[];
  bggUrl: string;
  state: HistoryState;
  onRetry: () => void;
  now: Date;
};

/** The panel's layout for a given load state. Kept free of fetching so every state can be rendered directly. */
export function PricePanelView({ offers, bggUrl, state, onRetry, now }: PricePanelViewProps) {
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
    <div className="grid gap-5 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8">
      {state.status === "ready" ? <PriceChart history={state.history} now={now} /> : null}
      {state.status === "loading" ? (
        <div aria-busy="true" aria-label="Загрузка истории цен" className="h-60 animate-pulse rounded-md bg-muted/60" />
      ) : null}
      {state.status === "error" ? (
        <div role="alert" className="flex h-60 flex-col items-center justify-center gap-3 rounded-md border border-dashed text-[13px] text-muted-foreground">
          <p>Не удалось загрузить историю цен</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Повторить
          </Button>
        </div>
      ) : null}
      <ShopList offers={offers} lowest={state.status === "ready" ? state.history.lowest : null} bggUrl={bggUrl} />
    </div>
  );
}

type PricePanelProps = {
  gameId: number;
  offers: GameOffer[];
  bggUrl: string;
};

/** Loads the game's price history when the panel is first shown. Current offers come with the page. */
export function PricePanel({ gameId, offers, bggUrl }: PricePanelProps) {
  const [state, setState] = useState<HistoryState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [now] = useState(() => new Date());
  const hasOffers = offers.length > 0;

  useEffect(() => {
    // Nothing to chart for a game no tracked shop sells, so the request is not made at all.
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

  return <PricePanelView offers={offers} bggUrl={bggUrl} state={state} onRetry={retry} now={now} />;
}
