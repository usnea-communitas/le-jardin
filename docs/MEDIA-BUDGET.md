# Media budget

What a first visit may download and how large each kind of media may grow. `npm test`
checks every line below with `scripts/test-media-budget.mjs` (the limits live in
`scripts/media-budget.mjs`) and stops the build when one is exceeded, naming it.
Text (HTML, CSS, JavaScript, JSON, SVG) counts as it travels, compressed with gzip;
pictures, fonts and sound count as they are. Measured on 13 November 2026; the first visit on 14 November 2026.

## A first visit

The opening story's cover, before anyone presses a key: the page and the game (its
template, styles and logic), its rules and runtime, three fonts, the English texts and
the story's first painting. The interface's small pictures wait until the garden shows
them (since 14 November 2026; they were 57 KiB of the first visit).

| | Now | Limit |
| --- | ---: | ---: |
| Phone held upright (the 600 × 900 crop of the first painting) | 605 KiB | 700 KiB |
| Desktop (the full 1600 × 900 painting) | 787 KiB | 900 KiB |

The largest parts are the game itself (`game.logic.js` 135 KiB, `game.fragment.html` 31 KiB
and `game.css` 26 KiB compressed), the first painting (134 KiB on a phone, 316 KiB on a
desktop), the fonts (128 KiB) and the English texts (48 KiB). The resilience journey
(`scripts/e2e-resilience.mjs`, part of CI) checks that a browser fetches exactly the files
the budget names, on a phone and on a desktop, so this sum stays true when something new
loads at the start.

Nothing else loads before the player begins: the story's sound and the other paintings
come as the story plays, the Garden's voice and the music when they are first heard,
the moving pictures only after the story, and nothing at all from the offline package.

## Each kind of media

All files, as the offline package (`offline-manifest.json`) counts them.

| | Now | Limit |
| --- | ---: | ---: |
| Each season gate | 20–34 KiB | 40 KiB |
| The story's paintings (seven, and seven crops for phones) | 3,843 KiB | 4,200 KiB |
| The Garden's voice, per language (49 recordings) | 8,208–8,987 KiB | 9,500 KiB |
| Music | 6,084 KiB | 6,500 KiB |
| Game sounds | 1,134 KiB | 1,300 KiB |
| Other pictures (299) | 13,019 KiB | 14,000 KiB |
| Fonts | 182 KiB | 200 KiB |
| Texts, per language | 163–264 KiB | 300 KiB |

## When a line is exceeded

Make the new file smaller first (a picture at the size the game draws it, sound at
the levels of `scripts/normalize-voice.mjs`). Raise a limit only on purpose, in the
same pull request, with the reason in its description; a first visit stays at most
700 KiB on a phone.
