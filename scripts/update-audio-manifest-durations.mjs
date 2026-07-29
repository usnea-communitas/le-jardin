import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifestName = process.argv[2] || 'audio.cs.json';
if (!/^audio\.[a-zA-Z0-9.-]+\.json$/u.test(manifestName)) {
  throw new Error(`Unsafe audio manifest name: ${manifestName}`);
}
const manifestPath = resolve(root, 'assets/i18n', manifestName);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

for (const cue of manifest.cues) {
  const audioPath = resolve(root, cue.targetPath);
  const duration = Number(execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    audioPath
  ], { encoding: 'utf8' }).trim());

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not read duration for ${cue.targetPath}`);
  }
  cue.durationMs = Math.round(duration * 1000);
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Updated ${manifest.cues.length} durations in ${manifestName}.`);
