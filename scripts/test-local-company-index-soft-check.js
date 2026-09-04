"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var root = path.resolve(__dirname, "..");
var localIndex = require(path.join(root, "api/_lib/local-company-index"));
var handlerSource = fs.readFileSync(path.join(root, "api/_handlers/mehka-boniteta.js"), "utf8");
var queueSource = fs.readFileSync(path.join(root, "api/_lib/mehka-boniteta-queue.js"), "utf8");
var frontendSource = fs.readFileSync(path.join(root, "app/bonitetna-preverba.js"), "utf8");
var handler = require(path.join(root, "api/mehka-boniteta"));

async function main() {
  localIndex.resetCache();
  var mang = await localIndex.resolveSelection({
    name: "Mang GmbH",
    registerNumber: "HRB 3886",
    registerCourt: "Bamberg",
    sourceId: "D4201V_HRB3886",
  });
  assert.equal(mang.status, "found");
  assert.equal(mang.source, "local_company_index");
  assert.equal(mang.company.name, "Mang GmbH");
  assert.equal(mang.company.register_number, "3886");
  assert.equal(mang.company.register_court, "Bamberg");
  assert.equal(mang.company.company_id, "", "zgodovinski lokalni ID ne sme postati OpenRegister company_id");
  assert.equal(mang.company.active, null, "zgodovinski posnetek ne sme trditi današnjega statusa");

  var spoofed = await localIndex.resolveSelection({
    name: "Mang GmbH",
    registerNumber: "HRB 999999",
    registerCourt: "Bamberg",
    sourceId: "D4201V_HRB3886",
  });
  assert.equal(spoofed.status, "not_found", "spremenjena registrska številka mora pasti pred plačljivim klicem");

  var openRegisterInput = handler._test.pripraviOpenRegisterVnosIzLokalnegaIzbora({}, mang);
  assert.deepEqual(openRegisterInput, {
    ime: "Mang GmbH",
    naslov: "",
    postnaStevilka: "",
    kraj: mang.company.address.city,
    registerNumber: "HRB 3886",
    registerCourt: "Bamberg",
  });
  var openRegisterUrl = handler._test.sestaviOpenRegisterIskalniUrl(openRegisterInput);
  assert.equal(openRegisterUrl.pathname, "/v0/search/company");
  assert.equal(openRegisterUrl.searchParams.get("register_type"), "HRB");
  assert.equal(openRegisterUrl.searchParams.get("register_number"), "3886");

  var localCandidateIdentity = handler._test.sestaviIdentiteto(mang, null, { status: "not_provided" }, openRegisterInput);
  assert.equal(localCandidateIdentity.status, "unresolved", "lokalni kandidat sam ne sme postati preverjena identiteta");
  assert.equal(handler._test.preveriSkladnostIdentiteteZaInsolvenco(localCandidateIdentity).status, "blocked");

  var localBranch = handlerSource.indexOf("if (lokalniCompanyIndexIzbor)");
  var localBranchEnd = handlerSource.indexOf("else if (podpisanoOpenRegisterPodjetje)", localBranch);
  assert.ok(localBranch >= 0 && localBranchEnd > localBranch, "lokalna veja mora obstajati pred drugimi registrskimi vejami");
  var localBlock = handlerSource.slice(localBranch, localBranchEnd);
  assert.match(localBlock, /localCompanyIndex\.resolveSelection\(/, "strežnik mora ponovno preveriti izbrano lokalno vrstico");
  assert.match(localBlock, /pripraviOpenRegisterVnosIzLokalnegaIzbora\(/, "OpenRegister vhod mora nastati iz strežniško preverjene vrstice");
  assert.equal((localBlock.match(/poisciOpenRegisterNajvecEnkrat\(/g) || []).length, 1,
    "izbrana lokalna kartica mora sprožiti natanko en OpenRegister identity-search");
  assert.match(localBlock, /\{ forceFresh: true \}/, "lokalne kartice mora OpenRegister dejansko sveže preveriti");

  var sharedNorthDataStart = handlerSource.indexOf("zacniNorthDataPoOpenRegisterju(openregister", localBranchEnd);
  assert.ok(sharedNorthDataStart > localBranchEnd, "potrjeni OpenRegister rezultat mora nadaljevati v eni skupni točki za oba actorja");
  var sharedNorthDataFunction = handlerSource.slice(
    handlerSource.indexOf("function zacniNorthDataPoOpenRegisterju"),
    handlerSource.indexOf("async function dokončajNorthDataPoOpenRegisterju")
  );
  assert.match(sharedNorthDataFunction, /identiteta\.status !== "verified_register"/,
    "oba actorja se smeta zagnati samo za registrsko identiteto, potrjeno z OpenRegisterjem");
  assert.match(sharedNorthDataFunction, /identiteta\.active === false/,
    "dokazano neaktivno podjetje mora ustaviti oba actorja");
  assert.doesNotMatch(sharedNorthDataFunction, /identiteta\.active !== true/,
    "neznan aktivni status iz v0 search ne sme ustaviti actorjev za potrjeno registrsko identiteto");
  assert.doesNotMatch(handlerSource, /not_used_for_local_company_index|verified_directory_snapshot|local_register_snapshot/,
    "stari neposredni lokalni obvoz mora biti v celoti odstranjen");
  assert.match(frontendSource, /fetch\("\/app\/company-index\//, "hitri predlogi morajo ostati v lokalnih shardih");
  assert.match(frontendSource, /companyIndexId: registrskiVnosJeSamoIme \? "" : izbranoOpenRegisterPodjetje && izbranoOpenRegisterPodjetje\.sourceId/);
  assert.match(queueSource, /company-index-v7-always-fresh-openregister-validation/,
    "sprememba avtoritete mora razveljaviti stare zaključene rezultate brez OpenRegisterja");
  assert.match(queueSource, /jePotrjenoNadaljevanje = Boolean\(telo && telo\.confirmedIdentity && telo\.confirmedIdentity\.confirmed\)[\s\S]*?companyIndexSource === "offeneregister" && !jePotrjenoNadaljevanje/,
    "nov klik na lokalno kartico ne sme uporabiti zaključenega rezultata in preskočiti OpenRegisterja");
  assert.doesNotMatch(queueSource, /company-index-v4-official-insolvency-zero-openregister/);

  console.log("Local company-index invariant passed: quick cards stay local; starting a selected card performs one fresh OpenRegister validation before the shared North Data and insolvency flow.");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
