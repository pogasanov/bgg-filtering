import { notifyIndexNow } from "@/lib/indexnow";
import { SITE_URL } from "@/lib/seo";

/**
 * Calls the site's /api/revalidate endpoint, then requests the first page of each prebuilt language
 * once so the stale-while-revalidate cycle regenerates it before the first visitor arrives. For the
 * public site it then tells search engines the pages changed (IndexNow); a local or preview
 * run must not speak for the public address.
 */
export function createRevalidator(
  revalidateUrl: string,
  secret: string,
  fetchImpl: typeof fetch = fetch,
  log: (line: string) => void = (line) => console.log(line),
): () => Promise<void> {
  const post = (url: string) =>
    fetchImpl(url, { method: "POST", headers: { Authorization: `Bearer ${secret}` }, redirect: "manual" });
  return async () => {
    let target = revalidateUrl;
    let response = await post(target);
    // An old address of the site redirects to the public one, and fetch drops the secret on a
    // redirect to another host. Follow it by hand, but hand the secret to no other host.
    const location = response.status >= 300 && response.status < 400 ? response.headers.get("location") : null;
    if (location && new URL(location, target).origin === new URL(SITE_URL).origin) {
      target = new URL(location, target).toString();
      response = await post(target);
    }
    if (!response.ok) {
      throw new Error(`Revalidation failed with ${response.status} ${response.statusText}`);
    }
    for (const path of ["/", "/en"]) {
      await fetchImpl(new URL(path, target).toString(), { method: "GET" }).catch(() => undefined);
    }
    if (new URL(target).origin !== new URL(SITE_URL).origin) return;
    // The pages are already fresh; search engines learning of it late is no reason to fail the run.
    try {
      log(`IndexNow: ${await notifyIndexNow(SITE_URL, fetchImpl)} pages submitted.`);
    } catch (error) {
      log(`IndexNow not notified: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}
