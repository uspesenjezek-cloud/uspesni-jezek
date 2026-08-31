"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const engine = require("../app/ponudba-moduli-engine");
const luna = require("../api/_lib/ponudba-luna-engine");

function unique(rows, label) { assert.equal(new Set(rows.map((row) => row.id)).size, rows.length, label + " ID-ji morajo biti enolični"); }
assert.equal(engine.version, "ponudba-moduli-v2");
assert.equal(engine.contractVersion, "ponudba-luna-id-contract-v4");
assert.equal(engine.families.length, 16);
assert.ok(engine.profiles.length >= 40, "katalog mora pokriti glavne SI/DE ponudnike obrtnikom");
assert.equal(engine.offerModels.length, 15);
assert.equal(engine.salesChannels.length, 12);
assert.equal(engine.areas.length, 6);
assert.equal(engine.modules.length, 28);
assert.ok(engine.fields.length >= 55);
[engine.families, engine.profiles, engine.offerModels, engine.salesChannels, engine.modules, engine.fields].forEach((rows, index) => unique(rows, "Katalog " + index));
assert.equal(new Set(engine.areas.map((area) => area.code)).size, engine.areas.length, "Kode področij morajo biti enolične");
assert.deepEqual(engine.modules.map((module) => module.code), ["C00","C01","C02","C03","S01","S02","S03","S04","S05","P01","P02","P03","P04","T01","T02","T03","K01","K02","K03","Q01","G01","G02","R01","R02","R03","R04","E01","A01"]);
assert.deepEqual(engine.areas.find((area) => area.code === "cena").moduleIds, [4009,4010,4011,4012]);
engine.areas.forEach((area) => assert.ok(area.moduleIds.length <= 6, area.label + " ima lahko največ 6 vprašanj"));
assert.deepEqual(Object.fromEntries(engine.areas.map((area) => [area.code, area.moduleIds.map((id) => engine.modules.find((module) => module.id === id).code)])), {
  cena:["P01","P02","P03","P04"],
  obseg:["S01","S02","S03","S04","S05","Q01"],
  placilo:["T01","T02","T03"],
  pogodba:["C03","K01","K02","K03"],
  garancija:["G01","G02"],
  tveganja:["C01","R01","R02","R03","R04","E01"]
});
assert.deepEqual(Object.fromEntries(engine.areas.map((area) => [area.code, area.moduleIds.map((id) => engine.modules.find((module) => module.id === id).question)])), {
  cena:[
    "Kakšna je enkratna cena in ali vključuje DDV?",
    "Kolikšen je redni strošek in kako pogosto se plača?",
    "Po kateri enoti, pragu ali odstotku se obračuna poraba oziroma uspeh?",
    "Kateri dodatni stroški, popusti ali podražitve lahko spremenijo končno ceno?"
  ],
  obseg:[
    "Kaj točno kupujete in kateri rezultat pričakujete?",
    "Kaj je vključeno in kaj boste morali naročiti ali plačati posebej?",
    "Kakšna sta količina in obračunska enota?",
    "Katere specifikacije, materiali, modeli ali standardi morajo veljati?",
    "Kaj morate pred začetkom zagotoviti vi?",
    "Po katerih merilih je delo končano in kdo potrdi prevzem?"
  ],
  placilo:[
    "Kdaj se izvedba začne in do kdaj mora biti zaključena?",
    "Kolikšni so predplačilo, obroki in roki plačila ob posameznih mejnikih?",
    "Kateri termin, časovno okno ali pogostost izvedbe velja?"
  ],
  pogodba:[
    "Ali gre za nakup, projekt, naročnino, najem ali drugo obliko sodelovanja?",
    "Koliko časa traja pogodba, kakšna je vezava in kako se podaljša?",
    "Kako in do kdaj lahko pogodbo odpoveste ter koliko stane izstop?",
    "Kaj lahko ponudnik enostransko spremeni in kako je omejena njegova odgovornost?"
  ],
  garancija:[
    "Kako dolgo velja garancija, kaj krije in kako prijavite napako?",
    "V kolikšnem času se ponudnik odzove in odpravi napako?"
  ],
  tveganja:[
    "Kdo sklene pogodbo in kdo ponudbo dejansko izvede ali dobavi?",
    "Kdo je pravni ponudnik in katera veljavna dovoljenja ali dokazila ima?",
    "Kdo bo delo dejansko izvajal in od katerih predpogojev je odvisno?",
    "Kdo dobi dostop do podatkov in kdo obdrži datoteke, vsebine ter dostope?",
    "Kaj vam je bilo obljubljeno ustno, vendar v ponudbi ni jasno zapisano?",
    "Katero dokazilo potrjuje navedene cene, pogoje in obljube?"
  ]
});
assert.ok(engine.areas.every((area) => area.moduleIds.every((id) => engine.modules.find((module) => module.id === id).question.endsWith("?"))), "vsak korak področja mora imeti kratko vprašanje iz kanoničnega kataloga");

assert.equal(engine.poisciProfile("mobilni operater poslovna naročnina", 1)[0].id, 1014);
assert.equal(engine.poisciProfile("Baumaschinenvermietung", 1)[0].id, 1006);
assert.equal(engine.poisciProfile("Steuerberater Buchhaltung", 1)[0].id, 1033);
assert.equal(engine.poisciProfile("Google Ads in SEO", 1)[0].id, 1022);

const telecom = engine.sestavi({ profileId: 1014, offerModelIds: [2005], salesChannelIds: [3005], moduleIds: [4002, 4010, 4016, 4017, 4025] });
assert.deepEqual(telecom.moduleIds, [4002, 4010, 4016, 4017, 4025]);
const telecomFields = telecom.modules.flatMap((module) => module.fields.map((field) => field.id));
[5106, 5401, 5402, 5403, 5404, 5608, 5609, 5611].forEach((id) => assert.ok(telecomFields.includes(id), "manjka prilagojeno polje " + id));
assert.ok(!telecom.moduleIds.includes(4009), "sestavljalnik ne sme dodati neizbranega modula");
assert.equal(engine.sestavi({ moduleIds:[4009] }).modules[0].question, "Kakšna je enkratna cena in ali vključuje DDV?", "materializirani modul mora ohraniti vprašanje iz istega kataloga");

const source = "Poklical nas je prodajalec. Paket stane 39 EUR mesečno in ima vezavo 24 mesecev.";
const safe = engine.validateLunaProposal({ profileId: 1014, offerModelIds: [2005], salesChannelIds: [3005], moduleIds: [4010, 4016], facts: [
  { fieldId: 5106, value: "39 EUR mesečno", evidence: "39 EUR mesečno" },
  { fieldId: 5402, value: "24 mesecev", evidence: "24 mesecev" }
] }, source);
assert.equal(safe.profileId, 1014);
assert.deepEqual(safe.offerModelIds, [2005]);
assert.equal(safe.facts.length, 2);
assert.ok(safe.facts.every((fact) => fact.requiresHumanReview));
assert.equal(engine.validateLunaProposal({ profileId: 9999, offerModelIds: [], salesChannelIds: [], moduleIds: [], facts: [] }, source), null);
assert.equal(engine.validateLunaProposal({ profileId: 1014, offerModelIds: [2005, 9999], salesChannelIds: [3005], moduleIds: [4010], facts: [] }, source), null, "neznan ID mora zavrniti celoten predlog");
assert.equal(engine.validateLunaProposal({ profileId: 1014, offerModelIds: [], salesChannelIds: [], moduleIds: [4010], facts: [
  { fieldId: 5106, value: "39 EUR mesečno", evidence: "tega v besedilu ni" },
] }, source), null, "nepovezano dejstvo se ne sme tiho odvreči");
assert.equal(engine.validateLunaProposal({ profileId: 1014, offerModelIds: [], salesChannelIds: [], moduleIds: [4010, 4010], facts: [] }, source), null, "podvojen moduleId mora fail-closed");
assert.equal(engine.validateLunaProposal({ profileId: 1014, offerModelIds: [], salesChannelIds: [], moduleIds: [], facts: [] }, source), null, "Lunin predlog brez modula ne sme materializirati vseh modulov");

const lunaResult = luna.materialize({ profileId: 1014, offerModelIds: [2005], salesChannelIds: [3005], moduleIds: [4010], facts: [{ fieldId: 5106, value: "39 EUR mesečno", evidence: "39 EUR mesečno" }] }, source);
assert.equal(luna.MODEL, "gpt-5.6-luna");
assert.equal(lunaResult.proposal.facts[0].fieldId, 5106);
assert.equal(luna.contract().responseSchema.additionalProperties, false);
assert.ok(luna.contract().instructions.join(" ").includes("Telemarketing"));
assert.match(luna.contract().instructions.join(" "), /HARD COMPOSITIONAL REASONING METHOD \(luna-compositional-reasoning-v1\)/);
assert.equal(luna.deterministicPlan, undefined, "ponudbeni engine ne sme izvažati lokalnega semantičnega fallbacka");

const timings = [];
for (let i = 0; i < 1000; i += 1) {
  const started = performance.now();
  engine.sestavi({ profileId: 1001 + (i % 43), offerModelIds: [2001 + (i % 15)], salesChannelIds: [3001 + (i % 12)], moduleIds: [4000 + (i % 28)] });
  timings.push(performance.now() - started);
}
timings.sort((a, b) => a - b);
const p95 = timings[Math.floor(timings.length * 0.95)];
assert.ok(p95 < 5, "p95 sestavljalnika mora ostati pod 5 ms, trenutno " + p95.toFixed(3));

const migration = ["20260829210652_ponudba_modularni_katalog.sql", "20260829223000_offer_lego_modules_v2.sql"].map((file) => fs.readFileSync(path.join(__dirname, "../supabase/migrations/" + file), "utf8")).join("\n");
["offer_provider_profiles", "offer_contract_models", "offer_sales_channels", "offer_review_modules", "offer_review_fields", "offer_review_requests", "offer_review_answers"].forEach((table) => assert.ok(migration.includes(table), "migracija nima " + table));
assert.match(migration, /alter table public\.offer_review_requests enable row level security/);
assert.match(migration, /with check \(\(select auth\.uid\(\)\) = user_id\)/);
assert.match(migration, /grant select, insert, update, delete on public\.offer_review_requests, public\.offer_review_answers to authenticated/);
assert.match(migration, /revoke all on[\s\S]*from anon/);
engine.profiles.forEach((profile) => assert.ok(migration.includes("(" + profile.id + ","), "migracija nima profila " + profile.id));
engine.fields.forEach((field) => assert.ok(migration.includes("(" + field.id + ","), "migracija nima polja " + field.id));
engine.modules.forEach((module) => assert.ok(migration.includes("(" + module.id + ","), "migracija nima modula " + module.id));

console.log("Ponudba modularni engine: OK (p95 " + p95.toFixed(3) + " ms)");
