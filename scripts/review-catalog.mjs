import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateText, Output } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';

const root = resolve(import.meta.dirname, '..');
const catalogRoot = resolve(root, 'assets/i18n');

function argument(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const locale = argument('locale');
const modelId = argument('model', locale === 'cs' ? 'openai/gpt-5.6-sol' : 'openai/gpt-5.6-terra');
const noWrite = process.argv.includes('--no-write');
const localeRules = {
  cs: 'Natural contemporary Czech; always informal singular ty. The Garden is grammatically feminine. Avoid calques, formal vy/vás, false certainty and stiff nominal phrases.',
  de: 'Idiomatic contemporary German from Germany; informal singular du. Prefer concise, clear educational language and avoid needless noun chains.',
  fr: 'Idiomatic contemporary French from France; informal singular tu. The personified jardin is grammatically masculine. Avoid anglicisms and literal English syntax.',
  es: 'Natural broadly understandable international Spanish; informal singular tú. Avoid a strongly regional variety and literal English syntax.',
  'pt-BR': 'Natural Brazilian Portuguese, using você; never European Portuguese wording. Keep labels concise and conversational.',
  pl: 'Natural contemporary Polish; always informal singular ty. Prefer concise native Polish syntax, avoid English calques and handle grammatical gender around runtime placeholders safely.',
  ru: 'Natural modern Russian; informal singular ты. The personified Garden is grammatically feminine where required. Avoid English calques.',
  'zh-CN': 'Natural concise Mainland Simplified Chinese using 你. Avoid English word order, unnecessary spaces and translationese.'
};

if (!localeRules[locale]) throw new Error(`Unsupported review locale: ${locale}`);
if (!process.env.VERCEL_OIDC_TOKEN && !process.env.AI_GATEWAY_API_KEY) {
  throw new Error('VERCEL_OIDC_TOKEN or AI_GATEWAY_API_KEY is required.');
}

const english = JSON.parse(await readFile(resolve(catalogRoot, 'catalog.en.json'), 'utf8'));
const targetPath = resolve(catalogRoot, `catalog.${locale}.json`);
const target = JSON.parse(await readFile(targetPath, 'utf8'));
const glossary = await readFile(resolve(catalogRoot, 'LOCALIZATION_GLOSSARY.md'), 'utf8');

const pairs = [];
for (const section of ['messages', 'templates']) {
  for (const [key, source] of Object.entries(english[section])) {
    pairs.push({ section, key, source, current: target[section][key] });
  }
}

const collisionGroups = [];
for (const section of ['messages', 'templates']) {
  const grouped = new Map();
  for (const [key, source] of Object.entries(english[section])) {
    if (!grouped.has(source)) grouped.set(source, []);
    grouped.get(source).push({ section, key, current: target[section][key] });
  }
  for (const [source, entries] of grouped) {
    if (entries.length > 1 && new Set(entries.map(entry => entry.current)).size > 1) {
      collisionGroups.push({ source, entries });
    }
  }
}

const lockedAudio = {};
if (locale === 'cs') {
  const manifest = JSON.parse(await readFile(resolve(catalogRoot, 'audio.cs.json'), 'utf8'));
  for (const cue of manifest.cues) lockedAudio[cue.id] = { caption: cue.caption, input: cue.input };
}

const correctionSchema = z.object({
  corrections: z.array(z.object({
    section: z.enum(['messages', 'templates']),
    key: z.string(),
    text: z.string()
  }))
});

const available = await gateway.getAvailableModels();
if (!available.models.some(model => model.id === modelId)) {
  throw new Error(`${modelId} is not available through AI Gateway.`);
}

const system = [
  `You are the final senior native-language editor and game-localization QA reviewer for Permaculture Garden — Le Jardin.`,
  `Review the complete ${locale} catalog against its English source. ${localeRules[locale]}`,
  `Return corrections only. A correction must make the target more idiomatic, accurate, concise, consistent or accessible; do not rewrite good copy merely for variety.`,
  `Preserve every placeholder exactly, including braces, percent signs and placeholder names. Preserve meaningful emoji, numbers, units, Markdown and line-break roles.`,
  `Never translate Menet, Le Jardin, GPT-5.6 Luna, model IDs or scientific Latin binomials. Keep internal ecological uncertainty: may/can is not a guarantee.`,
  `Use the glossary as authoritative. In particular, never confuse fair share with spendable game shares, or a design connection with a full plant guild.`,
  `The UI addresses one player consistently. Garden narration should feel warm and poetic without cliché; buttons and accessibility labels should be direct.`,
  `Any ordinary English left in the target must be corrected unless it is an explicitly protected name, scientific name, model identifier or language autonym.`,
  `CRITICAL RUNTIME RULE: when the same English source occurs under several semantic keys, all those keys must end with exactly the same target text. Choose one natural form that works across the listed contexts. The runtime reverse lookup cannot preserve contextual variants.`,
  locale === 'cs'
    ? `CZECH AUDIO RULE: recorded Czech speech is authoritative. Do not alter wording that corresponds to the supplied locked audio; other captions must use the same terminology and voice.`
    : `Audio remains English for this locale, but every visible caption and status note must still be translated naturally.`,
  ``,
  `AUTHORITATIVE GLOSSARY:`,
  glossary
].join('\n');

const prompt = JSON.stringify({
  locale,
  catalog: pairs,
  duplicateSourceGroupsRequiringOneUnifiedTranslation: collisionGroups,
  lockedCzechAudio: lockedAudio
});

const response = await generateText({
  model: modelId,
  system,
  prompt,
  output: Output.object({ schema: correctionSchema }),
  maxOutputTokens: 30000,
  providerOptions: {
    gateway: {
      user: 'permaculture-garden-localization-review',
      tags: ['feature:localization-review', `locale:${locale}`],
      cacheControl: 's-maxage=86400'
    }
  }
});

const sourceById = new Map(pairs.map(pair => [`${pair.section}\0${pair.key}`, pair]));
const placeholderPattern = /%\{([a-zA-Z0-9_]+)\}|\{([a-zA-Z0-9_]+)\}/g;
const placeholders = value => [...String(value).matchAll(placeholderPattern)]
  .map(match => match[1] || match[2])
  .sort();
const seen = new Set();
let applied = 0;
const rejected = [];

for (const correction of response.output.corrections) {
  const id = `${correction.section}\0${correction.key}`;
  const pair = sourceById.get(id);
  if (!pair || seen.has(id) || !correction.text.trim()) {
    rejected.push(`${correction.section}.${correction.key}: unknown, duplicate or blank`);
    continue;
  }
  seen.add(id);
  if (JSON.stringify(placeholders(pair.source)) !== JSON.stringify(placeholders(correction.text))) {
    rejected.push(`${correction.section}.${correction.key}: placeholders changed`);
    continue;
  }
  target[correction.section][correction.key] = correction.text;
  applied += 1;
}

if (rejected.length) {
  console.warn(`Rejected ${rejected.length} unsafe corrections:\n${rejected.slice(0, 20).join('\n')}`);
}

const remainingCollisions = [];
for (const section of ['messages', 'templates']) {
  const grouped = new Map();
  for (const [key, source] of Object.entries(english[section])) {
    if (!grouped.has(source)) grouped.set(source, []);
    grouped.get(source).push({ key, value: target[section][key] });
  }
  for (const [source, entries] of grouped) {
    if (entries.length > 1 && new Set(entries.map(entry => entry.value)).size > 1) {
      remainingCollisions.push({ section, source, entries });
    }
  }
}

const audit = {
  locale,
  model: modelId,
  applied,
  rejected,
  remainingCollisions,
  usage: response.usage
};
await writeFile(resolve(root, `.tmp/i18n-review-${locale}.json`), `${JSON.stringify(audit, null, 2)}\n`, 'utf8');

if (!noWrite) {
  const temporary = `${targetPath}.writing`;
  await writeFile(temporary, `${JSON.stringify(target, null, 2)}\n`, 'utf8');
  await rename(temporary, targetPath);
}

console.log(`${locale} editorial review complete: ${applied} corrections; ${remainingCollisions.length} duplicate-source groups still need unification.`);
console.log(`Usage: ${JSON.stringify(response.usage)}${noWrite ? ' (not written)' : ''}`);
