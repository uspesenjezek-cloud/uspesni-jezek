# OpenCode Project Context

## Projekt: Uspešni Jezek

Platforma za obrtnike (craftsmen/tradesmen) v Sloveniji in Nemčiji. Gre za partnerstvo z obrtniki — reševanje realnih problemov (neplačila, ugled, rast, delavci, skupnost). Trenutno v razvoju: **Kategorija 1 — Neplačila**.

## Tehnična nastavitev

- **Stack:** Čist HTML/CSS/JS (brez frameworkov), Vercel hosting + /api funkcije, Supabase (podatki)
- **Repo:** `github.com/uspesenjezek-cloud/uspesni-jezek`
- **Lokalna pot:** `C:\Users\jkjob\Desktop\uspesen jezik git` (Windows, Git Bash / PowerShell)
- **Lokalni zagon:** `powershell.exe -ExecutionPolicy Bypass -File ".\serve.ps1" -Port 8000`
- **Ngrok (za testiranje HTTPS/telefon):** `./ngrok.exe http --domain=spoiled-vengeful-cofounder.ngrok-free.dev 8000`
- **Stran v živo:** `https://spoiled-vengeful-cofounder.ngrok-free.dev/app/prijava.html`

## Struktura

- `/app` = portal za obrtnike (PWA, working tool)
- `index.html` = marketing za stranke
- Aplikacija je prvenstveno za telefon — UI v slovenščini, mint/teal barvna shema
- 3 koraki v flowu neplačil:
  1. `neplacila.html` — vnos dolžnika
  2. `neplacila-sporocilo.html` — vnos sporočila
  3. `neplacila-posiljanje.html` — načrt opominjanja

## Konvencije

- UI v slovenščini, nemški prevod pride kasneje
- Mint/teal barvna shema: `--teal: #51999a`, `--teal-dark: #10797d`, `#15959B`, `#168E94`
- `font-family: Inter, sans-serif`
- BEM poimenovanje za nove komponente
- Majhni, lokalizirani popravki — brez masivnih refaktorjev
- Po vsaki spremembi: commit s funkcionalnim sporočilom
- `feature/korak3-cas-sheet-in-predloge` branch

## Ključne komponente (trenutno stanje)

### Komponente CSS
- `.ocena-tveganja` — F4F8F9 ozadje, 16px radius, ščit ikona
- `.ocena-tveganja__polje` — grid 34px ikona | 1fr vsebina | auto gear
- `.ocena-tveganja__polje-vrednost` — 14px bold, border-bottom #BEE1DE
- `.ocena-tveganja__polje-kategorija` — 15px, margin-top: auto, #168E94
- `.ocena-tveganja__izbira` — 38px pill, 13px, scrollable, pikice indicator
- `.ton-widget` — overflow: visible, border 1.5px teal, 24px radius
- `.opomin-potrdi-predloge__kartica` — 82% širina, ikona 42px krog, scroll-snap
- `.predloge3-modal` — max 400px, max 96vh, textarea 280px min
- `.priporocilo-widget` — widget za ton na koraku 2/3

### JS moduli
- `app.js` — glavna logika, validacija, predloge, navigacija
- `ocena-tveganja.js` — kategorizacija dolga/zamude, pragovi, validacija, blur handlerji
- `ton-priporocilo.js` — 6 tonov: super_friendly|friendly|firm|strict|super_strict|super_evil
- `ton-widget.js` — carousel za izbiro tona
- `ton-predloge.js` — predloge sporočil po tonih (TONE_IDS 6 tonov)
- `ton-dodatki-priporocila.js` — normalizirajTon za 6 tonov
- `opomin-nacrt.js` — podatkovna plast načrta (ODMKI_BAZA za 6 tonov, schemaVersion 2)
- `opomin-nacrt-ui.js` — UI načrta, predloge carousel, urejanje kartic
- `priporocilo-widget.js` — skupen widget za korak 2 in 3
- `predlogi-urejevalnik.js` — urejevalnik predlog
- `rok-placila-sheet.js`, `obrocno-sheet.js`, `trr-sheet.js` — spodnji meniji

### Validacije
- Ocena tveganja: brez privzete izbire zgodovine, modal opozorilo če neizpolnjeno
- Blur validacija na vseh inputih — full chain check (od ≤ svoj do, od > prejšnji do, do > prejšnji do)
- Ponastavi/X/Escape preskočijo blur validacijo (_preskociBlur flag)
- Modal za napake: `root.potrdiVprasanje({ naslov, opis, potrdiBesedilo, samoEnGumb, stil })`
