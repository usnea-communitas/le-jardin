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
const localHarness = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/i.test(baseUrl);
const liveApi = process.env.LIVING_LESSON_LIVE_API === "1";
const expectedMode = process.env.EXPECTED_LESSON_MODE || (liveApi ? "either" : "ai");
const state = {
  placed: [
    { id: "p1", type: "compost", x: 18, y: 32, placedAtTurn: 0 },
    { id: "p2", type: "rain", x: 52, y: 38, placedAtTurn: 0 }
  ],
  shares: 10, budget: 300, pool: 65, goodwill: 0, given: 0, awarded: [], market: [],
  storySeen: true, introSeen: true, mode: "explore", journeyMoments: ["soil", "water"],
  gardenEffects: {}, communityMemory: [], reflectionOpened: false, endingSeen: false,
  discovered: [], seenWildlife: [], sharedActs: 0, muted: true, playerName: "", season: "Summer",
  unlocksSeen: ["sharing", "seedbank", "kitchen", "seedsaved", "askgarden"],
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
let livePayload = null;

if (liveApi) {
  page.on("response", async response => {
    if (/\/api\/garden-reflection(?:\?|$)/.test(response.url()) && response.request().method() === "POST") {
      apiCalls += 1;
      try { livePayload = await response.json(); } catch (_) { livePayload = null; }
    }
  });
} else {
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
    }, body.snapshot, candidates, { source: "ai", model: "openai/gpt-5.6-luna" });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, mode: "ai", model: "openai/gpt-5.6-luna", lesson }) });
  });
}

const waitForGame = async () => {
  if (localHarness) await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 15000 });
  else await page.locator('[data-testid="living-lesson-button"]').waitFor({ state: "attached", timeout: 15000 });
};

const savedGame = () => page.evaluate(() => JSON.parse(localStorage.getItem("permagarden_v2") || "{}"));

const dismissGardenMessages = async () => {
  for (let index = 0; index < 3; index += 1) {
    const dismiss = page.getByRole("button", { name: "Dismiss the garden's message" });
    if (!(await dismiss.isVisible().catch(() => false))) return;
    await dismiss.click();
    await page.waitForTimeout(120);
  }
};

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await waitForGame();
  await page.evaluate(({ key, value }) => { localStorage.clear(); localStorage.setItem(key, JSON.stringify(value)); }, { key: "permagarden_v2", value: state });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForGame();

  const budgetBefore = (await savedGame()).budget;
  const button = page.getByTestId("living-lesson-button");
  await button.waitFor({ state: "visible" });
  await button.scrollIntoViewIfNeeded();
  // The production shell streams the game fragment before React finishes binding
  // every delegated handler. Give that final hydration turn a bounded moment so
  // the click verifies the real request instead of racing an inert first frame.
  if (!localHarness) await page.waitForTimeout(2000);
  await dismissGardenMessages();
  check(await button.isEnabled(), "Living Lesson unlocks once the garden has enough state to reflect on");
  const liveMetadata = liveApi ? await page.evaluate(async () => {
    const response = await fetch("/api/garden-reflection", { headers: { Accept: "application/json" } });
    return response.json();
  }) : null;
  await button.click();
  const dialog = page.locator('[data-pg-dialog="living-lesson"]');
  await dialog.waitFor({ state: "visible" });
  await dialog.locator(".pg-living-lesson-experiment").waitFor({ state: "visible", timeout: 30000 });
  const eyebrow = (await dialog.locator(".pg-living-lesson-kicker").first().textContent()).trim();
  const resolvedMode = eyebrow.includes("listening") ? "ai" : "fallback";
  check(expectedMode === "either" || resolvedMode === expectedMode, "Living Lesson reports the expected inference mode", { expectedMode, resolvedMode, eyebrow });
  if (liveMetadata) {
    check(
      liveMetadata.model === "openai/gpt-5.6-luna" && liveMetadata.auth === "vercel-oidc",
      "production API identifies GPT-5.6 Luna and Vercel OIDC",
      { model: liveMetadata.model, auth: liveMetadata.auth }
    );
  }
  if (resolvedMode === "ai") {
    check(
      !livePayload || (livePayload.lesson?.source === "ai" && livePayload.lesson?.promptVersion === "living-lesson-v2"),
      "production lesson preserves its AI provenance and prompt version, including cached lessons",
      livePayload
        ? { source: livePayload.lesson?.source, promptVersion: livePayload.lesson?.promptVersion, apiCalls }
        : { cachedClientLesson: true, apiCalls }
    );
  }
  const experimentText = await dialog.locator(".pg-living-lesson-experiment").innerText();
  const normalizedExperimentText = experimentText.toLowerCase();
  check(
    normalizedExperimentText.includes("do this next") &&
      normalizedExperimentText.includes("how you'll know it worked") &&
      experimentText.length > 80,
    "the reflection resolves into one trusted, measurable experiment",
    { experimentText }
  );
  check((await savedGame()).budget === budgetBefore, "the reflection cannot change the game economy");
  if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH, fullPage: true });

  await dialog.getByRole("button", { name: "Keep observing" }).click();
  // Closing a reflection can legitimately release a queued garden message a few
  // animation frames later. Let that transition settle, then dismiss it through
  // the same control a player would use before reopening the lesson.
  if (!localHarness) await page.waitForTimeout(700);
  await dismissGardenMessages();
  await button.click();
  await dialog.waitFor({ state: "visible" });
  check(apiCalls === 1, "identical garden state reuses the local reflection cache", { apiCalls });
  await page.getByTestId("living-lesson-accept").click();
  await page.waitForFunction(() => {
    const saved=JSON.parse(localStorage.getItem("permagarden_v2")||"{}");
    return saved.livingLessonExperiment&&saved.livingLessonExperiment.status==="active";
  });
  check((await savedGame()).livingLessonExperiment.status === "active", "accepted reflection persists as an active experiment");

  if (localHarness) {
    await page.evaluate(() => {
      const app = window.__PERMAGARDEN_APP__;
      app.setState(s => ({ placed: [...s.placed, { id: "p99", type: "appletree", x: 55, y: 40, placedAtTurn: s.seasonTurns || 0 }] }));
    });
    await page.waitForFunction(() => window.__PERMAGARDEN_APP__.state.livingLessonExperiment && window.__PERMAGARDEN_APP__.state.livingLessonExperiment.status === "completed");
    const completed = await page.evaluate(() => ({ experiment: window.__PERMAGARDEN_APP__.state.livingLessonExperiment, history: window.__PERMAGARDEN_APP__.state.livingLessonHistory }));
    check(completed.history.length === 1, "game state completes and archives the experiment deterministically", completed);
    if (!liveApi) {
      failApi = true;
      // Completing the trusted experiment can also release a queued garden
      // milestone. Close that player-facing message before requesting the next
      // lesson so this assertion tests the fallback path, not dialog stacking.
      await dismissGardenMessages();
      await button.click();
      await dialog.waitFor({ state: "visible" });
      await dialog.getByText("The garden answers from memory", { exact: true }).waitFor();
      const fallbackExperiment = await dialog.locator(".pg-living-lesson-experiment").innerText();
      const normalizedFallbackExperiment = fallbackExperiment.toLowerCase();
      check(
        normalizedFallbackExperiment.includes("do this next") &&
          normalizedFallbackExperiment.includes("how you'll know it worked") &&
          fallbackExperiment.length > 80,
        "reviewed fallback keeps the full learning loop available during an AI outage",
        { fallbackExperiment }
      );
    }
  } else {
    await button.waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const trigger = document.querySelector('[data-testid="living-lesson-button"]');
      return Boolean(trigger && trigger.textContent && trigger.textContent.includes("The garden is still watching"));
    }, null, { timeout: 10000 });
    const productionButtonText = await button.textContent();
    check(
      productionButtonText.includes("The garden is still watching"),
      "production UI exposes the persisted experiment state without test-only internals",
      { productionButtonText }
    );
  }
  const unexpectedErrors = errors.filter(message => !/status of 503/i.test(message));
  check(unexpectedErrors.length === 0, "Living Lesson journey has no unexpected browser runtime errors", unexpectedErrors);
} finally {
  await context.close();
  await browser.close();
}

console.log("Living Lesson browser journey passed.");
