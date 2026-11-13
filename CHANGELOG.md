# Changelog

Notable changes to Le Jardin. Version numbers follow the game's internal release counter (`package.json`). Detailed handoff notes for the playtest releases are in [`docs/handoffs/`](docs/handoffs/).

## Unreleased

- **A second reading of the eight translations** (package S-19). Every language was compared with the English source and the glossary: the names of the game's own things, the informal address, the placeholders and the length. Seven clear mistakes were corrected: in Spanish the rain challenge called the overflowing water *rebosadero*, the overflow outlet (four texts); in Russian one quiz question addressed the player formally; in Polish two texts named the seasonal turn differently from the binding glossary. Twenty-one places a native speaker should decide, among them what the six acts are called in German, Spanish, Portuguese, Polish, Russian and Chinese, are now the first rows of each review sheet in [`docs/translations/`](docs/translations/), with what was changed; [`notes.json`](docs/translations/notes.json) records both.
- **The journeys in the engines of Safari and Firefox** (package S-17). The core browser journeys also run in WebKit and Firefox, in a second workflow beside CI (`npm run test:e2e:webkit`, `npm run test:e2e:firefox`). They found that a returning player's garden was asked to be kept only after a change (now also when a stored garden opens) and that, without a connection, sound left out of the download failed loudly in Safari (the service worker now answers it quietly). What each engine leaves out, and why, is in [`docs/BROWSERS.md`](docs/BROWSERS.md).
- The partly ticked rights checklist of the Build Week submission moved from `THIRD_PARTY_NOTICES.md` to the Build Week records, [`docs/build-week/RIGHTS_CHECK.md`](docs/build-week/RIGHTS_CHECK.md), unchanged: it describes that submission, not the game now (package J-08a).
- **A way in for groups** (package J-13). Workshop mode was visible only to someone who came with the `?workshop=1` link. The opening story's cover and *How to play* now end with a quiet line, *Playing with a group?*: workshop mode lets a group begin at any act and keeps its garden apart from anyone's own game, with links to workshop mode and to the facilitator guide in English, Czech or French (the player's language where there is one). It fits a 360 px phone, the keyboard reaches it, and the workshop journey tests it in English and Czech. The texts in the eight other languages were translated by Claude and await a native speaker's review.
- **A media budget** (package J-14, issue #6). [`docs/MEDIA-BUDGET.md`](docs/MEDIA-BUDGET.md) sets what a first visit may download (700 KiB on a phone, now 655; 900 KiB on a desktop, now 837) and how large the story's paintings, the Garden's voice per language, the music, the game sounds, the other pictures, the fonts and each language's texts may grow. `npm test` stops the build when a line is exceeded, and the resilience journey checks that a browser fetches exactly the files the budget names on a first visit. The four season gates are drawn at most 175 px wide, so they are now 352 px wide and weigh 20–34 kB instead of 93–133 kB, with no visible difference.
- **Your garden in a file, and a garden that does not disappear** (package J-11). The garden lives only in the browser's storage, so clearing the browser or changing devices lost it. *Garden file* (in the header; on a phone, in the ••• menu) saves the garden as a JSON file and loads it back; a damaged file, another app's file or one from a newer version is refused before anything changes, and loading over a garden in progress asks first. In workshop mode the file carries the group's garden, so a facilitator can bring a group back after *Prepare for the next group*; anyone's own game on the device stays byte for byte the same. With a garden on the device, the game asks the browser to keep its storage (not in Firefox, where that shows a prompt, and never in a workshop). A save the browser refuses is no longer a four-second note: a message stays until it is closed and offers the garden file, which carries the garden on screen. When another tab saves the same garden, this tab stops saving, says so and loads the newer garden on request. *How to play* says where the garden lives. The new texts in the eight other languages were translated by Claude and await a native speaker's review. `npm run test:e2e:garden-file` and the extended `test:e2e:resilience` (a full browser, two tabs) now run in CI.
- **The Living Lesson fails safely, and the tests show it** (package J-09a). The API test now simulates the AI Gateway running out of credit, a provider limit, a refused token, a server error, a timeout and a lost connection: each ends in the reviewed offline lesson with an honest reason, none passes the provider's message to the browser, none is cached, and the next request after the outage gets a model lesson again. The function's own limit (the seventh request in a minute from one address) is tested too. Challenge and guild entries in the snapshot now pass only as identifiers, so free text sent in their place never reaches the model's prompt. The README says what players see when the credit runs out.
- **The rules of the game are in `lib/`, with unit tests** (package J-07). The game's economy (prices, reclaimed materials, how a placement is paid, milestones, fair-share gifts that never pay the giver), the community table (when neighbours leave offers, which, and what taking one costs the shared pool), planting and harvest windows with growth through the seasons and winter, the six acts with what opens when, and the wild neighbours (who lives here, arrivals, visits, the residents' stories and the pests) moved from the game file into five modules: `lib/economy.js`, `lib/community-table.js`, `lib/seasons.js`, `lib/acts.js` and `lib/wildlife.js`. The game keeps every word, picture and sound and asks them. `npm test` runs their unit tests and checks that the rules and the words stay in step. Nothing changes for players. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) explains how the game runs and how to change a rule.
- **Playing without a connection** (package J-05). *Play without a connection* (the arrow in the header; on a phone, in the ••• menu) shows the size first and downloads the game to the device: its pictures and sounds, English and the chosen language, and the Garden's voice and the music if the player keeps them (about 20 MB, 29 MB with the voice, 35 MB with music too). Afterwards the game, the workshop link included, opens and plays without a connection; other languages and the moving pictures still need one, and the game shows still pictures instead. The panel can remove the download again; the garden stays in the browser's storage and nothing is sent anywhere. A service worker (`sw.js`) is registered only after a download and answers from the download made for its own build, so a page never mixes two versions; a newer build downloads in the background (unchanged files are copied, not fetched again) and starts the next time the game opens, with the garden in progress intact. `offline-manifest.json` is generated with every file's size and hash, and the production check makes sure every file on it is served.
- The facilitator guide and the playtest kit say how to prepare devices for a place with a weak signal.
- **The Garden speaks French** (package J-06). French players hear the Garden in French from the opening story to the end of the garden: 49 new recordings (the seven story scenes and the Garden's 42 lines), with English as the fallback for a recording that cannot load; the "audio in English" note no longer shows in French. The original English and Czech voice is not available in the ElevenLabs account used now, so the closest library voice was chosen by measuring it against the original recordings (Corinne; how, in `docs/ASSET_PROVENANCE.md`). The French subtitles now say exactly what the voice says, also in the story, and two lines were rewritten for speaking. The offline download carries the French voice for French. A first visit fetches no recording, so its size is unchanged. A listening checklist for a native French speaker is in `docs/translations/french-voice-review.md`.
- **The subtitles match the voice, and the checks see it.** `npm test` now checks every recorded language (Czech and French): no recording is missing, each sits where the game looks for it, each is a mono 44.1 kHz MP3 with a length header and the listed length, and the catalogue shows exactly what the voice says. This found two Czech recordings without a length header (now added, the audio unchanged) and three Czech subtitles that differed from the Czech voice (now corrected). A new browser journey (`npm run test:e2e:voice`, part of CI) plays the story and the garden in French and Czech, checks the English fallback and the note in German, and makes sure a first visit fetches no recording. The review sheets in `docs/translations/` are current again (they lacked the texts of playing without a connection) and a test keeps them so.

## v0.85.0 — 2026-11-12 — workshop mode and a facilitator guide

Live since 10–12 November 2026: the game can be played with groups, a facilitator has a guide in three languages, and phones start faster.

- **Workshop mode for groups** (`?workshop=1`, issue #7). The workshop garden is saved apart from anyone's own game on the device. The opening card asks where the group begins: with the opening story or at any of the six acts (`&act=3` preselects one); a later act starts with the earlier ones done using plain elements placed far apart, so every design connection is still the group's to find. The Living Lesson answers only from the reviewed offline lessons — no model call, no cost, the same lesson for every group. *Workshop* replaces *Reset* in the header and opens a panel for the facilitator: where the group is and a question to ask, the six acts with their learning goals, a session log that stays on the device (saved as a text file or printed on its own), the facilitator guide and *Prepare for the next group*, which clears only the workshop garden and its log after a confirmation.
- **Facilitator guide** in English, Czech and French in [`docs/facilitator/`](docs/facilitator/), with PDFs: how the game teaches, workshop mode and preparation, the goal, questions, common misconceptions and a tip for each act, the task, solution and explanation of all eleven challenges (generated from the game's catalogues, so it always matches the screen), questions for the closing conversation and plans for 45, 90 and 120 minutes, with QR codes of the workshop links.
- **Playtest kit** in [`docs/playtest/`](docs/playtest/), in English and Czech: a 60–90 minute session plan with the six acts to watch and discussion questions, an observation sheet, an anonymous paper questionnaire for players, a consent text that says exactly what the game stores and sends, and the steps for filing a *Playtest report* linked from issue #8.
- **Faster first start on phones.** While the opening story's cover is on screen, the garden behind it is not built: it is built 1.5 seconds into the story or when the story closes, so the cover appears sooner and pressing play answers at once. The raw template stays hidden until the runtime replaces it, so it is never laid out. On tall, narrow screens the story shows 600 × 900 crops of its paintings (1.1 MB instead of 2.7 MB for all seven), and the second picture loads at the first touch or key instead of during the first load.
- **The header fits laptop windows in every language.** In German, French, Spanish, Polish and Russian the desktop header was wider than windows of 1180–1440 px: the last button left the screen and the game's name was cut. The header now measures itself; when it does not fit, its tools show only their icons, and if that is still not enough, the community progress and the audio note step aside.
- **Security headers and caching.** `vercel.json` sends `X-Content-Type-Options`, a referrer policy, frame protection, a permissions policy and a content security policy for frames, plugins and base addresses; fonts are cached for a year and pictures, sound and video for a day. A 1200 × 630 JPEG share preview, a canonical address, `robots.txt` and `sitemap.xml`. A return visit downloads about 3 kB.
- **A review kit for native speakers.** `npm run translations:export` writes a CSV and a Markdown sheet per language to [`docs/translations/`](docs/translations/), and the import refuses a row whose `{placeholders}` changed; good-first issues #17–#24 invite a reviewer for each language.
- French names the six acts consistently as *actes* (the first two were *gestes*), and the mushroom names in German, French, Polish and Chinese show their Latin names in brackets instead of between stray asterisks.
- English pages no longer build the reverse translation index that only other languages use, and today's date is formatted once a day instead of on every render.
- The palette footer no longer carries a link, and the summary's credit reads simply *Le Jardin*.
- Dependabot proposes dependency and workflow updates once a month.
- The new interface texts were translated by Claude into the eight other languages and have not yet been checked by native speakers.

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
