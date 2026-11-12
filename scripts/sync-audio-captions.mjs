// Copy the recorded Garden voice into a language's catalogue, so the subtitles say
// exactly what the voice says: `node scripts/sync-audio-captions.mjs <locale>`
// (cs or fr) reads assets/i18n/audio.<locale>.json and writes catalog.<locale>.json.
// scripts/test-voice.mjs uses captionMessages() to check that they still agree.
import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// The catalogue messages that show a recorded line, and the line they show.
export function captionMessages(manifest) {
  const cues = new Map(manifest.cues.map(cue => [cue.id, cue]));
  const cue = id => {
    if (!cues.has(id)) throw new Error(`audio.${manifest.locale}.json has no cue ${id}`);
    return cues.get(id);
  };
  const messages = {};
  for (let index = 1; index <= 7; index += 1) {
    const number = String(index).padStart(2, '0');
    messages[`story.scene.${number}.caption`] = cue(`story-${number}`).caption;
    messages[`story.scene.${number}.narration`] = cue(`story-${number}`).input;
  }
  for (const id of ['soil', 'water', 'food', 'shelter', 'share']) {
    messages[`journey.${id}.voice`] = cue(id).caption;
  }
  messages['guild.voice'] = cue('guild-discovered').caption;
  messages['gardenVoice.guild'] = cue('guild-discovered').caption;
  messages['summary.guildReflection'] = cue('guild-discovered').caption;
  messages['reflection.three.voice'] = cue('reflection-three').caption;
  messages['reflection.share.voice'] = cue('reflection-share').caption;
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    messages[`season.${season}.passage.voice`] = cue(`cinematic-${season}`).caption;
  }
  for (const species of ['hedgehog', 'bee', 'worm']) {
    for (let beat = 1; beat <= 3; beat += 1) {
      messages[`resident.${species}.${beat}.text`] = cue(`${species}-${beat}`).caption;
    }
  }
  for (const species of ['aphid', 'slug', 'caterpillar']) {
    for (let beat = 1; beat <= 3; beat += 1) {
      messages[`pest.${species}.${beat}.text`] = cue(`${species}-${beat}`).caption;
    }
  }
  for (const id of ['mulch', 'compost', 'hugel', 'rain', 'kitchen', 'ladybug', 'bee', 'shelter', 'pexeso', 'seeds', 'quiz']) {
    messages[`challenge.voice.${id}`] = cue(`challenge:${id}`).caption;
  }
  messages['gardenVoice.ending'] = cue('ending').caption;
  messages['completion.summary.flourishing.voice'] = cue('ending').caption;
  return messages;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const locale = process.argv[2];
  if (!/^[a-z]{2}$/.test(locale || '')) {
    console.error('Usage: node scripts/sync-audio-captions.mjs <locale>   (for example cs or fr)');
    process.exit(1);
  }
  const root = resolve(import.meta.dirname, '..');
  const catalogPath = resolve(root, `assets/i18n/catalog.${locale}.json`);
  const manifest = JSON.parse(await readFile(resolve(root, `assets/i18n/audio.${locale}.json`), 'utf8'));
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const messages = captionMessages(manifest);
  for (const [key, value] of Object.entries(messages)) {
    if (!(key in catalog.messages)) throw new Error(`catalog.${locale}.json has no key ${key}`);
    catalog.messages[key] = value;
  }
  const temporary = `${catalogPath}.writing`;
  await writeFile(temporary, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  await rename(temporary, catalogPath);
  console.log(`Synchronized ${Object.keys(messages).length} ${locale} catalogue entries with the recorded voice.`);
}
