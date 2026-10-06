# Promet za obrtnike — temeljita preverba možnosti (SI + DE)

Datum: 7. 10. 2026. Štiri neodvisne raziskave (odprti podatki SI/DE, scraperji,
vreme, kako drugi gradijo napoved časa vožnje). Veliko strani je bilo iz
raziskovalnega okolja blokiranih (nap.si, promet.si, mobilithek.info, google.com …),
zato so mnoge trditve iz povzetkov iskalnika — pred gradnjo jih je treba potrditi
na živem portalu. Oznake: **[P]** preverjeno v viru, **[S]** iz povzetka iskanja,
**[O]** ocena/sklep.

## 1. Glavni sklep

1. **Brezplačnega odprtega vira, ki bi kot Google poznal promet na vsaki ulici v
   SI in DE, ni.** Odprti podatki so dobri na avtocestah, delni na glavnih cestah
   nekaterih nemških dežel in mest, za mestne ulice v Sloveniji (tudi Ljubljana)
   jih skoraj ni. [S]
2. **Scraping Googla/Wazea ni rešitev:** prepovedan po pogojih, tehnično vse bolj
   blokiran, pravno tvegan v EU, in dražji od uradnih brezplačnih kvot. [S]
3. **Kar dejansko naredi napoved točno** (izkušnje Uber, Google, DoorDash, raziskave):
   1. lastni dejanski časi voženj (napoved proti dejanskemu prihodu) → popravek
      modela — največji posamezni skok točnosti;
   2. profili hitrosti po odsekih in urah v tednu (iz GPS voženj);
   3. znane zapore in dela;
   4. vreme.
   Za napoved za jutri promet »v živo« skoraj nič ne prinese — zastojev jutri se
   danes ne vidi. [S/O]

## 2. Scraperji (Google, Waze, TomTom …)

| Možnost | Tehnično | Pravno (komercialno) | Vzdržno |
|---|---|---|---|
| Google — strganje časov poti v brskalniku | kratko, s stanovanjskimi proxyji; po 20–50 zahtevah blokade, od 2025 »SearchGuard« | ne: Maps Platform Terms §3.2.3 »No Scraping«; Google je dec. 2025 tožil SerpApi | ne |
| Google — barvanje prometnih ploščic | da, a le stopnja gneče, ne čas | ne | ne |
| Waze »live-map/georss« | od marca 2026 za reCAPTCHA (HTTP 403) | ne | ne |
| Waze for Cities | samo za javne organe/upravljavce cest | — | — |
| TomTom/HERE/Bing strganje | nesmiselno (uradna brezplačna kvota obstaja) | ne | ne |

Pravo: BGH (Ryanair, 2014) dopušča strganje prosto dostopnih strani, ne pa
obhajanja zaščit (CAPTCHA); SEU C-30/14 (pogodbene prepovedi veljajo), C-762/19
CV-Online (pravica sui generis baze podatkov). [S]
Strošek strganja v našem obsegu (~500 poti/dan): ~250–600 $/mes za proxyje +
vzdrževanje. [O] — dražje od uradnih kvot.

Viri: [Google Maps Terms povzetek](https://conductatlas.com/platform/google-maps/google-maps-platform-terms-of-service/no-scraping-or-content-extraction/),
[Google proti SerpApi](https://proxyway.com/news/google-sues-serpapi),
[Waze georss blokada](https://github.com/guberm/waze-alerts-monitor/issues/1),
[Waze for Cities](https://waze.com/ccp),
[BGH Ryanair](https://www.lto.de/recht/hintergruende/h/bgh-urteil-izr22412-screen-scraping-flugdaten-automatisiert-auslesen-ryanair-reiseportal),
[SEU Ryanair](https://www.pinsentmasons.com/out-law/news/website-operators-can-prohibit-screen-scraping-of-unprotected-data-via-terms-and-conditions-says-eu-court-in-ryanair-case),
[SEU CV-Online](https://www.scl.org/12290-cjeu-search-engine-copying-of-databases-infringes-sui-generis-right-where-it-adversely-affects-database-maker-investment/).

### Uradne brezplačne kvote (za odločitev, ni priporočilo za ali proti)

- **TomTom Freemium:** 2.500 klicev/dan, komercialna raba dovoljena, brez kartice;
  upošteva zgodovinske hitrosti na vseh cestah. 100 obrtnikov × 5 poti = 500/dan →
  0 €. Postane plačljivo šele pri ~500 obrtnikih ali če se pogoji spremenijo. [S]
  ([cenik](https://developer.tomtom.com/pricing))
- **Google Routes (Pro):** 5.000 brezplačnih na mesec, nato plačljivo; pri 500/dan
  ~60 $/mes. [S/O]
- Če se uporabi, samo s trdo dnevno omejitvijo v kodi in kot dodaten vir, ne kot
  edini.

## 3. Odprti podatki

### Slovenija
| Vir | Kaj | Dostop |
|---|---|---|
| NAP »Potovalni časi AC« | merjeni časi vožnje po odsekih **avtocest**, DATEX II v3.3 | registracija na nap.si [S] |
| NAP / promet.si »Števci prometa« (DARS + DRSI) | hitrost, razmik, zasedenost po pasovih, avtoceste in del državnih cest | verjetno registracija [S] |
| promet.si B2B dogodki | zapore, nesreče, dela; brezplačne različice **brez koordinat**, različice s koordinatami (npr. `b2b.dogodki.geojson`) zahtevajo registracijo/pogodbo | [B2B_full.pdf](https://promet.si/portal/res/doc/B2B_full.pdf) [S] |
| DRSI »Štetje prometa« | letni/urni pretoki na državnih cestah (količine, ne hitrosti) | odprto (OPSI) [S] |
| DARS cestne vremenske postaje | vidnost, temperatura, padavine, stanje vozišča (DATEX II) | nap.si [S] |
| Ljubljana (mesto) | odprtega vira hitrosti/stanja prometa po ulicah nismo našli | — [O] |

To pojasni, zakaj naš zemljevid kaže »ni podatkov« za DARS: viri s
koordinatami zahtevajo registracijo. **Potreben korak: registracija na nap.si.**

### Nemčija
| Vir | Kaj | Dostop |
|---|---|---|
| **BayernInfo** | stanje prometa iz FCD na ~55.000 km cest (tudi zvezne, deželne, mestne vpadnice), vsake 3 min — najboljši regionalni vir | Mobilithek, brezplačno [S] |
| Autobahn GmbH detektorji | hitrost/pretok po pasovih vsako minuto | Mobilithek, potrebna odobritev [S] |
| autobahn.api.bund.dev | dela, opozorila (zastoji), zapore — brez hitrosti | prosto [S] |
| Hamburg »Verkehrslage« | stanje prometa na glavnih cestah vsakih 5 min (WFS) | DL-DE BY 2.0 [S] |
| Berlin VIZ | detektorji (pretok, hitrost) | odprto [S] |
| Köln | stanje po odsekih glavnih cest (0/1/2) vsakih 5–10 min | CC BY 3.0 [S] |
| BASt | urni pretoki od 1975 (brez hitrosti) | delno prosto [S] |

Seznam virov: [graphhopper/open-traffic-collection](https://github.com/graphhopper/open-traffic-collection),
[BayernInfo](https://www.bayerninfo.de/en/about-bayerninfo-1/data-offer/private-transport-data),
[NAP SI](https://www.nap.si/sl/dataset_list).

## 4. Vreme

| Vir | Kaj | Pogoji |
|---|---|---|
| **DWD Open Data (DE)** | radarski nowcast RADVOR (2 h, 5 min), ICON-D2 (2 km, 48 h), cestno-vremenska napoved SWSMOS (1.700 postaj, temperatura vozišča) | brezplačno, CC BY 4.0 [S] |
| **ARSO (SI)** | meritve postaj, napovedi ALADIN-SI, INCA nowcast | CC BY 4.0 (OPSI) [S] |
| Open-Meteo | en API za vse modele (ICON-D2, AROME …) | **brezplačno samo nekomercialno**; komercialno od ~29 $/mes ali lastna namestitev (odprta koda) [S] |
| MET Norway | rezerva | brezplačno, CC BY 4.0 [S] |

Izmerjeni vplivi (izbor): HCM — srednji dež −7 % kapacitete, močan −14 %;
avtoceste v dežju −2 do −7 % hitrosti, močan sneg −11 do −15 %; Nemčija (FCD na
1,5 mio odsekih) — pri nalivu >8 mm/5 min na avtocestah 130 km/h več kot −30 %
hitrosti, vključitev padavin zmanjša napako do 50 % v močnem dežju; London
(mesto) — čas vožnje +0,1–6 % v dežju, +5–11 % v snegu. Dež na prometnih
odsekih v konici zlasti poveča verjetnost zastoja. [S]
([Future Transp. 2026](https://doi.org/10.3390/futuretransp6010038),
[FHWA](https://ops.fhwa.dot.gov/publications/weatherempirical/sect7.htm),
[UCL London](https://discovery-pp.ucl.ac.uk/1380395/2/1380395.pdf),
[Calvert/Snelder NL](https://www.researchgate.net/publication/283111445_The_influence_of_adverse_weather_conditions_on_probability_of_congestion_on_Dutch_motorways))

Začetni faktorji časa vožnje (dokler ni lastnih podatkov) [O, iz zgornjih virov]:

| Pogoji | Mesto | Regionalno | AC izven konice | AC v konici |
|---|---|---|---|---|
| Rahel dež (0,1–2,5 mm/h) | 1,02 | 1,03 | 1,04 | 1,08 |
| Zmeren dež (2,5–7,5) | 1,04 | 1,06 | 1,08 | 1,15 |
| Močan dež (>7,5) | 1,06 | 1,12 | 1,20 | 1,30 |
| Rahel sneg | 1,08 | 1,12 | 1,12 | 1,25 |
| Močan sneg / poledica | 1,15 | 1,30 | 1,25 | 1,45 |
| Megla <200 m | 1,03 | 1,10 | 1,10 | 1,12 |

Ključno: **vreme shranjevati ob vsakem zajemu/vožnji od prvega dne**, da se
faktorji pozneje izračunajo iz lastnih podatkov.

## 5. Kako to delajo drugi (napoved časa vožnje)

| Raven | Podatki | Tipična napaka |
|---|---|---|
| L0 | OSM + privzete hitrosti (OSRM/Valhalla) | mediana ~16–20 %, v mestnih konicah podcenjuje [S] |
| L1 | L0 + popravek, naučen na **lastnih dejanskih časih voženj** | RMSE −40 % za avto (raziskava); Uber DeepETA dela enako (usmerjevalnik + ML popravek) [S] |
| L2 | profili hitrosti po odsekih × ura v tednu iz GPS | jedro Googla [S] |
| L3 | živi podatki + nevronske mreže | Google/DeepMind −50 % netočnih ETA; za »jutri« malo koristi [S] |

Pričakovana točnost [O]: brez lastnih podatkov ~15–20 %; s popravkom po ~300–500
vožnjah ~12–15 %; z lastnimi GPS vožnjami ~8–12 %. Napoved naj bo **P90**
(prihod pravočasno v 90 % dni), ne povprečje.

Potrebni podatki [O]: 300–500 voženj za splošni popravek; 2.000–5.000 za model po
urah in območjih; 20.000+ (≈20 vozil 6–12 mesecev) za profile posameznih mestnih
vpadnic.

Orodja: **Valhalla** (MIT, zelo aktiven; edini odprtokodni usmerjevalnik z
vgrajenimi profili po 5 min za cel teden, »arrive by«, map matching),
OSRM (en nabor hitrosti naenkrat), Traccar (GPS, odprta koda), LightGBM/XGBoost
(kvantilni popravek). [S]
([Uber DeepETA](https://www.uber.com/en-CA/blog/deepeta-how-uber-predicts-arrival-times/),
[Valhalla](https://github.com/valhalla/valhalla),
[Valhalla historični promet](https://valhalla.github.io/valhalla/mjolnir/historical_traffic/))

## 6. Predlagana arhitektura (vse odprto, brez stroška na klic)

```
Valhalla (OSM SI+DE, lasten strežnik)  ──► pot + čas ob uri (arrive_by)
   ▲ profili hitrosti po odsekih × ura v tednu (tedensko)
   │
   ├─ lastne GPS vožnje (Traccar, samo s privolitvijo) → map matching
   ├─ NAP SI: potovalni časi AC + števci (registracija)
   ├─ DE: BayernInfo / Autobahn detektorji / mestni viri
   └─ arhiv vsakih 15 min (že narejen zbiralnik, Supabase pg_cron)
        │
popravek iz dejanskih prihodov (napoved ↔ »Na lokaciji«) → P90
        + vreme (DWD/ARSO: radar nowcast, ICON-D2, cestno vreme)
        + zapore/dela (DATEX II) kot kazen
        ▼
priporočen odhod = začetek naloga − P90 čas − rezerva za parkiranje
```

### Faze (največji učinek najprej)
1. **Takoj:** beleženje dejanskega odhoda/prihoda pri vsakem nalogu (gumb »Na
   lokaciji«, GPS samo s privolitvijo) + shranjevanje vremena. Brez tega se
   napoved nikoli ne izboljša in je ni mogoče preveriti.
2. **Registracija NAP (SI)** in Mobilithek (DE) → potovalni časi in števci.
3. **Valhalla** na lastnem strežniku namesto OSRM.
4. **Vreme:** DWD + ARSO (brezplačno) z začetnimi faktorji zgoraj.
5. **Po ~300–500 vožnjah:** popravek po urah × območje (mesto/podeželje), P90.
6. **Po 6–12 mesecih GPS:** profili hitrosti po odsekih v Valhalli.

## 7. Odločitve, ki jih mora sprejeti naročnik

1. Registracija na nap.si (SI) in Mobilithek (DE) — na podjetje.
2. Ali dovolimo TomTom Freemium kot **dodaten** vir za mestne ulice (0 € do
   ~2.500 klicev/dan, trda omejitev v kodi), dokler lastnih podatkov ni dovolj —
   ali ne.
3. Strežnik za Valhallo (npr. Oracle Free Tier ali ~10–20 €/mes).
4. Gumb »Na lokaciji« in GPS s privolitvijo v aplikaciji obrtnika.
