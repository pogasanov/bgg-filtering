import type { SyncLog } from "@/lib/sync";

type Attributes = Record<string, unknown>;

/** The slice of the Sentry SDK the worker log uses. */
export type SentryLike = {
  logger: {
    info(message: string, attributes?: Attributes): void;
    warn(message: string, attributes?: Attributes): void;
    error(message: string, attributes?: Attributes): void;
  };
  captureException(error: unknown, context: { extra: Attributes }): unknown;
  captureMessage(message: string, context: { level: "warning"; extra?: Attributes }): unknown;
};

/**
 * Worker log that writes to the console and Sentry Logs. Warnings and errors also become
 * Sentry issues, so they trigger alerts instead of sitting in the log stream.
 */
export function createSentryLog(sentry: SentryLike, options: { quiet?: boolean } = {}): SyncLog {
  const consoleLog = options.quiet ? () => {} : console.log;
  const consoleWarn = options.quiet ? () => {} : console.warn;
  const consoleError = options.quiet ? () => {} : console.error;

  return {
    info(message, attributes) {
      consoleLog(message, attributes ?? "");
      sentry.logger.info(message, attributes);
    },
    warn(message, attributes) {
      consoleWarn(message, attributes ?? "");
      sentry.logger.warn(message, attributes);
      sentry.captureMessage(message, { level: "warning", extra: attributes });
    },
    error(message, error, attributes) {
      consoleError(message, error, attributes ?? "");
      sentry.logger.error(message, { ...attributes, error: error instanceof Error ? error.message : String(error) });
      sentry.captureException(error, { extra: { message, ...attributes } });
    },
  };
}
