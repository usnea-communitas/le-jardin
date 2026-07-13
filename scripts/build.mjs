import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "Permaculture Garden v2.dc.html");
const outputPath = path.join(root, "index.html");
const fragmentPath = path.join(root, "game.fragment.html");

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
    '  const sources = ["vendor/react.production.min.js", "vendor/react-dom.production.min.js", "vendor/dc-runtime.js"];',
    '  const load = (src) => new Promise((resolve, reject) => {',
    '    const script = document.createElement("script");',
    '    script.src = src;',
    '    script.onload = resolve;',
    '    script.onerror = reject;',
    '    document.head.appendChild(script);',
    '  });',
    '  const boot = async () => {',
    '    const response = await fetch("game.fragment.html");',
    '    if (!response.ok) throw new Error("Game content could not be loaded");',
    '    document.body.insertAdjacentHTML("beforeend", await response.text());',
    '    await sources.reduce((ready, src) => ready.then(() => load(src)), Promise.resolve());',
    '  };',
    '  requestAnimationFrame(() => requestAnimationFrame(() => boot().catch((error) => console.error("Game failed to start", error))));',
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

await writeFile(outputPath, html, "utf8");
await writeFile(fragmentPath, fragment, "utf8");
console.log(`Built ${path.relative(root, outputPath)} loading shell (${html.length} characters).`);
console.log(`Built ${path.relative(root, fragmentPath)} game content (${fragment.length} characters).`);
