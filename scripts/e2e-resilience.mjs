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

const check = (condition, message, evidence) => {
  if (!condition) {
    const detail = evidence === undefined ? '' : '\nEvidence: ' + JSON.stringify(evidence, null, 2);
    throw new Error(message + detail);
  }
  console.log('PASS  ' + message);
};

const savedState = overrides => ({
  placed: [], shares: 10, budget: 300, pool: 65, goodwill: 0, given: 0,
  awarded: [], market: [], storySeen: true, introSeen: true, mode: 'explore',
  journeyMoments: [], gardenEffects: {}, communityMemory: [], reflectionOpened: false,
  endingSeen: false, discovered: [], seenWildlife: [], sharedActs: 0, muted: true,
  playerName: '', season: 'Summer', springBonusDone: false, autumnHarvestDone: false,
  rakeRewardDone: false, springForageDone: false, springSprouts: 0, leafPiles: 0,
  cherryPicks: 0, basket: {}, materials: {}, harvestEver: false, gatesPlayed: {},
  guests: [], visitsDone: {}, acknowledgedGardenReflectionsV2: [],
  pendingGardenReflections: [], pendingGardenWhispers: [], pendingGuildCards: [],
  pendingArrivals: [], pendingGardenCinematic: null, pendingVisit: null,
  ...overrides
});

const browser = await chromium.launch({ headless: true });
const runtimeErrors = [];

const openState = async state => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => runtimeErrors.push('pageerror: ' + error.message));
  page.on('console', message => {
    if (message.type() === 'error') runtimeErrors.push('console: ' + message.text());
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 15000 });
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    sessionStorage.clear();
  }, { key: storeKey, value: state });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 15000 });
  return { context, page };
};

try {
  // The cover should be visually ready without eagerly fetching the entire media library.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 15000 });
    const media = {
      audio: requests.filter(url => /\.(?:mp3|wav|ogg)(?:\?|$)/i.test(url)),
      video: requests.filter(url => /\.(?:webm|mp4)(?:\?|$)/i.test(url)),
      storyFrames: requests.filter(url => /\/assets\/story\/story-\d+[^/]*\.webp(?:\?|$)/i.test(url))
    };
    check(media.audio.length === 0, 'the unopened story makes no eager audio request', media);
    check(media.video.length === 0, 'ambient video stays unloaded behind the story cover', media);
    check(media.storyFrames.length > 0 && media.storyFrames.length <= 2, 'only the current and adjacent story frames load initially', media);
    await context.close();
  }

  // A fragment outage must leave a useful, keyboard-ready recovery state.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.route('**/game.fragment.html*', route => route.fulfill({
      status: 503,
      contentType: 'text/plain',
      body: 'temporary test outage'
    }));
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    const alert = page.getByRole('alert');
    const retry = page.getByRole('button', { name: 'Try again' });
    await alert.waitFor({ state: 'visible', timeout: 10000 });
    const recovery = {
      text: await alert.innerText(),
      retryVisible: await retry.isVisible(),
      focused: await retry.evaluate(element => element === document.activeElement)
    };
    check(/could not finish loading/i.test(recovery.text) && recovery.retryVisible, 'a failed fragment shows a clear retry action', recovery);
    check(recovery.focused, 'the fragment recovery action receives keyboard focus', recovery);
    await context.close();
  }

  // The first real action after restoring state must still run all discovery effects.
  {
    const { context, page } = await openState(savedState({
      placed: [{ id: 'p7', type: 'bench', x: 50, y: 50 }],
      _n: 7
    }));
    await page.evaluate(() => window.__PERMAGARDEN_APP__.placeType('sign', 52, 50, 'gift'));
    await page.waitForFunction(() => window.__PERMAGARDEN_APP__.state.discovered.includes('classroom'));
    const firstAction = await page.evaluate(() => {
      const state = window.__PERMAGARDEN_APP__.state;
      return {
        ids: state.placed.map(item => item.id),
        discovered: state.discovered,
        shares: state.shares,
        guildCard: state.guildCard
      };
    });
    check(firstAction.ids.includes('p8'), 'restored numeric IDs continue without collisions', firstAction);
    check(firstAction.discovered.includes('classroom') && firstAction.shares === 11 && firstAction.guildCard === 'classroom', 'the first restored placement discovers and rewards its guild', firstAction);
    await context.close();
  }

  // An earned reflection remains pending across a reload and is acknowledged only on dismissal.
  {
    const { context, page } = await openState(savedState({
      pendingGardenReflections: ['three-layers']
    }));
    const dialog = page.locator('[data-pg-dialog="garden-reflection"]');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    const beforeDismiss = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storeKey);
    check(!beforeDismiss.acknowledgedGardenReflectionsV2.includes('three-layers'), 'showing a reflection does not mark it acknowledged', beforeDismiss);
    await page.getByRole('button', { name: 'Continue tending' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.waitForTimeout(80);
    await page.evaluate(() => sessionStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__PERMAGARDEN_APP__);
    await page.waitForTimeout(750);
    const afterDismiss = await page.evaluate(key => ({
      saved: JSON.parse(localStorage.getItem(key)),
      visible: Boolean(document.querySelector('[data-pg-dialog="garden-reflection"]'))
    }), storeKey);
    check(afterDismiss.saved.acknowledgedGardenReflectionsV2.includes('three-layers') && !afterDismiss.visible, 'an acknowledged reflection does not return after reload', afterDismiss);
    await context.close();
  }

  // Reset must cancel stale asynchronous work as well as clear every transient layer.
  {
    const { context, page } = await openState(savedState({
      placed: [{ id: 'p1', type: 'compost', x: 45, y: 55 }]
    }));
    const reset = await page.evaluate(async () => {
      const app = window.__PERMAGARDEN_APP__;
      window.confirm = () => true;
      await new Promise(resolve => app.setState({
        toast: 'old toast', gardenPulse: { name: 'Soil', n: 1 },
        gardenWhisper: { key: 'soil', text: 'old whisper' },
        gardenReflectionQueue: [app.reflectionForCount(3)],
        guildCard: 'classroom', guildCardQueue: ['orchard'],
        showSummary: true, showGuilds: true,
        gate: { key: 'compost', target: 'Autumn', status: 'brief', d: app.gateDefs().compost.init() },
        visit: { key: 'bird', status: 'ask', picked: [] }
      }, resolve));
      app.later(() => app.setState({ toast: 'STALE CALLBACK' }), 120);
      app.resetGarden();
      await new Promise(resolve => setTimeout(resolve, 300));
      const state = app.state;
      return {
        placed: state.placed,
        toast: state.toast,
        gardenPulse: state.gardenPulse,
        gardenWhisper: state.gardenWhisper,
        reflection: state.gardenReflection,
        reflectionQueue: state.gardenReflectionQueue,
        guildCard: state.guildCard,
        guildQueue: state.guildCardQueue,
        showSummary: state.showSummary,
        showGuilds: state.showGuilds,
        gate: state.gate,
        visit: state.visit,
        season: state.season,
        cherryPicks: state.cherryPicks,
        locks: [app._gateOpening, app._seasonChanging]
      };
    });
    check(
      reset.placed.length === 0 && reset.toast === null && reset.gardenPulse === null &&
      reset.gardenWhisper === null && reset.reflection === null && reset.reflectionQueue.length === 0 &&
      reset.guildCard === null && reset.guildQueue.length === 0 && !reset.showSummary && !reset.showGuilds &&
      reset.gate === null && reset.visit === null && reset.season === 'Summer' && reset.cherryPicks === 3 &&
      reset.locks.every(value => value === false),
      'reset cancels stale work and returns every transient system to a clean Summer garden',
      reset
    );
    await context.close();
  }

  check(runtimeErrors.length === 0, 'resilience scenarios recorded no runtime or console errors', runtimeErrors);
  console.log('RESILIENCE REGRESSION COMPLETE');
} finally {
  await browser.close();
}
