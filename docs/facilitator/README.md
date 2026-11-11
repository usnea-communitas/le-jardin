# Facilitator guide

For anyone who plays Le Jardin with a group. To print, use the PDFs; to read on GitHub, open the chapters.

| | English | Čeština | Français |
|---|---|---|---|
| PDF to print | [le-jardin-facilitator-guide-en.pdf](pdf/le-jardin-facilitator-guide-en.pdf) | [le-jardin-facilitator-guide-cs.pdf](pdf/le-jardin-facilitator-guide-cs.pdf) | [le-jardin-facilitator-guide-fr.pdf](pdf/le-jardin-facilitator-guide-fr.pdf) |
| The game, workshop mode and the six acts | [guide.md](en/guide.md) | [pruvodce.md](cs/pruvodce.md) | [guide.md](fr/guide.md) |
| The eleven challenges | [challenges.md](en/challenges.md) | [vyzvy.md](cs/vyzvy.md) | [defis.md](fr/defis.md) |
| Session plans and the closing conversation | [plans.md](en/plans.md) | [plany.md](cs/plany.md) | [deroulements.md](fr/deroulements.md) |
| Workshop link | [QR code](qr/workshop-en.svg) | [QR kód](qr/workshop-cs.svg) | [Code QR](qr/workshop-fr.svg) |

The game links to the PDF in the player's language from its *Workshop* panel; in the other six languages it offers the English one.

## Changing the guide

The guide and the plans are written by hand. The chapter on the challenges is generated from the game's own words in `assets/i18n/`, so its titles, tasks, answers and explanations always match the screen; edit `scripts/facilitator-guide.mjs` or the catalogue, not that file. After any change, rebuild the chapters, the QR codes and the PDFs and commit them together:

```sh
node scripts/facilitator-guide.mjs          # chapters, QR codes, PDFs (needs Playwright's Chromium)
node scripts/facilitator-guide.mjs --check  # is every challenge chapter current? (part of npm test)
```

The guide names the acts and the workshop controls exactly as the game does in each language, and `npm test` checks that it still does.

The texts the chapter on the challenges takes from the game are covered by [LICENSE-ASSETS.md](../../LICENSE-ASSETS.md) (CC BY-NC-SA 4.0).
