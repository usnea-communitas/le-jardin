import { existsSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { generateText, Output } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';

const root = resolve(import.meta.dirname, '..');
const catalogDir = resolve(root, 'assets/i18n');
const modelId = 'openai/gpt-5.6-luna';
const localeConfig = {
  cs: {
    name: 'Czech',
    address: 'consistent informal singular “ty”',
    note: 'Use natural contemporary Czech. The personified Garden speaks in the feminine grammatical gender. Avoid calques, unnecessary passive voice and formal vy/vás.'
  },
  de: {
    name: 'German (Germany)',
    address: 'informal singular “du”',
    note: 'Write idiomatic contemporary German. Prefer clear educational language over long noun compounds.'
  },
  fr: {
    name: 'French (France)',
    address: 'consistent informal singular “tu”',
    note: 'Use idiomatic contemporary French from France, with a warm but restrained literary quality for the personified Garden.'
  },
  es: {
    name: 'international Spanish',
    address: 'informal singular “tú”',
    note: 'Use broadly understandable international Spanish rather than a strongly regional variety.'
  },
  'pt-BR': {
    name: 'Brazilian Portuguese',
    address: 'natural Brazilian “você”',
    note: 'Use Brazilian, not European, vocabulary and syntax.'
  },
  pl: {
    name: 'Polish',
    address: 'consistent informal singular “ty”',
    note: 'Use natural contemporary Polish, correct diacritics and idiomatic gardening terminology. Avoid English calques and restructure dynamic phrases when placeholder gender is unknown.'
  },
  ru: {
    name: 'Russian',
    address: 'informal singular “ты”',
    note: 'Use natural modern Russian and keep the personified Garden’s voice feminine where grammar requires it.'
  },
  'zh-CN': {
    name: 'Simplified Chinese',
    address: 'natural singular “你”',
    note: 'Use concise, natural Mainland Simplified Chinese; avoid literal English syntax and unnecessary spaces.'
  }
};

function argument(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const locales = String(argument('locales', 'de,es,pt-BR,pl,ru,zh-CN'))
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);
const concurrency = Math.max(1, Math.min(6, Number(argument('concurrency', '3')) || 3));
const maxKeys = Math.max(0, Number(argument('max-keys', '0')) || 0);
const noWrite = process.argv.includes('--no-write');
const force = process.argv.includes('--force');
const batchCharacters = Math.max(6000, Number(argument('batch-characters', '18000')) || 18000);

for (const locale of locales) {
  if (!localeConfig[locale]) throw new Error(`Unsupported translation locale: ${locale}`);
}
if (!process.env.VERCEL_OIDC_TOKEN && !process.env.AI_GATEWAY_API_KEY) {
  throw new Error('VERCEL_OIDC_TOKEN or AI_GATEWAY_API_KEY is required.');
}

const english = JSON.parse(await readFile(resolve(catalogDir, 'catalog.en.json'), 'utf8'));
const glossary = await readFile(resolve(catalogDir, 'LOCALIZATION_GLOSSARY.md'), 'utf8');
const sourceEntries = [
  ...Object.entries(english.messages).map(([key, text]) => ({ section: 'messages', key, text })),
  ...Object.entries(english.templates).map(([key, text]) => ({ section: 'templates', key, text }))
];

const placeholderPattern = /%\{([a-zA-Z0-9_]+)\}|\{([a-zA-Z0-9_]+)\}/g;
const placeholders = value => [...String(value).matchAll(placeholderPattern)]
  .map(match => match[1] || match[2])
  .sort();

function samePlaceholders(source, translated) {
  return JSON.stringify(placeholders(source)) === JSON.stringify(placeholders(translated));
}

function makeBatches(entries) {
  const batches = [];
  let current = [];
  let size = 0;
  for (const entry of entries) {
    const entrySize = entry.key.length + entry.text.length + 36;
    if (current.length && size + entrySize > batchCharacters) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(entry);
    size += entrySize;
  }
  if (current.length) batches.push(current);
  return batches;
}

function baseCatalog(locale) {
  const path = resolve(catalogDir, `catalog.${locale}.json`);
  if (!force && existsSync(path)) {
    const existing = JSON.parse(requireRead(path));
    if (existing.locale === locale) return existing;
  }
  return {
    version: english.version,
    locale,
    messages: Object.fromEntries(Object.keys(english.messages).map(key => [key, english.messages[key] === '' ? '' : english.messages[key]])),
    templates: Object.fromEntries(Object.keys(english.templates).map(key => [key, english.templates[key] === '' ? '' : english.templates[key]]))
  };
}

function requireRead(path) {
  // Synchronous startup read keeps partial human translations intact before requests begin.
  return globalThis.process.getBuiltinModule('fs').readFileSync(path, 'utf8');
}

function entriesToTranslate(catalog) {
  return sourceEntries.filter(entry => {
    if (entry.text === '') return false;
    const current = catalog[entry.section]?.[entry.key];
    return force || typeof current !== 'string' || current === entry.text;
  });
}

const resultSchema = z.object({
  translations: z.array(z.object({
    key: z.string(),
    text: z.string()
  }))
});

function systemPrompt(locale) {
  const config = localeConfig[locale];
  return [
    `You are the senior native-language editor for Permaculture Garden — Le Jardin.`,
    `Translate English game copy into ${config.name}, using ${config.address}.`,
    config.note,
    `The audience is young people with mixed ecological knowledge. UI text must be immediately clear; the Garden’s first-person voice may be warm and poetic without becoming vague or sentimental.`,
    `Translate complete meanings and sentences, never word by word. Write as a skilled native game localizer.`,
    `Preserve every placeholder exactly, including braces, percent signs and placeholder names. Preserve meaningful emoji, punctuation roles, numbers, units, Markdown and line breaks.`,
    `Do not translate Menet, Le Jardin, GPT-5.6 Luna, model IDs, scientific Latin binomials, file-like tokens, or internal abbreviations identified by the glossary.`,
    `Do not add ecological certainty, safety promises, rewards, rules or facts that are absent from the English source.`,
    `Return exactly one translation for every supplied key. Never omit, rename, duplicate, explain or reorder keys.`,
    ``,
    `AUTHORITATIVE LOCALIZATION GLOSSARY:`,
    glossary
  ].join('\n');
}

function batchPrompt(locale, batch, correction = '') {
  return [
    `Translate this JSON array into ${localeConfig[locale].name}.`,
    `Return the same keys in the structured translations array.`,
    correction,
    JSON.stringify(batch.map(({ key, text }) => ({ key, text })))
  ].filter(Boolean).join('\n\n');
}

async function requestBatch(locale, batch, attempt = 1) {
  const expected = new Map(batch.map(entry => [entry.key, entry]));
  const response = await generateText({
    model: modelId,
    system: systemPrompt(locale),
    prompt: batchPrompt(locale, batch, attempt > 1
      ? 'A previous attempt was incomplete or damaged placeholders. Be exact this time.'
      : ''),
    output: Output.object({ schema: resultSchema }),
    maxOutputTokens: 12000,
    providerOptions: {
      gateway: {
        user: 'permaculture-garden-localization',
        tags: ['feature:localization', `locale:${locale}`],
        cacheControl: 's-maxage=86400'
      }
    }
  });

  const received = new Map();
  for (const item of response.output.translations) {
    if (!expected.has(item.key) || received.has(item.key)) continue;
    const source = expected.get(item.key).text;
    if (!item.text.trim() || !samePlaceholders(source, item.text)) continue;
    received.set(item.key, item.text);
  }

  const missing = batch.filter(entry => !received.has(entry.key));
  if (missing.length && attempt < 3) {
    const repaired = await requestBatch(locale, missing, attempt + 1);
    for (const [key, value] of repaired.translations) received.set(key, value);
    return {
      translations: received,
      usage: mergeUsage(response.usage, repaired.usage)
    };
  }
  if (missing.length) {
    console.warn(`${locale}: keeping ${missing.length} source values for editorial repair after 3 attempts: ${missing.slice(0, 8).map(entry => entry.key).join(', ')}`);
    for (const entry of missing) received.set(entry.key, entry.text);
  }
  return { translations: received, usage: normalizeUsage(response.usage) };
}

function normalizeUsage(usage) {
  return {
    inputTokens: Number(usage?.inputTokens || 0),
    outputTokens: Number(usage?.outputTokens || 0),
    totalTokens: Number(usage?.totalTokens || 0)
  };
}

function mergeUsage(a, b) {
  const left = normalizeUsage(a);
  const right = normalizeUsage(b);
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    totalTokens: left.totalTokens + right.totalTokens
  };
}

async function atomicWrite(path, value) {
  const temporary = `${path}.writing`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, path);
}

const available = await gateway.getAvailableModels();
if (!available.models.some(model => model.id === modelId)) {
  throw new Error(`${modelId} is not currently available through this project’s AI Gateway.`);
}
console.log(`Using ${modelId}; ${concurrency} concurrent translation batches.`);

const work = [];
const catalogs = new Map();
for (const locale of locales) {
  const catalog = baseCatalog(locale);
  catalogs.set(locale, catalog);
  let pending = entriesToTranslate(catalog);
  if (maxKeys) pending = pending.slice(0, maxKeys);
  const batches = makeBatches(pending);
  batches.forEach((batch, index) => work.push({ locale, batch, index: index + 1, total: batches.length }));
  console.log(`${locale}: ${pending.length} values in ${batches.length} batches.`);
}

let cursor = 0;
let completed = 0;
let aggregateUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
const worker = async workerId => {
  while (cursor < work.length) {
    const item = work[cursor++];
    let result;
    for (let attempt = 1; ; attempt++) {
      try {
        result = await requestBatch(item.locale, item.batch);
        break;
      } catch (error) {
        if (attempt >= 3) throw error;
        console.warn(`Worker ${workerId}: retrying ${item.locale} batch ${item.index}/${item.total}: ${error.message}`);
        await delay(1500 * attempt);
      }
    }

    const catalog = catalogs.get(item.locale);
    for (const [key, value] of result.translations) {
      const entry = item.batch.find(candidate => candidate.key === key);
      catalog[entry.section][key] = value;
    }
    aggregateUsage = mergeUsage(aggregateUsage, result.usage);
    completed += 1;
    console.log(`Worker ${workerId}: ${item.locale} ${item.index}/${item.total}; overall ${completed}/${work.length}.`);
  }
};

await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, work.length)) }, (_, index) => worker(index + 1)));

for (const locale of locales) {
  const catalog = catalogs.get(locale);
  const failures = [];
  for (const entry of sourceEntries) {
    const value = catalog[entry.section]?.[entry.key];
    if (typeof value !== 'string') failures.push(`${entry.section}.${entry.key}: missing`);
    else if (!samePlaceholders(entry.text, value)) failures.push(`${entry.section}.${entry.key}: placeholders`);
  }
  if (failures.length) throw new Error(`${locale} validation failed:\n${failures.slice(0, 20).join('\n')}`);
  if (noWrite && maxKeys) {
    const preview = sourceEntries
      .slice(0, maxKeys)
      .map(entry => ({ key: entry.key, source: entry.text, translation: catalog[entry.section][entry.key] }));
    console.log(`${locale} preview:\n${JSON.stringify(preview, null, 2)}`);
  }
  if (!noWrite) await atomicWrite(resolve(catalogDir, `catalog.${locale}.json`), catalog);
}

console.log(`Translation complete. Usage: ${JSON.stringify(aggregateUsage)}${noWrite ? ' (not written)' : ''}.`);
