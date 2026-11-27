// Bundles the Modal workers (weekly BGG sync, daily prices) into one CommonJS file each.
// Uses esbuild's JS API: pnpm's bin shim cannot run esbuild's native binary directly.
import { build } from "esbuild";

const shared = {
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  logLevel: "warning",
};

await build({ ...shared, entryPoints: ["worker/sync-entry.ts"], outfile: "worker/dist/sync.cjs" });
await build({ ...shared, entryPoints: ["worker/prices-entry.ts"], outfile: "worker/dist/prices.cjs" });
