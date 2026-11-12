import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildOfflineManifest, formatOfflineManifest, stampServiceWorker } from "./offline-manifest.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "Permaculture Garden v2.dc.html");
const outputPath = path.join(root, "index.html");
const fragmentPath = path.join(root, "game.fragment.html");
const manifestPath = path.join(root, "offline-manifest.json");
const workerPath = path.join(root, "sw.js");

const runtimeUuid = "a642a266-8af5-4398-9a56-263a98de83c8";
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
    '  const boot = async () => {',
    '    const i18n = window.PermacultureI18n;',
    '    const localeReady = i18n && typeof i18n.bootstrap === "function" ? i18n.bootstrap() : Promise.resolve();',
    '    const [response] = await Promise.all([fetch("game.fragment.html"), localeReady, load("vendor/react.production.min.js")]);',
    '    if (!response.ok) throw new Error("Game content could not be loaded");',
    '    if (i18n && typeof i18n.installReact === "function") i18n.installReact(window.React);',
    '    const [fragment] = await Promise.all([response.text(), load("vendor/react-dom.production.min.js")]);',
    '    document.body.insertAdjacentHTML("beforeend", fragment);',
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
const fragment = html.slice(gameStart, gameEnd);
html = html.slice(0, gameStart) + html.slice(gameEnd);

// The offline package (lib/offline.js, sw.js): every file with its size and
// hash, and the build's version stamped into the service worker.
const offlineManifest = await buildOfflineManifest(root, { "index.html": html, "game.fragment.html": fragment });
const manifestText = formatOfflineManifest(offlineManifest);
const workerText = stampServiceWorker(await readFile(workerPath, "utf8"), offlineManifest.version);

if (process.argv.includes("--check")) {
  const [currentHtml, currentFragment, currentManifest, currentWorker] = await Promise.all([
    readFile(outputPath, "utf8"),
    readFile(fragmentPath, "utf8"),
    readFile(manifestPath, "utf8").catch(() => ""),
    readFile(workerPath, "utf8"),
  ]);
  const stale = [];
  if (currentHtml !== html) stale.push(path.relative(root, outputPath));
  if (currentFragment !== fragment) stale.push(path.relative(root, fragmentPath));
  if (currentManifest !== manifestText) stale.push(path.relative(root, manifestPath));
  if (currentWorker !== workerText) stale.push(path.relative(root, workerPath));
  if (stale.length) {
    throw new Error(`Generated production files are stale: ${stale.join(", ")}. Run node scripts/build.mjs.`);
  }
  console.log("Generated production files match the canonical source.");
} else {
  await writeFile(outputPath, html, "utf8");
  await writeFile(fragmentPath, fragment, "utf8");
  await writeFile(manifestPath, manifestText, "utf8");
  await writeFile(workerPath, workerText, "utf8");
  console.log(`Built ${path.relative(root, outputPath)} loading shell (${html.length} characters).`);
  console.log(`Built ${path.relative(root, fragmentPath)} game content (${fragment.length} characters).`);
  console.log(`Built ${path.relative(root, manifestPath)}: ${Object.keys(offlineManifest.files).length} files, version ${offlineManifest.version}.`);
}
