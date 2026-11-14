# Third-party notices and asset provenance

This file records the third-party software bundled with Le Jardin and the provenance of the game's generated media. It was first compiled for the OpenAI Build Week submission (July 2026) and is kept current for the open-source release; the licence that applies to the media themselves is in [LICENSE-ASSETS.md](LICENSE-ASSETS.md) and the code licence in [LICENSE](LICENSE). It is a provenance log, not legal advice. The author retains invoices, subscription records and original exports privately; secrets and receipts are never committed.

## Project-created media

| Material | Creation route | Project use | Evidence to retain privately | Status |
| --- | --- | --- | --- | --- |
| Seven onboarding paintings | AI-assisted image generation directed and selected for this project, then edited and optimised locally | `assets/story/` | Original generations and account/export history | Account terms confirmed before the Build Week submission; retain private record |
| Menet ambient background loop | Generated in Kling under the entrant's account and locally edited/optimised | `assets/video/garden-ambient-loop.*` | Kling generation/export record and plan terms applying on export date | Text attribution added to the always-available onboarding/help panel; retain private record |
| Garden voice, narration, music and sound effects (English and Czech) | Generated through the entrant's paid ElevenLabs account; final Garden of Menet voice is Voice 1 | `assets/audio/` | Subscription invoices and generation history | Paid-plan commercial licence documented; retain private record |
| Garden voice in French | Generated in November 2026 through a paid ElevenLabs account (Pro plan) with the ElevenLabs library voice Corinne, the closest available to the Garden of Menet voice; how it was chosen is in [`docs/ASSET_PROVENANCE.md`](docs/ASSET_PROVENANCE.md) | `assets/audio/story/fr/`, `assets/audio/garden-voice/fr/` | Subscription invoices and generation history (the generation IDs are listed in `assets/i18n/audio.fr.json`) | Paid-plan commercial licence, as for the other ElevenLabs audio; retain private record |
| Visual concepts and supporting generated art | Picsart and Lovable explorations directed by the entrant; selected ideas were reimplemented and integrated for this game | game UI and selected `assets/` | Project histories/exports and plan terms applying on creation dates | Official ownership/commercial-use guidance documented; retain private record |
| Reflection vignettes and garden artwork | Generated or edited specifically for this project under the entrant's direction | `assets/reflections/`, garden sprites and seasonal passages | Original source sheets and generation history | Account terms confirmed before the Build Week submission; retain private record |

Do not place account receipts, API keys, personal billing data or private generation URLs in this repository.

## Open-source software and fonts

The project bundles or installs the following third-party software. Each component remains under its own licence:

- React and ReactDOM — MIT License, bundled production builds in `vendor/`; licence text in `licenses/REACT_MIT.txt`.
- Vercel AI SDK (`ai`) and its Anthropic provider (`@ai-sdk/anthropic`) — Apache-2.0, installed from the locked npm dependency graph.
- Zod — MIT License, installed from the locked npm dependency graph.
- Hanken Grotesk — SIL Open Font License 1.1; copyright and licence text in `licenses/HANKEN_GROTESK_OFL.txt`.
- Bricolage Grotesque — SIL Open Font License 1.1; copyright and licence text in `licenses/BRICOLAGE_GROTESQUE_OFL.txt`.

The first version of the canonical source, `Permaculture Garden v2.dc.html`, was designed on the design canvas of the Claude app by Anthropic (claude.ai) and exported from it; everything since has been built on it in this repository with Claude Code and Codex, and the source keeps the canvas's template language. Up to v0.89.0 the game also shipped the canvas runtime that came with that export (13 July 2026), the Design Component runtime in `vendor/dc-runtime.js`, byte for byte as exported. The game now has a runtime of its own, written for it in this repository (`lib/runtime.js`, with `scripts/template-compiler.mjs`, which reads the template at build time), and ships no part of the canvas's runtime. The game's own code is the canonical source, `lib/`, `api/` and the build. Anthropic's terms for Claude ([consumer terms](https://www.anthropic.com/legal/consumer-terms), [commercial terms](https://www.anthropic.com/legal/commercial-terms)) assign to the user Anthropic's rights, if any, in outputs, and grant no rights in Anthropic's services themselves. The author keeps the Claude account record of the canvas project that the export came from.

## Official tool guidance checked on 19 July 2026

- [ElevenLabs publishing guidance](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform) states that paid plans include a commercial licence, provided the output is not from a Beta Service. The project used a paid Starter account; the entrant should retain its invoice and generation history.
- [Kling AI Terms of Service](https://kling.ai/docs/user-policy) state that Kling does not claim ownership of user Content under applicable law and require Kling attribution when an output is used without an embedded brand mark. The project therefore provides a plain-text credit in its onboarding/help panel instead of modifying the artwork with a watermark.
- [Picsart commercial-use guidance](https://support.picsart.com/hc/en-us/articles/9814385860381-Are-images-generated-through-AI-available-for-commercial-use) makes generative outputs available for commercial purposes while warning that third-party rights and copyrightability are not guaranteed.
- [Lovable Product Terms](https://lovable.dev/product-terms) state that the customer owns applications and AI output generated for the customer, subject to third-party rights.

## Names and trademarks

- Anthropic, Claude, OpenAI, GPT, Codex, Vercel, ElevenLabs, Kling, Picsart, Lovable and Erasmus+ are names or marks of their respective owners.
- They are referenced only to describe tools or the real historical context. No endorsement is claimed.
- The demo video shows no third-party logos except where unavoidable for a factual explanation, and contains only project-owned or properly licensed music, imagery and voice work.

## Rights check of the Build Week submission

The checklist confirmed for the OpenAI Build Week submission (July 2026), partly ticked, is kept as a historical record in [`docs/build-week/RIGHTS_CHECK.md`](docs/build-week/RIGHTS_CHECK.md). It describes that submission, not the game as it is now.
