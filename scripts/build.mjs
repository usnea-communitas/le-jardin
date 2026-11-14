import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildOfflineManifest, formatOfflineManifest, stampServiceWorker } from "./offline-manifest.mjs";
import { parseFragment } from "parse5";
import { LOGIC_FILE, LOGIC_GLOBAL } from "./game-logic.mjs";
import { compileTemplate, propsFromDataProps } from "./template-compiler.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "Permaculture Garden v2.dc.html");
const outputPath = path.join(root, "index.html");
const TEMPLATE_FILE = "game.template.js";
const templatePath = path.join(root, TEMPLATE_FILE);
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
const source = html;

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
    '<link rel="preload" href="vendor/react.production.min.js" as="script">',
    '<link rel="preload" href="vendor/react-dom.production.min.js" as="script">',
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
    '    // the game\'s styles, its logic class, its template (made into code by the build) and the runtime that draws',
    '    // them are files of their own, so the browser reads each once, while it arrives; they are fetched here, after',
    '    // the first paint, not preloaded: a preload would compete with the paint (docs/START-PERFORMANCE.md)',
    '    const styles = sheet("game.css");',
    '    const logic = load("game.logic.js");',
    '    const template = load("game.template.js");',
    '    const runtime = load("lib/runtime.js");',
    '    for (const part of [styles, logic, template, runtime]) part.catch(() => {}); // awaited below, before the start: until then a failure is not an unhandled rejection',
    '    const lettered = Promise.all([styles, localeReady]).then(typefaces, () => {});',
    '    await Promise.all([localeReady, load("vendor/react.production.min.js")]);',
    '    if (i18n && typeof i18n.installReact === "function") i18n.installReact(window.React);',
    '    await load("vendor/react-dom.production.min.js");',
    '    await parsed;',
    `    if (${JSON.stringify(ruleGlobals)}.some((name) => !window[name])) throw new Error("The rules of the game could not be loaded");`,
    '    await Promise.all([styles, logic, template, runtime]);',
    '    await lettered;',
    '    window.PermacultureRuntime.start({ onError: showError });',
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
const game = html.slice(gameStart, gameEnd);

// The game's logic class (the canonical source's <script type="text/x-dc" data-dc-script>)
// becomes a script of its own, game.logic.js: the browser compiles a script while it
// downloads, away from the main thread, and can keep it compiled for a returning player.
// It defines window.__permagardenLogic(DCLogic, StreamableLogic, React), which returns the
// class; lib/runtime.js gives it its base, DCLogic, and starts the game with it.
const logicOpen = game.indexOf('<script type="text/x-dc" data-dc-script');
const logicStart = game.indexOf(">", logicOpen) + 1;
const logicEnd = game.indexOf("</script>", logicStart);
if (logicOpen < 0 || logicStart < 1 || logicEnd < logicStart || game.indexOf('<script type="text/x-dc"', logicEnd) >= 0) {
  throw new Error("Expected exactly one game logic script in the game content.");
}
const logicSource = game.slice(logicStart, logicEnd);
const logic = [
  "// Generated by scripts/build.mjs from Permaculture Garden v2.dc.html: the game's logic class.",
  "// Never edit by hand. lib/runtime.js starts the game with it and with game.template.js.",
  `window.${LOGIC_GLOBAL} = (function (DCLogic, StreamableLogic, React) {`,
  logicSource,
  ';return (typeof Component!=="undefined"&&Component)||undefined;',
  "});",
  "",
].join("\n");
// The props the canvas gave the logic class as this.props: the defaults of the script's data-props.
const [logicTag] = parseFragment(game.slice(logicOpen, logicStart) + "</script>").childNodes;
const props = propsFromDataProps((logicTag.attrs.find((attr) => attr.name === "data-props") || {}).value);

// The game's styles (the <style> blocks in the canonical source's <helmet>) become a
// stylesheet of its own, game.css, which the shell fetches together with the logic.
const templateEnd = game.indexOf("</x-dc>");
let markup = game.slice("<x-dc>".length, templateEnd);
const helmetOpen = markup.indexOf("<helmet>");
const helmetEnd = markup.indexOf("</helmet>", helmetOpen);
if (helmetOpen < 0 || helmetEnd < 0 || markup.indexOf("<helmet", helmetEnd) >= 0) {
  throw new Error("Expected exactly one <helmet> in the game content.");
}
const helmet = markup.slice(helmetOpen + "<helmet>".length, helmetEnd);
const styleBlocks = [...helmet.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)];
if (!styleBlocks.length || styleBlocks.some(([, attributes]) => attributes.trim()) || helmet.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "").trim()) {
  // an attribute such as media would be lost in a plain stylesheet
  throw new Error("Expected the game's styles as plain <style> blocks in the <helmet>, and nothing else there.");
}
// the helmet's lines stay as empty lines, so the template's messages name the source's lines
markup = markup.slice(0, helmetOpen) + "\n".repeat(helmet.split("\n").length - 1) + markup.slice(helmetEnd + "</helmet>".length);

// The template (the rest of <x-dc>) becomes code at build time, game.template.js
// (scripts/template-compiler.mjs): the browser no longer reads it as HTML, walks and
// compiles it at every start, and the page needs no runtime that makes code from text.
const compiled = compileTemplate(markup, {
  props,
  firstLine: source.slice(0, source.indexOf("<x-dc>")).split("\n").length,
  header: [
    "// Generated by scripts/build.mjs from Permaculture Garden v2.dc.html: the game's template as code",
    "// (scripts/template-compiler.mjs). Never edit by hand; lib/runtime.js draws it with game.logic.js.",
  ].join("\n"),
});
const template = compiled.code;
const styles = [
  `/* Generated by scripts/build.mjs from Permaculture Garden v2.dc.html: the game's styles. Never edit by hand. */`,
  ...styleBlocks.map(([, , css]) => css.trim()),
  ...(compiled.css.length ? ["/* the template's style-hover attributes (scripts/template-compiler.mjs) */", ...compiled.css] : []),
  "",
].join("\n");
if (styleBlocks.some(([, , css]) => css.includes("{{"))) {
  throw new Error(`The game's styles hold a template value, which ${STYLES_FILE} cannot fill in.`);
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
const offlineManifest = await buildOfflineManifest(root, { "index.html": html, [TEMPLATE_FILE]: template, [LOGIC_FILE]: logic, [STYLES_FILE]: styles });
const manifestText = formatOfflineManifest(offlineManifest);
const workerText = stampServiceWorker(await readFile(workerPath, "utf8"), offlineManifest.version);

if (process.argv.includes("--check")) {
  const [currentHtml, currentTemplate, currentLogic, currentStyles, currentManifest, currentWorker] = await Promise.all([
    readFile(outputPath, "utf8"),
    readFile(templatePath, "utf8").catch(() => ""),
    readFile(logicPath, "utf8").catch(() => ""),
    readFile(stylesPath, "utf8").catch(() => ""),
    readFile(manifestPath, "utf8").catch(() => ""),
    readFile(workerPath, "utf8"),
  ]);
  const stale = [];
  if (currentHtml !== html) stale.push(path.relative(root, outputPath));
  if (currentTemplate !== template) stale.push(path.relative(root, templatePath));
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
  await writeFile(templatePath, template, "utf8");
  await writeFile(logicPath, logic, "utf8");
  await writeFile(stylesPath, styles, "utf8");
  await writeFile(manifestPath, manifestText, "utf8");
  await writeFile(workerPath, workerText, "utf8");
  console.log(`Built ${path.relative(root, outputPath)} loading shell (${html.length} characters).`);
  console.log(`Built ${path.relative(root, templatePath)} game template (${template.length} characters; ${compiled.stats.elements} elements, ${compiled.stats.conditions} conditions, ${compiled.stats.loops} lists, ${compiled.stats.functions} functions).`);
  console.log(`Built ${path.relative(root, logicPath)} game logic (${logic.length} characters).`);
  console.log(`Built ${path.relative(root, stylesPath)} game styles (${styles.length} characters).`);
  console.log(`Built ${path.relative(root, manifestPath)}: ${Object.keys(offlineManifest.files).length} files, version ${offlineManifest.version}.`);
}
