import { isAllowedByRobots } from "@/lib/prices/robots";
import type { Get } from "@/lib/prices/types";

const DEFAULT_MIN_INTERVAL_MS = 2000;
const MAX_REDIRECTS = 5;

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

type ShopGetOptions = {
  origin: string;
  userAgent: string;
  minIntervalMs?: number;
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
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;

  let queue: Promise<unknown> = Promise.resolve();
  let lastRequestAt: number | null = null;
  let robots: Promise<string> | null = null;

  async function request(url: string): Promise<Response> {
    if (lastRequestAt !== null) {
      const wait = lastRequestAt + minIntervalMs - now();
      if (wait > 0) await sleep(wait);
    }
    try {
      return await fetchImpl(url, { headers: { "user-agent": options.userAgent }, redirect: "manual" });
    } finally {
      lastRequestAt = now();
    }
  }

  async function loadRobots(): Promise<string> {
    const url = `${origin}/robots.txt`;
    const response = await request(url);
    if (response.status === 403 || response.status === 429) throw new ShopBlockedError(response.status, url);
    if (response.status === 404) return "";
    if (!response.ok) throw new Error(`Could not read robots.txt (HTTP ${response.status}): ${url}`);
    return response.text();
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
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return new TextDecoder(encoding).decode(await response.arrayBuffer());
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
