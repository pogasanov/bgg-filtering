import * as Sentry from "@sentry/nextjs";
import { siteReplayOptions, siteSentryOptions } from "@/lib/sentry-options";

Sentry.init({
  ...siteSentryOptions,
  ...siteReplayOptions,
  integrations: [Sentry.replayIntegration()],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
