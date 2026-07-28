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
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push('pageerror: ' + error.message));
page.on('console', message => { if (message.type() === 'error') errors.push('console: ' + message.text()); });

const check = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log('PASS  ' + message);
};
const challenges = [
  ['mulch', 'Summer'], ['compost', 'Spring'], ['hugel', 'Spring'], ['rain', 'Summer'],
  ['kitchen', 'Autumn'], ['ladybug', 'Summer'], ['bee', 'Spring'], ['shelter', 'Winter'],
  ['pexeso', 'Autumn'], ['seeds', 'Autumn'], ['quiz', 'Winter']
];

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Begin the story/i }).waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('button', { name: /Skip story/i }).first().click();
  await page.getByTestId('choose-explore').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('choose-explore').click();
  await page.waitForTimeout(250);

  const voiceAudit = await page.evaluate(async () => {
    const app = window.__PERMAGARDEN_APP__;
    const manifest = await fetch('assets/audio/garden-voice/manifest.json').then(response => {
      if (!response.ok) throw new Error(`Garden voice manifest returned ${response.status}`);
      return response.json();
    });
    const loadDuration = file => new Promise((resolve, reject) => {
      const audio = new Audio(`assets/audio/garden-voice/${file}`);
      audio.preload = 'metadata';
      audio.addEventListener('loadedmetadata', () => resolve(audio.duration), { once: true });
      audio.addEventListener('error', () => reject(new Error(`Could not load ${file}`)), { once: true });
    });
    const durations = await Promise.all(manifest.files.map(entry => loadDuration(entry.file)));
    // Two kinds of voice line, two honest budgets. Milestone whispers land over the plot
    // and must stay short; the resident and pest arcs are narrated story beats shown with
    // their own artwork in a dialog, so they run longer by design.
    const beatIds = manifest.files.map(entry => entry.id);
    const longForm = id => /^(aphid|slug|caterpillar|hedgehog|bee|worm)-\d$/.test(id);
    return {
      voice: manifest.voice,
      entries: manifest.files.length,
      uniqueIds: new Set(manifest.files.map(entry => entry.id)).size,
      runtimeMappings: Object.keys(app.gardenVoiceFiles).length,
      residentCoverage: app.residentStories
        .flatMap(resident => resident.beats.map(beat => beat.id))
        .every(id => manifest.files.some(entry => entry.id === id)),
      captionsComplete: manifest.files.every(entry => typeof entry.text === 'string' && entry.text.trim().length > 20),
      mapped: manifest.files.every(entry => app.gardenVoiceFiles[entry.id] === `assets/audio/garden-voice/${entry.file}`),
      finiteDurations: durations.every((duration, index) =>
        Number.isFinite(duration) && duration >= 2 &&
        duration <= (longForm(beatIds[index]) ? 32 : 12))
    };
  });
  check(voiceAudit.voice === 'The Garden of Menet', 'garden voice uses the selected Voice 1 identity');
  check(
    voiceAudit.entries === 31 &&
      voiceAudit.uniqueIds === 31 &&
      voiceAudit.runtimeMappings === 31 &&
      voiceAudit.residentCoverage,
    'all 31 intentional garden voice moments, including resident stories, are unique and mapped'
  );
  check(voiceAudit.captionsComplete && voiceAudit.mapped, 'every garden voice has an exact caption and runtime mapping');
  check(voiceAudit.finiteDurations, 'garden voice MP3 files respect their category budget (whispers under 12s, story beats under 32s)');

  await page.evaluate(() => {
    const app = window.__PERMAGARDEN_APP__;
    app.setState({ discovered: app.guildDefs.map(def => def.key) });
  });
  await page.waitForTimeout(100);

  for (const [key, target] of challenges) {
    await page.evaluate(({ key, target }) => window.__PERMAGARDEN_APP__.startGate(key, target), { key, target });
    await page.locator('.pg-gate-dialog').waitFor({ state: 'visible', timeout: 3000 });
    await page.locator('.pg-gate-hero img').waitFor({ state: 'visible', timeout: 3000 });
    await page.waitForFunction(() => {
      const image = document.querySelector('.pg-gate-hero img');
      return image?.complete && image.naturalWidth > 0;
    }, null, { timeout: 5000 });
    const briefing = await page.evaluate(() => {
      const dialog = document.querySelector('.pg-gate-dialog');
      const hero = dialog?.querySelector('.pg-gate-hero img');
      const rect = dialog?.getBoundingClientRect();
      return {
        dialogVisible: !!rect && rect.width > 0 && rect.height > 0,
        contained: !!rect && rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth,
        noHorizontalOverflow: !!dialog && dialog.scrollWidth <= dialog.clientWidth + 1,
        imageLoaded: !!hero && hero.complete && hero.naturalWidth > 0,
        title: dialog?.querySelector('h2')?.textContent?.trim() || ''
      };
    });
    check(briefing.dialogVisible && briefing.contained, `${key}: briefing stays inside the desktop viewport`);
    check(briefing.noHorizontalOverflow, `${key}: briefing has no horizontal overflow`);
    check(briefing.imageLoaded, `${key}: seasonal passage image is loaded`);
    check(briefing.title.length > 0, `${key}: challenge title is present`);

    await page.getByRole('button', { name: /Start challenge/i }).click();
    await page.waitForTimeout(80);
    const play = await page.evaluate(() => {
      const dialog = document.querySelector('.pg-gate-dialog');
      const rect = dialog?.getBoundingClientRect();
      const board = dialog?.querySelector('[data-testid="gate-board"]');
      const boardRect = board?.getBoundingClientRect();
      const controls = dialog?.querySelectorAll('button,[role="button"]').length || 0;
      return {
        contained: !!rect && rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth,
        noHorizontalOverflow: !!dialog && dialog.scrollWidth <= dialog.clientWidth + 1,
        boardVisible: !!boardRect && boardRect.width > 0 && boardRect.height > 0,
        controls
      };
    });
    check(play.contained && play.noHorizontalOverflow, `${key}: play view remains contained without horizontal overflow`);
    check(play.boardVisible && play.controls > 0, `${key}: play board and controls render`);

    await page.evaluate(() => {
      const app = window.__PERMAGARDEN_APP__;
      app.gateResolve({ ...app.state.gate.d }, 'won');
    });
    await page.waitForTimeout(80);
    const result = await page.evaluate(() => {
      const app = window.__PERMAGARDEN_APP__;
      const dialog = document.querySelector('.pg-gate-dialog');
      return {
        won: app.state.gate?.status === 'won',
        lesson: app.buildGateView().lesson || '',
        continueButton: Array.from(dialog?.querySelectorAll('button') || []).some(button => /Continue to/i.test(button.textContent || '')),
        noHorizontalOverflow: !!dialog && dialog.scrollWidth <= dialog.clientWidth + 1
      };
    });
    check(result.won && result.lesson.length > 40, `${key}: result explains the learning outcome`);
    check(result.continueButton && result.noHorizontalOverflow, `${key}: result offers a contained seasonal continuation`);

    await page.evaluate(() => {
      const app = window.__PERMAGARDEN_APP__;
      clearInterval(app._gateIv);
      app.setState({ gate: null, gardenCinematic: null });
    });
    await page.waitForTimeout(40);
  }

  check(errors.length === 0, 'all challenge views complete without browser errors');
  console.log(`\nRelease audit passed for ${challenges.length} minigames.`);
} finally {
  await browser.close();
}
