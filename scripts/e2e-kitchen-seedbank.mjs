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

const base = {
  shares: 40, budget: 900, pool: 65, goodwill: 0, given: 6, awarded: [], market: [],
  storySeen: true, introSeen: true, mode: 'explore', season: 'Summer', seasonTurns: 6,
  journeyMoments: [], gardenEffects: {}, gardenReflectionsSeen: [], pendingGardenReflections: [],
  pendingGardenWhispers: [], residentBeatsSeen: [], residentSeasons: {}, residentWinters: {},
  pestActive: null, pestSeasons: {}, pestCleared: {}, pestRelief: {}, pestBeatsSeen: [], pestLastSettled: null,
  pendingGuildCards: [], pendingArrivals: [], livingLessonHistory: [], communityMemory: [],
  discovered: [], seenWildlife: [], sharedActs: 3, rewardedGiftTypes: [], seedAllowance: {}, seedStock: {},
  grownHarvests: 0, preservedCount: 0, muted: true, springBonusDone: false, autumnHarvestDone: false,
  rakeRewardDone: false, springForageDone: false, springSprouts: 0, leafPiles: 0, cherryPicks: 0,
  returnQueue: [], basket: {}, materials: {}, harvestEver: false, gatesPlayed: {},
  guests: [], visitsDone: {}, payWith: 'shares', _n: 1, _g: 0
};

let failures = 0;
const check = (condition, message, evidence) => {
  if (condition) { console.log('PASS  ' + message); return; }
  failures++;
  console.log('FAIL  ' + message + (evidence === undefined ? '' : '\nEvidence: ' + JSON.stringify(evidence, null, 2)));
};

const browser = await chromium.launch({ headless: true });
const browserErrors = [];
const missingAssets = [];

async function open(state, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({
    viewport, hasTouch: viewport.width < 1180, isMobile: viewport.width < 768, reducedMotion: 'reduce',
    storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: storeKey, value: JSON.stringify(state) }] }] }
  });
  const page = await context.newPage();
  const tag = viewport.width + 'x' + viewport.height;
  page.on('pageerror', e => browserErrors.push(tag + ' pageerror: ' + e.message));
  page.on('response', r => { if (r.status() === 404) missingAssets.push(new URL(r.url()).pathname); });
  page.on('console', m => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource/.test(m.text())) return;
    browserErrors.push(tag + ' console: ' + m.text());
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 25000 });
  return { context, page };
}

const kitchenState = { ...base, placed: [{ id: 'k1', type: 'kitchen', x: 50, y: 50 }], basket: { cherries: 2, cabbage: 1, leafy: 1, roots: 1, potatoes: 1, herbs: 1 } };

// ---- 1. Each crop has exactly one honest way of being kept ------------------
{
  const { context, page } = await open(kitchenState);
  await page.evaluate(() => window.__PERMAGARDEN_APP__.openKitchen());
  await page.waitForSelector('[data-pg-dialog="kitchen"]', { timeout: 8000 });

  const model = await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    return {
      stations: app.kitchenStations.map(s => s.key),
      methods: Object.fromEntries(Object.entries(app.recipes).map(([k, r]) => [k, r.method])),
      fresh: Object.keys(app.keepsFresh),
      everyMethodIsAStation: Object.values(app.recipes).every(r => app.kitchenStations.some(s => s.key === r.method))
    };
  });
  check(model.stations.length === 4, 'the kitchen offers four ways of keeping food', model.stations);
  check(model.everyMethodIsAStation, 'every recipe points at a station that actually exists', model.methods);
  check(model.fresh.includes('leafy'), 'leafy greens are recorded as something not meant to be kept', model.fresh);

  const wrong = await page.evaluate(async () => {
    const app = window.__PERMAGARDEN_APP__;
    const before = { ...app.state.basket };
    app.preserveWith('cherries', 'dry');
    await new Promise(r => setTimeout(r, 300));
    return { before, after: { ...app.state.basket }, note: app.state.kitchenNote };
  });
  check(wrong.after.cherries === wrong.before.cherries, 'a wrong method never consumes the harvest', wrong);
  check(wrong.note && wrong.note.tone === 'wrong', 'a wrong method is answered, not punished', wrong.note);
  check(/cauldron/i.test((wrong.note || {}).text || ''), 'the answer points at the method that would work', wrong.note);

  const right = await page.evaluate(async () => {
    const app = window.__PERMAGARDEN_APP__;
    app.preserveWith('cherries', 'simmer');
    await new Promise(r => setTimeout(r, 300));
    return { basket: { ...app.state.basket }, note: app.state.kitchenNote, preserved: app.state.preservedCount };
  });
  check(right.basket.cherries === 1 && right.basket.jamCherry === 1, 'the right method turns harvest into a preserve', right.basket);
  check(right.preserved === 1, 'the preserve is counted', right.preserved);

  const fresh = await page.evaluate(async () => {
    const app = window.__PERMAGARDEN_APP__;
    const before = app.state.basket.leafy;
    app.preserveWith('leafy', 'ferment');
    await new Promise(r => setTimeout(r, 300));
    return { before, after: app.state.basket.leafy, tone: (app.state.kitchenNote || {}).tone };
  });
  check(fresh.after === fresh.before && fresh.tone === 'fresh', 'what is best eaten fresh is protected from being processed', fresh);

  const newOnes = await page.evaluate(async () => {
    const app = window.__PERMAGARDEN_APP__;
    app.preserveWith('roots', 'ferment');
    await new Promise(r => setTimeout(r, 250));
    app.preserveWith('potatoes', 'store');
    await new Promise(r => setTimeout(r, 250));
    return { crock: app.state.basket.crockRoots || 0, clamp: app.state.basket.clampPotatoes || 0 };
  });
  check(newOnes.crock === 1 && newOnes.clamp === 1, 'roots and potatoes both have a way of being kept', newOnes);
  await context.close();
}

// ---- 2. Dragging from the shelf onto a tool does the same thing -------------
{
  const { context, page } = await open(kitchenState);
  await page.evaluate(() => window.__PERMAGARDEN_APP__.openKitchen());
  await page.waitForSelector('[data-pg-dialog="kitchen"]', { timeout: 8000 });
  await page.waitForTimeout(400);

  const before = await page.evaluate(() => ({ ...window.__PERMAGARDEN_APP__.state.basket }));
  await page.locator('.pg-kit-item').first().dragTo(page.locator('.pg-kit-tool').first());
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({ basket: { ...window.__PERMAGARDEN_APP__.state.basket }, tone: (window.__PERMAGARDEN_APP__.state.kitchenNote || {}).tone }));
  check(after.basket.jamCherry === 1 && after.basket.cherries === before.cherries - 1,
    'dragging cherries onto the cauldron preserves them', { before, after });

  await page.locator('.pg-kit-item', { hasText: 'Cabbage' }).first().dragTo(page.locator('.pg-kit-tool').first());
  await page.waitForTimeout(600);
  const bad = await page.evaluate(() => ({ basket: { ...window.__PERMAGARDEN_APP__.state.basket }, tone: (window.__PERMAGARDEN_APP__.state.kitchenNote || {}).tone }));
  check(bad.tone === 'wrong' && bad.basket.cabbage === 1, 'dragging onto the wrong tool explains instead of consuming', bad);
  await context.close();
}

// ---- 3. Every tool has a loop, a still and a name ---------------------------
{
  const { context, page } = await open(kitchenState);
  await page.evaluate(() => window.__PERMAGARDEN_APP__.openKitchen());
  await page.waitForSelector('[data-pg-dialog="kitchen"]', { timeout: 8000 });
  const stages = [];
  for (const key of ['simmer', 'dry', 'ferment', 'store']) {
    await page.evaluate(k => window.__PERMAGARDEN_APP__.selectStation(k), key);
    await page.waitForTimeout(400);
    stages.push(await page.evaluate(async () => {
      const el = document.querySelector('.pg-kit-stage-art');
      if (!el) return { tag: 'none' };
      for (let i = 0; i < 40 && (el.paused || el.currentTime === 0); i++) {
        if (el.paused && el.play) { try { await el.play(); } catch (_) {} }
        await new Promise(r => setTimeout(r, 150));
      }
      return { tag: el.tagName, src: (el.currentSrc || el.src || '').split('/').pop(), playing: el.paused === false && el.currentTime > 0 };
    }));
  }
  check(stages.every(s => s.tag === 'VIDEO'), 'each tool is shown as a moving scene', stages);
  check(stages.every(s => s.playing), 'each scene actually plays', stages);
  check(new Set(stages.map(s => s.src)).size === 4, 'each tool has its own loop', stages.map(s => s.src));
  await context.close();
}

// ---- 4. The seed bank grows from real harvests ------------------------------
{
  const seedState = { ...base, placed: [
    { id: 'sb', type: 'seedbank', x: 50, y: 50 },
    { id: 'c1', type: 'crop_leafy', x: 40, y: 60, stage: 3, placedAtTurn: 0 }
  ], seedStock: { crop_leafy: 2, crop_cabbage: 1 } };
  const { context, page } = await open(seedState);
  await page.evaluate(() => window.__PERMAGARDEN_APP__.openSeedbank());
  await page.waitForSelector('[data-pg-dialog="seedbank"]', { timeout: 8000 });

  const drawers = await page.evaluate(() => document.querySelectorAll('.pg-seed-item').length);
  check(drawers === 5, 'the seed bank has a drawer for every crop the garden grows', drawers);

  const lore = await page.evaluate(async () => {
    const app = window.__PERMAGARDEN_APP__;
    app.pickSeed('crop_cabbage');
    await new Promise(r => setTimeout(r, 300));
    return {
      name: (document.querySelector('.pg-kit-holding-name') || {}).textContent,
      lines: [...document.querySelectorAll('.pg-seed-line')].map(e => e.textContent),
      hedged: app.seedCrops().every(k => /may |varies|mostly|often|depends|not always|can all|consult|tested/i.test(app.seedLore[k].note))
    };
  });
  check(lore.lines.length === 3, 'each seed has what it wants, how it keeps and how it behaves', lore.lines.length);
  check(lore.hedged, 'seed notes keep the same caution as the rest of the game');

  const give = await page.evaluate(async () => {
    const app = window.__PERMAGARDEN_APP__;
    const before = { seed: app.state.seedStock.crop_leafy, given: app.state.given };
    app.shareSeed('crop_leafy');
    await new Promise(r => setTimeout(r, 350));
    return { before, seed: app.state.seedStock.crop_leafy, given: app.state.given, tone: (app.state.seedNote || {}).tone };
  });
  check(give.seed === give.before.seed - 1 && give.given === give.before.given + 1,
    'giving a packet to the table costs seed and counts as a gift', give);

  const harvest = await page.evaluate(async () => {
    const app = window.__PERMAGARDEN_APP__;
    const before = app.state.seedStock.crop_leafy || 0;
    app.harvestCrop('c1');
    await new Promise(r => setTimeout(r, 400));
    return { before, after: app.state.seedStock.crop_leafy || 0, basket: { ...app.state.basket } };
  });
  check(harvest.after === harvest.before + 1, 'every harvest puts a little seed back into the bank', harvest);
  check((harvest.basket.leafy || 0) > 0, 'the harvest still reaches the basket', harvest.basket);
  await context.close();
}

// ---- 5. Saved seed is yours to sow -----------------------------------------
{
  const sowState = { ...base, placed: [{ id: 'sb', type: 'seedbank', x: 50, y: 50 }], season: 'Spring',
    seedAllowance: { crop_leafy: 1 }, seedStock: { crop_leafy: 1 } };
  const { context, page } = await open(sowState);
  const sow = await page.evaluate(async () => {
    const app = window.__PERMAGARDEN_APP__;
    const before = { stock: app.state.seedStock.crop_leafy, crops: app.state.placed.filter(p => p.type === 'crop_leafy').length };
    app.placeType('crop_leafy', 30, 40, 'plant');
    await new Promise(r => setTimeout(r, 500));
    return { before, stock: app.state.seedStock.crop_leafy || 0, crops: app.state.placed.filter(p => p.type === 'crop_leafy').length, toast: app.state.toast };
  });
  check(sow.crops === sow.before.crops + 1, 'saved seed can be sown even after the season packet is used', sow);
  check(sow.stock === sow.before.stock - 1, 'sowing from the bank spends a saved seed', sow);
  await context.close();
}

// ---- 6. A fruit tree needs time, compatible blossom and insect habitat -------
{
  const treeState = { ...base, season: 'Summer', seasonTurns: 7,
    placed: [
      { id: 't1', type: 'appletree', x: 38, y: 40, placedAtTurn: 7, appleReady: false },
      { id: 't2', type: 'appletree', x: 55, y: 40, placedAtTurn: 0, appleReady: false },
      { id: 't3', type: 'appletree', x: 68, y: 40, placedAtTurn: 0, appleReady: false },
      { id: 't4', type: 'appletree', x: 12, y: 15, placedAtTurn: 0, appleReady: false },
      { id: 'flowers', type: 'pollinator', x: 61, y: 55 }
    ] };
  const { context, page } = await open(treeState);
  const trees = await page.evaluate(async () => {
    const app = window.__PERMAGARDEN_APP__;
    const growth = app.state.placed.filter(p => p.type === 'appletree')
      .map(p => ({ id: p.id, seasons: app.treeSeasons(app.state, p), growth: app.treeGrowth(app.state, p) }));
    app._applySeasonNow('Autumn');
    await new Promise(r => setTimeout(r, 900));
    return { growth, ready: app.state.placed.filter(p => p.type === 'appletree').map(p => ({ id: p.id, apples: !!p.appleReady })) };
  });
  const young = trees.ready.find(t => t.id === 't1');
  const partnered = trees.ready.filter(t => t.id === 't2' || t.id === 't3');
  const lone = trees.ready.find(t => t.id === 't4');
  check(young && !young.apples, 'a sapling bears nothing in its first autumn', trees);
  check(partnered.length === 2 && partnered.every(t => t.apples),
    'two established nearby trees with flowering habitat can set the game harvest', trees);
  check(lone && !lone.apples,
    'an established but isolated tree does not receive an automatic harvest', trees);
  check(trees.growth.find(t => t.id === 't1').growth < trees.growth.find(t => t.id === 't2').growth,
    'a young tree is drawn smaller than a grown one', trees.growth);
  await context.close();
}

// ---- 7. Mulch shelters hardy young crops, not every crop indiscriminately ----
{
  const winterState = { ...base, season: 'Autumn', seasonTurns: 7, placed: [
    { id: 'm', type: 'mulch', x: 15, y: 20 },
    { id: 'g', type: 'greenhouse', x: 25, y: 20 },
    { id: 'root', type: 'crop_root', x: 35, y: 45, stage: 1 },
    { id: 'cabbage', type: 'crop_cabbage', x: 45, y: 45, stage: 1 },
    { id: 'potato', type: 'crop_potato', x: 55, y: 45, stage: 1 },
    { id: 'leafy', type: 'crop_leafy', x: 65, y: 45, stage: 1 },
    { id: 'herb', type: 'crop_herb', x: 75, y: 45, stage: 1 }
  ] };
  const { context, page } = await open(winterState);
  const winter = await page.evaluate(async () => {
    const app = window.__PERMAGARDEN_APP__;
    app._applySeasonNow('Winter');
    await new Promise(r => setTimeout(r, 900));
    return {
      crops: app.state.placed.filter(p => app.cropDefs[p.type])
        .map(p => ({ id: p.id, type: p.type, stage: p.stage, winterState: p.winterState })),
      toast: app.state.toast
    };
  });
  const byId = Object.fromEntries(winter.crops.map(p => [p.id, p]));
  check(byId.root?.winterState === 'dormant' && byId.cabbage?.winterState === 'dormant',
    'mulch lets the modeled hardy roots and cabbage wait through winter', winter);
  check(byId.leafy?.winterState === 'protected' && byId.leafy.stage === 2,
    'the greenhouse protects the modeled leafy crop and lets it keep growing', winter);
  check(!byId.potato && !byId.herb,
    'mulch alone no longer makes frost-sensitive young potatoes and herbs winter-proof', winter);
  await context.close();
}

// ---- 8. The design connections and the book --------------------------------
{
  const { context, page } = await open({ ...base, placed: [] });
  const book = await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    const keeping = app.bookEntries('keeping');
    return {
      guildCount: app.guildDefs.length,
      hasNectarCover: app.guildDefs.some(g => g.key === 'nectarcover' && g.types.includes('mulch') && g.types.includes('pollinator')),
      everyGuildDescribed: app.guildDefs.every(g => !!app.guildWho[g.key]),
      keepingTab: app.bookTabDefs.some(t => t.key === 'keeping'),
      keepingCount: keeping.length,
      hedged: keeping.filter(e => /may |varies|mostly|often|depends|not always|can all|consult|tested|does not|follow current|food-safety/i.test(e.why || '')).length,
      unsafe: keeping.filter(e => /you should can|safe to can|guaranteed safe/i.test(e.why || '')).length
    };
  });
  check(book.hasNectarCover, 'mulch beside a flower strip is a discoverable design connection');
  check(book.everyGuildDescribed, 'every connection says who it may serve');
  check(book.keepingTab && book.keepingCount === 6, 'the book has a Keeping chapter covering all four methods and seed', book);
  check(book.hedged === book.keepingCount, 'every keeping entry stays cautious about real food safety', book);
  check(book.unsafe === 0, 'no entry claims a method is guaranteed safe');
  await context.close();
}

// ---- 9. Both scenes work on a phone and a tablet ---------------------------
for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }]) {
  const label = viewport.width + 'x' + viewport.height;
  const { context, page } = await open({ ...kitchenState, placed: [
    { id: 'k1', type: 'kitchen', x: 50, y: 50 }, { id: 'sb', type: 'seedbank', x: 60, y: 50 }
  ], seedStock: { crop_leafy: 2 } }, viewport);

  for (const [opener, dialog] of [['openKitchen', 'kitchen'], ['openSeedbank', 'seedbank']]) {
    await page.evaluate(o => window.__PERMAGARDEN_APP__[o](), opener);
    await page.waitForSelector('[data-pg-dialog="' + dialog + '"]', { timeout: 8000 });
    await page.waitForTimeout(500);
    const view = await page.evaluate(d => {
      const el = document.querySelector('[data-pg-dialog="' + d + '"]');
      const r = el.getBoundingClientRect();
      const small = [...el.querySelectorAll('button')].filter(b => b.offsetParent !== null)
        .filter(b => { const q = b.getBoundingClientRect(); return q.width > 0 && (q.width < 44 || q.height < 44); })
        .map(b => (b.textContent || '').trim().slice(0, 24) + ' ' + Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height));
      return { inside: r.left >= -1 && r.right <= innerWidth + 1, overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), small };
    }, dialog);
    check(view.inside && view.overflow === 0, label + ': the ' + dialog + ' stays inside the viewport', view);
    check(view.small.length === 0, label + ': every control in the ' + dialog + ' is a 44px touch target', view.small);
    await page.evaluate(d => window.__PERMAGARDEN_APP__[d === 'kitchen' ? 'closeKitchen' : 'closeSeedbank'](), dialog);
    await page.waitForTimeout(300);
  }
  await context.close();
}

check(browserErrors.length === 0, 'the kitchen and seed bank record no console or runtime errors', browserErrors);
const unique = [...new Set(missingAssets)];
check(unique.length === 0, 'every asset the two scenes reference exists', unique);

await browser.close();
if (failures) {
  console.log('\n' + failures + ' check(s) failed.');
  process.exit(1);
}
console.log('\nKitchen and seed bank audit passed: four honest methods, drag and tap both work, seed follows the harvest, trees need time and partners, and winter protection stays crop-specific.');
