// Playing without a connection (package J-05): the package lists, the download
// into a cache, the answers for sound's byte ranges, and the generated files.
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const offline = require("../lib/offline.js");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = "https://example.test/";

// ── the package for a choice ──
const manifest = {
  version: "aaaaaaaaaaaaaaaa",
  files: {
    "index.html": [5, "h-index"], "game.fragment.html": [7, "h-frag"], "assets/a.webp": [3, "h-a"],
    "assets/i18n/catalog.en.json": [4, "h-en"], "assets/i18n/catalog.cs.json": [4, "h-cs"], "assets/i18n/catalog.fr.json": [4, "h-fr"], "assets/i18n/catalog.de.json": [4, "h-de"],
    "assets/audio/story/narration-01.mp3": [10, "h-ven"], "assets/audio/story/cs/narration-01.mp3": [11, "h-vcs"], "assets/audio/story/fr/narration-01.mp3": [12, "h-vfr"],
    "assets/audio/music/a.mp3": [20, "h-m"]
  },
  groups: {
    core: ["index.html", "game.fragment.html", "assets/a.webp"],
    catalogs: { en: ["assets/i18n/catalog.en.json"], cs: ["assets/i18n/catalog.cs.json"], fr: ["assets/i18n/catalog.fr.json"], de: ["assets/i18n/catalog.de.json"] },
    voice: { en: ["assets/audio/story/narration-01.mp3"], cs: ["assets/audio/story/cs/narration-01.mp3"], fr: ["assets/audio/story/fr/narration-01.mp3"] },
    music: ["assets/audio/music/a.mp3"]
  }
};
assert.deepEqual(offline.normalizeSettings({ locale: "xx", voice: 1 }, manifest), { locale: "en", voice: true, music: false });
assert.deepEqual(offline.filesFor(manifest, { locale: "en" }), ["index.html", "game.fragment.html", "assets/a.webp", "assets/i18n/catalog.en.json"]);
assert.deepEqual(offline.filesFor(manifest, { locale: "fr", voice: true }).slice(4), ["assets/i18n/catalog.fr.json", "assets/audio/story/fr/narration-01.mp3"], "French plays the French voice, as the game does");
assert.deepEqual(offline.filesFor(manifest, { locale: "de", voice: true }).slice(4), ["assets/i18n/catalog.de.json", "assets/audio/story/narration-01.mp3"], "German plays the English voice, as the game does");
assert.ok(offline.filesFor(manifest, { locale: "cs", voice: true, music: true }).includes("assets/audio/story/cs/narration-01.mp3"));
assert.ok(offline.filesFor(manifest, { locale: "cs", voice: true, music: true }).includes("assets/audio/music/a.mp3"));
assert.ok(!offline.filesFor(manifest, { locale: "cs", voice: false }).some(f => f.includes("audio")));
assert.deepEqual(offline.sizes(manifest, "cs"), { base: 23, voice: 11, music: 20 });
assert.equal(offline.formatSize(29326646, "en"), "29 MB");
assert.equal(offline.formatSize(8400000, "en"), "8.4 MB");
assert.equal(offline.formatSize(8400000, "cs"), "8,4 MB");
assert.equal(offline.formatSize(8400000, "fr"), "8,4\u00a0Mo");

// ── byte ranges ──
assert.deepEqual(offline.parseRange("bytes=0-", 100), { start: 0, end: 99 });
assert.deepEqual(offline.parseRange("bytes=10-19", 100), { start: 10, end: 19 });
assert.deepEqual(offline.parseRange("bytes=90-500", 100), { start: 90, end: 99 });
assert.deepEqual(offline.parseRange("bytes=-30", 100), { start: 70, end: 99 });
assert.equal(offline.parseRange("bytes=100-", 100), null);
assert.equal(offline.parseRange("bytes=-", 100), null);
assert.equal(offline.parseRange("items=0-1", 100), null);

// ── a small stand-in for the browser's Cache Storage ──
class Cache {
  constructor() { this.entries = new Map(); }
  async match(request, options = {}) {
    const url = typeof request === "string" ? request : request.url;
    const strip = u => (options.ignoreSearch ? u.split("?")[0] : u);
    for (const [key, value] of this.entries) {
      if (strip(key) === strip(url)) return new Response(value.body.slice(0), { status: value.status, headers: value.headers });
    }
    return undefined;
  }
  async put(request, response) {
    const url = typeof request === "string" ? request : request.url;
    this.entries.set(url, { body: await response.arrayBuffer(), status: response.status, headers: [...response.headers] });
  }
  async keys() { return [...this.entries.keys()].map(url => ({ url })); }
  async delete(request) { return this.entries.delete(typeof request === "string" ? request : request.url); }
}
class Caches {
  constructor() { this.all = new Map(); }
  async open(name) { if (!this.all.has(name)) this.all.set(name, new Cache()); return this.all.get(name); }
  async has(name) { return this.all.has(name); }
  async keys() { return [...this.all.keys()]; }
  async delete(name) { return this.all.delete(name); }
}
const bodies = {};
for (const [file, [size]] of Object.entries(manifest.files)) bodies[base + file] = "x".repeat(size);
const fetched = [];
const fakeFetch = async (url, init) => {
  fetched.push(url);
  assert.equal(init.headers[offline.DOWNLOAD_HEADER], "download", "a download's requests are marked for the service worker");
  return bodies[url] === undefined ? new Response("", { status: 404 }) : new Response(bodies[url], { headers: { "content-type": "text/plain" } });
};
const caches = new Caches();
const progress = [];
const first = await offline.download({ caches, fetch: fakeFetch, manifest, settings: { locale: "cs", voice: true }, base, onProgress: p => progress.push(p.done) });
assert.equal(first.complete, true);
assert.equal(first.bytes, 34);
assert.equal(fetched.length, 6, "the first download fetches every file of the choice");
assert.equal(progress[progress.length - 1], 34, "progress ends at the total");
assert.equal(await offline.isComplete(caches, manifest.version, base, { locale: "cs", voice: true }), true);
assert.equal(await offline.isComplete(caches, manifest.version, base, { locale: "en", voice: true }), false, "another choice is another download");

// a newer build where one file changed: the rest is copied from the older download
const next = JSON.parse(JSON.stringify(manifest));
next.version = "bbbbbbbbbbbbbbbb";
next.files["game.fragment.html"] = [8, "h-frag-2"];
bodies[base + "game.fragment.html"] = "y".repeat(8);
fetched.length = 0;
await offline.download({ caches, fetch: fakeFetch, manifest: next, settings: { locale: "cs", voice: true }, base });
assert.deepEqual(fetched, [base + "game.fragment.html"], "an update fetches only what changed");
const nextCache = await caches.open(offline.cacheName(next.version));
assert.equal(await (await nextCache.match(base + "game.fragment.html")).text(), "yyyyyyyy");
assert.equal((await nextCache.match(base + "assets/i18n/catalog.cs.json")).headers.get(offline.HASH_HEADER), "h-cs");
assert.ok(await nextCache.match(base + offline.MANIFEST), "the manifest is kept for the sizes without a connection");

// switching the voice off removes it from the download
await offline.download({ caches, fetch: fakeFetch, manifest: next, settings: { locale: "cs", voice: false }, base });
assert.equal(await nextCache.match(base + "assets/audio/story/cs/narration-01.mp3"), undefined);

// a file of the wrong size stops the download and leaves it incomplete
const broken = JSON.parse(JSON.stringify(next));
broken.version = "cccccccccccccccc";
broken.files["assets/a.webp"] = [99, "h-a-2"];
await assert.rejects(offline.download({ caches, fetch: fakeFetch, manifest: broken, settings: { locale: "en" }, base }), /offline_size/);
assert.equal(await offline.isComplete(caches, broken.version, base), false);

// the newest complete download, and dropping the older ones after an update
assert.equal((await offline.status(caches, base)).version, next.version);
await offline.dropOtherVersions(caches, next.version);
assert.deepEqual((await caches.keys()).sort(), [offline.cacheName(next.version)]);

// ── the service worker's answers ──
const request = (url, init = {}) => ({ url, mode: init.mode || "no-cors", headers: new Headers(init.headers || {}) });
assert.equal(await (await offline.respond(caches, next.version, request(base + "?lang=cs&workshop=1", { mode: "navigate" }), base)).text(), "xxxxx", "the game's address, with any query, opens the downloaded game");
assert.equal(await (await offline.respond(caches, next.version, request(base + "assets/a.webp?v=1"), base)).text(), "xxx");
assert.equal(await offline.respond(caches, next.version, request(base + "api/garden-reflection"), base), null);
assert.equal(await offline.respond(caches, next.version, request(base + "__offline/status.json"), base), null);
assert.equal(await offline.respond(caches, next.version, request("https://other.test/index.html"), base), null);
assert.equal(await offline.respond(caches, "dddddddddddddddd", request(base + "index.html"), base), null);
const part = await offline.respond(caches, next.version, request(base + "game.fragment.html", { headers: { range: "bytes=2-4" } }), base);
assert.equal(part.status, 206);
assert.equal(part.headers.get("content-range"), "bytes 2-4/8");
assert.equal(await part.text(), "yyy");
const outside = await offline.respond(caches, next.version, request(base + "game.fragment.html", { headers: { range: "bytes=50-" } }), base);
assert.equal(outside.status, 416);

// removing deletes the downloads and the choice
await offline.saveSettings(caches, { locale: "cs" }, base);
assert.deepEqual(await offline.readSettings(caches, base), { locale: "cs", voice: false, music: false });
await offline.remove(caches);
assert.deepEqual(await caches.keys(), []);

// ── the real manifest and service worker ──
const real = JSON.parse(readFileSync(path.join(root, "offline-manifest.json"), "utf8"));
const worker = readFileSync(path.join(root, "sw.js"), "utf8");
assert.ok(worker.includes(`const VERSION = "${real.version}";`), "sw.js carries the manifest's version; run npm run generate");
for (const [file, [size]] of Object.entries(real.files)) {
  assert.ok(existsSync(path.join(root, file)) && statSync(path.join(root, file)).size === size, `${file} exists with the size the manifest names`);
}
assert.ok(!Object.keys(real.files).some(f => /\.(webm|mp4)$/.test(f)), "moving pictures stay online");
assert.deepEqual(Object.keys(real.groups.catalogs).sort(), ["cs", "de", "en", "es", "fr", "pl", "pt-BR", "ru", "zh-CN"]);
for (const needed of ["index.html", "game.fragment.html", "game.logic.js", "game.css", "lib/offline.js", "lib/i18n.js", "vendor/dc-runtime.js"]) {
  assert.ok(real.groups.core.includes(needed), `the package holds ${needed}`);
}
assert.deepEqual(Object.keys(real.groups.voice).sort(), ["cs", "en", "fr"], "the English, Czech and French voices are listed");
for (const locale of ["en", "cs", "fr"]) assert.ok(real.groups.voice[locale].length >= 49, `the ${locale} voice has every line`);
const largest = offline.bytesOf(real, offline.filesFor(real, { locale: "cs", voice: true, music: true }));
assert.ok(largest < 40e6, `the largest package stays under 40 MB (${offline.formatSize(largest, "en")})`);

// the helper loads only when the panel opens; the loading shell starts a waiting build first
const shell = readFileSync(path.join(root, "index.html"), "utf8");
assert.ok(!shell.includes('src="lib/offline.js"'), "a first visit does not load the offline helper");
assert.ok(shell.includes("startWaitingBuild") && shell.includes('type: "skip-waiting"'), "the loading shell starts a newer downloaded build before the game");

console.log(`Playing without a connection: package lists, download, updates, byte ranges and the generated files OK (largest package ${offline.formatSize(largest, "en")}).`);
