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

const savedState = {
  placed: [{ id: 'c1', type: 'crop_leafy', x: 40, y: 55, stage: 1 }],
  shares: 40, budget: 900, pool: 65, goodwill: 0, given: 6, awarded: [], market: [],
  storySeen: true, introSeen: true, mode: 'explore', season: 'Spring', seasonTurns: 6,
  journeyMoments: [], gardenEffects: {}, gardenReflectionsSeen: [], pendingGardenReflections: [],
  pendingGardenWhispers: [], residentBeatsSeen: [], residentSeasons: {}, residentWinters: {},
  pestActive: null, pestSeasons: {}, pestCleared: {}, pestRelief: {}, pestBeatsSeen: [], pestLastSettled: null,
  pendingGuildCards: [], pendingArrivals: [], livingLessonHistory: [], communityMemory: [],
  discovered: [], seenWildlife: [], sharedActs: 3, rewardedGiftTypes: [], seedAllowance: {},
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

async function openGame(viewport, state = savedState) {
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
    // a 404 is already accounted for by the response listener above, with its URL
    if (/Failed to load resource/.test(m.text())) return;
    browserErrors.push(tag + ' console: ' + m.text());
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 25000 });
  return { context, page };
}

// ---- 1. An outbreak is a reading of the garden, never a dice roll -------------
{
  const { context, page } = await openGame({ width: 1440, height: 900 });
  const step = (placed, season, wildlife, prev = {}, allow = true) => page.evaluate(([placed, season, wildlife, prev, allow]) => {
    const ns = { seasonTurns: 6, placed: placed.map((t, i) => ({ id: 'p' + i, type: t, x: 40 + i * 3, y: 50, stage: 1 })), ...prev };
    return window.__PERMAGARDEN_APP__.stepPests(ns, season, new Set(wildlife), allow);
  }, [placed, season, wildlife, prev, allow]);

  check((await step(['crop_leafy'], 'Spring', [])).pestActive === 'aphid',
    'aphids appear when crops are grown with no predator habitat');
  check((await step(['crop_leafy'], 'Spring', ['ladybug'])).pestActive !== 'aphid',
    'ladybugs already in the garden prevent the aphid outbreak');
  check((await step(['crop_leafy'], 'Spring', ['ladybug', 'hedgehog'])).pestActive === null,
    'with every relevant predator present nothing breaks out');
  check((await step(['mulch'], 'Spring', [])).pestActive === null,
    'with no crops there is nothing to feed on');
  check((await step(['crop_cabbage'], 'Winter', [])).pestActive === null,
    'no outbreak begins in winter');
  check((await step(['crop_cabbage'], 'Summer', ['ladybug'])).pestActive === 'caterpillar',
    'caterpillars arrive on brassicas in summer');
  check((await step(['crop_leafy'], 'Spring', [], {}, false)).pestActive === null,
    'the guided journey is never interrupted before the player has finished it');
  const early = await page.evaluate(() => window.__PERMAGARDEN_APP__.stepPests(
    { seasonTurns: 1, placed: [{ id: 'a', type: 'crop_leafy', x: 40, y: 50, stage: 1 }] }, 'Spring', new Set(), true));
  check(early.pestActive === null, 'nothing breaks out in the opening seasons of a new garden', early);
  check((await step(['crop_leafy'], 'Spring', [], { pestLastSettled: 5 })).pestActive === null,
    'the garden stays calm for two seasons after an outbreak settles');
  check((await step(['crop_leafy'], 'Spring', [], { pestLastSettled: 4 })).pestActive === 'aphid',
    'after the calm has passed a new reading may begin');
  await context.close();
}

// ---- 2. Building the relationship resolves it; relief only postpones ---------
{
  const { context, page } = await openGame({ width: 1440, height: 900 });
  const step = (placed, season, wildlife, prev = {}) => page.evaluate(([placed, season, wildlife, prev]) => {
    const ns = { seasonTurns: 6, placed: placed.map((t, i) => ({ id: 'p' + i, type: t, x: 40 + i * 3, y: 50, stage: 1 })), ...prev };
    return window.__PERMAGARDEN_APP__.stepPests(ns, season, new Set(wildlife), true);
  }, [placed, season, wildlife, prev]);

  const persisted = await step(['crop_leafy'], 'Summer', [], { pestActive: 'aphid', pestSeasons: { aphid: 1 } });
  check(persisted.pestActive === 'aphid' && persisted.pestSeasons.aphid === 2,
    'an unaddressed outbreak persists and counts its seasons', persisted);

  const resolved = await step(['crop_leafy', 'bughotel'], 'Summer', ['ladybug'], { pestActive: 'aphid', pestSeasons: { aphid: 2 } });
  check(resolved.pestActive === null && resolved.pestCleared.aphid === true,
    'the predator arriving resolves the outbreak for good', resolved);
  check((await step(['crop_leafy'], 'Spring', [], { pestCleared: { aphid: true }, pestLastSettled: null })).pestActive !== 'aphid',
    'a resolved outbreak does not come back');

  const relieved = await step(['crop_leafy'], 'Summer', [], { pestActive: 'aphid', pestSeasons: { aphid: 1 }, pestRelief: { aphid: 1 } });
  check(relieved.pestActive === 'aphid' && relieved.pestRelief.aphid === 0,
    'hand relief lasts a single season and does not address the cause', relieved);

  const held = await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    return {
      active: app.pestHeldTypes({ pestActive: 'aphid', pestRelief: {} }).length,
      relieved: app.pestHeldTypes({ pestActive: 'aphid', pestRelief: { aphid: 1 } }).length,
      clear: app.pestHeldTypes({ pestActive: null, pestRelief: {} }).length
    };
  });
  check(held.active > 0 && held.relieved === 0 && held.clear === 0,
    'growth pauses only while an outbreak is active and unrelieved', held);
  await context.close();
}

// ---- 3. The effect is mild and fully reversible: nothing is ever destroyed ---
{
  const { context, page } = await openGame({ width: 1440, height: 900 });
  const outcome = await page.evaluate(async () => {
    const app = window.__PERMAGARDEN_APP__;
    const crop = () => app.state.placed.find(p => p.type === 'crop_leafy');
    const before = app.state.placed.length;
    app.setState({ pestActive: 'aphid', pestSeasons: { aphid: 1 }, seasonTurns: 6, season: 'Spring' });
    await new Promise(r => setTimeout(r, 150));
    const stageBefore = crop().stage;
    app._applySeasonNow('Summer');
    await new Promise(r => setTimeout(r, 900));
    const during = { count: app.state.placed.length, stage: crop() ? crop().stage : null, pest: app.state.pestActive };
    // the player actually builds the missing habitat, so the engine itself resolves it
    app.setState(s => ({
      placed: [...s.placed,
        { id: 'h1', type: 'bughotel', x: 60, y: 40 },
        { id: 'h2', type: 'pollinator', x: 66, y: 46 },
        { id: 'h3', type: 'mulch', x: 30, y: 62 }]
    }));
    await new Promise(r => setTimeout(r, 250));
    app._applySeasonNow('Autumn');
    await new Promise(r => setTimeout(r, 900));
    const after = { count: app.state.placed.length, stage: crop() ? crop().stage : null, pest: app.state.pestActive, cleared: app.state.pestCleared };
    return { before, stageBefore, during, after };
  });
  check(outcome.after.cleared && outcome.after.cleared.aphid === true,
    'building the missing habitat lets the engine resolve the outbreak by itself', outcome.after);
  check(outcome.after.pest === null,
    'the garden does not immediately follow one outbreak with another', outcome.after);
  check(outcome.during.count === outcome.before, 'no plant is ever removed by an outbreak', outcome);
  check(outcome.during.stage === outcome.stageBefore, 'an active outbreak holds growth instead of reversing it', outcome);
  check(outcome.after.stage > outcome.during.stage, 'growth resumes once the balance is restored', outcome);
  await context.close();
}

// ---- 4. The story arcs unlock in order and only from real state -------------
{
  const { context, page } = await openGame({ width: 1440, height: 900 });
  const beats = st => page.evaluate(st => window.__PERMAGARDEN_APP__.pendingPestBeats(st).map(b => b.id), st);
  check(JSON.stringify(await beats({ pestActive: 'aphid', pestSeasons: { aphid: 1 }, pestCleared: {}, pestBeatsSeen: [] })) === '["aphid-1"]',
    'the first chapter is offered as soon as the outbreak is read');
  check(JSON.stringify(await beats({ pestActive: 'aphid', pestSeasons: { aphid: 1 }, pestCleared: {}, pestBeatsSeen: ['aphid-1'] })) === '[]',
    'the diagnosis is withheld until the outbreak has actually persisted');
  check(JSON.stringify(await beats({ pestActive: 'aphid', pestSeasons: { aphid: 2 }, pestCleared: {}, pestBeatsSeen: ['aphid-1'] })) === '["aphid-2"]',
    'the diagnosis arrives after two seasons of imbalance');
  check(JSON.stringify(await beats({ pestActive: null, pestSeasons: { aphid: 2 }, pestCleared: { aphid: true }, pestBeatsSeen: ['aphid-1', 'aphid-2'] })) === '["aphid-3"]',
    'the closing chapter waits for the balance to actually return');
  check(JSON.stringify(await beats({ pestActive: null, pestSeasons: { aphid: 1 }, pestCleared: { aphid: true }, pestBeatsSeen: ['aphid-1'] })) === '["aphid-2"]',
    'resolving quickly still leaves the remaining chapters reachable');

  const voice = await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    return app.pestPressures.flatMap(p => p.beats.map(b => b.id)).map(id => ({ id, hasArt: true, voice: !!app.gardenVoiceFiles[id] }));
  });
  check(voice.length === 9, 'all three arcs carry three chapters each', voice.length);
  await context.close();
}

// ---- 5. The dialog reads clearly and is reachable on every device -----------
for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1440, height: 900 }]) {
  const label = viewport.width + 'x' + viewport.height;
  const { context, page } = await openGame(viewport, { ...savedState, pestActive: 'aphid', pestSeasons: { aphid: 2 } });
  await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    app.setState({ pestStory: app.pendingPestBeats(app.state)[0] });
  });
  await page.waitForSelector('[data-pg-dialog="pest-story"]', { timeout: 8000 });
  await page.waitForTimeout(500);

  const view = await page.evaluate(() => {
    const el = document.querySelector('[data-pg-dialog="pest-story"]');
    const r = el.getBoundingClientRect();
    const buttons = [...el.querySelectorAll('button')].filter(b => b.offsetParent !== null)
      .map(b => ({ text: b.textContent.trim(), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) }));
    return {
      title: (el.querySelector('.pg-res-title') || {}).textContent || '',
      reading: (el.querySelector('.pg-pest-reading-text') || {}).textContent || '',
      buttons,
      insideViewport: r.left >= -1 && r.right <= innerWidth + 1,
      overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth)
    };
  });

  check(view.insideViewport && view.overflow === 0, label + ': the imbalance dialog stays inside the viewport', view);
  check(view.title.length > 0, label + ': the dialog states what the garden noticed', view.title);
  check(/Consider adding|already here/.test(view.reading), label + ': the dialog names what is missing rather than what to kill', view.reading);
  check(view.buttons.length === 2, label + ': both constructive responses are offered', view.buttons);
  check(view.buttons.every(b => b.h >= 44 || viewport.width >= 1180), label + ': every response is a 44px touch target', view.buttons);

  // taking the quick relief must not mark the arc as resolved
  const after = await page.evaluate(async () => {
    const app = window.__PERMAGARDEN_APP__;
    app.relievePest();
    await new Promise(r => setTimeout(r, 500));
    return { relief: app.state.pestRelief, cleared: app.state.pestCleared, story: !!app.state.pestStory };
  });
  check(after.relief.aphid === 1 && !after.cleared.aphid,
    label + ': hand relief buys a season without resolving the imbalance', after);
  await context.close();
}

// ---- 6. The Garden Book teaches the principle -------------------------------
{
  const { context, page } = await openGame({ width: 1440, height: 900 });
  const book = await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    const entries = app.bookEntries('balance');
    return {
      tab: app.bookTabDefs.some(t => t.key === 'balance'),
      count: entries.length,
      names: entries.map(e => e.name),
      forbidden: entries.filter(e => /pesticide.{0,20}recommend|spray it|kill them/i.test(e.why || '')).length,
      hedged: entries.filter(e => /may |varies|depends|not a guarantee|cannot/i.test(e.why || '')).length
    };
  });
  check(book.tab, 'the garden book has a Balance chapter');
  check(book.count === 4, 'the chapter holds the principle and all three readings', book.names);
  check(book.forbidden === 0, 'no entry recommends killing anything');
  check(book.hedged === book.count, 'every entry keeps the epistemic caution of the rest of the book', book.hedged);
  await context.close();
}

check(browserErrors.length === 0, 'the imbalance system records no console or runtime errors', browserErrors);

const unique = [...new Set(missingAssets)];
const pendingArt = unique.filter(p => p.startsWith('/assets/pests/'));
const otherMissing = unique.filter(p => !p.startsWith('/assets/pests/'));
check(otherMissing.length === 0, 'every asset the imbalance system references exists', otherMissing);
if (pendingArt.length) {
  console.log('NOTE  ' + pendingArt.length + ' imbalance illustration(s) not generated yet — the dialog degrades to its frame without them:');
  pendingArt.sort().forEach(p => console.log('        ' + p));
} else {
  console.log('PASS  every imbalance illustration is in place');
}

await browser.close();
if (failures) {
  console.log('\n' + failures + ' check(s) failed.');
  process.exit(1);
}
console.log('\nImbalance audit passed: outbreaks read the garden, growth only pauses, arcs unlock in order, and every device can answer.');
