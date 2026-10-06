# Instagram → modul »Rezultati Instagram oglasov« (`igAds`) — navodila za Codex

Cilj: modul `igAds` na `app/marketing/analitika.html?kanal=instagram` preoblikuj tako, da:
- ima **ilustracijo z ljudmi** in oblačke s številkami (isti vzorec kot `fbOglas` na Facebooku in »Vaš Google profil« na Googlu);
- strošek oglasov kaže **vedno ob vrednosti dela**, da obrtnika ne prestraši.

Ostalih modulov in kanalov ne spreminjaj. Poslovne logike ne spreminjaj.

## 1. Pred začetkom

1. Preglej umazano delovno drevo in ohrani nepovezane spremembe.
2. Najdi obstoječi modul `fbOglas` (ilustracija s kavarno in oblački »54 vsi kliki«, »2 pogovori«, »1 Pokliči«). Ugotovi:
   - kateri HTML/CSS ga riše;
   - kako so oblački postavljeni (absolutno, v odstotkih);
   - kateri razredi dajejo obliko oblačka (bel, zelen).
3. **Ta vzorec ponovno uporabi.** Ne izdeluj novega sloga oblačkov, ne dodajaj nove palete.

## 2. Ilustracija

- Če obstaja ilustracija za Instagram oglas (ljudje gledajo telefon, Instagram), uporabi njo.
- Če je ni, **začasno uporabi isto ilustracijo kot `fbOglas`**, z istim razmerjem in zaobljenostjo. V kodo dodaj komentar `// TODO: lastna ilustracija za IG oglas`.
- Ne dodajaj ilustracije, ki ni v slogu obstoječih (brez emojijev, fotografij ali drugega sloga).

## 3. Zgradba modula (od zgoraj navzdol)

1. Oznaka: `REZULTATI INSTAGRAM OGLASOV` (obstoječa).
2. Naslov: **»Oglas je pripeljal <span class="hl">3 pogovore.</span>«**
   - Število in sklon iz podatkov, prek skupne funkcije za 1 / 2 / 3–4 / 5+ (pogovor / pogovora / pogovore / pogovorov v tožilniku).
   - V naslovu **ni evrov**.
3. **Ilustracija z oblački** (vzorec `fbOglas`):

   | Oblaček | Vsebina | Slog | Položaj |
   |---|---|---|---|
   | 1 | **3** pogovori | bel | zgoraj levo |
   | 2 | **1** povpraševanje | bel | zgoraj na sredini |
   | 3 | **0** naročil | bel, **zatemnjen** (siva številka, `opacity:.75`) kadar je 0; **zelen** kot »Pokliči« pri Facebooku, kadar je > 0 | zgoraj desno |

   Oblački ne smejo pokriti obrazov. Položaj prilagodi ilustraciji. Pri 320 px se ne smejo prekrivati ali rezati: velikost pisave pomanjšaj z obstoječim samodejnim prilagajanjem, ne z `scale()`.
4. **Pas vrednosti** (mehko vijolično ozadje `var(--soft)` oz. obstoječi ekvivalent, radij 16 px, odmik 11–12 px). Dve vrstici, vsaka v mreži `118px 1fr auto`:
   - »Oglasi septembra« · vijoličen trak · **70 €**;
   - »Povprečno naročilo« · zelen trak · **1.200 €**.
   - **Trakova sta v pravem razmerju:** širina vijoličnega = `strošek / vrednost × 100 %`, najmanj 8 px. Zelen je 100 %.
   - Pod trakovoma zeleno besedilo s kljukico: **»Eno naročilo pokrije oglase za {N} mesecev.«**, kjer je `N = floor(povprečno naročilo / mesečni strošek)`. Sklon prek skupne funkcije.
5. Opomba (mala, siva): »Ceno na povpraševanje pokažemo, ko so vsaj 3 povpraševanja.«
6. KAJ VIDIMO / UKREPALI:
   - KAJ VIDIMO: **»Oglas je odprl 3 pogovore, 1 je postal povpraševanje.«**
   - UKREPALI: »Osebi, ki je povpraševala, pošljemo ponudbo še ta teden.«

## 4. Tri stanja (izbira samodejno iz podatkov)

| Stanje | Pogoj | Kaj se spremeni |
|---|---|---|
| **A · plača obrtnik** | oglasi niso v paketu, < 3 povpraševanja iz oglasov v zadnjih 3 mesecih | kot zgoraj (§3) |
| **B · v paketu** | oglasi so vključeni v obrtnikov paket | pas vrednosti zamenja zelena ploščica s kljukico: **»Vključeno v vaš paket«** / »Za oglase ne plačate nič dodatno.« Evrov ni nikjer v modulu. Opombe o ceni ni. |
| **C · dovolj podatkov** | ≥ 3 povpraševanja iz oglasov v zadnjih 3 mesecih | oznaka `INSTAGRAM OGLASI · ZADNJI 3 MESECI`; naslov »Oglasi so prinesli **2 naročili**.«; oblački za 3 mesece (9 · 6 · 2, naročila zelena); pas vrednosti: »Oglasi jul.–sep.« **210 €** / »Vrednost 2 naročil« **2.400 €**; zeleno: »Za 1 € oglasov ste dobili **11 €** dela.«; pod pasom vrstica s črtkano zgornjo črto: »Eno povpraševanje v povprečju« **35 €**. |

Pravila:
- **Povprečno naročilo** je povprečje sprejetih ponudb obrtnika (zadnjih 12 mesecev, vsi kanali). Če ga ni, vrstice z vrednostjo ni, ni stavka »pokrije oglase«, ostane samo strošek. Vrednosti nikoli ne izmišljuj.
- Če v mesecu ni oglasov, se modul ne prikaže (ali pokaže obstoječe prazno stanje).
- Nikjer rdeče barve, nikjer »drago«.
- Kje je zapisano, ali so oglasi v paketu, preveri v obstoječem podatkovnem modelu. Če tega polja ni, uporabi stanje A in to napiši v povzetek.

## 5. Kaj se odstrani

- Štiri ploščice (»Začeti pogovori 3 · Povpraševanja 1 · Naročila 0 · Cena povpraševanja 70 €«) in naslov »Oglasi: 70 € → 1 povpraševanje.« zamenja zgradba iz §3.
- Povzetek meseca ostane, kot je. Vrstica »Oglasi« tam ostane.

## 6. Preverjanje

- [ ] Pri 390 px in 320 px: oblački ne pokrivajo obrazov, se ne prekrivajo, nič se ne reže, ni vodoravnega pomikanja.
- [ ] Vsa tri stanja (A, B, C) so preverjena z vzorčnimi podatki. Stanje B nima nobenega »€«.
- [ ] Menjava meseca (avgust, januar) pokaže pravilno prazno stanje.
- [ ] Razmerje trakov je pravilno (70 : 1.200 je droben vijoličen trak).
- [ ] Obstoječi Facebook `fbOglas` in ostali Instagram moduli niso spremenjeni.
- [ ] Ni napak v konzoli. Cache različica spremenjenih CSS/JS je dvignjena.
- [ ] Pošlji posnetek modula pri 390 px v vseh treh stanjih.

Referenca vsebine (brez ilustracije): `docs/marketing-predlog/ig-oglasi3-vse.png`.
