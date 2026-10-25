import http from "node:http";
import path from "node:path";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import playwright from "./load-playwright.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm"
};

async function serveFile(request, response) {
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

const server = http.createServer((request, response) => void serveFile(request, response));
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}/`;

const locales = ["en", "cs", "de", "fr", "es", "pt-BR", "pl", "ru", "zh-CN"];
const viewports = [
  { key: "desktop", width: 1440, height: 900, expectedMode: "desktop" },
  { key: "tablet", width: 820, height: 1180, expectedMode: "tablet" },
  { key: "phone", width: 390, height: 844, expectedMode: "phone" }
];
const types = [
  "compost", "hugel", "rain", "mulch", "bughotel", "arch", "herbspiral",
  "pollinator", "greenhouse", "seedbank", "birdbath", "birdhouse", "bench",
  "sign", "appletree", "kitchen", "crop_potato", "crop_root", "crop_leafy",
  "crop_cabbage", "crop_herb"
];
const guilds = [
  "hotbed", "dripcorner", "foodforest", "pollinatorpair", "seedlibrary",
  "classroom", "nectarcover", "pestpatrol"
];

const state = {
  placed: types.map((type, index) => ({
    id: `matrix-${type}`,
    type,
    x: 10 + (index % 6) * 15,
    y: 24 + Math.floor(index / 6) * 19,
    stage: 3,
    placedAtTurn: 0
  })),
  shares: 24,
  budget: 480,
  pool: 82,
  goodwill: 10,
  given: 12,
  awarded: [],
  market: [],
  storySeen: true,
  introSeen: true,
  mode: "guided",
  journeyMoments: ["soil", "water", "food", "shelter", "share", "challenge"],
  gardenEffects: { mulch: 1, compost: 1, rain: 1, kitchen: 1, bee: 1, shelter: 1 },
  communityMemory: [],
  reflectionOpened: true,
  endingSeen: false,
  discovered: guilds,
  seenWildlife: ["worm", "bee", "bird", "hedgehog", "ladybug", "beetle"],
  sharedActs: 3,
  seasonTurns: 7,
  seedAllowance: {},
  seedStock: { crop_potato: 2, crop_root: 2, crop_leafy: 2, crop_cabbage: 2, crop_herb: 2 },
  unlocksSeen: ["sharing", "seedbank", "kitchen", "askgarden", "seedsaved"],
  grownHarvests: 10,
  preservedCount: 5,
  muted: true,
  playerName: "Alex",
  season: "Summer",
  springBonusDone: true,
  autumnHarvestDone: true,
  rakeRewardDone: true,
  springForageDone: true,
  springSprouts: 0,
  leafPiles: 0,
  cherryPicks: 0,
  returnQueue: [],
  basket: { cherries: 2, potato: 2, root: 2, leafy: 2, cabbage: 2, herb: 2 },
  materials: { planks: 1, window: 1, bricks: 1, straw: 1 },
  harvestEver: true,
  gatesPlayed: { mulch: 1, compost: 1, rain: 1, kitchen: 1, bee: 1, shelter: 1 },
  guests: ["worm", "bee", "bird"],
  visitsDone: { worm: "won", bee: "won", bird: "won" },
  payWith: "shares",
  residentBeatsSeen: [],
  residentSeasons: {},
  residentWinters: {},
  pestActive: null,
  pestSeasons: {},
  pestCleared: {},
  pestRelief: {},
  pestBeatsSeen: []
};

const quiet = {
  story: false,
  intro: false,
  headerMenuOpen: false,
  bookOpen: false,
  kitchenOpen: false,
  seedbankOpen: false,
  livingLesson: null,
  residentStory: null,
  pestStory: null,
  unlockCard: null,
  gardenWhisper: null,
  gardenWhisperReplay: null,
  gardenReflection: null,
  gardenCinematic: null,
  gate: null,
  visit: null,
  inspectCritter: null,
  arrivalQueue: [],
  returnQueue: [],
  guildCard: null,
  guildReview: false,
  showGuilds: false,
  showSummary: false,
  toast: null
};

const report = [];
const failures = [];
const browser = await playwright.chromium.launch({ headless: true });

function expectedBrowserLocale(locale) {
  return {
    en: "en-US",
    cs: "cs-CZ",
    de: "de-DE",
    fr: "fr-FR",
    es: "es-ES",
    "pt-BR": "pt-BR",
    pl: "pl-PL",
    ru: "ru-RU",
    "zh-CN": "zh-CN"
  }[locale];
}

async function twoFrames(page) {
  await page.evaluate(() => new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  ));
}

async function setState(page, patch) {
  await page.evaluate(({ base, next }) => {
    const app = window.__PERMAGARDEN_APP__;
    for (const key of [
      "_residentStoryT", "_pestStoryT", "_unlockT", "_whisperStartT",
      "_reflectionT", "_cinematicVoiceT", "_gateIv"
    ]) {
      if (app[key]) {
        clearTimeout(app[key]);
        clearInterval(app[key]);
      }
      app[key] = null;
    }
    return new Promise(resolve => app.setState({ ...base, ...next }, resolve));
  }, { base: quiet, next: patch });
  await twoFrames(page);
}

async function inspect(page, locale, viewport, surface) {
  const evidence = await page.evaluate(() => {
    const rootElement = document.documentElement;
    const dialog = [...document.querySelectorAll("[data-pg-dialog]")].find(element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" &&
        rect.width > 1 && rect.height > 1;
    });
    const rect = dialog?.getBoundingClientRect();
    const clipped = dialog
      ? [...dialog.querySelectorAll("button,h1,h2,h3,label")]
        .filter(element => {
          const style = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          return box.width > 1 && box.height > 1 &&
            style.whiteSpace === "nowrap" &&
            style.overflowX === "hidden" &&
            element.scrollWidth > element.clientWidth + 3;
        })
        .map(element => (element.textContent || element.getAttribute("aria-label") || "").trim().slice(0, 120))
        .filter(Boolean)
      : [];
    const result = {
      locale: window.PermacultureI18n?.locale,
      htmlLang: rootElement.lang,
      viewportMode: document.querySelector(".pg-game-shell")?.getAttribute("data-viewport"),
      globalOverflow: rootElement.scrollWidth > window.innerWidth + 1 ||
        document.body.scrollWidth > window.innerWidth + 1,
      dialogOutsideViewport: rect
        ? rect.left < -1 || rect.right > window.innerWidth + 1 ||
          rect.top < -1 || rect.bottom > window.innerHeight + 1
        : false,
      clipped,
      missing: window.PermacultureI18n?.missing || [],
      fontFamily: getComputedStyle(document.body).fontFamily
    };
    window.PermacultureI18n?.clearMissing?.();
    return result;
  });
  const item = { locale, viewport: viewport.key, surface, ...evidence };
  report.push(item);
  if (
    evidence.locale !== locale ||
    evidence.htmlLang !== locale ||
    evidence.viewportMode !== viewport.expectedMode ||
    evidence.globalOverflow ||
    evidence.dialogOutsideViewport ||
    evidence.clipped.length ||
    (locale !== "en" && evidence.missing.length)
  ) failures.push(item);
}

try {
  for (const locale of locales) {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: "reduce",
        locale: expectedBrowserLocale(locale)
      });
      await context.addInitScript(({ key, value }) => {
        localStorage.setItem(key, JSON.stringify(value));
      }, { key: "permagarden_v2", value: state });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
      page.on("console", message => {
        if (
          message.type() === "error" ||
          (message.type() === "warning" && /\[dc-runtime\]|never resolved/u.test(message.text()))
        ) errors.push(`console ${message.type()}: ${message.text()}`);
      });
      try {
        await page.goto(`${baseUrl}?lang=${encodeURIComponent(locale)}`, { waitUntil: "networkidle" });
        await page.waitForFunction(expected =>
          window.__PERMAGARDEN_APP__ && window.PermacultureI18n?.locale === expected,
        locale, { timeout: 30000 });
        await inspect(page, locale, viewport, "main");

        await setState(page, { headerMenuOpen: true });
        await inspect(page, locale, viewport, "menu");

        await setState(page, { intro: true });
        await inspect(page, locale, viewport, "intro");

        await setState(page, { story: true, storyStarted: true, storyPaused: true, storyScene: 6, storyToIntro: true });
        await inspect(page, locale, viewport, "story");

        await setState(page, { bookOpen: true, bookTab: "keeping", bookLeaf: 5 });
        await inspect(page, locale, viewport, "book");

        const gate = await page.evaluate(() => {
          const app = window.__PERMAGARDEN_APP__;
          const definition = app.gateDefs().seeds;
          return { key: "seeds", target: "Autumn", status: "play", d: definition.init(app.state, "Autumn") };
        });
        await setState(page, { gate });
        await inspect(page, locale, viewport, "challenge");

        await setState(page, { visit: { key: "bird", status: "ask", picked: [] }, visitSeason: "Summer" });
        await inspect(page, locale, viewport, "visitor");

        await setState(page, { showSummary: true, endingSeen: true });
        await inspect(page, locale, viewport, "summary");

        const cinematic = await page.evaluate(() => {
          const passage = window.__PERMAGARDEN_APP__.seasonPassages.Winter;
          return {
            season: "Winter",
            title: passage.title,
            text: passage.voice,
            image: passage.image,
            loop: ""
          };
        });
        await setState(page, { gardenCinematic: cinematic, season: "Winter" });
        await inspect(page, locale, viewport, "cinematic");

        if (errors.length) {
          const item = { locale, viewport: viewport.key, surface: "browser", errors };
          report.push(item);
          failures.push(item);
        }
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

await mkdir(path.join(root, ".tmp"), { recursive: true });
await writeFile(
  path.join(root, ".tmp", "i18n-layout-matrix.json"),
  `${JSON.stringify({ checks: report.length, failures }, null, 2)}\n`,
  "utf8"
);

if (failures.length) {
  console.error(`i18n layout matrix failed: ${failures.length} of ${report.length} checks.`);
  console.error(JSON.stringify(failures.slice(0, 12), null, 2));
  process.exitCode = 1;
} else {
  console.log(`i18n layout matrix passed: ${locales.length} locales × ${viewports.length} viewports × 9 surfaces.`);
}
