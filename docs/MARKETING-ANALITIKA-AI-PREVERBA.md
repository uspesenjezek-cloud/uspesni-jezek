# AI — preverba (postopek A–J)

Stanje: 7. 10. 2026. Postopek: `docs/MARKETING-ANALITIKA-POSTOPEK-PREVERBE.md`.

**Predpostavka:** kanal »AI« pomeni, **ali obrtnika priporočijo AI asistenti** (ChatGPT, Google AI pregledi in AI Mode, Gemini, Perplexity, Copilot, Claude …), ko stranka vpraša npr. »dober vodoinštalater v Domžalah«. Če kanal v aplikaciji pomeni kaj drugega, je treba preverbo prilagoditi.

**Stran kaže samo rezultate.** Ukrepanje (urejanje profilov, imenikov) je v drugem delu aplikacije. Obrtnik tu ne sprejema odločitev.

**Viri:** štiri vzporedne raziskave:
1. kako asistenti izbirajo lokalne obrtnike;
2. kako to izmeriti (API-ji, orodja, lastni podatki, pogoji uporabe);
3. kako rezultate kažejo orodja za mala podjetja;
4. obiski, klici in povpraševanja iz AI.

Uradne strani so bile za neposreden dostop pogosto blokirane, zato **[preveri]** pomeni, da trditev ni potrjena iz uradnega vira.

---

## 0. Bistvo

1. **Asistenti nimajo svojega imenika obrtnikov.** Vsak vpraša enega od štirih virov:
   - **Google profil in Zemljevidi:** AI pregledi, AI Mode, Gemini;
   - **Bing in Bing Places:** Copilot, deloma ChatGPT in Meta AI;
   - **licencirani podatki in splet:** ChatGPT (Yelp od 7/2026, Mapbox, Bing), Perplexity (Yelp, Mapbox);
   - **Apple Business Connect:** Siri in Apple Intelligence.

   Izbere tiste, ki se ujemajo s storitvijo, so blizu, imajo veliko in svežih ocen ter imajo povsod enake podatke.
2. **Kaj AI priporoči, se ne da prebrati iz nobenega uradnega poročila.** Google, Bing in GA4 kažejo le približke. Glavno številko zato dobimo z **vzorčenjem**: ista vprašanja postavimo asistentom prek uradnih API-jev, večkrat na mesec.
3. **AI odgovori so naključni.** Isti seznam podjetij se ponovi v manj kot 1 % odgovorov (SparkToro, 2.961 ponovitev). **Mesta (»3. mesto«) ne kažemo**, samo »priporočeni pri N od 20 vprašanj«, vsako vprašanje postavimo 3-krat.
4. **Večina obrtnikov ni priporočenih.** ChatGPT priporoči okoli 1 %, Gemini 11 %, Perplexity 7 % lokalnih podjetij (SOCi 2026, 350.000 lokacij). »Še ne priporoča« bo najpogostejše stanje in ne sme delovati kot neuspeh.
5. **AI obrtnika pogosto pozna, tudi če ga ne priporoči.** ChatGPT pozna 94 % podjetij, a le pri 56 % ima pravilne podatke (Insites, 10.000 podjetij). »AI vas pozna« je ločen in spodbuden podatek.
6. **Obiski iz AI se štejejo samo deloma.** Okoli 70 % obiskov iz aplikacij na telefonu nima izvora. Vedno pišemo »najmanj N«. Klicev iz AI ne vidi nihče.

---

## A. Popoln popis — kaj ponuja kateri vir

### A.1 Asistenti: od kod jemljejo podatke in ali delujejo pri nas

| Asistent | Vir lokalnih podatkov | SI | DE | Ocene štejejo? |
|---|---|---|---|---|
| ChatGPT | Bing (20–30 zadetkov → 3–5 virov z ocenami), Mapbox, Yelp (7/2026, EU **[preveri]**), Foursquare (delež sporen) | da, odgovarja slovensko | da | da (raje viri z zvezdicami) |
| Google AI pregledi | Google profil + splet | da (slovenščina na seznamu) | da | da (uradno) |
| Google AI Mode | Google profil (do ~10 kartic) | **[preveri na google.si]** | da (od 10/2025) | da |
| Gemini | Google Zemljevidi (250 M+ krajev), povzetek ocen | da (slovenščina) | da | da – besedilo ocen oblikuje odgovor |
| Copilot | Bing + Bing Places | Copilot da, Bing Places **[preveri]** | da | — |
| Perplexity | splet, Yelp, Mapbox; v DE vgrajen v Telekomov »AI-Phone« | da | da | — |
| Claude | iskalnik Brave, brez lokalnih kartic | da | da | — |
| Apple Intelligence / Siri | Apple Business Connect | **ne podpira slovenščine** | da | — |
| Meta AI (WhatsApp, IG, FB) | Google/Bing; brez lokalnih kartic **[preveri]** | **ne podpira slovenščine** | da | — |

### A.2 Kaj se da izmeriti

| Meritev | Vir | Kako | Zanesljivost | Strošek | Odločitev |
|---|---|---|---|---|---|
| **Priporočeni pri N od 20 vprašanj** | OpenAI Responses API + `web_search` (`user_location` = kraj), Perplexity Sonar, Anthropic web search | 20 stalnih vprašanj × 3 ponovitve × asistent; »priporočen« = predlagan kot možnost, ne omenjen mimogrede | srednja za trend; API ≠ aplikacija (poizvedbe API in ChatGPT.com se ne prekrivajo) | ~2–10 $ na obrtnika na mesec | **pokažemo**, z oznako »merimo z vprašanji prek uradnih vmesnikov« |
| **Google AI pregledi / AI Mode** | ponudnik SERP (DataForSEO ~0,001–0,004 $ na stran, SerpApi) | dejanska stran Google z lokacijo | visoka; pravno siva cona (ToS Google) | majhen | **pokažemo**, ponudnik z dokumentiranim tveganjem |
| **Gemini** | Gemini API z Google Search/Maps grounding | — | — | 14 $ / 1.000 | **ne**: pogoji prepovedujejo shranjevanje in analizo rezultatov |
| **Copilot** | ni API (Bing Search API ukinjen 8/2025) | — | — | — | **ne**; neobvezno Bing Webmaster »AI Performance« (citati, samo CSV) |
| **AI vas pozna: da / delno / ne** | ista API vprašanja po imenu podjetja | ali AI pravilno pove ime, dejavnost, kraj, telefon | srednja | v ceni zgoraj | **pokažemo** |
| **Kdo je priporočen namesto vas** | isti odgovori | imena drugih podjetij | srednja | — | **pokažemo največ 2 imeni** (s.p. so fizične osebe – minimalno shranjevanje **[preveri s pravnikom]**) |
| **Od kod AI ve za vas** (citirani viri) | citati v API odgovorih in SERP | združeno v 4 vrste: Google profil, ocene, spletna stran, imeniki | visoka | — | **pokažemo** (brez URL-jev) |
| **Napačni podatki o vas** | primerjava odgovora z evidenco | npr. »telefon se ne ujema« | srednja | — | **pokažemo** kot besedilo |
| Mesto na seznamu | isti odgovori | — | **nizka** (šum) | — | **ne** |
| Ocena razpoloženja (0–100) | — | — | nizka | — | **ne** |
| Količina vprašanj (koliko ljudi sprašuje) | — | nihče je ne objavi | — | — | **ne** |
| Google AI prikazi (s povezavo) | Search Console »Generative AI performance« (od 6/2026) | samo prikazi, AI pregledi + AI Mode skupaj, samo povezani | visoka, a ozka | brezplačno | ozadje (če ima obrtnik spletno stran) |
| **Obiski iz AI** | naš strežnik / GA4 kanal »AI Assistant« (od 5/2026, brez Perplexityja) | izvor `chatgpt.com`, `perplexity.ai`, `gemini.google.com`, `copilot.microsoft.com`, `claude.ai` + `utm_source` | podšteva (~70 % brez izvora) | brezplačno | **pokažemo** kot »najmanj N« |
| **AI je odprl vašo stran med pogovorom** | dnevniki strežnika: `ChatGPT-User`, `Perplexity-User`, `Claude-User` (preverjeni IP) | štetje | srednja (eno vprašanje = več odprtij) | brezplačno | **pokažemo** s poštenim besedilom (ni N ljudi) |
| Indeksni roboti (OAI-SearchBot, PerplexityBot …) | dnevniki | — | visoka | — | ozadje |
| Klici iz AI | nihče | klik »Pokliči« v ChatGPT gre naravnost v telefon | ni merljivo | — | **ne**; neobvezno sledilna številka na posamezen profil (kasneje) |

### A.3 Česa ni mogoče izmeriti

- kolikokrat je AI obrtnika priporočil resničnim strankam;
- koliko ljudi sprašuje AI po obrtnikih v kraju;
- Gemini (pogoji), Copilot (ni API), Apple in Meta AI (ni API, ni slovenščine);
- klici in poti iz AI kartic.

---

## B. Kar izmerimo sami

| Kaj | Kako |
|---|---|
| **Vprašanja** | 20 stalnih vprašanj na obrtnika iz dejavnosti, storitev in 2–4 krajev, v jeziku strank (SI ali DE). Niz ostane enak iz meseca v mesec. |
| **Ponovitve** | Vsako vprašanje 3-krat na asistenta na mesec, v različnih tednih. **Da** = priporočen v ≥ 2 od 3, **Včasih** = 1 od 3, **Ne** = 0 od 3. |
| **Pozna vas** | 3 vprašanja po imenu. Da = ime, dejavnost in kraj pravilni. Delno = en ključen podatek napačen. Ne = ne pozna. |
| **Izvor obiska** | ob prvem ogledu strani se shranita izvor in `utm_*`, ki se preneseta v povpraševanje v evidenci |
| **»Kako ste izvedeli za nas?«** | polje v obrazcu in v vnosu klica: Google iskanje · Google Zemljevidi · **ChatGPT ali drug AI pomočnik (Gemini, Copilot, Perplexity …)** · Priporočilo · Facebook/Instagram · Že sem stranka · Drugo. Prikazano ločeno od izmerjenih obiskov, ne seštevano. |
| **Odprtja med pogovorom** | samo `*-User` roboti, preverjeni po objavljenih IP naslovih |
| **Povezave v profilih** | povezava na spletno stran v Google profilu, Bing Places … z oznako (`?utm_source=gbp` …), da so preostali obiski bolj razločljivi |

---

## C. Osem vprašanj obrtnika

| # | Vprašanje | Odgovor na strani |
|---|---|---|
| 1 | Ali me vidijo? | »Priporočeni pri 7 od 20 vprašanj« + »AI vas pozna« |
| 2 | Ali me kontaktirajo? | najmanj N obiskov iz AI; povpraševanja z odgovorom »ChatGPT / AI« |
| 3 | Kdo čaka na odgovor? | ni na tej strani |
| 4 | Kaj me sprašujejo? | »Kaj vprašajo stranke« = vprašanja, ki jih postavljamo AI, z Da / Včasih / Ne |
| 5 | Kaj deluje najbolje? | pri katerem asistentu in v katerem kraju ste priporočeni |
| 6 | Koliko stane / prinese? | ni stroška za obrtnika; povpraševanja iz AI |
| 7 | Od kod? | kraji s hišami: polna hiša = priporočen, obris = ne |
| 8 | Kaj naj naredim? | ni na tej strani; samo »UKREPALI BOMO TAKO« |

---

## D. Pregled obstoječe strani

**Čaka na posnetek strani Analitika → AI.** Pri pregledu preverim:
- mesto na seznamu, odstotke, razpoloženje → odstrani;
- »AI vas je priporočil N-krat« kot dejstvo → zamenja »pri N od 20 vprašanj«;
- asistente brez slovenščine → siva ploščica;
- trditve »zaradi« → »običajno pomaga«.

---

## E. Enotnost z drugimi kanali

| Modul | Vzorec |
|---|---|
| Glava | vijolična glava s 3 številkami |
| Kaj vprašajo stranke | Facebook mreža 2 × 2 z ljudmi; na ploščici vprašanje + Da/Včasih/Ne po asistentu + »namesto vas: …« |
| Kje vas AI vidi | kraji s hišami (polna / obris) |
| Od kod AI ve za vas | ilustracija z belimi oblački (Google profil ✓, Ocene ✓, Spletna stran –, Imeniki »napačen telefon«) |
| Ali je AI prinesel stranke | ploščice kot pri drugih kanalih |
| Povzetek | enak kot drugod |

---

## F. Stanja

| Stanje | Besedilo |
|---|---|
| prvi mesec / premalo ponovitev | »Prvi pregled še teče – rezultate pokažemo, ko AI vprašamo vsaj dvakrat.« (brez številk, hiše in oblački v obrisu, brez trenda) |
| 0 od 20 | »AI vas ta mesec še ni priporočil. To je pogosto – ChatGPT priporoči okoli 1 od 100 lokalnih podjetij.« Najprej »AI vas pozna« in viri. |
| AI vas ne pozna | »AI vas še ne pozna po imenu.« Oblački pokažejo, kaj manjka. |
| asistent ne deluje v slovenščini | siva ploščica: »Google AI v iskanju še ne odgovarja v slovenščini – tega ne štejemo.« Izločen iz »N od 20«. |
| nekatere ponovitve niso uspele | »pri 18 od 20 vprašanj« |
| manj kot 3 obiski | »Nekaj obiskov« namesto številke |

---

## G. Štetje

- **Brez odstotkov in mest.** »N od 20 vprašanj«.
- **Sprememba:** ±3 vprašanja ali manj = »približno enako«. Sprememba šteje šele pri ±4 ali več oziroma, če se isto vprašanje dva meseca zapored spremeni iz Ne v Da. Pri 7 od 20 je razpon zaupanja ~18–57 %.
- **Obiski so »najmanj«**, povpraševanja iz polja »Kako ste izvedeli« so prikazana ločeno.
- **Odprtja med pogovorom** niso ljudje.
- **Nikoli »zaradi tega vas bo AI priporočil«**, ampak »to običajno pomaga«. Ugotovitve o ocenah (133 proti 11 ocen) so korelacija.

---

## H. Pravo, dostop, strošek

- **OpenAI:** samodejno branje aplikacije ChatGPT je prepovedano, dovoljen je samo uradni API.
- **Gemini grounding:** pogoji prepovedujejo shranjevanje in analizo rezultatov ter jih dovolijo pokazati samo tistemu, ki je vprašal. **Ne uporabljamo** brez pravnega mnenja.
- **Google SERP:** strganje krši pogoje Googla. Sodišče v ZDA je 20. 7. 2026 zavrnilo tožbo DMCA proti SerpApi, stanje v EU je **[preveri]**. Ponudnika izberemo skrbno in tveganje zapišemo.
- **GDPR:**
  - Samostojni podjetniki so fizične osebe, zato je shranjevanje imen konkurentov obdelava osebnih podatkov.
  - Pravna podlaga je zakoniti interes s tehtanjem; hranimo samo štetja, imena čim manj, z rokom hrambe.
  - Z OpenAI, Anthropicom, Perplexityjem in ponudnikom SERP potrebujemo pogodbe o obdelavi (DPA).
- **robots.txt na straneh, ki jih gostimo:**
  - Dovolimo `OAI-SearchBot`, `PerplexityBot`, `Claude-SearchBot`, `Bingbot` in `Googlebot`, sicer obrtnik izgine iz odgovorov.
  - Preverimo, da CDN ali požarni zid (npr. privzeta blokada AI robotov pri Cloudflare) ne blokira robotov `*-User`.
- **Strošek:**
  - 20 vprašanj × 3 asistenti × 3 ponovitve = ~180 klicev na obrtnika na mesec, ~2–10 $.
  - Komercialna orodja (Peec, Otterly, BrightLocal, Local Falcon) so za preprodajo predraga, uporabimo jih le kot vzor definicij.

---

## I. Napake

Čaka na posnetek strani.

---

## J. Predlagana zgradba strani

1. **Glava »Ali vas AI priporoči?«:** **7 od 20** vprašanj · **AI vas pozna: da** · **najmanj 4 obiski iz AI**. Opomba: »AI vsakič odgovori malo drugače, zato vsako vprašanje postavimo trikrat.«
2. **Kaj vprašajo stranke** (mreža 2 × 2): štiri tipična vprašanja. Pri vsakem Da / Včasih / Ne po asistentu (ChatGPT, Google, Perplexity) in »namesto vas: …« (največ 2 imeni).
3. **Kje vas AI vidi:** hiše za 2–4 kraje, polna = priporočen vsaj »včasih«.
4. **Od kod AI ve za vas:** ilustracija z oblački Google profil · Ocene · Spletna stran · Imeniki (✓ / – / »napačen podatek«).
5. **Ali je AI prinesel stranke:** najmanj N obiskov · N povpraševanj, kjer je stranka izbrala »ChatGPT / AI« · »AI je 6-krat odprl vašo stran med pogovorom (to ni 6 ljudi)«.
6. **Povzetek meseca:** sprememba proti prejšnjemu mesecu po pravilu iz G; vrstica po asistentih.

**Namenoma ne:** mesto, odstotki, razpoloženje, indeksi, količine vprašanj, URL-ji, imena modelov, Gemini in Copilot kot izmerjena (siva ploščica »ne merimo«).

## Kontrolni seznam

- [x] A popis virov in meritev
- [x] B lastno merjenje
- [x] C osem vprašanj
- [ ] D obstoječa stran: **čaka na posnetek**
- [x] E enotnost
- [x] F stanja
- [x] G štetje
- [x] H pravo, dostop, strošek
- [ ] I napake: čaka na posnetek
- [~] J zgradba predlagana; slika po potrditvi
