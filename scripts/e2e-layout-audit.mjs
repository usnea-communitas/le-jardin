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
const viewports = [
  { width: 1180, height: 800 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 }
];

const check = (condition, message, evidence) => {
  if (!condition) {
    const detail = evidence === undefined ? '' : '\nEvidence: ' + JSON.stringify(evidence, null, 2);
    throw new Error(message + detail);
  }
  console.log('PASS  ' + message);
};

const savedState = {
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
  visitsDone: {}
};

const browser = await chromium.launch({ headless: true });
const origin = new URL(baseUrl).origin;
const context = await browser.newContext({
  viewport: viewports[0],
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

const waitForApp = async () => {
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 15000 });
  await page.waitForFunction(() =>
    document.querySelector('.pg-game-shell')?.getAttribute('data-viewport') === 'desktop' &&
    document.querySelectorAll('main.pg-game-main > .pg-game-sidebar, main.pg-game-main > .pg-game-center').length === 3
  );
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};

const setAppState = async patch => {
  await page.evaluate(async next => {
    const app = window.__PERMAGARDEN_APP__;
    await new Promise(resolve => app.setState({ ...app.state, ...next }, resolve));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, patch);
};

const isFullyInside = (inner, outer, tolerance = 1) =>
  inner.left >= outer.left - tolerance &&
  inner.top >= outer.top - tolerance &&
  inner.right <= outer.right + tolerance &&
  inner.bottom <= outer.bottom + tolerance;

const intersection = (a, b) => {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return { width, height, area: width * height };
};

const rectOf = locator => locator.evaluate(element => {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height
  };
});

const ensureReachable = async (target, sidebar, label, viewportLabel) => {
  await target.evaluate(element => element.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const [targetRect, sidebarRect] = await Promise.all([rectOf(target), rectOf(sidebar)]);
  const visible = intersection(targetRect, sidebarRect);
  const canFit = targetRect.height <= sidebarRect.height + 1;
  check(
    visible.width >= targetRect.width - 2 &&
      visible.height >= Math.min(targetRect.height, sidebarRect.height) - 2 &&
      (!canFit || isFullyInside(targetRect, sidebarRect, 1.5)),
    `${viewportLabel}: ${label} is reachable within its scrolling sidebar`,
    { targetRect, sidebarRect, visible }
  );
};

const auditLayout = async viewport => {
  const viewportLabel = `${viewport.width}x${viewport.height}`;
  await page.setViewportSize(viewport);
  await page.evaluate(() => {
    document.querySelectorAll('.pg-game-sidebar').forEach(sidebar => { sidebar.scrollTop = 0; });
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const overflow = await page.evaluate(() => ({
    innerWidth,
    htmlClientWidth: document.documentElement.clientWidth,
    htmlScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth
  }));
  check(
    overflow.htmlScrollWidth <= overflow.innerWidth + 1 &&
      overflow.bodyScrollWidth <= overflow.innerWidth + 1,
    `${viewportLabel}: the page has no horizontal overflow`,
    overflow
  );

  const main = page.locator('main.pg-game-main');
  const columns = main.locator(':scope > .pg-game-sidebar, :scope > .pg-game-center');
  check(await columns.count() === 3, `${viewportLabel}: exactly three main columns render`);
  const columnRects = await columns.evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    };
  }));
  const ordered = columnRects.every((rect, index) => index === 0 || columnRects[index - 1].right <= rect.left + 0.75);
  const pairwiseIntersections = [
    intersection(columnRects[0], columnRects[1]),
    intersection(columnRects[0], columnRects[2]),
    intersection(columnRects[1], columnRects[2])
  ];
  check(
    ordered &&
      columnRects.every(rect => rect.width > 0 && rect.height > 0) &&
      pairwiseIntersections.every(value => value.area <= 0.5),
    `${viewportLabel}: the three columns are ordered and do not overlap`,
    { columnRects, pairwiseIntersections }
  );

  const plot = page.locator('#pg-garden-plot');
  const fixedGate = plot.locator('.pg-fixed-gate');
  const emptyPrompt = plot.locator('.pg-empty-garden');
  check(await fixedGate.count() === 1, `${viewportLabel}: the fixed entrance gate has a stable selector`);
  check(await emptyPrompt.count() === 1, `${viewportLabel}: the empty-garden prompt is present`);
  const [plotRect, gateRect, promptRect] = await Promise.all([
    rectOf(plot),
    rectOf(fixedGate),
    rectOf(emptyPrompt)
  ]);
  const promptGateOverlap = intersection(promptRect, gateRect);
  check(
    isFullyInside(promptRect, plotRect, 1) && isFullyInside(gateRect, plotRect, 5),
    `${viewportLabel}: the entrance gate and empty prompt stay inside the plot`,
    { plotRect, gateRect, promptRect }
  );
  check(
    promptGateOverlap.area <= 0.5,
    `${viewportLabel}: the empty prompt does not cover the entrance gate`,
    promptGateOverlap
  );

  if (viewport.width === 1180) {
    const titleEvidence = await page.locator('.pg-map-title').evaluate(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const lineTops = Array.from(range.getClientRects())
        .filter(rect => rect.width > 0 && rect.height > 0)
        .map(rect => Math.round(rect.top * 2) / 2);
      return {
        lines: new Set(lineTops).size,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        text: element.textContent.trim()
      };
    });
    check(
      titleEvidence.lines === 1 && titleEvidence.scrollWidth <= titleEvidence.clientWidth + 1,
      '1180x800: the garden map title remains on one line',
      titleEvidence
    );

    const toolbarIntersections = await page.locator('.pg-map-toolbar').evaluate(toolbar => {
      const children = Array.from(toolbar.children).filter(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      });
      const boxes = children.map(element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, text: element.textContent.trim().slice(0, 80) };
      });
      const overlaps = [];
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const width = Math.max(0, Math.min(boxes[i].right, boxes[j].right) - Math.max(boxes[i].left, boxes[j].left));
          const height = Math.max(0, Math.min(boxes[i].bottom, boxes[j].bottom) - Math.max(boxes[i].top, boxes[j].top));
          if (width * height > 0.5) overlaps.push({ first: boxes[i], second: boxes[j], width, height });
        }
      }
      return { boxes, overlaps };
    });
    check(
      toolbarIntersections.overlaps.length === 0,
      '1180x800: visible map-toolbar controls do not collide',
      toolbarIntersections
    );
  }

  const sidebars = page.locator('main.pg-game-main > .pg-game-sidebar');
  const leftSidebar = sidebars.nth(0);
  const rightSidebar = sidebars.nth(1);
  const reflectionButton = page.getByTestId('reflection-button');
  const wildlifePanel = page.locator('.pg-wildlife-panel');
  check(await wildlifePanel.count() === 1, `${viewportLabel}: the wildlife panel has a stable selector`);
  await ensureReachable(reflectionButton, rightSidebar, 'the reflection action', viewportLabel);
  await ensureReachable(wildlifePanel, rightSidebar, 'the complete wildlife panel', viewportLabel);
  await ensureReachable(page.locator('.pg-footer-note'), leftSidebar, 'the palette footer', viewportLabel);

  await page.evaluate(() => {
    document.querySelectorAll('.pg-game-sidebar').forEach(sidebar => { sidebar.scrollTop = 0; });
  });
  check(
    browserErrors.length === 0,
    `${viewportLabel}: no browser console or runtime errors were recorded`,
    browserErrors
  );
};

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await waitForApp();

  // The skip link must be the first keyboard stop and must move focus to the plot.
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.keyboard.press('Tab');
  const firstFocus = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    className: document.activeElement?.className,
    text: document.activeElement?.textContent?.trim()
  }));
  check(
    await page.locator('.pg-skip-link').evaluate(element => element === document.activeElement),
    'the skip link is the first keyboard focus target',
    firstFocus
  );
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement?.id === 'pg-garden-plot');
  check(
    await page.locator('#pg-garden-plot').evaluate(element => element === document.activeElement),
    'activating the skip link focuses the garden plot'
  );

  const h1Evidence = await page.locator('h1').evaluateAll(elements => elements.map(element => ({
    text: element.textContent.trim(),
    visible: Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
  })));
  check(
    h1Evidence.length === 1 && h1Evidence[0].visible,
    'the game view exposes exactly one visible h1',
    h1Evidence
  );

  for (const viewport of viewports) await auditLayout(viewport);

  // Exercise the Seed Bank's compound control, which previously nested buttons.
  await setAppState({
    placed: [{ id: 'a11y-seedbank', type: 'seedbank', x: 42, y: 56 }],
    selectedPlacedId: 'a11y-seedbank',
    selectedType: 'seedbank',
    seedMenuId: 'a11y-seedbank'
  });
  const nestedInteractive = await page.evaluate(() => {
    const outerSelector = 'button, a[href], input, select, textarea, [role="button"]';
    const innerSelector = 'button, a[href], input, select, textarea, [role="button"]';
    return Array.from(document.querySelectorAll(outerSelector)).flatMap(outer =>
      Array.from(outer.querySelectorAll(innerSelector)).map(inner => ({
        outer: outer.outerHTML.slice(0, 240),
        inner: inner.outerHTML.slice(0, 240)
      }))
    );
  });
  check(
    nestedInteractive.length === 0,
    'interactive controls are never nested inside other interactive controls',
    nestedInteractive
  );

  // Open the playing story state without starting audio/timers and audit its chapter targets.
  await setAppState({
    story: true,
    storySeen: true,
    storyStarted: true,
    storyScene: 0,
    storyPaused: true,
    storyLeaving: false,
    intro: false
  });
  await page.locator('.pg-story-dots').waitFor({ state: 'visible' });
  const storyDotTargets = await page.locator('.pg-story-dot').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return {
      label: element.getAttribute('aria-label'),
      width: rect.width,
      height: rect.height
    };
  }));
  check(
    storyDotTargets.length === 7 && storyDotTargets.every(target => target.width >= 24 && target.height >= 24),
    'all seven story chapter dots provide at least a 24 by 24 pixel target',
    storyDotTargets
  );

  check(browserErrors.length === 0, 'the complete layout and accessibility audit recorded no browser errors', browserErrors);
  console.log('LAYOUT AND ACCESSIBILITY AUDIT COMPLETE');
} finally {
  await context.close();
  await browser.close();
}
