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
  mode: 'guided',
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
const browserErrors = [];

const openState = async initialState => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => browserErrors.push('pageerror: ' + error.message));
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push('console: ' + message.text());
  });

  // Load the origin once, then replace the fresh boot save. This intentionally
  // clears pg_session so the next navigation behaves like a new browser session.
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 15000 });
  await page.evaluate(({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
    sessionStorage.clear();
  }, { key: storeKey, state: initialState });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 15000 });
  await page.waitForTimeout(120);
  return { context, page };
};

const setAppState = async (page, patch) => {
  await page.evaluate(async next => {
    const app = window.__PERMAGARDEN_APP__;
    await new Promise(resolve => app.setState({ ...app.state, ...next }, resolve));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, patch);
};

const actionableCount = locator => locator.evaluateAll(elements => elements.filter(element => {
  const style = getComputedStyle(element);
  const hidden = style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0;
  const disabled = element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
  return !hidden && !disabled;
}).length);

const physicalGarden = () => [
  // These intentionally clear both the Guided type checks and the stricter
  // Free Garden system thresholds without accidentally forming a guild.
  { id: 'soil-1', type: 'compost', x: 8, y: 82 },
  { id: 'soil-2', type: 'mulch', x: 22, y: 82 },
  { id: 'water-1', type: 'rain', x: 8, y: 18 },
  // Close enough to the rain store to create one useful system relationship,
  // while still avoiding any of the seven named guild pairs.
  { id: 'food-1', type: 'appletree', x: 22, y: 20 },
  { id: 'food-2', type: 'herbspiral', x: 88, y: 18 },
  { id: 'habitat-1', type: 'pollinator', x: 88, y: 82 },
  { id: 'habitat-2', type: 'bughotel', x: 47, y: 18 }
];

try {
  // -------------------------------------------------------------------------
  // Persistence: season and every seasonal counter survive a fresh session.
  // -------------------------------------------------------------------------
  {
    const { context, page } = await openState(savedState());
    const roundTripSeason = async expected => {
      await setAppState(page, expected);
      const persisted = await page.evaluate(key => {
        const app = window.__PERMAGARDEN_APP__;
        app.persist();
        return JSON.parse(localStorage.getItem(key));
      }, storeKey);
      await page.evaluate(() => sessionStorage.clear());
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__PERMAGARDEN_APP__);
      const restored = await page.evaluate(() => {
        const state = window.__PERMAGARDEN_APP__.state;
        return {
          season: state.season,
          cherryPicks: state.cherryPicks,
          springSprouts: state.springSprouts,
          leafPiles: state.leafPiles
        };
      });
      return { persisted, restored };
    };

    const autumnRoundTrip = await roundTripSeason({
      season: 'Autumn', cherryPicks: 0, springSprouts: 0, leafPiles: 2
    });
    check(
      autumnRoundTrip.persisted.leafPiles === 2 &&
        autumnRoundTrip.restored.season === 'Autumn' &&
        autumnRoundTrip.restored.leafPiles === 2,
      'an Autumn reload preserves both the season and remaining leaf piles',
      autumnRoundTrip
    );

    const summerRoundTrip = await roundTripSeason({
      season: 'Summer', cherryPicks: 1, springSprouts: 0, leafPiles: 0
    });
    check(
      summerRoundTrip.persisted.cherryPicks === 1 &&
        summerRoundTrip.restored.season === 'Summer' &&
        summerRoundTrip.restored.cherryPicks === 1,
      'a Summer reload does not regenerate harvested cherries',
      summerRoundTrip
    );

    const springRoundTrip = await roundTripSeason({
      season: 'Spring', cherryPicks: 0, springSprouts: 2, leafPiles: 0
    });
    check(
      springRoundTrip.persisted.springSprouts === 2 &&
        springRoundTrip.restored.season === 'Spring' &&
        springRoundTrip.restored.springSprouts === 2,
      'a Spring reload preserves the remaining forage counter',
      springRoundTrip
    );
    await context.close();
  }

  // -------------------------------------------------------------------------
  // Season state machine: active/no-op and chronological transitions only.
  // -------------------------------------------------------------------------
  {
    const { context, page } = await openState(savedState({
      mode: 'explore',
      season: 'Summer',
      cherryPicks: 1,
      basket: { cherries: 2 }
    }));
    const seasonEvidence = await page.evaluate(async () => {
      const app = window.__PERMAGARDEN_APP__;
      const wait = () => new Promise(resolve => setTimeout(resolve, 140));
      const originalPickGate = app.pickGate;
      app.pickGate = () => null;

      const initial = {
        season: app.state.season,
        cherryPicks: app.state.cherryPicks,
        basket: { ...(app.state.basket || {}) },
        pool: app.state.pool
      };
      app.applySeason('Summer');
      await wait();
      const afterActive = {
        season: app.state.season,
        cherryPicks: app.state.cherryPicks,
        basket: { ...(app.state.basket || {}) },
        pool: app.state.pool,
        gate: app.state.gate
      };

      app.applySeason('Winter');
      await wait();
      const afterSkippedTarget = app.state.season;

      app.applySeason('Autumn');
      await wait();
      const afterNext = app.state.season;

      app.applySeason('Spring');
      await wait();
      const afterSecondSkippedTarget = app.state.season;

      app.applySeason('Winter');
      await wait();
      const afterSecondNext = app.state.season;
      app.pickGate = originalPickGate;
      return { initial, afterActive, afterSkippedTarget, afterNext, afterSecondSkippedTarget, afterSecondNext };
    });
    check(
      JSON.stringify(seasonEvidence.afterActive) === JSON.stringify({ ...seasonEvidence.initial, gate: null }),
      'choosing the active season is a complete no-op',
      seasonEvidence
    );
    check(
      seasonEvidence.afterSkippedTarget === 'Summer' &&
        seasonEvidence.afterNext === 'Autumn' &&
        seasonEvidence.afterSecondSkippedTarget === 'Autumn' &&
        seasonEvidence.afterSecondNext === 'Winter',
      'season progression accepts only the next chronological season',
      seasonEvidence
    );
    await context.close();
  }

  // -------------------------------------------------------------------------
  // Consequences: relationship loss, capped effects and unique garden voice.
  // -------------------------------------------------------------------------
  {
    const { context, page } = await openState(savedState({ mode: 'explore' }));
    const systemsEvidence = await page.evaluate(async () => {
      const app = window.__PERMAGARDEN_APP__;
      const wait = () => new Promise(resolve => setTimeout(resolve, 140));

      await new Promise(resolve => app.setState({
        ...app.state,
        placed: [
          { id: 'rain-link', type: 'rain', x: 20, y: 24 },
          { id: 'food-link', type: 'hugel', x: 22, y: 25 }
        ],
        gardenEffects: {},
        journeyMoments: [],
        toast: null,
        gardenPulse: null,
        gardenWhisper: null
      }, resolve));
      const waterBeforeMove = app.gardenSystems(app.state).values.water;
      app.moveElement('rain-link', 92, 90);
      await wait();
      const waterAfterMove = app.gardenSystems(app.state).values.water;
      const moveToast = app.state.toast;

      const challengeBase = {
        ...app.state,
        placed: [
          { id: 'rain-effect', type: 'rain', x: 25, y: 60 },
          { id: 'compost-effect', type: 'compost', x: 70, y: 60 }
        ],
        gardenEffects: {},
        journeyMoments: [],
        gardenWhisper: null
      };
      const rainBaseline = app.gardenSystems(challengeBase).values.water;
      const firstRain = app.applyChallengeImpact(challengeBase, 'rain');
      const firstRainWater = app.gardenSystems(firstRain).values.water;
      const repeatedRain = app.applyChallengeImpact(firstRain, 'rain');
      const repeatedRainWater = app.gardenSystems(repeatedRain).values.water;
      const withoutRain = { ...repeatedRain, placed: repeatedRain.placed.filter(item => item.type !== 'rain') };
      const withoutRainEffect = app.gardenSystems(withoutRain).values.water;
      const withoutRainBaseline = app.gardenSystems({ ...withoutRain, gardenEffects: {} }).values.water;

      const firstWhisper = firstRain.gardenWhisper;
      const secondChallenge = app.applyChallengeImpact(firstRain, 'compost');
      const secondWhisper = secondChallenge.gardenWhisper;

      return {
        waterBeforeMove,
        waterAfterMove,
        moveToast,
        rainBaseline,
        firstRainWater,
        repeatedRainWater,
        withoutRainEffect,
        withoutRainBaseline,
        firstRainEffect: firstRain.gardenEffects.rain,
        repeatedRainEffect: repeatedRain.gardenEffects.rain,
        firstWhisper,
        secondWhisper
      };
    });
    check(
      systemsEvidence.waterAfterMove < systemsEvidence.waterBeforeMove && /weaken/i.test(systemsEvidence.moveToast || ''),
      'moving an element away lowers the system and explains the weakened relationship',
      systemsEvidence
    );
    check(
      systemsEvidence.firstRainWater > systemsEvidence.rainBaseline &&
        systemsEvidence.repeatedRainWater === systemsEvidence.firstRainWater &&
        systemsEvidence.repeatedRainEffect === systemsEvidence.firstRainEffect,
      'a challenge has one lasting benefit and cannot be stacked by replaying it',
      systemsEvidence
    );
    check(
      systemsEvidence.withoutRainEffect === systemsEvidence.withoutRainBaseline,
      'a physical rain-system benefit is inactive when its supporting element is absent',
      systemsEvidence
    );
    check(
      systemsEvidence.firstWhisper?.text &&
        systemsEvidence.secondWhisper?.text &&
        systemsEvidence.secondWhisper.text !== systemsEvidence.firstWhisper.text &&
        systemsEvidence.secondWhisper.key !== systemsEvidence.firstWhisper.key,
      'a second distinct challenge produces its own unique garden whisper',
      systemsEvidence
    );
    await context.close();
  }

  // -------------------------------------------------------------------------
  // Guided Journey: harvest and sharing unlock only at the community act.
  // -------------------------------------------------------------------------
  {
    const { context, page } = await openState(savedState({
      mode: 'guided',
      season: 'Summer',
      cherryPicks: 3,
      basket: { cherries: 1 }
    }));
    const earlyHarvest = {
      cherryButtons: await actionableCount(page.getByRole('button', { name: 'Pick ripe cherries' })),
      shareButtons: await actionableCount(page.getByRole('button', { name: /Give Cherries/i }))
    };
    check(
      earlyHarvest.cherryButtons === 0 && earlyHarvest.shareButtons === 0,
      'Guided Journey hides harvest and sharing before the community act',
      earlyHarvest
    );

    await setAppState(page, {
      placed: physicalGarden(),
      journeyMoments: [],
      sharedActs: 0,
      cherryPicks: 3,
      basket: { cherries: 1 },
      guildCard: null,
      arrivalQueue: []
    });
    const communityAct = await page.evaluate(() => window.__PERMAGARDEN_APP__.journeyModel().current.key);
    const unlockedHarvest = {
      cherryButtons: await actionableCount(page.getByRole('button', { name: 'Pick ripe cherries' })),
      shareButtons: await actionableCount(page.getByRole('button', { name: /Give Cherries/i }))
    };
    check(communityAct === 'share', 'the four physical pillars lead to the community act', { communityAct });
    check(
      unlockedHarvest.cherryButtons > 0 && unlockedHarvest.shareButtons > 0,
      'harvest and sharing unlock during the community act',
      unlockedHarvest
    );
    await context.close();
  }

  // -------------------------------------------------------------------------
  // Completion: Free uses all eight acts; Guided readiness follows pillars.
  // -------------------------------------------------------------------------
  {
    const { context, page } = await openState(savedState({
      mode: 'explore',
      placed: physicalGarden(),
      journeyMoments: ['share', 'challenge'],
      sharedActs: 1,
      harvestEver: false,
      discovered: []
    }));
    const incompleteFree = {
      button: await page.getByTestId('reflection-button').innerText(),
      body: await page.locator('body').innerText()
    };
    check(
      !/Complete my garden story/i.test(incompleteFree.button) && /Harvest & preserve/i.test(incompleteFree.body),
      'Free Garden does not complete after only the six Guided acts',
      { button: incompleteFree.button }
    );

    await setAppState(page, {
      harvestEver: true,
      placed: [
        ...physicalGarden(),
        { id: 'guild-bench', type: 'bench', x: 68, y: 50 },
        { id: 'guild-sign', type: 'sign', x: 70, y: 51 }
      ],
      discovered: ['classroom']
    });
    const completeFreeButton = await page.getByTestId('reflection-button').innerText();
    check(
      /Complete my garden story/i.test(completeFreeButton),
      'Free Garden completes only after harvest and guild discovery bring it to 8/8',
      { completeFreeButton }
    );

    await setAppState(page, {
      mode: 'guided',
      placed: physicalGarden(),
      journeyMoments: ['share', 'challenge'],
      sharedActs: 1
    });
    const readyBeforeRemoval = await page.evaluate(() => window.__PERMAGARDEN_APP__.journeyModel().ready);
    const readyButton = await page.getByTestId('reflection-button').innerText();
    await setAppState(page, { placed: physicalGarden().filter(item => item.type !== 'rain') });
    const afterRemoval = await page.evaluate(() => {
      const journey = window.__PERMAGARDEN_APP__.journeyModel();
      return { ready: journey.ready, current: journey.current.key };
    });
    const afterRemovalButton = await page.getByTestId('reflection-button').innerText();
    check(
      readyBeforeRemoval && /Complete my garden story/i.test(readyButton),
      'Guided completion is ready while all current pillars exist',
      { readyBeforeRemoval, readyButton }
    );
    check(
      !afterRemoval.ready && afterRemoval.current === 'water' && !/Complete my garden story/i.test(afterRemovalButton),
      'removing a physical pillar returns Guided completion to not-ready',
      { afterRemoval, afterRemovalButton }
    );
    await context.close();
  }

  check(browserErrors.length === 0, 'no browser console or runtime errors were recorded', browserErrors);
  console.log('EDGE REGRESSION COMPLETE');
} finally {
  await browser.close();
}
