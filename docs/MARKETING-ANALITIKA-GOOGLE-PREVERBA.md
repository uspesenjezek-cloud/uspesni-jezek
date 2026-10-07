# Marketing → Analitika → Google: preverba podatkov v obstoječih modulih

Datum: 6. 10. 2026.

Vhod je posnetek strani `analitika.html?kanal=google` (september 2026, vzorčni podatki).

Pravilo: **dizajn in moduli ostanejo, spreminjajo se samo podatki in besedila v njih.** Novih modulov ne dodajamo.

---

## Kontrola računov v vzorcu (vse se ujema)

- 810 (Maps) + 470 (Iskanje) = 1.280 ogledov; 63 % / 37 % ✔
- 31 (spletna stran) + 9 (Pokliči) = 40 klikov ✔
- 5 povpraševanj iz oglasov + 3 iz profila = 8 v glavi ✔; 2 + 1 = 3 naročila ✔; avgust 6 / 2 → +2 / +1 ✔
- ocene 30 + 5 + 1 + 0 + 2 = 38; povprečje 175 / 38 = 4,61 → 4,6 ✔

---

## 1. Glava

| Kaj | Stanje | Sprememba |
|---|---|---|
| »1.280 ogledi Google profila« | slovnica | → **»1.280 ogledov Google profila«** |
| »8 povpraševanja« | slovnica | → **»8 povpraševanj«** (1 povpraševanje, 2 povpraševanji, 3–4 povpraševanja, 5+ povpraševanj) |
| Ogledi profila | vir je `BUSINESS_IMPRESSIONS_*` (Maps + Iskanje, mobilno + namizno) | ostane. Google podatke objavi z zamikom 3–5 dni, zato za tekoči mesec dodaj »stanje do <datum>«. |
| Vrednost naročil »Ni podatka« | — | vir je lahko **naš POS / sprejete ponudbe** za ta naročila, ko je naročilo povezano s ponudbo ali računom |
| Poraba 140 € | Google Ads `metrics.cost_micros` | ostane |

## 2. Vaš Google profil

| Kaj | Stanje | Sprememba |
|---|---|---|
| Naslov »… – 40 klikov **na povezave**« | klic ni povezava | → **»40 klikov za stik«** ali »40 ljudi je kliknilo na stik« |
| 31 klikov na spletno stran | `WEBSITE_CLICKS` | ostane |
| 9 klikov na »Pokliči« | `CALL_CLICKS` | ostane (šteje samo pritiske, večinoma na telefonu; opozorilo v KAJ VIDIMO je pravilno) |
| Maps / Iskanje razdelitev | vsota DESKTOP + MOBILE | ostane |
| **Poti do vas** | API jo daje (`BUSINESS_DIRECTION_REQUESTS`) | izbirno: v obstoječi oblaček ali vrstico »Ogledi profila« dodaj kot tretjo vrednost **samo, če je > 0**. Za obrtnika, ki hodi k strankam, je navadno nizka. |

## 3. Iskalni izrazi — **potreben popravek podatkovnega modela**

Vir je `searchkeywords.impressions.monthly`. Google vrne **število ljudi na izraz na mesec**. Izraze z manj kot ~15 ljudmi vrne samo kot prag »<15«, brez točne številke.

Težave v obstoječem prikazu:
1. **Odstotki niso izračunljivi**, ko so nekateri izrazi pod pragom. Vzorec sam je v nasprotju z virom: 8 % od 140 = 11, takšne vrednosti pa Google ne vrne, ampak vrne »<15«.
2. **»140 prikazanih iskanj«** ni prava enota. To je vsota ljudi po izrazih: ista oseba lahko šteje pri dveh izrazih, skriti izrazi pa niso všteti.

Sprememba (isti modul, isti stolpci):
- namesto **42 % / 31 % / 19 % / 8 %** prikaži **število ljudi**: »59«, »43«, »27«, za skrite pa **»<15«**;
- naslov: **»Največ vas iščejo s krajem.«**, brez skupne številke. Lahko tudi »Tako so vas iskali septembra.«;
- barvni pas oziroma dolžina ostane, izračuna pa se iz števila ljudi (prag se izriše kot najkrajši);
- opomba pod seznamom je pravilna: »Izraze z zelo malo iskanji Google skrije …«.

Razvrstitev v skupine (Storitev + kraj, Samo storitev, Vaše ime, Nujno) je **naša** in je zelo dobra. Ostane. »Vaše ime« pove, koliko ljudi vas že pozna.

## 4. Google ocene — ODSTRANI iz analitike

> **Odstranjeno (7. 10. 2026):** modul »Vse Google ocene« se iz Marketing → Analitika → Google **odstrani**. Ocene, razdelitev, zadnje ocene in »čaka na odgovor« so v **Ugledu podjetja**. Spodnja tabela velja samo še kot vir za Ugled podjetja.

| Kaj | Stanje | Sprememba |
|---|---|---|
| 4,6 · 38 ocen · razdelitev 5–1 | API v4 `averageRating`, `totalReviewCount`, `starRating` | ostane |
| »+2 v septembru« | iz `createTime` | ostane |
| Naslov »Stranke vas hvalijo – 4,6 ★« | trdo pozitiven | naslov naj bo **odvisen od ocene**: ≥ 4,5 »Stranke vas hvalijo«, 4,0–4,4 »Stranke so zadovoljne«, < 4,0 »Ocene lahko izboljšamo« |
| **Ocene brez odgovora** | API daje (`reviewReply` manjka) | v obstoječo vrstico »ZADNJE OCENE« (desno, kjer je »+2 v septembru«) ali pod oceno dodaj **»1 čaka na odgovor«**. Pri oceni brez odgovora pokaži oznako »brez odgovora«. To je za obrtnika najbolj uporaben podatek v modulu. |
| Oznaka »Vzorčna ocena« | — | ostane, dokler ni povezave |

## 5. Google oglasi

| Kaj | Stanje | Sprememba |
|---|---|---|
| Kraji »Ni podatka« | Google Ads API **daje** podatke po krajih (`geographic_view` / `user_location_view`: kliki, klici, strošek) | namesto »Ni podatka« prikaži **klike ali klice po kraju**, npr. »Domžale · 24 klikov«. Povpraševanja po kraju ostanejo »Ni podatka«, dokler kraja ne potrdimo v evidenci. |
| »Primer iskanj« | trenutno isti izrazi kot v modulu 3 | vir mora biti **Google Ads `search_term_view`** (dejanska iskanja, ki so sprožila oglas), s številom klikov ob izrazu. Ne sme biti seznam iz Google profila, sicer obrtnik misli, da gre za iste podatke. |
| **Cena enega povpraševanja** | izračunljivo: 140 € / 5 | v obstoječe besedilo KAJ VIDIMO dodaj **»Eno povpraševanje vas je stalo 28 €.«** To je glavna številka oglasov za obrtnika. |
| Klici iz oglasa | `metrics.phone_calls` (če ima oglas klicno razširitev) | izbirno, v isto vrstico kot klike |

Opomba: Google Lokalne storitve (LSA) v Sloveniji niso na voljo, v Nemčiji pa so. Za nemške obrtnike lahko ta modul kasneje bere tudi LSA lead-e.

## 6. Povzetek meseca

- Razdelitev Oglasi 5 · 2 / Profil 3 · 1 in Avgust je pravilna in skladna z glavo. Ostane.
- Izbirno v vrstico »Google oglasi« dodaj **»28 € na povpraševanje«**, v vrstico profila **»0 € stroškov«**. Tako obrtnik vidi, kaj je zastonj.

---

## Kaj potrebuje vir podatkov (za kasnejšo povezavo)

- **Google Business Profile API**: enkratna odobritev (profil mora biti potrjen 60+ dni in imeti spletno stran). Dnevne metrike so na voljo za ~18 mesecev nazaj **[preveri]**, iskalni izrazi za ~6 mesecev nazaj **[preveri]**.
- **Ocene**: My Business API v4, isti dostop.
- **Google Ads API**: Cloud projekt + preverjanje znamke (od 9. 9. 2026 brez developer tokena).
- **Povpraševanja in naročila**: naša evidenca. Da »Google profil« ni »Neznan vir«:
  - povezava na spletno stran v profilu mora imeti **UTM** (`?utm_source=google&utm_medium=organic&utm_campaign=gbp`);
  - obrazec/klic mora zapisati vir.
