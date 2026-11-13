// The garden in a file (lib/garden-file.js): saving a garden and loading it back,
// in a player's own game and in workshop mode (save, prepare for the next group,
// load), refusing a damaged file and a file from a newer game without changing
// anything, the phone menu, and asking the browser to keep the garden. Anyone's
// own game on the device stays byte for byte the same in workshop mode, and
// nothing goes to the Living Lesson API.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "./load-playwright.mjs";

const require = createRequire(import.meta.url);
const workshop = require("../lib/workshop.js");
const gardenFile = require("../lib/garden-file.js");

const baseUrl = process.env.GAME_URL || "http://127.0.0.1:8787/";
const at = query => new URL(query, baseUrl).href;
const check = (condition, message, evidence) => {
  if (!condition) throw new Error(message + (evidence === undefined ? "" : "\nEvidence: " + JSON.stringify(evidence, null, 2)));
  console.log("PASS  " + message);
};

const ownGame = {
  placed: [{ id: "p1", type: "mulch", x: 40, y: 52, placedAtTurn: 0 }, { id: "p2", type: "rain", x: 61, y: 40, placedAtTurn: 0 }],
  shares: 7, budget: 210, pool: 65, goodwill: 0, given: 0, awarded: [], market: [],
  storySeen: true, introSeen: true, mode: "explore", journeyMoments: ["soil", "water"], gardenEffects: {},
  discovered: [], seenWildlife: [], sharedActs: 0, muted: true, playerName: "Own game", season: "Autumn",
  unlocksSeen: ["sharing", "seedbank", "kitchen", "askgarden", "seedsaved"], gatesPlayed: {}
};
const OWN = workshop.PERSONAL_SAVE_KEY;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
// count the requests to keep the garden for good
await context.addInitScript(() => {
  window.__persistCalls = 0;
  // on the prototype: WebKit ignores methods set on navigator.storage itself
  const manager = window.StorageManager && window.StorageManager.prototype;
  if (manager && manager.persist) {
    const persist = manager.persist;
    manager.persist = function () { window.__persistCalls += 1; return persist.call(this); };
  }
  // what the browser said when the game asked whether the garden is kept already
  if (manager && manager.persisted) {
    const persisted = manager.persisted;
    manager.persisted = async function () { const kept = await persisted.call(this); window.__keptAlready = kept; return kept; };
  }
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push("pageerror: " + error.message));
// (Firefox reports the fonts a reload interrupts as errors: status 2152398850, NS_BINDING_ABORTED)
page.on("console", message => { if (message.type() === "error" && !/status=2152398850/.test(message.text())) errors.push("console: " + message.text()); });
let apiCalls = 0;
await page.route("**/api/garden-reflection", route => { apiCalls += 1; return route.fulfill({ status: 503, contentType: "application/json", body: "{}" }); });

const waitForApp = () => page.waitForFunction(() => window.__PERMAGARDEN_APP__ && window.__PERMAGARDEN_APP__.state, null, { timeout: 15000 });
const app = fn => page.evaluate(fn);
const stored = key => page.evaluate(k => localStorage.getItem(k), key);
const clearPopups = async () => {
  await app(() => window.__PERMAGARDEN_APP__.setState({ gardenWhisper: null, gardenWhisperQueue: [], unlockCard: null, unlocksSeen: ["sharing", "seedbank", "kitchen", "askgarden", "seedsaved"], gardenReflection: null, gardenReflectionQueue: [], guildCard: null, guildCardQueue: [], arrivalQueue: [], returnQueue: [], inspectCritter: null, visit: null, intro: false }));
  await page.waitForTimeout(150);
};
const dialog = page.locator('[data-pg-dialog="garden-file"]');
const status = page.getByTestId("garden-file-status");
const openDialog = async () => { await clearPopups(); await page.getByTestId("garden-file-open").click(); await dialog.waitFor({ state: "visible", timeout: 5000 }); };
const saveFile = async () => {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("garden-file-save").click()]);
  return { name: download.suggestedFilename(), text: await readFile(await download.path(), "utf8") };
};
const choose = async (name, text) => page.getByTestId("garden-file-input").setInputFiles({ name, mimeType: "application/json", buffer: Buffer.from(text) });
const placedOf = text => JSON.parse(text).placed.map(p => [p.id, p.type, p.x, p.y]);

try {
  // 1. A player's own game: save it, and refuse what is not a garden.
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await waitForApp();
  await page.evaluate(([key, value]) => { localStorage.clear(); localStorage.setItem(key, value); }, [OWN, JSON.stringify(ownGame)]);
  await page.goto(at("?lang=en"), { waitUntil: "domcontentloaded" });
  await waitForApp();
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__?.state?.placed.length === 2, null, { timeout: 15000 });
  const ownBefore = await stored(OWN);
  await openDialog();
  const intro = await page.locator("#pg-gf-intro").innerText();
  check(/kept only in this browser/.test(intro), "the dialog says where the garden lives", intro);
  const own = await saveFile();
  const unpacked = gardenFile.unpack(own.text);
  check(/^le-jardin-garden-\d{4}-\d{2}-\d{2}\.json$/.test(own.name) && unpacked.ok && !unpacked.workshop, "the garden saves as a file with the game's name and the day", { name: own.name, unpacked: { ok: unpacked.ok, workshop: unpacked.workshop } });
  check(JSON.stringify(placedOf(unpacked.garden)) === JSON.stringify(placedOf(ownBefore)), "the file holds the garden as stored", placedOf(unpacked.garden));
  check(/Saved on this device as le-jardin-garden-/.test(await status.innerText()), "the dialog names the saved file", await status.innerText());

  await choose("broken.json", "{ this is not a garden");
  await page.waitForFunction(() => /not a saved Le Jardin garden/.test(document.querySelector('[data-testid="garden-file-status"]').textContent));
  check(await stored(OWN) === ownBefore, "a damaged file changes nothing, byte for byte");
  const newer = JSON.stringify({ ...JSON.parse(own.text), format: gardenFile.FORMAT + 1 });
  await choose("newer.json", newer);
  await page.waitForFunction(() => /newer version of the game/.test(document.querySelector('[data-testid="garden-file-status"]').textContent));
  check(await stored(OWN) === ownBefore, "a file from a newer game changes nothing, byte for byte");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached", timeout: 3000 });
  check(await page.evaluate(() => document.activeElement && document.activeElement.dataset.testid) === "garden-file-open", "Escape closes the dialog and the focus goes back to its button");
  // Firefox would show a prompt, an engine without the request has nothing to ask,
  // and a browser that keeps the garden already needs no asking
  const canAsk = await page.evaluate(() => !!(navigator.storage && navigator.storage.persist) && !/\bFirefox\//.test(navigator.userAgent));
  if (canAsk) await page.waitForFunction(() => window.__persistCalls > 0 || window.__keptAlready === true, null, { timeout: 8000 }).catch(() => {});
  const asking = await page.evaluate(() => ({ calls: window.__persistCalls, keptAlready: window.__keptAlready === true }));
  const shouldAsk = canAsk && !asking.keptAlready;
  check(
    shouldAsk ? asking.calls >= 1 : asking.calls === 0,
    shouldAsk ? "with a garden on the device, the game asks the browser to keep it" : "where the garden is kept already, or asking would show a prompt, the game does not ask",
    { ...asking, canAsk }
  );

  // 2. The help says where the garden lives.
  await clearPopups();
  await app(() => window.__PERMAGARDEN_APP__.openIntro());
  const help = await page.locator('[data-pg-dialog="intro"]').innerText();
  check(/Your garden is kept in this browser/.test(help) && /Garden file/.test(help), "How to play says where the garden lives and how to take it along", help.slice(0, 200));
  await page.keyboard.press("Escape");

  // 3. Workshop mode: save the group's garden, prepare for the next group, load it back.
  const ownAtWorkshop = await stored(OWN);
  await page.goto(at("?workshop=1&lang=en&act=3"), { waitUntil: "domcontentloaded" });
  await waitForApp();
  await page.getByTestId("workshop-start").waitFor({ state: "visible", timeout: 15000 });
  await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded" }), page.getByTestId("workshop-begin").click()]);
  await waitForApp();
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__?.state?.workshopLog && window.__PERMAGARDEN_APP__.state.placed.length > 0, null, { timeout: 15000 });
  const groupBefore = await stored(workshop.SAVE_KEY);
  await openDialog();
  check(/This group’s garden/.test(await page.locator("#pg-gf-intro").innerText()), "in a workshop the dialog speaks of the group's garden");
  const group = await saveFile();
  check(/^le-jardin-workshop-garden-/.test(group.name) && gardenFile.unpack(group.text).workshop, "the group's garden saves as a workshop garden", group.name);
  check(JSON.stringify(placedOf(gardenFile.unpack(group.text).garden)) === JSON.stringify(placedOf(groupBefore)), "the file holds the group's garden");
  check(await app(() => window.__persistCalls) === 0, "a workshop on a shared device never asks to keep its data");
  await page.keyboard.press("Escape");

  await clearPopups();
  await page.getByTestId("workshop-open").click();
  page.once("dialog", d => d.accept());
  await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded" }), page.getByTestId("workshop-next-group").click()]);
  await waitForApp();
  check(await stored(workshop.SAVE_KEY) === null, "prepared for the next group: the workshop garden is gone");
  await page.getByTestId("workshop-start").waitFor({ state: "visible", timeout: 15000 });
  // the next group starts at the second act (a start with no story, in place or after a reload)
  await page.getByTestId("workshop-start").selectOption("2");
  // On a slow connection the file helper, fetched when the dialog opens, can arrive after a
  // file has been chosen: hold it back, so the file below is chosen first and has to wait for it.
  const slowHelper = "**/lib/garden-file.js";
  await page.route(slowHelper, async route => { await new Promise(resolve => setTimeout(resolve, 1500)); await route.continue(); });
  // beginning reloads the page: wait for the new one, not the one being left
  await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded" }), page.getByTestId("workshop-begin").click()]);
  await waitForApp();
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__?.state?.workshopLog && !window.__PERMAGARDEN_APP__.state.story, null, { timeout: 15000 });

  await openDialog();
  check(await page.evaluate(() => !window.PermacultureGardenFile), "the file is chosen before the helper has arrived");
  let asked = "";
  page.once("dialog", d => { asked = d.message(); d.accept(); });
  // the page reloads with the loaded garden: wait for the new page, not the old one
  await page.evaluate(() => { window.__beforeLoading = true; });
  await choose(group.name, group.text);
  await page.waitForFunction(() => !window.__beforeLoading && window.__PERMAGARDEN_APP__ && window.__PERMAGARDEN_APP__.state && window.__PERMAGARDEN_APP__.state.placed.length > 0, null, { timeout: 20000 });
  await page.unroute(slowHelper);
  const loaded = await stored(workshop.SAVE_KEY);
  check(/replaces the garden in progress/.test(asked), "loading over a garden in progress asks first", asked);
  check(JSON.stringify(placedOf(loaded)) === JSON.stringify(placedOf(gardenFile.unpack(group.text).garden)), "the earlier group's garden is back after loading the file", { loaded: placedOf(loaded), file: placedOf(gardenFile.unpack(group.text).garden) });
  const state = await app(() => window.__PERMAGARDEN_APP__.state.placed.map(p => [p.id, p.type, p.x, p.y]));
  check(JSON.stringify(state) === JSON.stringify(placedOf(groupBefore)), "the game shows the loaded garden", state);
  check(await stored(OWN) === ownAtWorkshop, "anyone's own game stayed byte for byte the same through the workshop");

  // 4. On a phone, the dialog opens from the menu and fits.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(at("?lang=cs"), { waitUntil: "domcontentloaded" });
  await waitForApp();
  await clearPopups();
  await page.locator("#pg-header-more").click();
  await page.getByTestId("garden-file-open-menu").click();
  await dialog.waitFor({ state: "visible", timeout: 5000 });
  const fit = await page.evaluate(() => {
    const d = document.querySelector('[data-pg-dialog="garden-file"]').getBoundingClientRect();
    return { left: d.left, right: d.right, width: innerWidth, scroll: document.documentElement.scrollWidth - innerWidth, title: document.getElementById("pg-gf-title").textContent };
  });
  check(fit.left >= 0 && fit.right <= fit.width && fit.scroll <= 0, "the dialog fits a 390 px phone", fit);
  check(fit.title === "Tvoje zahrada v souboru", "the dialog speaks Czech", fit.title);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached", timeout: 3000 });
  check(await page.evaluate(() => document.activeElement && document.activeElement.id) === "pg-header-more", "from the menu, the focus goes back to the menu button");

  check(apiCalls === 0, "nothing was sent to the Living Lesson API", apiCalls);
  check(errors.length === 0, "no errors in the console", errors);
  console.log("Garden file journey passed.");
} finally {
  await browser.close();
}
