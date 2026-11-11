(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PermacultureWorkshop = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Workshop mode (a link with ?workshop=1): a facilitator runs the game with
  // groups on shared devices. Its garden and its session log live under their
  // own storage keys, so a workshop never reads, changes or clears anyone's own
  // game on the device. Nothing here touches the network.
  const VERSION = "1.0.0";
  const SAVE_KEY = "permagarden_workshop_v1";
  const LOG_KEY = "permagarden_workshop_log_v1";
  const PERSONAL_SAVE_KEY = "permagarden_v2";
  const ACT_KEYS = ["soil", "water", "food", "shelter", "share", "challenge"];
  const START_POINTS = ["story", 1, 2, 3, 4, 5, 6];
  const GUIDE_LOCALES = ["en", "cs", "fr"];
  const GUIDE_PREFIX = "docs/facilitator/pdf/le-jardin-facilitator-guide-";
  const MAX_EVENTS = 400;
  const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];
  const KEY_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

  // The garden a group finds at the start of an act: each earlier act is done
  // with one plain element, paid for as a player would pay, and the elements
  // stand far apart so every design connection and every wild neighbour is
  // still the group's own discovery.
  const PRESET_STEPS = [
    { act: "soil", element: { id: "w-soil", type: "compost", x: 22, y: 34, paidMethod: "barter", paidAmount: 1 }, shares: 1 },
    { act: "water", element: { id: "w-water", type: "rain", x: 76, y: 30, paidMethod: "buy", paidAmount: 90 }, budget: 90 },
    { act: "food", element: { id: "w-food", type: "appletree", x: 28, y: 70, paidMethod: "barter", paidAmount: 2 }, shares: 2 },
    { act: "shelter", element: { id: "w-shelter", type: "birdhouse", x: 72, y: 68, paidMethod: "buy", paidAmount: 35 }, budget: 35 },
    { act: "share" }
  ];

  function text(value, max) {
    return String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
  }

  function count(value, max) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0;
  }

  function iso(now) {
    const date = now instanceof Date ? now : new Date(typeof now === "number" ? now : Date.now());
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  function validTime(value) {
    return typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value)) ? value : null;
  }

  function normalizeStart(value) {
    if (typeof value === "number") return Number.isInteger(value) && value >= 1 && value <= 6 ? value : null;
    const raw = String(value == null ? "" : value).trim().toLowerCase();
    if (raw === "story") return "story";
    return /^[1-6]$/.test(raw) ? Number(raw) : null;
  }

  function readQuery(search) {
    let params = null;
    try { params = new URLSearchParams(String(search || "")); } catch (_) { params = null; }
    if (!params) return { enabled: false, start: null };
    const flag = String(params.get("workshop") || "").trim().toLowerCase();
    const enabled = flag === "1" || flag === "true" || flag === "yes";
    return { enabled, start: enabled ? normalizeStart(params.get("act")) : null };
  }

  function presetSave(act) {
    const start = normalizeStart(act);
    const n = typeof start === "number" ? start : 1;
    const save = {
      placed: [], shares: 10, budget: 300, pool: 65, goodwill: 0, given: 0, awarded: [],
      storySeen: true, introSeen: true, mode: "guided",
      journeyMoments: [], gardenEffects: {}, gatesPlayed: {}, discovered: [], seenWildlife: [],
      sharedActs: 0, season: "Summer", seasonTurns: 0, cherryPicks: 3, harvestEver: false,
      basket: {}, materials: {}, unlocksSeen: [], gardenReflectionsSeen: [], playerName: ""
    };
    PRESET_STEPS.slice(0, n - 1).forEach(step => {
      if (step.element) save.placed.push(Object.assign({ usedMaterials: [], placedAtTurn: 0 }, step.element));
      save.shares -= step.shares || 0;
      save.budget -= step.budget || 0;
      save.journeyMoments.push(step.act);
    });
    // The garden's reflections for acts the group did not play stay quiet.
    if (n > 3) save.gardenReflectionsSeen.push("three-layers");
    if (n > 5) {
      // The fair-share act is done: one cherry cluster was picked and given
      // to the community table, exactly as the game records a first gift.
      Object.assign(save, { cherryPicks: 2, harvestEver: true, given: 1, sharedActs: 1, pool: 71, goodwill: 1 });
      save.unlocksSeen.push("sharing");
      save.gardenReflectionsSeen.push("fair-share");
    }
    return save;
  }

  // The acts the start point already counts as done.
  function presetActs(start) {
    const n = normalizeStart(start);
    return typeof n === "number" ? ACT_KEYS.slice(0, n - 1) : [];
  }

  function newLog(start, now) {
    const from = normalizeStart(start) || "story";
    const t = iso(now);
    return { v: 1, startedAt: t, from, acts: presetActs(from), events: [{ t, k: "start", from }] };
  }

  function sanitizeEvent(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const t = validTime(raw.t);
    if (!t) return null;
    const key = typeof raw.key === "string" && KEY_PATTERN.test(raw.key) ? raw.key : null;
    switch (raw.k) {
      case "start": {
        const from = normalizeStart(raw.from);
        return from ? { t, k: "start", from } : null;
      }
      case "act":
        return ACT_KEYS.includes(raw.act) ? { t, k: "act", act: raw.act } : null;
      case "challenge":
        return key ? { t, k: "challenge", key, clues: count(raw.clues, 99) } : null;
      case "challengeLater":
        return key ? { t, k: "challengeLater", key } : null;
      case "season":
        return SEASONS.includes(raw.season) ? { t, k: "season", season: raw.season } : null;
      case "connection":
      case "wildlife":
        return key ? { t, k: raw.k, key } : null;
      case "gift":
        return { t, k: "gift", count: Math.max(1, count(raw.count, 100000)) };
      case "lesson":
      case "ending":
        return { t, k: raw.k };
      case "certificate":
        return { t, k: "certificate", how: raw.how === "print" ? "print" : "save" };
      default:
        return null;
    }
  }

  function capEvents(events) {
    if (events.length <= MAX_EVENTS) return events;
    return [events[0]].concat(events.slice(events.length - (MAX_EVENTS - 1)));
  }

  function sanitizeLog(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.v !== 1) return null;
    const startedAt = validTime(raw.startedAt);
    const from = normalizeStart(raw.from);
    if (!startedAt || !from) return null;
    const events = (Array.isArray(raw.events) ? raw.events : []).slice(0, MAX_EVENTS * 2).map(sanitizeEvent).filter(Boolean);
    const acts = Array.from(new Set((Array.isArray(raw.acts) ? raw.acts : []).filter(act => ACT_KEYS.includes(act))));
    return { v: 1, startedAt, from, acts, events: capEvents(events) };
  }

  // What the session log compares between two moments of the game. The game
  // passes the keys of the acts that are done now and the rest of its state.
  function snapshot(state, doneActs) {
    const st = state && typeof state === "object" ? state : {};
    const list = value => Array.isArray(value) ? value.filter(item => typeof item === "string" && KEY_PATTERN.test(item)) : [];
    return {
      acts: (Array.isArray(doneActs) ? doneActs : []).filter(act => ACT_KEYS.includes(act)),
      season: SEASONS.includes(st.season) ? st.season : "Summer",
      seasonTurns: count(st.seasonTurns, 1000000),
      connections: list(st.discovered),
      wildlife: list(st.seenWildlife),
      gifts: count(st.sharedActs, 1000000),
      lessons: Array.isArray(st.livingLessonHistory) ? st.livingLessonHistory.length : 0,
      ending: !!st.endingSeen
    };
  }

  function diff(before, after, loggedActs) {
    if (!before || !after) return [];
    const logged = new Set(Array.isArray(loggedActs) ? loggedActs : []);
    const events = [];
    after.acts.forEach(act => {
      if (!before.acts.includes(act) && !logged.has(act)) events.push({ k: "act", act });
    });
    if (after.seasonTurns > before.seasonTurns && after.season !== before.season) events.push({ k: "season", season: after.season });
    after.connections.forEach(key => { if (!before.connections.includes(key)) events.push({ k: "connection", key }); });
    after.wildlife.forEach(key => { if (!before.wildlife.includes(key)) events.push({ k: "wildlife", key }); });
    if (after.gifts > before.gifts) events.push({ k: "gift", count: after.gifts });
    if (after.lessons > before.lessons) events.push({ k: "lesson" });
    if (after.ending && !before.ending) events.push({ k: "ending" });
    return events;
  }

  function append(log, events, now) {
    const base = sanitizeLog(log);
    if (!base) return null;
    const t = iso(now);
    const added = (Array.isArray(events) ? events : []).map(event => sanitizeEvent(Object.assign({}, event, { t }))).filter(Boolean);
    if (!added.length) return base;
    const acts = base.acts.slice();
    added.forEach(event => { if (event.k === "act" && !acts.includes(event.act)) acts.push(event.act); });
    return { v: 1, startedAt: base.startedAt, from: base.from, acts, events: capEvents(base.events.concat(added)) };
  }

  function summary(log) {
    const base = sanitizeLog(log);
    const out = { acts: 0, challenges: 0, gifts: 0, connections: 0, wildlife: 0, seasons: 0 };
    if (!base) return out;
    base.events.forEach(event => {
      if (event.k === "act") out.acts += 1;
      else if (event.k === "challenge") out.challenges += 1;
      else if (event.k === "gift") out.gifts = Math.max(out.gifts, event.count);
      else if (event.k === "connection") out.connections += 1;
      else if (event.k === "wildlife") out.wildlife += 1;
      else if (event.k === "season") out.seasons += 1;
    });
    return out;
  }

  // The log as plain text for the facilitator's own records. The game passes
  // the words, so the file is in the language the facilitator is using.
  function logText(log, words) {
    const base = sanitizeLog(log);
    const w = words && typeof words === "object" ? words : {};
    const describe = typeof w.describe === "function" ? w.describe : event => event.k;
    const time = typeof w.time === "function" ? w.time : value => value.slice(11, 16);
    const lines = [text(w.title, 200) || "Le Jardin"];
    (Array.isArray(w.header) ? w.header : []).forEach(line => { const clean = text(line, 400); if (clean) lines.push(clean); });
    lines.push("");
    if (base) base.events.forEach(event => lines.push(time(event.t) + "  " + text(describe(event), 400)));
    const footer = text(w.footer, 400);
    if (footer) lines.push("", footer);
    return lines.join("\n") + "\n";
  }

  function guideLocale(locale) {
    const base = String(locale || "").toLowerCase().split("-")[0];
    return GUIDE_LOCALES.includes(base) ? base : "en";
  }

  function guideHref(locale) {
    return GUIDE_PREFIX + guideLocale(locale) + ".pdf";
  }

  return {
    VERSION,
    SAVE_KEY,
    LOG_KEY,
    PERSONAL_SAVE_KEY,
    ACT_KEYS: ACT_KEYS.slice(),
    START_POINTS: START_POINTS.slice(),
    GUIDE_LOCALES: GUIDE_LOCALES.slice(),
    MAX_EVENTS,
    readQuery,
    normalizeStart,
    presetSave,
    presetActs,
    newLog,
    sanitizeLog,
    snapshot,
    diff,
    append,
    summary,
    logText,
    guideLocale,
    guideHref
  };
});
