"use strict";

const readiness = require("../api/_lib/pos-production-readiness");

const report = readiness.assess(process.env);
const jsonOutput = process.argv.includes("--json");
const strict = process.argv.includes("--strict");

if (jsonOutput) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} else {
  console.log("Nemški POS — produkcijska pripravljenost");
  console.log(report.summary.blockingReady + "/" + report.summary.blockingTotal + " obveznih kontrol pripravljenih");
  report.checks.forEach((check) => {
    const mark = check.ready ? "OK" : check.blocking ? "BLOCK" : "INFO";
    console.log("[" + mark + "] " + check.id + " — " + check.status);
    if (check.missing.length) console.log("       manjka: " + check.missing.join(", "));
  });
  console.log(report.ready ? "REZULTAT: pripravljeno za produkcijski zagon" : "REZULTAT: produkcijski zagon ostaja varno blokiran");
}

if (strict && !report.ready) process.exitCode = 1;
