(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PermacultureLivingLesson = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "1.2.0";
  const PROMPT_VERSION = "living-lesson-v3-i18n";
  const SUPPORTED_LOCALES = ["en", "cs", "de", "fr", "es", "pt-BR", "pl", "ru", "zh-CN"];
  const SYSTEM_KEYS = ["soil", "water", "food", "habitat"];
  const LINK_KEYS = ["soil", "water", "food", "habitat"];
  const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];
  const JOURNEY_KEYS = ["soil", "water", "food", "shelter", "share", "challenge"];
  const FOCUS_KEYS = ["soil", "water", "food", "habitat", "sharing", "relationships", "season"];
  const ELEMENT_KEYS = ["compost", "mulch", "hugel", "rain", "birdbath", "arch", "herbspiral", "greenhouse", "seedbank", "appletree", "kitchen", "crop_potato", "crop_root", "crop_leafy", "crop_cabbage", "crop_herb", "pollinator", "bughotel", "birdhouse", "bench", "sign"];
  const LINK_LABELS = {
    soil: "Mulch protects nearby roots",
    water: "Stored rain feeds a nearby growing area",
    food: "Flowers support nearby food crops",
    habitat: "Shelter connects with a feeding area"
  };

  function text(value, max) {
    return String(value == null ? "" : value)
      .replace(/<[^>]*>/g, " ")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);
  }

  function number(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  function uniqueStrings(values, maxItems, maxLength) {
    return Array.from(new Set((Array.isArray(values) ? values : []).map(v => text(v, maxLength)).filter(Boolean))).slice(0, maxItems);
  }

  function normalizeLocale(value) {
    const raw = String(value || "").trim().replace(/_/g, "-");
    if (!raw) return "en";
    const exact = SUPPORTED_LOCALES.find(locale => locale.toLowerCase() === raw.toLowerCase());
    if (exact) return exact;
    const base = raw.toLowerCase().split("-")[0];
    if (base === "pt") return "pt-BR";
    if (base === "zh") return "zh-CN";
    return SUPPORTED_LOCALES.find(locale => locale.toLowerCase() === base) || "en";
  }

  function sanitizeSnapshot(raw) {
    const input = raw && typeof raw === "object" ? raw : {};
    const rawSystems = input.systems && typeof input.systems === "object" ? input.systems : {};
    const values = {};
    SYSTEM_KEYS.forEach(key => {
      const entry = rawSystems[key] && typeof rawSystems[key] === "object" ? rawSystems[key] : {};
      values[key] = Math.round(number(entry.value, 0, 100, 0));
    });
    const links = (Array.isArray(input.links) ? input.links : []).map(link => ({
      kind: LINK_KEYS.includes(link && link.kind) ? link.kind : "",
      label: LINK_KEYS.includes(link && link.kind) ? LINK_LABELS[link.kind] : "",
      fromType: ELEMENT_KEYS.includes(link && link.fromType) ? link.fromType : "",
      toType: ELEMENT_KEYS.includes(link && link.toType) ? link.toType : ""
    })).filter(link => link.kind && link.fromType && link.toType).slice(0, 24);
    const journey = input.journey && typeof input.journey === "object" ? input.journey : {};
    const last = input.lastChange && typeof input.lastChange === "object" ? input.lastChange : null;
    return {
      locale: normalizeLocale(input.locale),
      season: SEASONS.includes(input.season) ? input.season : "Summer",
      placedTypes: uniqueStrings(input.placedTypes, 32, 40).filter(type => ELEMENT_KEYS.includes(type)),
      systems: SYSTEM_KEYS.reduce((out, key) => {
        const value = values[key];
        out[key] = { value, reason: value === 0 ? "This relationship is not represented yet." : value < 35 ? "This relationship has begun but remains lightly supported." : value < 65 ? "Several useful parts are present; stronger placement could connect them." : "This relationship is well represented; time and seasonal change can now test it." };
        return out;
      }, {}),
      links,
      journey: {
        done: Math.round(number(journey.done, 0, 6, 0)),
        total: 6,
        currentKey: JOURNEY_KEYS.includes(journey.currentKey) ? journey.currentKey : "soil",
        completedKeys: uniqueStrings(journey.completedKeys, 6, 20).filter(key => JOURNEY_KEYS.includes(key))
      },
      sharedActs: Math.round(number(input.sharedActs, 0, 999, 0)),
      completedChallenges: uniqueStrings(input.completedChallenges, 16, 50),
      guildKeys: uniqueStrings(input.guildKeys, 12, 50),
      harvests: Math.round(number(input.harvests, 0, 999, 0)),
      preserved: Math.round(number(input.preserved, 0, 999, 0)),
      lastChange: last && SYSTEM_KEYS.includes(last.system) ? {
        system: last.system,
        delta: Math.round(number(last.delta, -100, 100, 0)),
        text: "The latest garden action changed " + last.system + " by " + Math.round(number(last.delta, -100, 100, 0)) + " points."
      } : null
    };
  }

  function stable(value) {
    if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
    if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stable(value[key])).join(",") + "}";
    return JSON.stringify(value);
  }

  function fingerprint(raw) {
    const source = stable(sanitizeSnapshot(raw));
    let hash = 2166136261;
    for (let i = 0; i < source.length; i += 1) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return PROMPT_VERSION + "-" + (hash >>> 0).toString(36);
  }

  const SYSTEM_NAMES = { soil: "living soil", water: "water security", food: "the food web", habitat: "habitat" };
  const LINK_ACTIONS = {
    soil: "Place protective mulch close to a growing area so cover and roots work as one system.",
    water: "Place rain harvesting close to a growing area so stored water has a clear purpose.",
    food: "Place flowering habitat close to an edible crop so pollinators and harvest reinforce one another.",
    habitat: "Place shelter close to food or cover so wildlife finds a connected refuge."
  };

  function metric(id, kind, focus, title, action, why, success, baseline, target) {
    return { id, kind, focus, title, action, why, success, baseline, target };
  }

  function buildCandidates(raw) {
    const snapshot = sanitizeSnapshot(raw);
    const values = snapshot.systems;
    const placed = new Set(snapshot.placedTypes);
    const linkCounts = LINK_KEYS.reduce((out, key) => {
      out[key] = snapshot.links.filter(link => link.kind === key).length;
      return out;
    }, {});
    const weakest = SYSTEM_KEYS.slice().sort((a, b) => values[a].value - values[b].value || SYSTEM_KEYS.indexOf(a) - SYSTEM_KEYS.indexOf(b))[0];
    const candidates = [];
    if (values[weakest].value >= 92) {
      candidates.push(metric(
        "read-next-season", "challenge_gain", "season", "Let change test the design",
        "Turn to the next season, read what changed, and complete its garden challenge.",
        "A strong snapshot still needs change and time to reveal whether its relationships are resilient.",
        "Complete one more seasonal challenge.", snapshot.completedChallenges.length, snapshot.completedChallenges.length + 1
      ));
    } else {
      let action;
      if (weakest === "soil") action = !placed.has("compost") ? "Add compost to begin feeding the soil community." : (!placed.has("mulch") ? "Add mulch to protect the soil you are feeding." : LINK_ACTIONS.soil);
      if (weakest === "water") action = !placed.has("rain") ? "Add safe rain harvesting so water can pause in the garden." : LINK_ACTIONS.water;
      if (weakest === "food") action = !snapshot.placedTypes.some(type => ["hugel", "arch", "herbspiral", "greenhouse", "appletree", "crop_potato", "crop_root", "crop_leafy", "crop_cabbage", "crop_herb"].includes(type)) ? "Add one edible layer, such as a fruit tree, herb spiral or growing bed." : (!placed.has("pollinator") ? "Add pollinator flowers beside food so bloom and harvest support each other." : LINK_ACTIONS.food);
      if (weakest === "habitat") action = !snapshot.placedTypes.some(type => ["pollinator", "bughotel", "birdhouse"].includes(type)) ? "Add flowers, a bug hotel or a bird house to make room for other lives." : LINK_ACTIONS.habitat;
      candidates.push(metric(
        "strengthen-" + weakest,
        "system_gain",
        weakest,
        "Strengthen " + SYSTEM_NAMES[weakest],
        action,
        values[weakest].reason || ("This is currently the garden's least-supported relationship."),
        "Raise " + SYSTEM_NAMES[weakest] + " from " + values[weakest].value + "% to at least " + Math.min(100, values[weakest].value + 8) + "%.",
        values[weakest].value,
        Math.min(100, values[weakest].value + 8)
      ));
    }

    const missingLink = LINK_KEYS.find(key => linkCounts[key] === 0 && (key !== weakest || values[key].value >= 12));
    if (missingLink) {
      candidates.push(metric(
        "connect-" + missingLink,
        "link_added",
        "relationships",
        "Make one visible connection",
        LINK_ACTIONS[missingLink],
        "A useful element becomes more resilient when its position helps another part of the garden.",
        "Create the first " + SYSTEM_NAMES[missingLink] + " connection on the plot.",
        linkCounts[missingLink],
        linkCounts[missingLink] + 1
      ));
    }

    if (snapshot.journey.done >= 3 && snapshot.sharedActs === 0) {
      candidates.push(metric(
        "circulate-first-gift",
        "share_gain",
        "sharing",
        "Let one gift travel onward",
        "Grow or collect a genuine surplus, then share one item through the Menet table.",
        "Fair share connects ecological abundance with people; it is an action, not just a score.",
        "Complete one sharing action.",
        snapshot.sharedActs,
        snapshot.sharedActs + 1
      ));
    } else if (snapshot.placedTypes.length >= 3 && snapshot.guildKeys.length === 0) {
      candidates.push(metric(
        "discover-first-guild",
        "guild_gain",
        "relationships",
        "Help good neighbours cooperate",
        "Move or add related elements beside one another until their useful relationship forms an active guild.",
        "Permaculture design asks what each element gives and needs, then uses placement to connect them.",
        "Discover the first active garden guild.",
        snapshot.guildKeys.length,
        snapshot.guildKeys.length + 1
      ));
    }

    if ((snapshot.journey.currentKey === "challenge" || snapshot.journey.done >= 5) && !candidates.some(candidate => candidate.id === "read-next-season")) {
      candidates.push(metric(
        "read-next-season",
        "challenge_gain",
        "season",
        "Let change test the design",
        "Turn to the next season, read what changed, and complete its garden challenge.",
        "Resilience is revealed through change, not by a still snapshot of a high score.",
        "Complete one more seasonal challenge.",
        snapshot.completedChallenges.length,
        snapshot.completedChallenges.length + 1
      ));
    }

    if (candidates.length < 2) {
      const numbers = SYSTEM_KEYS.map(key => values[key].value);
      const gap = Math.max.apply(null, numbers) - Math.min.apply(null, numbers);
      if (gap > 0) {
        candidates.push(metric(
          "balance-living-web",
          "balance_gap",
          "relationships",
          "Balance the living web",
          "Improve the weakest relationship without removing the strongest one; watch whether the gap narrows.",
          "A resilient garden depends on several relationships supporting one another, not one isolated maximum.",
          "Reduce the strongest-to-weakest gap from " + gap + " points.",
          gap,
          Math.max(0, gap - 5)
        ));
      } else {
        candidates.push(metric(
          "circulate-another-gift", "share_gain", "sharing", "Let abundance circulate again",
          "Grow or collect another genuine surplus, then share one item through the Menet table.",
          "A balanced snapshot stays alive through repeated care and circulation, not a permanent perfect score.",
          "Complete one more sharing action.", snapshot.sharedActs, snapshot.sharedActs + 1
        ));
      }
    }
    return candidates.slice(0, 4);
  }

  const FALLBACKS = {
    soil: ["My quietest work is happening underfoot.", "Soil life grows through cover, organic matter and time; nearby mulch helps roots keep moisture while decomposition feeds the web."],
    water: ["I notice where each drop can pause, and where it still has nowhere useful to go.", "Catching rain is only the first step; stored water becomes part of a system when it is safely directed toward soil and plants."],
    food: ["A harvest is strongest when it is held by more than one relationship.", "Edible layers, flowering plants and seed stewardship can reinforce one another across the season."],
    habitat: ["Some neighbours arrive only when food, water and shelter meet.", "Habitat works as a connected refuge; one isolated shelter cannot guarantee wildlife, but it can improve the conditions they need."],
    sharing: ["What leaves my gate can become another beginning.", "Fair share is the circulation of genuine surplus, care or knowledge, without requiring an equal return."],
    relationships: ["Look between the elements, not only at the elements themselves.", "Placement turns separate objects into useful relationships: a need in one place can be met by a yield from another."],
    season: ["A season does not judge the design; it reveals what the design can learn.", "Observation after change helps a gardener adapt instead of assuming that one arrangement will always work."]
  };

  function fallbackLesson(raw, candidates) {
    const snapshot = sanitizeSnapshot(raw);
    const trusted = Array.isArray(candidates) && candidates.length ? candidates : buildCandidates(snapshot);
    const candidate = trusted[0];
    const copy = FALLBACKS[candidate.focus] || FALLBACKS.relationships;
    const question = candidate.focus === "sharing"
      ? "What genuine surplus can move onward without weakening the garden?"
      : candidate.focus === "season"
        ? "What changed with the season, and which relationship should respond first?"
        : "Which nearby element could help this part do more than one job?";
    return normalizeLesson({
      candidateId: candidate.id,
      focus: candidate.focus,
      observation: copy[0],
      relationship: copy[1],
      question
    }, snapshot, trusted, { source: "fallback", model: null });
  }

  function normalizeLesson(raw, snapshot, candidates, meta) {
    const trusted = Array.isArray(candidates) && candidates.length ? candidates : buildCandidates(snapshot);
    const wanted = text(raw && raw.candidateId, 80);
    const candidate = trusted.find(item => item.id === wanted) || trusted[0];
    const source = meta && meta.source === "ai" ? "ai" : "fallback";
    const defaultCopy = FALLBACKS[candidate.focus] || FALLBACKS.relationships;
    return {
      version: VERSION,
      promptVersion: PROMPT_VERSION,
      fingerprint: fingerprint(snapshot),
      source,
      model: source === "ai" ? text(meta && meta.model, 80) : null,
      candidateId: candidate.id,
      focus: candidate.focus,
      observation: text(raw && raw.observation, 260) || defaultCopy[0],
      relationship: text(raw && raw.relationship, 300) || defaultCopy[1],
      question: text(raw && raw.question, 190) || "Which relationship would you test next?",
      experiment: Object.assign({}, candidate),
      createdAt: new Date().toISOString()
    };
  }

  function startExperiment(rawSnapshot, candidate, lesson) {
    const snapshot = sanitizeSnapshot(rawSnapshot);
    const trusted = buildCandidates(snapshot);
    const found = trusted.find(item => item.id === (candidate && candidate.id)) || trusted[0];
    return {
      version: VERSION,
      id: found.id + "-" + Date.now().toString(36),
      candidate: Object.assign({}, found),
      lessonFingerprint: text(lesson && lesson.fingerprint, 100) || fingerprint(snapshot),
      startedAt: new Date().toISOString(),
      status: "active",
      progress: "Experiment started — keep observing the garden."
    };
  }

  function metricValue(candidate, snapshot) {
    if (candidate.kind === "system_gain") return snapshot.systems[candidate.focus] ? snapshot.systems[candidate.focus].value : 0;
    if (candidate.kind === "link_added") return snapshot.links.filter(link => link.kind === candidate.id.replace("connect-", "")).length;
    if (candidate.kind === "share_gain") return snapshot.sharedActs;
    if (candidate.kind === "guild_gain") return snapshot.guildKeys.length;
    if (candidate.kind === "challenge_gain") return snapshot.completedChallenges.length;
    if (candidate.kind === "balance_gap") {
      const values = SYSTEM_KEYS.map(key => snapshot.systems[key].value);
      return Math.max.apply(null, values) - Math.min.apply(null, values);
    }
    return 0;
  }

  function checkExperiment(rawExperiment, rawSnapshot) {
    const experiment = sanitizeExperiment(rawExperiment);
    if (!experiment) return null;
    const snapshot = sanitizeSnapshot(rawSnapshot);
    const value = metricValue(experiment.candidate, snapshot);
    const inverse = experiment.candidate.kind === "balance_gap";
    const completed = inverse ? value <= experiment.candidate.target : value >= experiment.candidate.target;
    const progress = completed
      ? "Experiment complete — the garden changed in the direction you tested."
      : inverse
        ? "Current gap: " + value + " points · aim for " + experiment.candidate.target + " or less."
        : "Current evidence: " + value + " · target: " + experiment.candidate.target + ".";
    return Object.assign({}, experiment, { status: completed ? "completed" : "active", progress, completedAt: completed ? (experiment.completedAt || new Date().toISOString()) : null });
  }

  function sanitizeCandidate(raw) {
    if (!raw || typeof raw !== "object") return null;
    const kind = ["system_gain", "link_added", "share_gain", "guild_gain", "challenge_gain", "balance_gap"].includes(raw.kind) ? raw.kind : "";
    const focus = FOCUS_KEYS.includes(raw.focus) ? raw.focus : "";
    if (!kind || !focus) return null;
    return {
      id: text(raw.id, 80), kind, focus,
      title: text(raw.title, 120), action: text(raw.action, 280), why: text(raw.why, 280), success: text(raw.success, 180),
      baseline: number(raw.baseline, 0, 999, 0), target: number(raw.target, 0, 999, 1)
    };
  }

  function sanitizeExperiment(raw) {
    if (!raw || typeof raw !== "object") return null;
    const candidate = sanitizeCandidate(raw.candidate);
    if (!candidate) return null;
    return {
      version: VERSION,
      id: text(raw.id, 120) || (candidate.id + "-restored"),
      candidate,
      lessonFingerprint: text(raw.lessonFingerprint, 100),
      startedAt: text(raw.startedAt, 40),
      status: raw.status === "completed" ? "completed" : "active",
      progress: text(raw.progress, 180),
      completedAt: raw.completedAt ? text(raw.completedAt, 40) : null
    };
  }

  function sanitizeHistory(raw) {
    return (Array.isArray(raw) ? raw : []).map(sanitizeExperiment).filter(Boolean).filter(item => item.status === "completed").slice(-8);
  }

  return {
    VERSION,
    PROMPT_VERSION,
    SUPPORTED_LOCALES: SUPPORTED_LOCALES.slice(),
    SYSTEM_KEYS: SYSTEM_KEYS.slice(),
    FOCUS_KEYS: FOCUS_KEYS.slice(),
    ELEMENT_KEYS: ELEMENT_KEYS.slice(),
    normalizeLocale,
    sanitizeSnapshot,
    fingerprint,
    buildCandidates,
    fallbackLesson,
    normalizeLesson,
    startExperiment,
    checkExperiment,
    sanitizeExperiment,
    sanitizeHistory
  };
});
