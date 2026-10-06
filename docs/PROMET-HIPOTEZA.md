# Promet za obrtnike — hipoteza in načrt preverbe (pred gradnjo)

Stanje: **analiza, ne implementacija.** Cilj je sistem, ki pove, koliko zamude
je običajno na *katerikoli* poti (ne le na avtocesti) ob določenem dnevu in uri,
deluje za 10 → 100+ obrtnikov v SI in DE, in **nikoli ne postane plačljiv na
klic**. Komercialni API-ji (Google, TomTom, HERE) so zavrnjeni: brezplačni
paketi so omejeni, pri rasti postanejo strošek na uporabnika, pogoji se lahko
spremenijo.

## 0. Odločitev uporabnika (6. 10. 2026): brez sledenja GPS

Obrtnikov **ne spremljamo z GPS**. Beležimo samo delovne naloge (naslov
stranke, ura prihoda) in **prednastavljeno približno izhodišče**, ki ga obrtnik
nastavi sam (npr. delavnica ali kraj). Posledice za zasnovo:

- Sloj »lastne vožnje iz GPS« (Traccar → map matching) **odpade**. Poglavja 1, 4,
  6 in 7 spodaj so zato posodobljena; prvotna različica je v zgodovini gita.
- Približno izhodišče zadošča: promet ocenjujemo po ~2 km celicah, zato nekaj
  sto metrov odstopanja ne spremeni rezultata.
- Pravno je bistveno lažje: ni sledenja zaposlenih, ni DPIA za geolokacijo,
  ni soodločanja Betriebsrata zaradi naprave za nadzor.
- Cena: za **mestne in lokalne ceste nimamo merjenih podatkov**. Tam velja
  deterministični osnovni model (vrsta ceste iz OSM × mesto/podeželje × ura ×
  tip dneva). Koliko je natančen, mora pokazati pilot — tega ne predpostavljamo.

Neobvezna dopolnitev brez GPS (predlog, ni odločeno): na nalogu dva gumba
**»Odhajam«** in **»Na lokaciji«**, ki shranita le *čas* (ne položaja). Iz
razlike dobimo dejansko trajanje poti izhodišče → stranka, kar umerja osnovni
model po območju, uri in tipu dneva, ter meri, ali napovedi držijo.

## 1. Ključno spoznanje

Google ve, kakšen je promet na vsaki ulici, ker ima položaje milijonov
telefonov. **Odprtega vira z enakim pokritjem za vse ceste v SI in DE ni.**
Odprti državni viri pokrivajo avtoceste in del državnih cest; mestne in lokalne
ceste skoraj nihče ne objavlja.

Brez lastnih GPS podatkov (glej poglavje 0) je zasnova:

> **odprti državni viri** (merjeno, kjer obstajajo) + **deterministični osnovni
> model** iz OpenStreetMap za ostale ceste + **neobvezni časi »Odhajam / Na
> lokaciji«** za umerjanje + odprtokodni usmerjevalnik.

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
- **H2 — (opuščena: GPS podatkov flote ne zbiramo).** Nadomesti jo: če obrtniki
  pritiskajo »Odhajam / Na lokaciji«, se v nekaj tednih nabere dovolj voženj na
  območje in uro za umerjanje osnovnega modela.
- **H3 — osnovni model za ostalo.** Za ceste brez meritev zadošča
  deterministični model: razred ceste iz OSM (avtocesta / glavna / lokalna) ×
  mesto ali podeželje × ura × tip dneva, umerjen s časi voženj (če so na voljo).
- **H4 — cilj natančnosti.** S priporočenim odhodom (p85 + fiksna rezerva)
  prispe pravočasno ≥ 90 % obrtnikov, ob povprečni »odvečni« rezervi ≤ 15 min.

Vsaka hipoteza ima v pilotu merilo; če ne zdrži, se smer spremeni pred gradnjo.

## 4. Kako bi točno delovalo (brez GPS)

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
| Pravila odhoda, profil, model | naša koda (deloma že narejena) | — |

### Deterministična pravila (isti vhod → isti izhod)

1. Odsek z meritvami iz javnih virov (≥ 8 zajemov v tem tipu dneva in intervalu)
   → p85 zamuda iz meritev.
2. Sicer osnovni model (faktor konice po vrsti ceste in okolju), umerjen s časi
   voženj, kjer jih je dovolj (≥ 8 na območje in uro).
3. + znane zapore/dela na poti, + fiksna rezerva, zaokroženo navzdol na 5 min.

## 5. Obseg in strošek

Brez GPS sledi so podatki zanemarljivi: en nalog je nekaj vrstic, zbiralnik
javnih virov nekaj sto MB na 56 dni. Pri 10, 50 ali 100 obrtnikih: 0 € na
domačem računalniku oziroma fiksnih 0–20 €/mes za en strežnik. Ni stroška na
klic ali na obrtnika.

## 6. Pravna plat

Ker ne sledimo lokaciji zaposlenih, odpadejo DPIA za geolokacijo in
soodločanje Betriebsrata zaradi nadzorne naprave. Ostane običajna obravnava
podatkov nalogov (naslovi strank) po GDPR. Časi »Odhajam / Na lokaciji«
(če jih uvedemo) so podatki o delovnem času — o tem obvestiti zaposlene;
za umerjanje se uporabljajo samo združeno po območju in uri, nikoli za
ocenjevanje posameznika.

## 7. Preverba (pilot) — preden karkoli gradimo naprej

Trajanje 4–6 tednov, strošek 0 €, vse na tvojem računalniku.

1. **Javni viri:** zbiralnik (že narejen) teče vsakih 15 min → izmerimo, koliko
   in kje so zastoji, ki jih javni viri vidijo.
2. **Resnične vožnje brez GPS:** ti (in po želji nekaj obrtnikov) za vsako
   vožnjo na nalog zapišete le izhodišče, naslov, čas odhoda in čas prihoda
   (lahko v preprosto tabelo). Cilj: ~50–100 voženj, različne ure in kraji.
3. **Primerjava:** za vsako vožnjo izračunamo napoved (čas brez prometa +
   osnovni model + javni viri) in jo primerjamo z dejanskim trajanjem.
4. **Merila odločitve:**
   - H4: delež pravočasnih prihodov s priporočenim odhodom ≥ 90 %, povprečna
     odvečna rezerva ≤ 15 min.
   - Ločeno za avtoceste, mesta in podeželje — da vidimo, kje model ne zadošča.
5. **Odločitev:**
   - Model dosega cilj → gradimo aplikacijo za naloge in obvestila.
   - Model ne dosega cilja v mestih → uvedemo gumba »Odhajam / Na lokaciji« za
     sprotno umerjanje in/ali povečamo rezervo v mestih.
   - Tudi to ne zadošča → ponovno razmislimo, preden kdorkoli plača karkoli.

## 8. Kaj od že narejenega ostane

- **Ostane:** zbiralnik javnih virov (DARS, Autobahn), tip dneva in prazniki,
  deterministična pravila odhoda, lokalni način na računalniku — to je sloj
  »javni viri« in »pravila« iz te zasnove.
- **Ostane tudi:** iskanje naslovov (Nominatim) in lokalni API za napoved iz
  naslova in ure.
- **Morda pozneje:** OSRM → Valhalla (časovno odvisno usmerjanje z vgrajenimi
  zgodovinskimi hitrostmi), če umerjanje pokaže, da je to potrebno.
- **Odpade:** Traccar / GPS sledenje (odločitev v poglavju 0).
- **Zavrženo:** integracija TomTom (ni bila commitana).
