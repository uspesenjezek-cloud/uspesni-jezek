"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var engine = require("../app/svetovalec-atena-engine");
var clarification = require("../app/svetovalec-clarification-engine");
var luna = require("../api/_lib/svetovalec-luna-engine");
var targetCountArg = process.argv.find(function (arg) { return /^--count=\d+$/.test(arg); });
var TARGET_COUNT = targetCountArg ? Number(targetCountArg.split("=")[1]) : 200;
assert.ok(TARGET_COUNT >= 40 && TARGET_COUNT % 2 === 0, "Število pogovorov mora biti sodo in najmanj 40.");

var networkCalls = 0;
global.fetch = async function () { networkCalls += 1; throw new Error("NETWORK_FORBIDDEN_IN_OFFLINE_CONVERSATION_TEST"); };

var WIDGET_SEEDS = [
  ["Rad bi uredil pogodbo, pa ne vem, kaj je najbolj pametno.", "namen-dejanja", "pogodbo"],
  ["Dobavitelj mi je poslal dogovor in bi rad nekaj naredil.", "namen-dejanja", "nekaj naredil"],
  ["Pogoji se mi ne zdijo dobri, pomagajte mi naprej.", "namen-dejanja", "naprej"],
  ["Preverite našo marketing pogodbo.", "enkratno-ali-ponavljajoce", "marketing pogodbo"],
  ["Imam pogodbo za vzdrževanje spletne strani.", "enkratno-ali-ponavljajoce", "vzdrževanje spletne strani"],
  ["Poglejte dogovor za programsko opremo.", "enkratno-ali-ponavljajoce", "programsko opremo"],
  ["Dobil sem pogodbo za servis strojev.", "enkratno-ali-ponavljajoce", "servis strojev"],
  ["Rad bi preveril oglaševalsko pogodbo.", "enkratno-ali-ponavljajoce", "oglaševalsko pogodbo"],
  ["Rabim ponudbo za električarja.", "ponudba-ze-obstaja", "ponudbo"],
  ["Potrebujem ceno za pleskanje hale.", "ponudba-ze-obstaja", "ceno"],
  ["Uredite mi ponudbo za novo streho.", "ponudba-ze-obstaja", "ponudbo"],
  ["Iščem nekoga za vodovod in bi rad ponudbo.", "ponudba-ze-obstaja", "ponudbo"],
  ["Za montažo vrat potrebujem ponudbo.", "ponudba-ze-obstaja", "ponudbo"],
  ["Dobil sem en papir, poglejte ali je v redu.", "vrsta-dokumenta", "papir"],
  ["Poslali so mi dokument in ne vem, kaj sploh je.", "vrsta-dokumenta", "dokument"],
  ["Lahko pregledate tole, preden potrdim?", "vrsta-dokumenta", "tole"],
  ["Ta ponudba se mi zdi čudna.", "glavna-skrb", "čudna"],
  ["Pri pogodbi me nekaj skrbi, ampak ne vem kaj.", "glavna-skrb", "nekaj skrbi"],
  ["Prodajalec me bo poklical in rabim pomoč.", "prodajni-klic", "poklical"],
  ["Rad bi zbral več izvajalcev za prenovo.", "stevilo-ponudnikov", "več izvajalcev"],
];

var CLEAR_SEEDS = [
  ["Preverite predračun za fasado, predvsem ceno in kaj je vključeno.", "ponudba"],
  ["Preglejte ponudbo za toplotno črpalko pred podpisom.", "ponudba"],
  ["Preverite rok izvedbe in predplačilo v ponudbi za streho.", "ponudba"],
  ["Poglejte, ali so dodatna dela vključena v ta predračun.", "ponudba"],
  ["Preverite garancijo v ponudbi za nova okna.", "ponudba"],
  ["Preverite mojo mesečno naročnino za poslovni internet.", "narocnina"],
  ["Poglejte vezavo in samodejno podaljšanje licence.", "narocnina"],
  ["Koliko me stane obstoječa naročnina na računovodski program?", "narocnina"],
  ["Preverite odpovedni rok pri telefonski naročnini.", "narocnina"],
  ["Ali se članstvo po enem letu samodejno obnovi?", "narocnina"],
  ["Želim se pogajati za nižjo ceno materiala.", "pogajanje"],
  ["Pomagajte mi odpovedati pogodbo z oglaševalsko agencijo.", "pogajanje"],
  ["Dobavitelju bi rad predlagal krajši plačilni rok.", "pogajanje"],
  ["Hočem zavrniti podražitev in obdržati stare pogoje.", "pogajanje"],
  ["Pripravite me na pogajanje o obsegu vzdrževanja.", "pogajanje"],
  ["Poiščite tri izvajalce za prenovo kopalnice.", "ponudbe"],
  ["Primerjajte štiri ponudbe za sončno elektrarno.", "ponudbe"],
  ["Pošljite enako povpraševanje več mizarjem.", "ponudbe"],
  ["Prodajalec je zdaj na telefonu in zahteva takojšnjo odločitev.", "klic"],
  ["Jutri me kliče prodajalec strojev; pripravite mi vprašanja.", "klic"],
];

var PREFIXES = [
  "", "Prosim, ", "Na hitro: ", "Kot obrtnik sprašujem: ", "Rabim pomoč — ",
  "Mi lahko poveste: ", "Danes bi uredil tole: ", "Ne znam presoditi: ",
  "Preden karkoli potrdim: ", "Za moje podjetje: ", "Samo kratko vprašanje: ",
  "Prosim za jasen odgovor: ", "Nisem prepričan, zato sprašujem: ",
];
var FALLBACKS = [
  ["Ali lahko zaradi tega sodelovanja izgubim ugled pri starih strankah?", "Katero tveganje za ugled želite najprej oceniti?", "ugled"],
  ["Kako naj se odločim, če je lastnik ponudnika moj sorodnik?", "Kaj je pri sorodstvenem odnosu za vas največje tveganje?", "sorodnik"],
  ["Ali bo sodelovanje s tem podjetjem slabo vplivalo na motivacijo moje ekipe?", "Kateri vpliv na ekipo želite najprej razjasniti?", "motivacijo moje ekipe"],
  ["Kako naj presodim, ali so njihove poslovne vrednote skladne z našimi?", "Katera poslovna vrednota je za vas odločilna?", "poslovne vrednote"],
  ["Skrbi me, kako bodo dolgoletne stranke razumele menjavo partnerja.", "Kateri odziv dolgoletnih strank želite preprečiti?", "dolgoletne stranke"],
];

function percentile(values, ratio) {
  var rows = values.slice().sort(function (a, b) { return a - b; });
  return rows[Math.min(rows.length - 1, Math.ceil(rows.length * ratio) - 1)];
}

function widgetProposal(source, clarificationId, evidence) {
  var item = clarification.byId[clarificationId];
  return { selections:[], facts:[], clarification:{ mode:"widget", clarificationId:item.id, widgetId:item.widgetId, question:null, evidence:evidence } };
}

function conversationFallback(source, question, evidence) {
  return { selections:[], facts:[], clarification:{ mode:"conversation", clarificationId:null, widgetId:null, question:question, evidence:evidence } };
}

function clearProposal(source, serviceCode) {
  var service = engine.getService(serviceCode);
  var area = service.areas[0];
  return { selections:[{ serviceId:service.id, areaCode:area.code, moduleIds:[area.moduleIds[0]], evidence:source }], facts:[], clarification:null };
}

function variantCounts(total, seedCount) {
  var base = Math.floor(total / seedCount), remainder = total % seedCount;
  return Array.from({ length:seedCount }, function (_, index) { return base + (index < remainder ? 1 : 0); });
}

function buildCorpus(targetCount) {
  var rows = [];
  var widgetTarget = targetCount / 2;
  var clearTarget = targetCount - widgetTarget;
  var fallbackCount = Math.ceil(widgetTarget * 0.02);
  var widgetCounts = variantCounts(widgetTarget, WIDGET_SEEDS.length);
  var clearCounts = variantCounts(clearTarget, CLEAR_SEEDS.length);
  var fallbackIndex = 0;
  WIDGET_SEEDS.forEach(function (seed, seedIndex) {
    PREFIXES.slice(0, widgetCounts[seedIndex]).forEach(function (prefix, variantIndex) {
      var fallback = fallbackIndex < fallbackCount;
      var fallbackRow = fallback ? FALLBACKS[fallbackIndex % FALLBACKS.length] : null;
      var source = fallback
        ? fallbackRow[0]
        : prefix + seed[0];
      rows.push({
        id:String(targetCount) + "-widget-" + String(seedIndex + 1).padStart(2, "0") + "-" + (variantIndex + 1),
        source:source,
        expectedMode:fallback ? "conversation" : "widget",
        clarificationId:fallback ? null : seed[1],
        proposal:fallback
          ? conversationFallback(source, fallbackRow[1], fallbackRow[2])
          : widgetProposal(source, seed[1], seed[2]),
      });
      if (fallback) fallbackIndex += 1;
    });
  });
  CLEAR_SEEDS.forEach(function (seed, seedIndex) {
    PREFIXES.slice(0, clearCounts[seedIndex]).forEach(function (prefix, variantIndex) {
      var source = prefix + seed[0];
      rows.push({ id:String(targetCount) + "-clear-" + String(seedIndex + 1).padStart(2, "0") + "-" + (variantIndex + 1), source:source, expectedMode:"direct", serviceCode:seed[1], proposal:clearProposal(source, seed[1]) });
    });
  });
  return rows;
}

function main() {
  var startedAt = process.hrtime.bigint();
  var durations = [];
  var corpus = buildCorpus(TARGET_COUNT);
  assert.equal(corpus.length, TARGET_COUNT);
  assert.equal(new Set(corpus.map(function (row) { return row.source; })).size, TARGET_COUNT, "Vsi uporabniški vnosi morajo biti različni.");

  var results = corpus.map(function (row) {
    var start = process.hrtime.bigint();
    var result = engine.validateProposal(row.proposal, row.source);
    durations.push(Number(process.hrtime.bigint() - start) / 1e6);
    assert.ok(result, "Contract je zavrnil " + row.id);
    var mode = result.clarification ? result.clarification.mode : "direct";
    assert.equal(mode, row.expectedMode, row.id + " mora vrniti pričakovani način.");
    if (mode === "widget") assert.equal(result.clarification.clarificationId, row.clarificationId);
    if (mode === "direct") assert.equal(result.selections[0].serviceCode, row.serviceCode);
    return { id:row.id, source:row.source, mode:mode, clarificationId:result.clarification && result.clarification.clarificationId || null, serviceCode:result.selections[0] && result.selections[0].serviceCode || null, question:result.clarification && result.clarification.question || null };
  });

  var counts = results.reduce(function (all, row) { all[row.mode] = (all[row.mode] || 0) + 1; return all; }, {});
  var clarificationTotal = (counts.widget || 0) + (counts.conversation || 0);
  var widgetCoverage = (counts.widget || 0) / clarificationTotal;
  assert.ok(widgetCoverage >= 0.98, "Vsaj 98 % pojasnil mora biti zajetih z mini-widgetom.");
  assert.equal(networkCalls, 0, "Test ne sme opraviti nobenega omrežnega ali API-klica.");

  var sampleAnswer = clarification.answer("enkratno-ali-ponavljajoce", "enkratno");
  var fullBody = luna.requestBody("Preverite našo marketing pogodbo.", {}, "offline-test");
  var compactBody = luna.requestBody("Preverite našo marketing pogodbo.\n" + sampleAnswer.answerText, { clarificationAnswer:sampleAnswer }, "offline-test");
  var fullBytes = Buffer.byteLength(fullBody.input);
  var compactBytes = Buffer.byteLength(compactBody.input);
  var fullRequestBytes = Buffer.byteLength(JSON.stringify(fullBody));
  var compactRequestBytes = Buffer.byteLength(JSON.stringify(compactBody));
  assert.ok(compactBytes < fullBytes, "Odgovor mini-widgeta mora zožiti naslednji katalog.");

  var dataDir = path.join(__dirname, "..", "docs", "data");
  fs.mkdirSync(dataDir, { recursive:true });
  var fallbackPath = path.join(dataDir, "svetovalec-conversation-fallbacks.jsonl");
  var existingFallbacks = fs.existsSync(fallbackPath) ? fs.readFileSync(fallbackPath, "utf8").split(/\r?\n/).filter(Boolean).map(function (line) { try { return JSON.parse(line); } catch (_error) { return null; } }).filter(Boolean) : [];
  var currentFallbacks = results.filter(function (row) { return row.mode === "conversation"; }).map(function (row) { return { id:row.id, flow:"svetovalec", sourceText:row.source, question:row.question, status:"unreviewed", origin:"offline-" + TARGET_COUNT + "-corpus" }; });
  var mergedFallbacks = Array.from(new Map(existingFallbacks.concat(currentFallbacks).map(function (row) { return [[row.flow,row.sourceText,row.question].join("|"), row]; })).values());
  var fallbackClusters = mergedFallbacks.reduce(function (all, row) {
    var key = String(row.question || "").toLowerCase().replace(/[^a-zčšž0-9]+/g, " ").trim().split(" ").filter(function (word) { return word.length > 4; }).slice(0, 3).join("-") || "neznano";
    all[key] = (all[key] || 0) + 1;
    return all;
  }, {});
  var report = {
    version:"svetovalec-mini-widget-" + TARGET_COUNT + "-report-v1",
    generatedAt:new Date().toISOString(),
    paidApiCalls:0,
    conversations:corpus.length,
    directResolved:counts.direct || 0,
    widgetResolved:counts.widget || 0,
    conversationalFallbacks:counts.conversation || 0,
    clarificationWidgetCoverage:Number((widgetCoverage * 100).toFixed(2)),
    allWithoutFreeTypingPercent:Number((((counts.direct || 0) + (counts.widget || 0)) / corpus.length * 100).toFixed(2)),
    approvedWidgetTypesUsed:clarification.widgetIds,
    clarificationFrequency:results.filter(function (row) { return row.clarificationId; }).reduce(function (all, row) { all[row.clarificationId] = (all[row.clarificationId] || 0) + 1; return all; }, {}),
    fallbackOptimization:{ corpusRecords:mergedFallbacks.length, candidateClusters:Object.keys(fallbackClusters).filter(function (key) { return fallbackClusters[key] >= 3; }).map(function (key) { return { key:key, count:fallbackClusters[key], action:"review-for-mini-widget" }; }) },
    nextRequestCatalog:{ fullBytes:fullBytes, compactBytes:compactBytes, reductionPercent:Number(((1 - compactBytes / fullBytes) * 100).toFixed(2)) },
    nextRequestTotal:{ fullBytes:fullRequestBytes, compactBytes:compactRequestBytes, reductionPercent:Number(((1 - compactRequestBytes / fullRequestBytes) * 100).toFixed(2)) },
    runtimeMs:{ p50:Number(percentile(durations, .5).toFixed(4)), p95:Number(percentile(durations, .95).toFixed(4)), max:Number(Math.max.apply(null, durations).toFixed(4)), total:Number((Number(process.hrtime.bigint() - startedAt) / 1e6).toFixed(2)) },
  };

  fs.writeFileSync(path.join(dataDir, "svetovalec-mini-widget-" + TARGET_COUNT + "-report.json"), JSON.stringify({ report:report, conversations:results }, null, 2) + "\n");
  fs.writeFileSync(fallbackPath, mergedFallbacks.map(function (row) { return JSON.stringify(row); }).join("\n") + (mergedFallbacks.length ? "\n" : ""));
  console.log("Svetovalec " + TARGET_COUNT + " pogovorov PASS:", JSON.stringify(report));
}

main();
