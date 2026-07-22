"use client";

import { RefreshCw, Search, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { CacheStatus } from "@/lib/cache/store";
import { filterGames, gameTags } from "@/lib/filtering";
import {
  playerCounts,
  type MatrixSelection,
  type NormalizedGame,
  type MatrixVerdict,
  type SortKey,
  matrixVerdicts,
} from "@/lib/bgg/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PoweredByBgg } from "@/components/powered-by-bgg";
import { cn } from "@/lib/utils";

type BggAppProps = {
  initialGames: NormalizedGame[];
  initialStatus: CacheStatus;
};

const verdictLabels: Record<MatrixVerdict, string> = {
  best: "BEST",
  recommended: "RECOMMENDED",
  "not-recommended": "NOT RECOMMENDED",
  "not-playable": "NOT PLAYABLE",
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
  const [language, setLanguage] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<MatrixSelection[]>([]);
  const [sort, setSort] = useState<SortKey>("rank");
  const [minYear, setMinYear] = useState<number | null>(null);
  const [maxYear, setMaxYear] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allTags = useMemo(
    () => [...new Set(games.flatMap((game) => gameTags(game)))].sort(),
    [games],
  );
  const allLanguages = useMemo(
    () => [...new Set(games.flatMap((game) => game.languages))].sort(),
    [games],
  );
  const yearLimits = useMemo(() => {
    const knownYears = games
      .map((game) => game.year)
      .filter((year): year is number => year !== null);

    if (knownYears.length === 0) return null;
    return {
      oldest: Math.min(...knownYears),
      newest: Math.max(...knownYears),
    };
  }, [games]);

  useEffect(() => {
    setMinYear((current) => {
      if (current === null || yearLimits === null) return null;
      return Math.min(Math.max(current, yearLimits.oldest), yearLimits.newest);
    });
    setMaxYear((current) => {
      if (current === null || yearLimits === null) return null;
      return Math.min(Math.max(current, yearLimits.oldest), yearLimits.newest);
    });
  }, [yearLimits]);

  const sliderMin = yearLimits ? yearLimits.oldest - 1 : 0;
  const sliderMax = yearLimits ? yearLimits.newest + 1 : 1;
  const minSliderValue = minYear ?? sliderMin;
  const maxSliderValue = maxYear ?? sliderMax;
  const yearRangeLabel = (minYear ?? "No min") + " \u2013 " + (maxYear ?? "No max");
  const filteredGames = useMemo(
    () => filterGames(games, { search, language, tags: selectedTags, matrix, sort, minYear, maxYear }),
    [games, search, language, selectedTags, matrix, sort, minYear, maxYear],
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

  function updateYearRange([minimum, maximum]: number[]) {
    setMinYear(minimum === sliderMin ? null : minimum);
    setMaxYear(maximum === sliderMax ? null : maximum);
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
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-primary">BoardGameGeek local cache</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal sm:text-4xl">Player-count game finder</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Top BGG games cached in SQLite, with selectable recommendation cells by player count.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Data source:{" "}
            <a href="https://boardgamegeek.com" target="_blank" rel="noreferrer" className="font-medium underline">
              BoardGameGeek
            </a>
            .
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

      <Separator />

      {games.length === 0 ? (
        <Alert>
          <AlertTitle>SQLite cache is empty</AlertTitle>
          <AlertDescription>
            Add BGG_TOKEN to .env.local and place boardgames_ranks.csv in the project root, then use Sync BGG.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="game-search">Search</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="game-search"
                    className="pl-9"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Game title"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sort">Sort</Label>
                <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
                  <SelectTrigger id="sort" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rank">BGG rank</SelectItem>
                    <SelectItem value="geekRating">Geek Rating</SelectItem>
                    <SelectItem value="averageRating">Average rating</SelectItem>
                    <SelectItem value="year">Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="language">Translation language</Label>
                <Select
                  value={language || "all"}
                  onValueChange={(value) => setLanguage(value === "all" ? "" : value)}
                >
                  <SelectTrigger id="language" className="w-full">
                    <SelectValue>{language || "Any language"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any language</SelectItem>
                    {allLanguages.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <fieldset disabled={!yearLimits} className="grid gap-3">
                <legend className="sr-only">Year</legend>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">Year</span>
                  <output className="text-xs text-muted-foreground">{yearRangeLabel}</output>
                </div>
                <Slider
                  aria-label="Publication year range"
                  min={sliderMin}
                  max={sliderMax}
                  step={1}
                  minStepsBetweenThumbs={1}
                  value={[minSliderValue, maxSliderValue]}
                  onValueChange={updateYearRange}
                  disabled={!yearLimits}
                />
                <div className="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
                  <span>No min</span>
                  <span>No max</span>
                </div>
              </fieldset>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Categories + mechanics</p>
                  {selectedTags.length > 0 ? (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedTags([])}>
                      <X className="size-3" />
                      Clear
                    </Button>
                  ) : null}
                </div>
                <ScrollArea className="h-64 rounded-md border">
                  <div className="space-y-1 p-2">
                    {allTags.map((tag) => (
                      <Label
                        key={tag}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 font-normal hover:bg-muted"
                      >
                        <Checkbox
                          checked={selectedTags.includes(tag)}
                          onCheckedChange={() => toggleTag(tag)}
                        />
                        <span>{tag}</span>
                      </Label>
                    ))}
                  </div>
                </ScrollArea>
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
                <Table className="min-w-[36rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Players</TableHead>
                      {matrixVerdicts.map((verdict) => (
                        <TableHead key={verdict} className="text-center">
                          {verdictLabels[verdict]}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {playerCounts.map((playerCount) => (
                      <TableRow key={playerCount}>
                        <TableHead className="bg-muted/50">{playerCount}</TableHead>
                        {matrixVerdicts.map((verdict) => {
                          const selected = selectedMatrixKeys.has(`${playerCount}:${verdict}`);
                          return (
                            <TableCell key={verdict} className="p-1">
                              <Button
                                type="button"
                                variant={selected ? "default" : "ghost"}
                                size="sm"
                                className="w-full"
                                onClick={() => toggleMatrixCell({ playerCount, verdict })}
                              >
                                {selected ? "Selected" : "Any"}
                              </Button>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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

          {syncError ? (
            <Alert variant="destructive">
              <AlertTitle>Sync failed</AlertTitle>
              <AlertDescription>{syncError}</AlertDescription>
            </Alert>
          ) : null}


          <div className="flex items-center justify-between text-sm text-muted-foreground">
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
                      {game.year ? <span className="text-sm text-muted-foreground">({game.year})</span> : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {gameTags(game).slice(0, 8).map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="grid min-w-40 grid-cols-2 gap-2 text-sm md:text-right">
                    <span className="text-muted-foreground">Geek</span>
                    <strong>{formatNumber(game.geekRating)}</strong>
                    <span className="text-muted-foreground">Avg</span>
                    <strong>{formatNumber(game.averageRating)}</strong>
                    <span className="text-muted-foreground">Voters</span>
                    <strong>{formatNumber(game.numVoters, 0)}</strong>
                    <span className="text-muted-foreground">Players</span>
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
      <Separator />

      <footer className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p>
            Board game data is sourced from{" "}
            <a href="https://boardgamegeek.com" target="_blank" rel="noreferrer" className="font-medium underline">
              BoardGameGeek
            </a>
            . This app is not affiliated with or endorsed by BoardGameGeek.
          </p>
          <p className="mt-1">Non-commercial local browsing only. API data is not used for AI or LLM training.</p>
        </div>
        <PoweredByBgg />
      </footer>
    </main>
  );
}
