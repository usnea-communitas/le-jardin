# v78 art provenance

The v78 crop thumbnails and winter entrance gate were generated in Picsart with
Seedream 5 Pro, selected by visual review, and processed locally into transparent,
web-ready assets.

Final runtime assets:

- `assets/harvest-potatoes.webp`
- `assets/harvest-roots.webp`
- `assets/harvest-leafy.webp`
- `assets/harvest-cabbage.webp`
- `assets/harvest-herbs.webp`
- `assets/harvest-apples.webp`
- `assets/gate2-winter.webp`

The selected source generations are retained in `art-candidates/`. The deterministic
processing pipeline is `scripts/process-picsart-assets.mjs`; it removes only
border-connected paper, preserves the principal painted motif, trims it, centres it,
and writes optimized WebP output at the dimensions expected by the game.

