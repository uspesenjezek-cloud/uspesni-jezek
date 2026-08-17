# POVZETEK PROJEKTA — »Uspešni Jezek«

## 1. Kaj je projekt

Platforma za **obrtnike** (Slovenija/Nemčija) — reševanje realnih poslovnih problemov. Trenutno v razvoju **Kategorija 1 — Neplačila** (izterjava dolgov z opominskim načrtom).

Flow neplačil je 3-stopenjski:
1. `neplacila.html` — vnos dolžnika
2. `neplacila-sporocilo.html` — vnos sporočila
3. `neplacila-posiljanje.html` — **načrt opominjanja** (tukaj se dogaja 95 % trenutnega dela)

10. korak načrta je **»Predaja odvetniku«** (ročni odvetniški korak, `manual_lawyer`) — na njem je trenutni fokus.

## 2. Tehnologija

- **Stack:** čisti HTML/CSS/JS (brez frameworkov), Vercel hosting + `/api` serverless funkcije, Supabase (podatki/storage/auth)
- **Edina npm odvisnost:** `luxon` (časovni pasovi)
- **Mobilno prvenstveno**, UI v **slovenščini**, mint/teal barvna shema
- **Barve:** `--teal: #51999a`, `--teal-dark: #10797d`, `#15959B`, `#168E94`; font `Inter`
- BEM poimenovanje za nove komponente

## 3. Lokacija in ukazi

- **Repo:** `C:\Users\jkjob\Desktop\uspesen jezik git` (Windows, PowerShell)
- **Branch:** `feature/korak3-cas-sheet-in-predloge`
- **Zagon:** `powershell.exe -ExecutionPolicy Bypass -File ".\serve.ps1" -Port 8000`
- **Ngrok (HTTPS/test na telefonu):** `./ngrok.exe http --domain=spoiled-vengeful-cofounder.ngrok-free.dev 8000`

## 4. Testi (vse zeleno na koncu zadnje seje)

```
node --check app/opomin-nacrt.js
node --check app/opomin-nacrt-ui.js
node --check app/app.js
node scripts/test-random.js                    → 312/312
node scripts/test-scheduler.js                 → 19/19
node scripts/test-predaja-koncni-pregled.js    → 15/15
node scripts/test-opomini-pregled.js           → 19/19
node scripts/test-paket-storitev.js            → uspešno
node scripts/test-predaja-sestavljalnik.mjs    → 34/34
npm.cmd test   (vse zgoraj združeno)
```
> Pozor: `npm test`/`npm.cmd test` lahko pade zaradi PowerShell execution policy — takrat poženi `node scripts/...` neposredno.

## 5. Ključne datoteke

| Datoteka | Vloga |
|---|---|
| `app/opomin-nacrt.js` | **Podatkovna plast** načrta (čista logika, brez DOM). ~2700 vrstic. Ima `module.exports` za teste |
| `app/opomin-nacrt-ui.js` | **UI plast** (vsi HTML generatorji + event binding). ~11.000 vrstic |
| `app/styles.css` | Vsi stili (~21.000 vrstic) |
| `app/app.js` | Glavna logika, Supabase, `naloziPrilogo`, `pridobiUrlPriloge`, navigacija |
| `app/priloge-vsebina.js` | `validirajDatoteko(file, obstojeci)`, `formatVelikost`, priloge za korak 2 |
| `api/` | Vercel funkcije: `aktiviraj-nacrt.js`, `obdelaj-opomine.js`, `potrdi-korak.js`, `_lib/` (scheduler, sms, supabase) |
| `supabase/migrations/` | SQL migracije (zadnja: `opomin_scheduler.sql`) |

## 6. Kako delava (delovna pravila)

1. **Majhni, ciljni popravki** — nikoli masivni refaktorji.
2. **Zamrznjeni deli** se eksplicitno navedejo in se jih NE sme spreminjati (npr. »vse od ›Izberite naslednji korak‹ navzdol je zamrznjeno«).
3. **En vir resnice** — ne uvajaj vzporednih stanj; podatki živijo v `lawyerHandoff`, `plan.steps` ipd.
4. **Ne `outerHTML`** — uporabljaj `innerHTML` panelov + ponovno vezavo handlerjev.
5. **Ne dodajaj CSS override na konec datoteke** — popravi obstoječe pravilo na mestu.
6. **Po vsaki spremembi:** `node --check` + testi + (če je UI) ročna vizualna potrditev v brskalniku na 320 px in 390 px.
7. **Vizualnega rezultata ne označim kot potrjenega brez posnetka** — v terminalu ne morem delati screenshotov, zato napišem »implementirano, vizualno še nepotrjeno«.
8. Povratne informacije so pogosto v obliki **»ocena X/10 + specifičen popravek«** — izvedem samo navedeni popravek, ne celega widgeta.

## 7. Zadnje opravljeno delo (nezaključeno — ni commitano!)

Vse spremembe so **nepushane/necommitane** (working tree je umazan — glej `git status`). Zadnja naloga:

### A) Enotni widget »Predaja odvetniku« (zgoraj)
- En zunanji okvir `.lp-enotni-widget` (brez kartic znotraj kartic)
- Glava s tehtnico + `PODATKI O PRIMERU` + Dolžnik/Zapadlost/Dolg (5-stolpčni grid: `1fr 1px 1fr 1px 1fr`)
- Statusni del je bil **nadomeščen z modulom `htmlOpominiPregled()`** (`lp-opomini-pregled*`):
  - časovni trak poslanih opominov (brez kartic, povezani krogi)
  - »Poglej vseh N opominov« → odpre `odpriZgodovinaSheet`
  - prazno stanje (0 poslanih) je **zamrznjeno kot končano** (ocena 8,5/10) — NE spreminjaj več
  - populated stanje (5 poslanih) je implementirano, **vizualno še nepotrjeno**
- Statusna preslikava: `unknown → --neznan`, `no_response → --brez-odziva`, `responded → --odziv`, `partially_paid → --delno`, `paid → --placano`
- Spodnji podvojeni prikaz zgodovine na 10. koraku je odstranjen (samo na `manual_lawyer`)

### B) Dokumentni kvadratki — več datotek (zadnja naloga, ravno dokončana)
V 10. koraku so 4 kvadratki: Račun / Podatki dolžnika / Zgodovina opominov / Pogodba. Spremembe:
- **`dodajDokumentOdvetniku`** zdaj shranjuje `sizeBytes` (prej ni)
- Nov helper **`dokumentiPredajePoTipu(plan, index, type, k1, prilogeKoraka)`** — vrne normaliziran seznam datotek kategorije; za račun združi `lawyerHandoff.documents` + `prilogeKoraka` z dedupom (po `id` → `storagePath` → `name+size+mime`)
- **`dokumentnoStanjePredaje`** vrne za vsako ploščico `{ type, title, status, subtitle, fileCount, files, generatedReady }`; `preparedCount` šteje kategorije (ne datotek), `baseTotal` ostane `4`
- Vse 4 ploščice so zdaj `<button>` z `data-dokument-odpri-tip`; podnapis kaže število datotek (`Ni datotek`, `3 datoteke`, …)
- Nov **kategorijski sheet** `#opomin-predaja-kategorija-dokumenti-sheet` (seznam datotek, sličica/PDF ikona, ogled prek signed URL, individualna odstranitev, `+ Dodaj datoteke`)
- Input `#opomin-dokument-datoteka` dobi `multiple`; change handler obdela **vse** datoteke (`Array.from`), zaporedno nalaganje, validacija glede na obstoječe, preprečevanje dvojnikov, status `Nalaganje X od Y …`
- Sheet »Vsi dokumenti« zdaj prikazuje vse datoteke, združene po kategorijah
- `sestaviPreparedSnapshot` vključi `sizeBytes`/`mimeType`

**Status B:** implementirano, `node --check` čist, 34/34 testov zelenih. **Posnetkov ni** — vizualna potrditev (320 px, 390 px, thumbnail, PDF, reload obstojnost, dvojnik, prevelika datoteka) je ODPRTA.

## 8. Kaj je »zamrznjeno« (ne spreminjaj brez izrecnega navodila)

- Prazno stanje zgodovine opominov (`lp-opomini-pregled--prazen`) — zaključeno 8,5/10
- Kartica »Predaja odvetniku«, gradient, glava
- Paketni carousel in popupi, `Potek opominov` 1–2–3 (višina 75 px)
- Gumb »Shrani osnutek« (besedilo `Shranjeno ✓`), odsotnost gumba »Nadaljuj na pregled«
- Logika pošiljanja/predaje, `opomin-nacrt.js` poslovna logika

## 9. Opombe za nov klepet

- Če je potrebna **slika/mockup**, ga ne vidim (model ne podpira slik) — navodila naj bodo tekstovna.
- `git status` je umazan s kupom sprememb iz več prejšnjih sej (ne samo zadnja naloga) — pri commit-u upoštevaj, da je v tree-u več ločenih zgodb.
- OPECODE.md obstaja, a je zastarel glede na zgornje.
