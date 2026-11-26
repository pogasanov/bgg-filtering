import { describe, expect, it } from "vitest";
import { publisherShopsByGame } from "@/lib/prices/publishers";

const xml = `<?xml version="1.0" encoding="utf-8"?>
<items>
  <item type="boardgame" id="266192">
    <link type="boardgamecategory" id="1089" value="Animals" />
    <link type="boardgamepublisher" id="23202" value="Stonemaier Games" />
    <link type="boardgamepublisher" id="34801" value="Lavka Games" />
  </item>
  <item type="boardgame" id="1">
    <link type="boardgamepublisher" id="34522" value="CrowD Games" />
    <link type="boardgamepublisher" id="29194" value="GaGa Games" />
  </item>
  <item type="boardgame" id="2">
    <link type="boardgamepublisher" id="9325" value="Lifestyle Boardgames Ltd" />
  </item>
  <item type="boardgame" id="3">
    <link type="boardgamepublisher" id="34801" value="Lavka Games" />
  </item>
</items>`;

describe("publisherShopsByGame", () => {
  const shops = publisherShopsByGame(xml);

  it("maps a game to the shop of its Russian publisher", () => {
    expect(shops.get(266192)).toEqual(["lavkaigr"]);
    expect(shops.get(3)).toEqual(["lavkaigr"]);
  });

  it("lists every tracked publisher of a game", () => {
    expect(shops.get(1)).toEqual(["crowdgames", "gaga"]);
  });

  it("gives an empty list for a game no tracked shop publishes", () => {
    expect(shops.get(2)).toEqual([]);
  });

  it("knows Hobby World's shop", () => {
    const hobby = `<items><item id="7"><link type="boardgamepublisher" id="18852" value="Hobby World" /></item></items>`;
    expect(publisherShopsByGame(hobby).get(7)).toEqual(["hobbygames"]);
  });

  it("ignores links that are not publishers", () => {
    const category = `<items><item id="5"><link type="boardgamecategory" id="34801" value="x" /></item></items>`;
    expect(publisherShopsByGame(category).get(5)).toEqual([]);
  });
});
