# ZAPISNIK — Uspešni Ježek (stanje ob koncu seje 2026-08-25, pozni del)

Ta dokument je namenjen predaji konteksta novemu pogovoru. Prilepi ga na začetek novega pogovora, da agent takoj razume, kje smo. **Ta datoteka nadomesti prejšnjo verzijo** — prejšnja je opisovala Bonitetni center/`neplacila-posiljanje.html` (glej razdelek 6 spodaj za skrajšan povzetek tega); ta seja se je skoraj v celoti vrtela okoli `app/izvedba.js` (dialog "Kaj želite narediti?" / "Kako je bil račun poravnan?").

## 1. Okolje

- Kanoničen delovni direktorij: `C:\Users\jkjob\Desktop\uspesen jezik git`
- Edini pravi produkcijski naslov: `https://uspesni-jezek.vercel.app/app/index.html` (Vercel projekt `uspesni-jezek`)
- Lokalni dev strežnik `http://localhost:8001` samo za interno testiranje
- **V repozitoriju hkrati dela vsaj eno drugo AI orodje ("Codex").** Pred vsakim posegom v skupno datoteko znova `Read`/`Grep` trenutno stanje.
- **Nič iz te seje ni bilo commitano ali objavljeno na Vercel.** Vse spremembe spodaj so samo na disku (`app/izvedba.js`, `app/izvedba.css`, `app/izvedba-komponente.js`, `app/nastavitve-izidov.js`, `app/koncani-primeri.html`, `app/izvedba.html`). Cache-busting `?v=` oznake so dvignjene sproti, trenutno stanje: `izvedba.js` v29, `izvedba.css` v15, `izvedba-komponente.js` v2, `nastavitve-izidov.js` v6 (po revertu — glej razdelek 4).

## 2. KRITIČNA LEKCIJA (velja še naprej): objava ni opcijska

1. Po vsakem funkcionalnem popravku poženi ustrezen test.
2. Dvigni cache-busting `?v=` na VSEH `<link>`/`<script>` referencah spremenjenih datotek.
3. `git add` samo dotaknjene datoteke.
4. `git commit`, nato `vercel deploy --prod --yes`.
5. Preveri z `curl` na produkcijskem URL-ju, da je nova `?v=` in vsebina dejansko tam.
6. Šele nato sporoči uporabniku "objavljeno".

## 3. Nova arhitektura v `izvedba.js`: dve ločeni "kaj se je zgodilo" poti

Obstajata dva ločena sistema (dva `actionSheetMode`):
- **`"actions"`** — dialog "Kaj želite narediti?", kartice iz `VRSTNI_RED_KARTIC`, odpre se prek `odpriActionSheet(filterKartic)`.
- **`"payment"`** — dialog "Kako je bil račun poravnan?", kartice iz `SETTLEMENT_ORDER` (`nastavitve-izidov.js`), odpre se prek `racunPoravnan()`.

Na zaslonu za pošiljanje opomina (`zo-sledi__vsebina`, funkcija `dodajHitraDejanja()`) so zdaj **trije** gumbi:
- Majhen **"Prekliči opomin"** zraven "Pošlji" (`izvedba-gumb-preklici-hitro`) → odpre "actions" filtrirano na `["skip_current_step", "stop_plan", "postpone_reminder"]`.
- **"Ne bo plačal"** (`izvedba-gumb-preklic`, staro ime "Prekliči opomin") → odpre "actions" filtrirano na `["handoff_to_lawyer", "partial_payment", "cancelled_invoice"]`.
- **"Bo plačal"** (`izvedba-gumb-poravnano`, staro ime "Račun je bil poravnan") → `racunPoravnan()`, "payment" način, prikaže `SETTLEMENT_ORDER` **plus** dodatno kartico "Dolžnik je obljubil plačilo" (glej spodaj).

`state.aktivniFilterKartic` (array ali `null`) filtrira `VRSTNI_RED_KARTIC` v `izrisiActionSvicer()`. Resetira se na `null` v `zapriActionSheet()`.

### Prestavljanje kartic med "Ne bo plačal" / "Bo plačal" — KLJUČNA LEKCIJA

Uporabnik je zahteval premikanje kartic med meniji. Prvi poskus (preimenovanje skupne oznake v `nastavitve-izidov.js`, da "izgleda" kot ista kartica) je bil **eksplicitno zavrnjen** ("kdo ti je to naročil", "izbrisal si kartico") — `nastavitve-izidov.js` je skupen vir za CEL sistem (uporablja ga tudi `koncani-primeri.js`), zato preimenovanje tam vpliva na zgodovinski prikaz povsod, ne samo na en gumb. **Pravilo:** za "premakni kartico med meniji" nikoli ne preimenuj/spreminjaj skupnih `nastavitve-izidov.js`/`SETTLEMENT_META` vnosov — namesto tega dodaj/odstrani ločen vnos v ustreznem seznamu (`VRSTNI_RED_KARTIC` filter oz. ročno vrinjena kartica v `izrisiPoravnavaSvicer()`), ki cilja isti podatkovni tip, a je vizualno/podatkovno ločena entiteta.

Trenutno stanje (po več krogih popravkov):
- **"Ne bo plačal"**: `handoff_to_lawyer` (Posreduj takoj odvetniku), `partial_payment` (Račun je delno poravnan), `cancelled_invoice` (Račun storniran).
- **"Bo plačal"**: `full, partial, compensation, installment, credit_note` (iz `SETTLEMENT_ORDER`) **plus** ročno vrinjena kartica `payment_promised` (Dolžnik je obljubil plačilo) — glej `izrisiPoravnavaSvicer()`.

### "Dolžnik je obljubil plačilo" znotraj "Bo plačal" — vzorec za mešanje sistemov

Ta kartica je edina, ki ne spada v noben od dveh seznamov naravno (ni `SETTLEMENT_ORDER` tip, nima zneska, ki bi zmanjšal dolg). Prvi poskus (klik preklopi cel zaslon na "actions" način) je uporabnik zavrnil ("naj dela kot druge kartice"). **Končna rešitev, ki DELUJE in naj se uporabi kot vzorec za podobne primere:**

- Kartica se izriše ročno v `izrisiPoravnavaSvicer()` z `data-settlement-select="payment_promised"` (isti generični klik-mehanizem kot ostale, brez posebnega handlerja).
- `izrisiPoravnavaPodrobnosti()`: ker `SETTLEMENT_META["payment_promised"]` ne obstaja, uporabi lokalni `OBLJUBA_SETTLEMENT_META` konstanto namesto tega.
- `izrisiPoravnavaKontrolnik()`: veja `if (tip === "payment_promised") return podatkiZaKartico("payment_promised", izbrano);` — **ponovno uporabi obstoječo actions-markup**, brez podvajanja.
- `pripraviPoravnavoZaOddajo()`: posebna veja na vrhu funkcije (PRED `if (!tip || !nastavitve) return null;`, ker `state.settlementSettings.payment_promised` ne obstaja) — bere iz `state.settingsByAction.payment_promised`.
- `opisNacrtovanegaKoraka()`: posebna veja, `znesek: null` (obljuba NE sme zmanjšati `preostaliDolgPoNacrtu()` — samo dejansko prejet denar sme).
- Rezultat: kartica se obnaša 1:1 enako kot ostale (isti "+ Dodaj korak", ista "Potek primera" akumulacija, isti "Potrdi" na koncu), lahko se meša z pravimi denarnimi koraki v istem načrtu — preverjeno.

### Dobropis/Odpust — združitev (prejšnji del te seje)

- "Zaključeno z dobropisom" preimenovano nazaj v **"Dobropis"** (`nastavitve-izidov.js`), zdaj vsebuje notranjo izbiro Dobropis/Odpust (prej ločeno).
- Odstranjena izbira Dobropis/Odpust iz "Delno plačilo" IN iz naprednega načrtovalca "Plačilo v obrokih" (oba zdaj samo denar).
- `VRSTNI_RED_PORAVNAVE`/`SETTLEMENT_ORDER` nima več `cancelled_invoice` (prestavljen v "actions" sistem, glej zgoraj).

### Napreden načrtovalec obrokov (`izrisiObrokPlaner`, prvi del te seje)

- Znotraj "Plačilo v obrokih": izbira števila obrokov (pill 1-20, brez drsnika — `scrollbar-width:none`), razmik (teden/2 tedna/mesec/ročno, privzeto BREZ izbire), "Enakomerno razdeli" kot velik okrogel gumb (privzeto izklopljen), seznam vrstic (znesek+datum), en sam gumb na dnu, ki se sklanja po številu ("Dodaj obrok"/"Dodaj oba obroka"/"Dodaj vse N obroke"/"Dodaj vseh N obrokov v načrt").
- **Znana omejitev (ni bug, obstoječe pravilo)**: zadnji obrok v enakomerno razdeljenem načrtu vedno pade z napako, ker `installment` tip ne sme pokriti celotnega preostalega dolga (obstoječa validacija). Prvi N-1 obrokov se doda uspešno.

### Popravljen bug: gol `addEventListener("click", odpriActionSheet)`

Ker `odpriActionSheet(filterKartic)` zdaj sprejme parameter, vsaka vezava kot gol referenčni klic (brez `function(){...}` ovoja) pošlje klik-`Event` namesto filtra → `state.aktivniFilterKartic.indexOf is not a function` → podre cel izris in obesi celoten zaslon (vsi gumbi videti "mrtvi"). **Pravilo:** pri VSAKEM `addEventListener` klicu na funkcijo, ki sprejme argumente, vedno ovij v anonimno funkcijo, nikoli gole reference.

### Testna past te seje

`window.UJIzvedbaDebug` (izpostavljen v `izvedba.js`) omogoča klic notranjih render-funkcij neposredno (`izrisiActionSheet()`, `izberiAkcijo()` ...), kar **obide** dejansko vezavo gumbov (`addEventListener`). Zgornji bug je ušel mimo ravno zato, ker sem testiral prek debug-hooka namesto s pravim `.click()` na DOM gumbu. **Pravilo za naprej:** za preverjanje click-handler vezav vedno simuliraj pravi DOM `.click()` na dejanskem gumbu (ne kliči notranje funkcije neposredno), sicer napake v vezavi ostanejo neopažene.

## 4. Vzorec, ki je povzročil resno nezaupanje uporabnika — NE PONOVI

Ko je uporabnik rekel "premakni kartico X v gumb Y", sem prvič poskusil "bližnjico" (preimenovanje skupne oznake namesto dejanskega premika) — uporabnik je to pravilno prepoznal kot prikrito izbris, ne premik, in se je močno razjezil ("KDO TI JE TO NAROČIL", "KARTICO SI IZBRISAL"). **Pravilo:** "premakni/prestavi kartico" pomeni: (1) fizično odstrani iz izvornega seznama/filtra, (2) fizično dodaj v ciljni seznam kot ločen, prepoznaven UI element z lastnim imenom/ikono — NIKOLI z zanašanjem na to, da "podoben obstoječ element že to pokriva". Če ciljni sistem tehnično ne podpira te kartice naravno (drugačen podatkovni model), to eksplicitno povej uporabniku IN vprašaj za smer, preden kar koli spremeniš — ne izberi sam "elegantne" bližnjice.

## 5. Trenutno stanje cache-busting oznak (za naslednji `Edit`)

- `app/izvedba.html`: `izvedba.css?v=20260825-storno-v-akcije-v15`, `izvedba.js?v=20260825-obljuba-inline-v29`, `izvedba-komponente.js?v=20260825-storno-akcija-meta-v2`, `nastavitve-izidov.js?v=20260825-revert-v6`
- `app/koncani-primeri.html`: `izvedba-komponente.js?v=20260825-storno-akcija-meta-v2`, `nastavitve-izidov.js?v=20260825-revert-v6`

## 6. Prejšnja seja (Bonitetni center, `neplacila-posiljanje.html`) — SKRAJŠANO, verjetno preseženo

- `bonitetna-preverba.css` in `bonitetna-podjetje-grafike.css` tekmujeta za iste razrede — pri delu na "Podatki podjetja" register-card pogledu vedno preveri OBE datoteki.
- Ikone/majhne elemente vedno preveri pri PRAVI velikosti (1×), ne samo povečano — past, ki je stala veliko časa.
- `app/neplacila-posiljanje.html` (`.delno-resitev`) je bil obsežno predelan, a obstaja sum, da ga je vmes prepisalo drugo orodje ("Codex") — pred kakršnim koli posegom najprej znova preberi dejansko stanje, ne domnevaj.
