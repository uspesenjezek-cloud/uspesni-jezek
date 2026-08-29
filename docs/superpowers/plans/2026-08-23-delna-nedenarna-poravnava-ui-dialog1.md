# Delna nedenarna poravnava — UI dialog "Kako je bil račun poravnan?" (Plan 2 od 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** V obstoječi kartici "Delno plačilo"/"Obrok" (dialog "Kako je bil račun poravnan?", `app/izvedba.js`) dodati 3-smerni preklopnik Denar/Dobropis/Odpust, ki uporabniku omogoči poslati backend akcijo `partial_settlement` (iz Plan 1) namesto samo obstoječega `partial_payment`.

**Architecture:** Ponovna uporaba obstoječih generičnih pomožnih funkcij (`izrisiPoravnavaSegment`, obstoječi `data-settlement-*` dogodkovni delegatorji), ki že brez sprememb podpirajo poljubno novo polje na `state.settlementSettings[tip]`. Edina prava sprememba logike je: (1) razlog-izbirnik (danes trdo vezan na `cancelled_invoice`) postane ponovno uporaben za poljuben tip, (2) `pripraviPoravnavoZaOddajo()` dobi novo vejo za `kind !== "cash"`. Backend (Plan 1) je že popolnoma zgrajen in testiran — ta plan ga samo pokliče.

**Tech Stack:** Vanilla JS (IIFE modul, brez ogrodja), obstoječi CSS razredi v `app/izvedba.css` (brez nove CSS datoteke — preklopnik ponovno uporabi `.izvedba-segment`/`.izvedba-segment__gumb`, ki že obstajata).

**Spec:** [docs/superpowers/specs/2026-08-23-delna-nedenarna-poravnava-design.md](../specs/2026-08-23-delna-nedenarna-poravnava-design.md), razdelek 3.2 (samo prvi dialog — drugi dialog "Kaj želite narediti?" in prikaz "dosedanji koraki" iz razdelka 3.3 sta namenoma izven obsega tega plana, glej "Naslednji koraki" na koncu).

## Global Constraints

- Brez sprememb `api/izvedi-opomin-ukrep.js`, `app/izvedba-api.js` ali backend datotek — Plan 1 je že popoln in generičen, ta plan je izključno klient-side UI.
- Brez nove CSS datoteke ali novih CSS razredov za sam preklopnik — ponovna uporaba `izrisiPoravnavaSegment`/`.izvedba-segment`.
- Vsaka sprememba `app/izvedba.js`/`app/izvedba.css` mora ob zaključku dvigniti cache-busting `?v=` oznako v `app/izvedba.html` na VSEH mestih, kjer se ta datoteka nalaga (glej `uj-app-popravki` skill).
- Pred vsakim urejanjem `app/izvedba.js` znova preberi trenutno stanje datoteke (drugi agenti jo aktivno urejajo vzporedno) — vrstične številke spodaj so bile preverjene tik pred pisanjem tega plana in se lahko premaknejo.
- Ne spreminjaj `app/nastavitve-izidov.js` (naslov/opis kartice "Delno plačilo"/"Plačilo v obrokih") — to je skupen vir resnice, ki ga uporablja tudi `koncani-primeri.js`; ostane generičen "krovni" naslov, dinamična vsebina znotraj kartice pojasni konkreten mehanizem.

---

## Task 1: Stanje in izris — preklopnik Denar/Dobropis/Odpust

**Files:**
- Modify: `app/izvedba.js:13-29` (DEFAULT_ACTION_SETTINGS/DEFAULT_SETTLEMENT_SETTINGS), `:89-90` (state), `:782-817` (izrisiPoravnavaKontrolnik + razlog blok)
- Test: `scripts/test-izvedba-actions.mjs`

**Interfaces:**
- Consumes: obstoječi `izrisiPoravnavaSegment(tip, polje, moznosti, izbrana)` (`izvedba.js:754-760`, brez sprememb), obstoječi generični dogodkovni delegator za `data-settlement-segment` (`izvedba.js:1110-1118`, brez sprememb — že piše v `state.settlementSettings[tip][polje]` za poljuben `polje`).
- Produces: `izrisiPoravnavaRazlog(tip)` — nova poimenovana funkcija (prej anonimen blok samo za `cancelled_invoice`), ki jo Task 1 in kasnejši klici uporabljajo za poljuben `tip`. `state.settlementSettings.partial`/`.installment` dobita nova polja `kind` ("cash"|"credit"|"writeoff", privzeto "cash") in `reason` (privzeto "").

- [ ] **Step 1: Napiši padajoč strukturni test**

Odpri `scripts/test-izvedba-actions.mjs`. Poišči obstoječi strukturni test, ki bere `app/izvedba.js` (vzorec `citaj("app/izvedba.js")`, glej npr. test okoli vrstice 65). Takoj za zadnjim testom v datoteki dodaj:

```js
  await test("izvedba.js: kartica delno placilo/obrok ima preklopnik Denar/Dobropis/Odpust", () => {
    const src = citaj("app/izvedba.js");
    assert.match(src, /function izrisiPoravnavaRazlog\(tip\)/);
    assert.match(src, /izrisiPoravnavaSegment\(tip,\s*"kind"/);
    assert.match(src, /oznaka:\s*"Denar"/);
    assert.match(src, /oznaka:\s*"Dobropis"/);
    assert.match(src, /oznaka:\s*"Odpust"/);
  });
```

- [ ] **Step 2: Zaženi test in preveri, da pade**

Run: `node scripts/test-izvedba-actions.mjs`
Expected: FAIL — nobeden od vzorcev (`izrisiPoravnavaRazlog`, `"kind"` segment, oznake "Denar"/"Dobropis"/"Odpust") še ne obstaja v `app/izvedba.js`.

- [ ] **Step 3: Znova preberi trenutno stanje `app/izvedba.js` in dodaj privzete nastavitve**

Ker datoteko vzporedno urejajo drugi agenti, najprej z `Read`/`Grep` preveri trenutno besedilo okoli vrstic 13-29 in 89-90 (iskani nizi: `DEFAULT_SETTLEMENT_SETTINGS`, `settlementReasonMenuOpen: false,`) — če so se vrstične številke premaknile, uporabi trenutno lokacijo istega besedila.

V `DEFAULT_SETTLEMENT_SETTINGS` spremeni:

```js
  var DEFAULT_SETTLEMENT_SETTINGS = {
    full: { dateMode: "today", settledAt: null },
    partial: { paymentAmount: null, kind: "cash", reason: "" },
    compensation: { dateMode: "today", settledAt: null },
    installment: { paymentAmount: null, kind: "cash", reason: "" },
    credit_note: { settlementAmount: null },
    cancelled_invoice: { reason: "" },
  };
```

(edini dve spremenjeni vrstici sta `partial:` in `installment:` — dodana `kind: "cash", reason: ""`).

Takoj za `settlementReasonMenuOpen: false,` v `state` objektu dodaj novo polje:

```js
    settlementReasonMenuOpen: false,
    settlementReasonMenuTip: null,
```

- [ ] **Step 4: Izlušči razlog-izbirnik v poimenovano, ponovno uporabno funkcijo**

Najdi obstoječi blok, ki se začne z `var razlogi = [` (danes zadnji del `izrisiPoravnavaKontrolnik`, po `credit_note` veji) in se konča z `'</div>' + '</div>';` (zapre `izrisiPoravnavaKontrolnik`). Ta blok trenutno bere `nastavitve`/`tip` iz zunanjega obsega funkcije. Zamenjaj CEL `izrisiPoravnavaKontrolnik` (od `function izrisiPoravnavaKontrolnik(tip, izbrano) {` do njegovega zaključnega `}`) z:

```js
  function izrisiPoravnavaRazlog(tip) {
    var nastavitve = state.settlementSettings[tip];
    var razlogi = [
      { vrednost: "", oznaka: "Izberite razlog" },
      { vrednost: "duplicate", oznaka: "Podvojen račun" },
      { vrednost: "incorrect", oznaka: "Napačen račun" },
      { vrednost: "agreement", oznaka: "Dogovor z dolžnikom" },
      { vrednost: "other", oznaka: "Drugo" },
    ];
    var izbraniRazlog = nastavitve.reason || "";
    var izbranaMoznost = razlogi.find(function (razlog) { return razlog.vrednost === izbraniRazlog; }) || razlogi[0];
    var jeOdprt = state.settlementReasonMenuOpen && state.settlementReasonMenuTip === tip;
    var moznosti = razlogi.map(function (razlog) {
      var jeIzbran = razlog.vrednost === izbraniRazlog;
      return '<button type="button" class="izvedba-poravnava__razlog-moznost' + (jeIzbran ? ' is-selected' : '') + '" role="option" aria-selected="' + String(jeIzbran) + '" data-settlement-reason-option="' + K.esc(razlog.vrednost) + '" data-settlement-type="' + K.esc(tip) + '">' +
        '<span>' + K.esc(razlog.oznaka) + '</span><span class="izvedba-poravnava__razlog-kljukica" aria-hidden="true">✓</span></button>';
    }).join("");
    return '<div class="izvedba-poravnava__razlog' + (jeOdprt ? ' is-open' : '') + '">' +
      '<button type="button" class="izvedba-poravnava__razlog-sprozi" data-settlement-reason-toggle data-settlement-type="' + K.esc(tip) + '" aria-haspopup="listbox" aria-expanded="' + String(jeOdprt) + '">' +
        '<span data-izvedba-fit data-fit-min="9">' + K.esc(izbranaMoznost.oznaka) + '</span><span class="izvedba-poravnava__razlog-puscica" aria-hidden="true"></span></button>' +
      '<div class="izvedba-poravnava__razlog-meni" role="listbox" aria-label="Razlog"' + (jeOdprt ? '' : ' hidden') + '>' + moznosti + '</div></div>';
  }

  function izrisiPoravnavaKontrolnik(tip, izbrano) {
    var nastavitve = state.settlementSettings[tip];
    if (tip === "full" || tip === "compensation") {
      var segment = izrisiPoravnavaSegment(tip, "dateMode", [
        { vrednost: "today", oznaka: "Danes" },
        { vrednost: "custom", oznaka: "Datum" },
      ], nastavitve.dateMode);
      return segment + (izbrano && nastavitve.dateMode === "custom" ? izrisiPoravnavaDatum(tip, nastavitve.settledAt, "Datum zaključka") : "");
    }
    if (tip === "partial" || tip === "installment") {
      var kindSegment = izrisiPoravnavaSegment(tip, "kind", [
        { vrednost: "cash", oznaka: "Denar" },
        { vrednost: "credit", oznaka: "Dobropis" },
        { vrednost: "writeoff", oznaka: "Odpust" },
      ], nastavitve.kind || "cash");
      var znesekPolje = izrisiPoravnavaZnesek(tip, "paymentAmount", nastavitve.paymentAmount, "Vnesite znesek");
      var razlogPolje = izbrano && nastavitve.kind === "writeoff" ? izrisiPoravnavaRazlog(tip) : "";
      return kindSegment + znesekPolje + razlogPolje;
    }
    if (tip === "credit_note") {
      nastavitve.settlementAmount = trenutniPreostaliDolg();
      return izrisiSamodejniDobropis(nastavitve.settlementAmount) +
        (izbrano ? '<p class="izvedba-poravnava__namig" data-izvedba-fit data-fit-min="7">Za delno znižanje zneska popravite račun — primer ostane odprt.</p>' : '');
    }
    return izrisiPoravnavaRazlog(tip);
  }
```

Opomba: zadnja vrstica (`return izrisiPoravnavaRazlog(tip);`) nadomesti prejšnji inline blok za `cancelled_invoice` — vedenje je enako, ker `izrisiPoravnavaRazlog("cancelled_invoice")` proizvede identičen HTML kot prej (le `aria-label` na meniju se spremeni iz `"Razlog za storno"` v splošni `"Razlog"` — to je namerno, ker se ista funkcija zdaj uporablja tudi za odpust pri delnem plačilu).

- [ ] **Step 5: Zaženi test in preveri, da preide**

Run: `node scripts/test-izvedba-actions.mjs`
Expected: PASS — vključno z novim testom in vsemi obstoječimi (funkcionalnost `izrisiPoravnavaKontrolnik`/`izrisiPoravnavaRazlog` ni pokrita s funkcionalnimi testi te datoteke, saj je `app/izvedba.js` DOM-generacijska koda brez `module.exports` — obstoječi testi nad njo so izključno strukturni/regex, kar ta korak sledi).

- [ ] **Step 6: Commit**

```bash
git add app/izvedba.js scripts/test-izvedba-actions.mjs
git commit -m "Add cash/credit/writeoff switcher to partial settlement card"
```

---

## Task 2: Posplošitev dogodkovnih ročnikov za razlog-izbirnik

**Files:**
- Modify: `app/izvedba.js:1080-1101` (klik-delegator za `data-settlement-reason-option`/`-toggle`), `:1195-1204` (Escape-tipka)
- Test: `scripts/test-izvedba-actions.mjs`

**Interfaces:**
- Consumes: `data-settlement-type="' + K.esc(tip) + '"` atribut, dodan v Task 1 na oba razlog-gumba (`data-settlement-reason-option`, `data-settlement-reason-toggle`).
- Produces: klik na razlog-opcijo/preklop zdaj deluje za POLJUBEN `tip` (prej trdo vezano na `"cancelled_invoice"`), z novim `state.settlementReasonMenuTip` ki sledi, KATERI kartice meni je odprt.

- [ ] **Step 1: Napiši padajoč strukturni test**

V `scripts/test-izvedba-actions.mjs`, takoj za testom iz Task 1, dodaj:

```js
  await test("izvedba.js: razlog-izbirnik ni vec trdo vezan samo na cancelled_invoice", () => {
    const src = citaj("app/izvedba.js");
    assert.match(src, /razlogMoznost\.getAttribute\("data-settlement-type"\)/);
    assert.match(src, /razlogSprozi\.getAttribute\("data-settlement-type"\)/);
    assert.doesNotMatch(src, /state\.selectedSettlementType = "cancelled_invoice";\s*\n\s*state\.settlementSettings\.cancelled_invoice\.reason/);
  });
```

- [ ] **Step 2: Zaženi test in preveri, da pade**

Run: `node scripts/test-izvedba-actions.mjs`
Expected: FAIL — trenutni ročniki (glej Step 3 spodaj) še vedno neposredno berejo `"cancelled_invoice"`, `getAttribute("data-settlement-type")` klic na teh dveh elementih še ne obstaja.

- [ ] **Step 3: Posodobi klik-delegator**

Najdi (znova preberi trenutno stanje pred urejanjem) blok znotraj `elActionSheet.addEventListener("click", ...)`, ki se začne z `var razlogMoznost = event.target.closest("[data-settlement-reason-option]");` in konča tik pred `var poravnavaIzbira = event.target.closest("[data-settlement-select]");`. Zamenjaj ta blok (oba `if` — za `razlogMoznost` in `razlogSprozi`) z:

```js
        var razlogMoznost = event.target.closest("[data-settlement-reason-option]");
        if (razlogMoznost) {
          var razlogTip = razlogMoznost.getAttribute("data-settlement-type");
          state.selectedSettlementType = razlogTip;
          state.settlementSettings[razlogTip].reason = razlogMoznost.getAttribute("data-settlement-reason-option");
          state.settlementReasonMenuOpen = false;
          state.settlementReasonMenuTip = null;
          state.error = null;
          izrisiActionSheet();
          return;
        }
        var razlogSprozi = event.target.closest("[data-settlement-reason-toggle]");
        if (razlogSprozi) {
          var razlogSproziTip = razlogSprozi.getAttribute("data-settlement-type");
          state.selectedSettlementType = razlogSproziTip;
          var zeOdprtZaTaTip = state.settlementReasonMenuOpen && state.settlementReasonMenuTip === razlogSproziTip;
          state.settlementReasonMenuTip = zeOdprtZaTaTip ? null : razlogSproziTip;
          state.settlementReasonMenuOpen = !zeOdprtZaTaTip;
          state.error = null;
          izrisiActionSheet();
          requestAnimationFrame(function () {
            var prviRazlog = elActionSheet.querySelector(".izvedba-poravnava__razlog-moznost.is-selected");
            if (state.settlementReasonMenuOpen && prviRazlog) prviRazlog.focus({ preventScroll: true });
          });
          return;
        }
```

- [ ] **Step 4: Posodobi Escape-tipko ročnik**

Najdi (znova preberi trenutno stanje) blok znotraj `document.addEventListener("keydown", ...)`, ki se začne z `if (state.settlementReasonMenuOpen) {`. Takoj za `state.settlementReasonMenuOpen = false;` znotraj tega bloka dodaj:

```js
        state.settlementReasonMenuTip = null;
```

(ostalo v tem bloku — `izrisiActionSheet()`, iskanje/fokus `[data-settlement-reason-toggle]` — ostane nespremenjeno; ker je element zdaj lahko eden od več, `elActionSheet.querySelector` najde tistega, ki je trenutno v DOM-u, kar je pravilno, saj se ob zaprtju menija znova izriše samo kartica z odprtim menijem).

- [ ] **Step 5: Zaženi test in preveri, da preide**

Run: `node scripts/test-izvedba-actions.mjs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/izvedba.js scripts/test-izvedba-actions.mjs
git commit -m "Generalize settlement reason picker to work for any settlement type"
```

---

## Task 3: Oddaja `partial_settlement` akcije

**Files:**
- Modify: `app/izvedba.js:324-359` (`pripraviPoravnavoZaOddajo`)
- Test: `scripts/test-izvedba-actions.mjs`

**Interfaces:**
- Consumes: `state.settlementSettings[tip].kind` in `.reason` (iz Task 1), backend `actionType: "partial_settlement"` s `settings: { kind, amount, reason }` (iz Plan 1, `api/_lib/izvedba-core.js` `validirajNastavitve("partial_settlement", ...)`).
- Produces: `pripraviPoravnavoZaOddajo()` vrne za `kind !== "cash"` primer `{ actionType: "partial_settlement", settings: { kind, amount, reason } }` namesto dosedanjega vedno-`partial_payment`.

- [ ] **Step 1: Napiši padajoč strukturni test**

V `scripts/test-izvedba-actions.mjs`, takoj za testom iz Task 2, dodaj:

```js
  await test("izvedba.js: pripraviPoravnavoZaOddajo poslje partial_settlement za dobropis/odpust", () => {
    const src = citaj("app/izvedba.js");
    assert.match(src, /actionType:\s*"partial_settlement"/);
    assert.match(src, /kindVneseno === "writeoff" && !nastavitve\.reason/);
  });
```

- [ ] **Step 2: Zaženi test in preveri, da pade**

Run: `node scripts/test-izvedba-actions.mjs`
Expected: FAIL — niz `"partial_settlement"` se v `app/izvedba.js` še ne pojavi (obstaja samo v `api/_lib/izvedba-core.js` iz Plan 1).

- [ ] **Step 3: Posodobi `pripraviPoravnavoZaOddajo`**

Znova preberi trenutno stanje funkcije (išči `function pripraviPoravnavoZaOddajo() {`). Zamenjaj CEL blok za `tip === "partial" || tip === "installment"` (od `if (tip === "partial" || tip === "installment") {` do njegovega zaključnega `}`, TIK PRED `if (tip === "credit_note") {`) z:

```js
    if (tip === "partial" || tip === "installment") {
      var znesekVneseno = Number(nastavitve.paymentAmount);
      if (!Number.isFinite(znesekVneseno) || znesekVneseno <= 0 || znesekVneseno >= dolg) {
        state.error = "Vnesite znesek, ki je večji od 0 in manjši od preostalega dolga.";
        return null;
      }
      var kindVneseno = nastavitve.kind === "credit" || nastavitve.kind === "writeoff" ? nastavitve.kind : "cash";
      if (kindVneseno === "cash") {
        return { actionType: "partial_payment", settings: { paymentAmount: znesekVneseno, settlementType: tip } };
      }
      if (kindVneseno === "writeoff" && !nastavitve.reason) {
        state.error = "Izberite razlog za odpust.";
        return null;
      }
      return { actionType: "partial_settlement", settings: { kind: kindVneseno, amount: znesekVneseno, reason: kindVneseno === "writeoff" ? nastavitve.reason : null } };
    }
```

Opomba: prejšnja koda je preverjala `placilo <= 0 || placilo >= dolg` z lastno spremenljivko `placilo` in vračala vedno `partial_payment`; nova koda preimenuje lokalno spremenljivko v `znesekVneseno` (izogib redeklaraciji, enak vzorec kot `Ned`-priponka v Plan 1), a validacijska meja (`0 < znesek < dolg`) in sporočilo o napaki ostajata IDENTIČNA — samo veja za `kindVneseno !== "cash"` je nova.

- [ ] **Step 4: Zaženi test in preveri, da preide**

Run: `node scripts/test-izvedba-actions.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/izvedba.js scripts/test-izvedba-actions.mjs
git commit -m "Submit partial_settlement action for non-cash partial debt reduction"
```

---

## Task 4: Cache-busting in ročno preverjanje v brskalniku

**Files:**
- Modify: `app/izvedba.html` (cache-busting `?v=` za `izvedba.js`)
- Verify: brskalniško preverjanje (glej spodaj)

**Interfaces:**
- Consumes: vse tri prejšnje naloge.
- Produces: uporabljena, preverjena funkcija v pravem CSS/DOM okolju (ne samo strukturni regex testi).

- [ ] **Step 1: Preveri trenutno cache-busting oznako in jo dvigni**

Run: `grep -n "izvedba.js?v=" app/izvedba.html`

V `app/izvedba.html` zamenjaj najdeno vrednost `izvedba.js?v=<trenutna-oznaka>` z `izvedba.js?v=20260824-poravnava-kind-preklopnik-v1` (če je vzporedni agent medtem že dvignil oznako na kaj drugega, uporabi TO NOVO oznako kot izhodišče imena, ne prejšnjo iz tega dokumenta — glej vzorec iz Plan 1 izvedbe, kjer se je to že enkrat zgodilo).

- [ ] **Step 2: Preveri v brskalniku prek obstoječega debug-vzorca**

Ker stran zahteva pravo prijavo/Supabase sejo (ni dosegljiva brez tega), uporabi enak nadomestni pristop kot v tej seji za `koncani-primeri.js` (glej zgodovino te seje: `fetch`+`eval` produkcijske `izvedba.js`/`izvedba-komponente.js`/`izvedba.css` v prazno testno stran, ročno sestavljen `state` z `selectedSettlementType: "partial"`, `settlementSettings.partial.kind: "writeoff"`, poklican `izrisiPoravnavaKontrolnik("partial", true)` in preverjen izrisan DOM (`getComputedStyle`, `getBoundingClientRect`) pri 320px in 390px — brez horizontalnega preliva, s pravilno prikazanim razlog-poljem).

Ta korak zahteva neposreden dostop do notranjih funkcij modula (`izrisiPoravnavaKontrolnik`, `state`), ki v `app/izvedba.js` NISO izvožene prek `window` (za razliko od `app/koncani-primeri.js`, ki ima namenski `UJKoncaniPrimeriDebug` izvoz). Če preverjanje pokaže, da je to potrebno za zanesljivo brskalniško preverjanje, dodaj ekvivalenten razvojni kavelj (glej komentar pri `UJKoncaniPrimeriDebug` v `app/koncani-primeri.js:625-627` za natančno besedilo/utemeljitev takega kavlja) — `root.UJIzvedbaDebug = { izrisiPoravnavaKontrolnik: izrisiPoravnavaKontrolnik, state: state };` tik pred `if (typeof document !== "undefined")` na koncu datoteke. Če to dodaš, ga vključi v commit tega koraka in dvigni cache-busting oznako še enkrat.

Če v tem okolju vizualnega/DOM preverjanja sploh ni mogoče izvesti (znana omejitev Browser pane v tej seji, glej ZAPISNIK razdelek 6.B6), to uporabniku jasno napiši namesto trditve o uspešni vizualni potrditvi.

- [ ] **Step 3: Commit**

```bash
git add app/izvedba.html
git commit -m "Bump izvedba.js cache-busting tag for settlement kind switcher"
```

(če je bil dodan `UJIzvedbaDebug` kavelj v Step 2, ga vključi v ta ali ločen commit z ustreznim sporočilom).

---

## Naslednji koraki (Plan 3, ločen dokument)

Ta plan pokriva samo dialog "Kako je bil račun poravnan?". Izven obsega, za Plan 3:
- Enak preklopnik v dialogu "Kaj želite narediti?" (kartica "Račun je delno poravnan", `AKCIJE_META.partial_payment` v `app/izvedba-komponente.js`, izris v `app/izvedba.js`) — ta dialog uporablja LOČEN sistem pomožnih funkcij (`izrisiSegmentiranKontrolnik`/`izrisiZnesekVnos`/`izrisiStevec`), ne tistega iz tega plana.
- Prikaz "dosedanji koraki" med aktivnim primerom (spec razdelek 3.3).
- Postavka za `koncani-primeri.js`/`izpeljiPrikazniModel` — ugotovitev iz Plan 1 končnega pregleda, da bo primer z delno poravnavo IN kasnejšim polnim plačilom napačno razvrščen (glej `zadnjaPoravnava` logiko), mora biti eksplicitno rešena, preden je ta funkcija dejansko uporabna v produkciji.
