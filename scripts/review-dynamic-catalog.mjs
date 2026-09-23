import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generateText, Output } from "ai";
import { z } from "zod";

const root = resolve(import.meta.dirname, "..");
const catalogRoot = resolve(root, "assets/i18n");

function argument(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const locale = argument("locale");
const modelId = argument("model", locale === "cs" ? "openai/gpt-5.6-sol" : "openai/gpt-5.6-terra");
const localeRules = {
  cs: "natural contemporary Czech, always informal singular ty",
  de: "idiomatic contemporary German from Germany, informal singular du",
  fr: "idiomatic contemporary French from France, informal singular tu",
  es: "natural broadly understandable international Spanish, informal singular tú",
  "pt-BR": "natural Brazilian Portuguese using você",
  pl: "natural contemporary Polish, always informal singular ty",
  ru: "natural modern Russian, informal singular ты",
  "zh-CN": "concise natural Mainland Simplified Chinese using 你"
};
if (!localeRules[locale]) throw new Error(`Unsupported locale: ${locale}`);
if (!process.env.VERCEL_OIDC_TOKEN && !process.env.AI_GATEWAY_API_KEY) {
  throw new Error("VERCEL_OIDC_TOKEN or AI_GATEWAY_API_KEY is required.");
}

const english = JSON.parse(await readFile(resolve(catalogRoot, "catalog.en.json"), "utf8"));
const targetPath = resolve(catalogRoot, `catalog.${locale}.json`);
const target = JSON.parse(await readFile(targetPath, "utf8"));
const placeholderPattern = /%\{([a-zA-Z0-9_]+)\}|\{([a-zA-Z0-9_]+)\}/g;
const placeholders = value => [...String(value).matchAll(placeholderPattern)]
  .map(match => match[1] || match[2])
  .sort();

const entries = [];
for (const section of ["messages", "templates"]) {
  for (const [key, source] of Object.entries(english[section])) {
    if (!placeholders(source).length) continue;
    entries.push({ section, key, source, current: target[section][key] });
  }
}

const schema = z.object({
  corrections: z.array(z.object({
    section: z.enum(["messages", "templates"]),
    key: z.string(),
    text: z.string()
  }))
});

const system = [
  "You are a senior native game-localization editor performing a narrow dynamic-text grammar pass.",
  `The target is ${localeRules[locale]}.`,
  "Review only problems caused by placeholders being inserted at runtime, plus clear remaining semantic or idiomatic errors in these dynamic strings.",
  "A placeholder such as {name}, {item}, {plant}, {animal}, {season}, {system}, {action} or {gift} may expand to many different translated nouns, grammatical genders, numbers or phrases.",
  "CRITICAL: do not attach a gendered article, possessive, adjective, participle or case ending to an arbitrary placeholder unless every possible runtime value is guaranteed to agree. Rephrase naturally around it, for example by making the placeholder a label, using a neutral word such as 'element', or restructuring the sentence.",
  "Do not make already-good strings stilted merely to avoid inflection. Chinese does not need artificial workarounds where grammar is already neutral.",
  "Keep the UI concise and preserve meaning, ecological uncertainty, punctuation roles, emoji, line breaks, numbers and every placeholder exactly.",
  "Never translate Menet, Le Jardin, GPT-5.6 Luna, model IDs or scientific Latin names.",
  "Return corrections only. Do not rewrite good copy for variety."
].join("\n");

const response = await generateText({
  model: modelId,
  system,
  prompt: JSON.stringify({ locale, dynamicEntries: entries }),
  output: Output.object({ schema }),
  maxOutputTokens: 12000,
  providerOptions: {
    gateway: {
      user: "permaculture-garden-dynamic-localization-review",
      tags: ["feature:localization-dynamic-review", `locale:${locale}`],
      cacheControl: "s-maxage=86400"
    }
  }
});

const byId = new Map(entries.map(entry => [`${entry.section}\0${entry.key}`, entry]));
const corrections = [];
const rejected = [];
const seen = new Set();
for (const correction of response.output.corrections) {
  const id = `${correction.section}\0${correction.key}`;
  const entry = byId.get(id);
  if (!entry || seen.has(id) || !correction.text.trim()) {
    rejected.push(`${correction.section}.${correction.key}: unknown, duplicate or blank`);
    continue;
  }
  seen.add(id);
  if (JSON.stringify(placeholders(entry.source)) !== JSON.stringify(placeholders(correction.text))) {
    rejected.push(`${correction.section}.${correction.key}: placeholders changed`);
    continue;
  }
  target[correction.section][correction.key] = correction.text;
  corrections.push(correction);
}

const temporary = `${targetPath}.writing`;
await writeFile(temporary, `${JSON.stringify(target, null, 2)}\n`, "utf8");
await rename(temporary, targetPath);
await writeFile(
  resolve(root, `.tmp/i18n-dynamic-review-${locale}.json`),
  `${JSON.stringify({
    locale,
    model: modelId,
    reviewed: entries.length,
    corrections,
    rejected,
    usage: response.usage
  }, null, 2)}\n`,
  "utf8"
);

console.log(
  `${locale} dynamic localization review complete: ${corrections.length} corrections; ` +
  `${rejected.length} rejected. Usage: ${JSON.stringify(response.usage)}`
);
