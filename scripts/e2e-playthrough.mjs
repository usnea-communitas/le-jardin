// A playthrough audit: nothing here calls the game's own methods.
// Everything is done the way a player does it — by looking at the screen and clicking.
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
const origin = new URL(baseUrl).origin;
const storeKey = 'permagarden_v2';

const garden = {
  placed: [
    { id: 'k1', type: 'kitchen', x: 38, y: 46 },
    { id: 'sb', type: 'seedbank', x: 62, y: 46 },
    { id: 'c1', type: 'crop_leafy', x: 50, y: 66, stage: 3, placedAtTurn: 0 }
  ],
  shares: 40, budget: 900, pool: 65, goodwill: 0, given: 6, awarded: [], market: [],
  storySeen: true, introSeen: true, mode: 'explore', season: 'Summer', seasonTurns: 6,
  journeyMoments: [], gardenEffects: {}, gardenReflectionsSeen: [], pendingGardenReflections: [],
  pendingGardenWhispers: [], residentBeatsSeen: [], residentSeasons: {}, residentWinters: {},
  pestActive: null, pestSeasons: {}, pestCleared: {}, pestRelief: {}, pestBeatsSeen: [], pestLastSettled: null,
  pendingGuildCards: [], pendingArrivals: [], livingLessonHistory: [], communityMemory: [],
  discovered: [], seenWildlife: [], sharedActs: 3, rewardedGiftTypes: [], seedAllowance: {},
  seedStock: { crop_leafy: 2 }, grownHarvests: 0, preservedCount: 0, muted: true,
  springBonusDone: false, autumnHarvestDone: false, rakeRewardDone: false, springForageDone: false,
  springSprouts: 0, leafPiles: 0, cherryPicks: 0, returnQueue: [],
  basket: { cherries: 2, cabbage: 1 }, materials: {}, harvestEver: false, gatesPlayed: {},
  guests: [], visitsDone: {}, payWith: 'shares', _n: 1, _g: 0
};

let failures = 0;
const check = (condition, message, evidence) => {
  if (condition) { console.log('PASS  ' + message); return; }
  failures++;
  console.log('FAIL  ' + message + (evidence === undefined ? '' : '\nEvidence: ' + JSON.stringify(evidence, null, 2)));
};

const browser = await chromium.launch({ headless: true });
const errors = [];

async function play(viewport) {
  const context = await browser.newContext({
    viewport, hasTouch: viewport.width < 1180, isMobile: viewport.width < 768, reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: storeKey, value: JSON.stringify(garden) }] }] }
  });
  const page = await context.newPage();
  const tag = viewport.width + 'x' + viewport.height;
  page.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(tag + ' console: ' + m.text()); });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('#pg-garden-plot', { timeout: 25000 });
  await page.waitForTimeout(700);
  return { context, page, tag };
}

// a player only ever sees labels — find the way in by its accessible name
async function findWayIn(page, label) {
  const want = new RegExp(label.replace(/^Open (the )?/, ''), 'i');
  // zahrada muze neco otevrit i se zpozdenim - uklizet je treba pri kazdem pokusu
  const clear = async () => {
    for (let i = 0; i < 10; i++) {
      if (!(await page.locator('.pg-garden-dialog-backdrop').count())) return;
      const later = page.locator('.pg-unlock-later');
      if (await later.count()) { await later.first().click({ force: true }); }
      else { await page.keyboard.press('Escape'); }
      await page.waitForTimeout(550);
    }
  };
  await page.waitForTimeout(1800);
  for (let attempt = 0; attempt < 4; attempt++) {
    await clear();
    const direct = page.getByRole('button', { name: label });
    if (await direct.count() && await direct.first().isVisible()) return direct.first();
    const more = page.locator('.pg-header-more');
    if (await more.count() && await more.first().isVisible()) {
      await more.first().click({ force: true });
      await page.waitForTimeout(600);
      const item = page.getByRole('menuitem', { name: want });
      if (await item.count() && await item.first().isVisible()) return item.first();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(700);
  }
  return null;
}

for (const viewport of [{ width: 1280, height: 900 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
  const { context, page, tag } = await play(viewport);

  // ---- the way in has to be findable without knowing the game -------------
  const kitchenWayIn = await findWayIn(page, 'Open the garden kitchen');
  check(!!kitchenWayIn, tag + ': a player can find a way into the kitchen without hunting');
  if (!kitchenWayIn) { await context.close(); continue; }

  const box = await kitchenWayIn.boundingBox();
  check(!!box && box.height >= 44 || viewport.width >= 1180,
    tag + ': the way into the kitchen is a real touch target', box);

  // ---- open the kitchen by clicking it ------------------------------------
  await kitchenWayIn.click();
  await page.waitForSelector('[data-pg-dialog="kitchen"]', { timeout: 8000 });
  await page.waitForTimeout(700);
  check(true, tag + ': clicking that button opens the garden kitchen');

  // ---- preserve something, entirely by clicking ---------------------------
  const cherries = page.locator('.pg-kit-item', { hasText: 'Cherries' }).first();
  check(await cherries.isVisible(), tag + ': the harvest is on the shelf where a player can see it');
  await cherries.click();
  await page.waitForTimeout(300);

  const cauldron = page.locator('.pg-kit-tool', { hasText: 'Simmer' }).first();
  await cauldron.click();
  await page.waitForTimeout(400);
  const act = page.locator('.pg-kit-act').first();
  const actLabel = (await act.textContent() || '').trim();
  check(/cherries/i.test(actLabel), tag + ': the action button says what it will do', actLabel);
  await act.click();
  await page.waitForTimeout(700);

  const jar = page.locator('.pg-kit-jar', { hasText: 'Cherry jam' }).first();
  check(await jar.count() > 0 && await jar.isVisible(),
    tag + ': a jar of cherry jam actually appears on the shelf');

  // ---- a wrong choice is answered, not punished ---------------------------
  const cabbage = page.locator('.pg-kit-item', { hasText: 'Cabbage' }).first();
  await cabbage.click();
  await page.waitForTimeout(250);
  await cauldron.click();
  await page.waitForTimeout(250);
  await page.locator('.pg-kit-act').first().click();
  await page.waitForTimeout(600);
  const note = await page.locator('.pg-kit-note-text').first().textContent();
  check(/cauldron|crock|oven|cold store/i.test(note || ''),
    tag + ': a wrong choice explains itself on screen', (note || '').slice(0, 90));
  check(await page.locator('.pg-kit-item', { hasText: 'Cabbage' }).first().isVisible(),
    tag + ': the cabbage is still on the shelf after the wrong choice');

  // ---- give a preserve to the table --------------------------------------
  const give = page.locator('.pg-kit-give').first();
  check(await give.isVisible(), tag + ': the community table can be reached from the kitchen');
  await give.click();
  await page.waitForTimeout(600);

  // ---- close and walk to the seed bank ------------------------------------
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const seedWayIn = await findWayIn(page, 'Open the seed bank');
  check(!!seedWayIn, tag + ': a player can find a way into the seed bank too');
  if (seedWayIn) {
    await seedWayIn.click();
    await page.waitForSelector('[data-pg-dialog="seedbank"]', { timeout: 8000 });
    await page.waitForTimeout(600);
    check(true, tag + ': clicking that button opens the seed bank');

    const drawer = page.locator('.pg-seed-item', { hasText: 'Leafy greens' }).first();
    check(await drawer.isVisible(), tag + ': saved seed is visible in its drawer');
    await drawer.click();
    await page.waitForTimeout(400);
    const lore = await page.locator('.pg-seed-line').allTextContents();
    check(lore.length === 3 && lore.every(t => (t || '').trim().length > 20),
      tag + ': the seed tells a player what it is and how it behaves', lore.map(t => (t || '').slice(0, 40)));

    const seedGive = page.locator('.pg-seed-give').first();
    check(await seedGive.isVisible(), tag + ': seed can be given to the table from here');
    const before = await page.locator('.pg-seed-item', { hasText: 'Leafy greens' }).first().locator('.pg-kit-item-count').textContent();
    await seedGive.click();
    await page.waitForTimeout(700);
    const after = await page.locator('.pg-seed-item', { hasText: 'Leafy greens' }).first().locator('.pg-kit-item-count').textContent();
    check(Number(after) === Number(before) - 1,
      tag + ': giving a packet visibly takes one out of the drawer', { before, after });
    const seedNote = await page.locator('.pg-kit-note-text').first().textContent();
    check((seedNote || '').length > 20, tag + ': the garden says something back when seed is given', (seedNote || '').slice(0, 70));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // ---- nothing left broken behind us --------------------------------------
  const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
  check(overflow === 0, tag + ': the garden is still intact afterwards', overflow);
  await context.close();
}

check(errors.length === 0, 'a full playthrough of both rooms records no errors', errors);

await browser.close();
if (failures) {
  console.log('\n' + failures + ' check(s) failed.');
  process.exit(1);
}
console.log('\nPlaythrough audit passed: both rooms can be found, opened and used with nothing but clicks.');
