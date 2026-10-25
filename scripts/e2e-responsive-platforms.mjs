import { chromium } from './load-playwright.mjs';

const baseUrl = process.env.GAME_URL || 'http://127.0.0.1:8787/';
const storeKey = 'permagarden_v2';
const ratioTolerance = 0.02;

const viewportGroups = {
  desktop: [
    { width: 1180, height: 800 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 }
  ],
  tablet: [
    { width: 768, height: 1024 },
    { width: 820, height: 1180 },
    { width: 1024, height: 768 },
    { width: 1179, height: 900 }
  ],
  phone: [
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 844, height: 390 }
  ]
};

const allViewports = Object.entries(viewportGroups).flatMap(([mode, viewports]) =>
  viewports.map(viewport => ({ ...viewport, mode }))
);

const check = (condition, message, evidence) => {
  if (!condition) {
    const detail = evidence === undefined ? '' : '\nEvidence: ' + JSON.stringify(evidence, null, 2);
    throw new Error(message + detail);
  }
  console.log('PASS  ' + message);
};

const savedState = {
  placed: [{ id: 'responsive-bench', type: 'bench', x: 50, y: 62, placedAtTurn: 0 }],
  shares: 7,
  budget: 271,
  pool: 65,
  goodwill: 0,
  given: 0,
  awarded: [],
  market: [],
  lastCommunityCheck: null,
  storySeen: true,
  introSeen: true,
  mode: 'explore',
  journeyMoments: [],
  gardenEffects: {},
  lastChallengeKey: null,
  gardenReflectionsSeen: [],
  acknowledgedGardenReflectionsV2: [],
  pendingGardenReflections: [],
  pendingGardenWhispers: [],
  pendingGuildCards: [],
  pendingArrivals: [],
  livingLessonExperiment: null,
  livingLessonHistory: [],
  communityMemory: [],
  reflectionOpened: false,
  reflectionNote: '',
  endingSeen: false,
  discovered: [],
  guildVoicePlayed: false,
  seenWildlife: [],
  sharedActs: 0,
  rewardedGiftTypes: [],
  seasonTurns: 0,
  seedAllowance: {}, unlocksSeen: ['sharing', 'seedbank', 'kitchen', 'seedsaved'],
  grownHarvests: 0,
  preservedCount: 0,
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
  returnQueue: [],
  basket: {},
  materials: {},
  harvestEver: false,
  gatesPlayed: {},
  guests: [],
  visitsDone: {},
  visitSeason: null,
  pendingVisit: null,
  lastSystemChange: null,
  payWith: 'shares',
  residentBeatsSeen: [],
  residentSeasons: {},
  residentWinters: {},
  _n: 1,
  _g: 0
};

const browser = await chromium.launch({ headless: true });
const origin = new URL(baseUrl).origin;
const context = await browser.newContext({
  viewport: viewportGroups.desktop[0],
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
const browserErrors = [];

page.on('pageerror', error => browserErrors.push('pageerror: ' + error.message));
page.on('console', message => {
  if (message.type() === 'error') browserErrors.push('console: ' + message.text());
});

const twoFrames = () =>
  page.evaluate(() => new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  ));

const waitForApp = async () => {
  await page.waitForSelector('.pg-game-shell', { state: 'visible', timeout: 20000 });
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 20000 });
  await page.waitForFunction(() => {
    const root = document.querySelector('.pg-game-shell');
    return root &&
      root.hasAttribute('data-viewport') &&
      document.querySelector('[data-plot]') &&
      document.querySelectorAll('[data-adaptive-pane]').length === 4 &&
      document.querySelector('.pg-adaptive-nav') &&
      document.querySelector('.pg-game-header');
  }, null, { timeout: 20000 });
  await twoFrames();
};

const waitForViewportMode = async expected => {
  await page.waitForFunction(mode => {
    const root = document.querySelector('.pg-game-shell');
    return root?.getAttribute('data-viewport') === mode;
  }, expected, { timeout: 5000 });
  await twoFrames();
};

const visiblePaneKeys = () => page.locator('[data-adaptive-pane]').evaluateAll(
  elements => elements
    .filter(element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number.parseFloat(style.opacity || '1') > 0 &&
        rect.width > 0.5 &&
        rect.height > 0.5 &&
        !element.closest('[hidden],[aria-hidden="true"],[inert]');
    })
    .map(element => element.getAttribute('data-adaptive-pane'))
);

const rootLayoutState = () => page.locator('.pg-game-shell').evaluate(root => ({
  viewport: root.getAttribute('data-viewport'),
  phonePane: root.getAttribute('data-phone-pane'),
  tabletPane: root.getAttribute('data-tablet-pane')
}));

const appProgressSnapshot = () => page.evaluate(() => {
  const state = window.__PERMAGARDEN_APP__.state;
  const copy = value => JSON.parse(JSON.stringify(value));
  return {
    placed: copy(state.placed || []),
    shares: state.shares,
    budget: state.budget,
    pool: state.pool,
    given: state.given,
    season: state.season,
    seasonTurns: state.seasonTurns,
    journeyMoments: copy(state.journeyMoments || []),
    gardenEffects: copy(state.gardenEffects || {}),
    communityMemory: copy(state.communityMemory || []),
    basket: copy(state.basket || {}),
    materials: copy(state.materials || {}),
    gatesPlayed: copy(state.gatesPlayed || {})
  };
});

const assertNoHorizontalOverflow = async label => {
  const evidence = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    htmlClientWidth: document.documentElement.clientWidth,
    htmlScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth
  }));
  check(
    evidence.htmlScrollWidth <= evidence.viewportWidth + 1 &&
      evidence.bodyScrollWidth <= evidence.viewportWidth + 1,
    `${label}: no global horizontal overflow`,
    evidence
  );
};

const assertPlotRatio = async label => {
  const plot = page.locator('[data-plot]');
  check(await plot.isVisible(), `${label}: the Garden plot is visible before its ratio is measured`);
  const rect = await plot.evaluate(element => {
    const box = element.getBoundingClientRect();
    return { width: box.width, height: box.height, ratio: box.height ? box.width / box.height : 0 };
  });
  check(
    rect.width > 0 && rect.height > 0 && Math.abs(rect.ratio - 1.4) <= ratioTolerance,
    `${label}: the visible plot preserves its 7:5 geometry`,
    { ...rect, expected: 1.4, tolerance: ratioTolerance }
  );
};

const visibleTargets = selector => page.locator(selector).evaluateAll(elements =>
  elements
    .filter(element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number.parseFloat(style.opacity || '1') > 0 &&
        rect.width > 0.5 &&
        rect.height > 0.5 &&
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.top < window.innerHeight &&
        !element.disabled &&
        !element.closest('[hidden],[aria-hidden="true"],[inert]');
    })
    .map(element => {
      const rect = element.getBoundingClientRect();
      return {
        label: element.getAttribute('aria-label') || element.textContent.trim().replace(/\s+/g, ' ').slice(0, 90),
        width: rect.width,
        height: rect.height
      };
    })
);

const assertTouchTargets = async label => {
  const navTargets = await visibleTargets('.pg-adaptive-nav button:not([disabled])');
  const headerTargets = await visibleTargets('.pg-game-header button:not([disabled]), .pg-game-header a[href]');
  const tooSmall = [...navTargets, ...headerTargets].filter(target =>
    target.width < 43.5 || target.height < 43.5
  );
  check(navTargets.length > 0, `${label}: adaptive navigation exposes visible controls`, navTargets);
  check(headerTargets.length > 0, `${label}: the header exposes visible controls`, headerTargets);
  check(
    tooSmall.length === 0,
    `${label}: all visible navigation and header targets are at least 44 by 44 CSS pixels`,
    { tooSmall, navTargets, headerTargets }
  );
};

const assertDesktopLayout = async label => {
  const nav = page.locator('.pg-adaptive-nav');
  check(!(await nav.isVisible()), `${label}: adaptive navigation stays hidden on desktop`);

  const visibleColumns = await page.locator(
    'main.pg-game-main > .pg-build-pane, main.pg-game-main > .pg-game-center, main.pg-game-main > .pg-learn-pane'
  ).evaluateAll(elements => elements.filter(element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0.5 && rect.height > 0.5;
  }).length);
  check(visibleColumns === 3, `${label}: exactly three desktop main surfaces remain visible`, { visibleColumns });
};

const assertTabletLayout = async label => {
  const nav = page.locator('.pg-adaptive-nav');
  check(await nav.isVisible(), `${label}: adaptive navigation is visible on tablet`);
  const [root, panes] = await Promise.all([rootLayoutState(), visiblePaneKeys()]);
  const sidePanes = panes.filter(key => key !== 'garden');
  check(
    panes.includes('garden') &&
      sidePanes.length === 1 &&
      sidePanes[0] === root.tabletPane &&
      panes.length === 2,
    `${label}: tablet shows Garden and exactly one selected side panel`,
    { root, panes }
  );
};

const assertPhoneLayout = async label => {
  const nav = page.locator('.pg-adaptive-nav');
  check(await nav.isVisible(), `${label}: adaptive navigation is visible on phone`);
  const [root, panes] = await Promise.all([rootLayoutState(), visiblePaneKeys()]);
  check(
    panes.length === 1 && panes[0] === root.phonePane,
    `${label}: phone shows exactly one selected game panel`,
    { root, panes }
  );
};

const activateNavPane = async (mode, key, label) => {
  const nav = page.locator('.pg-adaptive-nav');
  const button = nav.locator(`[aria-controls="pg-pane-${key}"]`);
  check(await button.count() === 1, `${label}: ${key} has exactly one navigation control`);
  check(await button.isVisible(), `${label}: ${key} navigation control is visible`);
  await button.click();
  const attribute = mode === 'tablet' ? 'data-tablet-pane' : 'data-phone-pane';
  await page.waitForFunction(({ attributeName, expected }) =>
    document.querySelector('.pg-game-shell')?.getAttribute(attributeName) === expected,
  { attributeName: attribute, expected: key }, { timeout: 3000 });
  await twoFrames();
  check(
    await button.getAttribute('aria-pressed') === 'true',
    `${label}: ${key} navigation control exposes its selected state`
  );
  if (mode === 'tablet') await assertTabletLayout(`${label} after selecting ${key}`);
  else await assertPhoneLayout(`${label} after selecting ${key}`);
  await assertNoHorizontalOverflow(`${label} after selecting ${key}`);
};

const auditViewport = async viewport => {
  const label = `${viewport.mode} ${viewport.width}x${viewport.height}`;
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await waitForViewportMode(viewport.mode);

  const root = await rootLayoutState();
  check(root.viewport === viewport.mode, `${label}: root publishes the correct viewport mode`, root);
  await assertNoHorizontalOverflow(label);

  if (viewport.mode === 'desktop') {
    await assertDesktopLayout(label);
  } else if (viewport.mode === 'tablet') {
    await assertTabletLayout(label);
    await assertTouchTargets(label);
  } else {
    await assertPhoneLayout(label);
    await assertTouchTargets(label);
  }

  const visiblePanes = await visiblePaneKeys();
  // Desktop is the locked visual reference and intentionally keeps its
  // existing flexible plot geometry. The new 7:5 invariant applies only to
  // the adaptive tablet/phone frame where tap coordinates need consistency.
  if (viewport.mode !== 'desktop' && visiblePanes.includes('garden')) {
    await assertPlotRatio(label);
  }
};

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await waitForApp();

  const storyState = await page.evaluate(() => {
    const state = window.__PERMAGARDEN_APP__.state;
    return {
      story: state.story,
      intro: state.intro,
      storySeen: state.storySeen,
      introSeen: state.introSeen
    };
  });
  check(
    storyState.story === false &&
      storyState.intro === false &&
      storyState.storySeen === true &&
      storyState.introSeen === true,
    'seeded localStorage starts directly in the playable garden',
    storyState
  );

  const progressBeforeResize = await appProgressSnapshot();

  for (const viewport of allViewports) await auditViewport(viewport);

  await page.setViewportSize({ width: 820, height: 1180 });
  await waitForViewportMode('tablet');
  for (const key of ['build', 'community', 'learn']) {
    await activateNavPane('tablet', key, 'tablet 820x1180');
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await waitForViewportMode('phone');
  for (const key of ['garden', 'build', 'community', 'learn', 'garden']) {
    await activateNavPane('phone', key, 'phone 390x844');
    if (key === 'garden') await assertPlotRatio('phone 390x844 after selecting Garden');
  }

  await page.setViewportSize({ width: 320, height: 568 });
  await waitForViewportMode('phone');
  await page.getByRole('button', { name: 'Open garden menu' }).click();
  const compactMenu = await page.getByRole('menu', { name: 'Garden menu' }).evaluate(menu => {
    const rect = menu.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + Math.min(12, rect.width / 2), rect.top + Math.min(12, rect.height / 2));
    const buttons = Array.from(menu.querySelectorAll('button')).map(button => {
      const box = button.getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
    return {
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      viewport: { width: innerWidth, height: innerHeight },
      hitInsideMenu: Boolean(hit && hit.closest('[role="menu"]') === menu),
      buttons
    };
  });
  check(
    compactMenu.rect.left >= 0 &&
      compactMenu.rect.top >= 0 &&
      compactMenu.rect.right <= compactMenu.viewport.width &&
      compactMenu.rect.bottom <= compactMenu.viewport.height &&
      compactMenu.hitInsideMenu,
    'phone 320x568: the compact menu is fully visible above the game surface',
    compactMenu
  );
  check(
    compactMenu.buttons.length === 4 &&
      compactMenu.buttons.every(button => button.width >= 44 && button.height >= 44),
    'phone 320x568: every compact-menu action has a 44px touch target',
    compactMenu.buttons
  );
  await page.keyboard.press('Escape');

  const progressAfterResize = await appProgressSnapshot();
  check(
    JSON.stringify(progressAfterResize) === JSON.stringify(progressBeforeResize),
    'viewport changes and responsive navigation preserve the complete game progress snapshot',
    { before: progressBeforeResize, after: progressAfterResize }
  );

  // Small phones up to 2x density draw the stage art under ~1000 device pixels, so they
  // get the 960px copy; denser phones keep the full image. CSS and the summary mini-map
  // (phoneArtQuery) must agree on which one a device uses.
  for (const [viewport, deviceScaleFactor, smallArt] of [
    [{ width: 360, height: 800 }, 2, true],
    [{ width: 390, height: 844 }, 3, false]
  ]) {
    const artContext = await browser.newContext({
      viewport,
      deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce',
      storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: storeKey, value: JSON.stringify(savedState) }] }] }
    });
    try {
      const artPage = await artContext.newPage();
      await artPage.goto(baseUrl, { waitUntil: 'load' });
      await artPage.waitForSelector('[data-plot]', { state: 'visible', timeout: 20000 });
      const art = await artPage.evaluate(() => ({
        backgroundImage: getComputedStyle(document.querySelector('[data-plot]')).backgroundImage,
        phoneArtQuery: window.matchMedia(window.__PERMAGARDEN_APP__.phoneArtQuery).matches
      }));
      const label = `phone ${viewport.width}x${viewport.height} at ${deviceScaleFactor}x`;
      check(
        (smallArt ? /garden-growing-960\.webp/ : /garden-growing\.webp/).test(art.backgroundImage) && art.phoneArtQuery === smallArt,
        `${label}: the plot uses the ${smallArt ? '960px' : 'full-size'} stage art and the summary agrees`,
        art
      );
    } finally {
      await artContext.close();
    }
  }

  check(
    browserErrors.length === 0,
    'responsive platform audit records no console or runtime errors',
    browserErrors
  );
  console.log(`RESPONSIVE PLATFORM AUDIT COMPLETE  ${baseUrl}`);
} finally {
  await context.close();
  await browser.close();
}
