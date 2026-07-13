import { describe, expect, test } from "vitest";
import { parseThingXml, parseTopRankRows } from "@/lib/bgg/parser";

const thingXml = `<?xml version="1.0" encoding="utf-8"?>
<items>
  <item type="boardgame" id="174430">
    <name type="primary" value="Gloomhaven"/>
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
      year: 2017,
      rank: 4,
      geekRating: 8.294,
      averageRating: 8.54,
      numVoters: 67354,
      minPlayers: 1,
      maxPlayers: 4,
      playingTime: 120,
      weight: 3.89,
      description: "Vanquish monsters with <em>strategic</em> cardplay.",
      categories: ["Adventure", "Fantasy"],
      mechanics: ["Deck, Bag, and Pool Building"],
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

  test("parses BGG browse rows into ranked list items", () => {
    const html = `
      <tr id="row_">
        <td class="collection_rank">24</td>
        <td class="collection_thumbnail"><a href="/boardgame/68448/7-wonders-duel"></a></td>
        <td class="collection_objectname"><a href="/boardgame/68448/7-wonders-duel">7 Wonders Duel</a><span class="smallerfont dull">(2015)</span></td>
        <td class="collection_bggrating">7.951</td>
        <td class="collection_bggrating">8.08</td>
        <td class="collection_bggrating">109427</td>
      </tr>`;

    expect(parseTopRankRows(html)).toEqual([
      {
        id: 68448,
        rank: 24,
        title: "7 Wonders Duel",
        year: 2015,
        geekRating: 7.951,
        averageRating: 8.08,
        numVoters: 109427,
      },
    ]);
  });
});
