# Napoved prometa za delovne naloge (SI + DE)

Cilj: obrtnik dobi za jutrišnji delovni nalog sporočilo, na primer
*»Ob tej uri je na vaši poti običajno gneča (do +20 min). Za prihod ob 08:00
priporočamo odhod najkasneje ob 07:00.«* Brez Google/TomTom/HERE plačil, z
odprtimi viri, in deterministično: isti vhod vedno da isti izhod.

## 1. Zakaj ne Google API in zakaj ne »enkrat na uro«

- Google Routes/Distance Matrix s prometom zaračuna vsak klic. Pri več obrtnikih
  in več nalogih na dan to hitro postane predrago.
- TomTom ima brezplačno kvoto (~2.500 klicev/dan), a ni odprtokoden in ima
  licenčne omejitve glede shranjevanja. Primeren je kvečjemu kot rezerva.
- Promet »zdaj« ne pove, kakšen bo promet jutri ob 7:30. Potrebujemo
  **zgodovinski profil**: kako je na določenem odseku običajno ob določenem
  tipu dneva in uri. Zato podatke zbiramo redno in se iz njih učimo.
- Zajem enkrat na uro je pregrob: jutranja konica traja 60–90 min in jo uro
  dolg korak skoraj zgreši. Uporabljamo **zajem vsakih 15 minut** (en vzorec na
  15-min interval na dan) in **nočni izračun profila**.

## 2. Viri podatkov (brezplačni)

| Vir | Država | Kaj | Dostop | V kodi |
|---|---|---|---|---|
| Autobahn GmbH API (`verkehr.autobahn.de/o/autobahn`) | DE | aktualni zastoji (Stau, zamuda v min, hitrost), dela, zapore — vse avtoceste | javno, brez ključa | `api/_lib/promet/viri/autobahn.js` |
| DARS / promet.si B2B dogodki (GeoJSON) | SI | zastoji, dela, zapore na avtocestah in državnih cestah | javno, brez ključa | `api/_lib/promet/viri/dars.js` |
| DARS NAP (`nap.si`) DATEX II — števci prometa, potovalni časi | SI | hitrosti in pretok vsako minuto | brezplačno, **potrebna registracija** | naslednji korak |
| Mobilithek — Autobahn detektorji (hitrost, pretok, 1 min) | DE | merjene hitrosti na avtocestah | brezplačno, **potrebna naročnina na ponudbo** | naslednji korak |
| OpenHolidays API (`openholidaysapi.org`) | SI + DE | prazniki, šolske počitnice (DE po deželah) | javno, brez ključa | `api/_lib/promet/tip-dneva.js` |
| OpenStreetMap + OSRM (lasten strežnik) | SI + DE | pot in čas v prostem toku | odprtokodno | `api/_lib/promet/osrm.js` |

Opombe:
- Autobahn API pokriva samo avtoceste. Mestne in regionalne ceste v DE do
  podatkov Mobilitheka (ali mestnih odprtih podatkov) pokriva začetna ocena konic.
- DARS dogodki imajo koordinate lahko v D96/TM (EPSG:3794); pretvorba v WGS84
  je vgrajena.
- Javni demo `router.project-osrm.org` ni dovoljen za produkcijo — potreben je
  lasten OSRM (ali Valhalla) z izvlečkom OSM za Slovenijo in Nemčijo (Geofabrik).

## 3. Kako sistem deluje

```
vsakih 15 min   promet-zbiralnik  ─► promet_zajem + promet_opazovanje (+ promet_dogodek)
vsako noč       promet-profil     ─► promet_profil + promet_pokritost (zadnjih 56 dni)
dan prej 18:00  napoved za naloge ─► sporočilo obrtniku
zjutraj 05:30   ponovni izračun   ─► opozorilo samo, če se je kaj spremenilo (nove zapore)
```

1. **Prostorske celice (~2 km)** — vsak zastoj in vsako točko poti preslikamo
   v isto mrežo. Tako ni odvisnosti od imen cest ali ID-jev virov.
2. **Zajem** — vsak vir zapiše en zajem. Zajem, pri katerem del vira ni
   odgovoril, je `uspeh=false` in se **ne šteje** v profil (sicer bi manjkajoči
   podatki izgledali kot »ni gneče«).
3. **Profil** — za vsak (vir, celica, tip dneva, 15-min interval): verjetnost
   zastoja, mediana in p85 zamude. Tipi dneva: `delavnik`, `petek`, `sobota`,
   `nedelja_praznik`, `pocitnice_delavnik`.
4. **Napoved odhoda** (`api/_lib/promet/napoved.js`):
   - čas prostega toka iz OSRM,
   - za vsak odsek p85 zamuda ob uri, ko bo vozilo tam (časovno odvisno,
     iteracija do najkasnejšega še varnega odhoda),
   - kazen za znana dela (+5 min) in zapore (+15 min) na poti,
   - + 10 min fiksne rezerve, zaokroženo navzdol na 5 min.
   - Opozorilo se pošlje, ko je dodatna zamuda ≥ 10 min ali je na poti dogodek.
5. **Hladni začetek** — dokler za interval ni vsaj 8 uspešnih zajemov (ali če
   cesta nikoli ni bila opažena), se uporabi fiksna, konzervativna tabela konic
   (`ZACETNE_KONICE`). Sporočilo to jasno označi kot oceno. Po ~2 tednih so
   delavniki pokriti z meritvami, petki in sobote po ~8 tednih.

Zakaj p85: »v 85 % podobnih dni boste prispeli pravočasno«. Mediana se vrne kot
`trajanjeObicajnoMin` za informacijo.

## 4. Zagon na lastnem računalniku (Windows) — začetna faza

Vse teče lokalno: brez Supabase, brez strežnika, 0 €. Podatki so v
`.promet-podatki\` v repozitoriju (git jih ignorira).

Potrebuješ: Node.js LTS, za izračun poti pa še Docker Desktop.

1. **Samodejni zajem** (enkrat):
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\promet-windows\namesti.ps1
   ```
   Namesti dve opravili v Razporejevalnik opravil: zbiralnik vsakih 15 min in
   izračun profila ob 02:41 (če je računalnik takrat izklopljen, se izvede ob
   naslednjem zagonu). Dnevnik: `.promet-podatki\promet.log`.
2. **OSRM za pot in čas vožnje**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\promet-windows\osrm.ps1 -Drzava SI
   powershell -ExecutionPolicy Bypass -File scripts\promet-windows\osrm.ps1 -Drzava DE -Obmocje europe/germany/bayern
   ```
   SI teče na `localhost:5000`, DE na `localhost:5001`. Slovenija je majhna
   (nekaj minut, ~2 GB RAM). Cela Nemčija potrebuje ~16 GB RAM v Docker Desktop,
   zato je privzeto ena dežela (Geofabrik ime, npr. `bayern`,
   `baden-wuerttemberg`). Docker ju ob zagonu računalnika sam znova zažene.
3. **Napoved**:
   ```powershell
   node scripts\promet-napoved.js --od 46.0569,14.5058 --do 46.5547,15.6459 --prihod 2026-10-07T07:30 --drzava SI
   ```
4. **Stanje zbranih podatkov**: `node scripts\promet-stanje.js`
5. **Odstranitev opravil**: `scripts\promet-windows\odstrani.ps1` (podatki ostanejo).

Kaj pomeni, če je računalnik izklopljen ali spi: zajemi v tem času manjkajo,
ne štejejo pa kot »ni gneče«. Profil se le počasneje polni (npr. če računalnik
ponoči ne teče, nočnih intervalov ne merimo — ponoči gneče tako ni). Dela in
zapore, starejši od 2 ur, napoved ignorira in to izpiše kot opozorilo.

Prehod na strežnik pozneje: isti ukazi z zastavico `--supabase`
(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, migracija
`supabase/migrations/20261006120000_promet_napoved.sql`) ali isti lokalni način
na majhni VM s crontabom:

```cron
*/15 * * * *  cd /srv/uspesni-jezek && node scripts/promet-zbiralnik.js >> .promet-podatki/promet.log 2>&1
41 2 * * *    cd /srv/uspesni-jezek && node scripts/promet-profil.js   >> .promet-podatki/promet.log 2>&1
```

## 4a. Aplikacija: Dnevni načrt poti

Stran `app/promet-dan.html` (Skrb za stranke ter delavce → Dnevni načrt poti):

1. Zaženi lokalni strežnik: `npm run dev` (http://localhost:8001/app/promet-dan.html).
2. Vpiši približno izhodišče (npr. »Šiška, Ljubljana«).
3. Za izbrani dan dodaj naloge: stranka, naslov, začetek, konec.
4. »Izračunaj poti« izračuna vsak odsek (dom → A → B → …) ob uri, ko se bo vozil:
   priporočen odhod, rezerva, »tesno« ali predvidena zamuda med nalogi.
5. »Kopiraj sporočilo« (SL/DE) za pošiljanje obrtniku.

Na vrhu je zemljevid **Promet zdaj** (MapLibre + brezplačna podlaga
OpenFreeMap): števci DARS obarvani po izmerjenem stanju (zeleno/oranžno/rdeče),
zastoji, dela in zapore DARS ter zastoji na nemških avtocestah; osvežuje se na
3 minute. Ceste brez števca niso pobarvane — tam podatka ni. Po izračunu so
na zemljevidu še poti dneva (barva po napovedani zamudi) in točke D, 1, 2 …

Nalogi so zaenkrat shranjeni na napravi (brskalnik); povezava s skupnim
koledarjem in obvestili pride pozneje. API (`/api/promet-dan`,
`/api/promet-zemljevid`, `/api/promet-stanje`) deluje na lokalnem strežniku
in na Vercelu (tam s prijavo; `api/promet.js`). Pot se računa z lokalnim OSRM; če ne teče, z javnim
preizkusnim strežnikom (samo za preizkus, označeno v rezultatu).

## 5. Naslednji koraki

1. Registracija na NAP (DARS) in naročnina na Autobahn detektorske podatke v
   Mobilitheku → dodati vira z merjenimi hitrostmi (natančnejši profil, ne le
   prijavljeni zastoji).
2. Povezati z dejanskimi delovnimi nalogi (naslov stranke → geokodiranje s
   samostojnim Nominatimom/Photon, izhodišče obrtnika) in obvestili.
3. Po 8 tednih primerjati napoved z dejanskimi prihodi in po potrebi
   prilagoditi rezervo / prag.

Testi: `npm run test:promet` (brez omrežja, s posnetki odgovorov virov).
