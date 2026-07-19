import path from "node:path";
import { pathToFileURL } from "node:url";
import { readdir } from "node:fs/promises";
import { createRequire } from "node:module";

const moduleRoot = process.env.CODEX_NODE_MODULES;
let playwright;
if (moduleRoot) {
  const pnpmRoot = path.join(moduleRoot, ".pnpm");
  const packageDir = (await readdir(pnpmRoot)).find(name => /^playwright@[^-]/.test(name));
  if (!packageDir) throw new Error("Playwright package was not found in " + pnpmRoot);
  playwright = await import(pathToFileURL(path.join(pnpmRoot, packageDir, "node_modules", "playwright", "index.mjs")).href);
} else {
  playwright = await import("playwright");
}
const { chromium } = playwright;
const require = createRequire(import.meta.url);
const engine = require("../lib/living-lesson.js");

const baseUrl = process.env.GAME_URL || "http://127.0.0.1:8787/";
const state = {
  placed: [
    { id: "p1", type: "compost", x: 18, y: 32, placedAtTurn: 0 },
    { id: "p2", type: "rain", x: 52, y: 38, placedAtTurn: 0 }
  ],
  shares: 10, budget: 300, pool: 65, goodwill: 0, given: 0, awarded: [], market: [],
  storySeen: true, introSeen: true, mode: "explore", journeyMoments: ["soil", "water"],
  gardenEffects: {}, communityMemory: [], reflectionOpened: false, endingSeen: false,
  discovered: [], seenWildlife: [], sharedActs: 0, muted: true, playerName: "", season: "Summer",
  springBonusDone: false, autumnHarvestDone: false, rakeRewardDone: false, springForageDone: false,
  springSprouts: 0, leafPiles: 0, cherryPicks: 0, basket: {}, materials: {}, harvestEver: false,
  gatesPlayed: {}, guests: [], visitsDone: {}, acknowledgedGardenReflectionsV2: [],
  pendingGardenReflections: [], pendingGardenWhispers: [], pendingGuildCards: [], pendingArrivals: [],
  pendingGardenCinematic: null, pendingVisit: null
};

const check = (condition, message, evidence) => {
  if (!condition) throw new Error(message + (evidence === undefined ? "" : "\nEvidence: " + JSON.stringify(evidence, null, 2)));
  console.log("PASS  " + message);
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push("pageerror: " + error.message));
page.on("console", message => { if (message.type() === "error") errors.push("console: " + message.text()); });
let apiCalls = 0;
let failApi = false;

await page.route("**/api/garden-reflection", async route => {
  apiCalls += 1;
  if (failApi) {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, error: "test_outage" }) });
    return;
  }
  const body = route.request().postDataJSON();
  const candidates = engine.buildCandidates(body.snapshot);
  const lesson = engine.normalizeLesson({
    candidateId: candidates[0].id,
    focus: candidates[0].focus,
    observation: "I notice one relationship waiting for a helpful neighbour.",
    relationship: "Connected placement helps one element's useful output meet another element's need.",
    question: "What changes when you place the next element for a relationship rather than in isolation?"
  }, body.snapshot, candidates, { source: "ai", model: "openai/gpt-5.6-terra" });
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, mode: "ai", model: "openai/gpt-5.6-terra", lesson }) });
});

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 15000 });
  await page.evaluate(({ key, value }) => { localStorage.clear(); localStorage.setItem(key, JSON.stringify(value)); }, { key: "permagarden_v2", value: state });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 15000 });

  const budgetBefore = await page.evaluate(() => window.__PERMAGARDEN_APP__.state.budget);
  const button = page.getByTestId("living-lesson-button");
  await button.scrollIntoViewIfNeeded();
  check(await button.isEnabled(), "Living Lesson unlocks once the garden has enough state to reflect on");
  await button.click();
  const dialog = page.locator('[data-pg-dialog="living-lesson"]');
  await dialog.waitFor({ state: "visible" });
  await dialog.getByText("Living Lesson · GPT-5.6", { exact: true }).waitFor();
  check((await dialog.textContent()).includes("One small experiment"), "GPT-5.6 reflection resolves into one trusted experiment");
  check(await page.evaluate(() => window.__PERMAGARDEN_APP__.state.budget) === budgetBefore, "AI reflection cannot change the game economy");
  if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH, fullPage: true });

  await dialog.getByRole("button", { name: "Keep observing" }).click();
  await button.click();
  await dialog.waitFor({ state: "visible" });
  check(apiCalls === 1, "identical garden state reuses the local reflection cache", { apiCalls });
  await page.getByTestId("living-lesson-accept").click();
  check(await page.evaluate(() => window.__PERMAGARDEN_APP__.state.livingLessonExperiment.status) === "active", "accepted reflection persists as an active experiment");

  await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    app.setState(s => ({ placed: [...s.placed, { id: "p99", type: "appletree", x: 55, y: 40, placedAtTurn: s.seasonTurns || 0 }] }));
  });
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__.state.livingLessonExperiment && window.__PERMAGARDEN_APP__.state.livingLessonExperiment.status === "completed");
  const completed = await page.evaluate(() => ({ experiment: window.__PERMAGARDEN_APP__.state.livingLessonExperiment, history: window.__PERMAGARDEN_APP__.state.livingLessonHistory }));
  check(completed.history.length === 1, "game state completes and archives the experiment deterministically", completed);
  failApi = true;
  await button.click();
  await dialog.waitFor({ state: "visible" });
  await dialog.getByText("Living Lesson · Garden wisdom offline", { exact: true }).waitFor();
  check((await dialog.textContent()).includes("One small experiment"), "reviewed fallback keeps the full learning loop available during an AI outage");
  const unexpectedErrors = errors.filter(message => !/status of 503/i.test(message));
  check(unexpectedErrors.length === 0, "Living Lesson journey has no unexpected browser runtime errors", unexpectedErrors);
} finally {
  await context.close();
  await browser.close();
}

console.log("Living Lesson browser journey passed.");
