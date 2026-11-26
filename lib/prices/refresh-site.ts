import { createRevalidator } from "@/lib/worker/revalidate";

type Env = { REVALIDATE_URL?: string; REVALIDATE_SECRET?: string };
type MakeRevalidator = (url: string, secret: string) => () => Promise<void>;

/**
 * After a price run, tells the site to drop its cached pages so the new prices show at once
 * instead of at the next scheduled rebuild. Never throws: by now the prices are stored, and a
 * site that could not be reached must not make the run look failed.
 */
export async function refreshSite(
  env: Env,
  log: (line: string) => void,
  makeRevalidator: MakeRevalidator = createRevalidator,
): Promise<"refreshed" | "skipped" | "failed"> {
  if (!env.REVALIDATE_URL || !env.REVALIDATE_SECRET) {
    log("Site not refreshed: REVALIDATE_URL and REVALIDATE_SECRET are not both set. New prices appear at the next rebuild.");
    return "skipped";
  }
  try {
    await makeRevalidator(env.REVALIDATE_URL, env.REVALIDATE_SECRET)();
    log("Site refreshed.");
    return "refreshed";
  } catch (error) {
    log(`Site not refreshed: ${error instanceof Error ? error.message : String(error)}`);
    return "failed";
  }
}
