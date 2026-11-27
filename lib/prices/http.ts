import { isAllowedByRobots } from "@/lib/prices/robots";
import type { Get } from "@/lib/prices/types";

const DEFAULT_MIN_INTERVAL_MS = 2000;
const MAX_REDIRECTS = 5;
const MAX_ATTEMPTS = 3;
/** How long to wait for a shop to start answering. */
const HEADER_TIMEOUT_MS = 30_000;
/**
 * How long a whole download may take. Kept apart from the wait for the first byte:
 * GaGa's sitemap is several megabytes served at ~120 KB/s, so it needs half a minute
 * or more to arrive even when the shop answers at once.
 */
const TRANSFER_TIMEOUT_MS = 180_000;

/** An honest identity: who is asking and why. Never a personal name or email. */
export function buildUserAgent(infoUrl?: string): string {
  const link = infoUrl ? `; +${infoUrl}` : "";
  return `BggPlayerFinderBot/0.1 (non-commercial price history${link})`;
}

/** The shop refused the collector (403 or 429). The caller stops collecting from that shop. */
export class ShopBlockedError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(status: number, url: string) {
    super(`Shop refused the request with HTTP ${status}: ${url}`);
    this.name = "ShopBlockedError";
    this.status = status;
    this.url = url;
  }
}

type Fetched = { status: number; headers: Headers; body: ArrayBuffer };

const ok = (response: Fetched) => response.status >= 200 && response.status < 300;

type ShopGetOptions = {
  origin: string;
  userAgent: string;
  minIntervalMs?: number;
  headerTimeoutMs?: number;
  transferTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

/**
 * A fetcher bound to one shop: one request at a time, spaced apart, never
 * leaving the shop's origin and never requesting what its robots.txt disallows.
 */
export function createShopGet(options: ShopGetOptions): Get {
  const origin = new URL(options.origin).origin;
  const minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
  const headerTimeoutMs = options.headerTimeoutMs ?? HEADER_TIMEOUT_MS;
  const transferTimeoutMs = options.transferTimeoutMs ?? TRANSFER_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;

  let queue: Promise<unknown> = Promise.resolve();
  let lastRequestAt: number | null = null;
  let robots: Promise<string> | null = null;

  /** One request with its body read in full, so a download cut short counts as a dropped connection. */
  async function attempt(url: string): Promise<Fetched> {
    if (lastRequestAt !== null) {
      const wait = lastRequestAt + minIntervalMs - now();
      if (wait > 0) await sleep(wait);
    }
    const waitForAnswer = new AbortController();
    const headerTimer = setTimeout(
      () => waitForAnswer.abort(new DOMException(`No answer within ${headerTimeoutMs} ms`, "TimeoutError")),
      headerTimeoutMs,
    );
    try {
      const response = await fetchImpl(url, {
        headers: { "user-agent": options.userAgent },
        redirect: "manual",
        signal: AbortSignal.any([waitForAnswer.signal, AbortSignal.timeout(transferTimeoutMs)]),
      });
      clearTimeout(headerTimer);
      return { status: response.status, headers: response.headers, body: await response.arrayBuffer() };
    } finally {
      clearTimeout(headerTimer);
      lastRequestAt = now();
    }
  }

  /** One request, tried again when the connection drops. An HTTP answer, even an error, is never retried. */
  async function request(url: string): Promise<Fetched> {
    let lastError: unknown;
    for (let tries = 0; tries < MAX_ATTEMPTS; tries += 1) {
      try {
        return await attempt(url);
      } catch (error) {
        lastError = error;
      }
    }
    const reason = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`No answer from ${url} after ${MAX_ATTEMPTS} attempts: ${reason}`);
  }

  async function loadRobots(): Promise<string> {
    const url = `${origin}/robots.txt`;
    const response = await request(url);
    if (response.status === 403 || response.status === 429) throw new ShopBlockedError(response.status, url);
    if (response.status === 404) return "";
    if (!ok(response)) throw new Error(`Could not read robots.txt (HTTP ${response.status}): ${url}`);
    return new TextDecoder("utf-8").decode(response.body);
  }

  async function run(startUrl: string, encoding: "utf-8" | "windows-1251"): Promise<string> {
    robots ??= loadRobots();
    const rules = await robots;
    let url = startUrl;

    // Redirects are followed by hand so that every hop is held to the same rules
    // as the first request: same shop, allowed by robots.txt, spaced apart.
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const target = new URL(url);
      if (target.origin !== origin) throw new Error(`Refusing ${url}: outside the shop origin ${origin}`);
      if (!isAllowedByRobots(rules, target.pathname + target.search)) throw new Error(`robots.txt disallows ${url}`);

      const response = await request(url);
      if (response.status === 403 || response.status === 429) throw new ShopBlockedError(response.status, url);

      const location = response.status >= 300 && response.status < 400 ? response.headers.get("location") : null;
      if (location) {
        url = new URL(location, url).href;
        continue;
      }
      if (!ok(response)) throw new Error(`HTTP ${response.status} for ${url}`);
      return new TextDecoder(encoding).decode(response.body);
    }

    throw new Error(`Too many redirects starting at ${startUrl}`);
  }

  return (url, opts) => {
    if (new URL(url).origin !== origin) {
      return Promise.reject(new Error(`Refusing ${url}: outside the shop origin ${origin}`));
    }
    const result = queue.then(() => run(url, opts?.encoding ?? "utf-8"));
    queue = result.catch(() => undefined);
    return result;
  };
}
