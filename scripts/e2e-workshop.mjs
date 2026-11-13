// Workshop mode (?workshop=1): entering it, starting a group at the third act,
// the offline-only Living Lesson, the facilitator's panel with its session log,
// and preparing the device for the next group. Anyone's own game on the device
// must stay byte for byte the same throughout.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "./load-playwright.mjs";

const require = createRequire(import.meta.url);
const workshop = require("../lib/workshop.js");

const baseUrl = process.env.GAME_URL || "http://127.0.0.1:8787/";
const at = query => new URL(query, baseUrl).href;

const check = (condition, message, evidence) => {
  if (!condition) throw new Error(message + (evidence === undefined ? "" : "\nEvidence: " + JSON.stringify(evidence, null, 2)));
  console.log("PASS  " + message);
};

// Someone's own game, plus the Living Lesson's own keys, already on the device.
const ownGame = {
  placed: [{ id: "p1", type: "mulch", x: 40, y: 52, placedAtTurn: 0 }, { id: "p2", type: "rain", x: 61, y: 40, placedAtTurn: 0 }],
  shares: 7, budget: 210, pool: 65, goodwill: 0, given: 0, awarded: [], market: [],
  storySeen: true, introSeen: true, mode: "explore", journeyMoments: ["soil", "water"], gardenEffects: {},
  discovered: [], seenWildlife: [], sharedActs: 0, muted: true, playerName: "Own game", season: "Autumn",
  unlocksSeen: ["sharing", "seedbank", "kitchen", "askgarden", "seedsaved"], gatesPlayed: {}
};
const ownKeys = {
  [workshop.PERSONAL_SAVE_KEY]: JSON.stringify(ownGame),
  permagarden_living_lessons_v1: JSON.stringify({ entries: {} }),
  permagarden_living_lesson_quota_v1: JSON.stringify({ day: "2026-11-12", count: 1 }),
  permagarden_living_lesson_client_v1: "garden_ownclient123"
};
const readOwn = page => page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(ownKeys));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push("pageerror: " + error.message));
page.on("console", message => { if (message.type() === "error") errors.push("console: " + message.text()); });
let apiCalls = 0;
await page.route("**/api/garden-reflection", route => { apiCalls += 1; return route.fulfill({ status: 503, contentType: "application/json", body: "{}" }); });

const waitForApp = () => page.waitForFunction(() => window.__PERMAGARDEN_APP__ && window.__PERMAGARDEN_APP__.state, null, { timeout: 15000 });
const app = fn => page.evaluate(fn);
// The garden's own messages (a new wild neighbour, an unlocked feature) come and go
// by themselves; a facilitator closes them before opening the panel, and so does this test.
const clearPopups = async () => {
  await app(() => window.__PERMAGARDEN_APP__.setState({ gardenWhisper: null, gardenWhisperQueue: [], unlockCard: null, unlocksSeen: ["sharing", "seedbank", "kitchen", "askgarden", "seedsaved"], gardenReflection: null, gardenReflectionQueue: [], guildCard: null, guildCardQueue: [], arrivalQueue: [], returnQueue: [], inspectCritter: null, visit: null }));
  await page.waitForTimeout(150);
};

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await waitForApp();
  await page.evaluate(seed => { localStorage.clear(); Object.entries(seed).forEach(([key, value]) => localStorage.setItem(key, value)); }, ownKeys);
  const ownBefore = await readOwn(page);

  // 1. Entering the mode: the cover asks where the group begins.
  await page.goto(at("?workshop=1&lang=en"), { waitUntil: "domcontentloaded" });
  await waitForApp();
  const select = page.getByTestId("workshop-start");
  await select.waitFor({ state: "visible", timeout: 15000 });
  const cover = await page.evaluate(() => ({
    label: document.querySelector('label[for="pg-ws-start-select"]')?.textContent.trim(),
    options: Array.from(document.querySelectorAll('[data-testid="workshop-start"] option')).map(o => [o.value, o.textContent.trim()]),
    value: document.querySelector('[data-testid="workshop-start"]').value,
    skip: Array.from(document.querySelectorAll(".pg-story-cover button")).some(b => /Skip story/.test(b.textContent)),
    store: window.__PERMAGARDEN_APP__.STORE
  }));
  check(cover.label === "Where does this group begin?" && cover.options.length === 7 && cover.value === "story", "the workshop link opens the story cover with a choice of where the group begins", cover);
  check(cover.options[3][1] === "Third act · Useful abundance", "the choices are the opening story and the six acts by their names", cover.options);
  check(!cover.skip && cover.store === workshop.SAVE_KEY, "the cover offers one way in and the workshop keeps its own save", cover);

  // Every start point matches the game's own journey and leaves every connection to discover.
  const presets = await app(() => [1, 2, 3, 4, 5, 6].map(n => {
    const game = window.__PERMAGARDEN_APP__, save = window.PermacultureWorkshop.presetSave(n), journey = game.journeyModel(save);
    return { n, done: journey.done, current: journey.current.key, connections: game.activeGuilds(save.placed).length, wildlife: game.activeOf(save.placed).size };
  }));
  check(presets.every(p => p.done === p.n - 1 && p.current === workshop.ACT_KEYS[p.n - 1] && p.connections === 0 && p.wildlife === 0), "each start point completes exactly the acts before it, with no ready-made connection or wild neighbour", presets);

  // 2. Starting the group at the third act.
  await select.selectOption("3");
  check(new URL(page.url()).searchParams.get("act") === "3", "the address remembers the chosen start");
  check(await page.getByRole("button", { name: /Begin at this act/ }).isVisible() && !(await page.getByRole("button", { name: /Begin the story/ }).isVisible()), "choosing an act changes the main button");
  await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded" }), page.getByTestId("workshop-begin").click()]);
  await waitForApp();
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__.state.workshopLog, null, { timeout: 10000 });
  const started = await app(() => {
    const game = window.__PERMAGARDEN_APP__, journey = game.journeyModel(game.state);
    return { done: journey.done, current: journey.current.key, story: game.state.story, intro: game.state.intro, mode: game.state.mode, types: game.state.placed.map(p => p.type), log: game.state.workshopLog };
  });
  check(started.done === 2 && started.current === "food" && !started.story && !started.intro && started.mode === "guided", "the group starts in the garden at the third act, soil and water done", started);
  check(started.log.from === 3 && started.log.events.length === 1 && started.log.events[0].k === "start", "the session log begins with where the group started", started.log);
  check(await page.getByTestId("workshop-open").isVisible() && !(await page.getByRole("button", { name: "Reset the whole garden" }).count()), "in workshop mode the header offers Workshop instead of Reset");

  // 3. Playing: the third act completes and the log notes it.
  await app(() => window.__PERMAGARDEN_APP__.placeType("herbspiral", 52, 56, "auto"));
  await page.waitForFunction(() => window.__PERMAGARDEN_APP__.state.workshopLog.events.some(e => e.k === "act" && e.act === "food"), null, { timeout: 5000 });
  check(true, "completing the third act is written to the session log");

  // 4. The Living Lesson never calls the model in a workshop.
  await app(() => window.__PERMAGARDEN_APP__.openLivingLesson());
  await page.waitForFunction(() => { const box = window.__PERMAGARDEN_APP__.state.livingLesson; return box && box.status === "ready"; }, null, { timeout: 5000 });
  const lesson = await app(() => { const box = window.__PERMAGARDEN_APP__.state.livingLesson; return { source: box.lesson.source, attribution: document.querySelector('[data-testid="living-lesson-attribution"]')?.textContent || "" }; });
  check(lesson.source === "fallback" && /Garden wisdom offline/.test(lesson.attribution) && apiCalls === 0, "the Living Lesson answers from the offline lesson, with no request to the API", { ...lesson, apiCalls });
  await app(() => window.__PERMAGARDEN_APP__.closeLivingLesson());
  await page.waitForTimeout(150);
  await clearPopups();

  // 5. The facilitator's panel.
  await page.getByTestId("workshop-open").click();
  const dialog = page.locator('[data-pg-dialog="workshop"]');
  await dialog.waitFor({ state: "visible", timeout: 5000 });
  // focus moves in a moment after the panel appears (later in Firefox and WebKit)
  await page.waitForFunction(() => {
    const d = document.querySelector('[data-pg-dialog="workshop"]');
    return !!d && d.contains(document.activeElement);
  }, null, { timeout: 3000 }).catch(() => {});
  const panel = await page.evaluate(() => {
    const d = document.querySelector('[data-pg-dialog="workshop"]');
    return {
      name: document.getElementById(d.getAttribute("aria-labelledby"))?.textContent.trim(),
      focusInside: d.contains(document.activeElement),
      current: d.querySelector('[data-testid="workshop-current-act"]')?.textContent.trim(),
      ask: d.querySelector(".pg-ws-question p")?.textContent.trim(),
      acts: Array.from(d.querySelectorAll(".pg-ws-act")).map(li => li.className),
      log: Array.from(d.querySelectorAll('[data-testid="workshop-log"] li')).map(li => li.textContent.trim()),
      headings: Array.from(d.querySelectorAll("h2,h3")).map(h => h.tagName),
      guide: d.querySelector('[data-testid="workshop-guide"]')?.getAttribute("href"),
      others: Array.from(d.querySelectorAll(".pg-ws-langs a")).map(a => a.getAttribute("href")),
      h1: document.querySelectorAll("h1").length
    };
  });
  check(panel.name === "For the facilitator" && panel.focusInside, "the panel is a named dialog and focus moves into it", panel);
  check(panel.current.startsWith("Fourth act · Room for others") && /besides food/.test(panel.ask), "it shows where the group is and a question to ask", panel);
  check(panel.acts.length === 6 && panel.acts.filter(c => /is-done/.test(c)).length === 3 && /is-current/.test(panel.acts[3]), "the six acts show three done and the fourth as the current one", panel.acts);
  // with the compost already there, the herb spiral also welcomed the field cap
  check(panel.log.length === 3 && /A wild neighbour arrived: Field cap/.test(panel.log[0]) && /Act complete: Third act · Useful abundance/.test(panel.log[1]) && /Began at Third act · Useful abundance/.test(panel.log[2]), "the log shows the newest entry first", panel.log);
  check(panel.headings.join(",") === "H2,H3,H3,H3,H3,H3" && panel.h1 === 1, "one h1 on the page, the panel's h2 and its h3 sections", panel);
  check(panel.guide === "docs/facilitator/pdf/le-jardin-facilitator-guide-en.pdf" && panel.others.length === 2, "the guide links to the PDF in the game's language and the other two", panel);
  const guide = await context.request.get(at(panel.guide));
  check(guide.ok() && (await guide.body()).subarray(0, 5).toString() === "%PDF-", "the facilitator guide PDF is served");

  // The six acts open to their goal and question.
  await dialog.locator(".pg-ws-act summary").first().click();
  check(await dialog.locator(".pg-ws-act details").first().evaluate(d => d.open), "an act opens to show its goal and question");

  // Saving the log as a text file.
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("workshop-save-log").click()]);
  const text = await readFile(await download.path(), "utf8");
  check(/^le-jardin-workshop-log-\d{4}-\d{2}-\d{2}\.txt$/.test(download.suggestedFilename()) && text.startsWith("Le Jardin — workshop log\n") && /\d\d:\d\d {2}Began at Third act · Useful abundance/.test(text) && /Nothing in it is sent anywhere\.\n$/.test(text), "the log saves as a plain text file in time order", { file: download.suggestedFilename(), text });
  check(/Saved on this device as le-jardin-workshop-log-/.test(await dialog.locator(".pg-ws-status").textContent()), "the panel says where the log was saved");

  // Printing prints only the log, on a portrait page.
  const printed = await page.evaluate(() => {
    let sheet = null;
    const original = window.print;
    window.print = () => { const el = document.getElementById("pg-workshop-print"); sheet = { text: el && el.innerText, cls: document.documentElement.classList.contains("pg-print-log"), page: document.getElementById("pg-workshop-print-page")?.textContent }; };
    document.querySelector('[data-testid="workshop-print-log"]').click();
    window.dispatchEvent(new Event("afterprint"));
    window.print = original;
    return { sheet, after: !!document.getElementById("pg-workshop-print") || document.documentElement.classList.contains("pg-print-log") };
  });
  check(printed.sheet && printed.sheet.cls && /portrait/.test(printed.sheet.page) && /Began at Third act/.test(printed.sheet.text) && !printed.after, "printing builds a portrait log sheet and removes it afterwards", printed);

  // Escape closes the panel and focus returns to the Workshop button.
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached", timeout: 3000 });
  check(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("data-testid") === "workshop-open"), "Escape closes the panel and returns focus to the Workshop button");

  // On a phone the menu offers Workshop instead of Reset.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await clearPopups();
  await page.locator("#pg-header-more").click();
  const menu = await page.evaluate(() => Array.from(document.querySelectorAll('.pg-header-menu [role="menuitem"]')).map(b => b.textContent.trim()));
  check(menu.some(t => /Workshop/.test(t)) && !menu.some(t => /Reset garden/.test(t)), "the phone menu offers Workshop instead of Reset garden", menu);
  await page.getByTestId("workshop-open-menu").click();
  await dialog.waitFor({ state: "visible", timeout: 3000 });
  const fit = await page.evaluate(() => { const d = document.querySelector('[data-pg-dialog="workshop"]').getBoundingClientRect(); return { left: d.left, right: d.right, width: innerWidth, scroll: document.documentElement.scrollWidth }; });
  check(fit.left >= 0 && fit.right <= fit.width && fit.scroll <= fit.width, "the panel fits a 390 px phone without sideways scrolling", fit);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached", timeout: 3000 });
  check(await page.evaluate(() => document.activeElement && document.activeElement.id === "pg-header-more"), "closed from the phone menu, focus returns to the menu button");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(250);

  // 6. Preparing for the next group.
  await clearPopups();
  await page.getByTestId("workshop-open").click();
  await dialog.waitFor({ state: "visible", timeout: 3000 });
  let asked = "";
  page.once("dialog", d => { asked = d.message(); d.accept(); });
  await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded" }), page.getByTestId("workshop-next-group").click()]);
  await waitForApp();
  await select.waitFor({ state: "visible", timeout: 15000 });
  const next = await page.evaluate(keys => ({
    save: localStorage.getItem(keys.save), log: localStorage.getItem(keys.log),
    value: document.querySelector('[data-testid="workshop-start"]').value, act: new URL(location.href).searchParams.get("act")
  }), { save: workshop.SAVE_KEY, log: workshop.LOG_KEY });
  check(/Prepare for the next group\?/.test(asked), "preparing for the next group asks first", asked);
  check(next.save === null && next.log === null && next.value === "3" && next.act === "3", "the workshop garden and its log are gone and the next group starts where this one did", next);

  // 7. The opening story is a start point too.
  await select.selectOption("story");
  await page.getByRole("button", { name: /Begin the story/ }).click();
  await page.waitForFunction(() => { const s = window.__PERMAGARDEN_APP__.state; return s.storyStarted && s.workshopLog && s.workshopLog.from === "story"; }, null, { timeout: 5000 });
  check(true, "beginning with the opening story starts the session log");

  // 8. Anyone's own game stayed exactly as it was.
  check(JSON.stringify(await readOwn(page)) === JSON.stringify(ownBefore), "anyone's own game and the Living Lesson keys stay byte for byte the same", { before: ownBefore, after: await readOwn(page) });
  check(apiCalls === 0, "no request reached the Living Lesson API");

  // 9. Without the workshop link the game is the player's own.
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await waitForApp();
  await page.waitForTimeout(300);
  const own = await app(() => { const game = window.__PERMAGARDEN_APP__; return { store: game.STORE, name: game.state.playerName, season: game.state.season, workshop: !!document.querySelector('[data-testid="workshop-open"]') }; });
  check(own.store === workshop.PERSONAL_SAVE_KEY && own.name === "Own game" && own.season === "Autumn" && !own.workshop, "the ordinary link still opens the player's own garden, with no workshop controls", own);

  // 10. In Czech, for a new session on this device.
  await page.evaluate(keys => { localStorage.removeItem(keys.save); localStorage.removeItem(keys.log); }, { save: workshop.SAVE_KEY, log: workshop.LOG_KEY });
  await page.goto(at("?workshop=1&lang=cs"), { waitUntil: "domcontentloaded" });
  await waitForApp();
  await page.getByRole("button", { name: /Začít příběh/ }).waitFor({ state: "visible", timeout: 15000 });
  const czech = await page.evaluate(() => ({ label: document.querySelector('label[for="pg-ws-start-select"]')?.textContent.trim(), third: document.querySelector('[data-testid="workshop-start"] option[value="3"]')?.textContent.trim() }));
  check(czech.label === "Kde tahle skupina začne?" && czech.third === "Třetí dějství · Užitečná hojnost", "the workshop cover speaks Czech", czech);

  // 11. A teacher who found the game alone: "Playing with a group?" on the cover and in How to play.
  for (const [width, height] of [[1440, 900], [360, 740]]) {
    const fresh = await browser.newContext({ viewport: { width, height } });
    const visitor = await fresh.newPage();
    visitor.on("pageerror", error => errors.push("pageerror: " + error.message));
    await visitor.route("**/api/garden-reflection", route => { apiCalls += 1; return route.fulfill({ status: 503, contentType: "application/json", body: "{}" }); });
    await visitor.goto(at("?lang=en"), { waitUntil: "domcontentloaded" });
    await visitor.waitForFunction(() => window.__PERMAGARDEN_APP__ && window.__PERMAGARDEN_APP__.state, null, { timeout: 15000 });
    const entry = visitor.getByTestId("group-entry-cover");
    await entry.scrollIntoViewIfNeeded();
    await entry.waitFor({ state: "visible", timeout: 5000 });
    const seen = await visitor.evaluate(() => {
      const box = document.querySelector('[data-testid="group-entry-cover"]').getBoundingClientRect();
      return { left: box.left, right: box.right, width: innerWidth, sideways: document.documentElement.scrollWidth - innerWidth,
        workshop: document.querySelector('[data-testid="group-entry-cover-workshop"]').getAttribute("href"),
        guide: document.querySelector('[data-testid="group-entry-cover-guide"]').getAttribute("href") };
    });
    check(seen.left >= 0 && seen.right <= seen.width && seen.sideways <= 0, `${width} px: the cover says workshop mode exists, inside the screen`, seen);
    check(seen.workshop === "?workshop=1&lang=en" && /le-jardin-facilitator-guide-en\.pdf$/.test(seen.guide), `${width} px: it links workshop mode and the English guide`, seen);
    const pdf = await fresh.request.get(new URL(seen.guide, baseUrl).href);
    check(pdf.ok() && (await pdf.body()).subarray(0, 5).toString() === "%PDF-", `${width} px: the guide it links is served`, pdf.status());
    // reachable by keyboard from the start of the cover
    await visitor.evaluate(() => document.activeElement && document.activeElement.blur());
    let reached = false;
    for (let i = 0; i < 30 && !reached; i += 1) {
      await visitor.keyboard.press("Tab");
      reached = await visitor.evaluate(() => document.activeElement && document.activeElement.dataset.testid === "group-entry-cover-workshop");
    }
    check(reached, `${width} px: the keyboard reaches "Open workshop mode"`);
    if (width === 1440) {
      // How to play says it too
      await visitor.evaluate(() => window.__PERMAGARDEN_APP__.setState({ story: false, storySeen: true }));
      await visitor.evaluate(() => window.__PERMAGARDEN_APP__.openIntro());
      await visitor.getByTestId("group-entry-help").waitFor({ state: "visible", timeout: 5000 });
      check(/Playing with a group\?/.test(await visitor.getByTestId("group-entry-help").innerText()), "How to play says workshop mode exists");
      await visitor.keyboard.press("Escape");
      // and Enter on the link opens workshop mode (a first visit again: the story has not been seen)
      await visitor.evaluate(() => localStorage.clear());
      await visitor.goto(at("?lang=en"), { waitUntil: "domcontentloaded" });
      await visitor.waitForFunction(() => window.__PERMAGARDEN_APP__ && window.__PERMAGARDEN_APP__.state, null, { timeout: 15000 });
      await visitor.getByTestId("group-entry-cover-workshop").focus();
      await Promise.all([visitor.waitForURL(/\?workshop=1&lang=en$/), visitor.keyboard.press("Enter")]);
      await visitor.getByTestId("workshop-start").waitFor({ state: "visible", timeout: 15000 });
      check(await visitor.getByTestId("group-entry-cover").count() === 0, "in workshop mode the cover asks where the group begins instead");
    }
    await fresh.close();
  }
  {
    const fresh = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const visitor = await fresh.newPage();
    await visitor.goto(at("?lang=cs"), { waitUntil: "domcontentloaded" });
    await visitor.waitForFunction(() => window.__PERMAGARDEN_APP__ && window.__PERMAGARDEN_APP__.state, null, { timeout: 15000 });
    const czech = await visitor.evaluate(() => ({ text: document.querySelector('[data-testid="group-entry-cover"]').innerText, guide: document.querySelector('[data-testid="group-entry-cover-guide"]').getAttribute("href") }));
    check(/Hrajete se skupinou\?/.test(czech.text) && /Otevřít režim workshopu/.test(czech.text) && /guide-cs\.pdf$/.test(czech.guide), "in Czech it speaks Czech and links the Czech guide", czech);
    await fresh.close();
  }

  check(errors.length === 0, "no page or console errors", errors);
} finally {
  await browser.close();
}
