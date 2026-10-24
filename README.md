# Le Jardin — a permaculture garden game

**A story-led educational browser game about designing a living permaculture garden in Menet, France. Every placement becomes a relationship, every season changes the lesson, and an AI "Living Lesson" helps the garden reflect on what the player has actually built — without ever taking over the rules.**

[![Play Le Jardin](https://img.shields.io/badge/play-permaculture--garden.vercel.app-5b7a3a)](https://permaculture-garden.vercel.app/)
[![License: MIT](https://img.shields.io/badge/code-MIT-blue.svg)](LICENSE)
[![Media: CC BY-NC-SA 4.0](https://img.shields.io/badge/media-CC%20BY--NC--SA%204.0-lightgrey.svg)](LICENSE-ASSETS.md)
[![Tests](https://img.shields.io/badge/tests-npm%20test-success)](#install-build-and-test)
[![Languages](https://img.shields.io/badge/languages-9-8a6d3b)](#localisation)

**Play it:** <https://permaculture-garden.vercel.app/> — free, no account, progress stays in your browser.

Le Jardin is an open-source project of [Usnea communitas, z. s.](https://usnea.ngo), a Czech nonprofit association for education, communities, nature and permaculture. It is built and maintained by [Martin Pazderník](https://github.com/martinpazdernik-source).

---

## Why this garden exists

The game is inspired by a real permaculture garden in the small French village of Menet. The creator's partner joined an Erasmus+ volunteering programme there and helped a group of young people care for the garden, learn together and move the project forward.

Le Jardin was conceived first as a learning experience for that community: not a textbook that explains permaculture from a distance, but a place where a young person can try relationships, watch seasons change, make a recoverable mistake and understand why a garden works as a system. Its longer-term purpose is to support schools, youth programmes, environmental organisations and other community projects that want to introduce ecology, systems thinking and fair sharing through play.

It is an independent project and is not affiliated with or endorsed by Erasmus+.

## What the player does

Players design a living garden rather than optimise isolated objects. They place soil, water, food and habitat elements; discover useful design connections; welcome wildlife; grow, harvest and preserve seasonal food; and contribute genuine surplus to a community sharing table.

- a seven-scene, first-person cinematic introduction narrated by the Garden of Menet;
- a guided first journey and a free-exploration mode;
- four seasons with crop windows, dormancy, preservation and ecological change;
- eleven replayable learning challenges without timers or punitive failure — a wrong answer gives a clue and invites another attempt;
- eight pairwise design connections and ten wildlife relationships with a visual relationship score; the game explicitly distinguishes a useful pair from a complete plant guild;
- a garden kitchen with four preservation methods, a village stall and a seed bank;
- a fair-share economy: community gifts build a shared fund and goodwill, but never convert into personal currency;
- earned reflections, a learning journal and an exportable garden certificate;
- an optional **Living Lesson** — an AI reflection that stays inside a deterministic learning contract (see below);
- nine interface languages, full Czech voice narration, English voice fallback elsewhere;
- desktop as the reference experience, with dedicated phone and tablet layouts in portrait and landscape, touch placement, keyboard navigation and reduced-motion support.

## The Living Lesson: AI that reflects instead of ruling

**The Garden Reflects — Living Lesson** puts a language model inside the learning loop instead of placing a chatbot next to the game:

1. The client derives a bounded, anonymous snapshot of the player's current garden.
2. `lib/living-lesson.js` generates two to four valid, *measurable* design experiments from that state.
3. `api/garden-reflection.js` sends the snapshot and the trusted candidates to the model through Vercel AI Gateway.
4. The model picks one candidate and expresses the current relationships as a first-person garden observation, a concise ecological explanation and one Socratic question — in the player's language.
5. The player accepts the experiment and changes the real garden.
6. The deterministic engine — not the model — checks the new state and records the evidence.

The model cannot invent an action, modify the economy, award points or decide whether its own experiment passed. Its output is structured, normalised and matched back to the server-generated candidate list. If live inference is unavailable, a reviewed deterministic lesson keeps the feature useful and is clearly labelled **Garden wisdom offline**.

**Privacy, safety and cost boundaries**

- No provider credential is shipped to the browser; production requests authenticate with Vercel's automatically supplied OIDC token.
- The model receives only element types, season, relationship metrics, bounded progression counts and a language code. Player name, free-text reflections and the save file never leave the browser.
- The endpoint rejects requests without a matching `Origin`, regenerates the candidates server-side and validates the structured response before returning it.
- Application code does not log prompts or player state; routing identifiers are hashed.
- Stable state fingerprints enable caching; the client allows three uncached requests per browser per day, and the function adds burst, client and global limits, a 12-second timeout and a 320-token output cap.
- If credit, authentication or the provider is unavailable, the endpoint returns a deterministic lesson without further model cost and without breaking the game.

## Localisation

The interface is fully localised in nine languages: English, Czech, German, French, Spanish, Brazilian Portuguese, Polish, Russian and Simplified Chinese. English is the source catalogue (`assets/i18n/catalog.en.json`, about 1,800 keys); every other catalogue must have the same structure, which `npm run check:i18n` enforces. Terminology decisions live in `assets/i18n/LOCALIZATION_GLOSSARY.md`.

The language follows the browser's preferred language when it is supported and falls back to English otherwise; the player can switch languages in the interface, and the choice is kept in the URL and in local storage. Czech has a complete voice layer (49 tracks); other languages use the English voice.

Translation corrections and new languages are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Architecture

The game is a local-first static site generated from a single editable source into a small loading shell and a prebuilt game fragment. One serverless function is the only server boundary.

| Path | Role |
| --- | --- |
| `Permaculture Garden v2.dc.html` | **The canonical source**: template, styles and the game logic class. Edit this, then run `npm run generate`. |
| `index.html`, `game.fragment.html` | Generated output — never edit by hand. |
| `scripts/build.mjs` | Builds the loading shell and the game fragment from the source. |
| `scripts/check.mjs`, `scripts/check-i18n.mjs` | Validate script syntax, local resource references, production invariants and catalogue completeness. |
| `lib/i18n.js` | Runtime localisation: locale detection, catalogue loading, formatting. |
| `lib/living-lesson.js` | The deterministic experiment engine shared by client and server. |
| `api/garden-reflection.js` | The protected Vercel Function and the model boundary. |
| `assets/` | Local WebP art, MP3 audio, fonts, icons, the ambient video and the i18n catalogues. |
| `vendor/` | Bundled React runtime and the Design Component runtime used by the static game. |
| `scripts/e2e-*.mjs` | Playwright browser journeys (see below). |
| `docs/` | Release handoffs, Build Week records and asset provenance. |

Player progress is stored locally in the browser. No account or external database is required.

## Install, build and test

Requirements: Node.js 22+ and npm (the API tests use `module.registerHooks`, available from Node 22.15).

```sh
npm ci
npm run generate   # rebuild index.html and game.fragment.html from the canonical source
npm test           # structural checks, i18n catalogue checks, Living Lesson engine and API tests
```

Serve the static build locally:

```sh
node scripts/static-server.mjs 8787
```

Then open <http://127.0.0.1:8787/>. The local server has no Vercel Function or OIDC identity, so the Living Lesson intentionally exercises its offline path.

### Browser regression journeys

The `test:e2e:*` scripts are Playwright journeys. Point `CODEX_NODE_MODULES` at a `node_modules` folder that contains Playwright and set `GAME_URL` to a running instance:

```sh
export CODEX_NODE_MODULES=/path/to/node_modules-with-playwright
export GAME_URL=http://127.0.0.1:8787/
npm run test:e2e:responsive     # 13 viewports from 320×568 to 1920×1080
npm run test:e2e:touch          # tap-to-place and tap-to-move
npm run test:e2e:playthrough    # a full guided playthrough
npm run test:e2e:i18n-layout    # 9 languages × viewports × main surfaces
npm run test:e2e:living-lesson  # reflection flow, caching, offline fallback
```

Coverage includes adaptive navigation, safe-area and overflow boundaries, 44-pixel touch targets, the 7:5 interactive plot, orientation-preserved state, all Garden Book chapters, all eleven challenges, the kitchen and seed bank, the fair-share economy invariants, snapshot sanitisation, stable fingerprints, response normalisation and outage fallback.

## Deployment

`main` deploys to the Vercel project behind <https://permaculture-garden.vercel.app/> with the **Other** framework preset, no custom build command and no `vercel.json`; Vercel installs locked dependencies from `package-lock.json`. The Living Lesson function needs an AI Gateway credential on the Vercel side only (`AI_GATEWAY_API_KEY`, or the platform OIDC token); nothing is required in the browser.

## Project history

- **Prototype (spring–July 2026)** — a single-file browser prototype with the core placement garden, seasons, guilds, wildlife and sharing.
- **OpenAI Build Week (13–19 July 2026)** — the prototype was rebuilt into a complete product with Codex as engineering collaborator: the eleven challenges, the cinematic introduction, the organic soundscape, hardened saving and progression, the Living Lesson architecture and the first automated journeys. The entry did not place; the submission text and provenance records are kept in [`docs/build-week/`](docs/build-week/).
- **Playtest line (v0.78–v0.82, late July 2026)** — nine full language versions, Czech narration, the garden kitchen and seed bank, a rebalanced economy, adjustable garden size, phone and tablet layouts, and a growing set of browser regression journeys. Release notes live in [`docs/handoffs/`](docs/handoffs/) and in [CHANGELOG.md](CHANGELOG.md).
- **Le Jardin under Usnea communitas (September 2026 →)** — the repository moved to the association's GitHub organisation, the name was unified to *Le Jardin*, the API boundary was hardened, accessibility contrast was improved and the project was opened as free software.

Planned: real playtesting with young people and facilitators connected to community gardening, facilitator tools, and a carefully designed shared mode for groups of 10–25 players where each person tends their own garden around a common Community Table.

## Contributing

Issues and pull requests are welcome — bug reports, translation fixes, accessibility findings, playtest observations and educational content ideas most of all. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first; it explains the canonical-source workflow (`npm run generate` after every change) and what we check before merging. This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Security concerns: see [SECURITY.md](SECURITY.md).

## License

- **Code** (HTML, JavaScript, CSS, build and test scripts): [MIT License](LICENSE), © 2026 Martin Pazderník.
- **Game media and texts** (artwork, audio, video, narrative and learning texts in `assets/` and in the source): [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International](LICENSE-ASSETS.md), © 2026 Martin Pazderník, with the attributions listed there.
- Bundled open-source dependencies and fonts keep their own licences; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [`licenses/`](licenses/).

## Acknowledgements

The garden in Menet and the young people who care for it; the Erasmus+ volunteers whose experience inspired the game; Robin Wall Kimmerer's *The Serviceberry* for the idea of a gift economy that shapes the sharing mechanics; and the open-source projects this game is built on.

OpenAI, GPT, Codex, Vercel, ElevenLabs, Kling, Picsart, Lovable and Erasmus+ are names or marks of their respective owners and are referenced only to describe tools or historical context.
