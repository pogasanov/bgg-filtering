"use client";

import { RefreshCw, Search, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import type { CacheStatus } from "@/lib/cache/store";
import { filterGames } from "@/lib/filtering";
import {
  playerCounts,
  type MatrixSelection,
  type NormalizedGame,
  type RecommendationVerdict,
  type SortKey,
  verdicts,
} from "@/lib/bgg/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type BggAppProps = {
  initialGames: NormalizedGame[];
  initialStatus: CacheStatus;
};

const verdictLabels: Record<Exclude<RecommendationVerdict, "unknown">, string> = {
  best: "BEST",
  recommended: "RECOMMENDED",
  "not-recommended": "NOT RECOMMENDED",
};

function matrixKey(selection: MatrixSelection) {
  return `${selection.playerCount}:${selection.verdict}`;
}

function formatNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function BggApp({ initialGames, initialStatus }: BggAppProps) {
  const [games, setGames] = useState(initialGames);
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<MatrixSelection[]>([]);
  const [sort, setSort] = useState<SortKey>("rank");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allTags = useMemo(
    () => [...new Set(games.flatMap((game) => [...game.categories, ...game.mechanics]))].sort(),
    [games],
  );
  const filteredGames = useMemo(
    () => filterGames(games, { search, tags: selectedTags, matrix, sort }),
    [games, search, selectedTags, matrix, sort],
  );
  const selectedMatrixKeys = new Set(matrix.map(matrixKey));

  function toggleMatrixCell(selection: MatrixSelection) {
    const key = matrixKey(selection);
    setMatrix((current) =>
      current.some((item) => matrixKey(item) === key)
        ? current.filter((item) => matrixKey(item) !== key)
        : [...current, selection],
    );
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  }

  async function refreshLocalState() {
    const [gamesResponse, statusResponse] = await Promise.all([fetch("/api/games"), fetch("/api/status")]);
    const gamesPayload = (await gamesResponse.json()) as { games: NormalizedGame[] };
    const statusPayload = (await statusResponse.json()) as CacheStatus;
    setGames(gamesPayload.games);
    setStatus(statusPayload);
  }

  function sync() {
    setSyncError(null);
    startTransition(async () => {
      const response = await fetch("/api/sync", { method: "POST" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setSyncError(payload.error ?? "Sync failed.");
        await refreshLocalState();
        return;
      }
      await refreshLocalState();
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--accent)]">BoardGameGeek local cache</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal sm:text-4xl">Player-count game finder</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted-foreground)]">
            Top BGG games cached in SQLite, with selectable recommendation cells by player count.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{status.gameCount} cached games</Badge>
          <Button onClick={sync} disabled={isPending || status.syncLocked}>
            <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
            Sync BGG
          </Button>
        </div>
      </header>

      {games.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>SQLite cache is empty</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[var(--muted-foreground)]">
            <p>Add `BGG_TOKEN` to `.env.local`, then use Sync BGG to populate `data/bgg-cache.sqlite`.</p>
            {syncError ? <p className="text-[var(--destructive)]">{syncError}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block text-sm font-medium">
                Search
                <span className="relative mt-1 block">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
                  <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Game title" />
                </span>
              </label>

              <label className="block text-sm font-medium">
                Sort
                <Select className="mt-1 w-full" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
                  <option value="rank">BGG rank</option>
                  <option value="geekRating">Geek Rating</option>
                  <option value="averageRating">Average rating</option>
                  <option value="year">Year</option>
                </Select>
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Categories + mechanics</p>
                  {selectedTags.length > 0 ? (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedTags([])}>
                      <X className="h-3 w-3" />
                      Clear
                    </Button>
                  ) : null}
                </div>
                <div className="max-h-64 space-y-1 overflow-auto rounded-md border bg-[var(--card)] p-2">
                  {allTags.map((tag) => (
                    <label key={tag} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-[var(--muted)]">
                      <input type="checkbox" checked={selectedTags.includes(tag)} onChange={() => toggleTag(tag)} />
                      <span>{tag}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Player recommendation matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border p-2 text-left">Players</th>
                      {verdicts.map((verdict) => (
                        <th key={verdict} className="border p-2 text-center">
                          {verdictLabels[verdict]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {playerCounts.map((playerCount) => (
                      <tr key={playerCount}>
                        <th className="border bg-[var(--muted)] p-2 text-left">{playerCount}</th>
                        {verdicts.map((verdict) => {
                          const selected = selectedMatrixKeys.has(`${playerCount}:${verdict}`);
                          return (
                            <td key={verdict} className="border p-1">
                              <Button
                                type="button"
                                variant={selected ? "default" : "ghost"}
                                size="sm"
                                className="w-full"
                                onClick={() => toggleMatrixCell({ playerCount, verdict })}
                              >
                                {selected ? "Selected" : "Any"}
                              </Button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {matrix.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {matrix.map((selection) => (
                    <Badge key={matrixKey(selection)}>
                      {selection.playerCount} players: {verdictLabels[selection.verdict]}
                    </Badge>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => setMatrix([])}>
                    Clear matrix
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {syncError ? <p className="rounded-md border border-[var(--destructive)] p-3 text-sm text-[var(--destructive)]">{syncError}</p> : null}

          <div className="flex items-center justify-between text-sm text-[var(--muted-foreground)]">
            <span>
              Showing {filteredGames.length} of {games.length}
            </span>
            <span>{status.cacheUpdatedAt ? `Cache updated ${new Date(status.cacheUpdatedAt).toLocaleString()}` : "No cache timestamp"}</span>
          </div>

          <div className="grid gap-3">
            {filteredGames.map((game) => (
              <Card key={game.id}>
                <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>#{game.rank ?? "—"}</Badge>
                      <a href={game.bggUrl} target="_blank" rel="noreferrer" className="text-lg font-semibold hover:underline">
                        {game.title}
                      </a>
                      {game.year ? <span className="text-sm text-[var(--muted-foreground)]">({game.year})</span> : null}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-[var(--muted-foreground)]">{game.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {[...game.categories, ...game.mechanics].slice(0, 8).map((tag) => (
                        <Badge key={tag} className="bg-transparent">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="grid min-w-40 grid-cols-2 gap-2 text-sm md:text-right">
                    <span className="text-[var(--muted-foreground)]">Geek</span>
                    <strong>{formatNumber(game.geekRating)}</strong>
                    <span className="text-[var(--muted-foreground)]">Avg</span>
                    <strong>{formatNumber(game.averageRating)}</strong>
                    <span className="text-[var(--muted-foreground)]">Voters</span>
                    <strong>{formatNumber(game.numVoters, 0)}</strong>
                    <span className="text-[var(--muted-foreground)]">Players</span>
                    <strong>
                      {game.minPlayers ?? "—"}-{game.maxPlayers ?? "—"}
                    </strong>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
