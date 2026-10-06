# Product

<!-- impeccable:product-schema 1 -->

> Návrh připravený z toho, co Martin o projektu řekl, a z `README.md` a `CONTEXT_FOR_CODEX.md`. Zkontroluj a oprav, co nesedí.

## Platform

web

## Users

- Hráči, kteří hrají samostatně, a skupiny na workshopech.
- Výchozí komunita: účastníci Erasmus+ projektu permakulturní zahrady v Menet (Francie), menší mezinárodní skupiny kolem 10–25 lidí, které zahradu budují i fyzicky.
- Do budoucna: školy, programy pro mládež, environmentální a další komunitní organizace.

## Product Purpose

Příběhová vzdělávací hra v prohlížeči o permakulturní zahradě v Menet. Hráč staví živou zahradu ze vztahů mezi prvky, prochází roční obdobími a učí se, proč je komunitní sdílení jedním z pilířů permakultury.

## Positioning

AI reflexe („Living Lesson“) je součástí učebního cyklu, ne chatbot vedle hry: model jen pojmenuje vztahy a položí otázku. O pravidlech, bodech a výsledku experimentu rozhoduje vždy deterministický engine.

## Operating Context

- Referenční zážitek je počítač; telefony a tablety jsou navržené a testované na výšku i na šířku.
- Zdarma, bez účtu, ukládání v prohlížeči.
- Jazyky: en, cs, de, fr, es, pt-BR, pl, ru, zh-CN (`lib/i18n.js`).

## Capabilities and Constraints

- Šestiaktový učební postup, deterministické bodování; AI reflexe nemění pravidla hry.
- Ekonomika daru: komunitní dary se nikdy nemění v osobní měnu.
- Výzvy bez časomíry a bez trestajícího selhání.
- Hlavní zdroj je `Permaculture Garden v2.dc.html`; `index.html` se generuje (`npm run generate`), needitovat ho ručně.
- Soutěžní repozitář, nasazení a Devpost z OpenAI Build Week jsou zmrazené a nesmí být cílem žádné změny.
- Hra pro více hráčů (vlastní zahrada každého a společný Community Table) je plánovaná, návrh i implementace jsou odložené.
- Soukromí: modelu jde jen anonymní souhrn zahrady, nikdy jméno hráče, volný text ani uložená hra. Bez dostupného modelu hra nabídne offline lekci.

## Brand Commitments

- Název „Permaculture Garden — Le Jardin“; vypravěčem je Zahrada v Menet.
- Projekt není spojený s programem Erasmus+ ani jím schválený a nesmí tak působit.
- Původ assetů: `ASSET_PROVENANCE.md`, licence třetích stran: `THIRD_PARTY_NOTICES.md`.

## Evidence on Hand

- Playtest a regresní testy (`npm test`, `test:e2e:*`), předávací záznamy `HANDOFF-*.md`.
- V OpenAI Build Week se hra neumístila; netvrdit žádné ocenění.
- Žádné citace hráčů ani statistiky neexistují; nevymýšlet je.

## Product Principles

1. Učit vztahy, ne optimalizaci jednotlivých objektů.
2. Sdílení před měnou.
3. AI vysvětluje a ptá se, nikdy nerozhoduje.
4. Laskavé učení: chyba je pokus, ne prohra.
