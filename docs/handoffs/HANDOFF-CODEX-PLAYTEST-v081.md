# Permaculture Garden Playtest — Codex handoff (v0.81.0)

Datum: 29. 7. 2026

## Nejdůležitější bezpečnostní pravidlo

Soutěžní verze je uzamčená do vyhlášení OpenAI Build Week. Nic do ní necommitovat, nepushovat ani nenasazovat.

- Uzamčená lokální složka: `<local working folder>\Permaculture garden game`
- Uzamčený GitHub: `martinpazdernik-source/Permaculture-Garden-new`
- Uzamčený Vercel: `https://permaculture-garden-new.vercel.app/`
- Stejné pravidlo platí pro Devpost přihlášku.

Veškerá další práce patří výhradně sem:

- Aktivní složka: `<local working folder>\Permaculture Garden Playtest`
- GitHub: `https://github.com/martinpazdernik-source/Permaculture-Garden-Playtest`
- Vercel projekt: `permaculture-garden-playtest`
- Vercel project ID: `prj_ld9nsNA3gL6Y8Q1PK56QzqdxX2rT`
- Vercel org ID: `team_5uZGAlCil3yaNbffbzsBLB78`
- Stabilní testovací URL: `https://permaculture-garden-playtest.vercel.app/`

Před každým pushem nebo deployem je nutné znovu ověřit aktuální složku, `git remote -v` a `.vercel/project.json`.

## Jak je projekt postavený

Hra je záměrně lehká webová aplikace bez bundleru. Kanonickým zdrojem herního rozhraní a logiky je:

`Permaculture Garden v2.dc.html`

Po každé změně kanonického souboru spustit:

```powershell
npm run generate
npm run check
```

Generátor `scripts/build.mjs` z něj vytváří:

- `game.fragment.html` — vygenerovaný herní obsah,
- `index.html` — malý načítací shell.

Oba vygenerované soubory se commitují. Neupravovat je ručně.

Další důležité části:

- `lib/i18n.js` — lokalizační runtime a React překladová vrstva,
- `assets/i18n/` — jazykové katalogy, audio manifesty a glosář,
- `lib/living-lesson.js` — deterministický a bezpečně omezený Living Lesson engine,
- `api/garden-reflection.js` — Vercel endpoint pro GPT-5.6 Luna přes Vercel AI Gateway/OIDC,
- `scripts/` — build, kontroly, audio utility a browserové regresní testy,
- `assets/gates/` — čtyři sezónní brány s průhledným pozadím.

Lokální `.env.local` je ignorovaný a nikdy nesmí do GitHubu ani do ZIP zálohy.

## Co je nového od v0.79

### 1. Devět plných jazykových verzí

Podporované jazyky:

- English (`en`)
- Čeština (`cs`)
- Deutsch (`de`)
- Français (`fr`)
- Español (`es`)
- Português do Brasil (`pt-BR`)
- Polski (`pl`)
- Русский (`ru`)
- 简体中文 (`zh-CN`)

Katalogy jsou v `assets/i18n/catalog.<locale>.json`. Anglický katalog je zdrojový a momentálně obsahuje 1761 klíčů. Kontroly vyžadují, aby všechny ostatní katalogy měly stejnou strukturu a žádné chybějící hodnoty.

Jazyk se volí v rozhraní, zapisuje do URL a localStorage a při reloadu zachová uloženou zahradu. Living Lesson posílá na server jen normalizovaný kód jazyka a GPT odpovídá ve zvoleném jazyce. Nepodporované varianty se bezpečně normalizují na známý jazyk nebo angličtinu.

### 2. Český zvuk

Čeština má kompletní namluvenou vrstvu:

- 7 onboardingových kapitol v `assets/audio/story/cs/`,
- 42 hlasů zahrady v `assets/audio/garden-voice/cs/`,
- celkem 49 stop / přibližně 8,67 minuty,
- manifest `assets/i18n/audio.cs.json`.

Jedenáct hlasů sezónních výzev existuje také nově v angličtině v `assets/audio/garden-voice/challenge-*.mp3`.

Pro ostatní jazyky zůstává bezpečný anglický audio fallback. Výběr audia řeší `localizedVoiceSources()` v kanonickém HTML.

Kontrola:

```powershell
node scripts/check-audio-cs.mjs
```

### 3. Opravená brána a odstraněná dekorativní cesta

Původní brány měly neprůhledný čtvercový podklad. Nové bezeztrátové WebP výřezy s průhledností jsou:

- `assets/gates/gate-spring-transparent.webp`
- `assets/gates/gate-summer-transparent.webp`
- `assets/gates/gate-autumn-transparent.webp`
- `assets/gates/gate-winter-transparent.webp`

Platí pro všechna roční období. Dekorativní SVG cesta od brány ke stromu byla odstraněna, protože neměla žádnou herní funkci a působila jako technický overlay.

### 4. Vyvážená ekonomika a vesnický stánek

- Rain harvesting: €90 (dříve €120)
- Garden kitchen: €120 (dříve €200)
- Počáteční fond €300 nyní umožní postavit obě klíčové stavby.
- Každou hotovou zavařeninu lze v kuchyni buď darovat, nebo prodat ve vesnickém stánku za €25.
- Prodej zvyšuje `budget` a `stallSales`, ale správně se nepočítá jako dar, fair-share akt ani goodwill.
- `stallSales` se ukládá a obnovuje se savem.

Ekonomická logika prodeje je v metodě `sellPreserve(k)` v kanonickém HTML. Kuchyň zobrazuje zvlášť počet prodejů a vrácené prostředky.

### 5. Volitelná velikost zahrady na desktopu

V mapové liště je nový ovladač `Garden view` se třemi režimy:

- `Balanced` — původní třísloupcové rozložení,
- `Large` — užší boční panely a větší zahrada,
- `Focus` — zahrada přes celou hlavní šířku, boční panely skryté.

Volba se ukládá jako `gardenSize`. Ovladač zůstává dostupný i ve Focus režimu, takže se hráč nikdy nezamkne. Pod 1180 px je skrytý a hra používá stávající tabletové/mobilní navigační chování.

### 6. Klidnější Guided UX bez odebrání funkcí

Pravý panel v Guided Journey nyní začíná kartou `Only this matters now`:

1. Choose
2. Place
3. Notice

Podrobný model zahrady, skóre, vztahy a vysvětlení zůstávají dostupné tlačítkem `Show how the garden works`. Free Garden je rozbalí automaticky. Stav se ukládá jako `insightsExpanded`.

Nové provozní popisky mají minimálně 11 px i na desktopu 1280 × 720. Cílem je ubrat počáteční kognitivní zátěž bez zrušení jakékoli herní funkce.

### 7. Testovací infrastruktura

`scripts/run-local-e2e.mjs` spustí dočasný lokální server a předá jeho URL browserovému testu. Nový cílený test:

```powershell
npm run test:e2e:v81
```

Ověřuje:

- nepřítomnost staré cesty,
- čtyři průhledné WebP brány,
- klidný Guided výchozí stav i dostupnost detailu,
- nákup Rain harvester + Garden kitchen z jednoho počátečního fondu,
- prodej zavařeniny za €25 bez falešného daru,
- postupné zvětšení Balanced → Large → Focus,
- návrat z Focus režimu,
- žádný overflow a zachované mobilní chování,
- žádné chyby prohlížeče ani chybějící assety.

Starší testy byly zpřesněny tak, aby:

- počítaly unikátní preloadované obrázky místo síťových opakování,
- po dokončeném Living Lesson zavřely legitimní milníkovou zprávu,
- kontrolovaly všech 42 hlasových momentů a české/anglické challenge audio,
- před kontrolou skóre vědomě rozbalily nový klidný panel,
- při přímém vkládání testovacího stavu vyčistily čekající transientní dialogy.

## Doporučený ověřovací postup

Základ:

```powershell
npm test
npm run test:e2e:v81
```

Nejdůležitější regresní sady:

```powershell
npm run test:e2e:responsive
npm run test:e2e:touch
npm run test:e2e:mobile-book
npm run test:e2e:kitchen
npm run test:e2e:playthrough
npm run test:e2e:resident-state
npm run test:e2e:pest-balance
npm run test:e2e:living-lesson
npm run test:e2e:i18n
npm run test:e2e:i18n-layout
```

Hloubkový audit jedné lokalizace:

```powershell
node scripts/e2e-i18n-surface-audit.mjs --locale cs
```

Povolené hodnoty `--locale`: `cs`, `de`, `fr`, `es`, `pt-BR`, `pl`, `ru`, `zh-CN`.

Další release testy:

```powershell
node scripts/run-local-e2e.mjs scripts/e2e-release-audit.mjs
node scripts/run-local-e2e.mjs scripts/e2e-layout-audit.mjs
node scripts/run-local-e2e.mjs scripts/e2e-accessibility.mjs
node scripts/run-local-e2e.mjs scripts/e2e-resilience.mjs
node scripts/run-local-e2e.mjs scripts/e2e-edge-regression.mjs
node scripts/run-local-e2e.mjs scripts/e2e-v70-economy.mjs
node scripts/run-local-e2e.mjs scripts/e2e-v70-visual-quality.mjs
```

## Stav posledního auditu

Před vydáním v0.81.0 prošlo:

- build, syntax a 230 lokálních asset referencí,
- 9/9 kompletních katalogů,
- 9 jazyků × 3 viewporty × 9 hlavních obrazovek,
- 232 scénářů pro každý neanglický jazyk bez nepřeložených hodnot, layout flagů nebo browser chyb,
- desktop 1180–1920 px,
- tablety 768–1179 px,
- telefony včetně 320 × 568 a 844 × 390,
- dotykové umisťování a přesun prvků,
- všech 11 miniher,
- kuchyň, seed bank, dlouhý klikací průchod,
- resident stories, pest balance, Living Lesson,
- ekonomika, odolnost, klávesnice, reduced motion a forced colors,
- české audio: 49/49 platných MP3.

## Co zůstává vědomě otevřené

- Německá, francouzská, španělská, portugalská, polská, ruská a čínská verze zatím používají anglický hlas. Text je plně lokalizovaný.
- `assets/i18n/LOCALIZATION_GLOSSARY.md` je zdroj terminologických rozhodnutí; při budoucích úpravách překladů ho zachovat.
- Výkon byl dříve vědomě odložen, dokud bude hra obsahově stabilnější. Před širším veřejným vydáním udělat samostatný síťový a media-budget audit.
- Soutěžní verzi nesynchronizovat automaticky. Po vyhlášení bude případné sloučení samostatné, výslovně schválené rozhodnutí.

## Záloha a obnovení

Autoritativní záloha je Playtest GitHub. Navíc je po vydání vytvářen Git archive ZIP v:

`<local working folder>\Permaculture Garden Backups`

ZIP z `git archive` neobsahuje `.env.local`, `node_modules`, `.vercel` ani jiné necommitované tajné/systémové soubory.

Pro obnovení stačí naklonovat Playtest GitHub, případně rozbalit poslední ZIP, spustit `npm install`, `npm run generate` a `npm test`.
