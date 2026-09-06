"use strict";

var assert = require("node:assert");
var fs = require("node:fs");
var path = require("node:path");

var source = fs.readFileSync(path.join(__dirname, "..", "api", "_handlers", "mehka-boniteta.js"), "utf8");
var core = source.slice(source.indexOf("async function poisciVImpressumuJedro"), source.indexOf("function frankfurtskaPosta"));

assert.match(core, /poisciLokalniJavniImpressum\(osnova, vnos, pravniKontekst, prednostniUrl\)/,
  "OpenRegister miss mora uporabljati eno omejeno neposredno pot do dejanskega Impressuma");
assert.doesNotMatch(source, /scrapling-impressum-client|boniteta-impressum-collector|poisciImpressumSCrawlerjemNajprej|poisciImpressumSScrapling/,
  "stari crawler in Scrapling veji morata biti odstranjeni iz identitetnega handlerja");
assert.doesNotMatch(core, /poisciImpressumZBrskalnikom|prviVeljavniVzporedniRezultat/,
  "kritična pot ne sme čakati brskalniškega ali vzporednega fallback drevesa");
assert.match(source, /obiskani\.size < 4[\s\S]*?fetchJavniHtml\(cilj, \{ maxAttempts: 2 \}\)/,
  "neposredni javni tok mora ostati omejen na štiri URL-je in en varen ponovni poskus na URL");

console.log("✓ linearni Impressum tok nima več crawler/Scrapling/browser fan-outa");
