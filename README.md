# Permaculture Garden — Le Jardin

**A story-led educational game where every placement becomes a relationship, every season changes the lesson, and GPT‑5.6 Luna helps the garden reflect on what the player has actually built.**

[Play the current v79 playtest](https://permaculture-garden-playtest.vercel.app/)

This is the separate post-submission playtest line. The OpenAI Build Week repository,
deployment and Devpost entry remain frozen at the submitted version; see
[`COMPETITION_FREEZE.md`](COMPETITION_FREEZE.md).
The complete Claude-handoff reconciliation and v79 verification record is in
[`HANDOFF-AUDIT-v79.md`](HANDOFF-AUDIT-v79.md).

## Why this garden exists

The game is inspired by a real permaculture garden in the small French village of Menet. The creator's partner joined an Erasmus+ volunteering programme there and helped a group of young people care for the garden, learn together and move the project forward.

Permaculture Garden was conceived first as a learning experience for that community. Its longer-term purpose is to support schools, youth programmes, environmental organisations and other community projects that want to introduce ecology, systems thinking and fair sharing through play. It is an independent project and is not affiliated with or endorsed by Erasmus+.

## What the player does

Players design a living garden rather than optimise isolated objects. They place soil, water, food and habitat elements; discover useful design connections; welcome wildlife; grow and preserve seasonal harvests; and contribute genuine surplus to a community sharing table. Eleven educational season challenges turn permaculture ideas into decisions with immediate explanatory feedback.

The experience includes:

- a seven-scene, first-person cinematic introduction narrated by the Garden of Menet;
- a guided first journey and a free-exploration mode;
- four seasons with crop windows, dormancy, preservation and ecological change;
- eleven replayable learning challenges without timers or punitive failure;
- eight pairwise design connections, ten wildlife relationships and a visual relationship score; the game explicitly distinguishes a useful pair from a complete plant guild;
- a fair-share economy in which community gifts never become personal currency;
- earned reflections, a learning journal and an exportable garden certificate;
- an optional **Living Lesson** powered by GPT‑5.6 Luna.

Desktop remains the reference experience, while the same garden is now designed and tested for phones and tablets in both portrait and landscape orientations. It is free to play and needs no account.

## Two-minute judge path

1. Open the [v79 playtest](https://permaculture-garden-playtest.vercel.app/).
2. Choose **Explore freely** during onboarding.
3. Add at least two elements, for example **Compost** and **Rain harvesting**.
4. In **Design connections**, select **Listen to your garden · GPT‑5.6 Luna**.
5. Read the observation, relationship explanation and Socratic question.
6. Choose **Try this experiment**, then make the proposed change on the plot.
7. Reopen the reflection: the deterministic engine measures the new state and records evidence if the experiment succeeded.

For the fuller learning journey, follow the guided path through soil, water, food, habitat, sharing, a design connection and a harvest, then advance through the seasons.

## Meaningful GPT‑5.6 integration

**The Garden Reflects — Living Lesson** makes GPT‑5.6 Luna part of the learning loop rather than placing a generic chatbot beside the game:

1. The client derives a bounded, anonymous snapshot from the player's current garden.
2. `lib/living-lesson.js` creates two to four valid, measurable design experiments from that state.
3. `api/garden-reflection.js` sends the snapshot and trusted candidates to `openai/gpt-5.6-luna` through Vercel AI Gateway.
4. GPT‑5.6 selects one candidate and expresses the current relationships as a first-person garden observation, a concise ecological explanation and one Socratic question.
5. The player accepts the experiment and changes the real garden.
6. The deterministic engine—not the model—checks the new state and records the evidence.

GPT‑5.6 cannot invent an action, modify the economy, award points or decide whether its own experiment passed. Model output is structured, normalised and matched back to the server-generated candidate list. A reviewed deterministic lesson keeps the feature useful and clearly labels it **Garden wisdom offline** if live inference is unavailable.

### Privacy, safety and cost boundaries

- No provider credential is shipped to the browser. Production requests authenticate with Vercel's automatically supplied OIDC token.
- The model receives only garden element types, season, relationship metrics and explanations, and bounded progression counts. Player name, free-text reflections and the save file are excluded.
- The server regenerates candidates and validates the structured response before returning it.
- Application code does not log prompts or player state. Routing identifiers are hashed.
- Stable state fingerprints enable caching. The client allows three uncached requests per browser per day, while the function adds burst, client and global limits, a 12-second timeout and a 320-token output cap.
- If credit, authentication or the provider is unavailable, the endpoint returns a deterministic lesson without further model cost and without breaking the game.

## How Codex shaped the project

Codex was the primary engineering collaborator throughout OpenAI Build Week. The creator supplied the educational intent, lived context, taste and product decisions; Codex helped turn those decisions into a reliable product:

- audited the existing prototype from game-design, art-direction, player and accessibility perspectives;
- redesigned the eleven minigames around learning, retry and explanatory feedback;
- implemented the cinematic onboarding, organic audio system, garden voice and unified visual language;
- hardened saving, resets, modal queues, season transitions, reduced-motion behaviour and keyboard semantics;
- rebuilt progression, sharing, winter crop logic, reflections and the final certificate around observable player actions;
- designed the bounded Living Lesson architecture and its safety, privacy, cost and outage behaviour;
- wrote deterministic unit/API tests and full-browser regression journeys;
- repeatedly verified local builds and the deployed Vercel experience before release.

Important human decisions included keeping money secondary to sharing, refusing to convert gifts directly into personal reward, making educational mistakes recoverable, giving GPT‑5.6 a reflective rather than authoritative role, and preserving the Garden of Menet as a poetic first-person narrator.

## OpenAI Build Week provenance

This project existed before the Submission Period. The last pre-period commit is [`ceec978`](https://github.com/martinpazdernik-source/Permaculture-Garden-new/commit/ceec9780de07829620d8ce2fce50e09de8bcf30d), committed at **07:58 PDT on 13 July 2026**, two minutes before the official 09:00 PDT start. That baseline was a deployable single-file prototype containing the core placement garden, seasons, guilds, wildlife, sharing and basic onboarding/minigames.

Only work added after the official start is presented for Build Week judging. From the baseline to v75, the dated Git history records **214 changed files, 17,871 insertions and 225 deletions**, including:

- recoverable source, a reproducible build pipeline and local vendoring;
- repaired game flow, accessibility and loading resilience;
- complete redesign of all eleven educational challenges;
- the seven-scene story introduction and a fully regenerated organic soundscape;
- one coherent onboarding/game visual system, cinematic season passages and a living garden voice;
- hardened state recovery, event queues, progression and fair-share economy;
- earned reflection vignettes, lasting learning evidence and payment-choice improvements;
- extensive automated journey, resilience, accessibility, economy and visual regression coverage;
- the v74 Living Lesson, the v75 production move to GPT‑5.6 Luna and v76 submission documentation/media attribution.

The chronological evidence begins with commit `1e8b215` after the start and continues through the current `main` history. [`BUILD_WEEK.md`](BUILD_WEEK.md) contains the compact submission handoff and exact judge path.

## Architecture

The editable source is `Permaculture Garden v2.dc.html`. Do not edit generated `index.html` or `game.fragment.html` by hand.

- `scripts/build.mjs` creates a small instant loading shell and the generated game fragment.
- `scripts/check.mjs` validates logic syntax, local resources and production invariants.
- `lib/living-lesson.js` is the shared deterministic experiment engine.
- `api/garden-reflection.js` is the protected Vercel Function and GPT‑5.6 boundary.
- `assets/` contains local WebP art, MP3 audio, fonts, icons and the background video.
- `vendor/` contains the local React and Design Component runtime used by the static game.

Player progress is stored locally in the browser. No account or external database is required.

## Install, build and test

Requirements: Node.js 20+ and npm.

```powershell
npm ci
npm run generate
npm test
```

To serve the static build locally:

```powershell
node scripts/static-server.mjs 8787
```

Then open `http://127.0.0.1:8787/`. The local static server has no Vercel Function or OIDC identity, so the Living Lesson intentionally exercises its offline path.

Optional browser verification, with Playwright available through `CODEX_NODE_MODULES`:

```powershell
$env:CODEX_NODE_MODULES="C:\path\to\playwright\node_modules"
npm run test:e2e:living-lesson

$env:GAME_URL="http://127.0.0.1:8787/"
npm run test:e2e:responsive
npm run test:e2e:touch
npm run test:e2e:mobile-book
npm run test:e2e:resident-state

$env:GAME_URL="https://permaculture-garden-playtest.vercel.app/"
$env:LIVING_LESSON_LIVE_API="1"
$env:EXPECTED_LESSON_MODE="ai"
node scripts/e2e-living-lesson.mjs
```

Responsive browser coverage spans 13 representative viewports from 320×568 to 1920×1080. It verifies adaptive navigation, safe-area and overflow boundaries, 44-pixel touch targets, the exact 7:5 interactive plot on adaptive layouts, tap-to-place and tap-to-move behaviour, orientation-preserved state, all six Garden Book chapters and all eleven learning challenges.

The broader automated coverage includes snapshot sanitisation, stable fingerprints, trusted candidate generation, response normalisation, deterministic completion metrics, method/input/origin boundaries, cache reuse, UI unlock, model/source labels, economy invariance, experiment persistence, resident-story scheduling and outage fallback.

## Deployment

This repository's `main` branch is connected only to the separate
`permaculture-garden-playtest` Vercel project. A push runs the playtest deployment for
the static game and `api/garden-reflection.js`; Vercel installs locked dependencies from
`package-lock.json`. The project uses the **Other** framework preset with no custom build
command and intentionally has no `vercel.json`.

The frozen Build Week repository and its Vercel project are deliberately not used by
this release line.

## Rights and acknowledgements

The entrant directed and assembled the game's original design, writing, code and generated media. Visual and audio generations were produced through the entrant's own tool accounts and then edited and integrated specifically for this project. Open-source runtime dependencies retain their own licences. Detailed provenance and the pre-submission rights check are recorded in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
