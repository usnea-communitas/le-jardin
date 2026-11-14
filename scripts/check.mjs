import { access, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import path from "node:path";
import { createRequire } from "node:module";
import { LOGIC_FILE } from "./game-logic.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const livingLesson = require(path.join(root, "lib", "living-lesson.js"));
if (!livingLesson || typeof livingLesson.buildCandidates !== "function" || typeof livingLesson.checkExperiment !== "function") {
  throw new Error("Living Lesson engine did not load correctly.");
}
require(path.join(root, "api", "garden-reflection.js"));
const execFileAsync = promisify(execFile);
const generated = await execFileAsync(process.execPath, [path.join(root, "scripts", "build.mjs"), "--check"], { cwd: root });
process.stdout.write(generated.stdout);
const html = await readFile(path.join(root, "index.html"), "utf8");
const template = await readFile(path.join(root, "game.template.js"), "utf8");
const logic = await readFile(path.join(root, LOGIC_FILE), "utf8");
const styles = await readFile(path.join(root, "game.css"), "utf8");
const source = await readFile(path.join(root, "Permaculture Garden v2.dc.html"), "utf8");

// The game's logic class, its template made into code and the game's own runtime are
// scripts of their own (scripts/build.mjs, docs/ARCHITECTURE.md): the shell loads them
// after the first paint, with the styles, and starts the runtime only once all are in.
new Function(logic);
new Function(template);
if (!template.includes("window.__permagardenTemplate = function") || /\bnew Function\b|\beval\(/.test(template)) {
  throw new Error("game.template.js should define window.__permagardenTemplate, and make no code from text.");
}
if (/<helmet>[\s\S]*?<style/.test(template) || !/@font-face/.test(styles) || !styles.includes(".pg-story-cover-card{") || !/@media print\{\s*figure,table/.test(styles)) {
  throw new Error("The game's styles should be in game.css, the print rules first.");
}
const ready = html.indexOf("await Promise.all([styles, logic, template, runtime]);");
const start = html.indexOf("window.PermacultureRuntime.start({ onError: showError });");
if (/<link rel="preload" href="(?:game\.(?:logic\.js|template\.js|css)|lib\/runtime\.js)"/.test(html) || !(["sheet(\"game.css\")", `load("${LOGIC_FILE}")`, 'load("game.template.js")', 'load("lib/runtime.js")'].every((part) => html.indexOf(part) > 0) && ready > 0 && ready < start)) {
  throw new Error(`index.html should fetch game.css, ${LOGIC_FILE}, game.template.js and lib/runtime.js after the first paint (no preload) and have them all before the start.`);
}
// The cover's typefaces are asked for before the runtime draws the cover (see build.mjs).
if (!(html.indexOf("await lettered;") > ready && html.indexOf("await lettered;") < start)) {
  throw new Error("index.html should have the cover's typefaces ready before the runtime starts.");
}
if (/vendor\/dc-runtime|game\.fragment/.test(html)) {
  throw new Error("index.html still names the design canvas's runtime or the old game fragment.");
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

// the template's addresses are read in the source's markup, where they are HTML
const production = html + "\n" + source.slice(source.indexOf("<x-dc>"), source.indexOf("</x-dc>")) + "\n" + logic + "\n" + styles;
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
