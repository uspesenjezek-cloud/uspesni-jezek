"use strict";

var assert = require("node:assert");
var fs = require("node:fs");
var path = require("node:path");

process.env.OPENREGISTER_IDENTITY_PROOF_SECRET = "test-only-northdata-details-secret";
process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE = "true";

var proof = require("../api/_lib/northdata-details-proof");
var queue = require("../api/_lib/mehka-boniteta-queue");

async function main() {
  var userId = "00000000-0000-0000-0000-000000000001";
  var official = { status: "found", company: {
    company_id: "DE-HRB-F1103-92943", name: "Jörg Steuernagel GmbH",
    register_type: "HRB", register_number: "92943", register_court: "Frankfurt am Main",
  } };
  var primary = { status: "found", company: {
    name: "Jörg Steuernagel GmbH", registerNumber: "HRB 92943",
    sourceUrl: "https://www.northdata.com/J%C3%B6rg+Steuernagel+GmbH,+Frankfurt+a.+Main/HRB+92943",
  } };
  var signed = proof.sign(userId, official, primary, 1000);
  var verified = proof.verify(signed, userId, 1001);
  assert.ok(verified && proof.matches(verified, official, primary), "veljaven dokaz mora ostati vezan na isto podjetje");
  assert.strictEqual(proof.verify(signed, "drug-user", 1001), null, "drug uporabnik ne sme uporabiti dokazila");
  assert.strictEqual(proof.verify(signed.slice(0, -1) + (signed.endsWith("a") ? "b" : "a"), userId, 1001), null, "spremenjen podpis mora pasti");
  assert.strictEqual(proof.verify(signed, userId, 1000 + proof.TTL_MS + 1), null, "poteklo dokazilo mora pasti");
  assert.strictEqual(proof.matches(verified, official, { status: "found", company: Object.assign({}, primary.company, { registerNumber: "HRB 1" }) }), false, "drug register se ne sme ujemati");
  var primaryRun = { runId: "PrimaryRun12345" };
  var detailsRun = { runId: "DetailsRun12345" };
  var pendingSigned = proof.signPending(userId, official, primaryRun, detailsRun, 1000);
  var pendingVerified = proof.verifyPending(pendingSigned, userId, 1001);
  assert.ok(pendingVerified && proof.matchesPending(pendingVerified, official, primaryRun, detailsRun), "ozadni podpis mora vezati OpenRegister in oba run ID-ja");
  assert.strictEqual(proof.matchesPending(pendingVerified, official, { runId: "DrugPrimaryRun" }, detailsRun), false, "prvega runa ni dovoljeno zamenjati");

  queue._test.ponastaviPomnilnik();
  var created = await queue.ustvari({}, userId, {
    ime: "Jörg Steuernagel GmbH", naslov: "Hungener Str. 3 a", postnaStevilka: "60389", kraj: "Frankfurt am Main",
    openRegisterCompanyId: "DE-HRB-F1103-92943", registerNumber: "HRB 92943", registerCourt: "Frankfurt am Main",
    confirmedIdentity: { confirmed: true, companyId: "DE-HRB-F1103-92943" },
  });
  var claimed = (await queue.prevzemi({}, 1, userId))[0];
  assert.ok(claimed && claimed.id === created.id);
  await queue.zakljuci({}, claimed, { success: true, result: {
    ok: true, identity: { status: "verified_register", companyId: "DE-HRB-F1103-92943", naziv: "Jörg Steuernagel GmbH" },
    openregister: official, northData: primary,
    northDataDetails: { status: "pending_background" },
    northDataDetailsRequest: { status: "pending", proof: signed, expiresAt: new Date(1000 + proof.TTL_MS).toISOString() },
    sources: [{ id: "northdata", status: "found" }, { id: "northdata_details", status: "pending_background" }],
  } });
  var publicJob = await queue.pridobi({}, userId, created.id);
  assert.strictEqual(publicJob.result.northDataDetailsRequest.status, "pending", "javni queue rezultat mora ohraniti pending zahtevo");
  assert.strictEqual(publicJob.result.northDataDetailsRequest.proof, signed, "frontend mora iz queue rezultata prejeti podpis za drugi North Data POST");
  var details = { status: "found", company: { name: "Jörg Steuernagel GmbH", registerNumber: "HRB 92943", sourceUrl: primary.company.sourceUrl, financials: [] } };
  var updated = await queue.dopolniNorthDataPodrobnosti({}, userId, created.id, signed, primary, details, { id: "northdata_details", status: "found" });
  assert.strictEqual(updated.result.northDataDetails.status, "found");
  assert.strictEqual(updated.result.northDataDetailsRequest.status, "completed");
  assert.ok(!updated.result.northDataDetailsRequest.proof, "porabljeno dokazilo se ne sme ohraniti za nov plačljiv klic");
  await assert.rejects(function () {
    return queue.dopolniNorthDataPodrobnosti({}, userId, created.id, signed, primary, details, { id: "northdata_details", status: "found" });
  }, /veljavno zaključeno preverbo/, "isti plačljivi background klic se ne sme porabiti dvakrat");

  var mainHandler = fs.readFileSync(path.join(__dirname, "..", "api", "_handlers", "mehka-boniteta.js"), "utf8");
  var backgroundHandler = fs.readFileSync(path.join(__dirname, "..", "api", "_handlers", "mehka-boniteta-podrobnosti.js"), "utf8");
  var frontend = fs.readFileSync(path.join(__dirname, "..", "app", "bonitetna-preverba.js"), "utf8");
  var html = fs.readFileSync(path.join(__dirname, "..", "app", "bonitetna-preverba.html"), "utf8");
  var graphicsCss = fs.readFileSync(path.join(__dirname, "..", "app", "bonitetna-podjetje-grafike.css"), "utf8");
  assert.ok(!mainHandler.includes("northDataDetailsClient.enrichVerifiedIdentity"), "glavni rezultat ne sme čakati dopolnilnega actorja");
  assert.ok(mainHandler.includes("northDataDetailsClient.startVerifiedIdentity"), "dopolnilni actor se mora začeti hkrati z osnovnim");
  assert.match(mainHandler, /var detailsPromise = northDataDetailsClient\.startVerifiedIdentity[\s\S]*?var primaryPromise = northDataClient\.startVerifiedIdentity/,
    "oba North Data actorja se morata začeti brez zaporednega await-a");
  assert.match(mainHandler, /Promise\.all\(\[zacetek\.primaryPromise, zacetek\.detailsPromise\]\)/,
    "prvi prikaz sme čakati samo zagon dopolnilnega actorja, ne njegovega zaključka");
  assert.ok(mainHandler.includes("northDataDetailsProof.signPending(authUserId, openregister, primaryStart, detailsStart)"), "ozadna zahteva mora biti podpisano vezana na OpenRegister in oba run ID-ja");
  assert.match(mainHandler, /northDataDetails = detailsStart[\s\S]*?status: "pending_background"[\s\S]*?status: "pending"[\s\S]*?endpoint: "\/api\/mehka-boniteta-podrobnosti"/,
    "osnovni odgovor mora vrniti nalaganje za Plus in ozadni endpoint");
  assert.strictEqual((backgroundHandler.match(/detailsClient\.enrichAfterPrimary/g) || []).length, 1, "združljivostni background handler sme actor poklicati enkrat");
  assert.strictEqual((backgroundHandler.match(/detailsClient\.completeStartedRun/g) || []).length, 2,
    "novi tok mora isti že začeti drugi run podpreti v progresivni in združljivostni poti brez novega POST-a");
  assert.strictEqual((backgroundHandler.match(/primaryClient\.completeStartedRun/g) || []).length, 1, "novi tok mora prebrati že začeti prvi run");
  assert.ok(!backgroundHandler.includes("fetchSPonovnimPoskusom"), "plačljivi background POST nima retryja");
  assert.ok(frontend.includes("mojaGeneracija !== generacijaRezultata"), "pozen odgovor mora imeti stale-generation varovalo");
  assert.match(frontend, /Promise\.allSettled\(\[pridobiVir\("primary"\), pridobiVir\("details"\)\]\)/,
    "frontend mora oba zaključka brati vzporedno");
  assert.match(frontend, /function uporabiDelniRezultat[\s\S]*?izrisiRegistrskoPodjetje/,
    "vsak prispeli vir se mora izrisati takoj in ne šele po skupni finalizaciji");
  assert.doesNotMatch(frontend, /signal:\s*source === "primary" \? omejitevKlica\(40000\)/,
    "noben North Data actor na odjemalcu ne sme imeti časovne ustavitve");
  assert.match(frontend, /stanjeVira\.status === "pending_background"[\s\S]*?await pocakaj\(900\)[\s\S]*?continue/,
    "odjemalec mora tekoči actor ponovno preverjati, dokler ne vrne končnega stanja");
  assert.ok(!html.includes("boniteta-dodatni-podatki-status"), "ločeni statusni widget ne sme več zasedati prostora nad navigacijo");
  assert.ok(frontend.includes('"Iščem podatke …"') && frontend.includes('"Ni dodatnih info"'), "iskanje in prazen rezultat morata biti jasno prikazana neposredno v zavihkih");
  assert.ok(frontend.includes('classList.toggle("is-plus-loading"') && frontend.includes('classList.toggle("is-plus-unavailable"'), "Plus mora imeti ločeni loading in sivi unavailable stanji");
  assert.match(frontend, /var imaVsebino = Boolean\(zadnjaDopolnilnaBilanca\(northDataPodrobnosti\(podatki\)\)\)[\s\S]*?imaVsebino[\s\S]*?\? "complete"/, "Plus sme biti označen kot najden samo, ko obstaja dejanska prikazljiva vsebina");
  assert.match(frontend, /if \(stanje !== "complete"\) gumb\.classList\.remove\("is-data-arrived"\)/, "prazen Plus ne sme obdržati obrobe najdenih podatkov");
  assert.match(frontend, /stanje === "unavailable"[\s\S]*?gumb\.disabled = true[\s\S]*?opis\.textContent = "Ni dodatnih info"/, "prazen Plus mora biti neklikljiv in jasno označen");
  assert.match(frontend, /podatki\.northDataDetailsRequest = \{[\s\S]*?status: dopolnitev\.allDone \? "completed" : "unavailable"[\s\S]*?posodobiPlusStanje\(podatki\);/,
    "končno stanje zahteve mora takoj ponovno izrisati Plus in odstraniti staro nalaganje");
  assert.ok(frontend.includes('classList.toggle("is-northdata-loading"') && frontend.includes('classList.add("is-data-arrived")'), "prvi agent mora podatke nalagati v zavihkih in prihod označiti na gumbu");
  assert.match(frontend, /stanje === "loading"[^\n]*classList\.remove\("is-data-arrived"\)/, "Plus mora pred vsakim novim nalaganjem odstraniti star zaključeni prehod");
  assert.match(frontend, /if \(seNalaga\) gumb\.classList\.remove\("is-data-arrived"\)/, "North Data zavihki morajo pred vsakim novim nalaganjem odstraniti star zaključeni prehod");
  assert.ok(frontend.includes('pogled === "izstopa" && niPomembnihUgotovitev') && frontend.includes('classList.remove("is-data-arrived")'), "prazen pogled Kaj izstopa ne sme obdržati opozorilnega poudarka");
  assert.match(graphicsCss, /is-northdata-loading\)::after\s*\{[\s\S]*?left:\s*-65%[\s\S]*?width:\s*60%[\s\S]*?will-change:\s*transform|is-plus-loading,\s*\.is-northdata-loading\)::after\s*\{[\s\S]*?left:\s*-65%[\s\S]*?width:\s*60%[\s\S]*?will-change:\s*transform/, "nalaganje mora uporabljati fizični svetli pas, ki se lahko premakne čez celoten gumb");
  assert.match(graphicsCss, /animation:\s*boniteta-northdata-gradient\s+1\.45s\s+linear\s+infinite/, "nalagalni prehod mora biti počasnejši in brez zaviranja na polovici");
  assert.match(graphicsCss, /@keyframes boniteta-northdata-gradient\s*\{[\s\S]*?translateX\(0\)[\s\S]*?translateX\(275%\)/, "svetli pas mora fizično prepotovati razdaljo od zunanjega levega do zunanjega desnega roba");
  assert.match(graphicsCss, /background:\s*linear-gradient\(90deg,\s*transparent,\s*rgba\(24,\s*170,\s*163,\s*\.1\)[\s\S]*?rgba\(8,\s*127,\s*131,\s*\.34\)/, "nalagalni pas mora uporabljati turkizno-zeleno barvo aplikacije");
  assert.match(graphicsCss, /is-data-arrived::after[\s\S]*?background:\s*conic-gradient[\s\S]*?mask-composite:\s*exclude[\s\S]*?animation:\s*boniteta-podatki-obhod\s+1\.8s\s+linear\s+1\s+both/, "zaključek mora enkrat izrisati turkizno črto po obrobi gumba");
  assert.match(graphicsCss, /@keyframes boniteta-podatki-obhod\s*\{[\s\S]*?--boniteta-obhod-kot:\s*0deg[\s\S]*?--boniteta-obhod-kot:\s*360deg/, "zaključna črta mora obhoditi celotno obrobo");
  assert.doesNotMatch(graphicsCss, /is-northdata-loading\)[^}]*span svg[\s\S]*?animation:/, "ikone med North Data nalaganjem se ne smejo vrteti");
  assert.ok(!graphicsCss.includes("boniteta-plus-vrtenje") && !frontend.includes("plusIkona.animate"), "nobena North Data ikona se ne sme vrteti");
  assert.match(graphicsCss, /is-northdata-loading\)[\s\S]*?linear-gradient[\s\S]*?animation:\s*boniteta-northdata-gradient[^;]*infinite/, "med nalaganjem mora biti na gumbih jasno viden premikajoči zeleni gradient");
  assert.match(html, /boniteta-identiteta-nadaljuj__puscica[^>]*>[\s\S]*?<svg[\s\S]*?m9 18 6-6-6-6/, "glavna puščica mora vedno uporabljati isti SVG-chevron");
  assert.match(frontend, /details-status-preview[\s\S]*?\["loading", "unavailable", "complete"\][\s\S]*?lokalniAudit: true/, "localhost predogled mora pokriti loading, unavailable in uspešno stanje kartice Plus");
  assert.match(html, /bonitetna-preverba\.js\?v=20260904-raw-name-single-search-v7/, "HTML mora prisiliti nalaganje aktualne logike OpenRegister in praznega Plus stanja");
  assert.match(graphicsCss, /rgba\(8, 127, 131, \.34\)/, "premikajoči barvni pas mora ostati umirjen in manj intenziven");
  assert.match(html, /bonitetna-podjetje-grafike\.css\?v=20260903-northdata-progress-v10/, "HTML mora prisiliti nalaganje aktualne umirjene animacije prihoda podatkov");
  console.log("✓ OpenRegister se prikaže prvi; oba North Data actorja se nalagata v kartici in uspeh označita na zavihkih.");
}

main().catch(function (error) { console.error(error); process.exitCode = 1; });
