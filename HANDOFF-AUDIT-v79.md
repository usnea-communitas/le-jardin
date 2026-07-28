# Permaculture Garden — úplný audit handoffu, playtest v79

Datum kontroly: 28. 7. 2026

## Výsledek

Claude handoff `HANDOFF-CODEX-permakultura.md` i všechny tři odkazované review
podklady byly znovu porovnány s kanonickým zdrojem, skutečnými assety a
automatizovanými průchody hry.

Pět položek označených v hlavním handoffu jako „Co zbývá“ je ve v79 uzavřených:

| Položka z handoffu | Stav ve v79 | Důkaz |
| --- | --- | --- |
| Akvarelové miniatury plodin | Hotovo | Šest 300×300 WebP miniatur z Picsart / Seedream je zapojených v Seed Bank; zásuvky a všechny jejich stránky prošly browser auditem. |
| Skutečně zimní vstupní brána | Hotovo | Samostatná zasněžená zimní ilustrace 564×528 je zapojená místo barevně posunutého podzimu. |
| SVG systém místo nosných emoji | Hotovo | Roční období, seed, idea, share, euro, recycle a gift používají sjednocené jemné SVG ikony. Emoji zůstávají pouze jako dekorace nebo náladové značky. |
| P3: Kniha, titulek plochy a blur | Hotovo | Kapitolová stránka Knihy je vyvážená bez bílé webové karty, název mapy se neláme a produkční papírové modály nemají nadbytečné rozmazání. |
| Bricolage Grotesque | Uzavřené vědomé rozhodnutí | Bricolage zůstává jen jako výrazové písmo. Georgia nese literární nadpisy a Hanken Grotesk běžné texty a ovládání. Tato kombinace zachovává schválený charakter onboardingu bez zhoršení čitelnosti. |

Neuzavřený dvojitý focus rámeček se při DPR 2 podařilo reprodukovat jako testovací
podmínku a uzavřít: dialog nemá cizí UA outline, ale klávesnicový focus zůstává
jednoznačně viditelný.

## Co audit navíc skutečně našel a opravil

Hlavní vizuální body byly hotové, ale ve starších odkazovaných review zůstalo několik
mechanik a textů, které ještě neodpovídaly jejich vlastnímu závěru:

- **Návrat škůdců.** Vyřešený tlak už není navždy vymazaný. Pokud podpůrný vztah
  později zmizí, známý tlak se může po klidovém období na jednu sezónu vrátit. Nezastaví
  růst a nespustí znovu celý trestný příběh; učí, že rovnováha není trvalá absence.
- **Zimní plodiny.** Mulč už automaticky nezachrání každou mladou plodinu. V modelu
  pod ním čekají kořenová zelenina a zelí, skleník může držet listovou zeleninu a
  mladé brambory či byliny zůstávají bez další ochrany ohrožené. Stejnou pravdu nyní
  ukazuje i náhled před otočením sezóny.
- **Jabloň.** Herní minimum zrání se změnilo ze čtyř na osm sezónních tahů. Podzimní
  sklizeň vyžaduje druhou zavedenou jabloň poblíž, která ve hře zastupuje kompatibilní
  odrůdu, a blízký květní pás nebo bylinkovou spirálu. Mladý či izolovaný strom
  automaticky neplodí.
- **„Guild“ versus design connection.** Všechny hráčské názvy, nápovědy, výzva,
  shrnutí, certifikát a čtečkové popisky označují dvojici jako **design connection**.
  Kniha zároveň vysvětluje, že úplná rostlinná guilda spojuje více druhů a funkcí.
  Interní názvy proměnných zůstaly beze změny kvůli bezpečné migraci uložených her.
- **Neznámé pojmy před nákupem.** Hügel bed, mulch, rain harvesting, arch,
  herb spiral, flower strip a seed bank mají stručné vysvětlení přímo na kartě prvku,
  v tooltipu i přístupném názvu.
- **Opatrnější ekologická tvrzení.** Arch, greenhouse, herb spiral, potato a woody-bed
  challenge už neslibují výnos, ochranu před mrazem ani velkou vodní nádrž jako
  jistotu. Bird bath připomíná výměnu vody a čištění, kompost kontrolu ježků,
  bobovité vztah s hlízkovými bakteriemi a brambory plíseň.
- **Bezpečnost skladovaných brambor.** Kniha rozlišuje podmínky pro brambory a
  kořenovou zeleninu a výslovně upozorňuje na zelené, naklíčené či hořké části a
  glykoalkaloidy.
- **Pohyblivé scény.** Čtyři kuchyňské a čtyři sezónní smyčky dostaly WebM variantu.
  Kuchyň si ponechává i MP4 fallback a při selhání média přechází na statický poster
  změnou React stavu, ne nebezpečnou ruční manipulací s DOM.
- **Přístupnost drobných prvků.** Zavírání hlasu zahrady má na telefonu a tabletu
  44×44 px. Skupina vztahových ukazatelů má platnou ARIA semantiku.
- **Testovací izolace.** Testy, které mají ověřovat čistou herní plochu, nyní výslovně
  označí úvodní unlock karty jako přečtené, takže asynchronní nápověda nemůže
  překrýt testovaný dotyk nebo klávesový focus.

## Ekologická kalibrace

Změny byly zkontrolované proti autoritativním zdrojům, zejména:

- RHS: [Growing apples](https://www.rhs.org.uk/fruit/apples/grow-your-own)
- University of Minnesota Extension:
  [Growing apples in the home garden](https://extension.umn.edu/fruit/growing-apples)
- RHS: [Vegetables for winter](https://www.rhs.org.uk/vegetables/growing-for-winter)
- EFSA:
  [Glycoalkaloids in potatoes — public health risks assessed](https://www.efsa.europa.eu/en/news/glycoalkaloids-potatoes-public-health-risks-assessed)
- UK Food Standards Agency:
  [Home food fact checker](https://www.food.gov.uk/print/pdf/node/4286)
- RHS:
  [Hedgehog-friendly gardening](https://www.rhs.org.uk/wildlife/hedgehog-friendly-gardening)
  a [Garden birds](https://www.rhs.org.uk/wildlife/garden-birds)

Hra zůstává zjednodušeným vzdělávacím modelem, ne pěstitelskou nebo
potravinově-bezpečnostní příručkou. Všechny relevantní texty tuto hranici zachovávají.

## Ověření v79

- kanonický zdroj se přesně generuje do `game.fragment.html`;
- JavaScript syntaxe a 207 lokálních zdrojových odkazů prošly;
- unit a API boundary testy Living Lesson prošly;
- všech 17 end-to-end sad prošlo;
- mobilní Kniha prošla každou stránku všech šesti kapitol;
- všech 11 sezónních výzev prošlo ve čtyřech responzivních viewpointech;
- responzivní audit pokrývá 13 velikostí od 320×568 do 1920×1080;
- dotykové umístění a přesun prošly na telefonu i tabletu;
- DPR 2 focus, reduced motion, forced colors a klávesnicový průchod prošly;
- samostatný agent-browser průchod ověřil story cover, onboarding a skutečný začátek
  Guided Journey; axe-core našel 0 automaticky potvrzených WCAG A/AA porušení;
- produkčnímu scénáři odpovídající lokální smoke test prošel bez runtime, console
  nebo same-origin HTTP chyb.

## Co se záměrně nedělalo

- **Vícejazyčné verze nejsou implementované.** Budou samostatný další krok spuštěný
  až po společném rozhodnutí.
- Nebyl měněn básnický hlas zahrady, oceňované Balance texty, houbová varování ani
  kázeň kolem dešťové vody.
- Nebyl přidán univerzální „wild corner“ jako falešná náhrada hostitelských rostlin.
  Text nyní konkrétně rozlišuje dospělé cabbage white butterflies na květech od
  druhově specifických larválních hostitelů; obecný kout nemůže sloužit každému druhu.
- Výkon velkých médií zůstává samostatnou budoucí optimalizační etapou, jak bylo
  dříve domluveno.

## Bezpečná větev vývoje

Tento audit patří pouze oddělené playtest větvi:

- GitHub: <https://github.com/martinpazdernik-source/Permaculture-Garden-Playtest>
- Vercel: <https://permaculture-garden-playtest.vercel.app/>
- pracovní kopie:
  `C:\Users\marti\OneDrive\Dokumenty\Permaculture Garden Playtest`

Původní soutěžní verze zůstává zmrazená:

- GitHub `martinpazdernik-source/Permaculture-Garden-new`
- commit `ba4381b8cebf7fb952654cd47d7936a705f3a1cf`
- Vercel <https://permaculture-garden-new.vercel.app/>
- Devpost beze změny

Na původní repozitář, Vercel ani Devpost se během tohoto auditu nesahalo.
