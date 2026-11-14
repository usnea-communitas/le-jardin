import { access, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { LOGIC_FILE, LOGIC_STUB } from "./game-logic.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const livingLesson = require(path.join(root, "lib", "living-lesson.js"));
if (!livingLesson || typeof livingLesson.buildCandidates !== "function" || typeof livingLesson.checkExperiment !== "function") {
  throw new Error("Living Lesson engine did not load correctly.");
}
require(path.join(root, "api", "garden-reflection.js"));
// vendor/dc-runtime.js is the Claude design canvas's runtime, redistributed exactly as it
// came with the export (THIRD_PARTY_NOTICES.md): the game never edits it.
const RUNTIME_SHA256 = "ae4f0ac8449655e17cca1e3b179effcb6817a3b0d8dc47f112a9c39c25c39fd7";
const runtimeHash = createHash("sha256").update(await readFile(path.join(root, "vendor", "dc-runtime.js"))).digest("hex");
if (runtimeHash !== RUNTIME_SHA256) {
  throw new Error("vendor/dc-runtime.js changed. It is the design canvas runtime as exported and is never edited (THIRD_PARTY_NOTICES.md); change the game in the canonical source, lib/ or the build instead.");
}
const execFileAsync = promisify(execFile);
const generated = await execFileAsync(process.execPath, [path.join(root, "scripts", "build.mjs"), "--check"], { cwd: root });
process.stdout.write(generated.stdout);
const html = await readFile(path.join(root, "index.html"), "utf8");
const fragment = await readFile(path.join(root, "game.fragment.html"), "utf8");
const logic = await readFile(path.join(root, LOGIC_FILE), "utf8");
const styles = await readFile(path.join(root, "game.css"), "utf8");

// The game's logic class ships as a script of its own (scripts/game-logic.mjs): the
// fragment keeps only the stub the runtime compiles, and the shell loads the script
// after the first paint and runs it before the runtime.
const open = fragment.indexOf('<script type="text/x-dc"');
const start = fragment.indexOf(">", open) + 1;
const end = fragment.indexOf("</script>", start);
if (open < 0 || start < 1 || end < 0) {
  throw new Error("The game script was not found in game.fragment.html.");
}
if (fragment.slice(start, end).trim() !== LOGIC_STUB) {
  throw new Error(`The game script in game.fragment.html should be the stub that asks ${LOGIC_FILE}.`);
}
new Function(logic);
// The game's styles ship as game.css (scripts/build.mjs): the template keeps no <style>, the
// shell fetches the sheet with the logic, after the first paint, and both are in before the runtime.
if (/<helmet>[\s\S]*?<style/.test(fragment) || !/@font-face/.test(styles) || !styles.includes(".pg-story-cover-card{")) {
  throw new Error("The game's styles should be in game.css, and none left in game.fragment.html.");
}
const ready = html.indexOf("await Promise.all([styles, logic]);");
if (/<link rel="preload" href="game\.(?:logic\.js|css)"/.test(html) || !(html.indexOf(`load("${LOGIC_FILE}")`) > 0 && html.indexOf('sheet("game.css")') > 0 && ready > 0 && ready < html.indexOf('await load("vendor/dc-runtime.js")'))) {
  throw new Error(`index.html should fetch game.css and ${LOGIC_FILE} after the first paint (no preload) and have both before the runtime.`);
}
// The cover's typefaces are asked for before the runtime draws the cover (see build.mjs).
if (!(html.indexOf("await lettered;") > ready && html.indexOf("await lettered;") < html.indexOf('await load("vendor/dc-runtime.js")'))) {
  throw new Error("index.html should have the cover's typefaces ready before the runtime starts.");
}
// The template waits in the page unseen: none of its pictures may download before the game shows it.
const template = fragment.slice(fragment.indexOf("<x-dc>"), fragment.indexOf("</x-dc>"));
if (/<(?:img|source|video|audio|iframe|object|embed)\b[^>]*\s(?:src|srcset|poster)="/.test(template)) {
  throw new Error("A picture in game.fragment.html has a src the browser would fetch while the template waits; the build writes sc-camel-src.");
}

const localRefs = new Set();
// The boot screen shows the story's first painting from exactly the files the head
// preloads, so the largest paint does not wait for the game and nothing downloads twice.
const preloadedArt = [...html.matchAll(/<link rel="preload" href="([^"]+)" as="image"[^>]*media="([^"]+)"/g)].map((m) => [m[1], m[2]]);
const boot = (html.match(/<div id="pg-boot"[\s\S]*?<\/picture>/) || [""])[0];
const bootSource = boot.match(/<source media="([^"]+)" srcset="([^"]+)"/);
const bootImage = boot.match(/<img class="pg-boot-art" src="([^"]+)"/);
const phoneArt = preloadedArt.find(([, media]) => !media.startsWith("not all"));
const wideArt = preloadedArt.find(([, media]) => media.startsWith("not all"));
if (!bootSource || !bootImage || !phoneArt || !wideArt || bootSource[2] !== phoneArt[0] || bootSource[1] !== phoneArt[1] || bootImage[1] !== wideArt[0]) {
  throw new Error("The boot screen's painting should be the story's first picture the head preloads, for the same screens.");
}

const production = html + "\n" + fragment + "\n" + logic + "\n" + styles;
for (const match of production.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const ref = match[1];
  if (!ref.includes("{{") && !/^(?:https?:|data:|#)/.test(ref)) localRefs.add(ref);
}
for (const match of production.matchAll(/assets\/[a-zA-Z0-9._/-]+\.(?:webp|svg|mp3|wav|ogg|woff2|webm|mp4|json)/g)) {
  localRefs.add(match[0]);
}

// Some artwork is addressed by a bare stem that is only joined to its folder and
// extension at render time (produceMeta img, sprite keys). A scan for literal
// "assets/..." paths cannot see those, so resolve the stems too — a missing preserve
// plate used to reach the browser as a silent 404.
for (const match of production.matchAll(/img:'([a-z0-9-]+)'/g)) {
  localRefs.add(`assets/${match[1]}.webp`);
}

const missing = [];
for (const ref of localRefs) {
  try {
    await access(path.join(root, ref));
  } catch {
    missing.push(ref);
  }
}

if (missing.length) {
  throw new Error(`Missing local resources:\n${missing.join("\n")}`);
}

console.log(`Game script syntax OK (${LOGIC_FILE}, ${logic.length} characters).`);
console.log(`Local resource references OK (${localRefs.size} checked).`);
