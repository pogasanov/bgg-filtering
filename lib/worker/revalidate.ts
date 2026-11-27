import { locales, SITE_URLS } from "@/lib/i18n/locale";
import { notifyIndexNow } from "@/lib/indexnow";

/** The public sites, one per language, all served from the same database. */
const PUBLIC_ORIGINS = locales.map((locale) => new URL(SITE_URLS[locale]).origin);

/**
 * Calls the site's /api/revalidate endpoint, then requests the first page of each prebuilt edition
 * language once so the stale-while-revalidate cycle regenerates it before the first visitor arrives.
 *
 * When the address is a public site, every language's site is refreshed the same way, since they
 * share the data, and search engines are told the pages changed (IndexNow). A local or preview run
 * refreshes only itself and must not speak for the public addresses.
 */
export function createRevalidator(
  revalidateUrl: string,
  secret: string,
  fetchImpl: typeof fetch = fetch,
  log: (line: string) => void = (line) => console.log(line),
): () => Promise<void> {
  const post = (url: string) =>
    fetchImpl(url, { method: "POST", headers: { Authorization: `Bearer ${secret}` }, redirect: "manual" });

  /** Posts to the endpoint and returns the address that answered. */
  async function revalidate(url: string): Promise<string> {
    let target = url;
    let response = await post(target);
    // An old address of the site redirects to a public one, and fetch drops the secret on a redirect
    // to another host. Follow it by hand, but hand the secret to no host but the public sites.
    const location = response.status >= 300 && response.status < 400 ? response.headers.get("location") : null;
    if (location && PUBLIC_ORIGINS.includes(new URL(location, target).origin)) {
      target = new URL(location, target).toString();
      response = await post(target);
    }
    if (!response.ok) {
      throw new Error(`Revalidation of ${new URL(target).host} failed with ${response.status} ${response.statusText}`);
    }
    for (const path of ["/", "/ru", "/en"]) {
      await fetchImpl(new URL(path, target).toString(), { method: "GET" }).catch(() => undefined);
    }
    return target;
  }

  return async () => {
    const first = await revalidate(revalidateUrl);
    const firstOrigin = new URL(first).origin;
    if (!PUBLIC_ORIGINS.includes(firstOrigin)) return;
    const endpoint = new URL(first).pathname;
    for (const origin of PUBLIC_ORIGINS) {
      if (origin !== firstOrigin) await revalidate(new URL(endpoint, origin).toString());
    }
    // The pages are already fresh; search engines learning of it late is no reason to fail the run.
    for (const origin of PUBLIC_ORIGINS) {
      try {
        log(`IndexNow ${new URL(origin).host}: ${await notifyIndexNow(origin, fetchImpl)} pages submitted.`);
      } catch (error) {
        log(`IndexNow ${new URL(origin).host} not notified: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };
}
