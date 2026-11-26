import { expect, test } from "vitest";
import { refreshSite } from "@/lib/prices/refresh-site";

const env = { REVALIDATE_URL: "https://site.example/api/revalidate", REVALIDATE_SECRET: "s3cret" };

test("asks the site to rebuild its cached pages once", async () => {
  const calls: string[] = [];
  const lines: string[] = [];
  const result = await refreshSite(env, (line) => lines.push(line), (url, secret) => async () => void calls.push(`${url}|${secret}`));
  expect(result).toBe("refreshed");
  expect(calls).toEqual(["https://site.example/api/revalidate|s3cret"]);
});

test("is skipped, and says so, when the site address or secret is not configured", async () => {
  const lines: string[] = [];
  let made = 0;
  const make = () => async () => void (made += 1);
  expect(await refreshSite({ REVALIDATE_URL: env.REVALIDATE_URL }, (line) => lines.push(line), make)).toBe("skipped");
  expect(await refreshSite({}, (line) => lines.push(line), make)).toBe("skipped");
  expect(made).toBe(0);
  expect(lines.join("\n")).toContain("REVALIDATE_URL");
});

test("a failed refresh is reported, not thrown: the prices are already stored", async () => {
  const lines: string[] = [];
  const failing = () => async () => {
    throw new Error("Revalidation failed with 500");
  };
  expect(await refreshSite(env, (line) => lines.push(line), failing)).toBe("failed");
  expect(lines.join("\n")).toContain("Revalidation failed with 500");
});
