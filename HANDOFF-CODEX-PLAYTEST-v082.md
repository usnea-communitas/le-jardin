# Permaculture Garden Playtest — Codex handoff (v0.82.0)

Datum: 29. 7. 2026

Tento dokument je doplněk k `HANDOFF-CODEX-PLAYTEST-v081.md`. Starší handoff stále obsahuje úplnou architekturu, lokalizace, české audio, kuchyň, Seed Bank, testovací příkazy a provozní kontext.

## Nejdůležitější bezpečnostní pravidlo

Soutěžní verze je uzamčená do vyhlášení OpenAI Build Week. Nic do ní necommitovat, nepushovat ani nenasazovat.

- Uzamčená lokální složka: `C:\Users\marti\OneDrive\Dokumenty\Permaculture garden game`
- Uzamčený GitHub: `martinpazdernik-source/Permaculture-Garden-new`
- Uzamčený Vercel: `https://permaculture-garden-new.vercel.app/`
- Stejné pravidlo platí pro Devpost přihlášku.

Veškerá práce v tomto vydání proběhla pouze zde:

- Aktivní složka: `C:\Users\marti\OneDrive\Dokumenty\Permaculture Garden Playtest`
- GitHub: `https://github.com/martinpazdernik-source/Permaculture-Garden-Playtest`
- Vercel projekt: `permaculture-garden-playtest`
- Stabilní testovací URL: `https://permaculture-garden-playtest.vercel.app/`

V0.82.0 je v okamžiku vytvoření tohoto handoffu dokončená a otestovaná lokálně. Nebyla v rámci tohoto úkolu pushnuta ani nasazena.

## Co se změnilo ve v0.82.0

### 1. Čerstvé třešně už neblokují Garden kitchen

Před kuchyní lze každý sklizený košík čerstvých třešní prodat na vesnickém stánku v Menet za €15.

- Tři letní sklizně mohou přinést celkem €45.
- Hráč s €75 se tak dostane na €120 potřebných pro Garden kitchen.
- Prodej odečte jednu položku `cherries` z košíku a zvýší `budget`.
- Samostatná statistika `freshSales` se ukládá a obnovuje se savem.
- Prodej záměrně nezvyšuje `given`, `sharedActs`, `goodwill`, `pool` ani `stallSales`.
- `stallSales` zůstává vyhrazené pro prodej hotových zavařenin za €25.
- Darování třešní dál posouvá fair-share část hry, prodej nikoli.

Hlavní metoda je `sellFreshProduce(k)` v `Permaculture Garden v2.dc.html`. Košík vysvětluje rozdíl mezi čerstvým prodejem, darováním a pozdějším zavařením.

### 2. Sklizitelné třešně jsou jasně viditelné

Každý zralý shluk má:

- zlatou radiální auru,
- jemný pomalý puls,
- vyšší sytost,
- hit area přibližně 50 × 50 px,
- viditelný keyboard focus.

Aura se zobrazuje jen u skutečně sklizitelných třešní. Při `prefers-reduced-motion` zůstane statická.

Relevantní selektor: `.pg-cherry-cluster`.

### 3. Plynulé nastavení šířky i výšky zahrady

Desktopový ovladač `Garden view` nyní nabízí:

- tři rychlé předvolby `Balanced`, `Large` a `Focus`,
- samostatný slider `Width` 0–100 %,
- samostatný slider `Height` 0–100 %.

Pohyb slideru přepne stav na `gardenSize: "custom"`. Hodnoty se ukládají jako:

- `gardenWidth`,
- `gardenHeight`.

Šířka plynule zužuje levý a pravý panel a zvětšuje středovou zahradu. Výška zmenšuje mezery, hlavičku mapy a maximální výšku podpůrných panelů. Community sharing table a Harvest basket zůstávají dostupné a při potřebě se uvnitř posouvají.

`Focus` je skutečný plot-only režim:

- skryje oba boční panely,
- skryje Community sharing table i Harvest basket,
- dá zahradě celou pracovní šířku i výšku,
- ovladač `Garden view` zůstává viditelný, takže se hráč nikdy nezamkne.

Pod 1180 px se ovladač dál skrývá. Telefonní a tabletové rozložení zůstalo oddělené a nezměněné.

### 4. Devět jazykových verzí

Do všech katalogů přibylo jedenáct nových klíčů pro:

- šířku a výšku zahrady,
- přístupné popisky sliderů,
- vysvětlení adaptivních panelů,
- čerstvý prodej třešní a jeho vztah k fair share.

Anglický zdrojový katalog nyní obsahuje 1772 klíčů. Všechny katalogy mají shodnou strukturu:

`en`, `cs`, `de`, `fr`, `es`, `pt-BR`, `pl`, `ru`, `zh-CN`.

Čeština byla napsaná jako prioritní přirozená verze; ostatní nové texty jsou plně lokalizované.

## Důležité soubory

- `Permaculture Garden v2.dc.html` — kanonický zdroj logiky, šablony a CSS.
- `game.fragment.html` — vygenerovaný výstup; neupravovat ručně.
- `assets/i18n/catalog.*.json` — devět lokalizačních katalogů.
- `scripts/e2e-v82-economy-resize.mjs` — cílený test ekonomiky, aury, sliderů, persistence, Focus režimu a telefonu.
- `package.json` — verze 0.82.0 a příkaz `npm run test:e2e:v82`.
- `test-results/v82-final-gut-check.png` — lokální finální vizuální kontrola.
- `test-results/v82-size-panel-gut-check.png` — lokální kontrola otevřeného ovladače velikosti.

Po změně kanonického souboru vždy:

```powershell
npm run generate
npm run check
```

## Ověření provedené pro v0.82.0

Nový cílený test:

```powershell
npm run test:e2e:v82
```

Ověřuje:

- prodej čerstvých třešní bez kuchyně,
- cestu €75 + 3 × €15 → €120,
- oddělení prodeje od fair-share ukazatelů,
- uložení `freshSales` i rozpočtu,
- dostupnost nákupu kuchyně,
- tři viditelné zlaté aury a 50px hit area,
- samostatné horizontální zvětšení,
- materiální vertikální zvětšení,
- scrollovatelnost okolních panelů,
- uložení a obnovení custom hodnot,
- skutečný full-workspace Focus,
- návrat z Focus režimu,
- zachované telefonní rozložení,
- žádné browser chyby a žádné chybějící assety.

Dále prošlo:

```powershell
npm test
npm run test:e2e:v81
npm run test:e2e:kitchen
npm run test:e2e:responsive
npm run test:e2e:touch
npm run test:e2e:playthrough
```

Rozsah poslední regresní kontroly:

- desktop 1180 × 800 až 1920 × 1080,
- tablety 768 × 1024 až 1179 × 900,
- telefony 320 × 568 až 430 × 932 a 844 × 390,
- dotykové umisťování a přesun prvků,
- kuchyň a všechny čtyři metody uchování,
- Seed Bank,
- dlouhý klikací průchod na desktopu, tabletu i telefonu,
- 9/9 katalogů a 230 lokálních asset referencí,
- 243 kombinací jazykového layoutu (9 jazyků × 3 viewporty × 9 hlavních povrchů) bez jediného nálezu,
- žádný globální horizontální overflow,
- žádné runtime nebo konzolové chyby.

## Stav před případným vydáním

Pracovní změny jsou lokální v Playtest repozitáři na větvi `codex/playtest-v081`. Před případným commitem/pushem/deployem:

1. Ověřit, že aktuální složka je přesně `Permaculture Garden Playtest`.
2. Ověřit, že `origin` míří na `Permaculture-Garden-Playtest`.
3. Znovu spustit `npm run check` a `npm run test:e2e:v82`.
4. Nikdy nepoužít soutěžní remote ani soutěžní Vercel projekt.

Bez výslovného požadavku uživatele v0.82.0 nenasazovat.
