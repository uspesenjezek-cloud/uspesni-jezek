"use strict";

var assert = require("assert");
var projectMonitor = require("../api/_lib/projektno-spremljanje");
var compare = projectMonitor._test.monitoringComparison;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function remove(object, key) { delete object[key]; return object; }

var BASE = {
  monitoringBaselineVersion: 2,
  checkedAt: "2026-08-26T10:00:00.000Z",
  identity: {
    companyId: "DE-HRB-M1201-100",
    registerNumber: "HRB 100",
    naziv: "Müller Bau GmbH & Co. KG",
    active: true,
    naslov: "Musterstraße 1a",
    postnaStevilka: "10115",
    kraj: "Berlin",
    website: "https://www.mueller-bau.de/",
    email: "Info@Mueller-Bau.de",
    phone: "+49 (0)30 123-456",
  },
  insolvency: { status: "clear" },
};

function next(change, previous) {
  var value = clone(previous || BASE);
  value.checkedAt = "2026-08-27T10:00:00.000Z";
  if (change) change(value);
  return value;
}

function previous(change) {
  var value = clone(BASE);
  if (change) change(value);
  return value;
}

var cases = [];
function state(name, expected, change, previousValue, keys) {
  cases.push({ name: name, expected: expected, previous: previousValue || clone(BASE), current: next(change, previousValue || BASE), keys: keys || [] });
}
function rejected(name, code, change, previousValue) {
  cases.push({ name: name, error: code, previous: previousValue || clone(BASE), current: next(change, previousValue || BASE) });
}

state("enako poročilo", "no_change");
state("ime – velike črke in presledki", "no_change", function (v) { v.identity.naziv = "  MÜLLER   BAU GMBH & CO. KG "; });
state("ime – nemški prepis in veznik", "no_change", function (v) { v.identity.naziv = "Mueller Bau GmbH und Co KG"; });
state("ulica – Str. in ločen dodatek", "no_change", function (v) { v.identity.naslov = "Musterstr. 1 a"; });
state("ulica – naslov vsebuje pošto in kraj", "no_change", function (v) { v.identity.naslov = "Musterstraße 1a, 10115 Berlin"; });
state("splet – druga shema", "no_change", function (v) { v.identity.website = "http://mueller-bau.de"; });
state("splet – brez www", "no_change", function (v) { v.identity.website = "https://mueller-bau.de/"; });
state("splet – pot, query in fragment", "no_change", function (v) { v.identity.website = "https://www.mueller-bau.de/kontakt?ref=monitor#top"; });
state("telefon – mednarodna predpona 00", "no_change", function (v) { v.identity.phone = "0049 30 123456"; });
state("telefon – samo drugačna ločila", "no_change", function (v) { v.identity.phone = "+49 30 123 456"; });
state("telefon – opcijska domača ničla", "no_change", function (v) { v.identity.phone = "+49 (0)30 / 123-456"; });
state("e-pošta – velike črke", "no_change", function (v) { v.identity.email = "INFO@MUELLER-BAU.DE"; });
state("e-pošta – mailto", "no_change", function (v) { v.identity.email = "mailto:info@mueller-bau.de"; });
state("varna insolvenčna sopomenka", "no_change", function (v) { v.insolvency.status = "not_found"; });
state("uradni clear preglasi tehnični možni zadetek", "no_change", function (v) { v.insolvency = { status: "possible_match", officialVerification: { status: "clear", checkedAt: v.checkedAt } }; });
state("ista pošta prepreči lažen alarm zaradi okrožja", "no_change", function (v) { v.identity.kraj = "Berlin-Mitte"; });
state("nov vir izpusti spletno stran", "no_change", function (v) { v.identity.website = ""; });
state("nov vir izpusti e-pošto", "no_change", function (v) { v.identity.email = ""; });
state("nov vir izpusti telefon", "no_change", function (v) { v.identity.phone = ""; });
state("spletna stran pride iz publicProfile", "no_change", function (v) { v.identity.website = ""; v.publicProfile = { website: "https://mueller-bau.de" }; });
state("telefon pride iz North Data", "no_change", function (v) { v.identity.phone = ""; v.northData = { company: { phone: "0049 30 123456" } }; });
state("company id – drugačna ločila", "no_change", function (v) { v.identity.companyId = "DE HRB M1201 100"; });
state("register – drugačna ločila", "no_change", function (v) { v.identity.registerNumber = "HRB-100"; });
state("company id manjka, register se ujema", "no_change", function (v) { delete v.identity.companyId; });
state("oba id-ja manjkata, celoten odtis se ujema", "no_change", function (v) { delete v.identity.companyId; delete v.identity.registerNumber; });
state("nevarno ostane nevarno – found v match", "no_change", function (v) { v.insolvency.status = "match"; }, previous(function (v) { v.insolvency.status = "found"; }));
state("nevarno ostane nevarno – possible v warning", "no_change", function (v) { v.insolvency.status = "warning"; }, previous(function (v) { v.insolvency.status = "possible_match"; }));
state("stara delna osnova ne sproži alarma ob dopolnitvi", "no_change", null, { checkedAt: BASE.checkedAt, identity: { companyId: BASE.identity.companyId, registerNumber: BASE.identity.registerNumber }, insolvency: { status: "clear" } });
state("prazen uradni status uporabi končni status poročila", "no_change", function (v) { v.insolvency.officialVerification = { status: "", checkedAt: v.checkedAt }; });
state("identifikatorji niso občutljivi na zapis", "no_change", function (v) { v.identity.companyId = "de_hrb_m1201_100"; v.identity.registerNumber = "hrb.100"; });

state("dejanska sprememba pravnega imena", "minor", function (v) { v.identity.naziv = "Müller Hochbau GmbH & Co. KG"; }, null, ["name"]);
state("sprememba hišne številke", "minor", function (v) { v.identity.naslov = "Musterstraße 2"; }, null, ["street"]);
state("selitev v drugo pošto in kraj", "minor", function (v) { v.identity.postnaStevilka = "10117"; v.identity.kraj = "Potsdam"; }, null, ["postalCode", "city"]);
state("nova domena", "minor", function (v) { v.identity.website = "https://mueller-hochbau.de"; }, null, ["website"]);
state("nova e-pošta", "minor", function (v) { v.identity.email = "kontakt@mueller-bau.de"; }, null, ["email"]);
state("nova telefonska številka", "minor", function (v) { v.identity.phone = "+49 30 123-999"; }, null, ["phone"]);
state("ponovna aktivacija", "minor", function (v) { v.identity.active = true; }, previous(function (v) { v.identity.active = false; }), ["active"]);
state("prvi potrjeni aktivni status", "minor", function (v) { v.identity.active = true; }, previous(function (v) { v.identity.active = null; }), ["active"]);
state("prva spletna stran", "minor", function (v) { v.identity.website = "https://mueller-bau.de"; }, previous(function (v) { v.identity.website = ""; }), ["website"]);
state("prva e-pošta", "minor", function (v) { v.identity.email = "info@mueller-bau.de"; }, previous(function (v) { v.identity.email = ""; }), ["email"]);
state("prvi telefon", "minor", function (v) { v.identity.phone = "+49 30 123456"; }, previous(function (v) { v.identity.phone = ""; }), ["phone"]);
state("insolvenčna posebnost je uradno odpravljena", "minor", function (v) { v.insolvency.status = "clear"; }, previous(function (v) { v.insolvency.status = "found"; }), ["insolvency"]);
state("uradni clear odpravi prejšnji možni zadetek", "minor", function (v) { v.insolvency = { status: "possible_match", officialVerification: { status: "clear", checkedAt: v.checkedAt } }; }, previous(function (v) { v.insolvency.status = "possible_match"; }), ["insolvency"]);
state("tri kontaktne spremembe", "minor", function (v) { v.identity.website = "https://novo.de"; v.identity.email = "novo@novo.de"; v.identity.phone = "+49 40 900"; }, null, ["website", "email", "phone"]);
state("naslov in telefon", "minor", function (v) { v.identity.naslov = "Musterstraße 3"; v.identity.phone = "+49 30 888"; }, null, ["street", "phone"]);
state("nova domena iz North Data", "minor", function (v) { v.identity.website = ""; v.northData = { company: { website: "https://nova-domena.de" } }; }, null, ["website"]);
state("novo ime iz javnega profila ob istem registru", "minor", function (v) { v.identity.naziv = ""; v.publicProfile = { legalName: "Müller Projektbau GmbH" }; }, null, ["name"]);

state("nova insolvenčna objava found", "danger", function (v) { v.insolvency.status = "found"; }, null, ["insolvency"]);
state("nov possible_match", "danger", function (v) { v.insolvency.status = "possible_match"; }, previous(function (v) { v.insolvency.status = "not_found"; }), ["insolvency"]);
state("uradni confirmed_match preglasi tehnični clear", "danger", function (v) { v.insolvency = { status: "clear", officialVerification: { status: "confirmed_match", checkedAt: v.checkedAt } }; }, null, ["insolvency"]);
state("podjetje postane neaktivno", "danger", function (v) { v.identity.active = false; }, null, ["active"]);
state("prvi status je neaktiven", "danger", function (v) { v.identity.active = false; }, previous(function (v) { v.identity.active = null; }), ["active"]);
state("neaktivnost in insolvenčna objava", "danger", function (v) { v.identity.active = false; v.insolvency.status = "found"; }, null, ["active", "insolvency"]);
state("nov warning", "danger", function (v) { v.insolvency.status = "warning"; }, null, ["insolvency"]);
state("nov match", "danger", function (v) { v.insolvency.status = "match"; }, null, ["insolvency"]);
state("pomembna in kontaktna sprememba skupaj", "danger", function (v) { v.insolvency.status = "possible_match"; v.identity.phone = "+49 30 777"; }, null, ["insolvency", "phone"]);
state("pomembna sprememba ob novem imenu", "danger", function (v) { v.insolvency.status = "found"; v.identity.naziv = "Müller Projektbau GmbH"; }, null, ["insolvency", "name"]);

rejected("drug company id", "MONITORING_IDENTITY_MISMATCH", function (v) { v.identity.companyId = "DE-HRB-X-999"; });
rejected("druga registrska številka", "MONITORING_IDENTITY_MISMATCH", function (v) { v.identity.registerNumber = "HRB 999"; });
rejected("oba stabilna identifikatorja sta druga", "MONITORING_IDENTITY_MISMATCH", function (v) { v.identity.companyId = "DE-HRB-X-999"; v.identity.registerNumber = "HRB 999"; });
rejected("brez id-ja in z drugim imenom", "MONITORING_IDENTITY_UNVERIFIED", function (v) { delete v.identity.companyId; delete v.identity.registerNumber; v.identity.naziv = "Drugo podjetje GmbH"; });
rejected("brez id-ja in z drugim naslovom", "MONITORING_IDENTITY_UNVERIFIED", function (v) { delete v.identity.companyId; delete v.identity.registerNumber; v.identity.naslov = "Druga Straße 9"; });
rejected("manjka pravno ime", "MONITORING_IDENTITY_INCOMPLETE", function (v) { delete v.identity.naziv; });
rejected("manjka ulica", "MONITORING_IDENTITY_INCOMPLETE", function (v) { delete v.identity.naslov; });
rejected("manjka poštna številka", "MONITORING_IDENTITY_INCOMPLETE", function (v) { delete v.identity.postnaStevilka; });
rejected("manjka kraj", "MONITORING_IDENTITY_INCOMPLETE", function (v) { delete v.identity.kraj; });
rejected("manjka insolvenčni rezultat", "MONITORING_REPORT_INCOMPLETE", function (v) { delete v.insolvency; });
rejected("insolvenčni vir unavailable", "MONITORING_REPORT_INCOMPLETE", function (v) { v.insolvency.status = "unavailable"; });
rejected("uradni vir unavailable", "MONITORING_REPORT_INCOMPLETE", function (v) { v.insolvency.officialVerification = { status: "unavailable", checkedAt: v.checkedAt }; });
rejected("starejše poročilo", "MONITORING_STALE_REPORT", function (v) { v.checkedAt = "2026-08-25T10:00:00.000Z"; });
rejected("isti čas kot osnova", "MONITORING_STALE_REPORT", function (v) { v.checkedAt = BASE.checkedAt; });
rejected("manjka čas poročila", "MONITORING_REPORT_TIME_REQUIRED", function (v) { delete v.checkedAt; });
rejected("neveljaven čas poročila", "MONITORING_REPORT_TIME_REQUIRED", function (v) { v.checkedAt = "ni-datum"; });
rejected("prazen rezultat", "MONITORING_IDENTITY_UNVERIFIED", function (v) { Object.keys(v).forEach(function (key) { delete v[key]; }); });

state("Unicode nedeljivi presledki", "no_change", function (v) { v.identity.naziv = "Müller\u00a0Bau\u00a0GmbH & Co. KG"; });
state("pikčasti zapis G.m.b.H.", "no_change", function (v) { v.identity.naziv = "Müller Bau G.m.b.H. & Co. K.G."; });
state("pikčasti zapis e.K.", "no_change", function (v) { v.identity.naziv = "Mueller Handel e K"; }, previous(function (v) { v.identity.naziv = "Müller Handel e.K."; }));
state("ulica s prepisom Strasse", "no_change", function (v) { v.identity.naslov = "Musterstrasse 1a"; });
state("pošta s predpono države", "no_change", function (v) { v.identity.postnaStevilka = "DE-10115"; });
state("IDN in punycode sta ista domena", "no_change", function (v) { v.identity.website = "https://xn--mller-bau-q9a.de"; }, previous(function (v) { v.identity.website = "https://müller-bau.de"; }));
state("privzeta vrata HTTPS", "no_change", function (v) { v.identity.website = "https://mueller-bau.de:443"; });
state("e-pošta z opisnim imenom", "no_change", function (v) { v.identity.email = "Müller Bau <info@mueller-bau.de>"; });
state("nemška lokalna in mednarodna številka", "no_change", function (v) { v.identity.phone = "030 123456"; });
state("enaka telefonska interna številka", "no_change", function (v) { v.identity.phone = "+49 30 123456 Durchwahl 77"; }, previous(function (v) { v.identity.phone = "+49 30 123456 ext. 77"; }));
state("uradni not_found preglasi tehnični možni zadetek", "no_change", function (v) { v.insolvency = { status: "possible_match", officialVerification: { status: "not_found", checkedAt: v.checkedAt } }; });
state("uradni no_match preglasi tehnični found", "no_change", function (v) { v.insolvency = { status: "found", officialVerification: { status: "no_match", checkedAt: v.checkedAt } }; });
state("preverjena identiteta ima prednost pred publicProfile", "no_change", function (v) { v.publicProfile = { legalName: "Napačno pomožno ime AG", website: "https://pomozno.example" }; });
state("preverjena identiteta ima prednost pred North Data", "no_change", function (v) { v.northData = { company: { name: "Drugo ime AG", street: "Druga 9", website: "https://drugo.example", phone: "+49 40 999" } }; });
state("nepovezana dodatna polja so prezrta", "no_change", function (v) { v.randomProviderPayload = { score: 1 }; v.identity.unrelated = "novo"; });
state("vhodni monitoringCardState ne vpliva na engine", "no_change", function (v) { v.monitoringCardState = { type: "danger", changes: [{ key: "fake" }] }; });
state("časovni pas pravilno določi novejše poročilo", "no_change", function (v) { v.checkedAt = "2026-08-27T12:00:00+02:00"; });
state("čas poročila se vzame iz uradnega insolvenčnega dokaza", "no_change", function (v) { delete v.checkedAt; v.insolvency.officialVerification = { status: "clear", checkedAt: "2026-08-27T10:00:00.000Z" }; });
state("čas poročila se vzame iz insolvenčnega rezultata", "no_change", function (v) { delete v.checkedAt; v.insolvency.checkedAt = "2026-08-27T10:00:00.000Z"; });
state("resnično spremenjena lokalna telefonska številka", "minor", function (v) { v.identity.phone = "030 999999"; }, null, ["phone"]);
state("spremenjena interna telefonska številka", "minor", function (v) { v.identity.phone = "+49 30 123456 ext. 88"; }, previous(function (v) { v.identity.phone = "+49 30 123456 ext. 77"; }), ["phone"]);
state("nova spletna poddomena", "minor", function (v) { v.identity.website = "https://portal.mueller-bau.de"; }, null, ["website"]);
state("uradni found je pomembna sprememba", "danger", function (v) { v.insolvency = { status: "clear", officialVerification: { status: "found", checkedAt: v.checkedAt } }; }, null, ["insolvency"]);
rejected("osnova brez časa", "MONITORING_BASELINE_TIME_REQUIRED", null, previous(function (v) { delete v.checkedAt; }));
rejected("osnova brez insolvenčnega zaključka", "MONITORING_BASELINE_INCOMPLETE", null, previous(function (v) { delete v.insolvency; }));
rejected("osnova brez popolne identitete", "MONITORING_BASELINE_IDENTITY_INCOMPLETE", null, previous(function (v) { delete v.identity.naslov; }));

assert.strictEqual(cases.length, 100, "Matrika mora vsebovati točno 100 različnih primerov.");
var oldFetch = global.fetch;
global.fetch = function () { throw new Error("Primerjalni engine ne sme klicati omrežja."); };
try {
  cases.forEach(function (testCase) {
    if (testCase.error) {
      assert.throws(function () { compare(testCase.previous, testCase.current); }, function (error) {
        return error && error.code === testCase.error;
      }, testCase.name + " mora biti varno zavrnjen z " + testCase.error);
      return;
    }
    var result = compare(testCase.previous, testCase.current);
    assert.strictEqual(result.type, testCase.expected, testCase.name);
    assert.strictEqual(result.comparisonBasis, "stored_report_to_current_report", testCase.name + " mora primerjati samo dve poročili");
    assert.deepStrictEqual(result.changes.map(function (change) { return change.key; }), testCase.keys, testCase.name + " ima napačen seznam sprememb");
  });
} finally {
  global.fetch = oldFetch;
}

var sourceResult = compare(BASE, next(function (v) { v.identity.website = ""; v.northData = { company: { website: "https://nova-domena.de" } }; }));
assert.deepStrictEqual(sourceResult.changeSources.website, { before: "identity", after: "northData" }, "Engine mora ohraniti sled vira posamezne primerjane vrednosti.");
assert.doesNotMatch(compare.toString(), /fetch\s*\(|https?:|store\.|db\./, "Jedro primerjave ne sme iskati podatkov zunaj podanih poročil.");
var immutableBefore = clone(BASE), immutableAfter = next(function (v) { v.identity.phone = "+49 30 999"; }), beforeJson = JSON.stringify(immutableBefore), afterJson = JSON.stringify(immutableAfter);
var deterministicOne = compare(immutableBefore, immutableAfter), deterministicTwo = compare(immutableBefore, immutableAfter);
assert.strictEqual(JSON.stringify(immutableBefore), beforeJson, "Engine ne sme spreminjati shranjene osnove.");
assert.strictEqual(JSON.stringify(immutableAfter), afterJson, "Engine ne sme spreminjati novega poročila.");
assert.deepStrictEqual(deterministicOne, deterministicTwo, "Enaka vhoda morata vedno vrniti popolnoma enak rezultat.");

console.log("Monitoring comparison engine: " + cases.length + " primerov OK");
