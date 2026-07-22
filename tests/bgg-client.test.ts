import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchGameDetails } from "@/lib/bgg/client";

afterEach(() => vi.unstubAllGlobals());

describe("BGG client", () => {
  test("requests version metadata with game details", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('<items><item type="boardgame" id="1"><name type="primary" value="Test"/></item></items>'),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchGameDetails([1], "test-token");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://boardgamegeek.com/xmlapi2/thing?id=1&stats=1&versions=1",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
  });
});
