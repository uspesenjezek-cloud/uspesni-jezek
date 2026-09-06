# Sistem gradnikov NAZORJEVA - kako je zgrajen

Namenjeno agentu, ki bo delal na vprasalnikih in widgetih.
Stanje 6. 9. 2026. Vse spodaj je preverjeno v kodi, ne po spominu.

---

## 0. Prvo, kar moras razumeti: to niso en sistem, ampak TRIJE

V aplikaciji obstajajo trije **loceni, med sabo nepovezani** sistemi za izris
kartic. Ne delijo CSS-a, ne delijo rendererja, ne delijo rokovalnikov. Ce
pomesas razrede enega z drugim, dobis kartico, ki izgleda skoraj prav in ne deluje.

| # | sistem | renderer | CSS | razredi | kartic |
|---|---|---|---|---|---|
| 1 | **NAZORJEVA zasnove** | `renderTemplate()` v `app/atena-card-templates.js` | `app/atena-card-templates.css` | `.uj-*` | 63 |
| 2 | **Prave Atenine kartice** | `questionShellHtml()` v `app/atena-card-renderer.js` + `atena-card-schema.js` | `app/styles.css` | `.ponudba-obrazec__*`, `.atena-*` | 89 |
| 3 | **Codexov mk-set** | lastna skripta v Shadow DOM | vgrajen `<style>` v `gallery-predlogi-blok.html` | `.mk-*` | 220 |

Sistema 1 in 2 sta produkcijska. Sistem 3 zivi samo v galeriji.

V galeriji so meje oznacene z vodoravnimi pasovi `.vrstica-locnica`:

- pri **#27** se zacne sistem 2 (ogrodje `ponudba-obrazec__*`)
- pri **#32** se zacne renderer vnosnih polj (`atena-*`)
- pri **#40** se zacne 53 NAZORJEVA widgetov kot **cele kartice**, ne razstavljene

---

## 1. Register vrstic - `NAZORJEVA-VRSTICE.js`

To **ni** seznam kartic. Je katalog **ponovno uporabljivih vrstic** - manjsih
gradbenih kock, izluscenih iz obstojecih kartic.

```js
module.exports = { version, name, status, vrstice, ids }
```

`vrstice` je polje 133 vnosov te oblike:

```js
{
  number: 1,
  id: "ikonski-krog",
  title: "Velik barvni ikonski krog (34px) na levi strani vrstice",
  ton: "is-good | is-warning | is-bad | is-neutral",
  viriKartic: [
    "nazorjeva:trend-odzivnosti - .uj-card-trend__hint span (izvorni vzorec)",
    "nazorjeva:pregled-odgovorov - .uj-card-review > p span (isti vzorec)"
  ],
  opis: "Zakaj je bila narejena tako in ne drugace ...",
  status: "extracted"
}
```

**`viriKartic` je najpomembnejse polje.** Pove, iz katere prave produkcijske
kartice je vrstica prisla. Preden izumis nov gradnik, poglej, ali ze obstaja
tukaj - to je izrecen namen registra.

Register je **rastoc, ne popoln**. V komentarju na vrhu pise, da ~39 druzin
razredov (`.uj-card-breakeven`, `.uj-card-price-bridge`, `.uj-card-waterfall`,
`.uj-card-funnel`, `.uj-card-heatmap` ...) namenoma **ni** vkljucenih, ker so
ocenjene kot sestavljene vizualizacije enega konkretnega widgeta, ne kot
ponovljive vrstice. Ta presoja ni dokazana; ce najdes ponovno uporabo, jo dodaj.

---

## 2. Generator - `scripts/generate-nazorjeva-vrstice-galerija.js`

Edini nacin, kako nastane `NAZORJEVA-VRSTICE-GALERIJA.html`.
**Datoteke nikoli ne urejaj rocno** - naslednji zagon jo prepise.

### Kaj bere

```
NAZORJEVA-VRSTICE.js                    register 133 vrstic
app/atena-card-templates.js             require() - za id-je "widget-*"
app/atena-card-templates.css            vgradi se dobesedno
scripts/gallery-predlogi-blok.html      220 kartic sistema 3 (Shadow DOM)
scripts/gallery-predlogi-stil.html      dodatni <head> stili
scripts/gallery-predlogi-skripte.html   5 skript svetlega DOM
```

Zadnje tri datoteke obstajajo zato, ker se je vsebina galerije **dvakrat
izgubila**: prvic 205 kartic, drugic 5 skript, ker jih generator ni poznal in
jih je ob regeneraciji izpustil. Ce dodas karkoli neposredno v izhodni HTML,
se bo to ponovilo.

### Kako sestavi telo ene kartice

Dve poti, odvisno od `id`:

**A) `id` se zacne z `widget-`** - gradnik je cela NAZORJEVA predloga:

```js
const realId = v.id.slice("widget-".length);
const template = templateById.get(realId);
const bodyHtml = template.body();
```

Ce telo vsebuje `data-card-reset`, ga generator ovije v **dvodelno strukturo**:

```html
<div data-template-card="ID">
  <div class="uj-answer-card__body"> ...telo brez gumba Ponastavi... </div>
  <div class="uj-answer-card__actions"> ...gumb Ponastavi... </div>
</div>
```

Zakaj: `resetTemplateCard()` zahteva prednika `[data-template-card]` in nato
**ponovno izrise samo `.uj-answer-card__body`**. `renderTemplateBody()` iz
telesa odstrani gumb Ponastavi, ker ta v pravi kartici zivi **zunaj** telesa.
Brez te iste strukture gumb po prvem kliku izgine ali sploh ne deluje.

**B) vsi ostali id-ji** - rocno napisan HTML iz slovarja `PRIMERI` v generatorju:

```js
const PRIMERI = {
  "stolpci-obrokov": `<div class="uj-card-installments">...</div>`,
  "stanje-dolga-primerjava": `<div class="zgodovina-ai-stanje-dolga">...</div>`,
};
```

Ce vnosa ni, kartica izrise oranzno opozorilo Primer se ni pripravljen.

### Oblika izhodne kartice

```html
<article class="vrstica-kartica">
  <header>
    <span class="vrstica-stevilka">#12</span>
    <h2>naslov</h2>
    <span class="vrstica-ton">is-good | is-warning</span>
  </header>
  <div class="vrstica-primer" data-answer-card> ...gradnik... </div>
  <details>
    <summary>Vir in opis</summary>
    <ul class="vrstica-viri"><li>...</li></ul>
    <p class="vrstica-opis">...</p>
  </details>
</article>
```

### Obvezna kontrola

```bash
node scripts/generate-nazorjeva-vrstice-galerija.js
```

Dvakratni zagon mora dati **bajtno identicno datoteko**. Ce ne da, je v
generatorju nedeterminizem (cas, nakljucje, vrstni red kljucev).

---

## 3. Shadow DOM - zakaj se stvari ne stilizirajo

Sistem 3 zivi v **zaprtem drevesu**:

```html
<section id="gallery-predlogi"></section>
<template id="gallery-predlogi-template">
  <style> ...141 KB... </style>
  <div class="mreza">
    <article class="vrstica-kartica">...</article>   <!-- 220 kartic -->
  </div>
</template>
<script>
  const predlogRoot = document.getElementById("gallery-predlogi")
    .attachShadow({ mode: "open" });
  predlogRoot.append(
    document.getElementById("gallery-predlogi-template").content.cloneNode(true)
  );
  // ...159 KB rokovalnikov...
</script>
```

Posledice, na katere sem se sam ujel:

1. **CSS iz `<head>` strani ne pride noter.** Vsi stili morajo biti v `<style>`
   znotraj template.
2. **Delegirani rokovalniki na `document` ne delujejo.** `event.target` se ob
   prehodu meje preslika na gostitelja. Rokovalniki so zato vezani na
   `predlogRoot`, ne na `document`.
3. **Ovoj `<div class="mreza">` je obvezen.** Ko sem kartico izluscil v
   samostojno datoteko in uporabil navaden `<div>`, so zetoni izgubili polnilo -
   `.mreza` je v tem CSS nosilec postavitve.

---

## 4. Dogovori sistema mk-* - kako gradniki komunicirajo

### Ziva vrstica

Vsaka kartica ima **eno** vrstico, ki izpisuje trenutno stanje:

```html
<p class="mk-live">opis &middot; <b>vrednost</b></p>
```

Rokovalniki pisejo **samo v `<b>`**, prek `nastaviZivo(kartica, besedilo)`.
Kartico najdejo z `el.closest('.mk-vr')`.

**Past:** genericni rokovalnik vpise `besediloGumba(g)`, kar je `textContent`
celega gumba. Ce ima gumb `<i>+</i>` in `<small>`, se v zivo vrstico prelije vse
skupaj. Zato zivo vrstico zastavi tako, da `<b>` nosi zadnjo spremembo.

### Globalna animacija in izjeme - TO JE NAJPOGOSTEJSA PAST

Na dnu skripte je delegirani poslusalec:

```js
predlogRoot.addEventListener("click", function (e) {
  var gumb = e.target.closest(".vrstica-primer button");
  if (!gumb || gumb.disabled) return;
  if (gumb.closest(ZELO_OBDELANO)) return;   // <- izjema
  juicePok(gumb);                            // pop animacija
});
```

`ZELO_OBDELANO` je seznam selektorjev widgetov z **lastno mehaniko**:

```
[data-obrazec],[data-mini],[data-nps],[data-bento-hero],[data-bari],
[data-donut],[data-krivulja],[data-merilnik],[data-dvoboj],[data-prihranek],
[data-tedn],[data-koraki],[data-mreza4],[data-zvezde],[data-kviz],
[data-srcki],[data-niz],[data-cas],[data-flash],[data-raven],[data-lestvica],
[data-izzivi],[data-spomin],[data-znacke],[data-stolpci],[data-preklop],
[data-pilula],[data-vrs],[data-izbor]
```

**Ko dodas nov widget z lastno logiko klika, MORAS dodati njegov data-atribut
v ta seznam.** Sicer ob vsakem kliku poskoci cela grafika - lastnik je to
opisal kot bounca cela grafika, naj ne dela to.

### Genericni rokovalniki po razredih

Delujejo samodejno, brez registracije:

| razred | vedenje |
|---|---|
| `.mk-vr-izbira` | enojna izbira med sorojenci v istem starsevskem elementu |
| `.mk-vr-mreza2` | isti gumbi, razporejeni v 2 stolpca |
| `.mk-vr-znacke` | vecizbira; **potrebuje** sosednji `.mk-vr-izbrane` za zetone |
| `.mk-vr-izbrane` | zetoni z x; klik odstrani tudi iz banke zgoraj |
| `.mk-vr-select` | spustni meni brez native `<select>` |
| `.mk-vr-denar` | vnos z ikonskim krogom in enoto |
| `.mk-vr-vnos` | `<span class="mk-label">` nad poljubnim poljem |
| `.mk-vr-uvod` | 36px zaokrozen kvadrat z ikono + naslov + podnapis |

`sinhronizirajZnacke(kartica)` zahteva **oba** elementa, `.mk-vr-znacke` in
`.mk-vr-izbrane`, in se sicer tiho ne izvede.

---

## 5. Gradniki, ki sem jih dodal jaz

### `[data-vrs]` - vrstica s trakom (P68a-P68f)

Sest locenih kartic, vsaka svoje barve, vsaka samostojno vlecljiva.

```html
<div class="mk-vrs" data-vrs
     data-vrs-min="0" data-vrs-max="128" data-vrs-korak="1"
     data-vrs-decimalke="0" data-vrs-enota="EUR"
     style="--barva:#3f9998;--svetla:#8fc7c6;--f:75%">
  <b>Oznaka</b>
  <div class="mk-vrs__trak"><i></i></div>
  <strong>96</strong>
</div>
```

- vrednost zivi v **CSS lastnosti `--f`** kot odstotek, ne v atributu
- enota, meje, korak in decimalke so nastavljivi prek `data-vrs-*`;
  `data-vrs-enota=""` pomeni brez enote, odsotnost pomeni odstotek
- proga se rise z `background-size: calc(100% - Tpx)` in
  `background-position: (T/2)px center`, sicer polnilo prehiti kolesce
- kolesce je `::after` na `.mk-vrs__trak i` in **namerno gleda cez rob polnila**
  za priblizno 11 px; to ni prelivanje

**Past, na katero sem se ujel:**

```js
var surovo = String(vrsta.style.getPropertyValue("--f")).replace(/[^0-9]/g,"");
return surovo === "" ? 50 : parseInt(surovo, 10);
```

Prvotno je bilo `parseInt(...) || 50`. Ker je **0 falsy**, je vrednost 0 tiho
postala 50. Isti vzorec preveri povsod, kjer je 0 veljavna vrednost.

Tipke: puscice, PageUp/Down, Home/End - vse potrebujejo `e.stopPropagation()`,
sicer drug rokovalnik pristeje se svoje.

### `[data-izbor]` - N gumbov + N vrstic (P68g-P68j)

3x3, 4x4, 5x5 in 6x6. Gumb in vrstica sta povezana **po indeksu**:

```html
<div class="mk-bento" data-izbor>
  <div class="mk-izb__gumbi">
    <button data-izbor-gumb="0" aria-pressed="true" class="is-selected"
            style="--barva:#3f9998">Osnovni</button>
    <button data-izbor-gumb="1" aria-pressed="false" style="--barva:#d97b2e">Novi</button>
  </div>
  <div class="mk-izb__vrste">
    <div class="mk-izb__vrsta" data-izbor-vrsta="0"
         style="--barva:#3f9998;--svetla:#8fc7c6;--f:75%">
      <b>Osnovni</b><div class="mk-izb__trak"><i></i></div><strong>96</strong>
    </div>
    <div class="mk-izb__vrsta" data-izbor-vrsta="1">...</div>
  </div>
</div>
```

Stanja: `.je-izbrana` (poudarjena), `.je-zbledela` (ostale), `.je-poskok`
(kratka animacija ob izbiri).

**Past:** senca. Ko sem gumbu nastavil obrobo, ozadje in barvo besedila, je
senca ostala teal, ker jo daje genericni `.mk-bento .is-selected`. Vsak gumb
potrebuje tudi svoj `box-shadow: 0 4px 14px color-mix(...)`.

### `[data-pilula]` - posamezna pilula (P73a)

Modularna: dodajas jih po ena. Odstotek je **v dnu pilule, v belem**; pod 16 %
se barva preklopi v crno, ker bela na svetlem ozadju izgine.

**Past:** `.mk-bento` centrira besedilo. Nalepka potrebuje izrecen
`text-align: left`.

### Animacija

Zacetna razlicica je bila `scale(.85) -> 1.07 -> 1` v 0.4 s. Lastnik je
zahteval umiritev; koncna je `scale(.97) -> 1` v 0.2 s ease-out.

---

## 6. Kako dodas nov gradnik - postopek

1. **Preveri register.** `NAZORJEVA-VRSTICE.js` - ali vrstica ze obstaja?
   Ce da, uporabi njen razred, ne pisi novega CSS.
2. **Izberi sistem.** Prava produkcijska kartica -> sistem 1 ali 2 in njuni
   razredi. Galerijski prikaz -> sistem 3.
3. **Napisi kartico v `scripts/gallery-predlogi-blok.html`**, znotraj
   `<div class="mreza">`, po vzorcu obstojecih `<article class="vrstica-kartica">`.
4. **Ce ima lastno logiko klika, dodaj data-atribut v `ZELO_OBDELANO`.**
5. **Dodaj `<p class="mk-live">` z enim `<b>`.**
6. **Regeneriraj** in preveri bajtno identicnost ob drugem zagonu.
7. **Poglej pri 390 x 844.** Nikoli v sirokem namiznem prikazu in nikoli v
   pomanjsanem predogledu - slicica na `atena-question-lab.html` kartico stisne
   na 299 px in pomanjsa na 44 %, kar da lazne napake o prekrivanju.
8. **Dvigni cache oznako** spremenjenega vira, kot zahteva CLAUDE.md.

---

## 7. Pravilo za urejanje `gallery-predlogi-blok.html`

Datoteka je 601 KB in razredi se v njej **ponovijo desetkrat**.

**Nikoli ne uporabi `indexOf` na golem vzorcu.** Najprej poisci sidro kartice:

```js
const i86 = s.indexOf('vrstica-stevilka">P86');
const a0  = s.lastIndexOf('<article class="vrstica-kartica je-app">', i86);
const a1  = s.indexOf('</article>', i86) + 10;
// sele znotraj [a0, a1] isci karkoli drugega
```

Ob tej napaki sem `indexOf('data-izbor')` dobil prvo pojavitev v datoteki - to
je bil **P68g**, ne P86 - in vanjo vrinil tujo vsebino.

---

## 8. Kaj je odprto

- **Vprasalnik P86** (kateri 3 mobilni ponudniki in kaksni placilni pogoji) je
  v galeriji v obliki, ki jo je lastnik zavrnil: korak 1 izpise imena dvakrat
  (banka + zetoni), korak 2 pa ima tri gumbe, ki samo podvajajo tri vrstice pod
  sabo. Lastnik je izbral resitev **dve kartici ob boku** - ponudniki kot
  `.mk-vr-izbira` v `.mk-vr-mreza2`, tako kot korak 5. Ni izvedeno.
- **Interakcijsko logiko vprasalnikov prevzames ti.** Lastnik je izrecno rekel,
  naj je jaz ne zasnavljam - katere gumbe, kdaj, kako vezane.

---

## 9. Stevilke

- galerija: **353 kartic** (133 svetlih + 220 v Shadow DOM)
- register: 133 vrstic
- CSS sistema 3: 141 KB, skripta: 159 KB
- generator: 97 KB, idempotenten
- izhodni HTML: 1,05 MB
