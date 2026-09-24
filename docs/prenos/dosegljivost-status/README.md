# Prenos: »Kaj trenutno sprejemam« (Status C)

Prenosljiv paket potrjene zasnove *Status C – kaj se odpre spodaj* iz artefakta »Nastavitve – 2 zasnovi«
(https://claude.ai/artifact/L92sJyFSHFVtzJTEEHLa8v). Ni nova zasnova: postavitev, barve, besedila in logika so prenesene iz potrjenega okvirja.

Paket še **ni vgrajen** v stran `http://127.0.0.1:18763/`, ker ta koda ni v repozitoriju. Vgradnjo mora narediti nekdo, ki ima dostop do lokalne kode (glej spodaj).

## Datoteke

| Datoteka | Namen |
|---|---|
| `dosegljivost-status.css` | Vsi slogi, omejeni na razred `.ujds` (ne vplivajo na preostalo stran). |
| `dosegljivost-status.js` | Komponenta brez odvisnosti: izris, dogodki, logika, shranjevanje. |
| `demo.html` | Samostojna testna stran (`python3 -m http.server` v tej mapi → `/demo.html`). |

## Kaj vsebuje

- Tri ploščice **Sprejemam / Nujno / Dopust**; tap na ploščico odpre ploščo spodaj, **ločen krog** v kotu vklopi/izklopi stanje.
- **Sprejemam:** Apple-slog »Povezano s koledarjem« (tap sproži `onCalendar`), *Nova dela* (največ N na teden/mesec), *Vrste del* (Običajna/Večja/Ogled, vsaj ena), *Ko je polno, pokaži »zasedeno«*.
- **Nujno:** 7 dni (Pon–Ned) z urami od–do za izbrani dan, *Pridem v* (minute/ure/dnevi, razpon od–do s pravilnim sklonom), *Doplačilo* (€/%, ±5), *Pokaži strankam*.
- **Dopust:** hitro dodaj (Ta vikend, 1 teden, 2 tedna), razpon od–do s sistemskim izbirnikom datuma, seznam z nazivom in stikalom *Pokaži strankam*, brisanje, *Nujni tudi med dopustom*.
- Vsaka plošča: **⇈ Zapri**, *Kaj vidijo stranke* (sproti izračunan predogled) in gumb **Izklopi/Vklopi …**.
- Pravila: Dopust izklopi Sprejemam in (če *Nujni tudi med dopustom* ni vklopljen) Nujno; izklop Dopusta vrne Sprejemam; vsaj eno od Sprejemam/Nujno ostane vklopljeno.
- Samodejno prilagajanje velikosti pisave na omejenih mestih (ploščice, glave plošč), da se besedilo ne reže in okvir ne širi.

## Vgradnja v obstoječo stran

1. Kopiraj obe datoteki k ostalim virom strani in ju poveži z novo `?v=` različico:
   ```html
   <link rel="stylesheet" href="dosegljivost-status.css?v=20260924-2">
   <script src="dosegljivost-status.js?v=20260924-2"></script>
   ```
   Pisava Figtree mora biti naložena (stran jo že uporablja).
2. Obstoječi blok »Kaj trenutno sprejemam« (stare tri ploščice) zamenjaj z enim elementom na **istem mestu**, pod karto »Kdaj me stranke dosežejo«:
   ```html
   <div id="dosegljivost"></div>
   ```
   Urnika, kanalov/kontaktov in ostalih delov strani ne spreminjaj.
3. Priklopi na obstoječe shranjevanje strani (namesto privzetega `localStorage`):
   ```js
   var ujds = UJDosegljivost.mount(document.getElementById('dosegljivost'), {
     load: function () { return obstojeciPodatki.dosegljivost || null; },
     save: function (stanje) { obstojeciPodatki.dosegljivost = stanje; shraniObstojece(); },
     onCalendar: function () { odpriKoledar(); }
   });
   ```
   Brez `load`/`save` komponenta uporabi `localStorage` ključ `uj.dosegljivost.v1`.
   Če so stare ploščice že hranile stanje (npr. »Sprejemam«), ga v `load` preslikaj v `on: { a, b, c }`.
4. Ob vsaki spremembi element sproži `ujds:change` (`event.detail` = stanje), npr. za osvežitev javnega profila.

## Oblika shranjenega stanja

```json
{
  "v": 1,
  "on": { "a": true, "b": false, "c": false },
  "cap": 3, "per": "teden", "af": true,
  "kinds": { "obic": true, "vec": true, "ogl": true },
  "ed": [[7,20],[7,20],[7,20],[7,20],[7,20],null,null], "edF": 0,
  "mu": "h", "ra": 1, "rb": 3,
  "unit": "eur", "fee": 40, "sh": true,
  "nd": false,
  "vac": [{ "id": 1, "from": "2026-11-03", "to": "2026-11-10", "label": "Sejem", "pub": true }],
  "nextId": 2
}
```
`a` = Sprejemam, `b` = Nujno, `c` = Dopust. Ure v `ed` so decimalne (7.5 = 7.30). Pretekli dopusti se ne prikazujejo.

## Preverjeno (Chromium, Playwright)

Na `demo.html` pri širinah 320, 390 in 1280 px: odpiranje vseh treh plošč, ⇈ Zapri, krogi za vklop,
pravila Dopust/Nujno, dodajanje dopusta, naziv, spremembe enot in doplačila, **shranjevanje in ponovno nalaganje**
(stanje enako), brez rezanja besedila in brez vodoravnega pomikanja, brez JS napak.

**Ni preverjeno:** vgradnja v lokalno stran `127.0.0.1:18763` in prikaz v nameščeni PWA na iPhonu.
