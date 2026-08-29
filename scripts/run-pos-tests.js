"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const scriptsDir = __dirname;
const tests = fs.readdirSync(scriptsDir)
  .filter((name) => /^test-pos-.*\.js$/.test(name) || name === "test-boniteta-offer-transfer.js")
  .sort();

if (!tests.length) {
  throw new Error("Nobena POS regresijska skripta ni bila najdena.");
}

for (const test of tests) {
  console.log("\n[POS] " + test);
  const result = spawnSync(process.execPath, [path.join(scriptsDir, test)], {
    cwd: path.resolve(scriptsDir, ".."),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log("\n[POS] test-vercel-function-budget.js");
const budget = spawnSync(process.execPath, [path.join(scriptsDir, "test-vercel-function-budget.js")], {
  cwd: path.resolve(scriptsDir, ".."),
  env: process.env,
  stdio: "inherit",
});
if (budget.error) throw budget.error;
if (budget.status !== 0) process.exit(budget.status || 1);

console.log("\nVsi POS regresijski testi in Vercel funkcijski proračun so uspešni.");
