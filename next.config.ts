import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    root,
  },
};

export default nextConfig;
