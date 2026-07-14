import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
for (const match of production.matchAll(/assets\/[a-zA-Z0-9._/-]+\.(?:webp|mp3|woff2)/g)) {
  localRefs.add(match[0]);
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
