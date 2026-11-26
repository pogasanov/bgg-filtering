import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gagaAdapter, parseGagaProduct, parseGagaSitemap, selectGagaUrls } from "@/lib/prices/shops/gaga";
import { shopAdapters } from "@/lib/prices/shops";
import type { Get, ShopProduct } from "@/lib/prices/types";

const bytes = (name: string) => readFileSync(new URL(`./fixtures/prices/${name}`, import.meta.url));
const cp1251 = (name: string) => new TextDecoder("windows-1251").decode(bytes(name));
const sitemap = bytes("gaga-sitemap.xml").toString("utf8");
const inStock = cp1251("gaga-product-instock.html");
const waitlist = cp1251("gaga-product-waitlist.html");

describe("parseGagaSitemap", () => {
  it("keeps only product pages", () => {
    expect(parseGagaSitemap(sitemap)).toEqual([
      "https://gaga.ru/game/bonanza-igra/",
      "https://gaga.ru/game/citadels-classic/",
      "https://gaga.ru/game/korova-006/",
      "https://gaga.ru/game/kolonizatory/",
      "https://gaga.ru/game/fish/",
      "https://gaga.ru/game/lost-cities/",
    ]);
  });
});

describe("parseGagaProduct", () => {
  it("maps an in-stock product", () => {
    expect(parseGagaProduct(inStock, "https://gaga.ru/game/beast/")).toEqual({
      shop: "gaga",
      externalId: "6171",
      url: "https://gaga.ru/game/beast/",
      title: "Зверь",
      vendor: "GaGa Games",
      barcode: null,
      price: 8990,
      oldPrice: null,
      available: true,
      variantCount: 1,
    });
  });

  it("marks a waitlist product unavailable", () => {
    expect(parseGagaProduct(waitlist, "https://gaga.ru/game/citadels-classic/")).toMatchObject({
      externalId: "3",
      title: "Цитадели",
      vendor: "Hobby World",
      price: 990,
      available: false,
    });
  });

  it("returns null for a page that is not a product", () => {
    expect(parseGagaProduct("<html><body><h1>Новости</h1></body></html>", "https://gaga.ru/game/x/")).toBeNull();
  });

  it("refuses a page whose buy buttons belong to different products", () => {
    const html =
      '<button class="btn add_to_cart" data-gid="1" data-price="100" data-name="A" data-vendor="V"></button>' +
      '<button class="btn add_to_cart" data-gid="2" data-price="200" data-name="B" data-vendor="V"></button>';
    expect(() => parseGagaProduct(html, "https://gaga.ru/game/x/")).toThrow(/unrecognised/);
  });
});

describe("gagaAdapter.listCatalog", () => {
  const productPage = (id: number) =>
    `<button type="button" class=" btn btn--basket add_to_cart" data-gid="${id}" data-price="500" data-name="Game ${id}" data-vendor="V">`;
  const sitemapOf = (slugs: string[]) =>
    `<urlset>${slugs.map((slug) => `<url><loc>https://gaga.ru/game/${slug}/</loc></url>`).join("")}<url><loc>https://gaga.ru/news/1/</loc></url></urlset>`;

  function fakeGet(slugs: string[]) {
    const calls: { url: string; encoding?: string }[] = [];
    const get: Get = async (url, opts) => {
      calls.push({ url, encoding: opts?.encoding });
      if (url.endsWith("/sitemap.xml")) return sitemapOf(slugs);
      const slug = url.split("/").at(-2) ?? "";
      return slug === "news-like" ? "<html></html>" : productPage(Number(slug.replace("g", "")));
    };
    return { get, calls };
  }

  const known: ShopProduct = {
    shop: "gaga",
    externalId: "1",
    url: "https://gaga.ru/game/g1/",
    title: "Known",
    vendor: null,
    barcode: null,
    price: 1,
    oldPrice: null,
    available: true,
    variantCount: 1,
  };

  it("reads product pages as windows-1251 and skips non-product pages", async () => {
    const { get, calls } = fakeGet(["g1", "news-like", "g2"]);
    const products = await gagaAdapter.listCatalog(get);
    expect(products.map((item) => item.externalId)).toEqual(["1", "2"]);
    expect(calls.slice(1).every((call) => call.encoding === "windows-1251")).toBe(true);
  });

  it("keeps known products without requesting them again", async () => {
    const { get, calls } = fakeGet(["g1", "g2"]);
    const products = await gagaAdapter.listCatalog(get, { known: [known] });
    expect(products).toEqual([known, expect.objectContaining({ externalId: "2" })]);
    expect(calls.map((call) => call.url)).toEqual(["https://gaga.ru/sitemap.xml", "https://gaga.ru/game/g2/"]);
  });

  it("stops after the limit of new pages and reports progress", async () => {
    const { get, calls } = fakeGet(["g1", "g2", "g3", "g4"]);
    const progress: [number, number | null][] = [];
    const products = await gagaAdapter.listCatalog(get, { limit: 2, onProgress: (done, total) => progress.push([done, total]) });
    expect(products).toHaveLength(2);
    expect(calls).toHaveLength(3);
    expect(progress.at(-1)).toEqual([2, 4]);
  });

  it("fails when the sitemap has no product pages", async () => {
    const { get } = fakeGet([]);
    await expect(gagaAdapter.listCatalog(get)).rejects.toThrow(/unrecognised/);
  });
});

describe("shopAdapters", () => {
  it("lists every tracked shop", () => {
    expect(shopAdapters.map((adapter) => adapter.code)).toEqual(["crowdgames", "lavkaigr", "gaga", "hobbygames"]);
  });
});

describe("gagaAdapter.listCatalog — review fixes", () => {
  const sitemapOf = (slugs: string[]) =>
    `<urlset>${slugs.map((slug) => `<url><loc>https://gaga.ru/game/${slug}/</loc></url>`).join("")}</urlset>`;
  const page = (id: number) => `<button class="btn add_to_cart" data-gid="${id}" data-price="500" data-name="Game ${id}" data-vendor="V">`;

  it("fails when every fetched page is something other than a product", async () => {
    const get: Get = async (url) => (url.endsWith("/sitemap.xml") ? sitemapOf(["a", "b", "c"]) : "<html>Проверка браузера</html>");
    await expect(gagaAdapter.listCatalog(get)).rejects.toThrow(/unrecognised/);
  });

  it("hands over what it has read so far, so a long crawl can be saved", async () => {
    const slugs = Array.from({ length: 5 }, (_, index) => `g${index + 1}`);
    const checkpoints: number[] = [];
    const get: Get = async (url) => (url.endsWith("/sitemap.xml") ? sitemapOf(slugs) : page(Number(url.split("/").at(-2)?.slice(1))));
    await gagaAdapter.listCatalog(get, { checkpointEvery: 2, onCheckpoint: (products) => checkpoints.push(products.length) });
    expect(checkpoints).toEqual([2, 4]);
  });

  it("keeps the checkpoint when a later page fails", async () => {
    const saved: ShopProduct[][] = [];
    const get: Get = async (url) => {
      if (url.endsWith("/sitemap.xml")) return sitemapOf(["g1", "g2", "g3"]);
      if (url.includes("/g3/")) throw new Error("HTTP 429");
      return page(Number(url.split("/").at(-2)?.slice(1)));
    };
    await expect(gagaAdapter.listCatalog(get, { checkpointEvery: 2, onCheckpoint: (products) => saved.push(products) })).rejects.toThrow("429");
    expect(saved.at(-1)?.map((item) => item.externalId)).toEqual(["1", "2"]);
  });
});

describe("selectGagaUrls", () => {
  const url = (slug: string) => `https://gaga.ru/game/${slug}/`;
  const urls = [
    "twilight-struggle",
    "twilight-struggle-red-sea",
    "ruiny-ostrova-arnak",
    "ruiny-ostrova-arnak-lidery-ekspedicii",
    "krasnyj-sobor",
    "vojna-kolca-suvenirnyj-plejmat",
    "tzolkin",
    "tzolkin-eng",
    "through-the-ages",
    "karkasson",
    "unmatched-bitva-legend",
    "unmatched-bitva-legend-tom-2",
  ].map(url);

  it("finds a page whose address is the game's name", () => {
    expect(selectGagaUrls(urls, ["Twilight Struggle", "Сумеречная борьба"])).toContain(url("twilight-struggle"));
  });

  it("transliterates Russian names, in either common spelling", () => {
    expect(selectGagaUrls(urls, ["Lost Ruins of Arnak", "Руины острова Арнак"])).toContain(url("ruiny-ostrova-arnak"));
    expect(selectGagaUrls(urls, ["The Red Cathedral", "Красный собор"])).toContain(url("krasnyj-sobor"));
  });

  it("tries the name without its subtitle and without apostrophes", () => {
    expect(selectGagaUrls(urls, ["Tzolk'in: The Mayan Calendar"])).toContain(url("tzolkin"));
    expect(selectGagaUrls(urls, ["Through the Ages: A New Story of Civilization"])).toContain(url("through-the-ages"));
  });

  it("adds a few pages that start with the name, shortest first", () => {
    const picked = selectGagaUrls(urls, ["Unmatched: Battle of Legends, Volume One", "Unmatched. Битва легенд. Том 1"]);
    expect(picked).toContain(url("unmatched-bitva-legend"));
  });

  it("reads one page when the address is the game's name, not its expansions too", () => {
    expect(selectGagaUrls(urls, ["Twilight Struggle"])).toEqual([url("twilight-struggle")]);
    expect(selectGagaUrls(urls, ["Tzolk'in: The Mayan Calendar"])).toEqual([url("tzolkin")]);
  });

  it("falls back to at most two longer addresses when nothing matches exactly", () => {
    const longer = ["orlean-vtorzhenie", "orlean-chuma", "orlean-torgovlya-i-intrigi", "orlean-nabor"].map(url);
    expect(selectGagaUrls(longer, ["Orléans", "Орлеан"])).toEqual([url("orlean-chuma"), url("orlean-nabor")]);
  });

  it("does not pick unrelated pages", () => {
    expect(selectGagaUrls(urls, ["Twilight Struggle"])).not.toContain(url("karkasson"));
    expect(selectGagaUrls(urls, ["Gizmos"])).toEqual([]);
  });

  it("ignores names too short to be an address", () => {
    expect(selectGagaUrls([url("go"), url("go-west")], ["Go"])).toEqual([url("go")]);
  });
});

describe("gagaAdapter.listCatalog — select", () => {
  it("requests only the pages asked for", async () => {
    const calls: string[] = [];
    const get: Get = async (target) => {
      calls.push(target);
      if (target.endsWith("/sitemap.xml")) {
        return `<urlset>${["a", "b", "c"].map((slug) => `<url><loc>https://gaga.ru/game/${slug}/</loc></url>`).join("")}</urlset>`;
      }
      return `<button class="btn add_to_cart" data-gid="1" data-price="500" data-name="B" data-vendor="V">`;
    };
    const products = await gagaAdapter.listCatalog(get, { select: (all) => all.filter((target) => target.endsWith("/b/")) });
    expect(products).toHaveLength(1);
    expect(calls).toEqual(["https://gaga.ru/sitemap.xml", "https://gaga.ru/game/b/"]);
  });
});
