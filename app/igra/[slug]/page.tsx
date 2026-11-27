import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { GamePage } from "@/components/game/game-page";
import { loadCachedGame, loadCachedGameNames } from "@/lib/catalog/cached";
import { gameIdFromSlug, gameName, gamePath, gameSummary, GAME_ROUTE } from "@/lib/game-page";
import { SITE_NAME } from "@/lib/seo";

// A game's page ("/igra/266192-krylya"). Static like the catalog: built once, rebuilt every 12 hours
// and after a sync or price run.
export const ensureStatic = "navigation";

type Props = { params: Promise<{ slug: string }> };

/** How many of the best-ranked games are built with the site; the rest on their first request. */
const PREBUILT_GAMES = 200;

export async function generateStaticParams() {
  const names = await loadCachedGameNames();
  const params = names.slice(0, PREBUILT_GAMES).map((game) => ({ slug: gamePath(game.id, gameName(game)).slice(GAME_ROUTE.length + 2) }));
  // At least one entry is required; with an empty catalog the page is simply not found.
  return params.length > 0 ? params : [{ slug: "1" }];
}

/** The game for the segment; only listed games are looked up, so made-up ids never reach the database. */
async function resolve(params: Props["params"]) {
  const slug = (await params).slug;
  const id = gameIdFromSlug(slug);
  if (id === null || !(await loadCachedGameNames()).some((game) => game.id === id)) return null;
  const data = await loadCachedGame(id);
  return data === null ? null : { ...data, slug };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await resolve(params);
  if (found === null) return {};
  const { game } = found;
  const name = gameName(game);
  const title = `${name}${game.titleRu && game.titleRu !== game.title ? ` (${game.title})` : ""} — на сколько игроков и цены`;
  const description = gameSummary(game);
  const url = gamePath(game.id, name);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "ru_RU", title, description, url },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function GameRoute({ params }: Props) {
  const found = await resolve(params);
  if (found === null) notFound();
  // An old or shortened name in the address leads to the current one.
  const canonical = gamePath(found.game.id, gameName(found.game));
  if (`/${GAME_ROUTE}/${found.slug}` !== canonical) permanentRedirect(canonical);
  return <GamePage game={found.game} history={found.history} />;
}
