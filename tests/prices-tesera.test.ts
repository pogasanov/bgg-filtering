import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findTeseraNames } from "@/lib/prices/tesera";
import type { Get } from "@/lib/prices/types";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/prices/${name}`, import.meta.url), "utf8");
const search = fixture("tesera-search-wingspan.json");
const wingspan = fixture("tesera-game-wingspan.json");

function fakeTesera(searchBody: string, games: Record<string, unknown>) {
  const urls: string[] = [];
  const get: Get = async (url) => {
    urls.push(url);
    const { pathname } = new URL(url);
    if (pathname === "/search/games") return searchBody;
    const alias = decodeURIComponent(pathname.replace("/games/", ""));
    if (!(alias in games)) throw new Error(`HTTP 404 for ${url}`);
    return typeof games[alias] === "string" ? (games[alias] as string) : JSON.stringify(games[alias]);
  };
  return { get, urls };
}

const game = (bggId: number, title: string) => ({ game: { bggId, alias: "x", title, title2: null, title3: null } });

describe("findTeseraNames", () => {
  it("returns the Russian and other names of the game with the matching BGG ID", async () => {
    const { get, urls } = fakeTesera(search, { wingspan });
    expect(await findTeseraNames(get, { bggId: 266192, primaryName: "Wingspan" })).toEqual({
      alias: "wingspan",
      names: ["Крылья", "Wingspan"],
    });
    expect(urls[0]).toBe("https://api.tesera.ru/search/games?query=Wingspan&limit=30");
    expect(urls[1]).toBe("https://api.tesera.ru/games/wingspan");
  });

  it("checks at most five search results, in order, and takes the first match", async () => {
    const results = ["a", "b", "c", "d", "e", "f", "g"].map((alias) => ({ alias, title: alias }));
    const games = Object.fromEntries(results.map(({ alias }) => [alias, game(alias === "f" ? 7 : 1, alias)]));
    const { get, urls } = fakeTesera(JSON.stringify(results), games);
    expect(await findTeseraNames(get, { bggId: 7, primaryName: "Seven" })).toBeNull();
    expect(urls.slice(1)).toEqual(["a", "b", "c", "d", "e"].map((alias) => `https://api.tesera.ru/games/${alias}`));
  });

  it("splits the comma-separated other names", async () => {
    const results = [{ alias: "citadels", title: "Цитадели" }];
    const detail = { game: { bggId: 478, alias: "citadels", title: "Цитадели", title2: "Citadels", title3: "Цитаделі, Ciudadelas" } };
    const { get } = fakeTesera(JSON.stringify(results), { citadels: detail });
    expect((await findTeseraNames(get, { bggId: 478, primaryName: "Citadels" }))?.names).toEqual([
      "Цитадели",
      "Citadels",
      "Цитаделі",
      "Ciudadelas",
    ]);
  });

  it("returns null when nothing has the right BGG ID or the search is empty", async () => {
    const one = fakeTesera(JSON.stringify([{ alias: "a", title: "A" }]), { a: game(5, "A") });
    expect(await findTeseraNames(one.get, { bggId: 6, primaryName: "A" })).toBeNull();
    const none = fakeTesera("[]", {});
    expect(await findTeseraNames(none.get, { bggId: 6, primaryName: "A" })).toBeNull();
  });

  it("never accepts an entry without a BGG ID", async () => {
    const { get } = fakeTesera(JSON.stringify([{ alias: "a", title: "A" }]), { a: game(0, "A") });
    expect(await findTeseraNames(get, { bggId: 0, primaryName: "A" })).toBeNull();
  });

  it("skips a search result whose details cannot be read", async () => {
    const results = [{ alias: "gone", title: "Gone" }, { alias: "wingspan", title: "Крылья" }];
    const { get } = fakeTesera(JSON.stringify(results), { wingspan });
    expect((await findTeseraNames(get, { bggId: 266192, primaryName: "Wingspan" }))?.alias).toBe("wingspan");
  });
});
