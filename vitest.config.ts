import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
    // The tests read as the Russian site, which the interface texts were written for; tests of the
    // English site pass the locale explicitly.
    env: { NEXT_PUBLIC_SITE_LOCALE: "ru" },
  },
  resolve: {
    alias: {
      "@": new URL(".", import.meta.url).pathname,
    },
  },
});
