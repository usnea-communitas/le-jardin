// The garden file (lib/garden-file.js): a garden saved to a file comes back the
// same, and a file that is not a garden, is damaged or comes from a newer game
// is refused before anything changes.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const file = require("../lib/garden-file.js");

const stored = JSON.stringify({
  placed: [{ id: "p1", type: "compost", x: 22, y: 34, paidMethod: "barter" }, { id: "p2", type: "rain", x: 61, y: 40 }],
  shares: 7, budget: 210, pool: 65, season: "Autumn", playerName: "Group 3", journeyMoments: ["soil", "water"]
});
const now = Date.parse("2026-11-13T10:00:00Z");

// round trip
const text = file.pack(stored, { version: "v0.85.0", workshop: true, now });
const wrapped = JSON.parse(text);
assert.equal(wrapped.app, "le-jardin");
assert.equal(wrapped.format, file.FORMAT);
assert.equal(wrapped.game, "v0.85.0");
assert.equal(wrapped.saved, "2026-11-13T10:00:00.000Z");
assert.equal(wrapped.workshop, true);
const back = file.unpack(text);
assert.equal(back.ok, true);
assert.equal(back.garden, stored, "the garden comes back exactly as it was stored");
assert.equal(back.workshop, true);
assert.equal(back.saved, "2026-11-13T10:00:00.000Z");

// nothing to save
assert.equal(file.pack(null), null);
assert.equal(file.pack("not json"), null);
assert.equal(file.pack(JSON.stringify({ shares: 3 })), null, "a save without placed elements is not a garden");

// refused before anything changes
const refuse = (input, error, label) => assert.deepEqual(file.unpack(input), { ok: false, error }, label);
refuse("", "format", "an empty file");
refuse("{ broken", "format", "not JSON");
refuse(JSON.stringify([1, 2]), "app", "a list");
refuse(JSON.stringify({ app: "vedome-utraceni", format: 1, garden: { placed: [] } }), "app", "another app's file");
refuse(JSON.stringify({ ...wrapped, format: 0 }), "format", "format 0");
refuse(JSON.stringify({ ...wrapped, format: "1" }), "format", "format as text");
refuse(JSON.stringify({ ...wrapped, format: file.FORMAT + 1 }), "newer", "a newer game's file");
refuse(JSON.stringify({ ...wrapped, garden: null }), "garden", "no garden");
refuse(JSON.stringify({ ...wrapped, garden: { placed: "x" } }), "garden", "placed is not a list");
refuse(JSON.stringify({ ...wrapped, garden: { placed: Array.from({ length: file.MAX_PLACED + 1 }, (_, i) => ({ id: "p" + i })) } }), "garden", "too many elements");
refuse("x".repeat(file.MAX_BYTES + 1), "format", "too large");

// file names
assert.equal(file.fileName(new Date(2026, 10, 3), false), "le-jardin-garden-2026-11-03.json");
assert.equal(file.fileName(new Date(2026, 10, 3), true), "le-jardin-workshop-garden-2026-11-03.json");

// where asking the browser to keep the garden would show a prompt
assert.equal(file.persistPrompts("Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0"), true);
assert.equal(file.persistPrompts("Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0"), true);
assert.equal(file.persistPrompts("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15"), false);
assert.equal(file.persistPrompts("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"), false);
assert.equal(file.persistPrompts("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36"), false);

console.log("Garden file tests passed: round trip, refusals, names and the persistence prompt.");
