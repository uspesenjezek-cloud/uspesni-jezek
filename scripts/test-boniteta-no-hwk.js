"use strict";

var assert = require("assert/strict");
var fs = require("fs");
var path = require("path");
var root = path.resolve(__dirname, "..");

[
  "api/_handlers/mehka-boniteta.js",
].forEach(function (file) {
  var source = fs.readFileSync(path.join(root, file), "utf8");
  var activeFlow = source.slice(source.indexOf("async function handler"), source.indexOf("handler._test"));
  assert.doesNotMatch(activeFlow, /\bhwk\b|handwerkskammer|handwerksrolle|kammerfinder|odav/i,
    file + " ne sme več uporabljati HWK v aktivnem toku");
  assert.doesNotMatch(activeFlow, /\bhwk\s*:/i,
    file + " ne sme vračati polja hwk");
  assert.match(activeFlow, /sestaviIdentiteto\(openregister, null, javniProfil, vnos\)/,
    file + " mora identiteto sestaviti samo iz registra ali Impressuma");
});

var ui = fs.readFileSync(path.join(root, "app", "bonitetna-preverba.js"), "utf8");
assert.doesNotMatch(ui, /Handwerkskammer|Handwerksrolle|Kammerfinder|ODAV/,
  "uporabniški vmesnik ne sme prikazovati HWK kot vira ali rezervne poti");

console.log("Boniteta brez HWK: OK");
