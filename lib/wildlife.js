(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PermacultureWildlife = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Wild neighbours: who comes to live in the garden and when, who may visit,
  // how the residents' stories advance, and when a pest breaks out, holds the
  // crops and settles.
  //
  // Rules only (docs/ARCHITECTURE.md): the names, notes, stories, quizzes and
  // pictures are in the canonical source, keyed by the same ids. Where chance
  // plays a part, the game draws the random number and passes it in as `roll`.
  const VERSION = "1.0.0";

  // What each wild neighbour needs to live here. Every need must be met, and a
  // need is met by any one of its elements.
  const HABITATS = deepFreeze([
    { key: "worm", needs: [["compost", "hugel"], ["mulch"]] },
    { key: "winecap", needs: [["mulch"], ["hugel"]] },
    { key: "oyster", needs: [["hugel"], ["mulch", "bughotel"]] },
    { key: "field", needs: [["compost"], ["pollinator", "herbspiral"]] },
    { key: "bee", needs: [["pollinator", "herbspiral", "arch"], ["birdbath"]] },
    { key: "butterfly", needs: [["pollinator", "herbspiral"], ["hugel", "mulch", "arch"]] },
    { key: "bird", needs: [["birdbath"], ["birdhouse"]] },
    { key: "hedgehog", needs: [["mulch", "hugel"], ["pollinator", "compost"]] },
    { key: "ladybug", needs: [["pollinator", "herbspiral"], ["bughotel"]] },
    { key: "beetle", needs: [["bughotel"], ["mulch", "hugel", "compost"]] }
  ]);

  // After an element is placed, a neighbour who is one need short of living
  // here may come to visit (a quiz) with this chance, once a season.
  const VISIT_CHANCE = 0.22;
  // In the first spring after a winter, up to three residents who were away
  // come back.
  const MAX_RETURNING = 3;

  // The residents' stories advance one beat at a time, in order, each when its
  // condition holds. A condition reads the resident's context: `active` (who
  // lives here now), `seasons` and `winters` (how many seasons and winters this
  // resident has lived here in a row) and `v` (the garden's resilience values).
  const RESIDENTS = deepFreeze([
    { key: "hedgehog", beats: [
      { id: "hedgehog-1", when: c => c.active.has("hedgehog") },
      { id: "hedgehog-2", when: c => c.active.has("hedgehog") && c.winters >= 1 },
      { id: "hedgehog-3", when: c => c.active.has("hedgehog") && c.winters >= 1 && c.seasons >= 3 && c.v.habitat >= 52 }
    ] },
    { key: "bee", beats: [
      { id: "bee-1", when: c => c.active.has("bee") },
      { id: "bee-2", when: c => c.active.has("bee") && c.seasons >= 2 },
      { id: "bee-3", when: c => c.active.has("bee") && c.seasons >= 2 && c.v.food >= 45 }
    ] },
    { key: "worm", beats: [
      { id: "worm-1", when: c => c.active.has("worm") },
      { id: "worm-2", when: c => c.active.has("worm") && c.v.soil >= 50 },
      { id: "worm-3", when: c => c.active.has("worm") && c.winters >= 1 && c.v.soil >= 64 }
    ] }
  ]);

  // Pests: in which seasons they may break out, on which crops they feed, which
  // neighbours keep them in balance (`allies`, or the one `ally`) and which
  // elements would bring those neighbours. Their story beats read `active`
  // (feeding now), `cleared` (an ally settled them) and `seasons` (how long).
  const PESTS = deepFreeze([
    { key: "aphid", seasons: ["Spring", "Summer"],
      crops: ["crop_leafy", "crop_herb", "crop_root", "crop_potato", "crop_cabbage"],
      ally: "ladybug", build: ["bughotel", "pollinator", "herbspiral"],
      beats: [
        { id: "aphid-1", when: c => c.active || c.cleared },
        { id: "aphid-2", when: c => (c.active && c.seasons >= 2) || c.cleared },
        { id: "aphid-3", when: c => c.cleared }
      ] },
    { key: "slug", seasons: ["Spring", "Autumn"],
      crops: ["crop_leafy", "crop_cabbage"],
      ally: "hedgehog", allies: ["hedgehog", "beetle", "bird"], build: ["mulch", "hugel", "bughotel", "birdhouse"],
      beats: [
        { id: "slug-1", when: c => c.active || c.cleared },
        { id: "slug-2", when: c => (c.active && c.seasons >= 2) || c.cleared },
        { id: "slug-3", when: c => c.cleared }
      ] },
    { key: "caterpillar", seasons: ["Summer"],
      crops: ["crop_cabbage"],
      ally: "bird", build: ["birdhouse", "birdbath"],
      beats: [
        { id: "caterpillar-1", when: c => c.active || c.cleared },
        { id: "caterpillar-2", when: c => (c.active && c.seasons >= 2) || c.cleared },
        { id: "caterpillar-3", when: c => c.cleared }
      ] }
  ]);
  // After an outbreak settles the garden stays calm for two seasons, and nothing
  // breaks out in the first two seasons of a new garden.
  const PEST_CALM = 2;
  const PEST_FIRST_TURN = 2;

  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.keys(value).forEach(key => deepFreeze(value[key]));
    }
    return value;
  }

  // Who lives in the garden now: every need met by an element that stands
  // there today. A visit or a quiz won in the past is not a habitat.
  function activeOf(placed) {
    const types = new Set((placed || []).map(p => p.type));
    const active = new Set();
    HABITATS.forEach(w => { if (w.needs.every(need => need.some(type => types.has(type)))) active.add(w.key); });
    return active;
  }

  // Who arrived with a change of the garden (before → after), split into first
  // arrivals and neighbours returning, and the updated list of everyone ever seen.
  function arrivals(placedBefore, placedAfter, seenBefore) {
    const before = activeOf(placedBefore);
    const after = activeOf(placedAfter);
    const arrived = HABITATS.filter(w => after.has(w.key) && !before.has(w.key)).map(w => w.key);
    const seen = new Set(seenBefore || []);
    const first = arrived.filter(key => !seen.has(key));
    const returning = arrived.filter(key => seen.has(key));
    arrived.forEach(key => seen.add(key));
    return { arrived, first, returning, seen: Array.from(seen), active: after };
  }

  // Neighbours who may come to visit: not living here, not already a guest or
  // visited, with a visit in the game (`visits`: the quizzes in the canonical
  // source, which may limit their own `seasons`), not away for the winter
  // (`awayWinter`) and exactly one need short of living here.
  function visitCandidates(st, placedAfter, active, visits, awayWinter) {
    const types = new Set((placedAfter || []).map(p => p.type));
    const season = st.season || "Summer";
    return HABITATS.filter(w => {
      if (active.has(w.key)) return false;
      if ((st.guests || []).indexOf(w.key) >= 0) return false;
      if ((st.visitsDone || {})[w.key]) return false;
      const visit = visits[w.key];
      if (!visit) return false;
      if (season === "Winter" && awayWinter[w.key]) return false;
      if (visit.seasons && visit.seasons.indexOf(season) < 0) return false;
      return w.needs.filter(need => !need.some(type => types.has(type))).length === 1;
    }).map(w => w.key);
  }

  // Whether a visit may start after a placement that brought no new resident:
  // wild neighbours must be introduced (`introduced`, from the journey), no
  // visit, challenge or earlier visit this season may be under way.
  function visitPossible(st, introduced, arrivedCount) {
    return !!introduced && !arrivedCount && !st.visit && !st.gate && st.visitSeason !== (st.season || "Summer");
  }

  // Residents who were away for the winter and come back in spring (at most
  // MAX_RETURNING), from the garden as it stood in winter.
  function returningInSpring(placed, awayWinter) {
    const active = activeOf(placed);
    return HABITATS.filter(w => active.has(w.key) && awayWinter[w.key]).map(w => w.key).slice(0, MAX_RETURNING);
  }

  // How long each resident has lived here as the season turns: one more season
  // for each resident still here (and one more winter when leaving winter); a
  // resident who left starts again from 0.
  function countResidents(st) {
    const active = activeOf(st.placed || []);
    const leavingWinter = (st.season || "Summer") === "Winter";
    const seasons = { ...(st.residentSeasons || {}) };
    const winters = { ...(st.residentWinters || {}) };
    RESIDENTS.forEach(r => {
      if (active.has(r.key)) {
        seasons[r.key] = (seasons[r.key] || 0) + 1;
        if (leavingWinter) winters[r.key] = (winters[r.key] || 0) + 1;
      } else {
        seasons[r.key] = 0;
        winters[r.key] = 0;
      }
    });
    return { residentSeasons: seasons, residentWinters: winters, active };
  }

  function firstDueBeat(beats, seen, context) {
    for (let index = 0; index < beats.length; index += 1) {
      const beat = beats[index];
      if (seen.indexOf(beat.id) >= 0) continue;
      return beat.when(context) ? { beat, index } : null;
    }
    return null;
  }

  // The next story beat of each resident that is due now (one per resident at
  // most): {id, resident, index (from 1), total}. `values` are the garden's
  // resilience values (soil, water, food, habitat).
  function dueResidentBeats(st, values) {
    const active = activeOf(st.placed || []);
    const seen = st.residentBeatsSeen || [];
    const out = [];
    RESIDENTS.forEach(r => {
      const context = { active, v: values || {}, seasons: (st.residentSeasons || {})[r.key] || 0, winters: (st.residentWinters || {})[r.key] || 0 };
      const due = firstDueBeat(r.beats, seen, context);
      if (due) out.push({ id: due.beat.id, resident: r.key, index: due.index + 1, total: r.beats.length });
    });
    return out;
  }

  // The next story beat of each pest that is due now: {id, pest, index, total, resolved}.
  function duePestBeats(st) {
    const seen = st.pestBeatsSeen || [];
    const out = [];
    PESTS.forEach(p => {
      const context = { active: (st.pestActive || null) === p.key, cleared: !!(st.pestCleared || {})[p.key], seasons: (st.pestSeasons || {})[p.key] || 0 };
      const due = firstDueBeat(p.beats, seen, context);
      if (due) out.push({ id: due.beat.id, pest: p.key, index: due.index + 1, total: p.beats.length, resolved: context.cleared });
    });
    return out;
  }

  function pest(key) {
    return PESTS.find(p => p.key === key) || null;
  }
  function allyKeys(p) {
    return p.allies || [p.ally];
  }
  // The elements of a pest's `build` list that the garden does not have yet.
  function missingBuilds(st, p) {
    const have = new Set((st.placed || []).map(x => x.type));
    return (p.build || []).filter(type => !have.has(type));
  }
  // The crops that hold instead of growing: those the active pest feeds on,
  // unless relief (hand work) bought a season or an ally already settled it.
  function heldCrops(st) {
    const key = st.pestActive;
    if (!key || (st.pestRelief || {})[key] || (st.pestCleared || {})[key]) return [];
    const p = pest(key);
    return p ? p.crops : [];
  }

  // A pest outbreak is a reading of the garden, never a dice roll. As the
  // season turns to `season` (`st.seasonTurns` counts it already): an active
  // pest settles when its crops are gone, an ally lives here (`activeWildlife`;
  // then it is cleared for good) or it was cleared; otherwise it stays another
  // season and relief wears off by one. With no active pest, after the calm of
  // PEST_CALM seasons and from turn PEST_FIRST_TURN on, the first pest of this
  // season that has crops to feed on and no ally here breaks out, if
  // `allowOnset`. `pestReturned` names a pest that was cleared before and is
  // back for a season.
  function stepPests(st, season, activeWildlife, allowOnset) {
    const cleared = { ...(st.pestCleared || {}) };
    const seasons = { ...(st.pestSeasons || {}) };
    const relief = { ...(st.pestRelief || {}) };
    const turns = Math.max(0, Math.floor(Number(st.seasonTurns) || 0));
    let lastSettled = st.pestLastSettled === null || st.pestLastSettled === undefined ? null : Math.floor(Number(st.pestLastSettled));
    const types = new Set((st.placed || []).map(p => p.type));
    const hasCrop = p => (p.crops || []).some(type => types.has(type));
    const allyPresent = p => allyKeys(p).some(key => activeWildlife.has(key));
    let active = st.pestActive || null;
    let pestReturned = null;
    if (active) {
      const p = pest(active);
      if (!p || !hasCrop(p) || allyPresent(p) || cleared[active]) {
        if (p && allyPresent(p)) cleared[p.key] = true;
        active = null;
        lastSettled = turns;
      } else {
        seasons[p.key] = (seasons[p.key] || 0) + 1;
        if (relief[p.key]) relief[p.key] = Math.max(0, relief[p.key] - 1);
      }
    }
    const calm = lastSettled === null || (turns - lastSettled) >= PEST_CALM;
    const onset = allowOnset === undefined ? true : allowOnset;
    if (!active && onset && calm && turns >= PEST_FIRST_TURN) {
      const candidate = PESTS.find(p => (p.seasons || []).indexOf(season) >= 0 && hasCrop(p) && !allyPresent(p));
      if (candidate) {
        active = candidate.key;
        seasons[candidate.key] = (seasons[candidate.key] || 0) + 1;
        if (cleared[candidate.key]) pestReturned = candidate.key;
      }
    }
    return { pestActive: active, pestSeasons: seasons, pestCleared: cleared, pestRelief: relief, pestLastSettled: lastSettled === null ? null : lastSettled, pestReturned };
  }

  return {
    VERSION,
    HABITATS,
    VISIT_CHANCE,
    MAX_RETURNING,
    RESIDENTS,
    PESTS,
    PEST_CALM,
    PEST_FIRST_TURN,
    activeOf,
    arrivals,
    visitCandidates,
    visitPossible,
    returningInSpring,
    countResidents,
    dueResidentBeats,
    duePestBeats,
    pest,
    allyKeys,
    missingBuilds,
    heldCrops,
    stepPests
  };
});
