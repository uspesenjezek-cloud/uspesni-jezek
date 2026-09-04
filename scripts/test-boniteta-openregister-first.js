"use strict";

var assert = require("node:assert");
var fs = require("node:fs");
var path = require("node:path");
var handler = require("../api/_handlers/mehka-boniteta");

var legalHtml = [
  "<html><body>",
  "<h1>Impressum</h1>",
  "<p>Alfons Dresch Haustechnische Anlagen GmbH</p>",
  "<p>Geschäftsführer: Christian Dresch</p>",
  "<p>Höhenstraße 45</p>",
  "<p>60385 Frankfurt am Main</p>",
  "<p>Registergericht: Amtsgericht Frankfurt am Main</p>",
  "<p>HRB 8354</p>",
  "</body></html>",
].join("");

assert.strictEqual(
  handler._test.najdiOpenRegisterNazivNaPravniStrani(
    legalHtml,
    "https://alfonsdresch.de/impressum/",
    { spletnaStran: "https://alfonsdresch.de/" }
  ),
  "Alfons Dresch Haustechnische Anlagen GmbH",
  "prvi OpenRegister klic mora dobiti polni pravni naziv s statične pravne strani"
);

assert.strictEqual(handler._test.pravniIskalniNamigZaDomeno(
  "https://autowerkstatt.atu.de/hessen/frankfurt-main/homburger-landstr-240"
), "A.T.U Auto-Teile-Unger GmbH & Co. KG",
"blokirana uradna ATU poddomena mora dobiti samo preverljiv iskalni namig za OpenRegister");
assert.strictEqual(handler._test.pravniIskalniNamigZaDomeno("https://atu-example.de/"), "",
  "podobna tuja domena ne sme prevzeti ATU pravnega namiga");

var atuExact = {
  company_id: "DE-HRA-D3508-1312", name: "A.T.U Auto-Teile-Unger GmbH & Co. KG",
  register_type: "HRA", register_number: "1312", register_court: "Weiden i. d. OPf.", address: {},
};
var atuSubsidiary = Object.assign({}, atuExact, {
  company_id: "DE-HRA-D3508-2012", name: "A.T.U Auto-Teile-Unger Handels GmbH & Co. KG", register_number: "2012",
});
assert.strictEqual(handler._test.izberiOpenRegisterZadetek([atuSubsidiary, atuExact], {
  ime: "A.T.U Auto-Teile-Unger GmbH & Co. KG",
}).company.company_id, atuExact.company_id,
"popolnoma enak pravni naziv mora pretehtati daljšo povezano ATU družbo");

assert.strictEqual(
  handler._test.najdiOpenRegisterNazivNaPravniStrani(
    legalHtml.replace("Alfons Dresch Haustechnische Anlagen GmbH", "Sanitär Heizungsbau GmbH"),
    "https://www.schraefl.de/impressum/",
    { spletnaStran: "https://www.schraefl.de/" }
  ),
  "",
  "generični pravni naziv brez razlikovalnega jedra domene ne sme sprožiti napačnega OpenRegister zadetka"
);

assert.strictEqual(
  handler._test.najdiOpenRegisterNazivNaPravniStrani(
    legalHtml.replace("Alfons Dresch Haustechnische Anlagen GmbH", "stop+go Systemzentrale GmbH"),
    "https://www.stopandgo.de/impressum/",
    { spletnaStran: "https://www.stopandgo.de/" }
  ),
  "stop+go Systemzentrale GmbH",
  "simbol + v pravnem nazivu in and v domeni morata predstavljati isto razlikovalno jedro"
);

var source = fs.readFileSync(path.join(__dirname, "..", "api", "_handlers", "mehka-boniteta.js"), "utf8");
var queueSource = fs.readFileSync(path.join(__dirname, "..", "api", "_lib", "mehka-boniteta-queue.js"), "utf8");
var classicsRepair = handler._test.razcleniImpressum([
  "<html><body><h1>Impressum</h1>",
  "<p>AM ClassicsRepair GmbH</p>",
  "<p>Victor-Slotosch-Straße 26</p>",
  "<p>60388 Frankfurt am Main</p>",
  "<p>Handelsregister: HRB 113954</p>",
  "<p>Registergericht: Registergericht Frankfurt</p>",
  "<p>Vertreten durch die Geschäftsführer: Heiko Hempe, Tim Hallas</p>",
  "</body></html>",
].join(""), "https://www.classics-repair.de/impressum/", { spletnaStran: "https://www.classics-repair.de/" });
var classicsOpenRegisterInput = handler._test.pripraviOpenRegisterVnosIzImpressuma(
  { spletnaStran: "https://www.classics-repair.de/" },
  classicsRepair
);
assert.strictEqual(classicsOpenRegisterInput.registerNumber, "HRB 113954",
  "koherentni GmbH Impressum mora registrsko številko predati istemu OpenRegister klicu");
assert.match(handler._test.sestaviOpenRegisterIskalniUrl(classicsOpenRegisterInput).toString(),
  /register_number=113954&register_type=HRB/,
  "AM ClassicsRepair GmbH se mora iskati po močnem HRB ključu, ne samo po imenu");
var openregisterFlowStart = source.indexOf("var openregisterOsnovniVnos");
var openregisterFlow = source.slice(
  openregisterFlowStart,
  source.indexOf("var identiteta = sestaviIdentiteto", openregisterFlowStart)
);
assert.match(openregisterFlow, /pripraviHitriOpenRegisterVnosIzSpletneStrani/,
  "statična pravna identiteta mora biti pripravljena pred prvim OpenRegister klicem");
assert.match(openregisterFlow, /hitriSpletniKontekst\.openRegisterInput[\s\S]*openregisterOsnovniVnos = hitriSpletniKontekst\.openRegisterInput/,
  "samo dovolj zanesljiv pravni naziv URL-konteksta sme neposredno v OpenRegister");
assert.match(openregisterFlow, /else if \(openregisterOsnovniVnos\.ime\)[\s\S]*poisciOpenRegisterNajvecEnkrat\(openregisterOsnovniVnos,\s*\{\s*forceFresh:\s*surovoImeIskanje\s*\}\)/,
  "zanesljiv URL ali vneseni naziv mora uporabiti neposredno registrsko pot");
assert.doesNotMatch(openregisterFlow, /pridobiApifyImpressumProfil\(vnos\.spletnaStran\)/,
  "uporabniški tok ne sme sinhrono čakati Impressum actorja");
assert.match(openregisterFlow, /else if \(vnos\.spletnaStran\)[\s\S]*reason: "local_identity_not_available"[\s\S]*hitriSpletniKontekst\.publicProfile = await poisciVImpressumu\(vnos, ""\)/,
  "brez zanesljivega naziva mora lokalni parser hitro vrniti dokaz ali resničen not-found");
assert.doesNotMatch(openregisterFlow, /openregister\.status !== "found"[\s\S]*poisciOpenRegisterNajvecEnkrat/,
  "po OpenRegister missu ne sme obstajati drugi registrski klic");
assert.match(openregisterFlow, /zacniNorthDataPoOpenRegisterju\(openregister, zacasnaIdentiteta/,
  "oba North Data toka se morata začeti na eni točki takoj po OpenRegister odločitvi");
assert.match(source, /openRegisterInput = pripraviOpenRegisterVnosIzImpressuma\(vnos, subjekt\)/,
  "hitri pravni parser mora celoten koherentni registrski subjekt predati OpenRegisterju");
assert.match(queueSource, /verified-result-24h-register-anchored-legal-links-v10-impressum-settings/,
  "stari rezultat iskanja samo po imenu se po popravku ne sme vrniti iz 24-urnega cachea");

console.log("✓ URL ali Impressum kandidat gre v natanko en dovoljeni OpenRegister klic.");
