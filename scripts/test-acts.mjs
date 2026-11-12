// Unit tests for lib/acts.js: the six acts of the guided journey, what opens
// along the way, the suggestions, and the first cycle and a flourishing garden.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const acts = require("../lib/acts.js");
const workshop = require("../lib/workshop.js");

assert.deepEqual([...acts.ACTS], ["soil", "water", "food", "shelter", "share", "challenge"]);
assert.deepEqual([...acts.ACTS], workshop.ACT_KEYS, "the workshop mode names the same six acts");

const garden = (types, extra = {}) => ({ placed: types.map((type, i) => ({ id: "e" + i, type })), ...extra });
const done = st => acts.ACTS.filter(act => acts.actsDone(st)[act]);

// The first four acts describe the garden as it is now.
assert.deepEqual(done(garden([])), []);
assert.deepEqual(done(garden(["compost"])), ["soil"]);
assert.deepEqual(done(garden(["hugel"])), ["soil", "food"], "a hügel bed feeds the soil and grows food");
assert.deepEqual(done(garden(["rain", "crop_leafy", "birdhouse"])), ["water", "food", "shelter"]);
assert.deepEqual(done(garden(["seedbank", "bench", "sign", "kitchen", "birdbath"])), [], "a seed bank prepares a crop but grows no food yet");
assert.deepEqual(done(garden([], { journeyMoments: ["soil", "water"] })), [], "a moment never keeps a missing layer complete");
// The last two are moments: once done, they stay done.
assert.deepEqual(done(garden([], { sharedActs: 1 })), ["share"]);
assert.deepEqual(done(garden([], { journeyMoments: ["share", "challenge"] })), ["share", "challenge"]);

// Where the journey is
const all = garden(["compost", "rain", "crop_leafy", "pollinator"], { journeyMoments: ["share", "challenge"] });
assert.deepEqual(acts.progress(garden([])), { done: acts.actsDone(garden([])), count: 0, total: 6, current: "soil", index: 0, ready: false });
assert.deepEqual([acts.progress(garden(["compost", "rain"])).current, acts.progress(garden(["compost", "rain"])).index], ["food", 2]);
assert.deepEqual([acts.progress(garden(["rain"])).current, acts.progress(garden(["rain"])).count], ["soil", 1], "the current act is the first one not done");
assert.deepEqual([acts.progress(all).ready, acts.progress(all).current, acts.progress(all).index], [true, "challenge", 5]);

// What opens along the way
const fourActs = garden(["compost", "rain", "crop_leafy", "pollinator"]);
assert.equal(acts.sharingOpen(garden(["compost", "rain", "crop_leafy"])), false);
assert.equal(acts.sharingOpen(fourActs), true, "the table opens with the fifth act");
assert.equal(acts.sharingOpen(garden([], { mode: "explore" })), true, "at once in free play");
assert.equal(acts.sharingOpen(garden([], { journeyMoments: ["share"] })), true, "and stays open after a gift");
assert.equal(acts.askingOpen(garden(["bench"])), false);
assert.equal(acts.askingOpen(garden(["bench", "sign"])), true, "two elements are enough to ask the garden");
assert.equal(acts.askingOpen(garden(["hugel"])), true, "two acts are enough too");
assert.equal(acts.wildlifeIntroduced(garden(["compost", "rain"])), false);
assert.equal(acts.wildlifeIntroduced(garden(["compost", "rain", "crop_leafy"])), true, "wild neighbours come with the fourth act");
assert.equal(acts.wildlifeIntroduced(garden([], { journeyMoments: ["shelter"] })), true);
assert.equal(acts.pestsAllowed({ ...fourActs, mode: "guided" }), false, "the guided journey is never interrupted by pests");
assert.equal(acts.pestsAllowed({ ...all, mode: "guided" }), true);
assert.equal(acts.pestsAllowed(garden([], { mode: "explore" })), true);

// Unlock cards, in order, each once
assert.deepEqual([...acts.UNLOCKS], ["sharing", "seedbank", "kitchen", "askgarden", "seedsaved"]);
const busy = garden(["compost", "rain", "crop_leafy", "pollinator", "seedbank", "kitchen"], { seedStock: { crop_leafy: 1 } });
assert.equal(acts.nextUnlock(busy), "sharing");
assert.equal(acts.nextUnlock({ ...busy, unlocksSeen: ["sharing"] }), "seedbank");
assert.equal(acts.nextUnlock({ ...busy, unlocksSeen: ["sharing", "seedbank", "kitchen"] }), "askgarden");
assert.equal(acts.nextUnlock({ ...busy, unlocksSeen: ["sharing", "seedbank", "kitchen", "askgarden"] }), "seedsaved");
assert.equal(acts.nextUnlock({ ...busy, unlocksSeen: [...acts.UNLOCKS] }), null);
assert.equal(acts.nextUnlock({ ...busy, story: true }), null, "never during the opening story");
assert.equal(acts.nextUnlock({ ...busy, intro: true }), null);
assert.equal(acts.unlocked("askgarden", garden(["bench", "sign"])), false, "asking the garden opens with two acts or three elements");
assert.equal(acts.unlocked("askgarden", garden(["bench", "sign", "birdbath"])), true);
assert.equal(acts.unlocked("seedsaved", garden([], { seedStock: { crop_root: 0 } })), false);
assert.equal(acts.unlocked("nothing", busy), false);

// What the guided journey suggests
const atShare = garden(["compost", "rain", "crop_leafy", "pollinator"]);
assert.equal(acts.nudge(atShare, true), "share");
assert.equal(acts.nudge({ ...atShare, cherryPicks: 2 }, false), "pick");
assert.equal(acts.nudge(atShare, false), "grow");
assert.equal(acts.nudge({ ...atShare, sharedActs: 1 }, false), "season", "after the gift, turn the season");
assert.equal(acts.nudge(garden(["compost"]), true), null, "the first acts need no suggestion");
assert.equal(acts.nudge({ ...atShare, mode: "explore" }, true), null);
assert.equal(acts.nudge(all, true), null);

// The first cycle and a flourishing garden
const strong = { soil: 60, water: 50, food: 45, habitat: 70 };
const flourishing = { ...all, seasonTurns: 4, sharedActs: 2, harvestEver: true, gardenEffects: { compost: 1, rain: 0.5, bee: 1, mulch: 0 } };
assert.deepEqual(acts.completion(flourishing, { links: 1, values: strong, connections: 2 }), { firstCycleReady: true, flourishingReady: true, missing: [], challengeKinds: 3 });
assert.deepEqual(acts.completion(flourishing, { links: 0, values: strong, connections: 2 }).missing, ["relationship"], "a first cycle needs one visible relationship");
assert.deepEqual(acts.completion(garden([]), { links: 0, values: { soil: 0, water: 0, food: 0, habitat: 0 }, connections: 0 }).missing,
  ["act", "seasons", "resilience", "connections", "gifts", "harvest", "challenges"]);
assert.deepEqual(acts.completion({ ...flourishing, seasonTurns: 3 }, { links: 1, values: { ...strong, food: 44 }, connections: 1 }).missing, ["seasons", "resilience", "connections"]);
assert.equal(acts.completion({ ...flourishing, gardenEffects: { compost: 1, rain: 1 } }, { links: 1, values: strong, connections: 2 }).flourishingReady, false, "three different challenges");

console.log("Act rules OK: six acts, progress, what opens, unlock cards, suggestions, first cycle and flourishing.");
