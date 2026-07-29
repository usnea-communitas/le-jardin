import path from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { readdir } from "node:fs/promises";

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
  budget: 300,
  pool: 65,
  goodwill: 0,
  given: 0,
  awarded: [],
  market: [],
  storySeen: true,
  introSeen: true,
  mode: "guided",
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
  basket: {},
  materials: {},
  harvestEver: false,
  gatesPlayed: {},
  guests: [],
  visitsDone: {},
  payWith: "euro",
  gardenSize: "balanced",
  insightsExpanded: false,
  _n: 0,
  _g: 0
};

const browserErrors = [];
const missingAssets = [];
const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  reducedMotion: "reduce",
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

const visualEvidence = await page.evaluate(() => {
  const app = window.__PERMAGARDEN_APP__;
  return {
    pathElements: document.querySelectorAll(".pg-garden-path").length,
    gateSources: Object.values(app.gates),
    calmVisible: !!document.querySelector(".pg-calm-focus"),
    detailsVisible: !!document.querySelector(".pg-design-summary")
  };
});
check(visualEvidence.pathElements === 0, "the obsolete decorative entrance path is absent");
check(
  visualEvidence.gateSources.length === 4 &&
    visualEvidence.gateSources.every(source => /assets\/gates\/gate-.+-transparent\.webp$/.test(source)),
  "all four seasons use transparent WebP gate artwork",
  visualEvidence.gateSources
);
check(visualEvidence.calmVisible && !visualEvidence.detailsVisible, "guided play opens with the calm one-action focus");

await page.getByTestId("insights-toggle").click();
check(await page.locator(".pg-design-summary").isVisible(), "the detailed model remains available on demand");

const economyEvidence = await page.evaluate(async () => {
  const app = window.__PERMAGARDEN_APP__;
  app._n = 0;
  app.setState({
    ...app.freshState(false),
    story: false,
    intro: false,
    storySeen: true,
    introSeen: true,
    muted: true,
    mode: "explore",
    payWith: "euro",
    budget: 300
  });
  await new Promise(resolve => setTimeout(resolve, 50));
  const prices = { rain: app.econ.rain.price, kitchen: app.econ.kitchen.price };
  app.placeType("rain", 25, 60, "buy");
  await new Promise(resolve => setTimeout(resolve, 40));
  app.placeType("kitchen", 70, 60, "buy");
  await new Promise(resolve => setTimeout(resolve, 40));
  const afterBuild = {
    budget: app.state.budget,
    types: app.state.placed.map(item => item.type)
  };
  app.setState(state => ({
    basket: { ...state.basket, jamCherry: 1 },
    stallSales: 0,
    given: 0
  }));
  await new Promise(resolve => setTimeout(resolve, 40));
  const beforeSale = app.state.budget;
  app.sellPreserve("jamCherry");
  await new Promise(resolve => setTimeout(resolve, 40));
  return {
    prices,
    afterBuild,
    beforeSale,
    afterSale: app.state.budget,
    stallSales: app.state.stallSales,
    remainingJar: (app.state.basket || {}).jamCherry || 0,
    given: app.state.given
  };
});
check(
  economyEvidence.afterBuild.types.includes("rain") &&
    economyEvidence.afterBuild.types.includes("kitchen") &&
    economyEvidence.afterBuild.budget >= 0,
  "one starting fund can build both rain harvesting and the garden kitchen",
  economyEvidence
);
check(
  economyEvidence.afterSale === economyEvidence.beforeSale + 25 &&
    economyEvidence.stallSales === 1 &&
    economyEvidence.remainingJar === 0 &&
    economyEvidence.given === 0,
  "selling one preserve returns €25 without pretending that a sale is a gift",
  economyEvidence
);

await page.evaluate(() => {
  const app = window.__PERMAGARDEN_APP__;
  app.setState({
    placed: [{ id: "soil", type: "compost", x: 25, y: 65, paidMethod: "barter", paidAmount: 1, usedMaterials: [], placedAtTurn: 0 }],
    mode: "guided",
    gardenSize: "balanced"
  });
});
await page.waitForTimeout(60);

const dimensions = {};
for (const size of ["balanced", "large", "focus"]) {
  await page.evaluate(value => window.__PERMAGARDEN_APP__.setGardenSize(value), size);
  await page.waitForTimeout(80);
  dimensions[size] = await page.evaluate(() => {
    const plot = document.querySelector("[data-plot]").getBoundingClientRect();
    return {
      width: plot.width,
      height: plot.height,
      buildDisplay: getComputedStyle(document.querySelector(".pg-build-pane")).display,
      learnDisplay: getComputedStyle(document.querySelector(".pg-learn-pane")).display,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
}
check(
  dimensions.large.width > dimensions.balanced.width &&
    dimensions.focus.width > dimensions.large.width,
  "Balanced, Large and Focus progressively enlarge the garden",
  dimensions
);
check(
  dimensions.focus.buildDisplay === "none" &&
    dimensions.focus.learnDisplay === "none" &&
    dimensions.focus.overflow === 0,
  "Focus view is reversible and does not create page overflow",
  dimensions.focus
);
check(await page.getByTestId("garden-view-size-toggle").isVisible(), "the view control remains visible in Focus mode");

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForFunction(() => document.querySelector(".pg-game-shell")?.dataset.viewport === "phone");
const phoneEvidence = await page.evaluate(() => {
  const plot = document.querySelector("[data-plot]").getBoundingClientRect();
  return {
    plotWidth: plot.width,
    plotHeight: plot.height,
    viewControlDisplay: getComputedStyle(document.querySelector(".pg-view-size")).display,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  };
});
check(
  phoneEvidence.plotWidth > 250 &&
    phoneEvidence.plotHeight > 170 &&
    phoneEvidence.viewControlDisplay === "none" &&
    phoneEvidence.overflow === 0,
  "mobile layout keeps its dedicated responsive behaviour",
  phoneEvidence
);

check(browserErrors.length === 0, "the v81 flow records no browser errors", browserErrors);
check([...new Set(missingAssets)].length === 0, "the v81 flow records no missing local assets", [...new Set(missingAssets)]);

await context.close();
await browser.close();

if (failures.length) {
  throw new Error(`${failures.length} v81 regression check(s) failed.`);
}
console.log("v81 usability and economy regression checks passed.");
