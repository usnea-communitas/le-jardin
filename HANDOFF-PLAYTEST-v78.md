# Permaculture Garden — playtest v78

## Kde je nová verze

- GitHub: <https://github.com/martinpazdernik-source/Permaculture-Garden-Playtest>
- Vercel: <https://permaculture-garden-playtest.vercel.app/>
- Vercel project: `permaculture-garden-playtest`
- Hlavní větev: `main`
- Lokální izolovaná kopie:
  `C:\Users\marti\AppData\Local\Temp\Permaculture-Garden-Ready-2026-07-27`

Tato větev je výhradně pro další vývoj a testování. Není propojena s původním
soutěžním repozitářem ani původním Vercel projektem.

## Co přibylo ve v78

- sjednocená sada jemných linkových SVG ikon pro systémové ovládací prvky;
- nové akvarelové obrázky brambor, kořenové zeleniny, listové zeleniny, zelí,
  bylinek a jablek vytvořené přes Picsart / Seedream 5 Pro;
- nová skutečně zimní vstupní brána se sněhem a proutěným obloukem;
- vyváženější a bohatší stránky Garden Book;
- stabilní jednořádkový název mapy i v užších desktopových rozvrženích;
- klidnější neprůhledné navigační a dialogové plochy bez nadbytečného rozmazání;
- odstranění dvojitého focus rámečku ve Windows/Chrome při DPR 2;
- zachovaná Bricolage Grotesque jako výrazové písmo, Georgia pro literární nadpisy
  a Hanken Grotesk pro běžné texty.

## Zdroj a build

Jediným zdrojem hry zůstává `Permaculture Garden v2.dc.html`.

Po každé změně:

```powershell
npm run generate
npm test
```

`index.html` a `game.fragment.html` jsou generované soubory a nesmějí se ručně
odchýlit od hlavního zdroje.

## Ověření této verze

- statická kontrola buildu, JavaScriptu a 207 lokálních zdrojů;
- unit testy deterministického Living Lesson enginu a API hranice;
- 17 end-to-end sad bez chyb;
- responzivní pokrytí telefonu, tabletu i desktopu;
- samostatná kontrola přístupnosti včetně DPR 2 focus stavu;
- vizuální kontrola úvodu, hlavní plochy, Seed Bank, Garden Book a zimní scény;
- produkční smoke test po nasazení.

## Zmrazená soutěžní verze

Původní soutěžní projekt je stále zmrazený:

- GitHub: `martinpazdernik-source/Permaculture-Garden-new`
- commit: `ba4381b8cebf7fb952654cd47d7936a705f3a1cf`
- Vercel: <https://permaculture-garden-new.vercel.app/>
- Devpost: bez změn do vyhlášení

Na tyto tři cíle se během dalšího vývoje nesmí pushovat ani deployovat.

