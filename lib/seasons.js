(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PermacultureSeasons = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Seasons, planting and harvest: when something can be planted, how crops
  // grow from season to season, what winter does to them, when they and the
  // apple trees can be harvested, and what each season leaves to gather.
  //
  // Rules only (docs/ARCHITECTURE.md): the game keeps the words (why a crop is
  // sown when it is, what a harvest note says) and calls these functions. One
  // turn of the game is one season.
  const VERSION = "1.0.0";

  const ORDER = Object.freeze(["Spring", "Summer", "Autumn", "Winter"]);
  // A garden without a season yet is in summer.
  const DEFAULT_SEASON = "Summer";

  // Crops are sown from the seed bank at stage 1 and grow one stage a season up
  // to MAX_STAGE. A crop is ready from `readyAt` and is lifted in its harvest
  // `window`; one harvest puts `yieldN` of its produce in the basket.
  const CROPS = deepFreeze({
    crop_potato: { produce: "potatoes", readyAt: 3, window: ["Autumn"], yieldN: 2 },
    crop_root: { produce: "roots", readyAt: 3, window: ["Autumn"], yieldN: 2 },
    crop_leafy: { produce: "leafy", readyAt: 2, window: ["Spring", "Summer"], yieldN: 2 },
    crop_cabbage: { produce: "cabbage", readyAt: 3, window: ["Autumn"], yieldN: 2 },
    crop_herb: { produce: "herbs", readyAt: 2, window: ["Summer"], yieldN: 2 }
  });
  const MAX_STAGE = 3;

  // The seasons in which an element can be planted; elements not listed can be
  // planted in any season. The reasons are in the canonical source
  // (`plantWindows`).
  const PLANTING = deepFreeze({
    crop_potato: ["Spring"],
    crop_root: ["Spring", "Summer"],
    crop_leafy: ["Spring", "Summer"],
    crop_cabbage: ["Spring"],
    crop_herb: ["Spring", "Summer"],
    appletree: ["Spring", "Autumn"],
    hugel: ["Spring", "Summer", "Autumn"],
    herbspiral: ["Spring", "Summer", "Autumn"],
    pollinator: ["Spring", "Summer"],
    birdhouse: ["Spring", "Summer", "Autumn", "Winter"]
  });

  // Biennials: the root or head you harvest is the plant that would have
  // flowered next summer, so it gives no seed.
  const BIENNIAL = deepFreeze(["crop_root", "crop_cabbage"]);
  // In winter, mulch lets these young crops sleep instead of freezing; a
  // greenhouse keeps young salads growing.
  const WINTER_MULCH_CROPS = deepFreeze(["crop_root", "crop_cabbage"]);
  const GREENHOUSE_CROP = "crop_leafy";
  // A grafted dwarf apple may bear after two to three years: eight seasons.
  const TREE_MATURITY = 8;
  // A mature apple sets fruit in autumn with a second mature apple tree within
  // 42 and a flower strip or herb spiral within 32 (plot distance).
  const POLLINATION = Object.freeze({ partner: 42, flowers: 32 });
  const APPLE_HARVEST = 3;
  // What each season leaves to gather: three cherry clusters in summer, three
  // sprout patches in spring, three leaf piles in autumn.
  const SEASON_FINDS = 3;

  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.keys(value).forEach(key => deepFreeze(value[key]));
    }
    return value;
  }

  function seasonOf(st) {
    return st.season || DEFAULT_SEASON;
  }

  // Seasons move in order: Spring, Summer, Autumn, Winter, Spring…
  function next(season) {
    return ORDER[(ORDER.indexOf(season) + 1) % ORDER.length];
  }

  function canPlantIn(type, season) {
    const seasons = PLANTING[type];
    return !seasons || seasons.indexOf(season) >= 0;
  }

  // Sowing a crop from seed you saved yourself (anything but a gift).
  function usesSavedSeed(type, via, st) {
    return !!CROPS[type] && via !== "gift" && ((st.seedStock || {})[type] || 0) > 0;
  }

  // Why an element cannot be planted now, or null. A gift from the community
  // table can always be planted. A crop needs a seed bank and one seed packet
  // per crop per season (saved seed does not count); anything with planting
  // seasons waits for one of them. Reasons: "seedbank", "packet", "season".
  function plantingBlock(type, via, st) {
    if (via === "gift") return null;
    const crop = !!CROPS[type];
    if (crop && !(st.placed || []).some(p => p.type === "seedbank")) return "seedbank";
    if (crop && !usesSavedSeed(type, via, st) && ((st.seedAllowance || {})[type] || 0) >= 1) return "packet";
    if (!canPlantIn(type, seasonOf(st))) return "season";
    return null;
  }

  // The seed packets and saved seed after sowing: a crop sown from the bank uses
  // the season's packet (a gifted crop too), saved seed uses one of your own.
  function afterSowing(st, type, savedSeed) {
    const allowance = st.seedAllowance || {};
    const stock = st.seedStock || {};
    return {
      seedAllowance: CROPS[type] && !savedSeed ? { ...allowance, [type]: (allowance[type] || 0) + 1 } : allowance,
      seedStock: savedSeed ? { ...stock, [type]: Math.max(0, (stock[type] || 0) - 1) } : stock
    };
  }

  // A new planting: a crop starts at stage 1, an apple tree as a sapling without fruit.
  function startGrowth(item) {
    if (CROPS[item.type]) item.stage = 1;
    if (item.type === "appletree") item.appleReady = false;
    return item;
  }

  function readyToHarvest(item, season) {
    const crop = CROPS[item.type];
    return !!crop && (item.stage || 1) >= crop.readyAt && crop.window.indexOf(season) >= 0;
  }

  // What lifting a crop gives: its produce and amount, and whether a little seed
  // goes back to the seed bank (only with a seed bank, and never from a biennial).
  function harvestOf(item, placed) {
    const crop = CROPS[item.type];
    const biennial = BIENNIAL.indexOf(item.type) >= 0;
    return {
      produce: crop.produce,
      amount: crop.yieldN,
      biennial,
      savesSeed: (placed || []).some(p => p.type === "seedbank") && !biennial
    };
  }

  // Seasons since a tree was planted, and how grown it is (0 to 1).
  function treeSeasons(st, tree) {
    return Math.max(0, (st.seasonTurns || 0) - (tree.placedAtTurn || 0));
  }
  function treeGrowth(st, tree) {
    return Math.min(1, treeSeasons(st, tree) / TREE_MATURITY);
  }
  // Distance on the plot: the plot is drawn wider than it is deep.
  function plotDistance(a, b) {
    return Math.hypot(((Number(a.x) || 0) - (Number(b.x) || 0)) * 1.4, (Number(a.y) || 0) - (Number(b.y) || 0));
  }
  function applePollinationReady(st, tree) {
    const placed = st.placed || [];
    const partner = placed.some(q => q.id !== tree.id && q.type === "appletree" && treeSeasons(st, q) >= TREE_MATURITY && plotDistance(tree, q) <= POLLINATION.partner);
    const flowers = placed.some(q => (q.type === "pollinator" || q.type === "herbspiral") && plotDistance(tree, q) <= POLLINATION.flowers);
    return partner && flowers;
  }

  // One season of growth for the garden `st` as the season turns to `season`
  // (st.seasonTurns already counts the new season). Young crops grow a stage,
  // except those of a type in `heldTypes` (a pest is feeding on them: they hold
  // instead). In winter a greenhouse keeps young salads growing, mulch lets
  // young roots and cabbages sleep and other young crops are lost to frost. In
  // autumn a mature, pollinated apple tree is ready to pick; a mature one
  // without pollination waits. Returns the new list of elements and what happened.
  function growSeason(st, season, heldTypes) {
    const placed = st.placed || [];
    const held = heldTypes || [];
    const hasGreenhouse = placed.some(p => p.type === "greenhouse");
    const hasMulch = placed.some(p => p.type === "mulch");
    const outcome = { greenhouseSaved: false, dormant: 0, lost: 0, held: 0, applesWaiting: 0 };
    const grown = placed.map(p => {
      const crop = CROPS[p.type];
      if (crop && (p.stage || 1) < MAX_STAGE) {
        if (season === "Winter") {
          if (hasGreenhouse && p.type === GREENHOUSE_CROP) { outcome.greenhouseSaved = true; return { ...p, stage: (p.stage || 1) + 1, winterState: "protected" }; }
          if (hasMulch && WINTER_MULCH_CROPS.indexOf(p.type) >= 0) { outcome.dormant += 1; return { ...p, winterState: "dormant" }; }
          outcome.lost += 1;
          return null;
        }
        if (held.indexOf(p.type) >= 0) { outcome.held += 1; return { ...p, winterState: null, pestHeld: true }; }
        return { ...p, stage: (p.stage || 1) + 1, winterState: null, pestHeld: false };
      }
      if (p.type === "appletree") {
        const mature = treeSeasons(st, p) >= TREE_MATURITY;
        const ready = season === "Autumn" && mature && applePollinationReady(st, p);
        if (season === "Autumn" && mature && !ready) outcome.applesWaiting += 1;
        return { ...p, appleReady: ready };
      }
      return p;
    }).filter(Boolean);
    return { placed: grown, hasMulch, ...outcome };
  }

  // What the new season leaves to gather (cherry clusters, sprouts, leaf piles).
  function seasonFinds(season) {
    return {
      cherryPicks: season === "Summer" ? SEASON_FINDS : 0,
      springSprouts: season === "Spring" ? SEASON_FINDS : 0,
      leafPiles: season === "Autumn" ? SEASON_FINDS : 0
    };
  }

  // The first spring with a seed bank fills the swap table with free seedlings.
  function firstSpringSowing(st, season) {
    return season === "Spring" && !st.springBonusDone && (st.placed || []).some(p => p.type === "seedbank");
  }
  // The cherry tree's first autumn surplus.
  function firstAutumnHarvest(st, season) {
    return season === "Autumn" && !st.autumnHarvestDone;
  }

  return {
    VERSION,
    ORDER,
    DEFAULT_SEASON,
    CROPS,
    MAX_STAGE,
    PLANTING,
    BIENNIAL,
    WINTER_MULCH_CROPS,
    GREENHOUSE_CROP,
    TREE_MATURITY,
    POLLINATION,
    APPLE_HARVEST,
    SEASON_FINDS,
    seasonOf,
    next,
    canPlantIn,
    usesSavedSeed,
    plantingBlock,
    afterSowing,
    startGrowth,
    readyToHarvest,
    harvestOf,
    treeSeasons,
    treeGrowth,
    plotDistance,
    applePollinationReady,
    growSeason,
    seasonFinds,
    firstSpringSowing,
    firstAutumnHarvest
  };
});
