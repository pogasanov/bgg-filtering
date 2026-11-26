/**
 * Calls the site's /api/revalidate endpoint, then requests the first page of each prebuilt language
 * once so the stale-while-revalidate cycle regenerates it before the first visitor arrives.
 */
export function createRevalidator(
  revalidateUrl: string,
  secret: string,
  fetchImpl: typeof fetch = fetch,
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
  };
}
