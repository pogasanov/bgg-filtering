import { describe, expect, test } from "vitest";
import { createPool } from "@/lib/db/client";

describe("createPool", () => {
  test("handles idle client errors and bounds connection time", async () => {
    const pool = createPool("postgres://user:pass@127.0.0.1:1/db", 3);
    try {
      expect(pool.listenerCount("error")).toBe(1);
      expect(pool.options.connectionTimeoutMillis).toBe(10_000);
      expect(pool.options.max).toBe(3);
      expect(() => pool.emit("error", new Error("idle client terminated"))).not.toThrow();
    } finally {
      await pool.end();
    }
  });
});
