import { XMLParser } from "fast-xml-parser";
import { decodeEntities } from "@/lib/prices/html";
import { normalizeTitle } from "@/lib/prices/text";
import type { GameNames } from "@/lib/prices/types";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: false,
  isArray: (tagName) => tagName === "item" || tagName === "name",
});

type XmlName = { type?: string; value?: unknown };
type XmlItem = { id?: unknown; name?: XmlName[] };

/**
 * Every name BGG knows for each game in a `thing` response, primary name first.
 * The alternate names include the Russian titles shops use.
 */
export function alternateNamesByGame(thingXml: string): Map<number, string[]> {
  const items: XmlItem[] = xmlParser.parse(thingXml)?.items?.item ?? [];
  const result = new Map<number, string[]>();

  for (const item of items) {
    const id = Number(item.id);
    if (!Number.isInteger(id)) continue;

    const names = (item.name ?? []).filter((name) => typeof name.value === "string" || typeof name.value === "number");
    const ordered = [...names.filter((name) => name.type === "primary"), ...names.filter((name) => name.type !== "primary")];
    result.set(
      id,
      // BGG double-encodes some names, leaving "&#039;" in the parsed value.
      ordered.map((name) => decodeEntities(String(name.value))),
    );
  }

  return result;
}

/** One list of names per game: primary first, later duplicates (by normalised title) dropped. */
export function mergeNames(bggId: number, primaryName: string, ...sources: string[][]): GameNames {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const name of [primaryName, ...sources.flat()]) {
    const key = normalizeTitle(name);
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    names.push(name.trim());
  }

  return { bggId, primaryName, names };
}
