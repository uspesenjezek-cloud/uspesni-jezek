# Predaja Codexu — kaj je bilo narejeno 6. 9. 2026

Vse spodaj je **že commitano in objavljeno na produkciji**
(`https://uspesni-jezek.vercel.app`). Nič ni v teku.

---

## 1. Novo, kar moraš poznati pred delom

### `app/varna-shramba.js` — skupni sloj za brskalnikovo shrambo

`sessionStorage` in `localStorage` v zasebnem oknu, pri nastavitvi
"blokiraj vse piškotke" in ponekod v iOS PWA **vržeta izjemo**. V aplikaciji
je bilo izmerjenih **77 nezaščitenih dostopov**; vsak od njih tam prekine
uporabnikovo dejanje sredi izvajanja.

```js
VarnaShramba.preberi(kljuc, zRezervo)       // null namesto izjeme
VarnaShramba.zapisi(kljuc, vrednost, zRezervo) // true/false, nikoli ne vrže
VarnaShramba.preberiJson(kljuc, zRezervo)
VarnaShramba.zapisiJson(kljuc, vrednost, zRezervo)
VarnaShramba.odstrani(kljuc, zRezervo)
VarnaShramba.naVoljo(zRezervo)              // preveri z DEJANSKIM zapisom
```

**Pomembno:** drugi argument `zRezervo` privzeto **ni** vklopljen. Brez njega
se piše samo v `sessionStorage`, torej se trajnost ne razširi po nesreči.
`localStorage` se uporabi le, kadar ga izrecno zahtevaš.

Uporabi ga povsod, kjer pišeš v shrambo. Skripto naloži pred svojo:
```html
<script src="varna-shramba.js?v=…"></script>
```
Testi: `scripts/test-varna-shramba.js`.

**Odprto:** 76 dostopov je še vedno nezaščitenih. Ni jih smiselno popraviti
na slepo — `auth-zascita.js` je npr. NAMERNO vezan na sejo, čarovniški
podatki v `neplacila-*` pa bi z `localStorage` preživeli tedne, kar je
odločitev o izdelku, ne popravek napake.

---

## 2. POS terminal — devet popravljenih napak

### Kar spremeni vedenje in moraš vedeti

**Razčlenjevanje količine** (`app/pos-terminal.js`, `parseQuantityMilli`)
Prej je isti obrazec bral `1.000` kot **1000 €** v polju cene in kot
**1 kos** v polju količine. Zdaj velja isto pravilo za oboje:
nemška tisočica je pika, decimalka vejica.

**Ključi idempotence** (`operationRequestId`)
Strežnik gradi zaščito pred podvojitvijo **izključno** na tem ključu —
`pos_payments` ima `primary key (user_id, request_key)`, RPC-ji delajo
`select … where request_key = p_request_key; if found then return`.
Ključ se je hranil samo v `sessionStorage`, zato je po osvežitvi strani
nastal NOV UUID in strežnik je vstavil **drugo plačilo**. Zdaj se piše v
obe shrambi. Če pišeš nov tok, ki ustvarja denarni zapis, **obvezno**
uporabi `operationRequestId(kind, scope)` in ga počisti šele PO uspehu.

**DATEV izvoz** (`buildDatevExport`)
Zneske je preračunal iz snapshota in jih ni primerjal z zaklenjenim
zneskom računa iz baze (`totals.byRate` je pri strežniškem računu prazen).
Izmerjeno: račun z zaklenjenim bruto 595,00 € se je poknjižil kot 119,00 €,
brez napake in brez opozorila. Zdaj izvoz v takem primeru **vrne napako in
se ustavi**. Če dodajaš knjižbe, ohrani ta invariant.

**TSE sidro** (`writeFiskalyAnchor`)
Transaction ID za nadaljevanje prekinjene TSE transakcije se je hranil samo
v `sessionStorage` in se tiho izgubil. Strežnik izrecno zahteva nadaljevanje
z ISTIM ID. Zdaj obe shrambi + opozorilo, če nobena ne sprejme zapisa.

### Zaledje

- `pos-cash-checkout.js` — pokvarjen `transactionId` se ne nadomesti več tiho
  z `requestKey`, ampak vrne `CASH_REQUEST_INVALID`
- `pos-arhiv-delavec.js` — `CRON_SECRET` mora imeti vsaj 16 znakov (kot
  `pos-delivery-worker.js`)
- `pos-dostava-webhook.js` — `safeEqual` dobil varovalko `a.length > 0`
- `pos-xrechnung.js` `preflightInvoice` — bela lista stopenj DDV 0/7/19 %,
  enaka kot v bazi

---

## 3. Testi — vzorec, ki se ponavlja

**Zamrznjene cache oznake.** CLAUDE.md zahteva novo `?v=` oznako ob vsaki
spremembi vira, več testov pa je trdilo TOČNO vrednost. Taka trditev pade ob
vsaki pravilni spremembi. Popravljenih je 5, **ostane jih 74 v 21 datotekah**.

Pravilna oblika:
```js
assert.match(html, /pos-terminal\.js\?v=\d{8}-[^"']+/);   // oblika, ne vrednost
```

**Časovne bombe.** `test-pos-workflow.js` je od 6. 9. padal vsak dan:
fixture s fiksnim datumom + 14-dnevni odstopni rok + prava sistemska ura.
Rešeno tako, da `workOrderActions(order, now)` zdaj sprejme uro in jo poda
naprej v `consumerWithdrawalAvailable`. **Če pišeš test, ki se dotika rokov,
uro vedno podaj izrecno.** Preverjeno do leta 2031.

Vseh 32 POS testov uspe (prej 31/32).

---

## 4. Git — osnova

Pred tem **269 datotek ni bilo sledenih** in 142 je bilo spremenjenih. Ni bilo
mogoče videti, kaj se je spremenilo, ne vrniti stanja, ne bisektirati.
Commit `2b39068` posname celotno drevo; **nobene datoteke ne spremeni**.

V `.gitignore` sta dodana `eng.traineddata` (5 MB, neuporabljen) in
`artifacts/` (posnetki zaslona). Datoteki ostajata na disku.

Odslej je diff smiseln — uporabi ga.

---

## 5. Česa se NE dotikaj

- **Vprašalnik P86** v `scripts/gallery-predlogi-blok.html` je v obliki, ki jo
  je lastnik zavrnil (podvojena imena v koraku 1, gumbi v koraku 2, ki samo
  podvajajo vrstice pod sabo). Čaka na tvojo zasnovo. Jaz interakcijske
  logike ne delam več.
- **Gotovinski del POS** je namerno zaklenjen: `CASH_PRODUCTION_LOCKED` v
  `pos-cash-checkout.js` dovoli samo `mock` in `training`, trije nizi v
  `pos-production-readiness.js` pa so trdo zapisani. To ni napaka.
- `POS_MIGRATION_MANIFEST` v `scripts/check-pos-migration-deployment.js` je
  ročna odobritev pisanja v produkcijo. **18 migracij čaka**, SHA-ji so
  pripravljeni v `docs/POS-MIGRACIJE-ZA-ODOBRITEV.txt`. Vnos je odločitev
  lastnika, ne agenta.

---

## 6. Pravila za urejanje `scripts/gallery-predlogi-blok.html`

Razredi in atributi se v datoteki ponovijo desetkrat. **Nikoli ne uporabi
`indexOf` na golem vzorcu** — najprej poišči sidro kartice
(`vrstica-stevilka">Pxx`) in išči znotraj njenih meja. Ob tej napaki sem
namesto P86 uredil P68g.

Po vsaki spremembi:
```bash
node scripts/generate-nazorjeva-vrstice-galerija.js
```
Dvakratni zagon mora dati **bajtno identično** datoteko.

---

## 7. Commiti

```
fc57729  varna shramba + nezaščiten zapis cilja
2b39068  osnovni commit celotnega drevesa (538 datotek)
1082c23  idempotenca plačil + DATEV invariant
da5e9a3  TSE sidro
434ede8  količina/cena + 6 najdb pregleda POS
ea5c326  vprašalnik P86 (zavrnjen, čaka zasnovo)
```
