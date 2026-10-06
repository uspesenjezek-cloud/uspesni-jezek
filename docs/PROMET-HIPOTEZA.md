# Promet za obrtnike — hipoteza in načrt preverbe (pred gradnjo)

Stanje: **analiza, ne implementacija.** Cilj je sistem, ki pove, koliko zamude
je običajno na *katerikoli* poti (ne le na avtocesti) ob določenem dnevu in uri,
deluje za 10 → 100+ obrtnikov v SI in DE, in **nikoli ne postane plačljiv na
klic**. Komercialni API-ji (Google, TomTom, HERE) so zavrnjeni: brezplačni
paketi so omejeni, pri rasti postanejo strošek na uporabnika, pogoji se lahko
spremenijo.

## 0. Odločitev uporabnika (6. 10. 2026): GPS samo z dovoljenjem

Beležimo delovne naloge (naslov stranke, ura prihoda) in **prednastavljeno
približno izhodišče**, ki ga obrtnik nastavi sam. **GPS vožnje beležimo samo,
če obrtnik to izrecno dovoli** (vklop v nastavitvah, kadarkoli preklicljiv).

Dva načina, ki delujeta skupaj:

| | Brez dovoljenja | Z dovoljenjem za GPS |
|---|---|---|
| Kaj shranimo | izhodišče (približno), naloge | + GPS točke *samo med vožnjo na nalog* |
| Kaj dobi obrtnik | napoved iz javnih virov + osnovnega modela | enako, a vse natančnejšo, ker njegove vožnje izboljšujejo profil |
| Kaj dobijo ostali | — | anonimne hitrosti po odsekih cest (brez imena, brez sledi) |

Posledice za zasnovo:

- Približno izhodišče zadošča: promet ocenjujemo po ~2 km celicah, nekaj sto
  metrov odstopanja ne spremeni rezultata.
- Plast »lastne vožnje iz GPS« (Traccar → Valhalla map matching → hitrosti po
  odsekih) ostane, a se polni **samo iz voženj s privolitvijo**. Več obrtnikov
  privoli, prej imajo tudi mestne in lokalne ceste merjene podatke.
- Kjer GPS podatkov še ni, velja deterministični osnovni model (vrsta ceste iz
  OSM × mesto/podeželje × ura × tip dneva). Koliko je natančen, pove pilot.
- Neobvezno tudi brez GPS: gumba **»Odhajam« / »Na lokaciji«**, ki shranita le
  *čas*. Dajeta dejansko trajanje poti za umerjanje in preverjanje napovedi.

## 1. Ključno spoznanje

Google ve, kakšen je promet na vsaki ulici, ker ima položaje milijonov
telefonov. **Odprtega vira z enakim pokritjem za vse ceste v SI in DE ni.**
Odprti državni viri pokrivajo avtoceste in del državnih cest; mestne in lokalne
ceste skoraj nihče ne objavlja.

Zasnova (glej poglavje 0):

> **odprti državni viri** (merjeno, kjer obstajajo) + **GPS vožnje obrtnikov, ki
> so to dovolili** (merjeno na vseh cestah, kjer vozijo) + **deterministični
> osnovni model** iz OpenStreetMap za ostalo + odprtokodni usmerjevalnik.

Strošek ostane fiksen (en računalnik oziroma strežnik), ne glede na število
obrtnikov. Natančnost na mestnih cestah bo nižja kot pri Googlu; pilot pove,
ali je dovolj dobra za priporočilo odhoda z rezervo.

## 2. O »scraperju«

| Kaj | Dovoljeno? | Ocena |
|---|---|---|
| Javni državni viri (DARS/promet.si, Autobahn GmbH, Mobilithek, NAP) | Da — namenjeni ponovni uporabi | Že deluje (`promet-zbiralnik`), to *je* naš zakoniti scraper |
| Občinski/deželni odprti podatki (npr. nekatera nemška mesta, BayernInfo) | Da, kjer licenca to dovoljuje | Dodajamo vir za virom, kjer obrtniki dejansko vozijo |
| Strganje Google Maps, Waze, TomTom, Apple zemljevidov | **Ne** — prepovedano po pogojih uporabe | Blokade, pravno tveganje za podjetje, nezanesljivo, ne skalira. Ne priporočam. |

## 3. Hipoteze (preverljive)

- **H1 — ponovljivost.** Večina zamud, ki jih obrtnik čuti, so *ponavljajoči se*
  zastoji (jutranja/popoldanska konica na istih vpadnicah, obvoznicah, križiščih),
  ki jih je mogoče napovedati iz zgodovine po tipu dneva in uri. Nepredvidljive
  nesreče se dan prej ne dajo napovedati nikomur (tudi Googlu ne), zato jih
  pokrijemo z jutranjim ponovnim preverjanjem aktualnih dogodkov.
- **H2 — dovolj podatkov iz privoljenih voženj.** Obrtniki vozijo pretežno po
  svoji regiji. Že nekaj obrtnikov s privolitvijo v nekaj tednih prevozi ključne
  koridorje dovolj pogosto za profil po uri; pilot izmeri, koliko privolitev je
  potrebnih za posamezno območje.
- **H3 — osnovni model za ostalo.** Za ceste brez meritev zadošča
  deterministični model: razred ceste iz OSM (avtocesta / glavna / lokalna) ×
  mesto ali podeželje × ura × tip dneva, umerjen s časi voženj (če so na voljo).
- **H4 — cilj natančnosti.** S priporočenim odhodom (p85 + fiksna rezerva)
  prispe pravočasno ≥ 90 % obrtnikov, ob povprečni »odvečni« rezervi ≤ 15 min.

Vsaka hipoteza ima v pilotu merilo; če ne zdrži, se smer spremeni pred gradnjo.

## 4. Kako bi točno delovalo

```
Obrtnik nastavi približno izhodišče ──┐
Delovni nalog: naslov stranke + ura ──┼─► naslov → koordinate (OSM Nominatim, predpomnjeno)
                                      ▼
            usmerjevalnik nad OSM (OSRM zdaj, Valhalla pozneje) → pot + čas brez prometa
                                      │
  odprti državni viri (DARS, Autobahn, │  zbiralnik vsakih 15 min → profil zastojev
  Mobilithek, NAP števci) ────────────┤  (merjeno, kjer viri obstajajo)
                                      │
  osnovni model OSM (vrsta ceste ×    ├─► za odseke brez meritev
  mesto/podeželje × ura × tip dneva)  │
                                      │
  GPS vožnje (samo s privolitvijo) ───┤─► Traccar → Valhalla map matching → hitrosti po odsekih
  neobvezno: časi Odhajam/Na lokaciji ┘─► umerjanje osnovnega modela po območju in uri
                                      ▼
        priporočen odhod = prihod − (čas + p85 zamuda + zapore) − rezerva
        dan prej 18:00 napoved · zjutraj 05:30 preverba novih zapor
```

| Del | Orodje | Licenca / cena |
|---|---|---|
| Zemljevid, iskanje naslovov | OpenStreetMap, Nominatim | ODbL, brezplačno |
| Pot in čas brez prometa | OSRM (pozneje Valhalla) | BSD / MIT |
| Zastoji, dela, zapore | DARS, Autobahn GmbH, Mobilithek, NAP | javni podatki |
| Prazniki, počitnice | OpenHolidays | brezplačno |
| Zajem GPS (samo s privolitvijo) | Traccar Client ali Traccar SDK v naši aplikaciji; deluje tudi v ozadju na iOS | Apache 2.0 |
| Sprejem GPS | Traccar server | Apache 2.0 |
| GPS točke → odseki cest | Valhalla (Meili map matching) | MIT |
| Pravila odhoda, profil, model | naša koda (deloma že narejena) | — |

### Deterministična pravila (isti vhod → isti izhod)

1. Odsek z meritvami iz javnih virov (≥ 8 zajemov v tem tipu dneva in intervalu)
   → p85 zamuda iz meritev.
2. Sicer odsek z GPS meritvami (≥ 8 voženj s privolitvijo v tem tipu dneva in
   uri) → p85 zamuda iz voženj.
3. Sicer osnovni model (faktor konice po vrsti ceste in okolju), umerjen s časi
   voženj, kjer jih je dovolj (≥ 8 na območje in uro).
4. + znane zapore/dela na poti, + fiksna rezerva, zaokroženo navzdol na 5 min.

Na vsakem odseku se uporabi največja izmed razpoložljivih izmerjenih zamud
(previdnejša), da se viri ne podvajajo.

## 5. Obseg in strošek

| Obrtnikov s privolitvijo | Voženj/dan (≈3 na obrtnika) | GPS točk/mesec (1 / 5 s, 25 min) | Strošek |
|---|---|---|---|
| 10 | 30 | ~0,3 mio | 0 € (domač računalnik) |
| 50 | 150 | ~1,4 mio | 0–20 €/mes (en strežnik) |
| 100 | 300 | ~2,7 mio | 0–20 €/mes (isti strežnik) |

To so majhne količine. Ni stroška na klic ali na obrtnika. Omejitev je
gostota voženj na odsek in uro, zato hierarhija pravil zgoraj.

## 6. Pravna plat

- **Obrtnik sam (samostojni podjetnik):** njegova izrecna privolitev za
  beleženje lastnih voženj zadošča; mora jo lahko kadarkoli preklicati.
- **Zaposleni obrtnika:** privolitev zaposlenega delodajalcu po GDPR pogosto ni
  »prostovoljna«, zato zgolj klik »dovolim« morda ni dovolj. Geolokacija
  zaposlenih je na seznamih obdelav, kjer je potrebna **ocena učinka (DPIA)**;
  v Nemčiji ima pri tem **soodločanje Betriebsrat** (§87(1)6 BetrVG). Pred
  vklopom za zaposlene je potreben posvet s pravnikom za varstvo podatkov.
- Zasnova za zmanjšanje tveganja v vsakem primeru: beleženje samo med vožnjo
  na nalog (začetek/konec), jasen prikaz, kdaj se beleži, za profil le
  **anonimne hitrosti po odsekih**, surove sledi se izbrišejo po 30 dneh,
  nikoli ocenjevanje posameznika.

## 7. Preverba (pilot) — preden karkoli gradimo naprej

Trajanje 4–6 tednov, strošek 0 €, vse na tvojem računalniku.

1. **Javni viri:** zbiralnik (že narejen) teče vsakih 15 min → izmerimo, koliko
   in kje so zastoji, ki jih javni viri vidijo.
2. **Resnične vožnje:** ti in nekaj obrtnikov, ki privolijo, namestite Traccar
   Client (brezplačen); Traccar server teče v Dockerju na tvojem računalniku.
   Kdor GPS ne želi, zapiše le čas odhoda in prihoda. Cilj: ~50–100 voženj,
   različne ure in kraji.
3. **Primerjava:** za vsako vožnjo izračunamo napoved (čas brez prometa +
   osnovni model + javni viri) in jo primerjamo z dejanskim trajanjem.
4. **Merila odločitve:**
   - H4: delež pravočasnih prihodov s priporočenim odhodom ≥ 90 %, povprečna
     odvečna rezerva ≤ 15 min.
   - Ločeno za avtoceste, mesta in podeželje — da vidimo, kje model ne zadošča.
5. **Odločitev:**
   - Model dosega cilj → gradimo aplikacijo za naloge in obvestila.
   - Osnovni model ne dosega cilja v mestih, GPS vožnje pa ga → gradimo cevovod
     Traccar → Valhalla → profil in spodbujamo privolitve.
   - Ne doseže ga nobeno → povečamo rezervo v mestih in ponovno ocenimo.
   - Tudi to ne zadošča → ponovno razmislimo, preden kdorkoli plača karkoli.

## 8. Kaj od že narejenega ostane

- **Ostane:** zbiralnik javnih virov (DARS, Autobahn), tip dneva in prazniki,
  deterministična pravila odhoda, lokalni način na računalniku — to je sloj
  »javni viri« in »pravila« iz te zasnove.
- **Ostane tudi:** iskanje naslovov (Nominatim) in lokalni API za napoved iz
  naslova in ure.
- **Morda pozneje:** OSRM → Valhalla (časovno odvisno usmerjanje z vgrajenimi
  zgodovinskimi hitrostmi), če umerjanje pokaže, da je to potrebno.
- **Novo v 2. fazi:** Traccar (samo s privolitvijo) → Valhalla map matching.
- **Zavrženo:** integracija TomTom (ni bila commitana).
