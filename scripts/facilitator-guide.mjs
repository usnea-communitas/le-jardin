// scripts/facilitator-guide.mjs — builds the facilitator guide in docs/facilitator/.
//
// The guide is written by hand in English, Czech and French (guide and plans);
// its chapter on the eleven challenges is generated from the game's own words in
// assets/i18n, so titles, tasks, answers and explanations always match what the
// group sees on screen. Run it after changing the guide, a challenge or a
// translation, and commit the results together:
//
//   node scripts/facilitator-guide.mjs          challenges, QR codes and PDFs
//   node scripts/facilitator-guide.mjs --check  fails when a challenges chapter is stale
//
// The PDFs are printed by Chromium (Playwright, already used by the browser
// tests) in the game's own type, Bricolage Grotesque and Hanken Grotesk.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const GUIDE = path.join(ROOT, "docs", "facilitator");
const SITE = "https://permaculture-garden.vercel.app";
const REPO = "https://github.com/usnea-communitas/le-jardin/blob/main/docs/facilitator/";

// The order the game defines its challenges in, and the catalogue name of each.
const CHALLENGES = ["mulch", "compost", "hugel", "rain", "kitchen", "ladybug", "bee", "shelter", "pexeso", "seeds", "quiz"];
const CATALOG_KEY = { pexeso: "connections" };
// Design connections as the game defines them: element, partner, catalogue keys.
const CONNECTIONS = [
  ["compost", "greenhouse", "hotbed"], ["rain", "herbSpiral", "dripCorner"], ["hugel", "arch", "foodForest"],
  ["bugHotel", "pollinator", "pollinatorPair"], ["seedBank", "pollinator", "seedLibrary"], ["bench", "sign", "classroom"],
  ["mulch", "pollinator", "nectarCover"], ["birdHouse", "hugel", "birdNeighbours"]
];

const cap = (text, locale) => text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);

// What the catalogue does not say: when each challenge appears, how its answer
// reads, and a question for the group. Everything else comes from the game.
const WORDS = {
  en: {
    file: "challenges.md",
    colon: ":",
    heading: "The eleven challenges",
    intro: "A challenge meets the group each time the season turns. The game picks one that fits the garden as it is, preferring the ones played least. The task and the explanation below are the game's own words; the solution is there to unblock a group, not to read out at the start.",
    labels: { when: "When it appears", task: "The task", solution: "Solution", why: "Why", ask: "Ask the group" },
    when: {
      mulch: "Mulch is in the garden; any season except winter.",
      compost: "Compost is in the garden.",
      hugel: "A hügelkultur bed is in the garden.",
      rain: "Rain harvesting is in the garden; spring or summer.",
      kitchen: "The garden kitchen is built.",
      ladybug: "Ladybugs live in the garden (flowers or a herb spiral, and a bug hotel); any season except winter.",
      bee: "Bees visit the garden (flowers and a bird bath); any season except winter.",
      shelter: "Every winter.",
      pexeso: "The group has found at least two design connections.",
      seeds: "A seed bank is in the garden; autumn.",
      quiz: "Any season, when the other challenges have had their turn or none of them fits the garden."
    },
    mulch: "Cover the four beds below 50%: **24%**, **31%**, **38%** and **45%**. The beds at 68% and 72% can wait for the next barrow.",
    compost: (t) => `Exactly four: two greens from *${t.banana}*, *${t.coffee}* and *${t.grass}*, and two browns from *${t.leaves}*, *${t.cardboard}* and *${t.branches}*. Leave out *${t.plastic}* and *${t.meat}*.`,
    order: "From the ground up:",
    rainOrder: "From the roof edge:",
    pexeso: "For each element, the partner from a connection the group has found (the game asks about up to three of them):",
    quiz: "Three of these four situations, in any order:",
    ladybug: (t) => `Choose *${t.flowers}*, *${t.stems}* and *${t.observe}*. Not *${t.spray}*, *${t.strip}* or *${t.bare}*.`,
    ask: {
      mulch: "Why did the driest beds come first, and what would have happened to them on a hot afternoon?",
      compost: "What do greens bring to the pile, what do browns bring, and why does air matter?",
      hugel: "What would you watch in a real woody bed during its first dry summer?",
      rain: "Where does the overflow go, and why is stored roof water not for drinking?",
      kitchen: "Which harvest would you share today, and which would you keep for winter?",
      ladybug: "Why not simply spray the aphids?",
      bee: "What happens to pollinators when everything flowers in the same month?",
      shelter: "Which of these winter homes could you leave in a real garden this autumn?",
      pexeso: "What does each element give the other, and what would turn a pair into a fuller guild?",
      seeds: "Why is the biggest handful not always the best seed to keep?",
      quiz: "Which answer solved today's problem without creating tomorrow's?"
    }
  },
  cs: {
    file: "vyzvy.md",
    colon: ":",
    heading: "Jedenáct výzev",
    intro: "Výzva skupinu čeká pokaždé, když se změní roční období. Hra vybere takovou, která sedí na zahradu, jak právě je, a dává přednost těm, které se hrály nejméně. Úkol a vysvětlení níže jsou slova hry; řešení je tu proto, aby skupina mohla pokračovat, když se zasekne, ne k přečtení na začátku.",
    labels: { when: "Kdy se objeví", task: "Úkol", solution: "Řešení", why: "Proč", ask: "Zeptejte se skupiny" },
    when: {
      mulch: "V zahradě je mulč; kromě zimy v kterémkoli ročním období.",
      compost: "V zahradě je kompost.",
      hugel: "V zahradě je vyvýšený záhon na dřevě (hügelkultur).",
      rain: "V zahradě je zachytávání dešťové vody; na jaře nebo v létě.",
      kitchen: "Zahradní kuchyně je postavená.",
      ladybug: "V zahradě žijí slunéčka (květiny nebo bylinková spirála a hmyzí hotel); kromě zimy.",
      bee: "Zahradu navštěvují včely (květiny a ptačí pítko); kromě zimy.",
      shelter: "Každou zimu.",
      pexeso: "Skupina už našla aspoň dvě návrhová propojení.",
      seeds: "V zahradě je semínkovna; na podzim.",
      quiz: "Kdykoli, když už ostatní výzvy přišly na řadu nebo se žádná z nich na zahradu nehodí."
    },
    mulch: "Zakryj čtyři záhony pod 50 %: **24 %**, **31 %**, **38 %** a **45 %**. Záhony s 68 % a 72 % počkají na další kolečko.",
    compost: (t) => `Přesně čtyři: dvě zelené složky z *${t.banana}*, *${t.coffee}* a *${t.grass}* a dvě hnědé z *${t.leaves}*, *${t.cardboard}* a *${t.branches}*. Vynech *${t.plastic}* a *${t.meat}*.`,
    order: "Odspodu nahoru:",
    rainOrder: "Od okraje střechy:",
    pexeso: "Ke každému prvku jeho partner z propojení, které skupina našla (hra se ptá nanejvýš na tři):",
    quiz: "Tři z těchto čtyř situací, v libovolném pořadí:",
    ladybug: (t) => `Vyber *${t.flowers}*, *${t.stems}* a *${t.observe}*. Ne *${t.spray}*, *${t.strip}* ani *${t.bare}*.`,
    ask: {
      mulch: "Proč přišly na řadu nejdřív nejsušší záhony a co by se s nimi stalo za horkého odpoledne?",
      compost: "Co do kompostu přinášejí zelené složky, co hnědé a proč záleží na vzduchu?",
      hugel: "Čeho byste si všímali u skutečného záhonu na dřevě během jeho prvního suchého léta?",
      rain: "Kam odteče přebytečná voda a proč dešťová voda ze střechy není k pití?",
      kitchen: "Kterou úrodu byste rozdali hned a kterou byste si nechali na zimu?",
      ladybug: "Proč mšice prostě nepostříkat?",
      bee: "Co se stane s opylovači, když všechno kvete ve stejném měsíci?",
      shelter: "Který z těchto zimních úkrytů byste letos na podzim mohli nechat ve skutečné zahradě?",
      pexeso: "Co si prvky navzájem dávají a co by z dvojice udělalo bohatší společenství rostlin?",
      seeds: "Proč největší hrst není vždycky to nejlepší semeno k uchování?",
      quiz: "Která odpověď vyřešila dnešní problém, aniž by vytvořila zítřejší?"
    }
  },
  fr: {
    file: "defis.md",
    colon: "\u00a0:",
    heading: "Les onze défis",
    intro: "Un défi attend le groupe à chaque changement de saison. Le jeu en choisit un qui convient au jardin tel qu’il est, en privilégiant ceux qui ont été le moins joués. La tâche et l’explication ci-dessous sont les mots du jeu ; la solution sert à débloquer un groupe, pas à être lue au départ.",
    labels: { when: "Quand il apparaît", task: "La tâche", solution: "Solution", why: "Pourquoi", ask: "Demandez au groupe" },
    when: {
      mulch: "Il y a du paillis dans le jardin ; en toute saison sauf l’hiver.",
      compost: "Il y a du compost dans le jardin.",
      hugel: "Il y a une butte de culture sur bois (hügelkultur) dans le jardin.",
      rain: "Il y a une récupération d’eau de pluie ; au printemps ou en été.",
      kitchen: "La cuisine du jardin est construite.",
      ladybug: "Des coccinelles vivent dans le jardin (des fleurs ou une spirale d’aromatiques, et un hôtel à insectes) ; sauf l’hiver.",
      bee: "Des abeilles visitent le jardin (des fleurs et un bain d’oiseaux) ; sauf l’hiver.",
      shelter: "Chaque hiver.",
      pexeso: "Le groupe a trouvé au moins deux liens fonctionnels de conception.",
      seeds: "Il y a une grainothèque dans le jardin ; en automne.",
      quiz: "En toute saison, quand les autres défis ont eu leur tour ou qu’aucun ne convient au jardin."
    },
    mulch: "Couvre les quatre planches sous 50 % : **24 %**, **31 %**, **38 %** et **45 %**. Celles à 68 % et 72 % peuvent attendre la prochaine brouette.",
    compost: (t) => `Exactement quatre : deux éléments verts parmi *${t.banana}*, *${t.coffee}* et *${t.grass}*, et deux bruns parmi *${t.leaves}*, *${t.cardboard}* et *${t.branches}*. Laisse de côté *${t.plastic}* et *${t.meat}*.`,
    order: "Du sol vers le haut :",
    rainOrder: "Depuis le bord du toit :",
    pexeso: "Pour chaque élément, son partenaire dans un lien que le groupe a trouvé (le jeu en propose trois au plus) :",
    quiz: "Trois de ces quatre situations, dans n’importe quel ordre :",
    ladybug: (t) => `Choisis *${t.flowers}*, *${t.stems}* et *${t.observe}*. Pas *${t.spray}*, *${t.strip}* ni *${t.bare}*.`,
    ask: {
      mulch: "Pourquoi les planches les plus sèches passaient-elles en premier, et que leur serait-il arrivé par un après-midi chaud ?",
      compost: "Qu’apportent les verts au tas, qu’apportent les bruns, et pourquoi l’air compte-t-il ?",
      hugel: "Qu’observeriez-vous sur une vraie butte en bois pendant son premier été sec ?",
      rain: "Où va le trop-plein, et pourquoi l’eau de pluie d’un toit ne se boit-elle pas ?",
      kitchen: "Quelle récolte partageriez-vous aujourd’hui, et laquelle garderiez-vous pour l’hiver ?",
      ladybug: "Pourquoi ne pas simplement pulvériser les pucerons ?",
      bee: "Que deviennent les pollinisateurs quand tout fleurit le même mois ?",
      shelter: "Lequel de ces abris d’hiver pourriez-vous laisser cet automne dans un vrai jardin ?",
      pexeso: "Qu’est-ce que chaque élément apporte à l’autre, et que faudrait-il pour qu’une paire devienne une guilde plus riche ?",
      seeds: "Pourquoi la plus grosse poignée n’est-elle pas toujours la meilleure graine à garder ?",
      quiz: "Quelle réponse a réglé le problème du jour sans créer celui de demain ?"
    }
  }
};

async function catalog(locale) {
  const raw = JSON.parse(await readFile(path.join(ROOT, "assets", "i18n", `catalog.${locale}.json`), "utf8"));
  const english = locale === "en" ? raw : JSON.parse(await readFile(path.join(ROOT, "assets", "i18n", "catalog.en.json"), "utf8"));
  return key => {
    const value = raw.messages[key] ?? english.messages[key];
    if (typeof value !== "string") throw new Error(`catalog.${locale}.json has no text for ${key}`);
    return value;
  };
}

export async function challengesMarkdown(locale) {
  const w = WORDS[locale];
  const t = await catalog(locale);
  const c = (key, part) => t(`challenge.${CATALOG_KEY[key] || key}.${part}`);
  const pick = (prefix, names) => Object.fromEntries(names.map(name => [name, t(`${prefix}${name}`)]));
  const arrow = list => list.map(item => `*${item}*`).join(" → ");
  const solution = {
    mulch: () => w.mulch,
    compost: () => w.compost(pick("challenge.compost.item.", ["banana", "coffee", "grass", "leaves", "cardboard", "branches", "plastic", "meat"])),
    hugel: () => `${w.order} ${arrow(["logs", "branches", "leaves", "compost", "soil"].map(k => t(`challenge.hugel.layer.${k}.name`)))}.`,
    rain: () => `${w.rainOrder} ${arrow(["gutter", "screen", "barrel", "swale"].map(k => t(`challenge.rain.${k}.name`)))}.`,
    kitchen: () => [["cherries", "jam"], ["apples", "dry"], ["cabbage", "ferment"], ["herbs", "dry"], ["leafy", "fresh"], ["roots", "cellar"]]
      .map(([crop, method]) => `- *${t(`challenge.kitchen.method.${method}.name`)}*${w.colon} ${t(`challenge.kitchen.why.${crop}`)}`).join("\n"),
    ladybug: () => w.ladybug(pick("challenge.ladybug.action.", ["flowers", "stems", "observe", "spray", "strip", "bare"])),
    bee: () => [["spring", "willow"], ["summer", "borage"], ["autumn", "ivy"]]
      .map(([season, plant]) => `${cap(t(`season.${season}.name`), locale)}${w.colon} *${t(`challenge.bee.${plant}`)}*`).join(" · ") + ".",
    shelter: () => [["hedgehog", "leaves"], ["ladybug", "stems"], ["worm", "compost"], ["butterfly", "woody"]]
      .map(([animal, home]) => `*${t(`challenge.shelter.${animal}`)}* → *${t(`challenge.shelter.${home}.name`)}*`).join(" · ") + ".",
    pexeso: () => w.pexeso + "\n\n" + CONNECTIONS
      .map(([a, b, guild]) => `- *${t(`catalog.${a}.name`)}* → *${t(`catalog.${b}.name`)}* (${t(`guild.${guild}.name`)})`).join("\n"),
    seeds: () => [["herb", "save"], ["leafy", "wait"], ["cabbageWet", "wait"], ["mould", "reject"], ["cabbageDry", "save"]]
      .map(([batch, action]) => `- *${t(`challenge.seeds.batch.${batch}.title`)}* → *${t(`challenge.seeds.action.${action}.name`)}*`).join("\n"),
    quiz: () => w.quiz + "\n\n" + [["hot", "deep"], ["bed", "layer"], ["slug", "balance"], ["surplus", "share"]]
      .map(([q, a]) => `- ${t(`challenge.quiz.${q}.question`)} → *${t(`challenge.quiz.${q}.${a}.label`)}*`).join("\n")
  };
  const blocks = CHALLENGES.map((key, i) => {
    const answer = solution[key]();
    const block = answer.includes("\n") ? `**${w.labels.solution}.**\n\n${answer}` : `**${w.labels.solution}.** ${answer}`;
    return [
      `### ${i + 1}. ${c(key, "title")}`,
      `*${c(key, "principle")}* · **${w.labels.when}${w.colon}** ${w.when[key]}`,
      `**${w.labels.task}.** ${c(key, "prompt")}`,
      block,
      `**${w.labels.why}.** ${c(key, "lesson")}`,
      `**${w.labels.ask}.** ${w.ask[key]}`
    ].join("\n\n");
  });
  const text = `# ${w.heading}\n\n${w.intro}\n\n${blocks.join("\n\n")}\n`;
  // French sets a no-break space before ? ! : ; so the mark never starts a line
  const typeset = locale === "fr" ? text.replace(/ ([?!:;»])/g, "\u00a0$1").replace(/« /g, "«\u00a0") : text;
  return `<!-- Generated by scripts/facilitator-guide.mjs from assets/i18n/catalog.${locale}.json. Edit the script or the catalogue, not this file. -->\n\n${typeset}`;
}

// The parts of each PDF, in order, and the words around them.
export const GUIDES = {
  en: { parts: ["guide.md", "challenges.md", "plans.md"], title: "Le Jardin · Facilitator guide", lead: "Workshop mode, the six acts, the eleven challenges and session plans", page: "page", contents: "Contents" },
  cs: { parts: ["pruvodce.md", "vyzvy.md", "plany.md"], title: "Le Jardin · Průvodce pro facilitátory", lead: "Režim workshopu, šest dějství, jedenáct výzev a plány lekcí", page: "strana", contents: "Obsah" },
  fr: { parts: ["guide.md", "defis.md", "deroulements.md"], title: "Le Jardin · Guide d’animation", lead: "Le mode atelier, les six actes, les onze défis et des déroulés de séance", page: "page", contents: "Sommaire" }
};
export const pdfName = locale => `le-jardin-facilitator-guide-${locale}.pdf`;

const FONT_FILES = {
  "Bricolage Grotesque": [["268f057e-7d88-4bfc-af3c-98d4cd308f56", "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"], ["046f8192-7261-4617-8fc9-dc35b3bb6432", "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1E00-1E9F, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF"]],
  "Hanken Grotesk": [["048df43a-fe9b-45a8-b411-e39d84d8ca7f", "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"], ["b55210b1-8cf9-41e5-9983-ed758dbf9ceb", "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1E00-1E9F, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF"]]
};
const FONTS = Object.entries(FONT_FILES).flatMap(([family, files]) => files.map(([file, range]) =>
  `@font-face{font-family:'${family}';font-weight:${family === "Hanken Grotesk" ? "400 700" : "400 800"};src:url(${pathToFileURL(path.join(ROOT, "assets", "fonts", file + ".woff2")).href}) format('woff2');unicode-range:${range}}`)).join("\n");

// the game's palette: moss greens on warm paper
const CSS = `
${FONTS}
@page{size:A4;margin:17mm 17mm 19mm}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;color:#2c3525;font:400 10.4pt/1.52 'Hanken Grotesk','DejaVu Sans',sans-serif}
h1,h2,h3{font-family:'Bricolage Grotesque','DejaVu Sans',sans-serif;color:#3f5c33;line-height:1.18;break-after:avoid}
h1{font-size:23pt;font-weight:700;margin:0 0 9pt;letter-spacing:-.01em;break-before:page}
main>h1:first-child{break-before:auto}
h2{font-size:14.5pt;font-weight:700;margin:17pt 0 6pt}
h3{font-size:12pt;font-weight:700;margin:15pt 0 4pt;color:#33502a}
p{margin:0 0 6.5pt}
a{color:#3f5c33;text-decoration:underline;text-decoration-color:#b9c7a8;text-underline-offset:2px}
strong{font-weight:700;color:#2f3b2a}
em{font-style:italic}
ul,ol{margin:0 0 7pt;padding-left:15pt}
li{margin:2pt 0}
code{font-family:inherit;background:#eaf1dc;padding:0 3pt;border-radius:3pt}
table{width:100%;border-collapse:collapse;margin:6pt 0 12pt;font-size:9.6pt;break-inside:avoid}
th,td{text-align:left;vertical-align:top;padding:4pt 6pt;border-bottom:.6pt solid #d8cdb4}
th{color:#3f5c33;border-bottom:1pt solid #5e7e4a}
td:first-child{white-space:nowrap;width:16%}
h3+p,h3+p+p{break-inside:avoid}
p:has(+ul),p:has(+ol){break-after:avoid}
.qr-row{display:flex;gap:16pt;margin:8pt 0 10pt}
.qr-row figure{margin:0;text-align:center;font-size:9pt;color:#5f584a}
.qr-row img{display:block;width:31mm;height:31mm;margin-bottom:3pt}
.cover{height:252mm;display:flex;flex-direction:column;justify-content:center;break-after:page}
.cover .brand{font:700 12pt 'Hanken Grotesk',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#7b6327;margin:0 0 12pt}
.cover h1{font-size:34pt;margin:0 0 12pt;break-before:auto}
.cover p{font-size:13pt;color:#5c5545;max-width:125mm}
.cover h2{font-size:11pt;letter-spacing:.12em;text-transform:uppercase;color:#7b6327;margin:28pt 0 6pt}
.cover ol{font-size:12pt;padding-left:16pt}
.cover .link{margin-top:24pt;font-size:10pt;color:#5c5545}
`;

function absoluteLinks(html, locale) {
  return html.replace(/href="(?!https?:|mailto:|#)([^"]+?\.md)(#[^"]*)?"/g, (_, file, hash = "") => `href="${REPO}${locale}/${file}${hash}"`);
}

async function guideHtml(locale) {
  const { marked } = await import("marked");
  const guide = GUIDES[locale];
  const parts = await Promise.all(guide.parts.map(async file => absoluteLinks(marked.parse(await readFile(path.join(GUIDE, locale, file), "utf8")), locale)));
  const titles = parts.map(html => (html.match(/<h1[^>]*>(.*?)<\/h1>/) || [])[1]).filter(Boolean);
  const [brand, name] = guide.title.split(" · ");
  const cover = `<section class="cover"><p class="brand">${brand}</p><h1>${name}</h1><p>${guide.lead}</p>` +
    `<h2>${guide.contents}</h2><ol>${titles.map(title => `<li>${title}</li>`).join("")}</ol>` +
    `<p class="link">${SITE}/?workshop=1&amp;lang=${locale}</p></section>`;
  const base = pathToFileURL(path.join(GUIDE, locale) + path.sep).href;
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>${guide.title}</title><base href="${base}"><style>${CSS}</style></head><body>${cover}<main>${parts.join("\n")}</main></body></html>`;
}

export async function writeQrCodes() {
  const { default: QRCode } = await import("qrcode-svg");
  await mkdir(path.join(GUIDE, "qr"), { recursive: true });
  for (const locale of Object.keys(GUIDES)) {
    const link = `${SITE}/?workshop=1&lang=${locale}`;
    const options = { content: link, ecl: "M", padding: 4, color: "#1F2A1B", background: "#FFFFFF", join: true, container: "svg-viewbox" };
    const size = (new QRCode(options).qrcode.getModuleCount() + 8) * 4;
    const svg = new QRCode({ ...options, width: size, height: size }).svg()
      .replace(/\r\n?/g, "\n")
      .replace(/^<\?xml[^>]*>\s*/, "")
      .replace(/ style="fill:(#[0-9A-F]+);shape-rendering:crispEdges;"/g, ' fill="$1" shape-rendering="crispEdges"')
      .replace(/ x="0" y="0"(?= fill)/g, "")
      .replace(/(<svg[^>]*>)/, `$1<desc>${link.replace(/&/g, "&amp;")}</desc>`);
    await writeFile(path.join(GUIDE, "qr", `workshop-${locale}.svg`), svg + "\n");
  }
}

export async function writeChallenges({ check = false } = {}) {
  const stale = [];
  for (const locale of Object.keys(GUIDES)) {
    const file = path.join(GUIDE, locale, WORDS[locale].file);
    const next = await challengesMarkdown(locale);
    const current = await readFile(file, "utf8").catch(() => "");
    if (current === next) continue;
    if (check) stale.push(path.relative(ROOT, file));
    else await writeFile(file, next);
  }
  return stale;
}

export async function writePdfs() {
  const { chromium } = await import("./load-playwright.mjs");
  await mkdir(path.join(GUIDE, "pdf"), { recursive: true });
  const work = path.join(tmpdir(), "le-jardin-facilitator-guide");
  await mkdir(work, { recursive: true });
  const browser = await chromium.launch();
  const made = [];
  try {
    for (const [locale, guide] of Object.entries(GUIDES)) {
      const htmlFile = path.join(work, `${locale}.html`);
      await writeFile(htmlFile, await guideHtml(locale));
      const tab = await browser.newPage();
      await tab.goto(pathToFileURL(htmlFile).href, { waitUntil: "load" });
      await tab.evaluate(() => document.fonts.ready);
      const bytes = await tab.pdf({
        format: "A4", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate: `<div style="width:100%;margin:0 17mm;font:7.5px sans-serif;color:#5f584a;display:flex;justify-content:space-between">` +
          `<span>${guide.title} · © 2026 Martin Pazderník</span><span>${guide.page} <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`
      });
      await writeFile(path.join(GUIDE, "pdf", pdfName(locale)), bytes);
      await tab.close();
      made.push({ file: pdfName(locale), bytes: bytes.length });
    }
  } finally {
    await browser.close();
    await rm(work, { recursive: true, force: true });
  }
  return made;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--check")) {
    const stale = await writeChallenges({ check: true });
    if (stale.length) {
      console.error(`Stale facilitator guide chapters: ${stale.join(", ")}. Run node scripts/facilitator-guide.mjs.`);
      process.exit(1);
    }
    console.log("The facilitator guide's challenge chapters match the game's catalogues.");
  } else {
    await writeChallenges();
    await writeQrCodes();
    for (const { file, bytes } of await writePdfs()) console.log(`docs/facilitator/pdf/${file}  ${Math.round(bytes / 1024)} kB`);
  }
}
