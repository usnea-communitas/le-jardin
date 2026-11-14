import { access, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import path from "node:path";
import { createRequire } from "node:module";
import { LOGIC_FILE, LOGIC_STUB } from "./game-logic.mjs";

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
const fragment = await readFile(path.join(root, "game.fragment.html"), "utf8");
const logic = await readFile(path.join(root, LOGIC_FILE), "utf8");

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
if (html.includes(`<link rel="preload" href="${LOGIC_FILE}"`) || !(html.indexOf(`load("${LOGIC_FILE}")`) > 0 && html.indexOf("await logic;") > 0 && html.indexOf("await logic;") < html.indexOf('await load("vendor/dc-runtime.js")'))) {
  throw new Error(`index.html should load ${LOGIC_FILE} after the first paint (no preload) and run it before the runtime.`);
}

const localRefs = new Set();
const production = html + "\n" + fragment + "\n" + logic;
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
