/* Le Jardin: the service worker for playing without a connection (J-05).
 *
 * The game registers it only after a player chooses "Play without a
 * connection". It answers from the download made for this exact build, so
 * one page never mixes two versions of the game. A newer build is downloaded
 * here in the background (unchanged files are copied, not fetched again) and
 * starts the next time the game opens; a game in progress keeps its version
 * until then, and the garden itself stays in the browser's storage.
 * The version below is stamped by `npm run generate` (scripts/build.mjs).
 */
const VERSION = "68d8f358bc93ab85";
importScripts("lib/offline.js?v=" + VERSION);

const offline = self.PermacultureOffline;
const BASE = self.registration.scope;
let ready = null;

async function isReady() {
  if (ready === null) ready = await offline.isComplete(caches, VERSION, BASE);
  return ready;
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const settings = await offline.readSettings(caches, BASE);
    // nothing chosen yet: the game downloads the first package itself
    if (!settings || (await offline.isComplete(caches, VERSION, BASE, settings))) return;
    const response = await fetch(new URL(offline.MANIFEST + "?v=" + VERSION, BASE).href, { cache: "no-cache" });
    if (!response.ok) throw new Error("offline_manifest_" + response.status);
    const manifest = await response.json();
    // another build was published meanwhile: the next update check brings it
    if (manifest.version !== VERSION) throw new Error("offline_manifest_version");
    await offline.download({ caches, fetch, manifest, settings, base: BASE });
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    await offline.dropOtherVersions(caches, VERSION);
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  const type = event.data && event.data.type;
  if (type === "skip-waiting") self.skipWaiting();
  if (type === "offline-changed") ready = null;
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.get(offline.DOWNLOAD_HEADER)) return;
  const url = new URL(request.url);
  const scope = new URL(BASE);
  if (url.origin !== scope.origin || url.pathname.startsWith(scope.pathname + "api/")) return;
  event.respondWith((async () => {
    if (await isReady()) {
      const answer = await offline.respond(caches, VERSION, request, BASE);
      if (answer) return answer;
    }
    try {
      return await fetch(request);
    } catch (error) {
      // Sound and moving pictures left out of the download simply stay silent
      // without a connection; Safari would report the failed answer on the page.
      if (request.destination === "audio" || request.destination === "video") {
        return new Response(null, { status: 503, statusText: "Offline" });
      }
      throw error;
    }
  })());
});
