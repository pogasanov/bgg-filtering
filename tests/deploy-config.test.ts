import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("deployment configuration", () => {
  test("README never activates the project's Modal profile globally", () => {
    const lines = readFileSync("README.md", "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("modal token new"));

    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line).toContain("--no-activate");
  });

  test(".vercelignore keeps secrets and local data out of CLI uploads", () => {
    const entries = readFileSync(".vercelignore", "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim());

    for (const entry of [".env*", "data", "*.csv", "*.sqlite*", ".claude", ".superpowers", "worker/dist", ".worktrees"]) {
      expect(entries).toContain(entry);
    }
  });
});
