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
  ...overrides
});

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'no-preference'
});
const page = await context.newPage();
const browserErrors = [];
page.on('pageerror', error => browserErrors.push('pageerror: ' + error.message));
page.on('console', message => {
  if (message.type() === 'error') browserErrors.push('console: ' + message.text());
});

const waitForApp = async () => {
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 15000 });
  await page.waitForTimeout(100);
};

const setAppState = async patch => {
  await page.evaluate(async next => {
    const app = window.__PERMAGARDEN_APP__;
    await new Promise(resolve => app.setState({ ...app.state, ...next }, resolve));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, patch);
};

const appState = keys => page.evaluate(requested => {
  const state = window.__PERMAGARDEN_APP__.state;
  return Object.fromEntries(requested.map(key => [key, state[key]]));
}, keys);

const cssTimeInMilliseconds = value => {
  const first = String(value).split(',')[0].trim();
  if (first.endsWith('ms')) return Number.parseFloat(first);
  if (first.endsWith('s')) return Number.parseFloat(first) * 1000;
  return Number.NaN;
};

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await waitForApp();
  await page.evaluate(({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
    sessionStorage.clear();
  }, {
    key: storeKey,
    state: savedState({
      discovered: ['classroom'],
      placed: [{ id: 'nudge-1', type: 'compost', x: 50, y: 50 }]
    })
  });
  await page.reload({ waitUntil: 'networkidle' });
  await waitForApp();

  // -----------------------------------------------------------------------
  // The central interactive surface is exposed as a named landmark.
  // -----------------------------------------------------------------------
  const plot = page.locator('[data-plot="1"]');
  const plotSemantics = await plot.evaluate(element => ({
    role: element.getAttribute('role'),
    tabIndex: element.tabIndex,
    label: element.getAttribute('aria-label')
  }));
  check(
    plotSemantics.role === 'region' && plotSemantics.tabIndex === 0 && /garden plot/i.test(plotSemantics.label || ''),
    'the garden plot is a named, keyboard-focusable region',
    plotSemantics
  );

  // -----------------------------------------------------------------------
  // Bird multi-select: real disabled state until exactly three choices.
  // -----------------------------------------------------------------------
  await setAppState({ visit: { key: 'bird', status: 'ask', picked: [] }, visitSeason: 'Summer' });
  const confirmMenu = page.getByRole('button', { name: /Offer the menu/i });
  const initialConfirm = {
    disabled: await confirmMenu.isDisabled(),
    disabledAttribute: await confirmMenu.getAttribute('disabled'),
    ariaDisabled: await confirmMenu.getAttribute('aria-disabled')
  };
  check(
    initialConfirm.disabled && initialConfirm.disabledAttribute !== null && initialConfirm.ariaDisabled === 'true',
    'the bird-menu confirmation is truly disabled before a valid selection',
    initialConfirm
  );

  for (const option of ['Mealworms & caterpillars', 'Spiders', 'Autumn berries']) {
    await page.getByRole('button', { name: option, exact: true }).click();
  }
  const validConfirm = {
    disabled: await confirmMenu.isDisabled(),
    disabledAttribute: await confirmMenu.getAttribute('disabled'),
    ariaDisabled: await confirmMenu.getAttribute('aria-disabled')
  };
  check(
    !validConfirm.disabled && validConfirm.disabledAttribute === null && validConfirm.ariaDisabled === 'false',
    'the bird-menu confirmation becomes operable after three valid selections',
    validConfirm
  );

  // -----------------------------------------------------------------------
  // Deferring must preserve the opportunity and must not consume the visit.
  // -----------------------------------------------------------------------
  await setAppState({
    visit: { key: 'bird', status: 'ask', picked: [0, 1, 2] },
    visitsDone: { bee: 'won' },
    guests: ['bee']
  });
  await page.getByRole('button', { name: /Not now; let this visitor return another season/i }).click();
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__.state.visit === null);
  const deferred = await appState(['visit', 'visitsDone', 'guests']);
  check(
    deferred.visit === null &&
      deferred.visitsDone.bee === 'won' &&
      !Object.prototype.hasOwnProperty.call(deferred.visitsDone, 'bird') &&
      JSON.stringify(deferred.guests) === JSON.stringify(['bee']),
    'Not now defers the visitor without consuming or recording the attempt',
    deferred
  );

  // Escape has the same defer behaviour for a question, but closes a result.
  await setAppState({
    visit: { key: 'bird', status: 'ask', picked: [] },
    visitsDone: { bee: 'won' },
    guests: ['bee'],
    seenWildlife: [],
    arrivalQueue: []
  });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__.state.visit === null);
  const escapedAsk = await appState(['visit', 'visitsDone', 'seenWildlife', 'arrivalQueue']);
  check(
    escapedAsk.visit === null &&
      !Object.prototype.hasOwnProperty.call(escapedAsk.visitsDone, 'bird') &&
      escapedAsk.seenWildlife.length === 0 &&
      escapedAsk.arrivalQueue.length === 0,
    'Escape defers an unanswered visitor instead of consuming it',
    escapedAsk
  );

  await setAppState({
    visit: { key: 'bird', status: 'won', picked: [0, 1, 2] },
    visitsDone: { bird: 'won' },
    guests: ['bird'],
    seenWildlife: [],
    arrivalQueue: []
  });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__.state.visit === null);
  const escapedResult = await appState(['visit', 'visitsDone', 'seenWildlife', 'arrivalQueue']);
  check(
    escapedResult.visit === null &&
      escapedResult.visitsDone.bird === 'won' &&
      escapedResult.seenWildlife.includes('bird') &&
      escapedResult.arrivalQueue.includes('bird'),
    'Escape closes a completed visitor result and preserves its earned outcome',
    escapedResult
  );

  // Dismiss the queued arrival card before testing the guild dialog.
  await setAppState({ arrivalQueue: [], guildCard: null, guildReview: false, showGuilds: true });
  const guildDialog = page.locator('[data-pg-dialog="guild-list"]');
  await guildDialog.waitFor({ state: 'visible' });

  const discoveredGuild = guildDialog.getByRole('button', { name: /discovered guild Outdoor classroom/i });
  await discoveredGuild.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__.state.guildCard === 'classroom');
  const openedGuild = await appState(['guildCard', 'guildReview', 'showGuilds']);
  check(
    openedGuild.guildCard === 'classroom' && openedGuild.guildReview === true && openedGuild.showGuilds === false,
    'a discovered guild row opens from the keyboard',
    openedGuild
  );

  await setAppState({ guildCard: null, guildReview: false, showGuilds: true });
  await guildDialog.waitFor({ state: 'visible' });
  const lockedGuild = guildDialog.locator('[role="button"][aria-disabled="true"]').first();
  const lockedLabel = await lockedGuild.getAttribute('aria-label');
  await lockedGuild.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  await page.keyboard.press('Space');
  await page.waitForTimeout(80);
  const lockedAttempt = await appState(['guildCard', 'showGuilds']);
  check(
    lockedAttempt.guildCard === null && lockedAttempt.showGuilds === true,
    'an undiscovered guild row does not activate from Enter or Space',
    { lockedLabel, ...lockedAttempt }
  );

  // -----------------------------------------------------------------------
  // Placed elements expose meaningful arrow-key movement.
  // -----------------------------------------------------------------------
  await setAppState({ showGuilds: false, placed: [{ id: 'nudge-1', type: 'compost', x: 50, y: 50 }] });
  const placedElement = page.locator('[data-drag-id="nudge-1"]');
  await placedElement.focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__.state.placed[0].x === 53);
  const nudged = await page.evaluate(() => window.__PERMAGARDEN_APP__.state.placed[0]);
  check(
    nudged.x === 53 && nudged.y === 50,
    'a focused garden element moves by one keyboard step with an arrow key',
    nudged
  );

  // -----------------------------------------------------------------------
  // Reduced-motion preference suppresses the garden's continuous motion.
  // -----------------------------------------------------------------------
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(50);
  const reducedMotion = await plot.evaluate(element => {
    const animated = Array.from(element.querySelectorAll('*')).find(node => node.style?.animationName === 'pg-sway');
    const transitioning = Array.from(element.querySelectorAll('*')).find(node => node.style?.transitionProperty?.includes('transform'));
    if (!animated || !transitioning) {
      return { foundAnimated: Boolean(animated), foundTransitioning: Boolean(transitioning) };
    }
    const animationStyle = getComputedStyle(animated);
    const transitionStyle = getComputedStyle(transitioning);
    return {
      foundAnimated: true,
      foundTransitioning: true,
      animationName: animationStyle.animationName,
      animationDuration: animationStyle.animationDuration,
      animationIterations: animationStyle.animationIterationCount,
      transitionDuration: transitionStyle.transitionDuration
    };
  });
  check(
    reducedMotion.foundAnimated &&
      reducedMotion.foundTransitioning &&
      cssTimeInMilliseconds(reducedMotion.animationDuration) <= 0.001 &&
      cssTimeInMilliseconds(reducedMotion.transitionDuration) <= 0.001 &&
      reducedMotion.animationIterations === '1',
    'prefers-reduced-motion effectively disables garden animation and transitions',
    reducedMotion
  );

  check(browserErrors.length === 0, 'no browser console or runtime errors were recorded', browserErrors);
  console.log('ACCESSIBILITY REGRESSION COMPLETE');
} finally {
  await context.close();
  await browser.close();
}
