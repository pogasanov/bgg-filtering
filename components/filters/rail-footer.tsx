"use client";

import { RefreshCw } from "lucide-react";
import { PoweredByBgg } from "@/components/powered-by-bgg";
import { Button } from "@/components/ui/button";
import type { CacheStatus } from "@/lib/cache/store";
import { cn } from "@/lib/utils";

type RailFooterProps = {
  status: CacheStatus;
  syncing: boolean;
  syncError: string | null;
  onSync: () => void;
};

export function BggAttribution() {
  return (
    <p className="text-[11px] leading-snug text-muted-foreground">
      Данные:{" "}
      <a href="https://boardgamegeek.com" target="_blank" rel="noreferrer" className="underline underline-offset-2">
        BoardGameGeek
      </a>
      . Не аффилировано с BGG. Только для личного некоммерческого использования.
    </p>
  );
}

/** Service controls live here, out of the way: attribution, cache date, sync and its errors. */
export function RailFooter({ status, syncing, syncError, onSync }: RailFooterProps) {
  const busy = syncing || status.syncLocked;

  return (
    <div className="grid gap-2.5 px-4 py-4">
      <PoweredByBgg />
      <BggAttribution />
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span suppressHydrationWarning>
          {status.cacheUpdatedAt
            ? `Обновлено ${new Date(status.cacheUpdatedAt).toLocaleDateString("ru-RU")}`
            : "Кэш пуст"}
        </span>
        <Button variant="link" size="sm" onClick={onSync} disabled={busy} className="h-auto gap-1 p-0 text-[11px]">
          <RefreshCw className={cn("size-3", busy && "animate-spin")} aria-hidden="true" />
          {busy ? "Синхронизация…" : "Синхронизировать"}
        </Button>
      </div>
      {syncError ? (
        <p role="alert" className="text-[11px] leading-snug text-destructive">
          {syncError}
        </p>
      ) : null}
    </div>
  );
}
