import { describe, expect, test } from "vitest";
import nextConfig from "@/next.config";

describe("Next development origins", () => {
  test("allows the WSL loopback host used to open the local app", () => {
    expect(nextConfig.allowedDevOrigins).toContain("127.0.0.1");
  });
});

describe("PostHog proxy", () => {
  test("rewrites the proxy path to PostHog ahead of the catalog routes", async () => {
    const rewrites = await nextConfig.rewrites!();
    if (Array.isArray(rewrites)) throw new Error("expected grouped rewrites");
    const [assets, api] = rewrites.beforeFiles ?? [];
    expect(assets).toMatchObject({ source: "/relay/static/:path*", destination: "https://eu-assets.i.posthog.com/static/:path*" });
    expect(api).toMatchObject({ source: "/relay/:path*", destination: "https://eu.i.posthog.com/:path*" });
  });

  test("keeps the trailing slash PostHog's endpoints use", () => {
    expect(nextConfig.skipTrailingSlashRedirect).toBe(true);
  });
});
