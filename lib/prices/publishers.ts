import { XMLParser } from "fast-xml-parser";
import type { ShopCode } from "@/lib/prices/types";

/** BoardGameGeek publisher IDs of the publishers whose own shops are tracked. */
export const shopByPublisherId: Readonly<Record<number, ShopCode>> = {
  34522: "crowdgames", // CrowD Games
  34801: "lavkaigr", // Lavka Games
  29194: "gaga", // GaGa Games
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: false,
  isArray: (tagName) => tagName === "item" || tagName === "link",
});

type XmlLink = { type?: string; id?: unknown };
type XmlItem = { id?: unknown; link?: XmlLink[] };

/**
 * For each game in a BGG `thing` response, the tracked shops whose publisher
 * released the game. A publisher's own shop is where its Russian edition is
 * expected to be on sale, so this says where a game should be looked for.
 */
export function publisherShopsByGame(thingXml: string): Map<number, ShopCode[]> {
  const items: XmlItem[] = xmlParser.parse(thingXml)?.items?.item ?? [];
  const result = new Map<number, ShopCode[]>();

  for (const item of items) {
    const id = Number(item.id);
    if (!Number.isInteger(id)) continue;

    const shops = new Set<ShopCode>();
    for (const link of item.link ?? []) {
      const shop = link.type === "boardgamepublisher" ? shopByPublisherId[Number(link.id)] : undefined;
      if (shop) shops.add(shop);
    }
    result.set(id, [...shops].sort());
  }

  return result;
}
