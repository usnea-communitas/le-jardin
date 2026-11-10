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


## Story paintings for phones

`assets/story/phone/story-01-menet.webp` … `story-07-invitation.webp` are 600 × 900
centre crops of the 1600 × 900 story paintings in `assets/story/`, re-encoded as
WebP (quality 86) on 10 November 2026. On screens whose width is at most three
fifths of their height the opening story shows these crops instead of the full
paintings: everything outside the crop is cut off there by the frame anyway, and
the seven pictures weigh 1.1 MB instead of 2.7 MB. Remake them from the full
paintings whenever a painting changes.
