import path from "node:path";
import http from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleRoot = process.env.CODEX_NODE_MODULES;
let playwright;
if (moduleRoot) {
  const direct = path.join(moduleRoot, "playwright", "index.mjs");
  try {
    playwright = await import(pathToFileURL(direct).href);
  } catch (_) {
    const pnpmRoot = path.join(moduleRoot, ".pnpm");
    const packageDir = (await readdir(pnpmRoot)).find(name => /^playwright@[^-]/.test(name));
    if (!packageDir) throw new Error("Playwright package was not found under " + moduleRoot);
    playwright = await import(pathToFileURL(path.join(pnpmRoot, packageDir, "node_modules", "playwright", "index.mjs")).href);
  }
} else {
  playwright = await import("playwright");
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4"
};

async function staticResponse(request, response) {
  try {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^[/\\]+/, "");
    const filename = path.resolve(root, relative);
    if (filename !== root && !filename.startsWith(root + path.sep)) throw new Error("outside_root");
    const info = await stat(filename);
    if (!info.isFile()) throw new Error("not_file");
    response.writeHead(200, {
      "Content-Type": mime[path.extname(filename).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(await readFile(filename));
  } catch (_) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

const externalUrl = process.env.GAME_URL;
let server;
let baseUrl = externalUrl;
if (!baseUrl) {
  server = http.createServer((request, response) => void staticResponse(request, response));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}/`;
}

const assert = (condition, message, evidence) => {
  if (!condition) throw new Error(`${message}${evidence === undefined ? "" : `\nEvidence: ${JSON.stringify(evidence, null, 2)}`}`);
  console.log("PASS  " + message);
};

const savedState = {
  placed: [{ id: "i18n-bench", type: "bench", x: 50, y: 62, placedAtTurn: 0 }],
  shares: 9,
  budget: 271,
  pool: 65,
  goodwill: 0,
  given: 0,
  awarded: [],
  market: [],
  storySeen: true,
  introSeen: true,
  mode: "explore",
  journeyMoments: [],
  gardenEffects: {},
  season: "Summer",
  muted: true
};

const browser = await playwright.chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "en-US" });
  await context.addInitScript(([key, value]) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, value);
  }, ["permagarden_v2", JSON.stringify(savedState)]);
  const page = await context.newPage();
  const localeRequests = [];
  page.on("request", request => {
    const match = request.url().match(/catalog\.([^.]+(?:-[^.]+)?)\.json(?:[?#]|$)/u);
    if (match) localeRequests.push(match[1]);
  });

  await page.goto(baseUrl + "?lang=cs", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="language-select-header"]', { state: "attached", timeout: 30000 });
  await page.waitForFunction(() => window.PermacultureI18n && window.PermacultureI18n.ready);
  const czech = await page.evaluate(() => ({
    htmlLang: document.documentElement.lang,
    locale: window.PermacultureI18n.locale,
    selected: document.querySelector('[data-testid="language-select-header"]')?.value,
    garden: window.PermacultureI18n.translateValue("Garden")
  }));
  assert(czech.htmlLang === "cs" && czech.locale === "cs" && czech.selected === "cs", "query locale reaches HTML, runtime and selector", czech);
  assert(czech.garden !== "Garden", "Czech catalog translates a known English UI phrase", czech);
  assert(
    [...new Set(localeRequests)].sort().join(",") === "cs,en",
    "startup fetches English plus only the selected locale",
    localeRequests
  );

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    page.selectOption('[data-testid="language-select-header"]', "de")
  ]);
  await page.waitForSelector('[data-testid="language-select-header"]', { state: "attached", timeout: 30000 });
  const changed = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("permagarden_v2") || "{}");
    return {
      htmlLang: document.documentElement.lang,
      storedLocale: localStorage.getItem("permagarden_locale_v1"),
      selected: document.querySelector('[data-testid="language-select-header"]')?.value,
      shares: saved.shares,
      budget: saved.budget,
      bench: Array.isArray(saved.placed) && saved.placed.some(item => item.id === "i18n-bench")
    };
  });
  assert(changed.htmlLang === "de" && changed.storedLocale === "de" && changed.selected === "de", "selector persists and reloads the chosen locale", changed);
  assert(changed.shares === 9 && changed.budget === 271 && changed.bench, "language reload preserves the saved garden", changed);

  await page.goto(baseUrl + "?lang=zh-Hans-CN", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="language-select-header"]', { state: "attached", timeout: 30000 });
  const chinese = await page.evaluate(() => ({
    htmlLang: document.documentElement.lang,
    locale: window.PermacultureI18n.locale,
    selected: document.querySelector('[data-testid="language-select-header"]')?.value
  }));
  assert(chinese.htmlLang === "zh-CN" && chinese.locale === "zh-CN" && chinese.selected === "zh-CN", "Chinese script variant normalizes safely", chinese);

  await page.goto(baseUrl + "?lang=pl-PL", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="language-select-header"]', { state: "attached", timeout: 30000 });
  const polish = await page.evaluate(() => {
    const values = window.__PERMAGARDEN_APP__.renderVals();
    const items = values.groups.flatMap(group => group.items || []);
    return {
      htmlLang: document.documentElement.lang,
      locale: window.PermacultureI18n.locale,
      selected: document.querySelector('[data-testid="language-select-header"]')?.value,
      garden: window.PermacultureI18n.translateValue("Garden"),
      plotTitle: window.PermacultureI18n.translateValue("Your garden plot"),
      acts: window.PermacultureI18n.translateValue("acts"),
      mulchHelp: items.find(item => item.type === "mulch")?.termHelp,
      pillarNames: values.pillars.map(item => item.name),
      pillarTips: values.pillars.map(item => item.tip),
      englishDialVisible: [...document.querySelectorAll("svg text")]
        .some(node => (node.textContent || "").trim() === "RESILIENCE")
    };
  });
  assert(polish.htmlLang === "pl" && polish.locale === "pl" && polish.selected === "pl", "Polish regional locale normalizes safely", polish);
  assert(polish.garden !== "Garden", "Polish catalog translates a known English UI phrase", polish);
  assert(polish.plotTitle !== "Your garden plot" && polish.acts !== "acts", "Polish translates startup and composed progress fragments", polish);
  assert(
    polish.mulchHelp && polish.mulchHelp !== "a protective surface cover laid without digging it into the soil",
    "Polish translates contextual permaculture help", polish
  );
  assert(
    ["Soil", "Water", "Food", "Habitat", "Sharing"].every(name => !polish.pillarNames.includes(name)) &&
      polish.pillarTips.every(tip => !/\b(?:Living soil|Water security|Food web|Fair share)\b/u.test(tip)),
    "Polish translates the design-system pillars and their explanations", polish
  );
  assert(!polish.englishDialVisible, "Polish translates the connections score dial", polish);

  await context.close();
  console.log("i18n browser checks passed.");
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
