// Bundles the weekly sync worker into one CommonJS file for the Modal container.
// Uses esbuild's JS API: pnpm's bin shim cannot run esbuild's native binary directly.
import { build } from "esbuild";

await build({
  entryPoints: ["worker/sync-entry.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "worker/dist/sync.cjs",
  logLevel: "warning",
});
