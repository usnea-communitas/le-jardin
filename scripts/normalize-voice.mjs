// Level the Garden's recorded voice for one language and record each length:
//   node scripts/normalize-voice.mjs <locale> <folder with the chosen takes>
// The folder holds story/narration-NN.mp3 and garden-voice/<name>.mp3, named as in
// assets/i18n/audio.<locale>.json. Each take is measured, then brought to the list's
// loudness (-16 LUFS, true peaks under -2 dB) in a second, linear pass, so nothing
// pumps; quiet lead-in and tail longer than a breath are shortened to 0.25 s. The
// result is a mono 44.1 kHz 128 kbit/s MP3 with a length header, and its duration
// goes into the list. Needs ffmpeg and ffprobe.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [locale, from] = process.argv.slice(2);
if (!/^[a-z]{2}$/.test(locale || '') || !from || !existsSync(from)) {
  console.error('Usage: node scripts/normalize-voice.mjs <locale> <folder with the chosen takes>');
  process.exit(1);
}
const root = path.resolve(import.meta.dirname, '..');
const listPath = path.join(root, `assets/i18n/audio.${locale}.json`);
const list = JSON.parse(readFileSync(listPath, 'utf8'));
const { targetLufs = -16, truePeakDb = -2 } = list.voice;
const target = `I=${targetLufs}:TP=${truePeakDb}:LRA=7`;
// keep at most a quarter of a second of quiet before and after the voice
const trim = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.25,' +
  'areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.25,areverse';

const ffmpeg = args => {
  const run = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(run.stderr);
  return run.stderr;
};

for (const cue of list.cues) {
  const input = path.join(from, cue.targetPath.replace('assets/audio/', '').replace(`/${locale}/`, '/'));
  if (!existsSync(input)) throw new Error(`Missing take for ${cue.id}: ${input}`);
  const report = ffmpeg(['-i', input, '-af', `aresample=44100,${trim},loudnorm=${target}:print_format=json`, '-f', 'null', '-']);
  const m = JSON.parse(report.slice(report.lastIndexOf('{'), report.lastIndexOf('}') + 1));
  const output = path.join(root, cue.targetPath);
  mkdirSync(path.dirname(output), { recursive: true });
  const temporary = output.replace(/\.mp3$/, '.leveling.mp3');
  ffmpeg(['-y', '-i', input, '-map_metadata', '-1', '-af',
    `aresample=44100,${trim},loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=44100`,
    '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', '-write_xing', '1', temporary]);
  renameSync(temporary, output);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', output], { encoding: 'utf8' });
  cue.durationMs = Math.round(Number(probe.stdout.trim()) * 1000);
  if (!(cue.durationMs > 0)) throw new Error(`Could not read the length of ${output}`);
  console.log(`${cue.id.padEnd(18)} ${String(cue.durationMs).padStart(6)} ms  (was ${m.input_i} LUFS, peak ${m.input_tp} dB)`);
}
writeFileSync(listPath, JSON.stringify(list, null, 2) + '\n');
console.log(`Levelled ${list.cues.length} ${locale} recordings and wrote their lengths to audio.${locale}.json.`);
