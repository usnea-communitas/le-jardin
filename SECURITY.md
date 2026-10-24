# Security policy

Le Jardin is a local-first browser game: progress is stored in the player's browser, there are no accounts and no database. The one server component is the Vercel Function `api/garden-reflection.js`, which forwards an anonymous garden snapshot to a language model through Vercel AI Gateway and returns a validated, structured reflection.

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Write to **<martin@usnea.ngo>** with:

- a description of the issue and the affected file, endpoint or URL,
- steps to reproduce or a proof of concept,
- the impact as you see it.

You will get an acknowledgement within a few days. This is a small volunteer nonprofit project, so there is no bug bounty, but reports are taken seriously, fixed as quickly as possible and credited in the release notes if you wish.

## Scope

In scope:

- the game code in this repository (the canonical source, `lib/`, `api/`, `scripts/`);
- the production deployment at <https://permaculture-garden.vercel.app/>;
- the Living Lesson endpoint: origin checks, rate limits, prompt and response handling, what leaves the browser (it must never be more than element types, season, relationship metrics, bounded progression counts and a language code);
- the handling of saved game state and URL parameters.

Out of scope:

- the hosting platform and the model provider themselves;
- vulnerabilities in dependencies that have no effect on this application (report those upstream; dependency updates are still welcome as pull requests).

## Supported versions

Only the `main` branch and the current production deployment are supported.
