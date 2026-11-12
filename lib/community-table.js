(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PermacultureCommunityTable = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // The community table: what neighbours leave on it, when, and what taking
  // an offer costs the shared pool.
  //
  // Rules only (docs/ARCHITECTURE.md). The game keeps the words and the list of
  // what neighbours can offer (`giftPool` in the canonical source: who offers
  // what, in which seasons), and passes that list in. Where chance plays a part,
  // the game draws the random number and passes it in as `roll` (0 ≤ roll < 1).
  const VERSION = "1.0.0";

  // The table holds at most four offers.
  const TABLE_SIZE = 4;
  // A neighbour who leaves an offer without a name is Camille, who keeps the
  // shared pantry.
  const DEFAULT_GIVER = "Camille";
  // A few seconds after a new season, a table with fewer than three offers gets
  // one more with this chance.
  const SEASON_REFILL = Object.freeze({ below: 3, chance: 0.75 });

  // Taking an offer uses points of the shared pool: euros 24, shares 18, a
  // reclaimed material 10, an element 12 — or 18 when the garden already has
  // that element, because then someone else needed it more.
  const OFFER_COSTS = Object.freeze({ budget: 24, shares: 18, material: 10, item: 12, itemAlreadyHere: 18, other: 12 });

  // The table answers only once the garden has given something: it begins with
  // contribution, not a vending machine.
  function reciprocityUnlocked(st) {
    return (st.sharedActs || 0) > 0;
  }

  function isFull(market) {
    return (market || []).length >= TABLE_SIZE;
  }

  // The chance that a neighbour leaves something after the player places an
  // element: more goodwill and a fuller pool make it likelier, up to 60 %; a
  // pool below 20 points halves it.
  function giftChance(st) {
    let chance = Math.min(0.6, 0.12 + st.goodwill * 0.03 + st.pool / 400);
    if (st.pool < 20) chance *= 0.5;
    return chance;
  }

  // Asking the neighbours ("See sharing") finds something with this chance, up
  // to 90 %. One check per gift or season: the key changes when either does.
  function checkChance(st) {
    return Math.min(0.9, 0.35 + st.pool / 160 + st.goodwill * 0.05);
  }
  function checkKey(st) {
    return (st.seasonTurns || 0) + ":" + (st.sharedActs || 0);
  }

  function inSeason(gift, season) {
    return !gift.seasons || gift.seasons.indexOf(season) >= 0;
  }
  function sameOffer(gift) {
    return gift.kind + ":" + (gift.type || gift.mat || gift.value || "");
  }

  // The offer a neighbour leaves: one of the gifts of this season that is not
  // on the table yet (or any gift of this season when all of them are), chosen
  // by `roll`. Null when the season has nothing.
  function pickGift(giftPool, season, market, roll) {
    const seasonal = giftPool.filter(gift => inSeason(gift, season));
    const onTable = new Set((market || []).map(sameOffer));
    const fresh = seasonal.filter(gift => !onTable.has(sameOffer(gift)));
    const choices = fresh.length ? fresh : seasonal;
    return choices[Math.floor(roll * choices.length)] || null;
  }

  // The offer as it lies on the table, with its id.
  function offerFrom(gift, id) {
    const offer = { id, kind: gift.kind, person: gift.person || DEFAULT_GIVER, seasons: gift.seasons, text: gift.text };
    if (gift.kind === "item") offer.type = gift.type;
    if (gift.kind === "material") offer.mat = gift.mat;
    if (gift.kind === "shares" || gift.kind === "budget") offer.value = gift.value;
    return offer;
  }

  // The table of a new garden: the first two gifts of the season.
  function firstOffers(giftPool, season) {
    return giftPool
      .filter(gift => inSeason(gift, season))
      .slice(0, 2)
      .map((gift, index) => ({ ...gift, id: "market-" + season.toLowerCase() + "-" + (index + 1) }));
  }

  // When the season turns, offers of other seasons leave the table; an empty
  // table starts again with the season's first offers.
  function marketForSeason(market, giftPool, season) {
    const kept = market.filter(offer => inSeason(offer, season));
    return kept.length ? kept : firstOffers(giftPool, season);
  }

  // What taking an offer costs the shared pool.
  function offerCost(offer, st) {
    if (!offer) return 0;
    if (offer.kind === "budget") return OFFER_COSTS.budget;
    if (offer.kind === "shares") return OFFER_COSTS.shares;
    if (offer.kind === "material") return OFFER_COSTS.material;
    if (offer.kind === "item") return (st.placed || []).some(p => p.type === offer.type) ? OFFER_COSTS.itemAlreadyHere : OFFER_COSTS.item;
    return OFFER_COSTS.other;
  }

  // Whether the garden may take an offer, its cost and why: "closed" before the
  // garden has given anything, "low" when the pool cannot cover the cost, "ok".
  function canTake(offer, st) {
    const cost = offerCost(offer, st);
    if (!reciprocityUnlocked(st)) return { eligible: false, cost, reason: "closed" };
    if ((st.pool || 0) < cost) return { eligible: false, cost, reason: "low" };
    return { eligible: true, cost, reason: "ok" };
  }

  // What taking an offer changes: it leaves the table, the pool pays its cost
  // (never below 0), and shares, euros or a material arrive. An element is
  // planted by the game as a gift.
  function takeOffer(st, offer, cost) {
    const out = { market: st.market.filter(m => m.id !== offer.id), pool: Math.max(0, st.pool - cost) };
    if (offer.kind === "shares") out.shares = st.shares + offer.value;
    else if (offer.kind === "budget") out.budget = st.budget + offer.value;
    else if (offer.kind === "material") out.materials = { ...(st.materials || {}), [offer.mat]: ((st.materials || {})[offer.mat] || 0) + 1 };
    return out;
  }

  return {
    VERSION,
    TABLE_SIZE,
    DEFAULT_GIVER,
    SEASON_REFILL,
    OFFER_COSTS,
    reciprocityUnlocked,
    isFull,
    giftChance,
    checkChance,
    checkKey,
    pickGift,
    offerFrom,
    firstOffers,
    marketForSeason,
    offerCost,
    canTake,
    takeOffer
  };
});
