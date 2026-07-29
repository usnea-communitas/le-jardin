import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const catalogPath = resolve(root, 'assets/i18n/catalog.cs.json');
const manifest = JSON.parse(await readFile(resolve(root, 'assets/i18n/audio.cs.json'), 'utf8'));
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const cues = new Map(manifest.cues.map(cue => [cue.id, cue]));
const required = [];

function setMessage(key, value) {
  if (!(key in catalog.messages)) throw new Error(`Czech catalog key is missing: ${key}`);
  catalog.messages[key] = value;
  required.push(key);
}

for (let index = 1; index <= 7; index += 1) {
  const number = String(index).padStart(2, '0');
  const cue = cues.get(`story-${number}`);
  if (!cue) throw new Error(`Missing Czech story cue story-${number}`);
  setMessage(`story.scene.${number}.caption`, cue.caption);
  setMessage(`story.scene.${number}.narration`, cue.input);
}

for (const id of ['soil', 'water', 'food', 'shelter', 'share']) {
  setMessage(`journey.${id}.voice`, cues.get(id).caption);
}

setMessage('guild.voice', cues.get('guild-discovered').caption);
setMessage('gardenVoice.guild', cues.get('guild-discovered').caption);
setMessage('summary.guildReflection', cues.get('guild-discovered').caption);
setMessage('reflection.three.voice', cues.get('reflection-three').caption);
setMessage('reflection.share.voice', cues.get('reflection-share').caption);

for (const season of ['spring', 'summer', 'autumn', 'winter']) {
  setMessage(`season.${season}.passage.voice`, cues.get(`cinematic-${season}`).caption);
}

for (const species of ['hedgehog', 'bee', 'worm']) {
  for (let beat = 1; beat <= 3; beat += 1) {
    setMessage(`resident.${species}.${beat}.text`, cues.get(`${species}-${beat}`).caption);
  }
}

for (const species of ['aphid', 'slug', 'caterpillar']) {
  for (let beat = 1; beat <= 3; beat += 1) {
    setMessage(`pest.${species}.${beat}.text`, cues.get(`${species}-${beat}`).caption);
  }
}

for (const id of ['mulch', 'compost', 'hugel', 'rain', 'kitchen', 'ladybug', 'bee', 'shelter', 'pexeso', 'seeds', 'quiz']) {
  setMessage(`challenge.voice.${id}`, cues.get(`challenge:${id}`).caption);
}

setMessage('gardenVoice.ending', cues.get('ending').caption);
setMessage('completion.summary.flourishing.voice', cues.get('ending').caption);

const temporary = `${catalogPath}.writing`;
await writeFile(temporary, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
await rename(temporary, catalogPath);
console.log(`Synchronized ${required.length} Czech catalog entries with recorded audio.`);
