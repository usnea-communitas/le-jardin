# Product

<!-- impeccable:product-schema 1 -->

> Prepared from what Martin said about the project and from `README.md` and `docs/handoffs/CONTEXT_FOR_CODEX.md`. Review and correct anything that does not fit.

## Platform

web

## Users

- Players who play on their own, and groups in workshops.
- Founding community: participants of an Erasmus+ permaculture-garden project in Menet (France) — small international groups of about 10–25 people who are also building the garden physically.
- Later: schools, youth programmes, environmental and other community organisations.

## Product Purpose

A story-led educational browser game about a permaculture garden in Menet. The player builds a living garden out of relationships between elements, moves through the seasons and learns why community sharing is one of the pillars of permaculture.

## Positioning

The AI reflection ("Living Lesson") is part of the learning loop, not a chatbot beside the game: the model only names relationships and asks a question. Rules, points and the outcome of an experiment are always decided by the deterministic engine.

## Operating Context

- The reference experience is the desktop; phones and tablets are designed and tested in portrait and landscape.
- Free, no account, saved in the browser.
- Languages: en, cs, de, fr, es, pt-BR, pl, ru, zh-CN (`lib/i18n.js`).

## Capabilities and Constraints

- Six-act learning progression, deterministic scoring; the AI reflection never changes the game rules.
- Gift economy: community gifts never turn into personal currency.
- Challenges without timers and without punishing failure.
- The canonical source is `Permaculture Garden v2.dc.html`; `index.html` and `game.fragment.html` are generated (`npm run generate`) and must not be edited by hand.
- The OpenAI Build Week competition repository, deployment and Devpost entry are frozen historical records and must not be the target of any change.
- Multiplayer (each player's own garden plus a shared Community Table) is planned; design and implementation are deferred.
- Privacy: the model receives only an anonymous summary of the garden — never the player's name, free text or saved game. Without a reachable model the game offers an offline lesson.

## Brand Commitments

- Name: "Le Jardin" (formerly "Permaculture Garden — Le Jardin"); the narrator is the Garden of Menet.
- The project is not affiliated with or endorsed by the Erasmus+ programme and must not appear to be.
- Asset provenance: `docs/ASSET_PROVENANCE.md`; third-party licences: `THIRD_PARTY_NOTICES.md`; media licence: `LICENSE-ASSETS.md`.

## Evidence on Hand

- Playtest and regression tests (`npm test`, `test:e2e:*`), handoff records in `docs/handoffs/`.
- The game did not place in OpenAI Build Week; claim no award.
- No player quotes or statistics exist; do not invent them.

## Product Principles

1. Teach relationships, not the optimisation of single objects.
2. Sharing before currency.
3. The AI explains and asks; it never decides.
4. Kind learning: a mistake is an attempt, not a defeat.
