"use strict";

const assert = require("node:assert");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const generator = require(path.join(repoRoot, "api", "_lib", "pos-xrechnung"));
const { validateWithKosit } = require(path.join(repoRoot, "api", "pos-racun-xrechnung"))._test;
const { invoice } = require(path.join(repoRoot, "scripts", "test-pos-xrechnung"));

async function main() {
  const env = {
    KOSIT_VALIDATOR_URL: process.env.KOSIT_VALIDATOR_URL,
    KOSIT_VALIDATOR_TOKEN: process.env.KOSIT_VALIDATOR_TOKEN
  };
  assert.ok(env.KOSIT_VALIDATOR_URL, "KOSIT_VALIDATOR_URL manjka");
  assert.ok(String(env.KOSIT_VALIDATOR_TOKEN || "").length >= 32, "KOSIT_VALIDATOR_TOKEN manjka");

  const validXml = generator.buildXRechnung(invoice());
  const invalidXml = Buffer.from(validXml.toString("utf8").replace(
    '<cbc:PayableAmount currencyID="EUR">238.00</cbc:PayableAmount>',
    '<cbc:PayableAmount currencyID="EUR">999.00</cbc:PayableAmount>'
  ), "utf8");

  const accepted = await validateWithKosit(validXml, "live-valid.xml", env);
  const rejected = await validateWithKosit(invalidXml, "live-invalid.xml", env);
  assert.strictEqual(accepted.status, "validated", "KoSIT ni sprejel veljavnega XRechnung dokumenta");
  assert.strictEqual(rejected.status, "failed", "KoSIT ni zavrnil pokvarjenega XRechnung dokumenta");
  assert.strictEqual(accepted.report.httpStatus, 200);
  assert.strictEqual(rejected.report.httpStatus, 406);
  console.log("KoSIT live: veljaven XRechnung sprejet (200), neveljaven zavrnjen (406).");
}

main().catch((error) => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
