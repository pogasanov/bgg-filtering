import { describe, expect, test } from "vitest";
import { parseThingXml } from "@/lib/bgg/parser";

const thingXml = `<?xml version="1.0" encoding="utf-8"?>
<items>
  <item type="boardgame" id="174430">
    <name type="primary" value="Gloomhaven"/>
    <name type="alternate" value="Мрачная Гавань"/>
    <name type="alternate" value="Сутінкова Гавань"/>
    <yearpublished value="2017"/>
    <description>Vanquish monsters with &lt;em&gt;strategic&lt;/em&gt; cardplay.</description>
    <minplayers value="1"/>
    <maxplayers value="4"/>
    <playingtime value="120"/>
    <statistics>
      <ratings>
        <average value="8.54"/>
        <bayesaverage value="8.294"/>
        <usersrated value="67354"/>
        <averageweight value="3.89"/>
        <ranks>
          <rank type="subtype" name="boardgame" value="4" bayesaverage="8.294"/>
        </ranks>
      </ratings>
    </statistics>
    <link type="boardgamecategory" id="1022" value="Adventure"/>
    <link type="boardgamecategory" id="1010" value="Fantasy"/>
    <link type="boardgamemechanic" id="2664" value="Deck, Bag, and Pool Building"/>
    <versions>
      <item type="boardgameversion" id="1001">
        <link type="language" id="2184" value="English"/>
        <link type="language" id="2187" value="French"/>
      </item>
      <item type="boardgameversion" id="1002">
        <link type="language" id="2187" value="French"/>
        <link type="language" id="2186" value="German"/>
        <link type="language" id="9999" value=""/>
      </item>
      <item type="boardgameversion" id="1003">
        <link type="language" id="9998"/>
        <link id="9997" value="Japanese"/>
      </item>
      <item type="boardgameversion" id="1004">
      </item>
    </versions>
    <poll name="suggested_numplayers" title="User Suggested Number of Players">
      <results numplayers="1">
        <result value="Best" numvotes="12"/>
        <result value="Recommended" numvotes="24"/>
        <result value="Not Recommended" numvotes="6"/>
      </results>
      <results numplayers="2">
        <result value="Best" numvotes="54"/>
        <result value="Recommended" numvotes="30"/>
        <result value="Not Recommended" numvotes="2"/>
      </results>
      <results numplayers="6+">
        <result value="Best" numvotes="0"/>
        <result value="Recommended" numvotes="2"/>
        <result value="Not Recommended" numvotes="60"/>
      </results>
    </poll>
  </item>
</items>`;

describe("BGG XML parser", () => {
  test("normalizes game details, tags, ratings, rank, and player recommendations", () => {
    const parsed = parseThingXml(thingXml);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      id: 174430,
      title: "Gloomhaven",
      ruNames: ["Мрачная Гавань"],
      year: 2017,
      rank: 4,
      geekRating: 8.294,
      averageRating: 8.54,
      numVoters: 67354,
      minPlayers: 1,
      maxPlayers: 4,
      playingTime: 120,
      weight: 3.89,
      categories: ["Adventure", "Fantasy"],
      mechanics: ["Deck, Bag, and Pool Building"],
      languages: ["English", "French", "German"],
    });
    expect(parsed[0].playerRecommendations["1"]).toEqual({
      best: 12,
      recommended: 24,
      notRecommended: 6,
      verdict: "recommended",
    });
    expect(parsed[0].playerRecommendations["2"].verdict).toBe("best");
    expect(parsed[0].playerRecommendations["6+"].verdict).toBe("not-recommended");
  });

  test("returns no languages when version metadata is absent", () => {
    const parsed = parseThingXml(`
      <items>
        <item type="boardgame" id="1">
          <name type="primary" value="No Versions"/>
        </item>
      </items>
    `);

    expect(parsed[0].languages).toEqual([]);
  });
});

test("reads the thumbnail URL and tolerates its absence", () => {
  const withThumb = `<items><item type="boardgame" id="1"><thumbnail>https://cf.geekdo-images.com/a/t.jpg</thumbnail><name type="primary" value="A"/></item></items>`;
  const without = `<items><item type="boardgame" id="2"><name type="primary" value="B"/></item></items>`;
  expect(parseThingXml(withThumb)[0].thumbnailUrl).toBe("https://cf.geekdo-images.com/a/t.jpg");
  expect(parseThingXml(without)[0].thumbnailUrl).toBeNull();
});

describe("names and publishers", () => {
  test("keeps every alternate name and the publisher IDs, for matching shop products", () => {
    const [game] = parseThingXml(`
      <items>
        <item type="boardgame" id="266192">
          <name type="primary" value="Wingspan"/>
          <name type="alternate" value="Крылья"/>
          <name type="alternate" value="L&amp;#039;envol"/>
          <link type="boardgamecategory" id="1089" value="Animals"/>
          <link type="boardgamepublisher" id="23202" value="Stonemaier Games"/>
          <link type="boardgamepublisher" id="34801" value="Lavka Games"/>
        </item>
      </items>`);

    expect(game.alternateNames).toEqual(["Крылья", "L'envol"]);
    expect(game.publisherIds).toEqual([23202, 34801]);
  });

  test("gives empty lists when a game has no alternate names or publishers", () => {
    const [game] = parseThingXml(`<items><item type="boardgame" id="1"><name type="primary" value="Solo"/></item></items>`);
    expect(game.alternateNames).toEqual([]);
    expect(game.publisherIds).toEqual([]);
  });
});

describe("the 7+ player bucket", () => {
  const votes = (numplayers: string, best: number, recommended: number, notRecommended: number) => `
    <results numplayers="${numplayers}">
      <result value="Best" numvotes="${best}"/>
      <result value="Recommended" numvotes="${recommended}"/>
      <result value="Not Recommended" numvotes="${notRecommended}"/>
    </results>`;
  const sevenPlus = (rows: string) =>
    parseThingXml(`<items><item type="boardgame" id="1"><name type="primary" value="A"/>
      <poll name="suggested_numplayers">${rows}</poll></item></items>`)[0].playerRecommendations["6+"];

  test("adds up the votes for seven, eight and more players", () => {
    expect(sevenPlus(votes("6", 9, 1, 0) + votes("7", 10, 30, 5) + votes("8", 4, 20, 10) + votes("8+", 0, 1, 40))).toEqual({
      best: 14,
      recommended: 50,
      notRecommended: 15,
      verdict: "recommended",
    });
  });

  test("falls back to the over-the-maximum row when the poll stops at six", () => {
    expect(sevenPlus(votes("6", 9, 1, 0) + votes("6+", 0, 2, 60))).toEqual({
      best: 0,
      recommended: 2,
      notRecommended: 60,
      verdict: "not-recommended",
    });
  });

  test("stays unknown when the poll stops below six", () => {
    expect(sevenPlus(votes("4", 9, 1, 0) + votes("4+", 0, 2, 60)).verdict).toBe("unknown");
  });
});
