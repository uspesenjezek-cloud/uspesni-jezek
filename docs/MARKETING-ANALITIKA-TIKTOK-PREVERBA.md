# TikTok analitika — raziskava, preverba in zamenjave v obstoječih modulih

Vhod:
- lokalni popis strani `analitika.html?kanal=tiktok` (september 2026, vzorčni podatki);
- raziskava TikTok API (stanje 6. 10. 2026; uradna dokumentacija prek zrcala portala TikTok API for Business, zadnja sprememba 15. 5. 2026).

Pravilo: moduli, ilustracije in vrstni red ostanejo. Spremenijo se podatki in besedila. Kjer podatka ni mogoče dobiti, se zamenja vir. Nov modul samo tam, kjer obstoječi ne ustreza.

---

## 0. Kaj TikTok dejansko da (bistvo raziskave)

### 0.1 Kateri API

| API | Kaj da | Uporabno? |
|---|---|---|
| **Display API** (`open.tiktokapis.com/v2`) | samo skupne števce: sledilci, všečki, število videov; pri videih skupni ogledi, všečki, komentarji, delitve | **ne** – brez zgodovine, brez obiskov profila, brez »do konca« |
| **Accounts API** (TikTok API for Business, `/v1.3/business/get/`, `/business/video/list/`) | dnevne številke računa in podrobnosti videov | **da** – to uporabimo |
| **Marketing API** (`/v1.3/report/integrated/get/`) + **Leads API** | oglasi: strošek, kliki, oddani obrazci, sami kontakti iz obrazcev | **da**, samo če vodimo oglase |

### 0.2 Pogoji na strani obrtnika

| Pogoj | Kaj dobimo | Kaj manjka brez njega |
|---|---|---|
| osebni račun | ogledi, obiski profila, všečki, komentarji, delitve | novi sledilci, »različni ljudje«, kontaktni kliki |
| **poslovni račun** (brezplačen preklop v aplikaciji) | + novi/izgubljeni sledilci, `unique_video_views` (različni gledalci) | kontaktni kliki |
| **registriran poslovni račun** (Registered Business Account) | + klik na povezavo, telefon, e-pošto, naslov, oddani obrazci (`lead_submissions`) | — |
| ≥ 100 sledilcev | demografija, kraji sledilcev | — |
| ≥ 1 objavljen video | sploh kakšni podatki | vse |

**[preveri]** Ali je registriran poslovni račun na voljo v Sloveniji in Nemčiji. Če ni, kontaktnih klikov na TikToku ne bo. Takrat ne pišemo »Ni podatka«, ampak razlog (§2).

### 0.3 Metrike, ki jih uporabimo

**Račun (dnevno):**
- `video_views` – ogledi vseh videov. **Vključuje tudi oglede iz oglasov** (organskih in plačanih ne loči).
- `profile_views` – obiski profila.
- `daily_new_followers` – novi sledilci (poslovni račun).
- `bio_link_clicks`, `phone_number_clicks`, `email_clicks`, `address_clicks`, `lead_submissions` – samo registriran poslovni račun.

**Video:**
- `thumbnail_url`, `share_url`, `caption`, `create_time`, `video_duration` → prava naslovnica in povezava do videa;
- `video_views`, `full_video_watched_rate` (»do konca«), `new_followers`;
- `is_ad` → video, ki je bil oglas, označimo.

**Oglasi:**
- `spend`, `clicks`, `form` (oddani obrazci);
- kontakti iz obrazcev prek Leads API → **gredo naravnost v evidenco povpraševanj**.

### 0.4 Česa ne pokažemo

- `impression_sources` (Za vas, Iskanje …), krivulja gledanosti, povprečni čas gledanja;
- starost, spol, kraji sledilcev (sledilec ni stranka; kraj je iz evidence);
- `audience_activity` (ure aktivnosti);
- primerjava s panogo (`benchmark`): kategorije za obrtnike ni.

### 0.5 Tehnične omejitve

- **Zgodovina samo 60 dni** → dnevni posnetki v Supabase so obvezni.
- **Zamik 24–48 ur** → stanje je vedno »do predvčerajšnjim«; v glavi pišemo datum stanja.
- Podatki videa se po 365 dneh ne osvežujejo več.
- Žeton dostopa velja 1 dan, osvežitveni 1 leto → nočno osveževanje.
- Od **20. 3. 2026** je za Accounts API obvezen obrazec »Accounts API Access Application« in pregled aplikacije z demo videom. To je naše enkratno opravilo.

---

## 1. Napake, ki jih je treba popraviti najprej (brez spremembe dizajna)

| # | Napaka | Popravek |
|---|---|---|
| 1 | Stran se ne izriše: `places()` bere nedefiniran `global.KRAJI_PRIZOR` → `TypeError … 'razlicne'` (`analitika-tiktok.js:197`). Zato manjkajo videi, oglasi, kraji, povzetek; ostanejo kartice splošne predloge (Google / Instagram / Priporočila). | Kraje izriši z obstoječim `HouseSceneEngine`, enako kot Facebook in WhatsApp. |
| 2 | Izbirnik meseca se po napaki ne zapre; včasih se ne odziva. | Odpravi se z #1. Preveri zapiranje. |
| 3 | Meseci so omogočeni do oktobra (trdo kodirano). | Zadnji omogočen mesec je zadnji zaključeni mesec, izpeljan iz datuma. |
| 4 | Povzetek kaže splošne vrstice »Google · SE SPLAČA«, »Instagram · ŠE DRAG«, »Priporočila · ZASTONJ«. | Povzetek bere samo TikTok podatke (§7). |
| 5 | Primerjava kaže gumb »Posli« in napis »Ta mesec šest strank več.« iz predloge. | »Naročila«; naslov iz TikTok podatkov (§6). |

---

## 2. Glava

| Element | Zdaj | Novo | Zakaj |
|---|---|---|---|
| 1 | nova povpraševanja | **novo povpraševanje** | slovnica (1/2/3–4/5+) |
| 0 | potrjena naročila | **naročil** | slovnica |
| 50 € | poraba oglasov | ostane | |
| opomba | Primer podatkov. Nova povpraševanja in naročila, potrjena v izbranem mesecu. Naročilo lahko izvira iz starejšega povpraševanja. | **Stanje 4. 10. TikTok podatke pošlje z dvodnevnim zamikom.** | razvijalska opomba → za obrtnika |
| naslov, podnaslov, ime | ostane | ostane | |

## 3. Odziv na TikToku (`ttResponse`)

| Element | Zdaj | Novo |
|---|---|---|
| naslov | Kako se odzivajo na vaše videe. | **Vaše videe so si ogledali 5.820-krat.** |
| 5.820 | ogledi videov | ostane |
| 73 | obiski profila | **obiskov profila** |
| 3. ploščica | Ni podatka · kliki na povezavo | **+12 · novih sledilcev** (`daily_new_followers`) |
| nova vrstica pod ploščicami (samo če ni registriranega poslovnega računa) | — | »Klike na telefon in povezavo TikTok pokaže samo registriranemu podjetju. Uredimo ga skupaj z vami.« |
| KAJ VIDIMO | Vsak odziv šteje posebej. Mesečni odziv na vse videe računa. Ogledi niso različni ljudje … Odziva oglasov ne prištevamo. | **73 ljudi je po videu odprlo vaš profil, 12 vam je začelo slediti.** |
| UKREPALI | Ločeno spremljamo oglede, obiske profila in klike … | **Na profil dodamo telefon in povezavo do obrazca za ponudbo.** |
| opomba (mala, siva) | — | **»Ogledi vključujejo tudi oglede oglasov.«** |

Pomembno: dosedanji stavek »Odziva oglasov ne prištevamo« je **napačen**. TikTok organskih in plačanih ogledov na ravni računa ne loči.

### 3.1 Kontaktni kliki (samo registriran poslovni račun)

Če so kliki na voljo, se ne dodaja v `ttResponse`. Uporabi **isti modul »Vaš profil« kot na Instagramu** (stolpci z ikonami, `docs/MARKETING-ANALITIKA-INSTAGRAM-IZVEDBA.md` §2.1) z gumbi, ki jih TikTok šteje:

| Gumb | Metrika | Barva (kot pri IG) |
|---|---|---|
| Pokliči | `phone_number_clicks` | #6a4be0 |
| Pot | `address_clicks` | #17946a |
| E-pošta | `email_clicks` | #e8892b |
| Povezava | `bio_link_clicks` | #e1306c |
| Obrazec | `lead_submissions` | #0fa3a8 |

- Naslov: »**N klikov na gumbe v profilu.**«
- Pravilo kot pri IG: stolpec samo za gumb, ki ga profil ima ali je imel > 0 klikov.
- Če registriranega računa ni, se modul ne prikaže (velja vrstica iz §3).

## 4. Objavljeni videi (`ttVideos`)

| Element | Zdaj | Novo |
|---|---|---|
| oznaka | Primer podatkov | **odstrani** (le v vzorčnem načinu) |
| naslov | Objavili smo 3 videe. | ostane |
| naslovnice | ilustracije hiš, ikona predvajanja dekorativna | **prava naslovnica** (`thumbnail_url`), klik odpre video (`share_url`); ilustracija hiše ostane samo, kadar naslovnice ni |
| vrstica videa | 1.840 ogledov · 38 % ogledov do konca | ostane; dodaj tretjo malo vrednost **+5 sledilcev** (`new_followers`), samo če > 0 |
| oznaka »Oglas« | — | mala oznaka ob videu, ki je bil oglas (`is_ad`) |
| vrstni red | po datumu | **po ogledih**, najboljši prvi |
| opomba | Ogledi od objave do 30. 9. 2026. Ogledi niso število različnih ljudi. Predogledi so ilustrativni. | **Ogledi od objave do 30. 9.** |
| KAJ VIDIMO | Merimo tudi oglede do konca. To je delež ogledov … | **»Menjavo sifona« je do konca gledalo 46 % ljudi – največ od vseh.** |
| UKREPALI | Primerjamo odziv posameznih videov … | **Posnamemo še en kratek video popravila, kot je »Menjava sifona«.** |

»Do konca« je `full_video_watched_rate`. To je edina metrika gledanosti, ki jo obrtnik razume, zato ostane.

## 5. Rezultati oglasov (`ttAds`)

Dizajn vrstic kampanj ostane. Spremenijo se besedila. Pod vrsticami se doda **isti pas vrednosti kot pri `igAds`** (stanja A / B / C, `docs/MARKETING-ANALITIKA-IG-OGLASI-CODEX.md` §3–4), da je strošek vedno ob vrednosti dela.

| Element | Zdaj | Novo |
|---|---|---|
| oznaka | Primer podatkov | odstrani |
| naslov | Dve kampanji tega meseca. | **Oglasi so prinesli 2 kontakta.** (vsota ciljnih odzivov, ki so kontakti) |
| kampanja 1 | Predstavitev vašega dela · Da ljudje obiščejo spletno stran. · 20 € · 18 klikov na spletno stran | ostane |
| kampanja 2 | Povprašajte za ponudbo · Da zainteresirani oddajo kontakt. · 30 € · 2 oddanih kontaktov | **2 oddana kontakta** (slovnica) |
| opomba | Prikazujemo odziv na cilj posamezne kampanje. | odstrani |
| pas vrednosti | — | kot `igAds`: »Oglasi septembra« 50 € / »Povprečno naročilo« 1.200 € · »Eno naročilo pokrije oglase za 24 mesecev.« |
| KAJ VIDIMO | Oddan kontakt še ni naročilo. Klik na povezavo in oddaja kontakta sta različna odziva … | **2 človeka sta oddala kontakt, 18 jih je odprlo spletno stran.** |
| UKREPALI | Uspešnost vsake kampanje preverimo glede na njen cilj … | **Oba kontakta pokličemo v 24 urah.** |

Kontakte iz obrazcev uvozimo prek **Leads API** naravnost v evidenco povpraševanj. Tako »oddan kontakt« postane povpraševanje brez ročnega dela.

## 6. Od kod prihajajo povpraševanja (`kr`)

Vir ostane **kraj iz povpraševanja v vaši evidenci**, ne kraj gledalca ali sledilca. Izris z `HouseSceneEngine` (§1).

| Element | Zdaj | Novo |
|---|---|---|
| naslov | Kje potrebujejo vaše delo. | **Povpraševanje je iz Mengša.** (pri 1); pri več: **Največ povpraševanj je iz {kraj}.** |
| hiše | ne izrišejo se | **Mengeš 1 povpr.** |
| STORITVE | ne izrišejo se | oznaka **ZA KATERO DELO**; vrstice iz evidence |
| KAJ VIDIMO / UKREPALI | — | KAJ VIDIMO: **»Povpraševanje iz TikToka je za {storitev} v Mengšu.«** UKREPALI: **»Naslednji video posnamemo o {storitev}.«** |

## 7. Primerjava (`pr`) in povzetek meseca

**Primerjava** ostane (graf in gumbi), bere samo TikTok:

| Element | Zdaj | Novo |
|---|---|---|
| naslov | Ta mesec šest strank več. / Ta mesec 1 več. | **1 povpraševanje več kot avgusta.** / **Enako kot avgusta.** |
| gumbi | Povpraševanja · Posli · Poraba | Povpraševanja · **Naročila** · Poraba |
| KAJ VIDIMO | Primerjamo datume iz evidence. Ta mesec: 1; v primerjalnem obdobju 0. Primerjava zaključenih mesecev. | **Septembra 1 povpraševanje, avgusta nobenega.** |
| UKREPALI | Rezultate primerjamo za enaki obdobji … | **Objavljamo naprej vsak teden en video.** |

**Povzetek meseca** – splošne vrstice zamenja:

| Vrstica | Novo |
|---|---|
| Videi | **1 povpraševanje · 0 naročil · brezplačno** |
| Oglasi | **2 oddana kontakta · 0 naročil · 50 €** |
| Avgust | **0 povpraševanj · 0 naročil** |
| KAJ VIDIMO | **Povpraševanje je prišlo iz videa, oglasi so prinesli 2 kontakta.** |
| UKREPALI | **Oglase obdržimo še oktobra in ju primerjamo s septembrom.** |

Brez oznak »SE SPLAČA / ŠE DRAG« in brez rdeče.

## 8. Prazni meseci

| Stanje | Besedilo |
|---|---|
| ni povezanega računa | »Povežite TikTok, da vidimo oglede vaših videov.« (gumb za povezavo) |
| mesec starejši od začetka shranjevanja | »Za ta mesec TikTok podatkov ne hrani več.« |
| tekoči mesec | »Podatki se zbirajo. Stanje {datum}.« |
| ni objavljenih videov | »Ta mesec ni bilo novih videov.« |

»Ni podatka« in 0 nista isto (načelo iz raziskave).

## 9. Slovnica

Ena skupna funkcija za 1 / 2 / 3–4 / 5+: povpraševanje, naročilo, ogled, obisk, sledilec, kontakt, video (video / videa / videi / videov).

## 10. Preverjanje

- [ ] Stran se izriše brez napake v konzoli, pri svežem nalaganju in pri preklopu kanala.
- [ ] Izbirnik meseca se zapre; omogočen je do zadnjega zaključenega meseca.
- [ ] V povzetku ni nobene vrstice drugega kanala.
- [ ] 390 px in 320 px, september, avgust, oktober.
- [ ] Cache različica `analitika-tiktok.js` je dvignjena.
