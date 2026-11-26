import { attribute, decodeEntities, hasClass, openingTags } from "@/lib/prices/html";
import { parseRubles } from "@/lib/prices/text";
import type { ShopAdapter, ShopProduct } from "@/lib/prices/types";

const ORIGIN = "https://gaga.ru";
const PRODUCT_URL = /^https:\/\/gaga\.ru\/game\/[^/]+\/$/;

/** Product page URLs from the sitemap. Category, news and article pages are dropped. */
export function parseGagaSitemap(xml: string): string[] {
  const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => decodeEntities(match[1]));
  return [...new Set(urls.filter((url) => PRODUCT_URL.test(url)))];
}

/**
 * A product page. Everything comes from the buy (or "notify me") button, which
 * carries the product ID, name, vendor and the price a visitor sees without logging in.
 * Returns `null` when the page has no such button.
 */
export function parseGagaProduct(html: string, url: string): ShopProduct | null {
  const buttons = openingTags(html, "button").filter(
    (tag) => attribute(tag, "data-gid") && attribute(tag, "data-name") !== null,
  );
  if (buttons.length === 0) return null;

  // The same button is repeated on the page. Buttons for different products would
  // mean a layout we do not understand, and guessing risks a wrong price.
  if (new Set(buttons.map((tag) => attribute(tag, "data-gid"))).size > 1) {
    throw new Error(`GaGa product page is unrecognised: buttons for several products at ${url}`);
  }

  const button = buttons[0];
  const title = (attribute(button, "data-name") ?? "").replace(/\s+/g, " ").trim();
  if (title === "") return null;
  const vendor = (attribute(button, "data-vendor") ?? "").trim();

  return {
    shop: "gaga",
    externalId: attribute(button, "data-gid") as string,
    url,
    title,
    vendor: vendor === "" ? null : vendor,
    barcode: null,
    price: parseRubles(attribute(button, "data-price")),
    oldPrice: null,
    available: buttons.some((tag) => hasClass(tag, "add_to_cart")),
    variantCount: 1,
  };
}

const translitBase: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", ъ: "",
  ы: "y", ь: "", э: "e",
};
/** GaGa spells its addresses in more than one transliteration ("krasnyj-sobor", "medvezhiy-park"). */
const translitSchemes: Record<string, string>[] = [
  { ...translitBase, й: "y", щ: "sch", ю: "yu", я: "ya" },
  { ...translitBase, й: "j", щ: "shch", ю: "ju", я: "ja" },
];
const MAX_LONGER_ADDRESSES = 2;

function addressKeys(name: string): string[] {
  const lowered = name.toLowerCase().replace(/['’`]/g, "");
  // The name as a whole, and without its subtitle ("Tzolk'in: The Mayan Calendar" → "tzolkin").
  const variants = [lowered, lowered.split(/[:.–—]| - /)[0]];
  const keys = variants.flatMap((variant) =>
    translitSchemes.map((scheme) =>
      [...variant]
        .map((char) => scheme[char] ?? char)
        .join("")
        .normalize("NFD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    ),
  );
  return [...new Set(keys.filter((key) => key.length >= 2))];
}

/**
 * Product pages worth reading for one game, chosen by address alone. The sitemap
 * has thousands of pages and the catalogue listing is closed to robots, so this
 * narrows a game down to a handful of requests. It only chooses what to read:
 * whether a page really is the game is decided later from the page's own title.
 */
export function selectGagaUrls(urls: string[], names: string[]): string[] {
  const keys = [...new Set(names.flatMap(addressKeys))];
  const slugOf = (url: string) => url.split("/").at(-2) ?? "";

  const exact = urls.filter((url) => keys.includes(slugOf(url)));
  // The address is the name cut short: "unmatched-bitva-legend" for "Unmatched. Битва легенд. Том 1".
  const shortened = urls.filter((url) => {
    const slug = slugOf(url);
    return slug.includes("-") && keys.some((key) => key.startsWith(`${slug}-`));
  });
  if (exact.length > 0 || shortened.length > 0) return [...new Set([...exact, ...shortened])];

  // Nothing matches outright. Addresses that continue the name are mostly expansions,
  // so only the two shortest are tried, in case the game itself is filed under one.
  return urls
    .filter((url) => keys.some((key) => key.length >= 4 && slugOf(url).startsWith(`${key}-`)))
    .sort((a, b) => a.length - b.length || a.localeCompare(b))
    .slice(0, MAX_LONGER_ADDRESSES);
}

export const gagaAdapter: ShopAdapter = {
  code: "gaga",
  origin: ORIGIN,
  /**
   * The catalogue is the sitemap, because robots.txt forbids paging the listing.
   * Each new URL costs one request, so `known` products are reused and `limit`
   * caps how many new pages are read in this call.
   */
  async listCatalog(get, opts) {
    const listed = parseGagaSitemap(await get(`${ORIGIN}/sitemap.xml`));
    if (listed.length === 0) throw new Error("GaGa sitemap empty or unrecognised: no product pages");
    const urls = opts?.select ? opts.select(listed) : listed;

    const knownByUrl = new Map((opts?.known ?? []).map((product) => [product.url, product]));
    const total = urls.filter((url) => !knownByUrl.has(url)).length;
    const limit = opts?.limit ?? Infinity;
    const products: ShopProduct[] = [];
    let fetched = 0;
    let parsed = 0;

    for (const url of urls) {
      const known = knownByUrl.get(url);
      if (known) {
        products.push(known);
        knownByUrl.delete(url);
        continue;
      }
      if (fetched >= limit) continue;

      const product = parseGagaProduct(await get(url, { encoding: "windows-1251" }), url);
      fetched += 1;
      if (product) {
        products.push(product);
        parsed += 1;
      }
      opts?.onProgress?.(fetched, total);
      if (opts?.onCheckpoint && fetched % (opts.checkpointEvery ?? 50) === 0) opts.onCheckpoint([...products]);
    }

    // Some sitemap entries are not products, but all of them at once means a block page or a new layout.
    if (fetched > 0 && parsed === 0) {
      throw new Error(`GaGa product pages are unrecognised: none of ${fetched} pages had a product`);
    }

    // Products the sitemap no longer lists stay known; they are simply not refreshed.
    return [...products, ...knownByUrl.values()];
  },
};
