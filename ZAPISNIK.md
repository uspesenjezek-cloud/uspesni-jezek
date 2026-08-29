# ZAPISNIK — Uspešni Ježek (stanje ob koncu seje 2026-08-26)

Ta dokument je namenjen predaji konteksta novemu pogovoru. Prilepi ga na začetek novega pogovora, da agent takoj razume, kje smo. **Ta datoteka nadomesti prejšnjo verzijo** (opisovala je `izvedba.js` dialog "Kaj želite narediti?"/"Kako je bil račun poravnan?" — glej razdelek 5 spodaj za skrajšan povzetek in trenutno stanje tega). Ta seja je pokrivala tri ločene teme: (1) nadaljevanje/popravek čarovnika "Posreduj takoj odvetniku" v `izvedba.js`, (2) obsežen večkrožni pregled dokončanosti nemškega POS terminala, (3) začetna raziskava Apple-like redesigna kartic "Podjetja" v Bonitetnem centru.

## 1. Okolje

- Kanoničen delovni direktorij: `C:\Users\jkjob\Desktop\uspesen jezik git`
- Edini pravi produkcijski naslov: `https://uspesni-jezek.vercel.app/app/index.html` (Vercel projekt `uspesni-jezek`)
- Lokalni dev strežnik `http://localhost:8001` samo za interno testiranje
- **V repozitoriju hkrati dela vsaj eno drugo AI orodje ("Codex").** Pred vsakim posegom v skupno datoteko znova `Read`/`Grep` trenutno stanje — v tej seji je Codex vzporedno commital ogromno POS kode (glej razdelek 2) in tudi sam urejal `izvedba.css`/`izvedba.html` (bump verzij) medtem ko sem jaz delal na isti datoteki.

## 2. POS terminal — dokončanost ~87 %, podrobno preverjeno v 5 krogih

**Ključno dejstvo seje:** ogromen kup (~150 datotek, ~116 SQL migracij, ves POS/OpenAPI/DATEV/Stripe/finAPI/Fiskaly/WORM arhiv razvoj od 19.–26. 8.) je bil MED to sejo dejansko **commitan** s strani drugega agenta (`1474119 feat(pos): harden German POS and OpenAPI readiness`, mergean v `8c057d6`). Prej je bilo vse to necommitano na disku.

**Cloud pregled (`uspesni-jezek-openapi-test.vercel.app`) je BLOKIRAN** — Vercel Deployment Protection/SSO preusmeri na `vercel.com/login`, ni to aplikacijska avtentikacija. Cloud pregled ni dal NOBENE funkcionalne ugotovitve. Za pravi zunanji pregled bi lastnik moral izklopiti Vercel Deployment Protection ali dati "Protection Bypass for Automation" token.

**Lokalni pregled (5 krogov, zadnji round 5 je dokončen)** — polna najdba v spominu: `project_pos_terminal_audit_findings.md`. Povzetek:
- **Koda/arhitektura: ~92 %** — vsi prejšnji arhitekturni riziki (RPC timeout 18/18, KoSIT preflight gate resničen na strežniku in ni obhoden s klienta, WORM/GoBD arhiv za vseh 7 vrst dokumentov, double-click zaščita na dveh nivojih, 0 nevarnih `grant...to anon`) so bili PONOVNO preverjeni in POTRJENI kot pravilno rešeni. `node scripts/run-pos-tests.js` (23 datotek + Vercel proračun) uspe v celoti.
- **Zaupanje v teste: ~82 %** — v round 5 prebranih 21/24 testnih datotek (ne le vzorec), večina je prava izračunana poslovna logika, ne string-match.
- **Ročno preverjeni 3 finančni izračuni** (DDV razdelitev, Schlussrechnung odbitek Abschlagsrechnung, €250 Kleinbetragsrechnung prag) — vsi matematično pravilni.
- **Edini preostali KODNI manko: 13 neprevedenih slovenskih nizov** v `app/pos-terminal.js` (natančen seznam z vrsticami v spominu) — šest od njih ("Dokaz ...") je v pravno občutljivem toku odstopa potrošnika (Widerrufsrecht), prednostno popravi te. Poleg tega razširi `highConfidenceSlovenianUi` regex v `scripts/test-pos-i18n.js:~176`, da jih test v prihodnje zazna.
- **Produkcijska pripravljenost: 0/6 vrat (`node scripts/check-pos-production-readiness.js`)** — a NOBENA od 6 blokad ni kodna. 4 so zunanja konfiguracija (Supabase prod ključi, OpenAPI e-računi žeton+webhook, S3 WORM poverilnice), 2 sta namerni človeški potrditvi (`POS_DE_LEGAL_REVIEW_CONFIRMED`, `POS_DE_PILOT_ACCEPTED`).
- **Realen "ozek grlo" do prave produkcije: odprtje nemške firme + VAT/davčna številka** (~2-6+ tednov, nemška birokracija) — od tega so odvisni OpenAPI produkcijski žeton in smiseln pilot pri obrtniku. Infrastruktura (Supabase/S3) in i18n prevodi NISO odvisni od tega in jih lahko kdorkoli dokonča vzporedno/takoj.

**Za Codex, konkretna naloga, če jo prevzame:** prevedi seznam 13 nizov v `app/pos-terminal-i18n.js` + razširi test regex. To je edino preostalo kodno delo na POS terminalu, ki ga je ta pregled našel.

## 3. `izvedba.js` — čarovnik "Posreduj takoj odvetniku" (PREVZEL CODEX, ne dokončano z moje strani)

Uporabnik je zahteval nov čarovnik na kartici "Posreduj takoj odvetniku" (znotraj "Ne bo plačal" menija), ki naj izgleda IDENTIČNO obstoječi "Predaja odvetniku" (10. korak glavnega načrtovalca opominov v `opomin-nacrt-ui.js`), a brez uvažanja celega 677 KB `opomin-nacrt-ui.js` modula (tuja DOM/globalna vezava).

**Pristop, ki je bil dogovorjen in delno izveden:**
- Backend: `api/_lib/izvedba-core.js` — `handoff_to_lawyer` akcija zdaj sprejme neobvezen `lawyerHandoff` patch (funkcija `sanitizirajLawyerHandoffPatch`), ki se v enem atomskem RPC klicu zapiše v `plan.steps[manual_lawyer].lawyerHandoff` PRED `preveriPredajoPopolno` preverbo. Brez nove SQL migracije (obstoječi RPC `izvedi_opomin_ukrep` ima generično vejo za poljuben `actionType`). Vseh 63 testov v `scripts/test-izvedba-actions.mjs` prehaja (vključno s tem, da sem popravil en krhek test, ki je preverjal točen `?v=` niz namesto vzorca).
- Frontend: nov `state.actionSheetMode = "lawyer"` v `izvedba.js`, 3-zaslonski čarovnik (paket+odvetnik → čas/dokumenti/sporočilo → pregled+potrditev) prek `odpriOdvetnikCarovnik()`/`izrisiOdvetnikSheet()`.
- **KLJUČNA LEKCIJA (uporabnik se je razjezil "WTF NO"):** prvi poskus sem naredil z lastnimi na novo izmišljenimi CSS razredi (`izvedba-odvetnik-*`) namesto ponovne uporabe pravega markupa. Uporabnik je eksplicitno zahteval "kopiraj kot vse pri predaji odvetniku, ne izumljaj po svoje". **Popravek:** ker `app/izvedba.html` že nalaga `styles.css` (globalni), sem markup prepisal na DOBESEDNO iste razrede kot original (`lp-predaja-povzetek__*`, `lp-paket-kartica__*`, `opomin-predaja-sestavljalnik__*`, `opomin-predaja-pregled__*`) — brez ene same nove vizualne CSS vrstice. Ostal je samo en na novo izmišljen del: `.izvedba-odvetnik-seznam`/`.izvedba-odvetnik-vrstica` za preklop med 3 odvetniki (original tega nima kot preprost seznam, ampak kot poln popup, ki je bil namerno izpuščen iz obsega).
- **Pravilo za naprej:** "kopiraj kot original" pomeni dobesedno iste razrede/markup, NE nov dizajn po lastnem okusu, tudi če je "podoben" ali "v istem slogu". Preveri, ali je skupni CSS/styles.css že naložen na ciljni strani, preden izmišljaš karkoli novega.
- **Najden in popravljen resen bug:** obstoječe mobilno pravilo `.izvedba-action-sheet__scroll { display:grid; grid-template-rows: auto auto; }` (v `@media` bloku) ni imelo `grid-template-columns`, zato se je stolpec širil na `max-content` katerekoli notranje vsebine — dosedanje kartice tega niso razkrile, nov karusel paketov pa je (674px namesto 360px, cel sheet je bil prekinjen/odrezan). **Popravek: dodaj `grid-template-columns: minmax(0, 1fr);`** — to je splošno uporaben "grid blowout" popravek, uporaben tudi drugje v tem projektu, če se podoben simptom pojavi.
- Tudi popravljen manjkajoč ovijajoči `<div class="opomin-predaja-sestavljalnik">` (daje `position:relative` in padding za lebdečo pill odvetnika in "krvaveč" rob dnevi-kartice) in narobe parsan format datuma (`K.formatirajDatumUro(...).split(" ")[0]` je dajalo samo "12." namesto "12. 12. 2022" — uporabi obstoječ `datumSamoZaPrikaz()` helper namesto tega).
- **Trenutno stanje: NIČ ni bilo commitano.** Uporabnik je rekel "bo prevzel Codex" — jaz sem se ustavil. Datoteke na disku (necommitano): `app/izvedba.js`, `app/izvedba.css`, `app/izvedba.html` (cache-busting), `api/_lib/izvedba-core.js`, `scripts/test-izvedba-actions.mjs`. Pred nadaljnjim posegom PREBERI, kaj je Codex morda že spremenil.
- **Namerno izpuščeno iz obsega (po dogovoru z uporabnikom, ne pozabi):** filter "Priporočeno/Mešane ponudbe" dropdown, gumb "Predogled" na paket kartici, sestavljalnik paketa po meri, nalaganje datotek za dokument "Pogodba ali ponudba" (dokumenti se avtomatsko štejejo za pripravljene iz obstoječih podatkov primera, brez upload UI-ja).

## 4. Bonitetni center — "Podjetja" kartice, Apple-like redesign (SAMO RAZISKAVA, nič v kodi)

Uporabnik je pokazal posnetke zaslona kartic v "Podjetja" zavihku (spodnja navigacija Preveri/Spremljano/Podjetja) — vsaka kartica: avatar z inicialkami, ime podjetja, HRB/HRA + naslov, status pilula (Aktivna/Neaktivna), vrstica "Brez zaznanih objav"/"Zaznane posebnosti", dva gumba (Odpri profil / Spremljaj).

- **Točne komponente v kodi NISEM našel/potrdil** — poskusil sem `boniteta-sredisce.js` (razred `boniteta-spremljanje-podjetje` obstaja, a je to DRUGA komponenta — nastavitev spremljanja enega podjetja, ne seznam kartic iz posnetka). `bonitetna-preverba.js`/`.css` in `bonitetna-podjetje-grafike.css` so verjetni kandidati (glej opombo v razdelku 5 spodaj o konkurenci teh dveh CSS datotek). **Naslednji korak: uporabi Explore agent ali natančnejši grep za točen razred te specifične kartice**, preden karkoli implementiraš.
- Naredil sem SAMO dva vizualna mockupa prek `mcp__visualize` orodja (ne v pravi kodi) — prva verzija (tanjši, text-link akcije) je bila zavrnjena kot premalo "Apple-like/lepa". Druga verzija (v teku odobritve): mehkejši tonirani avatar (ne poln teal), status kot pika+besedilo poleg imena namesto pilule zgoraj desno, status vrstica kot tonirana ploščica brez trde obrobe, primarni gumb poln/okrogel ("Odpri profil"), sekundarni kot kvadraten ikonski gumb ("Spremljaj" z `ti-bookmark-plus`) — v slogu iOS Kontaktov/App Store kartic.
- **Ni bilo potrjeno s strani uporabnika, ali je v2 dovolj dobra** — pred implementacijo v pravo kodo vprašaj za potrditev smeri, nato najdi pravo komponento in uredi obstoječo (ne nov mockup), po pravilih iz `CLAUDE.md` (§6).

## 5. Prejšnja tema (`izvedba.js` "Kaj želite narediti?"/"Kako je bil račun poravnan?") — SKRAJŠANO

Ta arhitektura (dva `actionSheetMode`: `"actions"` in `"payment"`, `VRSTNI_RED_KARTIC`/`SETTLEMENT_ORDER`, kartica "Dolžnik je obljubil plačilo" kot mešani vzorec, napredni načrtovalec obrokov) je bila DOKONČANA in COMMITANA v prejšnji seji (glej git log `ac7c52a`, `333553c`). Podrobnosti o vzorcih (npr. "premakni kartico" pravilo, gol `addEventListener` past, `UJIzvedbaDebug` testna past) najdeš v git zgodovini te datoteke, če jih boš rabil — niso ponovno navedene tu, ker je ta del zaključen.

- `bonitetna-preverba.css` in `bonitetna-podjetje-grafike.css` tekmujeta za iste razrede — pri delu na "Podatki podjetja" register-card pogledu vedno preveri OBE datoteki.
- Ikone/majhne elemente vedno preveri pri PRAVI velikosti (1×), ne samo povečano.

## 6. Nerešeno/odprto

- Uporabnik je vprašal "kaj sva rekla da je kategorija 20 v spominu" — v spominu NI bilo nič ujemajočega, tudi po grep-u cele kode. Ostalo nepojasnjeno, ni bilo dodatnega konteksta.
- Cache-busting trenutno stanje `izvedba.html`: `izvedba.css?v=20260825-odvetnik-carovnik-grid-overflow-fix-v23` (zadnja znana, Codex jo je morda že spremenil), `izvedba.js?v=20260825-odvetnik-carovnik-datum-fix-v34` — PREVERI SVEŽE STANJE pred vsakim `Edit`.
