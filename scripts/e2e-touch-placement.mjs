import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readdir } from 'node:fs/promises';

const moduleRoot = process.env.CODEX_NODE_MODULES;
let playwright;
if (moduleRoot) {
  const pnpmRoot = path.join(moduleRoot, '.pnpm');
  const packageDir = (await readdir(pnpmRoot)).find(name => /^playwright@[^-]/.test(name));
  if (!packageDir) throw new Error('Playwright package was not found in ' + pnpmRoot);
  playwright = await import(pathToFileURL(path.join(pnpmRoot, packageDir, 'node_modules', 'playwright', 'index.mjs')).href);
} else {
  playwright = await import('playwright');
}
const { chromium } = playwright;

const baseUrl = process.env.GAME_URL || 'http://127.0.0.1:8787/';
const storeKey = 'permagarden_v2';
const origin = new URL(baseUrl).origin;
const residentBeats = [
  'hedgehog-1', 'hedgehog-2', 'hedgehog-3',
  'bee-1', 'bee-2', 'bee-3',
  'worm-1', 'worm-2', 'worm-3'
];
const seenWildlife = [
  'worm', 'winecap', 'oyster', 'field', 'bee',
  'butterfly', 'bird', 'hedgehog', 'ladybug', 'beetle'
];
const savedState = {
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
  mode: 'explore',
  season: 'Summer',
  journeyMoments: [],
  gardenEffects: {},
  gardenReflectionsSeen: [],
  pendingGardenReflections: [],
  pendingGardenWhispers: [],
  residentBeatsSeen: residentBeats,
  residentSeasons: {},
  residentWinters: {},
  pendingGuildCards: [],
  pendingArrivals: [],
  livingLessonHistory: [],
  communityMemory: [],
  discovered: [],
  seenWildlife,
  sharedActs: 0,
  rewardedGiftTypes: [],
  seasonTurns: 0,
  seedAllowance: {},
  grownHarvests: 0,
  preservedCount: 0,
  muted: true,
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
  payWith: 'shares',
  _n: 1,
  _g: 0
};

const check = (condition, message, evidence) => {
  if (!condition) {
    const detail = evidence === undefined ? '' : '\nEvidence: ' + JSON.stringify(evidence, null, 2);
    throw new Error(message + detail);
  }
  console.log('PASS  ' + message);
};

const browser = await chromium.launch({ headless: true });
const browserErrors = [];

async function runTouchJourney(label, viewport) {
  const context = await browser.newContext({
    viewport,
    hasTouch: true,
    isMobile: viewport.width < 768,
    reducedMotion: 'reduce',
    storageState: {
      cookies: [],
      origins: [{
        origin,
        localStorage: [{ name: storeKey, value: JSON.stringify(savedState) }]
      }]
    }
  });
  const page = await context.newPage();
  page.on('pageerror', error => browserErrors.push(label + ' pageerror: ' + error.message));
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(label + ' console: ' + message.text());
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 20000 });
  await page.evaluate(() => { Math.random = () => 0.99; });

  const mode = await page.locator('.pg-game-shell').getAttribute('data-viewport');
  check(mode === label, `${label}: the touch viewport uses the expected responsive mode`, { mode, viewport });

  if (label === 'phone') {
    await page.getByRole('button', { name: 'Build', exact: true }).click();
  }
  await page.locator('[data-drag-type="compost"]').click();
  const armed = await page.evaluate(() => ({
    type: window.__PERMAGARDEN_APP__.state.plantType,
    phonePane: window.__PERMAGARDEN_APP__.state.phonePane
  }));
  check(armed.type === 'compost', `${label}: tapping a build card arms tap-to-place`, armed);
  if (label === 'phone') {
    check(armed.phonePane === 'garden', 'phone: selecting a build card returns directly to the garden', armed);
  }

  const plot = page.locator('[data-plot]');
  const firstBox = await plot.boundingBox();
  check(!!firstBox, `${label}: the plot is available for touch placement`);
  await page.touchscreen.tap(firstBox.x + firstBox.width * 0.29, firstBox.y + firstBox.height * 0.68);
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__.state.placed.some(item => item.type === 'compost'));

  const placed = await page.evaluate(() => {
    const item = window.__PERMAGARDEN_APP__.state.placed.find(entry => entry.type === 'compost');
    return { ...item, count: window.__PERMAGARDEN_APP__.state.placed.filter(entry => entry.type === 'compost').length };
  });
  check(placed.count === 1, `${label}: one tap places exactly one compost element`, placed);
  check(Math.abs(placed.x - 29) < 2 && Math.abs(placed.y - 68) < 2, `${label}: tap-to-place preserves the intended plot coordinates`, placed);

  await page.locator(`[data-drag-id="${placed.id}"]`).click();
  const selected = await page.evaluate(() => ({
    selected: window.__PERMAGARDEN_APP__.state.selectedPlacedId,
    phonePane: window.__PERMAGARDEN_APP__.state.phonePane,
    tabletPane: window.__PERMAGARDEN_APP__.state.tabletPane
  }));
  check(selected.selected === placed.id, `${label}: tapping a placed element selects it`, selected);
  check(
    label === 'phone' ? selected.phonePane === 'learn' : selected.tabletPane === 'learn',
    `${label}: selection reveals the element details and move action`,
    selected
  );

  const moveButton = page.getByRole('button', { name: /Move on the plot/i });
  check(await moveButton.isVisible(), `${label}: touch users receive an explicit move control`);
  await moveButton.click();
  await page.waitForFunction(id => window.__PERMAGARDEN_APP__.state.movingPlacedId === id, placed.id);

  const secondBox = await plot.boundingBox();
  check(!!secondBox, `${label}: the plot remains available in move mode`);
  await page.touchscreen.tap(secondBox.x + secondBox.width * 0.72, secondBox.y + secondBox.height * 0.36);
  await page.waitForFunction(id => window.__PERMAGARDEN_APP__.state.movingPlacedId === null &&
    window.__PERMAGARDEN_APP__.state.placed.some(item => item.id === id && item.x > 70 && item.y < 38), placed.id);

  const moved = await page.evaluate(id => {
    const state = window.__PERMAGARDEN_APP__.state;
    const item = state.placed.find(entry => entry.id === id);
    return {
      item,
      count: state.placed.filter(entry => entry.id === id).length,
      movingPlacedId: state.movingPlacedId
    };
  }, placed.id);
  check(moved.count === 1 && moved.movingPlacedId === null, `${label}: moving keeps one element and exits move mode`, moved);
  check(Math.abs(moved.item.x - 72) < 2 && Math.abs(moved.item.y - 36) < 2, `${label}: tap-to-move stores the new touch coordinates`, moved);

  const overflow = await page.evaluate(() => ({
    root: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth
  }));
  check(overflow.root <= 1 && overflow.body <= 1, `${label}: the full touch journey creates no horizontal overflow`, overflow);
  await context.close();
}

try {
  await runTouchJourney('phone', { width: 390, height: 844 });
  await runTouchJourney('tablet', { width: 820, height: 1180 });
  check(browserErrors.length === 0, 'touch placement and movement record no console or runtime errors', browserErrors);
  console.log('TOUCH PLACEMENT AUDIT COMPLETE  ' + baseUrl);
} finally {
  await browser.close();
}
