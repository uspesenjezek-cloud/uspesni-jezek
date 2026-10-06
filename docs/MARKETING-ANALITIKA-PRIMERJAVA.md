# Marketing analitika — primerjava obstoječega stanja z raziskavo

Datum: 6. 10. 2026.

Vhod sta dva dokumenta:
- lokalni popis obstoječih strani Facebook, WhatsApp, Instagram in TikTok (vzorčni podatki, lokalni projekt, veja `agent/resend-safe-test-mode`);
- `docs/MARKETING-ANALITIKA-RAZISKAVA.md`.

To je analiza in predlog. Kode ne spreminja in ne pomeni dovoljenja za implementacijo.

---

## 1. Splošna ocena

### Kaj je dobro in ostane

- **Poštenost podatkov** je pravilno zasnovana:
  - »Ni podatka« ni 0;
  - klik na »Pokliči« ni opravljen klic;
  - samodejni pozdrav ne šteje kot odgovor;
  - deduplikacija istega človeka med kanali;
  - »Neznan vir« ostane ločen;
  - vrednost ponudb ni dobiček.

  To je močnejše od večine orodij na trgu. Ta pravila ostanejo v podatkovnem sloju.
- **Glavna ideja** »Kanal X vam je prinesel N naročil« je pravilna. To je edina številka, ki obrtnika res zanima. Izvira iz naše evidence (povpraševanja, ponudbe, naročila), ne iz platforme. Zato je pod našim nadzorom in je najdragocenejši del sistema.
- **»Kaj vas ljudje sprašujejo«** (Facebook) je izjemno uporabno za obrtnika in ga drugi ne ponujajo.
- **Ogledi do konca** pri videih in **kontaktni kliki** na profilu so pravilno izbrane platformne metrike.

### Kaj je narobe

1. **Prenasičenost.** Facebook ima 7 sklopov, Instagram 9, WhatsApp 7, TikTok 7+. Vsak ima 3–6 številk in dva razlagalna odstavka. Obrtnik na telefonu tega ne prebere.
2. **»KAJ VIDIMO / UKREPALI BOMO TAKO« na vsaki kartici** se ponavlja in je splošen: »Preverimo …«, »Spremljamo …«, »Prilagodimo …«. Obrtniku ne pove nič novega. Bolje je en konkreten stavek na kanal.
3. **Opozorila so napisana za razvijalca ali revizorja, ne za obrtnika.** Primeri:
   - »Ogledi niso različni ljudje in ne dokazujejo povpraševanja. Odziva oglasov ne prištevamo.«
   - »Vsako povpraševanje se šteje enkrat, tudi če stranka piše na več mestih.«

   Pravila naj veljajo v kodi. Na zaslonu je največ ena kratka opomba na stran.
4. **Sklopi, ki jih platforme ne dajo ali so na meji:**
   - kraji sledilcev (FB je metriko verjetno ukinil; prag 100);
   - kraj iz naslova v WhatsApp pogovoru;
   - statistika zgodb (API jo hrani 24 ur);
   - »ogledano do konca« pri FB oglasu.
5. **Sklopi z nizko uporabnostjo za obrtnika:**
   - časovna mreža »Kdaj vam pišejo« (odgovore vodimo mi, ne obrtnik);
   - kraji sledilcev (sledilec ni stranka);
   - zgodbe kot ločen sklop;
   - povzetek meseca, ki večinoma kaže »Ni podatka« in ponavlja glavo.
6. **Manjkajo ključne platformne številke, ki jih API zanesljivo da:**
   - FB: obiski strani in novi sledilci;
   - IG in TikTok: novi sledilci;
   - FB: ocene/priporočila;
   - TikTok: klik na telefon.
7. **Napake** (§4).

---

## 2. Predlagana enotna zgradba kanala

Ista zgradba za vse kanale, zato se jo obrtnik nauči enkrat. Na telefonu največ **4 sklopi**:

| # | Sklop | Vsebina | Vir |
|---|---|---|---|
| 1 | **Glava** | »<Kanal> vam je ta mesec prinesel N naročil.« · povpraševanja · naročila · (poraba, če oglašujemo) · primerjava s prejšnjim mesecem v besedah | naša evidenca + oglasni API |
| 2 | **Kako so vas našli in kontaktirali** | ena številka »Videli so vas« + 2–3 kontaktne številke (sporočila, klik Pokliči, klik Pot/Povezava) + **»N čaka na odgovor«** kot opozorilo | platformni API + naši webhooki |
| 3 | **Kaj je delovalo** | **ena** najboljša objava/video/kampanja + **top 3 vprašanja strank** | platformni API + naše sporočila |
| 4 | **Naš naslednji korak** | en konkreten, iz podatkov izpeljan stavek (namesto 6× KAJ VIDIMO/UKREPALI) | pravila (raziskava §2.4) |

Vse ostalo gre pod **»Podrobnosti«** (zaprto) ali se odstrani. Mesečni izbirnik ostane povsod enak, tudi pri WhatsAppu.

---

## 3. Po kanalih: obdrži / združi / odstrani / dodaj

### Facebook

| Obstoječe | Odločitev | Razlog |
|---|---|---|
| Glava (doseg, povpraševanja, naročila, poraba, vrednost) | **Obdrži**. »Ocenjen doseg oglasa« zamenjaj z **»Videli so vas«**: oglasni `reach` ali organski `page_total_media_view_unique`, z jasno oznako. | jedro |
| `fbOglas` (kliki, pogovori, Pokliči) | **Združi** v sklop 2. Iz oglasa ostaneta pogovori in Pokliči; »vsi kliki« odstrani. | vsi kliki so šum |
| `fbVpr` vprašanja | **Obdrži seznam top 3 vprašanj** (sklop 3). Odzivni čas in »čaka« premakni v sklop 2. Razčlenitev 9/3/2 po vrsti vira odstrani. | zelo uporabno |
| `fbNaj` oglas + objava | **Obdrži eno** (najboljšo po `post_media_view` ali pogovorih). »Ogledano do konca« pri oglasu odstrani. | API ne da zanesljivo |
| `fbKr` kraji sledilcev | **Odstrani** (ali le v Podrobnosti). | metrika ukinjena ali negotova; sledilec ≠ stranka |
| `ak` časovna mreža | **Odstrani** z obrtnikovega pogleda; lahko ostane v našem admin pogledu. | ni dejanja za obrtnika |
| Povzetek meseca | **Odstrani**; podatki so že v glavi. | podvajanje |
| — | **Dodaj**: obiski strani (`page_views_total`), novi sledilci (`page_daily_follows_unique`), priporočila/ocena (`/ratings`). | zanesljivo v API |

### Instagram

| Obstoječe | Odločitev | Razlog |
|---|---|---|
| Glava | **Obdrži**; »doseženih računov« → »Videli so vas« (`reach`). | jedro |
| `ig1` sporočila in viri | **Poenostavi**: »N pogovorov · N čaka«. Vire (oglas/zgodba/objava/neposredno) v Podrobnosti. | `referral` / `reply_to` deluje, a je preveč za glavni pogled |
| `ig2` kontaktni kliki | **Obdrži** (sklop 2): Pokliči · Pot · E-pošta · Povezava (`profile_links_taps` + naša preusmeritev). | najboljša IG metrika |
| `ig3` objave in reels | **Obdrži eno** najboljšo: ogledi + klik Pokliči/obisk profila. Shranitve in povprečen ogled v sekundah odstrani. | shranitve obrtniku ne povedo, kaj narediti |
| `ig5` zgodbe | **Odstrani** kot ločen sklop. | API 24 h; nizka vrednost |
| `ig6` kraji sledilcev | **Odstrani** (ali v Podrobnosti). | sledilec ≠ stranka; samo `this_month` |
| `igAds` | **Združi** v glavo (poraba) in sklop 2 (pogovori iz oglasa). | podvaja 70 € iz glave |
| `ak` časovna mreža | **Odstrani**. | kot pri FB |
| Povzetek | **Odstrani**. | podvajanje |
| — | **Dodaj**: novi sledilci (`follows_and_unfollows`). | zanesljivo |

### WhatsApp

| Obstoječe | Odločitev | Razlog |
|---|---|---|
| Glava | **Obdrži**; dodaj **mesečni izbirnik**; popravi podnaslov. | neskladje z drugimi kanali |
| `wa1` ljudje in viri | **Obdrži v skrajšani obliki**: »Pisalo vam je N ljudi, od tega N novih« + največ 3 viri. | izvedljivo s Coexistence + `referral` + `wa.me?text=` kodami za splet/QR |
| `wa2` hitrost odgovora | **Obdrži**: »Prvi odgovor v X min · N čaka«. | najbolj uporabna WA številka; izračunamo sami |
| `wa3` kampanje | **Obdrži** izbirnik kampanj, a samo izid: »poslano N · odgovorilo N · povpraševanja N · naročila N«. Predogled telefona lahko ostane. | `template_analytics` + naša evidenca |
| `waKr` kraji iz naslova v pogovoru | **Odstrani**. | ni iz platforme; krhko razbiranje iz besedila |
| `ak` statična mreža | **Odstrani**. | ni izračunana iz podatkov in je v nasprotju z naslovom |
| Povzetek | **Odstrani** (primerjava je v glavi). | podvajanje |
| Strošek sporočil | Obrtniku pokaži samo, če ga plača on; sicer samo v admin pogledu. | od 1. 10. 2026 plačljivo |

**Tehnični pogoj:** brez WhatsApp Business Platform s Coexistence teh številk ni. Brezplačna aplikacija nima API-ja. Dokler številka ni povezana, je pravilen prikaz povabilo »Povežite WhatsApp«, ne vzorec.

### TikTok

| Obstoječe | Odločitev | Razlog |
|---|---|---|
| Glava | **Obdrži**; dodaj »Videli so vas« (`video_views`). | jedro |
| `ttResponse` | **Združi** v sklop 2: ogledi · obiski profila · klik Povezava/Pokliči (Registered Business Account) · novi sledilci. | `phone_number_clicks` in `daily_new_followers` manjkata |
| `ttVideos` | **Obdrži**, a privzeto samo najboljši video (ogledi + »X % do konca«). Ostali pod »Pokaži več«. | dobra izbira metrik |
| `ttAds` | **Obdrži v skrajšani obliki**: »Porabljeno X € · prineslo N kontaktov«. | jasno |
| Kraji in storitve iz evidence | **Prestavi v skupni pregled »Vsi kanali«** (velja za vse kanale, ne samo za TikTok). | ni specifično za TikTok |
| Splošna primerjava in povzetek | **Odstrani**; primerjava je v glavi. | ostanek predloge |

---

## 4. Napake v obstoječem stanju (popraviti ne glede na prenovo)

1. **TikTok ne izriše strani:** `KRAJI_PRIZOR` ni definiran → `TypeError … 'razlicne'` v `places()` (`analitika-tiktok.js:197`). Zaradi tega se ne prikažejo videi, oglasi, kraji in povzetek; ostanejo kartice splošne predloge (Google/Instagram/Priporočila); izbirnik meseca se ne zapre. Popravek je prehod na `HouseSceneEngine` kot pri drugih kanalih, ali pa odstranitev sklopa po §3.
2. **WhatsApp podnaslov** pravi »vsi kanali skupaj«.
3. **WhatsApp časovna mreža** je statična in v nasprotju z naslovom.
4. **Meja mesecev je trdo kodirana**: FB in IG do septembra, TikTok do oktobra. Biti mora izpeljana iz zadnjega zaključenega meseca.
5. **Slovnica števil:** »1 povpraševanja«, »0 potrjena naročila«, »1 pogovorov«, »2 pogovori«, »1 potrjena naročila«. Potrebna je skupna funkcija za dvojino in množino (1/2/3–4/5+).
6. **Različni vzorci za isti kanal** (WhatsApp 3 proti 2 v skupni evidenci; Instagram avgust). Ob prehodu na prave podatke mora vse brati iz ene evidence.
7. **Stanje podatkov ni usklajeno:** FB podrobnosti 14. 9., ostalo 30. 9. Vsi sklopi enega kanala naj imajo isti datum stanja.

---

## 5. Kaj platforme dejansko omogočajo za predlagane številke

| Številka | FB | IG | TikTok | WhatsApp |
|---|---|---|---|---|
| Videli so vas | `page_total_media_view_unique` / ads `reach` | `reach` | `video_views` | — |
| Obiski profila/strani | `page_views_total` | `profile_visits` (objave) **[preveri račun]** | `profile_views` | — |
| Novi sledilci | `page_daily_follows_unique` | `follows_and_unfollows` | `daily_new_followers` | — |
| Klik Pokliči/Pot/E-pošta | samo skupaj `page_total_actions` | `profile_links_taps` × tip | `phone_number_clicks`, `address_clicks`, `email_clicks` (Registered Business) | — |
| Pogovori, čaka, odzivni čas | naši Messenger webhooki | naši IG webhooki | — | naši webhooki (Coexistence) |
| Najboljša vsebina | `post_media_view` | media `views` | `video_views` + `full_video_watched_rate` | template `READ`/`CLICKED` + odgovori |
| Povpraševanja, naročila, vrednost | **naša evidenca** | **naša evidenca** | **naša evidenca** | **naša evidenca** |
| Poraba | Meta Ads `spend` | Meta Ads `spend` | TikTok Ads `spend` | `pricing_analytics` |

Pragovi:
- FB statistika strani zahteva 100+ sledilcev.
- Demografija zahteva 100+ sledilcev na vseh platformah.
- TikTok zgodovina je 60 dni, zato shranjujemo dnevne posnetke.

---

## 6. Predlagani vrstni red dela (če ga uporabnik odobri)

1. Popraviti napake iz §4 (TikTok izris najprej), brez spreminjanja dizajna.
2. Na enem kanalu (predlog: Facebook) izvesti zgradbo iz §2 in jo potrditi na telefonu (390 px in 320 px).
3. Ko je potrjena, enako preslikati na Instagram, TikTok in WhatsApp.
4. Šele nato povezave z API-ji (odobritve Meta, TikTok, Google; WhatsApp Coexistence) in dnevni posnetki v Supabase.
