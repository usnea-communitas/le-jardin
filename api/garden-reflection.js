const crypto = require("node:crypto");
const LivingLesson = require("../lib/living-lesson.js");

const MODEL = "openai/gpt-5.6-terra";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const BODY_LIMIT = 24 * 1024;
const cache = globalThis.__PG_LIVING_LESSON_CACHE__ || new Map();
const limits = globalThis.__PG_LIVING_LESSON_LIMITS__ || new Map();
globalThis.__PG_LIVING_LESSON_CACHE__ = cache;
globalThis.__PG_LIVING_LESSON_LIMITS__ = limits;

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

  if (!process.env.VERCEL_OIDC_TOKEN && !process.env.AI_GATEWAY_API_KEY) {
    return send(res, 200, fallback(snapshot, candidates, "gateway_unavailable"));
  }

  try {
    const [{ generateText, Output }, { z }] = await Promise.all([import("ai"), import("zod")]);
    const candidateIds = candidates.map(item => item.id);
    const schema = z.object({
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
        "Create one concise, age-inclusive learning reflection in English from the supplied bounded game-state snapshot.",
        "Choose exactly one trusted experiment by candidateId. Never invent an action, score, rule, species claim, certainty, or real-world fact beyond the snapshot and trusted experiments.",
        "Observation is first-person garden voice. Relationship is plain educational explanation. Question is one Socratic question.",
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
    const reason = status === 402 ? "credit_limit" : status === 429 ? "provider_rate_limit" : status === 401 || status === 403 ? "gateway_auth" : "provider_unavailable";
    return send(res, 200, fallback(snapshot, candidates, reason));
  }
};
