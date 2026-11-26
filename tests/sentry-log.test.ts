import { describe, expect, test, vi } from "vitest";
import { createSentryLog } from "@/lib/worker/sentry-log";

function fakeSentry() {
  return {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    captureException: vi.fn(),
    captureMessage: vi.fn(),
  };
}

describe("createSentryLog", () => {
  test("turns warnings into Sentry warning issues so they alert", () => {
    const sentry = fakeSentry();
    const log = createSentryLog(sentry, { quiet: true });

    log.warn("Database size is above the warning threshold", { bytes: 900 });

    expect(sentry.logger.warn).toHaveBeenCalledWith("Database size is above the warning threshold", { bytes: 900 });
    expect(sentry.captureMessage).toHaveBeenCalledWith("Database size is above the warning threshold", {
      level: "warning",
      extra: { bytes: 900 },
    });
  });

  test("captures errors as exceptions with their attributes", () => {
    const sentry = fakeSentry();
    const error = new Error("BGG request failed 503");

    createSentryLog(sentry, { quiet: true }).error("Batch failed", error, { ids: [3] });

    expect(sentry.captureException).toHaveBeenCalledWith(error, { extra: { message: "Batch failed", ids: [3] } });
  });

  test("keeps info as a log line only", () => {
    const sentry = fakeSentry();

    createSentryLog(sentry, { quiet: true }).info("Batch synced", { games: 20 });

    expect(sentry.logger.info).toHaveBeenCalledWith("Batch synced", { games: 20 });
    expect(sentry.captureMessage).not.toHaveBeenCalled();
  });
});
