import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { alternateNamesByGame, mergeNames } from "@/lib/prices/names";
import { publisherShopsByGame } from "@/lib/prices/publishers";
import type { GameNames, ShopCode } from "@/lib/prices/types";

/**
 * The games to price, with every name BGG knows for them and their Russian publishers'
 * shops, read from the legacy SQLite cache. That file is the only place the raw BGG
 * XML (and so the alternate names and publishers) is kept; the Postgres database
 * does not store it yet.
 */
export function loadLegacyGames(dbPath: string): GameNames[] {
  if (!existsSync(dbPath)) {
    throw new Error(`No legacy BGG cache at ${dbPath}. Copy data/bgg-cache.sqlite from a checkout that has it.`);
  }
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const rows = db.prepare("SELECT bgg_id AS bggId, title, raw_xml AS rawXml FROM games ORDER BY rank").all() as unknown as {
      bggId: number;
      title: string;
      rawXml: string;
    }[];
    // A row's XML is its whole 20-game batch, so each distinct text is parsed once.
    const namesById = new Map<number, string[]>();
    const shopsById = new Map<number, ShopCode[]>();
    for (const xml of new Set(rows.map((row) => row.rawXml))) {
      for (const [id, names] of alternateNamesByGame(xml)) namesById.set(id, names);
      for (const [id, shops] of publisherShopsByGame(xml)) shopsById.set(id, shops);
    }
    return rows.map((row) => ({
      ...mergeNames(row.bggId, row.title, namesById.get(row.bggId) ?? []),
      publisherShops: shopsById.get(row.bggId) ?? [],
    }));
  } finally {
    db.close();
  }
}
