// Unit tests for lib/economy.js: game shares, the garden fund, reclaimed
// materials, milestones and the fair-share rule (a gift never pays the giver).
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const economy = require("../lib/economy.js");

// A new garden
assert.deepEqual({ ...economy.START }, { shares: 10, budget: 300, pool: 65, goodwill: 0 });
assert.equal(economy.POOL_MAX, 100);

// Prices: euros, game shares (null: cannot be bartered), crops sown for nothing
assert.equal(economy.PRICES.compost.price, 40);
assert.equal(economy.PRICES.compost.barter, 1);
assert.equal(economy.PRICES.greenhouse.price, 220);
assert.equal(economy.PRICES.greenhouse.barter, null, "a greenhouse cannot be bartered");
for (const [type, entry] of Object.entries(economy.PRICES)) {
  if (type.startsWith("crop_")) assert.deepEqual([entry.price, entry.barter], [0, 0], `${type} is sown from the seed bank for nothing`);
  else assert.ok(entry.price > 0, `${type} has a euro price`);
}
assert.throws(() => { economy.PRICES.compost.price = 1; }, TypeError, "the rule tables cannot be changed by accident");

// Reclaimed materials take their value off a build that can use them, in order,
// as long as the build still costs at least €10.
assert.deepEqual(economy.effectivePrice("greenhouse", {}), { price: 220, used: [] });
assert.deepEqual(economy.effectivePrice("greenhouse", { window: 1, planks: 1 }), { price: 130, used: ["window", "planks"] });
assert.deepEqual(economy.effectivePrice("greenhouse", { window: 0, planks: 2 }), { price: 180, used: ["planks"] });
assert.deepEqual(economy.effectivePrice("kitchen", { planks: 1, window: 1, bricks: 1, straw: 1 }), { price: 10, used: ["planks", "window", "straw"] },
  "bricks would take the kitchen below €10, so straw is used instead");
assert.deepEqual(economy.effectivePrice("compost", { planks: 3 }), { price: 40, used: [] }, "compost uses no reclaimed material");
assert.deepEqual(economy.effectivePrice("nothing", { planks: 1 }), { price: 0, used: [] });
assert.deepEqual(economy.effectivePrice("kitchen"), { price: 120, used: [] });

// The ways to pay that are open
assert.deepEqual(economy.paymentOptions("compost", { shares: 1, budget: 0 }), { barter: true, buy: false, barterAmount: 1, buyAmount: 40, used: [] });
assert.deepEqual(economy.paymentOptions("rain", { shares: 10, budget: 89 }), { barter: false, buy: false, barterAmount: null, buyAmount: 90, used: [] });
assert.equal(economy.paymentOptions("rain", { shares: 0, budget: 90 }).buy, true);
assert.equal(economy.paymentOptions("greenhouse", { shares: 0, budget: 130, materials: { window: 1, planks: 1 } }).buy, true, "materials make a build affordable");
assert.deepEqual(economy.paymentOptions("crop_leafy", { shares: 5, budget: 500 }), { barter: false, buy: false, barterAmount: 0, buyAmount: 0, used: [] });

// How a placement is paid
const wallet = { shares: 1, budget: 100 };
assert.deepEqual(economy.choosePayment("compost", "barter", wallet), { source: "barter", amount: 1 });
assert.deepEqual(economy.choosePayment("compost", "buy", wallet), { source: "buy", amount: 40, used: [] });
assert.deepEqual(economy.choosePayment("compost", "auto", wallet, "euro"), { source: "buy", amount: 40, used: [] });
assert.deepEqual(economy.choosePayment("compost", "auto", wallet, "shares"), { source: "barter", amount: 1 });
assert.deepEqual(economy.choosePayment("compost", "auto", wallet), { source: "barter", amount: 1 }, "shares are the default currency");
assert.deepEqual(economy.choosePayment("compost", "buy", { shares: 1, budget: 10 }), { source: "barter", amount: 1 }, "a way that is not open falls back to bartering");
assert.deepEqual(economy.choosePayment("compost", "barter", { shares: 0, budget: 40 }), { source: "buy", amount: 40, used: [] }, "…then to buying");
assert.deepEqual(economy.choosePayment("crop_potato", "auto", { shares: 0, budget: 0 }, "shares", true), { source: "seed", amount: 0 });
assert.equal(economy.choosePayment("crop_potato", "auto", { shares: 0, budget: 0 }, "shares", false), null, "only a crop is sown for nothing");
assert.equal(economy.choosePayment("rain", "auto", { shares: 99, budget: 0 }), null, "a rain barrel cannot be bartered");
assert.deepEqual(economy.choosePayment("greenhouse", "gift", { shares: 0, budget: 0 }), { source: "gift", amount: 0 }, "a gift from the table is free");
assert.equal(economy.choosePayment("nothing", "gift", wallet), null);

// The wallet after paying
assert.deepEqual(economy.pay({ shares: 5, budget: 200, materials: { window: 1, planks: 2 } }, { source: "buy", amount: 130, used: ["window", "planks"] }),
  { shares: 5, budget: 70, materials: { window: 0, planks: 1 } });
assert.deepEqual(economy.pay({ shares: 5, budget: 200 }, { source: "barter", amount: 2 }), { shares: 3, budget: 200, materials: {} });
assert.deepEqual(economy.pay({ shares: 5, budget: 200 }, { source: "seed", amount: 0 }), { shares: 5, budget: 200, materials: {} });
const stock = { window: 1 };
economy.pay({ shares: 0, budget: 220, materials: stock }, { source: "buy", amount: 170, used: ["window"] });
assert.deepEqual(stock, { window: 1 }, "paying never changes the wallet it was given");

// Milestones, counted in gifts, each once
const purse = { shares: 1, budget: 2 };
assert.deepEqual(economy.reachMilestones({ ...purse, given: 9, awarded: [] }).reached, []);
const ten = economy.reachMilestones({ ...purse, given: 10, awarded: [] });
assert.deepEqual([ten.awarded, ten.shares, ten.budget, ten.reached.map(t => t.kind)], [[10], 1, 2, ["item"]]);
assert.equal(ten.reached[0].type, "pollinator");
const thirty = economy.reachMilestones({ ...purse, given: 30, awarded: [10] });
assert.deepEqual([thirty.awarded, thirty.shares, thirty.budget], [[10, 20, 30], 6, 102]);
assert.deepEqual(economy.reachMilestones({ ...purse, given: 31, awarded: [10, 20, 30] }).reached, [], "a milestone happens once");

// A gift feeds the shared pool and goodwill; it never pays the giver.
const giver = { given: 0, sharedActs: 0, pool: 96, goodwill: 2, shares: 4, budget: 5 };
assert.deepEqual(economy.afterGift(giver, "produce"), { given: 1, sharedActs: 1, pool: 100, goodwill: 3 }, "the pool stops at 100");
assert.deepEqual(economy.afterGift({ ...giver, pool: 40 }, "element"), { given: 1, sharedActs: 1, pool: 50, goodwill: 3 });
assert.deepEqual(economy.afterGift(giver, "seed"), { given: 1, sharedActs: 1 }, "a seed packet counts as a gift and adds no pool points");
for (const kind of ["produce", "element", "seed"]) {
  const after = economy.afterGift(giver, kind);
  assert.ok(!("shares" in after) && !("budget" in after), `a ${kind} gift leaves the giver's shares and euros alone`);
}
for (const type of Object.keys(economy.PRICES)) assert.equal(economy.giftReward(type), 0);

// Only a genuine surplus can be given away.
const notCrop = () => false;
const garden = (placed, seasonTurns = 3) => ({ placed, seasonTurns });
assert.deepEqual(economy.giftable(garden([]), "x", true, notCrop), { eligible: false, reason: "gone" });
assert.deepEqual(economy.giftable(garden([{ id: "a", type: "bench" }]), "a", false, notCrop), { eligible: false, reason: "closed" }, "the table opens with the community act");
assert.deepEqual(economy.giftable(garden([{ id: "a", type: "crop_leafy" }]), "a", true, type => type.startsWith("crop_")), { eligible: false, reason: "crop" }, "a crop gives its harvest");
assert.deepEqual(economy.giftable(garden([{ id: "a", type: "compost", placedAtTurn: 3 }]), "a", true, notCrop), { eligible: false, reason: "new", mode: "division" });
assert.deepEqual(economy.giftable(garden([{ id: "a", type: "compost", placedAtTurn: 2 }]), "a", true, notCrop), { eligible: true, mode: "division" }, "established compost can spare a division and stay");
assert.deepEqual(economy.giftable(garden([{ id: "a", type: "bench", placedAtTurn: 0 }]), "a", true, notCrop), { eligible: false, reason: "keep" }, "the garden keeps one of everything");
assert.deepEqual(economy.giftable(garden([{ id: "a", type: "bench", placedAtTurn: 0 }, { id: "b", type: "bench", placedAtTurn: 3 }]), "b", true, notCrop), { eligible: false, reason: "new", mode: "spare" });
assert.deepEqual(economy.giftable(garden([{ id: "a", type: "bench", placedAtTurn: 0 }, { id: "b", type: "bench", placedAtTurn: 2 }]), "b", true, notCrop), { eligible: true, mode: "spare" });
assert.deepEqual([...economy.DIVIDABLE], ["compost", "mulch", "herbspiral"]);

// Income for the garden fund, chores, and the seasons' effect on the pool
assert.deepEqual({ ...economy.STALL_PRICES }, { preserve: 25, freshCherries: 15 });
assert.deepEqual(economy.choreReward({ placed: [{ type: "mulch" }] }, "rakeRewardDone"), { hasBin: true, rewarded: true, shares: 1 });
assert.deepEqual(economy.choreReward({ placed: [{ type: "compost" }], rakeRewardDone: true }, "rakeRewardDone"), { hasBin: true, rewarded: false, shares: 0 }, "once per game");
assert.deepEqual(economy.choreReward({ placed: [{ type: "bench" }] }, "springForageDone"), { hasBin: false, rewarded: false, shares: 0 });
assert.equal(economy.poolAfterSeason(99, "winterMulched"), 100);
assert.equal(economy.poolAfterSeason(2, "winterBare"), 0);
assert.equal(economy.poolAfterSeason(50, "firstAutumn"), 53);
assert.equal(economy.poolAfterSeason(undefined, "winterMulched"), 2);

console.log("Economy rules OK: prices, reclaimed materials, ways to pay, milestones, fair-share gifts, stall, chores and the seasons' pool.");
