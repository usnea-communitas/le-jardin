// Unit tests for lib/community-table.js: when neighbours leave offers on the
// community table, which offer, and what taking one costs the shared pool.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const table = require("../lib/community-table.js");

// A small list of what neighbours can offer (the game's own list is `giftPool`
// in the canonical source; test-rules-words.mjs checks it).
const gifts = [
  { kind: "item", type: "mulch", person: "Camille", seasons: ["Autumn"], text: "Raked autumn leaves" },
  { kind: "item", type: "mulch", person: "Malik", seasons: ["Summer"], text: "Fresh grass clippings" },
  { kind: "shares", person: "Léa", value: 2, text: "Help at the work-day (+2 shares)" },
  { kind: "material", mat: "planks", person: "Baptiste", seasons: ["Summer", "Autumn"], text: "Good planks" },
  { kind: "budget", value: 80, text: "The fund covers €80" }
];

// The table answers once the garden has given something.
assert.equal(table.reciprocityUnlocked({ sharedActs: 0 }), false);
assert.equal(table.reciprocityUnlocked({}), false);
assert.equal(table.reciprocityUnlocked({ sharedActs: 1 }), true);

// Four offers at most
assert.equal(table.TABLE_SIZE, 4);
assert.equal(table.isFull([1, 2, 3]), false);
assert.equal(table.isFull([1, 2, 3, 4]), true);
assert.equal(table.isFull(undefined), false);

// How likely a neighbour leaves something after a placement, and an answer to "See sharing"
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
close(table.giftChance({ goodwill: 0, pool: 65 }), 0.2825);
close(table.giftChance({ goodwill: 0, pool: 10 }), 0.0725);
close(table.giftChance({ goodwill: 0, pool: 19 }), 0.08375);
close(table.giftChance({ goodwill: 0, pool: 20 }), 0.17, "a pool below 20 halves the chance");
close(table.giftChance({ goodwill: 20, pool: 100 }), 0.6);
close(table.checkChance({ goodwill: 0, pool: 0 }), 0.35);
close(table.checkChance({ goodwill: 2, pool: 32 }), 0.65);
close(table.checkChance({ goodwill: 9, pool: 100 }), 0.9);
assert.equal(table.checkKey({ seasonTurns: 3, sharedActs: 2 }), "3:2");
assert.equal(table.checkKey({}), "0:0", "one check per gift or season");

// Which offer: a gift of the season that is not on the table yet, chosen by the roll
assert.equal(table.pickGift(gifts, "Summer", [], 0).person, "Malik");
assert.equal(table.pickGift(gifts, "Summer", [], 0.99).kind, "budget");
assert.equal(table.pickGift(gifts, "Summer", [{ kind: "item", type: "mulch" }], 0).kind, "shares", "the same thing is not offered twice");
const all = [{ kind: "item", type: "mulch" }, { kind: "shares", value: 2 }, { kind: "material", mat: "planks" }, { kind: "budget", value: 80 }];
assert.equal(table.pickGift(gifts, "Summer", all, 0).type, "mulch", "when everything of the season is on the table, any of it may come again");
assert.deepEqual(table.pickGift(gifts, "Winter", [], 0.6).kind, "budget", "gifts without seasons come all year");
assert.equal(table.pickGift([gifts[0]], "Spring", [], 0), null, "nothing in a season with no gifts");

// The offer as it lies on the table
assert.deepEqual(table.offerFrom(gifts[4], "g1"), { id: "g1", kind: "budget", person: "Camille", seasons: undefined, text: "The fund covers €80", value: 80 });
assert.deepEqual(table.offerFrom(gifts[3], "g2"), { id: "g2", kind: "material", person: "Baptiste", seasons: ["Summer", "Autumn"], text: "Good planks", mat: "planks" });
assert.deepEqual(table.offerFrom(gifts[0], "g3"), { id: "g3", kind: "item", person: "Camille", seasons: ["Autumn"], text: "Raked autumn leaves", type: "mulch" });

// A new garden's table, and the table as the season turns
assert.deepEqual(table.firstOffers(gifts, "Autumn").map(o => [o.id, o.text]), [["market-autumn-1", "Raked autumn leaves"], ["market-autumn-2", "Help at the work-day (+2 shares)"]]);
const summerTable = [{ id: "a", kind: "item", seasons: ["Summer"] }, { id: "b", kind: "shares" }, { id: "c", kind: "material", seasons: ["Summer", "Autumn"] }];
assert.deepEqual(table.marketForSeason(summerTable, gifts, "Autumn").map(o => o.id), ["b", "c"], "offers of other seasons leave");
assert.deepEqual(table.marketForSeason([summerTable[0]], gifts, "Winter").map(o => o.id), ["market-winter-1", "market-winter-2"], "an empty table starts again");

// What taking an offer costs the shared pool
assert.equal(table.offerCost({ kind: "budget" }, {}), 24);
assert.equal(table.offerCost({ kind: "shares" }, {}), 18);
assert.equal(table.offerCost({ kind: "material" }, {}), 10);
assert.equal(table.offerCost({ kind: "item", type: "mulch" }, { placed: [{ type: "compost" }] }), 12);
assert.equal(table.offerCost({ kind: "item", type: "mulch" }, { placed: [{ type: "mulch" }] }), 18, "someone else may need it more");
assert.equal(table.offerCost(null, {}), 0);

assert.deepEqual(table.canTake({ kind: "shares" }, { sharedActs: 0, pool: 90 }), { eligible: false, cost: 18, reason: "closed" });
assert.deepEqual(table.canTake({ kind: "shares" }, { sharedActs: 1, pool: 17 }), { eligible: false, cost: 18, reason: "low" });
assert.deepEqual(table.canTake({ kind: "shares" }, { sharedActs: 1, pool: 18 }), { eligible: true, cost: 18, reason: "ok" });

// Taking it: the offer leaves the table, the pool pays, the gift arrives.
const st = { market: [{ id: "x", kind: "shares", value: 2 }, { id: "y", kind: "material", mat: "planks" }], pool: 20, shares: 3, budget: 50, materials: { planks: 1 }, given: 4, goodwill: 2 };
assert.deepEqual(table.takeOffer(st, st.market[0], 18), { market: [st.market[1]], pool: 2, shares: 5 });
assert.deepEqual(table.takeOffer(st, st.market[1], 10), { market: [st.market[0]], pool: 10, materials: { planks: 2 } });
assert.deepEqual(table.takeOffer(st, { id: "z", kind: "budget", value: 80 }, 24), { market: st.market, pool: 0, budget: 130 }, "the pool never drops below 0");
assert.deepEqual(table.takeOffer(st, { id: "x", kind: "item", type: "mulch" }, 12), { market: [st.market[1]], pool: 8 }, "an element is planted by the game");
for (const offer of [...st.market, { id: "z", kind: "budget", value: 80 }]) {
  const after = table.takeOffer(st, offer, 10);
  assert.ok(!("given" in after) && !("goodwill" in after), "taking is help received, never counted as a gift");
}

console.log("Community table rules OK: reciprocity, chances, which offer, the table by season, costs and taking.");
