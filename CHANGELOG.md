# Changelog

Notable changes to Le Jardin. Version numbers follow the game's internal release counter (`package.json`). Detailed handoff notes for the playtest releases are in [`docs/handoffs/`](docs/handoffs/).

## Unreleased

- **Faster first start on phones.** While the opening story's cover is on screen, the garden behind it is not built: it is built 1.5 seconds into the story or when the story closes, so the cover appears sooner and pressing play answers at once. The raw template stays hidden until the runtime replaces it, so it is never laid out. On tall, narrow screens the story shows 600 × 900 crops of its paintings (1.1 MB instead of 2.7 MB for all seven), and the second picture loads at the first touch or key instead of during the first load.
- English pages no longer build the reverse translation index that only other languages use, and today's date is formatted once a day instead of on every render.
- The palette footer no longer carries a link, and the summary's credit reads simply *Le Jardin*.
- **Playtest kit** in [`docs/playtest/`](docs/playtest/), in English and Czech: a 60–90 minute session plan with the six acts to watch and discussion questions, an observation sheet, an anonymous paper questionnaire for players, a consent text that says exactly what the game stores and sends, and the steps for filing a *Playtest report* linked from issue #8.

## v0.84.0 — 2026-11-10 — every text in the player's language

Two improvement rounds, live since 25 October and 8 November 2026.

- **Every text in the player's language.** The page translator prefers specific templates over generic ones, fills in numbers and plurals ("12 tokens"), translates lists joined with "·" and emoji-decorated items piece by piece, also inside a sentence, and no longer hides untranslated text. Newly translated: the "Take · −12" label, the learned-practice line, cherries in the community memory, what a locked element needs ("🔒 Compost needs 1 token (you have 0) or €40 …"), the winter preview that counts young crops, who gave an offering and the seasons in planting lists. The language audit now looks at what the game really shows, including challenge boards, the Living Lesson, the community memory and the open design panel: 232 scenarios with no untranslated text in any of the eight other languages. The new catalogue texts were machine-translated and have not yet been checked by native speakers.
- **Lighter media.** The garden's background loop went from 2.5 MB to 463 kB (MP4 first), and with Save-Data or reduced motion only the still picture is used; a returning player no longer downloads a story picture they will not see; music and voice load only when played; phones up to 2× get 960 px garden backgrounds; the summer and winter gates are lossy WebP with a lossless alpha channel (248 → 123 kB and 255 → 93 kB).
- **One score.** A single `gardenScore()` with a unit test drives the ring, the card and the certificate; the score is called *Resilience* and explains itself. The certificate exists in all nine languages, with localized dates and plurals.
- **Honest labels.** The offline lesson is labelled "Garden wisdom offline", and the header reads "Le Jardin · Usnea communitas" instead of "Erasmus+ ecology project".
- **Phones and readability.** The story card is centred and scrolls, the phone header shows "Le Jardin", the guide's instruction appears once, the footer shows the version from `package.json`, toasts stay off the toolbar, long badges wrap, accessible names start with the visible text and touch targets are at least 24 px (axe: no violations).
- **Fixes.** Design connection names in the progress summary (no more "undefined undefined") and the icon on the rain challenge button.
- **Checks.** Playwright is a dev dependency with a shared loader, and CI runs the core browser journeys as a second job; after every production deployment a workflow checks that the live site serves exactly the deployed build and that the game plays.
- `.env.example`, Open Graph and Twitter meta tags and a web app manifest.

## v0.83.0 — 2026-10-24 — open-source release

- Repository published as free software: MIT licence for code, CC BY-NC-SA 4.0 for media and texts, contributing guide, code of conduct, security policy and issue templates.
- English README rewritten for the open-source project; internal handoff and Build Week documents moved to `docs/`.
- Git history unified: the OpenAI Build Week line (July 2026) now precedes the playtest line in this repository.
- GitHub Actions CI (generate check + tests on Node 22); screenshots in the README; Node 22 documented as the requirement.

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
