import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readdir } from 'node:fs/promises';

const moduleRoot = process.env.CODEX_NODE_MODULES;
let playwright;
if (moduleRoot) {
  try {
    playwright = await import(pathToFileURL(path.join(moduleRoot, 'playwright', 'index.mjs')).href);
  } catch (_) {
    const pnpmRoot = path.join(moduleRoot, '.pnpm');
    const packageDir = (await readdir(pnpmRoot)).find(name => /^playwright@[^-]/.test(name));
    if (!packageDir) throw new Error('Playwright package was not found in ' + moduleRoot);
    playwright = await import(
      pathToFileURL(path.join(pnpmRoot, packageDir, 'node_modules', 'playwright', 'index.mjs')).href
    );
  }
} else {
  playwright = await import('playwright');
}

const { chromium } = playwright;
const baseUrl = process.env.GAME_URL || 'http://127.0.0.1:8787/';
const parsedUrl = new URL(baseUrl);
if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsedUrl.hostname)) {
  throw new Error(
    'This audit requires a localhost GAME_URL because it uses window.__PERMAGARDEN_APP__. ' +
    `Received ${baseUrl}`
  );
}

const BOOK_TABS = [
  { key: 'elements', label: 'Elements', entries: 21, leaves: 22, spreads: 11 },
  { key: 'wildlife', label: 'Who may visit', entries: 10, leaves: 11, spreads: 6 },
  { key: 'guilds', label: 'Connections', entries: 8, leaves: 9, spreads: 5 },
  { key: 'principles', label: 'Principles', entries: 11, leaves: 12, spreads: 6 },
  { key: 'balance', label: 'Balance', entries: 4, leaves: 5, spreads: 3 },
  { key: 'keeping', label: 'Keeping', entries: 6, leaves: 7, spreads: 4 }
];

const GATES = [
  ['mulch', 'Summer'],
  ['compost', 'Spring'],
  ['hugel', 'Spring'],
  ['rain', 'Summer'],
  ['kitchen', 'Autumn'],
  ['ladybug', 'Summer'],
  ['bee', 'Spring'],
  ['shelter', 'Winter'],
  ['pexeso', 'Autumn'],
  ['seeds', 'Autumn'],
  ['quiz', 'Winter']
];

const GATE_VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 }
];

const check = (condition, message, evidence) => {
  if (!condition) {
    const detail = evidence === undefined ? '' : '\nEvidence: ' + JSON.stringify(evidence, null, 2);
    throw new Error(message + detail);
  }
  console.log('PASS  ' + message);
};

const sameStrings = (actual, expected) => {
  const a = [...actual].sort((x, y) => x.localeCompare(y));
  const b = [...expected].sort((x, y) => x.localeCompare(y));
  return JSON.stringify(a) === JSON.stringify(b);
};

const waitForApp = async page => {
  await page.waitForFunction(
    () => !!window.__PERMAGARDEN_APP__,
    null,
    { timeout: 15000 }
  );
};

const settle = async page => {
  await page.waitForTimeout(35);
};

const quietGame = async page => {
  await page.evaluate(() => new Promise(resolve => {
    const app = window.__PERMAGARDEN_APP__;
    app.clearStoryTimer?.();
    app.stopAllAudio?.();
    app.setState({
      story: false,
      storySeen: true,
      storyStarted: false,
      storyLeaving: false,
      storyToIntro: false,
      intro: false,
      introSeen: true,
      gardenCinematic: null,
      gardenReflection: null,
      residentStory: null,
      livingLesson: null,
      showSummary: false,
      paymentChoice: null,
      guildCard: null,
      guildCardQueue: [],
      showGuilds: false,
      visit: null,
      inspectCritter: null,
      arrivalQueue: [],
      returnQueue: [],
      gardenWhisper: null,
      gardenWhisperQueue: [],
      gardenWhisperReplay: null,
      bookOpen: false,
      gate: null,
      toast: null,
      muted: true,
      headerMenuOpen: false
    }, resolve);
  }));
};

const makePage = async (browser, viewport, label) => {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    hasTouch: viewport.width < 1100,
    isMobile: viewport.width < 768,
    reducedMotion: 'reduce'
  });
  await context.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push('pageerror: ' + error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push('console: ' + message.text());
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await waitForApp(page);
  await quietGame(page);
  check(
    (await page.locator('body').innerText()).trim().length > 0,
    `${label}: the game renders meaningful page content`
  );
  return { context, page, errors };
};

const openBook = async page => {
  await page.evaluate(() => window.__PERMAGARDEN_APP__.openBook());
  await page.locator('[data-pg-dialog="book"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__.state.bookOpen === true);
};

const visibleBookSurface = async page => page.evaluate(() => {
  const visible = element => {
    if (!element) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number(style.opacity || 1) !== 0 &&
      rect.width > 0 &&
      rect.height > 0
    );
  };
  const book = document.querySelector('.pg-book');
  const pages = Array.from(document.querySelectorAll('.pg-book .pg-pg')).filter(visible);
  const spines = Array.from(document.querySelectorAll('.pg-book .pg-book-spine')).filter(visible);
  return {
    pages: pages.length,
    spines: spines.length,
    names: pages
      .map(page => page.querySelector('.pg-pg-name')?.textContent?.trim() || '')
      .filter(Boolean),
    titlePages: pages.filter(page => page.classList.contains('pg-pg-title')).length,
    horizontalOverflow: book ? Math.max(0, book.scrollWidth - book.clientWidth) : null,
    singleClass: !!document.querySelector('.pg-book-spread.pg-book-single')
  };
});

const auditSinglePageBook = async (page, viewportLabel) => {
  await openBook(page);
  for (const tab of BOOK_TABS) {
    await page.getByRole('tab', { name: tab.label, exact: true }).click();
    await page.waitForFunction(
      key => {
        const app = window.__PERMAGARDEN_APP__;
        return app.state.bookTab === key && app.state.bookLeaf === 0;
      },
      tab.key
    );

    const expected = await page.evaluate(key => {
      const app = window.__PERMAGARDEN_APP__;
      return {
        names: app.bookEntries(key).map(entry => entry.name),
        leaves: app.bookLeafCount(key),
        spreads: app.bookSpreadCount(key),
        single: app.bookUsesSinglePage()
      };
    }, tab.key);
    check(expected.single, `${viewportLabel} book/${tab.key}: runtime selects single-page mode`);
    check(
      expected.names.length === tab.entries &&
      expected.leaves === tab.leaves &&
      expected.spreads === tab.spreads,
      `${viewportLabel} book/${tab.key}: entry, leaf and spread counts are exact`,
      expected
    );
    check(
      new Set(expected.names).size === expected.names.length,
      `${viewportLabel} book/${tab.key}: source entry names are unique`,
      expected.names
    );

    const collected = [];
    for (let leaf = 0; leaf < expected.leaves; leaf += 1) {
      await page.waitForFunction(
        value => window.__PERMAGARDEN_APP__.state.bookLeaf === value,
        leaf
      );
      const surface = await visibleBookSurface(page);
      check(
        surface.pages === 1 && surface.spines === 0 && surface.singleClass,
        `${viewportLabel} book/${tab.key} leaf ${leaf + 1}: exactly one real page and no spine`,
        surface
      );
      check(
        surface.horizontalOverflow !== null && surface.horizontalOverflow <= 1,
        `${viewportLabel} book/${tab.key} leaf ${leaf + 1}: no horizontal overflow`,
        surface
      );

      const expectedLabel = `Page ${leaf + 1} of ${expected.leaves}`;
      const actualLabel = (await page.locator('.pg-book-pagelabel').innerText()).trim();
      check(
        actualLabel === expectedLabel,
        `${viewportLabel} book/${tab.key} leaf ${leaf + 1}: page label is correct`,
        { actualLabel, expectedLabel }
      );
      if (leaf === 0) {
        check(
          surface.titlePages === 1 && surface.names.length === 0,
          `${viewportLabel} book/${tab.key}: chapter title is a reachable first page`,
          surface
        );
      } else {
        check(
          surface.names.length === 1,
          `${viewportLabel} book/${tab.key} leaf ${leaf + 1}: exactly one entry name is visible`,
          surface
        );
        collected.push(surface.names[0]);
      }

      const next = page.locator('.pg-book-arrow[aria-label="Next pages"]');
      if (leaf < expected.leaves - 1) {
        check(!(await next.isDisabled()), `${viewportLabel} book/${tab.key}: next remains enabled before the last page`);
        await next.click();
      } else {
        check(await next.isDisabled(), `${viewportLabel} book/${tab.key}: next is disabled on the final page`);
      }
    }

    check(
      collected.length === expected.names.length &&
      new Set(collected).size === expected.names.length &&
      sameStrings(collected, expected.names),
      `${viewportLabel} book/${tab.key}: every unique entry is reachable exactly once`,
      { collected, expected: expected.names }
    );
  }
};

const auditDesktopBook = async (page, viewportLabel) => {
  await openBook(page);
  for (const tab of BOOK_TABS) {
    await page.getByRole('tab', { name: tab.label, exact: true }).click();
    await page.waitForFunction(
      key => {
        const app = window.__PERMAGARDEN_APP__;
        return app.state.bookTab === key && app.state.bookLeaf === 0;
      },
      tab.key
    );

    const expected = await page.evaluate(key => {
      const app = window.__PERMAGARDEN_APP__;
      return {
        names: app.bookEntries(key).map(entry => entry.name),
        leaves: app.bookLeafCount(key),
        spreads: app.bookSpreadCount(key),
        single: app.bookUsesSinglePage()
      };
    }, tab.key);
    check(!expected.single, `${viewportLabel} book/${tab.key}: runtime preserves desktop spread mode`);
    check(
      expected.names.length === tab.entries &&
      expected.leaves === tab.leaves &&
      expected.spreads === tab.spreads,
      `${viewportLabel} book/${tab.key}: desktop counts are exact`,
      expected
    );

    const collected = [];
    for (let spread = 0; spread < expected.spreads; spread += 1) {
      await page.waitForFunction(
        value => Math.floor((window.__PERMAGARDEN_APP__.state.bookLeaf || 0) / 2) === value,
        spread
      );
      const surface = await visibleBookSurface(page);
      check(
        surface.pages === 2 && surface.spines === 1 && !surface.singleClass,
        `${viewportLabel} book/${tab.key} spread ${spread + 1}: two pages and one spine remain visible`,
        surface
      );
      check(
        surface.horizontalOverflow !== null && surface.horizontalOverflow <= 1,
        `${viewportLabel} book/${tab.key} spread ${spread + 1}: no horizontal overflow`,
        surface
      );
      collected.push(...surface.names);

      const expectedLabel = `Spread ${spread + 1} of ${expected.spreads}`;
      const actualLabel = (await page.locator('.pg-book-pagelabel').innerText()).trim();
      check(
        actualLabel === expectedLabel,
        `${viewportLabel} book/${tab.key} spread ${spread + 1}: spread label is correct`,
        { actualLabel, expectedLabel }
      );

      const next = page.locator('.pg-book-arrow[aria-label="Next pages"]');
      if (spread < expected.spreads - 1) {
        check(!(await next.isDisabled()), `${viewportLabel} book/${tab.key}: next spread remains enabled`);
        await next.click();
      } else {
        check(await next.isDisabled(), `${viewportLabel} book/${tab.key}: next is disabled on final spread`);
      }
    }

    check(
      collected.length === expected.names.length &&
      new Set(collected).size === expected.names.length &&
      sameStrings(collected, expected.names),
      `${viewportLabel} book/${tab.key}: desktop spreads expose every entry exactly once`,
      { collected, expected: expected.names }
    );
  }
};

const auditOrientationRetention = async page => {
  await page.getByRole('tab', { name: 'Principles', exact: true }).click();
  await page.evaluate(() => new Promise(resolve => {
    window.__PERMAGARDEN_APP__.setState({ bookLeaf: 5 }, resolve);
  }));
  const before = await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    return {
      leaf: app.state.bookLeaf,
      name: document.querySelector('.pg-book .pg-pg-name')?.textContent?.trim() || ''
    };
  });
  check(before.leaf === 5 && before.name.length > 0, 'book orientation: a concrete entry is selected before rotation', before);

  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(
    () => {
      const state = window.__PERMAGARDEN_APP__.state;
      return state.viewportWidth === 844 && state.viewportHeight === 390;
    },
    null,
    { timeout: 4000 }
  );
  await settle(page);

  const after = await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    return {
      leaf: app.state.bookLeaf,
      name: document.querySelector('.pg-book .pg-pg-name')?.textContent?.trim() || '',
      single: app.bookUsesSinglePage()
    };
  });
  const surface = await visibleBookSurface(page);
  check(
    after.leaf === before.leaf && after.name === before.name,
    'book orientation: rotation preserves the current leaf and entry',
    { before, after }
  );
  check(
    after.single && surface.pages === 1 && surface.spines === 0,
    'book orientation: 844x390 remains a true single-page layout',
    { after, surface }
  );
};

const gateMetrics = async page => page.evaluate(() => {
  const dialog = document.querySelector('.pg-gate-dialog');
  const board = dialog?.querySelector('[data-testid="gate-board"]');
  const viewport = window.visualViewport;
  const viewportBox = {
    left: viewport?.offsetLeft || 0,
    top: viewport?.offsetTop || 0,
    right: (viewport?.offsetLeft || 0) + (viewport?.width || innerWidth),
    bottom: (viewport?.offsetTop || 0) + (viewport?.height || innerHeight)
  };
  const rectOf = element => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    };
  };
  const dialogRect = rectOf(dialog);
  const boardRect = rectOf(board);
  return {
    viewportBox,
    dialogRect,
    boardRect,
    dialogHorizontalOverflow: dialog ? Math.max(0, dialog.scrollWidth - dialog.clientWidth) : null,
    boardHorizontalOverflow: board ? Math.max(0, board.scrollWidth - board.clientWidth) : null,
    documentHorizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    dialogInsideHorizontally: !!dialogRect &&
      dialogRect.left >= viewportBox.left - 1 &&
      dialogRect.right <= viewportBox.right + 1,
    boardInsideDialogHorizontally: !boardRect || !dialogRect || (
      boardRect.left >= dialogRect.left - 1 &&
      boardRect.right <= dialogRect.right + 1
    )
  };
});

const assertGateLayout = async (page, viewportLabel, key, phase, boardExpected) => {
  const metrics = await gateMetrics(page);
  check(
    metrics.dialogRect &&
    metrics.dialogRect.width > 0 &&
    metrics.dialogInsideHorizontally &&
    metrics.dialogHorizontalOverflow !== null &&
    metrics.dialogHorizontalOverflow <= 1 &&
    metrics.documentHorizontalOverflow <= 1,
    `${viewportLabel} gate/${key} ${phase}: dialog stays inside the viewport without horizontal overflow`,
    metrics
  );
  if (boardExpected) {
    check(
      metrics.boardRect &&
      metrics.boardRect.width > 0 &&
      metrics.boardRect.height > 0 &&
      metrics.boardHorizontalOverflow !== null &&
      metrics.boardHorizontalOverflow <= 1 &&
      metrics.boardInsideDialogHorizontally,
      `${viewportLabel} gate/${key} ${phase}: board is visible and has no horizontal overflow`,
      metrics
    );
  }
};

const assertLastCtaReachable = async (page, viewportLabel, key, phase) => {
  const controls = page.locator('.pg-gate-dialog button, .pg-gate-dialog [role="button"]');
  const count = await controls.count();
  check(count > 0, `${viewportLabel} gate/${key} ${phase}: interactive controls render`);
  const last = controls.last();
  await last.scrollIntoViewIfNeeded();
  await settle(page);
  check(await last.isVisible(), `${viewportLabel} gate/${key} ${phase}: last CTA is visible after scrolling`);
  const evidence = await last.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    const right = left + (viewport?.width || innerWidth);
    const bottom = top + (viewport?.height || innerHeight);
    return {
      text: element.textContent?.trim() || element.getAttribute('aria-label') || '',
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      },
      viewport: { left, top, right, bottom },
      reachable:
        rect.width > 0 &&
        rect.height > 0 &&
        rect.left >= left - 1 &&
        rect.right <= right + 1 &&
        rect.top >= top - 1 &&
        rect.bottom <= bottom + 1
    };
  });
  check(
    evidence.reachable,
    `${viewportLabel} gate/${key} ${phase}: last CTA is reachable within the visual viewport`,
    evidence
  );
};

const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const clickGateControl = async (page, name) => {
  const control = page
    .locator('.pg-gate-dialog')
    .getByRole('button', { name: new RegExp(escapeRegex(name), 'i') })
    .first();
  await control.waitFor({ state: 'visible', timeout: 3000 });
  await control.scrollIntoViewIfNeeded();
  await control.click();
  await settle(page);
};

const completeGate = async (page, key) => {
  if (key === 'mulch') {
    for (const moisture of [24, 38, 31, 45]) {
      await clickGateControl(page, `Bed moisture ${moisture} percent`);
    }
    return;
  }

  if (key === 'compost') {
    const ingredients = await page.evaluate(() => {
      const items = window.__PERMAGARDEN_APP__.state.gate.d.items;
      return [
        ...items.filter(item => item.cat === 'green').slice(0, 2),
        ...items.filter(item => item.cat === 'brown').slice(0, 2)
      ].map(item => item.t);
    });
    for (const ingredient of ingredients) await clickGateControl(page, ingredient);
    await clickGateControl(page, 'Build this compost pile');
    return;
  }

  if (key === 'hugel') {
    for (const layer of ['Logs & trunks', 'Branches & twigs', 'Leaves & straw', 'Finished compost', 'Topsoil & plants']) {
      await clickGateControl(page, layer);
    }
    return;
  }

  if (key === 'rain') {
    for (const link of ['Gutter', 'Leaf screen', 'Covered barrel', 'Planted swale']) {
      await clickGateControl(page, link);
    }
    return;
  }

  if (key === 'kitchen') {
    const labels = {
      jam: 'Jam',
      dry: 'Dry',
      ferment: 'Ferment',
      cellar: 'Cellar',
      fresh: 'Share fresh'
    };
    for (let guard = 0; guard < 10; guard += 1) {
      const current = await page.evaluate(() => {
        const app = window.__PERMAGARDEN_APP__;
        const gate = app.state.gate;
        if (!gate || gate.status !== 'play') return null;
        const crop = gate.d.items[gate.d.i];
        return { answer: app.GATE_PRESERVE[crop] };
      });
      if (!current) break;
      await clickGateControl(page, labels[current.answer]);
    }
    return;
  }

  if (key === 'ladybug') {
    for (const action of ['Plant nectar flowers', 'Keep hollow stems', 'Observe for a few days']) {
      await clickGateControl(page, action);
    }
    await clickGateControl(page, 'Restore the balance');
    return;
  }

  if (key === 'bee') {
    for (const plant of ['Willow catkins', 'Borage flowers', 'Ivy flowers']) {
      await clickGateControl(page, plant);
    }
    return;
  }

  if (key === 'shelter') {
    for (let guard = 0; guard < 6; guard += 1) {
      const home = await page.evaluate(() => {
        const gate = window.__PERMAGARDEN_APP__.state.gate;
        if (!gate || gate.status !== 'play') return null;
        const animal = gate.d.animals[gate.d.i];
        return gate.d.homes.find(candidate => candidate.k === animal.home)?.label || null;
      });
      if (!home) break;
      await clickGateControl(page, home);
    }
    return;
  }

  if (key === 'pexeso') {
    for (let guard = 0; guard < 6; guard += 1) {
      const answer = await page.evaluate(() => {
        const app = window.__PERMAGARDEN_APP__;
        const gate = app.state.gate;
        if (!gate || gate.status !== 'play') return null;
        const question = gate.d.qs[gate.d.i];
        return (app.catalog[question.answer] || {}).name || question.answer;
      });
      if (!answer) break;
      await clickGateControl(page, answer);
    }
    return;
  }

  if (key === 'seeds') {
    const labels = {
      save: 'Store in seed bank',
      wait: 'Wait & dry',
      reject: 'Reject this batch'
    };
    for (let guard = 0; guard < 8; guard += 1) {
      const answer = await page.evaluate(() => {
        const gate = window.__PERMAGARDEN_APP__.state.gate;
        if (!gate || gate.status !== 'play') return null;
        return gate.d.items[gate.d.i]?.answer || null;
      });
      if (!answer) break;
      await clickGateControl(page, labels[answer]);
    }
    return;
  }

  if (key === 'quiz') {
    for (let guard = 0; guard < 6; guard += 1) {
      const answer = await page.evaluate(() => {
        const gate = window.__PERMAGARDEN_APP__.state.gate;
        if (!gate || gate.status !== 'play') return null;
        const question = gate.d.qs[gate.d.i];
        return question.opts.find(option => option.k === question.answer)?.label || null;
      });
      if (!answer) break;
      await clickGateControl(page, answer);
    }
  }
};

const prepareGate = async (page, key, target) => {
  await page.evaluate(({ key, target }) => new Promise(resolve => {
    const app = window.__PERMAGARDEN_APP__;
    clearInterval(app._gateIv);
    app._gateOpening = false;
    app.stopAllAudio?.();
    app.setState({
      story: false,
      intro: false,
      gardenCinematic: null,
      gardenReflection: null,
      residentStory: null,
      livingLesson: null,
      showSummary: false,
      paymentChoice: null,
      guildCard: null,
      showGuilds: false,
      visit: null,
      inspectCritter: null,
      arrivalQueue: [],
      returnQueue: [],
      gardenWhisper: null,
      gardenWhisperQueue: [],
      bookOpen: false,
      gate: null,
      toast: null,
      muted: true,
      discovered: app.guildDefs.map(def => def.key)
    }, () => {
      app.startGate(key, target);
      resolve();
    });
  }), { key, target });
  await page.locator('.pg-gate-dialog').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForFunction(
    expected => {
      const gate = window.__PERMAGARDEN_APP__.state.gate;
      return gate?.key === expected && gate.status === 'brief';
    },
    key
  );
};

const cleanupGate = async page => {
  await page.evaluate(() => new Promise(resolve => {
    const app = window.__PERMAGARDEN_APP__;
    clearInterval(app._gateIv);
    app._gateIv = null;
    app._gateOpening = false;
    app.setState({ gate: null, gardenCinematic: null, gardenPulse: null, toast: null }, resolve);
  }));
};

const auditGateViewport = async (browser, viewport) => {
  const viewportLabel = `${viewport.width}x${viewport.height}`;
  const { context, page, errors } = await makePage(browser, viewport, viewportLabel);
  try {
    for (const [key, target] of GATES) {
      await prepareGate(page, key, target);
      await assertGateLayout(page, viewportLabel, key, 'briefing', false);
      await assertLastCtaReachable(page, viewportLabel, key, 'briefing');

      await clickGateControl(page, 'Start challenge');
      await page.waitForFunction(() => window.__PERMAGARDEN_APP__.state.gate?.status === 'play');
      await page.locator('[data-testid="gate-board"]').waitFor({ state: 'visible', timeout: 3000 });
      await assertGateLayout(page, viewportLabel, key, 'play', true);
      await assertLastCtaReachable(page, viewportLabel, key, 'play');

      await completeGate(page, key);
      await page.waitForFunction(
        expected => {
          const gate = window.__PERMAGARDEN_APP__.state.gate;
          return gate?.key === expected && gate.status === 'won';
        },
        key,
        { timeout: 5000 }
      );
      await page.getByRole('button', { name: /Continue to/i }).waitFor({ state: 'visible', timeout: 3000 });
      await assertGateLayout(page, viewportLabel, key, 'result', false);
      await assertLastCtaReachable(page, viewportLabel, key, 'result');
      check(true, `${viewportLabel} gate/${key}: correct UI sequence reaches the won result`);
      await cleanupGate(page);
    }
    check(errors.length === 0, `${viewportLabel} gates: no browser console or runtime errors`, errors);
  } finally {
    await context.close();
  }
};

const browser = await chromium.launch({ headless: true });
try {
  {
    const label = '390x844';
    const { context, page, errors } = await makePage(browser, { width: 390, height: 844 }, label);
    try {
      await auditSinglePageBook(page, label);
      await auditOrientationRetention(page);
      check(errors.length === 0, `${label} book: no browser console or runtime errors`, errors);
    } finally {
      await context.close();
    }
  }

  {
    const label = '844x390';
    const { context, page, errors } = await makePage(browser, { width: 844, height: 390 }, label);
    try {
      await auditSinglePageBook(page, label);
      check(errors.length === 0, `${label} book: no browser console or runtime errors`, errors);
    } finally {
      await context.close();
    }
  }

  {
    const label = '1440x900';
    const { context, page, errors } = await makePage(browser, { width: 1440, height: 900 }, label);
    try {
      await auditDesktopBook(page, label);
      check(errors.length === 0, `${label} book: no browser console or runtime errors`, errors);
    } finally {
      await context.close();
    }
  }

  for (const viewport of GATE_VIEWPORTS) {
    await auditGateViewport(browser, viewport);
  }

  console.log(
    '\nMobile/tablet book and gate audit passed: ' + BOOK_TABS.length + ' book chapters, orientation retention, ' +
    'desktop spreads, and all 11 gates across 4 responsive viewports.'
  );
} finally {
  await browser.close();
}
