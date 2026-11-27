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
  return async () => {
    const response = await fetchImpl(revalidateUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!response.ok) {
      throw new Error(`Revalidation failed with ${response.status} ${response.statusText}`);
    }
    for (const path of ["/", "/en"]) {
      await fetchImpl(new URL(path, revalidateUrl).toString(), { method: "GET" }).catch(() => undefined);
    }
    if (new URL(revalidateUrl).origin !== new URL(SITE_URL).origin) return;
    // The pages are already fresh; search engines learning of it late is no reason to fail the run.
    try {
      log(`IndexNow: ${await notifyIndexNow(SITE_URL, fetchImpl)} pages submitted.`);
    } catch (error) {
      log(`IndexNow not notified: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}
