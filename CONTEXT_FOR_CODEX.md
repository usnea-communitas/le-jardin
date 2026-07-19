# Permaculture Garden — kompletní kontext pro Codex

> Předávací dokument. Vysvětluje **co** hra je, **jak** je postavená a **proč** jsme jednotlivé
> věci implementovali. Aktuální verze: **v73**. Hlavní zdroj: `Permaculture Garden v2.dc.html`
> (needituj bundle `index.html` — ten se generuje).

---

## 1. Účel a publikum (PROČ hra existuje)

**Cíl:** zábavnou formou vzdělávat o **permakulturní zahradě** — co to je, jak funguje a proč je
**komunitní sdílení** jedním z jejích hlavních pilířů.

**Primární cílovka:** menší skupiny 10–25 lidí. Konkrétně **Erasmus+ projekt „Permacultural
garden" v Menet (Francie)** — účastníci z různých zemí, kteří tu zahradu nakonec budou fyzicky
budovat. Do budoucna: vzdělávací instituce, neziskovky, další Erasmus projekty.

**Zařízení:** primárně **počítač** (desktop/laptop, různá rozlišení). Tablet a mobil jsou
odložené na samostatnou fázi/projekt — desktop je hotový a odladěný.

**Didaktické jádro (co si má hráč odnést):**
- permakultura = práce s přírodou, ne proti ní (půda, voda, jídlo, úkryt, živá půda)
- **„economy of gift"** (inspirace: Robin Wall Kimmerer, *The Serviceberry*) — kolik dáš komunitě,
  tolik se ti vrátí. Proto je **barter/sdílení v popředí** a peníze jen doplněk.
- sezónnost — příroda i zahrada se mění s ročním obdobím; v zimě se neroste, sklízí se v okně

---

## 2. Technický základ (JAK to běží)

- **Hlavní zdroj:** `Permaculture Garden v2.dc.html`. Je to „Design Component" (DC) —
  vlastní runtime + React. `node scripts/build.mjs` z něj vytváří přímý statický `index.html`.
- Struktura uvnitř: `<x-dc>` **template** (markup s `{{ }}` holes, `<sc-if>`, `<sc-for>`) +
  **logická třída** `class Component extends DCLogic { … }` (plain JS, chová se jako React
  class component: `state`, `setState`, `renderVals()`, lifecycle).
- `renderVals()` vrací všechny hodnoty, které template konzumuje. Veškerá herní logika je tam.
- Herní UI používá převážně inline styly. Samostatný filmový úvod má kvůli animacím sadu
  izolovaných tříd s prefixem `pg-story-*` v `<helmet>`.
- Produkční `index.html` je malá okamžitá načítací obrazovka; po prvním vykreslení načte
  `game.fragment.html`, lokální `vendor/` skripty a fonty v `assets/fonts/`. Starší pomalé
  rozbalování celé aplikace v prohlížeči už se nepoužívá. Obrázky zůstávají jako relativní
  `assets/*.webp`, takže se vždy nasazuje celý kořen projektu.

### Persistence
`localStorage` klíč `permagarden_v2`. Ukládá se `placed`, `shares`, `budget`, `given`, `pool`,
`goodwill`, `discovered`, `awarded`, `basket`, `materials`, `guests`, `visitsDone`,
`gatesPlayed`, `harvestEver`, `season`, `storySeen`, `introSeen`, `guildVoicePlayed` atd. **Sezóna se při čerstvém spuštění resetuje na léto**
(default), ale při obnovení stránky v témž sezení se zachová naposledy zvolená.

---

## 3. Layout obrazovky

Tři sloupce (CSS grid, clamp šířky pro různá rozlišení, strop max-width 1720 px, vycentrováno):

- **Vlevo — paleta prvků** ve skupinách: *Core* (kompost, hügel, dešťovka, mulč…),
  *Useful extras* (broučí hotel, oblouk, bylinková spirála, opylovači, skleník, semínková banka,
  **jabloň**, **kuchyň**), *From the seed bank* (plodiny — zdarma jako semínka).
- **Uprostřed — mapa zahrady** (cvičný plácek). Perspektiva shora s úběžníkem u brány; prvky se
  zmenšují podle vzdálenosti. Pevně: velká **třešeň** uprostřed nahoře, **branka** dole se
  sezónní podobou a nápisem **„Menet"**, tráva/hlína/plevel. Sem se drag&dropují prvky.
- **Vpravo — skóre nahoře** (jak je zahrada úplná/permakulturně správná), **„Who lives in your
  garden"** (zvířata/houby, které reagují na to, co zahrada nabízí), **Harvest basket**,
  **Reclaimed materials**, **Community sharing table** dole.

---

## 4. Herní mechaniky (CO a PROČ)

### 4.1 Umisťování prvků
Drag&drop z palety na mapu, i „klik na kartu → klik na plácek". Během tažení je vidět **ikona
prvku v ruce** (sleduje kurzor). Prvky mají sezónní podobu (léto/podzim/zima/jaro), zima má
vlastní zasněžené sprity.

### 4.2 Ekonomika sdílení (JÁDRO hry — „economy of gift")
Dvě měny:
- **€ budget** — omezený; některé věci se dají koupit jen za peníze (lavička, ptačí budka…)
- **Eco-shares** — získávají se **dáváním komunitě**, utrácejí se **barterem** za prvky

**Give to the community table** (velké animované tlačítko s dlaní): dáš prvek/úrodu → +share,
gift „putuje dál". Reciprocity: dary se vracejí („soused přinesl prkna…"). Materiály od sousedů
(prkna/okno/cihly/sláma) se objevují sezónně a **automaticky zlevňují stavbu kuchyně a skleníku**.

> **Proč:** naučit „ber si, co potřebuješ, ne víc" a „kolik dáš, tolik se vrátí".

### 4.3 Guildy (plant guilds)
Když hráč umístí dva kompatibilní prvky **vedle sebe**, objeví se guilda (Hotbed, Drip corner,
Food forest, Pollinator, Seed library, Classroom, Pest patrol). Guild UI je drawer; objevené
guildy mají kartu „co vzniklo / proč funguje / koho přitáhne" + malovanou vignetu. Vedení hráče:
při výběru prvku se zvýrazní kompatibilní sousední místa (ghost-targets) + hint.

### 4.4 Wildlife (kdo žije v zahradě)
10 druhů (žížala, 3 houby, včela, motýl, pták, ježek, beruška, střevlík). Přicházejí, když
zahrada splní jejich potřeby (jídlo/voda/úkryt/živá půda) — pravidla nastavená tak, aby příchod
odrážel realitu a nebyl moc snadný. Příchod = **velká oslavná karta** (malovaný hero portrét,
konfety, jméno, proč přišli). Kliknutím na už přítomné zvíře se karta zobrazí znovu.
V zimě někteří spí (brouci v broučím hotelu → 💤).

### 4.5 Sklizeň a kuchyň
- **Třešeň** — v létě 3 trsy zralých třešní ke sběru
- **Jabloň** — na podzim dozrají jablka
- **Plodiny ze semínkové banky** (brambory, kořenová, listová, zelí, bylinky) — zdarma jako
  semínka, ale nejdřív musí stát **Seed bank**; rostou přes sezóny (3 fáze), sklízí se jen ve
  svém okně (brambory/zelí podzim, greens jaro/léto, bylinky léto)
- **Zahradní kuchyň** — prezervace: třešně→marmeláda, jablka→sušená, zelí→sauerkraut,
  bylinky→sušené. **Čerstvé se sdílí jen v sezóně, zavařeniny kdykoliv (i v zimě).**

> **Proč:** propojit zahradu se společným stolem — máš co dávat po celý rok.

### 4.6 Sezónnost
4 roční období, přepínání tlačítkem „Next season" i kliknutím na ikonu. Mění se: podoba prvků,
strom, branka, co roste, co lze sklízet, co se objevuje na sharing table (sezónní dary), spánek
zvířat. Některé prvky/plodiny **nelze přidat mimo sezónu**; v zimě se neroste. Jarní sběr
divokých bylin, podzimní hrabání listí.

### 4.7 Season gates — naučné minihry (11 kusů)
Při přepnutí sezóny se otevře „brána" s minihrou vybranou podle toho, co hráč má v zahradě
(nejméně hrané mají přednost, vždy jde přeskočit, dokončení = +1 share + přenositelné ponaučení).
Od verze **v58** jsou všechny minihry přepracované jako jednotné „Garden challenges": nejdřív krátké
příběhové zadání a princip, potom praktická volba s okamžitou vysvětlující zpětnou vazbou a nakonec
shrnutí naučené dovednosti. Nejsou v nich časovače ani reflexní klikání a chyba hráče úlohu neukončí —
hráč dostane vodítko a může své řešení opravit.

Aktuálních 11 výzev: záchrana půdní vláhy (priorita záhonů podle vlhkosti), vyvážený kompost
(2 greens + 2 browns, bez kontaminace), vrstvení hügelkultury, návrh cesty dešťové vody, plán zimní
spíže, obnova přirozené rovnováhy proti mšicím, třísezónní kalendář nektaru, přiřazení zimních
úkrytů, doplnění funkčních guild, výběr zdravého a suchého osiva a scénářové systémové rozhodování.
Logika: `applySeason → pickGate → startGate (brief) → gateBegin → gateAct → gateResolve → gateFinish`,
view v `buildGateView()`, definice v `gateDefs()`. Na localhostu je instance pro automatické testy
dostupná jako `window.__PERMAGARDEN_APP__`; na produkční doméně se tento hook nevytváří.

### 4.8 Wildlife kvízy / speciální eventy
Občas po přidání prvku speciální event („ve vedlejší zahradě se objevil ježek — odpověz na
otázku / vyhraj minihru a přijde k tobě"). 10 wildlife kvízů s obrázky.

### 4.9 Filmový storytellingový úvod + onboarding + certifikát
Od verze **v59** před onboardingem běží přibližně minutový hybridní malovaný úvod
**„The Garden Is Waiting“**. Zahrada v Menet vypráví v první osobě sedm kapitol: tiché místo,
život pod půdou, nerovnováha, příchod mladých lidí, první permakulturní změny, živá síť vztahů
a osobní pozvání hráče. Každá kapitola má samostatný obraz v `assets/story/story-01-*.webp` až
`story-07-*.webp`, jemný Ken Burns pohyb, prolínačku a vždy viditelné anglické titulky.
Od **v60** má každá kapitola samostatné anglické vyprávění hlasem ElevenLabs
**„The Garden of Menet“** (`Ks7JQ2YMsS1TBefsBD27`), souvislou organickou hudbu a terénní
atmosféru francouzské venkovské zahrady. Ovládání: pause/resume, mute, předchozí/další kapitola, kapitoly
v tečkách a skip. Poslední CTA **Enter the garden** se rozpustí do původního onboardingu.

Nový hráč vidí story jednou a potom onboarding. Starší save bez `storySeen` uvidí story jednou,
ale jeho herní postup zůstane zachován; pokud už onboarding absolvoval, vrátí se po filmu rovnou
do hry. V onboardingu je **Replay “The Garden Is Waiting”** a přehrání se potom vrátí zpět do
onboardingu. Stav je oddělený (`story`, `storySeen`, `storyStarted`, `storyScene`, `storyPaused`,
`storyLeaving`, `storyToIntro`, `intro`, `introSeen`), aby se modal visibility nezaměňovala za
dokončení. `prefers-reduced-motion` vypíná filmové animace, obsah i ovládání zůstávají dostupné.

Potom následuje jemný krokový průvodce: Soil → Water → Food → Shelter → Sharing → Guild → Harvest. Když je hráč
hotový, tlačítko u skóre vygeneruje **přehledovou kartu/certifikát** (jméno, skóre, získaná
zvířata, co udělal dobře + co zlepšit, **zmenšenina zahrady**) — lze ho uložit jako samostatný
SVG obrázek nebo vytisknout.

### 4.10 Vizuální návaznost onboarding → hra
Od **v61** používá hlavní herní rozhraní stejný vizuální jazyk jako filmový úvod: teplé
krémové glass panely, větší zaoblení a měkké
stíny, šalvějové a zlaté akcenty a tmavá průsvitná horní lišta. Záměrně se neměnila herní
architektura ani třísloupcové rozložení — skin sjednocuje příběh, onboarding a herní plochu,
aniž by narušil mapu, mechaniky nebo hustotu informací. Třídy začínají `pg-game-*`, společné
panely používají `pg-panel`; hlavní tokeny a skin jsou ve scoped CSS pod `.pg-game-shell`.
Příběh má v horní liště samostatné viditelné tlačítko **Play story**; otazník zůstává jen pro
stručný návod. Přehrání z horní lišty se po skončení vrací přímo do hry.

Od **v64** běží kolem panelů čistá, lokálně zesmyčkovaná 10s video scéna Menet z Klingu
(`assets/video/garden-ambient-loop.*`). Video se zobrazuje v původních barvách a ostrosti — bez
béžového překryvu, průhlednosti, barevného filtru nebo rozmazání. Při `prefers-reduced-motion`
se místo pohybu zobrazí čistý statický první obraz.

Od **v65** už horní lišta není tmavá: používá světlé krémové onboardingové sklo, šalvějovou
typografii a ovládání a jemné zlaté zvýraznění tlačítka příběhu.

Od **v66** je hra sjednocená podle společného Lovable + Picsart design labu: teplé papírové povrchy,
jemná botanická linková kresba, serifová hierarchie pro příběhové okamžiky a jedna osmičlenná rodina
SVG ikon (`assets/ui/icons/`) pro půdu, vodu, potravní síť, habitat, fair share, guildy, sezóny a hlas
zahrady. Čtyři malované obrazy v `assets/season-passages/` se používají pouze v season gates a
filmových mezikrocích; nenahrazují čistou Kling video smyčku kolem panelů.

Hlas zahrady má tři registry: (1) neblokující šeptání nad mapou s automatickým zavřením a krátkým
replay oknem, (2) zaslouženou reflexní kartu po důležitých milnících a (3) vzácný celoplošný filmový
moment po dokončení změny sezóny. Vždy mluví v první osobě, přítomném čase, jedním krátkým dechem,
bez kárání. Text zůstává dostupný při mute i při případné chybě zvuku.

Od **v67** je v `gardenVoiceFiles` zapojeno 13 hotových anglických replik hlasem ElevenLabs
**The Garden of Menet / Voice 1**: první péče o půdu, vodu, potravu a habitat; první komunitní dar;
první objevená guilda; reflexe po třech vrstvách a po fair-share milníku; jarní, letní, podzimní a
zimní filmový přechod; a zasloužené dokončení zahrady. První guilda se pamatuje přes
`guildVoicePlayed`, takže hlas neopakuje každou další kombinaci. Sezónní titulky přesně odpovídají
nahrávce. Délka ztišení hudby se řídí skutečnou délkou hlasu a zavření karty hlas okamžitě a čistě
ukončí.

Od **v68** je samotná desktopová herní obrazovka dotažená podle schváleného Lovable/Picsart
konceptu do jednoho vizuálního světa. Header a třísloupcový workspace tvoří jeden zaoblený herní
rám, mezery a vnitřní karty používají kompaktnější společný rytmus a centrální cvičný plácek má
malebný obraz zahrady Menet ze stejné obrazové rodiny jako onboarding
(`assets/story/story-07-invitation.webp`). Herní perspektivní mřížka a kreslená cesta zůstávají jen
velmi jemnou funkční pomůckou; sezónní tinty, herní prvky, drag/drop souřadnice i Kling video bez
filtru kolem panelů zůstávají zachované.

Od **v69** je tento sjednocený design technicky vytvrzený pro produkci: obnovená hra neztrácí první
akci, rozpracované návštěvy, guild karty, příjezdy živočichů, sezónní cinematic, šeptání ani reflexe;
reset odstraňuje všechny časovače a přechodné dialogy. Více současných objevů se řadí do front a
reflexe se označí jako přečtená až po vědomém zavření. Zvuky a vyprávění se načítají líně, dialogy
správně vlastní svůj hlas, titulky zůstávají vždy dostupné a klíčové hlasy lze znovu přehrát. Story
načítá jen aktuální a sousední obraz, zatímco video za ní neběží. Přibylo chybové zotavení loaderu,
skip link, sémantické nadpisy a landmarky, opravdové button prvky a vícerozměrová regresní kontrola.

Od **v70** má hra férovější a čitelnější dlouhodobou smyčku. První vedený průchod končí reflexí;
certifikát se odemyká až po skutečně prosperující zahradě napříč čtyřmi obdobími, aktivních guildách,
sdílení, sklizni a více vyzkoušených výzvách. Volba mezi barterem a eury je viditelná a záměrná, semena jsou
omezena na jeden balíček dané plodiny za sezónu a komunitní dar nikdy přímo nevydělává osobní měnu.
Zimní stav rozlišuje chráněné, spící a ztracené mladé plodiny. Zahrada navíc vizuálně roste ve třech
malovaných fázích (prázdná, rozvíjející se, prosperující), sdílený fond ukazuje číslo i očekávaný dopad
a závěrečná reflexe/export zachycují skutečné hráčovy prvky, rozhodnutí, princip i další reálný krok.
Pozdější guildy a živočichové už neruší proud opakovanými modály; ukládají se do journalu a ozvou se
jemným oznámením. Video se pod dialogy zastavuje a při `prefers-reduced-motion` se vůbec nenačítá.
Komunitní nabídky lze převzít až po prvním skutečném daru, jejich převzetí spotřebovává sdílený fond
a jeden dar/sezónní stav dovolí jen jednu ruční kontrolu nových nabídek; nalezení nabídky nikdy samo
nepřipíše osobní měnu. Export certifikátu se připravuje až na kliknutí a vkládá malovanou mapu i
všechny použité WebP prvky přímo do SVG, takže stažený soubor zůstává úplný i offline.

Od **v73** nahrazuje opakovaný platební modal trvalý přepínač **Shares / Fund** v levé paletě.
Preferovaný zdroj se ukládá; pokud není dostupný, umístění bezpečně použije druhý platný zdroj místo
zablokování hry. Zasloužené reflexe mají dvouvrstvou akvarelovou vignetu
(`assets/reflections/*-background.webp` + `*-motif.webp`) s velmi pomalým dýcháním motivu a plnou
podporou `prefers-reduced-motion`. Obraz se vybírá podle typu reflexe a zimní obecné reflexe používají
spící zasněženou zahradu. Season-gate dialog je vyrenderovaný na nejvyšší úrovni aplikace, aby jeho
`position: fixed` nebyl omezen předkem s `backdrop-filter`. Dynamické obrazové cesty v DC template se
vždy předávají přes `sc-camel-src`, nikdy jako doslovný `src` s `{{ }}`.

Od **v74** je v pravém panelu **The Garden Reflects — Living Lesson**, přímá a bezpečně omezená
integrace `openai/gpt-5.6-terra` přes Vercel AI Gateway. Klient posílá jen anonymní snapshot vztahů
v aktuální zahradě; jméno, volná reflexní poznámka ani celý save se neposílají. Sdílený engine
`lib/living-lesson.js` deterministicky vytváří důvěryhodné experimenty, počítá otisk stavu, validuje
odpověď a později z reálného herního stavu rozhodne, zda se experiment podařil. GPT‑5.6 smí pouze
vybrat jeden připravený experiment a formulovat poetické pozorování, věcný vztah a sokratovskou
otázku; nesmí měnit pravidla, ekonomiku ani cíl.

Serverová hranice je Vercel Function `api/garden-reflection.js`. V produkci používá automatický
`VERCEL_OIDC_TOKEN`, takže projekt nepotřebuje OpenAI API klíč. Cache, klientský limit 3 nových
požadavků denně, serverové limity, 320 výstupních tokenů a 12s timeout chrání placený Gateway
kredit. GPT‑5.6 Terra vyžaduje zakoupené AI Gateway kredity; samotná karta a bezplatný zůstatek jej
neodemknou. Auto top-up má zůstat vypnutý. Dokud kredit není k dispozici, 403 bezpečně používá
fallback bez modelového nákladu.
Chybějící autentizace, 402/429, timeout, výpadek i offline režim vracejí plnohodnotný
deterministický fallback označený **Garden wisdom offline**. Aktivní experiment a posledních osm
dokončených se bezpečně ukládají do existujícího save. Soutěžní architektura a judge path jsou v
`BUILD_WEEK.md`; testy v `scripts/test-living-lesson*.mjs` a `scripts/e2e-living-lesson.mjs`.

### 4.11 Zvuk
Od **v60** se nepoužívají procedurální oscilátory ani Web Audio tóny. Celý zvuk je postavený na
organických MP3 nahrávkách v `assets/audio/`:
- `story/`: 7 vypravěčských scén, 65s akustická hudební linka a smyčkovatelná zahradní atmosféra
- `game/`: měkké dřevo/list pro UI, semínko a půda při sázení, voda, kompost, stavba, sklizeň,
  sdílení, vznik guildy, odměna, čtyři roční období a samostatné přirozené zvuky živočichů
- `game-v2/`: vybrané a normalizované Picsart/Kling fyzické foley a ElevenLabs hero cues pro
  garden voice, guild a změnu sezóny
- `music/`: tři odlišné Lyria vrstvy — klidná zahrada, season gate a závěrečná reflexe; načítají se
  jen jako metadata a mezi režimy se prolínají
- `garden-voice/`: 13 finálních replik Voice 1 a strojově čitelný `manifest.json` s přesnými titulky
- hlasitost je normalizovaná (`-16 LUFS` voice, `-23` music, `-32` ambience, `-20` game SFX),
  hudba je pod hlasem a rychlé opakování efektů se throttluje
- pause/resume drží pozici hlasu, hudby i atmosféry; mute časovou osu nezastaví a po odmutování
  se vyprávění neopakuje od začátku
- při Garden Speaks cue se aktivní hudební vrstva automaticky ztiší a potom plynule vrátí

Zdrojové prompty a reprodukovatelná výroba jsou v `scripts/generate-audio.ps1`; finální
normalizace v `scripts/normalize-audio.ps1`. ElevenLabs API klíč patří pouze do lokálního `.env`,
je v `.gitignore` a nikdy se necommitne ani neposílá do Vercelu.

---

## 5. Asset pipeline (DŮLEŽITÉ pro Codex)

- **Všechny obrazové herní assety jsou `assets/*.webp`.** Nikdy nepřidávej zpět PNG. Zvuk je MP3
  pod `assets/audio/`.
- Filmové scény jsou optimalizované 1600×900 WebP v `assets/story/`; zdrojové PNG generace nejsou
  součástí produkčního projektu.
- Vznikly z malovaných sprite-sheetů (Codex je generuje) → nařezané skriptem v Claude
  (flood-fill / component-based odstranění krémového pozadí #F2EBD9, ořez na bounding box,
  export `canvas → webp q≈0.9`).
- **Pravidla pro nové sheety** (aby šly čistě nařezat): jednolité krémové pozadí #F2EBD9 bez
  textury, žádné rámečky/karty se zaoblenými rohy kolem objektů, žádné texty v buňkách, mezery
  mezi objekty min. 40 px, měkký stín těsně pod objektem, PNG ~1024×1536 nebo 1254×1254.
- Názvy: `obj-*` (prvky léto), `wobj-*` (zima), `bug-*` / `winter-*` / `hero-*` (zvířata),
  `tree-apple-*`, `gate2-*` (branka), `crop-*-1..3` (růstové fáze), `harvest-*`, `preserve-*`,
  `material-*`, `guild-*` / `wguild-*` (vignety), `mg-*` (minihry), `cel-*` (oslava),
  `pk2-*` (sezónní pickupy).

---

## 6. Deployment (JAK nasadit — přes GitHub → Vercel)

Uživatel nasazuje **GitHub → Vercel**. Pravidla (od 2026-07-09):

1. `node scripts/build.mjs` vygeneruje kořenový `index.html` ze zdroje.
2. `node scripts/check.mjs` ověří syntaxi herní logiky a lokální zdroje.
3. Do GitHubu se posílá celý kořen projektu: `index.html`, `game.fragment.html`, `assets/`,
   `vendor/`, zdroj i skripty.
4. Vercel nasazuje větev `main` automaticky: statickou hru a od v74 také serverovou Function
   `api/garden-reflection.js`; závislosti instaluje z `package-lock.json`.
5. **NEPŘIDÁVAT `vercel.json`** (výslovný pokyn — ruší starší pravidlo).

Verze se značí v patičce palety (`v62`, …) a bumpuje při každém významném vydání.

---

## 7. Otevřené úkoly / budoucí vize

**Hned:**
- **Výměna cvičné mapy za skutečnou z Menet** (Francie) — až uživatel dodá podklad. Vymění se
  jen podklad plácku, pozice prvků zůstanou.

**Volitelné doladění:** delší uživatelské testování ve skutečné Erasmus+ skupině a následné
vyhodnocení, kde hráči potřebují více didaktického vedení.

**Multiplayer fáze (dlouhodobá vize — hra ve skupině 10–25 lidí):**
- **sdílený Community sharing table** mezi hráči (kdo co daroval, se jménem dárce)
- **společný dashboard** — leaderboard, porovnání zahrad, chlubení výsledky
- **víc gamifikace** — testování nabytých znalostí (kvízy/challenges nad rámec season gates)

---

## 8. Co NErozbít při úpravách

- Needituj kořenový `index.html` ani `game.fragment.html` ručně — přegenerují se ze zdroje přes
  `scripts/build.mjs`.
- Nezaváděj PNG assety ani `vercel.json`.
- Zachovej inline styly pro hlavní herní UI. U filmového úvodu používej jen existující izolovaný
  namespace `pg-story-*`; nevytvářej neomezené globální selektory.
- Ekonomika je vyladěná (shares neklesnou do záporu při normální hře) — při změně cen/barteru
  otestovat delší průchod.
- Drag&drop řešen přes pointer eventy kvůli kompatibilitě napříč prohlížeči (Edge/macOS) —
  neměnit bez testu na více prohlížečích.
