import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const lesson = require("../lib/living-lesson.js");

const base = {
  season: "Summer",
  placedTypes: ["compost", "rain", "appletree"],
  systems: {
    soil: { value: 22, reason: "Organic matter is feeding the soil." },
    water: { value: 30, reason: "Rain is stored; connect it to a growing area." },
    food: { value: 13, reason: "Food is growing; add flowering partners." },
    habitat: { value: 0, reason: "Wild neighbours still need shelter." }
  },
  links: [],
  journey: { done: 3, total: 6, currentKey: "shelter", completedKeys: ["soil", "water", "food"] },
  sharedActs: 0,
  completedChallenges: [],
  guildKeys: [],
  harvests: 0,
  preserved: 0,
  lastChange: { system: "food", delta: 13, text: "Food began to grow." }
};

const sanitized = lesson.sanitizeSnapshot({ ...base, season: "Moon", placedTypes: ["rain", "rain", "<script>bad</script>"] });
assert.equal(sanitized.season, "Summer");
assert.deepEqual(sanitized.placedTypes, ["rain"]);
assert.ok(!JSON.stringify(sanitized).includes("script"));
assert.equal(sanitized.systems.soil.value, 22);
assert.equal(lesson.fingerprint(base), lesson.fingerprint(JSON.parse(JSON.stringify(base))));

const candidates = lesson.buildCandidates(base);
assert.ok(candidates.length >= 2 && candidates.length <= 4);
assert.equal(candidates[0].id, "strengthen-habitat");
assert.ok(candidates.some(candidate => candidate.kind === "share_gain"));

const normalized = lesson.normalizeLesson({
  candidateId: "invented-action",
  focus: "season",
  observation: "<b>I notice a quiet edge.</b>",
  relationship: "Connected habitat can offer food, cover and water without guaranteeing a visitor.",
  question: "Which edge could become more connected?"
}, base, candidates, { source: "ai", model: "openai/gpt-5.6-luna" });
assert.equal(normalized.candidateId, candidates[0].id);
assert.equal(normalized.focus, candidates[0].focus);
assert.ok(!normalized.observation.includes("<b>"));
assert.equal(normalized.source, "ai");
assert.equal(normalized.experiment.action, candidates[0].action);

const fallback = lesson.fallbackLesson(base, candidates);
assert.equal(fallback.source, "fallback");
assert.ok(fallback.observation.length > 10);
assert.ok(fallback.question.endsWith("?"));

const flourishing = lesson.buildCandidates({
  ...base,
  systems: { soil: { value: 100 }, water: { value: 100 }, food: { value: 100 }, habitat: { value: 100 } },
  links: [
    { kind: "soil", fromType: "mulch", toType: "appletree" },
    { kind: "water", fromType: "rain", toType: "appletree" },
    { kind: "food", fromType: "pollinator", toType: "appletree" },
    { kind: "habitat", fromType: "birdhouse", toType: "mulch" }
  ],
  journey: { done: 6, currentKey: "challenge", completedKeys: ["soil", "water", "food", "shelter", "share", "challenge"] },
  sharedActs: 3,
  guildKeys: ["orchard-edge"]
});
assert.ok(flourishing.length >= 2);
assert.ok(flourishing.every(candidate => candidate.target !== candidate.baseline), "flourishing candidates must still require a real change");

function rawExperiment(candidate) {
  return { id: candidate.id + "-test", candidate, lessonFingerprint: "test", startedAt: new Date().toISOString(), status: "active", progress: "Started" };
}

const metricCases = [
  {
    candidate: { id: "strengthen-soil", kind: "system_gain", focus: "soil", title: "Soil", action: "Act", why: "Why", success: "Success", baseline: 20, target: 28 },
    next: { ...base, systems: { ...base.systems, soil: { value: 30, reason: "Covered" } } }
  },
  {
    candidate: { id: "connect-water", kind: "link_added", focus: "relationships", title: "Water", action: "Act", why: "Why", success: "Success", baseline: 0, target: 1 },
    next: { ...base, links: [{ kind: "water", label: "Stored rain feeds roots", fromType: "rain", toType: "appletree" }] }
  },
  {
    candidate: { id: "circulate-first-gift", kind: "share_gain", focus: "sharing", title: "Share", action: "Act", why: "Why", success: "Success", baseline: 0, target: 1 },
    next: { ...base, sharedActs: 1 }
  },
  {
    candidate: { id: "discover-first-guild", kind: "guild_gain", focus: "relationships", title: "Guild", action: "Act", why: "Why", success: "Success", baseline: 0, target: 1 },
    next: { ...base, guildKeys: ["orchard-edge"] }
  },
  {
    candidate: { id: "read-next-season", kind: "challenge_gain", focus: "season", title: "Season", action: "Act", why: "Why", success: "Success", baseline: 0, target: 1 },
    next: { ...base, completedChallenges: ["autumn"] }
  },
  {
    candidate: { id: "balance-living-web", kind: "balance_gap", focus: "relationships", title: "Balance", action: "Act", why: "Why", success: "Success", baseline: 30, target: 20 },
    next: { ...base, systems: { soil: { value: 30 }, water: { value: 30 }, food: { value: 25 }, habitat: { value: 20 } } }
  }
];

for (const item of metricCases) {
  const checked = lesson.checkExperiment(rawExperiment(item.candidate), item.next);
  assert.equal(checked.status, "completed", item.candidate.kind + " should complete deterministically");
}

const restored = lesson.sanitizeHistory(metricCases.map(item => ({ ...rawExperiment(item.candidate), status: "completed" })));
assert.equal(restored.length, metricCases.length);
console.log("Living Lesson engine tests passed.");
