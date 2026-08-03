import assert from "node:assert/strict";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const engine = require(path.join(root, "lib", "living-lesson.js"));
const locales = engine.SUPPORTED_LOCALES.filter(locale => locale !== "en");
const fields = ["title", "action", "why", "success"];

const readCatalog = async locale => JSON.parse(await readFile(path.join(root, "assets", "i18n", `catalog.${locale}.json`), "utf8"));
const english = await readCatalog("en");

function leaves(catalog) {
  return { ...(catalog.messages || {}), ...(catalog.templates || {}) };
}

function sourceOf(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  return value.source || value.template || value.value || value.text || value.other || value.one || "";
}

function compile(source, key) {
  const names = [];
  let cursor = 0;
  let pattern = "^";
  const token = /%\{([a-zA-Z0-9_]+)\}|\{([a-zA-Z0-9_]+)\}/g;
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let match;
  while ((match = token.exec(source))) {
    pattern += escape(source.slice(cursor, match.index)).replace(/\s+/g, "\\s+");
    pattern += "(.+?)";
    names.push(match[1] || match[2]);
    cursor = match.index + match[0].length;
  }
  if (!names.length) return null;
  pattern += escape(source.slice(cursor)).replace(/\s+/g, "\\s+") + "$";
  return { key, source, names, regex: new RegExp(pattern, "u") };
}

const englishLeaves = leaves(english);
const exactKeys = new Map();
const templateKeys = [];
for (const [key, value] of Object.entries(englishLeaves)) {
  const source = sourceOf(value);
  if (!source) continue;
  const compiled = compile(source, key);
  if (compiled) templateKeys.push(compiled);
  else exactKeys.set(source, key);
}
templateKeys.sort((a, b) => b.source.length - a.source.length);

function resolveEnglishKey(value) {
  if (exactKeys.has(value)) return { key: exactKeys.get(value), vars: {} };
  for (const entry of templateKeys) {
    const match = entry.regex.exec(value);
    if (!match) continue;
    const vars = {};
    entry.names.forEach((name, index) => { vars[name] = match[index + 1]; });
    return { key: entry.key, vars };
  }
  return null;
}

function snapshot(overrides = {}) {
  const systems = overrides.systems || Object.fromEntries(engine.SYSTEM_KEYS.map(key => [key, { value: 60 }]));
  return {
    locale: "en",
    season: "Summer",
    placedTypes: [],
    systems,
    links: [],
    journey: { done: 0, currentKey: "soil", completedKeys: [] },
    sharedActs: 0,
    completedChallenges: [],
    guildKeys: [],
    harvests: 0,
    preserved: 0,
    ...overrides,
    systems
  };
}

const scoreProfiles = [0, 20, 50, 80, 92].map(value =>
  Object.fromEntries(engine.SYSTEM_KEYS.map(key => [key, { value }]))
);
for (const weakest of engine.SYSTEM_KEYS) {
  for (const value of [0, 17, 40, 80]) {
    scoreProfiles.push(Object.fromEntries(engine.SYSTEM_KEYS.map(key => [key, { value: key === weakest ? value : 88 }])));
  }
}

const placedSets = [
  [], ["compost"], ["compost", "mulch"], ["rain"], ["appletree"],
  ["appletree", "pollinator"], ["bughotel"],
  ["compost", "mulch", "rain", "appletree", "pollinator", "bughotel"]
];
const journeyStates = [
  { done: 0, currentKey: "soil", completedKeys: [] },
  { done: 3, currentKey: "share", completedKeys: ["soil", "water", "food"] },
  { done: 5, currentKey: "challenge", completedKeys: ["soil", "water", "food", "shelter", "share"] }
];
const linkTypes = {
  soil: ["mulch", "appletree"], water: ["rain", "appletree"],
  food: ["pollinator", "appletree"], habitat: ["bughotel", "pollinator"]
};

const variants = new Map();
for (const systems of scoreProfiles) {
  for (const placedTypes of placedSets) {
    for (const journey of journeyStates) {
      for (const sharedActs of [0, 1]) {
        for (const guildCount of [0, 1]) {
          for (let mask = 0; mask < 16; mask += 1) {
            const links = engine.SYSTEM_KEYS.flatMap((kind, index) => {
              if (!(mask & (1 << index))) return [];
              const [fromType, toType] = linkTypes[kind];
              return [{ kind, fromType, toType }];
            });
            const state = snapshot({
              systems, placedTypes, journey, sharedActs, links,
              guildKeys: guildCount ? ["guild-test"] : [],
              completedChallenges: journey.done >= 5 ? ["challenge-test"] : []
            });
            for (const candidate of engine.buildCandidates(state)) {
              const signature = fields.map(field => candidate[field]).join("\u241f");
              if (!variants.has(signature)) variants.set(signature, { candidate, state });
            }
          }
        }
      }
    }
  }
}

const expectedIds = [
  "strengthen-soil", "strengthen-water", "strengthen-food", "strengthen-habitat",
  "connect-soil", "connect-water", "connect-food", "connect-habitat",
  "read-next-season", "circulate-first-gift", "discover-first-guild",
  "balance-living-web", "circulate-another-gift"
];
const foundIds = new Set([...variants.values()].map(entry => entry.candidate.id));
assert.deepEqual([...expectedIds].sort(), [...foundIds].sort(), "The matrix must reach every Living Lesson candidate family.");

const expectedActions = [
  "Add compost to begin feeding the soil community.",
  "Add mulch to protect the soil you are feeding.",
  "Place protective mulch close to a growing area so cover and roots work as one system.",
  "Add safe rain harvesting so water can pause in the garden.",
  "Place rain harvesting close to a growing area so stored water has a clear purpose.",
  "Add one edible layer, such as a fruit tree, herb spiral or growing bed.",
  "Add pollinator flowers beside food so bloom and harvest support each other.",
  "Place flowering habitat close to an edible crop so pollinators and harvest reinforce one another.",
  "Add flowers, a bug hotel or a bird house to make room for other lives.",
  "Place shelter close to food or cover so wildlife finds a connected refuge."
];
const foundActions = new Set([...variants.values()].map(entry => entry.candidate.action));
for (const action of expectedActions) assert.ok(foundActions.has(action), `Candidate matrix did not reach action: ${action}`);

const corpus = [];
const add = (kind, value) => { if (value && !corpus.some(item => item.value === value)) corpus.push({ kind, value }); };
for (const { candidate } of variants.values()) fields.forEach(field => add(`candidate.${field}`, candidate[field]));

const focusCandidate = new Map();
for (const { candidate } of variants.values()) if (!focusCandidate.has(candidate.focus)) focusCandidate.set(candidate.focus, candidate);
assert.deepEqual([...focusCandidate.keys()].sort(), [...engine.FOCUS_KEYS].sort(), "The matrix must reach every fallback focus.");
for (const [focus, candidate] of focusCandidate) {
  const state = snapshot({ systems: Object.fromEntries(engine.SYSTEM_KEYS.map(key => [key, { value: key === focus ? 0 : 70 }])) });
  const lesson = engine.fallbackLesson(state, [candidate]);
  add(`fallback.${focus}.observation`, lesson.observation);
  add(`fallback.${focus}.relationship`, lesson.relationship);
  add(`fallback.${focus}.question`, lesson.question);
  const generic = engine.normalizeLesson({ candidateId: candidate.id, focus, observation: "", relationship: "", question: "" }, state, [candidate], { source: "fallback" });
  add("fallback.question.generic", generic.question);
}

for (const { candidate, state } of variants.values()) {
  const rawExperiment = {
    id: `${candidate.id}-matrix`, candidate, lessonFingerprint: "matrix", startedAt: new Date(0).toISOString(),
    status: "active", progress: "Experiment started — keep observing the garden."
  };
  add("progress.started", rawExperiment.progress);
  const checked = engine.checkExperiment(rawExperiment, state);
  if (checked) add(`progress.${candidate.kind}`, checked.progress);
  add("toast.started", `✦ The garden offers a small experiment — ${candidate.success}`);
}
add("toast.completed", "✦ The garden saw it. What you changed is now part of what it knows.");

for (const { kind, value } of corpus) {
  const resolution = resolveEnglishKey(value);
  assert.ok(resolution, `No English localization source covers ${kind}: ${value}`);
}

const systemKeys = {
  soil: "systems.soil.name", water: "systems.water.name", food: "systems.food.name", habitat: "systems.habitat.name",
  sharing: "pillars.sharing.name", relationships: "common.relationships", season: "common.season"
};
const actionKeys = new Map(expectedActions.map(action => [action, resolveEnglishKey(action).key]));

async function loadRuntime(locale) {
  const oldLocation = globalThis.location;
  const oldFetch = globalThis.fetch;
  globalThis.location = { href: `http://local.test/?lang=${locale}`, search: `?lang=${locale}` };
  globalThis.fetch = async input => {
    const filename = new URL(String(input)).pathname.split("/").pop();
    const match = /^catalog\.(.+)\.json$/.exec(filename || "");
    if (!match) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => readCatalog(match[1]) };
  };
  const modulePath = require.resolve(path.join(root, "lib", "i18n.js"));
  delete require.cache[modulePath];
  const runtime = require(modulePath);
  await runtime.bootstrap();
  globalThis.location = oldLocation;
  globalThis.fetch = oldFetch;
  return runtime;
}

function localizeCandidate(runtime, candidate) {
  const systemFocus = candidate.id.startsWith("connect-") ? candidate.id.slice(8) : candidate.focus;
  const system = runtime.t(systemKeys[systemFocus] || "common.relationships");
  const localValue = value => runtime.translateValue(value || "");
  const copy = { ...candidate };
  if (candidate.id.startsWith("strengthen-")) {
    copy.title = runtime.t("livingLesson.strengthen.title", { system }, candidate.title);
    copy.action = actionKeys.has(candidate.action) ? runtime.t(actionKeys.get(candidate.action), null, candidate.action) : localValue(candidate.action);
    copy.why = localValue(candidate.why);
    copy.success = runtime.t("livingLesson.strengthen.success", { system, baseline: candidate.baseline, target: candidate.target }, candidate.success);
  } else if (candidate.id.startsWith("connect-")) {
    copy.title = runtime.t("livingLesson.candidate.connect.title", null, candidate.title);
    copy.action = actionKeys.has(candidate.action) ? runtime.t(actionKeys.get(candidate.action), null, candidate.action) : localValue(candidate.action);
    copy.why = runtime.t("livingLesson.candidate.connect.why", null, candidate.why);
    copy.success = runtime.t("livingLesson.connect.success", { system }, candidate.success);
  } else {
    const keys = {
      "read-next-season": ["nextSeason", candidate.why.startsWith("A strong snapshot") ? "whyStrong" : "why"],
      "circulate-first-gift": ["share", "why"],
      "discover-first-guild": ["guild", "why"],
      "balance-living-web": ["balance", "why"],
      "circulate-another-gift": ["shareAgain", "why"]
    };
    const [family, whyLeaf] = keys[candidate.id] || [];
    if (!family) return Object.fromEntries(fields.map(field => [field, localValue(candidate[field])]));
    copy.title = runtime.t(`livingLesson.candidate.${family}.title`, null, candidate.title);
    copy.action = runtime.t(`livingLesson.candidate.${family}.action`, null, candidate.action);
    copy.why = runtime.t(`livingLesson.candidate.${family}.${whyLeaf}`, null, candidate.why);
    copy.success = candidate.id === "balance-living-web"
      ? runtime.t("livingLesson.balance.success", { gap: candidate.baseline }, candidate.success)
      : runtime.t(`livingLesson.candidate.${family}.success`, null, candidate.success);
  }
  return copy;
}

for (const locale of locales) {
  const overlay = leaves(await readCatalog(locale));
  const runtime = await loadRuntime(locale);

  for (const { kind, value } of corpus) {
    const resolution = resolveEnglishKey(value);
    assert.ok(Object.prototype.hasOwnProperty.call(overlay, resolution.key), `${locale} is missing ${resolution.key} for ${kind}: ${value}`);
    assert.notEqual(sourceOf(overlay[resolution.key]), sourceOf(englishLeaves[resolution.key]), `${locale} still copies English for ${resolution.key} (${kind}: ${value})`);
  }

  for (const { candidate } of variants.values()) {
    const localized = localizeCandidate(runtime, candidate);
    for (const field of fields) {
      assert.ok(localized[field], `${locale} produced an empty ${candidate.id}.${field}`);
      assert.notEqual(localized[field], candidate[field], `${locale} left ${candidate.id}.${field} in English: ${candidate[field]}`);
    }
    const toast = runtime.t("livingLesson.startedToast", { success: localized.success }, `✦ The garden offers a small experiment — ${candidate.success}`);
    assert.ok(toast.includes(localized.success), `${locale} Living Lesson toast lost its localized success condition.`);
    assert.ok(!toast.includes(candidate.success), `${locale} Living Lesson toast embedded an English success condition: ${candidate.success}`);
  }

  for (const item of corpus.filter(entry => !entry.kind.startsWith("candidate.") && entry.kind !== "toast.started")) {
    const translated = runtime.translateValue(item.value);
    assert.notEqual(translated, item.value, `${locale} left ${item.kind} in English: ${item.value}`);
  }
  assert.deepEqual(runtime.missing, [], `${locale} produced unlocalized Living Lesson runtime values.`);
  console.log(`PASS  ${locale}: ${variants.size} candidate variants and ${corpus.length} dynamic texts`);
}

console.log(`Living Lesson localization matrix passed for ${locales.length} locales (${variants.size} candidate variants, ${corpus.length} unique dynamic texts).`);
