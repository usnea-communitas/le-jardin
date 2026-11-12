(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PermacultureEconomy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // The garden's economy: game shares, the garden fund in euros, reclaimed
  // materials and the shared pool of the community table.
  //
  // Rules only (docs/ARCHITECTURE.md): these functions decide and the game
  // speaks. They read no page, clock or random numbers and return no words for
  // the player; the canonical source keeps every word, picture and sound and
  // calls them. Fair share is a rule here too: a gift feeds the shared pool and
  // never pays the giver.
  const VERSION = "1.0.0";

  // What a new garden starts with.
  const START = deepFreeze({ shares: 10, budget: 300, pool: 65, goodwill: 0 });
  // The shared pool is counted in points from 0 to 100.
  const POOL_MAX = 100;

  // What each element costs: euros from the garden fund (price), game shares
  // (barter; null when it cannot be bartered, 0 for a crop sown from the seed
  // bank). `gift` is kept from earlier versions; nothing reads it now. The words
  // (what an element is often made from) are in the canonical source.
  const PRICES = deepFreeze({
    compost: { price: 40, barter: 1, gift: 2 },
    hugel: { price: 60, barter: 2, gift: 2 },
    rain: { price: 90, barter: null, gift: 1 },
    mulch: { price: 20, barter: 1, gift: 1 },
    bughotel: { price: 30, barter: 1, gift: 1 },
    arch: { price: 90, barter: 2, gift: 1 },
    herbspiral: { price: 70, barter: 2, gift: 2 },
    pollinator: { price: 40, barter: 1, gift: 2 },
    greenhouse: { price: 220, barter: null, gift: 2 },
    seedbank: { price: 15, barter: 1, gift: 3 },
    birdbath: { price: 45, barter: 1, gift: 1 },
    birdhouse: { price: 35, barter: null, gift: 1 },
    bench: { price: 80, barter: null, gift: 2 },
    sign: { price: 15, barter: 1, gift: 1 },
    appletree: { price: 50, barter: 2, gift: 2 },
    kitchen: { price: 120, barter: null, gift: 2 },
    crop_potato: { price: 0, barter: 0, gift: 1 },
    crop_root: { price: 0, barter: 0, gift: 1 },
    crop_leafy: { price: 0, barter: 0, gift: 1 },
    crop_cabbage: { price: 0, barter: 0, gift: 1 },
    crop_herb: { price: 0, barter: 0, gift: 1 }
  });

  // Reclaimed materials from neighbours, and how many euros each one saves on a
  // build that can use it. A build never drops below MIN_BUILD_PRICE.
  const MATERIAL_VALUES = deepFreeze({ planks: 40, window: 50, bricks: 40, straw: 20 });
  const BUILD_USES = deepFreeze({
    kitchen: ["planks", "window", "bricks", "straw"],
    greenhouse: ["window", "planks"]
  });
  const MIN_BUILD_PRICE = 10;

  // Game milestones, counted in gifts: perennial cuttings appear on the table
  // after 10 gifts, the garden fund adds €100 after 20 and the game adds five
  // shares after 30. Each one happens once.
  const MILESTONES = deepFreeze([
    { at: 10, kind: "item", type: "pollinator" },
    { at: 20, kind: "budget", value: 100 },
    { at: 30, kind: "shares", value: 5 }
  ]);

  // How many points of the shared pool a gift adds: produce 6, an established
  // spare or a division 10, a seed packet none (it still counts as a gift).
  const GIFT_POOL_POINTS = deepFreeze({ produce: 6, element: 10, seed: 0 });

  // Selling at the village stall is income for the garden fund, not a gift.
  const STALL_PRICES = deepFreeze({ preserve: 25, freshCherries: 15 });

  // The seasons move the shared pool too: in winter a mulched garden adds 2
  // points and bare soil loses 3; the cherry tree's first autumn surplus adds 3.
  const SEASON_POOL_POINTS = deepFreeze({ winterMulched: 2, winterBare: -3, firstAutumn: 3 });

  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.keys(value).forEach(key => deepFreeze(value[key]));
    }
    return value;
  }

  // The euro price after the reclaimed materials in stock: each material the
  // build can use takes its value off, in the order of BUILD_USES, as long as
  // the price stays at MIN_BUILD_PRICE or above. `used` lists the materials
  // that would be spent.
  function effectivePrice(type, materials) {
    const entry = PRICES[type];
    if (!entry) return { price: 0, used: [] };
    const uses = BUILD_USES[type];
    if (!uses) return { price: entry.price, used: [] };
    const stock = materials || {};
    let price = entry.price;
    const used = [];
    uses.forEach(material => {
      if ((stock[material] || 0) > 0 && price - MATERIAL_VALUES[material] >= MIN_BUILD_PRICE) {
        price -= MATERIAL_VALUES[material];
        used.push(material);
      }
    });
    return { price, used };
  }

  // Which ways of paying are open with this wallet ({shares, budget,
  // materials}): bartering needs a barter price above 0 and enough shares,
  // buying a euro price above 0 and enough in the fund.
  function paymentOptions(type, wallet) {
    const entry = PRICES[type];
    const effective = entry ? effectivePrice(type, wallet.materials) : { price: 0, used: [] };
    return {
      barter: !!entry && entry.barter > 0 && wallet.shares >= entry.barter,
      buy: !!entry && effective.price > 0 && wallet.budget >= effective.price,
      barterAmount: entry ? entry.barter : null,
      buyAmount: effective.price,
      used: effective.used
    };
  }

  // How a placement is paid. `via` is how the player asked to pay: "barter",
  // "buy", "auto" (the preferred currency when both are open: "euro" or
  // "shares", the default) or "gift" (an offering from the community table, which
  // is free). A way that is not open falls back to bartering, then buying; a crop
  // without a barter price is sown from the seed bank for nothing. Returns null
  // when nothing can pay.
  function choosePayment(type, via, wallet, preferred, isCrop) {
    const entry = PRICES[type];
    if (!entry) return null;
    if (via === "gift") return { source: "gift", amount: 0 };
    const effective = effectivePrice(type, wallet.materials);
    const options = paymentOptions(type, wallet);
    const barter = () => ({ source: "barter", amount: entry.barter });
    const buy = () => ({ source: "buy", amount: effective.price, used: effective.used });
    if (via === "barter" && options.barter) return barter();
    if (via === "buy" && options.buy) return buy();
    if (via === "auto" && options.barter && options.buy) return (preferred || "shares") === "euro" ? buy() : barter();
    if (options.barter) return barter();
    if (options.buy) return buy();
    if (isCrop && entry.barter === 0) return { source: "seed", amount: 0 };
    return null;
  }

  // The wallet after a payment from choosePayment: bartering spends shares,
  // buying spends euros and one of each reclaimed material it used.
  function pay(wallet, payment) {
    const shares = wallet.shares - (payment.source === "barter" ? payment.amount : 0);
    const budget = wallet.budget - (payment.source === "buy" ? payment.amount : 0);
    let materials = wallet.materials || {};
    if (payment.source === "buy" && payment.used && payment.used.length) {
      materials = { ...materials };
      payment.used.forEach(material => { materials[material] = Math.max(0, (materials[material] || 0) - 1); });
    }
    return { shares, budget, materials };
  }

  // The milestones a garden has just reached with its gifts so far (`given`),
  // skipping those already `awarded`, and the shares and euros they add. An
  // item milestone is placed on the table by the game.
  function reachMilestones(st) {
    const awarded = (st.awarded || []).slice();
    let shares = st.shares;
    let budget = st.budget;
    const reached = [];
    MILESTONES.forEach(tier => {
      if (st.given >= tier.at && awarded.indexOf(tier.at) < 0) {
        awarded.push(tier.at);
        reached.push(tier);
        if (tier.kind === "shares") shares += tier.value;
        else if (tier.kind === "budget") budget += tier.value;
      }
    });
    return { awarded, shares, budget, reached };
  }

  // What a gift changes: one more gift and one more shared act; produce and
  // elements also add to the shared pool (up to POOL_MAX) and to goodwill.
  // `kind` is "produce", "element" or "seed". Shares and euros never change.
  function afterGift(st, kind) {
    const out = { given: (st.given || 0) + 1, sharedActs: (st.sharedActs || 0) + 1 };
    if (kind !== "seed") {
      out.pool = Math.min(POOL_MAX, st.pool + GIFT_POOL_POINTS[kind]);
      out.goodwill = st.goodwill + 1;
    }
    return out;
  }

  // What the giver gets back for giving an element away: nothing, ever.
  function giftReward() {
    return 0;
  }

  // Whether an element in the garden can be given away, and why. Only a genuine
  // surplus goes: the garden keeps one living example of everything, and an
  // element needs one season to establish. Then a duplicate is a spare that
  // leaves ("spare"), while compost, mulch and a herb spiral can share a
  // division and stay ("division"). A crop gives its harvest, not itself.
  // `sharingOpen` (the community act, lib/acts.js) and `isCrop` come from the
  // game. Reasons when not: "gone", "closed", "crop", "new", "keep".
  const DIVIDABLE = deepFreeze(["compost", "mulch", "herbspiral"]);
  const ESTABLISH_SEASONS = 1;
  function giftable(st, id, sharingOpen, isCrop) {
    const placed = st.placed || [];
    const item = placed.find(p => p.id === id);
    if (!item) return { eligible: false, reason: "gone" };
    if (!sharingOpen) return { eligible: false, reason: "closed" };
    if (isCrop(item.type)) return { eligible: false, reason: "crop" };
    const established = (st.seasonTurns || 0) - (item.placedAtTurn || 0) >= ESTABLISH_SEASONS;
    const copies = placed.filter(p => p.type === item.type).length;
    if (copies < 2) {
      if (DIVIDABLE.indexOf(item.type) >= 0) return established ? { eligible: true, mode: "division" } : { eligible: false, reason: "new", mode: "division" };
      return { eligible: false, reason: "keep" };
    }
    if (!established) return { eligible: false, reason: "new", mode: "spare" };
    return { eligible: true, mode: "spare" };
  }

  // Gathering the last spring sprouts, or raking the last autumn leaf pile, into
  // a compost or mulch bed earns one game share — once per game for each chore
  // (`doneFlag` is the state key that remembers it).
  const CHORE_SHARES = 1;
  function choreReward(st, doneFlag) {
    const hasBin = (st.placed || []).some(p => p.type === "compost" || p.type === "mulch");
    return { hasBin, rewarded: hasBin && !st[doneFlag], shares: hasBin && !st[doneFlag] ? CHORE_SHARES : 0 };
  }

  // The shared pool after a seasonal event (a key of SEASON_POOL_POINTS),
  // kept between 0 and POOL_MAX.
  function poolAfterSeason(pool, event) {
    return Math.max(0, Math.min(POOL_MAX, (pool || 0) + SEASON_POOL_POINTS[event]));
  }

  return {
    VERSION,
    START,
    POOL_MAX,
    PRICES,
    MATERIAL_VALUES,
    BUILD_USES,
    MIN_BUILD_PRICE,
    MILESTONES,
    GIFT_POOL_POINTS,
    STALL_PRICES,
    SEASON_POOL_POINTS,
    effectivePrice,
    paymentOptions,
    choosePayment,
    pay,
    reachMilestones,
    afterGift,
    giftReward,
    DIVIDABLE,
    ESTABLISH_SEASONS,
    giftable,
    CHORE_SHARES,
    choreReward,
    poolAfterSeason
  };
});
