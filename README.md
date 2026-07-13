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
obrázky v `assets/*.webp`.

## Lokální test

```powershell
python -m http.server 8787 --bind 127.0.0.1
```

Potom otevři `http://127.0.0.1:8787/`.

## Nasazení

GitHub repozitář je propojený s Vercel projektem. Produkce se nasadí automaticky po sloučení do
větve `main`. Framework preset je `Other`, bez vlastního Build Commandu; nasazuje se commitnutý
kořenový `index.html` a `game.fragment.html` spolu s `assets/`, `vendor/` a `favicon.ico`. Do
projektu nepřidávat `vercel.json`.
