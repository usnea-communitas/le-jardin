import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const sourcePath = resolve(root, 'Permaculture Garden v2.dc.html');
const catalogPath = resolve(root, 'assets/i18n/catalog.en.json');
const reportPath = resolve(root, '.tmp/i18n-source-audit.json');
const source = await readFile(sourcePath, 'utf8');
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));

const exact = new Set([...Object.values(catalog.messages), ...Object.values(catalog.templates)]);
const templateRegexes = Object.values(catalog.templates).filter(value => {
  const staticText = String(value).replace(/%\{[a-zA-Z0-9_]+\}|\{[a-zA-Z0-9_]+\}/g, '');
  return staticText.replace(/[^A-Za-zÀ-ž\u0400-\u04ff\u4e00-\u9fff]/gu, '').length >= 3;
}).map(value => {
  const pattern = String(value)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\{[a-zA-Z0-9_]+\\\}|%\\\{[a-zA-Z0-9_]+\\\}/g, '.+?')
    .replace(/\s+/g, '\\s+');
  try { return new RegExp(`^${pattern}$`, 'u'); }
  catch (_) { return null; }
}).filter(Boolean);

function looksUserFacing(value) {
  const text = value.trim();
  if (text.length < 3 || text.length > 700) return false;
  if (!/[A-Za-zÀ-ž\u0400-\u04ff\u4e00-\u9fff]/u.test(text)) return false;
  if (text.includes('{{') || text.includes('}}')) return false;
  if (/^data:image\//iu.test(text)) return false;
  if (/^M[-\d.\sA-Za-z,]+$/u.test(text)) return false;
  if (/^(?:Hanken Grotesk|Bricolage Grotesque|Times New Roman|Noto Sans|Noto Serif|Segoe UI|Microsoft YaHei UI|PingFang SC|Hiragino Sans GB|Songti SC|STSong)$/u.test(text)) return false;
  if (/(?:^|;)(?:width|height|min-width|max-width|min-height|max-height|display|position|inset|top|right|bottom|left|margin|padding|border|background|color|font|line-height|letter-spacing|overflow|transform|animation|box-shadow|filter|flex|grid|cursor|opacity|z-index|white-space|text-align|pointer-events|object-fit)\s*:/iu.test(text)) return false;
  if (/^rgb\(/iu.test(text)) return false;
  if (/^(?:assets|api|lib|scripts|vendor|https?):[\\/]/iu.test(text)) return false;
  if (/^(?:assets|api|lib|scripts|vendor)[\\/]/iu.test(text)) return false;
  if (/\.(?:mp3|mp4|webp|png|svg|js|json|html|woff2?)(?:[?#]|$)/iu.test(text)) return false;
  if (/^[.#[]|^(?:data-|aria-|pg-|sc-)/u.test(text)) return false;
  if (/[<>]=?|===?|!==?|=>|&&|\|\||\b(?:function|return|const|let|var|this\.|window\.|document\.)\b/u.test(text)) return false;
  if (/^[a-z][a-zA-Z0-9_.:-]*$/u.test(text)) return false;
  if (/^[A-Z_][A-Z0-9_]*$/u.test(text)) return false;
  if (/^(?:GET|POST|OPTIONS|Content-Type|Cache-Control|same-origin|no-cache)$/u.test(text)) return false;
  if (/^[\w-]+(?:\s*,\s*[\w-]+)+$/u.test(text) && !/[.!?…—]/u.test(text)) return false;
  return /\s/u.test(text) || /^[A-ZÀ-Ž\u0400-\u042f\u4e00-\u9fff]/u.test(text);
}

function decodeLiteral(raw) {
  try {
    const value = vm.runInNewContext(raw, Object.create(null), { timeout: 20 });
    return typeof value === 'string' ? value : null;
  } catch (_) {
    return null;
  }
}

const lineStarts = [0];
for (let index = 0; index < source.length; index += 1) {
  if (source[index] === '\n') lineStarts.push(index + 1);
}
function lineAt(offset) {
  let low = 0;
  let high = lineStarts.length;
  while (low + 1 < high) {
    const mid = (low + high) >> 1;
    if (lineStarts[mid] <= offset) low = mid;
    else high = mid;
  }
  return low + 1;
}

const literalPattern = /'(?:\\.|[^'\\\r\n])*'|"(?:\\.|[^"\\\r\n])*"/gu;
const missing = new Map();
for (const match of source.matchAll(literalPattern)) {
  const value = decodeLiteral(match[0]);
  if (!value || !looksUserFacing(value)) continue;
  if (exact.has(value) || templateRegexes.some(regex => regex.test(value))) continue;
  const normalized = value.trim();
  if (!missing.has(normalized)) missing.set(normalized, []);
  missing.get(normalized).push(lineAt(match.index));
}

const report = [...missing.entries()]
  .map(([value, lines]) => ({ value, lines: [...new Set(lines)] }))
  .sort((a, b) => a.lines[0] - b.lines[0] || a.value.localeCompare(b.value));

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Potential untranslated source strings: ${report.length}`);
console.log(`Report: ${reportPath}`);
