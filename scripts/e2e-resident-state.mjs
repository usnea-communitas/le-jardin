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
const residentKeys = ['hedgehog', 'bee', 'worm'];
const residentBeatIds = [
  'hedgehog-1', 'hedgehog-2', 'hedgehog-3',
  'bee-1', 'bee-2', 'bee-3',
  'worm-1', 'worm-2', 'worm-3'
];
const wormGarden = [
  { id: 'p1', type: 'hugel', x: 38, y: 58 },
  { id: 'p2', type: 'mulch', x: 62, y: 58 }
];

const legacyState = overrides => ({
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
  journeyMoments: [],
  gardenEffects: {},
  communityMemory: [],
  reflectionOpened: false,
  endingSeen: false,
  discovered: [],
  seenWildlife: [],
  unlocksSeen: ['sharing', 'seedbank', 'kitchen', 'seedsaved'],
  sharedActs: 0,
  muted: true,
  playerName: '',
  season: 'Summer',
  springBonusDone: false,
  autumnHarvestDone: false,
  rakeRewardDone: false,
  springForageDone: false,
  springSprouts: 0,
  leafPiles: 0,
  cherryPicks: 0,
  basket: {},
  materials: {},
  harvestEver: false,
  gatesPlayed: {},
  guests: [],
  visitsDone: {},
  acknowledgedGardenReflectionsV2: [],
  pendingGardenReflections: [],
  pendingGardenWhispers: [],
  pendingGuildCards: [],
  pendingArrivals: [],
  pendingGardenCinematic: null,
  pendingVisit: null,
  ...overrides
});

const failures = [];
const openContexts = new Set();

const check = (condition, message, evidence) => {
  if (!condition) {
    const detail = evidence === undefined ? '' : '\nEvidence: ' + JSON.stringify(evidence, null, 2);
    throw new Error(message + detail);
  }
  console.log('PASS  ' + message);
};

const test = async (name, fn) => {
  console.log('\nTEST  ' + name);
  try {
    await fn();
    console.log('PASS  ' + name);
  } catch (error) {
    failures.push({ name, error });
    console.error('FAIL  ' + name);
    console.error(String(error && error.stack ? error.stack : error));
  }
};

const closeContext = async context => {
  if (!context) return;
  openContexts.delete(context);
  await context.close();
};

const openState = async (state, options = {}) => {
  const context = await browser.newContext({
    viewport: options.viewport || { width: 1440, height: 900 },
    reducedMotion: options.reducedMotion || 'no-preference'
  });
  openContexts.add(context);
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push('pageerror: ' + error.message));
  page.on('console', message => {
    if (message.type() === 'error') runtimeErrors.push('console: ' + message.text());
  });
  if (options.setupPage) await options.setupPage(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 15000 });
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    sessionStorage.clear();
  }, { key: storeKey, value: state });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 15000 });
  await page.waitForTimeout(100);
  return { context, page, runtimeErrors };
};

const visibleDialogs = page => page.evaluate(() => Array.from(document.querySelectorAll('[data-pg-dialog]'))
  .filter(element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 &&
      rect.width > 0 && rect.height > 0;
  })
  .map(element => element.getAttribute('data-pg-dialog')));

const measureDialog = (page, selector) => page.evaluate(async dialogSelector => {
  const dialog = document.querySelector(dialogSelector);
  if (!dialog) return { exists: false };
  dialog.scrollTop = dialog.scrollHeight;
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const rect = dialog.getBoundingClientRect();
  const style = getComputedStyle(dialog);
  const actions = Array.from(dialog.querySelectorAll('button:not([disabled])'));
  const action = actions[actions.length - 1] || null;
  const actionRect = action ? action.getBoundingClientRect() : null;
  const fitsWithoutScroll = dialog.scrollHeight <= dialog.clientHeight + 1;
  const canScroll = /^(auto|scroll)$/.test(style.overflowY);
  return {
    exists: true,
    tag: dialog.tagName,
    viewport: { width: innerWidth, height: innerHeight },
    rect: {
      left: Math.round(rect.left * 10) / 10,
      top: Math.round(rect.top * 10) / 10,
      right: Math.round(rect.right * 10) / 10,
      bottom: Math.round(rect.bottom * 10) / 10,
      width: Math.round(rect.width * 10) / 10,
      height: Math.round(rect.height * 10) / 10
    },
    contained: rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1,
    noHorizontalOverflow: dialog.scrollWidth <= dialog.clientWidth + 1,
    scrollHeight: dialog.scrollHeight,
    clientHeight: dialog.clientHeight,
    overflowY: style.overflowY,
    verticalContentReachable: fitsWithoutScroll || canScroll,
    actionReachable: !!actionRect &&
      actionRect.left >= -1 && actionRect.right <= innerWidth + 1 &&
      actionRect.top >= Math.max(0, rect.top) - 1 &&
      actionRect.bottom <= Math.min(innerHeight, rect.bottom) + 1
  };
}, selector);

const browser = await chromium.launch({ headless: true });

try {
  await test('legacy save migrates to empty resident history and counters', async () => {
    const { context, page } = await openState(legacyState());
    try {
      const state = await page.evaluate(() => {
        const s = window.__PERMAGARDEN_APP__.state;
        return {
          seen: s.residentBeatsSeen,
          seasons: s.residentSeasons,
          winters: s.residentWinters
        };
      });
      const zeroMap = value => value && typeof value === 'object' &&
        Object.keys(value).every(key => residentKeys.includes(key)) &&
        Object.values(value).every(number => number === 0);
      check(Array.isArray(state.seen) && state.seen.length === 0,
        'legacy save restores residentBeatsSeen as []', state);
      check(zeroMap(state.seasons) && zeroMap(state.winters),
        'legacy save restores resident counters as empty/zero maps', state);
    } finally {
      await closeContext(context);
    }
  });

  await test('resident restore sanitizes unknown beats and invalid counters', async () => {
    const { context, page } = await openState(legacyState({
      placed: wormGarden,
      residentBeatsSeen: ['worm-1', 'unknown-beat', 'worm-1', 42],
      residentSeasons: { worm: -7, bee: 4, ghost: 99 },
      residentWinters: { worm: -2, bee: 2, ghost: 44 }
    }));
    try {
      const state = await page.evaluate(() => {
        const s = window.__PERMAGARDEN_APP__.state;
        return {
          seen: s.residentBeatsSeen,
          seasons: s.residentSeasons,
          winters: s.residentWinters
        };
      });
      check(JSON.stringify(state.seen) === JSON.stringify(['worm-1']),
        'restore keeps only unique, known resident beat ids', state);
      check((state.seasons.worm || 0) === 0 && (state.winters.worm || 0) === 0,
        'negative active-resident counters are clamped to zero', state);
      check((state.seasons.bee || 0) === 0 && (state.winters.bee || 0) === 0,
        'inactive resident counters are reset to zero', state);
      check(!Object.hasOwn(state.seasons, 'ghost') && !Object.hasOwn(state.winters, 'ghost'),
        'unknown resident counter keys are discarded', state);
    } finally {
      await closeContext(context);
    }
  });

  await test('persistence stores durable resident data but not an open story object', async () => {
    const { context, page } = await openState(legacyState());
    try {
      const saved = await page.evaluate(async ({ key }) => {
        const app = window.__PERMAGARDEN_APP__;
        const story = ({
          id: 'worm-2',
          resident: 'worm',
          residentName: 'The earthworms',
          title: 'The ground opens',
          text: 'Temporary open story',
          art: 'assets/residents/worm-2.webp',
          index: 2,
          total: 3
        });
        await new Promise(resolve => app.setState({
          residentStory: story,
          residentBeatsSeen: ['worm-1'],
          residentSeasons: { worm: 2 },
          residentWinters: { worm: 1 }
        }, resolve));
        app.persist();
        return JSON.parse(localStorage.getItem(key));
      }, { key: storeKey });
      check(JSON.stringify(saved.residentBeatsSeen) === JSON.stringify(['worm-1']),
        'persist includes acknowledged resident beats', saved);
      check(saved.residentSeasons.worm === 2 && saved.residentWinters.worm === 1,
        'persist includes resident season and winter counters', saved);
      check(!Object.hasOwn(saved, 'residentStory') && !Object.hasOwn(saved, 'pendingResidentStory'),
        'persist does not serialize the active resident dialog', saved);
    } finally {
      await closeContext(context);
    }
  });

  await test('an open resident beat is re-derived after reload and acknowledged only on dismiss', async () => {
    const { context, page } = await openState(legacyState({
      placed: wormGarden,
      residentBeatsSeen: [],
      residentSeasons: {},
      residentWinters: {}
    }));
    try {
      const dialog = page.locator('[data-pg-dialog="resident-story"]');
      await dialog.waitFor({ state: 'visible', timeout: 6000 });
      const first = await page.evaluate(key => {
        const app = window.__PERMAGARDEN_APP__;
        const saved = JSON.parse(localStorage.getItem(key) || '{}');
        return {
          id: app.state.residentStory && app.state.residentStory.id,
          seen: app.state.residentBeatsSeen,
          savedSeen: saved.residentBeatsSeen || []
        };
      }, storeKey);
      check(first.id === 'worm-1' && first.seen.length === 0 && first.savedSeen.length === 0,
        'showing worm-1 does not acknowledge it', first);

      await page.evaluate(() => sessionStorage.clear());
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 15000 });
      await dialog.waitFor({ state: 'visible', timeout: 6000 });
      const reopenedId = await page.evaluate(() => window.__PERMAGARDEN_APP__.state.residentStory?.id);
      check(reopenedId === 'worm-1', 'reload re-derives the still-unacknowledged beat', { reopenedId });

      await dialog.locator('button').last().click();
      await page.waitForFunction(() => window.__PERMAGARDEN_APP__.state.residentBeatsSeen.includes('worm-1'));
      const afterDismiss = await page.evaluate(key => ({
        seen: window.__PERMAGARDEN_APP__.state.residentBeatsSeen,
        savedSeen: JSON.parse(localStorage.getItem(key) || '{}').residentBeatsSeen || []
      }), storeKey);
      check(afterDismiss.seen.includes('worm-1') && afterDismiss.savedSeen.includes('worm-1'),
        'dismiss marks and immediately persists the beat as seen', afterDismiss);
    } finally {
      await closeContext(context);
    }
  });

  await test('reset clears all resident story state and its persisted form', async () => {
    const { context, page } = await openState(legacyState({
      placed: wormGarden,
      residentBeatsSeen: residentBeatIds,
      residentSeasons: { worm: 4 },
      residentWinters: { worm: 1 }
    }));
    try {
      const reset = await page.evaluate(async ({ key }) => {
        const app = window.__PERMAGARDEN_APP__;
        window.confirm = () => true;
        const resident = app.residentStories.find(item => item.key === 'worm');
        const beat = resident.beats[2];
        await new Promise(resolve => app.setState({
          residentStory: {
            id: beat.id,
            resident: resident.key,
            residentName: resident.name,
            title: beat.title,
            text: beat.text,
            art: 'assets/residents/' + beat.id + '.webp',
            index: 3,
            total: 3
          }
        }, resolve));
        app.resetGarden();
        await new Promise(resolve => setTimeout(resolve, 180));
        const state = app.state;
        return {
          state: {
            story: state.residentStory,
            seen: state.residentBeatsSeen,
            seasons: state.residentSeasons,
            winters: state.residentWinters
          },
          saved: JSON.parse(localStorage.getItem(key) || '{}')
        };
      }, { key: storeKey });
      check(reset.state.story === null && reset.state.seen.length === 0,
        'reset clears the open story and acknowledged beats', reset);
      check(Object.keys(reset.state.seasons).length === 0 && Object.keys(reset.state.winters).length === 0,
        'reset clears resident continuity counters', reset);
      check((reset.saved.residentBeatsSeen || []).length === 0 &&
          Object.keys(reset.saved.residentSeasons || {}).length === 0 &&
          Object.keys(reset.saved.residentWinters || {}).length === 0,
        'reset persists cleared resident data', reset);
    } finally {
      await closeContext(context);
    }
  });

  const exercisePriority = async kind => {
    const { context, page } = await openState(legacyState());
    try {
      await page.evaluate(async ({ kind, garden }) => {
        const app = window.__PERMAGARDEN_APP__;
        await new Promise(resolve => app.setState({
          placed: garden,
          residentStory: null,
          residentBeatsSeen: [],
          residentSeasons: {},
          residentWinters: {}
        }, resolve));
        if (kind === 'gate') app.startGate('compost', 'Spring');
        if (kind === 'book') app.openBook();
        if (app._residentStoryT) {
          clearTimeout(app._residentStoryT);
          app._residentStoryT = null;
        }
        app.scheduleResidentStory(120);
      }, { kind, garden: wormGarden });
      const expected = kind === 'gate' ? 'gate' : 'book';
      await page.locator('[data-pg-dialog="' + expected + '"]').waitFor({ state: 'visible', timeout: 3000 });
      await page.waitForTimeout(1500);
      const during = await page.evaluate(() => ({
        active: window.__PERMAGARDEN_APP__.activeDialogKey(),
        resident: window.__PERMAGARDEN_APP__.state.residentStory
      }));
      const dialogs = await visibleDialogs(page);
      check(during.active === expected && during.resident === null,
        kind + ' keeps priority while a resident beat is pending', { during, dialogs });
      check(dialogs.length === 1 && dialogs[0] === expected,
        kind + ' and resident story never render as stacked dialogs', dialogs);

      await page.evaluate(kindToClose => {
        const app = window.__PERMAGARDEN_APP__;
        if (kindToClose === 'gate') {
          clearInterval(app._gateIv);
          app._gateOpening = false;
          app.setState({ gate: null });
        } else {
          app.closeBook();
        }
      }, kind);
      try {
        await page.locator('[data-pg-dialog="resident-story"]').waitFor({ state: 'visible', timeout: 4000 });
      } catch (error) {
        const diagnostic = await page.evaluate(() => {
          const app = window.__PERMAGARDEN_APP__;
          return {
            mode: app.state.mode,
            journeyReady: app.journeyModel(app.state).ready,
            activeDialog: app.activeDialogKey(),
            residentStory: app.state.residentStory && app.state.residentStory.id,
            pending: app.pendingResidentBeats(app.state).map(beat => beat.id),
            timerPending: Boolean(app._residentStoryT),
            bookOpen: app.state.bookOpen,
            gate: app.state.gate && app.state.gate.status
          };
        });
        throw new Error('Resident story did not resume after ' + kind + ': ' + JSON.stringify(diagnostic) + '\n' + error.message);
      }
      await page.waitForTimeout(450);
      const after = await visibleDialogs(page);
      check(after.length === 1 && after[0] === 'resident-story',
        'pending resident story appears alone after ' + kind + ' closes', after);
    } finally {
      await closeContext(context);
    }
  };

  await test('season gate has priority over a pending resident story', () => exercisePriority('gate'));
  await test('Garden Book has priority over a pending resident story', () => exercisePriority('book'));

  await test('restored cinematic keeps its loop and has priority over resident story', async () => {
    const { context, page } = await openState(legacyState({
      placed: wormGarden,
      residentBeatsSeen: [],
      residentSeasons: {},
      residentWinters: {},
      pendingGardenCinematic: 'Autumn'
    }));
    try {
      const cinematic = page.locator('[data-pg-dialog="garden-cinematic"]');
      await cinematic.waitFor({ state: 'visible', timeout: 4000 });
      await page.waitForTimeout(1700);
      const during = await page.evaluate(() => {
        const app = window.__PERMAGARDEN_APP__;
        const media = document.querySelector('.pg-cinematic-image');
        return {
          active: app.activeDialogKey(),
          resident: app.state.residentStory,
          loop: app.state.gardenCinematic && app.state.gardenCinematic.loop,
          expectedLoop: app.seasonPassages.Autumn.loop,
          mediaTag: media && media.tagName,
          mediaSrc: media && media.getAttribute('src')
        };
      });
      const dialogs = await visibleDialogs(page);
      check(during.active === 'garden-cinematic' && during.resident === null,
        'restored cinematic remains the only active dialog while resident waits', { during, dialogs });
      check(dialogs.length === 1 && dialogs[0] === 'garden-cinematic',
        'cinematic and resident story are never stacked', dialogs);
      check(during.loop === during.expectedLoop && during.mediaTag === 'VIDEO' &&
          /autumn-loop\.webm$/i.test(during.mediaSrc || ''),
        'cinematic restore preserves and renders the seasonal video loop', during);

      await page.evaluate(() => window.__PERMAGARDEN_APP__.dismissGardenCinematic());
      await page.locator('[data-pg-dialog="resident-story"]').waitFor({ state: 'visible', timeout: 4000 });
      await page.waitForTimeout(450);
      const after = await visibleDialogs(page);
      check(after.length === 1 && after[0] === 'resident-story',
        'resident story appears alone after cinematic dismissal', after);
    } finally {
      await closeContext(context);
    }
  });

  await test('failed cinematic video falls back to its poster still', async () => {
    const { context, page } = await openState(legacyState(), {
      setupPage: pageToPrepare => pageToPrepare.route('**/missing-season-loop.mp4', route => route.abort())
    });
    try {
      await page.evaluate(async () => {
        const app = window.__PERMAGARDEN_APP__;
        const passage = app.seasonPassages.Winter;
        await new Promise(resolve => app.setState({
          gardenCinematic: {
            season: 'Winter',
            title: passage.title,
            text: passage.voice,
            image: passage.image,
            loop: 'assets/season-passages/missing-season-loop.mp4'
          }
        }, resolve));
      });
      await page.waitForFunction(() => {
        const app = window.__PERMAGARDEN_APP__;
        const media = document.querySelector('.pg-cinematic-image');
        return app.state.gardenCinematic && app.state.gardenCinematic.loop === '' &&
          media && media.tagName === 'IMG';
      }, null, { timeout: 5000 });
      const fallback = await page.evaluate(() => {
        const app = window.__PERMAGARDEN_APP__;
        const media = document.querySelector('.pg-cinematic-image');
        return {
          loop: app.state.gardenCinematic.loop,
          tag: media && media.tagName,
          src: media && media.getAttribute('src'),
          complete: !!media && media.complete,
          naturalWidth: media && media.naturalWidth
        };
      });
      check(fallback.loop === '' && fallback.tag === 'IMG' &&
          /winter\.webp$/i.test(fallback.src || '') && fallback.complete && fallback.naturalWidth > 0,
        'video error replaces motion with the valid seasonal poster', fallback);
    } finally {
      await closeContext(context);
    }
  });

  await test('unmuting while a resident dialog is visible resumes its Garden voice', async () => {
    const { context, page } = await openState(legacyState());
    try {
      const voice = await page.evaluate(async () => {
        const app = window.__PERMAGARDEN_APP__;
        const resident = app.residentStories.find(item => item.key === 'worm');
        const beat = resident.beats[0];
        const calls = [];
        app._gardenVoice = null;
        app.speakGarden = id => {
          calls.push({ type: 'voice', value: id });
          return null;
        };
        app.setMusicMode = mode => {
          calls.push({ type: 'music', value: mode });
        };
        await new Promise(resolve => app.setState({
          muted: true,
          residentStory: {
            id: beat.id,
            resident: resident.key,
            residentName: resident.name,
            title: beat.title,
            text: beat.text,
            art: 'assets/residents/' + beat.id + '.webp',
            index: 1,
            total: resident.beats.length
          }
        }, resolve));
        await new Promise(resolve => app.setState({ muted: false }, resolve));
        app.syncAudioMute();
        if (!app._gardenVoice) app.resumeVisibleGardenVoice();
        return {
          active: app.activeDialogKey(),
          muted: app.state.muted,
          calls
        };
      });
      check(voice.active === 'resident-story' && voice.muted === false &&
          voice.calls.some(call => call.type === 'voice' && call.value === 'worm-1') &&
          voice.calls.some(call => call.type === 'music' && call.value === 'reflection'),
        'resident narration and reflection music are restored on unmute', voice);
    } finally {
      await closeContext(context);
    }
  });

  await test('resident continuity resets immediately when its habitat disappears', async () => {
    const { context, page } = await openState(legacyState({
      placed: wormGarden,
      residentBeatsSeen: residentBeatIds,
      residentSeasons: { worm: 4 },
      residentWinters: { worm: 1 }
    }));
    try {
      const before = await page.evaluate(() => {
        const s = window.__PERMAGARDEN_APP__.state;
        return { seasons: s.residentSeasons.worm, winters: s.residentWinters.worm };
      });
      check(before.seasons === 4 && before.winters === 1,
        'active worm continuity restores before habitat removal', before);
      await page.evaluate(async () => {
        const app = window.__PERMAGARDEN_APP__;
        await new Promise(resolve => app.setState({
          placed: app.state.placed.filter(item => item.type !== 'mulch')
        }, resolve));
      });
      await page.waitForFunction(() => {
        const state = window.__PERMAGARDEN_APP__.state;
        return (state.residentSeasons.worm || 0) === 0 && (state.residentWinters.worm || 0) === 0;
      }, null, { timeout: 2500 });
      const after = await page.evaluate(key => {
        const app = window.__PERMAGARDEN_APP__;
        app.persist();
        const saved = JSON.parse(localStorage.getItem(key) || '{}');
        return {
          active: app.activeOf(app.state.placed).has('worm'),
          seasons: app.state.residentSeasons.worm,
          winters: app.state.residentWinters.worm,
          savedSeasons: saved.residentSeasons.worm,
          savedWinters: saved.residentWinters.worm,
          seen: app.state.residentBeatsSeen
        };
      }, storeKey);
      check(!after.active && (after.seasons || 0) === 0 && (after.winters || 0) === 0 &&
          (after.savedSeasons || 0) === 0 && (after.savedWinters || 0) === 0,
        'removing mulch immediately and durably resets worm continuity', after);
      check(after.seen.length === residentBeatIds.length,
        'habitat disappearance does not erase acknowledged stories', after);
    } finally {
      await closeContext(context);
    }
  });

  await test('resident and reflection dialogs remain reachable at 844×390', async () => {
    const { context, page } = await openState(legacyState(), {
      viewport: { width: 844, height: 390 }
    });
    try {
      await page.evaluate(async () => {
        const app = window.__PERMAGARDEN_APP__;
        const resident = app.residentStories.find(item => item.key === 'hedgehog');
        const beat = resident.beats[2];
        await new Promise(resolve => app.setState({
          residentStory: {
            id: beat.id,
            resident: resident.key,
            residentName: resident.name,
            title: beat.title,
            text: beat.text,
            art: 'assets/residents/' + beat.id + '.webp',
            index: 3,
            total: resident.beats.length
          }
        }, resolve));
      });
      await page.locator('[data-pg-dialog="resident-story"]').waitFor({ state: 'visible' });
      const residentMeasure = await measureDialog(page, '.pg-res');

      await page.evaluate(async () => {
        const app = window.__PERMAGARDEN_APP__;
        await new Promise(resolve => app.setState({
          residentStory: null,
          gardenReflection: app.reflectionForCount(3)
        }, resolve));
      });
      await page.locator('[data-pg-dialog="garden-reflection"]').waitFor({ state: 'visible' });
      const reflectionMeasure = await measureDialog(page, '.pg-garden-reflection');

      check(residentMeasure.exists && residentMeasure.contained &&
          residentMeasure.noHorizontalOverflow && residentMeasure.verticalContentReachable &&
          residentMeasure.actionReachable,
        'resident story is contained and its final action remains reachable in low landscape', residentMeasure);
      check(reflectionMeasure.exists && reflectionMeasure.contained &&
          reflectionMeasure.noHorizontalOverflow && reflectionMeasure.verticalContentReachable &&
          reflectionMeasure.actionReachable,
        'garden reflection is contained and its final action remains reachable in low landscape', reflectionMeasure);
    } finally {
      await closeContext(context);
    }
  });
} finally {
  for (const context of Array.from(openContexts)) {
    await closeContext(context).catch(() => {});
  }
  await browser.close();
}

if (failures.length) {
  console.error('\n' + failures.length + ' resident-state regression group(s) failed:');
  failures.forEach(({ name }) => console.error(' - ' + name));
  process.exitCode = 1;
} else {
  console.log('\nAll resident-state, cinematic and low-viewport regressions passed.');
}
