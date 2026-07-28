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

const check = (condition, message, evidence) => {
  if (!condition) {
    const detail = evidence === undefined ? '' : '\nEvidence: ' + JSON.stringify(evidence, null, 2);
    throw new Error(message + detail);
  }
  console.log('PASS  ' + message);
};

const minimalCycleGarden = () => [
  // All four living pillars are present, but this intentionally has no guild
  // and only one modest connection. It is a first cycle, not flourishing.
  { id: 'cycle-soil', type: 'compost', x: 8, y: 82, paidMethod: 'buy', paidAmount: 40, placedTurn: 0 },
  { id: 'cycle-water', type: 'rain', x: 8, y: 18, paidMethod: 'buy', paidAmount: 120, placedTurn: 0 },
  { id: 'cycle-food', type: 'appletree', x: 22, y: 20, paidMethod: 'buy', paidAmount: 50, placedTurn: 0 },
  { id: 'cycle-habitat', type: 'pollinator', x: 88, y: 82, paidMethod: 'buy', paidAmount: 40, placedTurn: 0 }
];

const flourishingGarden = () => [
  // The close pairs form all seven currently modelled guilds. Additional
  // elements make each garden system materially resilient as well as broad.
  { id: 'f-compost', type: 'compost', x: 10, y: 15, paidMethod: 'buy', paidAmount: 40, placedTurn: 0 },
  { id: 'f-greenhouse', type: 'greenhouse', x: 12, y: 16, paidMethod: 'buy', paidAmount: 220, placedTurn: 0 },
  { id: 'f-rain', type: 'rain', x: 30, y: 15, paidMethod: 'buy', paidAmount: 120, placedTurn: 0 },
  { id: 'f-herbspiral', type: 'herbspiral', x: 32, y: 16, paidMethod: 'buy', paidAmount: 70, placedTurn: 0 },
  { id: 'f-hugel', type: 'hugel', x: 50, y: 15, paidMethod: 'buy', paidAmount: 60, placedTurn: 0 },
  { id: 'f-arch', type: 'arch', x: 52, y: 16, paidMethod: 'buy', paidAmount: 90, placedTurn: 0 },
  { id: 'f-birdhouse', type: 'birdhouse', x: 49, y: 17, paidMethod: 'buy', paidAmount: 35, placedTurn: 0 },
  { id: 'f-bughotel', type: 'bughotel', x: 70, y: 15, paidMethod: 'buy', paidAmount: 30, placedTurn: 0 },
  { id: 'f-pollinator', type: 'pollinator', x: 72, y: 16, paidMethod: 'buy', paidAmount: 40, placedTurn: 0 },
  { id: 'f-seedbank', type: 'seedbank', x: 73, y: 17, paidMethod: 'buy', paidAmount: 15, placedTurn: 0 },
  { id: 'f-bench', type: 'bench', x: 88, y: 15, paidMethod: 'buy', paidAmount: 80, placedTurn: 0 },
  { id: 'f-sign', type: 'sign', x: 89, y: 16, paidMethod: 'buy', paidAmount: 15, placedTurn: 0 },
  { id: 'f-mulch', type: 'mulch', x: 12, y: 60, paidMethod: 'buy', paidAmount: 20, placedTurn: 0 },
  { id: 'f-appletree', type: 'appletree', x: 14, y: 61, paidMethod: 'buy', paidAmount: 50, placedTurn: 0 },
  { id: 'f-birdbath', type: 'birdbath', x: 32, y: 60, paidMethod: 'buy', paidAmount: 45, placedTurn: 0 },
  { id: 'f-kitchen', type: 'kitchen', x: 54, y: 60, paidMethod: 'buy', paidAmount: 200, placedTurn: 0 }
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const browserErrors = [];

page.on('pageerror', error => browserErrors.push('pageerror: ' + error.message));
page.on('console', message => {
  if (message.type() === 'error') browserErrors.push('console: ' + message.text());
});
page.on('response', response => {
  if (response.url().startsWith(baseUrl) && response.status() >= 400) {
    browserErrors.push(`http ${response.status()}: ${response.url()}`);
  }
});

const settle = async () => {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(60);
};

const resetApp = async (patch = {}) => {
  await page.evaluate(async next => {
    const app = window.__PERMAGARDEN_APP__;
    if (!app) throw new Error('Permaculture Garden test API is unavailable');
    if (typeof app.clearTransientWork === 'function') app.clearTransientWork();
    if (typeof app.stopAllAudio === 'function') app.stopAllAudio();
    app._suppressFx = true;
    const fresh = app.freshState(false);
    const state = {
      ...fresh,
      story: false,
      storySeen: true,
      storyStarted: false,
      intro: false,
      introSeen: true,
      mode: 'explore',
      placed: [],
      market: [],
      muted: true,
      shares: 10,
      budget: 300,
      pool: 65,
      goodwill: 0,
      given: 0,
      awarded: [],
      sharedActs: 0,
      season: 'Summer',
      seasonTurns: 0,
      rewardedGiftTypes: [],
      paymentChoice: null,
      journeyMoments: [],
      gardenEffects: {},
      communityMemory: [],
      basket: {},
      materials: {},
      harvestEver: false,
      discovered: [],
      gardenWhisper: null,
      gardenWhisperQueue: [],
      gardenReflection: null,
      gardenReflectionQueue: [],
      gardenCinematic: null,
      guildCard: null,
      guildCardQueue: [],
      arrivalQueue: [],
      returnQueue: [],
      visit: null,
      gate: null,
      showSummary: false,
      showGuilds: false,
      ...next
    };
    await new Promise(resolve => app.setState(state, resolve));
    if (typeof app.capturePreviousState === 'function') app.capturePreviousState();
    app._suppressFx = false;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, patch);
  await page.waitForTimeout(60);
};

const patchState = async patch => {
  await page.evaluate(async next => {
    const app = window.__PERMAGARDEN_APP__;
    await new Promise(resolve => app.setState(state => ({ ...state, ...next }), resolve));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, patch);
  await page.waitForTimeout(40);
};

const placeType = async (type, x, y, via = 'gift') => {
  await page.evaluate(({ type: itemType, x: itemX, y: itemY, via: source }) => {
    window.__PERMAGARDEN_APP__.placeType(itemType, itemX, itemY, source);
  }, { type, x, y, via });
  await settle();
};

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 15000 });
  await page.evaluate(() => { Math.random = () => 0.99; });

  const contract = await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    return Object.fromEntries([
      'elementGiftEligibility',
      'elementGiftReward',
      'completionModel',
      'certificateStats',
      'reciprocityUnlocked'
    ].map(name => [name, typeof app[name]]));
  });
  check(
    Object.values(contract).every(type => type === 'function'),
    'the v70 economy and completion helpers are exposed to regression tests',
    contract
  );

  // -----------------------------------------------------------------------
  // Genuine surplus: an old duplicate crop is still ineligible while unripe.
  // -----------------------------------------------------------------------
  await resetApp({ seasonTurns: 0 });
  await placeType('crop_root', 22, 72, 'gift');
  await placeType('crop_root', 78, 72, 'gift');
  await patchState({ seasonTurns: 1 });

  const cropBefore = await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    const crop = app.state.placed.find(item => item.type === 'crop_root');
    const eligibility = app.elementGiftEligibility(crop.id);
    return {
      id: crop.id,
      stage: crop.stage,
      eligibility,
      count: app.state.placed.length,
      shares: app.state.shares,
      sharedActs: app.state.sharedActs
    };
  });
  check(
    cropBefore.stage === 1 && cropBefore.eligibility?.eligible === false,
    'an immature crop cannot be donated as a placed element',
    cropBefore
  );
  check(
    /crop|harvest|matur|ripe|ready/i.test(cropBefore.eligibility?.reason || ''),
    'the immature-crop refusal explains that growth or harvest must come first',
    cropBefore.eligibility
  );
  await page.evaluate(id => window.__PERMAGARDEN_APP__.giveElement(id, 'crop_root'), cropBefore.id);
  await settle();
  const cropAfter = await page.evaluate(id => {
    const state = window.__PERMAGARDEN_APP__.state;
    return {
      stillPlaced: state.placed.some(item => item.id === id),
      count: state.placed.length,
      shares: state.shares,
      sharedActs: state.sharedActs
    };
  }, cropBefore.id);
  check(
    cropAfter.stillPlaced && cropAfter.count === cropBefore.count &&
      cropAfter.shares === cropBefore.shares && cropAfter.sharedActs === cropBefore.sharedActs,
    'attempting to give an immature crop changes neither inventory nor economy',
    { cropBefore, cropAfter }
  );

  // -----------------------------------------------------------------------
  // Genuine surplus: only an established duplicate can leave the garden.
  // -----------------------------------------------------------------------
  await resetApp({ seasonTurns: 0, shares: 10, rewardedGiftTypes: [] });
  await placeType('sign', 14, 80, 'gift');
  await patchState({ seasonTurns: 1 });
  await placeType('sign', 86, 80, 'gift');

  const signEligibility = await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    const signs = app.state.placed.filter(item => item.type === 'sign');
    return {
      oldId: signs[0].id,
      newId: signs[1].id,
      oldResult: app.elementGiftEligibility(signs[0].id),
      newResult: app.elementGiftEligibility(signs[1].id),
      seasonTurns: app.state.seasonTurns,
      signs
    };
  });
  check(
    signEligibility.newResult?.eligible === false,
    'a newly placed duplicate cannot be donated immediately',
    signEligibility
  );
  check(
    /season|turn|new|settle|establish|grow/i.test(signEligibility.newResult?.reason || ''),
    'the new-element refusal explains the one-season establishment rule',
    signEligibility.newResult
  );
  check(
    signEligibility.oldResult?.eligible === true,
    'a duplicate that has remained for at least one season turn is eligible',
    signEligibility
  );

  const beforeNewAttempt = await page.evaluate(() => {
    const state = window.__PERMAGARDEN_APP__.state;
    return { count: state.placed.length, shares: state.shares, sharedActs: state.sharedActs };
  });
  await page.evaluate(id => window.__PERMAGARDEN_APP__.giveElement(id, 'sign'), signEligibility.newId);
  await settle();
  const afterNewAttempt = await page.evaluate(id => {
    const state = window.__PERMAGARDEN_APP__.state;
    return {
      stillPlaced: state.placed.some(item => item.id === id),
      count: state.placed.length,
      shares: state.shares,
      sharedActs: state.sharedActs
    };
  }, signEligibility.newId);
  check(
    afterNewAttempt.stillPlaced && afterNewAttempt.count === beforeNewAttempt.count &&
      afterNewAttempt.shares === beforeNewAttempt.shares && afterNewAttempt.sharedActs === beforeNewAttempt.sharedActs,
    'the blocked immediate donation is a complete economy no-op',
    { beforeNewAttempt, afterNewAttempt }
  );

  const firstGiftBefore = await page.evaluate(id => {
    const app = window.__PERMAGARDEN_APP__;
    return {
      reward: app.elementGiftReward('sign'),
      barter: app.econ.sign.barter,
      shares: app.state.shares,
      sharedActs: app.state.sharedActs,
      eligible: app.elementGiftEligibility(id)
    };
  }, signEligibility.oldId);
  await page.evaluate(id => window.__PERMAGARDEN_APP__.giveElement(id, 'sign'), signEligibility.oldId);
  await settle();
  const firstGiftAfter = await page.evaluate(id => {
    const state = window.__PERMAGARDEN_APP__.state;
    return {
      removed: !state.placed.some(item => item.id === id),
      shares: state.shares,
      sharedActs: state.sharedActs,
      rewardedGiftTypes: state.rewardedGiftTypes
    };
  }, signEligibility.oldId);
  const firstGiftDelta = firstGiftAfter.shares - firstGiftBefore.shares;
  check(
    firstGiftAfter.removed && firstGiftAfter.sharedActs === firstGiftBefore.sharedActs + 1,
    'giving the established duplicate records one genuine sharing act',
    { firstGiftBefore, firstGiftAfter }
  );
  check(
    firstGiftDelta === firstGiftBefore.reward && firstGiftDelta >= 0 && firstGiftDelta <= firstGiftBefore.barter,
    'a first element gift never earns more shares than its barter cost',
    { firstGiftBefore, firstGiftAfter, firstGiftDelta }
  );
  check(
    firstGiftAfter.rewardedGiftTypes.includes('sign'),
    'the first rewarded element type is remembered',
    firstGiftAfter
  );

  // Add a fresh spare, then let both remaining signs live through a turn.
  await placeType('sign', 50, 82, 'gift');
  await patchState({ seasonTurns: 2 });
  const repeatBefore = await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    const signs = app.state.placed.filter(item => item.type === 'sign');
    return {
      id: signs[0].id,
      count: signs.length,
      eligibility: app.elementGiftEligibility(signs[0].id),
      reward: app.elementGiftReward('sign'),
      shares: app.state.shares,
      sharedActs: app.state.sharedActs,
      rewardedGiftTypes: [...app.state.rewardedGiftTypes]
    };
  });
  check(
    repeatBefore.count === 2 && repeatBefore.eligibility?.eligible === true && repeatBefore.reward === 0,
    'a later established duplicate remains shareable but its type has no repeat currency reward',
    repeatBefore
  );
  await page.evaluate(id => window.__PERMAGARDEN_APP__.giveElement(id, 'sign'), repeatBefore.id);
  await settle();
  const repeatAfter = await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    const lastSign = app.state.placed.find(item => item.type === 'sign');
    return {
      signs: app.state.placed.filter(item => item.type === 'sign').length,
      shares: app.state.shares,
      sharedActs: app.state.sharedActs,
      rewardedGiftTypes: [...app.state.rewardedGiftTypes],
      lastEligibility: lastSign ? app.elementGiftEligibility(lastSign.id) : null
    };
  });
  check(
    repeatAfter.signs === 1 && repeatAfter.sharedActs === repeatBefore.sharedActs + 1 &&
      repeatAfter.shares === repeatBefore.shares,
    'repeating an element type can circulate a real spare without minting shares again',
    { repeatBefore, repeatAfter }
  );
  check(
    repeatAfter.rewardedGiftTypes.filter(type => type === 'sign').length === 1,
    'rewarded element types remain a unique ledger',
    repeatAfter
  );
  check(
    repeatAfter.lastEligibility?.eligible === false && /duplicate|spare|only|another/i.test(repeatAfter.lastEligibility?.reason || ''),
    'the last remaining element of a type is not treated as surplus',
    repeatAfter.lastEligibility
  );

  const rewardCaps = await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    return Object.entries(app.econ).map(([type, economy]) => {
      const firstState = { ...app.state, rewardedGiftTypes: [] };
      const repeatedState = { ...app.state, rewardedGiftTypes: [type] };
      return {
        type,
        barter: economy.barter,
        cap: economy.barter == null ? 0 : Math.max(0, economy.barter),
        firstReward: app.elementGiftReward(type, firstState),
        repeatedReward: app.elementGiftReward(type, repeatedState)
      };
    });
  });
  check(
    rewardCaps.every(row => Number.isFinite(row.firstReward) && row.firstReward >= 0 && row.firstReward <= row.cap),
    'every element reward is capped at its barter cost, including zero for non-barter and free elements',
    rewardCaps.filter(row => !(Number.isFinite(row.firstReward) && row.firstReward >= 0 && row.firstReward <= row.cap))
  );
  check(
    rewardCaps.every(row => row.repeatedReward === 0),
    'every repeated element type has zero currency reward',
    rewardCaps.filter(row => row.repeatedReward !== 0)
  );

  // -----------------------------------------------------------------------
  // Persistent payment intent: the visible toggle chooses the preferred
  // source without interrupting every placement with another modal.
  // -----------------------------------------------------------------------
  await resetApp({ shares: 10, budget: 300, payWith: 'shares', paymentChoice: null });
  const paymentBefore = await page.evaluate(() => {
    const state = window.__PERMAGARDEN_APP__.state;
    return { shares: state.shares, budget: state.budget, placed: state.placed.length };
  });
  await placeType('compost', 36, 72, 'auto');
  const sharePayment = await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    const item = app.state.placed.at(-1);
    return {
      paymentChoice: app.state.paymentChoice,
      payWith: app.state.payWith,
      shares: app.state.shares,
      budget: app.state.budget,
      placed: app.state.placed.length,
      paidMethod: item?.paidMethod,
      paidAmount: item?.paidAmount
    };
  });
  check(
    sharePayment.paymentChoice === null && sharePayment.paidMethod === 'barter' &&
      sharePayment.shares < paymentBefore.shares && sharePayment.budget === paymentBefore.budget &&
      sharePayment.placed === paymentBefore.placed + 1,
    'the default shares preference places immediately and spends only participation shares',
    { paymentBefore, sharePayment }
  );

  await resetApp({ shares: 10, budget: 300, payWith: 'shares', paymentChoice: null });
  await page.getByTestId('pay-euro-toggle').click();
  await settle();
  const euroPreference = await page.evaluate(() => ({
    payWith: window.__PERMAGARDEN_APP__.state.payWith,
    euroPressed: document.querySelector('[data-testid="pay-euro-toggle"]')?.getAttribute('aria-pressed'),
    sharePressed: document.querySelector('[data-testid="pay-shares-toggle"]')?.getAttribute('aria-pressed'),
    storedPayWith: JSON.parse(localStorage.getItem(window.__PERMAGARDEN_APP__.STORE) || '{}').payWith
  }));
  check(
    euroPreference.payWith === 'euro' && euroPreference.storedPayWith === 'euro' &&
      euroPreference.euroPressed === 'true' && euroPreference.sharePressed === 'false',
    'the visible Fund toggle records, persists and communicates the preferred payment source',
    euroPreference
  );
  const euroBefore = await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    return { shares: app.state.shares, budget: app.state.budget, placed: app.state.placed.length, expected: app.effectivePrice('compost', app.state).price };
  });
  await placeType('compost', 40, 68, 'auto');
  const euroPayment = await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    const item = app.state.placed.at(-1);
    return { shares: app.state.shares, budget: app.state.budget, placed: app.state.placed.length, paidMethod: item?.paidMethod, paidAmount: item?.paidAmount };
  });
  check(
    euroPayment.paidMethod === 'buy' && euroPayment.shares === euroBefore.shares &&
      euroPayment.budget === euroBefore.budget - euroBefore.expected && euroPayment.placed === euroBefore.placed + 1,
    'the Fund preference places immediately and spends only the effective euro price',
    { euroBefore, euroPayment }
  );

  await resetApp({ shares: 10, budget: 0, payWith: 'euro', paymentChoice: null });
  await placeType('compost', 44, 66, 'auto');
  const fallbackPayment = await page.evaluate(() => {
    const state = window.__PERMAGARDEN_APP__.state;
    const item = state.placed.at(-1);
    return { paymentChoice: state.paymentChoice, shares: state.shares, budget: state.budget, placed: state.placed.length, paidMethod: item?.paidMethod };
  });
  check(
    fallbackPayment.paymentChoice === null && fallbackPayment.paidMethod === 'barter' &&
      fallbackPayment.shares < 10 && fallbackPayment.budget === 0 && fallbackPayment.placed === 1,
    'an unavailable preferred source falls back to the other valid source instead of blocking play',
    fallbackPayment
  );

  // -----------------------------------------------------------------------
  // Completion: one full cycle earns reflection, flourishing earns export.
  // -----------------------------------------------------------------------
  const firstCycleState = {
    mode: 'guided',
    placed: minimalCycleGarden(),
    journeyMoments: ['soil', 'water', 'food', 'shelter', 'share', 'challenge'],
    gardenEffects: { compost: 1 },
    sharedActs: 1,
    given: 1,
    harvestEver: true,
    seasonTurns: 4,
    discovered: [],
    paymentChoice: null
  };
  await resetApp(firstCycleState);
  const firstCycleCompletion = await page.evaluate(() => window.__PERMAGARDEN_APP__.completionModel());
  check(
    firstCycleCompletion?.firstCycleReady === true && firstCycleCompletion?.flourishingReady === false,
    'the first completed cycle is ready to reflect but is not yet flourishing',
    firstCycleCompletion
  );
  await page.getByTestId('reflection-button').click();
  await settle();
  const firstCycleSummary = await page.evaluate(() => ({
    showSummary: window.__PERMAGARDEN_APP__.state.showSummary,
    certificate: document.querySelector('[data-pg-dialog="summary"]')?.getAttribute('data-certificate'),
    saveButtons: document.querySelectorAll('[data-save-certificate="1"]').length
  }));
  check(
    firstCycleSummary.showSummary && firstCycleSummary.certificate !== '1' && firstCycleSummary.saveButtons === 0,
    'first-cycle reflection does not unlock a learning certificate',
    firstCycleSummary
  );

  const allGuildKeys = await page.evaluate(() => window.__PERMAGARDEN_APP__.guildDefs.map(def => def.key));
  const flourishingState = {
    mode: 'guided',
    placed: flourishingGarden(),
    journeyMoments: ['soil', 'water', 'food', 'shelter', 'share', 'challenge'],
    gardenEffects: {
      compost: 1, mulch: 1, hugel: 1, rain: 1, kitchen: 1,
      ladybug: 1, bee: 1, shelter: 1, seeds: 1
    },
    sharedActs: 3,
    given: 6,
    harvestEver: true,
    seasonTurns: 8,
    discovered: allGuildKeys,
    gatesPlayed: { compost: true, rain: true, bee: true },
    paymentChoice: null,
    showSummary: false
  };
  await resetApp(flourishingState);
  const flourishingCompletion = await page.evaluate(() => window.__PERMAGARDEN_APP__.completionModel());
  check(
    flourishingCompletion?.firstCycleReady === true && flourishingCompletion?.flourishingReady === true,
    'a mature connected garden reaches the flourishing completion state',
    flourishingCompletion
  );
  await page.getByTestId('reflection-button').click();
  await settle();
  const flourishingSummary = await page.evaluate(() => ({
    showSummary: window.__PERMAGARDEN_APP__.state.showSummary,
    certificate: document.querySelector('[data-pg-dialog="summary"]')?.getAttribute('data-certificate'),
    saveButtons: document.querySelectorAll('[data-save-certificate="1"]').length
  }));
  check(
    flourishingSummary.showSummary && flourishingSummary.certificate === '1' && flourishingSummary.saveButtons === 1,
    'only the flourishing state unlocks the certificate export',
    flourishingSummary
  );

  // -----------------------------------------------------------------------
  // Score integrity: guild history cannot stand in for a current relationship.
  // -----------------------------------------------------------------------
  const guildScoreEvidence = await page.evaluate(({ basePlaced, history, activePair }) => {
    const app = window.__PERMAGARDEN_APP__;
    const base = { ...app.state, placed: basePlaced, discovered: history };
    const historyOnly = app.certificateStats(base);
    const noHistory = app.certificateStats({ ...base, discovered: [] });
    const active = app.certificateStats({
      ...base,
      placed: [...basePlaced, ...activePair],
      discovered: []
    });
    return {
      activeKeysWithoutPair: app.activeGuilds(basePlaced).map(guild => guild.key),
      activeKeysWithPair: app.activeGuilds([...basePlaced, ...activePair]).map(guild => guild.key),
      historyOnly,
      noHistory,
      active
    };
  }, {
    basePlaced: minimalCycleGarden(),
    history: allGuildKeys,
    activePair: [
      { id: 'score-bench', type: 'bench', x: 48, y: 48, paidMethod: 'buy', paidAmount: 80, placedTurn: 0 },
      { id: 'score-sign', type: 'sign', x: 50, y: 49, paidMethod: 'buy', paidAmount: 15, placedTurn: 0 }
    ]
  });
  check(
    guildScoreEvidence.activeKeysWithoutPair.length === 0 &&
      guildScoreEvidence.historyOnly.guilds === 0 &&
      guildScoreEvidence.historyOnly.score === guildScoreEvidence.noHistory.score,
    'certificate guild count and score ignore inactive historical discoveries',
    guildScoreEvidence
  );
  check(
    guildScoreEvidence.activeKeysWithPair.length === 1 && guildScoreEvidence.active.guilds === 1 &&
      guildScoreEvidence.active.score > guildScoreEvidence.noHistory.score,
    'certificate guild count and score respond to a currently active guild',
    guildScoreEvidence
  );

  // -----------------------------------------------------------------------
  // Reciprocity: force the random branch and prove it is sharing-gated.
  // -----------------------------------------------------------------------
  await resetApp({
    mode: 'guided',
    shares: 0,
    budget: 300,
    market: [],
    sharedActs: 0,
    paymentChoice: null
  });
  await page.evaluate(() => { Math.random = () => 0; });
  const lockedReciprocity = await page.evaluate(() => window.__PERMAGARDEN_APP__.reciprocityUnlocked());
  await placeType('rain', 30, 70, 'auto');
  const beforeFirstShare = await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    return {
      unlocked: app.reciprocityUnlocked(),
      sharedActs: app.state.sharedActs,
      market: app.state.market,
      placedTypes: app.state.placed.map(item => item.type),
      budget: app.state.budget
    };
  });
  check(
    lockedReciprocity === false && beforeFirstShare.unlocked === false &&
      beforeFirstShare.sharedActs === 0 && beforeFirstShare.placedTypes.includes('rain') &&
      beforeFirstShare.market.length === 0,
    'forced random reciprocity cannot fire before the first genuine share',
    beforeFirstShare
  );

  await patchState({ sharedActs: 1, market: [] });
  const afterFirstShare = await page.evaluate(async () => {
    const app = window.__PERMAGARDEN_APP__;
    const unlocked = app.reciprocityUnlocked();
    app.maybeGift();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      unlocked,
      sharedActs: app.state.sharedActs,
      market: app.state.market
    };
  });
  check(
    afterFirstShare.unlocked === true && afterFirstShare.market.length > 0,
    'reciprocity becomes available after a genuine share instead of being disabled globally',
    afterFirstShare
  );

  // -----------------------------------------------------------------------
  // Community table: contribution gates taking, offers never mint currency
  // on discovery, taking consumes the pool, and manual checks cannot be spammed.
  // -----------------------------------------------------------------------
  await resetApp({
    mode: 'explore', sharedActs: 0, pool: 65, market: [
      { id: 'locked-offer', kind: 'item', type: 'mulch', person: 'Malik', text: 'Fresh grass clippings' }
    ]
  });
  const lockedTake = await page.evaluate(async () => {
    const app = window.__PERMAGARDEN_APP__;
    const before = { market: app.state.market.length, pool: app.state.pool, placed: app.state.placed.length };
    app.takeOffering('locked-offer');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      before,
      after: { market: app.state.market.length, pool: app.state.pool, placed: app.state.placed.length },
      message: app.state.toast
    };
  });
  check(
    JSON.stringify(lockedTake.before) === JSON.stringify(lockedTake.after) && /contribute one genuine/i.test(lockedTake.message || ''),
    'visible opening offers cannot be taken before the first genuine contribution',
    lockedTake
  );

  await resetApp({ mode: 'explore', sharedActs: 1, pool: 65, shares: 4, budget: 100, market: [], lastCommunityCheck: null });
  const queuedCurrency = await page.evaluate(async () => {
    const app = window.__PERMAGARDEN_APP__;
    const originalPool = app.giftPool;
    app.giftPool = [{ kind: 'shares', person: 'Léa', value: 2, text: 'Work-day acknowledgement (+2 shares)' }];
    app.addGiftToMarket();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    app.giftPool = originalPool;
    return { shares: app.state.shares, budget: app.state.budget, market: app.state.market };
  });
  check(
    queuedCurrency.shares === 4 && queuedCurrency.budget === 100 &&
      queuedCurrency.market.length === 1 && queuedCurrency.market[0].kind === 'shares',
    'discovering a currency offer puts it on the table instead of crediting it immediately',
    queuedCurrency
  );
  const consumedCurrency = await page.evaluate(async () => {
    const app = window.__PERMAGARDEN_APP__;
    const offer = app.state.market[0];
    const cost = app.offeringPoolCost(offer);
    app.takeOffering(offer.id);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { cost, shares: app.state.shares, pool: app.state.pool, market: app.state.market.length };
  });
  check(
    consumedCurrency.shares === 6 && consumedCurrency.pool === 65 - consumedCurrency.cost && consumedCurrency.market === 0,
    'taking a currency offer is explicit and consumes the shared pool',
    consumedCurrency
  );

  await resetApp({ mode: 'explore', sharedActs: 1, seasonTurns: 2, pool: 65, market: [], lastCommunityCheck: null });
  const repeatCheck = await page.evaluate(async () => {
    const app = window.__PERMAGARDEN_APP__;
    Math.random = () => 0;
    app.onSeeSharing();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const first = { market: app.state.market.length, shares: app.state.shares, budget: app.state.budget, check: app.state.lastCommunityCheck };
    app.onSeeSharing();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    app.persist();
    const second = { market: app.state.market.length, shares: app.state.shares, budget: app.state.budget, check: app.state.lastCommunityCheck, savedCheck: JSON.parse(localStorage.getItem(app.STORE)).lastCommunityCheck, message: app.state.toast };
    return { first, second };
  });
  check(
    repeatCheck.first.market === 1 && repeatCheck.second.market === 1 &&
      repeatCheck.first.shares === repeatCheck.second.shares && repeatCheck.first.budget === repeatCheck.second.budget &&
      repeatCheck.first.check === '2:1' && repeatCheck.second.savedCheck === '2:1' && /already checked/i.test(repeatCheck.second.message || ''),
    'one contribution-season key permits only one persisted manual reciprocity check',
    repeatCheck
  );

  check(
    browserErrors.length === 0,
    'v70 economy regression records no browser, console, or same-origin HTTP errors',
    browserErrors
  );
  console.log('V70 ECONOMY REGRESSION COMPLETE');
} finally {
  await context.close();
  await browser.close();
}
