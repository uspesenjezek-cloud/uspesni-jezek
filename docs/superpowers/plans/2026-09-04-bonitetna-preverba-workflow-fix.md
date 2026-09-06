# Bonitetna preverba: odprava podvojene discovery/verification orkestracije — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the bonitetna-preverba quicksearch screen from spending paid OpenRegister/Apify credits on pre-verification "discovery" calls, and give a bare typed company name (with no unique local match and no full manual address) a real, single, fresh OpenRegister verification path through the existing queue — without ever letting a client-supplied signed OpenRegister proposal stand in for that fresh check.

**Architecture:** Two independently-testable backend changes (queue cache-freshness rule; a new `rawNameIdentitySearch` input mode on the existing `mehka-boniteta` handler that reuses the already-correct-but-currently-unreachable raw-name OpenRegister branch) unblock a frontend change that deletes the two paid pre-verification discovery calls from `izvediUniverzalnoIskanje` and redirects that case straight into the queue. A frontend UX task fixes the resulting "not found" messaging so the searched name stays visible, and shows OpenRegister's own `ambiguous` candidates (already returned in the job result, no extra call) as a read-only disambiguation aid. A dedicated regression test locks in the call-count contract so this cannot regress silently.

**Tech Stack:** Plain Node.js CommonJS backend (`api/_handlers/mehka-boniteta.js`, `api/_lib/mehka-boniteta-queue.js`), vanilla JS frontend (`app/bonitetna-preverba.js`), custom `node scripts/test-*.js` test scripts run directly with `node` (no test framework) — assertion style mixes `node:assert` functional checks with `assert.match`/`assert.doesNotMatch` regex checks against file source, exactly as in the existing test scripts (see `scripts/test-openregister-one-credit-budget.js`, `scripts/test-mehka-boniteta-queue.js`).

**Spec:** The user's pasted handoff report (this conversation) plus the explicit numbered product rules in its §2 "Uporabnikovo obvezno produktno pravilo", refined by one explicit user decision made during planning (see Global Constraints). `docs/BONITETA-REGRESSION-GUARDRAILS.md` and `docs/BONITETA-MERE.md` are the project's existing living guardrail docs and must be updated, not duplicated.

## Global Constraints

- Quicksearch cards (typing) must use only local shards/saved profiles — zero OpenRegister, zero Apify/North Data calls. (Already true today — verified; do not regress it.)
- When the user explicitly starts an actual verification, OpenRegister gets **exactly one** fresh `GET /v0/search/company` call per new identity check — never zero, never two.
- **Explicit user decision (this session, overrides a literal reading of the pasted spec's rule #6):** the existing 24-hour "safe verified result" cache reuse for **website** and **full-manual-address raw name** re-checks stays exactly as it is today (tested in `scripts/test-mehka-boniteta-queue.js:452-455`) — do not touch it. Only the **local-index-card** path (already forced fresh) and the **new bare-name-without-address** path introduced by this plan are forced fresh, mirroring each other.
- Never let a client-supplied signed OpenRegister proposal (`openRegisterIdentityProof`) stand in for a fresh check on this screen. After this plan, the bonitetna-preverba frontend must never produce that field from its own quicksearch flow again.
- North Data (`parsebird/northdata-scraper` + `trev0n/northdata-scraper`) starts only from the single existing gate `zacniNorthDataPoOpenRegisterju` (`api/_handlers/mehka-boniteta.js:7479`), only after `openregister.status === "found"`. Do not add a second start point.
- Do not delete now-unreachable frontend functions (`poisciNorthDataPodjetja`, `poisciAutocompletePodjetja`) — per stored user preference, dead code gets left in place, not silently removed, unless the user asks.
- Bump the cache-busting `?v=` query on `app/bonitetna-preverba.html`'s script/style tags for every changed JS/CSS file (per `CLAUDE.md` §6.6).
- Every task that touches `app/bonitetna-preverba.js` or `api/_handlers/mehka-boniteta.js` must re-run `npm run verify:local` before other checks (per `CLAUDE.md` §9), and the final task must exercise the real flow at `http://localhost:8001/app/bonitetna-preverba.html?app-preview=1#new` with real OpenRegister/Apify counters — no completion claim without that screenshot evidence (per `CLAUDE.md` §6.11).

## File Structure

- `api/_lib/mehka-boniteta-queue.js` — `zahtevaPrisilnoSvezePreverjanje` (line ~106) gets one new OR-clause for the new `rawNameIdentitySearch` input marker. No other change in this file.
- `api/_handlers/mehka-boniteta.js` — the `INVALID_INPUT` guard (line ~7676) and the raw-name OpenRegister branch (line ~7803) accept and honor the new `rawNameIdentitySearch` input mode; a small new validation rejects it when combined with any other candidate/proof field.
- `app/bonitetna-preverba.js` — `izvediUniverzalnoIskanje` (line ~1290) stops calling `poisciNorthDataPodjetja`/`poisciAutocompletePodjetja` and instead submits a raw-name queue check; `izvediBonitetnoPreverbo` (line ~5820) gains a `surovoImeVnos` input mode; `nastaviSpletnoRezervo`/`prikaziPotPoNeuspesnemRegistrskemIskanju` (line ~1027, ~1056) keep the searched name visible in the fallback message; a small new renderer shows `ambiguous` OpenRegister candidates read-only.
- `app/bonitetna-preverba.html` — cache-busting `?v=` bump for `bonitetna-preverba.js`.
- `scripts/test-mehka-boniteta-queue.js` — extend with the new `rawNameIdentitySearch` freshness assertions.
- `scripts/test-mehka-boniteta.js` or a new `scripts/test-boniteta-raw-name-search.js` — new backend tests for the raw-name branch (guard relaxation, forceFresh, mutual-exclusivity rejection).
- New `scripts/test-boniteta-quicksearch-no-discovery-calls.js` — source-level regression test proving `izvediUniverzalnoIskanje` no longer calls the two discovery functions, and that the raw-name payload wiring is present.
- `docs/BONITETA-REGRESSION-GUARDRAILS.md` — add the new rule.

---

### Task 1: Queue must force a fresh OpenRegister check for the new bare-name search, without touching the existing website/manual-address cache policy

**Files:**
- Modify: `api/_lib/mehka-boniteta-queue.js:106-110`
- Test: `scripts/test-mehka-boniteta-queue.js` (append near the existing `zahtevaPrisilnoSvezePreverjanje` assertions at line 452-462)

**Interfaces:**
- Consumes: nothing new.
- Produces: `zahtevaPrisilnoSvezePreverjanje(telo)` now also returns `true` when `telo.rawNameIdentitySearch === true` and `telo.confirmedIdentity.confirmed` is not `true`. This is the contract Task 2's frontend payload (`rawNameIdentitySearch: true`) relies on to guarantee cache-bypass.

- [ ] **Step 1: Write the failing test**

Add this block directly after the existing block at `scripts/test-mehka-boniteta-queue.js:456-462` (right after the `companyIndexSource: "offeneregister"` assertions, before the `recheckMode: "manual_refresh"` assertion at line 463):

```js
  assert.equal(queue._test.zahtevaPrisilnoSvezePreverjanje({ ime: "Cache GmbH", rawNameIdentitySearch: true }), true,
    "nova preverba surovega imena brez lokalne kartice mora vedno sveže poklicati OpenRegister");
  assert.equal(queue._test.zahtevaPrisilnoSvezePreverjanje({
    ime: "Cache GmbH", rawNameIdentitySearch: true, confirmedIdentity: { confirmed: true },
  }), false, "nadaljevanje že potrjene identitete iz surovega imena ne sme ustvariti drugega OpenRegister kredita");
  assert.equal(queue._test.zahtevaPrisilnoSvezePreverjanje({ ime: "Cache GmbH" }), false,
    "brez izrecne oznake rawNameIdentitySearch ostane obstoječe varno 24-urno predpomnjenje nespremenjeno");
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node scripts/test-mehka-boniteta-queue.js
```
Expected: FAIL — `zahtevaPrisilnoSvezePreverjanje({ ime: "Cache GmbH", rawNameIdentitySearch: true })` currently returns `false`, not `true`.

- [ ] **Step 3: Implement**

Replace `api/_lib/mehka-boniteta-queue.js:106-110`:

```js
function zahtevaPrisilnoSvezePreverjanje(telo) {
  var jeNovaPreverbaLokalneKartice = Boolean(telo && telo.companyIndexSource === "offeneregister" &&
    !(telo.confirmedIdentity && telo.confirmedIdentity.confirmed));
  return jeNovaPreverbaLokalneKartice || Boolean(telo && ["manual_refresh", "saved_profile", "stale_version"].includes(telo.recheckMode));
}
```

with:

```js
function zahtevaPrisilnoSvezePreverjanje(telo) {
  var jePotrjenoNadaljevanje = Boolean(telo && telo.confirmedIdentity && telo.confirmedIdentity.confirmed);
  var jeNovaPreverbaLokalneKartice = Boolean(telo && telo.companyIndexSource === "offeneregister" && !jePotrjenoNadaljevanje);
  // Surovo ime brez lokalne kartice in brez polnega ročnega naslova nima
  // razločevalnega naslovnega ključa v predpomnilniku, zato dobi isto
  // prisilno svežo obravnavo kot lokalna kartica (glej Task 2 v backend
  // handlerju za ujemajočo se forceFresh logiko na OpenRegister klicu).
  var jeNovoSurovoImeIskanje = Boolean(telo && telo.rawNameIdentitySearch === true && !jePotrjenoNadaljevanje);
  return jeNovaPreverbaLokalneKartice || jeNovoSurovoImeIskanje ||
    Boolean(telo && ["manual_refresh", "saved_profile", "stale_version"].includes(telo.recheckMode));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node scripts/test-mehka-boniteta-queue.js
```
Expected: PASS (full script prints its three `✓` summary lines with no thrown error).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/mehka-boniteta-queue.js scripts/test-mehka-boniteta-queue.js
git commit -m "fix(boniteta): force fresh OpenRegister check for new raw-name identity search"
```

---

### Task 2: Backend accepts a bare company name (no address) as a real single-search identity check

**Files:**
- Modify: `api/_handlers/mehka-boniteta.js:7660-7818` (input-mode guards and the raw-name branch)
- Test: new `scripts/test-boniteta-raw-name-search.js`

**Interfaces:**
- Consumes: `telo.rawNameIdentitySearch === true` (new boolean body field), `queue._test.zahtevaPrisilnoSvezePreverjanje` contract from Task 1 (queue-level; independent of this task, but both are driven by the same frontend field name — keep them identical: `rawNameIdentitySearch`).
- Produces: a request body `{ ime: "<name>", rawNameIdentitySearch: true }` (no `naslov`/`postnaStevilka`/`kraj`, no `companyIndexSource`, no `openRegisterIdentityProof`, no `companyIndexProof`, no `openRegisterCompanyId`, no `registerNumber`) now reaches the existing `openregisterOsnovniVnos.ime` branch at line ~7803 instead of being rejected with `INVALID_INPUT`, and that branch performs exactly one **forced-fresh** `poisciOpenRegister` call. This is what Task 4's frontend payload relies on.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-boniteta-raw-name-search.js`:

```js
"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var root = path.resolve(__dirname, "..");
var source = fs.readFileSync(path.join(root, "api/_handlers/mehka-boniteta.js"), "utf8");
var activeFlow = source.slice(source.indexOf("async function handler"), source.indexOf("handler._test"));

// 1. The INVALID_INPUT guard must let a flagged bare name through.
assert.match(activeFlow, /surovoImeIskanje\s*=\s*Boolean\(telo\.rawNameIdentitySearch === true/,
  "backend mora prepoznati izrecno označeno surovo ime brez naslova");
assert.match(activeFlow, /!izbranoRegistrskoPodjetje\s*&&\s*!surovoImeIskanje\)\s*\{[\s\S]{0,200}INVALID_INPUT/,
  "prazen vnos brez spletne strani, naslova ali kandidata mora ostati zavrnjen tudi za novo pot");

// 2. The raw-name OpenRegister branch must force a fresh call when this flag is set.
assert.match(activeFlow, /openregisterOsnovniVnos\.ime\)\s*\{[\s\S]{0,220}poisciOpenRegisterNajvecEnkrat\(openregisterOsnovniVnos,\s*\{\s*forceFresh:\s*surovoImeIskanje\s*\}\)/,
  "surovo ime brez naslova mora vedno sprožiti sveže OpenRegister iskanje, ne predpomnjenega");

// 3. Mutual exclusivity: rawNameIdentitySearch must not combine with any pre-resolved candidate/proof field.
assert.match(activeFlow, /rawNameIdentitySearch[\s\S]{0,400}RAW_NAME_SEARCH_CONFLICT/,
  "surovo ime ne sme sobivati z lokalno kartico, podpisanim predlogom ali eksplicitnim companyId");

console.log("✓ Backend raw-name identity search: guard, forceFresh in izključnost so ožičeni.");
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node scripts/test-boniteta-raw-name-search.js
```
Expected: FAIL on the first `assert.match` (`surovoImeIskanje` does not exist yet).

- [ ] **Step 3: Implement**

In `api/_handlers/mehka-boniteta.js`, locate the block at lines 7660-7677 (mutual-exclusivity checks followed by the `INVALID_INPUT` guard):

```js
  var lokalniCompanyIndexIzbor = telo.companyIndexSource === "offeneregister";
  if (lokalniCompanyIndexIzbor && (telo.openRegisterCompanyId || telo.openRegisterIdentityProof || telo.companyIndexProof)) {
    return odgovorJson(res, 400, {
      ok: false,
      code: "COMPANY_INDEX_SELECTION_INVALID",
      napaka: "Izbira podjetja iz lokalne baze ni veljavna. Poiščite ga znova.",
    });
  }
  var popolnRocniVnos = Boolean(vnos.ime && vnos.naslov.length >= 3 && /^\d{5}$/.test(vnos.postnaStevilka) && vnos.kraj.length >= 2);
  var odprtiRegister = razcleniOpenRegisterVnos(vnos.registerNumber);
  var izbranoRegistrskoPodjetje = Boolean(vnos.ime && (
    razcleniOpenRegisterVnos(varnoBesedilo(telo.openRegisterCompanyId, 120)).companyId ||
    podpisanoOpenRegisterPodjetje ||
    (lokalniCompanyIndexIzbor && vnos.ime) ||
    podpisanNorthDataPredlog
  ));
  if (!vnos.spletnaStran && !popolnRocniVnos && !izbranoRegistrskoPodjetje) {
    return odgovorJson(res, 400, { ok: false, code: "INVALID_INPUT", napaka: "Vnesite spletno stran ali pa ročno izpolnite ime in celoten naslov podjetja." });
  }
```

Replace with:

```js
  var lokalniCompanyIndexIzbor = telo.companyIndexSource === "offeneregister";
  if (lokalniCompanyIndexIzbor && (telo.openRegisterCompanyId || telo.openRegisterIdentityProof || telo.companyIndexProof)) {
    return odgovorJson(res, 400, {
      ok: false,
      code: "COMPANY_INDEX_SELECTION_INVALID",
      napaka: "Izbira podjetja iz lokalne baze ni veljavna. Poiščite ga znova.",
    });
  }
  var popolnRocniVnos = Boolean(vnos.ime && vnos.naslov.length >= 3 && /^\d{5}$/.test(vnos.postnaStevilka) && vnos.kraj.length >= 2);
  var odprtiRegister = razcleniOpenRegisterVnos(vnos.registerNumber);
  var izbranoRegistrskoPodjetje = Boolean(vnos.ime && (
    razcleniOpenRegisterVnos(varnoBesedilo(telo.openRegisterCompanyId, 120)).companyId ||
    podpisanoOpenRegisterPodjetje ||
    (lokalniCompanyIndexIzbor && vnos.ime) ||
    podpisanNorthDataPredlog
  ));
  // Surovo ime brez lokalne kartice, naslova ali predloga sme v eno samo
  // sveže OpenRegister iskanje, vendar samo kot lasten, nedvoumen vnos —
  // sicer bi lahko tiho prepisal ali podvojil drug že razrešen kandidat.
  var surovoImeIskanje = Boolean(telo.rawNameIdentitySearch === true && vnos.ime && !vnos.spletnaStran);
  if (surovoImeIskanje && (lokalniCompanyIndexIzbor || podpisanoOpenRegisterPodjetje || podpisanNorthDataPredlog ||
    telo.openRegisterCompanyId || telo.companyIndexProof || vnos.registerNumber)) {
    return odgovorJson(res, 400, {
      ok: false,
      code: "RAW_NAME_SEARCH_CONFLICT",
      napaka: "Surovo iskanje po imenu ne sme biti hkrati poslano z lokalno kartico, predlogom ali registrsko številko.",
    });
  }
  if (!vnos.spletnaStran && !popolnRocniVnos && !izbranoRegistrskoPodjetje && !surovoImeIskanje) {
    return odgovorJson(res, 400, { ok: false, code: "INVALID_INPUT", napaka: "Vnesite spletno stran ali pa ročno izpolnite ime in celoten naslov podjetja." });
  }
```

Then update the raw-name OpenRegister branch at line ~7803-7811:

```js
    } else if (openregisterOsnovniVnos.ime) {
      var prviOpenRegisterZacetek = Date.now();
      openregister = await poisciOpenRegisterNajvecEnkrat(openregisterOsnovniVnos);
      console.info("[mehka-boniteta:workflow-timing]", {
        phase: "openregister_identity",
        elapsedMs: Date.now() - prviOpenRegisterZacetek,
        status: openregister.status,
        inputSource: hitriSpletniKontekst.openRegisterInput ? "url_context" : "entered_identity",
      });
```

to:

```js
    } else if (openregisterOsnovniVnos.ime) {
      var prviOpenRegisterZacetek = Date.now();
      openregister = await poisciOpenRegisterNajvecEnkrat(openregisterOsnovniVnos, { forceFresh: surovoImeIskanje });
      console.info("[mehka-boniteta:workflow-timing]", {
        phase: "openregister_identity",
        elapsedMs: Date.now() - prviOpenRegisterZacetek,
        status: openregister.status,
        inputSource: surovoImeIskanje ? "raw_name_identity_search" : hitriSpletniKontekst.openRegisterInput ? "url_context" : "entered_identity",
      });
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node scripts/test-boniteta-raw-name-search.js
node --check api/_handlers/mehka-boniteta.js
node scripts/test-openregister-one-credit-budget.js
```
Expected: all three PASS. The last one must still pass unmodified — it proves this change did not touch the one-credit-per-run budget guarantee.

- [ ] **Step 5: Commit**

```bash
git add api/_handlers/mehka-boniteta.js scripts/test-boniteta-raw-name-search.js
git commit -m "feat(boniteta): accept a single fresh OpenRegister search for a bare company name"
```

---

### Task 3: Frontend stops spending paid discovery calls before an actual verification starts

**Files:**
- Modify: `app/bonitetna-preverba.js:1290-1372` (`izvediUniverzalnoIskanje`)
- Modify: `app/bonitetna-preverba.js:5820-5871` (`izvediBonitetnoPreverbo` — new `surovoImeVnos` input mode)
- Test: new `scripts/test-boniteta-quicksearch-no-discovery-calls.js`

**Interfaces:**
- Consumes: Task 2's contract — a request body `{ ime, rawNameIdentitySearch: true }` reaches the backend's raw-name branch.
- Produces: `izvediBonitetnoPreverbo()` now recognizes `nacinVnosa === "surovo_ime"` as a third valid input mode (alongside existing `"spletna"` and `"register"`), sending `rawNameIdentitySearch: true` in the queue payload. This is what Task 4 relies on when rendering fallback state.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-boniteta-quicksearch-no-discovery-calls.js`:

```js
"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var root = path.resolve(__dirname, "..");
var source = fs.readFileSync(path.join(root, "app/bonitetna-preverba.js"), "utf8");
var iskanje = source.slice(
  source.indexOf("async function izvediUniverzalnoIskanje"),
  source.indexOf("function odpriAutocomplete")
);

assert.doesNotMatch(iskanje, /poisciNorthDataPodjetja\(\)/,
  "izvediUniverzalnoIskanje ne sme več avtomatsko klicati plačljivega North Data autocompleta");
assert.doesNotMatch(iskanje, /poisciAutocompletePodjetja\(\)/,
  "izvediUniverzalnoIskanje ne sme več avtomatsko klicati plačljivega OpenRegister identity_search");
assert.match(iskanje, /nacinVnosa = "surovo_ime"/,
  "brez enolične lokalne kartice mora surovo ime iti neposredno v eno samo pravo preverbo");
assert.match(iskanje, /await izvediBonitetnoPreverbo\(\)/,
  "surovo ime mora iti skozi isto čakalno vrsto kot vsaka druga dejanska preverba");

var preverba = source.slice(
  source.indexOf("async function izvediBonitetnoPreverbo"),
  source.indexOf("obrazec.addEventListener(\"submit\"")
);
assert.match(preverba, /surovoImeVnos = nacinVnosa === "surovo_ime"/,
  "izvediBonitetnoPreverbo mora prepoznati novi način vnosa surovega imena");
assert.match(preverba, /rawNameIdentitySearch:\s*surovoImeVnos/,
  "payload mora backend izrecno obvestiti, da gre za surovo iskanje po imenu");
assert.match(preverba, /!samoSpletniVnos && !registrskiVnos && !surovoImeVnos && !obrazec\.reportValidity\(\)/,
  "surovo ime ne sme zahtevati izpolnjenega ročnega naslovnega obrazca");

console.log("✓ Quicksearch nima več plačljivih discovery klicev; surovo ime gre v eno pravo preverbo.");
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node scripts/test-boniteta-quicksearch-no-discovery-calls.js
```
Expected: FAIL — `poisciNorthDataPodjetja()`/`poisciAutocompletePodjetja()` are still called; `surovo_ime` doesn't exist yet.

- [ ] **Step 3: Implement**

In `app/bonitetna-preverba.js`, replace the body of `izvediUniverzalnoIskanje` from line 1319 (`univerzalnoIskanjeVTehniku = true;`) through line 1371 (the `finally` block's closing brace) — i.e. everything between the `spletna_stran` branch (ends at line 1317) and the function's closing brace at line 1372 — with:

```js
    univerzalnoIskanjeVTehniku = true;
    var iskalniGumb = document.getElementById("boniteta-nacin-spletna");
    if (iskalniGumb) iskalniGumb.disabled = true;
    if (heroPreveriGumb) heroPreveriGumb.disabled = true;
    pocistiHeroSporocilo();
    try {
      await naloziBrezplacneAutocompleteZadetke();
      var odprtiZadetki = [];
      try { odprtiZadetki = await naloziOdprtiRegisterZadetke(query); } catch (_) {}
      var kandidati = zdruziAutocompleteZaPrikaz(filtrirajAutocompleteZadetke(query), odprtiZadetki);
      var zanesljiv = zanesljivEnolicniZadetek(kandidati, query);
      if (zanesljiv) {
        izberiAutocompletePodjetje(zanesljiv);
        await izvediBonitetnoPreverbo();
        return true;
      }
      if (kandidati.length > 1) {
        izrisiAutocompleteZadetke(kandidati);
        nastaviHeroNapako(razvrstitev.vrsta === "oseba"
          ? "Našli smo več možnih zapisov za to osebo. Izberite podjetje, ki mu pripada."
          : "Našli smo več možnih podjetij. Izberite pravi registrski zapis.");
        return false;
      }
      // Brez enolične lokalne kartice ne ustvarjamo ločenega plačljivega
      // North Data/OpenRegister predloga samo za prikaz kartic: surovo ime
      // gre naravnost v isto čakalno vrsto kot vsaka druga dejanska
      // preverba in tam porabi kvečjemu eno sveže OpenRegister iskanje.
      izpolniRazbranoPolje("boniteta-ime", query);
      izbranoOpenRegisterPodjetje = null;
      nacinVnosa = "surovo_ime";
      vnosPodrobnosti.hidden = true;
      await izvediBonitetnoPreverbo();
      return true;
    } catch (error) {
      nastaviHeroNapako(error && error.message || "Iskanja trenutno ni mogoče dokončati.");
      return false;
    } finally {
      univerzalnoIskanjeVTehniku = false;
      if (iskalniGumb) iskalniGumb.disabled = false;
      if (heroPreveriGumb && !preverjanjeVTehniku) heroPreveriGumb.disabled = false;
    }
  }
```

Then in `izvediBonitetnoPreverbo` (line 5820-5837), change the mode detection and validation guards. Replace:

```js
    var samoSpletniVnos = nacinVnosa === "spletna";
    var registrskiVnosJeSamoIme = Boolean(izbranoOpenRegisterPodjetje &&
      izbranoOpenRegisterPodjetje.source === "northdata_names");
    var registrskiVnos = nacinVnosa === "register" && Boolean(izbranoOpenRegisterPodjetje && (
      izbranoOpenRegisterPodjetje.companyId || izbranoOpenRegisterPodjetje.registerNumber || registrskiVnosJeSamoIme
    ));
    if (!samoSpletniVnos && !registrskiVnos && !obrazec.reportValidity()) return;

    var posta = samoSpletniVnos || registrskiVnos ? "" : document.getElementById("boniteta-posta").value.replace(/\D/g, "");
    var spletnaStran = spletnaPolje.value.trim();
    var rocnoIme = samoSpletniVnos ? "" : registrskiVnos ? izbranoOpenRegisterPodjetje.name : document.getElementById("boniteta-ime").value.trim();
    var rocniNaslov = samoSpletniVnos || registrskiVnos ? "" : document.getElementById("boniteta-naslov-podjetja").value.trim();
    var rocniKraj = samoSpletniVnos || registrskiVnos ? "" : krajPolje.value.trim();
    if (!spletnaStran && !registrskiVnos && (!rocnoIme || rocniNaslov.length < 3 || !/^\d{5}$/.test(posta) || rocniKraj.length < 2)) {
      pokaziNapako("Brez spletne strani izpolnite ime, ulico s hišno številko, poštno številko in kraj.");
      return;
    }
```

with:

```js
    var samoSpletniVnos = nacinVnosa === "spletna";
    var registrskiVnosJeSamoIme = Boolean(izbranoOpenRegisterPodjetje &&
      izbranoOpenRegisterPodjetje.source === "northdata_names");
    var registrskiVnos = nacinVnosa === "register" && Boolean(izbranoOpenRegisterPodjetje && (
      izbranoOpenRegisterPodjetje.companyId || izbranoOpenRegisterPodjetje.registerNumber || registrskiVnosJeSamoIme
    ));
    var surovoImeVnos = nacinVnosa === "surovo_ime";
    if (!samoSpletniVnos && !registrskiVnos && !surovoImeVnos && !obrazec.reportValidity()) return;

    var posta = samoSpletniVnos || registrskiVnos ? "" : document.getElementById("boniteta-posta").value.replace(/\D/g, "");
    var spletnaStran = spletnaPolje.value.trim();
    var rocnoIme = samoSpletniVnos ? "" : registrskiVnos ? izbranoOpenRegisterPodjetje.name : document.getElementById("boniteta-ime").value.trim();
    var rocniNaslov = samoSpletniVnos || registrskiVnos ? "" : document.getElementById("boniteta-naslov-podjetja").value.trim();
    var rocniKraj = samoSpletniVnos || registrskiVnos ? "" : krajPolje.value.trim();
    if (!spletnaStran && !registrskiVnos && !surovoImeVnos && (!rocnoIme || rocniNaslov.length < 3 || !/^\d{5}$/.test(posta) || rocniKraj.length < 2)) {
      pokaziNapako("Brez spletne strani izpolnite ime, ulico s hišno številko, poštno številko in kraj.");
      return;
    }
    if (surovoImeVnos && !rocnoIme) {
      pokaziNapako("Vnesite ime podjetja.");
      return;
    }
```

Finally, in the `zadnjiVnos` payload object (line 5856-5871), add the new field right after `uporabiOpenRegisterIdentiteto: true,`:

```js
        openRegisterCompanyId: izbranoOpenRegisterPodjetje && izbranoOpenRegisterPodjetje.companyId || "",
        openRegisterIdentityProof: izbranoOpenRegisterPodjetje && izbranoOpenRegisterPodjetje.identityProof || "",
        companyIndexSource: izbranoOpenRegisterPodjetje && izbranoOpenRegisterPodjetje.source || "",
        companyIndexId: registrskiVnosJeSamoIme ? "" : izbranoOpenRegisterPodjetje && izbranoOpenRegisterPodjetje.sourceId || "",
        companyIndexProof: izbranoOpenRegisterPodjetje && izbranoOpenRegisterPodjetje.suggestionProof || "",
        uporabiOpenRegisterIdentiteto: true,
        rawNameIdentitySearch: surovoImeVnos,
      };
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node scripts/test-boniteta-quicksearch-no-discovery-calls.js
node --check app/bonitetna-preverba.js
node scripts/test-openregister-one-credit-budget.js
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add app/bonitetna-preverba.js scripts/test-boniteta-quicksearch-no-discovery-calls.js
git commit -m "fix(boniteta): remove paid pre-verification discovery calls from raw-name quicksearch"
```

---

### Task 4: Fallback UI keeps the searched name visible and shows OpenRegister's own ambiguous candidates

**Files:**
- Modify: `app/bonitetna-preverba.js:1027-1061` (`nastaviSpletnoRezervo`, `prikaziPotPoNeuspesnemRegistrskemIskanju`)
- Modify: `app/bonitetna-preverba.js:5889` area (`izrisi(podatki)` call site in `izvediBonitetnoPreverbo`, for the `ambiguous` case)
- Test: extend `scripts/test-boniteta-quicksearch-no-discovery-calls.js`

**Interfaces:**
- Consumes: Task 3's `nacinVnosa === "surovo_ime"` payload; the job result's `podatki.openregister.status === "ambiguous"` / `podatki.openregister.candidates` (already present in the response per `api/_handlers/mehka-boniteta.js:7877` etc. — confirmed to carry through unmodified from `kopirajOpenRegisterRezultat`).
- Produces: nothing consumed by a later task — this is a UI-only leaf.

- [ ] **Step 1: Write the failing test**

Append to `scripts/test-boniteta-quicksearch-no-discovery-calls.js` (before the final `console.log`):

```js
assert.match(source, /"Podjetja »" \+ .*?\+ "« v registru nismo našli\./,
  "sporočilo ob registrskem missu mora poimensko pokazati iskano ime, ne le generičnega besedila");

var izvedbaPreverbe = source.slice(
  source.indexOf("async function izvediBonitetnoPreverbo"),
  source.indexOf("obrazec.addEventListener(\"submit\"")
);
assert.match(izvedbaPreverbe, /podatki\.openregister && podatki\.openregister\.status === "ambiguous"/,
  "surovo ime mora znati prikazati OpenRegistrove lastne kandidate ob dvoumnem zadetku, brez novega plačljivega klica");
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node scripts/test-boniteta-quicksearch-no-discovery-calls.js
```
Expected: FAIL on both new assertions.

- [ ] **Step 3: Implement**

Replace `prikaziPotPoNeuspesnemRegistrskemIskanju` at `app/bonitetna-preverba.js:1056-1061`:

```js
  function prikaziPotPoNeuspesnemRegistrskemIskanju(query) {
    var iskanoIme = String(query || "").trim().replace(/\s+/g, " ");
    rezervnoRegistrskoIme = iskanoIme;
    if (iskanoIme) izpolniRazbranoPolje("boniteta-ime", iskanoIme);
    nastaviSpletnoRezervo(true, "", "openregister_not_found");
  }
```

with:

```js
  function prikaziPotPoNeuspesnemRegistrskemIskanju(query) {
    var iskanoIme = String(query || "").trim().replace(/\s+/g, " ");
    rezervnoRegistrskoIme = iskanoIme;
    if (iskanoIme) izpolniRazbranoPolje("boniteta-ime", iskanoIme);
    nastaviSpletnoRezervo(true, "", "openregister_not_found", iskanoIme);
  }
```

Then update `nastaviSpletnoRezervo` at `app/bonitetna-preverba.js:1027-1054` to accept and use the fourth argument. Replace:

```js
  function nastaviSpletnoRezervo(prikazi, opis, razlog) {
    var prejsnjiRazlog = spletnaRezervaRazlog;
    spletnaRezervaRazlog = prikazi ? String(razlog || "") : "";
    var niRegistrskegaZadetka = razlog === "openregister_not_found";
    if (!prikazi) {
      if (prejsnjiRazlog === "openregister_not_found") nastaviHeroZaSpletnoRezervo(false);
      if (heroSpletnaStatus && heroSpletnaStatus.dataset.spletnaRezerva === "true") {
        heroSpletnaStatus.hidden = true;
        delete heroSpletnaStatus.dataset.spletnaRezerva;
      }
      return;
    }
    potek.hidden = true;
    rezultat.hidden = true;
    vnosPodrobnosti.hidden = true;
    if (niRegistrskegaZadetka) nastaviHeroZaSpletnoRezervo(true);
    if (heroSpletnaStatus) {
      heroSpletnaStatus.classList.add("is-error");
      heroSpletnaStatus.textContent = niRegistrskegaZadetka
        ? "Podjetja v registru nismo našli. Vnesite spletno stran ali neposredni URL Impressuma."
        : String(opis || "Impressuma ni bilo mogoče zajeti. Vnesite neposredni URL Impressuma ali poskusite znova.");
      heroSpletnaStatus.dataset.spletnaRezerva = "true";
      heroSpletnaStatus.hidden = false;
    }
    window.requestAnimationFrame(function () {
      if (heroSpletnaPolje) heroSpletnaPolje.focus({ preventScroll: true });
    });
  }
```

with:

```js
  function nastaviSpletnoRezervo(prikazi, opis, razlog, iskanoIme) {
    var prejsnjiRazlog = spletnaRezervaRazlog;
    spletnaRezervaRazlog = prikazi ? String(razlog || "") : "";
    var niRegistrskegaZadetka = razlog === "openregister_not_found";
    if (!prikazi) {
      if (prejsnjiRazlog === "openregister_not_found") nastaviHeroZaSpletnoRezervo(false);
      if (heroSpletnaStatus && heroSpletnaStatus.dataset.spletnaRezerva === "true") {
        heroSpletnaStatus.hidden = true;
        delete heroSpletnaStatus.dataset.spletnaRezerva;
      }
      return;
    }
    potek.hidden = true;
    rezultat.hidden = true;
    vnosPodrobnosti.hidden = true;
    if (niRegistrskegaZadetka) nastaviHeroZaSpletnoRezervo(true);
    if (heroSpletnaStatus) {
      heroSpletnaStatus.classList.add("is-error");
      var ocisceneIme = String(iskanoIme || "").trim();
      heroSpletnaStatus.textContent = niRegistrskegaZadetka
        ? (ocisceneIme ? "Podjetja »" + ocisceneIme + "« v registru nismo našli. Vnesite spletno stran ali neposredni URL Impressuma."
          : "Podjetja v registru nismo našli. Vnesite spletno stran ali neposredni URL Impressuma.")
        : String(opis || "Impressuma ni bilo mogoče zajeti. Vnesite neposredni URL Impressuma ali poskusite znova.");
      heroSpletnaStatus.dataset.spletnaRezerva = "true";
      heroSpletnaStatus.hidden = false;
    }
    window.requestAnimationFrame(function () {
      if (heroSpletnaPolje) heroSpletnaPolje.focus({ preventScroll: true });
    });
  }
```

Finally, in `izvediBonitetnoPreverbo`, right after the `var podatki = await izvediPrekoCakalneVrste(zadnjiVnos, token);` line (5873) and its existing `if (!podatki) return;` guard (5874), insert an `ambiguous` short-circuit before the existing `jeNeuspesnaSpletnaIdentifikacija` block, so a raw-name search that came back ambiguous shows the OpenRegister-provided candidates without ever making another paid call:

```js
      var podatki = await izvediPrekoCakalneVrste(zadnjiVnos, token);
      if (!podatki) return;
      if (surovoImeVnos && podatki.openregister && podatki.openregister.status === "ambiguous" &&
        Array.isArray(podatki.openregister.candidates) && podatki.openregister.candidates.length) {
        var dvoumniKandidati = podatki.openregister.candidates.map(function (kandidat) {
          return normalizirajOpenRegisterPodjetje({}, Object.assign({ source: "openregister_ambiguous" }, kandidat));
        });
        izrisiAutocompleteZadetke(dvoumniKandidati);
        nastaviHeroNapako("Našli smo več možnih podjetij z enakim imenom. Izberite pravi registrski zapis ali vnesite spletno stran.");
        return;
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node scripts/test-boniteta-quicksearch-no-discovery-calls.js
node --check app/bonitetna-preverba.js
```
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add app/bonitetna-preverba.js scripts/test-boniteta-quicksearch-no-discovery-calls.js
git commit -m "fix(boniteta): show searched name and OpenRegister's own ambiguous candidates in fallback UI"
```

---

### Task 5: Bump cache-busting version and update the regression-guardrails doc

**Files:**
- Modify: `app/bonitetna-preverba.html` (script `?v=` for `bonitetna-preverba.js`)
- Modify: `docs/BONITETA-REGRESSION-GUARDRAILS.md`

- [ ] **Step 1: Read the current cache-busting query**

```bash
grep -n "bonitetna-preverba.js?v=" "app/bonitetna-preverba.html"
```

- [ ] **Step 2: Bump it**

Increment the version query string found in Step 1 (e.g. `?v=123` → `?v=124`) using Edit on the exact matched line.

- [ ] **Step 3: Add the new guardrail**

Append a new dated entry to `docs/BONITETA-REGRESSION-GUARDRAILS.md` (read the file first to match its existing entry format) stating: quicksearch card generation must never call OpenRegister `identity_search` or Apify North Data autocomplete; a raw company name without a unique local match or full manual address goes through exactly one fresh OpenRegister search inside the queue via `rawNameIdentitySearch: true`, gated the same way the local-index-card path already is; a client-supplied `openRegisterIdentityProof` must never originate from this screen's quicksearch flow again.

- [ ] **Step 4: Verify**

```bash
node --check app/bonitetna-preverba.js
npm run verify:local
```
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add app/bonitetna-preverba.html docs/BONITETA-REGRESSION-GUARDRAILS.md
git commit -m "chore(boniteta): bump cache-busting version and document the raw-name search guardrail"
```

---

### Task 6: Full backend test suite pass and real end-to-end browser verification

This task has no new source code — it is the mandatory verification pass required by `CLAUDE.md` §6.9-11 before any completion claim.

- [ ] **Step 1: Run the full targeted command list**

```bash
npm run verify:local
node --check app/bonitetna-preverba.js
node --check api/_handlers/mehka-boniteta.js
node --check api/_lib/mehka-boniteta-queue.js
node scripts/test-local-company-index-soft-check.js
node scripts/test-company-status-safety.js
node scripts/test-openregister-one-credit-budget.js
node scripts/test-boniteta-northdata-background.js
node scripts/test-boniteta-northdata-background-flow.js
node scripts/test-mehka-boniteta-queue.js
node scripts/test-boniteta-raw-name-search.js
node scripts/test-boniteta-quicksearch-no-discovery-calls.js
npm run test:boniteta
```

Note: `scripts/test-boniteta-openregister-first.js` and `scripts/test-mehka-boniteta.js` were already failing before this plan started, on unrelated stale assertions (a stale `VERIFIED_RESULT_CACHE_VERSION` string in the first, an unrelated Impressum-heading-pattern assertion in the second — confirmed unrelated to this workflow during planning). Report their pass/fail state honestly but do not let them block this task; do not silently patch their assertions as part of this plan without calling it out to the user separately, per `CLAUDE.md`'s "unrelated failing test from another agent's in-progress work must not block, but must be clearly mentioned" rule.

- [ ] **Step 2: Start the local server and open the real screen**

```bash
npm run dev
```
Then open `http://localhost:8001/app/bonitetna-preverba.html?app-preview=1#new` in the browser tool.

- [ ] **Step 3: Exercise the real matrix with network/log counting**

For one known, cheap test company (reuse `ZIR Beteiligungs GmbH` from the prior verified run, or another low-cost subject the user names):
1. Type the name slowly; confirm zero OpenRegister/Apify log lines appear while typing and while local cards are shown.
2. Type a name that has **no** local match; press Enter; confirm exactly one OpenRegister call fires (check OpenRegister dashboard/logs counter delta) and, only if `found`, exactly two Apify runs start (`parsebird/northdata-scraper`, `trev0n/northdata-scraper`).
3. Trigger a real registry miss (a name with no OpenRegister match either); confirm the fallback message now names the searched company and Apify stays at 0.
4. If a real ambiguous case is reachable, confirm the read-only candidate list renders without a second OpenRegister call.

- [ ] **Step 4: Screenshot and compare**

Take a fresh screenshot of each state in Step 3 (open the URL fully fresh — no reused tab, per `CLAUDE.md` §6.11) and compare against the user's original screenshot and this plan's acceptance criteria. If anything doesn't match, return to the relevant task and fix before proceeding — do not report completion.

- [ ] **Step 5: Report to the user**

Summarize: which OpenRegister/Apify counters moved and when, screenshots, full test command results (including the two pre-existing unrelated failures called out honestly), and that production has **not** been touched (per `CLAUDE.md` §9, publish only on explicit user instruction).
