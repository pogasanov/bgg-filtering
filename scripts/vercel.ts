import { spawnSync } from "node:child_process";
import { buildVercelArgs } from "@/lib/deploy/vercel-args";

try {
  const args = buildVercelArgs(process.argv.slice(2), process.env.VERCEL_TOKEN);
  const result = spawnSync("vercel", args, { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
