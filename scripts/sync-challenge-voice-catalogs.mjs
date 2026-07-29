import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const i18nRoot = resolve(root, 'assets/i18n');
const ids = ['mulch', 'compost', 'hugel', 'rain', 'kitchen', 'ladybug', 'bee', 'shelter', 'pexeso', 'seeds', 'quiz'];

const englishAudio = JSON.parse(await readFile(resolve(i18nRoot, 'audio.en-challenges.json'), 'utf8'));
const czechAudio = JSON.parse(await readFile(resolve(i18nRoot, 'audio.cs.json'), 'utf8'));
const english = JSON.parse(await readFile(resolve(i18nRoot, 'catalog.en.json'), 'utf8'));
const czech = JSON.parse(await readFile(resolve(i18nRoot, 'catalog.cs.json'), 'utf8'));

const englishCues = new Map(englishAudio.cues.map(cue => [cue.id, cue]));
const czechCues = new Map(czechAudio.cues.map(cue => [cue.id, cue]));

for (const id of ids) {
  const cueId = `challenge:${id}`;
  const englishCue = englishCues.get(cueId);
  const czechCue = czechCues.get(cueId);
  if (!englishCue?.caption || !czechCue?.caption) {
    throw new Error(`Missing bilingual challenge voice cue: ${cueId}`);
  }
  english.messages[`challenge.voice.${id}`] = englishCue.caption;
  czech.messages[`challenge.voice.${id}`] = czechCue.caption;
}

async function atomicWrite(filename, value) {
  const path = resolve(i18nRoot, filename);
  const temporary = `${path}.writing`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, path);
}

await atomicWrite('catalog.en.json', english);
await atomicWrite('catalog.cs.json', czech);
console.log(`Synchronized ${ids.length} English and Czech challenge voice captions.`);
