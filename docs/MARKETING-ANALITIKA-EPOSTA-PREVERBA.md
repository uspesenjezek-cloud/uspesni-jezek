# E-pošta — preverba (različica 2)

Stanje: 6. 10. 2026. Postopek: `docs/MARKETING-ANALITIKA-POSTOPEK-PREVERBE.md` (A–J).

**Kaj je ta stran:** Analitika → E-pošta kaže **samo rezultate** e-pošte, ki jo pošiljamo v imenu obrtnika. Kaj storiti (koga poklicati, katera ponudba čaka) je v drugem delu aplikacije, ne tukaj. Obrtnik pri tej strani ne sprejema nobenih odločitev.

**Viri in preverjenost:**
- Resend: uradna specifikacija OpenAPI v1.5.1 in SDK `resend@6.32.1` (preverjeno v izvorni datoteki).
- Primerjava s 7 drugimi ponudniki.
- Zakonodaja in pravila Gmail/Yahoo/Microsoft: iz izvlečkov uradnih strani, ker so bile strani same blokirane.
- Vsaka trditev je bila preverjena v ločenem krogu (§K). Postavke **[preveri]** niso potrjene.

---

## 0. Bistvo

1. **Kaj pokažemo** (vse kot števila, brez imen):
   - povpraševanja in naročila po e-pošti z vrednostjo;
   - odgovori;
   - kliki na posamezne gumbe;
   - ponudbe: odprte, sprejete, zavrnjene, z vprašanjem;
   - nove Google ocene po prošnji za oceno;
   - zdravje seznama.
2. **Česa ne pokažemo:**
   - **odprtij e-pošte**: niso merljiva, ker Apple sam naloži vsebino sporočil, Resend pa pri odprtju ne pošlje nobenega podatka za izločanje lažnih;
   - odstotkov, naprav, krajev odpiranja, ure pošiljanja, primerjave s panogo.
3. **Odpiranje PDF izmerimo, kadar je PDF poslan kot povezava** (gumb »Odpri ponudbo« → naš pregledovalnik). Tako delajo vsa orodja, ki »merijo priponke« (Yesware, HubSpot, DocSend, Mailtrack, PandaDoc): datoteko v resnici zamenjajo s povezavo. Odprtja priponke ne izmeri nihče. PDF zato pošljemo kot povezavo, priponka je lahko zraven.
4. **Za nič na tej strani ne potrebujemo posebne privolitve v sledenje:**
   - kliki se štejejo po gumbu na ravni kampanje, brez osebne oznake;
   - povpraševanja pridejo iz evidence;
   - odprtje ponudbe beleži strežnik kot del storitve, ki jo je stranka zahtevala.
5. **Pošiljamo z naše poddomene** z obrtnikovim imenom kot pošiljateljem in odgovori na obrtnikov naslov. Obrtnik ne nastavlja ničesar.

---

## A. Popoln popis podatkov — Resend

### A.1 Dogodki (vseh 23, preverjeno v specifikaciji)

| Dogodek | Vsebina | Odločitev |
|---|---|---|
| `email.sent` | id, od, za, zadeva, `broadcast_id`, `template_id`, `tags`, `headers` | ozadje |
| `email.scheduled` | enako | ozadje |
| `email.delivered` | enako | **pokažemo** »dostavljeno« |
| `email.delivery_delayed` | enako | ozadje (opozorilo pri porastu) |
| `email.bounced` | `type` Permanent/Transient/Undetermined; `subType` General/NoEmail/MailboxFull/MessageTooLarge/ContentRejected/AttachmentRejected/Undetermined; `message`; `diagnosticCode` | **pokažemo** »neveljaven naslov« (trajno; začasno po 3 zaporednih) |
| `email.complained` | enako kot sent | **pokažemo** kot »najmanj N« (Gmail posamičnih prijav ne sporoča) |
| `email.failed` | `reason` | admin |
| `email.suppressed` | `type`, `reason` (prejšnja zavrnitev/pritožba) | ozadje; šteje kot neveljaven naslov |
| `email.opened` | **nič dodatnega** (ne IP, ne naprava) | **ne**, sledenje odprtij izklopljeno |
| `email.clicked` | `link`, `ipAddress`, `userAgent`, `timestamp` | **ne uporabljamo**: Resendovo sledenje klikom je izklopljeno, ker prepiše povezave z oznako za vsakega prejemnika; kliki gredo prek naše povezave (B) |
| `email.received` | od, za, cc, bcc, `received_for`, `message_id`, zadeva, metapodatki priponk | **pokažemo** »odgovori« (vsebina z `GET /emails/receiving/{id}`) |
| `contact.*`, `contact.topics.updated`, `topic.*` | kontakti, teme, `unsubscribed` | ozadje; seznamov ne vodimo v Resendu (A.3) |
| `domain.*` | stanje DNS | admin |
| `suppression.added/removed` | izvor | ozadje |

Za vsako domeno se v Resendu nastavi `open_tracking: false` in `click_tracking: false`.

### A.2 Poročila prek API

- `GET /emails/metrics`:
  - poslano, dostavljeno, zakasnjeno, neuspešno, zavrnjeno (po vrsti), pritožbe, blokirano, odprtja, kliki;
  - **odjave**;
  - prejeto.

  Razčlemba po obdobju, domeni, sporočilu ali kampanji. Privzeto obdobje je 7 dni.
- `GET /broadcasts/{id}/recipients?type=…` in `GET /broadcasts/{id}/clicked-links` (veljajo samo pri pošiljanju prek Broadcasts).

### A.3 Kaj Resend ne da ali kaj ne ustreza

- Pri odprtju ni podatkov, s katerimi bi lažna Apple odprtja izločili.
- Ni vgrajenega filtra robotskih klikov.
- **Kontakti in odjave so skupni za ves račun**, od novembra 2025. Odjava pri enem obrtniku bi ustavila kampanje vseh. Zato seznamov, odjav in tem **ne vodimo v Resendu**, ampak pri sebi, in pošiljamo prek `/emails` ali paketno.
- **Podatki računa, dnevniki in metapodatki so v ZDA** ne glede na regijo pošiljanja. Regija se izbere za vsako domeno, privzeto je `us-east-1`. Za naše domene izberemo `eu-west-1`.
- **Hramba dogodkov je kratka** (podatki si nasprotujejo **[preveri]**). Vse dogodke shranjujemo sami.
- Ni pripisa naročil.

### A.4 Drugi ponudniki (za primerjavo)

| Funkcija | Kdo jo ima |
|---|---|
| oznaka Apple odprtij | SendGrid `sg_machine_open`, Mailgun `client-info.bot`, Brevo `proxy_open`, Mailchimp |
| oznaka robotskih klikov | Mailgun, Klaviyo (lastnost »Bot Click«), Brevo (filter v poročilu) |
| shranjevanje v EU | Brevo, MailerLite (samo EU); SES, Mailgun, SendGrid (regija EU) |

Ker odprtij ne kažemo, nas te prednosti za prikaz ne zadevajo. Ostanemo pri Resendu.

### A.5 Omejitve

- Resend: pritožbe < 0,08 %, zavrnitve < 4 %, sicer lahko račun zapre brez opozorila.
- Priponke: do 40 MB skupaj po kodiranju; v paketnem pošiljanju niso dovoljene.

---

## B. Kar izmerimo sami

| Kaj | Kako | Privolitev |
|---|---|---|
| **Kliki na gumbe** (»Želim termin«, »Pokliči«, »Odpri ponudbo«, »Pot do nas«) | Vsak gumb ima svojo povezavo prek naše domene **na ravni kampanje** (brez oznake prejemnika). Izločimo: zahteve HEAD, predoglede (WhatsApp, iMessage, facebookexternalhit, Google), znane skenerje (safelinks, urldefense, mimecast, oblačna omrežja), izbruhe v prvi minuti po pošiljanju. **Pred filtrom oblačnih omrežij spustimo naslove iCloud Private Relay** (Applov objavljeni seznam `egress-ip-ranges.csv`), ker so to pravi uporabniki iPhona. Predoglede lovimo po oznaki brskalnika, ne po naslovu: `facebookexternalhit`/`Facebot` (tudi iMessage, ki teče na napravi uporabnika), `WhatsApp/`, `Slackbot-LinkExpanding`, `TelegramBot`, `Twitterbot`. Oznak ne dajemo v parametre z imeni, ki jih Apple briše (`gclid`, `fbclid`, `mc_eid` …); žeton je v poti. | ni potrebna |
| **Odgovori** | naslov za odgovor `odgovor+<žeton>@…` → `email.received` → posredujemo obrtniku in štejemo. Izločimo samodejne odgovore (`Auto-Submitted`, `X-Autoreply`, odsotnost). Odgovor »odjavite me« / »stop« = odjava. Kdor odgovori in izbere termin, je v »Odzvali« štet enkrat. | ni potrebna |
| **Ponudba odprta** | osebna povezava z žetonom (v poti, ne v parametru) → naš pregledovalnik. »Odprta« pomeni, da je brskalnik prenesel PDF. Izločimo predoglede (po oznaki brskalnika), znane skenerje in prenose iz oblačnih omrežij v prvih minutah po dostavi; naslovi iCloud Private Relay niso izločeni. Beleži strežnik; v brskalniku ne merimo ničesar (ni časa na strani, ni strani). | storitev, ki jo je stranka zahtevala |
| **Sprejem, zavrnitev, vprašanje** | gumbi »Sprejmi ponudbo« / »Ne, hvala« / »Imam vprašanje«. Sprejem se potrdi z drugim klikom na strani za potrditev, ki ga skener ne naredi. Beležimo čas, različico in kontrolno vsoto dokumenta. | storitev |
| **Ponudba potekla** | datum veljavnosti brez odziva | — |
| **Termini** | gumb »Želim termin« vodi na rezervacijo s številko kampanje; stranka se vpiše sama | ni potrebna |
| **Povpraševanja in naročila po e-pošti** | evidenca: povpraševanje znane stranke v **30 dneh po dostavi**, ali prek odgovora, termina ali ponudbe; samo zaključena naročila; vsako se šteje enkrat (zadnji dotik). Besedilo pove »po pošiljanju«, ne »zaradi«. | ni potrebna |
| **Vrnjene stranke** (pri kampanji »Pogrešamo vas«) | evidenca: stranka brez naročila > 12 mesecev, ki je naročila v 30 dneh po pošiljanju | ni potrebna |
| **Nove Google ocene po prošnji** | sprememba števila ocen v Google profilu (Business Profile API) v 14 dneh po prošnji | ni potrebna |
| **Novi kontakti** | evidenca strank in prijavni obrazci | — |
| **Odjave in razlogi** | lasten seznam za vsakega obrtnika. Odjava z enim klikom (POST, RFC 8058), **nikoli ob GET**, ker bi skenerji odjavljali ljudi. Neobvezno vprašanje o razlogu po odjavi. Povezava za odjavo (glava `List-Unsubscribe`) ima žeton obrtnika in prejemnika – samo za odjavo, ne za merjenje. Gmail »Upravljanje naročnin« (od 7/2025) jo uporablja za odjavo z enim dotikom, zato bo odjav nekaj več. Naslovi `@privaterelay.appleid.com` brez registracije domene pri Applu se vrnejo – štejejo kot neveljaven naslov. | — |

Klik na »Pokliči« šteje klik na gumb, ne opravljenega klica. Aplikacija ne vidi klicev na telefonu.

---

## C. Osem vprašanj obrtnika

| # | Vprašanje | Odgovor na strani |
|---|---|---|
| 1 | Ali me vidijo? | »Dostavljeno 142 od 150.« Dostavljeno pomeni, da je strežnik sporočilo sprejel, ne da ga je stranka videla. |
| 2 | Ali me kontaktirajo? | odgovori · termini · kliki na »Pokliči« |
| 3 | Kdo čaka na odgovor? | **ni na tej strani**, je v delu aplikacije za sporočila |
| 4 | Kaj me sprašujejo? | »Kaj vas sprašujejo« iz odgovorov in vprašanj pri ponudbah, od 3 naprej |
| 5 | Kaj deluje najbolje? | najboljša kampanja (po povpraševanjih, nato odgovorih); najbolj kliknjen gumb |
| 6 | Koliko stane, koliko prinese? | vrednost naročil; strošek pošiljanja se ne prikaže (zanemarljiv) |
| 7 | Od kod, za katero delo? | **ni na tej strani** – kraji in vrste dela za vse kanale skupaj so na »Vsi kanali« (pri e-pošti je povpraševanj premalo za svoj modul) |
| 8 | Kaj naj naredim? | **ni na tej strani**; samo »UKREPALI BOMO TAKO« pod moduli |

---

## D. Pregled obstoječe strani

**Čaka na posnetek strani Analitika → E-pošta.** Pri pregledu odstranim ali zamenjam:
- odprtja in »delež odprtih«;
- »prebrano« pri PDF priponki;
- vse klike brez filtra;
- odstotke;
- sezname imen;
- ostanke drugih kanalov;
- napake v slovnici.

---

## E. Enotnost z drugimi kanali

| Modul | Ponovno uporabljen vzorec |
|---|---|
| Kampanje | WhatsApp »Kampanje« (izbira kampanje, rezultati) – **brez predogleda sporočila** |
| Rezultat kampanje | tri osebe: **Dostavljeno → Odzvali (odgovori + termini) → Povpraševanja**, tretja »V TEKU«, kadar naročila še ni |
| Kliki na gumbe | vijolični blok + lestvica (vzorec odzivov pri Facebooku/Instagramu) |
| Kaj vas sprašujejo | Facebook, mreža 2 × 2 |
| Povzetek | enak kot drugje |

Nov modul je samo **»Ponudbe«** (tri pisma: poslane, pogledane, sprejete + vrednost), ker ga drugi kanali nimajo.

---

## F. Stanja

| Stanje | Besedilo |
|---|---|
| ta mesec ni bilo pošiljanja | »Ta mesec nismo pošiljali.« |
| rezultati še prihajajo (< 48 h) | »Rezultati se še zbirajo.« |
| 0 odzivov | »Odzivov še ni.« (brez rdeče) |
| 0 naročil | tretja oseba »V TEKU« |
| zavrnitve ≥ 4 % ali pritožbe ≥ 0,08 % | ena rumena vrstica »Pošiljanje smo začasno ustavili – preverjamo seznam.«; pošiljanje se samodejno ustavi |
| ponudba poslana samo kot priponka | »Odprtij ne vidimo – ponudba je bila poslana samo kot priponka.« |
| starejše od naše hrambe | »Za ta mesec nimamo več podatkov.« |

---

## G. Denar in štetje

- Vrednost samo iz zaključenih naročil.
- Povpraševanje se šteje enkrat v vseh kanalih (zadnji dotik).
- Števila namesto odstotkov (1 od 150 je 0,7 %).
- Kliki so kliki, ne ljudje. Z odgovori se ne seštevajo.
- Pritožbe so »najmanj N«.
- Brez primerjave s panogo. Notranje meje za samodejno ustavitev obrtnik ne vidi.
- **Ne pišemo »zaradi e-pošte«**, ampak »v 30 dneh po e-pošti« – tudi v naslovu glave. Vrnjene stranke so prav tako »po«, ne »zaradi«.
- Klike ne primerjamo z lani kot golo število (odvisno od velikosti seznama); ob številu klikov piše, pri koliko strankah (»pri 142 strankah«).
- Vrednost sprejetih ponudb in vrednost zaključenih naročil sta ločeni številki in se ne seštevata.
- Pri ocenah ne kažemo »povprečje prej → potem« (pri 3 ocenah je to naključje); samo število novih ocen v 14 dneh in trenutno oceno.
- Manj klikov ne pomeni nujno manj zanimanja: Gmail (Gemini povzetki, 2025–26) in Apple Intelligence povzemata sporočila in ljudje lahko ukrepajo brez klika. Glavno merilo ostanejo odgovori in povpraševanja; ključne podatke (telefon, cena, rok) zato pišemo v besedilo.

---

## H. Pravo in dostava

### H.1 Pošiljanje

- **SI, ZEKom-2, 226. člen:** potrebna je privolitev ali izjema za obstoječo stranko za *podobne* storitve. Možnost zavrnitve mora biti ponujena ob zbiranju naslova in v vsakem sporočilu.
- **DE, UWG §7(3):** enaki pogoji. Za nove prijave je dvojna potrditev ustaljena praksa: pri e-pošti, potrjeni z dvojno potrditvijo, mora pošiljatelju dokazovati prejemnik, da privolitve ni dal.
- **BGH VI ZR 225/17 (10. 7. 2018):** prošnja za oceno v e-pošti z računom je oglaševanje. Velja tudi za »ocenite nas« v POS sporočilih v DE.
- **SEU C-654/23 Inteligo Media (13. 11. 2025):** izjemo za obstoječe stranke ureja samo ePrivacy; tudi brezplačna registracija lahko šteje kot prodaja.
- **Vloge:**
  - Obrtnik je upravljavec, mi smo obdelovalec. Z vsakim obrtnikom potrebujemo pogodbo o obdelavi (DPA).
  - Skupni seznam blokiranih naslovov je naša obdelava **[preveri s pravnikom]**.

### H.2 Merjenje

- Odprtja (slikovni sledilnik) zahtevajo privolitev: DE (TDDDG §25), FR (CNIL 2026-042, od 14. 4. 2026; izjem za skupne podatke ni), IT (Garante 284/2026, rok 28. 10. 2026; dovoljena je anonimna skupna statistika). Za SI je osnova ZEKom-2, 225. člen; smernic IP RS ni. **Pri nas se odprtja ne merijo.**
- Kliki z oznako prejemnika: v DE so mnenja deljena; CNIL 2026-042 povezave izrecno izvzema iz svoje priporočila (velja samo za slikovne sledilnike). **Pri nas jih ni**, kliki so na ravni kampanje.
- **Digital Omnibus** (prenos pravil o piškotkih v GDPR, čl. 88a) je oktobra 2026 še v prvi obravnavi; ni zakon in nanj se ne zanašamo.
- Odprtje ponudbe: beleži strežnik ob prenosu dokumenta, ki ga je stranka zahtevala. V brskalniku ne merimo ničesar.

### H.3 Dostava

| Pravilo | Gmail | Yahoo | Microsoft |
|---|---|---|---|
| velja za | > 5.000 na dan na zasebne Gmail naslove (nato trajno) | množične pošiljatelje | > 5.000 na dan na Outlook.com/Hotmail |
| SPF + DKIM + poravnan DMARC | da | da | da (od 5. 5. 2025) |
| odjava z enim klikom (RFC 8058) | da, v 48 h | da, v 2 dneh | ne; zahtevana je delujoča povezava za odjavo |
| meja pritožb | < 0,1 %, nikoli 0,3 % | < 0,3 % | ni objavljena |
| zavračanje | od novembra 2025 trajno (550) | sproti od 2024 | zavrnitev `550 5.7.515` |

Pri nas:
- vsa pravila izpolnimo za vse;
- ločeni poddomeni za račune in ponudbe ter za trženje;
- Google Postmaster Tools API v2 za naše domene (podatki šele pri večji količini). Vsi obrtniki si delijo našo poddomeno, zato pritožbe enega vplivajo na vse – samodejna ustavitev in spremljanje po obrtniku sta obvezna; meja 5.000 na dan se šteje za vse obrtnike skupaj.
- Microsoftova poročila o pritožbah (JMRP) so od 6/2026 v formatu ARF brez naslova prejemnika; preveri, ali Resendov `email.complained` še prepozna prejemnika pri Outlooku **[preveri]**.
- BIMI (logotip in modra kljukica) ne uporabljamo: pokazal bi naš logotip ob obrtnikovem imenu.

### H.4 Pošiljatelj

- **Privzeto:** `"Vodovod Novak" <novak@obvestila.nasaapp.si>`, odgovor na obrtnikov naslov.
- **Nadgradnja:** obrtnikova poddomena z vodenim vnosom DNS.
- **Nikoli:** obrtnikov gmail ali siol naslov kot pošiljatelj, ker DMARC tako sporočilo zavrne.
- **V nogi:** obrtnikov polni naziv in naslov, pri DE impresum, »poslano prek …«, odjava.

---

## I. Napake

### I.1 V obstoječi kodi (POS, samo pregled)

1. `api/_handlers/pos-dostava-webhook.js:162-163` vrne **503** za neznan `email_id`. Če gre nanj trženjska pošta, Resend ponavlja približno 28 ur in webhook na koncu izklopi. S tem se ustavi tudi sledenje računom. Trženje potrebuje **ločen webhook**.
2. Pošiljanju se ne dodajo `tags` (obrtnik, kampanja).
3. Od zavrnitve se ohrani samo `type`, `subType` se izgubi (vrstica 99).

Popravi se pred prvim pošiljanjem trženja; ni del te strani.

### I.2 Na strani

Čaka na posnetek.

---

## J. Zgradba strani (potrjeno s sliko `docs/marketing-predlog/eposta-v6-hd.png`)

1. **Glava:** »V 30 dneh po e-pošti ste dobili 1 naročilo.« · povpraševanja · naročila · vrednost. Opomba: »Povpraševanja in naročila v 30 dneh po pošiljanju, iz vaše evidence.«
2. **Kampanje e-pošte** (brez predogleda e-pošte in brez gumbov):
   - naslov iz podatkov (»Po opomniku za servis sta prišli 2 povpraševanji.«), izbira kampanje;
   - »Dostavljeno 142 od 150«;
   - tri osebe: Dostavljeno → Odzvali (različni ljudje: odgovori + termini) → Povpraševanja; pod njimi »Odzvalo se je 6 strank: 4 so odgovorile, 2 sta izbrali termin.«;
   - zelena vrstica **»Ta kampanja: 1 naročilo · 1.200 €«** (vrednost po kampanji);
   - **»Kaj so stranke kliknile v e-pošti«**: levo vijolični blok (majhne okrogle ikone gumbov, skupno število klikov, »pri 142 strankah«), desno lestvica gumbov. Samo gumbi iz izbrane kampanje, največ 4, ostali v »drugo«;
   - pri kampanji »Pogrešamo vas« še vrstica »Vrnile so se N stranke« (v 30 dneh po pošiljanju).
3. **Ponudbe po e-pošti:** tri pisma – zaprto s puščico (poslane), odprto (pogledane), podpisano (sprejete) – in vrstica »Vrednost sprejetih ponudb«.
4. **Kaj vas sprašujejo v odgovorih** (mreža 2 × 2), od 3 vprašanj naprej.
5. **Prošnja za oceno:** »Po prošnji ste dobili 3 nove ocene.« · v 14 dneh · trenutna ocena.
6. **Povzetek meseca:** vrstice po kampanjah; **Seznam strank: 150 · +12 novih · 3 odjave** (neto, ne pri posamezni kampanji); **Letos iz e-pošte: povpraševanja · naročila · vrednost** (ker je en mesec pogosto 0 ali 1).

**Odstranjeno:** modul »Zdravje seznama«. Ob težavi z dostavo se pokaže ena rumena vrstica: »Pošiljanje smo začasno ustavili – preverjamo seznam.«

**Namenoma ne:** pravi telefonski klici (zahtevajo sledilno številko – kasneje), povprečna vrednost naročila, deleži, posredovanja, »dodatni« prihodek (premajhni seznami).

## K. Popravki glede na različico 1

| Bilo | Zdaj | Zakaj |
|---|---|---|
| »PDF se ne da izmeriti« | PDF kot povezava se izmeri; priponka ne | zavajajoče |
| seznam »Pokličite jih« z imeni | odstranjen | ukrepanje je v drugem delu aplikacije |
| »Kdo čaka na odgovor« | odstranjeno s strani | isto |
| »Kliknili 9 ljudi« in hkrati kliki brez oznake | »kliki na gumbe« na ravni kampanje | protislovje: štetje ljudi zahteva osebno oznako |
| privolitev v sledenje kot pogoj | ni potrebna | stran ne uporablja ničesar, kar jo zahteva |
| odločitve za uporabnika | odstranjene | niso del te strani |
| ponudba: čas na strani, strani, »≥ 2–3 s viden zavihek« | samo prenos dokumenta na strežniku | meritev v brskalniku je lahko poseg v napravo (EDPB 2/2023) |
| »Resend nima odjav po sporočilu« | ima jih v `/emails/metrics` (ne kot webhook) | napačno |
| »Resend pošilja iz Irske« | regija po domeni, privzeto ZDA; izberemo `eu-west-1` | napačno |
| »~50 % odprtij je Apple« | Litmus 7/2026: 62 % sledenih odprtij, globalni vzorec, napihnjen | nenatančno |
| Gmail in Yahoo zavračata od 11/2025 | samo Gmail; Yahoo sproti od 2024 | napačno |
| »velja, ker pošiljamo > 5.000 na dan« | meja je 5.000 na dan na zasebne Gmail (oz. Outlook) naslove | nenatančno |
| Microsoft zahteva RFC 8058 | ne, zahteva delujočo odjavo | napačno |
| BGH I ZR 164/09 za dvojno potrditev | zadeva je o telefonu; dvojna potrditev je praksa | zavajajoče |
| Italija: vedno privolitev | anonimna skupna statistika je dovoljena | nepopolno |
| manjkalo | zavrnjene, potekle ponudbe in ponudbe z vprašanjem; kliki po gumbih; termini; vrnjene stranke; nove Google ocene; pritožbe kot »najmanj«; skenerji pri ponudbah; »stop« v odgovoru = odjava | nepopolno |

## Kontrolni seznam

- [x] A popis Resend (23 dogodkov, poročila, omejitve) + primerjava
- [x] B lastno merjenje
- [x] C osem vprašanj
- [ ] D obstoječa stran: **čaka na posnetek**
- [x] E enotnost
- [x] F stanja
- [x] G denar in štetje
- [x] H pravo in dostava
- [~] I napake: koda pregledana, stran čaka na posnetek
- [x] J zgradba in slika (`eposta-v6-hd.png`)
- [x] Zadnji pregled: primerjava z 10 orodji (Mailchimp, Brevo, MailerLite, Klaviyo, Constant Contact, Square, Jobber, Housecall Pro, ServiceTitan, ActiveCampaign) in spremembe Gmail/Apple/Outlook/Yahoo 2024–2026
- [x] Na strani ni seznamov za ukrepanje, nobena trditev ni nepreverjena brez oznake, za uporabnika ni nobene odločitve.
