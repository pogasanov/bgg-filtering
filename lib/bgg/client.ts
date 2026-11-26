import { parseThingXml } from "./parser";
import type { NormalizedGame } from "./types";

const BGG_BASE = "https://boardgamegeek.com";

/** BGG XML API allows at most 20 IDs per `thing` request. */
export const THING_BATCH_SIZE = 20;
/** Minimum time between the starts of two BGG requests. */
export const REQUEST_SPACING_MS = 5200;

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const BACKOFF_MS = [10_000, 30_000];

export type FetchThingOptions = {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
};

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get("Retry-After"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
  return BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)];
}

export async function fetchThingBatch(
  ids: number[],
  token: string,
  options: FetchThingOptions = {},
): Promise<NormalizedGame[]> {
  const { fetchImpl = fetch, sleep = defaultSleep, maxAttempts = 3 } = options;
  const url = `${BGG_BASE}/xmlapi2/thing?id=${ids.join(",")}&stats=1&versions=1`;

  for (let attempt = 1; ; attempt += 1) {
    const response = await fetchImpl(url, {
      headers: {
        "User-Agent": "bgg-player-recommendation-finder/0.1",
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) return parseThingXml(await response.text());

    const body = await response.text().catch(() => "");
    if (!RETRYABLE_STATUSES.has(response.status) || attempt >= maxAttempts) {
      throw new Error(`BGG request failed ${response.status} ${response.statusText}: ${body.slice(0, 180)}`);
    }
    await sleep(retryDelayMs(response, attempt));
  }
}
