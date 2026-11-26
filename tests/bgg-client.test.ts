import { describe, expect, test, vi } from "vitest";
import { fetchThingBatch } from "@/lib/bgg/client";

const GAME_XML = '<items><item type="boardgame" id="1"><name type="primary" value="Test"/></item></items>';

function fetchSequence(...responses: Array<() => Response>) {
  const queue = [...responses];
  return vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error("unexpected extra request");
    return next();
  });
}

const noSleep = vi.fn(async () => {});

describe("BGG client", () => {
  test("requests version metadata with game details", async () => {
    const fetchImpl = fetchSequence(() => new Response(GAME_XML));

    await fetchThingBatch([1], "test-token", { fetchImpl, sleep: noSleep });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://boardgamegeek.com/xmlapi2/thing?id=1&stats=1&versions=1",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
  });

  test("retries 503 and then succeeds", async () => {
    const fetchImpl = fetchSequence(
      () => new Response("busy", { status: 503 }),
      () => new Response(GAME_XML),
    );

    const games = await fetchThingBatch([1], "test-token", { fetchImpl, sleep: noSleep });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(games.map((game) => game.title)).toEqual(["Test"]);
  });

  test("honours Retry-After seconds on 429", async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = fetchSequence(
      () => new Response("slow down", { status: 429, headers: { "Retry-After": "7" } }),
      () => new Response(GAME_XML),
    );

    await fetchThingBatch([1], "test-token", { fetchImpl, sleep });

    expect(sleep).toHaveBeenCalledWith(7000);
  });

  test("gives up after 3 attempts", async () => {
    const fetchImpl = fetchSequence(
      () => new Response("busy", { status: 503 }),
      () => new Response("busy", { status: 503 }),
      () => new Response("busy", { status: 503 }),
    );

    await expect(fetchThingBatch([1], "test-token", { fetchImpl, sleep: noSleep })).rejects.toThrow("503");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  test("does not retry 400", async () => {
    const fetchImpl = fetchSequence(() => new Response("bad", { status: 400 }));

    await expect(fetchThingBatch([1], "test-token", { fetchImpl, sleep: noSleep })).rejects.toThrow("400");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
