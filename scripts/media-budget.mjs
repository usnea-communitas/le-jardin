// The media budget (docs/MEDIA-BUDGET.md): what a first visit may download and
// how large each kind of media may grow. `npm test` checks it with
// scripts/test-media-budget.mjs; the resilience journey checks that
// FIRST_VISIT names exactly what a browser fetches when the game first opens.
import { readFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

export const KIB = 1024;

// Limits in KiB. Text (HTML, JavaScript, JSON, SVG) counts as it travels,
// compressed; pictures, fonts and sound count as they are.
export const BUDGET = {
  firstVisitPhone: 700,
  firstVisitDesktop: 900,
  gate: 40,
  story: 4200,
  voicePerLanguage: 9500,
  music: 6500,
  gameSounds: 1300,
  pictures: 14000,
  fonts: 200,
  catalogPerLanguage: 300
};

// What the opening story's cover fetches, before anyone presses a key: the
// page and the game, its rules and runtime, three fonts, the English texts,
// four small pictures of the interface and the story's first painting (a
// 600 × 900 crop on a phone held upright).
const FIRST_VISIT_SHARED = [
  "index.html",
  "game.fragment.html",
  "lib/acts.js",
  "lib/community-table.js",
  "lib/economy.js",
  "lib/i18n.js",
  "lib/living-lesson.js",
  "lib/seasons.js",
  "lib/wildlife.js",
  "lib/workshop.js",
  "vendor/dc-runtime.js",
  "vendor/react-dom.production.min.js",
  "vendor/react.production.min.js",
  "assets/fonts/048df43a-fe9b-45a8-b411-e39d84d8ca7f.woff2",
  "assets/fonts/268f057e-7d88-4bfc-af3c-98d4cd308f56.woff2",
  "assets/fonts/b55210b1-8cf9-41e5-9983-ed758dbf9ceb.woff2",
  "assets/i18n/catalog.en.json",
  "assets/ui/divider-vine.webp",
  "assets/ui/flourish-branch.webp",
  "assets/ui/icons/garden-voice.svg",
  "assets/ui/icons/season.svg"
];
// Fetched by some browsers only (Safari reads the web app manifest at once,
// Chromium when it needs it): counted in the sum, allowed to be absent.
export const FIRST_VISIT_SOMETIMES = ["manifest.webmanifest"];
export const FIRST_VISIT = {
  phone: [...FIRST_VISIT_SHARED, "assets/story/phone/story-01-menet.webp"].sort(),
  desktop: [...FIRST_VISIT_SHARED, "assets/story/story-01-menet.webp"].sort()
};

const TEXT = /\.(html|js|json|svg|css|webmanifest)$/;

// The bytes a file costs a visitor: compressed if it is text, as it is otherwise.
export function transferSize(root, file) {
  const buffer = readFileSync(path.join(root, file));
  return TEXT.test(file) ? gzipSync(buffer, { level: 9 }).length : buffer.length;
}

// Everything the budget limits, in KiB, from the files and the offline manifest.
export function measure(root) {
  const manifest = JSON.parse(readFileSync(path.join(root, "offline-manifest.json"), "utf8"));
  const size = files => files.reduce((sum, file) => sum + manifest.files[file][0], 0) / KIB;
  const core = manifest.groups.core;
  const sum = files => files.reduce((total, file) => total + transferSize(root, file), 0) / KIB;
  return {
    firstVisitPhone: sum([...FIRST_VISIT.phone, ...FIRST_VISIT_SOMETIMES]),
    firstVisitDesktop: sum([...FIRST_VISIT.desktop, ...FIRST_VISIT_SOMETIMES]),
    gates: Object.fromEntries(core.filter(file => file.startsWith("assets/gates/")).map(file => [file, manifest.files[file][0] / KIB])),
    story: size(Object.keys(manifest.files).filter(file => file.startsWith("assets/story/"))),
    voice: Object.fromEntries(Object.entries(manifest.groups.voice).map(([lang, files]) => [lang, size(files)])),
    music: size(manifest.groups.music),
    gameSounds: size(core.filter(file => file.endsWith(".mp3"))),
    pictures: size(core.filter(file => /\.(webp|jpg|svg)$/.test(file) && !file.startsWith("assets/story/"))),
    fonts: size(core.filter(file => file.endsWith(".woff2"))),
    catalogs: Object.fromEntries(Object.entries(manifest.groups.catalogs).map(([lang, files]) => [lang, size(files)]))
  };
}
