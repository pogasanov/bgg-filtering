import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { buildVercelArgs } from "@/lib/deploy/vercel-args";

// The project's Vercel login lives here, apart from the global `vercel login`.
const globalConfigDir = process.env.VERCEL_GLOBAL_CONFIG ?? join(homedir(), ".config", "vercel-bgg");

try {
  const args = buildVercelArgs(process.argv.slice(2), { token: process.env.VERCEL_TOKEN, globalConfigDir });
  const result = spawnSync("vercel", args, { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
