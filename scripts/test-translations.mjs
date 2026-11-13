// The translation review kit: the export lists every message, and the import
// changes exactly the reviewed translations and refuses broken placeholders.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALES, readCatalog, writeCatalogText, exportLocale, toCsv, parseCsv, importLocale, readNotes, notesFor } from "./translations.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const en = readCatalog("en");
const ids = Object.keys(en.messages);

const notes = readNotes();

// every locale exports one row per English message, each once
for (const locale of LOCALES) {
  const rows = exportLocale(en, readCatalog(locale), locale, notes);
  assert.deepEqual(rows[0], ["id", "en", locale, "area", "check", "note"]);
  const listed = new Set(rows.slice(1).map(r => r[0].split("#")[0]));
  assert.deepEqual([...listed].sort(), [...ids].sort(), `${locale}: every message is listed`);
  assert.equal(new Set(rows.slice(1).map(r => r[0])).size, rows.length - 1, `${locale}: every row once`);
}

// the second reading (S-19): every locale has its record, tied to messages the
// game has, and its questions are the first rows a reviewer sees
for (const locale of LOCALES) {
  const own = notesFor(en, notes, locale);
  assert.match(own.read, /^\d{4}-\d{2}-\d{2}$/, `${locale}: the day of the second reading`);
  assert.ok(own.check.length > 0, `${locale}: places for a native speaker`);
  for (const n of own.fixed) assert.ok(n.before && n.after && n.why, `${locale}: ${n.id} is recorded with its reason`);
  const rows = exportLocale(en, readCatalog(locale), locale, notes);
  assert.deepEqual(rows.slice(1, 1 + own.check.length).map(r => [r[0], r[4]]), own.check.map(n => [n.id, n.question]), `${locale}: the questions come first`);
  assert.ok(rows.slice(1 + own.check.length).every(r => r[4] === ""), `${locale}: no question below them`);
}
assert.throws(() => notesFor(en, { de: { check: [{ id: "no.such.id", question: "?" }] } }, "de"), /no message no\.such\.id/);

// the review sheets native speakers read are current
for (const locale of LOCALES) {
  const sheet = readFileSync(path.join(root, "docs/translations", `${locale}.csv`), "utf8");
  assert.equal(sheet, toCsv(exportLocale(en, readCatalog(locale), locale, notes)), `docs/translations/${locale}.csv is out of date; run npm run translations:export`);
}

// CSV round trip with commas, quotes and line breaks
assert.deepEqual(parseCsv(toCsv([["id", "de"], ['a, "b"', "line\nbreak"]])), [["id", "de"], ['a, "b"', "line\nbreak"]]);

// the import changes exactly the edited message and keeps the file's format
const de = readCatalog("de");
const rows = exportLocale(en, de, "de", notes);
const tip = rows.findIndex(r => r[0] === "pillars.soil.tip");
rows[tip][2] = "Lebendiger Boden {value} % – neu, mit \"Anführung\", und Komma";
rows[tip][5] = "a reviewer note is ignored";
rows[1][4] = "a question is ignored too";
const broken = rows.findIndex(r => r[0] === "pillars.water.tip");
rows[broken][2] = "Wasser ohne Platzhalter";
const plural = rows.findIndex(r => r[0] === "certificate.gifts#other");
rows[plural][2] = "{count} kleine Geschenke";
rows.push(["no.such.id", "", "etwas", "", ""]);
const result = importLocale(en, de, "de", toCsv(rows));
assert.deepEqual(result.edits.map(e => e.id), ["pillars.soil.tip", "certificate.gifts#other"]);
assert.deepEqual(result.refused, ["pillars.water.tip"], "a translation without its {value} is refused");
assert.deepEqual(result.unknown, ["no.such.id"]);
for (const id of ids) {
  const expected = id === "pillars.soil.tip" ? rows[tip][2]
    : id === "certificate.gifts" ? { ...de.messages[id], other: "{count} kleine Geschenke" }
    : de.messages[id];
  assert.deepEqual(result.catalog.messages[id], expected, id);
}
const original = readFileSync(path.join(root, "assets", "i18n", "catalog.de.json"), "utf8");
assert.equal(writeCatalogText(de), original, "the catalogue is written back in its own format");

console.log("Translation review kit tests passed.");
