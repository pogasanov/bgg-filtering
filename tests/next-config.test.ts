import { describe, expect, test } from "vitest";
import nextConfig from "@/next.config";

describe("Next development origins", () => {
  test("allows the WSL loopback host used to open the local app", () => {
    expect(nextConfig.allowedDevOrigins).toContain("127.0.0.1");
  });
});
