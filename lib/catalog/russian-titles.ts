import { and, eq, sql } from "drizzle-orm";
import { buildShopTitleIndex, pickRussianTitle } from "@/lib/bgg/russian-title";
import type { Db } from "@/lib/db/client";
import { games, productLinks, shopProducts } from "@/lib/db/schema";

/**
 * Chooses every game's Russian title again from its candidate names, using what the tracked
 * Russian shops sell as evidence. Run after the BGG sync (new candidates) and after a price
 * collection (new shop catalogues). Returns how many titles changed.
 */
export async function refreshRussianTitles(db: Db): Promise<number> {
  const [gameRows, linkedRows, productRows] = await Promise.all([
    db.select({ id: games.bggId, ruNames: games.ruNames, titleRu: games.titleRu }).from(games),
    db
      .select({ bggId: productLinks.bggId, title: shopProducts.title })
      .from(productLinks)
      .innerJoin(
        shopProducts,
        and(eq(shopProducts.shop, productLinks.shop), eq(shopProducts.externalId, productLinks.externalId)),
      )
      .where(eq(productLinks.status, "confirmed")),
    db.select({ title: shopProducts.title }).from(shopProducts),
  ]);

  const linkedByGame = new Map<number, string[]>();
  for (const row of linkedRows) linkedByGame.set(row.bggId, [...(linkedByGame.get(row.bggId) ?? []), row.title]);
  const shopIndex = buildShopTitleIndex(productRows.map((row) => row.title));

  const changes: { id: number; title: string | null }[] = [];
  for (const game of gameRows) {
    const title = pickRussianTitle(game.ruNames, { linkedTitles: linkedByGame.get(game.id) ?? [], shopIndex });
    if (title !== game.titleRu) changes.push({ id: game.id, title });
  }

  // One statement for all the changes, passed as a single JSON parameter.
  if (changes.length > 0) {
    await db.execute(sql`
      update ${games} set title_ru = v.title
      from json_to_recordset(${JSON.stringify(changes)}::json) as v(id int, title text)
      where ${games.bggId} = v.id
    `);
  }
  return changes.length;
}
