// The Garden's recorded voice in Czech and French (package J-06): every line the
// game can speak has a recording in each voiced language, named so the game finds
// it next to the English one; each recording is a mono 44.1 kHz MP3 with a length
// header (Safari and iOS read the duration from it) whose length matches the list;
// and the subtitles in the catalogue say exactly what the voice says.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { captionMessages } from "./sync-audio-captions.mjs";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(path.join(root, file));
const source = read("Permaculture Garden v2.dc.html").toString("utf8");

// The first MPEG audio frame and its Xing/Info header, read without ffprobe.
function mp3Info(buffer) {
  let at = 0;
  if (buffer.subarray(0, 3).toString("latin1") === "ID3") {
    const size = (buffer[6] & 0x7f) << 21 | (buffer[7] & 0x7f) << 14 | (buffer[8] & 0x7f) << 7 | (buffer[9] & 0x7f);
    at = 10 + size + (buffer[5] & 0x10 ? 10 : 0);
  }
  while (at + 4 < buffer.length && !(buffer[at] === 0xff && (buffer[at + 1] & 0xe0) === 0xe0)) at += 1;
  const header = buffer.readUInt32BE(at);
  const mpeg1 = ((header >> 19) & 3) === 3;
  const layer3 = ((header >> 17) & 3) === 1;
  const sampleRate = mpeg1 ? [44100, 48000, 32000][(header >> 10) & 3] : 0;
  const channels = ((header >> 6) & 3) === 3 ? 1 : 2;
  const tagAt = at + 4 + (channels === 1 ? 17 : 32);
  const tag = buffer.subarray(tagAt, tagAt + 4).toString("latin1");
  const frames = (tag === "Info" || tag === "Xing") && (buffer.readUInt32BE(tagAt + 4) & 1) ? buffer.readUInt32BE(tagAt + 8) : 0;
  return { mpeg1, layer3, sampleRate, channels, frames, durationMs: frames && sampleRate ? Math.round(frames * 1152 / sampleRate * 1000) : 0 };
}

// What the game can say: the seven story scenes and the Garden's lines.
const storyVoices = [...source.matchAll(/voice:'(assets\/audio\/story\/narration-\d\d\.mp3)'/g)].map(match => match[1]);
assert.equal(storyVoices.length, 7, "the opening story has seven narrated scenes");
const tableStart = source.indexOf("gardenVoiceFiles={");
const table = source.slice(tableStart + "gardenVoiceFiles=".length, source.indexOf("\n  };", tableStart) + 4);
const gardenVoiceFiles = Function(`"use strict"; return (${table});`)();
const english = id => (typeof gardenVoiceFiles[id] === "object" ? gardenVoiceFiles[id].en : gardenVoiceFiles[id]);
// "begin" is the first soil line played before anything is placed
assert.equal(english("begin"), english("soil"));
const lineIds = Object.keys(gardenVoiceFiles).filter(id => id !== "begin");
const expected = new Map([
  ...storyVoices.map((file, index) => [`story-${String(index + 1).padStart(2, "0")}`, file]),
  ...lineIds.map(id => [id, english(id)])
]);
assert.equal(expected.size, 49, "the Garden has 49 recorded lines");
for (const [id, file] of expected) assert.ok(existsSync(path.join(root, file)), `the English recording of ${id} exists (${file})`);

// The languages with their own recordings, as the game and the offline package see them.
const voiceLocales = JSON.parse(source.match(/voiceLocales=(\[[^\]]*\])/)[1].replace(/'/g, '"'));
assert.deepEqual(voiceLocales, ["cs", "fr"], "the game speaks Czech and French in their own recordings");
const offline = require("../lib/offline.js");
for (const locale of voiceLocales) assert.equal(offline.voiceLocale(locale), locale);
assert.equal(offline.voiceLocale("de"), "en", "every other language hears the English voice");
const offlineManifest = JSON.parse(read("offline-manifest.json"));

let minutes = 0;
for (const locale of voiceLocales) {
  const manifest = JSON.parse(read(`assets/i18n/audio.${locale}.json`));
  assert.equal(manifest.locale, locale);
  assert.equal(manifest.languageCode, locale);
  assert.ok(manifest.voice && manifest.voice.model && manifest.voice.name, `audio.${locale}.json names its voice and model`);
  assert.deepEqual(manifest.cues.map(cue => cue.id).sort(), [...expected.keys()].sort(), `audio.${locale}.json has exactly the game's 49 lines`);
  assert.equal(new Set(manifest.cues.map(cue => cue.targetPath)).size, 49, `audio.${locale}.json names 49 different files`);

  for (const cue of manifest.cues) {
    const englishFile = expected.get(cue.id);
    const folder = englishFile.startsWith("assets/audio/story/") ? "assets/audio/story/" : "assets/audio/garden-voice/";
    assert.equal(cue.targetPath, folder + locale + "/" + path.basename(englishFile), `${locale} ${cue.id} sits where the game looks for it`);
    if (typeof gardenVoiceFiles[cue.id] === "object") {
      assert.equal(gardenVoiceFiles[cue.id][locale], cue.targetPath, `the game maps ${cue.id} to the ${locale} recording`);
    }
    assert.match(cue.input, /^\[[^\]]+\] [^[\]]+$/u, `${locale} ${cue.id}: one stage direction, then the spoken text`);
    assert.equal(cue.caption, cue.input.replace(/^\[[^\]]+\]\s*/u, ""), `${locale} ${cue.id}: the caption is the spoken text`);

    assert.ok(existsSync(path.join(root, cue.targetPath)), `${cue.targetPath} exists`);
    const info = mp3Info(read(cue.targetPath));
    assert.ok(info.mpeg1 && info.layer3 && info.sampleRate === 44100 && info.channels === 1, `${cue.targetPath} is a mono 44.1 kHz MP3`);
    assert.ok(info.frames > 0, `${cue.targetPath} has a length header`);
    assert.ok(Math.abs(info.durationMs - cue.durationMs) <= 60, `${cue.targetPath} lasts ${info.durationMs} ms as listed (${cue.durationMs})`);
    // a take that ran on, or stopped short, shows in its length
    const limit = cue.id.startsWith("story-") ? 16000 : /^(aphid|slug|caterpillar|hedgehog|bee|worm)-\d$/.test(cue.id) ? 32000 : 13000;
    assert.ok(cue.durationMs >= 2000 && cue.durationMs <= limit, `${cue.targetPath} lasts between 2 and ${limit / 1000} s (${cue.durationMs} ms)`);
    assert.ok(offlineManifest.groups.voice[locale].includes(cue.targetPath), `${cue.targetPath} is in the ${locale} voice of the offline package`);
    minutes += info.durationMs / 60000;
  }

  const catalog = JSON.parse(read(`assets/i18n/catalog.${locale}.json`)).messages;
  for (const [key, value] of Object.entries(captionMessages(manifest))) {
    assert.equal(catalog[key], value, `catalog.${locale}.json ${key} says what the ${locale} voice says; run node scripts/sync-audio-captions.mjs ${locale}`);
  }
}

console.log(`Garden voice OK: ${voiceLocales.length} languages × 49 recordings with length headers and matching subtitles, ${minutes.toFixed(1)} minutes.`);
