# Third-party notices and asset provenance

This file records the sources that must be checked before the OpenAI Build Week submission. It is a provenance log, not legal advice. The entrant should retain invoices, subscription records and original exports privately; secrets and receipts must not be committed.

## Project-created media

| Material | Creation route | Project use | Evidence to retain privately | Status |
| --- | --- | --- | --- | --- |
| Seven onboarding paintings | AI-assisted image generation directed and selected for this project, then edited and optimised locally | `assets/story/` | Original generations and account/export history | Confirm account terms before Submit |
| Menet ambient background loop | Generated in Kling under the entrant's account and locally edited/optimised | `assets/video/garden-ambient-loop.*` | Kling generation/export record and plan terms applying on export date | Text attribution added to the always-available onboarding/help panel; retain private record |
| Garden voice, narration, music and sound effects | Generated through the entrant's paid ElevenLabs Starter account; final Garden of Menet voice is Voice 1 | `assets/audio/` | Starter subscription invoice and generation history | Paid-plan commercial licence documented; retain private record |
| Visual concepts and supporting generated art | Picsart and Lovable explorations directed by the entrant; selected ideas were reimplemented and integrated for this game | game UI and selected `assets/` | Project histories/exports and plan terms applying on creation dates | Official ownership/commercial-use guidance documented; retain private record |
| Reflection vignettes and garden artwork | Generated or edited specifically for this project under the entrant's direction | `assets/reflections/`, garden sprites and seasonal passages | Original source sheets and generation history | Confirm account terms before Submit |

Do not place account receipts, API keys, personal billing data or private generation URLs in this repository.

## Open-source software and fonts

The project bundles or installs the following third-party software. Each component remains under its own licence:

- React and ReactDOM — MIT License, bundled production builds in `vendor/`; licence text in `licenses/REACT_MIT.txt`.
- Vercel AI SDK (`ai`) — Apache-2.0, installed from the locked npm dependency graph.
- Zod — MIT License, installed from the locked npm dependency graph.
- Hanken Grotesk — SIL Open Font License 1.1; copyright and licence text in `licenses/HANKEN_GROTESK_OFL.txt`.
- Bricolage Grotesque — SIL Open Font License 1.1; copyright and licence text in `licenses/BRICOLAGE_GROTESQUE_OFL.txt`.

The local Design Component runtime in `vendor/dc-runtime.js` is part of the project's exported application toolchain. The entrant should retain the source-tool account/project record that authorised its export and use.

## Official tool guidance checked on 19 July 2026

- [ElevenLabs publishing guidance](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform) states that paid plans include a commercial licence, provided the output is not from a Beta Service. The project used a paid Starter account; the entrant should retain its invoice and generation history.
- [Kling AI Terms of Service](https://kling.ai/docs/user-policy) state that Kling does not claim ownership of user Content under applicable law and require Kling attribution when an output is used without an embedded brand mark. The project therefore provides a plain-text credit in its onboarding/help panel instead of modifying the artwork with a watermark.
- [Picsart commercial-use guidance](https://support.picsart.com/hc/en-us/articles/9814385860381-Are-images-generated-through-AI-available-for-commercial-use) makes generative outputs available for commercial purposes while warning that third-party rights and copyrightability are not guaranteed.
- [Lovable Product Terms](https://lovable.dev/product-terms) state that the customer owns applications and AI output generated for the customer, subject to third-party rights.

## Names and trademarks

- OpenAI, GPT, Codex, Vercel, ElevenLabs, Kling, Picsart, Lovable and Erasmus+ are names or marks of their respective owners.
- They are referenced only to describe tools or the real historical context. No endorsement is claimed.
- The final demo video should show no third-party logos except where unavoidable for a factual explanation, and should contain only project-owned or properly licensed music, imagery and voice work.

## Final rights check

Before submitting, the entrant must personally confirm:

- [ ] I am authorised to submit the game's code, writing, designs and generated media.
- [x] Public ElevenLabs guidance confirms a commercial licence for paid plans; I will retain proof that the submitted outputs were generated under Starter and were not Beta Services.
- [x] Current Kling terms and the required text attribution are documented; I will retain the original generation/export record.
- [x] Current Picsart and Lovable ownership/commercial-use guidance is documented; I will retain the original project/export records.
- [ ] I have retained private evidence for those generation accounts and exports.
- [ ] The demo video uses no unlicensed music, stock media, logos or third-party gameplay footage.
- [ ] No collaborator's personal information, image or voice appears without permission.
- [ ] All open-source dependencies retain their applicable licences and notices.
