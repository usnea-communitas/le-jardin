# Browsers

The core journeys run in Chromium in CI (`npm run test:e2e:core`), and in
WebKit (the engine of Safari) and Firefox in the **Browsers** workflow beside
it (`npm run test:e2e:webkit`, `npm run test:e2e:firefox`; any journey runs in
another engine with `BROWSER=webkit` or `BROWSER=firefox`). Browsers is not a
required check; it is read before every merge. WebKit in Playwright is not
Safari on an iPhone: a real device still has to confirm sound, the home
screen, the phone keyboard and how Safari keeps data.

`scripts/load-playwright.mjs` picks the engine. It leaves Chromium's own
launch switches out of the other engines, lets Firefox play sound without a
click where the journey asks Chromium to, gives Firefox its pages without
mobile emulation (`isMobile`), which it does not have, and keeps from the
journeys the console errors Firefox reports for fonts a navigation
interrupts (NS_BINDING_ABORTED).

## Found and fixed

- **A returning player's garden was not always kept for good.** The game
  asked the browser to keep its storage only after a change; a player who
  opened a garden and looked at it never got asked. The game now asks once
  the page has settled when a stored garden has elements.
- **Without a connection, sound left out of the download failed loudly in
  Safari.** The service worker passed a failed fetch on to the page, which
  WebKit reports as an error. Sound and moving pictures not in the download
  now get a quiet "offline" answer.
- Journeys that waited a fixed time now wait for what they check (the gate's
  board and result, the facilitator panel's focus), and the garden-file
  journey counts the storage requests on the prototype, where WebKit sees
  them.
- Each engine reports a failed load in its own words. The journeys that
  allow some loads to fail (the offline journey: music and moving pictures
  left out of the download) check which ones failed on their own and ignore
  the console line for it, in Firefox too ("A ServiceWorker intercepted the
  request…"). WebKit also asks for `sw.js` without a connection, its own
  check for a newer worker; the first visit may fetch
  `manifest.webmanifest`, which WebKit does and the others do not.

## Left out, and why

| Journey | Engine | Why |
| --- | --- | --- |
| `e2e-voice.mjs` | WebKit, Firefox | Sound does not play there in Playwright on machines without an audio device, so the subtitles never follow the voice. Chromium covers it; a real iPhone and a Mac with Safari or Firefox confirm it. |
| `e2e-release-audit.mjs` | WebKit | WebKit without a graphics card (CI, containers) draws the seasonal gates too slowly for the audit's timing. Firefox and Chromium run it; check the gates on a real Mac or iPhone. |
