import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * Crawlers that collect pages to train AI models. The BGG data on the pages must not be used to
 * train AI, so they are kept out. Search crawlers, AI search included (OAI-SearchBot, ChatGPT-User,
 * Claude-SearchBot, Claude-User, PerplexityBot), fall under "*" and may read everything public.
 * Google-Extended also controls Gemini Apps grounding; it does not affect Google Search or its AI answers.
 */
export const AI_TRAINING_AGENTS = [
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "meta-externalagent",
  // The shared "no AI training" signal (draft-kelley-aipref-training-preference-signal).
  "__usage_ai-training",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The API and the analytics relay are not pages. /view, /page/N and /podborka/… are the internal
        // routes behind "/?…", "/?page=N" and the collections ("/na-dvoih"); visitors and links never use them.
        disallow: ["/api/", "/relay/", "/view", "/page/", "/*/page/", "/podborka/"],
        // Yandex: the sort changes the order of a view, not its games.
        other: { "Clean-param": "sort&dir" },
      },
      { userAgent: AI_TRAINING_AGENTS, disallow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
