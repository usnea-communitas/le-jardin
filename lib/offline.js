/* Le Jardin: playing without a connection (package J-05).
 *
 * Shared by the game (window.PermacultureOffline) and its service worker
 * (sw.js, through importScripts): which files a download needs, the download
 * itself into a cache named after the build, and the answers from that cache.
 * A download talks only to the game's own server and sends nothing about the
 * player. offline-manifest.json, made by `npm run generate`, lists every file
 * with its size and a short content hash; the build's version is a hash of
 * that list, so one cache always holds one consistent build.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PermacultureOffline = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const PREFIX = "lj-offline-";
  const SETTINGS_CACHE = "lj-offline-settings";
  const MANIFEST = "offline-manifest.json";
  const STATUS = "__offline/status.json";
  const SETTINGS = "__offline/settings.json";
  // a download's own requests carry this header, so the service worker lets
  // them through to the server instead of answering from an older download
  const DOWNLOAD_HEADER = "x-pg-offline";
  const HASH_HEADER = "x-pg-hash";
  const PARALLEL = 4;

  const cacheName = version => PREFIX + version;
  // the game speaks Czech in Czech, French in French and English in every other language
  const VOICE_LOCALES = ["cs", "fr"];
  const voiceLocale = locale => (VOICE_LOCALES.includes(locale) ? locale : "en");
  const json = value => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
  const urlFor = (path, base) => new URL(path, base).href;

  function normalizeSettings(input, manifest) {
    const known = manifest && manifest.groups && manifest.groups.catalogs ? Object.keys(manifest.groups.catalogs) : null;
    const wanted = input && typeof input.locale === "string" ? input.locale : "en";
    return {
      locale: !known || known.includes(wanted) ? wanted : "en",
      voice: !!(input && input.voice),
      music: !!(input && input.music)
    };
  }

  // Every file the chosen package needs: the game, its pictures and sounds,
  // English (always: it is the fallback for every text) and the chosen
  // language, and the voice and music when they are wanted.
  function filesFor(manifest, settings) {
    const s = normalizeSettings(settings, manifest);
    const g = manifest.groups;
    const list = [].concat(
      g.core,
      g.catalogs.en || [],
      s.locale !== "en" ? g.catalogs[s.locale] || [] : [],
      s.voice ? g.voice[voiceLocale(s.locale)] || [] : [],
      s.music ? g.music : []
    );
    return Array.from(new Set(list));
  }

  function bytesOf(manifest, paths) {
    return paths.reduce((sum, path) => sum + ((manifest.files[path] || [0])[0] || 0), 0);
  }

  // The sizes the player chooses between, for one language.
  function sizes(manifest, locale) {
    const s = normalizeSettings({ locale }, manifest);
    return {
      base: bytesOf(manifest, filesFor(manifest, { locale: s.locale })),
      voice: bytesOf(manifest, manifest.groups.voice[voiceLocale(s.locale)] || []),
      music: bytesOf(manifest, manifest.groups.music)
    };
  }

  // "21 MB", "8,4 MB", "8,4 Mo" in the player's language.
  function formatSize(bytes, locale) {
    const mb = bytes / 1e6;
    const digits = mb < 10 ? 1 : 0;
    let number;
    try {
      number = new Intl.NumberFormat(locale || "en", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(mb);
    } catch (_) {
      number = mb.toFixed(digits);
    }
    const unit = { fr: "Mo", ru: "МБ" }[String(locale || "").split("-")[0]] || "MB";
    return number + "\u00a0" + unit;
  }

  async function readJson(cache, url) {
    const hit = cache && (await cache.match(url));
    if (!hit) return null;
    try { return await hit.json(); } catch (_) { return null; }
  }

  async function saveSettings(caches, settings, base) {
    const cache = await caches.open(SETTINGS_CACHE);
    await cache.put(urlFor(SETTINGS, base), json(normalizeSettings(settings)));
  }

  async function readSettings(caches, base) {
    if (!(await caches.has(SETTINGS_CACHE))) return null;
    return readJson(await caches.open(SETTINGS_CACHE), urlFor(SETTINGS, base));
  }

  async function versionStatus(caches, version, base) {
    const name = cacheName(version);
    if (!(await caches.has(name))) return null;
    return readJson(await caches.open(name), urlFor(STATUS, base));
  }

  const sameSettings = (a, b) => !!a && !!b && a.locale === b.locale && a.voice === b.voice && a.music === b.music;

  // Is this build downloaded completely (with these settings, when given)?
  async function isComplete(caches, version, base, settings) {
    const status = await versionStatus(caches, version, base);
    return !!(status && status.complete && status.version === version && (!settings || sameSettings(status.settings, normalizeSettings(settings))));
  }

  // The newest complete download on this device, whatever its build.
  async function status(caches, base) {
    let best = null;
    for (const name of await caches.keys()) {
      if (!name.startsWith(PREFIX) || name === SETTINGS_CACHE) continue;
      const found = await readJson(await caches.open(name), urlFor(STATUS, base));
      if (found && found.complete && (!best || String(found.at) > String(best.at))) best = found;
    }
    return best;
  }

  // Download one build's package into its own cache. Files the cache already
  // holds, or an older download holds with the same content hash, are not
  // fetched again; everything else comes from the server and must have the
  // size the manifest names. The cache is marked complete only at the end.
  async function download({ caches, fetch, manifest, settings, base, onProgress, signal }) {
    const version = manifest.version;
    const name = cacheName(version);
    const s = normalizeSettings(settings, manifest);
    const paths = filesFor(manifest, s);
    const total = bytesOf(manifest, paths);
    const cache = await caches.open(name);
    const statusUrl = urlFor(STATUS, base);
    const older = [];
    for (const other of await caches.keys()) {
      if (other.startsWith(PREFIX) && other !== name && other !== SETTINGS_CACHE) older.push(await caches.open(other));
    }
    await cache.put(statusUrl, json({ version, settings: s, complete: false }));
    let done = 0;
    let count = 0;
    const report = () => { if (onProgress) onProgress({ done, total, count, files: paths.length }); };
    report();

    async function one(path) {
      const [size, hash] = manifest.files[path];
      const url = urlFor(path, base);
      const have = await cache.match(url);
      if (have && have.headers.get(HASH_HEADER) === hash) return size;
      for (const old of older) {
        const hit = await old.match(url);
        if (hit && hit.headers.get(HASH_HEADER) === hash) { await cache.put(url, hit); return size; }
      }
      const response = await fetch(url, { cache: "no-cache", credentials: "same-origin", headers: { [DOWNLOAD_HEADER]: "download" }, signal });
      if (!response.ok) throw new Error("offline_http_" + response.status + ": " + path);
      const blob = await response.blob();
      if (blob.size !== size) throw new Error("offline_size: " + path);
      const headers = { "content-type": response.headers.get("content-type") || "application/octet-stream", [HASH_HEADER]: hash };
      await cache.put(url, new Response(blob, { status: 200, headers }));
      return size;
    }

    const queue = paths.slice();
    const worker = async () => {
      while (queue.length) {
        if (signal && signal.aborted) throw new Error("offline_aborted");
        // read `done` only after the await: the workers run side by side
        const size = await one(queue.shift());
        done += size;
        count += 1;
        report();
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));

    // the manifest too, so the sizes can be shown without a connection
    await cache.put(urlFor(MANIFEST, base), json(manifest));
    // what this choice no longer needs (another language, voice switched off)
    const keep = new Set(paths.map(path => urlFor(path, base)).concat([urlFor(MANIFEST, base), statusUrl]));
    for (const request of await cache.keys()) {
      if (!keep.has(request.url)) await cache.delete(request);
    }
    const result = { version, settings: s, complete: true, bytes: total, files: paths.length, at: new Date().toISOString() };
    await cache.put(statusUrl, json(result));
    return result;
  }

  // Delete every download and the choice; the garden itself is not here.
  async function remove(caches) {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX)) await caches.delete(name);
    }
  }

  // After a newer build takes over: the older downloads are no longer needed.
  async function dropOtherVersions(caches, version) {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== SETTINGS_CACHE && name !== cacheName(version)) await caches.delete(name);
    }
  }

  // "bytes=0-", "bytes=100-199", "bytes=-500" → { start, end } or null.
  function parseRange(header, total) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(String(header || "").trim());
    if (!match || (match[1] === "" && match[2] === "")) return null;
    let start;
    let end;
    if (match[1] === "") {
      start = Math.max(0, total - Number(match[2]));
      end = total - 1;
    } else {
      start = Number(match[1]);
      end = match[2] === "" ? total - 1 : Math.min(Number(match[2]), total - 1);
    }
    if (!(start >= 0) || start >= total || start > end) return null;
    return { start, end };
  }

  // Sound and video ask for byte ranges; Safari needs a real 206 answer.
  async function partial(response, header) {
    const blob = await response.blob();
    const range = parseRange(header, blob.size);
    if (!range) {
      return new Response(null, { status: 416, headers: { "content-range": "bytes */" + blob.size } });
    }
    const body = blob.slice(range.start, range.end + 1);
    return new Response(body, {
      status: 206,
      statusText: "Partial Content",
      headers: {
        "content-type": response.headers.get("content-type") || "application/octet-stream",
        "content-range": "bytes " + range.start + "-" + range.end + "/" + blob.size,
        "content-length": String(body.size),
        "accept-ranges": "bytes"
      }
    });
  }

  // The service worker's answer for one request, or null for "ask the server".
  async function respond(caches, version, request, base) {
    const name = cacheName(version);
    if (!(await caches.has(name))) return null;
    const cache = await caches.open(name);
    const scope = new URL(base);
    const url = new URL(request.url);
    if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return null;
    let path = url.pathname.slice(scope.pathname.length);
    // the address of the game itself, with any ?lang= or ?workshop=
    if (path === "") path = "index.html";
    if (!path || path.startsWith("__offline/")) return null;
    const hit = await cache.match(urlFor(path, base), { ignoreSearch: true });
    if (!hit) return null;
    const range = request.headers.get("range");
    return range ? partial(hit, range) : hit;
  }

  return {
    PREFIX,
    SETTINGS_CACHE,
    MANIFEST,
    DOWNLOAD_HEADER,
    HASH_HEADER,
    cacheName,
    voiceLocale,
    normalizeSettings,
    filesFor,
    bytesOf,
    sizes,
    formatSize,
    saveSettings,
    readSettings,
    isComplete,
    status,
    download,
    remove,
    dropOtherVersions,
    parseRange,
    partial,
    respond
  };
});
