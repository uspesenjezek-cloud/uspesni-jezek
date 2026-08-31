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
  assert.ok(openingBrace >= 0, "Funkcija " + name + " nima telesa.");
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
      if (current === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === quote) quote = "";
      continue;
    }
    if (current === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (current === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (current === '"' || current === "'" || current === "`") {
      quote = current;
      continue;
    }
    if (current === "{") depth += 1;
    else if (current === "}") {
      depth -= 1;
      if (depth === 0) return sourceText.slice(start, index + 1);
    }
  }
  assert.fail("Telesa funkcije " + name + " ni bilo mogoče zaključiti.");
}

var center = source("app/boniteta-sredisce.js");
var css = source("app/boniteta-pro.css");
var shellCss = source("app/bonitetna-preverba.css");
var html = source("app/bonitetna-preverba.html");
var loadProfilesSource = functionSource(center, "loadProfiles");
var loadWatchedSource = functionSource(center, "loadWatched");
var clientAuthStart = center.indexOf("async function token");
var clientAuthEnd = center.indexOf("function error", clientAuthStart);
assert.ok(clientAuthStart >= 0 && clientAuthEnd > clientAuthStart, "Manjka odjemalčev Auth/API sklop.");
var clientAuthSource = center.slice(clientAuthStart, clientAuthEnd);

["api/boniteta-pro.js", "api/_handlers/boniteta-pro.js"].forEach(function (relativePath) {
  var handler = source(relativePath);
  var authStart = handler.indexOf("preveriUporabnika(req, cfg)");
  var authEnd = handler.indexOf("cfg.userToken = auth.token", authStart);
  assert.ok(authStart >= 0 && authEnd > authStart, "Manjka Auth meja v " + relativePath + ".");
  var authFailure = handler.slice(authStart, authEnd);
  assert.match(authFailure, /code\s*:\s*auth\.code\b/,
    "Auth odgovor mora ohraniti strojno kodo napake: " + relativePath);
  assert.match(authFailure, /retryable\s*:\s*auth\.retryable\s*===\s*true/,
    "Auth odgovor mora ohraniti oznako varnega ponovnega poskusa: " + relativePath);
});

assert.match(clientAuthSource, /supabaseKlient\.auth\.refreshSession\s*\(/,
  "odjemalec mora po zavrnjeni ali zastareli seji enkrat prisilno osvežiti žeton");
assert.match(clientAuthSource, /AUTH_SESSION_(?:INVALID|REFRESH_REQUIRED)/,
  "odjemalec mora prepoznati zavrnjeno oziroma zastarelo sejo");
assert.match(clientAuthSource, /AUTH_SERVER_UNAVAILABLE/,
  "odjemalec mora prepoznati začasno nedosegljiv Auth strežnik");
assert.match(clientAuthSource, /AUTH_TIMEOUT/,
  "odjemalec mora prepoznati časovno omejitev Auth strežnika");

assert.doesNotMatch(
  loadProfilesSource,
  /if\s*\(\s*responses\[1\]\.status\s*!==\s*["']fulfilled["']\s*\)\s*throw\s+responses\[1\]\.reason/,
  "odpoved watched seznama ne sme zavreči že uspešno naloženih osnovnih profilov"
);
assert.match(loadWatchedSource, /<button\b[^>]*>[\s\S]*?Poskusi znova[\s\S]*?<\/button>/,
  "neuspešno nalaganje spremljanih podjetij mora ponuditi gumb Poskusi znova");

assert.ok(
  center.includes("if(profilesLoading)return") && center.includes("finally{profilesLoading=false}"),
  "sočasni ali ponovljeni kliki ne smejo ustvariti vzporednih nalaganj profilov"
);
assert.ok(
  center.includes('state.textContent="Nalagam preverjene stranke …"') &&
    center.includes("Preverjenih podjetij trenutno ni bilo mogoče naložiti.") &&
    center.includes("data-retry-profiles") &&
    center.includes("Poskusi znova"),
  "neuspešen klic mora končati vrteče stanje in ponuditi ponovni poskus"
);
assert.ok(
  center.includes('el("bp-profile-count").textContent="0"') &&
    center.includes('grid.innerHTML=""') &&
    center.includes("profilesLoaded=false"),
  "neuspeh ne sme prikazati zastarelega števca ali zastarelih kartic kot aktualne"
);
assert.ok(
  css.includes(".bp-state__retry") && /boniteta-sredisce\.js\?v=[^"']+-v\d+/.test(html),
  "ponovni poskus mora biti oblikovan in dostavljen z novo različico sredstva"
);
assert.ok(
  /id="bp-profiles"[^>]*aria-label="Preverjena podjetja"[\s\S]*?id="bp-profile-count" hidden/.test(html) &&
    !/id="bp-profiles"[^>]*>[\s\S]*?<div class="bp-panel-head"><h3>Preverjena podjetja<\/h3>/.test(html),
  "vidna naslovna vrstica Preverjena podjetja mora biti odstranjena, skriti števec pa mora ostati povezan"
);
assert.ok(
  css.includes("#bp-profiles { padding:0; border:0; border-radius:0; background:transparent; box-shadow:none; }") &&
    css.includes("#bp-profiles .bp-profile-card") && css.includes("border-radius:18px"),
  "profilne kartice morajo biti samostojni widgeti brez zunanjega panela"
);
assert.ok(
  /id="boniteta-center-active"[^>]*aria-label="Spremljana podjetja"[\s\S]*?id="bp-watched"[\s\S]*?Spremljamo 0 podjetij/.test(html) &&
    /data-boniteta-center-view="active"[\s\S]*?<span data-fit-text>Spremljano<\/span>/.test(html),
  "srednji pogled mora prikazovati dejansko spremljana podjetja in biti poimenovan Spremljano"
);
assert.ok(
  center.includes('function profileInitials(name)') && center.includes('function profileInsight(p)') &&
    center.includes('function companyCard(p)') && center.includes('rows.map(companyCard)') &&
    center.includes('function watchedCard(m){return profileCard(watchedProfile(m),m)}') &&
    html.includes('id="bp-profiles-grid" class="bp-grid bp-profiles-list"') &&
    html.includes('id="bp-watched-grid" class="bp-grid bp-profiles-list"') &&
    center.includes('if(!companyCardsPreview&&!monitoringStatesPreview)loadWatched()'),
  "Podjetja uporabljajo svoj obstoječi widget z dodatno akcijo, Spremljano pa ohrani spremljevalno kartico"
);
assert.ok(
  center.includes('resultHtml=monitor?monitoringResultHtml(p,monitor,profileHref,defaultInsight):defaultInsight'),
  "spremljevalni rezultat se sme prikazati samo v pogledu Spremljano, Podjetja pa ohranijo navadni widget zadnje preverbe"
);
assert.ok(
  shellCss.includes("#bp-watched .bp-profile-card__izberi { display: none; }") &&
    shellCss.includes("#bp-profiles.is-comparison-open .bp-profile-card__izberi"),
  "Spremljano mora skriti primerjalni izbirnik, profili pa ga morajo ohraniti"
);
assert.ok(
  center.includes('<span>Nova preverba</span>') && center.includes('<span>Spremljaj</span>') &&
    center.includes('section=monitoring#new') &&
    center.includes('function applyWatchedNextDates(grid,monitors){applyProfileMonitoringStates(grid,monitors)}'),
  "obe kartici morata imeti isto novo preverbo ter isti gumb spremljanja"
);
assert.ok(
  center.includes('class="bp-card-actions"><a class="bp-secondary"') &&
    center.includes('data-fit-text data-fit-text-min="10">'+"'+shieldIcon()+'"+'<span>Spremljaj</span>') &&
    center.includes('<span>Nova preverba</span>') &&
    center.includes('<strong>Poglej zadnjo preverbo</strong>') &&
    center.includes('newCheckHref="bonitetna-preverba.html?profile="+encodeURIComponent(p.id)+"&recheck=1#new"') &&
    center.includes('function openProfileMonitoring(link,event)') &&
    center.includes('openMonitoringSetup([{name:profile.legal_name||"Podjetje",profileId:profile.id||"",monitoring:monitoring}]') &&
    center.includes('label.textContent="Spremeni spremljanje"') &&
    center.includes('return"Naslednja preverba: "+datum') &&
    center.includes('api("/api/boniteta-profili?view=watched")') &&
    center.includes('window.UJBonitetaPonovnoPreveriProfil(profile)') &&
    center.includes('insight.tone==="danger"?profileIcon("danger"):shieldIcon()') &&
    center.includes("bp-company-card__avatar '+(inactive?'is-inactive':'is-active')+'") &&
    center.includes('class="bp-company-card__state ') &&
    center.includes('class="bp-company-card__meta"'),
  "profilna kartica mora odpreti zadnji rezultat, isto okno spremljanja, pripraviti novo preverbo in barvno označiti avatar"
);
assert.ok(
  source("app/bonitetna-preverba.js").includes('window.UJBonitetaPonovnoPreveriProfil = async function (profile)') &&
    source("app/bonitetna-preverba.js").includes('recheckMode: "saved_profile"') &&
    source("api/_lib/mehka-boniteta-queue.js").includes('telo && telo.recheckMode === "saved_profile" ? null') &&
    source("api/_handlers/mehka-boniteta.js").includes('telo.recheckMode === "saved_profile"'),
  "Nova preverba mora v ozadju ustvariti sveže opravilo, ohraniti aktivno deduplikacijo in nato prikazati rezultat"
);
assert.ok(
  shellCss.includes(':is(#bp-profiles, #bp-watched) .bp-card-actions { margin: 12px 0 0;') &&
    shellCss.includes('grid-template-columns: minmax(104px,.78fr) minmax(0,1.22fr)') &&
    shellCss.includes(':is(#bp-profiles, #bp-watched) .bp-card-actions .bp-primary { border: 1px solid #0b8f91;') &&
    shellCss.includes(':is(#bp-profiles, #bp-watched) .bp-card-delete { top: 12px; right: 12px; width: 30px; height: 30px; border: 1px solid #e1e8e6; border-radius: 50%;'),
  "Spremljaj mora biti levo, Nova preverba desno, izbris pa v okroglem zgornjem kontrolniku"
);
assert.ok(
  shellCss.includes('.bp-secondary.is-monitored') &&
    center.includes('function applyMonitoringNextText') &&
    center.includes('card&&card.querySelector(".bp-monitoring-next span")||card&&card.querySelector(".bp-company-card__insight small")') &&
    !center.includes('function appendMonitoringNextLine') &&
    !shellCss.includes('.bp-company-card__next-check') &&
    shellCss.includes(':is(#bp-profiles, #bp-watched) .bp-monitoring-next'),
  "običajna kartica ohrani termin v informacijskem bloku, primerjalno stanje pa ga prikaže v kompaktni namenski vrstici"
);
assert.ok(
  html.includes('id="boniteta-spremljanje-ura" type="time" value="12:00"') &&
    center.includes('checkTime:el("boniteta-spremljanje-ura").value') &&
    center.includes('checkTime:schedule.checkTime') &&
    center.includes('" · ob "+schedule.checkTime') &&
    shellCss.includes('.boniteta-spremljanje-obdobje__ura'),
  "okno spremljanja mora ponuditi desno poravnano uro 12:00 in jo poslati razporejevalniku"
);
assert.ok(
  shellCss.includes(':is(#bp-profiles, #bp-watched) .bp-company-card__insight.is-danger { border: 1px solid #efc4c0;') &&
    shellCss.includes('linear-gradient(135deg,#fff8f7,#fdeceb)') &&
    shellCss.includes(':is(#bp-profiles, #bp-watched) .bp-company-card__insight.is-danger strong { color: #a4443f; }') &&
    shellCss.includes(':is(#bp-profiles, #bp-watched) .bp-company-card__avatar.is-inactive { border: 2px solid #d65a54;') &&
    shellCss.includes('background: #fdecea; color: #b44742;'),
  "neaktivno podjetje mora imeti rdeč opozorilni odtenek in jasno obrobljen avatar"
);
assert.ok(
  shellCss.includes(".bp-company-card__header") && shellCss.includes(".bp-company-card__insight") &&
    shellCss.includes(".boniteta-watched-summary") && shellCss.includes("grid-template-columns: repeat(2,minmax(0,1fr))"),
  "oba pogleda morata uporabljati enoten kompaktni sistem kartic in povzetkov"
);

function fakeResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status: status,
    json: async function () { return body; }
  };
}

function createClient(fetchImpl) {
  var currentToken = "stari-token";
  var refreshCalls = 0;
  var sandbox = {
    supabaseKlient: {
      auth: {
        getSession: async function () {
          return { data: { session: { access_token: currentToken, expires_at: Math.floor(Date.now() / 1000) + 3600 } }, error: null };
        },
        refreshSession: async function () {
          refreshCalls += 1;
          currentToken = "osvezeni-token";
          return { data: { session: { access_token: currentToken, expires_at: Math.floor(Date.now() / 1000) + 3600 } }, error: null };
        }
      }
    },
    fetch: fetchImpl,
    AbortSignal: undefined,
    URL: URL,
    URLSearchParams: URLSearchParams,
    console: console,
    pocakaj: async function () {},
    setTimeout: function (callback) { callback(); return 1; },
    clearTimeout: function () {}
  };
  sandbox.window = sandbox;
  vm.runInNewContext(clientAuthSource + "\nglobalThis.__bonitetaApi = api;", sandbox);
  return {
    api: sandbox.__bonitetaApi,
    refreshCalls: function () { return refreshCalls; }
  };
}

function fakeStateElement(retryButton) {
  return {
    hidden: false,
    textContent: "",
    innerHTML: "",
    querySelector: function () { return retryButton; }
  };
}

async function verifyHandlerAuthContract(relativePath) {
  var db = require(path.join(root, "api", "_lib", "supabase-server"));
  var originalConfiguration = db.uporabniskaKonfiguracija;
  var originalVerify = db.preveriUporabnika;
  var handlerPath = require.resolve(path.join(root, relativePath));
  delete require.cache[handlerPath];
  var handler = require(handlerPath);
  var response = {
    statusCode: 200,
    body: null,
    setHeader: function () {},
    status: function (status) { this.statusCode = status; return this; },
    json: function (body) { this.body = body; return this; }
  };
  try {
    db.uporabniskaKonfiguracija = function () {
      return { url: "https://auth.example.test", publicKey: "anon-test", serviceKey: "anon-test" };
    };
    db.preveriUporabnika = async function () {
      return {
        ok: false,
        status: 502,
        code: "AUTH_SERVER_UNAVAILABLE",
        retryable: true,
        napaka: "Prijava začasno ni dosegljiva."
      };
    };
    await handler({ method: "GET", url: "/api/boniteta-pro?route=profiles", query: { route: "profiles" }, headers: {} }, response);
  } finally {
    db.uporabniskaKonfiguracija = originalConfiguration;
    db.preveriUporabnika = originalVerify;
  }
  assert.strictEqual(response.statusCode, 502, "handler mora ohraniti začasni Auth HTTP status: " + relativePath);
  assert.strictEqual(response.body && response.body.code, "AUTH_SERVER_UNAVAILABLE",
    "handler mora odjemalcu vrniti Auth kodo: " + relativePath);
  assert.strictEqual(response.body && response.body.retryable, true,
    "handler mora odjemalcu vrniti retryable=true: " + relativePath);
}

async function verifyClientAuthBehavior() {
  var requests = [];
  var refreshedClient = createClient(async function (_url, options) {
    requests.push(options);
    if (requests.length === 1) {
      return fakeResponse(401, { ok: false, code: "AUTH_SESSION_INVALID", retryable: false, napaka: "Prijava ni več veljavna." });
    }
    return fakeResponse(200, { ok: true, profiles: [] });
  });
  await refreshedClient.api("/api/boniteta-profili");
  assert.strictEqual(refreshedClient.refreshCalls(), 1, "HTTP 401 mora sprožiti natanko eno prisilno osvežitev seje");
  assert.strictEqual(requests.length, 2, "po osvežitvi se mora prvotna zahteva ponoviti natanko enkrat");
  assert.strictEqual(requests[1].headers.Authorization, "Bearer osvezeni-token",
    "ponovljena zahteva mora uporabiti novi access token");

  var temporaryCalls = 0;
  var unavailableClient = createClient(async function () {
    temporaryCalls += 1;
    return fakeResponse(502, {
      ok: false,
      code: "AUTH_SERVER_UNAVAILABLE",
      retryable: true,
      napaka: "Prijava začasno ni dosegljiva."
    });
  });
  await assert.rejects(function () { return unavailableClient.api("/api/boniteta-profili"); });
  assert.strictEqual(temporaryCalls, 2,
    "začasni Auth izpad mora prvotno zahtevo ponoviti natanko enkrat");

  var nonRetryableCalls = 0;
  var nonRetryableClient = createClient(async function () {
    nonRetryableCalls += 1;
    return fakeResponse(502, {
      ok: false,
      code: "AUTH_SERVER_UNAVAILABLE",
      retryable: false,
      napaka: "Napake ni varno samodejno ponoviti."
    });
  });
  await assert.rejects(function () { return nonRetryableClient.api("/api/boniteta-profili"); });
  assert.strictEqual(nonRetryableCalls, 1,
    "Auth zahteve brez izrecnega retryable=true ni dovoljeno samodejno ponoviti");

  var unrelatedCalls = 0;
  var unrelatedClient = createClient(async function () {
    unrelatedCalls += 1;
    return fakeResponse(503, { ok: false, code: "BONITETA_PRO_FAILED", retryable: true, napaka: "Napaka storitve." });
  });
  await assert.rejects(function () { return unrelatedClient.api("/api/boniteta-profili"); });
  assert.strictEqual(unrelatedCalls, 1, "splošnih ali stranskih napak API ne sme samodejno ponavljati kot Auth napake");
}

async function verifyPartialProfileBehavior() {
  var retryButton = { onclick: null, addEventListener: function (_type, listener) { this.onclick = listener; } };
  var elements = {
    "bp-profiles-state": fakeStateElement(retryButton),
    "bp-profiles-grid": { innerHTML: "" },
    "bp-profile-count": { textContent: "0" }
  };
  var errors = [];
  var factory = new Function("api", "elements", "errors", [
    "var profilesLoading=false,profilesLoaded=false,profileRows=[];",
    "function el(id){return elements[id]}",
    "function clearError(){}",
    "function error(value){errors.push(value)}",
    "function fit(){}",
    "function companyCard(profile){return '<article data-profile-id=\\\"'+profile.id+'\\\"></article>'}",
    "function bindCompanyCards(){}",
    "function updateProfileComparisonUi(){}",
    loadProfilesSource,
    "return {loadProfiles:loadProfiles,profileRows:function(){return profileRows}};"
  ].join("\n"));
  var subject = factory(async function (url) {
    if (url.includes("view=watched")) throw new Error("watched začasno ni dosegljiv");
    return { ok: true, profiles: [{ id: "osnovni-profil" }] };
  }, elements, errors);
  await subject.loadProfiles();
  assert.match(elements["bp-profiles-grid"].innerHTML, /osnovni-profil/,
    "uspešno naložen osnovni profil mora ostati prikazan, če watched seznam odpove");
  assert.strictEqual(String(elements["bp-profile-count"].textContent), "1",
    "delni watched neuspeh ne sme ponastaviti števca osnovnih profilov na nič");
  assert.strictEqual(subject.profileRows().length, 1,
    "delni watched neuspeh ne sme izbrisati osnovnih vrstic iz odjemalčevega stanja");
}

async function verifyWatchedRetryBehavior() {
  var retryButton = { onclick: null, addEventListener: function (_type, listener) { this.onclick = listener; } };
  var elements = {
    "bp-watched-state": fakeStateElement(retryButton),
    "bp-watched-grid": { innerHTML: "" },
    "boniteta-active-nav-count": { hidden: false, textContent: "7" },
    "boniteta-watched-summary-title": { textContent: "Spremljamo 7 podjetij" },
    "boniteta-active-count": { textContent: "7" }
  };
  var errors = [];
  var factory = new Function("api", "elements", "errors", [
    "var profileRows=[];",
    "function el(id){return elements[id]}",
    "function clearError(){}",
    "function error(value){errors.push(value)}",
    "function fit(){}",
    "function watchedProfile(value){return value}",
    "function watchedCard(){return ''}",
    "function applyWatchedNextDates(){}",
    "function bindCompanyCards(){}",
    loadWatchedSource,
    "return {loadWatched:loadWatched};"
  ].join("\n"));
  var subject = factory(async function () { throw new Error("watched ni dosegljiv"); }, elements, errors);
  await subject.loadWatched();
  assert.match(elements["bp-watched-state"].innerHTML, /<button\b[^>]*>[\s\S]*Poskusi znova[\s\S]*<\/button>/,
    "napaka spremljanja mora izrisati pravi retry gumb, ne le slepega besedila");
  assert.strictEqual(typeof retryButton.onclick, "function", "retry gumb mora biti povezan z novim klicem loadWatched");
}

(async function runBehaviorRegressions() {
  await verifyHandlerAuthContract("api/boniteta-pro.js");
  await verifyHandlerAuthContract("api/_handlers/boniteta-pro.js");
  await verifyClientAuthBehavior();
  await verifyPartialProfileBehavior();
  await verifyWatchedRetryBehavior();
  console.log("Moja podjetja — zaključek nalaganja in ponovni poskus: OK");
})().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
