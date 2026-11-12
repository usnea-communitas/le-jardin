// The list of files a player can download to play without a connection
// (package J-05), written by `npm run generate` as offline-manifest.json.
// Every file under assets/ must belong to a group or to the files that stay
// online, so a new kind of file stops the build until it is placed here.
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const hash = buffer => createHash("sha256").update(buffer).digest("hex").slice(0, 16);

async function walk(root, dir) {
  const out = [];
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const rel = dir + "/" + entry.name;
    if (entry.isDirectory()) out.push(...(await walk(root, rel)));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

// Files that stay online: moving pictures (the game shows their still
// pictures without a connection), the share preview for social networks and
// the build-time notes about translations and recordings.
export function staysOnline(file) {
  return /\.(webm|mp4)$/.test(file)
    || file === "assets/story/share-menet.jpg"
    || file === "assets/audio/garden-voice/manifest.json"
    || /^assets\/i18n\/(audio\.[^/]+\.json|[^/]+\.md)$/.test(file);
}

export function groupOf(file) {
  if (/^assets\/i18n\/catalog\.[^/]+\.json$/.test(file)) return "catalog";
  const voice = file.match(/^assets\/audio\/(?:story|garden-voice)\/(cs|fr)\/[^/]+\.mp3$/);
  if (voice) return "voice:" + voice[1];
  if (/^assets\/audio\/story\/narration-[^/]+\.mp3$/.test(file) || /^assets\/audio\/garden-voice\/[^/]+\.mp3$/.test(file)) return "voice:en";
  if (/^assets\/audio\/music\/[^/]+\.mp3$/.test(file) || /^assets\/audio\/story\/(intro-music|garden-ambience)\.mp3$/.test(file)) return "music";
  if (/^assets\/audio\/game(-v2)?\/[^/]+\.mp3$/.test(file)) return "core";
  if (/^assets\/fonts\/[^/]+\.woff2$/.test(file) || /^assets\/.+\.(webp|jpg|svg)$/.test(file)) return "core";
  return null;
}

// generated: the contents of index.html and game.fragment.html as this build
// makes them (they may not be written yet when the build only checks).
export async function buildOfflineManifest(root, generated) {
  const shell = ["index.html", "game.fragment.html", "manifest.webmanifest", "favicon.ico"];
  const lib = (await readdir(path.join(root, "lib"))).filter(f => f.endsWith(".js")).sort().map(f => "lib/" + f);
  const vendor = (await readdir(path.join(root, "vendor"))).filter(f => f.endsWith(".js")).sort().map(f => "vendor/" + f);
  const assets = (await walk(root, "assets")).sort();

  const groups = { core: [...shell, ...lib, ...vendor], catalogs: {}, voice: { en: [], cs: [], fr: [] }, music: [] };
  const unplaced = [];
  for (const file of assets) {
    if (staysOnline(file)) continue;
    const group = groupOf(file);
    if (group === "core") groups.core.push(file);
    else if (group === "music") groups.music.push(file);
    else if (group && group.startsWith("voice:")) groups.voice[group.slice(6)].push(file);
    else if (group === "catalog") groups.catalogs[file.match(/catalog\.([^/]+)\.json$/)[1]] = [file];
    else unplaced.push(file);
  }
  if (unplaced.length) {
    throw new Error(`Files under assets/ belong to no offline group: ${unplaced.join(", ")}. Place them in scripts/offline-manifest.mjs.`);
  }
  if (!groups.catalogs.en) throw new Error("The English catalogue is missing from the offline package.");

  const files = {};
  const listed = [...groups.core, ...Object.values(groups.catalogs).flat(), ...Object.values(groups.voice).flat(), ...groups.music];
  for (const file of listed) {
    const buffer = generated && Object.prototype.hasOwnProperty.call(generated, file)
      ? Buffer.from(generated[file], "utf8")
      : await readFile(path.join(root, file));
    files[file] = [buffer.length, hash(buffer)];
  }
  const version = hash(Buffer.from(JSON.stringify(Object.keys(files).sort().map(f => [f, ...files[f]]))));
  return { version, files, groups };
}

// One file or path per line, so a change shows as a readable diff.
export function formatOfflineManifest(manifest) {
  const pad = n => " ".repeat(n);
  const list = (items, indent) => "[\n" + items.map(item => pad(indent + 2) + JSON.stringify(item)).join(",\n") + "\n" + pad(indent) + "]";
  const g = manifest.groups;
  return [
    "{",
    `  "version": ${JSON.stringify(manifest.version)},`,
    '  "files": {',
    Object.keys(manifest.files).map(f => `    ${JSON.stringify(f)}: ${JSON.stringify(manifest.files[f])}`).join(",\n"),
    "  },",
    '  "groups": {',
    `    "core": ${list(g.core, 4)},`,
    '    "catalogs": {',
    Object.keys(g.catalogs).map(l => `      ${JSON.stringify(l)}: ${JSON.stringify(g.catalogs[l])}`).join(",\n"),
    "    },",
    '    "voice": {',
    Object.keys(g.voice).map(l => `      ${JSON.stringify(l)}: ${list(g.voice[l], 6)}`).join(",\n"),
    "    },",
    `    "music": ${list(g.music, 4)}`,
    "  }",
    "}"
  ].join("\n") + "\n";
}

// sw.js carries the build's version, so a new build makes a new worker.
export function stampServiceWorker(source, version) {
  const pattern = /^const VERSION = "[0-9a-f]*";$/m;
  if (!pattern.test(source)) throw new Error('Expected `const VERSION = "…";` in sw.js');
  return source.replace(pattern, `const VERSION = "${version}";`);
}
