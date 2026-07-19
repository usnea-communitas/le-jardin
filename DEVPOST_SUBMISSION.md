# Devpost submission copy — Permaculture Garden — Le Jardin

This document is field-ready source material for the OpenAI Build Week submission. Before final submission, the creator should read it in their own voice and confirm every factual statement.

## Project name

Permaculture Garden — Le Jardin

## Tagline

A living permaculture garden where GPT‑5.6 Luna turns the player's real design into a measurable learning experiment.

## Track

Education

## Short description

Permaculture Garden is a story-led educational game inspired by a real youth-run garden in Menet, France. Players learn ecological systems thinking by designing across soil, water, food, habitat, seasons and community sharing. GPT‑5.6 Luna listens to the garden they actually built and proposes a safe, measurable design experiment; deterministic game logic then checks the result.

## Inspiration

The project began with a real place. My partner joined an Erasmus+ volunteering programme in the small French village of Menet, where she and a group of young people helped care for a permaculture garden and learned by working together.

I wanted to create something for a community like theirs: not a textbook that explains permaculture from a distance, but a beautiful space where a young person can try relationships, watch seasons change, make a recoverable mistake and understand why a garden works as a system. The longer-term vision is to adapt the experience for schools, youth programmes, environmental organisations and other community projects exploring ecology and social cooperation.

This is an independent project and is not affiliated with or endorsed by Erasmus+.

## What it does

The player enters through a short story narrated in the first person by the Garden of Menet. They then build a garden from soil, water, food and habitat elements, discover beneficial guilds, welcome wildlife, grow and preserve harvests, and share real surplus with a community table.

Four seasons change what can grow, be harvested, preserved or protected. Eleven learning challenges transform ideas such as water retention, compost balance, winter shelter, seed selection and pollinator continuity into practical decisions. Wrong answers provide a useful clue and invite another attempt instead of ending the lesson.

The Garden Reflects — Living Lesson connects GPT‑5.6 Luna to the player's current system. It observes a bounded anonymous snapshot, selects one server-approved experiment, explains one relationship and asks a Socratic question in the voice of the garden. If the player accepts, deterministic game logic tracks the real change and records evidence when the experiment succeeds.

## How we built it

The game is a local-first browser experience generated from an editable Design Component source into a static React build. It runs on Vercel, stores progress locally and requires no account. A Vercel Function provides the only server boundary for GPT‑5.6 Luna through Vercel AI Gateway.

Codex was my primary engineering collaborator during Build Week. I supplied the real-world context, learning goals, ethical boundaries, narrative direction and visual taste. With Codex I audited the earlier prototype, redesigned every minigame, rebuilt progression and sharing, added the cinematic onboarding and organic audio, hardened accessibility and state recovery, created automated regression journeys, and designed and verified the Living Lesson.

The AI architecture deliberately separates expression from authority. `lib/living-lesson.js` generates a small trusted set of measurable experiments. GPT‑5.6 can choose and narrate one, but it cannot invent rules, change currency, grant rewards or judge its own success. The server validates structured output against the trusted candidates; the same deterministic engine later evaluates the garden state.

The model receives no name, free-text reflection or save file. Responses are cached by state fingerprint, rate-limited and token-capped. Authentication stays on Vercel through OIDC. If the model or credit is unavailable, a reviewed deterministic lesson preserves the educational flow and is clearly labelled offline.

## Challenges we ran into

The hardest problem was not adding AI; it was deciding what AI should be allowed to do. A free-form gardening chatbot would have been easy, but it could invent ecological claims, detach itself from play or become an authority the player simply obeys. We instead made GPT‑5.6 a reflective voice inside a deterministic learning contract.

A second challenge was turning a dense prototype into a coherent journey without losing its systemic depth. We had to coordinate seasons, asynchronous wildlife and guild events, narration, saves, reset behaviour, reduced motion, sharing economics and long-term completion. Codex helped expose edge cases through repeated professional-style audits and browser tests.

Finally, we wanted the experience to feel poetic without becoming vague. The garden can speak with warmth, but every Living Lesson still points to an observable relationship and one action the game can measure.

## Accomplishments that we are proud of

- GPT‑5.6 is embedded in a complete learning loop rather than presented as a generic chatbot.
- The player receives a reflection about their own garden, takes an action and can produce lasting evidence of learning.
- Gifts contribute to a community fund but never convert directly into personal currency.
- Eleven minigames teach through feedback and revision rather than timers or punishment.
- The experience has a coherent watercolor world, an original garden narrator, seasonal audio and accessible subtitles.
- The production path has deterministic tests for privacy boundaries, model normalisation, economy invariance, caching, persistence and outage behaviour.

## What we learned

We learned that generative AI becomes more trustworthy—and more educational—when its creative freedom is placed inside a carefully designed system. The model is most valuable here not because it knows every answer, but because it can notice the player's current relationships, express one clearly and ask a question that invites observation.

We also learned that fair-share values need to live in mechanics, not only in explanatory text. Separating community contribution from personal reward changed the meaning of the whole game.

## What's next

The next phase is real playtesting with young people and facilitators connected to community gardening. Their feedback will guide pacing, terminology and lesson scaffolding. We then want to add language versions, facilitator tools and a carefully designed shared mode for groups of 10–25 players. Longer term, schools and youth organisations could adapt the learning scenarios to their own local gardens while keeping the same systems-thinking foundation.

## Built with

Codex, GPT‑5.6 Luna, OpenAI-compatible structured generation through Vercel AI Gateway, Vercel Functions, JavaScript, React, HTML, CSS, Zod, ElevenLabs, Kling, Picsart and Lovable.

## Links

- **Live demo:** <https://permaculture-garden-new.vercel.app/>
- **Code repository:** <https://github.com/martinpazdernik-source/Permaculture-Garden-new> (private; shared with official judge accounts)
- **Demo video:** `ADD_PUBLIC_YOUTUBE_URL_LAST`
- **Codex Session ID:** `019f5bf0-57fc-7473-b5f0-dfa3659d2261`

## Testing instructions

No account or credentials are required. The intended platform is a desktop or laptop browser.

Fast GPT‑5.6 path:

1. Open the live demo and choose **Explore freely**.
2. Place Compost and Rain harvesting.
3. Select **Listen to your garden · GPT‑5.6 Luna** in the right panel.
4. Select **Try this experiment** and follow its action.
5. Reopen the card to see the evidence state update.

The live result is labelled **Living Lesson · GPT‑5.6 Luna**. If the inference service is temporarily unavailable, the feature remains usable and is explicitly labelled **Garden wisdom offline**.

## Submission checklist

- [ ] Join/register for OpenAI Build Week on Devpost
- [ ] Confirm entrant eligibility and representation
- [ ] Select **Education**
- [ ] Add the public production URL
- [ ] Add the private repository URL
- [ ] Confirm both official judge invitations
- [x] Add the primary Codex project Session ID: `019f5bf0-57fc-7473-b5f0-dfa3659d2261`
- [ ] Upload final screenshots
- [ ] Record and publish the public YouTube demo under three minutes
- [ ] Add the YouTube URL
- [ ] Review all text and rights statements personally
- [ ] Keep the demo free and accessible through 5 August 2026
- [ ] Submit before 21 July 2026 at 17:00 PDT
