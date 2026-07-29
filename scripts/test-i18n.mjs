import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogs = {
  en: JSON.parse(await readFile(path.join(root, "assets", "i18n", "catalog.en.json"), "utf8")),
  cs: JSON.parse(await readFile(path.join(root, "assets", "i18n", "catalog.cs.json"), "utf8"))
};
const storage = new Map();
const requested = [];
let replacedWith = null;

globalThis.location = {
  href: "https://garden.example/?lang=cs",
  search: "?lang=cs",
  replace(value) { replacedWith = value; },
  reload() { throw new Error("reload should not be needed"); }
};
globalThis.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); }
};
globalThis.fetch = async url => {
  const match = String(url).match(/catalog\.([^.]+(?:-[^.]+)?)\.json$/u);
  const locale = match && match[1];
  requested.push(locale);
  return locale && catalogs[locale]
    ? { ok: true, async json() { return catalogs[locale]; } }
    : { ok: false, status: 404, async json() { return {}; } };
};

const require = createRequire(import.meta.url);
const i18n = require(path.join(root, "lib", "i18n.js"));
await i18n.bootstrap();

assert.equal(i18n.locale, "cs");
assert.deepEqual(requested, ["en", "cs"]);
assert.notEqual(i18n.translateValue("Garden"), "Garden");
assert.match(i18n.translateValue("Page 2 of 5"), /2/u);
assert.match(i18n.translateValue("Page 2 of 5"), /5/u);
assert.equal(i18n.t("language.label", null, "Language").length > 0, true);
assert.equal(i18n.number(1234.5).includes(","), true);
assert.equal(i18n.normalizeLocale("pl-PL"), "pl");
assert.equal(i18n.normalizeLocale("PL_pl"), "pl");

i18n.setLocaleAndReload("pt");
assert.equal(storage.get(i18n.STORAGE_KEY), "pt-BR");
assert.match(replacedWith, /[?&]lang=pt-BR(?:&|$)/u);

console.log("i18n runtime tests passed.");
