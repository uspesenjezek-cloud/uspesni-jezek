# Postopek totalne preverbe kanala — Marketing → Analitika

Namen: vsak kanal preverimo **po istem seznamu, v celoti in naenkrat**, da se nove stvari ne pojavljajo šele ob naslednjem vprašanju. Preverba je končana šele, ko je vsaka točka spodaj odkljukana ali izrecno označena »ne velja – zakaj«.

Vhod za vsak kanal:
1. posnetek cele strani (vse kartice, razprta stanja »Pokaži več«);
2. uradna dokumentacija platforme (seznam polj, ne povzetki blogov);
3. naši dosedanji dokumenti (`docs/MARKETING-ANALITIKA-*.md`).

Izhod: en dokument `docs/MARKETING-ANALITIKA-{KANAL}-PREVERBA.md` z razdelki A–J v tem vrstnem redu + slika v `docs/marketing-predlog/`.

---

## A. Popoln popis podatkov platforme

Za **vsako** metriko in vsak vmesnik, ki ga platforma ponuja (ne samo za tiste, ki se zdijo uporabne), ena vrstica:

| Metrika | Raven (račun / objava / oglas / sporočilo) | Pogoj (vrsta računa, prag, dovoljenje) | Zgodovina in zamik | Zanesljivost | Odločitev |
|---|---|---|---|---|---|

Odločitev je ena od treh:
- **pokažemo** (v katerem modulu);
- **samo v ozadju** (za izračun ali naš admin pogled);
- **ne** (zakaj).

Kako: grem po uradnem seznamu polj od začetka do konca. Kar ni potrjeno iz uradnega vira, dobi oznako **[preveri]**. Na koncu razdelka je seznam »česa platforma ne da«.

## B. Kar izmerimo sami

Kar dobimo brez platforme ali poleg nje:
- webhooki in dogodki;
- lastne povezave s števcem (povezava v profilu, QR koda);
- obrazci in predizpolnjena sporočila;
- naša evidenca: povpraševanja, ponudbe, naročila, vrednost, strošek;
- odzivni čas in čakajoči odgovori.

Za vsako: kaj potrebujemo, da deluje, in ali deluje za vsakega obrtnika ali samo pod pogojem.

## C. Vprašanja obrtnika

Vsak kanal odgovori na istih 8 vprašanj. Za vsako je napisano, kateri modul odgovarja, ali pa »ne odgovarjamo, ker …«.

1. Ali me ljudje vidijo?
2. Ali me kontaktirajo (klic, sporočilo, obrazec, povezava)?
3. Kdo čaka na moj odgovor?
4. Kaj me sprašujejo?
5. Kaj deluje najbolje (objava, video, kampanja, iskanje)?
6. Koliko me stane in koliko mi prinese?
7. Od kod so stranke in za katero delo?
8. Kaj naj naredim zdaj?

## D. Pregled obstoječe strani, element za elementom

Za vsak naslov, številko, napis, oblaček, opombo, KAJ VIDIMO in UKREPALI:

| Preverim | Vprašanje |
|---|---|
| vir | Ali je številko mogoče dobiti? Iz katerega polja (A) ali lastnega merjenja (B)? |
| pomen | Ali napis pove točno to, kar številka meri (klik ≠ klic, ogled ≠ človek)? |
| slovnica | 1 / 2 / 3–4 / 5+, sklon, ločila. |
| prazno | »Ni podatka« namesto 0 in obratno; razlog namesto »Ni podatka«, kjer ga poznamo. |
| KAJ VIDIMO | Ima številko ali ime iz tega meseca? Ne ponavlja številk, ki so že zgoraj? |
| UKREPALI | Konkretno dejanje, ne »preverimo / spremljamo«? |
| opombe | Napisane za obrtnika, ne za razvijalca? Največ ena na modul? |
| podvajanje | Ali isto že kaže drug modul? |
| ostanki | Vrstice ali besedila iz splošne predloge ali drugega kanala? |

## E. Enotnost med kanali

- isti izrazi (povpraševanje, naročilo, kontakt, ogled, obisk);
- ponovno uporabljeni moduli, kjer se vsebina ujema:
  - »Vaš profil« s stolpci;
  - oglasi s tremi ljudmi in pasom vrednosti;
  - »Kaj vas sprašujejo«;
  - kraji s hišami;
  - primerjava;
  - povzetek;
- ista zgradba glave in povzetka;
- isti stavki za ista stanja (npr. »V TEKU · ponudba čaka«).

## F. Stanja

Vsak modul preverim v vseh stanjih:
- kanal ni povezan;
- pod pragom (npr. < 100 sledilcev);
- nepoln račun (npr. ni poslovnega ali registriranega);
- prazen mesec;
- tekoči mesec;
- mesec starejši od hrambe;
- 1 proti veliko;
- 0 naročil;
- napaka vira.

Za vsako stanje je napisano besedilo.

## G. Pravila denarja in štetja

- Strošek je vedno ob vrednosti dela. Cene na povpraševanje ni pod 3 povpraševanji.
- Nikjer rdeče barve, nikjer »drago«.
- Stike seštevamo med kanali, oglede ne.
- Kraj je kraj iz povpraševanja v evidenci, ne kraj sledilca.
- Vsako povpraševanje se šteje enkrat.
- Ali so oglasi oziroma pošiljanje v paketu ali jih plača obrtnik (stanje A ali B).

## H. Pravno, dostop, strošek

- privolitve (GDPR, ZEKom-2, UWG pri DE);
- odobritve aplikacije in obrazci;
- omejitve klicev;
- rok hrambe;
- strošek platforme na sporočilo ali klic.

## I. Napake

Iz posnetka in opisa kode:
- napake izrisa in konzole;
- trdo kodirani meseci;
- napačen podnaslov;
- neusklajen datum stanja;
- statični prikazi, ki se predstavljajo kot izračun.

## J. Videz

Pri 390 px in 320 px:
- nič se ne reže, ne prekriva in ne pomika vodoravno;
- obstoječi moduli ohranijo dizajn, spremeni se samo besedilo;
- nov modul samo, kjer obstoječi ne ustreza, in to je izrecno napisano.

---

## Zaključni pregled pred oddajo

Preden pošljem dokument in sliko, grem še enkrat po A–J in v dokument zapišem seznam odkljukanih točk ter seznam »ne velja – zakaj«. Kar se pojavi pozneje, je napaka postopka in jo dopišem v ta dokument kot novo točko.
