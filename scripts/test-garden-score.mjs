// Unit tests for the garden score and the downloadable certificate.
// The game logic lives in one Design Component class inside the generated game
// fragment; it is evaluated here with minimal React and DCLogic stand-ins.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "Permaculture Garden v2.dc.html"), "utf8");
const fragment = await readFile(path.join(root, "game.fragment.html"), "utf8");

// One formula only: the ring, the reflection card and the certificate must agree.
assert.equal(source.split("systems.average*.78").length - 1, 1, "The garden score formula must exist exactly once (gardenScore).");

const open = fragment.indexOf('<script type="text/x-dc"');
const start = fragment.indexOf(">", open) + 1;
const end = fragment.indexOf("</script>", start);
assert.ok(open >= 0 && start > 0 && end > start, "The game script was not found in game.fragment.html.");

const React = { createElement: (type, props, ...children) => ({ type, props: { ...(props || {}), children } }) };
class DCLogic {
  constructor(props) { this.props = props || {}; this.state = {}; }
  setState(update, done) { Object.assign(this.state, typeof update === "function" ? update(this.state) : update); if (done) done(); }
}
const sandbox = { React, DCLogic, console, Math, Date, JSON, Intl, URL, setTimeout, clearTimeout, setInterval, clearInterval };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fragment.slice(start, end) + "\n;globalThis.__GameComponent = Component;", sandbox);
const game = new sandbox.__GameComponent({});

const threeConnections = {
  season: "Summer", given: 2, sharedActs: 2,
  placed: [
    { id: "a", type: "rain", x: 40, y: 60 }, { id: "b", type: "herbspiral", x: 46, y: 60 },
    { id: "c", type: "hugel", x: 60, y: 70 }, { id: "d", type: "arch", x: 66, y: 70 },
    { id: "e", type: "bughotel", x: 30, y: 75 }, { id: "f", type: "pollinator", x: 36, y: 75 },
    { id: "g", type: "compost", x: 50, y: 80 }, { id: "h", type: "mulch", x: 56, y: 80 }
  ]
};

assert.equal(game.gardenScore({ placed: [] }), 0, "A bare plot scores 0.");
assert.equal(game.activeGuilds(threeConnections.placed).length, 3, "The fixture forms three design connections.");
// Pinned value: the on-screen resilience ring showed 66 for this garden while the
// old certificate formula printed 69. Change it only together with the ring.
assert.equal(game.gardenScore(threeConnections), 66, "The garden score keeps the on-screen formula.");
assert.equal(game.certificateStats(threeConnections).score, 66, "The certificate uses the same garden score.");
const englishCertificate = game.certificateSvg(threeConnections, {}).svg;
assert.match(englishCertificate, />66<\/text>/u, "The downloadable certificate prints the same score as the ring.");

const crowded = {
  season: "Summer", given: 12, sharedActs: 6,
  placed: ["compost", "mulch", "hugel", "rain", "birdbath", "arch", "herbspiral", "greenhouse", "seedbank", "appletree", "pollinator", "bughotel", "birdhouse"]
    .flatMap((type, index) => [0, 1].map(copy => ({ id: type + copy, type, x: 12 + (index % 6) * 14 + copy * 5, y: 30 + Math.floor(index / 6) * 18 + copy * 4 })))
};
const crowdedScore = game.gardenScore(crowded);
assert.ok(crowdedScore > 66 && crowdedScore <= 100, `A crowded, generous garden stays within 0–100 (got ${crowdedScore}).`);

// English certificate: grammatical defaults and plural-aware counts.
const textOf = svg => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/gu)].map(match => match[1]).join(" | ");
const englishText = textOf(englishCertificate);
assert.match(englishText, /My garden today: Connections taking shape\./u, "The default decision sentence is grammatical.");
assert.doesNotMatch(englishText, /a connected a/u);
assert.match(englishText, /· 2 gifts/u);
assert.ok(englishText.includes(new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date())), "English dates keep the day-month-year order.");
assert.match(textOf(game.certificateSvg({ ...threeConnections, given: 1 }, {}).svg), /· 1 gift(?!s)/u, "One gift is singular.");

// Czech certificate: every text comes from the catalogs and the date follows the active language.
const catalogs = Object.fromEntries(await Promise.all(["en", "cs"].map(async locale =>
  [locale, JSON.parse(await readFile(path.join(root, "assets", "i18n", `catalog.${locale}.json`), "utf8"))])));
Object.assign(sandbox, {
  location: { href: "https://garden.example/?lang=cs", search: "?lang=cs", replace() {}, reload() {} },
  navigator: { languages: ["cs"] },
  fetch: async url => {
    const locale = (String(url).match(/catalog\.([A-Za-z-]+)\.json$/u) || [])[1];
    return catalogs[locale] ? { ok: true, json: async () => catalogs[locale] } : { ok: false, status: 404, json: async () => ({}) };
  }
});
vm.runInContext(await readFile(path.join(root, "lib", "i18n.js"), "utf8"), sandbox);
await sandbox.PermacultureI18n.bootstrap();
assert.equal(sandbox.PermacultureI18n.locale, "cs");
const czech = game.certificateSvg(threeConnections, {}).svg;
const czechText = textOf(czech);
const cs = catalogs.cs.messages;
assert.match(czech, /xml:lang="cs"/u);
assert.ok(czechText.includes(cs["certificate.title"]), "The certificate title is Czech.");
assert.ok(czechText.includes(cs["certificate.defaultName"]), "The default gardener name is Czech.");
assert.ok(czechText.includes(new Intl.DateTimeFormat("cs", { day: "numeric", month: "long", year: "numeric" }).format(new Date())), "The date is formatted in Czech.");
assert.ok(czechText.includes(cs["completion.status.connections"]), "The garden status is Czech.");
assert.match(czechText, /· 2 dary/u, "Czech uses the few-form for two gifts.");
assert.match(textOf(game.certificateSvg({ ...threeConnections, given: 5 }, {}).svg), /· 5 darů/u, "Czech uses the other-form for five gifts.");
for (const english of ["Certificate of Learning", "GROWN WITH CARE BY", "A caring gardener", "Next real-world act", "habitat matches", "Care for earth"]) {
  assert.ok(!czechText.includes(english), `The Czech certificate still contains English text: ${english}`);
}

console.log("Garden score and certificate tests passed.");
