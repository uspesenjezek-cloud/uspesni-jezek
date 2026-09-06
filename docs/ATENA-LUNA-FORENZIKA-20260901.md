# Forenzična analiza Atena / Luna — 2026-09-01

**Vir:** veja `snapshot/atena-luna-forensics-20260831`, commit `daa64f1`.
**Način:** read-only. Nobena koda ni spremenjena. Ta datoteka je edini zapis in ni commitana.
**Legenda:** `[POTRJENO]` = prebrano v kodi ali izmerjeno; `[HIPOTEZA]` = sklep brez izvedene meritve; `[OVRŽENO]` = preverjeno in NI napaka.

---

## 1. Izvršni povzetek

Pričakoval sem nezrel sistem s klasičnimi napakami (podvojeni klici, brez generation guarda, brez abort). **Tega nisem našel.** Strežniški sloj Atene je med bolj dodelanimi v tem repozitoriju: obstajajo enotna transportna politika, omejen retry z jitterjem, deadline proračun, idempotenca po `requestId` + prstnem odtisu, in **atomski porazdeljeni sprejemni nadzor v Postgresu** z advisory lockom. Odjemalec ima generation guard in `AbortController` že danes.

Resnične težave zato niso tam, kjer jih išče prvotno navodilo. So na treh drugih mestih:

1. **Realtime dogodek prepiše stanje in uniči vnos.** `naSpremembaPovezave` ob vsakem `SUBSCRIBED` brezpogojno naloži in izriše celoten zaslon — brez preverjanja verzije, ki ga sicer ima `naNoviDogodek`. Ker `render()` popolnoma zamenja `innerHTML` action sheeta brez ohranitve fokusa, uporabnik med tipkanjem opisa izgubi kurzor. To je edini potrjeni mehanizem za "stari rezultat prepiše novega" in za "izguba vnosa".
2. **Serializacija ob vsaki tipki.** Na samostojni strani zgodovine se ob vsakem `input` dogodku sinhrono serializira celotno stanje primera v `sessionStorage`, brez debounce in brez preklica.
3. **Dva ločena podsistema z istim imenom.** "Atenin sistem kartic" (`atena-card-schema/renderer/templates`) in "Atena/Luna semantični tok" (`razcleni-*`) se **ne dotikata**. `izvedba.html` in `neplacila-zgodovina.html` ne naložita niti sheme niti rendererja. Zato več predpostavk iz naloge (skupni register kartic, `cardId`, podvojene kartice) v glavnem toku nima predmeta.

**Zmogljivostna resnica:** obstoječi test ne dokazuje, da sistem postreže 200 uporabnikov. Dokazuje, da pri 200 hkratnih zahtevah **24 uspe in 176 dobi `503 AI_BUSY`**. To je varna degradacija, ne kapaciteta. Odjemalec tega stanja trenutno ne obravnava posebej.

**Priporočilo:** nobenega velikega refactorja. Prvih pet popravkov je skupaj pod ~120 vrstic in odpravi vse potrjene napake.

---

## 2. Kaj je dejansko potrjeno

### 2.1 Kar že deluje pravilno (in se ne sme pokvariti)

| Lastnost | Dokaz |
|---|---|
| Enotna transportna politika, omejen retry (2 poskusa), eksponentni backoff z jitterjem, spoštovanje `Retry-After` | `api/_lib/atena-luna-policy.js:179-215, 217-280` |
| Deadline proračun čez vse poskuse (`deadline = startedAt + totalTimeoutMs`), prekinitev z `AbortController` | `atena-luna-policy.js:229-239, 263-266` |
| Idempotenca: cache po ključu + dedup zahtev v letu; drugačen prstni odtis pri istem `requestId` → `409 REQUEST_ID_REUSED` | `atena-luna-policy.js:404-455`, posebej `408`, `413` |
| Atomski porazdeljeni sprejem: advisory xact lock, najv. **24** hkratnih, najv. **12/min** na uporabnika, 55 s lease | `supabase/migrations/20260830133746_atena_distributed_admission_control.sql:69, 104-115, 121-125` |
| RLS + odvzem pravic, `security definer` s praznim `search_path`, lastništvo iz `auth.uid()` | ista migracija: `26-27, 45-46, 51, 57-59` |
| Generation guard na odjemalcu (obstaja že danes) | `app/neplacila-zgodovina.js:1231-1232, 1262`; `app/neplacila-cilj.js:1000, 1043` |
| `AbortController` s časovno omejitvijo na odjemalcu | `app/atena-request.js:6-21` |
| Stabilna identiteta kandidatov (UUID, **ne** indeks seznama) | `app/neplacila-zgodovina.js:269-275` |
| Transakcijsko dodajanje dogodkov s snapshot rollbackom | `app/izvedba.js:1211-1229` |
| Vsebinski dedup (isto besedilo → en plačljiv klic) — **samo zgodovina** | `api/_handlers/razcleni-zgodovino.js:36-57`; omejitev 100 vnosov na `:13` |

Testi, ki sem jih dejansko pognal na tej veji, vsi uspejo:

```
node scripts/test-atena-reliability-policy.js   -> PASS (916 ms)
node scripts/test-atena-engine-adversarial.js   -> PASS (p50 0.027 ms, p95 0.068 ms)
node scripts/test-atena-200-user-readiness.js   -> PASS (concurrency max 24)
```

### 2.2 Skladnost dokumentacije s kodo

Preveril sem številke iz dokumentacije proti dejanskemu izvozu modulov:

```
matrixReport(): modules 89, fields 137, reviewedModules 89, reviewedFields 137,
                canonicalTemplates 30, approvedTemplates 30,
                missingModules [], missingFields [], missingTemplateBindings []
atena-card-templates.js: templates 61, approved 30
categories["2.0"]: goals 12, legalOutcomes 6, records 18, legalFields 6
```

- `docs/atena-card-system.md` trdi 89 modulov → **se ujema**.
- `docs/ATENA-CILJ-FATHER.md` trdi 61 kartic ter `categories["2.0"]` z 12 cilji in 6 pravnimi izidi → **se ujema**.
- `docs/ATENA-200-USER-READINESS.md` trdi najv. 24 hkratnih in 12/min → **se ujema** z migracijo.

**Kjer dokumentacija zavaja:** glej D13 — naslov "pripravljenost na 200 aktivnih uporabnikov" in izpisani p50/p95 vabita k napačnemu branju testa, ki v resnici zavrne 176 od 200 zahtev, njegove latence pa so zgolj režija koordinacije z lažnim ponudnikom.

### 2.3 Arhitekturna ugotovitev: dva ločena podsistema

`grep -rn "atena-card" app/*.html` vrne **samo**:

```
app/neplacila-cilj.html:129      atena-card-templates.js
app/svetovalec-preverba.html:14  atena-card-templates.css
app/svetovalec-preverba.html:29  atena-card-templates.js
app/svetovalec-preverba.html:30  atena-card-schema.js
app/svetovalec-preverba.html:31  atena-card-renderer.js
```

- **(A) Semantični tok Luna** — `izvedba.html`, `neplacila-zgodovina.html`, `neplacila-cilj.html` → `izvedba.js`, `neplacila-zgodovina.js`, `neplacila-cilj.js` → `/api/razcleni-{zgodovino,dogovor,cilj}` → `zgodovina-naravni-vnos.js` (3876 vrstic) → `atena-luna-policy.js` → OpenAI. **Ne uporablja sheme kartic ne rendererja.** Izrisuje sam, prek `innerHTML`.
- **(B) Sistem kartic** — samo `svetovalec-preverba.html`. 89 modulov, 137 polj, 30 kanoničnih zasnov.

**Posledica za nalogo:** v toku (A) ni registra kartic, ni `cardId` in ni dileme `upsert` proti `append`. Simptom D (podvojene kartice) tam nima mehanizma.

---

## 3. Kaj ostaja hipoteza

Naslednjega **nisem** mogel potrditi, ker zahteva meritev v brskalniku ali produkcijske telemetrijske podatke, ki jih nimam:

| # | Hipoteza | Zakaj je verjetna | Kako jo dokazati |
|---|---|---|---|
| H1 | Vnos v Lunino polje se dejansko zatika na telefonu | D4 (serializacija na tipko) + D6 (neomejen `resize`) sta mehanizma, a nisem izmeril trajanja | Performance profil pri 60 znakih/min na `neplacila-zgodovina.html`, štej long taske > 50 ms |
| H2 | `documentFiles` povzroči merljivo rast pomnilnika | Koda datotek nikoli ne počisti (D5), a velikost je odvisna od uporabe | Heap snapshot po 100 pripetjih/odstranitvah v `svetovalec-preverba.html` |
| H3 | Datoteka iz enega primera se pokaže v drugem | Ključ je samo `fieldId`, brez `caseId` (D5) | Pripni datoteko v primeru A, preklopi na B z istim modulom, kliči `getFiles(fieldId)` |
| H4 | `AI_BUSY` v produkciji dejansko zadene uporabnike | Meja 24 je globalna; ali se doseže, je odvisno od prometa | Števec `AI_BUSY` odgovorov po uri v produkciji |
| H5 | Realtime `SUBSCRIBED` se sproža dovolj pogosto, da moti | Supabase se znova poveže ob prehodu v ozadje/ospredje na iOS | Števec `SUBSCRIBED` dogodkov na sejo |

**Izrecno ovrženo** (preveril in NI napaka — ne popravljaj):

- `[OVRŽENO]` Pojasnjevalni krog ne povzroči `409 REQUEST_ID_REUSED`. `neplacila-cilj.js:1178` osveži `ciljAiRequestId` pred klicem, `neplacila-zgodovina.js:1192` ga osveži ob `pojasnilo`.
- `[OVRŽENO]` Podvojeni listenerji na `izvedba-gumb-*`. `dodajHitraDejanja()` (`izvedba.js:298-320`) vstavlja relativno na `.izvedba-posljizdaj-vrstica`, ki je znotraj `elKartice.innerHTML`; gumbi se pred vsako vezavo na novo ustvarijo.
- `[OVRŽENO]` Dvojni klik na "Pripravi dogodke" sproži dva klica. Varovalo: `neplacila-zgodovina.js:1185` in `neplacila-cilj.js:973` (`status === "analyzing"` → return).
- `[OVRŽENO]` Podvojene kartice ob potrditvi. Pot je **sinhrona** (`neplacila-zgodovina.js:2052` → `izvedba.js:1204`), takoj počisti `naravni.candidates`; asinhronega okna ni.
- `[OVRŽENO]` `cardId` iz indeksa seznama. Kandidati dobijo UUID (`neplacila-zgodovina.js:269-275`).

---

## 4. Diagram trenutne arhitekture

```
TOK (A) — Luna semantika (glavni)                    TOK (B) — kartice
────────────────────────────────                     ─────────────────
izvedba.html                                         svetovalec-preverba.html
neplacila-zgodovina.html                                    │
neplacila-cilj.html                                  atena-card-templates.js (61/30)
        │                                            atena-card-schema.js  (89/137)
        │                                            atena-card-renderer.js
   izvedba.js  ◄──── Supabase realtime                      │
   neplacila-zgodovina.js       ▲                    (drži documentFiles Map — D5)
   neplacila-cilj.js            │                           │
        │              naNoviDogodek (verzijski guard OK)   │
        │              naSpremembaPovezave (BREZ guarda ✗ D1)
        │                                           BREZ POVEZAVE S TOKOM (A)
   atena-request.js  (AbortController + 50 s timeout)
        │
        │  POST /api/razcleni-{zgodovino,dogovor,cilj}
        ▼
   handler: auth → validacija → prstni odtis → cleanRuntime(O(n) ✗ D12)
        │
        ├─ executeIdempotent (cache + inflight)      atena-luna-policy.js:404
        │       │
        │       └─ createDistributedCoordinator ──► Supabase RPC
        │                                            atena_begin_ai_request
        │                                            (advisory lock, 24 / 12-min)
        │
        └─ parser.analyze ──► requestOpenAi ──► OpenAI /v1/responses
              (samo zgodovina ima vsebinski cache — D10)
```

**Oznake na povezavah**

| Povezava | Timeout | Retry | Preklic | Idempotenca | Lastnik stanja | Tveganje |
|---|---|---|---|---|---|---|
| UI → odjemalčev fetch | 50 s (`atena-request.js:4`) | ne | da | `requestId` | odjemalec | timer pušča (D3) |
| handler → sprejem RPC | 3 s (`statement_timeout`) | 1 ponovitev pri finish | ne | `request_key` | Postgres | — |
| handler → OpenAI | 30 s/poskus, 45 s skupaj | 2 | da | prstni odtis | strežnik | — |
| realtime → render | brez | brez | brez | **brez** | strežnik prepiše | **D1 + D2** |

---

## 5. Diagram ciljnega toka

```
uporabniški dogodek
   │
   ├─► lokalni draft se zapiše TAKOJ (sinhrono, brez I/O)
   │
   ├─► render samo prizadetega vozlišča (ne innerHTML celotnega sheeta)
   │
   └─► debounce po namenu (tabela v razdelku 11)
          │
          ▼
   generation.requested  { generationId, stateVersion, inputHash }
          │
          ├─ prekliči prejšnjo generacijo ISTEGA namena (abort + dispose)
          │
          ▼
   POST /api/razcleni-*   (requestId = idempotency ključ; ob retryju NESPREMENJEN)
          │
          ▼
   sprejem: cached | in_progress | busy | rate_limited | start
          │
          ▼
   Luna ──► strukturirana validacija ──► GENERATION GUARD
          │                                    │
          │                          zavrni, če se ne ujema
          │                          (štej staleRejected, NE dotikaj UI)
          ▼
   uporabi rezultat ──► delni render ──► persistence
          │
          └─► realtime dogodki: SAMO če novaVerzija > trenutnaVerzija
                                IN action sheet ni v urejanju
```

**Ključna razlika glede na danes:** realtime pot dobi enak generation guard kot AI pot, izris pa preneha uničevati vozlišče, v katerem je fokus.

---

## 6. Top 10 korenskih vzrokov

### D1 — Realtime `SUBSCRIBED` prepiše novejše stanje `[POTRJENO]` — resnost: VISOKA

**Dokaz:** `app/izvedba.js:481-486`

```js
function naSpremembaPovezave(status) {
  if (status === "SUBSCRIBED") {
    Api.nalozi({ zadevaId: state.zadevaId }).then(function (odgovor) {
      if (odgovor && odgovor.ok === true) { uporabiOdgovor(odgovor); render(); }
    }).catch(function () {});
  }
}
```

Primerjaj z `naNoviDogodek` (`izvedba.js:468-475`), ki ima guard:

```js
if (novaVerzija <= trenutnaVerzija) return; // echo lastne spremembe ali starejše stanje
```

`naSpremembaPovezave` tega guarda **nima**. Dve prekrivajoči se `Api.nalozi` obljubi (ena iz 150 ms debounce, druga iz reconnecta) se lahko razrešita v napačnem vrstnem redu → starejši posnetek prepiše novejšega. To je natanko scenarij E iz naloge, samo da v podatkovni in ne v AI poti.

- **Modul:** `app/izvedba.js`, funkcija `naSpremembaPovezave`.
- **Uporabniška posledica:** po prehodu telefona iz ozadja se lahko prikaže starejše stanje primera; `serverVersion` se zavrti nazaj.
- **Najmanjši varen popravek:** isti verzijski guard kot v `naNoviDogodek` (~3 vrstice).
- **Test:** T3 (razdelek 18).
- **Metrika:** `staleSnapshotRejected` (nov števec) > 0 pomeni, da se je scenarij dogajal.
- **Rollback:** odstrani guard; vedenje se vrne na sedanje.

### D2 — Izris uniči fokus in kurzor `[POTRJENO]` — resnost: VISOKA

**Dokaz:** `app/izvedba.js:1552` — `render()` kliče `izrisiActionSheet()`; ta na `2724, 2754, 3434, 3647, 3721` izvede `elActionSheet.innerHTML = ...`. Iskanje `selectionStart` v `app/izvedba.js` ne vrne **nobenega** zadetka; `document.activeElement` se uporablja le za `actionSheetReturnFocus` (`1512, 2835, 3741`) in past fokusa (`4856-4861`), nikoli za obnovitev kurzorja po izrisu.

Veriga: realtime (D1) ali reconnect → `render()` → `izrisiActionSheet()` → `innerHTML` → textarea, v katero uporabnik tipka, je uničena. Vrednost preživi (zrcali se v `naravni.text` ob vsakem `input`, `neplacila-zgodovina.js:2196`), **fokus in kurzor ne**.

- **Uporabniška posledica:** sredi stavka izgine tipkovnica; nadaljnje tipkanje gre "v prazno".
- **Najmanjši varen popravek:** pred `innerHTML` shrani `activeElement.dataset` ključ + `selectionStart/End`, po izrisu obnovi. Alternativno: preskoči `izrisiActionSheet()`, kadar je `document.activeElement` znotraj `elActionSheet` in je vzrok izrisa **sistemski** (realtime), ne uporabniški.
- **Test:** T5.
- **Metrika:** `focusLostDuringRender` (nov števec).
- **Rollback:** odstrani ohranitev fokusa.

### D3 — Prekinjena generacija pusti 50-sekundni timer `[POTRJENO]` — resnost: SREDNJA

**Dokaz:** `app/neplacila-zgodovina.js:1190`

```js
if (analizaAbort) analizaAbort.abort();     // abort DA, dispose NE
analizaAbort = window.UJAtenaRequest.create();
```

`dispose()` (ki počisti `setTimeout` iz `app/atena-request.js:11-19`) se kliče samo v `finally` na `1275-1277`, in sicer pod pogojem `mojaGeneracija === analizaGeneracija` — kar za **prehiteto** generacijo ne velja. Pravilen vzorec obstaja tik zraven, v `prekiniAktivnoAnalizo()` (`972-975`), ki naredi `abort()` **in** `dispose()`.

Ista napaka v `app/neplacila-cilj.js:979`.

- **Uporabniška posledica:** vsaka prehitena analiza pusti 50 s živ timer s closure. Omejeno, a se ob hitrem ponavljanju kopiči.
- **Najmanjši varen popravek:** dodaj `analizaAbort.dispose();` pred ponovno dodelitvijo (2 vrstici, obe datoteki).
- **Test:** T6.
- **Metrika:** število aktivnih timerjev po 50 ciklih.
- **Rollback:** trivialen.

### D4 — Serializacija celotnega stanja ob vsaki tipki `[POTRJENO]` — resnost: SREDNJA

**Dokaz:** `app/neplacila-zgodovina.js:2278` — na koncu `input` poslušalca:

```js
setTimeout(function () { shrani(false); }, 0);
```

Brez debounce, brez preklica prejšnjega. `shrani()` (`159-224`) na samostojni strani izvede sinhroni `sessionStorage.setItem(KLJUC_ZGODOVINA, JSON.stringify({...}))` z **celotnim** načrtom (`dogodki: debug.state.nacrtKoraki`), vsemi kandidati in celotnim stanjem naravnega vnosa.

Poslabšanje: veja za `[data-ai-clarification-answer]` (`~2216`) kliče `shrani(false)` **sinhrono**, nato pa se sproži še rep na `2278` → **dve serializaciji na tipko**.

Ublažitev, ki jo je treba upoštevati: pri vgnezdeni rabi (`jeVgrajenaZgodovina`) `shrani` na `160-189` zapiše samo v pomnilniški objekt in se vrne — brez I/O. Strošek je torej na samostojni strani `neplacila-zgodovina.html`.

- **Najmanjši varen popravek:** en `trailing` debounce ~400 ms z `clearTimeout` prejšnjega; ob `blur` in `submit` takojšen `flush`. Prikaz natipkanega znaka ostane **nedotaknjen**.
- **Test:** T2.
- **Metrika:** `inputLatencyMs` p95, število long taskov > 50 ms.
- **Rollback:** vrni neposredni klic.

### D5 — `documentFiles` se nikoli ne počisti `[POTRJENO]` (posledice `[HIPOTEZA]`) — resnost: SREDNJA

**Dokaz:** `app/atena-card-renderer.js:8` — `var documentFiles = new Map();` na ravni modula. Polni se na `241` (`documentFiles.set(root.dataset.atenaFieldId, files)`, kjer so `files` pravi `File` objekti). Odstranjuje se **samo** na `234`, ob izrecnem kliku "odstrani". Ni čiščenja ob zaprtju kartice, menjavi primera ali navigaciji. Ključ je **samo** `fieldId` — brez `caseId` ali `userId`.

- **Posledica 1 (pomnilnik, H2):** `File`/blob ročice ostanejo dosegljive do osvežitve strani.
- **Posledica 2 (izolacija, H3):** datoteka, pripeta v primeru A, ostane berljiva prek `getFiles(fieldId)` (`250`) v primeru B, ki uporabi isti `fieldId`. To je zasebnostno tveganje in ga je treba preveriti prednostno.
- **Najmanjši varen popravek:** ključu dodaj `caseId` in dodaj `clearFiles(caseId)`, ki se kliče ob menjavi primera oz. zaprtju obrazca.
- **Test:** T-nov "izolacija datotek med primeri".
- **Rollback:** vrni prejšnji ključ.

### D6 — Neomejen `resize` → meritev celotnega dokumenta `[POTRJENO]` — resnost: SREDNJA

**Dokaz:** `app/atena-card-renderer.js:242`

```js
if (!autoFitBound && typeof window !== "undefined") {
  autoFitBound = true;
  window.addEventListener("resize", function () { fitTextControls(document); }, { passive:true });
}
```

Vezava je pravilno enkratna (`autoFitBound`), a rokovalnik je **brez dušenja** in obdela cel dokument: `fitTextControls` (`201-204`) prečka vse `input[type=text]` in `input[type=number]`, za vsakega pa `fitTextControl` (`185-200`) izvede `getComputedStyle` + `clientWidth` (vsiljen reflow) + `measureText`.

Ista vrsta težave v `app/izvedba.js:4877-4883`: `prilagodiBesediloOmejenemuPolju(elKartice)` in `(elActionSheet)` brez dušenja.

Na iOS `resize` sproži vsako odpiranje/zapiranje tipkovnice in vsak umik naslovne vrstice — torej natanko med tipkanjem.

- **Najmanjši varen popravek:** ovij v `requestAnimationFrame` z zastavico "že načrtovano".
- **Test:** T2 (varianta z odpiranjem tipkovnice).
- **Metrika:** long taski med `resize`.

### D7 — Manjkajoč renderer tiho izklopi validacijo `[POTRJENO]` — resnost: SREDNJA

**Dokaz:** `app/svetovalec-preverba.js:1703`

```js
if (preveri && atenaCardRenderer && atenaCardRenderer.validate && !atenaCardRenderer.validate(ponudbaObrazecPolja)) return false;
```

Če se `atena-card-renderer.js` ne naloži, je pogoj `false` in **validacija obveznih polj se preskoči**; korak se nato označi kot dokončan (`1716`). To je fail-open in ustreza simptomu H iz naloge (preskočena obvezna validacija).

Enako `1708`: `collectValues` pade na rezervno branje `[data-ponudba-field]`, ki ne pozna sestavljenih kontrolnikov.

- **Najmanjši varen popravek:** če je `preveri === true` in rendererja ni, **zavrni** korak z jasno napako, namesto da ga spustiš naprej.
- **Test:** T8 (varianta "modul manjka").
- **Rollback:** vrni sedanji izraz.

### D8 — Shema kartic vrže napako ob nalaganju `[POTRJENO]`, doseg omejen — resnost: SREDNJA

**Dokaz:** `app/atena-card-schema.js:23-25`

```js
if (CANONICAL_TEMPLATES.length !== 30 || CANONICAL_TEMPLATES.some(function (t) { return !t.approved; })) {
  throw new Error("Atena UI: manjka potrjena knjižnica 30 kanoničnih zasnov kartic.");
}
```

Nadaljnji `throw` na `128, 131, 141, 174`. Če `atena-card-templates.js` manjka ali je zastarel, `UJAtenaCardSchema` nikoli ne nastane.

**Ublažitev (pomembno za oceno resnosti):** `svetovalec-preverba.js` vsako rabo varuje z `&&` (`42-43, 1012, 1461-1464, 1517, 1653-1662`), zato **stran ne crasha** — degradira. Vendar ta degradacija sproži D7 (izklop validacije). To je torej vzrok, ne končni simptom.

### D9 — Ista datoteka z različnima `?v=` `[POTRJENO]` — resnost: NIZKA/SREDNJA

**Dokaz:**

```
app/neplacila-cilj.html:129      atena-card-templates.js?v=20260831-category-2-0-v1
app/svetovalec-preverba.html:29  atena-card-templates.js?v=20260830-approved-v2
```

Ista datoteka, dva različna cache ključa. Dve posledici: (a) uporabnik, ki obišče obe strani, jo prenese dvakrat; (b) če prihodnja sprememba dvigne le eno oznako, druga stran servira **zastarelo** kopijo → neujemanje med predlogami in shemo → D8 → D7. To neposredno zadeva pravilo iz `CLAUDE.md` §6.6 o dvigu cache različice.

- **Najmanjši varen popravek:** poenoti oznako na obeh mestih.

### D10 — Vsebinski dedup obstaja samo v zgodovini `[POTRJENO]` — resnost: SREDNJA

**Dokaz:** `api/_handlers/razcleni-zgodovino.js:12-17, 36-57` definira `contentCache` + `contentInflight` z `CONTENT_CACHE_MAX_ENTRIES = 100` (`:13`). V `api/_handlers/razcleni-cilj.js` in `api/_handlers/razcleni-dogovor.js` teh struktur **ni** — imata samo `runtime.cache`, ključan po `requestId`.

Ker odjemalec ob vsakem urejanju besedila ponastavi `requestId` (`neplacila-zgodovina.js:2198`, `neplacila-cilj.js:1661`), isto besedilo, poslano znova, v ciljnem in dogovornem toku sproži **nov plačljiv klic**, v zgodovinskem pa ne.

- **Najmanjši varen popravek:** prenesi obstoječi vzorec `analyzeContentOnce` iz zgodovine v druga dva handlerja (koda je že napisana in pokrita s testi).
- **Metrika:** `cacheHitRate` po toku; `promptTokens` na uporabniški namen.

### D11 — Vsebinski cache obide omejitev hitrosti `[POTRJENO]` — resnost: NIZKA

**Dokaz:** `api/_handlers/razcleni-zgodovino.js:162-165`

```js
beforeStart: function () {
  if (runtime.contentCache.has(semanticContentKey) || runtime.contentInflight.has(semanticContentKey)) return null;
  return reserve(auth.user.id, now) ? null : { statusCode: 429, ... };
},
```

Ob zadetku v vsebinskem cachu se rezervacija **preskoči**. Isto vsebino z vedno novimi `requestId` je torej mogoče pošiljati mimo lokalne meje 12/min. Porazdeljeni RPC mejo še vedno uveljavlja (kadar je `auth.token` prisoten), zato je posledica omejena na neskladnost, ne na zlorabo.

### D12 — `runtime.cache` brez zgornje meje + O(n) čiščenje na zahtevo `[POTRJENO]` — resnost: NIZKA/SREDNJA

**Dokaz:** `razcleni-zgodovino.js:59-69` (`cleanRuntime`), `razcleni-cilj.js:20` (`cleanup`), `razcleni-dogovor.js:15-18`. Vsi prečkajo **celotne** mape ob **vsaki** zahtevi. `contentCache` ima mejo 100 vnosov (`razcleni-zgodovino.js:13, 38-40`), `runtime.cache` pa ima **samo TTL (5 min), brez omejitve velikosti**.

Pri burstu znotraj TTL okna mapa raste, s tem pa raste tudi cena čiščenja na vroči poti.

- **Najmanjši varen popravek:** enaka meja vnosov kot pri `contentCache` + čiščenje po števcu (npr. vsak 50. klic), ne ob vsaki zahtevi.

### D13 — Test 200 uporabnikov meri nekaj drugega, kot pove naslov `[POTRJENO]`

**Dokaz:** `scripts/test-atena-200-user-readiness.js:88-91`

```js
assert.equal(outcomes.filter(i => i.statusCode === 200).length, 24);
assert.equal(outcomes.filter(i => i.statusCode === 503 && i.payload.code === "AI_BUSY").length, 176);
```

Test **trdi**, da 176 od 200 uporabnikov dobi zavrnitev. Poleg tega sta ponudnik in RPC v celoti lažna (`mockAdmission`, `:12-47`), zato izpisana `p50 10 ms, p95 14 ms` nista latenci od konca do konca, temveč režija koordinacije v procesu. Prava HTTP obremenitev (`httpBurst`, `:143`) se izvede **samo**, če je podan `--url=`, in še takrat le prenese statični HTML, brez AI klica.

**To ni napaka v testu** — test dela točno to, kar naj bi. Napačna je le interpretacija, ki jo vabi naslov dokumenta.

### D14 — Odjemalec ne obravnava stanj hrbtnega pritiska `[POTRJENO, po odsotnosti]` — resnost: SREDNJA

**Dokaz:** `grep -rn "AI_BUSY\|RATE_LIMITED\|AI_REQUEST_IN_PROGRESS\|REQUEST_ID_REUSED" app/*.js` → **nič zadetkov**. `retryAfterMs` se v `app/atena-request.js:28` shrani, a se v Ateninem toku nikoli ne prebere (uporablja ga le `app/boniteta-profil.js:13`).

Posledica: ob doseženi meji 24 uporabnik vidi le splošno sporočilo in mora ročno klikniti znova; ni odštevanja in ni samodejnega poskusa z istim idempotency ključem. Pri burstu, kakršnega modelira test, to zadene 88 % uporabnikov.

- **Najmanjši varen popravek:** za `retryable === true` s `retryAfterMs` prikaži odštevanje in ponudi en samodejni ponovni poskus z **nespremenjenim** `requestId` (idempotenca to že varuje).

---

## 7. Matrika lastništva stanja

Sedanje stanje (`S`) in ciljno (`C`). Kjer se razlikujeta, je označeno `→`.

| Podatek | Bere | Sme spremeniti | Potrdi | Verzija | Sme Luna neposredno? |
|---|---|---|---|---|---|
| Uporabnikov draft (`naravni.text`) | UI | samo UI | — | brez → `stateVersion` | **ne** (drži) |
| Pojasnjevalni odgovor | UI | samo UI | Atena ob pošiljanju | brez | ne |
| `naravni.candidates` | UI, Atena | Luna predlaga → Atena prevzame | uporabnik ob "potrdi" | `contractVersion` | posredno (drži) |
| `candidateId` | UI | ustvari UI (UUID) | — | stabilen | ne |
| `state.nacrtKoraki` | UI, strežnik | Atena (transakcijsko) | uporabnik | `serverVersion` | ne |
| `serverVersion` | vsi | **samo strežnik** | — | monotona | ne |
| Aktivna generacija | UI | samo UI | — | `analizaGeneracija` | ne |
| Rezultat primera (realtime) | UI | strežnik | strežnik | `plan.version` | ne |
| `documentFiles` | renderer | renderer | — | **brez, brez `caseId`** → dodaj `caseId` | ne |
| Sprejemna vrsta | strežnik | Postgres | Postgres | `lease_token` | ne |

**Privzeto pravilo je v kodi že spoštovano** in ga ne spreminjaj: `atena-luna-policy.js:47-49` (`semanticAuthorityInstructions`) in `assertAdapterOperations` (`51-60`) eksplicitno prepovedujeta, da bi lokalni adapter po Luninem odgovoru ponovno interpretiral vir. Dovoljenih je natanko 7 operacij (`ADAPTER_OPERATIONS`, `33-41`).

**Edina luknja v matriki je vrstica `serverVersion` v realtime poti** — glej D1.

---

## 8. Event contract Atena–Luna

Danes formalnega dogodkovnega vodila **ni**; komunikacija poteka z neposrednimi klici funkcij in `debug.izrisiActionSheet()`. Predlog je zato aditiven — ne zahteva zamenjave sedanjega toka, le da se obstoječi prehodi poimenujejo in opremijo z identiteto.

Minimalna ovojnica (vsi dogodki):

```
{ eventId, correlationId, source: "user" | "system" | "luna",
  caseId, generationId, stateVersion, createdAt, payload }
```

| Dogodek | Kdo sproži | Sme sprožiti novo generacijo? |
|---|---|---|
| `draft.changed` | UI | **ne** |
| `generation.requested` | UI (samo `source: "user"`) | da |
| `generation.started` | odjemalec | ne |
| `generation.completed` | odjemalec po guardu | ne |
| `generation.cancelled` | odjemalec | ne |
| `generation.failed` | odjemalec | ne (razen izrecnega uporabnikovega retryja) |
| `case.updated` | realtime | **ne** — samo osveži prikaz |
| `card.submitted` / `decision.confirmed` | UI | ne |

**Zaščita pred zanko (simptom L):** pravilo je eno samo in ga je treba uveljaviti na enem mestu — *generacijo sme sprožiti izključno dogodek s `source === "user"`*. Danes je ta invarianta izpolnjena po naključju (realtime ne kliče `razcleniBesedilo`), ni pa nikjer zapisana, zato jo lahko prihodnja sprememba tiho prekrši. Povratne zanke v sedanji kodi **nisem našel** — `[OVRŽENO]` za trenutno stanje, a brez varovala.

---

## 9. Generation guard in abort — psevdokoda

Guard na odjemalcu **že obstaja** (`neplacila-zgodovina.js:1231-1232, 1262`). Manjkata dve stvari: `dispose()` (D3) in enak guard v realtime poti (D1).

```js
// ── začetek generacije ────────────────────────────────
function zacniGeneracijo(namen, vhod) {
  if (aktivna[namen]) {                 // prekliči SAMO isti namen
    aktivna[namen].abort();
    aktivna[namen].dispose();           // ← D3: manjka danes
    stevci.abort += 1;
  }
  var gen = {
    id: ++generacija,
    caseId: state.zadevaId,
    stateVersion: state.serverVersion,
    inputHash: zgostitev(vhod),
    ctrl: UJAtenaRequest.create(),
  };
  aktivna[namen] = gen;
  return gen;
}

// ── sprejem rezultata ─────────────────────────────────
function sprejmi(gen, odgovor) {
  if (gen.id !== generacija)                 return zavrni("superseded");
  if (gen.caseId !== state.zadevaId)         return zavrni("case_switched");
  if (odgovor.requestId !== gen.requestId)   return zavrni("request_mismatch");
  if (!ciljnaKarticaObstaja(gen))            return zavrni("target_gone");
  uporabi(odgovor);
}

function zavrni(razlog) {
  stevci.staleRejected[razlog] = (stevci.staleRejected[razlog] || 0) + 1;
  // NE spreminjaj UI-ja
}

// ── realtime (D1) — isti guard, ki danes manjka ───────
function naSpremembaPovezave(status) {
  if (status !== "SUBSCRIBED") return;
  var zahtevanaOb = ++snapshotSeq;
  Api.nalozi({ zadevaId: state.zadevaId }).then(function (o) {
    if (!o || o.ok !== true) return;
    if (zahtevanaOb !== snapshotSeq) return zavrni("snapshot_superseded");
    if (Number(o.plan && o.plan.version || 0) <= Number(state.serverVersion)) {
      return zavrni("snapshot_older");
    }
    uporabiOdgovor(o);
    render();
  }).catch(function () {});
}

// ── čiščenje ──────────────────────────────────────────
function pocisti(gen) {
  gen.ctrl.abort();
  gen.ctrl.dispose();      // clearTimeout
  ustaviStatusniInterval(); // neplacila-zgodovina.js:963-967
}
```

Zavrnjeni star rezultat se **zabeleži v metriko in ne spremeni UI-ja** — to je v obstoječi kodi že tako (`return` brez stranskih učinkov), manjka le števec.

---

## 10. Model idempotence

Sedanje stanje je večinoma pravilno. Zapis za jasnost, kaj nastane kdaj:

| Identifikator | Nastane | Ohrani se ob retryju | Danes obstaja? |
|---|---|---|---|
| `requestId` | ob novi uporabnikovi nameri (`novRequestId()`) | **DA** — ključ idempotence | da |
| `fingerprint` | strežnik, sha256 nad vsebino | da | da (`razcleni-zgodovino.js:102-104`) |
| `request_key` | `contractVersion:userId:requestId` | da | da (`:142`) |
| `lease_token` | ob vsakem `begin` | ne (nov ob prevzemu) | da |
| `generationId` | ob vsakem UI sprožilcu | ne | da (`analizaGeneracija`) |
| `candidateId` | ob nastanku kandidata | da | da (UUID) |
| `correlationId` | — | — | **manjka** |
| `attempt` | ob vsakem poskusu | ne | delno (`attempts` v logu) |

**Ključna invarianta, ki je že spoštovana:** odjemalec ob *retryable* napaki `requestId` **ohrani** (`neplacila-zgodovina.js:1270`, `neplacila-cilj.js:1051` — ponastavi ga samo, če napaka NI retryable). Zato ponovni poskus ne povzroči drugega plačljivega klica. To je pravilno in se ne sme spremeniti.

**Manjka le `correlationId`**, ki bi povezal UI dogodek → generacijo → HTTP zahtevo → RPC → modelni klic v enem iskanju po logih.

---

## 11. Tabela SLO

Vrednosti so **cilji**, ne izmerjeno stanje. Produkcijskih meritev nimam (glej H1–H5).

| Tok | p50 | p95 | Trdi timeout | Opomba |
|---|---|---|---|---|
| Odziv UI na tipko | < 16 ms | < 50 ms | — | ne sme biti debounce-an |
| Prikaz loading stanja | < 150 ms | < 250 ms | — | danes takoj po `izrisiActionSheet()` |
| Sprejem zahteve (RPC) | < 80 ms | < 300 ms | 3 s (`statement_timeout`) | že uveljavljeno |
| Glavna generacija Lune | 3 s | 8 s | 30 s/poskus, 45 s skupaj | že uveljavljeno |
| Celoten odgovor od konca do konca | 3–6 s | < 10 s | 50 s (odjemalec) | cilj iz naloge |
| Delež `AI_BUSY` | < 1 % | < 5 % | — | **nov alarm** |
| Delež stale zavrnitev | ~0 | < 0,5 % | — | **nov števec** |
| Crash rate (frontend) | 0 | 0 | — | |

## 12. Tabela timeoutov (dejansko stanje)

| Korak | Vrednost | Vir |
|---|---|---|
| Odjemalčev fetch | 50 s | `app/atena-request.js:4` |
| Modelni klic, en poskus | 30 s | `atena-luna-policy.js:12` |
| Modelni klic, skupni deadline | 45 s | `atena-luna-policy.js:13` |
| Zgodovinski profil (nižji) | 18 s / 25 s | `atena-luna-policy.js:26-31` |
| Sprejemni RPC | 3 s | migracija, `set statement_timeout = '3s'` |
| Lease | 55 s | migracija, `v_now + interval '55 seconds'` |
| Cache rezultata | 5 min | vsi trije handlerji |
| Backoff | 250 ms → 1500 ms, z jitterjem | `atena-luna-policy.js:21-22, 179-185` |

**Ocena:** proračun je notranje skladen (50 s odjemalec > 45 s strežnik > 30 s poskus). Ne dvigaj teh vrednosti — glej razdelek 20.

## 13. Concurrency in backpressure

| Nastavitev | Sedanja vrednost | Vir | Ocena |
|---|---|---|---|
| Globalno hkratnih AI klicev | **24** | migracija `:124` | ohrani; dvigni šele, ko je izmerjen `AI_BUSY` delež |
| Na uporabnika/min | **12** | migracija `:108` + `policy:19` | ohrani |
| Poskusov na klic | 2 | `policy:20` | ohrani |
| Velikost vrste | **ni vrste** — takojšen `busy` | migracija `:125` | pravilna izbira; vrsta bi le skrila preobremenitev |
| Circuit breaker | **ne obstaja** | — | dodaj šele po meritvi |

**Odgovori na izrecna vprašanja iz naloge:**

- *Ali sme en primer imeti več kot eno glavno aktivno generacijo?* Ne. Danes to preprečuje `status === "analyzing"` guard, kar zadošča.
- *Ali naj nova namera prekliče staro?* Da, in to se že dogaja — manjka le `dispose()` (D3).
- *Kako preprečiti retry storm?* Že preprečeno: 2 poskusa, jitter, spoštovanje `Retry-After`, ter idempotenca, ki ponovni poskus poveže z istim `request_key`.
- *Kako vrniti nadzorovan `busy` namesto crasha?* Že vrnjen (`503 AI_BUSY` + `retryAfterMs`); manjka le, da ga odjemalec **uporabi** (D14).

## 14. AI in prompt pipeline

`[POTRJENO]` glede strukture: izhod je strogo shematiziran. `assertPortableResponseSchema` (`policy:115-154`) zavrne vsak nestrog objekt, neomejeno polje ali nepodprto ključno besedo — torej neveljaven JSON ne more tiho spremeniti stanja. Dokazi za vsako trditev morajo biti **dobesedni podniz** vira (`exactEvidenceSpan`, `:75-79`), kar je močno varovalo proti halucinaciji.

`[HIPOTEZA]` glede velikosti: rasti prompta po korakih **nisem izmeril**. Kar vem zanesljivo:

- Meje so trde in nizke: `MAX_SOURCE_TEXT_LENGTH = 12000`, `MAX_STRUCTURED_ITEMS = 50`, `MAX_REQUEST_BODY_BYTES = 128 KB` (`policy:14, 17, 18`).
- Pojasnjevalni krogi so omejeni na **2** (`policy:16`).
- Zahteva **ne** nosi celotne zgodovine pogovora: telo je `{requestId, text, referenceDate, originalDebt, remainingDebt, clarification}` (`neplacila-zgodovina.js:1203`). Torej **simptom I (neomejena rast konteksta) v tej kodi nima mehanizma** — `[OVRŽENO]` za sedanjo obliko.
- `store: false` (`policy:165`) — ničesar se ne hrani pri ponudniku.

**Edina resnična priložnost je usmerjanje modelov.** Danes gre vse na `gpt-5.6-luna` z `reasoning: high` (`policy:9-10`), z eno izjemo: zgodovinski profil uporablja `low` in 1600 izhodnih tokenov (`policy:26-31`). Ta vzorec je že dokazano varen in ga je smiselno razširiti na klasifikacijo namena — **nikoli** pa na pravno občutljive rezultate.

## 15. Render in memory optimizacija

Konkretno, po dokazih zgoraj:

1. Ohrani fokus in kurzor pri `innerHTML` zamenjavi (D2) — največji učinek na zaznano kakovost.
2. Debounce persistence, **ne** prikaza (D4).
3. `requestAnimationFrame` okoli obeh `resize` rokovalcev (D6).
4. `dispose()` prekinjenih generacij (D3).
5. Počisti `documentFiles` ob menjavi primera (D5).

Merilne točke, ki jih je treba uvesti hkrati: število izrisov na tipko, `inputLatencyMs`, long taski > 50 ms, detached DOM nodes po 50 ciklih odpri/zapri, število aktivnih timerjev.

**Opozorilo:** `izrisiSwipe()` (`izvedba.js:1562-1600`) v zanki bere `offsetLeft`/`offsetTop`/`offsetWidth` in `getComputedStyle` za vsako povezavo — klasičen layout thrash. Deluje pravilno, zato **ni na seznamu popravkov**; zabeleženo za primer, če meritve pokažejo, da je `render()` predrag.

## 16. Observability

Danes obstajata dva strukturirana loga: `[atena-luna-transport]` (`policy:251, 271-278`) in `[atena-admission-finish]` (`policy:436-439`). Oba že pazita, da ne izpišeta vsebine.

**Manjka:** `correlationId`, `staleRejectionReason`, `abortReason`, `queueWaitMs`, `renderDurationMs`, `inputLatencyMs`, `promptTokens`/`completionTokens`.

**Predlagani alarmi:** delež `AI_BUSY` > 5 % / 15 min; stale zavrnitve > 0,5 %; frontend crash rate > 0; `AI_ADMISSION_FINISH_FAILED` > 0 (pomeni, da rezultat ni bil trajno zapisan).

**Ne logiraj** (velja že danes in mora ostati): pravnega vprašanja, osebnih podatkov, vsebine dokumentov, surovega pogovora.

## 17. P0 / P1 / P2

**P0 — stabilizacija (~120 vrstic skupaj, brez prenove):**

| # | Popravek | Datoteka |
|---|---|---|
| 1 | Verzijski guard v `naSpremembaPovezave` (D1) | `app/izvedba.js:481-486` |
| 2 | Ohranitev fokusa/kurzorja ob izrisu (D2) | `app/izvedba.js` — `izrisiActionSheet` |
| 3 | `dispose()` prekinjene generacije (D3) | `neplacila-zgodovina.js:1190`, `neplacila-cilj.js:979` |
| 4 | Debounce persistence (D4) | `neplacila-zgodovina.js:2278` |
| 5 | Poenotenje `?v=` (D9) | `neplacila-cilj.html:129`, `svetovalec-preverba.html:29` |
| 6 | Fail-closed validacija (D7) | `svetovalec-preverba.js:1703` |

**P1 — hitrost in strošek:** vsebinski dedup v cilj/dogovor (D10); `rAF` na `resize` (D6); obravnava `AI_BUSY` + `retryAfterMs` na odjemalcu (D14); meja vnosov za `runtime.cache` (D12).

**P2 — strukturna okrepitev:** `correlationId` skozi celoten tok; zapisano pravilo "generacijo sproži samo `source === "user"`" (razdelek 8); `caseId` v ključu `documentFiles` (D5); usmerjanje modelov za klasifikacijo (razdelek 14).

## 18. Testna matrika

| # | Test | Pričakovano | Pokrit danes? |
|---|---|---|---|
| T1 | Dvojni klik na "Pripravi dogodke" | 1 klic | **da** — `[OVRŽENO]`, guard obstaja |
| T2 | 5 hitrih sprememb besedila | UI se ne zatika; aktivna zadnja generacija | delno — manjka meritev (H1) |
| T3 | A se konča za B (tudi realtime snapshot) | B ostane; A zavrnjen in preštet | **ne** — glavna vrzel (D1) |
| T4 | Menjava primera med generacijo | rezultat A se ne pokaže v B | delno — `caseId` se ne preverja izrecno |
| T5 | Navigacija stran med tokom | draft ostane; fokus se ne izgubi | **ne** (D2) |
| T6 | 50× odpri/zapri zaslon | listenerji in timerji se ne množijo | **ne** (D3) |
| T7 | 50 zaporednih korakov | prompt ne raste | ni relevantno — glej razdelek 14 |
| T8 | Neveljaven modelni odgovor | ni prehoda; draft ostane | **da** — `test-atena-engine-adversarial.js` |
| T9 | Timeout modela | retryable stanje; ni dvojnega plačila | **da** — `test-atena-reliability-policy.js` |
| T10 | Luna nedosegljiva | obstoječe kartice ostanejo uporabne | **da** — ista datoteka |
| T11 | Persistence odpove | kartica ni lažno označena kot shranjena | delno — `AI_ADMISSION_FINISH_FAILED` obstaja (`policy:435-440`) |
| T12 | 200 uporabnikov | nadzorovan `AI_BUSY`, brez crasha | **da**, a glej D13 o interpretaciji |

## 19. Prvih 15 korakov

Vrstni red je spremenjen glede na predlog iz naloge, ker dokazi kažejo drugačno prioriteto: inventura, diagram in generation guard so **že opravljeni oz. obstajajo**, zato se začne pri dejanskih napakah.

| # | Korak | Cilj | Dokaz | Test | Rollback |
|---|---|---|---|---|---|
| 1 | Verzijski guard v `naSpremembaPovezave` | ustavi prepis stanja | D1 | T3 | odstrani guard |
| 2 | Ohrani fokus/kurzor ob izrisu | ustavi izgubo vnosa | D2 | T5 | odstrani ohranitev |
| 3 | `dispose()` prekinjene generacije | ustavi puščanje timerjev | D3 | T6 | 2 vrstici nazaj |
| 4 | Debounce persistence | odpravi zatikanje | D4 | T2 | vrni neposredni klic |
| 5 | Poenoti `?v=` | prepreči zastarel cache | D9 | ročno | vrni oznako |
| 6 | Fail-closed validacija | odpravi preskok validacije | D7 | T8 | vrni izraz |
| 7 | Dodaj števce `staleRejected` / `abort` | naredi 1–3 merljive | — | T3, T6 | odstrani |
| 8 | Izmeri `inputLatencyMs` in long taske | potrdi/ovrzi H1 | H1 | T2 | — |
| 9 | Heap snapshot za `documentFiles` | potrdi/ovrzi H2 | H2 | — | — |
| 10 | Preveri izolacijo datotek med primeri | potrdi/ovrzi H3 (zasebnost) | H3 | nov | — |
| 11 | `rAF` na oba `resize` rokovalca | odpravi jank | D6 | T2 | odstrani |
| 12 | Vsebinski dedup v cilj/dogovor | zniža strošek | D10 | nov | odstrani cache |
| 13 | Obravnava `AI_BUSY` + odštevanje | odpravi ročni retry zid | D14 | T12 | odstrani UI |
| 14 | Meja vnosov za `runtime.cache` | omeji rast | D12 | nov | odstrani mejo |
| 15 | Popravi naslov/uvod readiness dokumenta | prepreči napačno branje | D13 | — | — |

Koraki 1–6 so P0 in gredo lahko v eni objavi za feature flagom. Koraki 7–10 so **meritve**, ne spremembe vedenja, in morajo priti pred kakršnimkoli nadaljnjim optimiziranjem.

## 20. Nevarne bližnjice — izrecno opozorilo

- **Ne dvigaj timeoutov.** Proračun je skladen (50 > 45 > 30 s); dvig bi le podaljšal zamrznitev.
- **Ne dvigaj meje 24**, dokler ni izmerjen delež `AI_BUSY`. Meja ščiti Luno in Supabase, ne aplikacije.
- **Ne uvajaj čakalne vrste** namesto `busy`. Vrsta bi skrila preobremenitev in podaljšala p95.
- **Ne odstrani `SEMANTIC_AUTHORITY_BOUNDARY`** (`policy:47-49`) in ne širi `ADAPTER_OPERATIONS` (`:33-41`). To je varovalo pravne pravilnosti, ne slog.
- **Ne debounce-aj prikaza tipkanja** — samo persistence in analizo (D4).
- **Ne spreminjaj `requestId` ob retryju.** Sedanje vedenje (`neplacila-zgodovina.js:1270`) je pravilno in preprečuje dvojno plačilo.
- **Ne cache-iraj rezultatov med uporabniki.** Ključi danes vsebujejo `auth.user.id` (`razcleni-zgodovino.js:142`) — to mora ostati.
- **Ne delaj velikega refactorja na podlagi tega poročila.** Osem od štirinajstih ugotovitev je pod 10 vrstic popravka.
- **Ne razglasi uspeha brez p95/p99 in crash meritev** — korakov 8–10 ni mogoče preskočiti.
- **Ne odstrani `throw` v `atena-card-schema.js:23-25`.** Je pravilen fail-fast; popraviti je treba posledico (D7), ne vzroka.

