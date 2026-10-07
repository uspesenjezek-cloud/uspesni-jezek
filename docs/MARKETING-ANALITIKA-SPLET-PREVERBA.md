# Splet — preverba v2 (postopek A–J)

Datum: 7. 10. 2026. Raziskava je bila razdeljena na devet delov:
1. slovenski portali;
2. portali DE/AT;
3. forumi, Reddit in omembe;
4. doslednost podatkov in obiski;
5. številke Reddita;
6. številke forumov in portalov;
7. novice in mediji;
8. povezave, blogi in YouTube (YouTube je odslej ločen kanal);
9. popoln popis vrst mest.

**Kaj je Splet:** vsa mesta na internetu zunaj obrtnikove spletne strani, Google profila, lastnih družbenih omrežij in **YouTuba (ločen kanal)**, kjer je obrtnik **vpisan, omenjen, priporočen ali povezan**. To so portali, zemljevidi, registri, partnerji proizvajalcev, forumi, Reddit, novice, občinska glasila in blogi.

**Omejitev raziskave:** omrežni proxy je blokiral neposredno branje večine strani. Podatki so iz iskalnikov in sekundarnih virov. Kar ni potrjeno na viru, je označeno z **[preveri]**. Pogojev uporabe portalov nismo prebrali v celoti. Do pravne preverbe velja: **brez množičnega strganja**. Dovoljeni so samo API-ji, profili posameznega obrtnika v nizki frekvenci in podatki, ki jih vnese ali poveže obrtnik.

> v1 tega dokumenta je pokrival samo portale, forume in Reddit, številk posamezne objave pa ni preveril. To je bila napaka postopka. Dodana sta točka A.0 (vrste mest) in stolpec »javne številke« pri vsakem viru.

---

## 0. Bistvo

1. Obrtnik ima od Spleta štiri vprašanja:
   - Kje sem in ali so podatki pravilni?
   - Kaj o meni pišejo in koliko ljudi je to videlo?
   - Kaj mi daje zaupanje (značke, certifikati, ocene)?
   - Ali je od tam prišla stranka?
2. **Vsaka omemba ima svoje javne številke** in te pokažemo pri omembi sami:
   - forumska tema: ogledi, odgovori, zadnja aktivnost;
   - Reddit: glasovi, delež glasov za, komentarji, velikost skupnosti;
   - članek: doseg portala na mesec (MOSS), povezava na vašo stran;
   - za vse: **položaj v Googlu** za lokalno iskanje.
3. **Omemb je malo** (0–3 na leto na vrsto). Zato ne kažemo odstotkov tona ali trendov. Kažemo vsako omembo posebej, z njenimi številkami.
4. **Napačen podatek na vpisu je najpomembnejša številka strani.** Imeniki in zemljevidi (Bing, Apple, Foursquare, OSM) so ~42 % virov, ki jih navajajo AI asistenti. Napačen telefon na Biziju gre naravnost v ChatGPT.
5. **Samo statistika.** Brez seznama »kje manjkate z gumbom za vpis«. »UKREPALI BOMO TAKO« ostane kot pri drugih kanalih.

---

## A. Popoln popis

### A.0 Vrste mest (da nič ne manjka)

| # | Vrsta | SI primeri | DE/AT primeri | Pomen |
|---|---|---|---|---|
| 1 | Portali in imeniki | Bizi, TIS/1188, Mojmojster, Daibau, Bolha | MyHammer, Check24 Profis, Gelbe Seiten, Das Örtliche, 11880, Herold, werkenntdenBESTEN | visok |
| 2 | Zemljevidi in podatkovni sloji | Bing Places, Apple Business, OpenStreetMap, Foursquare | isto + Yelp, HERE, TomTom | **zelo visok** (vir za AI) |
| 3 | Uradni registri in zbirniki | AJPES, OZS/OOZ, CompanyWall, e-creditreform | Handwerksrolle (HWK), WKO Firmen A-Z, GISA, North Data, firmenabc | visok (ujemanje podatkov) |
| 4 | Partnerji proizvajalcev | Daikin Home Comfort Expert, Immergas servisna mreža, Vaillant, Fronius [preveri SI] | Viessmann Partner-vor-Ort, Fronius Installateur-Finder, Buderus, Geberit | visok za ogrevanje, TČ, klime, sončne |
| 5 | Certifikati in spodbude | F-plini (C/D serviserji, MOPE), Eko sklad ZER seznam izvajalcev | dena Energieeffizienz-Experten, klimaaktiv | visok za energetsko obnovo |
| 6 | Forumi | med.over.net (Gradimo, opremljamo …), slo-tech (Loža) | Haustechnikdialog, Bauexpertenforum | srednji |
| 7 | Reddit | r/Slovenia, r/ljubljana | r/de, r/Handwerker, r/Austria | nizek v SI, srednji v DE |
| 8 | Novice in mediji | 24ur, Žurnal24, regionalni (Gorenjski glas, Sobotainfo, Dolenjski list …), **občinska glasila** (npr. Slamnik) | Lokalzeitung, Gemeindeblatt, meinbezirk.at | srednji (redko, a močno) |
| 9 | Blogi in seznami »najboljši« | blogi o prenovi, »10 najboljših vodoinštalaterjev« | isto | srednji (AI jih pogosto navaja) |
| — | Video (YouTube) | — | — | **ločen kanal**, ni na tej strani |
| 11 | Javna naročila | e-JN / enarocanje.si, Erar | TED, auftrag.at | nizek (samo del obrtnikov) |
| 12 | Zaposlitveni portali | MojeDelo, Optius | **Kununu**, StepStone, karriere.at | nizek |
| 13 | Lokalne skupnosti | občinski imeniki, TIC | nebenan.de, Nextdoor | nizek |
| — | Facebook skupine | — | — | **ni dostopno** (Groups API ukinjen 2024) |

### A.1 Javne številke po viru

| Vir | Javne številke | Kako jih dobimo | Pokažemo? |
|---|---|---|---|
| **Mojmojster** | ocena **/10** (npr. 9,8), število ocen, **značke**: odzivnost (≥ 70 % odgovorjenih povpraševanj), izkušnje (> 10 let), priporočen izvajalec (> 2 leti in ocena > 8,5), »izbor strank« | profil (URL vnese obrtnik) [preveri ToS] | **da**: ocena, ocene, značke |
| **Daibau** | ocene preverjenih naročnikov [preveri polja] | profil | da, če so javne |
| **Bizi.si** | bonitetna ocena SB1–SB10, semafor; ogledov in ocen ni | Bizi API / AJPES | **ne** na tej strani (finančni podatek); samo ujemanje NAP |
| **MyHammer** | `reviewCount`, `ratingValue` (JSON-LD), posamezne ocene z datumom, položaj na seznamu »Top 10 … in Kraj« | profil | da (DE/AT) |
| **Check24 Profis** | `aggregateRating` | profil | da (DE) |
| **Herold.at** | število ocen, ocena vsake ocene, »Datenstand« | profil | da (AT) |
| **werkenntdenBESTEN** | povprečje, število, število portalov, porazdelitev po zvezdicah, »+N v 12 mesecih« | profil | da (DE) |
| **Bing Places / Apple Business** | lastnik vidi oglede in dejanja; Apple ima izvoz CSV | obrtnik poveže ali uvozi | da, samo če povezano |
| **OpenStreetMap / Foursquare** | prisotnost in NAP | Overpass (prosto) / odprti nabor [preveri] | **da**: vpis in ujemanje |
| **Partnerji proizvajalcev** | prisotnost, stopnja partnerstva (npr. FSP Plus), razdalja; zvezdic ni | iskalnik po poštni številki | **da** kot značka |
| **F-plini, Eko sklad ZER, dena, klimaaktiv** | prisotnost na seznamu | PDF / iskalnik | **da** kot značka z datumom preverbe |
| **OZS / HWK / WKO** | vpis, obrt, mojstrski status | iskalnik | **da** kot značka |
| **slo-tech** | **ogledi teme** (npr. 25.582), **sporočila**, zadnje sporočilo | seznam podforuma | **da** |
| **med.over.net** | **odgovori**, zadnja aktivnost; ogledi so bili prej javni, v novi postavitvi [preveri] | seznam kategorije (selitev na medover.zurnal24.si) | **da** |
| **Haustechnikdialog / Bauexpertenforum** | odgovori in ogledi (oznake stolpcev [preveri]), reakcije | seznam foruma | da (DE) |
| **Reddit** | `score` (približek, »vote fuzzing«), `upvote_ratio`, `num_comments`, `created_utc`, `subreddit_subscribers`; **ogledi in delitve samo za avtorja** | iskalni API (`site:reddit.com`); neposreden API samo z odobritvijo in pogodbo | **da**: glasovi, % za, komentarji, velikost skupnosti |
| **Članek (novice, glasilo, blog)** | medij, datum, naslov, URL, **povezava na vašo stran** (dofollow/nofollow), **doseg portala na mesec (MOSS)**, položaj na seznamu »najboljših« | DataForSEO News, Event Registry, lasten pregled HTML, MOSS lestvica | **da**; obisk posameznega članka **ni javen**, AVE **ne** |
| **Povezave na vašo stran** | število strani, ki kažejo na vas, nove in izgubljene na mesec, vir, dofollow | DataForSEO Backlinks (< 0,10 $ na mesec) | **da**, brez DR/»authority« številk |
| **Google (vse zgoraj)** | **položaj** URL-ja teme, članka ali profila za lokalno iskanje | DataForSEO / SerpApi (`gl=si`, lokacija) | **da**: »#4 za ›bojler Domžale‹«, z datumom meritve |
| **e-JN / TED** | pridobljeni posli, vrednost, naročnik | iskalnik / TED API | **ne** v prvi različici |
| **Kununu** | ocena delodajalca | profil | **ne** (ni marketing) |

### A.2 Česa ni mogoče izmeriti

- ogledov in povpraševanj na profilih portalov (razen ob uvozu ali posredovani e-pošti);
- ogledov posameznega članka, Reddit objave ali forumske teme na med.over.net [preveri];
- zaprtih Facebook skupin;
- **vseh** omemb (vedno »najdene javne omembe«);
- tona v odstotkih (premalo omemb, slovenščina v orodjih nepotrjena);
- AVE, doseg posameznega članka, Similarweb za male portale.

---

## B. Kar izmerimo sami

| Kaj | Kako |
|---|---|
| **Vpisi in ujemanje podatkov** | Mesečno preverimo ime, naslov, telefon, splet in delovni čas proti glavnemu zapisu na potrjenih profilih, zemljevidih (OSM, Bing, Apple) in v registrih. |
| **Značke zaupanja** | Mesečno preverimo partnerje proizvajalcev (po dejavnosti), F-plin, Eko sklad, OZS/HWK in Mojmojster značke. |
| **Omembe** | Tedensko: iskalni API (Brave / DataForSEO) za ime + kraj, ime + dejavnost, telefon, omejeno na forume, Reddit in novice. Novice še prek DataForSEO News / Event Registry. Omembe v YouTube videih so v kanalu YouTube. LLM preveri, ali gre za tega obrtnika (potrjeno / verjetno / izključeno) in ali omemba priporoča, omenja ali je pritožba. |
| **Številke omembe** | Ob najdbi in nato enkrat na teden 4 tedne preberemo ogledi/odgovori/glasovi/komentarji (glej A.1). |
| **Položaj v Googlu** | Za vsako potrjeno omembo enkrat na mesec 2–3 lokalne poizvedbe (storitev + kraj, ime + »izkušnje«), top 20. |
| **Doseg medija** | MOSS mesečni doseg, če je portal vključen. Sicer brez številke. |
| **Povezave** | DataForSEO Backlinks enkrat na mesec: nove, izgubljene, skupaj. |
| **Povpraševanja** | posredovana obvestila portalov na `portal+<token>@…`, »Kako ste izvedeli za nas?« (+ možnosti »portal«, »forum / Reddit«, »članek / novice«), UTM na profilih. |
| **Obiski** | referrer in UTM na strani, ki jo gostimo, ujemanje z domeno omembe. Vedno »najmanj N«. |

---

## C. Osem vprašanj obrtnika

| # | Vprašanje | Odgovor |
|---|---|---|
| 1 | Ali me vidijo? | vpisi + doseg omemb (ogledi teme, doseg portala) + položaj v Googlu |
| 2 | Ali me kontaktirajo? | povpraševanja s Spleta |
| 3 | Kdo čaka? | ni na tej strani |
| 4 | Kaj pišejo? | omembe s citatom in številkami |
| 5 | Kaj deluje? | omemba ali portal z največ obiski oziroma povpraševanji |
| 6 | Koliko stane / prinese? | strošek portala (če ga vnese) ob vrednosti naročil |
| 7 | Od kod? | kraji iz povpraševanj |
| 8 | Kaj naj naredim? | ni na tej strani; »UKREPALI BOMO TAKO« |

---

## D. Obstoječa stran

**Čaka na posnetek.**

---

## E. Enotnost

| Modul | Vzorec |
|---|---|
| Glava | vijolična glava s 3 številkami |
| Kje ste vpisani | ilustracija z belimi karticami (»stranka kliče«), rdeče samo napačen podatek |
| Znaki zaupanja | značke v stilu ploščic »Vaš profil« |
| Kaj pišejo o vas | oblački kot »Kaj vas sprašujejo« + vrstica številk pod vsakim |
| Povezave | stolpci kot e-pošta »Kliki« |
| Ali je splet prinesel stranke | ilustracija z ljudmi in oblački |
| Povzetek | enak |

---

## F. Stanja

| Stanje | Besedilo |
|---|---|
| prvi pregled | »Iščemo, kje vse ste na spletu. Prve rezultate pokažemo v nekaj dneh.« |
| nepotrjeni zadetki | »Našli smo N mest, kjer ste morda vi.« |
| 0 omemb | »Ta mesec vas na forumih, v novicah in na Redditu ni nihče omenil. To je običajno.« |
| omemba brez številk (forum ne kaže ogledov) | pokažemo samo odgovore in datum, brez »0 ogledov« |
| portal ni v MOSS | brez dosega, samo »lokalni portal« |
| ni v top 20 Googla | brez oznake položaja (ne »ni v Googlu«) |
| Reddit `score` | »približno 24 glasov« |
| vir ni dosegljiv | »podatki z dne 3. 9.« |
| DE/AT | isti moduli, viri iz A.0 |

---

## G. Štetje

- **Brez seštevanja ogledov** med viri (forum, Reddit, portal merijo različno).
- **Doseg portala ni bralec članka.** Napis je vedno »portal doseže ~N ljudi na mesec«.
- **Glasovi na Redditu so približek.**
- **Položaj v Googlu** ima datum in kraj meritve.
- **Ocene:** vsak portal posebej, na njegovi lestvici (Mojmojster /10, ostali /5), brez skupnega povprečja.
- **Povezave:** število in sprememba, brez DR, Trust Flow ali Authority Score (le notranje razvrščanje »močna / lokalna / mala stran«).
- **Omembe** štejemo samo potrjene.

---

## H. Pravo, dostop, strošek

- **Strganje:** baze imenikov so zaščitene (96/9/ES, § 87b UrhG), ToS prepovedi veljajo (C-30/14). Beremo samo profil posameznega obrtnika ali uporabimo API. Pred zagonom pravno preverimo ToS [preveri].
- **Novice:** pravica izdajateljev (SI **ZASP-I, 139.a čl.**; DE § 87f–87k UrhG). Prikažemo naslov, medij, datum in povezavo, citata iz članka ne.
- **Reddit:** Responsible Builder Policy (11. 11. 2025), komercialna raba po pogodbi. Uporabljamo iskalni API. Hranimo ID in številke, ne besedila. Izbrisano odstranimo.
- **GDPR:** zakoniti interes (6(1)(f), C-621/22) + LIA. Ne hranimo vzdevkov in imen drugih oseb. Izseki 12 mesecev, metapodatki 24 mesecev [predlog]. Negativne članke vidi samo obrtnik.
- **Strošek na obrtnika na mesec:**
  - iskalni API in SERP: < 0,30 $;
  - Backlinks: < 0,10 $;
  - Event Registry: delež paketa ~90 $/mes;
  - LLM: ~0,05 $.

---

## I. Napake

Čaka na posnetek strani.

---

## J. Zgradba strani

1. **Glava:** »Na spletu ste na 14 mestih – en podatek je napačen.« · **14** mest · **1** napačen podatek · **3** nove omembe.
2. **Kje ste vpisani** (ilustracija »stranka kliče«): kartice s telefonom, ki ga vidi stranka (Bizi rdeče). Spodaj oznake zemljevidov in registrov (Bing, Apple, OSM, AJPES).
3. **Znaki zaupanja:** značke s kljukico in datumom.
   - Vaillant pooblaščeni serviser;
   - F-plini certifikat;
   - OZS;
   - Mojmojster »odzivnost« in »10+ let«;
   - »priporočen izvajalec – še ne« v obrisu.
4. **Ocene drugje:** Mojmojster 9,8 /10 (23 ocen, +2), Daibau 4,8 ★.
5. **Kaj pišejo o vas:** vsaka omemba z vrstico številk.
   - forum: ogledi · odgovori · #N v Googlu;
   - Reddit: ▲ glasovi · % za · komentarji · velikost skupnosti;
   - članek: medij · doseg portala · ✓ povezava na vašo stran.
6. **Kdo kaže na vašo stran:** »14 strani, septembra +2« + stolpci zadnjih 6 mesecev.
7. **Ali je splet prinesel stranke:** ilustracija z obiski, povpraševanji in naročilom.
8. **Povzetek.**

**Namenoma ne:** YouTube (ločen kanal), % tona, AVE, doseg članka, DR, skupno povprečje ocen, bonitete, Kununu, javna naročila, seznam »kje manjkate« z gumbi.

---

## Kontrolni seznam

- [x] A.0 vrste mest
- [x] A.1 javne številke po viru
- [x] A.2 česa ni
- [x] B lastno merjenje
- [x] C osem vprašanj
- [ ] D: čaka na posnetek
- [x] E enotnost
- [x] F stanja
- [x] G štetje
- [x] H pravo, dostop, strošek
- [ ] I: čaka na posnetek
- [~] J zgradba, slika v2

---

## K. Widget Reddit (preverjeno 7. 10. 2026)

Ocene s portalov so v **Ugledu podjetja**, zato modul »Ocene drugje« s strani Splet odstranimo.

Polja so potrjena iz izvorne kode PRAW in Devvit. Pri vsakem viru sta navedena dva neodvisna vira, reddit.com pa je iz omrežja blokiran.

| Pokažemo | Polje | Zapis |
|---|---|---|
| glasovi | `score` (rahlo zamegljen) | »~24 glasov«, vedno z ~ |
| delež za | `upvote_ratio` (2 decimalki) | »92 % za« |
| komentarji | `num_comments` | »11 komentarjev« |
| zadnja aktivnost | največji `created_utc` komentarjev | »zadnji pred 2 dnevoma« |
| komentar o vas | komentar z imenom + njegov `score` | citat + »▲ ~12« |
| skupnost in datum | `subreddit`, `created_utc` | »r/Slovenia · 2. 9.« |
| Google | DataForSEO `discussions_and_forums` / organsko, `rank_group` | »#3 v Googlu za ›vodoinštalater Domžale‹, preverjeno 5. 10.« |

**Ne pokažemo:**
- ogledov (`view_count` vidi samo avtor);
- »tedenskih obiskovalcev« (ni v API);
- `subscribers` (Reddit ga javno ne kaže več);
- trenutno aktivnih;
- navedb v Reddit Answers (ni API, ni slovenščine);
- mesta v »hot«;
- odstranjenih in izbrisanih niti (brišemo v 48 urah).

**Iskanje:** API išče po objavah, komentarje beremo iz najdenih niti. Za komentarje v drugih nitih uporabimo `site:reddit.com "ime"` prek Brave/DataForSEO.

**Pogoji:** pred zagonom je potrebna odobritev po Responsible Builder Policy (11. 11. 2025). Preverimo tudi, ali potrebujemo komercialno pogodbo.

Zasnove: `marketing-predlog/splet-reddit-3.png`.
