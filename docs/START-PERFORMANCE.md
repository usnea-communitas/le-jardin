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

## The story's painting on the boot screen (14 November 2026)

The boot screen shows the story's first painting from the files the head
already preloads, placed exactly as the opening story places it, with the leaf
and "Preparing Le Jardin…" on a small card in the cover card's style; the
painting stays when the cover takes over. A player on a slow connection sees
the painting as soon as it arrives instead of a cream screen until the whole
game has rendered.

Lighthouse did not notice. Ten runs each, alternating with the live site:
performance median 89.5 → 90, worst 78 → 75, largest paint median 2.58 →
2.60 s, three slow runs in ten in both. A trace shows why: Chrome takes no
image that covers the whole viewport as a largest-paint candidate (it treats it
as a background), so the boot painting never counts, and neither does the
story's own painting. The only candidates are texts: the boot card's title at
the first paint, and sometimes the cover's paragraph (4.3–5.3 s): those are the
slow runs. The cover card rises in from transparent (`storyCaption`), and
Chrome ignores text painted at opacity 0, so usually the boot title stays the
largest paint. We first thought the paragraph won when a busy main thread made
the cover's first frame come mid-animation; the next section found the real
cause, a typeface arriving after that first frame.

## The styles once, and the cover's letters before the cover (14 November 2026)

Four changes, none of them in the runtime, and the game looks the same: twelve
screenshots of the cover and the garden (desktop, tablet and phone, English and
Czech) match `main` pixel for pixel.

- **The styles are a file of their own.** The canonical source keeps its styles
  in the template's `<helmet>`, so they travelled inside `game.fragment.html`
  (124 kB of its 288 kB), and the browser parsed them twice: when the shell put
  the template into the page, and again when the runtime copied the helmet into
  the head at React's first render (11–15 ms there, inside the longest task). Each
  copy also made its own set of `@font-face` rules, so the fonts were looked up
  and decoded again for the second. `npm run generate` now writes them to
  `game.css`, which the shell fetches after the first paint beside the logic and
  needs before the runtime starts, like the logic; a sheet that does not arrive, or
  that the browser refuses (one served as another type still "loads", empty),
  shows the retry screen. Without the styles, the fragment is 164 kB, so every
  pass of the runtime over the template's text is shorter too.
- **The template's pictures wait for the garden.** The template waits in the page,
  unseen, until the runtime reads it, and the browser still downloaded the pictures
  it names with a fixed address: four of the interface's (57 KiB, among them an
  80 kB SVG the main thread parses as it arrives, 20–90 ms at the phone's speed).
  The build now writes their `src` as `sc-camel-src`, the runtime's own spelling
  of `src` that the story's frames already use: the browser leaves it alone, and the
  rendered picture gets `src` when the garden shows it. A first visit is 605 KiB on
  a phone instead of 657 KiB.
- **The cover's typefaces are ready before the cover.** This was the cause of the
  slow runs. The cover's paragraph is painted at opacity 0 at the start of its
  fade-in, and Chrome does not count that paint; but its typeface, Bricolage
  Grotesque, only became usable once the runtime had copied the helmet's
  `@font-face` rules into the head, a moment after that first paint, and the
  paragraph was drawn again in it, mid-fade, visible and larger than the boot
  title. A local server that waits 40–100 ms before each answer (as a real
  connection does) shows it every time: the paragraph became the largest paint in
  seven runs of eight on the live build, in English, and in three of three in
  Czech. The shell now asks the browser for the cover's faces
  (`document.fonts.load`) before it starts the runtime: Bricolage Grotesque and
  Hanken Grotesk in the Latin files the head already preloads, the letters of the
  player's language that only another file draws (the build finds them in the
  catalogues: Czech and Polish need a few), and the letters of the language list.
  They are in long before the logic, so the cover does not wait for them (and
  never more than 2.5 s). Then the paragraph is drawn once, in its own letters, and
  never became the largest paint again: none of eight runs in English, none of
  four in Czech. A player no longer sees the cover's title and paragraph switch
  typeface as it appears.
- **Two long tasks split.** The game asked for `document.fonts.ready` while it
  mounted, and with the fonts already in, that makes Chrome lay the page out at
  once, inside React's first render; it is now asked a moment later, so the layout
  happens in the next frame. And the template goes into the page as soon as it has
  arrived, in a task of its own, instead of in the same task as running React DOM.

Lighthouse 12, phone, eight runs each, alternating, against local servers that wait
40–100 ms before each answer:

| | Before (main) | After |
|---|---:|---:|
| Performance, median (worst) | 70.5 (66) | 87.5 (78) |
| Largest contentful paint | 5.3–5.4 s in seven runs (the cover's paragraph), 3.4 s in one | 3.0–3.5 s in every run (the boot title) |
| Total blocking time, median | 417 ms | 265 ms |
| First visit (phone) | 657 KiB | 605 KiB |

The preview deployment against production, ten runs each, alternating (the same
afternoon this machine scored production about ten points lower than in the
morning, so the columns compare, not the days):

| | Production (v0.87.0) | Preview |
|---|---:|---:|
| Performance, median (worst) | 77 (64) | 87.5 (87) |
| Total blocking time, median | 426 ms | 266 ms |
| Largest contentful paint, median | 3.57 s | 3.13 s |
| Runs with the cover's paragraph as the largest paint | 5 of 10 | none |
| Transferred | 681 KiB | 628 KiB |

Against J-12: the worst run is now at least 85 (87 on the preview; locally one run
of eight scored 78 with 642 ms of blocking time on a two-core machine, the others
85–90), the first visit stays under 700 KiB and every journey passes. The median
of 90 and the blocking time of 200 ms are not reached yet: what is left is React's
first render with the game's `renderVals()` (item 2 below) and the runtime's own
work on the template (item 3).

Two more things were tried and left out. Telling V8 to compile all of
`game.logic.js` while it downloads (the `//# allFunctionsCalledOnLoad` comment)
took about 100 ms of compiling out of React's first render, but the browser then
needed about as long on the main thread when the script ran, so the blocking time
did not fall (on this two-core machine the background compiling also competes with
the main thread; a phone has more cores). And React's first render as a transition,
which React renders in slices of 5 ms, did not shorten the task: the runtime draws
the whole template in one component's render, which React cannot slice.

## What can be taken away, largest first

1. **The cover waits for the whole game.** Every step above stands between
   the first paint (1.0 s) and the cover. The boot screen shows the story's
   first painting (14 November 2026), so a player sees it long before the game
   is ready; Chrome never counts an image that covers the whole viewport, and
   since the cover's typefaces are ready before it is drawn, the largest paint is
   the boot title in every run, not the cover. The cover itself still arrives
   after the game's start, so the work in items 2 and 3 is what brings it closer.
2. **React's first render computes the whole game.** `renderVals()` is one
   function of 119 kB that the browser compiles at its first call and that
   computes every value of the template (the catalogue, the garden, the panels)
   while the cover shows a title, a paragraph and three buttons. Splitting it, so
   the cover asks only for what it shows, is the largest piece of work left
   outside the runtime. (The style and layout React's first render forced, 70–85
   ms, moved to the next frame on 14 November 2026, see above.)
3. **The runtime's own work on the template**: putting its 1,343 elements into
   the page, reading them back and compiling them (`stamp`, `collectProps`,
   `walkElement`), 140–280 ms at the phone's speed. Its CSS is no longer part of
   it (14 November 2026); the rest waits for I3, the decision about the runtime.
4. **The logic as a real script** (candidate (d)): done on 14 November 2026,
   see above. The runtime itself stays untouched until I3.
5. **The three scripts in the head without `defer`** (`lib/i18n.js`,
   `lib/living-lesson.js`, `lib/workshop.js`; Lighthouse estimated 130 ms of
   render blocking). Tried on 14 November 2026 with the boot waiting for the
   page to be parsed before it asks for the translations: the boot screen
   filled sooner (speed index 2.43 → 1.87 s, the largest paint 3.06 → 2.84 s,
   six runs each), but their work then fell after the first paint, inside the
   window Lighthouse counts as blocking (265 → 374 ms), and the performance
   median fell (88.5 → 85.5). Left out while J-12 is judged by Lighthouse; a
   player would see the boot screen half a second sooner.
