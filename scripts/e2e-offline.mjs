// Playing without a connection (package J-05), the way a player does it:
// download the game from its panel, switch the server off, play the first act,
// then publish a newer build and check that it waits for the next start, keeps
// the garden in progress and downloads only what changed.
// The test runs its own server, because it has to stop it and change files.
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './load-playwright.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.OFFLINE_PORT || 8797);
const base = `http://127.0.0.1:${port}/`;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json; charset=utf-8', '.pdf': 'application/pdf'
};

let failures = 0;
const check = (condition, message, evidence) => {
  if (condition) { console.log('PASS  ' + message); return; }
  failures++;
  console.log('FAIL  ' + message + (evidence === undefined ? '' : '\nEvidence: ' + JSON.stringify(evidence, null, 2)));
};

// ── the server: the repository, plus files a test build replaces ──
const overrides = new Map();
let requests = [];
let server = null;
function start() {
  server = createServer(async (request, response) => {
    const url = new URL(request.url || '/', base);
    const relative = decodeURIComponent(url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, ''));
    requests.push(relative);
    try {
      let body = overrides.get(relative);
      if (!body) {
        const file = path.resolve(root, relative);
        if (!file.startsWith(root + path.sep) || !(await stat(file)).isFile()) throw new Error('missing');
        body = await readFile(file);
      }
      response.writeHead(200, { 'Content-Type': types[path.extname(relative).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (_) {
      response.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    }
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
}
function stop() {
  if (server.closeAllConnections) server.closeAllConnections();
  return new Promise(resolve => server.close(() => resolve()));
}

const manifest = JSON.parse(await readFile(path.join(root, 'offline-manifest.json'), 'utf8'));
const offline = createRequire(import.meta.url)('../lib/offline.js');
await start();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'allow' });
const page = await context.newPage();
const errors = [];
const failed = [];
// Which part of the journey an error belongs to, so a failure names its moment.
let part = '1. download';
page.on('pageerror', error => errors.push(`[${part}] pageerror: ` + error.message));
// A load that fails is reported here in each browser's words (Firefox: "A ServiceWorker
// intercepted the request…"); which loads may fail is checked on its own below.
page.on('console', message => {
  if (message.type() === 'error' && !/Failed to load resource|net::ERR_|A ServiceWorker intercepted the request and encountered an unexpected error/.test(message.text())) errors.push(`[${part}] console: ` + message.text());
});
page.on('requestfailed', request => failed.push(request.url()));
// The server is switched off on purpose; a picture still on its way would be cut
// off and reported as corrupt (Firefox: "Image corrupt or truncated"), so the
// journey waits until nothing is loading before it stops the server.
let loading = 0;
page.on('request', () => { loading += 1; });
page.on('requestfinished', () => { loading = Math.max(0, loading - 1); });
page.on('requestfailed', () => { loading = Math.max(0, loading - 1); });
async function quiet(timeout = 15000) {
  const end = Date.now() + timeout;
  while (loading > 0 && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 100));
  await new Promise(resolve => setTimeout(resolve, 200));
}
page.on('dialog', dialog => dialog.accept());

const app = fn => page.evaluate(fn);
// page.waitForFunction does not wait for a promise, so poll from here
async function until(target, fn, arg, timeout = 30000) {
  const end = Date.now() + timeout;
  for (;;) {
    const value = await target.evaluate(fn, arg).catch(() => false);
    if (value) return value;
    if (Date.now() > end) throw new Error('Timed out waiting for ' + fn.toString().slice(0, 120));
    await new Promise(resolve => setTimeout(resolve, 400));
  }
}
// close whatever the garden opens on its own (the welcome, unlock cards…)
async function clearDialogs() {
  for (let i = 0; i < 12; i++) {
    const open = await app(() => window.__PERMAGARDEN_APP__ ? window.__PERMAGARDEN_APP__.activeDialogKey() : 'booting');
    if (!open) return;
    const later = page.locator('.pg-unlock-later');
    if (await later.count()) await later.first().click({ force: true });
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
  }
}
async function gardenReady() {
  await page.waitForFunction(() => !!window.__PERMAGARDEN_APP__ && !!document.querySelector('[data-plot]'), null, { timeout: 30000 });
  await page.waitForTimeout(500);
}
const footerVersion = () => page.locator('[data-pg-version]').first().innerText();

// ── 1. a fresh player skips the story and downloads the game ──
await page.goto(base, { waitUntil: 'load' });
await page.getByRole('button', { name: 'Skip story' }).filter({ visible: true }).first().click();
await gardenReady();
await clearDialogs();
check(await page.evaluate(() => !navigator.serviceWorker.controller), 'a player who never chose it gets no service worker');

const tool = page.locator('[data-testid="offline-open"]');
check(await tool.isVisible(), 'the header offers “Play without a connection” on a laptop');
await tool.click();
const dialog = page.locator('[data-pg-dialog="offline"]');
await dialog.waitFor();
await page.locator('[data-testid="offline-size"]').filter({ hasText: 'MB' }).waitFor({ timeout: 15000 });
const expected = offline.formatSize(offline.bytesOf(manifest, offline.filesFor(manifest, { locale: 'en', voice: true, music: false })), 'en');
const sizeText = await page.locator('[data-testid="offline-size"]').innerText();
check(sizeText.includes(expected), 'the panel names the download size before anything is downloaded', { sizeText, expected });
check(await dialog.getAttribute('aria-labelledby') === 'pg-off-title' && (await page.locator('#pg-off-title').innerText()) === 'Play without a connection', 'the panel is a named dialog');
check(await page.locator('[data-testid="offline-voice"]').isChecked() && !(await page.locator('[data-testid="offline-music"]').isChecked()), 'voice is chosen and music is not, by default');

requests = [];
await page.locator('[data-testid="offline-download"]').click();
await page.locator('[data-testid="offline-ready"]').waitFor({ timeout: 90000 });
const listed = new Set(offline.filesFor(manifest, { locale: 'en', voice: true, music: false }));
const fetchedDuringDownload = new Set(requests.filter(r => listed.has(r)));
check(fetchedDuringDownload.size === listed.size, 'the download fetched every file of the package', { fetched: fetchedDuringDownload.size, listed: listed.size });
check(!requests.some(r => /\.(webm|mp4)$/.test(r)), 'moving pictures are not part of the download');
await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
check(true, 'after the download a service worker looks after the page');
const status = await page.locator('[data-testid="offline-status"]').innerText();
check(/without a connection/.test(status), 'the panel says the game now plays without a connection', status);
await page.keyboard.press('Escape');
await dialog.waitFor({ state: 'detached' });
check(await page.evaluate(() => document.activeElement && document.activeElement.dataset.testid === 'offline-open'), 'Escape closes the panel and focus returns to its button');

// ── 2. the server is switched off: the game opens and the first act is played ──
await quiet();
part = '2. offline play';
await stop();
failed.length = 0;
await page.reload({ waitUntil: 'load' });
await gardenReady();
await clearDialogs();
check(await page.locator('[data-plot]').isVisible(), 'with the server off the game opens from the download');
const actBefore = await app(() => window.__PERMAGARDEN_APP__.journeyModel().index);
await page.locator('[data-drag-type="compost"]').first().click();
const plot = await page.locator('[data-plot]').boundingBox();
await page.mouse.click(plot.x + plot.width * 0.3, plot.y + plot.height * 0.62);
await page.waitForTimeout(400);
if (await page.locator('[data-pg-dialog="payment"]').count()) {
  await page.locator('[data-pg-dialog="payment"] button').first().click();
}
await page.waitForFunction(() => window.__PERMAGARDEN_APP__.state.placed.some(item => item.type === 'compost'), null, { timeout: 10000 });
await clearDialogs();
const journey = await app(() => { const j = window.__PERMAGARDEN_APP__.journeyModel(); return { index: j.index, soil: j.steps[0].done }; });
check(actBefore === 0 && journey.soil && journey.index === 1, 'without a connection the first act is played to its end', { actBefore, journey });
const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('permagarden_v2') || '{}'));
check(Array.isArray(saved.placed) && saved.placed.some(item => item.type === 'compost'), 'the garden is saved as usual');
// music was not chosen and moving pictures are never downloaded: those may fail
const inPackage = url => { const p = new URL(url).pathname.replace(/^\//, ''); return listed.has(p === '' ? 'index.html' : p); };
const unexpected = failed.filter(inPackage);
check(unexpected.length === 0, 'offline, everything the download holds was answered from it', unexpected);
// (WebKit also asks for sw.js, its own check for a newer worker)
check(failed.every(url => /\.(webm|mp4|mp3)(\?|$)|\/sw\.js(\?|$)/.test(url)), 'offline, only sound and moving pictures left out of the download are missing', failed);

// ── 3. a newer build is published while the game is open ──
part = '3. update';
const template = await readFile(path.join(root, 'game.template.js'), 'utf8');
const oldVersion = await footerVersion();
const newTemplate = template.replace(/("data-pg-version": "true"[^}]*\},\s*)"[^"]*"/, '$1' + JSON.stringify(oldVersion + '-next'));
if (newTemplate === template) throw new Error('The version in game.template.js was not found.');
const digest = text => createHash('sha256').update(text).digest('hex').slice(0, 16);
const nextManifest = JSON.parse(JSON.stringify(manifest));
nextManifest.files['game.template.js'] = [Buffer.byteLength(newTemplate), digest(newTemplate)];
nextManifest.version = digest(manifest.version + '-next');
const worker = (await readFile(path.join(root, 'sw.js'), 'utf8')).replace(/^const VERSION = "[0-9a-f]+";$/m, `const VERSION = "${nextManifest.version}";`);
overrides.set('game.template.js', Buffer.from(newTemplate));
overrides.set('offline-manifest.json', Buffer.from(JSON.stringify(nextManifest)));
overrides.set('sw.js', Buffer.from(worker));
await start();
requests = [];
await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration.update(); });
await until(page, async () => { const registration = await navigator.serviceWorker.getRegistration(); return !!(registration && registration.waiting); }, null, 60000);
const fetchedForUpdate = requests.filter(r => !/^(sw\.js|lib\/offline\.js|offline-manifest\.json)$/.test(r));
check(fetchedForUpdate.length === 1 && fetchedForUpdate[0] === 'game.template.js', 'the newer build downloads in the background, only the file that changed', requests);
check(await footerVersion() === oldVersion, 'the game in progress keeps its version while it is played', await footerVersion());
await tool.click();
await page.locator('[data-testid="offline-update"]').waitFor({ timeout: 10000 });
check(true, 'the panel says a newer version is ready');
await page.keyboard.press('Escape');
await dialog.waitFor({ state: 'detached' });

// ── 4. the next start uses the newer build, with the same garden ──
part = '4. newer build';
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(next => { const v = document.querySelector('[data-pg-version]'); return v && v.textContent === next; }, oldVersion + '-next', { timeout: 30000 });
await gardenReady();
await clearDialogs();
check(true, 'the next start runs the newer build');
const after = await app(() => ({ compost: window.__PERMAGARDEN_APP__.state.placed.some(item => item.type === 'compost'), index: window.__PERMAGARDEN_APP__.journeyModel().index }));
check(after.compost && after.index === 1, 'the update kept the garden in progress and its act', after);
await quiet();
await stop();
await page.reload({ waitUntil: 'load' });
await gardenReady();
check(await footerVersion() === oldVersion + '-next', 'without a connection the newer build opens from its own download');
const caches = await page.evaluate(() => caches.keys());
check(caches.filter(name => name.startsWith('lj-offline-') && name !== 'lj-offline-settings').length === 1 && caches.includes('lj-offline-' + nextManifest.version), 'the older download was removed after the update', caches);

// ── 5. removing the download ──
part = '5. removal';
overrides.clear();
await start();
await clearDialogs();
await tool.click();
await page.locator('[data-testid="offline-remove"]').click();
await until(page, async () => (await caches.keys()).every(name => !name.startsWith('lj-offline-')) && !(await navigator.serviceWorker.getRegistration()), null, 15000);
check(true, 'removing the download deletes it and the service worker');
check(await page.evaluate(() => !!localStorage.getItem('permagarden_v2')), 'removing the download keeps the garden');
await context.close();

// ── 6. a phone in Czech: the menu leads to the panel, and it fits ──
const phone = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', locale: 'cs-CZ' });
const p2 = await phone.newPage();
p2.on('pageerror', error => errors.push('[6. phone] pageerror: ' + error.message));
await p2.goto(base + '?lang=cs', { waitUntil: 'load' });
await p2.getByRole('button', { name: /Přeskočit/ }).filter({ visible: true }).first().click();
await p2.waitForFunction(() => !!window.__PERMAGARDEN_APP__ && !!document.querySelector('[data-plot]'), null, { timeout: 30000 });
for (let i = 0; i < 12; i++) {
  if (!(await p2.evaluate(() => window.__PERMAGARDEN_APP__.activeDialogKey()))) break;
  await p2.keyboard.press('Escape');
  await p2.waitForTimeout(350);
}
check(!(await p2.locator('[data-testid="offline-open"]').isVisible()), 'phone: the header tool gives way to the menu');
await p2.locator('#pg-header-more').click();
await p2.locator('[data-testid="offline-open-menu"]').click();
await p2.locator('[data-testid="offline-size"]').filter({ hasText: 'MB' }).waitFor({ timeout: 15000 });
const czech = await p2.evaluate(() => {
  const d = document.querySelector('[data-pg-dialog="offline"]');
  const box = d.getBoundingClientRect();
  return { title: document.getElementById('pg-off-title').textContent, size: document.querySelector('[data-testid="offline-size"]').textContent, inside: box.left >= 0 && box.right <= window.innerWidth + 0.5, scroll: document.documentElement.scrollWidth <= window.innerWidth };
});
check(czech.title === 'Hrát bez připojení' && /\d,\d|\d MB/.test(czech.size), 'phone: the panel speaks Czech and writes sizes the Czech way', czech);
check(czech.inside && czech.scroll, 'phone: the panel fits a 360 px screen', czech);
await p2.keyboard.press('Escape');
await p2.waitForTimeout(300);
check(await p2.evaluate(() => document.activeElement && document.activeElement.id === 'pg-header-more'), 'phone: focus returns to the menu button');
await phone.close();

await browser.close();
await stop();
check(errors.length === 0, 'no page or console errors', errors);
if (failures) {
  console.log(`\n${failures} offline check(s) failed.`);
  process.exit(1);
}
console.log('\nPlaying without a connection: download, offline play, update and removal OK.');
