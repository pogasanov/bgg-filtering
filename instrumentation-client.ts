import * as Sentry from "@sentry/nextjs";
import { siteSentryOptions } from "@/lib/sentry-options";

Sentry.init(siteSentryOptions);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
