# Atena → »Kaj želite urediti?« — nove kartice (za vgradnjo)

Potrjena slika: `../marketing-predlog/atena-kartice-izbrana.png` (levo 390 px, desno 320 px).

Kode vijolične strani Atena v repozitoriju ni, ker obstaja samo lokalno. Zato je tukaj samostojna komponenta: `kartice.css`, `kartice.js` in predogled `predogled.html`. **V lokalni strani zamenjaj obstoječi blok »Kaj želite urediti?« in zavihke »Hitri koraki / Moji koraki«**. Ne dodajaj druge vzporedne strani.

## Kaj se spremeni

1. **Zavihki »Hitri koraki 4 / Moji koraki 5 / +« nad naslovom se odstranijo.** Stikalo je zdaj v prvi kartici.
2. **Prva kartica čez vso širino (rožnata), »Klici prodajalcev«.** V njej je stikalo `Hitri koraki N` / `Moji N`. Gumb `+` za nov lasten korak ostane v obstoječem »Uredi«.
3. **Pod njo pet kartic v eni vrsti.** Ikona v polnem krogu sega čez zgornji rob kartice, kartica je obarvana v svoji barvi, kontekst je spodaj v barvi kartice.

| Kartica | Naslov | Kontekst | Barva |
|---|---|---|---|
| prej »Hitri koraki« | Klici prodajalcev | (stikalo Hitri / Moji) | `#c4566f` |
| Pregled ponudbe | Preverite ponudbo | pred podpisom | `#d48a12` |
| Pregled pogodb | Preverite pogodbe | po podpisu | `#2d7fd0` |
| Pogajanje / odpoved | Pogajajte se | cena ali odpoved | `#7a4fe0` |
| Iskanje ponudb | Poiščite ponudbe | primerjamo za vas | `#14928f` |
| Iskanje delavca | Poiščite mojstra | z izkušnjami | `#3d8a4f` |

## Vedenje (ostane enako kot zdaj)

- Tap na kartico jo izbere (`aria-pressed="true"`, razred `is-izbrana`). **Pas z ježkom spodaj se takoj napolni s koraki te skupine**, brez pomikanja.
- Stikalo Hitri / Moji v prvi kartici preklopi vir korakov v pasu (obstoječa logika zavihkov). Ob tem se izbere prva kartica.
- Komponenta sproži dogodek `atena:skupina` z `{ skupina, vir }`. Nanj priklopi obstoječo funkcijo, ki zdaj polni pas z ježkom.
- Barva izbrane skupine je na korenu kot `--atena-c`, da pas z ježkom lahko vzame isto barvo (neobvezno).

## Mere (390 px)

- prva kartica: radij 22 px, odmik 12 px, ikona 44 × 44 px;
- vrsta kartic: 5 stolpcev, razmik 6 px, zgornji odmik 26 px za krogce;
- kartica: najmanj 120 px, radij 18 px, notranji odmik zgoraj 24 px;
- krog ikone: **32 × 32 px** (zmanjšan), sega 15 px čez rob, bel obroč 4 px;
- naslov 11 px Bricolage 800, kontekst 9,5 px Figtree 800 v barvi kartice.

Pri 320 px se mere ne spremenijo, besedila se prilegajo. Naslov in kontekst imata `data-fit-text`, zato ju obstoječe samodejno pomanjšanje zmanjša, če bi besedilo kdaj preseglo kartico.

## Preveri po vgradnji

- 390 × 844 in 320 px v `?app-preview=1`: prva kartica, 5 kartic, pas z ježkom, Uredi / Izberi korak in vnos za Ateno so vidni brez pomikanja;
- menjava kartic in stikala Hitri / Moji takoj zamenja pas;
- dvig `?v=` pri spremenjenem CSS in JS.
