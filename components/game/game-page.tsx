import Link from "next/link";
import type { ReactNode } from "react";
import { PriceChanges } from "@/components/prices/price-changes";
import { BggAttribution, PoweredByBgg } from "@/components/powered-by-bgg";
import { PersonalPrice } from "@/components/results/personal-price";
import type { ListedGame } from "@/lib/bgg/types";
import { mechanicCollectionPath, playerCollectionPath } from "@/lib/collections";
import { gameName, gamePath, gameSummary, pollVerdicts } from "@/lib/game-page";
import { mechanicLabel } from "@/lib/i18n/mechanics";
import { formatNumber, playerCountText } from "@/lib/labels";
import { pollCells, type PollCell } from "@/lib/poll";
import { changeRows } from "@/lib/prices/changes";
import type { GameHistory } from "@/lib/prices/history";
import { formatPrice, inStock, shopNames, type GameOffer } from "@/lib/prices/offers";
import { SITE_URL } from "@/lib/seo";
import { cn } from "@/lib/utils";

/*
 * A game's own page: what the player-count poll says, what the tracked shops ask, its mechanics.
 * Server-rendered and cached with the catalog; the text is Russian, like the catalog's first render.
 */

const linkClass = "underline-offset-2 hover:underline outline-none focus-visible:underline";
const chipClass = "rounded-[4px] border px-2 py-0.5 text-xs hover:bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { timeZone: "UTC" });
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-mono font-semibold tabular-nums">{children}</div>
    </div>
  );
}

function playersRange({ minPlayers, maxPlayers }: ListedGame): string {
  if (minPlayers === null && maxPlayers === null) return "—";
  if (minPlayers === null || maxPlayers === null || minPlayers === maxPlayers) return String(minPlayers ?? maxPlayers);
  return `${minPlayers}–${maxPlayers}`;
}

function WeightMeter({ weight }: { weight: number }) {
  const filled = Math.round(weight);
  return (
    <span className="mr-1.5 inline-flex gap-0.5 align-[-1px]" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((step) => (
        <span key={step} className={cn("meter-bar", step <= filled ? "bg-meter" : "bg-border")} />
      ))}
    </span>
  );
}

const verdictText: Record<PollCell["verdict"], string> = {
  best: "лучше всего",
  recommended: "рекомендуют",
  "not-recommended": "не рекомендуют",
  unknown: "нет данных",
};

function cellClass(cell: PollCell) {
  return cn(
    "poll-cell",
    cell.verdict === "best" && "bg-poll-best text-poll-best-foreground",
    cell.verdict === "recommended" && "bg-poll-rec text-poll-rec-foreground",
    cell.verdict === "not-recommended" && "bg-poll-no text-poll-no-foreground ring-1 ring-poll-no-border ring-inset",
    !cell.inRange && "opacity-40",
  );
}

const headClass = "h-8 border-b bg-muted/50 px-2 text-left text-xs font-medium text-muted-foreground";
const cellPad = "border-b px-2 py-2 align-middle";

function PollTable({ game }: { game: ListedGame }) {
  const cells = pollCells(game);
  const voted = cells.filter((cell) => cell.best + cell.recommended + cell.notRecommended > 0 && cell.verdict !== "unknown");
  const silent = cells.filter((cell) => !voted.includes(cell)).map((cell) => playerCountText(cell.playerCount));
  if (voted.length === 0) return <p className="text-[13px] text-muted-foreground">На BGG пока нет голосов по числу игроков.</p>;

  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr>
          <th className={headClass}>Игроки</th>
          <th className={headClass}>Голоса: лучше · рекомендуют · не рек.</th>
          <th className={cn(headClass, "hidden text-right sm:table-cell")}>Голосов</th>
          <th className={headClass}>Итог</th>
        </tr>
      </thead>
      <tbody>
        {voted.map((cell) => {
          const total = cell.best + cell.recommended + cell.notRecommended;
          const shares = [cell.best, cell.recommended, cell.notRecommended].map((votes) => (votes / total) * 100);
          return (
            <tr key={cell.playerCount}>
              <td className={cellPad}>
                <span className={cellClass(cell)}>{playerCountText(cell.playerCount)}</span>
              </td>
              <td className={cn(cellPad, "w-full")}>
                <div className="flex h-2.5 min-w-24 overflow-hidden rounded-[3px] bg-muted" aria-hidden="true">
                  <span className="bg-poll-best" style={{ width: `${shares[0]}%` }} />
                  <span className="bg-poll-rec" style={{ width: `${shares[1]}%` }} />
                  <span className="bg-poll-no-border" style={{ width: `${shares[2]}%` }} />
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                  {shares.map((share) => `${Math.round(share)}%`).join(" · ")}
                </div>
              </td>
              <td className={cn(cellPad, "hidden text-right font-mono text-muted-foreground tabular-nums sm:table-cell")}>
                {formatNumber(total, 0)}
              </td>
              <td className={cn(cellPad, "text-xs whitespace-nowrap", cell.verdict === "best" && "font-semibold")}>
                {verdictText[cell.verdict]}
                {cell.inRange ? null : <span className="block font-normal text-muted-foreground">вне диапазона игроков</span>}
              </td>
            </tr>
          );
        })}
        {silent.length > 0 ? (
          <tr>
            <td className={cn(cellPad, "text-xs text-muted-foreground")} colSpan={4}>
              Нет голосов: {silent.join(", ")}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

function availability(offer: GameOffer): string {
  if (offer.stale) return offer.checkedAt ? `проверено ${day(offer.checkedAt)}` : "не проверялась";
  if (offer.price === null) return "без цены";
  return offer.available === false ? "нет в наличии" : "в наличии";
}

function Prices({ game, history }: { game: ListedGame; history: GameHistory }) {
  if (game.offers.length === 0) {
    return <p className="text-[13px] text-muted-foreground">Игра не найдена в отслеживаемых магазинах.</p>;
  }
  const rows = changeRows(history, game.offers);
  const checks = game.offers.flatMap((offer) => (offer.checkedAt ? [offer.checkedAt] : [])).sort();
  const updatedAt = checks.at(-1);

  return (
    <div className="grid gap-3">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={headClass}>Магазин</th>
            <th className={cn(headClass, "text-right")}>Цена</th>
            <th className={cn(headClass, "hidden sm:table-cell")}>Наличие</th>
            <th className={headClass} />
          </tr>
        </thead>
        <tbody>
          {game.offers.map((offer) => {
            const buyable = inStock(offer);
            return (
              <tr key={offer.shop} className={cn(!buyable && "text-muted-foreground")}>
                <td className={cellPad}>
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className="size-2 flex-none rounded-full" style={{ backgroundColor: `var(--shop-${offer.shop})` }} />
                    {shopNames[offer.shop]}
                  </span>
                </td>
                <td className={cn(cellPad, "text-right font-mono tabular-nums")}>
                  <span className="inline-flex flex-col items-end leading-tight">
                    <span className={cn(buyable && "font-semibold")}>
                      {buyable && offer.salePercent !== null ? <span className="mr-1 text-[11px] font-normal text-muted-foreground">−{offer.salePercent}%</span> : null}
                      {formatPrice(offer.price)}
                    </span>
                    {buyable ? <PersonalPrice shop={offer.shop} price={offer.price} /> : null}
                    <span className="font-sans text-[11px] sm:hidden">{buyable ? null : availability(offer)}</span>
                  </span>
                </td>
                <td className={cn(cellPad, "hidden sm:table-cell")}>{availability(offer)}</td>
                <td className={cn(cellPad, "text-right")}>
                  <a href={offer.url} target="_blank" rel="noreferrer" className={cn(chipClass, "whitespace-nowrap")}>
                    В магазин ↗
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {history.lowest ? (
          <span>
            Самая низкая цена за всё время <span className="font-mono text-foreground">{formatPrice(history.lowest.price)}</span> ·{" "}
            {shopNames[history.lowest.shop]}, {day(history.lowest.at)}
          </span>
        ) : null}
        {updatedAt ? <span>Цены обновлены {day(updatedAt)}</span> : null}
      </p>
      {rows.length > 0 ? (
        <div>
          <h3 className="mb-1 text-xs font-medium text-muted-foreground">Изменения цен</h3>
          <PriceChanges rows={rows} game={{ gameId: game.id, title: gameName(game) }} />
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2 text-[13px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Product markup for the shop prices, and the breadcrumb trail. Only what the page itself shows. */
function structuredData(game: ListedGame, bestCollection: { name: string; path: string } | null) {
  const name = gameName(game);
  const url = `${SITE_URL}${gamePath(game.id, name)}`;
  const prices = game.offers.filter(inStock).map((offer) => offer.price as number);
  const crumbs = [
    { name: "Каталог", path: "/" },
    ...(bestCollection ? [bestCollection] : []),
    { name, path: gamePath(game.id, name) },
  ];
  return [
    // Search engines show a price only for something on sale, so the product is described only then.
    ...(prices.length > 0
      ? [
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name,
            ...(game.titleRu && game.titleRu !== game.title ? { alternateName: game.title } : {}),
            ...(game.thumbnailUrl ? { image: game.thumbnailUrl } : {}),
            url,
            offers: {
              "@type": "AggregateOffer",
              priceCurrency: "RUB",
              lowPrice: Math.min(...prices),
              highPrice: Math.max(...prices),
              offerCount: prices.length,
              availability: "https://schema.org/InStock",
            },
          },
        ]
      : []),
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, name: crumb.name, item: `${SITE_URL}${crumb.path}` })),
    },
  ];
}

const playersPhrase: Record<string, string> = {
  "1": "для одного",
  "2": "на двоих",
  "3": "на троих",
  "4": "на четверых",
  "5": "на пятерых",
  "6": "на шестерых",
  "6+": "на компанию от семи",
};

export function GamePage({ game, history }: { game: ListedGame; history: GameHistory }) {
  const name = gameName(game);
  const { best } = pollVerdicts(game);
  const bestCollection = best.length > 0 ? { name: `Лучшие ${playersPhrase[best[0]]}`, path: playerCollectionPath(best[0]) } : null;
  const mechanics = [...game.mechanics].sort((a, b) => mechanicLabel(a, "ru").localeCompare(mechanicLabel(b, "ru"), "ru"));
  const subtitle = [game.titleRu && game.titleRu !== game.title ? game.title : null, game.year, game.rank !== null ? `№ ${game.rank} в рейтинге BGG` : null]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(game, bestCollection)).replace(/</g, "\\u003c") }}
      />
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background px-4 py-2.5">
        <Link href="/" className={cn(linkClass, "text-[13px] whitespace-nowrap")}>
          ← Каталог
        </Link>
        {/* A plain form: the catalog's own search takes over from "/?q=…". */}
        <form action="/" className="max-w-xl flex-1">
          <input
            type="search"
            name="q"
            placeholder="Поиск по названию…"
            aria-label="Поиск по названию"
            className="h-9 w-full rounded-md border bg-transparent px-3 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </form>
      </header>

      <main className="mx-auto max-w-[860px] px-4 pt-4 pb-10">
        <nav aria-label="Навигация" className="mb-3.5 text-xs text-muted-foreground">
          <Link href="/" className={linkClass}>
            Каталог
          </Link>
          {bestCollection ? (
            <>
              {" / "}
              <Link href={bestCollection.path} className={linkClass}>
                {bestCollection.name}
              </Link>
            </>
          ) : null}
          {" / "}
          <span>{name}</span>
        </nav>

        <div className="flex items-start gap-4">
          {game.thumbnailUrl ? (
            <img
              src={game.thumbnailUrl}
              alt={name}
              width={88}
              height={88}
              referrerPolicy="no-referrer"
              className="size-16 flex-none rounded-lg bg-muted object-cover sm:size-[88px]"
            />
          ) : (
            <span aria-hidden="true" className="size-16 flex-none rounded-lg bg-muted sm:size-[88px]" />
          )}
          <div className="min-w-0">
            <h1 className="text-[19px] leading-tight font-semibold tracking-tight sm:text-[22px]">{name}</h1>
            {subtitle ? <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p> : null}
            <div className="mt-2.5 flex flex-wrap gap-x-[18px] gap-y-1.5 text-[13px]">
              <Stat label="Игроки">{playersRange(game)}</Stat>
              <Stat label="Время">{game.playingTime === null ? "—" : `${game.playingTime}′`}</Stat>
              <Stat label="Сложность">
                {game.weight !== null ? <WeightMeter weight={game.weight} /> : null}
                {formatNumber(game.weight, 1)}
              </Stat>
              <Stat label="Geek">{formatNumber(game.geekRating, 2)}</Stat>
              <Stat label="Средний">{formatNumber(game.averageRating, 2)}</Stat>
              <Stat label="Оценок">{formatNumber(game.numVoters, 0)}</Stat>
            </div>
          </div>
        </div>

        <p className="mt-[18px] max-w-[70ch] text-sm">{gameSummary(game)}</p>

        <Section title="На сколько игроков">
          <PollTable game={game} />
        </Section>

        <Section title="Цены в магазинах">
          <Prices game={game} history={history} />
        </Section>

        {mechanics.length > 0 ? (
          <Section title="Механики">
            <ul className="flex flex-wrap gap-1.5">
              {mechanics.map((mechanic) => (
                <li key={mechanic}>
                  <Link href={mechanicCollectionPath(mechanic)} className={cn(chipClass, "inline-block")}>
                    {mechanicLabel(mechanic, "ru")}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section title="Ещё">
          <ul className="flex flex-wrap gap-1.5">
            <li>
              <a href={game.bggUrl} target="_blank" rel="noreferrer" className={cn(chipClass, "inline-block")}>
                Страница на BoardGameGeek ↗
              </a>
            </li>
            {bestCollection ? (
              <li>
                <Link href={bestCollection.path} className={cn(chipClass, "inline-block")}>
                  Лучшие настолки {playersPhrase[best[0]]}
                </Link>
              </li>
            ) : null}
          </ul>
        </Section>
      </main>

      <footer className="mx-auto grid max-w-[860px] gap-2 border-t px-4 py-4">
        <PoweredByBgg />
        <BggAttribution />
      </footer>
    </>
  );
}
