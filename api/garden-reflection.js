const crypto = require("node:crypto");
const LivingLesson = require("../lib/living-lesson.js");

const MODEL = "openai/gpt-5.6-luna";
const LANGUAGE_NAMES = {
  en: "English",
  cs: "Czech",
  de: "German",
  fr: "French",
  es: "Spanish",
  "pt-BR": "Brazilian Portuguese",
  pl: "Polish",
  ru: "Russian",
  "zh-CN": "Simplified Chinese"
};
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const BODY_LIMIT = 24 * 1024;
const cache = globalThis.__PG_LIVING_LESSON_CACHE__ || new Map();
const limits = globalThis.__PG_LIVING_LESSON_LIMITS__ || new Map();
globalThis.__PG_LIVING_LESSON_CACHE__ = cache;
globalThis.__PG_LIVING_LESSON_LIMITS__ = limits;

// A deliberately conservative guard against a model returning a correctly tagged
// response in the wrong language. Uncertain output is safer as a reviewed,
// localized fallback than as a stray English (or neighbouring-language) lesson.
const LANGUAGE_PROFILES = {
  en: ["a", "an", "and", "are", "as", "at", "between", "can", "could", "from", "garden", "how", "i", "in", "into", "is", "it", "its", "my", "near", "notice", "of", "one", "plants", "relationship", "roots", "soil", "that", "the", "this", "through", "to", "water", "what", "when", "where", "which", "with", "would", "you", "your"],
  cs: ["a", "ale", "by", "bys", "co", "do", "díky", "jak", "je", "jsou", "kde", "která", "které", "který", "mezi", "mohl", "mohou", "může", "na", "podporují", "půda", "půdě", "půdy", "rostliny", "rostlinám", "se", "si", "spojení", "v", "ve", "vidím", "voda", "vodě", "vodu", "všímám", "vztah", "z", "zahrada", "zahradě", "zahrady", "zatímco", "ze", "že"],
  de: ["am", "auf", "bei", "beziehung", "bemerke", "boden", "das", "dass", "dein", "deine", "dem", "den", "der", "des", "die", "du", "durch", "ein", "eine", "einer", "für", "garten", "gartens", "ich", "im", "ist", "kann", "könnte", "mein", "mit", "pflanzen", "sich", "sind", "und", "verbindung", "von", "was", "wasser", "welche", "welcher", "wenn", "wie", "wo", "würde", "wurzeln", "zwischen", "zu"],
  fr: ["avec", "comment", "dans", "de", "des", "du", "eau", "entre", "est", "et", "grâce", "jardin", "je", "la", "le", "les", "lien", "mon", "où", "peut", "plantes", "pour", "pourrait", "près", "quand", "que", "quel", "quelle", "qui", "racines", "relation", "remarque", "sol", "sont", "sur", "ta", "tes", "ton", "tu", "un", "une", "vois"],
  es: ["agua", "ayuda", "cómo", "con", "conexión", "cuando", "cuál", "de", "del", "desde", "dónde", "el", "en", "entre", "es", "jardín", "la", "las", "los", "mi", "noto", "para", "plantas", "podría", "por", "puede", "qué", "que", "raíces", "relación", "son", "suelo", "tú", "tu", "tus", "un", "una", "veo", "y", "yo"],
  "pt-BR": ["a", "ajuda", "as", "água", "como", "com", "conexão", "da", "das", "de", "do", "dos", "e", "é", "em", "entre", "eu", "jardim", "meu", "o", "onde", "os", "para", "percebo", "perto", "plantas", "pode", "poderia", "por", "qual", "quando", "que", "raízes", "relação", "são", "seu", "solo", "sua", "um", "uma", "vejo", "você"],
  pl: ["co", "do", "dzięki", "gdzie", "gleba", "glebie", "gleby", "i", "ja", "jak", "jest", "kiedy", "korzenie", "która", "które", "który", "między", "mogą", "moja", "może", "mógłby", "na", "ogród", "ogrodzie", "ogrodu", "połączenie", "rośliny", "relacja", "są", "twój", "twoja", "ty", "w", "we", "widzę", "woda", "wodę", "wodzie", "wspiera", "z", "zauważam", "ze"]
};

function outputMatchesLocale(output, locale) {
  const combined = [output && output.observation, output && output.relationship, output && output.question]
    .filter(Boolean).join(" ").normalize("NFC").toLocaleLowerCase(locale || "en");
  if (!combined) return false;
  const letters = combined.match(/\p{L}/gu) || [];
  const cyrillicCount = (combined.match(/[\u0400-\u052f]/gu) || []).length;
  const hanCount = (combined.match(/[\u3400-\u9fff]/gu) || []).length;
  if (locale === "ru") return cyrillicCount >= 12 && cyrillicCount / Math.max(letters.length, 1) >= 0.72;
  if (locale === "zh-CN") {
    return hanCount >= 12 && hanCount / Math.max(letters.length, 1) >= 0.65;
  }
  if (cyrillicCount > 0 || hanCount > 0) return false;
  const tokens = new Set(combined.match(/\p{L}+/gu) || []);
  const scores = Object.fromEntries(Object.entries(LANGUAGE_PROFILES).map(([key, words]) => [
    key,
    words.reduce((count, word) => count + (tokens.has(word) ? 1 : 0), 0)
  ]));
  const targetScore = scores[locale] || 0;
  const strongestOther = Math.max(0, ...Object.entries(scores).filter(([key]) => key !== locale).map(([, score]) => score));
  return targetScore >= 2 && targetScore + 1 >= strongestOther;
}

function header(req, name) {
  const value = req.headers && (req.headers[name] || req.headers[name.toLowerCase()]);
  return Array.isArray(value) ? value[0] : String(value || "");
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(payload));
}

function hashId(value) {
  return crypto.createHash("sha256").update(String(value || "anonymous")).digest("hex").slice(0, 24);
}

function allowedOrigin(req) {
  const origin = header(req, "origin");
  if (!origin) return true;
  const host = header(req, "x-forwarded-host") || header(req, "host");
  try { return new URL(origin).host === host; } catch (_) { return false; }
}

function takeLimit(key, max, windowMs) {
  const now = Date.now();
  if (limits.size > 2000) {
    for (const [storedKey, stored] of limits) {
      if (!stored || stored.until <= now || limits.size > 1800) limits.delete(storedKey);
      if (limits.size <= 1800) break;
    }
  }
  const current = limits.get(key);
  if (!current || current.until <= now) {
    limits.set(key, { count: 1, until: now + windowMs });
    return true;
  }
  if (current.count >= max) return false;
  current.count += 1;
  return true;
}

function fallback(snapshot, candidates, reason) {
  return {
    ok: true,
    lesson: LivingLesson.fallbackLesson(snapshot, candidates),
    mode: "fallback",
    fallbackReason: reason,
    model: null
  };
}

function safeBody(req) {
  if (!req.body) return null;
  if (typeof req.body === "string") {
    if (Buffer.byteLength(req.body) > BODY_LIMIT) return null;
    try { return JSON.parse(req.body); } catch (_) { return null; }
  }
  try {
    if (Buffer.byteLength(JSON.stringify(req.body)) > BODY_LIMIT) return null;
    return req.body;
  } catch (_) { return null; }
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return send(res, 200, {
      ok: true,
      feature: "The Garden Reflects — Living Lesson",
      model: MODEL,
      promptVersion: LivingLesson.PROMPT_VERSION,
      locales: LivingLesson.SUPPORTED_LOCALES,
      auth: "vercel-oidc",
      fallback: true
    });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { ok: false, error: "method_not_allowed" });
  }
  if (!allowedOrigin(req)) return send(res, 403, { ok: false, error: "origin_not_allowed" });
  if (!/application\/json/i.test(header(req, "content-type"))) return send(res, 415, { ok: false, error: "json_required" });
  const body = safeBody(req);
  if (!body || !body.snapshot || !/^[a-zA-Z0-9_-]{8,80}$/.test(String(body.clientId || ""))) {
    return send(res, 400, { ok: false, error: "invalid_request" });
  }

  const snapshot = LivingLesson.sanitizeSnapshot(body.snapshot);
  const responseLanguage = LANGUAGE_NAMES[snapshot.locale] || LANGUAGE_NAMES.en;
  const candidates = LivingLesson.buildCandidates(snapshot);
  const fingerprint = LivingLesson.fingerprint(snapshot);
  const cached = cache.get(fingerprint);
  if (cached && cached.expires > Date.now()) return send(res, 200, Object.assign({}, cached.payload, { cached: true }));

  const ip = hashId(header(req, "x-forwarded-for").split(",")[0] || header(req, "x-real-ip"));
  const client = hashId(body.clientId);
  const allowed = takeLimit("minute:" + ip, 6, 60 * 1000)
    && takeLimit("day:" + client, 12, 24 * 60 * 60 * 1000)
    && takeLimit("global", 240, 24 * 60 * 60 * 1000);
  if (!allowed) return send(res, 200, fallback(snapshot, candidates, "rate_limit"));

  if (process.env.LIVING_LESSON_FORCE_FALLBACK === "1") {
    return send(res, 200, fallback(snapshot, candidates, "gateway_unavailable"));
  }

  try {
    const [{ generateText, Output }, { z }] = await Promise.all([import("ai"), import("zod")]);
    const candidateIds = candidates.map(item => item.id);
    const schema = z.object({
      locale: z.literal(snapshot.locale),
      candidateId: z.enum(candidateIds),
      focus: z.enum(LivingLesson.FOCUS_KEYS),
      observation: z.string().min(12).max(260),
      relationship: z.string().min(20).max(300),
      question: z.string().min(12).max(190)
    });
    const prompt = JSON.stringify({ snapshot, trustedExperiments: candidates });
    const result = await generateText({
      model: MODEL,
      output: Output.object({ schema }),
      system: [
        "You are Le Jardin, a poetic but scientifically careful community garden in Menet, France.",
        "Create one concise, age-inclusive learning reflection in " + responseLanguage + " from the supplied bounded game-state snapshot.",
        "Return locale exactly as " + snapshot.locale + ". Write observation, relationship and question entirely in that language, with natural wording for young people rather than a literal translation.",
        "Choose exactly one trusted experiment by candidateId. Never invent an action, score, rule, species claim, certainty, or real-world fact beyond the snapshot and trusted experiments.",
        "Observation is one warm first-person sentence in the garden's voice, grounded in visible elements and using a gentle sensory image.",
        "Never mention percentages, points, scores, metrics, keys, UI labels, progress, or the word journey. Do not merely list the snapshot.",
        "Relationship is one plain educational sentence. Question is one brief, open Socratic question.",
        "Avoid praise, guilt, commands outside the chosen experiment, and claims that wildlife is guaranteed. Do not mention JSON, AI, prompts, models or private data."
      ].join(" "),
      prompt,
      maxOutputTokens: 320,
      timeout: { totalMs: 12000 },
      providerOptions: {
        gateway: { only: ["openai"], user: client, tags: ["permaculture-garden", "living-lesson", LivingLesson.PROMPT_VERSION] },
        openai: { reasoningEffort: "low", textVerbosity: "low", store: false }
      }
    });
    if (!result.output || result.output.locale !== snapshot.locale || !outputMatchesLocale(result.output, snapshot.locale)) {
      throw new Error("locale_mismatch");
    }
    const lesson = LivingLesson.normalizeLesson(result.output, snapshot, candidates, { source: "ai", model: MODEL });
    const payload = { ok: true, lesson, mode: "ai", model: MODEL, cached: false };
    cache.set(fingerprint, { payload, expires: Date.now() + CACHE_TTL_MS });
    if (cache.size > 120) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
    return send(res, 200, payload);
  } catch (error) {
    const status = Number(error && (error.statusCode || error.status));
    const reason = error && error.message === "locale_mismatch" ? "locale_mismatch" : status === 402 ? "credit_limit" : status === 429 ? "provider_rate_limit" : status === 401 || status === 403 ? "gateway_auth" : "provider_unavailable";
    return send(res, 200, fallback(snapshot, candidates, reason));
  }
};
