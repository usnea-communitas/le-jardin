// Unit tests for lib/wildlife.js: who lives in the garden, who arrives and who
// may visit, the residents' stories, and pests as a reading of the garden.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const wildlife = require("../lib/wildlife.js");

const elements = types => types.map((type, i) => ({ id: "e" + i, type, x: 40 + i * 3, y: 50, stage: 1 }));
const living = types => [...wildlife.activeOf(elements(types))].sort();

// Who lives here: every need met by an element that stands here today.
assert.deepEqual(wildlife.HABITATS.map(w => w.key), ["worm", "winecap", "oyster", "field", "bee", "butterfly", "bird", "hedgehog", "ladybug", "beetle"]);
assert.deepEqual(living([]), []);
assert.deepEqual(living(["compost", "mulch"]), ["hedgehog", "worm"]);
assert.deepEqual(living(["birdbath", "birdhouse"]), ["bird"]);
assert.deepEqual(living(["birdbath"]), [], "every need must be met");
assert.deepEqual(living(["rain", "birdhouse"]), [], "a closed rain barrel is not a drinking place for birds");
assert.deepEqual(living(["rain", "pollinator"]), [], "…nor for bees");
assert.deepEqual(wildlife.HABITATS.map(w => [w.key, w.needs.map(need => need.join("|")).join(" & ")]), [
  ["worm", "compost|hugel & mulch"],
  ["winecap", "mulch & hugel"],
  ["oyster", "hugel & mulch|bughotel"],
  ["field", "compost & pollinator|herbspiral"],
  ["bee", "pollinator|herbspiral|arch & birdbath"],
  ["butterfly", "pollinator|herbspiral & hugel|mulch|arch"],
  ["bird", "birdbath & birdhouse"],
  ["hedgehog", "mulch|hugel & pollinator|compost"],
  ["ladybug", "pollinator|herbspiral & bughotel"],
  ["beetle", "bughotel & mulch|hugel|compost"]
], "what each neighbour needs");
assert.deepEqual(living(["herbspiral", "birdbath", "bughotel"]), ["bee", "ladybug"], "a need is met by any one of its elements");
assert.deepEqual([...wildlife.activeOf(undefined)], []);

// Who arrives with a change of the garden, first or returning
const came = wildlife.arrivals(elements(["compost"]), elements(["compost", "mulch"]), ["hedgehog"]);
assert.deepEqual([came.arrived, came.first, came.returning, came.seen], [["worm", "hedgehog"], ["worm"], ["hedgehog"], ["hedgehog", "worm"]]);
assert.deepEqual(wildlife.arrivals(elements(["compost", "mulch"]), elements(["compost", "mulch", "bench"]), []).arrived, [], "nobody new");

// Who may come to visit: exactly one need short, with a visit in this season
const visits = { bee: {}, butterfly: { seasons: ["Spring", "Summer"] }, ladybug: {}, field: {}, bird: {} };
const st = (season, extra = {}) => ({ season, ...extra });
const candidates = (season, types, extra, away = {}) => wildlife.visitCandidates(st(season, extra), elements(types), wildlife.activeOf(elements(types)), visits, away);
assert.deepEqual(candidates("Summer", ["pollinator"]), ["field", "bee", "butterfly", "ladybug"]);
assert.deepEqual(candidates("Autumn", ["pollinator"]), ["field", "bee", "ladybug"], "a butterfly visits in spring and summer only");
assert.deepEqual(candidates("Winter", ["pollinator"], {}, { bee: "overwintering" }), ["field", "ladybug"], "nobody visits from their winter quarters");
assert.deepEqual(candidates("Summer", ["pollinator"], { guests: ["bee"], visitsDone: { field: true } }), ["butterfly", "ladybug"], "a guest or a past visit does not come again");
assert.deepEqual(candidates("Summer", ["pollinator", "birdbath"]), ["field", "butterfly", "bird", "ladybug"], "a resident does not visit; the bird is one need short");
assert.deepEqual(candidates("Summer", ["bench"]), [], "two needs short is too far");
assert.deepEqual(wildlife.visitCandidates(st("Summer"), elements(["birdbath", "birdhouse"]), new Set(), visits, {}), ["bee"], "a visitor is exactly one need short: the bird, with none short, is not one");
assert.equal(wildlife.VISIT_CHANCE, 0.22);
assert.equal(wildlife.visitPossible({ season: "Summer" }, true, 0), true);
assert.equal(wildlife.visitPossible({ season: "Summer" }, false, 0), false, "wild neighbours must be introduced first");
assert.equal(wildlife.visitPossible({ season: "Summer" }, true, 1), false, "not when someone just arrived");
assert.equal(wildlife.visitPossible({ season: "Summer", visit: { key: "bee" } }, true, 0), false);
assert.equal(wildlife.visitPossible({ season: "Summer", gate: { key: "rain" } }, true, 0), false);
assert.equal(wildlife.visitPossible({ season: "Summer", visitSeason: "Summer" }, true, 0), false, "one visit a season");
assert.equal(wildlife.visitPossible({ visitSeason: "Spring" }, true, 0), true);

// Back in spring: residents who were away for the winter, three at most
const away = { worm: "w", bee: "b", hedgehog: "h", ladybug: "l", beetle: "x" };
assert.deepEqual(wildlife.returningInSpring(elements(["compost", "mulch", "pollinator", "birdbath", "bughotel"]), away), ["worm", "bee", "hedgehog"]);
assert.deepEqual(wildlife.returningInSpring(elements(["birdbath", "birdhouse"]), away), [], "birds stay through the winter");

// How long each resident has lived here
let counted = wildlife.countResidents({ season: "Autumn", placed: elements(["compost", "mulch"]), residentSeasons: { hedgehog: 2, bee: 4 }, residentWinters: { hedgehog: 1, bee: 1 } });
assert.deepEqual([counted.residentSeasons, counted.residentWinters], [{ hedgehog: 3, bee: 0, worm: 1 }, { hedgehog: 1, bee: 0 }], "a resident who left starts again; winters are counted when leaving winter");
counted = wildlife.countResidents({ season: "Winter", placed: elements(["compost", "mulch"]), residentSeasons: { hedgehog: 3 }, residentWinters: { hedgehog: 0 } });
assert.deepEqual([counted.residentSeasons.hedgehog, counted.residentWinters.hedgehog], [4, 1], "leaving winter counts a winter");

// The residents' stories, one beat at a time
const due = extra => wildlife.dueResidentBeats({ placed: elements(["compost", "mulch"]), ...extra }, extra.values).map(b => b.id);
assert.deepEqual(due({ values: {} }), ["hedgehog-1", "worm-1"]);
assert.deepEqual(due({ residentBeatsSeen: ["hedgehog-1", "worm-1"], values: {} }), [], "the next beat waits for its condition");
assert.deepEqual(due({ residentBeatsSeen: ["hedgehog-1"], residentWinters: { hedgehog: 1 }, values: {} }), ["hedgehog-2", "worm-1"]);
const hedgehog3 = habitat => due({ residentBeatsSeen: ["hedgehog-1", "hedgehog-2", "worm-1"], residentSeasons: { hedgehog: 3 }, residentWinters: { hedgehog: 1 }, values: { habitat } });
assert.deepEqual([hedgehog3(51), hedgehog3(52)], [[], ["hedgehog-3"]], "young hedgehogs need a winter, three seasons and habitat 52");
const worm = (soil, winters) => due({ residentBeatsSeen: ["hedgehog-1", "worm-1"].concat(soil > 60 ? ["worm-2"] : []), residentWinters: { worm: winters }, values: { soil } });
assert.deepEqual([worm(49, 0), worm(50, 0), worm(63, 1), worm(64, 1), worm(64, 0)], [[], ["worm-2"], [], ["worm-3"], []]);
const bees = (seasons, food) => wildlife.dueResidentBeats({ placed: elements(["pollinator", "birdbath"]), residentBeatsSeen: ["bee-1", "bee-2"], residentSeasons: { bee: seasons } }, { food }).map(b => b.id);
assert.deepEqual([bees(2, 44), bees(2, 45), bees(1, 90)], [[], ["bee-3"], []], "fruit follows the bees after two seasons and food 45");
assert.deepEqual(wildlife.dueResidentBeats({ placed: elements(["compost", "mulch"]) }, {})[0], { id: "hedgehog-1", resident: "hedgehog", index: 1, total: 3 });

// Pests: a reading of the garden, never a dice roll
const step = (types, season, wild, prev = {}, allow = true) => wildlife.stepPests({ seasonTurns: 6, placed: elements(types), ...prev }, season, new Set(wild), allow);
assert.equal(step(["crop_leafy"], "Spring", []).pestActive, "aphid", "aphids appear when crops grow with no predator habitat");
assert.notEqual(step(["crop_leafy"], "Spring", ["ladybug"]).pestActive, "aphid", "ladybugs prevent the aphid outbreak");
assert.equal(step(["crop_leafy"], "Spring", ["ladybug"]).pestActive, "slug", "…while slugs still find the salads");
assert.equal(step(["crop_leafy"], "Spring", ["ladybug", "hedgehog"]).pestActive, null, "with every relevant ally present nothing breaks out");
assert.equal(step(["mulch"], "Spring", []).pestActive, null, "no crops, nothing to feed on");
assert.equal(step(["crop_cabbage"], "Winter", []).pestActive, null, "no outbreak begins in winter");
assert.equal(step(["crop_cabbage"], "Summer", ["ladybug"]).pestActive, "caterpillar", "caterpillars come to brassicas in summer");
assert.equal(step(["crop_leafy"], "Spring", [], {}, false).pestActive, null, "no onset when the game does not allow it");
assert.equal(wildlife.stepPests({ seasonTurns: 1, placed: elements(["crop_leafy"]) }, "Spring", new Set()).pestActive, null, "nothing breaks out in a new garden's first seasons");
assert.equal(step(["crop_leafy"], "Spring", [], { pestLastSettled: 5 }).pestActive, null, "two calm seasons after an outbreak settles");
assert.equal(step(["crop_leafy"], "Spring", [], { pestLastSettled: 4 }).pestActive, "aphid");
assert.equal(wildlife.stepPests({ seasonTurns: 6, placed: elements(["crop_leafy"]) }, "Spring", new Set()).pestActive, "aphid", "onset is allowed unless the game says otherwise");

const persisted = step(["crop_leafy"], "Summer", [], { pestActive: "aphid", pestSeasons: { aphid: 1 }, pestRelief: { aphid: 2 } });
assert.deepEqual([persisted.pestActive, persisted.pestSeasons.aphid, persisted.pestRelief.aphid], ["aphid", 2, 1], "an unaddressed outbreak persists and relief wears off");
const settled = step(["crop_leafy", "bughotel", "pollinator"], "Summer", ["ladybug"], { pestActive: "aphid", pestSeasons: { aphid: 2 } });
assert.deepEqual([settled.pestActive, settled.pestCleared.aphid, settled.pestLastSettled], [null, true, 6], "an ally settles the pest for good");
const gone = step(["mulch"], "Summer", [], { pestActive: "aphid", pestSeasons: { aphid: 2 } });
assert.deepEqual([gone.pestActive, gone.pestCleared.aphid, gone.pestLastSettled], [null, undefined, 6], "without its crops a pest leaves, but nothing was learned");
const back = step(["crop_cabbage"], "Summer", ["ladybug"], { pestCleared: { caterpillar: true } });
assert.deepEqual([back.pestActive, back.pestReturned], ["caterpillar", "caterpillar"], "a cleared pest may return briefly");
assert.equal(step(["crop_leafy"], "Spring", []).pestReturned, null);

// What each pest feeds on, when, and what would bring its allies
assert.deepEqual(wildlife.PESTS.map(p => [p.key, [...p.seasons].join("+"), [...p.crops].join("+"), wildlife.allyKeys(p).join("+"), [...p.build].join("+")]), [
  ["aphid", "Spring+Summer", "crop_leafy+crop_herb+crop_root+crop_potato+crop_cabbage", "ladybug", "bughotel+pollinator+herbspiral"],
  ["slug", "Spring+Autumn", "crop_leafy+crop_cabbage", "hedgehog+beetle+bird", "mulch+hugel+bughotel+birdhouse"],
  ["caterpillar", "Summer", "crop_cabbage", "bird", "birdhouse+birdbath"]
]);

// The crops a pest holds, and what would bring its allies
const aphids = wildlife.pest("aphid");
assert.deepEqual([...wildlife.heldCrops({ pestActive: "aphid" })], [...aphids.crops]);
assert.deepEqual(wildlife.heldCrops({ pestActive: "aphid", pestRelief: { aphid: 1 } }), [], "relief buys a season");
assert.deepEqual(wildlife.heldCrops({ pestActive: "aphid", pestCleared: { aphid: true } }), []);
assert.deepEqual(wildlife.heldCrops({}), []);
assert.deepEqual(wildlife.allyKeys(wildlife.pest("slug")), ["hedgehog", "beetle", "bird"]);
assert.deepEqual(wildlife.allyKeys(aphids), ["ladybug"]);
assert.deepEqual(wildlife.missingBuilds({ placed: elements(["pollinator"]) }, aphids), ["bughotel", "herbspiral"]);
assert.equal(wildlife.pest("nothing"), null);

// The pests' stories
const pestDue = extra => wildlife.duePestBeats(extra).map(b => b.id);
assert.deepEqual(pestDue({ pestActive: "aphid", pestSeasons: { aphid: 1 } }), ["aphid-1"]);
assert.deepEqual(pestDue({ pestActive: "aphid", pestSeasons: { aphid: 1 }, pestBeatsSeen: ["aphid-1"] }), []);
assert.deepEqual(pestDue({ pestActive: "aphid", pestSeasons: { aphid: 2 }, pestBeatsSeen: ["aphid-1"] }), ["aphid-2"]);
assert.deepEqual(wildlife.duePestBeats({ pestCleared: { slug: true }, pestBeatsSeen: ["slug-1", "slug-2"] }), [{ id: "slug-3", pest: "slug", index: 3, total: 3, resolved: true }]);
assert.deepEqual(pestDue({}), []);

console.log("Wildlife rules OK: habitats, arrivals, visits, returning residents, resident stories and pests.");
