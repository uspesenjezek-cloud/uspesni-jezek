"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var source = fs.readFileSync(path.join(__dirname, "..", "supabase", "functions", "openregister-webhook", "index.ts"), "utf8");
var gateAt = source.indexOf("monitoringWindowAllows(monitor, occurredOn)");
var alertInsertAt = source.indexOf("/rest/v1/boniteta_opozorila", gateAt);

assert.match(source, /\[event\.occurred_at, event\.created_at\]/);
assert.match(source, /if \(!Number\.isNaN\(parsed\.getTime\(\)\)\) return parsed\.toISOString\(\)/);
assert.match(source, /return new Date\(\)\.toISOString\(\)/);
assert.match(source, /monitor\.openregister_payload\?\.monitoringSchedule/);
assert.match(source, /date >= start && date <= end/);
assert.ok(gateAt > 0 && alertInsertAt > gateAt, "opozorilo mora biti filtrirano pred vstavljanjem v bazo");
assert.match(source, /if \(!schedule\) return true/);
assert.match(source, /if \(!validIsoDate\(start\) \|\| !validIsoDate\(end\)\) return false/);

console.log("OpenRegister monitoring window: OK");
