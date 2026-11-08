import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './load-playwright.mjs';

const baseUrl = process.env.GAME_URL || 'https://permaculture-garden.vercel.app/';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');

// With EXPECT_LOCAL_BUILD=1 (the workflow after a production deployment, run on
// the deployed commit), the live site must serve exactly this checkout's build.
// The domain can take a moment to point at a new deployment, so it is asked again
// for up to 90 seconds.
if (process.env.EXPECT_LOCAL_BUILD === '1') {
  for (const file of ['index.html', 'game.fragment.html']) {
    const local = sha256(await readFile(path.join(root, file)));
    let live = '';
    for (let waited = 0; ; waited += 5000) {
      const response = await fetch(new URL(file, baseUrl), { headers: { 'cache-control': 'no-cache' } });
      if (!response.ok) throw new Error(`GET ${file} answered ${response.status}`);
      live = sha256(Buffer.from(await response.arrayBuffer()));
      if (live === local || waited >= 90000) break;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    if (live !== local) throw new Error(`${file} on ${baseUrl} is not this commit's build`);
    console.log(`PASS  ${file} on the live site is this commit's build`);
  }
}
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];

page.on('pageerror', error => errors.push('pageerror: ' + error.message));
page.on('console', message => {
  if (message.type() === 'error') errors.push('console: ' + message.text());
});
page.on('response', response => {
  if (response.url().startsWith(baseUrl) && response.status() >= 400) {
    errors.push(`http ${response.status()}: ${response.url()}`);
  }
});

const check = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log('PASS  ' + message);
};

const dismissGarden = async () => {
  const button = page.getByRole('button', { name: "Dismiss the garden's message" });
  if (await button.isVisible().catch(() => false)) await button.click();
};

const dismissGardenReflections = async () => {
  for (let i = 0; i < 12; i += 1) {
    const button = page.getByRole('button', { name: /Continue tending/i });
    if (await button.isVisible().catch(() => false)) await button.click();
    await page.waitForTimeout(450);
  }
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
  const paymentDialog = page.locator('[data-pg-dialog="payment"]');
  if (await paymentDialog.isVisible().catch(() => false)) {
    await paymentDialog.getByRole('button', { name: /Use \d+ shares?/i }).click();
  }
  await page.waitForTimeout(180);
  await dismissGarden();
  await dismissArrivals();
};

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const storyButton = page.getByRole('button', { name: /Begin the story/i });
  await storyButton.waitFor({ state: 'visible', timeout: 20000 });
  check(await storyButton.isVisible(), 'production opens on the cinematic story cover');

  await page.getByRole('button', { name: /Skip story/i }).first().click();
  await page.getByTestId('choose-guided').waitFor({ state: 'visible' });
  await page.getByTestId('choose-guided').click();
  await page.evaluate(() => { Math.random = () => 0.99; });

  await place('Compost', 0.28, 0.72);
  await place('Rain harvesting', 0.34, 0.68);
  await place('Hügelkultur bed', 0.41, 0.66);
  await place('Flower strip', 0.48, 0.64);
  check(await page.getByText('Community sharing table', { exact: true }).isVisible(), 'production reaches the community act through real player actions');

  await page.getByRole('button', { name: 'Pick ripe cherries', exact: true }).first().press('Enter');
  await page.getByRole('button', { name: /Give Cherries to the community table/i }).click();
  await page.waitForTimeout(220);
  await dismissGarden();
  check(await page.getByText('Turn to the next season', { exact: false }).first().isVisible(), 'production records a genuine surplus gift');
  await dismissGardenReflections();

  await page.getByRole('button', { name: /^(Next season|Advance to)/i }).click();
  const gate = page.locator('[data-pg-dialog="gate"]');
  await gate.waitFor({ state: 'visible', timeout: 10000 });
  check(await gate.isVisible(), 'production opens the seasonal learning challenge');
  check(errors.length === 0, 'production has no console, runtime, or failed same-origin request errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log('PRODUCTION SMOKE COMPLETE  ' + baseUrl);
} finally {
  await browser.close();
}
