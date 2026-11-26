import { describe, expect, test } from "vitest";
import { buildVercelArgs } from "@/lib/deploy/vercel-args";

const CONFIG_DIR = "/home/user/.config/vercel-bgg";

describe("buildVercelArgs", () => {
  test("uses the project's own CLI login when no token is set", () => {
    expect(buildVercelArgs(["deploy", "--prod"], { globalConfigDir: CONFIG_DIR })).toEqual([
      "deploy",
      "--prod",
      "--global-config",
      CONFIG_DIR,
    ]);
    expect(buildVercelArgs(["login"], { token: "", globalConfigDir: CONFIG_DIR })).toEqual([
      "login",
      "--global-config",
      CONFIG_DIR,
    ]);
  });

  test("prefers VERCEL_TOKEN when it is set", () => {
    expect(buildVercelArgs(["deploy", "--prod"], { token: "t", globalConfigDir: CONFIG_DIR })).toEqual([
      "deploy",
      "--prod",
      "--global-config",
      CONFIG_DIR,
      "--token",
      "t",
    ]);
  });

  test("rejects credentials or config passed on the command line", () => {
    for (const flag of ["--token", "--token=other", "-t", "--global-config", "--global-config=/x", "-Q"]) {
      expect(() => buildVercelArgs(["deploy", flag], { globalConfigDir: CONFIG_DIR })).toThrow(
        "pnpm vc picks the project's Vercel login itself",
      );
    }
  });
});
