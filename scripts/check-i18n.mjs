import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogDir = path.join(root, "assets", "i18n");
const supported = ["en", "cs", "de", "fr", "es", "pt-BR", "pl", "ru", "zh-CN"];
const requireAll = process.argv.includes("--require-all") || process.env.PG_REQUIRE_ALL_LOCALES === "1";
const placeholderPattern = /%\{([a-zA-Z0-9_]+)\}|\{([a-zA-Z0-9_]+)\}/g;

function placeholders(value) {
  const names = [];
  for (const match of String(value).matchAll(placeholderPattern)) names.push(match[1] || match[2]);
  return names.sort();
}

function messageForms(value, label) {
  if (typeof value === "string") return [value];
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} must be a string or plural-form object.`);
  const keys = Object.keys(value);
  assert.ok(keys.length > 0, `${label} must not be empty.`);
  for (const key of keys) {
    assert.match(key, /^(?:zero|one|two|few|many|other|=\d+|source|value|text|template|translation)$/, `${label} has an unsupported form "${key}".`);
    assert.equal(typeof value[key], "string", `${label}.${key} must be a string.`);
  }
  return Object.values(value);
}

function validateText(value, label) {
  assert.ok(value.trim().length > 0, `${label} must not be blank.`);
  assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffd]/u.test(value), `${label} contains an invalid character.`);
  assert.ok(!/<\/?[a-z][^>]*>/iu.test(value), `${label} contains HTML. Keep catalog text plain.`);
}

function validateCatalog(catalog, expectedLocale, english) {
  assert.ok(catalog && typeof catalog === "object" && !Array.isArray(catalog), `${expectedLocale}: catalog must be an object.`);
  assert.equal(catalog.version, "1.0.0", `${expectedLocale}: unsupported catalog version.`);
  assert.equal(catalog.locale, expectedLocale, `${expectedLocale}: locale metadata does not match its filename.`);
  assert.ok(catalog.messages && typeof catalog.messages === "object" && !Array.isArray(catalog.messages), `${expectedLocale}: messages object is required.`);
  assert.ok(catalog.templates && typeof catalog.templates === "object" && !Array.isArray(catalog.templates), `${expectedLocale}: templates object is required.`);

  for (const section of ["messages", "templates"]) {
    const sourceKeys = Object.keys(english[section]).sort();
    const localeKeys = Object.keys(catalog[section]).sort();
    assert.deepEqual(localeKeys, sourceKeys, `${expectedLocale}: ${section} keys must exactly match English.`);
    for (const key of sourceKeys) {
      const sourceForms = messageForms(english[section][key], `en.${section}.${key}`);
      const translatedForms = messageForms(catalog[section][key], `${expectedLocale}.${section}.${key}`);
      translatedForms.forEach((form, index) => {
        const source = sourceForms[Math.min(index, sourceForms.length - 1)];
        if (source === "") {
          assert.equal(form, "", `${expectedLocale}.${section}.${key} is an intentionally empty accessibility value.`);
          return;
        }
        validateText(form, `${expectedLocale}.${section}.${key}`);
        assert.deepEqual(
          placeholders(form),
          placeholders(source),
          `${expectedLocale}.${section}.${key} must preserve placeholders.`
        );
      });
    }
  }
}

function validateReverseLookupCollisions(english, localeCatalog, locale) {
  const conflicts = [];
  for (const section of ["messages", "templates"]) {
    const grouped = new Map();
    for (const [key, value] of Object.entries(english[section])) {
      for (const source of messageForms(value, `en.${section}.${key}`)) {
        if (!grouped.has(source)) grouped.set(source, []);
        grouped.get(source).push(key);
      }
    }
    for (const [source, keys] of grouped) {
      if (keys.length < 2) continue;
      const translated = new Set(keys.map(key => JSON.stringify(localeCatalog[section][key])));
      if (translated.size > 1) conflicts.push(`${section}:${source}`);
    }
  }
  return conflicts;
}

const files = await readdir(catalogDir);
const catalogFiles = files.filter(name => /^catalog\..+\.json$/u.test(name));
const localesOnDisk = catalogFiles.map(name => name.slice("catalog.".length, -".json".length));
const unknown = localesOnDisk.filter(locale => !supported.includes(locale));
assert.deepEqual(unknown, [], `Unsupported locale catalog files found: ${unknown.join(", ")}`);

const english = JSON.parse(await readFile(path.join(catalogDir, "catalog.en.json"), "utf8"));
validateCatalog(english, "en", english);
for (const key of ["language.label", "language.aria", "language.changeAnnouncement", "audio.englishStatus", "boot.error.title", "boot.error.detail", "boot.error.retry"]) {
  assert.equal(typeof english.messages[key], "string", `English catalog is missing required runtime key: ${key}`);
}

const loaded = new Map([["en", english]]);
const collisionWarnings = [];
for (const locale of supported.slice(1)) {
  const filename = path.join(catalogDir, `catalog.${locale}.json`);
  if (!localesOnDisk.includes(locale)) {
    if (requireAll) assert.fail(`Missing required locale catalog: assets/i18n/catalog.${locale}.json`);
    continue;
  }
  const catalog = JSON.parse(await readFile(filename, "utf8"));
  validateCatalog(catalog, locale, english);
  const conflicts = validateReverseLookupCollisions(english, catalog, locale);
  if (conflicts.length) collisionWarnings.push(`${locale}:${conflicts.length}`);
  loaded.set(locale, catalog);
}

const require = createRequire(import.meta.url);
const i18n = require(path.join(root, "lib", "i18n.js"));
assert.deepEqual(i18n.SUPPORTED_LOCALES, supported, "Runtime locale whitelist differs from the catalog contract.");
assert.equal(i18n.normalizeLocale("pt"), "pt-BR");
assert.equal(i18n.normalizeLocale("zh-Hans-CN"), "zh-CN");
assert.equal(i18n.normalizeLocale("pl-PL"), "pl");
assert.equal(i18n.normalizeLocale("ru-RU"), "ru");
assert.equal(i18n.normalizeLocale("unsupported"), null);

const source = await readFile(path.join(root, "Permaculture Garden v2.dc.html"), "utf8");
const i18nPosition = source.indexOf('<script src="lib/i18n.js"></script>');
const lessonPosition = source.indexOf('<script src="lib/living-lesson.js"></script>');
assert.ok(i18nPosition >= 0 && lessonPosition > i18nPosition, "i18n runtime must load before the game and Living Lesson client.");
for (const testId of ["language-select-header", "language-select-menu", "language-select-story"]) {
  assert.ok(source.includes(`data-testid="${testId}"`), `Missing language selector: ${testId}`);
}
assert.ok(source.includes("begin:'assets/audio/garden-voice/milestone-soil.mp3'"), "Missing begin voice alias.");
for (const id of ["mulch", "compost", "hugel", "rain", "kitchen", "ladybug", "bee", "shelter", "pexeso", "seeds", "quiz"]) {
  assert.ok(
    source.includes(`'challenge:${id}':{cs:'assets/audio/garden-voice/cs/challenge-${id}.mp3'`),
    `Missing Czech challenge voice mapping: challenge:${id}`
  );
  assert.ok(
    source.includes(`en:'assets/audio/garden-voice/challenge-${id}.mp3'`),
    `Missing exact English fallback voice mapping: challenge:${id}`
  );
}
assert.match(source, /dialog==='pest-story'[\s\S]{0,220}speakGarden\(p\.id\)/u, "Pest-story voice is not resumed after unmuting.");
assert.ok(source.includes("this.localizedVoiceSources(src,'garden')"), "Garden voice does not use localized audio fallback.");
assert.ok(source.includes("this.localizedVoiceSources(def.voice,'story')"), "Story voice does not use localized audio fallback.");
assert.ok(source.includes("showEnglishAudioNote:locale!=='en'&&locale!=='cs'"), "Non-English audio status note is missing.");
assert.match(source, /res==='won'[\s\S]{0,800}speakGarden\('challenge:'\+g\.key\)/u, "Completed challenges do not play their localized garden voice.");

const livingLesson = require(path.join(root, "lib", "living-lesson.js"));
assert.deepEqual(livingLesson.SUPPORTED_LOCALES, supported, "Living Lesson locale whitelist differs from the catalog contract.");
assert.equal(livingLesson.sanitizeSnapshot({ locale: "ru-RU" }).locale, "ru");
assert.equal(livingLesson.sanitizeSnapshot({ locale: "pl-PL" }).locale, "pl");
assert.notEqual(
  livingLesson.fingerprint({ locale: "en" }),
  livingLesson.fingerprint({ locale: "cs" }),
  "Living Lesson cache fingerprint must be isolated by locale."
);
const apiSource = await readFile(path.join(root, "api", "garden-reflection.js"), "utf8");
assert.ok(apiSource.includes("responseLanguage"), "Living Lesson prompt does not select a safe response language.");

const audioManifest = JSON.parse(await readFile(path.join(catalogDir, "audio.cs.json"), "utf8"));
assert.equal(audioManifest.locale, "cs", "Czech audio manifest has the wrong locale.");
assert.equal(audioManifest.languageCode, "cs", "Czech ElevenLabs language code is missing.");
assert.ok(Array.isArray(audioManifest.cues) && audioManifest.cues.length > 0, "Czech audio manifest has no cues.");
const audioIds = audioManifest.cues.map(cue => cue.id);
assert.equal(new Set(audioIds).size, audioIds.length, "Czech audio manifest has duplicate cue IDs.");
const requiredAudioIds = [
  ...Array.from({ length: 7 }, (_, index) => `story-0${index + 1}`),
  "soil", "water", "food", "shelter", "share", "guild-discovered",
  "reflection-three", "reflection-share",
  "cinematic-spring", "cinematic-summer", "cinematic-autumn", "cinematic-winter",
  "aphid-1", "aphid-2", "aphid-3", "slug-1", "slug-2", "slug-3",
  "caterpillar-1", "caterpillar-2", "caterpillar-3",
  "hedgehog-1", "hedgehog-2", "hedgehog-3",
  "bee-1", "bee-2", "bee-3", "worm-1", "worm-2", "worm-3",
  ...["mulch", "compost", "hugel", "rain", "kitchen", "ladybug", "bee", "shelter", "pexeso", "seeds", "quiz"].map(id => `challenge:${id}`),
  "ending"
];
assert.deepEqual(requiredAudioIds.filter(id => !audioIds.includes(id)), [], "Czech audio manifest is missing required cues.");
for (const cue of audioManifest.cues) {
  assert.equal(typeof cue.caption, "string", `Czech audio cue ${cue.id} has no caption.`);
  assert.ok(Number(cue.durationMs) > 0, `Czech audio cue ${cue.id} has no measured duration.`);
  assert.match(cue.targetPath, /^assets\/audio\/(?:story|garden-voice)\/cs\/[^/]+\.mp3$/u, `Unsafe Czech audio target path for ${cue.id}.`);
  const info = await stat(path.join(root, cue.targetPath));
  assert.ok(info.isFile() && info.size > 5000, `Czech audio file is missing or unexpectedly small: ${cue.targetPath}`);
}

const englishChallengeAudio = JSON.parse(await readFile(path.join(catalogDir, "audio.en-challenges.json"), "utf8"));
assert.equal(englishChallengeAudio.locale, "en", "English challenge audio manifest has the wrong locale.");
assert.deepEqual(
  englishChallengeAudio.cues.map(cue => cue.id).sort(),
  requiredAudioIds.filter(id => id.startsWith("challenge:")).sort(),
  "English challenge audio manifest must contain all eleven challenge cues."
);
for (const cue of englishChallengeAudio.cues) {
  assert.match(cue.targetPath, /^assets\/audio\/garden-voice\/challenge-[^/]+\.mp3$/u, `Unsafe English challenge audio target path for ${cue.id}.`);
  const info = await stat(path.join(root, cue.targetPath));
  assert.ok(info.isFile() && info.size > 5000, `English challenge audio file is missing or unexpectedly small: ${cue.targetPath}`);
}

const missing = supported.filter(locale => !loaded.has(locale));
const suffix = missing.length ? `; awaiting ${missing.join(", ")}` : "; all locale packs present";
console.log(`i18n catalogs valid (${loaded.size}/${supported.length} locales, ${Object.keys(english.messages).length + Object.keys(english.templates).length} source keys${suffix}).`);
if (collisionWarnings.length) {
  console.warn(`i18n note: duplicate English UI phrases use the first semantic match (${collisionWarnings.join(", ")} contextual alternatives).`);
}
