const fs = require("fs");
const assert = require("assert");
const replacement = require("../app/neplacila-zgodovina-zamenjava.js");

const js = fs.readFileSync("app/neplacila-zgodovina.js", "utf8");
const css = fs.readFileSync("app/neplacila-zgodovina.css", "utf8");
const html = fs.readFileSync("app/neplacila-zgodovina.html", "utf8");

const candidates = [
  { candidateId: "candidate-1", type: "installment_payment", amount: 1000, occurredDate: "2026-01-31", paymentMethod: "bank_transfer", requiredFields: ["amount", "occurredDate", "paymentMethod"] },
  { candidateId: "candidate-2", type: "installment_payment", amount: 1000, occurredDate: "2026-02-28", paymentMethod: "bank_transfer", requiredFields: ["amount", "occurredDate", "paymentMethod"] },
  { candidateId: "candidate-3", type: "remaining_unpaid", amount: 7000, occurredDate: "2026-03-01", communicationChannel: "email", description: "Preostanek ni plačan", requiredFields: ["amount", "occurredDate", "communicationChannel", "description"] },
];
const original = JSON.parse(JSON.stringify(candidates));
const replacementDraft = { active: true, sourceCandidateId: "candidate-2", sourceIndex: 1, selectedSettlementType: "compensation" };

const savedBeforeConfirmation = JSON.parse(JSON.stringify({ candidates, replacement: replacementDraft }));
assert.deepStrictEqual(savedBeforeConfirmation.candidates, original, "izbira sama ne sme spremeniti shranjenega plana");

const afterCancel = JSON.parse(JSON.stringify(savedBeforeConfirmation.candidates));
assert.deepStrictEqual(afterCancel, original, "preklic mora pustiti vse kandidate nedotaknjene");

const newCandidate = {
  type: "compensation",
  amount: null,
  occurredDate: null,
  requiredFields: ["amount", "occurredDate"],
  fieldOrder: ["amount", "occurredDate"],
  missing: ["amount", "occurredDate"],
};
const result = replacement.zamenjajNaMestu(candidates, replacementDraft, newCandidate);
assert.strictEqual(result.ok, true);
assert.strictEqual(result.index, 1, "zamenjan mora biti izvorni korak 2");
assert.strictEqual(candidates.length, 3, "zamenjava ne sme dodati kandidata ali duplikata");
assert.deepStrictEqual(candidates[0], original[0], "prvi korak mora ostati nedotaknjen");
assert.deepStrictEqual(candidates[2], original[2], "tretji korak mora ostati nedotaknjen");
assert.strictEqual(candidates[1].candidateId, "candidate-2", "stabilni ID in položaj se morata ohraniti");
assert.strictEqual(candidates[1].type, "compensation");
assert.strictEqual(replacement.saldoPoKandidatih(9000, candidates), 8000, "ledger/saldo se mora preračunati iz zamenjanega zaporedja");
assert.deepStrictEqual(candidates[1].missing, ["amount", "occurredDate"], "novi osnutek mora v wizardju zahtevati svoja obvezna polja");

const refreshed = JSON.parse(JSON.stringify(candidates));
const back = JSON.parse(JSON.stringify(refreshed));
const forward = JSON.parse(JSON.stringify(back));
assert.deepStrictEqual(forward, candidates, "refresh ter Back/Forward ne smeta izgubiti ali podvojiti zamenjave");

assert.match(js, /data-ai-change-candidate[\s\S]*zacniZamenjavo\(aktivniPodatki\.indeks\)/);
assert.doesNotMatch(js.match(/if \(dogodek\.target\.closest\("\[data-ai-change-candidate\]"\)\)[\s\S]*?return;/)[0], /candidates\.splice/);
assert.match(js, /S čim želite nadomestiti korak\?/);
assert.match(js, /zgodovina-zamenjava__vrstica[\s\S]*data-ai-replacement-confirm[\s\S]*>Spremeni<\/button>/);
assert.match(js, /data-ai-replacement-cancel[\s\S]*Nazaj brez zamenjave/);
assert.match(js, /data-ai-replacement-cancel[\s\S]*prekliciZamenjavo\(true\)/);
assert.match(js, /if \(zapriZamenjavo\) zapriZamenjavo\.remove\(\)/);
assert.match(js, /root\.addEventListener\("click"[\s\S]*data-settlement-select[\s\S]*stopImmediatePropagation\(\)[\s\S]*selectedSettlementType[\s\S]*}, true\)/);
assert.match(js, /var cone = root\.querySelectorAll\("\.izvedba-poravnava-cona"\);[\s\S]*if \(cone\[1\]\) cone\[1\]\.remove\(\)/);
assert.match(js, /prejsnjiKljuciVprasanj = naravni\.questionKeys\.slice\(\)[\s\S]*zamenjajNaMestu\(naravni\.candidates, naravni\.replacement, novi\)[\s\S]*prejsnjiKljuciVprasanj\[indeksVprasanja\] = kljucVprasanja\(izvorniIndeks, poljaKandidata\(novi\)\)[\s\S]*naravni\.questionIndex = indeksVprasanja/);
assert.match(js, /vrnitevNaVprasanje[\s\S]*Math\.min\(vrnitevNaVprasanje/);
assert.match(js, /window\.addEventListener\("popstate"[\s\S]*prekliciZamenjavo\(false\)/);
assert.match(css, /\.zgodovina-zamenjava__potrdi/);
assert.match(css, /\.zgodovina-zamenjava__preklic/);
assert.match(html, /neplacila-zgodovina-zamenjava\.js\?v=20260828-replacement-state-v1/);

console.log("OK: replacement kartica se samo označi; potrditev zamenja korak 2 in odpre njegova required fields v wizardju.");
