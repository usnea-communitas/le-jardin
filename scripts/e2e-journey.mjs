import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { mkdir, readdir } from 'node:fs/promises';

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
const artifacts = path.join(os.tmpdir(), 'permagarden-e2e');
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push('pageerror: ' + error.message));
page.on('console', message => { if (message.type() === 'error') errors.push('console: ' + message.text()); });

const check = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log('PASS  ' + message);
};
const textVisible = async text => page.getByText(text, { exact: false }).first().isVisible().catch(() => false);
const dismissGarden = async () => {
  const button = page.getByRole('button', { name: "Dismiss the garden's message" });
  if (await button.isVisible().catch(() => false)) await button.click();
};
const dismissArrivals = async () => {
  for (let i = 0; i < 4; i += 1) {
    const welcome = page.getByRole('button', { name: /Keep observing|Continue observing|Welcome to the garden|Welcome all|Welcome them in/i }).first();
    if (!(await welcome.isVisible().catch(() => false))) break;
    await welcome.click();
    await page.waitForTimeout(120);
  }
};
const place = async (label, x, y) => {
  await page.getByText(label, { exact: true }).first().click();
  const plot = page.locator('[data-plot]');
  const box = await plot.boundingBox();
  if (!box) throw new Error('Garden plot has no bounding box');
  await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  await page.waitForTimeout(180);
  await dismissGarden();
  await dismissArrivals();
};

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  try {
    await page.getByRole('button', { name: /Begin the story/i }).waitFor({ state: 'visible', timeout: 15000 });
  } catch (error) {
    console.error('INITIAL BODY\n' + (await page.locator('body').innerText().catch(() => '<unavailable>')));
    console.error('BROWSER ERRORS\n' + errors.join('\n'));
    throw error;
  }
  check((await page.locator('body').innerText()).trim().length > 500, 'the game renders meaningful content');
  const ambientVideo = page.locator('video.pg-game-ambient');
  check(await ambientVideo.count() === 1, 'the calm garden background video is present');
  await page.waitForFunction(() => document.querySelector('video.pg-game-ambient')?.readyState >= 2, null, { timeout: 8000 }).catch(() => {});
  const ambientState = await ambientVideo.evaluate(video => ({ muted: video.muted, defaultMuted: video.defaultMuted, loop: video.loop, autoplay: video.autoplay, readyState: video.readyState }));
  check((ambientState.muted || ambientState.defaultMuted) && ambientState.loop && ambientState.autoplay && ambientState.readyState >= 2, 'the background video is muted, looped, and ready to play');
  check(await page.getByRole('button', { name: /Begin the story/i }).isVisible(), 'the cinematic story is the first entry point');
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(artifacts, '01-story-cover.png') });

  await page.getByRole('button', { name: /Skip story/i }).first().click();
  await page.waitForTimeout(1000);
  check(await page.getByTestId('choose-guided').isVisible(), 'the intro offers Guided Journey and Free Garden instead of a manual');
  await page.getByTestId('choose-guided').click();
  await page.waitForTimeout(200);
  await page.evaluate(() => { Math.random = () => 0.99; });
  check(await textVisible('Begin with my soil'), 'guided play begins with one clear soil action');
  check(await page.getByText('Compost', { exact: true }).first().isVisible(), 'the first palette exposes a soil tool');
  check(!(await page.getByText('Rain harvesting', { exact: true }).first().isVisible().catch(() => false)), 'later systems are progressively hidden');

  await place('Compost', 0.28, 0.72);
  check(await textVisible('Catch and keep water'), 'water is revealed after the first soil decision');
  await page.getByTestId('reflection-button').click();
  check(await textVisible('Garden Reflection'), 'early completion opens reflection rather than an unearned certificate');
  check(!(await page.getByRole('link', { name: /Save certificate/i }).isVisible().catch(() => false)), 'certificate export stays locked during early reflection');
  await page.getByRole('button', { name: /Close (?:garden reflection|learning certificate|certificate)/i }).click();

  await place('Rain harvesting', 0.34, 0.68);
  check(await textVisible('Grow food in layers'), 'food is revealed after water');
  await place('Hügelkultur bed', 0.41, 0.66);
  check(await textVisible('Make a home for wildlife'), 'habitat is revealed after food');
  await place('Flower strip', 0.48, 0.64);
  check(await textVisible('Let one gift circulate'), 'the community table is introduced only after the garden has something to share');
  check(await textVisible('Malik'), 'the sharing table is populated by named Menet garden characters');
  await page.screenshot({ path: path.join(artifacts, '02-guided-systems.png') });

  await page.getByRole('button', { name: 'Pick ripe cherries', exact: true }).first().press('Enter');
  await page.getByRole('button', { name: /Give Cherries to the community table/i }).click();
  await page.waitForTimeout(220);
  await dismissGarden();
  check(await textVisible('Turn to the next season'), 'sharing a genuine harvest surplus advances the journey');
  check(await textVisible('Camille will add cherries'), 'the gift reaches a fitting community character with a distinct response');

  await page.getByRole('button', { name: /Advance to/i }).click();
  check(await textVisible('Garden challenge'), 'a seasonal transition opens a contextual garden challenge');
  await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    if (!app || !app.state.gate) throw new Error('Gate instance unavailable');
    app.gateResolve({ ...app.state.gate.d }, 'won');
  });
  await page.waitForTimeout(200);
  check(await textVisible('What remains'), 'winning a minigame explains what learning remains and when its physical effect applies');
  await page.getByRole('button', { name: /Continue to/i }).click();
  await page.waitForTimeout(250);
  await dismissGarden();
  check(await textVisible('The garden is ready to reflect'), 'all six acts unlock the ending');

  const stateEvidence = await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    const systems = app.gardenSystems(app.state);
    return { moments: app.state.journeyMoments, effects: app.state.gardenEffects, systems, memories: app.state.communityMemory };
  });
  check(stateEvidence.moments.includes('challenge'), 'challenge completion persists in the player journey');
  check(Object.keys(stateEvidence.effects).length === 1, 'the completed minigame persists its garden effect');
  check(stateEvidence.systems.links.length >= 1, 'nearby elements create visible spatial relationships');
  check(stateEvidence.memories.length >= 1, 'community gifts create persistent human notes');

  await page.getByTestId('reflection-button').click();
  check(await textVisible('The Garden Remembers'), 'the earned ending continues the garden voice');
  check(await textVisible('A decision with consequences'), 'the ending reflects one concrete player decision');
  check(await textVisible('A principle you practised'), 'the ending names a learned principle');
  check(await textVisible('One small action beyond the screen'), 'the ending proposes a real-world action');
  check(await page.locator('a[download][href^="blob:"]').count() === 1, 'the certificate unlocks only after the full learning arc');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(artifacts, '03-earned-ending.png') });

  const impactCoverage = await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    const keys = ['mulch','compost','hugel','rain','kitchen','ladybug','bee','shelter','pexeso','seeds','quiz'];
    let state = { ...app.state, journeyMoments: [], gardenEffects: {} };
    for (const key of keys) state = app.applyChallengeImpact(state, key);
    return Object.keys(state.gardenEffects);
  });
  check(impactCoverage.length === 11, 'every minigame records its learning without requiring a magical physical bonus');

  const freeContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const freePage = await freeContext.newPage();
  freePage.on('pageerror', error => errors.push('free-pageerror: ' + error.message));
  freePage.on('console', message => { if (message.type() === 'error') errors.push('free-console: ' + message.text()); });
  await freePage.goto(baseUrl, { waitUntil: 'networkidle' });
  await freePage.getByRole('button', { name: /Begin the story/i }).waitFor({ state: 'visible', timeout: 15000 });
  await freePage.getByRole('button', { name: /Skip story/i }).first().click();
  await freePage.waitForTimeout(1000);
  await freePage.getByTestId('choose-explore').click();
  check(await freePage.getByText('Food, seed & season', { exact: true }).isVisible(), 'Free Garden exposes the complete functional palette immediately');
  check(await freePage.getByText('Community sharing table', { exact: true }).isVisible(), 'Free Garden exposes community systems immediately');
  check(await freePage.getByRole('button', { name: /Advance to/i }).isVisible(), 'Free Garden exposes seasonal exploration immediately');
  await freeContext.close();

  check(errors.length === 0, 'no browser console or runtime errors were recorded' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log('ARTIFACTS  ' + artifacts);
} finally {
  await browser.close();
}
