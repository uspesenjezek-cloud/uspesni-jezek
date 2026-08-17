/**
 * Integracijski testi SQL/RPC za produkcijsko stran "Izvedba"
 * (supabase/migrations/20260814200000_izvedba.sql).
 *
 * Za razliko od scripts/test-izvedba-actions.mjs (čista poslovna logika,
 * brez baze) ta skripta dejansko poganja migracijo proti PRAVI, ločeni
 * testni PostgreSQL bazi in kliče RPC funkcije neposredno - dokazuje
 * atomarnost, idempotenco in rollback, ne samo poslovno logiko v JS.
 *
 * NIKOLI je ne poganjaj proti produkcijski Supabase bazi.
 *
 * Zagon:
 *   1. Zaženi lokalni Postgres (npr. `supabase start` ali Docker
 *      `postgres:15` s praznim vzdevkom).
 *   2. Nastavi TEST_DATABASE_URL na to bazo, npr.:
 *      TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
 *   3. npm run test:integration
 *
 * Brez TEST_DATABASE_URL se skripta konča z jasnim sporočilom in izhodno
 * kodo 0 (ne šteje kot neuspeh privzetega `npm test`, ki nima dostopa do
 * žive baze) - glej main() spodaj.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const root = path.dirname(fileURLToPath(import.meta.url));

async function nalozipg() {
  try {
    const modul = await import("pg");
    return modul.default || modul;
  } catch (err) {
    return null;
  }
}

function kanonicniFingerprint(podatki) {
  function kanon(v) {
    if (Array.isArray(v)) return "[" + v.map(kanon).join(",") + "]";
    if (v && typeof v === "object") {
      return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + kanon(v[k])).join(",") + "}";
    }
    return JSON.stringify(v === undefined ? null : v);
  }
  return crypto.createHash("sha256").update(kanon(podatki)).digest("hex");
}

async function main() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.log("\nTEST_DATABASE_URL ni nastavljen - integracijski RPC testi preskočeni.");
    console.log("Glej komentar na vrhu te datoteke za navodila (lokalni Supabase/Postgres).");
    return;
  }

  const pg = await nalozipg();
  if (!pg) {
    console.log("\nPaket 'pg' ni nameščen (devDependency) - integracijski RPC testi preskočeni.");
    console.log("Zaženi `npm install` in poskusi znova.");
    return;
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  let passed = 0;
  async function test(name, fn) {
    try {
      await fn();
      passed++;
      console.log("  ✓ " + name);
    } catch (err) {
      console.error("  ✗ " + name);
      throw err;
    }
  }

  async function q(sql, params) {
    return client.query(sql, params);
  }

  // Migracijske datoteke morajo biti pognane po vrstnem redu na PRAZNI
  // testni bazi (vse od začetka projekta) - to je odgovornost uporabnika
  // (npr. `supabase db reset` proti testni bazi pred zagonom te skripte).
  // Tu samo preverimo, da ključne funkcije/tabele obstajajo, preden
  // nadaljujemo - jasna napaka namesto nejasnih SQL napak.
  async function preveriPredpogoje() {
    const rez = await q(
      "select to_regprocedure('public.izvedi_opomin_ukrep(uuid,uuid,text,uuid,text,text,jsonb,jsonb,jsonb,numeric,text)') as fn"
    );
    if (!rez.rows[0].fn) {
      throw new Error(
        "RPC izvedi_opomin_ukrep ne obstaja na testni bazi - najprej zaženi VSE migracije (supabase/migrations/*.sql po vrstnem redu) proti TEST_DATABASE_URL."
      );
    }
  }

  async function ustvariTestnegaUporabnika() {
    // auth.users v lokalnem Supabase stacku je navadna tabela - vstavimo
    // minimalno vrstico za FK. Na pravem Supabase auth.users upravlja GoTrue,
    // zato to deluje samo na lokalnem/self-hosted testnem stacku.
    const id = crypto.randomUUID();
    await q("insert into auth.users (id, email) values ($1, $2) on conflict (id) do nothing", [id, id + "@test.local"]);
    return id;
  }

  async function ustvariTestnoZadevo(obrtnikId, znesek) {
    const rez = await q(
      `insert into public.zadeve (obrtnik_id, ime_dolznika, znesek, opomin_nacrt)
       values ($1, 'Test Dolznik', $2, $3::jsonb)
       returning id`,
      [obrtnikId, znesek, JSON.stringify({ id: "plan-test", version: "0", status: "active", steps: [] })]
    );
    return rez.rows[0].id;
  }

  try {
    await preveriPredpogoje();

    console.log("\nIzvedba - integracijski RPC testi (živa testna baza)");

    await test("1) dvojni klik z istim action_id vrne enak rezultat, brez podvojenega učinka", async () => {
      const obrtnikId = await ustvariTestnegaUporabnika();
      const zadevaId = await ustvariTestnoZadevo(obrtnikId, 100);
      const actionId = crypto.randomUUID();
      const noviPlan = { id: "plan-test", version: "1", status: "active", steps: [] };
      const fingerprint = kanonicniFingerprint({ obrtnikId, zadevaId, stepId: null, actionType: "stop_plan", settings: { resumeMode: "manual" } });

      const args = [zadevaId, obrtnikId, "0", actionId, fingerprint, "stop_plan", JSON.stringify({ resumeMode: "manual" }), JSON.stringify(noviPlan), JSON.stringify([]), null, null];
      const [r1, r2] = await Promise.all([
        q("select public.izvedi_opomin_ukrep($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11) as r", args),
        q("select public.izvedi_opomin_ukrep($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11) as r", args),
      ]);
      assert.equal(r1.rows[0].r.ok, true);
      assert.deepEqual(r1.rows[0].r, r2.rows[0].r);

      const stevilo = await q("select count(*) from public.opomin_ukrepi where action_id = $1", [actionId]);
      assert.equal(Number(stevilo.rows[0].count), 1);
    });

    await test("2) isti action_id z drugačnimi nastavitvami vrne ACTION_ID_REUSED", async () => {
      const obrtnikId = await ustvariTestnegaUporabnika();
      const zadevaId = await ustvariTestnoZadevo(obrtnikId, 100);
      const actionId = crypto.randomUUID();
      const noviPlan = { id: "plan-test", version: "1", status: "active", steps: [] };
      const fp1 = kanonicniFingerprint({ obrtnikId, zadevaId, stepId: null, actionType: "stop_plan", settings: { resumeMode: "manual" } });
      const fp2 = kanonicniFingerprint({ obrtnikId, zadevaId, stepId: null, actionType: "stop_plan", settings: { resumeMode: "date" } });

      await q("select public.izvedi_opomin_ukrep($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11) as r", [
        zadevaId, obrtnikId, "0", actionId, fp1, "stop_plan", JSON.stringify({ resumeMode: "manual" }), JSON.stringify(noviPlan), JSON.stringify([]), null, null,
      ]);
      const r2 = await q("select public.izvedi_opomin_ukrep($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11) as r", [
        zadevaId, obrtnikId, "0", actionId, fp2, "stop_plan", JSON.stringify({ resumeMode: "date" }), JSON.stringify(noviPlan), JSON.stringify([]), null, null,
      ]);
      assert.equal(r2.rows[0].r.ok, false);
      assert.equal(r2.rows[0].r.code, "ACTION_ID_REUSED");
    });

    await test("3) napačna (zastarela) verzija vrne VERSION_CONFLICT, brez sprememb", async () => {
      const obrtnikId = await ustvariTestnegaUporabnika();
      const zadevaId = await ustvariTestnoZadevo(obrtnikId, 100);
      const noviPlan = { id: "plan-test", version: "1", status: "active", steps: [] };
      const fingerprint = kanonicniFingerprint({ obrtnikId, zadevaId, stepId: null, actionType: "stop_plan", settings: {} });

      const r = await q("select public.izvedi_opomin_ukrep($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11) as r", [
        zadevaId, obrtnikId, "99", crypto.randomUUID(), fingerprint, "stop_plan", JSON.stringify({}), JSON.stringify(noviPlan), JSON.stringify([]), null, null,
      ]);
      assert.equal(r.rows[0].r.ok, false);
      assert.equal(r.rows[0].r.code, "VERSION_CONFLICT");

      const preverjenaZadeva = await q("select opomin_nacrt from public.zadeve where id = $1", [zadevaId]);
      assert.equal(preverjenaZadeva.rows[0].opomin_nacrt.version, "0");
    });

    await test("4) tuj obrtnik_id vrne FORBIDDEN", async () => {
      const lastnik = await ustvariTestnegaUporabnika();
      const drugUporabnik = await ustvariTestnegaUporabnika();
      const zadevaId = await ustvariTestnoZadevo(lastnik, 100);
      const noviPlan = { id: "plan-test", version: "1", status: "active", steps: [] };
      const fingerprint = kanonicniFingerprint({ obrtnikId: drugUporabnik, zadevaId, stepId: null, actionType: "stop_plan", settings: {} });

      const r = await q("select public.izvedi_opomin_ukrep($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11) as r", [
        zadevaId, drugUporabnik, "0", crypto.randomUUID(), fingerprint, "stop_plan", JSON.stringify({}), JSON.stringify(noviPlan), JSON.stringify([]), null, null,
      ]);
      assert.equal(r.rows[0].r.ok, false);
      assert.equal(r.rows[0].r.code, "FORBIDDEN");
    });

    await test("5) delno plačilo preko meje debta je zavrnjeno kot poslovna napaka (Node), ne SQL izjema", async () => {
      const core = await import(path.join(root, "..", "api", "_lib", "izvedba-core.js"));
      const validacija = core.validirajNastavitve("partial_payment", { remainingAmount: 500 }, { preostaliDolg: 100 });
      assert.equal(validacija.ok, false);
      assert.equal(validacija.code, "PAYMENT_EXCEEDS_DEBT");
    });

    await test("6) ločen SQL-rollback test: CHECK constraint prepreči negativen preostali_dolg, brez sprememb", async () => {
      const obrtnikId = await ustvariTestnegaUporabnika();
      const zadevaId = await ustvariTestnoZadevo(obrtnikId, 100);

      await q("begin");
      try {
        await q("select set_config('app.dovoli_denarne_spremembe', 'true', true)");
        await assert.rejects(
          q("update public.zadeve set preostali_dolg = -5 where id = $1", [zadevaId]),
          /preostali_dolg_nenegativen/
        );
      } finally {
        await q("rollback");
      }

      const preverjenaZadeva = await q("select preostali_dolg from public.zadeve where id = $1", [zadevaId]);
      assert.equal(Number(preverjenaZadeva.rows[0].preostali_dolg), 100);
    });

    await test("7) denarnih stolpcev ni mogoče spremeniti brez app.dovoli_denarne_spremembe zastavice", async () => {
      const obrtnikId = await ustvariTestnegaUporabnika();
      const zadevaId = await ustvariTestnoZadevo(obrtnikId, 100);
      await q("begin");
      try {
        await assert.rejects(
          q("update public.zadeve set preostali_dolg = 50 where id = $1", [zadevaId]),
          /Denarnih stolpcev ni mogoče spreminjati neposredno/
        );
      } finally {
        await q("rollback");
      }
    });

    await test("8) sistem_stikala izklopljen -> prevzemi_zapadle_opomine vrne nič vrstic", async () => {
      const stanje = await q("select vklopljeno from public.sistem_stikala where ime = 'opomin_scheduler'");
      const prejsnje = stanje.rows[0].vklopljeno;
      await q("update public.sistem_stikala set vklopljeno = false where ime = 'opomin_scheduler'");
      try {
        const r = await q("select * from public.prevzemi_zapadle_opomine(10)");
        assert.equal(r.rows.length, 0);
      } finally {
        await q("update public.sistem_stikala set vklopljeno = $1 where ime = 'opomin_scheduler'", [prejsnje]);
      }
    });

    console.log("\nUspešnih integracijskih RPC testov: " + passed);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
