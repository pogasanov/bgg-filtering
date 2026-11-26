import { describe, expect, it } from "vitest";
import { alternateNamesByGame, mergeNames } from "@/lib/prices/names";

const xml = `<?xml version="1.0" encoding="utf-8"?>
<items>
  <item type="boardgame" id="266192">
    <name type="alternate" sortindex="1" value="Крылья" />
    <name type="primary" sortindex="1" value="Wingspan" />
    <name type="alternate" sortindex="1" value="Flügelschlag" />
  </item>
  <item type="boardgame" id="478">
    <name type="primary" sortindex="1" value="Citadels" />
    <name type="alternate" sortindex="1" value="Цитадели" />
  </item>
  <item type="boardgame" id="1">
    <name type="primary" sortindex="1" value="Tom &amp; Jerry" />
  </item>
</items>`;

describe("alternateNamesByGame", () => {
  const names = alternateNamesByGame(xml);

  it("lists each game's names under its own ID, primary first", () => {
    expect(names.get(266192)).toEqual(["Wingspan", "Крылья", "Flügelschlag"]);
    expect(names.get(478)).toEqual(["Citadels", "Цитадели"]);
  });

  it("handles a game with a single name and decodes entities", () => {
    expect(names.get(1)).toEqual(["Tom & Jerry"]);
  });

  it("returns nothing for XML without items", () => {
    expect(alternateNamesByGame("<items></items>").size).toBe(0);
  });
});

describe("mergeNames", () => {
  it("puts the primary name first and de-duplicates by normalised title", () => {
    expect(mergeNames(1, "Wingspan", ["Крылья", "wingspan"], ["КРЫЛЬЯ"])).toEqual({
      bggId: 1,
      primaryName: "Wingspan",
      names: ["Wingspan", "Крылья"],
    });
  });

  it("drops names that normalise to nothing", () => {
    expect(mergeNames(1, "Go", ["  ", "—"]).names).toEqual(["Go"]);
  });
});

describe("alternateNamesByGame — review fixes", () => {
  it("decodes numeric entities BGG leaves in names", () => {
    const withEntity = `<items><item type="boardgame" id="9"><name type="primary" value="La Guerre de l&amp;#039;anneau" /></item></items>`;
    expect(alternateNamesByGame(withEntity).get(9)).toEqual(["La Guerre de l'anneau"]);
  });
});
