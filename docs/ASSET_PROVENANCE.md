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


## The Garden's voice in French

The 49 French recordings in `assets/audio/story/fr/` (the seven story scenes) and
`assets/audio/garden-voice/fr/` (the Garden's 42 lines in the game) were generated
with ElevenLabs on 12 November 2026, under a paid plan like the rest of the audio
([LICENSE-ASSETS.md](../LICENSE-ASSETS.md)). `assets/i18n/audio.fr.json` lists each
file with its spoken text, its length and the ElevenLabs generation it came from.

**The voice.** The English and Czech recordings use the voice *The Garden of Menet*
(`Ks7JQ2YMsS1TBefsBD27`), which is not in the ElevenLabs account used for this work,
so the closest available voice was chosen instead, as the plan for this package
asked. 39 native French female voices from the ElevenLabs library were screened by
their previews; nine were auditioned on the same story line with `eleven_v3` (two
takes each) and the two closest again on a longer line from the garden. Closeness was
measured as the similarity of speaker embeddings (WeSpeaker ResNet34) to the average of
the 98 English and Czech recordings; for scale, the original voice speaking Czech
scores 0.67 against its own English. **Corinne** (`j3PYHC4NBf5MAIuCgGYU`, standard
French accent) scored 0.54–0.57 on all four of her takes, ahead of Chloé (0.44–0.52),
Atma (0.37–0.45) and the others (0.36 and lower), with a pace close to the original's
(16.8–17.1 s against 16.3 s for the same garden line). Her pitch is a little higher:
a median of about 195 Hz against 170 Hz.

**The lines.** Each line was generated twice with `eleven_v3`, language `fr`, the
default *Natural* stability and the same English stage direction as the Czech
recording (`[softly]`, `[reflective]` …). Both takes were transcribed with Whisper
large-v3-turbo and compared with the text; the take that said its text was kept, then
the one without an overlong pause, then the one whose voice was most consistent with
the rest of the set (two choices were changed by hand for a steadier pace: story scene
6 and the reflection on sharing). All 49 kept takes say their text; the only
differences the transcription found are words that sound the same and the name Menet.
The kept takes score 0.57 against the original voice on average (median), and 0.92
against each other.

**The text.** The spoken text is the French catalogue's, with two lines rewritten
for speaking: the ending ("Tu ne m’as pas achevé" can also be heard as "you did not
finish me off"; it now says that a garden is never finished) and the first soil line
(it said "commence" twice). The French subtitles now show exactly what the voice says,
also in the opening story, where the subtitle used to be shorter than the narration.

**Processing.** `node scripts/normalize-voice.mjs fr <folder of kept takes>` shortens
the quiet before and after the voice to a quarter of a second, levels each take in two
passes to −16 LUFS with true peaks under −2 dB (the results measure between −15.7 and
−16.6 LUFS, peaks at −2.4 dBFS or lower), writes a mono 44.1 kHz 128 kbit/s MP3 with a
length header and records the length in `audio.fr.json`. Together: 9.6 minutes,
9.2 MB, loaded only when a line plays.

A listening check by a native French speaker is still to come; the checklist is in
[`docs/translations/french-voice-review.md`](translations/french-voice-review.md).

At the same time two Czech recordings (`milestone-soil.mp3`, `season-spring.mp3`)
received the length header the others have, by copying their audio unchanged into a
new file, and three Czech subtitles (the spring passage, the mulch and ladybug
challenges) were corrected to what the Czech voice actually says.
