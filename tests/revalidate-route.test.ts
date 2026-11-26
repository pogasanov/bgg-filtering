import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ ...mocks, unstable_cache: (fn: unknown) => fn }));

import { POST } from "@/app/api/revalidate/route";

function request(authorization?: string) {
  return new Request("https://example.vercel.app/api/revalidate", {
    method: "POST",
    headers: authorization ? { Authorization: authorization } : {},
  });
}

beforeEach(() => vi.stubEnv("REVALIDATE_SECRET", "s3cret"));
afterEach(() => {
  vi.unstubAllEnvs();
  mocks.revalidateTag.mockReset();
  mocks.revalidatePath.mockReset();
});

describe("POST /api/revalidate", () => {
  test("401 without authorization", async () => {
    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  test("401 with a wrong secret", async () => {
    const response = await POST(request("Bearer wrong"));

    expect(response.status).toBe(401);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  test("500 and no revalidation when REVALIDATE_SECRET is unset", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "");

    const response = await POST(request("Bearer "));

    expect(response.status).toBe(500);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  test("200 revalidates the catalog tag and the home page", async () => {
    const response = await POST(request("Bearer s3cret"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revalidated: true });
    expect(mocks.revalidateTag).toHaveBeenCalledWith("bgg-catalog", "max");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  });
});
