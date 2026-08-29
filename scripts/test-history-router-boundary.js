"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var source = fs.readFileSync(path.join(__dirname, "..", "api", "izvedi-opomin-ukrep.js"), "utf8");

assert.doesNotMatch(source, /req\.query/, "history-ai router ne sme sprožiti zastarelega Node url.parse() prek Vercel req.query");
assert.match(source, /new URL\(String\(\(req && req\.url\) \|\| ""\), "http:\/\/localhost"\)\.searchParams\.get\(ime\)/, "query se mora prebrati prek standardnega URL API-ja");
assert.match(source, /parameterPoti\(req, "handler"\) === "history-ai"/, "rewrite mora še vedno usmeriti zahtevo v Atenin history-ai handler");

console.log("✓ history-ai router: standardni URL API brez req.query");
