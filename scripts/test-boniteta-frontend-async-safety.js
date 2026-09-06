"use strict";

var assert = require("node:assert");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

var root = path.resolve(__dirname, "..");
function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function functionSource(sourceText, name) {
  var match = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(").exec(sourceText);
  assert.ok(match, "Manjka funkcija " + name + ".");
  var start = match.index;
  var openingBrace = sourceText.indexOf("{", start);
  var depth = 0;
  var quote = "";
  var escaped = false;
  var lineComment = false;
  var blockComment = false;
  for (var index = openingBrace; index < sourceText.length; index += 1) {
    var current = sourceText[index];
    var next = sourceText[index + 1];
    if (lineComment) {
      if (current === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (current === "*" && next === "/") { blockComment = false; index += 1; }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === quote) quote = "";
      continue;
    }
    if (current === "/" && next === "/") { lineComment = true; index += 1; continue; }
    if (current === "/" && next === "*") { blockComment = true; index += 1; continue; }
    if (current === '"' || current === "'" || current === "`") { quote = current; continue; }
    if (current === "{") depth += 1;
    else if (current === "}") {
      depth -= 1;
      if (depth === 0) return sourceText.slice(start, index + 1);
    }
  }
  assert.fail("Telesa funkcije " + name + " ni bilo mogoče zaključiti.");
}

function deferred() {
  var resolve;
  var reject;
  var promise = new Promise(function (ok, fail) { resolve = ok; reject = fail; });
  return { promise: promise, resolve: resolve, reject: reject };
}

function loadFunction(sourceText, name, sandbox) {
  sandbox.globalThis = sandbox;
  vm.runInNewContext(functionSource(sourceText, name) + "\nglobalThis.__tested = " + name + ";", sandbox);
  return sandbox.__tested;
}

var profileSource = source("app/boniteta-profil.js");
var centerSource = source("app/boniteta-sredisce.js");
var html = source("app/bonitetna-preverba.html");
var css = source("app/bonitetna-preverba.css");
var profileHelpers = require("../app/boniteta-profil.js");

var apiSource = functionSource(profileSource, "api");
assert.match(apiSource, /x\.retryable=d\.retryable===true/,
  "API napaka mora ohraniti strežniško oznako retryable");
assert.match(apiSource, /x\.retryAfterMs=Number\(d\.retryAfterMs\)/,
  "API napaka mora ohraniti strežniški retryAfterMs");
assert.match(functionSource(profileSource, "napakaPrenosa"), /transport\.transport=true/,
  "prekinjena povezava mora biti razločna od varne strežniške zavrnitve");
assert.match(apiSource, /try\{d=await r\.json\(\)\}catch\(e\)\{throw napakaPrenosa\(e\)\}/,
  "prekinjeno ali neveljavno 2xx telo mora ostati transportna napaka istega plačljivega namena");

var generatedKey = profileHelpers.novPlacljivKljuc();
assert.match(generatedKey, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  "plačljiva uporabniška akcija mora dobiti veljaven UUID");
assert.notStrictEqual(profileHelpers.novPlacljivKljuc(), generatedKey,
  "nov uporabniški namen mora dobiti nov ključ");
var paidGet = profileHelpers.pripraviPlacljivoZahtevo("/api/openregister-pro?action=section", {}, generatedKey);
assert.match(paidGet.url, new RegExp("[?&]idempotencyKey=" + generatedKey + "(?:&|$)"));
var paidPost = profileHelpers.pripraviPlacljivoZahtevo("/api/openregister-pro", {
  method: "POST",
  body: JSON.stringify({ action: "document_realtime", profileId: "profil-1" })
}, generatedKey);
assert.strictEqual(JSON.parse(paidPost.options.body).idempotencyKey, generatedKey,
  "POST retry mora poslati isti ključ v telesu");

["section", "loadDocument", "loadRealtimeDocument", "transparency", "extra"].forEach(function (name) {
  assert.match(functionSource(profileSource, name), /paidApi\(/,
    name + " mora uporabljati trajno idempotentno plačljivo zahtevo");
});
var ownershipSource = functionSource(profileSource, "ownership");
assert.match(ownershipSource, /section=owners[\s\S]*await paidApi[\s\S]*section=holdings/,
  "lastniki in deleži morajo teči zaporedno zaradi privzete omejitve ene plačljive akcije");
assert.doesNotMatch(ownershipSource, /Promise\.allSettled/,
  "dveh plačljivih sklopov ne smemo zagnati vzporedno");

assert.match(functionSource(profileSource, "choose"), /sectionGeneration\s*\+=\s*1;activeSection=name/,
  "tudi sinhroni zavihek mora takoj razveljaviti stare asinhrone odzive");
assert.match(functionSource(profileSource, "monitoring"), /mojaGeneracija!==sectionGeneration\|\|activeSection!==name/,
  "spremljanje mora pred pisanjem rezultata preveriti generacijo in aktivni zavihek");
assert.match(functionSource(profileSource, "zapriProfil"), /sectionGeneration\s*\+=\s*1;activeSection=""/,
  "zaprt profil mora razveljaviti čakajoči odziv zavihka");

var failSource = functionSource(profileSource, "fail");
assert.ok(["profile", "id", "section", "northdataRun"].every(function (parameter) {
  return failSource.includes('searchParams.delete("' + parameter + '")');
}), "izbrisan ali neveljaven profil mora odstraniti vse zastarele profilne parametre");
assert.match(failSource, /loading\)loading\.hidden=true/,
  "neuspešno odpiranje profila mora končati stanje nalaganja");
assert.match(functionSource(centerSource, "openSavedProfile"), /if\(odprto===false\)return;history\.replaceState/,
  "neuspešno odpiranje profila ne sme ponovno zapisati stare povezave");

var watchedSource = functionSource(centerSource, "loadWatched");
assert.match(watchedSource, /if\(loadWatched\.loading\)return;loadWatched\.loading=true/,
  "sočasni loadWatched klici se morajo združiti");
assert.match(watchedSource, /finally\{loadWatched\.loading=false\}/,
  "loadWatched mora vedno sprostiti in-flight varovalko");
["enableMonitoring", "disableMonitoring"].forEach(function (name) {
  var body = functionSource(centerSource, name);
  assert.doesNotMatch(body, /showCenter\("active"\);(?:await\s+)?loadWatched\(\)/,
    name + " ne sme po navigaciji še enkrat ročno naložiti istega seznama");
  assert.match(body, /closeMonitoringSetup\(true\);showCenter\("active"\)/,
    name + " mora imeti natanko en navigacijski vir za osvežitev spremljanja");
});

var markAlertSource = functionSource(centerSource, "markAlertRead");
assert.match(markAlertSource, /button\.disabled=true/);
assert.match(markAlertSource, /setAttribute\("aria-busy","true"\)/);
assert.match(markAlertSource, /try\{[\s\S]*await api[\s\S]*\}catch\(e\)\{error\(e\)\}finally/,
  "označevanje opozorila mora imeti nalaganje, obravnavo napake in cleanup");

assert.match(functionSource(centerSource, "openCrif"), /mojaGeneracija=\+\+crifOpenGeneration/);
assert.match(functionSource(centerSource, "openCrif"), /if\(mojaGeneracija!==crifOpenGeneration\)return/,
  "CRIF mora upoštevati zadnji klik, ne zadnjega omrežnega odziva");

assert.doesNotMatch(html, /<form id="crif-form"[^>]*\bnovalidate\b/,
  "CRIF obrazec ne sme obiti browser validacije");
[
  "crif-legal-name", "crif-street", "crif-postal-code", "crif-city",
  "crif-project-value", "crif-open-exposure", "crif-payment-timing",
  "crif-project-start", "crif-project-end", "crif-legitimate-interest",
  "crif-financial-risk", "crif-business-purpose"
].forEach(function (id) {
  assert.match(html, new RegExp('id="' + id + '"[^>]*\\brequired\\b'), id + " mora biti browser-obvezno polje");
});
assert.match(functionSource(centerSource, "submitCrif"), /form\.checkValidity\(\)[\s\S]*form\.reportValidity\(\)/,
  "programska oddaja mora ohraniti isto native validacijo");
assert.match(functionSource(centerSource, "updateCrifSubject"), /nastaviCrifPolje\("crif-legal-name",!person,true\)/);
assert.match(functionSource(centerSource, "updateCrifMonitoring"), /nastaviCrifPolje\("crif-monitoring-end",checked,true\)/);

assert.match(html, /id="boniteta-hero-status"[^>]*aria-live="polite"/,
  "glavni status mora biti aria-live območje");
assert.match(functionSource(centerSource, "startSelectedFlow"), /Vnesite podjetje, osebo ali spletno stran\.[\s\S]*heroStatus\.hidden=false/,
  "prazen glavni CTA mora prikazati vidno sporočilo");
assert.ok(
  css.includes(".stran--bonitetna .boniteta-priporocilo__vnos input,") &&
  css.includes(".boniteta-spremljanje-pogostost select { font-size: 16px; }"),
  "mobilni vnosni kontrolniki ne smejo pasti pod 16 px in sprožiti iOS povečave"
);
[
  "boniteta-priporocilo-vrednost", "boniteta-priporocilo-izpostavljenost",
  "boniteta-priporocilo-trajanje", "crif-legal-name", "crif-register-number",
  "crif-first-name", "crif-last-name", "crif-street", "crif-postal-code",
  "crif-city", "crif-project-reference", "crif-monitoring-reason"
].forEach(function (id) {
  assert.match(html, new RegExp('id="' + id + '"[^>]*data-fit-input-min="16"'),
    id + " mora tudi po samodejnem prilagajanju ostati velik vsaj 16 px");
});
assert.match(html, /boniteta-profil\.js\?v=20260831-paid-idempotency-v1/);
assert.match(html, /boniteta-sredisce\.js\?v=20260831-frontend-async-safety-v1/);

async function verifyPaidRetryKeyLifecycle() {
  var nextIntent = 0;
  var calls = [];
  var attemptsInIntent = 0;
  var sandbox = {
    novPlacljivKljuc: function () { nextIntent += 1; return "paid-request-000" + nextIntent; },
    pripraviPlacljivoZahtevo: profileHelpers.pripraviPlacljivoZahtevo,
    pocakajPlacljivRetry: async function () {},
    api: async function (url, options) {
      attemptsInIntent += 1;
      calls.push({ url: url, body: JSON.parse(options.body) });
      if (attemptsInIntent === 1) throw { transport: true, retryable: true };
      if (attemptsInIntent === 2) throw { code: "PAID_ACTION_IN_PROGRESS", retryable: true, retryAfterMs: 5 };
      return { ok: true };
    }
  };
  var paidApi = loadFunction(profileSource, "paidApi", sandbox);
  await paidApi("/api/openregister-pro", { method: "POST", body: JSON.stringify({ action: "document_realtime" }) });
  assert.strictEqual(calls.length, 3, "transport in obdelava smeta sprožiti le omejeno ponovitev");
  assert.deepStrictEqual(calls.map(function (call) { return call.body.idempotencyKey; }), [
    "paid-request-0001", "paid-request-0001", "paid-request-0001"
  ], "vse ponovitve istega namena morajo ohraniti isti ključ");

  attemptsInIntent = 2;
  await paidApi("/api/openregister-pro", { method: "POST", body: JSON.stringify({ action: "transparency_order" }) });
  assert.strictEqual(calls[calls.length - 1].body.idempotencyKey, "paid-request-0002",
    "naslednji klik mora dobiti nov ključ");

  var rejectedCalls = 0;
  var noConcurrencyRetry = loadFunction(profileSource, "paidApi", {
    novPlacljivKljuc: function () { return "paid-request-concurrency"; },
    pripraviPlacljivoZahtevo: profileHelpers.pripraviPlacljivoZahtevo,
    pocakajPlacljivRetry: async function () {},
    api: async function () {
      rejectedCalls += 1;
      throw { code: "PAID_ACTION_CONCURRENCY_LIMIT", retryable: true };
    }
  });
  await assert.rejects(noConcurrencyRetry("/api/openregister-pro", {
    method: "POST", body: JSON.stringify({ action: "document" })
  }));
  assert.strictEqual(rejectedCalls, 1,
    "helper ne sme samodejno ponavljati drugih strežniških zavrnitev");
}

async function verifySuccessfulHttpWithBrokenBodyIsTransportFailure() {
  var api = loadFunction(profileSource, "api", {
    token: async function () { return "token"; },
    mergedUrl: function (url) { return url; },
    napakaPrenosa: function (cause) {
      var error = new Error("prekinjeno telo");
      error.code = "BONITETA_TRANSPORT_FAILED";
      error.retryable = true;
      error.transport = true;
      error.cause = cause;
      return error;
    },
    AbortSignal: { timeout: function () { return {}; } },
    fetch: async function () {
      return { ok: true, status: 200, json: async function () { throw new Error("body reset"); } };
    }
  });
  await assert.rejects(api("/api/openregister-pro"), function (error) {
    return error && error.code === "BONITETA_TRANSPORT_FAILED" && error.transport === true && error.retryable === true;
  }, "2xx brez berljivega telesa ne sme postati lažen prazen uspeh");
}

async function verifyMonitoringRace() {
  var first = deferred();
  var second = deferred();
  var calls = 0;
  var nodes = {
    "#bp-project-on": {},
    "#bp-project-off": {},
    "#bp-project-value": { value: "" },
    "#bp-project-start": { value: "" },
    "#bp-project-end": { value: "" },
    "#bp-project-status": { textContent: "začetno" }
  };
  var content = {
    innerHTML: "",
    querySelector: function (selector) { return nodes[selector] || null; }
  };
  var state = { hidden: false };
  var sandbox = {
    sectionGeneration: 0,
    activeSection: "",
    Date: Date,
    api: function () { calls += 1; return calls === 1 ? first.promise : second.promise; },
    el: function (id) { return id === "bp-section-state" ? state : id === "bp-section-content" ? content : null; },
    projectMonitor: function () {},
    profileId: "00000000-0000-0000-0000-000000000001"
  };
  var monitoring = loadFunction(profileSource, "monitoring", sandbox);
  var oldRequest = monitoring();
  sandbox.sectionGeneration += 1;
  sandbox.activeSection = "overview";
  first.resolve({ monitor: { project_value_cents: 9900000, project_start_date: "2026-09-01", project_end_date: "2027-01-01" } });
  await oldRequest;
  assert.strictEqual(nodes["#bp-project-value"].value, "", "star odgovor spremljanja ne sme prepisati novega zavihka");

  var currentRequest = monitoring();
  second.resolve({ monitor: { project_value_cents: 2500000, project_start_date: "2026-09-01", project_end_date: "2027-01-01", interval_days: 30, next_check_at: "2026-10-01T10:00:00Z" } });
  await currentRequest;
  assert.strictEqual(nodes["#bp-project-value"].value, "25000", "aktualni odgovor spremljanja mora ostati prikazan");
}

async function verifyCrifLastClickWins() {
  var requests = {};
  var rendered = [];
  var errors = [];
  var output = { scrollIntoView: function () {} };
  var elements = { "crif-form": { hidden: false }, "crif-success": { hidden: false }, "crif-output": output };
  var sandbox = {
    crifElementsVisible: true,
    crifOpenGeneration: 0,
    api: function (url) {
      var id = new URL("https://example.test" + url).searchParams.get("id");
      requests[id] = deferred();
      return requests[id].promise;
    },
    showCenter: function () {},
    selectFlow: function () {},
    el: function (id) { return elements[id]; },
    renderCrif: function (request) { rendered.push(request.id); },
    error: function (reason) { errors.push(reason); }
  };
  function button() {
    return { disabled: false, textContent: "Odpri analizo", setAttribute: function () {}, removeAttribute: function () {} };
  }
  var openCrif = loadFunction(centerSource, "openCrif", sandbox);
  var firstOpen = openCrif("prva", button());
  var secondOpen = openCrif("druga", button());
  requests.druga.resolve({ request: { id: "druga" }, provider: {} });
  await secondOpen;
  requests.prva.resolve({ request: { id: "prva" }, provider: {} });
  await firstOpen;
  assert.deepStrictEqual(rendered, ["druga"], "počasnejši prvi CRIF odziv ne sme prepisati drugega klika");
  assert.deepStrictEqual(errors, []);
}

async function verifyAlertCleanup() {
  var reported = 0;
  var reloads = 0;
  var shouldFail = true;
  var sandbox = {
    api: async function () { if (shouldFail) throw new Error("začasna napaka"); },
    loadAlerts: async function () { reloads += 1; },
    error: function () { reported += 1; }
  };
  var markAlertRead = loadFunction(centerSource, "markAlertRead", sandbox);
  function button() {
    return {
      dataset: { read: "alert-1" }, disabled: false, textContent: "Označi kot prebrano",
      setAttribute: function () {}, removeAttribute: function () {}
    };
  }
  var failedButton = button();
  await markAlertRead(failedButton);
  assert.strictEqual(reported, 1, "napaka označevanja opozorila mora biti vidno obravnavana");
  assert.strictEqual(failedButton.disabled, false, "gumb mora po napaki znova postati uporaben");
  assert.strictEqual(failedButton.textContent, "Označi kot prebrano");

  shouldFail = false;
  await markAlertRead(button());
  assert.strictEqual(reloads, 1, "uspešna oznaka mora osvežiti opozorila natanko enkrat");
}

async function verifyFailedProfileDoesNotRewriteUrl() {
  var historyWrites = 0;
  var centerShows = 0;
  var opened = false;
  var windowObject = {
    location: { href: "https://example.test/app/bonitetna-preverba.html#profiles", assign: function () {} },
    UJBonitetaOdpriProfil: async function () { return opened; }
  };
  var sandbox = {
    window: windowObject,
    history: { state: {}, replaceState: function () { historyWrites += 1; } },
    singleResultReturnView: "new",
    showCenter: function () { centerShows += 1; },
    URL: URL,
    JSON: JSON
  };
  var openSavedProfile = loadFunction(centerSource, "openSavedProfile", sandbox);
  var link = {
    href: "https://example.test/app/bonitetna-preverba.html?profile=00000000-0000-0000-0000-000000000001#new",
    dataset: { openProfile: "00000000-0000-0000-0000-000000000001" },
    closest: function () { return null; }
  };
  await openSavedProfile(link, { preventDefault: function () {} });
  assert.strictEqual(historyWrites, 0, "neobstoječ profil ne sme obnoviti zastarelega URL-ja");
  assert.strictEqual(centerShows, 0);
  opened = true;
  await openSavedProfile(link, { preventDefault: function () {} });
  assert.strictEqual(historyWrites, 1, "uspešno odprt profil mora zapisati kanonično povezavo");
  assert.strictEqual(centerShows, 1);
}

async function run() {
  await verifySuccessfulHttpWithBrokenBodyIsTransportFailure();
  await verifyPaidRetryKeyLifecycle();
  await verifyMonitoringRace();
  await verifyCrifLastClickWins();
  await verifyAlertCleanup();
  await verifyFailedProfileDoesNotRewriteUrl();
  console.log("Boniteta frontend async/validacija varovalke: OK");
}

run().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
