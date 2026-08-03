import http from "node:http";
import path from "node:path";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleRoot = process.env.CODEX_NODE_MODULES;
const supportedLocales = ["cs", "de", "fr", "es", "pt-BR", "pl", "ru", "zh-CN"];
const localeArgumentIndex = process.argv.indexOf("--locale");
const targetLocale = localeArgumentIndex >= 0 ? process.argv[localeArgumentIndex + 1] : "cs";
if (!supportedLocales.includes(targetLocale)) {
  throw new Error(
    `Unsupported --locale ${JSON.stringify(targetLocale)}. Expected one of: ${supportedLocales.join(", ")}.`
  );
}
const browserLocales = {
  cs: "cs-CZ",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
  "pt-BR": "pt-BR",
  pl: "pl-PL",
  ru: "ru-RU",
  "zh-CN": "zh-CN"
};
let playwright;
if (moduleRoot) {
  const direct = path.join(moduleRoot, "playwright", "index.mjs");
  try {
    playwright = await import(pathToFileURL(direct).href);
  } catch (_) {
    playwright = await import("playwright");
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
  ".mp4": "video/mp4",
  ".webm": "video/webm"
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

const server = http.createServer((request, response) => void staticResponse(request, response));
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}/`;

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
const wildlife = [
  "worm", "winecap", "oyster", "field", "bee", "butterfly", "bird",
  "hedgehog", "ladybug", "beetle"
];
const challenges = [
  "mulch", "compost", "hugel", "rain", "kitchen", "ladybug", "bee",
  "shelter", "pexeso", "seeds", "quiz"
];
const challengeTargets = {
  mulch: "Summer",
  compost: "Autumn",
  hugel: "Spring",
  rain: "Spring",
  kitchen: "Autumn",
  ladybug: "Summer",
  bee: "Autumn",
  shelter: "Winter",
  pexeso: "Spring",
  seeds: "Autumn",
  quiz: "Summer"
};

const placed = types.map((type, index) => ({
  id: `audit-${type}`,
  type,
  x: 10 + (index % 6) * 15,
  y: 24 + Math.floor(index / 6) * 19,
  stage: 3,
  placedAtTurn: 0,
  paidMethod: "barter",
  paidAmount: 1
}));

const savedState = {
  placed,
  shares: 28,
  budget: 480,
  pool: 82,
  goodwill: 10,
  given: 12,
  awarded: [],
  market: [],
  lastCommunityCheck: null,
  storySeen: true,
  introSeen: true,
  mode: "guided",
  journeyMoments: ["soil", "water", "food", "shelter", "share", "challenge"],
  gardenEffects: Object.fromEntries(challenges.map(key => [key, 1])),
  lastChallengeKey: "quiz",
  gardenReflectionsSeen: [],
  acknowledgedGardenReflectionsV2: [],
  pendingGardenReflections: [],
  pendingGardenWhispers: [],
  pendingGuildCards: [],
  pendingArrivals: [],
  livingLessonExperiment: null,
  livingLessonHistory: [],
  communityMemory: [
    {
      id: "audit-community-1",
      person: "Camille",
      text: "Camille offered spare compost. Taking it records help received as well as help given."
    },
    {
      id: "audit-community-2",
      person: "Noa",
      text: "Noa offered saved seed. Taking it records help received as well as help given."
    }
  ],
  reflectionOpened: true,
  reflectionNote: "",
  endingSeen: false,
  discovered: guilds,
  guildVoicePlayed: true,
  seenWildlife: wildlife,
  sharedActs: 4,
  rewardedGiftTypes: ["compost", "mulch", "herbspiral"],
  seasonTurns: 8,
  seedAllowance: {},
  seedStock: {
    crop_potato: 2,
    crop_root: 2,
    crop_leafy: 2,
    crop_cabbage: 2,
    crop_herb: 2
  },
  unlocksSeen: ["sharing", "seedbank", "kitchen", "askgarden", "seedsaved"],
  grownHarvests: 12,
  preservedCount: 7,
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
  basket: {
    cherries: 3,
    potato: 2,
    root: 2,
    leafy: 2,
    cabbage: 2,
    herb: 2
  },
  materials: { planks: 1, window: 1, bricks: 1, straw: 1 },
  harvestEver: true,
  gatesPlayed: Object.fromEntries(challenges.map(key => [key, 1])),
  guests: wildlife,
  visitsDone: Object.fromEntries(wildlife.map(key => [key, "won"])),
  visitSeason: "Summer",
  pendingVisit: null,
  lastSystemChange: null,
  payWith: "shares",
  residentBeatsSeen: [],
  residentSeasons: { hedgehog: 4, bee: 4, worm: 4 },
  residentWinters: { hedgehog: 2, bee: 2, worm: 2 },
  pestActive: null,
  pestSeasons: {},
  pestCleared: {},
  pestRelief: {},
  pestBeatsSeen: [],
  pestLastSettled: null,
  _n: 40,
  _g: 8
};

const browser = await playwright.chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
  locale: browserLocales[targetLocale]
});
await context.addInitScript(({ key, state }) => {
  localStorage.setItem(key, JSON.stringify(state));
}, { key: "permagarden_v2", state: savedState });
const page = await context.newPage();
const browserErrors = [];
let activeScenario = "bootstrap";
page.on("pageerror", error => browserErrors.push(`pageerror: ${error.message}`));
page.on("console", message => {
  if (
    message.type() === "error" ||
    (message.type() === "warning" && /\[dc-runtime\]|never resolved/u.test(message.text()))
  ) browserErrors.push(`console ${message.type()}: ${message.text()}`);
});

const quietState = {
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

async function settle() {
  await page.evaluate(() => new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  ));
  await page.waitForTimeout(25);
}

async function setState(patch) {
  await page.evaluate(({ quiet, next }) => {
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
    app.setState({ ...quiet, ...next });
  }, { quiet: quietState, next: patch });
  await settle();
}

const scenarios = [];
const missing = new Map();

async function capture(label) {
  const result = await page.evaluate(() => {
    const dialog = [...document.querySelectorAll("[data-pg-dialog]")].find(element => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" &&
        box.width > 1 && box.height > 1;
    });
    const root = document.documentElement;
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
      missing: window.PermacultureI18n?.missing || [],
      overflow: root.scrollWidth > window.innerWidth + 1,
      dialogOverflow: rect
        ? rect.left < -1 || rect.right > window.innerWidth + 1 || rect.top < -1 || rect.bottom > window.innerHeight + 1
        : false,
      clipped
    };
    window.PermacultureI18n?.clearMissing?.();
    return result;
  });
  scenarios.push({
    label,
    overflow: result.overflow,
    dialogOverflow: result.dialogOverflow,
    clipped: result.clipped
  });
  for (const entry of result.missing) {
    if (!missing.has(entry.value)) missing.set(entry.value, { count: 0, scenarios: new Set() });
    const saved = missing.get(entry.value);
    saved.count += entry.count;
    saved.scenarios.add(label);
  }
}

async function scenario(label, patch) {
  activeScenario = label;
  await setState(patch);
  await capture(label);
}

try {
  await page.goto(`${baseUrl}?lang=${encodeURIComponent(targetLocale)}`, { waitUntil: "networkidle" });
  await page.waitForFunction(locale =>
    window.__PERMAGARDEN_APP__ && window.PermacultureI18n?.locale === locale,
  targetLocale);
  await capture("startup");

  for (const mode of ["guided", "explore"]) {
    for (const season of ["Spring", "Summer", "Autumn", "Winter"]) {
      await scenario(`main:${mode}:${season}`, {
        mode,
        season,
        springSprouts: season === "Spring" ? 3 : 0,
        cherryPicks: season === "Summer" ? 3 : 0,
        leafPiles: season === "Autumn" ? 3 : 0
      });
    }
  }
  await scenario("header-menu", { headerMenuOpen: true });
  await scenario("intro", { intro: true });

  for (let index = 0; index < 7; index += 1) {
    await scenario(`story:${index + 1}`, {
      story: true,
      storyStarted: true,
      storyPaused: true,
      storyScene: index,
      storyToIntro: true
    });
  }

  for (const type of types) {
    await scenario(`selected:${type}`, { selectedPlacedId: `audit-${type}` });
  }

  const bookTabs = ["elements", "wildlife", "guilds", "principles", "balance", "keeping"];
  for (const tab of bookTabs) {
    const leaves = await page.evaluate(bookTab => {
      const app = window.__PERMAGARDEN_APP__;
      return app.bookLeafCount(bookTab);
    }, tab);
    for (let leaf = 0; leaf < leaves; leaf += 1) {
      await scenario(`book:${tab}:${leaf}`, { bookOpen: true, bookTab: tab, bookLeaf: leaf });
    }
  }

  await scenario("kitchen:overview", { kitchenOpen: true });
  for (const key of ["cherries", "potato", "root", "leafy", "cabbage", "herb"]) {
    await scenario(`kitchen:${key}`, { kitchenOpen: true, kitchenPick: key });
  }
  await scenario("seedbank:overview", { seedbankOpen: true });
  for (const key of ["crop_potato", "crop_root", "crop_leafy", "crop_cabbage", "crop_herb"]) {
    await scenario(`seedbank:${key}`, { seedbankOpen: true, seedPick: key });
  }

  const residentBeats = await page.evaluate(() =>
    window.__PERMAGARDEN_APP__.residentStories.flatMap(resident =>
      resident.beats.map((beat, index) => ({
        id: beat.id,
        resident: resident.key,
        residentName: resident.name,
        title: beat.title,
        text: beat.text,
        art: `assets/residents/${beat.id}.webp`,
        index: index + 1,
        total: resident.beats.length
      }))
    )
  );
  for (const beat of residentBeats) {
    await scenario(`resident:${beat.id}`, { residentStory: beat });
  }

  const pestBeats = await page.evaluate(() =>
    window.__PERMAGARDEN_APP__.pestPressures.flatMap(pest =>
      pest.beats.map((beat, index) => ({
        id: beat.id,
        pest: pest.key,
        pestName: pest.name,
        noun: pest.noun,
        title: beat.title,
        text: beat.text,
        art: `assets/pests/${beat.id}.webp`,
        index: index + 1,
        total: pest.beats.length,
        resolved: index === pest.beats.length - 1,
        reading: pest.reading,
        relief: pest.relief,
        reliefWhy: pest.reliefWhy,
        allyName: pest.allyName
      }))
    )
  );
  for (const beat of pestBeats) {
    await scenario(`pest:${beat.id}`, {
      pestStory: beat,
      pestActive: beat.pest,
      pestSeasons: { [beat.pest]: 3 },
      pestCleared: beat.resolved ? { [beat.pest]: true } : {}
    });
  }

  for (const key of ["sharing", "seedbank", "kitchen", "askgarden", "seedsaved"]) {
    await scenario(`unlock:${key}`, { unlockCard: key });
  }

  for (const count of [3, 5]) {
    const reflection = await page.evaluate(value =>
      window.__PERMAGARDEN_APP__.reflectionForCount(value), count);
    await scenario(`reflection:${reflection.id}`, { gardenReflection: reflection });
  }

  await scenario("guild-list", { showGuilds: true });
  for (const key of guilds) {
    await scenario(`guild:${key}`, { guildCard: key, guildReview: true });
  }

  for (const key of wildlife) {
    await scenario(`visit:${key}:ask`, {
      visit: { key, status: "ask", picked: [] },
      visitSeason: "Summer"
    });
    await scenario(`visit:${key}:won`, {
      visit: { key, status: "won", picked: [0, 1, 2] },
      visitSeason: "Summer"
    });
    await scenario(`arrival:${key}`, { inspectCritter: key });
  }
  await scenario("arrival:return-single", { returnQueue: ["bee"], season: "Spring" });
  await scenario("arrival:return-batch", { returnQueue: ["bee", "bird", "butterfly"], season: "Spring" });
  await scenario("arrival:new-batch", { arrivalQueue: ["worm", "bee", "bird"] });

  for (const key of challenges) {
    const gate = await page.evaluate(({ challenge, target }) => {
      const app = window.__PERMAGARDEN_APP__;
      const def = app.gateDefs()[challenge];
      return { key: challenge, target, status: "brief", d: def.init(app.state, target) };
    }, { challenge: key, target: challengeTargets[key] });
    await scenario(`challenge:${key}:brief`, { gate });
    await scenario(`challenge:${key}:play`, { gate: { ...gate, status: "play" } });
    await scenario(`challenge:${key}:won`, { gate: { ...gate, status: "won", effectNew: true } });
  }

  for (const season of ["Spring", "Summer", "Autumn", "Winter"]) {
    const cinematic = await page.evaluate(value => {
      const passage = window.__PERMAGARDEN_APP__.seasonPassages[value];
      return {
        season: value,
        title: passage.title,
        text: passage.voice,
        image: passage.image,
        loop: ""
      };
    }, season);
    await scenario(`cinematic:${season}`, { gardenCinematic: cinematic, season });
  }

  for (const key of ["soil", "water", "food", "shelter", "share", "challenge"]) {
    const text = await page.evaluate(value =>
      window.__PERMAGARDEN_APP__.journeyModel().steps.find(step => step.key === value)?.voice || "", key);
    await scenario(`whisper:${key}`, { gardenWhisper: { key, text } });
  }

  const lesson = {
    source: "fallback",
    focus: "relationships",
    observation: "Two useful elements are present, but they are still working as isolated objects.",
    relationship: "Distance changes whether one element can answer another.",
    question: "Which pair could begin sharing a need and a yield?",
    experiment: {
      title: "Bring two useful neighbours together",
      action: "Move one element closer to a complementary partner.",
      why: "A visible connection makes the design easier to observe and adjust.",
      success: "Create the first relationship connection on the plot."
    }
  };
  await scenario("living-lesson:ready", { livingLesson: { status: "ready", lesson } });
  await scenario("living-lesson:loading", { livingLesson: { status: "loading" } });

  await scenario("summary:progress", { showSummary: true, mode: "explore", endingSeen: false });
  await scenario("summary:complete", {
    showSummary: true,
    mode: "guided",
    endingSeen: true,
    reflectionOpened: true,
    journeyMoments: ["soil", "water", "food", "shelter", "share", "challenge"]
  });

  const report = {
    locale: targetLocale,
    scenarioCount: scenarios.length,
    missing: [...missing.entries()]
      .map(([value, data]) => ({
        value,
        count: data.count,
        scenarios: [...data.scenarios].slice(0, 20)
      }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
    layoutIssues: scenarios.filter(item =>
      item.overflow || item.dialogOverflow || item.clipped.length),
    browserErrors
  };
  await mkdir(path.join(root, ".tmp"), { recursive: true });
  await writeFile(
    path.join(root, ".tmp", `i18n-runtime-surface-audit-${targetLocale}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  console.log(
    `i18n surface audit (${targetLocale}): ${report.scenarioCount} scenarios, ` +
    `${report.missing.length} untranslated values, ${report.layoutIssues.length} layout flags, ` +
    `${report.browserErrors.length} browser errors.`
  );
  if (report.missing.length) {
    for (const item of report.missing.slice(0, 40)) {
      console.log(`MISSING ${JSON.stringify(item.value)} (${item.count})`);
    }
  }
  if (report.missing.length || report.layoutIssues.length || report.browserErrors.length) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`i18n surface audit (${targetLocale}) failed during ${activeScenario}.`);
  throw error;
} finally {
  await context.close();
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
