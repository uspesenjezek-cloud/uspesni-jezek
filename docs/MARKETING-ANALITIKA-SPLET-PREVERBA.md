# Splet — preverba (postopek A–J)

Datum: 7. 10. 2026. Raziskava je bila razdeljena na štiri dele: slovenski portali, portali DE/AT, forumi/Reddit/omembe ter doslednost podatkov/obiski/AI.

**Kaj je Splet:** vsa mesta na internetu, kjer je obrtnik vpisan ali omenjen. To so portali in imeniki, ocene na portalih, forumi, Reddit in članki. Splet **ni** obrtnikova lastna spletna stran in **ni** Google profil (ta je v kanalu Google).

**Omejitev raziskave:** omrežni proxy je blokiral neposredno branje večine portalov (bizi.si, mojmojster.net, daibau.si, my-hammer.de, med.over.net …). Podatki so iz iskalnikov in sekundarnih virov. Vse, česar nismo potrdili na uradnem viru, je označeno z **[preveri]**. Pogojev uporabe (ToS) portalov nismo prebrali v celoti, zato do pravne preverbe velja: **brez strganja, samo API, javni profil posameznega obrtnika v nizki frekvenci in podatki, ki jih vnese ali poveže obrtnik.**

---

## 0. Bistvo

1. **Obrtnik ima od Spleta tri vprašanja:**
   - Kje sem vpisan in ali so podatki pravilni?
   - Kaj ljudje pišejo o meni?
   - Ali je od tam prišla kakšna stranka?
2. **Portali lastniku ne dajo statistike prek API-ja.** Mojmojster, Bizi, TIS, Daibau, MyHammer, Check24, Gelbe Seiten in Herold nimajo javnega API-ja za oglede, klike ali povpraševanja. Zato povpraševanja s portalov štejemo **sami**: posredovana e-pošta portala, polje »Kako ste izvedeli za nas?« in UTM.
3. **Omemb je malo: 0–3 na leto pri tipičnem obrtniku.** Zato ne kažemo odstotkov, tona ali trendov. Pokažemo posamezne najdene omembe, vsako z virom in datumom.
4. **Podatki morajo biti povsod pravilni (NAP).** Pri Googlu je to le osnovna higiena (Whitespark 2026: ~7 % teže). Pri AI pa šteje, *kje* je obrtnik omenjen: lastna stran ~44 %, imeniki ~42 % citatov (Yext 2025). Napačen telefon na Biziju gre naravnost v ChatGPT (glej AI preverbo). Zato je »napačen podatek« najpomembnejša številka strani.
5. **Brez ukrepov na strani.** Samo stanje. »UKREPALI BOMO TAKO« ostane kot pri drugih kanalih.

---

## A. Popoln popis virov

### A.1 Slovenija

| Vir | Kaj vsebuje | Statistika za lastnika | Dostop za nas | Ocene | Odločitev |
|---|---|---|---|---|---|
| **AJPES – PRS** | uradni naziv, naslov, dejavnost, matična in davčna številka | ne | **FTP / `wsPrsInfo`**, komercialna ponovna raba po tarifi | ne | **samo v ozadju**: identiteta in vir resnice za ime in naslov |
| **Bizi.si** (TSmedia) | kartica podjetja, kontakti, finance | ni najdeno [preveri] | **Bizi API** (plačljiv, od ~69 €/mesec za 4.000 MŠ [preveri]) | ne | **pokažemo**: vpis ✓ in ujemanje podatkov |
| **TIS / itis.si / 1188** (TSmedia) | ime, naslov, telefon | ni najdeno | javno iskanje; API ni najden | ne | **pokažemo**: vpis in telefon [preveri ToS] |
| **Najdi.si** | iskalnik in oglasi TSmedia | ni najdeno | [preveri] | ne | **ne**: ni samostojnega profila [preveri] |
| **Mojmojster.net** | profil, reference, slike, ocene samo dejanskih naročnikov | povpraševanja v računu in po e-pošti/SMS; ogledov javno ni [preveri] | javni profil (URL vnese obrtnik) [preveri ToS] | **da** | **pokažemo**: vpis, ocena, število ocen; povpraševanja iz posredovane e-pošte |
| **Daibau.si** (tudi AT, HR …) | profil, slike, ocene preverjenih naročnikov | povpraševanja v profilu | javni profil (URL vnese obrtnik) [preveri ToS] | **da** | **pokažemo** kot Mojmojster |
| **Bolha.com** (storitve) | oglasi, ne profili | ogledi oglasa [preveri] | ne | ne | **ne** v prvi različici (oglasi so začasni) |
| **Bing Places** | NAP, čas, slike | Insights: ogledi, klici, pot, spletna stran (4/8/12 tednov) | Bulk API samo za partnerje; Insights brez API [preveri] | ne | **pokažemo**: vpis in ujemanje; Insights samo, če ga obrtnik poveže ali uvozi |
| **Apple Business** (prej Business Connect) | Place Card | Insights: iskanja, ogledi, dejanja; **izvoz CSV** | API samo za partnerje | ne | **pokažemo**: vpis; ogledi samo ob uvozu CSV |
| **OZS obrtni register** | obrtno dovoljenje | ne | na zahtevo | ne | **samo v ozadju** |
| Najmojster.si, MojObrtnik.com, GZS eKatalog | manjši imeniki | ni najdeno | [preveri] | [preveri] | **ne** dokler ne preverimo aktivnosti |
| Agregatorji (CompanyWall, Topograph, e-creditreform, Infobel) | prepis registra, pogosto **star telefon** | ne | javne strani | ne | **samo v ozadju**: iščemo star telefon, ki ga širijo |
| Yelp | v SI ne deluje | — | — | — | **ne** |

### A.2 Nemčija in Avstrija

| Vir | Statistika za lastnika | Dostop za nas | Ocene | Odločitev |
|---|---|---|---|---|
| **MyHammer** (DE, AT) | naročila in ponudbe v aplikaciji; ogledov ni [preveri] | URL profila | da | **pokažemo**: vpis, ocena |
| **Check24 Profis** (DE) | povpraševanja v aplikaciji | ni API | da | **pokažemo**: vpis, ocena |
| **Gelbe Seiten, Das Örtliche, Das Telefonbuch** (DE) | poročila samo za plačljive pakete | ni API; baza je zaščitena (§ 87b UrhG) | da | **pokažemo**: vpis in NAP (posamezen profil, nizka frekvenca) |
| **11880 + werkenntdenBESTEN** (DE) | plačljivo | ni API | **zbirne ocene** z več portalov | **pokažemo**: zbirna ocena kot dodatni vir |
| **Herold.at** (AT) | prek prodaje | ni API | da | **pokažemo** (AT) |
| **ProvenExpert** (DE, AT) | nadzorna plošča | **API od paketa Premium** (ključ obrtnika) | da | **pokažemo**, če obrtnik vnese ključ |
| **Trustpilot** | nadzorna plošča | **javni API** s ključem | da | **pokažemo**, če ima obrtnik profil (redko pri obrti) |
| **Yelp DE** | Yelp for Business | Places API: 3–7 izsekov, predpomnjenje 24 h, plačljiv | da | **ne** (nizek pomen, strošek) |
| Aroundhome, Blauarbeit, KennstDuEinen, Houzz | — | ni API | delno | **ne** v prvi različici |
| Handwerkskammer (Handwerksrolle) | ne | ni enotnega sistema | ne | **samo v ozadju** |
| Betreut, Helpling, Jameda | — | — | — | **ne** (ni obrt) |

### A.3 Forumi, Reddit in omembe

| Vir | Dostop | Odločitev |
|---|---|---|
| med.over.net (Gradimo, opremljamo in urejamo dom), slo-tech | ni API; RSS [preveri] | **pokažemo** najdene omembe prek iskalnega API-ja, ne lastnega strganja |
| Facebook skupine | **ni API** (Groups API ukinjen 22. 4. 2024) | **ne**: največja slepa pega, napisano v opombi |
| Reddit (r/Slovenia, r/de, r/Handwerker) | od 11. 11. 2025 vsak nov dostop ročno odobri Reddit; komercialna raba po pogodbi | **posredno**: iskalni API `site:reddit.com`, samo naslov, povezava in datum |
| Haustechnikdialog, Bauexpertenforum (DE) | [preveri] | posredno prek iskalnega API-ja |
| Iskalni API | **Bing Web Search ukinjen 11. 8. 2025**; **Google CSE zaprt za nove**, ugasne 1. 1. 2027; **Brave** 5 $/1.000; **DataForSEO** 0,6–2 $/1.000; Tavily, Exa | **Brave ali DataForSEO**, ~12 poizvedb na obrtnika na mesec (< 0,10 $) |
| Google Alerts | brez API, RSS | dodatek, ne osnova |
| Brand24, Mention, Talkwalker, Awario | 49–1.500 $/mesec, slovenščine Brand24 nima | **ne**: predrago na obrtnika, slaba pokritost SI |

### A.4 Česa ni mogoče izmeriti

- **Portali:** ogledov profila, klikov na telefon in števila povpraševanj na nobenem portalu iz A.1/A.2, razen če obrtnik sam uvozi izvoz ali posreduje e-pošto.
- **Omembe:** zaprtih Facebook skupin, dosega forumskih objav in **vseh** omemb (pokažemo samo »najdene javne omembe«).
- **Ton:** odstotkov in trenda tona (premalo omemb).
- **Konkurenca:** primerjave s konkurenco (kolizije imen, pravno tveganje sistematičnega zajema baz).
- **Ocene:** pristnosti ocen; pokažemo samo vir in datum.

---

## B. Kar izmerimo sami

| Kaj | Kako | Pogoj |
|---|---|---|
| **Seznam vpisov** | Ob vključitvi: AJPES (MŠ) → Bizi API → iskanje imena in telefona prek iskalnega API-ja (`site:mojmojster.net`, `site:daibau.si` …). Obrtnik potrdi najdene profile, manjkajoče URL-je doda sam. | vsak obrtnik |
| **Ujemanje podatkov** | Mesečno beremo potrjene profile in primerjamo ime, naslov, telefon, spletno stran in delovni čas z glavnim zapisom v appu. Rezultat na podatek: pravilen / napačen / ni podatka. | potrjen URL profila |
| **Ocene po portalih** | Povprečje, število in nove ta mesec, samo zbirne številke s povezavo na vir. Besedil ocen ne kopiramo. | portal z ocenami |
| **Omembe** | Tedensko 3 poizvedbe (ime + kraj, ime + dejavnost, telefon) prek Brave/DataForSEO, omejene na znane forume in Reddit. Ujemanje z več signali: ime + kraj + dejavnost ali telefon. LLM razvrsti: ali gre za tega obrtnika (potrjeno / verjetno / izključeno), priporoča / omenja / pritožba. | vsak obrtnik |
| **Povpraševanja s portalov** | Obrtnik nastavi posredovanje obvestil Mojmojstra, Daibau, MyHammer … na `portal+<token>@…`. Štejemo samo prejeta povpraševanja, brez vsebine strank v prikazu. | obrtnik nastavi posredovanje |
| **Obiski s portalov** | UTM v povezavi na profilu (`?utm_source=mojmojster`), kjer portal to dovoli, in referrer na strani, ki jo gostimo. Vedno »najmanj N«. | obrtnik ima spletno stran |
| **»Kako ste izvedeli za nas?«** | Nove možnosti: **Mojmojster / Daibau / drug portal** in **forum ali Reddit**. Prikazano ločeno od izmerjenih števil. | obrazec ali vnos klica |
| **Naročila in vrednost** | iz evidence, povezano s povpraševanjem iz zgornjih virov | evidenca |

**Sledilnih telefonskih številk ne uporabljamo.** Ker na vsakem portalu drugačna številka podre ujemanje podatkov, so v sporu z NAP. V DE so poleg tega pravno zapletene (BNetzA, § 201 StGB pri snemanju).

---

## C. Osem vprašanj obrtnika

| # | Vprašanje | Odgovor na strani |
|---|---|---|
| 1 | Ali me vidijo? | »Vpisani ste na N portalih« + ocene po portalih |
| 2 | Ali me kontaktirajo? | povpraševanja s portalov (posredovana e-pošta + »Kako ste izvedeli«) |
| 3 | Kdo čaka na odgovor? | ni na tej strani |
| 4 | Kaj me sprašujejo / kaj pišejo? | najdene omembe na forumih in Redditu |
| 5 | Kaj deluje najbolje? | portal z največ povpraševanji |
| 6 | Koliko stane / prinese? | strošek portala (če ga obrtnik vnese) **ob** vrednosti naročil |
| 7 | Od kod so stranke? | kraji iz povpraševanj s portalov (hiše) |
| 8 | Kaj naj naredim? | ni na tej strani; samo »UKREPALI BOMO TAKO« |

---

## D. Pregled obstoječe strani

**Čaka na posnetek strani Analitika → Splet.** Pri pregledu preverim:
- vrstice, ki pomešajo lastno spletno stran ali Google profil v Splet;
- številke brez vira (»omembe +23 %«, »doseg«, »ton 82 % pozitiven«) → odstrani;
- »vse omembe« → »najdene javne omembe«;
- ostanke splošne predloge.

---

## E. Enotnost z drugimi kanali

| Modul | Vzorec |
|---|---|
| Glava | vijolična glava s 3 številkami, kot pri AI |
| Kje ste vpisani | ploščice portalov z logotipom; isti označevalci kot izkaznica pri AI (✓ pravilen · **rdeče** napačen podatek · obris = ni vpisa) |
| Ocene drugje | stolpci kot »Vaš profil« |
| Kaj pišejo o vas | oblački kot »Kaj vas sprašujejo« (Facebook), z virom in datumom |
| Ali je splet prinesel stranke | ilustracija z ljudmi in belimi oblački (AI, IG oglasi) |
| Kraji | hiše (`HouseSceneEngine`) |
| Povzetek | enak kot drugod |

Rdeča barva je dovoljena **samo** za napačen podatek (enako kot telefon v AI izkaznici). Nikjer drugje ni rdeče in nikjer »slabo«.

---

## F. Stanja

| Stanje | Besedilo |
|---|---|
| prvi pregled še teče | »Iščemo, kje vse ste vpisani. Prve rezultate pokažemo v nekaj dneh.« |
| obrtnik še ni potrdil profilov | »Našli smo N mest, kjer ste morda vpisani. Ko jih potrdite, preverimo podatke.« |
| 0 omemb | »Ta mesec vas na forumih in Redditu ni nihče omenil. To je običajno.« (brez sivega »0«) |
| omemba »verjetno vi« | prikazana z oznako »verjetno vi«, ne šteje v število, dokler je obrtnik ne potrdi |
| portal ni dosegljiv | »Mojmojster ta mesec ni odgovoril – podatki so z dne 3. 9.« |
| ni posredovanja e-pošte | ploščica povpraševanj z »Povpraševanj z Mojmojstra še ne štejemo.« |
| obrtnik nima spletne strani | brez vrstice »obiski«, ostalo enako |
| DE/AT obrtnik | isti moduli, nabor portalov iz A.2 |

---

## G. Štetje

- **Vpisi:** šteje samo potrjen profil. »Morda vi« ne šteje.
- **Napačen podatek:** en napačen podatek na portalu = en zaznamek. Napačen telefon ima prednost pred ostalimi, ker gre v AI.
- **Ocene:** **ne** računamo skupnega povprečja čez portale (različne lestvice in pogoji). Vsak portal posebej, s številom ocen.
- **Omembe:** samo potrjene, posamično, z virom in datumom. Brez odstotkov, tona v %, grafov in »+N od lani« pri n < 5.
- **Povpraševanja:** vsako šteje enkrat. Če je stranka prišla z Mojmojstra in poklicala, šteje pri Mojmojstru, ne pri telefonu.
- **Obiski** so »najmanj N«. Ne seštevamo jih s stiki.
- **Strošek** portala samo ob vrednosti naročil. Cene na povpraševanje ni pod 3 povpraševanji.

---

## H. Pravo, dostop, strošek

- **Strganje:**
  - Imeniki so zaščitene baze (Direktiva 96/9/ES, v DE § 87b UrhG).
  - Prepovedi v ToS veljajo tudi za nezaščitene baze (SEU C-30/14 Ryanair).
  - Zato beremo **samo profil posameznega obrtnika**, na njegovo željo, enkrat na mesec, ter uporabljamo API-je (AJPES, Bizi, ProvenExpert, Trustpilot). **ToS vsakega portala pravno preverimo pred zagonom [preveri].**
- **Google ocene:** strganje je prepovedano. Lastnik jih bere prek GBP API (kanal Google).
- **§ 5b UWG / Omnibus:** ne velja neposredno, ker prikazujemo samo obrtniku, ne potrošnikom. Kljub temu vsaka ocena dobi vir in datum, nikjer ne napišemo »preverjena«. Ne ponudimo javnega pripomočka z združeno oceno.
- **GDPR:**
  - Obrtnik s.p., avtorji objav in osebe v objavah so posamezniki.
  - Pravna podlaga je zakoniti interes (6(1)(f), SEU C-621/22) s testom LIA.
  - Hranimo samo URL, datum, vir in razvrstitev ter kratek izsek, ki zadeva samo obrtnika. **Ne hranimo vzdevkov avtorjev.**
  - Hramba: izseki 12 mesecev, metapodatki 24 mesecev [predlog].
  - Obvestilo po čl. 14 z javnim obvestilom o zasebnosti [preveri].
  - DPA z iskalnim ponudnikom in ponudnikom LLM.
- **Reddit:** neposreden API samo z odobritvijo. Uporabljamo iskalni API in prikažemo samo naslov in povezavo.
- **Strošek na obrtnika na mesec:**
  - iskalni API < 0,10 $;
  - LLM razvrščanje ~0,01–0,05 $;
  - Bizi API razdeljen na obrtnike [preveri ceno za naš obseg];
  - AJPES po tarifi.

---

## I. Napake

Čaka na posnetek strani.

---

## J. Predlagana zgradba strani

1. **Glava »Kje vas najdejo na spletu«:** **6 portalov** · **1 napačen podatek** · **2 omembi** · izbirnik meseca. Opomba: »Pregledamo portale in forume, kjer ste vpisani ali omenjeni.«
2. **Kje ste vpisani:** ploščice portalov (Bizi, TIS, Mojmojster, Daibau, Bing, Apple; DE: Gelbe Seiten, MyHammer …).
   - Na vsaki: ✓ podatki pravilni, ali **rdeče** »star telefon«, ali obris »ni vpisa«.
   - Ob portalih, ki jih AI pogosto bere, majhna iskrica (povezava s kanalom AI).
3. **Ocene drugje:** po portalu povprečje ★, število ocen in »+N novih ta mesec«.
4. **Kaj pišejo o vas:** do 3 najdene omembe.
   - Vir (med.over.net, Reddit …), datum in kratek izsek.
   - Oznaka »priporoča« / »omenja« / »pritožba«.
   - Opomba »najdene javne omembe; zaprtih Facebook skupin ne vidimo«.
5. **Ali je splet prinesel stranke:** ilustracija z oblački.
   - povpraševanja s portalov;
   - »najmanj N obiskov s portalov«;
   - naročila in vrednost dela.
6. **Povzetek meseca:** enak kot drugod.

**Namenoma ne:** odstotki tona, doseg, »share of voice«, primerjava s konkurenco, skupno povprečje ocen, število vseh imenikov kot cilj, sledilne številke.

---

## Kontrolni seznam

- [x] A popis virov (SI, DE/AT, forumi, česa ni)
- [x] B lastno merjenje
- [x] C osem vprašanj
- [ ] D obstoječa stran: **čaka na posnetek**
- [x] E enotnost
- [x] F stanja
- [x] G štetje
- [x] H pravo, dostop, strošek
- [ ] I napake: čaka na posnetek
- [~] J zgradba predlagana, slika sledi
