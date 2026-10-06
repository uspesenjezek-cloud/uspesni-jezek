# Instagram analitika — navodila za izvedbo v aplikaciji

Za: Claude/Codex, ki dela v lokalnem projektu (`app/marketing/analitika.html`, kanal `instagram`).
Potrjena slika: `docs/marketing-predlog/instagram-v3.png`. Podrobna preverba: `docs/MARKETING-ANALITIKA-INSTAGRAM-PREVERBA.md`.

## 0. Pravila

1. **Obstoječi moduli ohranijo dizajn v celoti**: ilustracije, kuverte, hiše, ploščice, barve, razmike in ikone. Spremeni **samo besedila in številke** po tabeli v §1.
   - Slika `instagram-v3.png` je ponekod obstoječe module narisala drugače (npr. ploščice pri oglasih, ikone pri sporočilih). To **ni** del naloge. Velja vaš obstoječi dizajn.
2. **Nova dizajna sta samo dva**, oba v §2:
   - modul »Vaš profil«, ki zamenja vsebino obstoječega `ig2`;
   - gradnik »Odziv« in reakcijska vrstica v objavah, ki se dodata v obstoječi `ig3`.
3. Vse CSS-razrede novih delov imej s predpono `uj-` (npr. `uj-odziv`), da ne trčijo z obstoječimi (npr. `.ph`).
4. Po spremembi dvigni cache različico (`?v=`) spremenjenih CSS/JS datotek.
5. Preveri pri 390 px in 320 px: nič se ne prekriva, nič se ne reže, ni vodoravnega pomikanja.
6. Ostali kanali, podatkovna logika in poslovna pravila ostanejo nespremenjeni.

## 1. Obstoječi moduli: samo besedila in številke

| Modul | Element | Zdaj | Novo |
|---|---|---|---|
| Glava | naslov | Instagram vam je ta mesec prinesel 1 potrjen **posel**. | Instagram vam je ta mesec prinesel 1 **naročilo**. |
| Glava | 1. številka | 2.100 doseženih računov · Ni primerjave | 2.100 **ljudi vas je videlo** · **+300 od avgusta** |
| Glava | 2./3. številka | 2 povpraševanja · 1 potrjena naročila | 2 **povpraševanji** · 1 **potrjeno naročilo** |
| Glava | Vrednost naročil | Ni podatka | **1.460 €** (iz sprejetih ponudb; če ni zapisa, ostane »Ni podatka«) |
| `ig1` Sporočila | KAJ VIDIMO | Zanimanje za vaše delo. V evidenci: 2 povpraševanji … | **Iz 9 pogovorov sta nastali 2 povpraševanji.** 2 človeka čakata na odgovor. |
| `ig1` | UKREPALI | Spremljamo nove pogovore … | Na čakajoča pogovora odgovorimo še danes. |
| `ig3` Objave | naslov | Vsebina, objavljena septembra. | **Ljudje so se odzvali 236-krat.** |
| `ig3` objava 1 | spodnja vrstica | 2 klika »Pokliči« · 12 obiskov profila · **19 shranitev** | 2 klika »Pokliči« · 12 obiskov profila · **1 povpraševanje** (shranitve gredo v reakcijsko vrstico, §2.3) |
| `ig3` reel | spodnja vrstica | 870 ogledov · **26 shranitev** · 9 s | 870 ogledov · 9 s povprečen ogled · **+5 sledilcev** |
| `ig3` | KAJ VIDIMO | Odziv na vaše delo. Shranitve kažejo … | **52 odzivov več kot avgusta.** 45 ljudi je shranilo vaše objave – to pomeni, da jih zanima za pozneje. |
| `ig3` | UKREPALI | Primerjamo odziv objav … | Naredimo še en kratek video dela, kot je menjava sifona. |
| `ig5` Zgodbe | 24 | povprečen doseg ene zgodbe | **ljudi je povprečno videlo eno zgodbo** |
| `ig5` | 1. ploščica | Ni podatka · kliki na povezavo | **2 · odgovora → pogovora** |
| `ig5` | KAJ VIDIMO / UKREPALI | splošno | **Zgodbe so prinesle 2 pogovora.** / V vsako zgodbo dodamo povabilo »Pošljite nam sporočilo«. |
| `ig6` Sledilci | oznaka | Vaši sledilci | **Od kod so povpraševanja** |
| `ig6` | naslov | 62 % sledilcev je iz krajev, kjer delate. | **Povpraševanji sta iz Domžal in Kamnika.** |
| `ig6` | hiše | Domžale 31 % · Kamnik 18 % · Ljubljana 13 % sledilcev | Domžale **1 povpr.** · Kamnik **1 povpr.** · Ljubljana **0 povpr.** (kraj iz evidence povpraševanj) |
| `ig6` | opomba | Stanje 30. 9. … Kraj ni znan za 29 %. | Kraj je iz povpraševanja v vaši evidenci. 62 % sledilcev je iz krajev, kjer delate. |
| `ig6` | KAJ VIDIMO / UKREPALI | splošno | **Obe povpraševanji sta iz krajev, kjer delate.** Iz Ljubljane, kjer je 13 % sledilcev, ni povpraševanj. / Oglas usmerimo na Domžale in Kamnik. |
| `igAds` | naslov | Za Instagram oglase smo porabili 70 €. | **Oglasi: 70 € → 1 povpraševanje.** |
| `igAds` | 4 ploščice | Začeti pogovori 3 · Ni podatka · Ni podatka · Ni podatka | Začeti pogovori **3** · Povpraševanja **1** · Naročila **0** · Cena povpraševanja **70 €** |
| `igAds` | opomba | Povpraševanja in posli ostanejo Ni podatka … | Povpraševanje iz oglasa prepoznamo po oznaki oglasa v prvem sporočilu. |
| `igAds` | KAJ VIDIMO / UKREPALI | splošno | **Oglas je odprl 3 pogovore, 1 je postal povpraševanje.** Neplačana objava je prinesla naročilo. / V oglasu uporabimo objavo kopalnice, ki je prinesla naročilo. |
| `ak` Kdaj pišejo | naslov | Največ pišejo v več enako pogostih terminih. | Največ pišejo **v torek zjutraj in četrtek popoldne.** (pri izenačenju naštej termine, ne »več terminov«) |
| `ak` | KAJ VIDIMO / UKREPALI | splošno | **1 od 9 pogovorov se je začel po delovnem času.** / Ob torkih zjutraj odgovarjamo prednostno. |
| Povzetek | vrstice | Oglasi: Ni podatka · Objave in profil: Ni podatka · Neznan vir: 2 · 1 | Oglasi: **1 povpraševanje · 0 naročil · 70 € na povpraševanje** · Objave in profil: **1 povpraševanje · 1 naročilo · brezplačno** · »Neznan vir« samo, če > 0 |
| Povzetek | KAJ VIDIMO / UKREPALI | splošno | **Naročilo je prišlo iz neplačane objave kopalnice.** / Stranki iz oglasa pošljemo ponudbo še ta teden. |

Slovnica števil gre povsod prek ene funkcije (1 / 2 / 3–4 / 5+): povpraševanje/povpraševanji/povpraševanja/povpraševanj, naročilo/naročili/naročila/naročil, klik/klika/kliki/klikov, pogovor/pogovora/pogovori/pogovorov.

Pravilo za vse KAJ VIDIMO / UKREPALI: vsak stavek vsebuje številko ali ime iz podatkov izbranega meseca. Če podatkov ni, ostane obstoječe besedilo »Za izbrani mesec še ni podatkov.«

## 2. Nova dizajna

Uporabi obstoječe pisave in barvne spremenljivke strani. Spodaj so vrednosti iz potrjene slike. Vse sledi izbranemu mesecu in izbiri primerjave (prejšnji mesec / lani).

### 2.1 Modul »Vaš profil« (zamenja vsebino `ig2`)

Zgradba od zgoraj navzdol:
1. Oznaka `VAŠ PROFIL`, naslov: `{N} klikov na <span class="hl">gumbe v profilu.</span>`
2. **Pas profila**:
   - mehko vijolično ozadje, radij 16 px, odmik 8–12 px;
   - levo krog 40 px z Instagram obrobo (`conic-gradient(from 210deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5,#feda75)`) in začetnicami;
   - ime podjetja;
   - desno trije stolpci: **obiskov** · **sledilcev** · **novih** (zeleno, s »+«).
3. **Stolpci po gumbih**: mreža `repeat(n,1fr)`, razmik 8 px, `align-items:end`, višina samodejna.
   - Vsak stolpec ima od zgoraj navzdol: številko (Bricolage 800, 19–22 px), stolpec (radij `12px 12px 6px 6px`, višina `max(v/max*80, 12)px`, barvni gradient), krog ikone 30 px, ime pod njim.
4. Opomba: »Instagram šteje pritiske na gumbe, ne ljudi. Pokažemo samo gumbe, ki jih imate na profilu. Povezavo štejemo sami.«
5. KAJ VIDIMO / UKREPALI: »Največ klikov na povezavo (6) in »Pokliči« (4).« / »Povezavo usmerimo na obrazec za ponudbo.«

Gumbi, barve in vir:

| Gumb | Barva | Vir |
|---|---|---|
| Pokliči | `#6a4be0` | `profile_links_taps` × `contact_button_type` = klic |
| SMS | `#3b8cff` | isto, vrsta = SMS/besedilno sporočilo |
| Pot | `#17946a` | isto, vrsta = pot |
| E-pošta | `#e8892b` | isto, vrsta = e-pošta |
| Rezerviraj | `#0fa3a8` | isto, vrsta = rezervacija |
| Povezava | `#e1306c` | lastna preusmeritev (ne Instagram) |

Točna imena vrednosti `contact_button_type` preveri v Metini dokumentaciji.

**Pravilo:** stolpec se prikaže samo za gumb, ki ga ima profil, ali ki je imel v izbranem mesecu > 0 klikov. Zato je stolpcev 3–6. Pri 320 px in 6 stolpcih: ikona 26 px, ime 9.5 px, brez reza in prekrivanja.

Ikone so lahke linijske SVG (debelina 2, beli potezi na barvnem krogu): telefon, oblaček s tremi pikami, žebljiček, ovojnica, koledar s kljukico, člen verige.

### 2.2 Gradnik »Odziv« (na vrhu `ig3`, pod naslovom)

Zgornja vrsta je mreža `1fr 1.05fr`, razmik 8 px:
- **levo, vijoličen blok**:
  - gradient `155deg,#6a4be0 → #8b71f2`, radij 18 px, bela pisava;
  - zgoraj tri prekrivajoče se reakcijske značke (♥, zaznamek, puščica);
  - **236** (Bricolage 800, 34 px), pod njim »odzivov v septembru«;
  - značka »+52 od avgusta« (prosojno belo ozadje).
- **desno, mehko vijolična ploščica »Po tednih«**:
  - 5 stolpcev po 7 dni (1.–7., 8.–14., 15.–21., 22.–28., ostanek);
  - številka nad stolpcem, najboljši teden temno vijoličen;
  - zadnji, nepopoln teden je črtkan (`repeating-linear-gradient(135deg,#ddd5fb 0 4px,#efebfd 4px 8px)`).

Pod tem je vrstica 4 ploščic (bela, tanka obroba, radij 14 px): reakcijska značka, število in ime.
- **Instagram**: všečki (♥, `#ff6f97 → #e1306c`) · komentarji (oblaček, siv) · delitve (puščica, vijolična) · shranitve (zaznamek, rumena).
- **Facebook** (isti gradnik, `fbNaj`): všečki · srčki · wow · komentarji · delitve.

Vir za Instagram: dnevni `likes`, `comments`, `shares`, `saves` (vsota objav), shranjeni dnevno v naši bazi.

### 2.3 Reakcijska vrstica v vsaki objavi (`ig3`, med sliko in spodnjo vrstico)

- Levo: značka ♥ in število (Bricolage 800, 17 px).
- Desno: tri mehke ploščice (`background:var(--soft)`, radij 99 px), vsaka z ikono in številom: komentarji · delitve · shranitve.
- Zgornja obroba 1 px `var(--line)`, odmik `9px 12px`.

## 3. Preverjanje po izvedbi

- [ ] Instagram stran se pri 390 px in 320 px ujema s `docs/marketing-predlog/instagram-v3.png` v novih delih. Obstoječi moduli ostanejo, kot so bili, le z novimi besedili.
- [ ] Menjava meseca (avgust, januar) pokaže pravilna prazna stanja, ne izmišljenih ničel.
- [ ] Ni napak v konzoli; obstoječi Facebook, Google in WhatsApp moduli niso prizadeti.
- [ ] Cache različica je dvignjena.
- [ ] Pošlji posnetek pri 390 px.
