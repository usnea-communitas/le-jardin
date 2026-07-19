import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
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
assert.equal(get.body.model, "openai/gpt-5.6-terra");
assert.equal(get.body.auth, "vercel-oidc");

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

console.log("Living Lesson API fallback and boundary tests passed.");
