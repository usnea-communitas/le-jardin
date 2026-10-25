import { chromium } from './load-playwright.mjs';

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

const openRawSave = async raw => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => runtimeErrors.push('pageerror: ' + error.message));
  page.on('console', message => {
    if (message.type() === 'error') runtimeErrors.push('console: ' + message.text());
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 15000 });
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, value);
    sessionStorage.clear();
  }, { key: storeKey, value: raw });
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
      // A browser may request the same responsive image twice while the story
      // shell settles. The resilience contract is about how many distinct
      // frames are warmed, not transport-level retries.
      storyFrames: [...new Set(requests.filter(url => /\/assets\/story\/story-\d+[^/]*\.webp(?:\?|$)/i.test(url)))]
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

  // Invalid JSON and valid JSON with the wrong schema are cleared once instead of
  // making every future reload repeat the same failed restore.
  for (const [label, raw] of [['invalid JSON', '{bad'], ['wrong-shaped JSON', JSON.stringify({ placed: {} })]]) {
    const { context, page } = await openRawSave(raw);
    const result = await page.evaluate(key => ({
      stored: localStorage.getItem(key),
      placed: window.__PERMAGARDEN_APP__.state.placed
    }), storeKey);
    check(result.stored === null && Array.isArray(result.placed) && result.placed.length === 0, label + ' is cleared and starts a safe fresh garden', result);
    await context.close();
  }

  // Malformed fields in a legacy save must be contained instead of crashing render.
  {
    const { context, page } = await openState(savedState({
      placed: [
        { id: 'duplicate id', type: 'compost', x: 1000000, y: 'bad', paidMethod: 'barter', paidAmount: 1000000, usedMaterials: {} },
        { id: 'duplicate id', type: 'mulch', x: -1000000, y: 55, paidMethod: 'buy', paidAmount: 1000000, usedMaterials: ['planks', 'unknown'] },
        { id: 'c1', type: 'appletree', x: 52, y: 48, appleReady: true },
        { id: 'p10', type: 'crop_root', x: 60, y: 58, stage: 3, winterState: 'dormant' },
        { id: 'kitchen-safe', type: 'kitchen', x: 68, y: 50, paidMethod: 'buy', paidAmount: 1000000, usedMaterials: ['window', 'window', 'planks', 'unknown'] }
      ],
      market: [
        { id: 'bad id', kind: 'shares', value: 'bad', text: null, seasons: {} },
        { id: 'material-1', kind: 'material', mat: 'planks', text: 'Useful planks', seasons: ['Summer', 'Moon'] }
      ],
      pendingGate: { key: 'mulch', target: 'Autumn', status: 'won', d: {} },
      _n: 1e308, _g: 1e308, seasonTurns: 1e308,
      springSprouts: 999, leafPiles: -20, cherryPicks: 2.8, freshSales: 1e308,
      awarded: { not: 'an array' }, journeyMoments: { bad: true }, gardenEffects: [],
      communityMemory: { bad: true }, discovered: 'classroom', reflectionNote: { bad: true },
      seedAllowance: [], seedStock: 'bad', basket: [], materials: 'bad',
      guests: { bad: true }, seenWildlife: { bad: true }, gatesPlayed: [], visitsDone: [],
      playerName: { bad: true }, lastSystemChange: []
    }));
    const restored = await page.evaluate(() => {
      const state = window.__PERMAGARDEN_APP__.state;
      return {
        placed: state.placed,
        market: state.market,
        awarded: state.awarded, journeyMoments: state.journeyMoments,
        gardenEffects: state.gardenEffects, communityMemory: state.communityMemory,
        discovered: state.discovered, reflectionNote: state.reflectionNote,
        seedAllowance: state.seedAllowance, seedStock: state.seedStock,
        basket: state.basket, materials: state.materials, guests: state.guests,
        seenWildlife: state.seenWildlife, gatesPlayed: state.gatesPlayed,
        visitsDone: state.visitsDone, playerName: state.playerName,
        lastSystemChange: state.lastSystemChange,
        counters: { n: window.__PERMAGARDEN_APP__._n, g: window.__PERMAGARDEN_APP__._g, seasonTurns: state.seasonTurns, springSprouts: state.springSprouts, leafPiles: state.leafPiles, cherryPicks: state.cherryPicks, freshSales: state.freshSales },
        gate: state.gate ? { key: state.gate.key, status: state.gate.status, patches: state.gate.d && state.gate.d.patches } : null
      };
    });
    check(
      restored.placed.some(item => item.type === 'compost') && restored.placed.some(item => item.type === 'mulch') &&
      restored.placed.some(item => item.id === 'c1' && item.type === 'appletree' && item.appleReady === true) &&
      restored.placed.some(item => item.type === 'crop_root' && item.stage === 3 && item.winterState === 'dormant') &&
      restored.placed.some(item => item.type === 'compost' && item.paidAmount === 1 && item.usedMaterials.length === 0) &&
      restored.placed.some(item => item.type === 'mulch' && item.paidAmount === 20 && item.usedMaterials.length === 0) &&
      restored.placed.some(item => item.type === 'kitchen' && item.paidAmount === 120 && item.usedMaterials.length === 2 && new Set(item.usedMaterials).size === 2) &&
      new Set(restored.placed.map(item => item.id)).size === restored.placed.length &&
      restored.placed.every(item => Number.isFinite(item.x) && item.x >= 0 && item.x <= 100 && Number.isFinite(item.y) && item.y >= 0 && item.y <= 100 && Array.isArray(item.usedMaterials)) &&
      restored.market.every(item => typeof item.id === 'string' && typeof item.text === 'string' && (!('value' in item) || Number.isFinite(item.value))) &&
      Array.isArray(restored.awarded) &&
      Array.isArray(restored.journeyMoments) && Array.isArray(restored.communityMemory) &&
      Array.isArray(restored.discovered) && Array.isArray(restored.guests) &&
      Array.isArray(restored.seenWildlife) && restored.reflectionNote === '' &&
      restored.playerName === '' && restored.lastSystemChange === null &&
      restored.counters.n === 10 && restored.counters.g === 0 && restored.counters.seasonTurns === 1000000 &&
      restored.counters.springSprouts === 3 && restored.counters.leafPiles === 0 && restored.counters.cherryPicks === 2 && restored.counters.freshSales === 1000000 &&
      restored.gate && restored.gate.key === 'mulch' && restored.gate.status === 'won' && Array.isArray(restored.gate.patches) &&
      [restored.gardenEffects, restored.seedAllowance, restored.seedStock, restored.basket,
        restored.materials, restored.gatesPlayed, restored.visitsDone]
        .every(value => value && typeof value === 'object' && !Array.isArray(value)),
      'malformed legacy save fields are sanitized without losing valid garden elements',
      restored
    );
    await context.close();
  }

  // Purely visual state changes should not serialize the complete save, while a
  // durable action should still be written immediately and only once.
  {
    const { context, page } = await openState(savedState({ unlocksSeen: ['sharing', 'seedbank', 'kitchen', 'seedsaved', 'askgarden'] }));
    const writes = await page.evaluate(async key => {
      const app = window.__PERMAGARDEN_APP__;
      const original = Storage.prototype.setItem;
      let count = 0;
      Storage.prototype.setItem = function (name, value) {
        if (name === key) count += 1;
        return original.call(this, name, value);
      };
      try {
        await new Promise(resolve => app.setState({ dragType: 'compost', selectedType: 'compost', headerMenuOpen: true }, resolve));
        await new Promise(resolve => setTimeout(resolve, 60));
        const transient = count;
        await new Promise(resolve => app.setState(state => ({ shares: state.shares + 1 }), resolve));
        await new Promise(resolve => setTimeout(resolve, 60));
        const durable = count - transient;
        const gateData = app.gateDefs().compost.init();
        await new Promise(resolve => app.setState({ gate: { key: 'compost', target: 'Autumn', status: 'play', d: gateData } }, resolve));
        for (let tick = 0; tick < 8; tick += 1) {
          await new Promise(resolve => app.setState(state => ({ gate: { ...state.gate, d: { ...state.gate.d, t: tick } } }), resolve));
        }
        await new Promise(resolve => setTimeout(resolve, 60));
        const gateTicks = count - transient - durable;
        await new Promise(resolve => app.setState(state => ({ gate: { ...state.gate, status: 'won' } }), resolve));
        await new Promise(resolve => setTimeout(resolve, 60));
        const gateResult = count - transient - durable - gateTicks;
        for (const note of ['o', 'ob', 'obs', 'obse', 'observe']) {
          await new Promise(resolve => app.setState({ reflectionNote: note }, resolve));
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        const reflectionImmediate = count - transient - durable - gateTicks - gateResult;
        await new Promise(resolve => setTimeout(resolve, 500));
        const reflectionSettled = count - transient - durable - gateTicks - gateResult;
        return { transient, durable, gateTicks, gateResult, reflectionImmediate, reflectionSettled, total: count };
      } finally {
        Storage.prototype.setItem = original;
      }
    }, storeKey);
    check(writes.transient === 0 && writes.durable === 1, 'transient UI updates skip storage and one durable change produces one save write', writes);
    check(writes.gateTicks === 0 && writes.gateResult === 1, 'timed challenge ticks do not hammer storage, while a finished result is saved once', writes);
    check(writes.reflectionImmediate === 0 && writes.reflectionSettled === 1, 'reflection typing is coalesced into one delayed save', writes);
    await context.close();
  }

  // A full or unavailable storage area must warn once and stop retrying on every render.
  {
    const { context, page } = await openState(savedState({}));
    const failure = await page.evaluate(async key => {
      const app = window.__PERMAGARDEN_APP__;
      const original = Storage.prototype.setItem;
      let attempts = 0;
      Storage.prototype.setItem = function (name, value) {
        if (name === key) {
          attempts += 1;
          throw new DOMException('Storage full', 'QuotaExceededError');
        }
        return original.call(this, name, value);
      };
      try {
        await new Promise(resolve => app.setState(state => ({ shares: state.shares + 1 }), resolve));
        await new Promise(resolve => setTimeout(resolve, 80));
        const firstAttempts = attempts;
        await new Promise(resolve => app.setState(state => ({ budget: state.budget + 1 }), resolve));
        await new Promise(resolve => setTimeout(resolve, 80));
        return { firstAttempts, attempts, unavailable: app._storageUnavailable, toast: app.state.toast };
      } finally {
        Storage.prototype.setItem = original;
      }
    }, storeKey);
    check(failure.firstAttempts === 1 && failure.attempts === 1 && failure.unavailable === true && /could not save/i.test(failure.toast || ''), 'storage failure is announced once without a render-by-render retry loop', failure);
    await context.close();
  }

  // Resetting during certificate preparation must not trigger a late download.
  {
    const { context, page } = await openState(savedState({ placed: [{ id: 'p1', type: 'compost', x: 45, y: 55 }] }));
    const certificate = await page.evaluate(async () => {
      const app = window.__PERMAGARDEN_APP__;
      const originalAssetDataUrl = app.assetDataUrl;
      const originalClick = HTMLAnchorElement.prototype.click;
      let clicks = 0;
      app.assetDataUrl = () => new Promise(resolve => setTimeout(() => resolve('data:image/webp;base64,UklGRg=='), 220));
      HTMLAnchorElement.prototype.click = function () { clicks += 1; };
      window.confirm = () => true;
      try {
        const pending = app.downloadCertificate();
        await new Promise(resolve => setTimeout(resolve, 30));
        app.resetGarden();
        await pending;
        await new Promise(resolve => setTimeout(resolve, 40));
        return { clicks, preparing: app.state.certificatePreparing, url: app._certificateUrl || null, request: app._certificateRequest };
      } finally {
        app.assetDataUrl = originalAssetDataUrl;
        HTMLAnchorElement.prototype.click = originalClick;
      }
    });
    check(certificate.clicks === 0 && certificate.preparing === false && certificate.url === null, 'reset cancels an in-flight certificate export without a late download or object URL', certificate);
    await context.close();
  }

  // Reset must own and remove an active drag's global listeners, ghost and body styles.
  {
    const { context, page } = await openState(savedState({ placed: [{ id: 'p1', type: 'compost', x: 45, y: 55 }] }));
    const drag = await page.evaluate(async () => {
      const app = window.__PERMAGARDEN_APP__;
      const source = document.createElement('div');
      const art = document.createElement('span');art.textContent = '🌱';source.appendChild(art);document.body.appendChild(source);
      app.nativeDrag({ button: 0, type: 'pointerdown', clientX: 100, clientY: 100 }, source, { mode: 'add', type: 'compost' });
      document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 135, clientY: 140 }));
      await new Promise(resolve => requestAnimationFrame(resolve));
      const ghostCount = () => Array.from(document.body.children).filter(element => element.style && element.style.zIndex === '9999').length;
      const during = { active: app._dragActive, cleanup: typeof app._dragCleanup === 'function', ghosts: ghostCount(), cursor: document.body.style.cursor };
      window.confirm = () => true;
      app.resetGarden();
      await new Promise(resolve => setTimeout(resolve, 40));
      const after = { active: app._dragActive, cleanup: app._dragCleanup || null, ghosts: ghostCount(), cursor: document.body.style.cursor, selection: document.body.style.userSelect };
      source.remove();
      return { during, after };
    });
    check(drag.during.active && drag.during.cleanup && drag.during.ghosts === 1 && drag.during.cursor === 'grabbing' && !drag.after.active && drag.after.cleanup === null && drag.after.ghosts === 0 && drag.after.cursor === '' && drag.after.selection === '', 'reset fully cleans an active pointer drag', drag);
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
