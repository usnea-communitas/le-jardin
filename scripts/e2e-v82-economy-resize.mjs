import { existsSync } from "node:fs";
import { chromium } from "./load-playwright.mjs";

const baseUrl = process.env.GAME_URL || "http://127.0.0.1:8787/";
const origin = new URL(baseUrl).origin;
const storeKey = "permagarden_v2";
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await chromium.launch(existsSync(chromePath)
  ? { headless: true, executablePath: chromePath }
  : { headless: true });

const failures = [];
const check = (condition, message, evidence) => {
  if (condition) {
    console.log("PASS  " + message);
    return;
  }
  failures.push({ message, evidence });
  console.log("FAIL  " + message + (evidence === undefined ? "" : "\nEvidence: " + JSON.stringify(evidence, null, 2)));
};

const baseState = {
  placed: [],
  shares: 10,
  budget: 75,
  pool: 65,
  goodwill: 0,
  given: 0,
  awarded: [],
  market: [],
  storySeen: true,
  introSeen: true,
  mode: "explore",
  journeyMoments: [],
  gardenEffects: {},
  gardenReflectionsSeen: [],
  pendingGardenReflections: [],
  pendingGardenWhispers: [],
  residentBeatsSeen: [],
  residentSeasons: {},
  residentWinters: {},
  pestActive: null,
  pestSeasons: {},
  pestCleared: {},
  pestRelief: {},
  pestBeatsSeen: [],
  pendingGuildCards: [],
  pendingArrivals: [],
  livingLessonHistory: [],
  communityMemory: [],
  discovered: [],
  seenWildlife: [],
  sharedActs: 0,
  rewardedGiftTypes: [],
  seasonTurns: 0,
  seedAllowance: {},
  seedStock: {},
  unlocksSeen: [],
  grownHarvests: 0,
  preservedCount: 0,
  stallSales: 0,
  freshSales: 0,
  muted: true,
  season: "Summer",
  springBonusDone: false,
  autumnHarvestDone: false,
  rakeRewardDone: false,
  springForageDone: false,
  springSprouts: 0,
  leafPiles: 0,
  cherryPicks: 0,
  returnQueue: [],
  basket: { cherries: 3 },
  materials: {},
  harvestEver: true,
  gatesPlayed: {},
  guests: [],
  visitsDone: {},
  payWith: "euro",
  gardenSize: "balanced",
  gardenWidth: 0,
  gardenHeight: 0,
  insightsExpanded: false,
  _n: 0,
  _g: 0
};

const browserErrors = [];
const missingAssets = [];
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  reducedMotion: "no-preference",
  storageState: {
    cookies: [],
    origins: [{ origin, localStorage: [{ name: storeKey, value: JSON.stringify(baseState) }] }]
  }
});
const page = await context.newPage();
page.on("pageerror", error => browserErrors.push("pageerror: " + error.message));
page.on("console", message => {
  if (message.type() === "error" && !/Failed to load resource/.test(message.text())) {
    browserErrors.push("console: " + message.text());
  }
});
page.on("response", response => {
  if (response.status() === 404) missingAssets.push(new URL(response.url()).pathname);
});

await page.goto(baseUrl + "?lang=en", { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 20000 });

const dismissGardenOverlays = async () => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const overlay = page.locator(".pg-garden-dialog-backdrop").last();
    if (!(await overlay.count()) || !(await overlay.isVisible())) return;
    await overlay.click({ position: { x: 4, y: 4 } });
    await page.waitForTimeout(40);
  }
};
await dismissGardenOverlays();

check(await page.getByTestId("sell-fresh-cherries").isVisible(), "fresh cherries can be sold before the kitchen exists");
const stallCopy = await page.locator(".pg-basket-stall-note").innerText();
check(
  /€15/.test(stallCopy) && /kitchen/i.test(stallCopy) && /fair-share gift/i.test(stallCopy),
  "the basket explains the fresh-sale, preserve and fair-share trade-off",
  stallCopy
);

for (let index = 0; index < 3; index += 1) {
  await page.getByTestId("sell-fresh-cherries").click();
  await page.waitForTimeout(50);
  await dismissGardenOverlays();
}
const saleEvidence = await page.evaluate(() => {
  const app = window.__PERMAGARDEN_APP__;
  const stored = JSON.parse(localStorage.getItem("permagarden_v2") || "{}");
  return {
    budget: app.state.budget,
    freshSales: app.state.freshSales,
    stallSales: app.state.stallSales,
    given: app.state.given,
    sharedActs: app.state.sharedActs,
    goodwill: app.state.goodwill,
    pool: app.state.pool,
    cherries: (app.state.basket || {}).cherries || 0,
    canBuyKitchen: app.paymentOptions("kitchen").buy,
    storedFreshSales: stored.freshSales,
    storedBudget: stored.budget
  };
});
check(
  saleEvidence.budget === 120 &&
    saleEvidence.freshSales === 3 &&
    saleEvidence.stallSales === 0 &&
    saleEvidence.given === 0 &&
    saleEvidence.sharedActs === 0 &&
    saleEvidence.goodwill === 0 &&
    saleEvidence.pool === 65 &&
    saleEvidence.cherries === 0,
  "three fresh cherry sales bridge €75 to the €120 kitchen without counting as gifts",
  saleEvidence
);
check(
  saleEvidence.canBuyKitchen && saleEvidence.storedFreshSales === 3 && saleEvidence.storedBudget === 120,
  "the kitchen becomes affordable and the new income survives save-state persistence",
  saleEvidence
);

await page.evaluate(() => {
  const app = window.__PERMAGARDEN_APP__;
  app.setState({
    mode: "explore",
    season: "Summer",
    cherryPicks: 3,
    basket: {},
    budget: 75,
    freshSales: 0,
    gardenSize: "balanced",
    gardenWidth: 0,
    gardenHeight: 0
  });
});
await page.waitForTimeout(80);
const cherryEvidence = await page.locator(".pg-cherry-cluster").evaluateAll(elements =>
  elements.map(element => {
    const box = element.getBoundingClientRect();
    const aura = getComputedStyle(element, "::before");
    return {
      width: box.width,
      height: box.height,
      background: aura.backgroundImage,
      shadow: aura.boxShadow,
      opacity: aura.opacity
    };
  })
);
check(
  cherryEvidence.length === 3 &&
    cherryEvidence.every(item => item.width >= 49.9 && item.height >= 49.9) &&
    cherryEvidence.every(item => item.background !== "none" && item.shadow !== "none"),
  "all ripe cherry clusters have a large golden aura and accessible hit area",
  cherryEvidence
);

await page.evaluate(() => {
  const app = window.__PERMAGARDEN_APP__;
  app.setState({
    mode: "explore",
    season: "Summer",
    cherryPicks: 0,
    basket: {
      cherries: 1,
      apples: 3,
      potatoes: 3,
      roots: 3,
      leafy: 3,
      herbs: 3,
      cabbage: 3
    },
    market: app.freshMarket("Summer"),
    gardenSize: "balanced",
    gardenWidth: 0,
    gardenHeight: 0
  });
});
await page.waitForTimeout(100);
const plotBox = () => page.locator("[data-plot]").evaluate(element => {
  const box = element.getBoundingClientRect();
  return { width: box.width, height: box.height };
});
const balanced = await plotBox();

await page.getByTestId("garden-view-size-toggle").click();
await page.getByTestId("garden-width-slider").evaluate(element => {
  element.value = "100";
  element.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.waitForFunction(() => window.__PERMAGARDEN_APP__.state.gardenWidth === 100);
await page.getByTestId("garden-width-slider").evaluate(element => {
  element.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForTimeout(100);
const widthAdjusted = await plotBox();

await page.getByTestId("garden-height-slider").evaluate(element => {
  element.value = "100";
  element.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.waitForFunction(() => window.__PERMAGARDEN_APP__.state.gardenHeight === 100);
await page.getByTestId("garden-height-slider").evaluate(element => {
  element.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForTimeout(120);
const custom = await plotBox();
const customState = await page.evaluate(() => {
  const app = window.__PERMAGARDEN_APP__;
  const stored = JSON.parse(localStorage.getItem("permagarden_v2") || "{}");
  const community = document.querySelector(".pg-community-pane .pg-community-panel");
  const basket = document.querySelector(".pg-game-center > .pg-right-panel");
  return {
    gardenSize: app.state.gardenSize,
    gardenWidth: app.state.gardenWidth,
    gardenHeight: app.state.gardenHeight,
    storedSize: stored.gardenSize,
    storedWidth: stored.gardenWidth,
    storedHeight: stored.gardenHeight,
    communityExists: !!community,
    basketExists: !!basket,
    communityOverflow: community ? getComputedStyle(community).overflowY : null,
    basketOverflow: basket ? getComputedStyle(basket).overflowY : null
  };
});
check(
  widthAdjusted.width > balanced.width + 100 && Math.abs(widthAdjusted.height - balanced.height) < 8,
  "the width slider enlarges the plot horizontally without unexpectedly changing its height",
  { balanced, widthAdjusted }
);
check(
  custom.height > widthAdjusted.height + 35,
  "the height slider gives the plot materially more vertical room",
  { widthAdjusted, custom }
);
check(
  customState.gardenSize === "custom" &&
    customState.gardenWidth === 100 &&
    customState.gardenHeight === 100 &&
    customState.storedSize === "custom" &&
    customState.storedWidth === 100 &&
    customState.storedHeight === 100 &&
    (!customState.communityExists || customState.communityOverflow === "auto") &&
    (!customState.basketExists || customState.basketOverflow === "auto"),
  "custom width and height persist while surrounding panels remain scrollable",
  customState
);

await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 20000 });
await dismissGardenOverlays();
const restoredCustom = await page.evaluate(() => {
  const state = window.__PERMAGARDEN_APP__.state;
  return { size: state.gardenSize, width: state.gardenWidth, height: state.gardenHeight };
});
check(
  restoredCustom.size === "custom" && restoredCustom.width === 100 && restoredCustom.height === 100,
  "a custom two-axis garden size restores correctly after a reload",
  restoredCustom
);

await page.getByTestId("garden-view-size-toggle").click();
await page.locator(".pg-view-size-option").filter({ hasText: "Focus" }).click();
await page.waitForTimeout(100);
const focusEvidence = await page.evaluate(() => {
  const plot = document.querySelector("[data-plot]").getBoundingClientRect();
  const display = selector => {
    const element = document.querySelector(selector);
    return element ? getComputedStyle(element).display : "absent";
  };
  return {
    width: plot.width,
    height: plot.height,
    build: display(".pg-build-pane"),
    learn: display(".pg-learn-pane"),
    community: display(".pg-game-center > .pg-community-pane"),
    basket: display(".pg-game-center > .pg-right-panel"),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
});
check(
  focusEvidence.width > custom.width &&
    focusEvidence.height > custom.height &&
    focusEvidence.build === "none" &&
    focusEvidence.learn === "none" &&
    ["none", "absent"].includes(focusEvidence.community) &&
    ["none", "absent"].includes(focusEvidence.basket) &&
    focusEvidence.overflow === 0,
  "Focus is a true full-workspace plot view and remains free of page overflow",
  { custom, focusEvidence }
);
check(await page.getByTestId("garden-view-size-toggle").isVisible(), "the view-size control stays visible so Focus can always be exited");

await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 20000 });
const restored = await page.evaluate(() => {
  const state = window.__PERMAGARDEN_APP__.state;
  return { size: state.gardenSize, width: state.gardenWidth, height: state.gardenHeight };
});
check(
  restored.size === "focus" && restored.width === 100 && restored.height === 100,
  "the selected garden view restores correctly after a reload",
  restored
);

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForFunction(() => document.querySelector(".pg-game-shell")?.dataset.viewport === "phone");
const phoneEvidence = await page.evaluate(() => {
  const plot = document.querySelector("[data-plot]").getBoundingClientRect();
  return {
    width: plot.width,
    height: plot.height,
    controlDisplay: getComputedStyle(document.querySelector(".pg-view-size")).display,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
});
check(
  phoneEvidence.width > 250 &&
    phoneEvidence.height > 170 &&
    phoneEvidence.controlDisplay === "none" &&
    phoneEvidence.overflow === 0,
  "phone layout keeps its dedicated responsive behaviour",
  phoneEvidence
);

check(browserErrors.length === 0, "the complete v82 flow records no browser errors", browserErrors);
check([...new Set(missingAssets)].length === 0, "the complete v82 flow records no missing local assets", [...new Set(missingAssets)]);

await context.close();
await browser.close();

if (failures.length) {
  throw new Error(`${failures.length} v82 economy and resize check(s) failed.`);
}
console.log("v82 fresh-cherry economy, aura and garden resize checks passed.");
