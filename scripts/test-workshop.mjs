import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const workshop = require("../lib/workshop.js");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The link
assert.deepEqual(workshop.readQuery("?workshop=1"), { enabled: true, start: null });
assert.deepEqual(workshop.readQuery("?workshop=1&act=3&lang=cs"), { enabled: true, start: 3 });
assert.deepEqual(workshop.readQuery("?lang=fr&workshop=true&act=story"), { enabled: true, start: "story" });
assert.deepEqual(workshop.readQuery("?workshop=1&act=9"), { enabled: true, start: null });
assert.deepEqual(workshop.readQuery("?workshop=0&act=3"), { enabled: false, start: null });
assert.deepEqual(workshop.readQuery("?act=3"), { enabled: false, start: null });
assert.deepEqual(workshop.readQuery(""), { enabled: false, start: null });
assert.equal(workshop.normalizeStart("4"), 4);
assert.equal(workshop.normalizeStart(0), null);
assert.equal(workshop.normalizeStart("story"), "story");

// A workshop never shares a storage key with anyone's own game.
assert.notEqual(workshop.SAVE_KEY, workshop.PERSONAL_SAVE_KEY);
assert.notEqual(workshop.LOG_KEY, workshop.PERSONAL_SAVE_KEY);
assert.equal(workshop.PERSONAL_SAVE_KEY, "permagarden_v2");
assert.deepEqual(workshop.ACT_KEYS, ["soil", "water", "food", "shelter", "share", "challenge"]);

// The garden at the start of each act. The game's journey reads the acts from
// element types and moments; the browser journey checks every preset against it.
const typesFor = {
  soil: ["compost", "mulch", "hugel"],
  water: ["rain"],
  food: ["hugel", "arch", "herbspiral", "greenhouse", "appletree", "crop_potato", "crop_root", "crop_leafy", "crop_cabbage", "crop_herb"],
  shelter: ["bughotel", "birdhouse", "pollinator"]
};
const doneActs = save => workshop.ACT_KEYS.filter(act => {
  const types = new Set(save.placed.map(p => p.type));
  if (typesFor[act]) return typesFor[act].some(type => types.has(type));
  if (act === "share") return save.journeyMoments.includes("share") || save.sharedActs > 0;
  return save.journeyMoments.includes("challenge");
});
for (let act = 1; act <= 6; act += 1) {
  const save = workshop.presetSave(act);
  assert.deepEqual(doneActs(save), workshop.ACT_KEYS.slice(0, act - 1), `the preset for act ${act} completes exactly the acts before it`);
  assert.deepEqual(workshop.presetActs(act), workshop.ACT_KEYS.slice(0, act - 1));
  assert.equal(save.storySeen, true);
  assert.equal(save.introSeen, true);
  assert.equal(save.mode, "guided");
  assert.equal(save.season, "Summer");
  assert.ok(save.shares >= 0 && save.budget >= 0, `act ${act} leaves something to spend`);
  const spentShares = save.placed.filter(p => p.paidMethod === "barter").reduce((sum, p) => sum + p.paidAmount, 0);
  const spentMoney = save.placed.filter(p => p.paidMethod === "buy").reduce((sum, p) => sum + p.paidAmount, 0);
  assert.equal(save.shares, 10 - spentShares, `act ${act}: every share spent is paid for by an element`);
  assert.equal(save.budget, 300 - spentMoney, `act ${act}: every euro spent is paid for by an element`);
  // design connections form within 22 units (x counts 1.4 times): none is ready-made
  for (const a of save.placed) for (const b of save.placed) {
    if (a === b) continue;
    assert.ok(Math.hypot((a.x - b.x) * 1.4, a.y - b.y) > 30, `act ${act}: ${a.type} and ${b.type} stand far apart`);
  }
}
assert.deepEqual(workshop.presetSave(1).placed, []);
assert.deepEqual(workshop.presetSave("story").placed, [], "the story starts with an empty garden");
const sixth = workshop.presetSave(6);
assert.equal(sixth.sharedActs, 1);
assert.equal(sixth.given, 1);
assert.equal(sixth.cherryPicks, 2, "the first gift was one picked cherry cluster");
assert.deepEqual(sixth.gardenReflectionsSeen, ["three-layers", "fair-share"]);
assert.deepEqual(workshop.presetSave(4).gardenReflectionsSeen, ["three-layers"]);
assert.deepEqual(workshop.presetSave(3).gardenReflectionsSeen, []);

// The session log
const t0 = new Date("2026-11-12T09:05:00Z");
const log = workshop.newLog("3", t0);
assert.equal(log.from, 3);
assert.deepEqual(log.acts, ["soil", "water"], "acts done before the start are not the group's");
assert.deepEqual(log.events, [{ t: t0.toISOString(), k: "start", from: 3 }]);
assert.equal(workshop.newLog("story", t0).from, "story");
assert.equal(workshop.newLog("nonsense", t0).from, "story");

const before = workshop.snapshot({ season: "Summer", seasonTurns: 0, discovered: ["dripcorner"], seenWildlife: [], sharedActs: 0, livingLessonHistory: [] }, ["soil", "water"]);
const after = workshop.snapshot({ season: "Autumn", seasonTurns: 1, discovered: ["dripcorner", "nectarcover"], seenWildlife: ["bee"], sharedActs: 1, livingLessonHistory: [{}], endingSeen: true }, ["soil", "water", "food"]);
assert.deepEqual(workshop.diff(before, after, log.acts), [
  { k: "act", act: "food" },
  { k: "season", season: "Autumn" },
  { k: "connection", key: "nectarcover" },
  { k: "wildlife", key: "bee" },
  { k: "gift", count: 1 },
  { k: "lesson" },
  { k: "ending" }
]);
assert.deepEqual(workshop.diff(after, after, log.acts), [], "nothing new, nothing logged");
assert.deepEqual(workshop.diff(before, after, ["soil", "water", "food"]).filter(e => e.k === "act"), [], "an act is logged once, even if it is undone and done again");
assert.deepEqual(workshop.diff(null, after, []), []);
assert.deepEqual(workshop.snapshot({ discovered: ["ok", "<b>"] }, ["soil", "nope"]).connections, ["ok"]);

const t1 = new Date("2026-11-12T09:20:00Z");
const next = workshop.append(log, [{ k: "act", act: "food" }, { k: "challenge", key: "compost", clues: 2 }, { k: "bogus" }], t1);
assert.deepEqual(next.acts, ["soil", "water", "food"]);
assert.deepEqual(next.events.slice(1), [
  { t: t1.toISOString(), k: "act", act: "food" },
  { t: t1.toISOString(), k: "challenge", key: "compost", clues: 2 }
]);
assert.deepEqual(workshop.append(next, [], t1), next);
assert.equal(workshop.append({ v: 2 }, [{ k: "lesson" }], t1), null);

let long = log;
for (let i = 0; i < workshop.MAX_EVENTS + 20; i += 1) long = workshop.append(long, [{ k: "gift", count: i + 1 }], t1);
assert.equal(long.events.length, workshop.MAX_EVENTS, "the log keeps a bounded number of entries");
assert.equal(long.events[0].k, "start", "the start of the session is always kept");
assert.equal(long.events[long.events.length - 1].count, workshop.MAX_EVENTS + 20);

const dirty = workshop.sanitizeLog({
  v: 1, startedAt: "2026-11-12T09:05:00.000Z", from: 2, acts: ["soil", "lava"],
  events: [
    { t: "2026-11-12T09:05:00.000Z", k: "start", from: 2 },
    { t: "not a time", k: "lesson" },
    { t: "2026-11-12T09:06:00.000Z", k: "challenge", key: "<script>", clues: 1 },
    { t: "2026-11-12T09:07:00.000Z", k: "season", season: "Monsoon" },
    { t: "2026-11-12T09:08:00.000Z", k: "certificate", how: "print" },
    { t: "2026-11-12T09:09:00.000Z", k: "gift", count: -4 }
  ]
});
assert.deepEqual(dirty.acts, ["soil"]);
assert.deepEqual(dirty.events.map(e => e.k), ["start", "certificate", "gift"]);
assert.equal(dirty.events[2].count, 1);
assert.equal(workshop.sanitizeLog(null), null);
assert.equal(workshop.sanitizeLog({ v: 1, startedAt: "yesterday-ish", from: 2, events: [] }), null);

assert.deepEqual(workshop.summary(next), { acts: 1, challenges: 1, gifts: 0, connections: 0, wildlife: 0, seasons: 0 });

const textOut = workshop.logText(next, {
  title: "Le Jardin — workshop log",
  header: ["12 November 2026", ""],
  describe: e => e.k === "start" ? "Began at the third act" : e.k === "act" ? "Act complete" : "Challenge solved",
  time: value => value.slice(11, 16),
  footer: "Nothing in this log has left this device."
});
assert.equal(textOut, [
  "Le Jardin — workshop log",
  "12 November 2026",
  "",
  "09:05  Began at the third act",
  "09:20  Act complete",
  "09:20  Challenge solved",
  "",
  "Nothing in this log has left this device.",
  ""
].join("\n"));

// The facilitator guide follows the game's language where it exists.
assert.equal(workshop.guideLocale("cs"), "cs");
assert.equal(workshop.guideLocale("fr-CA"), "fr");
assert.equal(workshop.guideLocale("de"), "en");
assert.equal(workshop.guideLocale("pt-BR"), "en");
for (const locale of workshop.GUIDE_LOCALES) {
  const href = workshop.guideHref(locale);
  assert.ok(existsSync(path.join(root, href)), `the facilitator guide exists: ${href}`);
  const pdf = readFileSync(path.join(root, href));
  const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  assert.ok(pdf.subarray(0, 5).toString() === "%PDF-" && pages >= 8, `${href} is a printed guide of at least eight pages (${pages})`);
}

// A browser shows a PDF opened in a tab as a plugin document, so the guides are
// served without the site's object-src 'none'; a later header rule overrides an
// earlier one, and the guides keep frame-ancestors (production smoke checks it live).
const headerRules = JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8")).headers;
const cspOf = rule => (rule.headers.find(header => header.key === "Content-Security-Policy") || {}).value || "";
const siteRule = headerRules.findIndex(rule => rule.source === "/(.*)");
const guideRule = headerRules.findIndex(rule => rule.source === "/docs/facilitator/pdf/(.*)");
assert.ok(siteRule >= 0 && guideRule > siteRule, "vercel.json gives the guide PDFs their own CSP after the site's");
assert.ok(/object-src 'none'/.test(cspOf(headerRules[siteRule])), "the site keeps object-src 'none'");
assert.ok(/frame-ancestors 'self'/.test(cspOf(headerRules[guideRule])) && !/object-src/.test(cspOf(headerRules[guideRule])), "the guide PDFs keep frame-ancestors and drop object-src");

// The guide speaks the game's words: its challenge chapter is generated from the
// catalogues and must be current; the hand-written parts name the six acts and the
// workshop controls exactly as the game shows them in that language.
const guide = await import("./facilitator-guide.mjs");
assert.deepEqual(await guide.writeChallenges({ check: true }), [], "the guide's challenge chapters match the catalogues; run node scripts/facilitator-guide.mjs");
for (const locale of workshop.GUIDE_LOCALES) {
  const messages = JSON.parse(readFileSync(path.join(root, "assets", "i18n", `catalog.${locale}.json`), "utf8")).messages;
  const parts = guide.GUIDES[locale].parts.map(file => readFileSync(path.join(root, "docs", "facilitator", locale, file), "utf8")).join("\n");
  const typeset = text => locale === "fr" ? text.replace(/ ([?!:;»])/g, " $1") : text;
  const expected = [
    ...workshop.ACT_KEYS.map(act => messages[`journey.${act}.eyebrow`]),
    ...workshop.ACT_KEYS.map(act => messages[`journey.${act}.label`]),
    ...["workshop.button", "workshop.cover.label", "workshop.title", "workshop.next.button", "workshop.log.save", "workshop.log.print"].map(key => messages[key])
  ].map(typeset);
  const missing = expected.filter(text => !parts.includes(text));
  assert.deepEqual(missing, [], `the ${locale} guide names the acts and workshop controls as the game does`);
}

// The game uses the same keys, and loads the helper before itself.
const source = readFileSync(path.join(root, "Permaculture Garden v2.dc.html"), "utf8");
assert.ok(source.includes(`STORE=this.WORKSHOP.enabled?'${workshop.SAVE_KEY}':'${workshop.PERSONAL_SAVE_KEY}'`), "the game keeps a workshop's garden under the workshop key");
assert.ok(source.indexOf('<script src="lib/workshop.js"></script>') > source.indexOf('<script src="lib/living-lesson.js"></script>'), "the workshop helper loads with the other helpers, before the game");
assert.ok(/if\(this\.WORKSHOP\.enabled\)\{const lesson=engine\.fallbackLesson\(/.test(source), "a workshop's Living Lesson is always the offline lesson");

console.log("Workshop mode: link, separate storage, act presets, session log and guide links OK.");
