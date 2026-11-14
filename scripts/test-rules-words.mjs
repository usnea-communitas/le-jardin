// The rules in lib/ and the words in the canonical source stay in step: the
// game loads the rule modules before it starts, every rule table has its words
// (and no words lack a rule), every id the rules use exists in the game, and the
// game asks the rules instead of keeping its own copy (docs/ARCHITECTURE.md).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import { loadGameClass } from "./game-logic.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "Permaculture Garden v2.dc.html"), "utf8");
const MODULES = { economy: "PermacultureEconomy", "community-table": "PermacultureCommunityTable", seasons: "PermacultureSeasons", acts: "PermacultureActs", wildlife: "PermacultureWildlife" };

// The page loads every rule module, deferred so it does not hold up the first
// paint, and the loading shell starts the game only after them.
const runtimeAt = source.indexOf('<script src="a642a266-8af5-4398-9a56-263a98de83c8"></script>');
for (const file of Object.keys(MODULES)) {
  const at = source.indexOf(`<script src="lib/${file}.js" defer></script>`);
  assert.ok(at > 0 && at < runtimeAt, `lib/${file}.js loads, deferred, before the game`);
}
const shell = await readFile(path.join(root, "index.html"), "utf8");
assert.ok(/document\.addEventListener\("DOMContentLoaded", resolve/.test(shell) && shell.indexOf("await parsed;") > 0 && shell.indexOf("await parsed;") < shell.indexOf("window.PermacultureRuntime.start("),
  "the game starts only after the deferred rule modules have run");
assert.ok(shell.includes(JSON.stringify(Object.values(MODULES))), "the shell checks every rule module arrived, by its global name");

// The game, evaluated with its rule modules as in the page
const React = { createElement: (type, props, ...children) => ({ type, props: { ...(props || {}), children } }) };
class DCLogic {
  constructor(props) { this.props = props || {}; this.state = {}; }
  setState(update, done) { Object.assign(this.state, typeof update === "function" ? update(this.state) : update); if (done) done(); }
}
const sandbox = { React, DCLogic, console, Math, Date, JSON, Intl, URL, setTimeout, clearTimeout, setInterval, clearInterval };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const file of Object.keys(MODULES)) vm.runInContext(await readFile(path.join(root, "lib", file + ".js"), "utf8"), sandbox, { filename: `lib/${file}.js` });
sandbox.__GameComponent = await loadGameClass(root, sandbox);
const game = new sandbox.__GameComponent({});
const economy = sandbox.PermacultureEconomy, table = sandbox.PermacultureCommunityTable, seasons = sandbox.PermacultureSeasons, acts = sandbox.PermacultureActs, wildlife = sandbox.PermacultureWildlife;
assert.equal(game.rules.economy, economy);
assert.equal(game.rules.table, table);
assert.equal(game.rules.seasons, seasons);
assert.equal(game.rules.acts, acts);
assert.equal(game.rules.wildlife, wildlife);

const keys = object => Object.keys(object);
// the game and its modules run in their own realm: compare plain copies
const plain = value => JSON.parse(JSON.stringify(value));
const eq = (actual, expected, message) => assert.deepEqual(plain(actual), plain(expected), message);
const words = (value, what) => assert.ok(typeof value === "string" && value.trim().length > 1, `${what} has words`);
const elementTypes = new Set(keys(economy.PRICES));
const isType = (type, what) => assert.ok(elementTypes.has(type), `${what}: ${type} is an element of the game`);

// Economy: prices, materials, milestones, divisions
eq(keys(game.econ), keys(economy.PRICES), "every element has a price, in the catalogue's order");
for (const type of keys(economy.PRICES)) {
  eq([game.econ[type].price, game.econ[type].barter], [economy.PRICES[type].price, economy.PRICES[type].barter]);
  words(game.econ[type].material, `${type} material`);
  assert.ok(game.catalog[type], `${type} is in the catalogue`);
}
eq(keys(game.MATS), keys(economy.MATERIAL_VALUES));
for (const mat of keys(game.MATS)) {
  assert.equal(game.MATS[mat].value, economy.MATERIAL_VALUES[mat]);
  words(game.MATS[mat].name, `material ${mat}`);
  assert.ok(game.MATS[mat].img, `material ${mat} has a picture`);
}
assert.equal(game.buildUses, economy.BUILD_USES);
for (const [type, mats] of Object.entries(economy.BUILD_USES)) { isType(type, "BUILD_USES"); mats.forEach(m => assert.ok(m in economy.MATERIAL_VALUES, m)); }
eq(keys(game.PROPAGABLE), [...economy.DIVIDABLE], "every element that can share a division says what it shares");
eq(keys(game.milestoneText).map(Number), economy.MILESTONES.map(m => m.at), "every milestone has its message");
economy.MILESTONES.filter(m => m.type).forEach(m => isType(m.type, "MILESTONES"));

// Community table: the neighbours' offers use real elements, materials and seasons.
assert.ok(game.giftPool.length >= 10);
for (const gift of game.giftPool) {
  assert.ok(["item", "material", "shares", "budget"].includes(gift.kind), `offer kind ${gift.kind}`);
  if (gift.kind === "item") isType(gift.type, "giftPool");
  if (gift.kind === "material") assert.ok(gift.mat in economy.MATERIAL_VALUES, `offer material ${gift.mat}`);
  if (gift.kind === "shares" || gift.kind === "budget") assert.ok(gift.value > 0, "an offer of shares or euros has a value");
  (gift.seasons || []).forEach(s => assert.ok(seasons.ORDER.includes(s), `offer season ${s}`));
  words(gift.text, "an offer");
  assert.ok(game.communityPeople[gift.person || table.DEFAULT_GIVER], `${gift.person} is a neighbour`);
}
for (const season of seasons.ORDER) assert.ok(table.firstOffers(game.giftPool, season).length > 0, `the table has something in ${season}`);

// Seasons: crops and planting windows
assert.equal(game.cropDefs, seasons.CROPS);
eq(keys(game.plantWindows), keys(seasons.PLANTING));
for (const type of keys(seasons.PLANTING)) {
  isType(type, "PLANTING");
  assert.equal(game.plantWindows[type].s, seasons.PLANTING[type]);
  words(game.plantWindows[type].why, `why ${type} is planted when it is`);
}
for (const type of keys(seasons.CROPS)) { isType(type, "CROPS"); assert.ok(game.produceMeta[seasons.CROPS[type].produce], `${type} produce has words`); }
[...seasons.BIENNIAL, ...seasons.WINTER_MULCH_CROPS, seasons.GREENHOUSE_CROP].forEach(type => assert.ok(type in seasons.CROPS, `${type} is a crop`));
assert.equal(game.TREE_MATURITY, seasons.TREE_MATURITY);

// Acts: one set of words per act, and per unlock card
eq(game.journeyModel(game.freshState(false)).steps.map(step => step.key), [...acts.ACTS]);
for (const step of game.journeyModel(game.freshState(false)).steps) ["eyebrow", "label", "why", "voice"].forEach(k => words(step[k], `act ${step.key} ${k}`));
for (const [act, types] of Object.entries(acts.ACT_ELEMENTS)) types.forEach(type => isType(type, `act ${act}`));
eq(game.unlockDefs.map(u => u.key), [...acts.UNLOCKS], "the unlock cards follow the rules' order");
for (const card of game.unlockDefs) {
  ["title", "text", "cta"].forEach(k => words(card[k], `unlock ${card.key} ${k}`));
  assert.equal(typeof card.go, "function");
  assert.ok(!("when" in card), `when the ${card.key} card opens is a rule in lib/acts.js`);
}

// Wildlife: neighbours, residents and pests
eq(game.wildlife.map(w => w.key), wildlife.HABITATS.map(w => w.key));
for (const w of game.wildlife) {
  assert.equal(w.needs, wildlife.HABITATS.find(h => h.key === w.key).needs);
  ["name", "tip", "why"].forEach(k => words(w[k], `${w.key} ${k}`));
  w.needs.flat().forEach(type => isType(type, `${w.key} needs`));
}
keys(game.visitDefs).forEach(key => assert.ok(wildlife.HABITATS.some(w => w.key === key), `the ${key} visit belongs to a neighbour`));
keys(game.awayWinter).forEach(key => assert.ok(wildlife.HABITATS.some(w => w.key === key), `${key} away in winter is a neighbour`));
const storyIds = stories => stories.map(s => [s.key, s.beats.map(b => b.id)]);
eq(storyIds(game.residentStories), storyIds(wildlife.RESIDENTS), "every resident beat has its story");
eq(storyIds(game.pestPressures), storyIds(wildlife.PESTS), "every pest beat has its story");
for (const resident of game.residentStories) {
  words(resident.name, resident.key);
  resident.beats.forEach(b => { words(b.title, b.id); words(b.text, b.id); assert.ok(!("when" in b), `${b.id}: when is a rule`); });
  assert.ok(wildlife.HABITATS.some(w => w.key === resident.key), `${resident.key} lives in the garden`);
}
for (const pest of game.pestPressures) {
  ["name", "noun", "allyName", "reading", "relief", "reliefWhy"].forEach(k => words(pest[k], `${pest.key} ${k}`));
  pest.beats.forEach(b => { words(b.title, b.id); words(b.text, b.id); });
  [...pest.crops].forEach(type => assert.ok(type in seasons.CROPS, `${pest.key} feeds on the crop ${type}`));
  [...pest.build].forEach(type => isType(type, `${pest.key} build`));
  wildlife.allyKeys(pest).forEach(key => assert.ok(wildlife.HABITATS.some(w => w.key === key), `${pest.key} ally ${key}`));
  assert.ok(game.gardenVoiceFiles[pest.beats[0].id], `${pest.beats[0].id} has a voice`);
}

// The game keeps no copy of a rule it asks lib/ for.
assert.ok(!/when:\((?:c|st)\)=>/.test(source), "story and unlock conditions live in lib/");
assert.ok(!/TREE_MATURITY=\d|BIENNIAL=\[|cropDefs=\{|buildUses=\{/.test(source), "season and build tables live in lib/");
assert.ok(!/price:\d+,barter:/.test(source), "prices live in lib/economy.js");
assert.ok(!/needs:\[\[/.test(source), "what neighbours need lives in lib/wildlife.js");

// …and asks them: the same answers through the game and from the rules
const st = { ...game.freshState(false), season: "Spring", seasonTurns: 6, shares: 2, budget: 150, materials: { window: 1 },
  placed: [{ id: "a", type: "crop_leafy", x: 40, y: 50, stage: 1 }, { id: "b", type: "compost", x: 46, y: 50, placedAtTurn: 0 }, { id: "c", type: "mulch", x: 52, y: 50, placedAtTurn: 5 }] };
eq(game.paymentOptions("greenhouse", st), economy.paymentOptions("greenhouse", st));
eq(game.stepPests(st, "Spring", game.activeOf(st.placed), true), wildlife.stepPests(st, "Spring", wildlife.activeOf(st.placed), true));
eq(game.journeyModel(st).index, acts.progress(st).index);
assert.equal(game.offeringPoolCost({ kind: "item", type: "mulch" }, st), table.offerCost({ kind: "item", type: "mulch" }, st));
assert.equal(game.elementGiftEligibility("b", { ...st, mode: "explore" }).mode, "division");

console.log("Rules and words in step: 5 rule modules load before the game, every rule has its words, every id exists, and the game asks the rules.");
