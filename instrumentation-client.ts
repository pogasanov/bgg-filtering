import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { posthogOptions } from "@/lib/posthog-options";
import { siteReplayOptions, siteSentryOptions } from "@/lib/sentry-options";

Sentry.init({
  ...siteSentryOptions,
  ...siteReplayOptions,
  integrations: [Sentry.replayIntegration()],
});

// Without a key (local runs, previews without it) PostHog stays off.
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (posthogKey) posthog.init(posthogKey, posthogOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
