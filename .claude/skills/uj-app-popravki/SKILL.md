---
name: uj-app-popravki
description: Preveri, preden in potem ko urejaš app/*.js, app/*.css ali app/*.html v repozitoriju Uspešni Jezek (neplačila/opomini) — dvig cache-busting ?v=, stanje datotek zaradi vzporednih AI orodij, dvojnike koren/app, in znano iOS Safari/Chrome past pri sheet animacijah. Uporabi TAKOJ ob prvem dotiku ene od teh datotek, ne šele na koncu.
---

# Popravki v Uspešni Jezek (app/)

Ta repo ima štiri ponavljajoče se pasti, ki so v preteklih sejah že povzročile
resnične napake ali izgubljen čas. Preveri jih ob vsakem posegu v
`app/*.js`, `app/*.css`, `app/*.html` — ne samo ko uporabnik poroča o bugu.

## 1. Pred posegom: znova preberi stanje datoteke

V repozitoriju hkrati dela vsaj eno drugo AI orodje (Cursor/DeepSeek in
Codex-podoben agent). Datoteke, zlasti `app/opomin-nacrt-ui.js`,
`app/app.js`, `app/opomin-nacrt.js`, `app/styles.css`, se spreminjajo tudi
med sejami in včasih sredi seje.

**Naredi:** tik pred `Edit`/`Write` v skupno datoteko znova `Read`/`Grep`
trenutno stanje, ne zanašaj se na prej prebrano vsebino v kontekstu. Vrstične
številke iz prejšnjega branja so lahko zastarele.

Po `git status` preveri, ali so se pojavile nove netrackane datoteke drugih
orodij (npr. `app/__codex_widget_qa.*`, `OPECODE.md`) — to je normalno
stanje, ne napaka, samo znak, da je treba znova prebrati.

## 2. Preveri dvojnike koren ↔ app/

Vsaj enkrat je vzporedno orodje zapisalo stran aplikacije v **koren**
namesto v `app/` (prepisan `styles.css`, zastarel `neplacila-posiljanje.html`
v korenu). Ker je v `vercel.json` `outputDirectory: "."`, se koren dejansko
streže — uporabnik je na enem URL-ju videl staro, na drugem novo stanje.

**Naredi**, kadar uporabnik omeni "na eni napravi/brskalniku je drugače kot
na drugi" ali kadar delaš na strani, ki obstaja tudi zunaj `app/`:

```bash
for f in *.html *.css *.js; do [ -f "app/$f" ] && echo "DVOJNIK: $f"; done
```

Če dvojnik obstaja, primerjaj `mtime` in vsebino (komentar v glavi CSS
datotek običajno pove, kam datoteka spada, npr. "Ista paleta kot na javni
strani (../styles.css)"). Zastarelo/napačno kopijo iz korena umakni (premakni,
ne izbriši brez potrditve), pravo pusti v `app/`.

## 3. Po vsaki spremembi: dvigni cache-busting ?v=

Vse `<link>`/`<script>` reference na spremenjeno datoteko imajo
`?v=OSTREJSI-OPIS`. Če oznake ne dvigneš, brskalnik postreže staro verzijo iz
predpomnilnika in je videti, kot da sprememba ni delovala — enkrat je to
povzročilo, da sem po nepotrebnem trdil, da nisem nič spremenil.

**Naredi** takoj po vsakem `Edit`/`Write` v `.js`/`.css`:

```bash
grep -rn 'DATOTEKA.js?v=\|DATOTEKA.css?v=' app/*.html
```

in dvigni oznako na vseh straneh, ki jo dejansko nalagajo (ne vseh strani v
repu — samo tistih, ki so v `<script src>`/`<link href>` zanjo). Oznaka naj
bo `YYYYMMDD-kratek-opis-vN`.

## 4. iOS Safari/Chrome: visualViewport past pri animacijah sheetov

Bottom sheeti (`rok-sheet`, `obrocno-sheet` in podobni) na mobilnem berejo
`top`/`height` iz `--visual-viewport-*`, ki jih JS piše ob `resize`/`scroll`
dogodkih `window.visualViewport`. `position: fixed` na `body` (scroll lock)
v iOS-u premakne orodno vrstico brskalnika, kar sproži tak dogodek – če se to
zgodi SREDI vstopne animacije (fade), se panel opazno "trza", in to samo
občasno (odvisno od položaja drsenja, ko se sheet odpre).

**Naredi**, kadar dodajaš nov bottom sheet ali popravljaš odpiranje
obstoječega:
- geometrijo (`vklopiViewportPoslusalce`/ekvivalent) in scroll-lock nastavi
  PREDEN razkriješ element (`hidden = false`), ne po tem
- med vstopno animacijo (glej trajanje v `@keyframes` v styles.css, npr.
  `rokSheetPojavi`) na kratko zamrzni pisanje `--visual-viewport-*` iz
  dogodkov in združi zapise prek `requestAnimationFrame`, glej vzorec v
  `app/obrocno-sheet.js` (`vvZamrznjenoDo`, `vvRafId`)
- fokus, postavljen tik po odprtju, naj uporabi `focus({ preventScroll: true })`

## Splošno

- Ne briši obstoječe kode brez vprašanja, tudi če je videti kot vzrok buga.
- Po vsaki spremembi v `opomin-nacrt.js`/`opomin-nacrt-ui.js` poženi
  `npm test` (obsežen nabor skript v `scripts/`) preden razglasiš popravek za
  končan.
