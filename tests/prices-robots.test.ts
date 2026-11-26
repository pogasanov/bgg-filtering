import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isAllowedByRobots } from "@/lib/prices/robots";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/prices/${name}`, import.meta.url), "utf8");
const gaga = fixture("robots-gaga.txt");
const lavka = fixture("robots-lavkaigr.txt");
const crowd = fixture("robots-crowdgames.txt");

describe("isAllowedByRobots", () => {
  it("gaga: product pages allowed, anything with a query string disallowed", () => {
    expect(isAllowedByRobots(gaga, "/game/citadels-classic/")).toBe(true);
    expect(isAllowedByRobots(gaga, "/nastolnie-igri/?page=2")).toBe(false);
    expect(isAllowedByRobots(gaga, "/game/citadels-classic/otzyvy")).toBe(false);
    expect(isAllowedByRobots(gaga, "/sitemap.xml")).toBe(true);
  });

  it("lavkaigr: shop listing allowed, ajax and games disallowed", () => {
    expect(isAllowedByRobots(lavka, "/shop/?page=3")).toBe(true);
    expect(isAllowedByRobots(lavka, "/ajax/cart")).toBe(false);
    expect(isAllowedByRobots(lavka, "/shop/strategicheskie/tirany-podzemya/")).toBe(false);
  });

  it("crowdgames: collection json allowed, search and $-anchored rules respected", () => {
    expect(isAllowedByRobots(crowd, "/collection/all.json?page=2")).toBe(true);
    expect(isAllowedByRobots(crowd, "/search?q=x")).toBe(false);
    expect(isAllowedByRobots(crowd, "/collection/arhiv")).toBe(false);
    expect(isAllowedByRobots(crowd, "/collection/arhiv-2")).toBe(true);
  });

  it("the longest matching rule wins, Allow beating Disallow on a tie", () => {
    expect(isAllowedByRobots("User-agent: *\nDisallow: /a\nAllow: /a/b", "/a/b/c")).toBe(true);
    expect(isAllowedByRobots("User-agent: *\nDisallow: /a\nAllow: /a", "/a")).toBe(true);
  });

  it("ignores groups for other user agents and empty Disallow lines", () => {
    const robots = "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow:\n";
    expect(isAllowedByRobots(robots, "/anything")).toBe(true);
  });

  it("allows everything when there is no group for all agents", () => {
    expect(isAllowedByRobots("", "/x")).toBe(true);
  });
});
