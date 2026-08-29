"use strict";

var assert = require("node:assert");
var fs = require("node:fs");
var path = require("node:path");
var parser = require("../api/_lib/zgodovina-naravni-vnos.js");

var context = { referenceDate: "2026-08-27", originalDebt: 9446, remainingDebt: 9446 };
var cases = [];

function add(category, expected, texts) {
  texts.forEach(function (text) { cases.push({ category: category, expected: expected, text: text }); });
}

add("delno plačilo", ["partial_payment"], [
  "Danes mi je nakazal 300 evrov.",
  "včeraj je poravnal 450 EUR prek banke",
  "Plačal je 1.200 €, ostalo še urejava.",
  "evo dolžnik je dal 250 eur v gotovini danes",
  "Prejel sem nakazilo 99,90 evra včeraj.",
  "poravnal je 25 odstotkov dolga",
  "danes placal polovico dolga na roke",
]);

add("delno plačilo in preostanek", ["partial_payment", "remaining_unpaid"], [
  "Plačal je samo 3000 evrov.",
  "dal je le 500 EUR, preostanka še ni poravnal",
  "včeraj nakazal zgolj 200 eur in potem nič več",
]);

add("plačano v celoti", ["paid_in_full"], [
  "Danes je plačal vse z nakazilom.",
  "račun je bil v celoti poravnan včeraj prek banke",
  "poravnal je celoten dolg danes",
  "končno je plačala ves preostanek z gotovino",
  "vse je nakazal predvčerajšnjim",
  "celotni dolg je poravnan, plačal je s kartico danes",
  "danes je račun v celoti plačan",
  "je plačal vse na roke včeraj",
  "končni znesek je poravnal danes z nakazilom",
  "ves preostanek je danes plačala prek banke",
]);

add("plačan obrok", ["installment_payment"], [
  "Danes je plačal en obrok 200 EUR z nakazilom.",
  "včeraj poravnal obrok 350 evrov v gotovini",
  "plačala je 2 obroka po 150 EUR danes",
  "danes je nakazal tri obroke skupaj 600 evrov",
  "prvi obrok 500 eur je plačal včeraj s kartico",
  "poravnan je en obrok v višini 100 EUR danes",
  "stranka je predvčerajšnjim plačala obrok 240 evrov na roke",
  "dva obroka 400 EUR je nakazal danes",
  "placal je obrok 90 eur danes preko banke",
  "včeraj je poravnala en obrok 1.000 € z nakazilom",
]);

add("neplačan obrok", ["unpaid_installment"], [
  "3. obrok še ni plačan.",
  "drugi obrok ni poravnan",
  "petega obroka še ni plačal",
  "1 obrok ni še plačan",
  "četrti obrok pa ni plačan",
  "deseti obrok ni poravnan",
  "7. obrok pa še ni poravnan",
  "prvi ni še plačan",
  "osmega obroka ni plačal",
  "šesti obrok še ni poravnan",
]);

add("obljuba plačila", ["payment_promise"], [
  "Po telefonu je obljubil, da bo plačal jutri.",
  "rekel je da bo poravnal pojutrišnjem",
  "v sms je napisal da nakaže čez 3 dni",
  "obljubila je plačilo do 30. 8.",
  "jutri bo plačal, tako je rekel po telefonu",
  "čez pet dni bo poravnal vse",
  "po emailu je obljubil plačilo 2026-09-02",
  "pravi da bo nakazal čez 10 dni",
  "najkasneje 5. 9. bo plačala",
  "v živo je povedal: plačam jutri",
]);

add("nov rok", ["deadline_extension"], [
  "Prosil je za nov rok plačila do 5. 9.",
  "odobril sem mu dodatni rok do 2026-09-10",
  "po telefonu je prosil za podaljšanje roka za 7 dni",
  "dogovorila sva se za prestavitev zapadlosti do 15. 9.",
  "stranka želi nov rok plačila, čez 14 dni",
  "zaprosila je za 10 dni dodatnega roka",
  "prestaviti moramo rok do 1. 10.",
  "dal sem mu dodatni rok, plača do 3. 9.",
  "po mailu prosi za podaljšanje roka do 12. 9.",
  "nov rok plačila naj bo 20. 9.",
]);

add("neuspešno plačilo", ["payment_failed"], [
  "Banka je zavrnila plačilo.",
  "nakazilo se je vrnilo včeraj",
  "kartica je zavrnila plačilo danes",
  "direktna obremenitev ni bila izvedena",
  "trajnik je banka stornirala",
  "plačilo je bilo vrnjeno na račun",
  "ček ni bil unovčen",
  "banka je vrnila denar in plačilo ni uspelo",
  "nakazilo včeraj ni bilo izvedeno",
  "kartično plačilo je bilo zavrnjeno",
]);

add("ugovor", ["invoice_dispute"], [
  "Dolžnik ugovarja računu po emailu.",
  "stranka je reklamirala opravljeno delo",
  "po telefonu pravi da je cena višja od ponudbe",
  "račun je zavrnil zaradi napačne količine",
  "zavrača del računa in želi pojasnilo",
  "poslal je ugovor po e-pošti",
  "izpodbija račun ker delo ni končano",
  "zahteva odpravo napak in zato zadržuje plačilo",
  "reklamacija računa je prišla danes po sms",
  "ostalemu znesku ugovarja po telefonu",
]);

add("insolventnost", ["insolvency"], [
  "Podjetje je v stečaju.",
  "danes sem izvedel za stečajni postopek",
  "dolžnik je plačilno nesposoben",
  "začela se je prisilna poravnava",
  "stranka je insolventna",
  "po telefonu so povedali da je podjetje v stečaju",
  "nad dolžnikom teče prisilna poravnava",
  "firma je očitno insolventna in ne more plačati",
  "objavljen je bil stečajni postopek včeraj",
  "dolžnik je postal plačilno nesposoben",
]);

add("drugi dogodki", ["credit_note"], [
  "Danes sem izdal dobropis za 200 EUR.",
  "dobropisna nota 150 evrov je bila izdana včeraj",
]);
add("drugi dogodki", ["compensation"], [
  "Dogovorili smo pobot v višini 500 EUR danes.",
  "včeraj smo naredili kompenzacijo za 300 evrov",
]);
add("drugi dogodki", ["cancelled_invoice"], [
  "Danes sem račun storniral.",
  "terjatev smo včeraj izrecno odpisali",
]);
add("drugi dogodki", ["debtor_statement"], [
  "Po telefonu je rekel, da ne bo plačal.",
  "dolžnica noče plačati in je to napisala po emailu",
]);
add("drugi dogodki", ["installment_agreement"], [
  "Dogovorila sva se za obročno plačilo.",
  "danes smo odobrili obročni načrt",
]);

assert.strictEqual(cases.length, 100, "Regresijski nabor mora vsebovati natanko 100 primerov.");

var uiSource = fs.readFileSync(path.join(__dirname, "../app/neplacila-zgodovina.js"), "utf8");
var failures = [];
var coverage = new Set();

cases.forEach(function (testCase, index) {
  var result = parser._test.deterministicResult(testCase.text, context);
  var actual = result && Array.isArray(result.candidates) ? result.candidates.map(function (candidate) { return candidate.type; }) : [];
  testCase.expected.forEach(function (type) {
    if (!actual.includes(type)) failures.push((index + 1) + ". [" + testCase.category + "] pričakovano " + type + ", dobljeno " + (actual.join(", ") || "nič") + ": " + testCase.text);
  });
  actual.forEach(function (type) {
    coverage.add(type);
    assert(parser.ALLOWED_TYPES.includes(type), "Nedovoljena vrsta dogodka: " + type);
    assert(new RegExp("\\b" + type + "\\s*:").test(uiSource), "Za " + type + " manjka KANDIDAT_META kartica.");
  });
});

if (failures.length) assert.fail("Napake v 100 pogovornih primerih:\n" + failures.join("\n"));

var requiredCardTypes = [
  "partial_payment", "paid_in_full", "installment_payment", "unpaid_installment", "remaining_unpaid",
  "installment_agreement", "payment_promise", "deadline_extension", "payment_failed", "invoice_dispute",
  "insolvency", "credit_note", "compensation", "cancelled_invoice", "debtor_statement",
];
requiredCardTypes.forEach(function (type) { assert(coverage.has(type), "Nabor ne pokrije kartice " + type + "."); });

console.log("✓ 100/100 pogovornih primerov; pokritih " + coverage.size + " vrst dejanskih kartic");
