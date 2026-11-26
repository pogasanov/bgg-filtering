import { describe, expect, test, vi } from "vitest";
import { createRevalidator } from "@/lib/worker/revalidate";

describe("createRevalidator", () => {
  test("posts with the bearer secret then warms the home page", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));

    await createRevalidator("https://x.vercel.app/api/revalidate", "s", fetchImpl)();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://x.vercel.app/api/revalidate",
      expect.objectContaining({ method: "POST", headers: { Authorization: "Bearer s" } }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "https://x.vercel.app/", expect.objectContaining({ method: "GET" }));
  });

  test("throws when revalidation is rejected", async () => {
    const fetchImpl = vi.fn(async () => new Response("no", { status: 401 }));

    await expect(createRevalidator("https://x.vercel.app/api/revalidate", "s", fetchImpl)()).rejects.toThrow("401");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
