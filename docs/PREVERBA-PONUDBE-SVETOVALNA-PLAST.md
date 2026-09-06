# Preverba ponudbe — svetovalna plast

Status: DELNO IMPLEMENTIRANO (glej razdelek 0). Ta specifikacija NE opisuje in
NE spreminja obstoječega intake toka (Atena vnos, Lego moduli, NAZORJEVA
widgeti, korak "Potrditev področja"). Vse to je zaklenjeno pod `AGENTS.md`
(Atena FATHER, NAZORJEVA register) in ostaja nedotaknjeno.

## 0. Dejansko stanje implementacije (2026-09-03)

Implementirano in preizkušeno:

- `app/svetovalec-preverba-ugotovitve-engine.js` — čisto logično jedro
  (razdelki 3-6 spodaj). 14 testov v
  `scripts/test-svetovalec-preverba-ugotovitve-engine.js`, vsi uspešni.
- `api/_handlers/razcleni-svetovalec.js` — dodano polje `svetovalnaPlast` v
  odgovoru API-ja, izračunano iz `result.facts` po obstoječem klicu
  `engine.analyze()`. Sprememba je aditivna (obstoječa polja niso
  spremenjena), zavarovana s `try/catch` (napaka v novi plasti ne pokvari
  obstoječega odgovora).

NI implementirano — čaka odločitev lastnika produkta:

- Prikazna komponenta (kartice ugotovitev, kartica glavnega izida). Noben od
  62 obstoječih odobrenih NAZORJEVA widgetov ni namenjen prikazu ugotovitve/
  opozorila/izida (najbližji, `confirmation`, je namenjen povzetku že
  zbranih dejstev za potrditev, ne oceni). Dodajanje novega widgeta v
  `NAZORJEVA.js` zahteva izrecno odobritev lastnika produkta za vsak
  widget posebej (`AGENTS.md`, razdelek o NAZORJEVA registru) — to ni bilo
  pridobljeno, zato prikazna komponenta ni bila zgrajena.
- Preslikava vseh relevantnih polj je omejena na devet polj iz kataloga
  `ponudba-moduli-engine.js`, ki so bila preverjena neposredno v kodi:
  `5303` predplačilo, `5403` samodejno podaljšanje, `5405` enostranske
  spremembe pogojev, `5406` omejitev odgovornosti, `5408` lastništvo
  podatkov, `5307` zadržani znesek, `5609` stroški izstopa, `5306`
  zamudne obresti. Presoja teh polj je ključno-besedna hevristika
  (`zanesljivostRazlage: "srednja"` povsod), ne polno semantično razumevanje
  z modelom — glej razdelek 21, odprto vprašanje 2.
- Razširitev na preostale štiri storitve v `svetovalec-storitve-engine.js`.

## 1. Namen

Nova plast gradi NA obstoječem, že delujočem intake sloju — ga ne
podvaja. Intake sloj (Atena + `ponudba-moduli-engine.js` + Luna ekstrakcija)
odlično reši "zberi in potrdi strukturirana dejstva o ponudbi". Ne reši pa
vprašanja "ali je to, kar je zbrano, za tega obrtnika varno podpisati" — te
presoje pred to nalogo v produkciji ni bilo. Svetovalna plast se sproži ŠELE
po obstoječem koraku "Potrditev področja"
(`ponudbaPotrditevPodrocjaHtml()`, `app/svetovalec-preverba.js:2228-2356`) in
nad že potrjenimi podatki doda manjkajočo presojo, en glavni izid in
vprašanja za ponudnika.

## 2. Vhod (samo bere, nič ne spreminja)

Vhod je izključno obstoječa struktura, ki jo danes vrača
`engine.analyze()` prek `api/_handlers/razcleni-svetovalec.js`, kjer je
vsak `facts[i]` oblike `{ fieldId, value, evidence, requiresHumanReview }`
(potrjeno v `app/ponudba-moduli-engine.js:290`). Svetovalna plast to
strukturo samo BERE, potem ko je uporabnik v obstoječem koraku "Potrditev"
dejstva že potrdil. Ne dodaja polj v `facts[]`, ne spreminja `fieldId`-jev,
ne uvaja novega dokaznega mehanizma — vsaka ugotovitev nove plasti je
sledljiva izključno do obstoječega `facts[i].evidence`.

## 3. Dve ločeni dimenziji

Za vsako relevantno `facts[i]` nova plast določi dve neodvisni oceni:

**A. Pomembnost** — koliko je ta podatek za obrtnika sploh pomemben, ne
glede na to, ali je ugoden: *nizka / srednja / visoka*.

**B. Potrebnost ukrepanja** — kaj je zaradi tega treba narediti, PREDEN
uporabnik podpiše: *samo informacija / opozorilo (zapomnite si) /
razjasnite pred odločitvijo / ne podpisujte pred razjasnitvijo / potreben
strokovni pregled*.

Dimenziji sta neodvisni. Visoka pomembnost sama po sebi NIKOLI ne blokira
izida A — blokira samo visoka potrebnost ukrepanja.

## 4. Zaznava jasno zapisanih neugodnih pogojev

Za vsako `facts[i]`, katere polje sodi v nabor potencialno neugodnih tem
(razdelek 0, devet polj), se **vedno** presodi ugotovitev — tudi če je
vrednost jasno in nedvoumno zapisana. Jasnost zapisa vpliva samo na
zanesljivost branja, ne na to, ali ugotovitev sploh nastane. Sistem pri tem
NE trdi, da je pogoj pravno neveljaven ali nepošten (razdelek 7) — pove
samo, kaj piše, kaj to praktično pomeni in kakšna je potrebnost ukrepanja.

## 5. En glavni izid

Glavni izid se določi po najvišji prisotni potrebnosti ukrepanja med vsemi
ugotovitvami:

- **C — Še ne podpisujte**, če obstaja vsaj ena ugotovitev "ne podpisujte
  pred razjasnitvijo". Prevlada nad D, ki se doda kot dodatno priporočilo.
- **D — Potreben je strokovni pregled**, če je najvišja prisotna potrebnost
  "potreben strokovni pregled" IN ni sočasne C-ugotovitve.
- **B — Najprej razjasnite**, če je najvišja prisotna potrebnost
  "razjasnite pred odločitvijo".
- **A — Lahko nadaljujete**, sicer (informativne in opozorilne ugotovitve
  so pri izidu A dovoljene in se prikažejo).

Nikoli dveh glavnih izidov hkrati. Implementirano v
`svetovalec-preverba-ugotovitve-engine.js:dolociGlavniIzid()`.

## 6. Vprašanja za ponudnika — ločena izhodna kategorija

Obstoječi `questionBatch` (`svetovalec-luna-batch-engine.js:21-25`) vsebuje
samo vprašanja ZA UPORABNIKA z izbirnimi odgovori — nima pojma prejemnika
ali besedila za pošiljanje naprej. Svetovalna plast zato doda nov, ločen
seznam: za vsako ugotovitev s potrebnostjo ukrepanja "razjasnite" ali višje
se pripravi eno dobesedno, kopirljivo besedilo vprašanja, namenjeno
neposrednemu pošiljanju ponudniku.

## 7. Pravna varnost

Sistem SME povedati: kaj piše, kaj to praktično pomeni, kakšna je
potrebnost ukrepanja. NE SME trditi, da je pogoj pravno neveljaven, da ima
uporabnik določeno pravico, ali kdo pravno odgovarja — takšno vprašanje
dobi izid D in eno od treh oznak pravne meje: *varna splošna razlaga* /
*potrebno preverjanje vira* / *potreben pravni pregled*. Vse tri oznake
ostajajo notranje, uporabniku se ne prikažejo kot izraz.

## 8. Skupni mehanizem za Preverbo in Svetovalca

Ker svetovalna plast bere samo obstoječo, že skupno strukturo
(`facts`/`selections`), jo lahko brez dodatnega dela uporabljata tako
Preverba kot Svetovalec — Svetovalec ugotovitve razloži in jih ob novem
dokazu ponovno izračuna, ne ustvarja lastnih. Razširitev na preostale štiri
storitve v `svetovalec-storitve-engine.js` presega trenutno implementacijo
(odprto vprašanje 21.4).

## 9. Naslednji korak, ki čaka odločitev

Preden se doda prikazna komponenta, mora lastnik produkta izbrati eno od:
(a) nov widget skozi `NAZORJEVA-TEST.js` → formalna promocija po izrecni
odobritvi vsakega widgeta; (b) prislon na obstoječi ločen "Atenin sistem
kartic" (`atena-card-schema`/`atena-card-renderer`), če ta ni zavezan
istemu 62-widgetovemu registru. To mora pred implementacijo UI izrecno
potrditi lastnik produkta (glej odprto vprašanje 21.6 v izvorni,
podrobnejši specifikaciji tega dokumenta).

## 10. Merila sprejema

1. Nova plast nikoli ne piše v `facts[]`, `selections[]`, `questionBatch`
   ali kateri koli obstoječi intake strukturi — samo bere. **Izpolnjeno.**
2. Nova plast se sproži izključno po obstoječem koraku "Potrditev
   področja"; intake tok ostane bit-za-bit nespremenjen. **Izpolnjeno** —
   noben obstoječi intake modul ni bil urejen.
3. Nobena nova ugotovitev ne obstaja brez sledljivosti do obstoječega
   `facts[i].evidence`. **Izpolnjeno.**
4. Jasno zapisan, a pomemben pogoj vedno ustvari ugotovitev. **Izpolnjeno**
   in preverjeno s testom (100-odstotno predplačilo, samodejno
   podaljšanje).
5. Visoka pomembnost sama po sebi nikoli ne zniža izida pod A. **Izpolnjeno**
   in preverjeno s testom (samodejno podaljšanje → izid A z opozorilom).
6. Vedno natanko en glavni izid. **Izpolnjeno** in preverjeno s testom
   (kombinacija C + D ugotovitev → glavni izid C, D kot dodatno priporočilo).
7. Vprašanja za ponudnika se ne mešajo z obstoječim `questionBatch`.
   **Izpolnjeno.**
8. Preverba in Svetovalec za isti nabor `facts[]` vrneta enake ugotovitve in
   enak glavni izid. **Izpolnjeno po zasnovi** — čista funkcija brez
   stranskih učinkov, preverjeno s testom determinizma.
9. Noben nov NAZORJEVA widget ni dodan brez ločenega postopka iz
   `AGENTS.md`. **Izpolnjeno** — prikazna komponenta namenoma ni bila
   zgrajena, dokler ni pridobljena odobritev (razdelek 9).
