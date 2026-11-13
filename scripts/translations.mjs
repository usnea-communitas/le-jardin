// scripts/translations.mjs — a review kit for native speakers.
//
//   node scripts/translations.mjs export                 writes docs/translations/<locale>.csv and .md
//   node scripts/translations.mjs import de reviewed.csv applies the reviewed column back to the catalogue
//
// English (assets/i18n/catalog.en.json) is the source. For each other locale the
// export lists the message id, the English text, the current translation, the
// area of the game (the first part of the id), a question from the second
// reading where there is one, and an empty note column. The rows with a question
// come first (docs/translations/notes.json holds the questions and what the
// second reading changed). A reviewer edits only the translation and note
// columns; the import writes changed translations back into
// catalog.<locale>.json, keeps the file's formatting and refuses a translation
// whose {placeholders} differ from the English ones.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LOCALES = ['cs', 'de', 'es', 'fr', 'pl', 'pt-BR', 'ru', 'zh-CN'];
const NAMES = { cs: 'Czech', de: 'German', es: 'Spanish', fr: 'French', pl: 'Polish', 'pt-BR': 'Portuguese (Brazil)', ru: 'Russian', 'zh-CN': 'Chinese (Simplified)' };
const catalogPath = locale => join(root, 'assets', 'i18n', `catalog.${locale}.json`);
export const readCatalog = locale => JSON.parse(readFileSync(catalogPath(locale), 'utf8'));
export const writeCatalogText = catalog => JSON.stringify(catalog, null, 2) + '\n';

// ---------- CSV ----------

const csvCell = v => (/[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
export function toCsv(rows) { return rows.map(r => r.map(v => csvCell(String(v ?? ''))).join(',')).join('\n') + '\n'; }

export function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(v => v !== ''));
}

// ---------- export ----------

// Plural messages are objects of forms ({ one, other }, and few/many in some
// languages); each form of the target language gets its own row, id#form.
// ---------- the second reading (notes.json) ----------

export function readNotes(file = join(root, 'docs', 'translations', 'notes.json')) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return {}; throw e; }
}

// the notes of one locale; a note whose message the game no longer has stops
// the export, so no question is lost
export function notesFor(en, notes, locale) {
  const own = notes[locale] ?? {};
  const known = list => (list ?? []).map(n => {
    const [id, form] = n.id.split('#');
    const source = en.messages[id];
    if (source === undefined || (form && (typeof source !== 'object' || !(form in source) && !('other' in source)))) {
      throw new Error(`docs/translations/notes.json (${locale}): no message ${n.id} in the English catalogue`);
    }
    return n;
  });
  return { read: own.read ?? '', fixed: known(own.fixed), check: known(own.check) };
}

export function exportLocale(en, target, locale, notes = {}) {
  const rows = [];
  for (const [id, text] of Object.entries(en.messages)) {
    const area = id.split('.')[0];
    if (text && typeof text === 'object') {
      const own = target.messages[id] && typeof target.messages[id] === 'object' ? target.messages[id] : text;
      for (const form of Object.keys(own)) rows.push([`${id}#${form}`, text[form] ?? text.other ?? '', target.messages[id]?.[form] ?? '', area, '', '']);
    } else rows.push([id, text, target.messages[id] ?? '', area, '', '']);
  }
  const asked = new Map(notesFor(en, notes, locale).check.map(n => [n.id, n.question]));
  for (const r of rows) r[4] = asked.get(r[0]) ?? '';
  const first = [...asked.keys()].map(id => rows.find(r => r[0] === id)).filter(Boolean);
  return [['id', 'en', locale, 'area', 'check', 'note'], ...first, ...rows.filter(r => !asked.has(r[0]))];
}

const longDate = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${y}`;
};

function markdown(rows, locale, en, notes = {}) {
  const esc = v => String(v).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
  const name = NAMES[locale];
  const { read, fixed, check } = notesFor(en, notes, locale);
  const byId = new Map(rows.slice(1).map(r => [r[0], r]));
  const order = new Map(Object.keys(en.messages).map((id, i) => [id, i]));
  const lines = [
    `# ${name} (${locale}) — translations to review`,
    '',
    `Generated by \`npm run translations:export\`. Edit \`${locale}.csv\` (the same rows), not this file; see [README.md](README.md) and the [glossary](../../assets/i18n/LOCALIZATION_GLOSSARY.md).`,
    '',
  ];
  if (check.length || fixed.length) {
    lines.push(
      '## Start here',
      '',
      `A second reading${read ? ` on ${longDate(read)}` : ''} compared the ${name} texts with the English source and the [glossary](../../assets/i18n/LOCALIZATION_GLOSSARY.md): the names of the game's own things, the informal address, the placeholders and the length. ${fixed.length ? 'It changed what was clearly wrong (see below)' : 'It found nothing clearly wrong'} and left ${check.length === 1 ? 'one place' : `${check.length} places`} for a native speaker to decide. They are also the first rows of \`${locale}.csv\`, with the question in the \`check\` column.`,
      '',
    );
    if (check.length) lines.push(
      `| Id | English | ${name} | What to check |`,
      '|---|---|---|---|',
      ...check.map(n => { const r = byId.get(n.id) ?? [n.id, '', '']; return `| \`${esc(n.id)}\` | ${esc(r[1])} | ${esc(r[2])} | ${esc(n.question)} |`; }),
      '',
    );
    if (fixed.length) lines.push(
      '### What the second reading changed',
      '',
      '| Id | Before | After | Why |',
      '|---|---|---|---|',
      ...fixed.map(n => `| \`${esc(n.id)}\` | ${esc(n.before)} | ${esc(n.after)} | ${esc(n.why)} |`),
      '',
    );
    lines.push('## All texts', '');
  }
  lines.push(
    `| Id | English | ${name} | Area |`,
    '|---|---|---|---|',
    // here in the order of the catalogue
    ...rows.slice(1).map((r, i) => [r, i]).sort(([a, i], [b, j]) => (order.get(a[0].split('#')[0]) - order.get(b[0].split('#')[0])) || i - j)
      .map(([r]) => `| \`${esc(r[0])}\` | ${esc(r[1])} | ${esc(r[2])} | ${esc(r[3])} |`),
  );
  return lines.join('\n') + '\n';
}

// ---------- import ----------

const placeholders = text => [...String(text).matchAll(/\{[a-zA-Z0-9_]+\}/g)].map(m => m[0]).sort().join(' ');

// applies the reviewed column of a CSV to a catalogue; returns the new catalogue and what happened
export function importLocale(en, target, locale, csvText) {
  const [header, ...rows] = parseCsv(csvText);
  const col = header.indexOf(locale);
  if (header[0] !== 'id' || col < 0) throw new Error(`the CSV needs an "id" column first and a "${locale}" column`);
  const messages = { ...target.messages };
  const edits = []; const unknown = []; const refused = [];
  for (const r of rows) {
    const [id, form] = r[0].split('#');
    const source = en.messages[id];
    if (source === undefined || (form ? typeof source !== 'object' : typeof source !== 'string')) { unknown.push(r[0]); continue; }
    const current = form ? messages[id]?.[form] : messages[id];
    const text = r[col] ?? '';
    if (text.trim() === '' || text === current) continue;
    if (placeholders(text) !== placeholders(form ? source[form] ?? source.other : source)) { refused.push(r[0]); continue; }
    edits.push({ id: r[0], before: current, after: text });
    messages[id] = form ? { ...messages[id], [form]: text } : text;
  }
  return { catalog: { ...target, messages }, edits, unknown, refused };
}

// ---------- command line ----------

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [command, locale, file] = process.argv.slice(2);
  const en = readCatalog('en');
  if (command === 'export') {
    const dir = join(root, 'docs', 'translations');
    mkdirSync(dir, { recursive: true });
    const notes = readNotes();
    for (const l of LOCALES) {
      const rows = exportLocale(en, readCatalog(l), l, notes);
      writeFileSync(join(dir, `${l}.csv`), toCsv(rows));
      writeFileSync(join(dir, `${l}.md`), markdown(rows, l, en, notes));
    }
    console.log(`Exported ${Object.keys(en.messages).length} messages for ${LOCALES.join(', ')} to docs/translations/.`);
  } else if (command === 'import' && LOCALES.includes(locale) && file) {
    const result = importLocale(en, readCatalog(locale), locale, readFileSync(file, 'utf8'));
    writeFileSync(catalogPath(locale), writeCatalogText(result.catalog));
    for (const e of result.edits) console.log(`changed: ${e.id}\n   ${e.before}\n → ${e.after}`);
    for (const id of result.refused) console.log(`refused: ${id} – its {placeholders} differ from the English text`);
    if (result.unknown.length) console.log(`skipped ${result.unknown.length} row(s) whose id is no longer in the game`);
    console.log(`${result.edits.length} translation(s) updated in catalog.${locale}.json. Now run: npm test`);
  } else {
    console.log(`usage: node scripts/translations.mjs export | import <${LOCALES.join('|')}> <file.csv>`);
    process.exit(1);
  }
}
