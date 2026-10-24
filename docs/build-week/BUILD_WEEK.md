# OpenAI Build Week — submission handoff

## Submission identity

- **Project:** Permaculture Garden — Le Jardin
- **Track:** Education
- **Tagline:** A living permaculture garden where every placement becomes a relationship and GPT‑5.6 Luna turns the player's real design into a measurable learning experiment.
- **Production:** <https://permaculture-garden-new.vercel.app/>
- **Repository:** <https://github.com/martinpazdernik-source/Permaculture-Garden-new> (private; judge access required)
- **Primary Codex Session ID:** `019f5bf0-57fc-7473-b5f0-dfa3659d2261`
- **Current release:** v76 / `0.76.0`

## Real origin and intended impact

The game is inspired by a real permaculture garden in Menet, France. The creator's partner joined an Erasmus+ volunteering programme there and helped a group of young people care for the garden and learn together. The experience is being designed first for a community like theirs, then for schools, youth programmes, environmental organisations and similar projects exploring ecology, systems thinking and social cooperation.

The project is independent and is not affiliated with or endorsed by Erasmus+.

## Meaningful GPT‑5.6 integration

The v74 feature **The Garden Reflects — Living Lesson**, updated in v75 for the production model, uses `openai/gpt-5.6-luna` through Vercel AI Gateway. It is not a decorative chatbot:

1. The game derives a bounded snapshot from the player's actual garden state.
2. A deterministic engine creates two to four valid, measurable design experiments.
3. GPT‑5.6 Luna chooses one experiment and turns the current relationships into a first-person observation, an educational explanation and one Socratic question.
4. The player accepts the experiment and changes the real garden.
5. The deterministic engine—not the model—checks the new state and records evidence when the experiment succeeds.

This makes the AI response part of the learning loop while preventing it from inventing rules, rewards or success conditions. The shared engine lives in `lib/living-lesson.js`; the protected server boundary is `api/garden-reflection.js`; the watercolor dialog and experiment tracker live in `Permaculture Garden v2.dc.html`.

## Safety, privacy and cost

- The browser never receives a provider credential. Deployed requests authenticate with Vercel's automatically supplied OIDC token.
- The model sees only the season, placed element types, relationship metrics, system explanations and bounded progress counts. Player name, reflection notes and save data are excluded.
- Candidate experiments are regenerated and validated server-side. Structured output is normalised against that trusted list before it reaches the player.
- Identifiers used for throttling and routing are hashed; prompts and player state are not logged by application code.
- Responses are cached by deterministic state fingerprint. The client permits three uncached calls per day, the function adds burst/client/global limits, output is capped at 320 tokens and total model time at 12 seconds.
- Auto top-up remains disabled. A missing gateway, exhausted balance, 402, 429, timeout or provider error safely uses the reviewed fallback and creates no further model charge. Cost controls never break the game.

## Built with Codex

Codex was the primary engineering collaborator during the Submission Period. The creator made the educational, ethical, narrative and aesthetic decisions; Codex audited the existing prototype, implemented and tested the chosen systems, repeatedly reviewed the result from four player/professional perspectives, and prepared the GitHub/Vercel releases.

Codex materially accelerated:

- source recovery and a reproducible build pipeline;
- the redesign of eleven educational minigames;
- accessibility, state resilience and browser regression testing;
- the cinematic onboarding, soundscape, garden voice and unified visual system;
- the fair-share economy, progression, seasonal learning and evidence-based reflections;
- the bounded GPT‑5.6 architecture, server function, validation, fallback and production verification.

Key human decisions included keeping community gifts separate from personal reward, making wrong answers repairable, keeping money secondary to sharing, choosing a first-person garden voice and limiting GPT‑5.6 to reflection while deterministic code retains authority over rules and learning evidence.

## Prior work versus Build Week work

The project was pre-existing. The formal baseline is commit `ceec9780de07829620d8ce2fce50e09de8bcf30d`, committed at **13 July 2026, 07:58 PDT**, before the official 09:00 PDT Submission Period start.

### Present at the baseline

- a deployable single-file garden prototype;
- placement of core garden elements;
- seasons, guild discovery, wildlife and sharing concepts;
- basic onboarding, minigames and a summary card.

### Added during the Submission Period

- a recoverable editable source, build/check pipeline and local runtime assets;
- repaired journey, loading, saving, reset, event queues and accessibility;
- eleven redesigned learning challenges with feedback and retry;
- a seven-scene narrated story introduction and regenerated organic audio;
- unified watercolor UI, cinematic season passages, background scene and garden voice;
- a fairer long-term loop, explicit sharing economy, winter logic, earned reflections and richer completion evidence;
- comprehensive automated game, resilience, accessibility, economy, visual and production tests;
- v74 **Living Lesson**, v75 production use of **GPT‑5.6 Luna**, and v76 submission documentation and in-product media attribution.

The first qualifying post-start commit is `1e8b215` at 11:25 PDT on 13 July. From the baseline through v75, Git records 214 changed files, 17,871 insertions and 225 deletions. The dated commit history and this Codex project thread provide timestamped evidence.

## Judge path — about two minutes

1. Open the production game and choose **Explore freely** in onboarding.
2. Place at least two elements, for example Compost and Rain harvesting.
3. In **Design connections**, select **Listen to your garden · GPT‑5.6 Luna**.
4. Read the garden observation, relationship explanation and question.
5. Select **Try this experiment**.
6. Follow its action on the plot. The card updates from current evidence to a completed experiment.
7. Reopen the feature after changing the garden to see that the lesson follows the new state.

The modal labels a live result **Living Lesson · GPT‑5.6 Luna**. If Gateway credit is unavailable, it transparently labels the reviewed continuity path **Garden wisdom offline**.

## Reproducible verification

```powershell
npm ci
npm run generate
npm test

python -m http.server 8787 --bind 127.0.0.1
$env:CODEX_NODE_MODULES="C:\path\to\playwright\node_modules"
npm run test:e2e:living-lesson

$env:GAME_URL="https://permaculture-garden-new.vercel.app/"
$env:LIVING_LESSON_LIVE_API="1"
$env:EXPECTED_LESSON_MODE="ai"
node scripts/e2e-living-lesson.mjs
```

Coverage includes snapshot sanitisation, stable fingerprints, trusted candidate generation, structured-output normalisation, all deterministic completion metrics, method/input/origin boundaries, no-credential fallback, UI unlock, GPT labelling, cache reuse, economy invariance, experiment persistence, automatic completion and outage fallback.

## Required external completion

- [x] Functional public app, free and without login
- [x] Meaningful direct use of GPT‑5.6 in the product loop
- [x] Codex used materially in engineering and verification
- [x] Pre-existing versus Submission Period work documented with a baseline commit
- [x] English README with setup, testing, Codex decisions and GPT‑5.6 architecture
- [x] Clear fallback, privacy and cost boundaries documented and tested
- [ ] Confirm private repository invitations for `testing@devpost.com` and `build-week-event@openai.com`
- [x] Record the primary Codex project Session ID for the `/feedback` field
- [ ] Save the final Devpost draft in the Education track
- [ ] Complete the asset-rights evidence check in `THIRD_PARTY_NOTICES.md`
- [ ] Record and publish the final YouTube demo under three minutes
- [ ] Add the YouTube URL and perform the creator's final review before Submit

The remaining actions either create external account changes or require the creator's real video and rights records; they must not be fabricated.
