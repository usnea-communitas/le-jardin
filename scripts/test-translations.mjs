// The translation review kit: the export lists every message, and the import
// changes exactly the reviewed translations and refuses broken placeholders.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALES, readCatalog, writeCatalogText, exportLocale, toCsv, parseCsv, importLocale } from "./translations.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const en = readCatalog("en");
const ids = Object.keys(en.messages);

// every locale exports one row per English message
for (const locale of LOCALES) {
  const rows = exportLocale(en, readCatalog(locale), locale);
  assert.deepEqual(rows[0], ["id", "en", locale, "area", "note"]);
  const listed = new Set(rows.slice(1).map(r => r[0].split("#")[0]));
  assert.deepEqual([...listed].sort(), [...ids].sort(), `${locale}: every message is listed`);
}

// CSV round trip with commas, quotes and line breaks
assert.deepEqual(parseCsv(toCsv([["id", "de"], ['a, "b"', "line\nbreak"]])), [["id", "de"], ['a, "b"', "line\nbreak"]]);

// the import changes exactly the edited message and keeps the file's format
const de = readCatalog("de");
const rows = exportLocale(en, de, "de");
const tip = rows.findIndex(r => r[0] === "pillars.soil.tip");
rows[tip][2] = "Lebendiger Boden {value} % – neu, mit \"Anführung\", und Komma";
rows[tip][4] = "a reviewer note is ignored";
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
