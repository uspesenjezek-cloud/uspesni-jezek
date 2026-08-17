"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE = "true";

var queue = require("../api/_lib/mehka-boniteta-queue");
var supabaseServer = require("../api/_lib/supabase-server");
var worker = require("../api/mehka-boniteta-delavec")._test;
var projectMonitor = require("../api/_lib/projektno-spremljanje");
var koren = path.resolve(__dirname, "..");

async function main() {
  var prvotniAuthFetch = global.fetch;
  try {
    var jose = await import("jose");
    var kljuci = await jose.generateKeyPair("ES256");
    var javniJwk = await jose.exportJWK(kljuci.publicKey);
    javniJwk.kid = "test-es256-key";
    javniJwk.alg = "ES256";
    javniJwk.use = "sig";
    var lokalniJwks = jose.createLocalJWKSet({ keys: [javniJwk] });
    var uporabnikId = "4ca9b768-b7d3-4a35-8b93-46e0b529f282";
    var veljavniJwt = await new jose.SignJWT({ role: "authenticated", email: "test@example.test" })
      .setProtectedHeader({ alg: "ES256", kid: "test-es256-key" })
      .setIssuer("https://auth.example.test/auth/v1")
      .setAudience("authenticated")
      .setSubject(uporabnikId)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(kljuci.privateKey);
    global.fetch = async function () { throw new Error("oddaljeni auth se pri veljavnem JWT ne sme klicati"); };
    var lokalnoPreverjenaPrijava = await supabaseServer.preveriUporabnika(
      { headers: { authorization: "Bearer " + veljavniJwt } },
      { url: "https://auth.example.test", serviceKey: "service-test", authJwks: lokalniJwks }
    );
    assert.equal(lokalnoPreverjenaPrijava.ok, true, "ES256 prijava mora biti preverjena lokalno brez /auth/v1/user");
    assert.equal(lokalnoPreverjenaPrijava.user.id, uporabnikId);
    assert.equal(lokalnoPreverjenaPrijava.verification, "local_jwks");

    var potekliJwt = await new jose.SignJWT({ role: "authenticated" })
      .setProtectedHeader({ alg: "ES256", kid: "test-es256-key" })
      .setIssuer("https://auth.example.test/auth/v1")
      .setAudience("authenticated")
      .setSubject(uporabnikId)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 120)
      .sign(kljuci.privateKey);
    var zavrnjenaPoteklaPrijava = await supabaseServer.preveriUporabnika(
      { headers: { authorization: "Bearer " + potekliJwt } },
      { url: "https://auth.example.test", serviceKey: "service-test", authJwks: lokalniJwks }
    );
    assert.equal(zavrnjenaPoteklaPrijava.code, "AUTH_SESSION_INVALID",
      "lokalno preverjanje mora potekli JWT varno zavrniti brez oddaljenega obhoda");

    var legacySkrivnost = jose.base64url.decode("Y2lzdG8tdGVzdG5hLXNrcml2bm9zdC16YS1oc3RvaXBldHNldGRlc2V0");
    var legacyJwt = await new jose.SignJWT({ role: "authenticated" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("https://auth.example.test/auth/v1")
      .setAudience("authenticated")
      .setSubject(uporabnikId)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(legacySkrivnost);
    var zahtevanaOsvezitev = await supabaseServer.preveriUporabnika(
      { headers: { authorization: "Bearer " + legacyJwt } },
      { url: "https://auth.example.test", serviceKey: "service-test", authJwks: lokalniJwks }
    );
    assert.equal(zahtevanaOsvezitev.code, "AUTH_SESSION_REFRESH_REQUIRED",
      "stari HS256 žeton mora sprožiti osvežitev seje, ne nedosegljivega Auth API-ja");
    assert.equal(zahtevanaOsvezitev.retryable, true);

    assert.equal(require("../vercel.json").functions["api/mehka-boniteta-opravilo.js"].maxDuration, 30,
      "hladni zajem javnega ključa in rezervna auth pot morata imeti dovolj skupnega časa");

    assert.equal(supabaseServer._test.omejenCas(5000, 12000), 5000,
      "rezervni auth poskus mora ostati znotraj skupne omejitve strežniške funkcije");
    var authKlici = 0;
    global.fetch = async function () {
      authKlici += 1;
      if (authKlici < 3) throw new TypeError("temporary network failure");
      return { ok: true, status: 200, json: async function () { return { id: "user-retry" }; } };
    };
    var authPoOmrezniNapaki = await supabaseServer.preveriUporabnika(
      { headers: { authorization: "Bearer veljaven-token" } },
      { url: "https://auth.example.test", serviceKey: "service-test", authRetryDelays: [0, 0], authVerificationMode: "remote" }
    );
    assert.equal(authPoOmrezniNapaki.ok, true, "začasna omrežna napaka avtorizacije mora biti samodejno ponovljena");
    assert.equal(authKlici, 3);

    authKlici = 0;
    global.fetch = async function () {
      authKlici += 1;
      return authKlici === 1
        ? { ok: false, status: 503, json: async function () { return {}; } }
        : { ok: true, status: 200, json: async function () { return { id: "user-http-retry" }; } };
    };
    var authPo503 = await supabaseServer.preveriUporabnika(
      { headers: { authorization: "Bearer veljaven-token" } },
      { url: "https://auth.example.test", serviceKey: "service-test", authRetryDelays: [0, 0], authVerificationMode: "remote" }
    );
    assert.equal(authPo503.ok, true, "začasni odgovor 503 mora biti samodejno ponovljen");
    assert.equal(authKlici, 2);

    authKlici = 0;
    global.fetch = async function () {
      authKlici += 1;
      return { ok: false, status: 401, json: async function () { return {}; } };
    };
    var neveljavnaSeja = await supabaseServer.preveriUporabnika(
      { headers: { authorization: "Bearer neveljaven-token" } },
      { url: "https://auth.example.test", serviceKey: "service-test", authRetryDelays: [0, 0], authVerificationMode: "remote" }
    );
    assert.equal(neveljavnaSeja.code, "AUTH_SESSION_INVALID");
    assert.equal(neveljavnaSeja.retryable, false);
    assert.equal(authKlici, 1, "neveljavne seje ne smemo po nepotrebnem ponavljati na strežniku");

    authKlici = 0;
    global.fetch = async function () { authKlici += 1; throw new TypeError("network down"); };
    var nedosegljivaAvtorizacija = await supabaseServer.preveriUporabnika(
      { headers: { authorization: "Bearer veljaven-token" } },
      { url: "https://auth.example.test", serviceKey: "service-test", authRetryDelays: [0, 0], authVerificationMode: "remote" }
    );
    assert.equal(nedosegljivaAvtorizacija.code, "AUTH_SERVER_UNAVAILABLE");
    assert.equal(nedosegljivaAvtorizacija.retryable, true);
    assert.equal(authKlici, 3, "strežnik mora pred prikazom začasne napake poskusiti trikrat");
  } finally {
    global.fetch = prvotniAuthFetch;
  }

  assert.equal(queue._test.CACHE_VERSION, "impressum-parser-v33-visible-legal-content");
  assert.equal(
    queue.cacheKey({ ime: "Cache GmbH" }),
    require("node:crypto").createHash("sha256").update(JSON.stringify({
      cacheVersion: "impressum-parser-v33-visible-legal-content",
      faza: "identiteta",
      ime: "cache gmbh",
      naslov: "",
      postnaStevilka: "",
      kraj: "",
      spletnaStran: "",
      openregister: false,
      potrjenoIme: "",
      potrjeniNaziv: "",
      potrjeniNosilec: "",
      potrjeniNaslov: "",
      potrjenaPosta: "",
      potrjeniKraj: "",
      companyId: "",
    })).digest("hex"),
    "ključ mora vsebovati različico parserja"
  );
  assert.notEqual(
    queue.cacheKey({ confirmedIdentity: { confirmed: true, name: "Primer GmbH", representativeName: "Erika Beispiel" } }),
    queue.cacheKey({ confirmedIdentity: { confirmed: true, name: "Primer GmbH", representativeName: "Max Muster" } }),
    "potrditev drugega nosilca ne sme ponovno uporabiti rezultata prve osebe"
  );
  queue._test.ponastaviPomnilnik();
  var prviEnak = await queue.ustvari({}, "isti-uporabnik", { ime: "Isto podjetje GmbH", spletnaStran: "https://example.test" });
  var drugiEnak = await queue.ustvari({}, "isti-uporabnik", { ime: "Isto podjetje GmbH", spletnaStran: "https://example.test" });
  assert.equal(drugiEnak.id, prviEnak.id, "ponoven klik mora uporabiti isto aktivno opravilo");
  assert.equal(drugiEnak.reused, true, "UI mora vedeti, da ni nastala nova zunanja poizvedba");
  queue._test.ponastaviPomnilnik();
  var ustvarjena = [];
  for (var i = 0; i < 100; i += 1) {
    ustvarjena.push(await queue.ustvari({}, "user-" + i, {
      ime: "Testni obrtnik " + i,
      naslov: "Teststraße " + i,
      postnaStevilka: "20095",
      kraj: "Hamburg",
      uporabiOpenRegisterIdentiteto: false,
    }));
  }
  assert.equal(ustvarjena.length, 100);
  assert.equal(ustvarjena[0].position, 1);
  assert.equal(ustvarjena[99].position, 100);

  var prevzemiHkrati = await Promise.all(Array.from({ length: 50 }, function () {
    return queue.prevzemi({}, 1);
  }));
  var prevzeta = prevzemiHkrati.flat();
  assert.equal(prevzeta.length, 30, "globalna omejitev mora dovoliti trideset opravil");
  assert.equal(new Set(prevzeta.map(function (job) { return job.id; })).size, 30, "isto opravilo ne sme biti prevzeto dvakrat");

  await queue.zakljuci({}, prevzeta[0], { success: false, retryable: true, error: "začasno" });
  await queue.zakljuci({}, prevzeta[1], { success: true, result: { ok: true, marker: "koncano" } });
  var zakljuceno = await queue.pridobi({}, prevzeta[1].user_id, prevzeta[1].id);
  assert.equal(zakljuceno.status, "completed");
  assert.equal(zakljuceno.result.marker, "koncano");
  assert.equal(await queue.pridobi({}, "drug-uporabnik", prevzeta[1].id), null, "rezultat mora ostati vezan na lastnika");

  var starSivId = "a877dc5f-8fba-4ced-8db5-e61c0403b458";
  queue._test.pomnilnik.jobs.set(starSivId, {
    id: starSivId, user_id: "isti-uporabnik", faza: "identiteta", status: "completed", attempts: 1, max_attempts: 3,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), result_payload: {
      identityEvidence: {
        status: "captured", imageDataUrl: "data:image/jpeg;base64,QUJDRA==",
        sourceUrl: "https://example.test/impressum", captureVersion: "identity-evidence-v12-pre-contract",
        viewportOverlaysRemoved: true,
      },
    },
  });
  var starSiv = await queue.pridobi({}, "isti-uporabnik", starSivId);
  assert.equal(starSiv.result.identityEvidence.screenshotReady, false,
    "čakalna vrsta mora star avtomatski posnetek po odkritju delnih sivih slojev razveljaviti");
  assert.equal(starSiv.result.identityEvidence.evidenceContractVersion, "identity-evidence-contract-v1");

  var starPrazenId = "a877dc5f-8fba-4ced-8db5-e61c0403b460";
  queue._test.pomnilnik.jobs.set(starPrazenId, {
    id: starPrazenId, user_id: "isti-uporabnik", faza: "identiteta", status: "completed", attempts: 1, max_attempts: 3,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), result_payload: {
      identityEvidence: {
        status: "captured", imageDataUrl: "data:image/jpeg;base64,QUJDRA==",
        sourceUrl: "https://example.test/impressum", captureVersion: "identity-evidence-v14-partial-overlay-detection",
        viewportOverlaysRemoved: true, screenshotReady: true,
      },
    },
  });
  var starPrazen = await queue.pridobi({}, "isti-uporabnik", starPrazenId);
  assert.equal(starPrazen.result.identityEvidence.screenshotReady, false,
    "čakalna vrsta mora tudi že označen skoraj prazen avtomatski zajem v14 razveljaviti");

  var novVarenId = "a877dc5f-8fba-4ced-8db5-e61c0403b459";
  queue._test.pomnilnik.jobs.set(novVarenId, {
    id: novVarenId, user_id: "isti-uporabnik", faza: "identiteta", status: "completed", attempts: 1, max_attempts: 3,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), result_payload: {
      identityEvidence: {
        status: "captured", imageDataUrl: "data:image/jpeg;base64,QUJDRA==",
        sourceUrl: "https://example.test/impressum", captureVersion: "identity-evidence-v15-visible-legal-content",
        viewportOverlaysRemoved: true,
      },
    },
  });
  var novVaren = await queue.pridobi({}, "isti-uporabnik", novVarenId);
  assert.equal(novVaren.result.identityEvidence.screenshotReady, true,
    "čakalna vrsta mora nov preverjen zajem z vidno pravno vsebino prikazati");

  queue._test.ponastaviPomnilnik();
  for (var insolventni = 0; insolventni < 40; insolventni += 1) {
    await queue.ustvari({}, "insolvenca-" + insolventni, {
      ime: "Insolvenca " + insolventni,
      confirmedIdentity: { confirmed: true, name: "Dolžnik " + insolventni },
    });
  }
  for (var identiteta = 0; identiteta < 20; identiteta += 1) {
    await queue.ustvari({}, "identiteta-" + identiteta, { ime: "Identiteta " + identiteta });
  }
  var mesaniPrevzemi = (await Promise.all(Array.from({ length: 50 }, function () {
    return queue.prevzemi({}, 1);
  }))).flat();
  assert.equal(mesaniPrevzemi.length, 30, "skupaj mora biti prevzetih največ trideset opravil");
  assert.equal(mesaniPrevzemi.filter(function (job) { return job.faza === "insolvenca"; }).length, 10, "uradnih insolvenčnih opravil mora biti največ deset");
  assert.equal(mesaniPrevzemi.filter(function (job) { return job.faza === "identiteta"; }).length, 20, "preostala mesta lahko uporabijo preverbe identitete");

  queue._test.ponastaviPomnilnik();
  var telo = { ime: "Cache GmbH", naslov: "Musterstraße 1", postnaStevilka: "10115", kraj: "Berlin" };
  var prvi = await queue.ustvari({}, "user-a", telo);
  var claim = (await queue.prevzemi({}, 1))[0];
  await queue.zakljuci({}, claim, { success: true, result: { ok: true, cachedResult: true } });
  var drugi = await queue.ustvari({}, "user-b", telo);
  assert.equal(prvi.status, "queued");
  assert.equal(drugi.status, "queued", "uporabnik ne sme dobiti rezultata ali dokazil drugega uporabnika");
  assert.equal(drugi.cached, false);
  var istiUporabnik = await queue.ustvari({}, "user-a", telo);
  assert.equal(istiUporabnik.status, "completed");
  assert.equal(istiUporabnik.cached, true);
  assert.equal(istiUporabnik.result.cachedResult, true);
  var izbrisanih = await queue.izbrisiPodatkeProfila({}, "user-a", {
    legal_name: "Cache GmbH",
    address: { street: "Musterstraße 1", postal_code: "10115", city: "Berlin" },
    contact: {}, latest_check: {},
  });
  assert.equal(izbrisanih, 2, "izbris profila mora odstraniti prvotno in predpomnjeno opravilo istega uporabnika");
  assert.equal(queue._test.pomnilnik.jobs.size, 1, "opravilo drugega uporabnika mora ostati nedotaknjeno");
  var poIzbrisu = await queue.ustvari({}, "user-a", telo);
  assert.equal(poIzbrisu.status, "queued", "po izbrisu mora nastati povsem novo preverjanje");
  assert.equal(poIzbrisu.cached, false);
  var aktivnaUporabnika = await queue.seznamAktivnih({}, "user-a");
  assert.equal(aktivnaUporabnika.length, 1, "zavihek V teku mora vrniti samo aktivna opravila prijavljenega uporabnika");
  assert.equal(aktivnaUporabnika[0].request.ime, "Cache GmbH");
  assert.equal((await queue.seznamAktivnih({}, "drug-uporabnik")).length, 0, "aktivna opravila drugega uporabnika ne smejo biti vidna");
  var starejsiSorodniId = "b877dc5f-8fba-4ced-8db5-e61c0403b459";
  var drugVnosId = "c877dc5f-8fba-4ced-8db5-e61c0403b459";
  queue._test.pomnilnik.jobs.set(starejsiSorodniId, { id: starejsiSorodniId, user_id: "user-a", request_payload: Object.assign({}, telo, { confirmedIdentity: { confirmed: true } }) });
  queue._test.pomnilnik.jobs.set(drugVnosId, { id: drugVnosId, user_id: "user-a", request_payload: Object.assign({}, telo, { spletnaStran: "https://drugo.example.test/impressum" }) });
  assert.equal(await queue.izbrisiOpravilo({}, "drug-uporabnik", poIzbrisu.id), 0, "tujega nedokončanega preverjanja ni dovoljeno izbrisati");
  assert.equal(await queue.izbrisiOpravilo({}, "user-a", poIzbrisu.id), 2, "lastnik mora z enim klikom odstraniti tudi starejši poskus istega vnosa");
  assert.equal(await queue.pridobi({}, "user-a", poIzbrisu.id), null, "izbrisano preverjanje in njegov rezultat ne smeta ostati v pomnilniku");
  assert.ok(queue._test.pomnilnik.jobs.has(drugVnosId), "preverjanje drugega podjetja mora ostati nedotaknjeno");
  var klimaDomovId = "e877dc5f-8fba-4ced-8db5-e61c0403b459";
  var klimaImpressumId = "f877dc5f-8fba-4ced-8db5-e61c0403b459";
  queue._test.pomnilnik.jobs.set(klimaDomovId, {
    id: klimaDomovId, user_id: "user-a", request_payload: { spletnaStran: "https://www.klimaberatung.de/" }, result_payload: {},
  });
  queue._test.pomnilnik.jobs.set(klimaImpressumId, {
    id: klimaImpressumId, user_id: "user-b", request_payload: {},
    result_payload: { identityEvidence: { sourceUrl: "https://klimaberatung.de/impressum" } },
  });
  assert.equal(queue.izbrisiLokalnaOpravilaPoDomeni("https://www.klimaberatung.de/"), 2,
    "lokalno čistilo mora odstraniti vse stare poskuse iste domene, tudi brez shranjenega profila");
  assert.ok(queue._test.pomnilnik.jobs.has(drugVnosId), "lokalno čistilo ne sme odstraniti druge domene");
  assert.equal(queue._test.opraviloPripadaProfilu({
    id: "job-company", request_payload: { confirmedIdentity: { companyId: "DE-HRB-123" } }, result_payload: {},
  }, { company_id: "DE-HRB-123", legal_name: "Drugo ime GmbH", address: {}, contact: {}, latest_check: {} }), true);
  assert.equal(queue._test.opraviloPripadaProfilu({
    id: "job-other", request_payload: { ime: "Cache GmbH", postnaStevilka: "60325" }, result_payload: {},
  }, { company_id: "", legal_name: "Cache GmbH", address: { postal_code: "10115" }, contact: {}, latest_check: {} }), false,
  "enako ime na drugem naslovu ne sme biti pomotoma izbrisano");
  assert.equal(queue._test.opraviloPripadaProfilu({
    id: "job-sister", request_payload: { spletnaStran: "https://gruppe.example.test/impressum-druzba-b" }, result_payload: {},
  }, { company_id: "", legal_name: "Družba A GmbH", address: {}, contact: { website: "https://gruppe.example.test/impressum-druzba-a" }, latest_check: {} }), false,
  "dve družbi na isti domeni ne smeta biti združeni samo zaradi gostitelja");

  var oldFetch = global.fetch;
  var deleteUrls = [];
  process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE = "false";
  global.fetch = async function (url, options) {
    deleteUrls.push({ url: String(url), method: options && options.method || "GET", headers: options && options.headers || {} });
    return {
      ok: true, status: 200,
      json: async function () {
        return options && options.method === "DELETE" ? null : [{
          id: "d877dc5f-8fba-4ced-8db5-e61c0403b459", user_id: "user-a",
          request_payload: { spletnaStran: "https://cache.example.test/impressum" }, result_payload: {},
        }];
      },
    };
  };
  try {
    assert.equal(await queue.izbrisiPodatkeProfila({ url: "https://db.example.test", serviceKey: "service-test", isService: true }, "user-a", {
      legal_name: "Cache GmbH", address: {}, contact: { website: "https://www.cache.example.test/impressum/" }, latest_check: {},
    }), 1);
    assert.ok(deleteUrls.every(function (call) { return call.url.includes("user_id=eq.user-a"); }), "branje in brisanje morata biti vedno omejena z lastnikom");
    assert.ok(deleteUrls.some(function (call) { return call.method === "DELETE" && call.url.includes("id=in.(d877dc5f-8fba-4ced-8db5-e61c0403b459)"); }));
    deleteUrls.length = 0;
    assert.equal(await queue.izbrisiPodatkeProfila({
      url: "https://db.example.test", publicKey: "public-test", serviceKey: "public-test",
      userToken: "signed-user-token", isService: false,
    }, "user-a", {
      legal_name: "Cache GmbH", address: {}, contact: { website: "https://www.cache.example.test/impressum/" }, latest_check: {},
    }), 1);
    assert.ok(deleteUrls.every(function (call) {
      return call.url.includes("user_id=eq.user-a") &&
        call.headers.apikey === "public-test" && call.headers.Authorization === "Bearer signed-user-token";
    }), "uporabniška rezervna pot mora uporabljati sejo in ostati omejena z lastnikom");
    await assert.rejects(function () {
      return queue.izbrisiPodatkeProfila({ url: "https://db.example.test", serviceKey: "public-test", isService: false }, "user-a", {
        legal_name: "Cache GmbH", address: {}, contact: {}, latest_check: {},
      });
    }, /veljavno uporabniško ali strežniško povezavo/);
  } finally {
    global.fetch = oldFetch;
    process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE = "true";
  }

  assert.equal(worker.prehodnaNapaka(502, null), true);
  assert.equal(worker.prehodnaNapaka(200, { ok: true, identityEvidence: { status: "unavailable" } }), false);
  assert.equal(worker.prehodnaNapaka(200, { ok: true, insolvency: { status: "unavailable" } }), false);
  assert.equal(worker.prehodnaNapaka(200, { ok: true, retryable: true }), true);
  assert.equal(worker.prehodnaNapaka(200, { ok: true, insolvency: { status: "clear", officialVerification: { status: "clear" } } }), false);
  assert.equal(worker.vrsticaZakljucka([{ status: "queued" }]).status, "queued");
  var prvotniFinish = projectMonitor.finish;
  var prvotniConsoleError = console.error;
  projectMonitor.finish = async function () { throw new Error("testna napaka urnika"); };
  console.error = function () {};
  try {
    await worker.varnoZakljuciSpremljanje({}, { project_monitor_id: "monitor-1" }, true, { ok: true });
  } finally {
    projectMonitor.finish = prvotniFinish;
    console.error = prvotniConsoleError;
  }
  var workerVir = fs.readFileSync(path.join(koren, "api", "mehka-boniteta-delavec.js"), "utf8");
  assert.ok(workerVir.indexOf("queue.prevzemi(cfg, 1)") < workerVir.indexOf("projectMonitor.schedule(cfg)"), "ročna vrsta mora biti preverjena pred projektnim razporejevalnikom");
  assert.match(workerVir, /catch \(scheduleError\)/, "napaka projektnega razporejevalnika ne sme blokirati ročne preverbe");

  var osnovnaMigracija = fs.readFileSync(path.join(koren, "supabase", "migrations", "20260815232735_mehka_boniteta_cakalna_vrsta.sql"), "utf8");
  var migracija = fs.readFileSync(path.join(koren, "supabase", "migrations", "20260815234001_mehka_boniteta_trideset_skupaj_deset_insolvenca.sql"), "utf8");
  var izbrisMigracija = fs.readFileSync(path.join(koren, "supabase", "migrations", "20260816170712_uporabnik_lahko_izbrise_svoje_preverbe.sql"), "utf8");
  assert.match(migracija, /for update skip locked/i);
  assert.match(migracija, /30 - count\(\*\)/i);
  assert.match(migracija, /10 - count\(\*\) filter/i);
  assert.match(migracija, /pg_advisory_xact_lock/i);
  assert.match(migracija, /where status = 'queued'/i);
  assert.match(osnovnaMigracija, /enable row level security/i);
  assert.match(izbrisMigracija, /grant select, delete on table public\.mehka_boniteta_opravila to authenticated/i);
  assert.equal((izbrisMigracija.match(/auth\.uid\(\).*user_id/g) || []).length, 2, "obe RLS pravili morata preveriti lastnika");
  assert.match(izbrisMigracija, /revoke all on table public\.mehka_boniteta_opravila from anon/i);
  assert.match(migracija, /grant execute.*service_role/i);
  var zanesljivost = fs.readFileSync(path.join(koren, "supabase", "migrations", "20260816170000_boniteta_zanesljivost_cakalne_vrste.sql"), "utf8");
  assert.match(zanesljivost, /j\.status in \('completed', 'failed'\)/i, "retry ne sme premakniti projektnega urnika");
  assert.match(zanesljivost, /available_at = case/i, "potekli lease mora dobiti odmik pred ponovitvijo");
  assert.match(zanesljivost, /finished_at = case/i, "izčrpano opravilo mora dobiti čas zaključka");
  var userCacheMigration = fs.readFileSync(path.join(koren, "supabase", "migrations", "20260816193000_mehka_boniteta_uporabniski_cache.sql"), "utf8");
  assert.match(userCacheMigration, /user_id, cache_key, finished_at desc/i, "uporabniški cache potrebuje sestavljeni indeks");

  var ui = fs.readFileSync(path.join(koren, "app", "bonitetna-preverba.js"), "utf8");
  assert.match(ui, /mehka-boniteta-opravilo/);
  assert.match(ui, /mehka-boniteta-delavec/);
  assert.match(ui, /Pred vami je še/);
  assert.match(ui, /naslednjePrebujanje/);
  assert.match(ui, /55 \* 1000/, "widget uporabnika ne sme več minut držati na vrtečem kolescu");
  assert.match(ui, /krajiTrenutnePoste\.length > 1/, "pri poštni številki z več kraji mora biti izbira izrecna");
  var lokalniStreznik = fs.readFileSync(path.join(koren, "scripts", "local-server.js"), "utf8");
  assert.match(lokalniStreznik, /osveziApiCeJeSpremenjen/, "lokalni strežnik mora osvežiti API samo ob spremembi različice");
  assert.match(lokalniStreznik, /novaRazlicica === nalozenaApiRazlicica/);

  console.log("✓ Čakalna vrsta sprejme 100 zahtev: največ 30 skupaj in 10 insolvenčnih.");
  console.log("✓ Ponovitve, lastništvo rezultatov in predpomnilnik delujejo.");
  console.log("✓ Migracija uporablja SKIP LOCKED, RLS in najmanjše privilegije.");
}

main().catch(function (err) {
  console.error(err);
  process.exitCode = 1;
});
