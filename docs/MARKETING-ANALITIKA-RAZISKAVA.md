# Marketing analitika za obrtnike — raziskava in priporočen nabor podatkov

Stanje: 6. 10. 2026. Viri: uradna dokumentacija Meta, WhatsApp, TikTok in Google (večinoma prek iskalnih izvlečkov, ker je bil neposreden dostop do strani blokiran). Točna imena metrik pred implementacijo preveri v živi dokumentaciji. Postavke z oznako **[preveri]** niso bile potrjene iz uradnega vira.

---

## 0. Bistvo v treh stavkih

1. Obrtnika zanima samo eno vprašanje: **»Ali me ljudje najdejo in ali me kontaktirajo?«** Vse drugo je šum.
2. Zato vsak kanal pokaže največ **4–5 številk** po lestvici **Videli → Zanimanje → Stik**, plus **najboljšo objavo** in **eno priporočilo**.
3. Najbolj dragocena in najbolj zanesljiva številka so **stiki**: klici, sporočila, poti, povpraševanja. Ogledi in všečki so samo kontekst.

---

## 1. Kaj platforme dejansko ponujajo (povzetek raziskave)

### 1.1 Facebook stran (Page Insights API, Graph API v26)

Meta je v letih 2024–2026 odstranila veliko metrik. Stara navodila in Codexova koda, ki uporablja `page_impressions`, `page_fans`, `*_unique` reach ali ločene klike na klic/pot/splet, **ne delujejo več**.

| Še na voljo | Pomen |
|---|---|
| `page_media_view` | ogledi vsebine (zamenja impressions, od 11/2025) |
| `page_total_media_view_unique` | koliko različnih ljudi je videlo (zamenja reach, od 6/2026) |
| `page_views_total` | obiski strani/profila |
| `page_follows`, `page_daily_follows_unique` | sledilci skupaj / novi sledilci |
| `page_total_actions` | kliki na kontakt in gumb CTA — **samo skupaj**, brez delitve na klic/pot/splet |
| `page_post_engagements` | odzivi na objave |
| `post_media_view`, `post_total_media_view_unique`, `post_clicks` | po objavi |
| `/{page-id}/ratings` | priporočila in ocena strani |

Omejitve:
- Statistika strani je na voljo šele pri **100+ sledilcih**.
- Demografija prav tako zahteva 100+ ljudi, prikaže pa največ 45 mest/držav.
- Zgodovina sega 2 leti nazaj, en klic pa pokrije največ ~90 dni.
- Odstranjeno brez nadomestila: delitve dosega (plačano/organsko/viralno), unikatni ogledi videa, ločeni kliki na klic/pot/splet (od 3/2024).
- Sporočila v Messengerju niso več metrika. Štejemo jih sami prek Conversations API ali webhookov.
- Neveljavna metrika zavrne **celoten** zahtevek, zato je treba metrike zahtevati posamično ali s fallbackom.

### 1.2 Instagram (profesionalni račun)

| Na voljo | Pomen |
|---|---|
| `views` | ogledi (zamenja impressions/plays od 4/2025) |
| `reach` | različni ljudje, ki so videli |
| `profile_links_taps` × `contact_button_type` | **kliki na klic, e-pošto, SMS, pot, rezervacijo** |
| `follows_and_unfollows`, `follower_count` | novi/izgubljeni sledilci (100+ sledilcev) |
| `total_interactions`, `likes`, `comments`, `shares`, `saves` | odzivi |
| media: `views`, `reach`, `profile_visits`, `follows`, `ig_reels_avg_watch_time` | po objavi in reelsu |
| `follower_demographics` | starost/spol/mesto, samo `this_week`/`this_month`, 100+ sledilcev |

Omejitve:
- Odstranjeni sta stari metriki `phone_call_clicks` in `get_directions_clicks` (1/2025). Nadomestek je `profile_links_taps`.
- Statistika zgodb je v API **samo 24 ur**, zato jo je treba zajeti sproti.

### 1.3 WhatsApp

Brezplačna aplikacija WhatsApp Business nima API-ja za statistiko. Njeni štirje števci (poslano, dostavljeno, prebrano, prejeto) niso dosegljivi.

Rešitev je **WhatsApp Business Platform s Coexistence**. Obrtnik obdrži aplikacijo na telefonu, mi pa prejemamo webhooke:
- dohodna sporočila;
- statuse `sent`/`delivered`/`read`/`failed`;
- `smb_message_echoes` za sporočila, ki jih obrtnik pošlje s telefona;
- enkratni uvoz do 6 mesecev zgodovine.

Velja za EU **[preveri dostopnost za SI/DE]**.

Meta sama ponuja:
- `analytics`: poslano, dostavljeno;
- `pricing_analytics`: količina in strošek;
- `template_analytics`: sent, delivered, read, clicked, 90 dni nazaj;
- oceno kakovosti številke;
- podatke `referral` o tem, s katerega oglasa je prišlo sporočilo.

**Najbolj uporabne metrike izračunamo sami** iz webhookov: nova povpraševanja, odzivni čas, neodgovorjeni pogovori, vir povpraševanja.

Stroški:
- Od 1. 10. 2026 so servisna sporočila plačljiva po 1000 brezplačnih na številko na mesec.
- Okvirne cene marketinških sporočil: DE ~0,11 €, SI ~0,07 € **[preveri]**.

Pravo: za marketinška sporočila je obvezna predhodna privolitev (DE: UWG §7; SI: ZEKom-2, 226. člen).

### 1.4 TikTok

Uporabiti je treba **Business API – Accounts API**. Display API daje samo skupne števce brez zgodovine.

Za dostop je od 20. 3. 2026 obvezen še obrazec »Accounts API Access Application« in pregled aplikacije.

| Račun (dnevno) | Video |
|---|---|
| `video_views`, `profile_views`, `likes`, `comments`, `shares` | `video_views`, `reach`, `likes`, `comments`, `shares` |
| `daily_new_followers`, `daily_lost_followers` | `average_time_watched`, `full_video_watched_rate` |
| `bio_link_clicks`, `phone_number_clicks`, `email_clicks`, `address_clicks`, `lead_submissions` (samo **Registered Business Account**) | `impression_sources`, `new_followers`, enaki kontaktni kliki |
| `audience_*` (100+ sledilcev) | `audience_countries/cities` (top 10) |

Omejitve:
- Zgodovina na ravni računa je **največ 60 dni**, zato podatke shranjujemo dnevno.
- Zamik podatkov je 24–48 ur.
- Statistika videa se po 365 dneh ne posodablja več.

### 1.5 Splet in Google

**Google profil podjetja (Performance API)** je najbolj zanesljiv vir za lokalnega obrtnika. Podatke meri Google, zato nanje ne vplivajo piškotki.
- `BUSINESS_IMPRESSIONS_*` (Iskanje/Zemljevidi, mobilno/namizno), `CALL_CLICKS`, `WEBSITE_CLICKS`, `BUSINESS_DIRECTION_REQUESTS`.
- Iskalni izrazi na mesec. Majhne vrednosti se prikažejo kot »<15«.
- Ocene prek API v4: povprečje, število, nove, brez odgovora.
- Zamik podatkov je 3–5 dni.
- Dostop zahteva enkratno odobritev Google (profil mora biti potrjen vsaj 60 dni in imeti spletno stran).

**Search Console** pokaže, s katerimi iskanji ljudje najdejo stran: kliki, prikazi, CTR, pozicija. Zgodovina sega 16 mesecev.

**GA4** v EU zaradi zavrnjenih piškotkov pogosto vidi **manj kot polovico** obiskovalcev. Modeliranje privolitev za majhne strani ne deluje (prag je 1000 uporabnikov na dan).
- Klik na telefon in poslan obrazec nista samodejna, ampak ju mora stran poslati kot dogodek.
- Boljše: povpraševanja iz obrazca štejemo v **lastnem backendu**, obisk pa s strežniškim števcem brez piškotkov.

**Oglasi**:
- Google Ads: strošek, kliki, klici, konverzije.
- Lokalne storitve (LSA) so na voljo v **Nemčiji**, v Sloveniji ne.
- Meta Ads: `spend`, `reach`, `actions` (lead), `cost_per_action_type`. Lead obrazci se brišejo po 90 dneh.
- TikTok Ads: `spend`, `impressions`, `clicks`, `conversion`, `cost_per_conversion`.

---

## 2. Priporočen nabor za obrtnika

### 2.1 Načela

1. **Vsaka številka mora odgovoriti na vprašanje, ki si ga obrtnik zastavi sam.** Če obrtnik po pogledu nanjo ne ve, kaj narediti, je ne pokažemo.
2. **Lestvica Videli → Zanimanje → Stik** je enaka v vseh kanalih, zato se obrtnik nauči brati en vzorec.
3. **Primerjava s prejšnjim obdobjem v besedah**, npr. »12 več kot septembra«. Brez odstotnih točk in brez grafov z dnevnimi nihanji. Privzeto obdobje je mesec, izbirna je zadnjih 7 dni.
4. **Stiki se seštevajo, ogledi ne.** Ogledi na različnih platformah merijo različne stvari, zato jih med kanali ne seštevamo. Klice, sporočila, poti in povpraševanja pa lahko pošteno seštejemo.
5. **Ničle ne izmišljujemo.** Če platforma podatka ne da (manj kot 100 sledilcev, nepotrjen poslovni račun), napišemo zakaj, npr. »Statistiko pokaže Facebook, ko imate 100 sledilcev«, in ne prikažemo 0.
6. **En nasvet, ne deset.** Na koncu vsakega kanala je največ eno konkretno priporočilo.
7. Brez strokovnih izrazov: ne CTR, ne CPM, ne engagement rate, ne impressions.

### 2.2 Skupni pregled (vrh strani Analitika)

| Prikaz | Vir |
|---|---|
| **Stopili so v stik: N** (+/− glede na prejšnji mesec), razbito na klici · sporočila · poti · povpraševanja | vsota kontaktnih metrik vseh kanalov |
| **Najbolj vam prinaša: <kanal>** | kanal z največ stiki |
| **Ocena: 4,8 ★ (N ocen), X novih, Y brez odgovora** | Google ocene (+ Facebook priporočila) |
| **Za ta teden priporočamo: …** | eno pravilo iz §2.4 |

### 2.3 Po kanalih

Struktura vsakega kanala: **Videli · Zanimanje · Stik · Najboljše · Nasvet**.

**Google in splet**
- Videli: *Prikazali smo vas v Googlu* (vsota `BUSINESS_IMPRESSIONS_*`), ločeno Iskanje / Zemljevidi.
- Zanimanje: *Obiski spletne strani* (strežniški števec ali `WEBSITE_CLICKS` + GSC kliki).
- Stik: *Klici* (`CALL_CLICKS`), *Poti do vas* (`BUSINESS_DIRECTION_REQUESTS`), *Povpraševanja z obrazca* (lasten backend).
- Najboljše: *Tako so vas iskali*: top 3–5 iskalnih izrazov (GBP keywords ali GSC `query`).
- Ocene: povprečje, nove, **brez odgovora** (to je opravilo).

**Facebook**
- Videli: *Ljudje, ki so vas videli* (`page_total_media_view_unique`).
- Zanimanje: *Obiski strani* (`page_views_total`), *Novi sledilci* (`page_daily_follows_unique`).
- Stik: *Kliki na kontakt* (`page_total_actions`; podrobnosti ni) + *Sporočila* (naš števec iz Messengerja, če je povezan).
- Najboljše: objava z največ `post_media_view`, s sličico.

**Instagram**
- Videli: *Ljudje, ki so vas videli* (`reach`).
- Zanimanje: *Obiski profila* (vsota `profile_visits` iz objav **[preveri metriko na ravni računa]**), *Novi sledilci*.
- Stik: *Klici · E-pošta · Pot · Spletna stran* (`profile_links_taps` po `contact_button_type`).
- Najboljše: objava ali reel z največ `views`.

**TikTok**
- Videli: *Ogledi videov* (`video_views`).
- Zanimanje: *Obiski profila* (`profile_views`), *Novi sledilci* (`daily_new_followers`).
- Stik: *Klici · E-pošta · Naslov · Povezava* (samo Registered Business Account; sicer razlaga, kako to vklopiti).
- Najboljše: video z največ ogledi + *»X % ljudi ga je gledalo do konca«* (`full_video_watched_rate`). To je edina metrika gledanosti, ki je obrtniku razumljiva in uporabna.

**WhatsApp**
- Stik: *Nova povpraševanja* (prvo sporočilo nove številke ali po 30 dneh tišine).
- *Povprečno ste odgovorili v: X min* (mediana).
- **Čakajo na odgovor: N** (opravilo, s klikom v pogovor).
- *Od kod so prišli*: oglas / spletna stran / QR koda / drugo (`referral`, predizpolnjeno besedilo `wa.me`).
- Samo če obrtnik pošilja obvestila: *Poslano · Prebrano* z opombo, da vsi ne vklopijo potrdil o branju.

**Oglasi** (samo če jih vodimo mi)
- *Porabljeno: X €*, *Prinesli so: N stikov*, *Cena enega stika: X €*. Nič drugega.

### 2.4 Pravila za priporočila (primeri)

| Pogoj | Nasvet |
|---|---|
| ocene brez odgovora > 0 | »Odgovorite na N ocen — to vpliva na vaš položaj v Googlu.« |
| WhatsApp čaka > 0 | »N strank čaka na odgovor.« |
| ni objave > 14 dni na kanalu | »Že X dni niste objavili. Objavite fotografijo zadnjega dela.« |
| najboljša objava je »pred/po« ali video dela | »Objave s fotografijo končanega dela delujejo pri vas najbolje.« |
| TikTok/IG ima ogledi, a 0 kontaktnih klikov | »Dodajte telefon na profil.« |
| Google profil: veliko prikazov, malo klicev | »Dodajte fotografije in delovni čas na Google profil.« |

### 2.5 Česa namenoma NE prikazujemo obrtniku

- Impressions in reach hkrati: pokažemo samo eno številko »videli«.
- Engagement rate, CTR, CPM, CPC, frekvenca, pozicija v Googlu na decimalko.
- Demografija (starost/spol): pri lokalnem obrtniku je redko uporabna in pogosto prazna pod 100 sledilci. Lahko je v razširjenem pogledu.
- Krivulje gledanosti, viri prikazov na TikToku, navigacija zgodb, aktivne ure sledilcev.
- Ocena kakovosti WhatsApp številke, stroški po kategorijah sporočil. To je za naš admin pogled; obrtniku samo opozorilo, če je problem.
- GA4 seje, stopnja odboja, naprave.
- Dnevni grafi. Namesto njih je mesečni trend z največ 6 stolpci.

---

## 3. Tehnične posledice (za implementacijo)

1. **Dnevni posnetki v naši bazi so obvezni**:
   - TikTok hrani samo 60 dni;
   - IG zgodbe so dostopne 24 ur;
   - FB klic pokrije 90 dni;
   - Meta leadi se brišejo po 90 dneh;
   - GSC hrani 16 mesecev.
2. **Vsaka metrika posebej z obravnavo napake**, ker Meta neveljavno metriko zavrne skupaj z vsem zahtevkom.
3. **Stanje »ni podatka« ≠ 0.** Shranjujemo razlog: `prag_sledilcev`, `ni_poslovnega_racuna`, `ni_povezano`, `napaka_vira`.
4. **Ločena napaka vira od napake aplikacije** (AGENTS.md).
5. Enkratne odobritve, ki jih potrebujemo kot podjetje:
   - Meta App Review + Business Verification (`read_insights`, `pages_read_engagement`, `instagram_manage_insights`, `whatsapp_business_management`, `ads_read`);
   - Google Business Profile API obrazec;
   - TikTok Accounts API obrazec + app review;
   - Google Ads (Cloud projekt + preverjanje znamke).
6. GDPR: pogodba o obdelavi (DPA) z obrtnikom, rok hrambe sporočil, brisanje ob odklopu računa.

---

## 4. Viri (izbor)

- Meta Page Insights: developers.facebook.com/docs/graph-api/reference/insights/ ; deprecations: developers.facebook.com/blog/post/2025/08/15/page-insights-api-updates/ ; junij 2026: docs.supermetrics.com/docs/facebook-insights-field-changes-june-30-2026
- Instagram: docs.emplifi.io/platform/latest/home/instagram-insights-metrics-deprecation-april-2025 ; docs.supermetrics.com/docs/instagram-insights-field-changes-december-11-2024
- WhatsApp: developers.facebook.com/documentation/business-messaging/whatsapp/analytics/ ; …/pricing ; docs.360dialog.com/partner/onboarding/whatsapp-coexistence/coexistence-webhooks
- TikTok: business-api.tiktok.com/portal/docs/organic-api/v1.3 ; developers.tiktok.com/doc/tiktok-api-v2-get-user-info
- Google: developers.google.com/my-business/reference/performance/rest/v1/DailyMetric ; developers.google.com/webmaster-tools/v1/searchanalytics/query ; support.google.com/analytics/answer/11161109
