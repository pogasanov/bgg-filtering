// Lets plain `node` run the project's TypeScript: resolves the "@/…" alias
// from tsconfig.json and the extensionless imports the code base uses.
import { statSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);

const isFile = (path) => statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;

registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/")
      ? new URL(specifier.slice(2), root)
      : specifier.startsWith(".") && context.parentURL
        ? new URL(specifier, context.parentURL)
        : null;
    if (!target) return nextResolve(specifier, context);

    const path = fileURLToPath(target);
    const found = [path, `${path}.ts`, `${path}/index.ts`].find(isFile);
    return nextResolve(found ? pathToFileURL(found).href : specifier, context);
  },
});
