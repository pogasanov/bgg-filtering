import { describe, expect, test } from "vitest";
import { buildVercelArgs } from "@/lib/deploy/vercel-args";

describe("buildVercelArgs", () => {
  test("requires VERCEL_TOKEN", () => {
    expect(() => buildVercelArgs(["deploy"], undefined)).toThrow("VERCEL_TOKEN is not set");
    expect(() => buildVercelArgs(["deploy"], "")).toThrow("VERCEL_TOKEN is not set");
  });

  test("appends the token", () => {
    expect(buildVercelArgs(["deploy", "--prod"], "t")).toEqual(["deploy", "--prod", "--token", "t"]);
  });

  test("rejects an explicit --token", () => {
    expect(() => buildVercelArgs(["deploy", "--token", "other"], "t")).toThrow(
      "Pass the token through VERCEL_TOKEN, not --token",
    );
    expect(() => buildVercelArgs(["deploy", "--token=other"], "t")).toThrow(
      "Pass the token through VERCEL_TOKEN, not --token",
    );
  });
});
