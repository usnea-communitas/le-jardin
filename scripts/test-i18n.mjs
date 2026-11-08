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

// Reverse lookup of English runtime text (the game composes English, the page shows the
// player's language). Catch-all and wrong templates must not hide or mix up text.
i18n.clearMissing();
assert.equal(i18n.translateValue("1 share"), "1 žeton", "a message with a placeholder is matched with its plural form");
assert.equal(i18n.translateValue("12 shares"), "12 žetonů");
assert.match(
  i18n.translateValue("Camille will add cherries to the pantry plan and note what remains for others."),
  /: třešně\./u,
  "a name the game lower-cases is still found, and stays lower-case"
);
assert.equal(
  i18n.translateValue("Learned practice · safe rainwater chain · woody-bed monitoring"),
  `${i18n.t("systems.learned", { practice: "" }).replace(/\s*$/u, "")} ${i18n.translateValue("safe rainwater chain")} · ${i18n.translateValue("woody-bed monitoring")}`,
  "each item of a list joined with · is translated"
);
assert.equal(i18n.translateValue("Chapter 1: At the edge of Menet"), i18n.t("story.chapterAria", { number: 1, title: i18n.translateValue("At the edge of Menet") }),
  "a count placeholder only takes a number, so a chapter title is not split at \"of\"");
assert.equal(i18n.translateValue("🔥 Hot-bed idea"), `🔥 ${i18n.translateValue("Hot-bed idea")}`, "an emoji before a known text is kept");
const unknownSentence = "Choose a path that nobody has walked before today";
assert.equal(i18n.translateValue(unknownSentence), unknownSentence, "an unknown sentence is not half translated by a short template");
assert.equal(i18n.translateValue("Water cannot jump there yet."), "Water cannot jump there yet.");
const reported = i18n.missing.map(entry => entry.value);
assert.ok(reported.includes(unknownSentence) && reported.includes("Water cannot jump there yet."), "untranslated sentences are reported, not hidden by catch-all templates");
const localized = `${i18n.translateValue("Spring")} — ${i18n.t("common.current", null, "current")}`;
i18n.clearMissing();
i18n.translateValue(localized);
assert.deepEqual(i18n.missing, [], "text already in the player's language is not reported");

console.log("i18n reverse lookup tests passed.");
