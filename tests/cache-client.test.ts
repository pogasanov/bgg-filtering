import { expect, test } from "vitest";
import { fetchCacheState } from "@/lib/cache-client";

function fakeFetch(responses: Record<string, { ok: boolean; body: unknown }>) {
  return async (url: string) => ({ ok: responses[url].ok, json: async () => responses[url].body });
}

test("returns games and status when both requests succeed", async () => {
  const state = await fetchCacheState(
    fakeFetch({ "/api/games": { ok: true, body: { games: [] } }, "/api/status": { ok: true, body: { gameCount: 0 } } }),
  );
  expect(state).toEqual({ games: [], status: { gameCount: 0 } });
});

test("rejects instead of handing back an error payload as data", async () => {
  const failing = fakeFetch({
    "/api/games": { ok: false, body: { error: "boom" } },
    "/api/status": { ok: true, body: { gameCount: 0 } },
  });
  await expect(fetchCacheState(failing)).rejects.toThrow();
});
