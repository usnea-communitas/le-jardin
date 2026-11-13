# Reviewing the translations

Le Jardin is played in nine languages. English is the source; **the other eight were translated with machine help, and the newest texts have not been checked by native speakers.** If you speak one of them natively, your review makes the garden feel right for players and facilitators. It takes a few hours per language; you can also review one area at a time.

## What you need

- The game: <https://permaculture-garden.vercel.app/>. Choose your language in the language menu; your progress stays in your browser.
- Your file: `cs.csv`, `de.csv`, `es.csv`, `fr.csv`, `pl.csv`, `pt-BR.csv`, `ru.csv` or `zh-CN.csv` in this folder for a spreadsheet, or the same rows to read on GitHub in the matching `.md` file.
- The agreed terms: [`assets/i18n/LOCALIZATION_GLOSSARY.md`](../../assets/i18n/LOCALIZATION_GLOSSARY.md).

## How to review

1. Open your `.csv` in a spreadsheet (LibreOffice, Excel or Google Sheets; UTF-8, comma-separated).
2. The columns:
   - `id` – the message id. Do not change it: it identifies the row. An id like `certificate.gifts#few` is one plural form of a message.
   - `en` – the English source.
   - your language (`de`, `pl` …) – the translation to check. **This is the column you edit.**
   - `area` – the part of the game the message belongs to (`season`, `catalog`, `certificate` …).
   - `check` – a question from a second reading, on the first few rows only: places where a native speaker has to decide. Start with them. The top of your `.md` file lists the same questions and what the second reading already changed.
   - `note` – your comment, if a change needs explaining.
3. Change a translation when it is wrong, sounds unnatural or does not match the glossary. Leave it as it is when it is fine; an empty cell also means "no change".
4. Keep everything in braces exactly as it is (`{count}`, `{value}`, `{name}` …): the game fills in numbers and names there. A row whose braces differ from the English is refused on import.
5. Keep the tone of the English: warm, clear and practical, never preachy. Emoji and symbols (🔒, ·, €) stay where they are.
6. Save as CSV (UTF-8) and attach it to the GitHub issue for your language, or open a pull request with the changed file.

Thank you! Your name goes into the changelog of the release that carries your review, if you want it there.

## For maintainers

```sh
npm run translations:import -- de reviewed-de.csv   # applies changed cells, prints each change, refuses broken placeholders
npm test                                            # catalogue checks and the review-kit test
npm run translations:export                         # refreshes these files after text changes
```

The import changes only the reviewed locale's `assets/i18n/catalog.<locale>.json` and keeps its formatting; rows whose id no longer exists are skipped and reported. Commit through a pull request as usual.

[`notes.json`](notes.json) records the second reading of each language (package S-19): what it changed and the questions for a native speaker. The export puts the questions first, and it stops when a note names a message the game no longer has. When a native speaker has answered a question, remove it from `notes.json` and export again.
