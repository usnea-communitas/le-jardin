# Permaculture Garden — Le Jardin

Statická edukativní hra o permakulturní zahradě, sezónnosti a ekonomice sdílení.

## Zdroj a build

Hlavní editovatelný zdroj je `Permaculture Garden v2.dc.html`. Produkční `index.html` ani
`game.fragment.html` se neupravují ručně:

```powershell
node scripts/build.mjs
node scripts/check.mjs
```

Build vytvoří malou okamžitou načítací stránku `index.html` a herní obsah
`game.fragment.html`. React/DC runtime je lokálně v `vendor/`, fonty v `assets/fonts/` a herní
obrázky v `assets/*.webp`. Organické vyprávění, hudba a herní efekty jsou v `assets/audio/`.

Volitelná regenerace zvuku používá lokální, Git-em ignorovaný `ELEVENLABS_API_KEY` v `.env`:

```powershell
.\scripts\generate-audio.ps1
.\scripts\normalize-audio.ps1
# Jen nové repliky zahrady:
.\scripts\normalize-audio.ps1 -GardenVoiceOnly
```

Klíč se nikdy necommitne ani nenasazuje do Vercelu; hra při běhu používá jen hotové MP3 soubory.
Třináct finálních replik Voice 1 je v `assets/audio/garden-voice/`; jejich přesné titulky a mapování
udržuje `manifest.json`.

## Living Lesson · GPT‑5.6

Od v74 obsahuje pravý panel funkci **The Garden Reflects — Living Lesson**. Po alespoň dvou
smysluplných herních aktech pošle Vercel Function `api/garden-reflection.js` do modelu
`openai/gpt-5.6-terra` pouze omezený anonymní snímek zahrady: sezónu, typy umístěných prvků,
čtyři systémové hodnoty a jejich vysvětlení, vzniklé vazby, postup, guildy a počty sdílení,
sklizní a výzev. Neposílá jméno hráče, poznámku z reflexe ani obsah `localStorage`.

Model formuluje hlas zahrady, stručné vysvětlení vztahu a sokratovskou otázku. Nemůže měnit
ekonomiku, skóre, herní pravidla ani definovat vlastní úkol: server vždy znovu vytvoří 2–4
důvěryhodné experimenty pomocí sdíleného deterministického enginu `lib/living-lesson.js` a
výstup GPT‑5.6 smí pouze jeden z nich vybrat. Dokončení experimentu vyhodnocuje stejný engine
z reálné změny herního stavu.

Autentizace v produkci používá automatický `VERCEL_OIDC_TOKEN`; OpenAI API klíč se nevytváří,
neukládá do prohlížeče ani neposílá do repozitáře. Při chybě AI Gateway, vyčerpání kreditu,
limitu, timeoutu nebo offline režimu vrátí hra plnohodnotnou předem zkontrolovanou reflexi.
Ochranu nákladů tvoří lokální cache podle otisku stavu, nejvýše 3 nové požadavky denně z jednoho
prohlížeče, serverové limity, 12s timeout a maximálně 320 výstupních tokenů. Vercel AI Gateway má
navíc zůstat bez automatického dobíjení. Pro model GPT‑5.6 Terra je vedle platební karty nutné
zakoupit placené Gateway kredity; samotný bezplatný zůstatek tento model neodemkne. Dokud placený
kredit není k dispozici, endpoint správně přejde do offline větve a nic neúčtuje. Aktuální katalogová
cena Terra je $2.50 za milion vstupních a $15 za milion výstupních tokenů; limity aplikace proto drží
jeden nový uncached požadavek v řádu zlomků centu až nízkých jednotek centů podle délky vstupu.

Lokální statický server nemá Vercel Function ani OIDC, takže UI přejde automaticky do offline
větve. Samotnou funkci a engine lze ověřit bez klíče:

```powershell
npm install
npm test

# Volitelný browser průchod, když na portu 8787 běží lokální server:
$env:CODEX_NODE_MODULES="C:\cesta\k\bundled\node_modules"
npm run test:e2e:living-lesson

# Skutečný produkční endpoint a UI (před odemčením kreditu očekává fallback, potom ai):
$env:GAME_URL="https://permaculture-garden-new.vercel.app/"
$env:LIVING_LESSON_LIVE_API="1"
$env:EXPECTED_LESSON_MODE="fallback" # po přidání karty změnit na "ai"
node scripts/e2e-living-lesson.mjs
```

## Lokální test

```powershell
python -m http.server 8787 --bind 127.0.0.1
```

Potom otevři `http://127.0.0.1:8787/`.

## Nasazení

GitHub repozitář je propojený s Vercel projektem. Produkce se nasadí automaticky po sloučení do
větve `main`. Framework preset je `Other`, bez vlastního Build Commandu; nasazuje se commitnutý
kořenový `index.html` a `game.fragment.html` spolu s `assets/`, `vendor/`, `favicon.ico` a Vercel
Function v `api/`. Vercel při nasazení nainstaluje závislosti z `package-lock.json`. Do projektu
nepřidávat `vercel.json`.
