# OpenAI Build Week — submission handoff

## Project

**Permaculture Garden — Le Jardin** is a story-led educational game inspired by a real
youth-run community garden in Menet, France. Players learn permaculture by arranging soil,
water, food, habitat and community elements, observing their relationships, sharing genuine
surplus and adapting across seasons.

Production: <https://permaculture-garden-new.vercel.app/>

## Meaningful GPT‑5.6 integration

The v74 feature **The Garden Reflects — Living Lesson** uses
`openai/gpt-5.6-terra` through Vercel AI Gateway. It is not a decorative chatbot:

1. The game derives a bounded snapshot from the player's actual garden state.
2. A deterministic engine creates two to four valid, measurable design experiments.
3. GPT‑5.6 chooses one experiment and turns the current relationships into a first-person
   observation, an educational explanation and one Socratic question.
4. The player accepts the experiment and changes the real garden.
5. The deterministic engine—not the model—checks the new state and records evidence when the
   experiment succeeds.

This makes the AI response part of the learning loop while preventing it from inventing rules,
rewards or success conditions. The shared engine lives in `lib/living-lesson.js`; the protected
server boundary is `api/garden-reflection.js`; the watercolor dialog and experiment tracker live
in `Permaculture Garden v2.dc.html`.

## Safety, privacy and cost

- The browser never receives a provider credential. Deployed requests authenticate with Vercel's
  automatically supplied OIDC token.
- The model sees only the season, placed element types, relationship metrics, system explanations
  and bounded progress counts. Player name, reflection notes and save data are excluded.
- Candidate experiments are regenerated and validated server-side. Structured output is normalized
  against that trusted list before it reaches the player.
- Identifiers used for throttling and routing are hashed; prompts and player state are not logged by
  application code.
- Responses are cached by deterministic state fingerprint. The client permits three uncached calls
  per day, the function adds burst/client/global limits, output is capped at 320 tokens and total
  model time at 12 seconds.
- Auto top-up should remain disabled. Vercel requires a valid card on file before it unlocks even
  the free Gateway credit; until the project owner adds one, a 403 safely uses the reviewed fallback
  and creates no model charge. A missing gateway, 402, 429, timeout or provider error likewise
  returns a deterministic lesson with HTTP 200, so cost controls never break the game.

## Built with Codex

Codex was used as the primary engineering collaborator to audit the existing game, reason about
the learning design, implement the shared experiment engine and Vercel Function, integrate the UI,
write automated tests, verify the complete browser journey and prepare the GitHub/Vercel release.
The Git history after the Build Week start provides a chronological implementation record; v74 adds
the direct GPT‑5.6 runtime feature and its testable safety boundary.

## Judge path (about 2 minutes)

1. Open the production game and choose **Explore freely** in onboarding (or continue an existing garden).
2. Place at least two elements, for example Compost and Rain harvesting.
3. In **Design connections**, select **Listen to your garden · GPT‑5.6**.
4. Read the garden observation, relationship explanation and question.
5. Select **Try this experiment**.
6. Follow its action on the plot. The card updates from current evidence to a completed experiment.
7. Reopen the feature after changing the garden to see that the lesson follows the new state.

The modal labels a live result **Living Lesson · GPT‑5.6**. If the free gateway allowance is
unavailable, it transparently labels the reviewed continuity path **Garden wisdom offline**.

## Reproducible verification

```powershell
npm install
npm test

python -m http.server 8787 --bind 127.0.0.1
$env:CODEX_NODE_MODULES="C:\path\to\playwright\node_modules"
npm run test:e2e:living-lesson

$env:GAME_URL="https://permaculture-garden-new.vercel.app/"
$env:LIVING_LESSON_LIVE_API="1"
$env:EXPECTED_LESSON_MODE="fallback" # change to "ai" after Gateway credit is unlocked
node scripts/e2e-living-lesson.mjs
```

Coverage includes snapshot sanitization, stable fingerprints, trusted candidate generation,
structured-output normalization, all deterministic completion metrics, method/input/origin
boundaries, no-credential fallback, UI unlock, GPT labeling, cache reuse, economy invariance,
experiment persistence, automatic completion and outage fallback.
The same browser harness can run against production without relying on the localhost-only React
test handle; it verifies the deployed endpoint, cache, economy invariance and persisted experiment
through public UI and `localStorage` behavior.

## Submission checklist

- [x] A functional app, not a prototype-only mockup
- [x] Meaningful direct use of GPT‑5.6 in the product loop
- [x] Codex used materially in engineering and verification
- [x] Public production URL and public Git history
- [x] Clear fallback when live inference is unavailable
- [x] Privacy and cost boundaries documented and tested
- [ ] Project owner adds a valid card in Vercel to unlock the free AI Gateway credit, with auto top-up off
- [ ] Record the final demo video after production verification
- [ ] Add the required public user-feedback evidence and link/quote to the Devpost submission
- [ ] Complete the final Devpost description, screenshots and team details

The final three items require the creator's real public materials and should not be fabricated in code.
