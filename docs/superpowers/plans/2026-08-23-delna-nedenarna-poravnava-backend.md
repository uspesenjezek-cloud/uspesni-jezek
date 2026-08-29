# Delna nedenarna poravnava — backend (Plan 1 od 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodati nov backend akcijski tip `partial_settlement` (delni dobropis/odpust), ki zmanjša preostali dolg zadeve ne da bi jo zaprl — enak vzorec kot obstoječi `partial_payment`, le da znesek zapiše v ne-denarno evidenco (`zadeva_poravnave`) namesto v `zadeva_placila`.

**Architecture:** Razširitev obstoječega `api/_lib/izvedba-core.js` validacijskega/izračunskega vzorca (nova veja, ponovna uporaba obstoječe `izracunajDelnoPlacilo` funkcije) + nova veja v obstoječi Postgres RPC `izvedi_opomin_ukrep` (nova migracija, `create or replace function` z identično signaturo). Brez sprememb API poti (`api/izvedi-opomin-ukrep.js`) — obstoječe generično žičenje že podpira nov tip.

**Tech Stack:** Node.js (CommonJS, `api/_lib`), PostgreSQL/Supabase migracije (plpgsql), Node test runner brez ogrodja (`node scripts/test-izvedba-actions.mjs`, vzorec `assert`+ročni `test()` helper).

**Spec:** [docs/superpowers/specs/2026-08-23-delna-nedenarna-poravnava-design.md](../specs/2026-08-23-delna-nedenarna-poravnava-design.md)

## Global Constraints

- Denarni invariant mora ostati resničen po vsakem koraku: `placano_skupaj + poravnano_nedenarno + preostali_dolg = prvotni_znesek` (zaokroženo na 2 decimalki).
- Znesek koraka mora biti `0 < amount < trenutni preostali_dolg` (enaka meja kot pri `partial_payment` — enak znesek pomeni "zapri primer", za to obstaja ločena terminalna pot `paid_in_full`).
- Primer NE sme spremeniti statusa ali se zapreti prek te akcije.
- `zadeva_poravnave.vrsta` mora ostati ena od že dovoljenih vrednosti check-omejitve (`compensation`, `credit_note`, `cancelled_invoice`) — brez sheme spremembe te tabele.
- Nobene nove tabele, nobenega novega RPC parametra — ponovna uporaba obstoječe sheme in signature.

---

## Task 1: Validacija `partial_settlement` v `izvedba-core.js`

**Files:**
- Modify: `api/_lib/izvedba-core.js:142` (takoj za koncem obstoječega `partial_payment` bloka, pred `if (actionType === "paid_in_full")`)
- Test: `scripts/test-izvedba-actions.mjs` (nov razdelek testov)

**Interfaces:**
- Consumes: `zaokrozi2(vrednost)` (obstoječa funkcija, `izvedba-core.js:59`)
- Produces: `validirajNastavitve("partial_settlement", settings, { preostaliDolg })` vrne pri uspehu `{ ok: true, settings: { kind, amount, remainingAmount, reason }, placiloZnesek: number, placiloVrsta: "credit_note"|"cancelled_invoice" }`. Vhodni `settings` (od klicatelja): `{ kind: "credit"|"writeoff", amount: number, reason?: string }`.

- [ ] **Step 1: Napiši padajoče teste**

Odpri `scripts/test-izvedba-actions.mjs`. Poišči obstoječi test blok za `partial_payment` (vsebuje `core.validirajNastavitve("partial_payment", ...)`, okoli vrstice 196-204) in takoj za njim (pred naslednjim poimenovanim testom) dodaj:

```js
  await test("partial_settlement (dobropis) - uspesen delni dobropis ne zapre primera", () => {
    const rezultat = core.validirajNastavitve(
      "partial_settlement",
      { kind: "credit", amount: 40 },
      { preostaliDolg: 100 }
    );
    assert.equal(rezultat.ok, true);
    assert.equal(rezultat.placiloZnesek, 40);
    assert.equal(rezultat.placiloVrsta, "credit_note");
    assert.equal(rezultat.settings.remainingAmount, 60);
    assert.equal(rezultat.settings.reason, null);
  });

  await test("partial_settlement (odpust) - zahteva razlog", () => {
    const brezRazloga = core.validirajNastavitve(
      "partial_settlement",
      { kind: "writeoff", amount: 40 },
      { preostaliDolg: 100 }
    );
    assert.equal(brezRazloga.ok, false);
    assert.equal(brezRazloga.code, "INVALID_SETTINGS");

    const zRazlogom = core.validirajNastavitve(
      "partial_settlement",
      { kind: "writeoff", amount: 40, reason: "Dogovor z dolžnikom" },
      { preostaliDolg: 100 }
    );
    assert.equal(zRazlogom.ok, true);
    assert.equal(zRazlogom.placiloVrsta, "cancelled_invoice");
    assert.equal(zRazlogom.settings.reason, "Dogovor z dolžnikom");
  });

  await test("partial_settlement - znesek mora biti vecji od 0 in manjsi od preostanka", () => {
    const nicelni = core.validirajNastavitve(
      "partial_settlement",
      { kind: "credit", amount: 0 },
      { preostaliDolg: 100 }
    );
    assert.equal(nicelni.ok, false);
    assert.equal(nicelni.code, "INVALID_SETTINGS");

    const previsoki = core.validirajNastavitve(
      "partial_settlement",
      { kind: "credit", amount: 150 },
      { preostaliDolg: 100 }
    );
    assert.equal(previsoki.ok, false);
    assert.equal(previsoki.code, "PAYMENT_EXCEEDS_DEBT");

    const enakPreostanku = core.validirajNastavitve(
      "partial_settlement",
      { kind: "credit", amount: 100 },
      { preostaliDolg: 100 }
    );
    assert.equal(enakPreostanku.ok, false);
    assert.equal(enakPreostanku.code, "PAYMENT_EXCEEDS_DEBT");
  });

  await test("partial_settlement - zaokrozi znesek na 2 decimalki", () => {
    const rezultat = core.validirajNastavitve(
      "partial_settlement",
      { kind: "credit", amount: 33.336 },
      { preostaliDolg: 100 }
    );
    assert.equal(rezultat.ok, true);
    assert.equal(rezultat.placiloZnesek, 33.34);
    assert.equal(rezultat.settings.remainingAmount, 66.66);
  });
```

- [ ] **Step 2: Zaženi teste in preveri, da padejo**

Run: `node scripts/test-izvedba-actions.mjs`
Expected: FAIL — prvi od štirih novih testov vrže napako, ker `validirajNastavitve` za `"partial_settlement"` pade skozi vse veje do `return { ok: false, code: "UNKNOWN_ACTION_TYPE", ... }` (vrstica 172), torej `rezultat.ok` bo `false` namesto pričakovanega `true`, test `assert.equal(rezultat.ok, true)` vrže `AssertionError`.

- [ ] **Step 3: Implementiraj validacijsko vejo**

V `api/_lib/izvedba-core.js` najdi konec obstoječega `partial_payment` bloka (vrstica 142, zapre se z `}` takoj pred `if (actionType === "paid_in_full")`). Med njiju vstavi:

```js
  if (actionType === "partial_settlement") {
    var preostaliDolgNed = Number(context.preostaliDolg);
    var kind = vhod.kind === "writeoff" ? "writeoff" : "credit";
    var amountNed = Number(vhod.amount);
    if (!(preostaliDolgNed > 0)) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Trenutni dolg ni znan." };
    }
    if (!Number.isFinite(amountNed) || amountNed <= 0) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Vnesite znesek, ki je večji od 0." };
    }
    if (amountNed >= preostaliDolgNed) {
      return { ok: false, code: "PAYMENT_EXCEEDS_DEBT", napaka: "Znesek mora biti manjši od trenutnega preostalega dolga." };
    }
    if (kind === "writeoff" && !String(vhod.reason || "").trim()) {
      return { ok: false, code: "INVALID_SETTINGS", napaka: "Razlog za odpust je obvezen." };
    }
    var placiloVrstaNed = kind === "writeoff" ? "cancelled_invoice" : "credit_note";
    var placiloZnesekNed = zaokrozi2(amountNed);
    var novPreostanekNed = zaokrozi2(preostaliDolgNed - placiloZnesekNed);
    return {
      ok: true,
      settings: {
        kind: kind,
        amount: placiloZnesekNed,
        remainingAmount: novPreostanekNed,
        reason: kind === "writeoff" ? String(vhod.reason) : null
      },
      placiloZnesek: placiloZnesekNed,
      placiloVrsta: placiloVrstaNed
    };
  }

```

Opomba: `vhod` je že definiran zgoraj v funkciji (glej obstoječo rabo `vhod.paymentAmount` v `partial_payment` bloku) — ne definiraj ga znova.

- [ ] **Step 4: Zaženi teste in preveri, da vsi preidejo**

Run: `node scripts/test-izvedba-actions.mjs`
Expected: PASS — vsi štirje novi testi in vsi obstoječi testi v datoteki (skript se ustavi na prvem neuspehu, torej "PASS" pomeni izpis do konca brez `✗`).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/izvedba-core.js scripts/test-izvedba-actions.mjs
git commit -m "Add partial_settlement validation for non-cash partial debt reduction"
```

---

## Task 2: Ožičenje `partial_settlement` v `izracunajUkrep`

**Files:**
- Modify: `api/_lib/izvedba-core.js:487-497` (`izracunajUkrep` switch), `:499-516` (`module.exports`, samo če dodajaš nov `_test` izvoz — tu ni potreben, `izracunajDelnoPlacilo` je že izvožen)
- Test: `scripts/test-izvedba-actions.mjs`

**Interfaces:**
- Consumes: obstoječa `izracunajDelnoPlacilo(ctx)` (`izvedba-core.js:439-459`) — bere `ctx.plan`, `ctx.koraki`, `ctx.placiloZnesek`, `ctx.novPreostanek`; ne razlikuje denarno/nedenarno, torej brez sprememb.
- Produces: `izracunajUkrep("partial_settlement", ctx)` vrne isto obliko kot `izracunajUkrep("partial_payment", ctx)`: `{ ok: true, newPlan, korakiUpdates: [], placiloZnesek }`.

- [ ] **Step 1: Napiši padajoč test**

V `scripts/test-izvedba-actions.mjs`, takoj za testi iz Task 1, dodaj (potrebuje minimalen `plan`/`koraki` fixture — poglej obstoječ test za `izracunajDelnoPlacilo`, če obstaja v datoteki prek `core._test.izracunajDelnoPlacilo`; če ne obstaja neposreden test zanjo, uporabi ta minimalen fixture):

```js
  await test("izracunajUkrep(partial_settlement) - uporabi izracunajDelnoPlacilo, primer ostane odprt", () => {
    const ctx = {
      plan: { version: 3, steps: [] },
      koraki: [],
      placiloZnesek: 40,
      novPreostanek: 60,
    };
    const izracun = core.izracunajUkrep("partial_settlement", ctx);
    assert.equal(izracun.ok, true);
    assert.equal(izracun.placiloZnesek, 40);
    assert.equal(izracun.newPlan.version, 4);
    assert.deepEqual(izracun.korakiUpdates, []);
  });
```

- [ ] **Step 2: Zaženi teste in preveri, da padejo**

Run: `node scripts/test-izvedba-actions.mjs`
Expected: FAIL — `core.izracunajUkrep("partial_settlement", ctx)` vrne `{ ok: false, code: "UNKNOWN_ACTION_TYPE" }` (privzeta veja switch-a), torej `assert.equal(izracun.ok, true)` vrže napako.

- [ ] **Step 3: Dodaj vejo v switch**

V `api/_lib/izvedba-core.js`, `izracunajUkrep` funkcija (okoli vrstice 493), dodaj vrstico takoj za `case "partial_payment": return izracunajDelnoPlacilo(ctx);`:

```js
    case "partial_settlement": return izracunajDelnoPlacilo(ctx);
```

- [ ] **Step 4: Zaženi teste in preveri, da vsi preidejo**

Run: `node scripts/test-izvedba-actions.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api/_lib/izvedba-core.js scripts/test-izvedba-actions.mjs
git commit -m "Wire partial_settlement into izracunajUkrep dispatcher"
```

---

## Task 3: Nova RPC veja v `izvedi_opomin_ukrep` (migracija)

**Files:**
- Create: `supabase/migrations/20260824090000_delna_nedenarna_poravnava.sql`
- Test: `scripts/test-izvedba-actions.mjs` (strukturni test nad SQL besedilom — vzorec kot obstoječi testi, ki berejo `citaj("supabase/migrations/...")`)

**Interfaces:**
- Consumes: obstoječo tabelo `public.zadeva_poravnave` (stolpci `zadeva_id, obrtnik_id, vrsta, znesek, datum_poravnave, razlog, action_id`, `vrsta` omejena na `'compensation'|'credit_note'|'cancelled_invoice'`) in stolpec `public.zadeve.poravnano_nedenarno` — oba iz `supabase/migrations/20260823150000_nedenarne_poravnave.sql`, brez sprememb sheme.
- Produces: RPC `public.izvedi_opomin_ukrep(...)` (ista signatura kot danes) razume `p_action_type = 'partial_settlement'`: bere `p_placilo_znesek` (znesek koraka) in `p_placilo_vrsta` (`'credit_note'` ali `'cancelled_invoice'`, pošlje jih `api/izvedi-opomin-ukrep.js` brez sprememb, glej Task 1 `placiloVrsta`), `p_settings->>'reason'` za razlog. Zmanjša `preostali_dolg`, poveča `poravnano_nedenarno`, NE spremeni `status`.

- [ ] **Step 1: Napiši strukturni test (padajoč)**

V `scripts/test-izvedba-actions.mjs`, takoj za testi iz Task 2, dodaj:

```js
  await test("migracija: RPC izvedi_opomin_ukrep obravnava partial_settlement brez zapiranja primera", () => {
    const sql = citaj("supabase/migrations/20260824090000_delna_nedenarna_poravnava.sql");
    assert.match(sql, /p_action_type\s*=\s*'partial_settlement'/);
    assert.match(sql, /poravnano_nedenarno\s*=\s*poravnano_nedenarno\s*\+\s*p_placilo_znesek/);
    assert.match(sql, /insert into public\.zadeva_poravnave/);
    // primer se pri partial_settlement NE sme zapreti - noben del te veje ne sme nastaviti status='Rešeno'
    const partialSettlementVeja = sql.split("p_action_type = 'partial_settlement'")[1].split("elsif p_action_type")[0];
    assert.doesNotMatch(partialSettlementVeja, /status\s*=\s*'Rešeno'/);
  });
```

- [ ] **Step 2: Zaženi teste in preveri, da padejo**

Run: `node scripts/test-izvedba-actions.mjs`
Expected: FAIL z `ENOENT` (datoteka `20260824090000_delna_nedenarna_poravnava.sql` še ne obstaja) — `citaj()` vrže napako pri branju datoteke.

- [ ] **Step 3: Napiši migracijo**

Ustvari `supabase/migrations/20260824090000_delna_nedenarna_poravnava.sql` s tem točnim besedilom (celotna funkcija se redefinira prek `create or replace function` — enak vzorec kot prejšnje migracije te RPC — z eno novo `elsif` vejo, vstavljeno med obstoječo `partial_payment` in `paid_in_full` vejo):

```sql
-- Nova veja RPC izvedi_opomin_ukrep za partial_settlement: delni dobropis
-- ali odpust, ki zmanjša preostali_dolg in poveca poravnano_nedenarno,
-- a NE zapre primera - zrcali obstojeco partial_payment vejo, le da pise
-- v zadeva_poravnave namesto zadeva_placila. Glej
-- docs/superpowers/specs/2026-08-23-delna-nedenarna-poravnava-design.md.

create or replace function public.izvedi_opomin_ukrep(
  p_zadeva_id uuid,
  p_obrtnik_id uuid,
  p_expected_version text,
  p_action_id uuid,
  p_fingerprint text,
  p_action_type text,
  p_settings jsonb,
  p_new_plan jsonb,
  p_koraki_updates jsonb,
  p_placilo_znesek numeric default null,
  p_placilo_vrsta text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ukrep_id uuid;
  v_obstojeci public.opomin_ukrepi%rowtype;
  v_zadeva public.zadeve%rowtype;
  v_verzija bigint;
  v_pricakovana_verzija bigint;
  v_nov_preostanek numeric;
  v_settlement_type text;
  v_settled_at timestamptz;
  v_nedenarni_znesek numeric;
  v_result jsonb;
begin
  insert into public.opomin_ukrepi (
    action_id, zahteva_fingerprint, zadeva_id, obrtnik_id, action_type, settings, status, created_at
  ) values (
    p_action_id, p_fingerprint, p_zadeva_id, p_obrtnik_id, p_action_type, coalesce(p_settings, '{}'::jsonb), 'pending', now()
  )
  on conflict (action_id) do nothing
  returning id into v_ukrep_id;

  if v_ukrep_id is null then
    select * into v_obstojeci from public.opomin_ukrepi where action_id = p_action_id for update;
    if not found then
      insert into public.opomin_ukrepi (
        action_id, zahteva_fingerprint, zadeva_id, obrtnik_id, action_type, settings, status, created_at
      ) values (
        p_action_id, p_fingerprint, p_zadeva_id, p_obrtnik_id, p_action_type, coalesce(p_settings, '{}'::jsonb), 'pending', now()
      ) returning id into v_ukrep_id;
    elsif v_obstojeci.zahteva_fingerprint <> p_fingerprint then
      return jsonb_build_object('ok', false, 'code', 'ACTION_ID_REUSED');
    elsif v_obstojeci.status in ('completed', 'failed') then
      return v_obstojeci.result_state;
    else
      return jsonb_build_object('ok', false, 'code', 'ACTION_IN_PROGRESS');
    end if;
  end if;

  select * into v_zadeva from public.zadeve where id = p_zadeva_id for update;
  if not found then
    v_result := jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
    update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
    return v_result;
  end if;
  if v_zadeva.obrtnik_id <> p_obrtnik_id then
    v_result := jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
    update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
    return v_result;
  end if;

  v_verzija := coalesce((v_zadeva.opomin_nacrt->>'version')::bigint, 0);
  v_pricakovana_verzija := coalesce(nullif(p_expected_version, '')::bigint, 0);
  if v_verzija <> v_pricakovana_verzija then
    v_result := jsonb_build_object('ok', false, 'code', 'VERSION_CONFLICT', 'serverVersion', v_verzija::text);
    update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
    return v_result;
  end if;

  if p_action_type = 'partial_payment' then
    if p_placilo_znesek is null or p_placilo_znesek <= 0 then
      v_result := jsonb_build_object('ok', false, 'code', 'INVALID_PAYMENT_AMOUNT');
      update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
      return v_result;
    end if;
    v_nov_preostanek := v_zadeva.preostali_dolg - p_placilo_znesek;
    if v_nov_preostanek <= 0 then
      v_result := jsonb_build_object('ok', false, 'code', 'PAYMENT_EXCEEDS_DEBT');
      update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
      return v_result;
    end if;
    perform set_config('app.dovoli_denarne_spremembe', 'true', true);
    update public.zadeve
    set opomin_nacrt = p_new_plan,
        preostali_dolg = v_nov_preostanek,
        placano_skupaj = placano_skupaj + p_placilo_znesek,
        znesek = v_nov_preostanek
    where id = p_zadeva_id;
    insert into public.zadeva_placila (zadeva_id, obrtnik_id, znesek, vrsta, datum_placila, action_id)
    values (
      p_zadeva_id,
      p_obrtnik_id,
      p_placilo_znesek,
      case when p_placilo_vrsta = 'installment' then 'installment' else 'partial' end,
      current_date,
      p_action_id
    );

  elsif p_action_type = 'partial_settlement' then
    if p_placilo_znesek is null or p_placilo_znesek <= 0 then
      v_result := jsonb_build_object('ok', false, 'code', 'INVALID_PAYMENT_AMOUNT');
      update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
      return v_result;
    end if;
    v_nov_preostanek := v_zadeva.preostali_dolg - p_placilo_znesek;
    if v_nov_preostanek <= 0 then
      v_result := jsonb_build_object('ok', false, 'code', 'PAYMENT_EXCEEDS_DEBT');
      update public.opomin_ukrepi set status = 'failed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
      return v_result;
    end if;
    perform set_config('app.dovoli_denarne_spremembe', 'true', true);
    update public.zadeve
    set opomin_nacrt = p_new_plan,
        preostali_dolg = v_nov_preostanek,
        poravnano_nedenarno = poravnano_nedenarno + p_placilo_znesek,
        znesek = v_nov_preostanek
    where id = p_zadeva_id;
    insert into public.zadeva_poravnave (zadeva_id, obrtnik_id, vrsta, znesek, datum_poravnave, razlog, action_id)
    values (
      p_zadeva_id,
      p_obrtnik_id,
      p_placilo_vrsta,
      p_placilo_znesek,
      current_date,
      nullif(p_settings->>'reason', ''),
      p_action_id
    );

  elsif p_action_type = 'paid_in_full' then
    v_settlement_type := coalesce(nullif(p_settings->>'settlementType', ''), 'full');
    v_settled_at := coalesce(nullif(p_settings->>'settledAt', '')::timestamptz, now());

    if v_settlement_type = 'full' then
      perform set_config('app.dovoli_denarne_spremembe', 'true', true);
      update public.zadeve
      set opomin_nacrt = p_new_plan,
          preostali_dolg = 0,
          placano_skupaj = placano_skupaj + preostali_dolg,
          znesek = 0,
          status = 'Rešeno',
          poravnano_at = v_settled_at
      where id = p_zadeva_id;
      insert into public.zadeva_placila (zadeva_id, obrtnik_id, znesek, vrsta, datum_placila, action_id)
      values (p_zadeva_id, p_obrtnik_id, v_zadeva.preostali_dolg, 'full', v_settled_at::date, p_action_id);
    else
      -- compensation / credit_note / cancelled_invoice: NI denarnega priliva.
      v_nedenarni_znesek := v_zadeva.preostali_dolg;
      perform set_config('app.dovoli_denarne_spremembe', 'true', true);
      update public.zadeve
      set opomin_nacrt = p_new_plan,
          preostali_dolg = 0,
          poravnano_nedenarno = poravnano_nedenarno + v_nedenarni_znesek,
          znesek = 0,
          status = 'Rešeno',
          poravnano_at = v_settled_at
      where id = p_zadeva_id;
      insert into public.zadeva_poravnave (zadeva_id, obrtnik_id, vrsta, znesek, datum_poravnave, razlog, action_id)
      values (
        p_zadeva_id, p_obrtnik_id, v_settlement_type, v_nedenarni_znesek, v_settled_at::date,
        nullif(p_settings->>'reason', ''), p_action_id
      );
    end if;
  else
    update public.zadeve set opomin_nacrt = p_new_plan where id = p_zadeva_id;
  end if;

  if p_koraki_updates is not null and jsonb_typeof(p_koraki_updates) = 'array' and jsonb_array_length(p_koraki_updates) > 0 then
    update public.opomin_koraki k
    set execution_state = coalesce(x.execution_state, k.execution_state),
        status = coalesce(x.status, k.status),
        scheduled_at = coalesce(x.scheduled_at, k.scheduled_at),
        cancel_reason = coalesce(x.cancel_reason, k.cancel_reason),
        paused_until = x.paused_until,
        posodobljeno_at = now()
    from jsonb_to_recordset(p_koraki_updates) as x(
      id uuid, execution_state text, status text, scheduled_at timestamptz,
      cancel_reason text, paused_until timestamptz
    )
    where k.id = x.id and k.zadeva_id = p_zadeva_id;
  end if;

  select * into v_zadeva from public.zadeve where id = p_zadeva_id;
  v_result := jsonb_build_object(
    'ok', true, 'actionId', p_action_id, 'version', (p_new_plan->>'version'),
    'zadeva', jsonb_build_object(
      'id', v_zadeva.id, 'status', v_zadeva.status, 'prvotniZnesek', v_zadeva.prvotni_znesek,
      'preostaliDolg', v_zadeva.preostali_dolg, 'placanoSkupaj', v_zadeva.placano_skupaj,
      'poravnanoNedenarno', v_zadeva.poravnano_nedenarno,
      'znesek', v_zadeva.znesek, 'poravnanoAt', v_zadeva.poravnano_at
    ),
    'plan', p_new_plan, 'steps', public._izvedba_koraki_dto(p_zadeva_id)
  );
  update public.opomin_ukrepi set status = 'completed', result_state = v_result, completed_at = now() where id = v_ukrep_id;
  return v_result;
end;
$$;

revoke all on function public.izvedi_opomin_ukrep(uuid, uuid, text, uuid, text, text, jsonb, jsonb, jsonb, numeric, text) from public, anon, authenticated;
grant execute on function public.izvedi_opomin_ukrep(uuid, uuid, text, uuid, text, text, jsonb, jsonb, jsonb, numeric, text) to service_role;
```

- [ ] **Step 4: Zaženi teste in preveri, da vsi preidejo**

Run: `node scripts/test-izvedba-actions.mjs`
Expected: PASS

- [ ] **Step 5: Uveljavi migracijo na (linked) Supabase bazi**

Ta korak zahteva dostop do prave Supabase baze — ni del avtomatiziranih testov. Uporabi enak postopek kot pri prejšnji migraciji te seje (`20260823150000_nedenarne_poravnave.sql`, glej ZAPISNIK razdelek "Denarni podatkovni model"):

```bash
supabase db query --linked -f supabase/migrations/20260824090000_delna_nedenarna_poravnave.sql
```

Po uveljavitvi ročno preveri v Supabase SQL urejevalniku ali prek `psql`, da funkcija obstaja s pravilno signaturo:

```sql
select proname, pg_get_function_arguments(oid) from pg_proc where proname = 'izvedi_opomin_ukrep';
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260824090000_delna_nedenarna_poravnave.sql scripts/test-izvedba-actions.mjs
git commit -m "Add partial_settlement RPC branch: non-cash partial debt reduction"
```

---

## Task 4: Preveri celoten backend nabor testov

**Files:**
- Test: `scripts/test-izvedba-actions.mjs` (samo zagon, brez novih sprememb)

**Interfaces:**
- Consumes: vse tri prejšnje naloge.
- Produces: potrjeno delujoč, samostojno testiran backend za `partial_settlement`, pripravljen za UI ožičenje (Plan 2).

- [ ] **Step 1: Zaženi celoten obstoječi testni ukaz projekta za povezane teste**

Run: `node scripts/test-izvedba-actions.mjs`
Expected: PASS — izpis se konča brez `✗`, zadnja vrstica poroča število uspešnih testov.

- [ ] **Step 2: Zaženi širši `npm test`, da preveriš, da sprememba ni podrla nič nepovezanega**

Run: `npm test`
Expected: PASS za vse teste, ki dejansko pokrivajo spremenjene datoteke (`izvedba-core.js`, novo migracijo). Če kateri nepovezan test v repozitoriju pade zaradi vzporednega dela drugega agenta (glej CLAUDE.md razdelek 9), to ne blokira te naloge — a to uporabniku jasno omeni.

- [ ] **Step 3: Commit (če je karkoli ostalo nezavezano)**

```bash
git status --short
```

Če je delovno drevo čisto (vse že zavezano v prejšnjih nalogah), ta korak ne zahteva ničesar.

---

## Naslednji koraki (Plan 2, ločen dokument)

Ta plan namerno NE vsebuje UI sprememb (kartice v `izvedba.js`/`izvedba-komponente.js`, prikaz "dosedanji koraki"). Zakaj ločeno: backend je samostojno testiran in mergeable brez UI, UI ožičenje je precej večji, ločen kos dela (dva dialoga, event-delegacija, cache-busting, vizualno preverjanje pri 320/390px). Ko je ta plan izveden in potrjen, napišem Plan 2 za UI del na podlagi dejansko obstoječega backend vmesnika iz tega plana.
