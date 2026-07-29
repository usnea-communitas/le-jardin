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
const failures = [];

const check = (condition, message, evidence) => {
  if (condition) {
    console.log('PASS  ' + message);
    return;
  }
  const detail = evidence === undefined ? '' : '\nEvidence: ' + JSON.stringify(evidence, null, 2);
  failures.push(message + detail);
  console.error('FAIL  ' + message + detail);
};

const runCase = async (name, task) => {
  console.log('\n--- ' + name + ' ---');
  try {
    await task();
  } catch (error) {
    const message = name + ' could not be completed';
    const evidence = error instanceof Error ? error.stack || error.message : String(error);
    failures.push(message + '\nEvidence: ' + evidence);
    console.error('FAIL  ' + message + '\nEvidence: ' + evidence);
  }
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
  showSummary: false,
  gate: null,
  visit: null,
  gardenCinematic: null,
  gardenWhisper: null,
  gardenWhisperQueue: [],
  gardenReflection: null,
  gardenReflectionQueue: [],
  unlockCard: null,
  guildCard: null,
  guildCardQueue: [],
  arrivalQueue: [],
  residentStory: null,
  pestStory: null,
  livingLesson: null,
  bookOpen: false,
  kitchenOpen: false,
  seedbankOpen: false,
  returnQueue: [],
  ...overrides
});

const physicalGarden = () => [
  { id: 'soil-1', type: 'compost', x: 8, y: 82 },
  { id: 'soil-2', type: 'mulch', x: 22, y: 82 },
  { id: 'water-1', type: 'rain', x: 8, y: 18 },
  { id: 'food-1', type: 'appletree', x: 22, y: 20 },
  { id: 'food-2', type: 'herbspiral', x: 88, y: 18 },
  { id: 'habitat-1', type: 'pollinator', x: 88, y: 82 },
  { id: 'habitat-2', type: 'bughotel', x: 47, y: 18 }
];

const flourishingGarden = () => [
  { id: 'f-compost', type: 'compost', x: 10, y: 15 },
  { id: 'f-greenhouse', type: 'greenhouse', x: 12, y: 16 },
  { id: 'f-rain', type: 'rain', x: 30, y: 15 },
  { id: 'f-herbspiral', type: 'herbspiral', x: 32, y: 16 },
  { id: 'f-hugel', type: 'hugel', x: 50, y: 15 },
  { id: 'f-arch', type: 'arch', x: 52, y: 16 },
  { id: 'f-birdhouse', type: 'birdhouse', x: 49, y: 17 },
  { id: 'f-bughotel', type: 'bughotel', x: 70, y: 15 },
  { id: 'f-pollinator', type: 'pollinator', x: 72, y: 16 },
  { id: 'f-seedbank', type: 'seedbank', x: 73, y: 17 },
  { id: 'f-bench', type: 'bench', x: 88, y: 15 },
  { id: 'f-sign', type: 'sign', x: 89, y: 16 },
  { id: 'f-mulch', type: 'mulch', x: 12, y: 60 },
  { id: 'f-appletree', type: 'appletree', x: 14, y: 61 },
  { id: 'f-birdbath', type: 'birdbath', x: 32, y: 60 },
  { id: 'f-kitchen', type: 'kitchen', x: 54, y: 60 }
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  reducedMotion: 'no-preference',
  forcedColors: 'none'
});
const page = await context.newPage();
const browserErrors = [];

page.on('pageerror', error => browserErrors.push('pageerror: ' + error.message));
page.on('console', message => {
  if (message.type() === 'error') browserErrors.push('console: ' + message.text());
});

// Record ambient-video lifecycle calls without changing their behaviour.
await page.addInitScript(() => {
  window.__PG_V70_MEDIA_AUDIT__ = { playCalls: 0, pauseCalls: 0 };
  const originalPlay = HTMLMediaElement.prototype.play;
  const originalPause = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.play = function (...args) {
    if (this.classList?.contains('pg-game-ambient')) window.__PG_V70_MEDIA_AUDIT__.playCalls += 1;
    return originalPlay.apply(this, args);
  };
  HTMLMediaElement.prototype.pause = function (...args) {
    if (this.classList?.contains('pg-game-ambient')) window.__PG_V70_MEDIA_AUDIT__.pauseCalls += 1;
    return originalPause.apply(this, args);
  };
});

const waitForApp = async () => {
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__, null, { timeout: 15000 });
  await page.waitForTimeout(120);
};

const setAppState = async patch => {
  await page.evaluate(async next => {
    const app = window.__PERMAGARDEN_APP__;
    if (typeof app.clearTransientWork === 'function') app.clearTransientWork();
    await new Promise(resolve => app.setState({ ...app.state, ...next }, resolve));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, patch);
};

const visibleInfiniteAnimations = scopeSelector => page.evaluate(selector => {
  const root = selector ? document.querySelector(selector) : document.body;
  if (!root) return [];
  const inViewport = rect => rect.width > 0 && rect.height > 0 &&
    rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;
  const selectorFor = element => {
    const id = element.id ? '#' + element.id : '';
    const classes = Array.from(element.classList || []).slice(0, 3).map(name => '.' + name).join('');
    return element.tagName.toLowerCase() + id + classes;
  };
  const result = [];
  for (const element of root.querySelectorAll('*')) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0 || !inViewport(rect)) continue;
    const names = style.animationName.split(',').map(value => value.trim());
    const iterations = style.animationIterationCount.split(',').map(value => value.trim());
    const durations = style.animationDuration.split(',').map(value => value.trim());
    names.forEach((name, index) => {
      const iteration = iterations[index] ?? iterations.at(-1);
      if (name && name !== 'none' && iteration === 'infinite') {
        result.push({
          selector: selectorFor(element),
          name,
          duration: durations[index] ?? durations.at(-1),
          interactive: Boolean(element.closest('button,a,input,select,textarea,[role="button"]')),
          text: (element.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 80)
        });
      }
    });
  }
  return result;
}, scopeSelector);

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await waitForApp();
  await page.evaluate(({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
    sessionStorage.clear();
  }, { key: storeKey, state: savedState() });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForApp();

  await runCase('honest staged garden progression', async () => {
    const stageEvidence = async () => page.locator('[data-plot]').evaluate(element => ({
      className: element.className,
      backgroundImage: getComputedStyle(element).backgroundImage
    }));

    const bare = await stageEvidence();
    await setAppState({ placed: physicalGarden() });
    const growing = await stageEvidence();
    await setAppState({
      placed: flourishingGarden(),
      seasonTurns: 8,
      journeyMoments: ['share', 'challenge'],
      sharedActs: 3,
      given: 3,
      harvestEver: true,
      grownHarvests: 4,
      preservedCount: 2,
      gardenEffects: { compost: 1, mulch: 1, hugel: 1, rain: 1, kitchen: 1, ladybug: 1, bee: 1, shelter: 1, pexeso: 1, seeds: 1, quiz: 1 }
    });
    const flourishing = await stageEvidence();

    check(
      /pg-stage-bare/.test(bare.className) && /garden-bare\.webp/.test(bare.backgroundImage),
      'an empty plot looks genuinely bare instead of pre-completed',
      bare
    );
    check(
      /pg-stage-growing/.test(growing.className) && /garden-growing\.webp/.test(growing.backgroundImage),
      'an early connected plot advances to the growing landscape',
      growing
    );
    check(
      /pg-stage-flourishing/.test(flourishing.className) && /story-07-invitation\.webp/.test(flourishing.backgroundImage),
      'a mature high-resilience plot reaches the flourishing landscape',
      flourishing
    );

    await setAppState(savedState());
  });

  await runCase('1280 x 720 operational text legibility', async () => {
    const undersizedText = await page.evaluate(() => {
      const root = document.querySelector('.pg-game-shell') || document.body;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const findings = [];
      const selectorFor = element => {
        const id = element.id ? '#' + element.id : '';
        const classes = Array.from(element.classList || []).slice(0, 3).map(name => '.' + name).join('');
        return element.tagName.toLowerCase() + id + classes;
      };
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const text = node.textContent.replace(/\s+/g, ' ').trim();
        if (!text || !/[\p{L}\p{N}]/u.test(text)) continue;
        const element = node.parentElement;
        if (!element || element.closest('script,style,noscript,[hidden],[aria-hidden="true"]')) continue;
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0 || rect.right <= 0 || rect.bottom <= 0 || rect.left >= innerWidth || rect.top >= innerHeight) continue;
        const size = Number.parseFloat(style.fontSize);
        if (Number.isFinite(size) && size < 10.99) {
          findings.push({ text: text.slice(0, 90), fontSize: size, selector: selectorFor(element) });
        }
      }
      return findings.slice(0, 40);
    });
    check(
      undersizedText.length === 0,
      'no visible operational text is smaller than 11px at 1280 x 720',
      undersizedText
    );
  });

  await runCase('header milestone language', async () => {
    const progress = page.locator('.pg-header-progress');
    const evidence = {
      visible: await progress.isVisible(),
      text: (await progress.textContent() || '').replace(/\s+/g, ' ').trim()
    };
    check(evidence.visible, 'the sharing milestone remains visible in the desktop header', evidence);
    check(!/garden\s+goal/i.test(evidence.text), 'the header does not mislabel sharing as a garden goal', evidence);
  });

  await runCase('learning-model disclosure', async () => {
    const insightsToggle = page.getByTestId('insights-toggle');
    const calmDefault = {
      visible: await insightsToggle.isVisible(),
      expanded: await insightsToggle.getAttribute('aria-expanded'),
      focusVisible: await page.locator('.pg-calm-focus').isVisible()
    };
    check(
      calmDefault.visible && calmDefault.expanded === 'false' && calmDefault.focusVisible,
      'guided play starts with the calm one-action view while keeping the model available',
      calmDefault
    );
    await insightsToggle.click();
    await page.locator('.pg-score-visual').waitFor({ state: 'visible' });
    const disclosure = await page.locator('.pg-design-panel').evaluate(panel => {
      const contextPattern = /(learning[- ]game|learning model|not (?:a )?scientific|not (?:a )?measurement|how (?:the )?(?:score|connections) works)/i;
      const details = Array.from(panel.querySelectorAll('details')).find(element => contextPattern.test(element.textContent || ''));
      if (details) {
        return {
          kind: 'details',
          label: details.querySelector('summary')?.textContent?.trim() || '',
          context: details.textContent.trim(),
          semantic: Boolean(details.querySelector('summary'))
        };
      }
      for (const button of panel.querySelectorAll('button[aria-expanded],[role="button"][aria-expanded]')) {
        const controlledId = button.getAttribute('aria-controls');
        const controlled = controlledId ? document.getElementById(controlledId) : null;
        const combined = [button.textContent, button.getAttribute('aria-label'), controlled?.textContent].filter(Boolean).join(' ');
        if (contextPattern.test(combined)) {
          return {
            kind: 'button',
            label: button.getAttribute('aria-label') || button.textContent.trim(),
            context: combined.trim(),
            semantic: Boolean(controlledId && controlled)
          };
        }
      }
      return null;
    });
    check(
      disclosure?.semantic === true && /(learning|scientific|measurement|connections|score)/i.test(disclosure.context),
      'the learning-model caveat is an accessible disclosure, not a title-only tooltip',
      disclosure
    );
  });

  await runCase('community-pool number and prediction', async () => {
    const poolEvidence = await page.locator('.pg-community-panel').evaluate(section => {
      const label = Array.from(section.querySelectorAll('*')).find(element => {
        const own = Array.from(element.childNodes)
          .filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        return /^(shared|community)\s+pool\b/i.test(own);
      });
      if (!label) return { labelFound: false, nearby: '' };
      let node = label;
      const nearby = [];
      for (let depth = 0; node && node !== section && depth < 4; depth += 1, node = node.parentElement) {
        nearby.push((node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim());
      }
      return { labelFound: true, nearby };
    });
    const usefulText = (poolEvidence.nearby || []).find(text =>
      /\d+\s*(?:%|\/\s*100|points?)/i.test(text) &&
      /(likely|unlikely|chance|forecast|predict|expected|next|offer|return|flow|quiet|steady|strong|low|high|scarce|abundant)/i.test(text)
    );
    check(
      poolEvidence.labelFound && Boolean(usefulText),
      'the community pool shows both its numeric state and a plain-language prediction',
      poolEvidence
    );
  });

  await runCase('score naming', async () => {
    const scoreText = (await page.locator('.pg-score-visual').textContent() || '').replace(/\s+/g, ' ').trim();
    check(!/game\s+score/i.test(scoreText), 'the primary score is not labelled GAME SCORE', { scoreText });
    check(
      /(garden\s+resilience|(?:design\s+)?connections)/i.test(scoreText),
      'the primary score is named Garden resilience or Connections',
      { scoreText }
    );
  });

  await runCase('reflection vignette layers', async () => {
    const reflection = {
      id: 'three-layers',
      voiceId: 'reflection-three',
      text: 'Soil, water and food answer one another.',
      note: 'A connected garden learns through relationships.'
    };
    await setAppState({
      story: false,
      intro: false,
      showSummary: false,
      gate: null,
      visit: null,
      gardenCinematic: null,
      guildCard: null,
      gardenReflection: reflection,
      gardenReflectionQueue: []
    });
    const art = page.locator('.pg-reflection-art');
    await art.waitFor({ state: 'visible' });
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.pg-reflection-art img')).every(image => image.complete && image.naturalWidth > 0));
    const threeLayers = await art.evaluate(element => ({
      sources: Array.from(element.querySelectorAll('img')).map(image => new URL(image.src).pathname),
      animation: getComputedStyle(element.querySelector('.pg-reflection-motif')).animationName
    }));
    check(
      threeLayers.sources.length === 2 &&
        threeLayers.sources.some(source => /three-layers-answer-background\.webp$/i.test(source)) &&
        threeLayers.sources.some(source => /three-layers-answer-motif\.webp$/i.test(source)),
      'the three-layers reflection loads its real background and transparent motif instead of a literal template URL',
      threeLayers
    );
    check(
      /pgReflectionBreathe/i.test(threeLayers.animation),
      'the reflection motif receives the intended calm breathing animation',
      threeLayers
    );

    await setAppState({
      season: 'Winter',
      gardenReflection: { ...reflection, id: 'seasonal-observation' }
    });
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.pg-reflection-art img')).every(image => /garden-sleeps-winter/.test(image.src) && image.complete && image.naturalWidth > 0));
    const winterSources = await art.locator('img').evaluateAll(images => images.map(image => new URL(image.src).pathname));
    check(
      winterSources.length === 2 && winterSources.every(source => /garden-sleeps-winter-(?:background|motif)\.webp$/i.test(source)),
      'a general winter reflection uses the sleeping-garden layer pair',
      winterSources
    );
    await setAppState({ gardenReflection: null, season: 'Summer' });
  });

  await runCase('first-cycle reflection versus certificate', async () => {
    await setAppState({
      mode: 'explore',
      placed: [],
      journeyMoments: [],
      sharedActs: 0,
      harvestEver: false,
      discovered: [],
      showSummary: true,
      reflectionOpened: true,
      intro: false,
      story: false
    });
    const summary = page.locator('[data-pg-dialog="summary"]');
    await summary.waitFor({ state: 'visible' });
    const firstCycle = await summary.evaluate(element => ({
      certificate: element.getAttribute('data-certificate'),
      ariaLabel: element.getAttribute('aria-label') || '',
      openingText: (element.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 220),
      certificateActions: Boolean(element.querySelector('[data-certificate-actions]'))
    }));
    check(
      firstCycle.certificate === '0' && !firstCycle.certificateActions &&
        /first\s+(?:learning\s+)?cycle/i.test(firstCycle.ariaLabel + ' ' + firstCycle.openingText),
      'an unfinished summary is explicitly a first-cycle reflection, not a certificate',
      firstCycle
    );

    await setAppState({
      mode: 'guided',
      placed: flourishingGarden(),
      journeyMoments: ['soil', 'water', 'food', 'shelter', 'share', 'challenge'],
      gardenEffects: { compost: 1, rain: 1, bee: 1, kitchen: 1 },
      sharedActs: 3,
      given: 6,
      seasonTurns: 8,
      harvestEver: true,
      showSummary: true,
      reflectionOpened: true,
      intro: false,
      story: false,
      guildCard: null,
      arrivalQueue: []
    });
    await page.waitForFunction(() => document.querySelector('[data-pg-dialog="summary"]')?.getAttribute('data-certificate') === '1');
    const certificate = await summary.evaluate(element => ({
      certificate: element.getAttribute('data-certificate'),
      ariaLabel: element.getAttribute('aria-label') || '',
      openingText: (element.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 220),
      certificateActions: Boolean(element.querySelector('[data-certificate-actions]'))
    }));
    check(
      certificate.certificate === '1' && certificate.certificateActions &&
        /certificate/i.test(certificate.ariaLabel + ' ' + certificate.openingText),
      'a completed journey is explicitly presented as the learning certificate',
      certificate
    );

    const summaryScoreText = (await summary.locator('svg text').allTextContents()).join(' ').replace(/\s+/g, ' ').trim();
    check(
      !/game\s+score/i.test(summaryScoreText) && /(garden\s+resilience|(?:design\s+)?connections)/i.test(summaryScoreText),
      'the certificate uses the same honest resilience/connections score name',
      { summaryScoreText }
    );

    const standaloneExport = await page.evaluate(async () => {
      const out = await window.__PERMAGARDEN_APP__.certificateExport();
      const imageHrefs = Array.from(out.svg.matchAll(/<image\b[^>]*\bhref="([^"]+)"/g), match => match[1]);
      return {
        filename: out.filename,
        svgLength: out.svg.length,
        imageCount: imageHrefs.length,
        embeddedCount: imageHrefs.filter(href => /^data:image\//i.test(href)).length,
        externalHrefs: imageHrefs.filter(href => !/^data:image\//i.test(href))
      };
    });
    check(
      /\.svg$/i.test(standaloneExport.filename) && standaloneExport.svgLength > 100000 &&
        standaloneExport.imageCount >= 2 && standaloneExport.embeddedCount === standaloneExport.imageCount &&
        standaloneExport.externalHrefs.length === 0,
      'the downloaded certificate embeds its painted map and sprites for offline use',
      standaloneExport
    );
  });

  await runCase('landscape certificate printing', async () => {
    const pageRules = await page.evaluate(() => {
      const collected = [];
      const walk = rules => {
        for (const rule of Array.from(rules || [])) {
          if (/^@page\b/i.test(rule.cssText || '')) collected.push(rule.cssText);
          if (rule.cssRules) walk(rule.cssRules);
        }
      };
      for (const sheet of document.styleSheets) {
        try { walk(sheet.cssRules); } catch { /* Cross-origin font styles are irrelevant. */ }
      }
      return collected;
    });
    check(
      pageRules.some(rule => /\bsize\s*:\s*(?:a\d\s+)?landscape\b/i.test(rule)),
      'print CSS explicitly requests a landscape page for the certificate',
      pageRules
    );
  });

  await runCase('forced-colors accessibility', async () => {
    const forcedColorRules = await page.evaluate(() => {
      const collected = [];
      const walk = rules => {
        for (const rule of Array.from(rules || [])) {
          if (rule.media?.mediaText && /forced-colors\s*:\s*active/i.test(rule.media.mediaText)) collected.push(rule.cssText);
          if (rule.cssRules) walk(rule.cssRules);
        }
      };
      for (const sheet of document.styleSheets) {
        try { walk(sheet.cssRules); } catch { /* Cross-origin font styles are irrelevant. */ }
      }
      return collected;
    });
    check(
      forcedColorRules.length > 0 && forcedColorRules.some(rule => /(border|outline|forced-color-adjust|CanvasText|ButtonText)/i.test(rule)),
      'forced-colors: active has an explicit boundary/focus treatment',
      forcedColorRules
    );

    await page.emulateMedia({ media: 'screen', reducedMotion: 'no-preference', forcedColors: 'active' });
    const forcedEvidence = await page.evaluate(() => {
      const button = document.querySelector('.pg-header-story');
      if (!button) return { mediaMatches: matchMedia('(forced-colors: active)').matches, button: null };
      button.focus();
      const style = getComputedStyle(button);
      return {
        mediaMatches: matchMedia('(forced-colors: active)').matches,
        button: {
          borderStyle: style.borderStyle,
          borderWidth: style.borderWidth,
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth
        }
      };
    });
    const boundaryWidth = Number.parseFloat(forcedEvidence.button?.borderWidth || '0');
    const outlineWidth = Number.parseFloat(forcedEvidence.button?.outlineWidth || '0');
    check(
      forcedEvidence.mediaMatches && forcedEvidence.button &&
        ((forcedEvidence.button.borderStyle !== 'none' && boundaryWidth > 0) ||
          (forcedEvidence.button.outlineStyle !== 'none' && outlineWidth > 0)),
      'a primary header control keeps a visible boundary in forced-colors mode',
      forcedEvidence
    );
    await page.emulateMedia({ media: 'screen', reducedMotion: 'no-preference', forcedColors: 'none' });
  });

  await runCase('calm motion budget', async () => {
    await setAppState({
      story: false,
      intro: false,
      showSummary: false,
      placed: physicalGarden(),
      arrivalQueue: [],
      guildCard: null,
      gardenCinematic: null,
      gardenReflection: null,
      gate: null,
      visit: null
    });
    await page.waitForTimeout(180);
    const gameplayAnimations = await visibleInfiniteAnimations('.pg-game-main');
    check(
      gameplayAnimations.length <= 4 && gameplayAnimations.every(animation => !animation.interactive),
      'calm gameplay limits simultaneous infinite CSS motion and never loops an interactive control',
      gameplayAnimations
    );
  });

  await runCase('ambient video poster and blocking-dialog pause', async () => {
    const ambient = page.locator('video.pg-game-ambient');
    await ambient.waitFor({ state: 'attached' });
    const poster = await ambient.getAttribute('poster');
    check(
      Boolean(poster && !/^(?:about:blank|#)$/i.test(poster)),
      'the ambient video has a non-empty poster fallback',
      { poster }
    );

    const before = await ambient.evaluate(async video => {
      video.muted = true;
      try {
        await Promise.race([
          video.play(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('play timeout')), 3000))
        ]);
      } catch (error) {
        return {
          started: !video.paused,
          paused: video.paused,
          readyState: video.readyState,
          error: error?.message || String(error),
          calls: { ...window.__PG_V70_MEDIA_AUDIT__ }
        };
      }
      return {
        started: !video.paused,
        paused: video.paused,
        readyState: video.readyState,
        calls: { ...window.__PG_V70_MEDIA_AUDIT__ }
      };
    });

    await setAppState({ intro: true, story: false, showSummary: false });
    await page.locator('[data-pg-dialog="intro"]').waitFor({ state: 'visible' });
    await page.waitForTimeout(180);
    const after = await page.locator('video.pg-game-ambient').evaluate(video => ({
      paused: video.paused,
      calls: { ...window.__PG_V70_MEDIA_AUDIT__ }
    }));
    check(
      before.started && after.paused,
      'ambient playback pauses when an aria-modal blocking dialog opens',
      { before, after }
    );
    await setAppState({ intro: false });
  });

  await runCase('story caption safe zone and calm story motion', async () => {
    await setAppState({
      story: true,
      storySeen: true,
      storyStarted: true,
      storyScene: 1,
      storyPaused: true,
      storyLeaving: false,
      intro: false,
      showSummary: false
    });
    const caption = page.locator('.pg-story-caption');
    await caption.waitFor({ state: 'visible' });
    const safeZone = await caption.evaluate(element => {
      const captionRect = element.getBoundingClientRect();
      const candidates = [
        ...document.querySelectorAll('[data-story-safe-zone],.pg-story-safe-zone,.pg-story-vignette')
      ].filter(candidate => candidate !== element);
      const overlays = candidates.map(candidate => {
        const rect = candidate.getBoundingClientRect();
        const style = getComputedStyle(candidate);
        return {
          selector: candidate.className || candidate.getAttribute('data-story-safe-zone') || candidate.tagName,
          backgroundImage: style.backgroundImage,
          coversCaption: rect.left <= captionRect.left && rect.right >= captionRect.right &&
            rect.top <= captionRect.top && rect.bottom >= captionRect.bottom
        };
      });
      return {
        caption: {
          left: captionRect.left,
          right: innerWidth - captionRect.right,
          bottom: innerHeight - captionRect.bottom
        },
        overlays
      };
    });
    check(
      safeZone.caption.left >= 14 && safeZone.caption.right >= 14 && safeZone.caption.bottom >= 48,
      'story captions remain inside a readable title-safe area',
      safeZone.caption
    );
    check(
      safeZone.overlays.some(overlay => overlay.coversCaption && /linear-gradient/i.test(overlay.backgroundImage)),
      'a full safe-zone gradient sits behind the story captions',
      safeZone.overlays
    );

    const storyAnimations = await visibleInfiniteAnimations('.pg-story');
    check(
      storyAnimations.length <= 6 && storyAnimations.every(animation => !animation.interactive),
      'the opening story also respects the calm infinite-motion budget',
      storyAnimations
    );
  });

  check(browserErrors.length === 0, 'no browser console or runtime errors were recorded', browserErrors);

  if (failures.length) {
    throw new Error(
      'V70 VISUAL QUALITY REGRESSION FAILED (' + failures.length + ')\n\n' +
      failures.map((failure, index) => String(index + 1) + '. ' + failure).join('\n\n')
    );
  }
  console.log('\nV70 VISUAL QUALITY REGRESSION COMPLETE');
} finally {
  await context.close();
  await browser.close();
}
