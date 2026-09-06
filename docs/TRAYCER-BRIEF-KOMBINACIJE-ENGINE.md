# Traycer brief — engine za kombiniranje NAZORJEVA-VRSTICE kartic (reaktivno stanje med karticami)

Status: BRIEF za zasnovo v Traycerju. Nič od spodnjega še ni implementirano.

## Kaj že obstaja (da se ne podvaja)

1. **`app/svetovalec-conversation-flow.js` + `app/svetovalec-clarification-engine.js`** — obstoječi, pravi produkcijski engine, ki odloča, **KATERO VPRAŠANJE PRIDE NASLEDNJE** glede na prejšnje odgovore (namen-dejanja → enkratno-ali-ponavljajoce → vrsta-dokumenta → glavna-skrb, itd., glej `plan()` v clarification-engine). To je sekvenčno vejanje (ena kartica naenkrat, "naslednji korak"), **ne** živa reaktivnost med dvema hkrati vidnima karticama. Ta engine ostane nedotaknjen.
2. **`app/ponudba-moduli-engine.js`** (POLJA, 60 polj) + renderer v `app/svetovalec-preverba.js` (`ponudbaPoljeHtml`, `ponudbaOsnutek.answers`) — obstoječ, pravi, delujoč flat form: vsako polje ima svoj `field.id`, vrednost se bere/piše v `ponudbaOsnutek.answers[field.id]`. **Polja med seboj NE vedo druga za drugo** — ni pogojnega prikaza, ni ponavljajočih se skupin, ni živih vsot. To je natanko vrzel, ki jo nova naloga zapolnjuje.
3. **`app/atena-card-segments.js`** — obstoječ "segment engine", ki SESTAVLJA en sam DOM iz delov (fieldLabel, choiceGroup, moneyField, stepper, liveSummary, resetButton, stepHeader, `sestaviKartico`). To je gradnja ENE kartice iz delov — ne pove nič o tem, kako se VEČ ločenih kartic odziva druga na drugo. Nova naloga je na plasti NAD tem.
4. **`NAZORJEVA-VRSTICE.js`** — register 133 atomarnih vzorcev, samo metapodatki (naslov/opis/CSS-viri), brez vedenja/logike. Relevantne vrstice za primer iz naloge:
   - #10 `skupina-izbirnih-gumbov` — izbira ene možnosti (npr. "1 / 2 / 3 pogodbe")
   - #13 `stepper-nadzor` — minus/vrednost/plus
   - #35 `kolicinski-nadzor-produkcija` — PRAVI produkcijski stepper (minus/vnos/plus/enota)
   - #12 `denarno-polje`, #34 `denarni-vnos-produkcija` — denarni vnosi, ki bi jih bilo treba seštevati
   - #5 `obarvana-vrstica-povzetka` — kandidat za "živi seštevek/števec spodaj"
5. **205 mockup kartic** (`NAZORJEVA-PREDLOGI-MOCKUP.html`) — čiste vizualne lupine s PRIMER-podatki. Vsaka kartica danes deluje IZOLIRANO (lasten majhen script blok, glej vrstice ~5000-6500). Nobena kartica danes ne bere stanja druge kartice.

## Konkreten problem, ki ga uporabnik opisuje

Primer uporabnika (dobesedno): vrstica A = izbira "koliko pogodb imate" (1/2/3, gumbi ali stepper). Ko uporabnik izbere npr. "3", se mora vrstica B (spodaj, "števec"/skupna vrednost) **odzvati** — npr. prikazati 3 ponovljene sklope polj (eno na pogodbo) ali preračunati živo vsoto/števec na podlagi vnosov v teh treh sklopih. **Obe vrstici morata vedeti druga za drugo**: A piše vrednost, ki jo B bere; B (ali sklopi, ki jih B ustvari) morda piše nazaj vrednosti, ki jih spet nekaj tretje bere (živ seštevek).

To ni sekvenčno "naslednje vprašanje" (obstoječi conversation-flow), ampak **hkratna, na-zaslonu-vidna reaktivnost** med več karticami/vrsticami iste forme.

## Kaj mora Traycer zasnovati

1. **Model deljenega stanja** — en objekt/store za "trenutni ekran" (npr. razširitev ali vzporednik `ponudbaOsnutek.answers`), kjer vsaka vrstica/kartica deklarira:
   - katere ključe **bere** (reads)
   - katere ključe **piše** (writes)
   - funkcijo za ponoven izris/preračun, ko se spremeni ključ, ki ga bere
2. **Mehanizem "ponavljajočih se skupin"** — ko vrstica A piše število N (npr. count polj/pogodb), mora engine znati inštancirati/odstraniti N kopij določene kartice-predloge (predefinirane v `NAZORJEVA-VRSTICE.js` ali `atena-card-segments.js`), vsako s svojim namespace-om ključev (npr. `pogodba_1_cena`, `pogodba_2_cena`, ...).
3. **Živi agregati** — vrstica tipa "obarvana-vrstica-povzetka" (#5) ali "denarno-polje" (#12), ki prikazuje SEŠTEVEK/ŠTEVEC vrednosti iz N ponovljenih polj zgoraj, se mora samodejno preračunati ob vsaki spremembi katerekoli od N vrednosti.
4. **Deklaracija "kdaj se kartici kombinirata in zakaj"** — potreben je eksploiten register/pravila (podoben `NAZORJEVA-VRSTICE.js`, a za KOMBINACIJE, ne posamezne vrstice): "vrstica tipa izbira-števila + vrstica tipa denarno-polje => skupina se ponovi N-krat + doda se živi seštevek spodaj". To ni splošen graf poljubnih odvisnosti (to bi bilo prekompleksno) — najbrž majhen, poimenovan nabor VZORCEV KOMBINACIJE (npr. "štej-in-ponovi", "izberi-in-pogojno-prikaži", "vnesi-in-sestej"), ne prosto žično vezanje kjerkoli s kjerkoli.
5. **Vklopna točka v `app/svetovalec-preverba.js`** — kje in kako nov engine nadomesti/razširi obstoječi `ponudbaPoljeHtml` + `ponudbaOsnutek.answers` tok, ne da bi se pokvarilo obstoječih 60 statičnih polj (ki reaktivnosti ne potrebujejo in naj ostanejo preprosta).
6. **Omejitev obsega** — večina od 60 obstoječih polj v `ponudba-moduli-engine.js` NE potrebuje te reaktivnosti (so preprosta neodvisna polja). Nov engine je namenjen NOVIM/PRIHODNJIM sklopom polj, ki dejansko potrebujejo štetje/ponavljanje/vsote — ne prisilne predelave vsega obstoječega v reaktivni model.

## Trdi tehnični okvir (ne spreminjati)

- UMD modul vzorec kot vsi ostali `app/*.js` (glej katerikoli obstoječi engine za primer ovoja).
- `Object.freeze` na vseh javnih definicijah/registrih (ustaljen vzorec v tem repu).
- Slovenska imena funkcij/spremenljivk (kot v vseh obstoječih engine datotekah — `preberi*`, `izrisi*`, `nastavi*` itd.).
- Ne dotikaj se `NAZORJEVA.js` / `NAZORJEVA-TEST.js` governance testov (62 odobrenih, 1 v testu) — ti morajo ostati nespremenjeni.
- Ne spreminjaj `app/svetovalec-conversation-flow.js`, `app/svetovalec-clarification-engine.js`, `app/svetovalec-guided-flow-engine.js`, `app/svetovalec-dynamic-batch-engine.js` — ločen, zaključen sistem za vrstni red vprašanj.
- Nova datoteka(-e) morajo imeti svoje teste po vzoru `scripts/test-atena-card-segments.js` (10 testov, brez mock ogrodij, čist `node:assert`).

## Vhodni viri za Traycer (natančne poti)

- `C:\Users\jkjob\Desktop\uspesen jezik git\app\svetovalec-preverba.js` (vrstice ~1949-1970: `ponudbaPoljeHtml`, `ponudbaPoljaRazpored`; vrstica 1911: `nastaviAktivnoStoritev`)
- `C:\Users\jkjob\Desktop\uspesen jezik git\app\ponudba-moduli-engine.js`
- `C:\Users\jkjob\Desktop\uspesen jezik git\app\atena-card-segments.js`
- `C:\Users\jkjob\Desktop\uspesen jezik git\NAZORJEVA-VRSTICE.js`
- `C:\Users\jkjob\Desktop\uspesen jezik git\app\svetovalec-conversation-flow.js` (samo za referenco, KAKO obstoječi sistem loči "plan"/"answer"/"rebuild" — nov engine naj se zgleduje po podobni čistosti, ne po isti domeni)

## Kaj Traycer NI dobil (namerno)

- Ni dobil naloge spreminjati vizualni izgled 205 mockup kartic (Spark-ovo delo, ločeno, že narejeno).
- Ni dobil naloge dokončati "5 kanoničnih storitev" vsebinske definicije (ločena, še odprta tema).
