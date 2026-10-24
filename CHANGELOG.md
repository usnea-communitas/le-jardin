# Changelog

Notable changes to Le Jardin. Version numbers follow the game's internal release counter (`package.json`). Detailed handoff notes for the playtest releases are in [`docs/handoffs/`](docs/handoffs/).

## Unreleased — open-source release (October 2026)

- Repository published as free software: MIT licence for code, CC BY-NC-SA 4.0 for media and texts, contributing guide, code of conduct, security policy and issue templates.
- English README rewritten for the open-source project; internal handoff and Build Week documents moved to `docs/`.
- Git history unified: the OpenAI Build Week line (July 2026) now precedes the playtest line in this repository.

## 2026-10-08 — accessibility contrast

- Muted brown body text and map labels darkened to reach 4.7–5.0:1 contrast on the cream surfaces; "Begin the story" button and story kicker recoloured for readable contrast.

## 2026-10-06 — design tooling

- Impeccable design skill and review hook added for Claude Code and Codex; `PRODUCT.md` describes the game for automated design review.

## 2026-09-23 — one name, one instruction, hardened API

- Game name unified to *Le Jardin* across header, loading screen, title and all nine catalogues.
- Element cards translate the whole material/exchange sentence; a single instruction at the start instead of overlapping hints; toasts moved below the header; prices and tokens shown under element names.
- Tablet layout: wider plot, portrait plot across the full width; one sentence explains engagement tokens and the fund in all languages.
- `api/garden-reflection.js` rejects requests without an `Origin` header; test added.
- Repository moved to the Usnea communitas GitHub organisation.

## v0.82.0 — 2026-07-29 (deployed 2026-09-23)

- Fresh cherry harvests can be sold at the village stall (€15 each) so the garden kitchen (€120) is reachable without blocking the fair-share path; sales are tracked separately from gifts and never feed goodwill or the shared fund.
- Harvestable cherries get a golden aura, slow pulse, 50 px hit area and visible keyboard focus; static under reduced motion.
- Desktop *Garden view* control: Balanced / Large / Focus presets plus separate width and height sliders; a true plot-only Focus mode that never locks the player out.
- Eleven new keys added to all nine catalogues (1,772 source keys).

## v0.81.0 — July 2026

- Nine complete language versions: English, Czech, German, French, Spanish, Brazilian Portuguese, Polish, Russian and Simplified Chinese; language stored in URL and local storage; Living Lesson answers in the chosen language.
- Full Czech voice layer: 7 story chapters and 42 garden voices (49 tracks); English voices for the eleven challenge intros.
- Fixed gate artwork, removed the decorative path; rebalanced economy with a village stall for finished preserves (€25); optional garden size on desktop; calmer guided UX; expanded test infrastructure (kitchen, seed bank, long click-through).

## v0.79 – v0.80 — July 2026

- Handoff audit and verification of the playtest deployment; stabilised production Living Lesson verification and Vercel deployment identity; repository line endings normalised; localized playtest experience polished; cherry economy and garden sizing improved; multilingual Living Lesson localisation completed.

## v0.78 — 2026-07-28

- Separate post-submission playtest line created; Picsart-generated crop thumbnails and winter gate processed into web-ready assets (`docs/ASSET_PROVENANCE.md`); playtest deployment documented and hardened.

## v0.76 — 2026-07-19 (OpenAI Build Week submission)

- Build Week submission prepared: Living Lesson moved to production GPT model through Vercel AI Gateway with OIDC credentials, verified on production; submission documentation and media attribution (`docs/build-week/`).

## v0.70 – v0.75 — 17–19 July 2026

- GPT-powered Living Lesson added: deterministic experiment candidates, structured model output, server-side validation, offline fallback.
- Progression and visual polish; reflections and payment-choice improvements; unified garden workspace; cinematic background loop; living garden voice; hardened saving, resets, modal queues and season transitions.

## v0.60 – v0.69 — 13–16 July 2026

- Game flow, accessibility and loading fixed after a full audit; all eleven challenges redesigned around learning, retry and explanatory feedback.
- Seven-scene cinematic story introduction; organic soundscape replacing the original audio; onboarding and game visuals unified; warm beige background restored; production UI smoke test.

## Prototype — 5–13 July 2026

- Single-file browser prototype with the core placement garden, seasons, guilds, wildlife and community sharing, deployed as a static site; image assets optimised.
