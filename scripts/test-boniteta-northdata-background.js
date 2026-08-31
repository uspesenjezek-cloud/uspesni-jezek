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
  assert.ok(mainHandler.includes('status: "pending_background"') && mainHandler.includes("northDataDetailsProof.sign"));
  assert.ok(!mainHandler.includes("northDataDetailsClient.enrichAfterPrimary"), "glavni handler ne sme čakati details actorja");
  assert.strictEqual((backgroundHandler.match(/detailsClient\.enrichAfterPrimary/g) || []).length, 1, "background handler sme actor poklicati enkrat");
  assert.ok(!backgroundHandler.includes("fetchSPonovnimPoskusom"), "plačljivi background POST nima retryja");
  assert.ok(frontend.includes("mojaGeneracija !== generacijaRezultata"), "pozen odgovor mora imeti stale-generation varovalo");
  assert.ok(frontend.includes('fetch(request.endpoint || "/api/mehka-boniteta-podrobnosti"'), "frontend mora uporabiti neposreden enkraten fetch");
  assert.ok(!html.includes("boniteta-dodatni-podatki-status"), "ločeni statusni widget ne sme več zasedati prostora nad navigacijo");
  assert.ok(frontend.includes('"Nalagam …"') && frontend.includes('"Ni dodatnih info"'), "loading in neuspeh morata biti prikazana neposredno v kartici Plus");
  assert.ok(frontend.includes('classList.toggle("is-plus-loading"') && frontend.includes('classList.toggle("is-plus-unavailable"'), "Plus mora imeti ločeni loading in sivi unavailable stanji");
  assert.match(graphicsCss, /boniteta-plus-vrtenje[\s\S]*?translateY\(-50%\)[\s\S]*?scale\(1\.22\)/, "Plus se mora med nalaganjem vrteti povečan in ostati na prvotnem sidru");
  assert.match(frontend, /zacetnaTransformacija[\s\S]*?plusIkona\.animate[\s\S]*?duration:\s*460/, "Plus se mora po nalaganju postopno vrniti v prvotno velikost in položaj");
  assert.match(html, /boniteta-identiteta-nadaljuj__puscica[^>]*>[\s\S]*?<svg[\s\S]*?m9 18 6-6-6-6/, "glavna puščica mora vedno uporabljati isti SVG-chevron");
  assert.match(frontend, /details-status-preview[\s\S]*?\["loading", "unavailable", "complete"\][\s\S]*?lokalniAudit: true/, "localhost predogled mora pokriti loading, unavailable in uspešno stanje kartice Plus");
  console.log("✓ Background North Data je podpisan, enkraten in stale-safe; stanje ostane znotraj kartice Plus.");
}

main().catch(function (error) { console.error(error); process.exitCode = 1; });
