import { describe, expect, test } from "vitest";
import { siteReplayOptions, siteTracesSampleRate } from "@/lib/sentry-options";

describe("site Sentry options", () => {
  test("samples 10% of traces in production and every trace elsewhere", () => {
    expect(siteTracesSampleRate("production")).toBe(0.1);
    expect(siteTracesSampleRate("development")).toBe(1);
    expect(siteTracesSampleRate(undefined)).toBe(1);
  });

  test("records a replay only for sessions with an error", () => {
    expect(siteReplayOptions).toEqual({ replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 1 });
  });
});
