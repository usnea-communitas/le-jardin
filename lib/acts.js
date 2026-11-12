(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PermacultureActs = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // The six acts of the guided journey, what opens along the way, and when a
  // garden has completed its first cycle and when it flourishes.
  //
  // Rules only (docs/ARCHITECTURE.md): the game keeps the words of each act
  // (eyebrow, label, why, the Garden's line), of each unlock card and of each
  // missing step, and asks these functions.
  const VERSION = "1.0.0";

  const ACTS = Object.freeze(["soil", "water", "food", "shelter", "share", "challenge"]);

  // The first four acts are done while the garden has one of these elements:
  // they describe the garden as it is now, so removing the last one undoes the
  // act. "share" and "challenge" are moments: done once, they stay done.
  const ACT_ELEMENTS = deepFreeze({
    soil: ["compost", "mulch", "hugel"],
    water: ["rain"],
    food: ["hugel", "arch", "herbspiral", "greenhouse", "appletree", "crop_potato", "crop_root", "crop_leafy", "crop_cabbage", "crop_herb"],
    shelter: ["bughotel", "birdhouse", "pollinator"]
  });

  // Unlock cards, in the order the game shows them.
  const UNLOCKS = Object.freeze(["sharing", "seedbank", "kitchen", "askgarden", "seedsaved"]);

  // A flourishing garden: a full year of four seasons, every resilience value at
  // 45 or more, two active design connections, two gifts, one harvest and the
  // learning of three different challenges.
  const FLOURISHING = Object.freeze({ seasons: 4, resilience: 45, connections: 2, gifts: 2, challenges: 3 });

  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.keys(value).forEach(key => deepFreeze(value[key]));
    }
    return value;
  }

  function hasMoment(st, key) {
    return (st.journeyMoments || []).indexOf(key) >= 0;
  }

  // Which acts are done ({soil: true, …}): an element act while the garden has
  // one of its elements; "share" after a gift (a shared act or the moment);
  // "challenge" after the challenge moment.
  function actsDone(st) {
    const types = new Set((st.placed || []).map(p => p.type));
    const has = act => ACT_ELEMENTS[act].some(type => types.has(type));
    return {
      soil: has("soil"),
      water: has("water"),
      food: has("food"),
      shelter: has("shelter"),
      share: hasMoment(st, "share") || (st.sharedActs || 0) > 0,
      challenge: hasMoment(st, "challenge")
    };
  }

  // Where the journey is: the acts done, how many, the current act (the first
  // one not done, or the last when all are) and its index.
  function progress(st) {
    const done = actsDone(st);
    const count = ACTS.filter(act => done[act]).length;
    const open = ACTS.findIndex(act => !done[act]);
    const index = open < 0 ? ACTS.length - 1 : open;
    return { done, count, total: ACTS.length, current: ACTS[index], index, ready: count === ACTS.length };
  }

  // The community table opens with the fifth act, at once in free play, and
  // stays open after the first gift.
  function sharingOpen(st) {
    return st.mode === "explore" || hasMoment(st, "share") || progress(st).index >= 4;
  }

  // The garden can be asked (Living Lesson) in free play, after two acts or
  // once two elements stand in the garden.
  function askingOpen(st) {
    return st.mode === "explore" || progress(st).count >= 2 || (st.placed || []).length >= 2;
  }

  // Wild neighbours may visit from the fourth act on (or once its moment came),
  // and at once in free play.
  function wildlifeIntroduced(st) {
    return st.mode === "explore" || progress(st).index >= 3 || hasMoment(st, "shelter");
  }

  // Pests may break out only in free play or after the whole journey: the
  // guided journey is never interrupted before the player has finished it.
  function pestsAllowed(st) {
    return !(st.mode === "guided" && !progress(st).ready);
  }

  function unlocked(key, st) {
    const placed = st.placed || [];
    if (key === "sharing") return sharingOpen(st);
    if (key === "seedbank") return placed.some(p => p.type === "seedbank");
    if (key === "kitchen") return placed.some(p => p.type === "kitchen");
    if (key === "askgarden") return askingOpen(st) && (progress(st).count >= 2 || placed.length >= 3);
    if (key === "seedsaved") return Object.keys(st.seedStock || {}).some(type => ((st.seedStock || {})[type] || 0) > 0);
    return false;
  }

  // The next unlock card to show, or null: the first one that is open and not
  // seen yet. Never during the opening story or the introduction.
  function nextUnlock(st) {
    if (st.story || st.intro) return null;
    const seen = st.unlocksSeen || [];
    return UNLOCKS.find(key => seen.indexOf(key) < 0 && unlocked(key, st)) || null;
  }

  // What the guided journey suggests next, or null: in the fifth act "share"
  // when the basket holds something that can be shared now (`shareable`),
  // "pick" while cherries hang on the tree and the table is open, "grow"
  // otherwise; in the sixth act "season".
  function nudge(st, shareable) {
    if ((st.mode || "guided") !== "guided") return null;
    const journey = progress(st);
    if (journey.ready) return null;
    if (journey.current === "share") {
      if (shareable) return "share";
      if ((st.cherryPicks || 0) > 0 && sharingOpen(st)) return "pick";
      return "grow";
    }
    if (journey.current === "challenge") return "season";
    return null;
  }

  function challengeKinds(st) {
    const effects = st.gardenEffects || {};
    return Object.keys(effects).filter(key => Number(effects[key]) > 0).length;
  }

  // The first cycle is complete when all six acts are done and the garden shows
  // at least one relationship (`links`, the visible links between elements). A
  // flourishing garden also meets FLOURISHING. `values` are the resilience
  // values (soil, water, food, habitat) and `connections` the active design
  // connections. `missing` lists what is still missing, in the order the game
  // explains it: "act" or "relationship", then "seasons", "resilience",
  // "connections", "gifts", "harvest", "challenges".
  function completion(st, facts) {
    const journey = progress(st);
    const firstCycleReady = journey.ready && facts.links > 0;
    const kinds = challengeKinds(st);
    const values = facts.values || {};
    const missing = [];
    if (!firstCycleReady) missing.push(journey.ready ? "relationship" : "act");
    if ((st.seasonTurns || 0) < FLOURISHING.seasons) missing.push("seasons");
    if (Object.keys(values).some(key => values[key] < FLOURISHING.resilience)) missing.push("resilience");
    if (facts.connections < FLOURISHING.connections) missing.push("connections");
    if ((st.sharedActs || 0) < FLOURISHING.gifts) missing.push("gifts");
    if (!st.harvestEver) missing.push("harvest");
    if (kinds < FLOURISHING.challenges) missing.push("challenges");
    return { firstCycleReady, flourishingReady: missing.length === 0, missing, challengeKinds: kinds };
  }

  return {
    VERSION,
    ACTS,
    ACT_ELEMENTS,
    UNLOCKS,
    FLOURISHING,
    hasMoment,
    actsDone,
    progress,
    sharingOpen,
    askingOpen,
    wildlifeIntroduced,
    pestsAllowed,
    unlocked,
    nextUnlock,
    nudge,
    challengeKinds,
    completion
  };
});
