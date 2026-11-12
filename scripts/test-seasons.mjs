// Unit tests for lib/seasons.js: planting windows, sowing from the seed bank,
// growth through the seasons and winter, harvests and the apple trees.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const seasons = require("../lib/seasons.js");

// Seasons move in order.
assert.deepEqual([...seasons.ORDER], ["Spring", "Summer", "Autumn", "Winter"]);
assert.equal(seasons.next("Spring"), "Summer");
assert.equal(seasons.next("Winter"), "Spring");
assert.equal(seasons.seasonOf({}), "Summer", "a garden without a season is in summer");

// Planting windows
assert.equal(seasons.canPlantIn("crop_potato", "Spring"), true);
assert.equal(seasons.canPlantIn("crop_potato", "Summer"), false);
assert.equal(seasons.canPlantIn("appletree", "Autumn"), true, "trees go in while dormant");
assert.equal(seasons.canPlantIn("appletree", "Summer"), false);
assert.equal(seasons.canPlantIn("hugel", "Winter"), false, "no digging into frozen ground");
assert.equal(seasons.canPlantIn("compost", "Winter"), true, "elements without a window go in any season");
for (const type of Object.keys(seasons.CROPS)) assert.ok(seasons.PLANTING[type], `${type} has sowing seasons`);
// The planting calendar and the crops, as the game teaches them
assert.deepEqual(JSON.parse(JSON.stringify(seasons.PLANTING)), {
  crop_potato: ["Spring"], crop_root: ["Spring", "Summer"], crop_leafy: ["Spring", "Summer"], crop_cabbage: ["Spring"], crop_herb: ["Spring", "Summer"],
  appletree: ["Spring", "Autumn"], hugel: ["Spring", "Summer", "Autumn"], herbspiral: ["Spring", "Summer", "Autumn"], pollinator: ["Spring", "Summer"],
  birdhouse: ["Spring", "Summer", "Autumn", "Winter"]
});
assert.deepEqual(Object.entries(seasons.CROPS).map(([type, c]) => [type, c.produce, c.readyAt, [...c.window].join("+"), c.yieldN]), [
  ["crop_potato", "potatoes", 3, "Autumn", 2],
  ["crop_root", "roots", 3, "Autumn", 2],
  ["crop_leafy", "leafy", 2, "Spring+Summer", 2],
  ["crop_cabbage", "cabbage", 3, "Autumn", 2],
  ["crop_herb", "herbs", 2, "Summer", 2]
]);

// Sowing a crop: a seed bank, one packet per crop per season, the sowing season.
const bank = { type: "seedbank" };
assert.equal(seasons.plantingBlock("crop_leafy", "auto", { placed: [], season: "Spring" }), "seedbank");
assert.equal(seasons.plantingBlock("crop_leafy", "auto", { placed: [bank], season: "Spring" }), null);
assert.equal(seasons.plantingBlock("crop_leafy", "auto", { placed: [bank], season: "Spring", seedAllowance: { crop_leafy: 1 } }), "packet");
assert.equal(seasons.plantingBlock("crop_leafy", "auto", { placed: [bank], season: "Spring", seedAllowance: { crop_leafy: 1 }, seedStock: { crop_leafy: 1 } }), null, "saved seed ignores the packet limit");
assert.equal(seasons.plantingBlock("crop_leafy", "auto", { placed: [bank], season: "Autumn" }), "season");
assert.equal(seasons.plantingBlock("crop_potato", "gift", { placed: [], season: "Winter", seedAllowance: { crop_potato: 3 } }), null, "a gift from the table can always be planted");
assert.equal(seasons.plantingBlock("appletree", "buy", { placed: [], season: "Winter" }), "season");
assert.equal(seasons.plantingBlock("bench", "buy", { placed: [], season: "Winter" }), null);
assert.equal(seasons.usesSavedSeed("crop_root", "buy", { seedStock: { crop_root: 2 } }), true);
assert.equal(seasons.usesSavedSeed("crop_root", "gift", { seedStock: { crop_root: 2 } }), false);
assert.equal(seasons.usesSavedSeed("compost", "buy", { seedStock: { compost: 2 } }), false);

assert.deepEqual(seasons.afterSowing({ seedAllowance: { crop_root: 0 }, seedStock: {} }, "crop_leafy", false), { seedAllowance: { crop_root: 0, crop_leafy: 1 }, seedStock: {} });
assert.deepEqual(seasons.afterSowing({ seedAllowance: {}, seedStock: { crop_leafy: 2 } }, "crop_leafy", true), { seedAllowance: {}, seedStock: { crop_leafy: 1 } }, "saved seed uses your own packet, not the season's");
assert.deepEqual(seasons.afterSowing({}, "bench", false), { seedAllowance: {}, seedStock: {} });

// A new planting
assert.deepEqual(seasons.startGrowth({ id: "a", type: "crop_herb" }), { id: "a", type: "crop_herb", stage: 1 });
assert.deepEqual(seasons.startGrowth({ id: "b", type: "appletree" }), { id: "b", type: "appletree", appleReady: false }, "a sapling has no fruit");
assert.deepEqual(seasons.startGrowth({ id: "c", type: "bench" }), { id: "c", type: "bench" });

// Harvest windows
assert.equal(seasons.readyToHarvest({ type: "crop_leafy", stage: 2 }, "Summer"), true);
assert.equal(seasons.readyToHarvest({ type: "crop_leafy", stage: 1 }, "Summer"), false);
assert.equal(seasons.readyToHarvest({ type: "crop_leafy" }, "Spring"), false, "a crop without a stage is at stage 1");
assert.equal(seasons.readyToHarvest({ type: "crop_potato", stage: 3 }, "Summer"), false);
assert.equal(seasons.readyToHarvest({ type: "crop_potato", stage: 3 }, "Autumn"), true);
assert.equal(seasons.readyToHarvest({ type: "bench", stage: 3 }, "Autumn"), false);

assert.deepEqual(seasons.harvestOf({ type: "crop_potato" }, [bank]), { produce: "potatoes", amount: 2, biennial: false, savesSeed: true });
assert.deepEqual(seasons.harvestOf({ type: "crop_root" }, [bank]), { produce: "roots", amount: 2, biennial: true, savesSeed: false }, "a biennial gives no seed in the year it is eaten");
assert.deepEqual(seasons.harvestOf({ type: "crop_herb" }, []), { produce: "herbs", amount: 2, biennial: false, savesSeed: false }, "seed goes back only to a seed bank");
assert.deepEqual([...seasons.BIENNIAL], ["crop_root", "crop_cabbage"], "carrots, beets and cabbages are biennial");
assert.equal(seasons.harvestOf({ type: "crop_cabbage" }, [bank]).savesSeed, false);

// Apple trees: eight seasons to bear, a partner and flowers nearby to set fruit.
assert.equal(seasons.TREE_MATURITY, 8);
assert.equal(seasons.treeSeasons({ seasonTurns: 5 }, { placedAtTurn: 1 }), 4);
assert.equal(seasons.treeSeasons({ seasonTurns: 1 }, { placedAtTurn: 3 }), 0);
assert.equal(seasons.treeGrowth({ seasonTurns: 4 }, { placedAtTurn: 0 }), 0.5);
assert.equal(seasons.treeGrowth({ seasonTurns: 30 }, { placedAtTurn: 0 }), 1);
assert.equal(seasons.plotDistance({ x: 0, y: 0 }, { x: 10, y: 0 }), 14, "the plot is drawn wider than it is deep");
assert.equal(seasons.plotDistance({ x: 0, y: 0 }, { x: 0, y: 10 }), 10);
const tree = { id: "t1", type: "appletree", x: 40, y: 50, placedAtTurn: 0 };
const partner = { id: "t2", type: "appletree", x: 60, y: 50, placedAtTurn: 0 };
const flowers = { id: "f", type: "pollinator", x: 50, y: 60 };
const orchard = placed => ({ seasonTurns: 9, placed });
assert.equal(seasons.applePollinationReady(orchard([tree, partner, flowers]), tree), true);
assert.equal(seasons.applePollinationReady(orchard([tree, { ...partner, placedAtTurn: 4 }, flowers]), tree), false, "the partner must be mature");
assert.equal(seasons.applePollinationReady(orchard([tree, partner]), tree), false, "flowers must be near");
assert.equal(seasons.applePollinationReady(orchard([tree, { ...partner, x: 75 }, flowers]), tree), false, "the partner must stand within 42");
assert.equal(seasons.applePollinationReady(orchard([tree, partner, { ...flowers, type: "herbspiral" }]), tree), true, "a herb spiral flowers too");
assert.equal(seasons.applePollinationReady(orchard([tree, { ...partner, x: 70 }, flowers]), tree), true, "a partner exactly 42 away still pollinates");
assert.equal(seasons.applePollinationReady(orchard([tree, partner, { ...flowers, x: 40, y: 82 }]), tree), true, "flowers exactly 32 away still count");
assert.equal(seasons.applePollinationReady(orchard([tree, partner, { ...flowers, x: 40, y: 83 }]), tree), false);

// One season of growth
const grow = (season, placed, held) => seasons.growSeason({ seasonTurns: 9, placed }, season, held);
let g = grow("Summer", [{ id: "a", type: "crop_leafy", stage: 1 }, { id: "b", type: "crop_potato", stage: 3 }, { id: "c", type: "crop_herb", stage: 2, winterState: "dormant" }]);
assert.deepEqual(g.placed, [
  { id: "a", type: "crop_leafy", stage: 2, winterState: null, pestHeld: false },
  { id: "b", type: "crop_potato", stage: 3 },
  { id: "c", type: "crop_herb", stage: 3, winterState: null, pestHeld: false }
], "young crops grow a stage; a crop at stage 3 is fully grown");
g = grow("Spring", [{ id: "a", type: "crop_leafy", stage: 1 }, { id: "b", type: "crop_herb", stage: 1 }], ["crop_leafy"]);
assert.deepEqual([g.placed[0].stage, g.placed[0].pestHeld, g.placed[1].stage, g.held], [1, true, 2, 1], "a pest holds the crops it feeds on");
g = grow("Winter", [{ id: "gh", type: "greenhouse" }, { id: "m", type: "mulch" }, { id: "a", type: "crop_leafy", stage: 1 }, { id: "b", type: "crop_root", stage: 2 }, { id: "c", type: "crop_herb", stage: 1 }, { id: "d", type: "crop_potato", stage: 3 }]);
assert.deepEqual(g.placed.map(p => [p.id, p.stage, p.winterState]), [["gh", undefined, undefined], ["m", undefined, undefined], ["a", 2, "protected"], ["b", 2, "dormant"], ["d", 3, undefined]]);
assert.deepEqual([g.greenhouseSaved, g.dormant, g.lost, g.hasMulch], [true, 1, 1, true], "winter: the greenhouse keeps salads, mulch lets roots sleep, frost takes the rest");
g = grow("Winter", [{ id: "a", type: "crop_leafy", stage: 1 }, { id: "b", type: "crop_cabbage", stage: 1 }]);
assert.deepEqual([g.placed.length, g.lost, g.hasMulch], [0, 2, false], "bare soil loses its young crops to frost");
g = grow("Autumn", [tree, partner, flowers, { id: "t3", type: "appletree", x: 10, y: 20, placedAtTurn: 0 }, { id: "t4", type: "appletree", x: 70, y: 80, placedAtTurn: 6 }]);
assert.deepEqual(g.placed.filter(p => p.type === "appletree").map(p => [p.id, p.appleReady]), [["t1", true], ["t2", true], ["t3", false], ["t4", false]]);
assert.equal(g.applesWaiting, 1, "a mature tree without a partner and flowers waits");
assert.equal(grow("Summer", [{ ...tree, appleReady: true }]).placed[0].appleReady, false, "apples are picked in autumn");

// What each season leaves to gather
assert.deepEqual(seasons.seasonFinds("Summer"), { cherryPicks: 3, springSprouts: 0, leafPiles: 0 });
assert.deepEqual(seasons.seasonFinds("Spring"), { cherryPicks: 0, springSprouts: 3, leafPiles: 0 });
assert.deepEqual(seasons.seasonFinds("Autumn"), { cherryPicks: 0, springSprouts: 0, leafPiles: 3 });
assert.deepEqual(seasons.seasonFinds("Winter"), { cherryPicks: 0, springSprouts: 0, leafPiles: 0 });
assert.equal(seasons.firstSpringSowing({ placed: [bank] }, "Spring"), true);
assert.equal(seasons.firstSpringSowing({ placed: [bank], springBonusDone: true }, "Spring"), false);
assert.equal(seasons.firstSpringSowing({ placed: [] }, "Spring"), false);
assert.equal(seasons.firstAutumnHarvest({}, "Autumn"), true);
assert.equal(seasons.firstAutumnHarvest({ autumnHarvestDone: true }, "Autumn"), false);
assert.equal(seasons.firstAutumnHarvest({}, "Summer"), false);

console.log("Season rules OK: planting windows, sowing, growth and winter, harvests, apple trees and seasonal finds.");
