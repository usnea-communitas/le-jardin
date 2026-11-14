import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildOfflineManifest, formatOfflineManifest, stampServiceWorker } from "./offline-manifest.mjs";
import { LOGIC_FILE, LOGIC_GLOBAL, LOGIC_STUB } from "./game-logic.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "Permaculture Garden v2.dc.html");
const outputPath = path.join(root, "index.html");
const fragmentPath = path.join(root, "game.fragment.html");
const logicPath = path.join(root, LOGIC_FILE);
const STYLES_FILE = "game.css";
const stylesPath = path.join(root, STYLES_FILE);
const manifestPath = path.join(root, "offline-manifest.json");
const workerPath = path.join(root, "sw.js");

const runtimeUuid = "a642a266-8af5-4398-9a56-263a98de83c8";
// the shell's letters for the cover's typefaces, filled in once the game's styles are known
const COVER_LETTERS = "__PG_COVER_LETTERS__";
const COVER_FAMILIES = ["Bricolage Grotesque", "Hanken Grotesk"];
const fontUuids = [
  "e02e5547-5706-4b80-ad16-90743fc8c4d8",
  "046f8192-7261-4617-8fc9-dc35b3bb6432",
  "268f057e-7d88-4bfc-af3c-98d4cd308f56",
  "0e9e2eef-5de5-4034-ae2d-c6645fbcf6bc",
  "25e53409-fda0-4f1f-9947-3dd97129457e",
  "b55210b1-8cf9-41e5-9983-ed758dbf9ceb",
  "048df43a-fe9b-45a8-b411-e39d84d8ca7f",
];

let html = await readFile(sourcePath, "utf8");

// The version shown in the palette footer always follows package.json.
const { version } = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const versionPattern = /(<span data-pg-version="true"[^>]*>)[^<]*(<\/span>)/;
if (!versionPattern.test(html)) {
  throw new Error(`Expected the data-pg-version span in ${path.basename(sourcePath)}`);
}
html = html.replace(versionPattern, `$1v${version}$2`);

const runtimeTag = `<script src="${runtimeUuid}"></script>`;
if (!html.includes(runtimeTag)) {
  throw new Error(`Expected runtime tag is missing from ${path.basename(sourcePath)}`);
}

// The rule modules (docs/ARCHITECTURE.md) are deferred scripts: lib/seasons.js
// defines window.PermacultureSeasons. The shell starts the game only once they
// have all run, and shows the retry screen if one of them did not arrive.
const ruleGlobals = [...html.matchAll(/<script src="lib\/([a-z-]+)\.js" defer><\/script>/g)]
  .map(([, name]) => "Permaculture" + name.split("-").map(part => part[0].toUpperCase() + part.slice(1)).join(""));
if (!ruleGlobals.length) {
  throw new Error(`Expected the deferred rule modules in ${path.basename(sourcePath)}`);
}

html = html.replace(
  runtimeTag,
  [
    '<link rel="preload" href="game.fragment.html" as="fetch" crossorigin>',
    '<link rel="preload" href="vendor/react.production.min.js" as="script">',
    '<link rel="preload" href="vendor/react-dom.production.min.js" as="script">',
    '<link rel="preload" href="vendor/dc-runtime.js" as="script">',
    '<script>',
    '(() => {',
    '  const load = (src) => new Promise((resolve, reject) => {',
    '    const script = document.createElement("script");',
    '    script.src = src;',
    '    script.onload = resolve;',
    '    script.onerror = reject;',
    '    document.head.appendChild(script);',
    '  });',
    '  const sheet = (href) => new Promise((resolve, reject) => {',
    '    const link = document.createElement("link");',
    '    link.rel = "stylesheet";',
    '    link.href = href;',
    '    // a sheet the browser refused (one served as another type, say) still loads, empty',
    '    link.onload = () => {',
    '      let rules = 1;',
    '      try { rules = link.sheet ? link.sheet.cssRules.length : 0; } catch (_) {}',
    '      if (rules) resolve(); else reject(new Error("The game\'s styles could not be read"));',
    '    };',
    '    link.onerror = reject;',
    '    document.head.appendChild(link);',
    '  });',
    '  // The cover\'s typefaces are ready before the game draws it, so its words appear once, in their own letters,',
    '  // not first in a stand-in swapped a moment later. The head preloads their basic Latin files; a language that',
    '  // needs more letters names them (from its catalogue), and so does the list of languages (docs/START-PERFORMANCE.md).',
    '  const typefaces = () => {',
    '    const fonts = document.fonts;',
    '    if (!fonts || typeof fonts.load !== "function") return Promise.resolve();',
    `    const letters = " " + (${COVER_LETTERS}[document.documentElement.lang] || "");`,
    '    const i18n = window.PermacultureI18n;',
    '    const names = i18n && Array.isArray(i18n.LANGUAGE_OPTIONS) ? i18n.LANGUAGE_OPTIONS.map((option) => option.label).join("") : "";',
    '    const faces = [fonts.load("1em \'Bricolage Grotesque\'", letters), fonts.load("1em \'Hanken Grotesk\'", letters + names), fonts.load("700 1em \'Hanken Grotesk\'", letters + names)];',
    '    return Promise.race([Promise.all(faces), new Promise((resolve) => setTimeout(resolve, 2500))]).catch(() => {});',
    '  };',
    '  const translate = (key, fallback) => {',
    '    const i18n = window.PermacultureI18n;',
    '    return i18n && typeof i18n.t === "function" ? i18n.t(key, null, fallback) : fallback;',
    '  };',
    '  const showError = (error) => {',
    '    console.error("Game failed to start", error);',
    '    const bootScreen = document.getElementById("pg-boot");',
    '    if (!bootScreen) return;',
    '    bootScreen.classList.add("pg-boot-error");',
    '    bootScreen.setAttribute("role", "alert");',
    '    const box = bootScreen.firstElementChild;',
    '    const status = box && box.querySelector("span");',
    '    if (status) status.textContent = translate("boot.error.title", "Le Jardin needs another moment");',
    '    if (box && !box.querySelector("[data-pg-boot-detail]")) {',
    '      const detail = document.createElement("p");',
    '      detail.dataset.pgBootDetail = "1";',
    '      detail.textContent = translate("boot.error.detail", "The game could not finish loading. Check your connection, then try again.");',
    '      const retry = document.createElement("button");',
    '      retry.type = "button";',
    '      retry.dataset.testid = "boot-retry";',
    '      retry.textContent = translate("boot.error.retry", "Try again");',
    '      retry.addEventListener("click", () => window.location.reload());',
    '      box.append(detail, retry);',
    '      retry.focus();',
    '    }',
    '  };',
    '  // The rule modules (lib/*.js with defer) run once the page is parsed, before',
    '  // DOMContentLoaded; the game starts only after them, without blocking the first paint.',
    '  const parsed = new Promise((resolve) => {',
    '    if (document.readyState === "complete") resolve();',
    '    else document.addEventListener("DOMContentLoaded", resolve, { once: true });',
    '  });',
    '  const boot = async () => {',
    '    const i18n = window.PermacultureI18n;',
    '    const localeReady = i18n && typeof i18n.bootstrap === "function" ? i18n.bootstrap() : Promise.resolve();',
    '    // the game\'s styles and its logic class are files of their own, so the browser reads each once, while it',
    '    // arrives; both are fetched here, after the first paint, not preloaded: a preload would compete with the',
    '    // paint (docs/START-PERFORMANCE.md)',
    '    const styles = sheet("game.css");',
    '    const logic = load("game.logic.js");',
    '    for (const part of [styles, logic]) part.catch(() => {}); // awaited below, before the runtime: until then a failure is not an unhandled rejection',
    '    const lettered = Promise.all([styles, localeReady]).then(typefaces, () => {});',
    '    const [response] = await Promise.all([fetch("game.fragment.html"), localeReady, load("vendor/react.production.min.js")]);',
    '    if (!response.ok) throw new Error("Game content could not be loaded");',
    '    if (i18n && typeof i18n.installReact === "function") i18n.installReact(window.React);',
    '    const reactDom = load("vendor/react-dom.production.min.js");',
    '    reactDom.catch(() => {}); // awaited below, once the template is in the page',
    '    // the template goes into the page as soon as it is read, in a task of its own, not after React DOM in one long task',
    '    document.body.insertAdjacentHTML("beforeend", await response.text());',
    '    await reactDom;',
    '    await parsed;',
    `    if (${JSON.stringify(ruleGlobals)}.some((name) => !window[name])) throw new Error("The rules of the game could not be loaded");`,
    '    await Promise.all([styles, logic]);',
    '    await lettered;',
    '    await load("vendor/dc-runtime.js");',
    '  };',
    '  // Playing without a connection (sw.js): a newer build downloaded in the background',
    '  // starts now, before the game runs, so a game never changes version while it is played.',
    '  const startWaitingBuild = async () => {',
    '    const workers = navigator.serviceWorker;',
    '    if (!workers || !workers.controller) return false;',
    '    const registration = await workers.getRegistration();',
    '    if (!registration) return false;',
    '    registration.update().catch(() => {});',
    '    if (!registration.waiting) return false;',
    '    // once per tab session, so a worker that will not take over can never start a reload loop',
    '    try {',
    '      if (sessionStorage.getItem("pg-offline-update")) return false;',
    '      sessionStorage.setItem("pg-offline-update", "1");',
    '    } catch (_) { return false; }',
    '    await new Promise((resolve) => {',
    '      workers.addEventListener("controllerchange", resolve, { once: true });',
    '      registration.waiting.postMessage({ type: "skip-waiting" });',
    '      setTimeout(resolve, 3000);',
    '    });',
    '    window.location.reload();',
    '    return true;',
    '  };',
    '  requestAnimationFrame(() => requestAnimationFrame(() => startWaitingBuild().catch(() => false)',
    '    .then((reloading) => reloading || boot()).catch(showError)));',
    '})();',
    '</script>',
  ].join("\n"),
);

for (const uuid of fontUuids) {
  if (!html.includes(uuid)) {
    throw new Error(`Expected font resource is missing: ${uuid}`);
  }
  html = html.replaceAll(uuid, `assets/fonts/${uuid}.woff2`);
}

const unresolved = (html.match(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/g) ?? [])
  .filter((uuid) => !fontUuids.includes(uuid));
if (unresolved.length > 0) {
  throw new Error(`Unresolved bundled resource IDs: ${[...new Set(unresolved)].join(", ")}`);
}

if (/assets\/[^"')]+\.png(?:["')]|$)/i.test(html)) {
  throw new Error("Production source still references PNG assets; use WebP instead.");
}

const gameStart = html.indexOf("<x-dc>");
const gameScriptEnd = html.lastIndexOf("</script>");
if (gameStart < 0 || gameScriptEnd < gameStart) {
  throw new Error("Could not split the game content from the loading shell.");
}
const gameEnd = gameScriptEnd + "</script>".length;
let fragment = html.slice(gameStart, gameEnd);

// The game's logic class (the canonical source's <script type="text/x-dc" data-dc-script>)
// becomes a script of its own, game.logic.js: the browser compiles a script while it
// downloads, away from the main thread, and can keep it compiled for a returning player,
// which code the runtime makes from text (new Function) gets neither of. The runtime is
// unchanged: it still compiles the script's text, now one line that hands over the class
// made by game.logic.js with the same three names (docs/START-PERFORMANCE.md).
const logicOpen = fragment.indexOf('<script type="text/x-dc" data-dc-script');
const logicStart = fragment.indexOf(">", logicOpen) + 1;
const logicEnd = fragment.indexOf("</script>", logicStart);
if (logicOpen < 0 || logicStart < 1 || logicEnd < logicStart || fragment.indexOf('<script type="text/x-dc"', logicEnd) >= 0) {
  throw new Error("Expected exactly one game logic script in the game content.");
}
const logicSource = fragment.slice(logicStart, logicEnd);
const logic = [
  "// Generated by scripts/build.mjs from Permaculture Garden v2.dc.html: the game's logic class.",
  "// Never edit by hand. The runtime (vendor/dc-runtime.js) asks for it with the stub in game.fragment.html.",
  `window.${LOGIC_GLOBAL} = (function (DCLogic, StreamableLogic, React) {`,
  logicSource,
  ';return (typeof Component!=="undefined"&&Component)||undefined;',
  "});",
  "",
].join("\n");
fragment = fragment.slice(0, logicStart) + "\n" + LOGIC_STUB + "\n" + fragment.slice(logicEnd);

// The game's styles (the <style> blocks in the canonical source's <helmet>) become a
// stylesheet of its own, game.css, which the shell fetches together with the logic. In the
// fragment the browser read them twice, when the shell put the template into the page and
// again when the runtime copied the helmet into the head at the first render, and with
// them every font they name; and the runtime's passes over the template's text carried
// them too (docs/START-PERFORMANCE.md).
const helmetOpen = fragment.indexOf("<helmet>");
const helmetEnd = fragment.indexOf("</helmet>", helmetOpen);
if (helmetOpen < 0 || helmetEnd < 0 || fragment.indexOf("<helmet", helmetEnd) >= 0) {
  throw new Error("Expected exactly one <helmet> in the game content.");
}
const helmet = fragment.slice(helmetOpen + "<helmet>".length, helmetEnd);
const styleBlocks = [...helmet.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)];
if (!styleBlocks.length || styleBlocks.some(([, attributes]) => attributes.trim())) {
  // an attribute such as media would be lost in a plain stylesheet
  throw new Error("Expected the game's styles as plain <style> blocks in the <helmet>.");
}
const styles = [
  `/* Generated by scripts/build.mjs from Permaculture Garden v2.dc.html: the game's styles. Never edit by hand. */`,
  ...styleBlocks.map(([, , css]) => css.trim()),
  "",
].join("\n");
if (styles.includes("{{")) {
  throw new Error(`The game's styles hold a template value, which ${STYLES_FILE} cannot fill in.`);
}
const helmetRest = helmet.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
fragment = fragment.slice(0, helmetOpen) + (helmetRest.trim() ? `<helmet>${helmetRest}</helmet>` : "") + fragment.slice(helmetEnd + "</helmet>".length);

// The template waits in the page, unseen, until the runtime reads it, and a picture in it
// with a fixed address would still be downloaded and decoded there, long before the game
// shows it. sc-camel-src is the runtime's own spelling of src (the story's frames use it
// for their addresses): the browser leaves it alone, the rendered picture gets src.
const tplStart = fragment.indexOf("<x-dc>");
const tplEnd = fragment.indexOf("</x-dc>");
fragment = fragment.slice(0, tplStart) + fragment.slice(tplStart, tplEnd).replace(/(<img\b[^>]*?\s)src="(?![^"]*\{\{)/g, '$1sc-camel-src="') + fragment.slice(tplEnd);
if (/<(?:img|source|video|audio|iframe|object|embed)\b[^>]*\s(?:src|srcset|poster)="/.test(fragment.slice(tplStart, fragment.indexOf("</x-dc>")))) {
  throw new Error("A picture or media element in the template still downloads before the game shows it.");
}
html = html.slice(0, gameStart) + html.slice(gameEnd);

// The letters each language's cover needs beyond the basic Latin files the head preloads: the
// characters of its catalogue that, in the cover's typefaces, only a face the head does not
// preload draws. The shell asks for those faces too before the cover is drawn.
const preloadedFonts = new Set([...html.matchAll(/<link rel="preload" href="([^"]+)" as="font"/g)].map(([, href]) => href));
const fontFaces = [...styles.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) => ({
  family: (body.match(/font-family:\s*'([^']+)'/) || [])[1],
  url: (body.match(/url\("([^"]+)"\)/) || [])[1],
  ranges: ((body.match(/unicode-range:\s*([^;]+);/) || [])[1] || "").split(",")
    .map((range) => range.trim().replace(/^U\+/i, "").split("-").map((hex) => parseInt(hex, 16)))
    .filter(([from]) => Number.isFinite(from)),
}));
if (COVER_FAMILIES.some((family) => !fontFaces.some((face) => face.family === family && preloadedFonts.has(face.url)))) {
  throw new Error(`The head should preload a file of each of the cover's typefaces (${COVER_FAMILIES.join(", ")}).`);
}
const drawnBy = (family, preloaded, code) => fontFaces.some((face) => face.family === family && preloadedFonts.has(face.url) === preloaded
  && face.ranges.some(([from, to = from]) => code >= from && code <= to));
const coverLetters = {};
const catalogsDir = path.join(root, "assets", "i18n");
for (const name of (await readdir(catalogsDir)).filter((file) => /^catalog\..+\.json$/.test(file)).sort()) {
  const strings = [];
  const collect = (value) => typeof value === "string" ? strings.push(value) : value && typeof value === "object" && Object.values(value).forEach(collect);
  collect(JSON.parse(await readFile(path.join(catalogsDir, name), "utf8")));
  const letters = new Set();
  for (const character of strings.join("")) {
    const code = character.codePointAt(0);
    if (!/\p{M}/u.test(character) && COVER_FAMILIES.some((family) => !drawnBy(family, true, code) && drawnBy(family, false, code))) letters.add(character);
  }
  if (letters.size) coverLetters[name.slice("catalog.".length, -".json".length)] = [...letters].sort().join("");
}
if (!html.includes(COVER_LETTERS) || COVER_FAMILIES.some((family) => !html.includes(`fonts.load("1em '${family}'"`))) {
  throw new Error("The shell should ask for each of the cover's typefaces, with the letters filled in here.");
}
html = html.replace(COVER_LETTERS, JSON.stringify(coverLetters));

// The offline package (lib/offline.js, sw.js): every file with its size and
// hash, and the build's version stamped into the service worker.
const offlineManifest = await buildOfflineManifest(root, { "index.html": html, "game.fragment.html": fragment, [LOGIC_FILE]: logic, [STYLES_FILE]: styles });
const manifestText = formatOfflineManifest(offlineManifest);
const workerText = stampServiceWorker(await readFile(workerPath, "utf8"), offlineManifest.version);

if (process.argv.includes("--check")) {
  const [currentHtml, currentFragment, currentLogic, currentStyles, currentManifest, currentWorker] = await Promise.all([
    readFile(outputPath, "utf8"),
    readFile(fragmentPath, "utf8"),
    readFile(logicPath, "utf8").catch(() => ""),
    readFile(stylesPath, "utf8").catch(() => ""),
    readFile(manifestPath, "utf8").catch(() => ""),
    readFile(workerPath, "utf8"),
  ]);
  const stale = [];
  if (currentHtml !== html) stale.push(path.relative(root, outputPath));
  if (currentFragment !== fragment) stale.push(path.relative(root, fragmentPath));
  if (currentLogic !== logic) stale.push(path.relative(root, logicPath));
  if (currentStyles !== styles) stale.push(path.relative(root, stylesPath));
  if (currentManifest !== manifestText) stale.push(path.relative(root, manifestPath));
  if (currentWorker !== workerText) stale.push(path.relative(root, workerPath));
  if (stale.length) {
    throw new Error(`Generated production files are stale: ${stale.join(", ")}. Run node scripts/build.mjs.`);
  }
  console.log("Generated production files match the canonical source.");
} else {
  await writeFile(outputPath, html, "utf8");
  await writeFile(fragmentPath, fragment, "utf8");
  await writeFile(logicPath, logic, "utf8");
  await writeFile(stylesPath, styles, "utf8");
  await writeFile(manifestPath, manifestText, "utf8");
  await writeFile(workerPath, workerText, "utf8");
  console.log(`Built ${path.relative(root, outputPath)} loading shell (${html.length} characters).`);
  console.log(`Built ${path.relative(root, fragmentPath)} game content (${fragment.length} characters).`);
  console.log(`Built ${path.relative(root, logicPath)} game logic (${logic.length} characters).`);
  console.log(`Built ${path.relative(root, stylesPath)} game styles (${styles.length} characters).`);
  console.log(`Built ${path.relative(root, manifestPath)}: ${Object.keys(offlineManifest.files).length} files, version ${offlineManifest.version}.`);
}
