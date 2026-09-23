import assert from "node:assert/strict";
import { createRequire, registerHooks } from "node:module";

const AI_MOCK_URL = "pg-test:living-lesson-ai";
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "ai") return { url: AI_MOCK_URL, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === AI_MOCK_URL) {
      return {
        format: "module",
        shortCircuit: true,
        source: `
          export const Output = {
            object({ schema }) {
              globalThis.__PG_TEST_LIVING_LESSON_SCHEMA__ = schema;
              return { schema };
            }
          };
          export async function generateText(options) {
            globalThis.__PG_TEST_LIVING_LESSON_REQUEST__ = options;
            const output = globalThis.__PG_TEST_LIVING_LESSON_OUTPUT__;
            if (output instanceof Error) throw output;
            return { output };
          }
        `
      };
    }
    return nextLoad(url, context);
  }
});

const require = createRequire(import.meta.url);
const LivingLesson = require("../lib/living-lesson.js");
const handler = require("../api/garden-reflection.js");

function response() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); }
  };
}

async function call(method, body, headers = {}) {
  const res = response();
  await handler({ method, body, headers }, res);
  return res;
}

function clearServerState() {
  globalThis.__PG_LIVING_LESSON_CACHE__?.clear();
  globalThis.__PG_LIVING_LESSON_LIMITS__?.clear();
  delete globalThis.__PG_TEST_LIVING_LESSON_SCHEMA__;
  delete globalThis.__PG_TEST_LIVING_LESSON_REQUEST__;
  delete globalThis.__PG_TEST_LIVING_LESSON_OUTPUT__;
}

const snapshot = {
  season: "Summer",
  placedTypes: ["compost", "rain"],
  systems: { soil: { value: 22 }, water: { value: 30 }, food: { value: 0 }, habitat: { value: 0 } },
  links: [],
  journey: { done: 2, currentKey: "food", completedKeys: ["soil", "water"] },
  sharedActs: 0,
  completedChallenges: [],
  guildKeys: []
};

const get = await call("GET", null);
assert.equal(get.statusCode, 200);
assert.equal(get.body.model, "openai/gpt-5.6-luna");
assert.equal(get.body.auth, "vercel-oidc");
assert.equal(get.body.promptVersion, "living-lesson-v4-locale-contract");
assert.deepEqual(get.body.locales, ["en", "cs", "de", "fr", "es", "pt-BR", "pl", "ru", "zh-CN"]);

const method = await call("DELETE", null);
assert.equal(method.statusCode, 405);

const invalid = await call("POST", { clientId: "short", snapshot }, { "content-type": "application/json" });
assert.equal(invalid.statusCode, 400);

const crossOrigin = await call("POST", { clientId: "garden_12345678", snapshot }, { "content-type": "application/json", origin: "https://attacker.example", host: "garden.example" });
assert.equal(crossOrigin.statusCode, 403);

const oldOidc = process.env.VERCEL_OIDC_TOKEN;
const oldGateway = process.env.AI_GATEWAY_API_KEY;
const oldForcedFallback = process.env.LIVING_LESSON_FORCE_FALLBACK;
delete process.env.VERCEL_OIDC_TOKEN;
delete process.env.AI_GATEWAY_API_KEY;
process.env.LIVING_LESSON_FORCE_FALLBACK = "1";
const fallback = await call("POST", { clientId: "garden_12345678", snapshot }, { "content-type": "application/json", origin: "https://garden.example", host: "garden.example" });
if (oldOidc !== undefined) process.env.VERCEL_OIDC_TOKEN = oldOidc;
if (oldGateway !== undefined) process.env.AI_GATEWAY_API_KEY = oldGateway;
if (oldForcedFallback === undefined) delete process.env.LIVING_LESSON_FORCE_FALLBACK;
else process.env.LIVING_LESSON_FORCE_FALLBACK = oldForcedFallback;
assert.equal(fallback.statusCode, 200);
assert.equal(fallback.body.ok, true);
assert.equal(fallback.body.mode, "fallback");
assert.equal(fallback.body.fallbackReason, "gateway_unavailable");
assert.ok(fallback.body.lesson.experiment.action.length > 10);
assert.equal(fallback.headers["Cache-Control"], "no-store");

process.env.LIVING_LESSON_FORCE_FALLBACK = "1";
const localizedFallback = await call("POST", {
  clientId: "garden_87654321",
  snapshot: { ...snapshot, locale: "zh-Hans-CN" }
}, { "content-type": "application/json", origin: "https://garden.example", host: "garden.example" });
delete process.env.LIVING_LESSON_FORCE_FALLBACK;
assert.equal(localizedFallback.body.lesson.fingerprint.startsWith("living-lesson-v4-locale-contract-"), true);
assert.equal(localizedFallback.body.lesson.locale, "zh-CN");

const czechSnapshot = { ...snapshot, locale: "cs", harvests: 1 };
const czechCandidate = LivingLesson.buildCandidates(czechSnapshot)[0];
clearServerState();
globalThis.__PG_TEST_LIVING_LESSON_OUTPUT__ = {
  locale: "cs",
  candidateId: czechCandidate.id,
  focus: czechCandidate.focus,
  observation: "Všímám si, jak se zachycená voda tiše přibližuje kořenům.",
  relationship: "Půda a voda se v zahradě podporují, když zachycený déšť směřuje k rostlinám.",
  question: "Které spojení mezi vodou a půdou bys chtěl vyzkoušet jako první?"
};
const localizedAi = await call("POST", {
  clientId: "garden_czech_ai_01",
  snapshot: czechSnapshot
}, { "content-type": "application/json", origin: "https://garden.example", host: "garden.example" });
assert.equal(localizedAi.statusCode, 200);
assert.equal(localizedAi.body.mode, "ai");
assert.equal(localizedAi.body.lesson.source, "ai");
assert.equal(localizedAi.body.lesson.locale, "cs");
assert.equal(localizedAi.body.lesson.promptVersion, "living-lesson-v4-locale-contract");
assert.match(globalThis.__PG_TEST_LIVING_LESSON_REQUEST__.system, /in Czech/);
assert.match(globalThis.__PG_TEST_LIVING_LESSON_REQUEST__.system, /Return locale exactly as cs\./);
assert.ok(globalThis.__PG_TEST_LIVING_LESSON_REQUEST__.abortSignal instanceof AbortSignal);

const capturedSchema = globalThis.__PG_TEST_LIVING_LESSON_SCHEMA__;
assert.equal(capturedSchema.safeParse(globalThis.__PG_TEST_LIVING_LESSON_OUTPUT__).success, true);
assert.equal(capturedSchema.safeParse({ ...globalThis.__PG_TEST_LIVING_LESSON_OUTPUT__, locale: "en" }).success, false);

const localeSamples = {
  en: {
    observation: "I notice water resting near the roots in my garden.",
    relationship: "The soil and plants support one another when water moves between them.",
    question: "Which relationship could you strengthen next?"
  },
  cs: {
    observation: "Všímám si, jak voda v zahradě tiše zůstává mezi kořeny.",
    relationship: "Půda a rostliny se mohou podporovat, když voda zůstává blízko.",
    question: "Které spojení bys chtěl v zahradě posílit?"
  },
  de: {
    observation: "Ich bemerke, wie Wasser im Garten nahe bei den Wurzeln ruht.",
    relationship: "Der Boden und die Pflanzen unterstützen sich, wenn Wasser zwischen ihnen bleibt.",
    question: "Welche Verbindung könntest du als Nächstes stärken?"
  },
  fr: {
    observation: "Je remarque que l’eau repose près des racines dans le jardin.",
    relationship: "Le sol et les plantes se soutiennent quand l’eau reste entre leurs racines.",
    question: "Quel lien pourrais-tu renforcer dans le jardin ?"
  },
  es: {
    observation: "Noto que el agua descansa cerca de las raíces en el jardín.",
    relationship: "El suelo y las plantas se apoyan cuando el agua permanece entre ellas.",
    question: "¿Qué conexión podrías fortalecer en tu jardín?"
  },
  "pt-BR": {
    observation: "Percebo que a água repousa perto das raízes no jardim.",
    relationship: "O solo e as plantas se apoiam quando a água permanece entre eles.",
    question: "Qual conexão você poderia fortalecer no jardim?"
  },
  pl: {
    observation: "Zauważam, jak woda w ogrodzie zatrzymuje się blisko korzeni.",
    relationship: "Gleba i rośliny wspierają się, kiedy woda pozostaje między nimi.",
    question: "Które połączenie możesz wzmocnić w swoim ogrodzie?"
  },
  ru: {
    observation: "Я замечаю, как вода тихо остаётся рядом с корнями в саду.",
    relationship: "Почва и растения поддерживают друг друга, когда вода остаётся между ними.",
    question: "Какую связь ты хотел бы укрепить в саду?"
  },
  "zh-CN": {
    observation: "我注意到雨水安静地停留在花园的根系旁边。",
    relationship: "土壤、植物和水分彼此连接，也能相互支持。",
    question: "你接下来想加强花园里的哪一种联系？"
  }
};

for (const [locale, sample] of Object.entries(localeSamples)) {
  const localizedSnapshot = { ...snapshot, locale, harvests: 2 };
  const candidate = LivingLesson.buildCandidates(localizedSnapshot)[0];
  clearServerState();
  globalThis.__PG_TEST_LIVING_LESSON_OUTPUT__ = { locale, candidateId: candidate.id, focus: candidate.focus, ...sample };
  const result = await call("POST", {
    clientId: `garden_locale_${locale.replace(/[^a-z]/gi, "_")}_01`,
    snapshot: localizedSnapshot
  }, { "content-type": "application/json", origin: "https://garden.example", host: "garden.example" });
  assert.equal(result.body.mode, "ai", `${locale} should pass the locale guard`);
  assert.equal(result.body.lesson.locale, locale);
}

clearServerState();
globalThis.__PG_TEST_LIVING_LESSON_OUTPUT__ = {
  locale: "en",
  candidateId: czechCandidate.id,
  focus: czechCandidate.focus,
  observation: "Všímám si, jak se zachycená voda přibližuje kořenům.",
  relationship: "Půda a voda se podporují, když déšť směřuje k rostlinám.",
  question: "Které spojení bys chtěl vyzkoušet?"
};
const wrongLocale = await call("POST", {
  clientId: "garden_wrong_locale_01",
  snapshot: czechSnapshot
}, { "content-type": "application/json", origin: "https://garden.example", host: "garden.example" });
assert.equal(wrongLocale.statusCode, 200);
assert.equal(wrongLocale.body.mode, "fallback");
assert.equal(wrongLocale.body.fallbackReason, "locale_mismatch");
assert.equal(wrongLocale.body.lesson.source, "fallback");
assert.equal(wrongLocale.body.lesson.locale, "cs");

clearServerState();
globalThis.__PG_TEST_LIVING_LESSON_OUTPUT__ = {
  locale: "cs",
  candidateId: czechCandidate.id,
  focus: czechCandidate.focus,
  observation: "The garden is quiet and the water is waiting near the soil.",
  relationship: "The soil and water are connected with the garden, and this relationship can support one growing area.",
  question: "What can you change in your garden first?"
};
const wrongLanguage = await call("POST", {
  clientId: "garden_wrong_language_01",
  snapshot: { ...czechSnapshot, preserved: 1 }
}, { "content-type": "application/json", origin: "https://garden.example", host: "garden.example" });
assert.equal(wrongLanguage.statusCode, 200);
assert.equal(wrongLanguage.body.mode, "fallback");
assert.equal(wrongLanguage.body.fallbackReason, "locale_mismatch");
assert.equal(wrongLanguage.body.lesson.source, "fallback");
assert.equal(wrongLanguage.body.lesson.locale, "cs");

const wrongLanguageCases = [
  {
    locale: "en",
    label: "Czech tagged as English",
    text: localeSamples.cs
  },
  {
    locale: "cs",
    label: "short English tagged as Czech",
    text: {
      observation: "Water waits beside the roots.",
      relationship: "Soil and plants share one quiet connection.",
      question: "Which change could help next?"
    }
  },
  {
    locale: "cs",
    label: "German tagged as Czech",
    text: localeSamples.de
  },
  {
    locale: "pt-BR",
    label: "Spanish tagged as Portuguese",
    text: localeSamples.es
  },
  {
    locale: "ru",
    label: "English with one Cyrillic character tagged as Russian",
    text: {
      observation: "I notice я water resting near the roots in my garden.",
      relationship: "The soil and plants support one another when water moves between them.",
      question: "Which relationship could you strengthen next?"
    }
  },
  {
    locale: "zh-CN",
    label: "English with one Han character tagged as Chinese",
    text: {
      observation: "I notice 花 water resting near the roots in my garden.",
      relationship: "The soil and plants support one another when water moves between them.",
      question: "Which relationship could you strengthen next?"
    }
  }
];

for (const [index, item] of wrongLanguageCases.entries()) {
  const localizedSnapshot = { ...snapshot, locale: item.locale, preserved: index + 2 };
  const candidate = LivingLesson.buildCandidates(localizedSnapshot)[0];
  clearServerState();
  globalThis.__PG_TEST_LIVING_LESSON_OUTPUT__ = {
    locale: item.locale,
    candidateId: candidate.id,
    focus: candidate.focus,
    ...item.text
  };
  const result = await call("POST", {
    clientId: `garden_wrong_language_${index}_01`,
    snapshot: localizedSnapshot
  }, { "content-type": "application/json", origin: "https://garden.example", host: "garden.example" });
  assert.equal(result.body.mode, "fallback", item.label);
  assert.equal(result.body.fallbackReason, "locale_mismatch", item.label);
  assert.equal(result.body.lesson.locale, item.locale, item.label);
}

console.log("Living Lesson API fallback and boundary tests passed.");
