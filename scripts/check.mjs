import { access, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import path from "node:path";
import { createRequire } from "node:module";

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

const open = fragment.indexOf('<script type="text/x-dc"');
const start = fragment.indexOf(">", open) + 1;
const end = fragment.indexOf("</script>", start);
if (open < 0 || start < 1 || end < 0) {
  throw new Error("The game script was not found in game.fragment.html.");
}

const gameScript = fragment.slice(start, end);
new Function(gameScript);

const localRefs = new Set();
const production = html + "\n" + fragment;
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

console.log(`Game script syntax OK (${gameScript.length} characters).`);
console.log(`Local resource references OK (${localRefs.size} checked).`);
