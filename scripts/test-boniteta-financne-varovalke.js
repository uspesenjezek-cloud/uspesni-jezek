"use strict";

var assert = require("node:assert");
var guard = require("../app/bonitetna-finance-guard");

assert.strictEqual(guard._test.preveriVrednost({ year: 2024, value: 100 }, { items: {} }).vrednost, 100, "manjkajoča dopolnilna postavka ne sme postati ničla");

function primarno(vrednosti) {
  return { financials: [{ metric: "Total assets", values: vrednosti }] };
}

function podrobnosti(vrstice) {
  return { financials: vrstice.map(function (v) {
    return { fiscalYear: v.year, date: v.year + "-12-31", items: v.items };
  }) };
}

var arf = guard.uskladi(
  primarno([{ year: 2023, value: 69436.22 }, { year: 2024, value: 117255.6 }]),
  podrobnosti([{ year: 2024, items: { Liabilities: { value: 117255.6 }, Equity: { value: -62632.89 } } }])
);
assert.deepStrictEqual(arf.company.financials[0].values.map(function (v) { return v.year; }), [2023]);
assert.strictEqual(arf.issues[0].reason, "assets_equal_liabilities_with_nonzero_equity");
assert.strictEqual(arf.company.financialGuard.issues.length, 1, "UI mora prejeti pojasnilo o zavrnjeni vrednosti");

var veljavno = guard.uskladi(
  primarno([{ year: 2024, value: 200000 }]),
  podrobnosti([{ year: 2024, items: { Liabilities: { value: 120000 }, Equity: { value: 70000 }, Cash: { value: 30000 }, Receivables: { value: 40000 } } }])
);
assert.strictEqual(veljavno.company.financials[0].values[0].value, 200000);
assert.strictEqual(veljavno.changed, false);

var izrecno = guard.uskladi(
  primarno([{ year: 2024, value: 117255.6 }]),
  podrobnosti([{ year: 2024, items: { Liabilities: { value: 117255.6 }, Equity: { value: -62632.89 }, TotalAssets: { label: "Total assets", value: 54622.71 } } }])
);
assert.strictEqual(izrecno.company.financials[0].values[0].value, 54622.71);
assert.strictEqual(izrecno.company.financials[0].values[0].correctedByFinancialGuard, true);

var prenizko = guard.uskladi(
  primarno([{ year: 2024, value: 50000 }]),
  podrobnosti([{ year: 2024, items: { Cash: { value: 30000 }, Receivables: { value: 25000 } } }])
);
assert.strictEqual(prenizko.company.financials[0].values.length, 0);
assert.strictEqual(prenizko.issues[0].reason, "assets_below_known_asset_components");

var signali = require("../app/bonitetna-signali");
assert.ok(!signali.izpelji(arf.company).allSignals.some(function (signal) { return signal.id === "assets_change"; }), "zavrnjena bilančna vsota ne sme ustvariti napačnega signala");

console.log("✓ Finančne varovalke zavrnejo zamenjavo bilančne vsote z obveznostmi in ohranijo veljavne podatke.");
