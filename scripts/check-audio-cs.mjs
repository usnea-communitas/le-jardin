import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifestPath = resolve(root, 'assets/i18n/audio.cs.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const errors = [];

if (manifest.locale !== 'cs' || manifest.languageCode !== 'cs') {
  errors.push('The Czech manifest locale metadata is invalid.');
}
if (!Array.isArray(manifest.cues) || manifest.cues.length !== 49) {
  errors.push(`Expected 49 Czech cues, found ${manifest.cues?.length ?? 0}.`);
}

const ids = new Set();
const paths = new Set();
let totalDurationMs = 0;

for (const cue of manifest.cues || []) {
  if (!cue.id || ids.has(cue.id)) errors.push(`Duplicate or missing cue id: ${cue.id}`);
  if (!cue.targetPath || paths.has(cue.targetPath)) errors.push(`Duplicate or missing cue path: ${cue.targetPath}`);
  ids.add(cue.id);
  paths.add(cue.targetPath);

  if (!cue.caption || cue.caption !== cue.input.replace(/\[[^\]]+\]\s*/g, '').trim()) {
    errors.push(`Caption does not match the spoken text for ${cue.id}.`);
  }

  const path = resolve(root, cue.targetPath);
  if (!existsSync(path) || statSync(path).size < 1024) {
    errors.push(`Missing or empty audio file: ${cue.targetPath}`);
    continue;
  }

  const probe = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'stream=codec_name,sample_rate,channels:format=duration',
    '-of', 'json',
    path
  ], { encoding: 'utf8' }));
  const stream = probe.streams?.[0];
  const durationMs = Math.round(Number(probe.format?.duration) * 1000);

  if (stream?.codec_name !== 'mp3' || stream?.sample_rate !== '44100' || stream?.channels !== 1) {
    errors.push(`Unexpected audio format for ${cue.targetPath}.`);
  }
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    errors.push(`Invalid duration for ${cue.targetPath}.`);
  } else {
    totalDurationMs += durationMs;
    if (Math.abs(durationMs - Number(cue.durationMs)) > 50) {
      errors.push(`Manifest duration differs for ${cue.targetPath}.`);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Czech audio OK: ${manifest.cues.length} cues, ${(totalDurationMs / 60000).toFixed(2)} minutes.`);
