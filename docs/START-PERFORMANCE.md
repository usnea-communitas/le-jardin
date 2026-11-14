# How the game starts on a phone

Package J-12 asks for a steady start on a phone: in Lighthouse's phone, a
median of five runs of at least 90 and the worst at least 85, a median
blocking time of at most 200 ms and a first visit of at most 700 KiB, with
every journey passing and the rules unchanged. This page records where the
start spends its time, so the work can begin with the largest part.

## Where it stands (13 November 2026, production)

Lighthouse 12, phone, five runs: performance **75 · 89 · 86 · 91 · 89**
(median 89, worst 75), largest contentful paint 3.2 s (worst 4.2 s), total
blocking time median **223 ms**, first visit 679 KiB. The largest element is
the text of the story's cover, so the paint Lighthouse waits for is the game's
own first render.

## What the main thread does

`scripts/measure-start.mjs` records a Chromium trace of a first visit on an
emulated phone (412 × 823 at 1.75×, the CPU four times slower, as Lighthouse's
phone) up to the moment the cover appears, and sums it by phase and by long
task:

```sh
node scripts/run-local-e2e.mjs scripts/measure-start.mjs
GAME_URL=https://permaculture-garden.vercel.app/ MEASURE_RUNS=3 node scripts/measure-start.mjs
```

Three runs against production: the cover appears after 1.3–1.8 s; until then
the main thread is busy for 0.94–1.11 s, of which 0.50–0.64 s is script. In
order, the start is three long tasks:

| Step | Long task | Inside it |
|---|---|---|
| 1. `game.fragment.html` is put into the page (after `react-dom` has loaded) | 95–119 ms | parsing its HTML 50–65 ms, its 123 kB of CSS 19–24 ms |
| 2. `vendor/dc-runtime.js` runs | 185–231 ms | parsing the template's HTML again 26–35 ms, compiling the game's logic from text (`new Function`) 32–44 ms, the rest running the runtime and the logic |
| 3. React's first render of the game | 209–259 ms (sometimes two tasks) | compiling the game's functions on their first call 60–76 ms, the styles again 11–15 ms, and style and layout forced inside the render 70–85 ms |

Over the whole start: parsing HTML 136–167 ms, compiling scripts
134–160 ms, layout 91–127 ms, style 50–59 ms, parsing CSS 34–42 ms. Image
decoding does not show. Lighthouse files most of steps 2 and 3 under
"other" and "unattributable", because code made from text has no file.

## The logic as a script of its own (14 November 2026)

`npm run generate` now writes the game's logic class to `game.logic.js`, wrapped
in a function with the runtime's three names, and leaves a one-line stub in its
place in `game.fragment.html` that hands the class to the runtime
([`scripts/game-logic.mjs`](../scripts/game-logic.mjs)). The canonical source and
the runtime are unchanged and the class is the same text, so the game behaves the
same; the unit tests evaluate the shipped file. The browser compiles the script
while it arrives, away from the main thread, and a returning player's browser can
keep it compiled. The shell fetches it after the first paint, beside the fragment
and React: with a preload, Lighthouse counted it among what the first paint waits
for (first contentful paint 1.0 → 1.8 s).

The trace as above, against a local server, three runs each (main → this change):
putting the fragment into the page 88–99 → 64–72 ms (the fragment is 288 kB
instead of 755 kB), the runtime's task 172–231 → 147–175 ms (it no longer compiles
the logic from text); React's first render (119–156 ms) and the layout after it
(75–91 ms) are unchanged.

Lighthouse 12, phone, ten runs each, alternating between the live site and the
preview deployment of this change:

| | Live site (main) | The logic as a script |
|---|---:|---:|
| Performance, median (worst) | 86.5 (77) | 93 (78) |
| Largest contentful paint, median | 3.18 s | 2.61 s |
| Total blocking time, median | 300 ms | 215 ms |
| Speed index, median | 2.28 s | 1.67 s |
| First contentful paint, median | 1.01 s | 1.01 s |
| First visit | 679 KiB | 680 KiB |

Three runs in ten (four on the live site) still end with the cover's text as the
largest paint, at 4.2–4.5 s, because that paint waits for the whole game. That is
item 1 below, and it keeps the worst run under 85.

## What can be taken away, largest first

1. **The cover waits for the whole game.** Every step above stands between
   the first paint (1.0 s) and the largest one. Painting the story's first
   picture in `index.html` itself, before the game runs, would let the
   largest paint happen with the first one. It changes the boot screen (a
   picture instead of the leaf), so it needs the maintainer's yes.
2. **Style and layout inside React's first render** (70–85 ms): something in
   the first render asks for layout. Moving that read after the first frame
   splits the task, which lowers blocking time without saving work.
3. **The template is parsed twice** (26–35 ms) and its CSS twice
   (11–15 ms): once as the fragment enters the page, once by the runtime.
4. **The logic as a real script** (candidate (d)): done on 14 November 2026,
   see below. The runtime itself stays untouched until I3.
5. **The three scripts in the head without `defer`** (`lib/i18n.js`,
   `lib/living-lesson.js`, `lib/workshop.js`; Lighthouse estimates 130 ms of
   render blocking). The boot reads `window.PermacultureI18n` two frames after
   the first paint, so deferring them needs the boot to wait for them first.
