# Permaculture Garden - Le Jardin

Staticka edukacni hra pro Vercel / GitHub Pages / Netlify.

## Dulezite pro Vercel

Do GitHub repozitare nahraj **obsah teto slozky primo do korene repozitare**:

- `index.html`
- `assets/`
- `README.md`
- `vercel.json`

Slozka `assets/` je povinna. Pokud se nahraje jen `index.html`, hra se sice spusti, ale vsechny herni obrazky budou rozbite a dole se objevi opakovane `[bundle] error`.

## Vercel nastaveni

Pri importu projektu na Vercelu:

- Framework Preset: `Other`
- Build Command: prazdne
- Output Directory: prazdne nebo `.`
- Install Command: prazdne

Pokud mas v repozitari jeste nadrazenou slozku, nastav ve Vercelu `Root Directory` na slozku, ktera obsahuje `index.html` a `assets/`.

## Lokalni test

V teto slozce spust:

```bash
python -m http.server 8787 --bind 127.0.0.1
```

Pak otevri:

```text
http://localhost:8787/
```
