// The media budget (docs/MEDIA-BUDGET.md): a first visit and each kind of media
// stay within their limits, or the build stops and says which one grew.
import { fileURLToPath } from "node:url";
import path from "node:path";
import { BUDGET, measure } from "./media-budget.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const m = measure(root);
const rows = [
  ["first visit, phone", m.firstVisitPhone, BUDGET.firstVisitPhone],
  ["first visit, desktop", m.firstVisitDesktop, BUDGET.firstVisitDesktop],
  ...Object.entries(m.gates).map(([file, kib]) => [path.basename(file), kib, BUDGET.gate]),
  ["story paintings", m.story, BUDGET.story],
  ...Object.entries(m.voice).map(([lang, kib]) => [`the Garden's voice, ${lang}`, kib, BUDGET.voicePerLanguage]),
  ["music", m.music, BUDGET.music],
  ["game sounds", m.gameSounds, BUDGET.gameSounds],
  ["other pictures", m.pictures, BUDGET.pictures],
  ["fonts", m.fonts, BUDGET.fonts],
  ...Object.entries(m.catalogs).map(([lang, kib]) => [`texts, ${lang}`, kib, BUDGET.catalogPerLanguage])
];
const over = rows.filter(([, kib, limit]) => kib > limit);
if (over.length) {
  for (const [name, kib, limit] of over) console.error(`Over the media budget: ${name} is ${Math.round(kib)} KiB, the limit is ${limit} KiB (docs/MEDIA-BUDGET.md).`);
  process.exit(1);
}
console.log(`Media budget OK: first visit ${Math.round(m.firstVisitPhone)} KiB on a phone and ${Math.round(m.firstVisitDesktop)} KiB on a desktop; ${rows.length} limits kept.`);
