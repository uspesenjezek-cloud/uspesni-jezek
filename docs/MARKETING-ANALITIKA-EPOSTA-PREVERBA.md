# E-pošta — totalna preverba (postopek A–J)

Stanje: 6. 10. 2026.

Vir: šest vzporednih raziskav:
1. Resend: OpenAPI v1.5.1 in SDK `resend@6.32.1`;
2. drugi ponudniki: Brevo, Mailchimp, SendGrid, Postmark, Amazon SES, Mailgun, MailerLite, Klaviyo;
3. zanesljivost številk;
4. sledenje PDF;
5. pravo in dostava;
6. orodja za obrtnike: Jobber, Housecall Pro, ServiceTitan, Square, Constant Contact.

Pravila za zanesljivost:
- Uradne strani so bile za neposreden dostop blokirane. Pri Resendu so primarni vir uradna specifikacija in SDK.
- Postavke **[preveri]** niso potrjene iz uradnega vira.
- Pravne točke mora pred zagonom potrditi pravnik.

Manjka: posnetek obstoječe strani Analitika → E-pošta. Brez njega razdelka D (elementi strani) in I (napake na strani) nista izvedena. Narejen je samo pregled kode za Resend.

---

## 0. Bistvo v sedmih točkah

1. **»Koliko ljudi je odprlo e-pošto« obrtniku ne pokažemo.** Razlogi:
   - Apple samodejno »odpre« vsa sporočila (okoli 50 % vseh odprtij je Apple Mail).
   - Resend pri odprtju ne pošlje ne naslova IP ne naprave, zato lažnih odprtij sploh ne moremo izločiti.
   - V Nemčiji (TDDDG §25), Franciji (CNIL, april 2026) in Italiji (Garante, rok 28. 10. 2026) je za merjenje odprtij potrebna **ločena privolitev**. Za Slovenijo (ZEKom-2, 225. člen) velja ista evropska osnova.
2. **Kdo je odprl PDF v priponki, se ne da izmeriti.** Nihče tega ne zna, triki pa so nezakoniti in tvegajo, da sporočilo konča med vsiljeno pošto. Rešitev: **osebna povezava do ponudbe na spletu** in gumb **»Sprejmi ponudbo«**. Priponka ostane, kjer jo stranka pričakuje.
3. **Zanesljive številke** so samo te:
   - dostavljeno;
   - neveljaven naslov;
   - odjave;
   - prijave neželene pošte;
   - **odgovori**;
   - **povpraševanja in naročila iz evidence**;
   - **ogledi in sprejem ponudbe na spletu**;
   - kliki, a samo **po filtriranju** varnostnih skenerjev, ki sami klikajo povezave.
4. **Seznam »Pokličite jih«** z imeni ljudi, ki so kliknili, je najbolj uporaben podatek za obrtnika. Dovoljen je samo iz klikov (nikoli iz odprtij) in samo pri prejemnikih s privolitvijo v sledenje.
5. **Pošiljamo v imenu obrtnika z naše poddomene**, npr. `"Vodovod Novak" <novak@obvestila.nasaapp.si>`, z odgovorom na obrtnikov naslov. Obrtnik ne nastavlja ničesar. Lastna domena je nadgradnja.
6. **Resend pri več obrtnikih:**
   - Ima skupne kontakte in odjave za ves račun: odjava pri enem obrtniku bi ustavila pošto vseh.
   - Podatke računa hrani v ZDA.
   - Dogodke hrani kratek čas.

   Zato vodimo **lastne sezname, odjave in zgodovino dogodkov**. **[odločitev]** Ali ostanemo pri Resendu ali za trženjsko pošto vzamemo ponudnika s hrambo v EU (Brevo, MailerLite, Amazon SES EU, Mailgun EU).
7. **Najprej je treba popraviti tveganje v obstoječi kodi:** POS webhook vrne 503 za vsak neznan `email_id`. Če gre nanj tudi trženjska pošta, bo Resend en dan ponavljal pošiljanje in po približno 5 dneh webhook izklopil (§I).

---

## A. Popoln popis podatkov — Resend

### A.1 Dogodki (webhooki), vseh 23

| Dogodek | Kaj vsebuje | Odločitev |
|---|---|---|
| `email.sent` | id, od, za, zadeva, `broadcast_id`, `tags` | ozadje (štetje poslanih) |
| `email.scheduled` | — | ozadje |
| `email.delivered` | — | **pokažemo** »dostavljeno« |
| `email.delivery_delayed` | — | ozadje |
| `email.bounced` | `type` Permanent / Transient / Undetermined, `subType` NoEmail / MailboxFull / MessageTooLarge / ContentRejected / AttachmentRejected …, `diagnosticCode` | **pokažemo** kot »neveljaven naslov« (trajno) oziroma »poln predal« (začasno); podrobnosti v ozadju |
| `email.complained` | — | **pokažemo** v zdravju seznama; samodejna odjava |
| `email.failed` | `reason` (npr. dnevna kvota) | admin |
| `email.suppressed` | razlog: prejšnja zavrnitev ali pritožba | ozadje; pri obrtniku šteje kot »neveljaven naslov« |
| `email.opened` | **nič dodatnega**: ne IP, ne naprave | **ne** (§0.1) |
| `email.clicked` | `link`, `ipAddress`, `userAgent`, `timestamp` | **pokažemo** po filtriranju skenerjev; samo s privolitvijo za osebni prikaz |
| `email.received` (dohodna pošta) | od, za, zadeva, `message_id`, priponke (brez vsebine, ta je na `GET /emails/receiving/{id}`) | **pokažemo** »odgovori«, z ujemanjem prek žetona v naslovu za odgovor |
| `contact.created` / `updated` / `deleted` | `unsubscribed` (globalno) | ozadje; zaradi skupnih kontaktov jih ne uporabljamo kot vir resnice |
| `contact.topics.updated` | prijava ali odjava po temi | ozadje |
| `domain.*` | stanje preverjanja DNS | admin in nastavitve obrtnika (lastna domena) |
| `suppression.added` / `removed` | izvor: zavrnitev, pritožba ali ročno | ozadje |
| `topic.*` | — | ozadje |

Dogodki lahko pridejo v napačnem vrstnem redu, zato jih uredimo po `created_at`. Resend ob napaki ponavlja pošiljanje: takoj, nato 5 s, 5 min, 30 min, 2 h, 5 h, 10 h, 10 h. Po približno 5 dneh neuspehov webhook izklopi.

### A.2 Poročila prek API

- **`GET /emails/metrics`** po obdobju, domeni, sporočilu ali kampanji. Vsebuje:
  - poslano, dostavljeno, zavrnjeno (po vrsti), pritožbe;
  - odprtja (vsa in edinstvena), kliki (vsi in edinstveni), odjave, prejeto;
  - deleže.
- **`GET /broadcasts/{id}/recipients?type=`**: kdo je kaj naredil, s številom klikov in kliknjenimi povezavami.
- **`GET /broadcasts/{id}/clicked-links`**: kliki po posamezni povezavi.

### A.3 Česa Resend ne da

- oznake za Apple ali strojna odprtja in samodejnega filtra robotskih klikov;
- naprave, države, sledenja priponkam;
- dogodka odjave za posamezno sporočilo (samo spremembo stanja kontakta);
- ločenih podračunov za obrtnike: kontakti, odjave in stran za odjavo so skupni;
- shranjevanja v EU (pošilja iz Irske, podatki računa so v ZDA **[preveri]**);
- dolge zgodovine (hramba po paketu je nejasna: 1, 30 ali 60 dni **[preveri]**);
- pripisa naročil in prihodka.

### A.4 Kaj drugi ponudniki dajo dodatno (za odločitev o ponudniku)

| Funkcija | Kdo |
|---|---|
| oznaka Apple odprtij | SendGrid `sg_machine_open`, Mailgun `bot=apple`, Brevo `proxy_open` in `appleMppOpens`, Mailchimp |
| oznaka robotskih klikov | Mailgun `client-info.bot`, Klaviyo `Bot Click`, Brevo (filter v poročilu) |
| razčlenjena naprava in država | Postmark, Mailgun, Mandrill |
| podrobna razvrstitev zavrnitev | SendGrid, Postmark, SES |
| shranjevanje v EU | Brevo, MailerLite (samo EU); SES, Mailgun, SendGrid (regija EU) |

Ker odprtij ne pokažemo, je prednost drugih ponudnikov pri nas predvsem **hramba v EU** in **vgrajen filter robotskih klikov**.

### A.5 Omejitve pri Resendu

- pritožbe < 0,08 %, zavrnitve < 4 %, sicer lahko suspendira račun;
- priponke do približno 40 MB, v paketnem pošiljanju niso dovoljene;
- domene: Pro 10, Scale 1.000, dodatek +100 za 20 $ na mesec **[preveri]**.

---

## B. Kar izmerimo sami

| Kaj | Kako | Velja za |
|---|---|---|
| **Kliki** | lastna preusmeritvena povezava na naši domeni + filter skenerjev (klik v nekaj sekundah po dostavi, vse povezave naenkrat, skrita povezava-past, omrežja Microsoft/Proofpoint/Mimecast, zahteve HEAD) | vse; osebno samo s privolitvijo |
| **Odgovori** | naslov za odgovor `odgovor+<žeton>@…` → Resend `email.received` → posredujemo obrtniku in štejemo; samodejne odgovore izločimo po glavi `Auto-Submitted` | vse |
| **Ponudba na spletu** | osebna povezava z žetonom → pregledovalnik PDF. Ogled šteje šele, ko se prva stran res izriše in je zavihek viden (≥ 2–3 s). Beležimo tudi prenos in ponovne oglede. | vse ponudbe, ki jih je stranka zahtevala |
| **Sprejem ponudbe** | gumb »Sprejmi ponudbo« → stran za potrditev z **drugim klikom** (skener ne more sprejeti); beležimo čas, različico in kontrolno vsoto dokumenta | vse |
| **Povpraševanja in naročila** | evidenca: povpraševanje ali naročilo stranke v **30 dneh po kliku ali odgovoru**, zadnji dotik, samo zaključena naročila (kot Housecall Pro in Jobber) | vse |
| **Klic** | gumb »Pokliči« prek naše povezave, ki preusmeri na `tel:` **[preveri delovanje na iOS/Android]**; ali klic stranke s številko iz evidence v 14 dneh | vse |
| **Novi kontakti** | evidenca strank (vsako končano delo doda kontakt) | vse |
| **Odjave** | lasten seznam za vsakega obrtnika; RFC 8058 (POST), **nikoli odjava ob GET** (skenerji bi odjavljali ljudi) | vse |

---

## C. Osem vprašanj obrtnika

| # | Vprašanje | Odgovor na strani |
|---|---|---|
| 1 | Ali me vidijo? | »Dostavljeno 142 od 150 strankam.« Odprtij ne kažemo. |
| 2 | Ali me kontaktirajo? | odgovori + kliki na »Pokliči« / »Želim termin« + povpraševanja |
| 3 | Kdo čaka na odgovor? | odgovori brez obrtnikovega odgovora (štejemo prek žetona) |
| 4 | Kaj me sprašujejo? | modul »Kaj vas sprašujejo« iz odgovorov (isti kot pri Facebooku), od 3 vprašanj naprej |
| 5 | Kaj deluje najbolje? | najboljša kampanja po povpraševanjih, nato po klikih; najbolj kliknjena ponudba |
| 6 | Koliko stane in koliko prinese? | strošek pošiljanja (če ga plača obrtnik) ob vrednosti naročil; pas vrednosti kot pri oglasih |
| 7 | Od kod in za katero delo? | kraj in delo iz povpraševanja v evidenci (isti modul s hišami); samo od 2 povpraševanj naprej |
| 8 | Kaj naj naredim zdaj? | »Pokličite jih« (ljudje, ki so kliknili ponudbo) + ponudbe, ki so ogledane, a ne sprejete |

---

## D. Pregled obstoječe strani

**Ni izveden. Potreben je posnetek strani Analitika → E-pošta.** Pri pregledu najprej preverim:
- ali stran kaže odprtja ali »delež odprtih« → odstrani;
- ali kaže »prebrano« pri PDF → odstrani; zamenja »ogledano na spletu«;
- ali sešteva klike brez filtra → zamenja »ljudje, ki so kliknili«;
- deleže pri majhnih seznamih → števila;
- ostanke drugih kanalov in splošne predloge;
- slovnico 1 / 2 / 3–4 / 5+.

---

## E. Enotnost z drugimi kanali

| Modul na E-pošti | Ponovno uporabljen modul |
|---|---|
| Kampanje e-pošte | **WhatsApp »Kampanje«** (izbira kampanje + predogled sporočila + rezultati); namesto telefona predogled e-pošte |
| Rezultat kampanje | **tri osebe** (Dostavljeno → Kliknili → Povpraševanja), tretja »V TEKU«, kadar naročila še ni |
| Strošek | **pas vrednosti** iz `igAds` (stanja A / B / C) |
| Kaj vas sprašujejo | **Facebook** mreža 2 × 2 |
| Od kod so povpraševanja | **kraji s hišami** |
| Primerjava, povzetek | ista kot drugod |

Nov modul je samo **»Ponudbe«** (časovnica posamezne ponudbe), ker ga drugi kanali nimajo. Bolj ga ne moremo poenostaviti.

---

## F. Stanja

| Stanje | Besedilo |
|---|---|
| ni še nobene kampanje | »Pošljimo prvo obvestilo vašim strankam – npr. opomnik za servis.« |
| kampanja poslana, rezultati še prihajajo (< 48 h) | »Rezultati se še zbirajo.« |
| privolitev v sledenje nima nihče | brez seznama »Pokličite jih«; kliki samo kot skupno število |
| 0 klikov | »Ponudbe še ni kliknil nihče. Odgovori: N.« (brez rdeče) |
| 0 naročil | tretja oseba »V TEKU« |
| zavrnitve > 4 % ali pritožbe > 0,08 % | v zdravju seznama »Preverimo seznam« (oranžno, ne rdeče); pošiljanje začasno ustavimo samodejno |
| mesec brez pošiljanja | »Ta mesec nismo pošiljali.« |
| starejše od naše hrambe | »Za ta mesec nimamo več podatkov.« |

---

## G. Denar in štetje

- Strošek Resenda na sporočilo je zanemarljiv. **[odločitev]** Ali je pošiljanje v paketu (stanje B: »Vključeno v vaš paket«)?
- Povpraševanje iz e-pošte se šteje enkrat, tudi če je stranka hkrati klikala tudi oglas: zadnji dotik.
- Odstotkov ne kažemo, ker je seznam majhen (1 klik pri 150 kontaktih je 0,7 %). Kažemo števila.
- Brez primerjave s »povprečjem panoge«: definicije ponudnikov se preveč razlikujejo. Primerjamo samo s prejšnjimi kampanjami istega obrtnika.
- Pričakovane vrednosti za seznam obrtnika so: kliki 1–4 % ljudi, odjave 0,1–0,5 % na pošiljanje, pritožbe pod 0,1 %.

---

## H. Pravo, dostop, dostava

### H.1 Smemo pošiljati?

- **SI, ZEKom-2, 226. člen:** potrebna je privolitev ali izjema za obstoječo stranko. Izjema velja samo za *podobne* storitve. Možnost zavrnitve mora biti ponujena ob zbiranju naslova in v vsakem sporočilu.
- **DE, UWG §7(3):** pogoji so enaki, sodišča jih berejo strogo. Za nove prijave velja dvojna potrditev (BGH I ZR 164/09: dokazno breme nosi pošiljatelj).
  - BGH VI ZR 225/17: **prošnja za oceno v e-pošti z računom je oglaševanje.** Velja tudi za »ocenite nas« v naših sporočilih iz POS.
- **SEU C-654/23 (13. 11. 2025):** izjemo za obstoječe stranke ureja samo ePrivacy; tudi brezplačna registracija lahko šteje kot »prodaja«.
- **Vloge:**
  - Obrtnik je upravljavec, mi smo obdelovalec. Z vsakim obrtnikom potrebujemo **pogodbo o obdelavi (DPA)**.
  - Pri skupnem seznamu blokiranih naslovov smo upravljavec mi.

**Zapis za vsak kontakt:**
- vir: prodaja, dvojna potrditev ali uvoz;
- čas, besedilo obvestila, povezava na posel;
- čas odjave;
- **privolitev v sledenje (ločeno)**.

### H.2 Smemo meriti?

- Smernice EDPB 2/2023 izrecno pokrivajo slikovne in povezavne sledilnike v e-pošti.
- DE (TDDDG §25, DSK), FR (CNIL 2026-042), IT (Garante 284/2026): odprtja potrebujejo privolitev. Kliki z osebno oznako po večini mnenj prav tako **[preveri s pravnikom]**.
- **Privzeto pri nas:**
  - brez slikovnega sledilnika;
  - kliki prek naše povezave **brez osebne oznake** (skupno število na kampanjo);
  - osebni kliki in seznam »Pokličite jih« samo pri prejemnikih s privolitvijo (ločeno potrditveno polje, odjava sledenja v nogi vsakega sporočila).
- Ponudbe, ki jih je stranka zahtevala: beleženje ogleda in sprejema na strežniku je del storitve. Podrobna analitika po straneh (čas na strani) je samo s privolitvijo v pregledovalniku.

### H.3 Dostava (veljajo za nas, ker pošiljamo za vse obrtnike skupaj > 5.000 na dan)

- Gmail, Yahoo (od 2024, zavračanje od novembra 2025) in Microsoft (od 5. 5. 2025) zahtevajo:
  - SPF, DKIM in poravnan DMARC;
  - PTR in TLS;
  - **odjavo z enim klikom (RFC 8058)**, upoštevano v 48 urah;
  - pritožbe < 0,1 %, nikoli 0,3 %.
- **Ločeni poddomeni** za računi in ponudbe ter za trženje, da težava s trženjem nikoli ne ustavi računov.
- Google Postmaster Tools API v2 za naše domene; Microsoft SNDS samo pri lastnem IP.
- Za vsakega obrtnika: samodejna ustavitev pri pritožbah nad 0,1 %, omejitev pri prvih pošiljanjih, pregled uvoženih seznamov.

### H.4 V imenu obrtnika

| Možnost | Ocena |
|---|---|
| obrtnikov gmail ali siol naslov kot pošiljatelj | **ne**, DMARC zavrne |
| naša poddomena + obrtnikovo ime + odgovor na obrtnika | **privzeto** |
| obrtnikova domena (poddomena `mail.vodovod-novak.si`) z vodenim vnosom DNS | nadgradnja |

V nogi sporočila so obrtnikov polni naziv, naslov, pri DE impresum in »poslano prek …«.

---

## I. Napake

### I.1 V obstoječi kodi (POS, pregled brez sprememb)

1. `api/_handlers/pos-dostava-webhook.js` vrne **503** za `email_id`, ki ni račun iz POS. Če isti webhook prejema trženjsko pošto, Resend ponavlja pošiljanje približno 28 ur in webhook po približno 5 dneh izklopi. Posledica: **ustavi se tudi sledenje računom.** Trženje potrebuje ločen webhook, ali pa naj ta vrača 200 za neznane.
2. Pošiljanju se ne doda `tags` (obrtnik, kampanja), zato dogodkov ni mogoče razvrstiti po obrtniku.
3. Shranjeno je samo `type` zavrnitve. `subType`, `diagnosticCode`, podatki o kliku (`link`, IP, naprava) in razlog blokade se izgubijo.
4. Podatki o klikih in odprtjih se zapišejo, a nimajo filtra skenerjev.

Teh napak ne popravljamo v tej nalogi (POS je ločena funkcija). Popraviti jih je treba pred prvim pošiljanjem trženja.

### I.2 Na strani

Ni izvedeno, ker manjka posnetek.

---

## J. Videz

Ni izveden; slika sledi po posnetku. Predlagana zgradba strani, največ 6 številk in 2 seznama:

1. **Glava:** povpraševanja iz e-pošte · naročila · vrednost (strošek, če ga plača obrtnik).
2. **Kampanje** (vzorec WhatsApp):
   - izbira kampanje, predogled sporočila;
   - **Dostavljeno 142 · Kliknili 9 ljudi · Odgovorili 4 · Povpraševanja 2**;
   - tri osebe s stanjem »V TEKU«.
3. **Pokličite jih:** do 5 imen (samo kliki, zadnjih 30 dni, samo s privolitvijo), za vsako kaj je kliknila in gumb »Pokliči«.
4. **Ponudbe:** časovnica za vsako ponudbo: Poslano → Dostavljeno → **Ogledano na spletu (2×)** → Preneseno → **Sprejeto**. Pod časovnico opomba: »Če je stranka odprla priponko, tega ne vidimo.«
5. **Kaj vas sprašujejo** (iz odgovorov), od 3 vprašanj naprej.
6. **Zdravje seznama:** semafor »V redu / Preverimo«, ob dotiku neveljavni naslovi, odjave, prijave neželene pošte, +novi kontakti.
7. **Povzetek meseca.**

**Ne kažemo:**
- deleža odprtih;
- »prebranega PDF«;
- vseh klikov (samo ljudi);
- naprav, krajev odpiranja, najboljše ure pošiljanja, primerjave s panogo.

---

## Odločitve, ki so uporabnikove

1. Ostanemo pri Resendu za trženje ali vzamemo ponudnika s hrambo v EU?
2. Ali je pošiljanje v paketu?
3. Ali zbiramo privolitev v sledenje (potrebno za »Pokličite jih«)?
4. Ali uvedemo ponudbe na spletu z gumbom »Sprejmi ponudbo«?
5. Pravni pregled točk H.1 in H.2 pred zagonom.

## Kontrolni seznam postopka

- [x] A popis platforme (Resend + primerjava)
- [x] B lastno merjenje
- [x] C osem vprašanj
- [ ] D elementi strani: **čaka na posnetek**
- [x] E enotnost
- [x] F stanja
- [x] G denar in štetje
- [x] H pravo in dostava
- [~] I napake: koda pregledana, stran čaka na posnetek
- [ ] J videz: **čaka na posnetek**
