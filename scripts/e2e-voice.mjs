// The Garden's voice in the player's language (package J-06): French and Czech
// players hear their own recordings from the opening story to the garden, other
// languages hear English with a note saying so, a missing recording falls back to
// English, the subtitles show what the voice says, and a first visit fetches no
// voice at all.
import { readFile } from "node:fs/promises";
import { chromium } from "./load-playwright.mjs";

const baseUrl = process.env.GAME_URL || "http://127.0.0.1:8787/";
const at = query => new URL(query, baseUrl).href;
const manifests = {
  fr: JSON.parse(await readFile(new URL("../assets/i18n/audio.fr.json", import.meta.url), "utf8")),
  cs: JSON.parse(await readFile(new URL("../assets/i18n/audio.cs.json", import.meta.url), "utf8"))
};

const check = (condition, message, evidence) => {
  if (!condition) throw new Error(message + (evidence === undefined ? "" : "\nEvidence: " + JSON.stringify(evidence, null, 2)));
  console.log("PASS  " + message);
};
const until = async (predicate, timeout = 8000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await predicate()) return true;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return false;
};

const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const errors = [];

async function open(locale, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport, locale: "en-GB" });
  const page = await context.newPage();
  const requests = [];
  page.on("request", request => requests.push(new URL(request.url()).pathname));
  page.on("pageerror", error => errors.push(`${locale} pageerror: ${error.message}`));
  page.on("console", message => { if (message.type() === "error" && !/Failed to load resource/.test(message.text())) errors.push(`${locale} console: ${message.text()}`); });
  await page.goto(at(`?lang=${locale}`), { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__ && window.__PERMAGARDEN_APP__.state, null, { timeout: 15000 });
  return { context, page, requests };
}
const voiceRequests = requests => requests.filter(p => /\/assets\/audio\/(story\/narration|story\/(cs|fr)\/|garden-voice\/)/.test(p));

try {
  for (const locale of ["fr", "cs"]) {
    const manifest = manifests[locale];
    const { context, page, requests } = await open(locale);

    // A first visit fetches no voice: the recordings load only when they play.
    check(voiceRequests(requests).length === 0, `${locale}: the first visit fetches no recording`, voiceRequests(requests));
    check(await page.locator(".pg-audio-language-note").count() === 0, `${locale}: no "audio in English" note`);

    // The opening story narrates in the player's language and shows what it says.
    await page.locator(".pg-story-primary").first().click();
    check(await until(() => requests.includes(`/assets/audio/story/${locale}/narration-01.mp3`)), `${locale}: the story's first scene plays assets/audio/story/${locale}/narration-01.mp3`);
    check(!requests.includes("/assets/audio/story/narration-01.mp3"), `${locale}: the English narration is not fetched`);
    const caption = (await page.locator(".pg-story-caption p").first().textContent()).trim();
    const spoken = manifest.cues.find(cue => cue.id === "story-01").caption;
    check(caption === spoken, `${locale}: the first scene's subtitle is what the voice says`, { caption, spoken });

    // In the garden: a plain line, a challenge line and a resident's story.
    await page.evaluate(() => {
      const app = window.__PERMAGARDEN_APP__;
      app.stopAllAudio();
      app.setState({ story: false, storyStarted: false, muted: false });
    });
    for (const [id, file] of [["soil", "milestone-soil.mp3"], ["challenge:mulch", "challenge-mulch.mp3"], ["hedgehog-1", "resident-hedgehog-1.mp3"], ["ending", "ending.mp3"]]) {
      await page.evaluate(voiceId => window.__PERMAGARDEN_APP__.speakGarden(voiceId), id);
      check(await until(() => requests.includes(`/assets/audio/garden-voice/${locale}/${file}`)), `${locale}: the Garden says ${id} from assets/audio/garden-voice/${locale}/${file}`);
    }
    check(!requests.some(p => /\/assets\/audio\/garden-voice\/[a-z-]+\.mp3$/.test(p) && !p.includes(`/${locale}/`)), `${locale}: no English garden line is fetched while the ${locale} ones play`, voiceRequests(requests));

    // A recording that cannot load falls back to the English one.
    await page.route(`**/assets/audio/garden-voice/${locale}/resident-bee-1.mp3`, route => route.fulfill({ status: 404, body: "" }));
    await page.evaluate(() => window.__PERMAGARDEN_APP__.speakGarden("bee-1"));
    check(await until(() => requests.includes("/assets/audio/garden-voice/resident-bee-1.mp3")), `${locale}: a missing recording falls back to the English one`);
    await page.evaluate(() => window.__PERMAGARDEN_APP__.stopAllAudio());

    // A whisper stays on screen until its line has been said, also when the French
    // recording lasts longer than the time the English text would get (10.3 s here).
    if (locale === "fr") {
      const englishRain = "The next rain will pause, fill the tank, overflow safely, and sink in — instead of hurrying away.";
      await page.evaluate(text => {
        const app = window.__PERMAGARDEN_APP__;
        const whisper = { key: "challenge:rain", text };
        app.setState({ gardenWhisper: whisper, gardenWhisperQueue: [] }, () => app.presentGardenWhisper(whisper));
      }, englishRain);
      check(await until(() => page.evaluate(() => {
        const voice = window.__PERMAGARDEN_APP__._gardenVoice;
        return !!voice && voice.currentTime > 0.2 && /\/fr\/challenge-rain\.mp3$/.test(voice.src);
      })), "fr: the rain challenge's whisper plays its French line");
      await page.waitForTimeout(10600);
      const stillOpen = await page.evaluate(() => !!window.__PERMAGARDEN_APP__.state.gardenWhisper);
      check(stillOpen, "fr: the whisper is still open after the English text's 10.3 s, while the French line is said");
      check(await until(() => page.evaluate(() => !window.__PERMAGARDEN_APP__.state.gardenWhisper), 5000), "fr: the whisper closes once the line has been said");
    }
    await context.close();
  }

  // Another language hears the English voice and says so.
  {
    const { context, page, requests } = await open("de");
    check(await page.locator(".pg-audio-language-note").count() > 0, 'de: the "audio in English" note is shown');
    await page.locator(".pg-story-primary").first().click();
    check(await until(() => requests.includes("/assets/audio/story/narration-01.mp3")), "de: the story plays the English narration");
    check(!requests.some(p => /\/assets\/audio\/story\/(cs|fr)\//.test(p)), "de: no Czech or French narration is fetched");
    await page.evaluate(() => window.__PERMAGARDEN_APP__.stopAllAudio());
    await context.close();
  }

  // The French story on a phone: the subtitle of every scene is the spoken text.
  {
    const { context, page } = await open("fr", { width: 390, height: 844 });
    await page.locator(".pg-story-primary").first().click();
    for (let scene = 0; scene < 7; scene += 1) {
      await page.evaluate(index => window.__PERMAGARDEN_APP__.goStory(index), scene);
      const caption = (await page.locator(".pg-story-caption p").first().textContent()).trim();
      const spoken = manifests.fr.cues.find(cue => cue.id === `story-0${scene + 1}`).caption;
      check(caption === spoken, `fr phone: scene ${scene + 1} shows what the voice says`, { caption, spoken });
    }
    await page.evaluate(() => window.__PERMAGARDEN_APP__.stopAllAudio());
    await context.close();
  }

  check(errors.length === 0, "no page or console errors", errors);
  console.log("GARDEN VOICE JOURNEY COMPLETE");
} finally {
  await browser.close();
}
