import { parseThingXml, parseTopRankRows } from "./parser";
import type { NormalizedGame, TopRankItem } from "./types";

const BGG_BASE = "https://boardgamegeek.com";
const DETAILS_BATCH_SIZE = 20;
const REQUEST_DELAY_MS = 5200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": "local-bgg-player-recommendation-finder/0.1",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`BGG request failed ${response.status} ${response.statusText}: ${body.slice(0, 180)}`);
  }

  return response.text();
}

export async function fetchTopRankItems(limit = 500): Promise<{ items: TopRankItem[]; rawPayload: string }> {
  const pages = Math.ceil(limit / 100);
  const allItems: TopRankItem[] = [];
  const rawPages: string[] = [];

  for (let page = 1; page <= pages; page += 1) {
    const html = await fetchText(`${BGG_BASE}/browse/boardgame/page/${page}`);
    rawPages.push(html);
    allItems.push(...parseTopRankRows(html));
    if (page < pages) await sleep(REQUEST_DELAY_MS);
  }

  return {
    items: allItems.slice(0, limit),
    rawPayload: JSON.stringify(
      rawPages.map((html, index) => ({ page: index + 1, html })),
      null,
      2,
    ),
  };
}

export async function fetchGameDetails(
  ids: number[],
  token: string,
): Promise<{ games: NormalizedGame[]; rawXmlByGameId: Record<number, string> }> {
  const games: NormalizedGame[] = [];
  const rawXmlByGameId: Record<number, string> = {};

  for (let index = 0; index < ids.length; index += DETAILS_BATCH_SIZE) {
    const batchIds = ids.slice(index, index + DETAILS_BATCH_SIZE);
    const xml = await fetchText(`${BGG_BASE}/xmlapi2/thing?id=${batchIds.join(",")}&stats=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const parsedGames = parseThingXml(xml);
    for (const game of parsedGames) {
      games.push(game);
      rawXmlByGameId[game.id] = xml;
    }
    if (index + DETAILS_BATCH_SIZE < ids.length) await sleep(REQUEST_DELAY_MS);
  }

  return { games, rawXmlByGameId };
}
