# Promet za obrtnike — hipoteza in načrt preverbe (pred gradnjo)

Stanje: **analiza, ne implementacija.** Cilj je sistem, ki pove, koliko zamude
je običajno na *katerikoli* poti (ne le na avtocesti) ob določenem dnevu in uri,
deluje za 10 → 100+ obrtnikov v SI in DE, in **nikoli ne postane plačljiv na
klic**. Komercialni API-ji (Google, TomTom, HERE) so zavrnjeni: brezplačni
paketi so omejeni, pri rasti postanejo strošek na uporabnika, pogoji se lahko
spremenijo.

## 1. Ključno spoznanje

Google ve, kakšen je promet na vsaki ulici, ker ima položaje milijonov
telefonov. **Odprtega vira z enakim pokritjem za vse ceste v SI in DE ni.**
Odprti državni viri pokrivajo avtoceste in del državnih cest; mestne in lokalne
ceste skoraj nihče ne objavlja.

Edina pot do »Googla na naši bazi« brez stroška na klic je zato:

> **lastni podatki o vožnjah naših obrtnikov** (floating car data)
> + odprti državni viri + OpenStreetMap + odprtokodni usmerjevalnik.

To se z rastjo *izboljšuje*, ne draži: več obrtnikov = več prevoženih poti =
natančnejši profil, strošek pa ostane fiksen (en strežnik).

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
- **H2 — dovolj podatkov iz flote.** Obrtniki vozijo pretežno po omejenem
  območju (svoja regija). Že 10–20 obrtnikov v nekaj tednih prevozi ključne
  koridorje dovolj pogosto za zanesljiv profil po uri.
- **H3 — osnovni model za ostalo.** Za ceste brez podatkov zadošča
  deterministični model: razred ceste iz OSM (avtocesta / glavna / lokalna) ×
  mesto ali podeželje × ura × tip dneva, *kalibriran iz lastnih voženj*.
- **H4 — cilj natančnosti.** S priporočenim odhodom (p85 + fiksna rezerva)
  prispe pravočasno ≥ 90 % obrtnikov, ob povprečni »odvečni« rezervi ≤ 15 min.

Vsaka hipoteza ima v pilotu merilo; če ne zdrži, se smer spremeni pred gradnjo.

## 4. Kako bi točno delovalo

```
Telefon obrtnika ──(Traccar Client, odprtokodno, tudi v ozadju na iOS)──► lasten Traccar strežnik
                                                                              │ samo vožnje na naloge
                                                                              ▼
                       Valhalla map matching (Meili): GPS točke → odseki OSM ceste + dejanska hitrost
                                                                              │
Odprti državni viri (DARS, Autobahn, Mobilithek, NAP števci) ────────────────┤
                                                                              ▼
            Profil hitrosti po odseku × tip dneva × ura (mediana, p85), hierarhično dopolnjen
                                                                              │
                                                                              ▼
       Valhalla »arrive_by« s časovno odvisnimi hitrostmi → trajanje → priporočen odhod
                                                                              │
                  dan prej 18:00 napoved  ·  zjutraj 05:30 preverba novih zapor/nesreč
```

Sestavni deli (vsi odprtokodni, brez stroška na klic):

| Del | Orodje | Licenca |
|---|---|---|
| Zemljevid | OpenStreetMap (Geofabrik izvlečki SI + DE) | ODbL |
| Zajem GPS | Traccar Client (iOS/Android, deluje v ozadju) ali Traccar SDK v naši aplikaciji | Apache 2.0 |
| Sprejem GPS | Traccar server | Apache 2.0 |
| Ujemanje GPS s cesto + usmerjanje z zgodovinskim prometom | Valhalla (Meili + »historical traffic«: profil hitrosti za cel teden v 5-min intervalih na odsek) | MIT |
| Javni viri, profil, pravila odhoda | naša koda (že delno narejena) | — |

Zakaj Valhalla namesto OSRM: Valhalla zna sama oboje, kar potrebujemo —
ujemanje GPS sledi s cestami in usmerjanje z vgrajenimi zgodovinskimi
hitrostmi po odsekih (`valhalla_add_predicted_traffic`). OSRM tega nima.

### Deterministična pravila (isti vhod → isti izhod)

1. Odsek z ≥ N vzorci v (tip dneva, ura) → njegova p85 hitrost.
2. Sicer: isti razred ceste v istem območju (npr. 5 km) in isti uri → p85.
3. Sicer: osnovni model H3.
4. + znane zapore/dela na poti, + fiksna rezerva, zaokroženo navzdol na 5 min.

Tip dneva: delavnik, petek, sobota, nedelja/praznik, šolske počitnice
(OpenHolidays, brezplačno).

## 5. Koliko podatkov to je (ocena)

| Obrtnikov | Voženj/dan (≈3 na obrtnika) | GPS točk/mesec (1 točka / 5 s, 25 min) | Strošek |
|---|---|---|---|
| 10 | 30 | ~0,3 mio | 0 € (domač računalnik) |
| 50 | 150 | ~1,4 mio | 0–20 €/mes (1 strežnik) |
| 100 | 300 | ~2,7 mio | 0–20 €/mes (isti strežnik) |

To so majhne količine; omejitev ni strežnik, ampak **gostota vzorcev po uri na
odsek** — zato hierarhija v pravilih zgoraj in urni (ne 15-min) intervali za
lastne podatke.

## 6. Pravna plat (pomembno, posebej DE)

- Položaj zaposlenega je osebni podatek (GDPR). Geolokacija zaposlenih je na
  seznamih obdelav, kjer je potrebna **ocena učinka (DPIA)**.
- V Nemčiji ima **Betriebsrat soodločanje** pri napravah, ki lahko nadzorujejo
  zaposlene (§87(1)6 BetrVG) — običajno z Betriebsvereinbarung.
- Zasnova za zmanjšanje tveganja: beleženje **samo med vožnjo na nalog**
  (začetek/konec), za profil se hranijo le **anonimne hitrosti po odsekih**,
  surove sledi se izbrišejo po npr. 30 dneh, nikoli ocenjevanje posameznika.
  Pred pilotom: pisna privolitev udeležencev.

## 7. Preverba (pilot) — preden karkoli gradimo naprej

Trajanje 4–6 tednov, strošek 0 €, vse na tvojem računalniku.

1. **Javni viri:** zbiralnik (že narejen) teče vsakih 15 min → izmerimo, koliko
   in kje so zastoji, ki jih javni viri sploh vidijo.
2. **Lastne vožnje:** 3–5 obrtnikov (lahko tudi ti) namesti Traccar Client;
   Traccar server teče v Dockerju na tvojem računalniku. Nič novega ne razvijamo.
3. **Primerjava:** za vsako dejansko vožnjo na nalog zabeležimo
   (a) čas brez prometa (OSM usmerjevalnik), (b) napoved osnovnega modela,
   (c) dejansko trajanje.
4. **Merila odločitve:**
   - H4: delež pravočasnih prihodov s priporočenim odhodom ≥ 90 %, povprečna
     odvečna rezerva ≤ 15 min.
   - H2: po koliko tednih imajo najpogostejši koridorji ≥ 8 vzorcev na uro.
   - H1: delež zamude, ki se ponavlja (isti odsek, ista ura, različni dnevi).
5. **Odločitev:**
   - Če osnovni model + javni viri že dosežejo H4 → gradimo samo aplikacijo
     za naloge in obvestila (najmanj dela).
   - Če ne → gradimo cevovod lastnih voženj (Traccar → Valhalla → profil).
   - Če tudi to po pilotu ne zadošča → ponovno razmislimo, preden kdorkoli
     plača karkoli.

## 8. Kaj od že narejenega ostane

- **Ostane:** zbiralnik javnih virov (DARS, Autobahn), tip dneva in prazniki,
  deterministična pravila odhoda, lokalni način na računalniku — to je sloj
  »javni viri« in »pravila« iz te zasnove.
- **Zamenja se v 2. fazi:** OSRM → Valhalla (zaradi map matchinga in
  zgodovinskih hitrosti).
- **Zavrženo:** integracija TomTom (ni bila commitana).
