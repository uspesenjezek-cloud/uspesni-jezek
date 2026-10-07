# Reddit — preverba (postopek A–J)

> **Umestitev:** Reddit **ni ločena stran**, ampak en kompakten modul na strani **Splet** (`splet-v3-hd.png`, modul »Reddit«). Modul je sestavljen iz dveh delov: oglas (videlo → kliknilo → povpraševanja + pas vrednosti) in vaši odgovori (4 številke). Slika `reddit-v1-hd.png` je zastarela.

Datum: 7. 10. 2026.

**Kaj je kanal Reddit:** oglasi na Redditu (Reddit Ads) in objave ter odgovori, ki jih v imenu obrtnika objavljamo **iz njegovega označenega poslovnega profila**. Tuje omembe obrtnika na Redditu so na strani **Splet** (`MARKETING-ANALITIKA-SPLET-PREVERBA.md`, razdelek K).

**Viri:** reddit.com, ads-api.reddit.com in business.reddithelp.com so iz omrežja blokirani. Polja so potrjena iz kode, ustvarjene iz uradne specifikacije OpenAPI v3 (Airbyte, metorial, Genei, soenneker, PostHog na GitHubu), in iz knjižnice PRAW. Ostalo je iz izsekov iskanja, nepotrjeno pa je označeno z **[preveri]**.

---

## 0. Bistvo

1. **Oglasi dajo vse, kar potrebujemo za pas vrednosti:** strošek, doseg, kliki, povpraševanja (`REDDIT_LEADS`, `CONVERSION_LEAD_CLICKS`), naročila z vrednostjo prek našega Conversions API in razčlenitev po skupnosti in regiji.
2. **Pri naših objavah kot avtor vidimo oglede, a samo v Reddit vmesniku (Post Insights, 45 dni). API zanje ni potrjen.** Prek API dobimo glasove, komentarje in sledilce. Oglede beremo iz Reddit Pro ali jih ne pokažemo [preveri `view_count` za lastne objave z odobrenim OAuth].
3. **Pravno:**
   - Objavljamo samo iz jasno označenega poslovnega profila in vedno razkrijemo, da piše obrtnik.
   - Pretvarjanje, da piše zasebnik, je **prepovedano** (UCPD Priloga I, točki 11 in 22; SI ZVPNPP).
   - Brez več računov in brez glasovanja za lastne objave.
4. **Samo statistika**, enak vzorec kot oglasi FB, IG in TikTok: strošek vedno ob vrednosti dela.

---

## A. Popoln popis

### A.1 Reddit Ads API v3 (`POST /api/v3/ad_accounts/{id}/reports`)

| Metrika | Polje | Odločitev |
|---|---|---|
| strošek | `SPEND` (milijoninke valute) | **pokažemo**, vedno ob vrednosti dela |
| doseg | `REACH` (od 6/2024), rezervno `IMPRESSIONS` | **pokažemo**: »oglas je videlo N ljudi« |
| prikazi | `IMPRESSIONS` | samo v ozadju |
| kliki | `CLICKS` | **pokažemo** |
| CTR, CPC, eCPM, pogostost | `CTR`, `CPC`, `ECPM`, `FREQUENCY` | **ne** (strokovno) |
| povpraševanja z obrazca | `REDDIT_LEADS` (samo število) | **pokažemo** |
| povpraševanja s strani | `CONVERSION_LEAD_CLICKS` (po kliku) | **pokažemo**, seštejemo z `REDDIT_LEADS`, vsako enkrat |
| pretvorbe po ogledu | `CONVERSION_*_VIEWS` | **ne** (preveč ohlapno) |
| naročila in vrednost | `CONVERSION_PURCHASE_CLICKS`, `CONVERSION_PURCHASE_TOTAL_VALUE` (stotine), ki ju pošljemo prek CAPI | **pokažemo** |
| video | `VIDEO_*` | **ne** (samo v ozadju) |
| glasovi in komentarji na oglasu | ni v poročilu | **ne** [preveri `GET /posts/{id}`] |

**Razčlenitve:** `DATE`, `CAMPAIGN_ID`/`AD_ID`, `COUNTRY`, `REGION`, `COMMUNITY`, `INTEREST`, `KEYWORD`, `PLACEMENT`, `OS_TYPE`. Omejitve:
- največ 3 razčlenitve na poročilo;
- `COMMUNITY` ali `REGION` posebej, ne skupaj.

**Dostop:**
- Razvijalska aplikacija v Ads Managerju (admin, preverjen račun). OAuth `adsread`, `adsconversions`.
- 60 poročil na minuto.
- Zgodovina 24 mesecev.
- **Podatki se ustalijo v ~6 urah, pretvorbe se popravljajo pozneje.** Zadnja 2 dni zato označimo z »se še posodablja«.
- Od 13. 7. 2026 je **Pixel obvezen** pri vsaki oglasni skupini.

**Lead obrazci:**
- V API je samo število leadov. Posamezne leade dobimo prek CSV ali Zapierja, Reddit jih po 90 dneh izbriše.
- Onsite obrazci so morda ukinjeni [preveri], zato povpraševanja štejemo predvsem prek Pixla ali CAPI na obrtnikovi strani.

**CAPI:**
- `POST /api/v3/pixels/{id}/conversion_events`, dogodek `PURCHASE` ali `CUSTOM` z `value` in `currency=EUR`.
- `action_source = OTHER` za naročilo, potrjeno v appu.
- Ujemanje prek `click_id` (rdt_cid), zgoščenega e-naslova in telefona.
- **EU:** samo po marketinškem soglasju, ker Reddit nima polja za soglasje v EGP.

**Trg:**
- EUR je podprt, minimalni proračun 5 USD na dan na oglasno skupino.
- Slovenija je pri Redditu »trg partnerja Aleph«. Samopostrežni dostop za SI podjetja [preveri].
- Ciljanje po mestu (Ljubljana, Domžale) [preveri `GET /targeting/geolocations`], slovenščina kot jezik [preveri].

### A.2 Naše objave in odgovori (organsko)

| Metrika | Kje | Odločitev |
|---|---|---|
| ogledi objave | Post Insights (UI, avtor, od 10 ogledov, 45 dni); API `view_count` [preveri] | **pokažemo, če ga dobimo** (Reddit Pro / API), sicer ne |
| ogledi komentarja | Insights pod komentarjem (UI, od 6/2025) | **pokažemo, če ga dobimo** |
| glasovi | `score` (rahlo zamegljen) | **pokažemo** kot »~N« |
| odgovori ljudi | `num_comments`, `replies` | **pokažemo** |
| deljenja | Post Insights (UI) | ne (ni API) |
| sledilci profila | Reddit Pro | **pokažemo** |
| karma | API | **ne** (ni »ugled«, napihljivo) |
| upvote_ratio | API | ne pri lastnih objavah (brez konteksta zavaja) |
| kliki na povezavo | Reddit Pro »Links« (preverjena domena, od 3/2026) | pokažemo, če je na voljo; sicer UTM |

**Reddit Pro:** brezplačen, a javnega API in izvoza nima, razpoložljivost v SI ni potrjena [preveri]. Do potrditve beremo ročno ali prikažemo samo podatke iz API.

### A.3 Česa ni mogoče izmeriti

- glasov in komentarjev pod oglasom (ni v poročilu);
- posameznih leadov prek API;
- ogledov lastnih objav prek API (nepotrjeno);
- obiskov z Reddita brez UTM: mobilna aplikacija izgubi referrer, zato vedno »najmanj N«.

---

## B. Kar izmerimo sami

| Kaj | Kako |
|---|---|
| povpraševanja z Reddita | Pixel / CAPI `LEAD` na obrazcu in klik na telefon + »Kako ste izvedeli za nas?« (možnost »Reddit«) |
| naročila in vrednost | evidenca → CAPI `PURCHASE` z vrednostjo; v appu iz evidence, ne iz Reddita |
| obiski | UTM `utm_source=reddit` na vseh povezavah (oglasi in objave) |
| odgovori na vprašanja | naša evidenca objav in komentarjev (ID-ji) + API `score` / `replies` |
| kraji | kraj iz povpraševanja v evidenci (ne `REGION` iz Reddita) |

---

## C. Osem vprašanj

| # | Vprašanje | Odgovor |
|---|---|---|
| 1 | Ali me vidijo? | »Oglas je videlo N ljudi« + ogledi naših objav (če so) |
| 2 | Ali me kontaktirajo? | povpraševanja iz oglasa in objav |
| 3 | Kdo čaka? | ni na tej strani |
| 4 | Kaj sprašujejo? | vprašanja, na katera smo odgovorili |
| 5 | Kaj deluje? | skupnost z največ kliki (r/ljubljana …) |
| 6 | Koliko stane / prinese? | pas vrednosti: oglasi X € · vrednost naročil Y € |
| 7 | Od kod? | kraji iz povpraševanj (hiše) |
| 8 | Kaj naj naredim? | ni na strani; »UKREPALI BOMO TAKO« |

---

## D. Obstoječa stran

Kanala Reddit v appu še ni, zato je to **nova stran**. Moduli so isti kot pri FB, IG in TikTok oglasih.

## E. Enotnost

| Modul | Vzorec |
|---|---|
| Glava | vijolična glava s 3 številkami |
| Rezultati oglasov | ilustracija z ljudmi in oblački + pas vrednosti (kot IG `igAds`) |
| Kje je oglas deloval | lestvica s trakovi (kot »Največ vas priporoča« pri AI) |
| Vaši odgovori | pogovor v vijoličnem bloku (zasnova 3 iz `splet-reddit-3.png`) |
| Povzetek | enak |

## F. Stanja

| Stanje | Besedilo |
|---|---|
| ni oglasov ta mesec | »Ta mesec oglasov na Redditu nismo imeli.« Modul oglasov skrit, odgovori ostanejo. |
| zadnja 2 dni | »Zadnja 2 dni se še posodabljata.« |
| 0 povpraševanj | oblaček »0 povpraševanj« zatemnjen, brez rdeče |
| < 3 povpraševanja | brez »cene na povpraševanje« |
| ogledi objav niso na voljo | vrstica brez ogledov, samo glasovi in odgovori |
| ni soglasja za Pixel | »Del povpraševanj ne vidimo, ker obiskovalec ni dovolil merjenja.« |

## G. Štetje

- Povpraševanje = `REDDIT_LEADS` + `CONVERSION_LEAD_CLICKS`, odstranjeni dvojniki z evidenco. Vsako šteje enkrat.
- Samo pretvorbe **po kliku**.
- Vrednost naročil je iz naše evidence, ne iz Reddita.
- Glasovi z »~«.
- Strošek je vedno v isti vrstici kot vrednost dela. Brez rdeče in brez »drago«.

## H. Pravo, dostop, strošek

- **UCPD / ZVPNPP:** objave samo kot podjetje, z razkritjem. Brez prikritega oglaševanja in brez lažnih priporočil.
- **Reddit pravila:** Rule 2 (spam, manipulacija glasov, več računov) in pravila posameznih skupnosti. Pred prvo objavo pišemo moderatorjem.
- **API:**
  - Ads API: razvijalska aplikacija v Ads Managerju; partnerski dostop [preveri].
  - Data API za objave: odobritev po Responsible Builder Policy (11. 11. 2025).
- **GDPR / ePrivacy:** Pixel in CAPI samo po soglasju. Leade iz CSV hranimo v evidenci, ne v Reddit izvozih.
- **Strošek:** oglasi najmanj ~5 USD na dan na oglasno skupino (plača obrtnik ali paket – stanje A/B). API je brezplačen.

## I. Napake

Ni obstoječe strani.

## J. Zgradba (modul na strani Splet)

Modul »Reddit« – naslov »Reddit je pripeljal 3 povpraševanja.«

1. **Oglas na Redditu** (vijoličen blok):
   - oznaka »septembra 45 €«;
   - tri ploščice: **4.800** videlo › **62** kliknilo › **3** povpraševanja;
   - pas vrednosti: oglas 45 € · naročilo 1.840 €;
   - vrstica: »Eno povpraševanje je stalo 15 € · največ klikov v r/ljubljana«.
2. **Vaši odgovori na vprašanja** (svetel blok):
   - zadnje vprašanje in »odgovorili kot Vodovod Novak ▲ ~9«;
   - 4 številke: odgovori · ogledi · ~glasovi · +sledilci.
3. Opomba: »Ogledi se na Redditu hranijo 45 dni, glasovi so približni. Zadnja 2 dni se še posodabljata.«
4. KAJ VIDIMO / UKREPALI BOMO TAKO.

Stanja:
- brez oglasov ta mesec: blok 1 se skrije;
- brez odgovorov: blok 2 se skrije;
- brez obojega: modula ni.
