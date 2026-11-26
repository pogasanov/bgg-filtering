import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "@/app/api/sentry-check/route";

function request(authorization?: string) {
  return new Request("https://example.vercel.app/api/sentry-check", {
    headers: authorization ? { Authorization: authorization } : {},
  });
}

beforeEach(() => vi.stubEnv("REVALIDATE_SECRET", "s3cret"));
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/sentry-check", () => {
  test("401 without the secret", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
  });

  test("throws a deliberate error with the secret", async () => {
    await expect(GET(request("Bearer s3cret"))).rejects.toThrow("Sentry check: deliberate site error");
  });
});
