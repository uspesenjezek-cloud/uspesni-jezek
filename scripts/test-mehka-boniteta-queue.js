"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE = "true";

var queue = require("../api/_lib/mehka-boniteta-queue");
var identityEvidence = require("../api/_lib/identity-evidence");
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

    var noviKljuci = await jose.generateKeyPair("ES256");
    var jwtZNepoznanimKid = await new jose.SignJWT({ role: "authenticated", email: "rotated@example.test" })
      .setProtectedHeader({ alg: "ES256", kid: "rotated-es256-key" })
      .setIssuer("https://auth.example.test/auth/v1")
      .setAudience("authenticated")
      .setSubject(uporabnikId)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(noviKljuci.privateKey);
    assert.equal(supabaseServer._test.jeNeveljavnaJwtNapaka({ code: "ERR_JWKS_NO_MATCHING_KEY" }), false,
      "neznan kid ni dokončen dokaz neveljavne seje, ker se je ključ lahko pravkar zamenjal");
    assert.equal(supabaseServer._test.jeNeveljavnaJwtNapaka({ code: "ERR_JWKS_MULTIPLE_MATCHING_KEYS" }), false,
      "nekonkluzivna izbira JWKS ključa mora pasti na avtoritativni Auth strežnik");

    var rotacijskiAuthKlici = 0;
    global.fetch = async function () {
      rotacijskiAuthKlici += 1;
      return { ok: true, status: 200, json: async function () { return { id: uporabnikId, email: "rotated@example.test" }; } };
    };
    var prijavaPoRotacijiKljuca = await supabaseServer.preveriUporabnika(
      { headers: { authorization: "Bearer " + jwtZNepoznanimKid } },
      { url: "https://auth.example.test", serviceKey: "service-test", authJwks: lokalniJwks, authRetryDelays: [0, 0] }
    );
    assert.equal(prijavaPoRotacijiKljuca.ok, true,
      "veljavno sejo z novim kid mora varno potrditi oddaljeni Auth strežnik");
    assert.equal(prijavaPoRotacijiKljuca.user.id, uporabnikId);
    assert.equal(rotacijskiAuthKlici, 1, "po neznanem kid zadošča en uspešen avtoritativni Auth klic");

    rotacijskiAuthKlici = 0;
    global.fetch = async function () {
      rotacijskiAuthKlici += 1;
      throw new TypeError("network down during signing-key rotation");
    };
    var rotacijaBrezOmrezja = await supabaseServer.preveriUporabnika(
      { headers: { authorization: "Bearer " + jwtZNepoznanimKid } },
      { url: "https://auth.example.test", serviceKey: "service-test", authJwks: lokalniJwks, authRetryDelays: [0, 0] }
    );
    assert.equal(rotacijaBrezOmrezja.code, "AUTH_SERVER_UNAVAILABLE");
    assert.equal(rotacijaBrezOmrezja.retryable, true,
      "neznan kid ob omrežnem izpadu mora ostati začasna napaka, ne lažni 401");
    assert.equal(rotacijskiAuthKlici, 3, "rezervna Auth pot mora ohraniti omejene ponovitve");

    var vercelConfig = require("../vercel.json");
    assert.equal(vercelConfig.functions["api/boniteta.js"].maxDuration, 60,
      "združena bonitetna funkcija mora imeti dovolj časa za auth in čakalno vrsto");
    assert.ok(vercelConfig.rewrites.some(function (rewrite) {
      return rewrite.source === "/api/mehka-boniteta-opravilo" && rewrite.destination === "/api/boniteta?handler=job";
    }), "javna pot čakalne vrste mora kazati na združeni job handler");

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

  assert.equal(queue._test.CACHE_VERSION, "impressum-parser-v49-scrapling-acquisition-fallback");
  assert.match(queue.cacheKey({ ime: "Cache GmbH" }), /^[a-f0-9]{64}$/,
    "ključ predpomnilnika mora biti stabilen SHA-256");
  assert.equal(queue.cacheKey({ ime: " Cache   GmbH " }), queue.cacheKey({ ime: "cache gmbh" }),
    "normalizirano isto podjetje mora ponovno uporabiti isto opravilo");
  assert.notEqual(queue.cacheKey({ ime: "Cache GmbH", openRegisterCompanyId: "DE-HRB-1" }), queue.cacheKey({ ime: "Cache GmbH" }),
    "druga registrska identiteta ne sme ponovno uporabiti napačnega opravila");
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
  assert.equal(starSiv.result.identityEvidence.evidenceContractVersion, identityEvidence.CONTRACT_VERSION);

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
        sourceUrl: "https://example.test/impressum", captureVersion: "identity-evidence-v17-preserve-legal-modal",
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
  assert.equal(mesaniPrevzemi.filter(function (job) { return job.faza === "insolvenca"; }).length, 20, "uradnih insolvenčnih opravil mora biti največ dvajset");
  assert.equal(mesaniPrevzemi.filter(function (job) { return job.faza === "identiteta"; }).length, 10, "preostalih deset mest lahko uporabijo preverbe identitete");

  queue._test.ponastaviPomnilnik();
  var telo = { ime: "Cache GmbH", naslov: "Musterstraße 1", postnaStevilka: "10115", kraj: "Berlin" };
  var prvi = await queue.ustvari({}, "user-a", telo);
  var claim = (await queue.prevzemi({}, 1))[0];
  var veljavenPredpomnjeniRezultat = {
    ok: true, cachedResult: true,
    identity: { status: "verified_register", companyId: "DE-HRB-X-12345" },
    identityEvidence: { status: "verified_api", companyId: "DE-HRB-X-12345" },
  };
  await queue.zakljuci({}, claim, { success: true, result: veljavenPredpomnjeniRezultat });
  var drugi = await queue.ustvari({}, "user-b", telo);
  assert.equal(prvi.status, "queued");
  assert.equal(drugi.status, "queued", "uporabnik ne sme dobiti rezultata ali dokazil drugega uporabnika");
  assert.equal(drugi.cached, false);
  var istiUporabnik = await queue.ustvari({}, "user-a", telo);
  assert.equal(istiUporabnik.status, "completed");
  assert.equal(istiUporabnik.cached, true);
  assert.equal(istiUporabnik.result.cachedResult, true);
  assert.equal(queue._test.jeRezultatPrimerenZaPredpomnilnik({
    ok: true,
    identity: { status: "probable_impressum" },
    identityEvidence: { status: "unavailable", reason: "capture_failed" },
    result: { level: "yellow", title: "Vira ni bilo mogoče prikazati" },
  }, "identiteta"), false, "neuspešen zajem dokazila se mora ob naslednjem kliku vedno ponoviti");
  assert.equal(queue._test.jeRezultatPrimerenZaPredpomnilnik(veljavenPredpomnjeniRezultat, "identiteta"), true,
    "uradno OpenRegister dokazilo se lahko varno ponovno uporabi");
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
    id: "job-same-company", request_payload: {
      spletnaStran: "https://skupina.example.test/pravna-oseba-b",
      confirmedIdentity: { companyId: "DE-HRB-R0001-10001", registerNumber: "HRB 10001" },
    }, result_payload: {},
  }, {
    company_id: "DE-HRB-R0001-10001", legal_name: "Pravna oseba A GmbH", register_number: "HRB 10001",
    address: { street: "Skupna ulica 12", postal_code: "10115" },
    contact: { website: "https://skupina.example.test/pravna-oseba-a" }, latest_check: {},
  }), true, "isti uradni company ID mora ostati pozitivna vez");
  assert.equal(queue._test.opraviloPripadaProfilu({
    id: "job-different-company", request_payload: {
      ime: "Pravna oseba A GmbH", naslov: "Skupna ulica 12", postnaStevilka: "10115",
      spletnaStran: "https://skupina.example.test/pravna-oseba-b",
      confirmedIdentity: { companyId: "DE-HRB-R0001-20002", registerNumber: "HRB 20002" },
    }, result_payload: {},
  }, {
    company_id: "DE-HRB-R0001-10001", legal_name: "Pravna oseba A GmbH", register_number: "HRB 10001",
    address: { street: "Skupna ulica 12", postal_code: "10115" },
    contact: { website: "https://skupina.example.test/pravna-oseba-a" }, latest_check: {},
  }), false, "različna uradna company ID-ja morata premagati isto ime, naslov in domeno");
  assert.equal(queue._test.opraviloPripadaProfilu({
    id: "job-known-but-conflicting", request_payload: {
      ime: "Pravna oseba A GmbH", naslov: "Skupna ulica 12", postnaStevilka: "10115",
      spletnaStran: "https://skupina.example.test/pravna-oseba-b", registerNumber: "HRB 20002",
    }, result_payload: {},
  }, {
    company_id: "", legal_name: "Pravna oseba A GmbH", register_number: "HRB 10001",
    address: { street: "Skupna ulica 12", postal_code: "10115" },
    contact: { website: "https://skupina.example.test/pravna-oseba-a" },
    latest_check: { queueJobId: "job-known-but-conflicting" },
  }), false, "znani ID opravila ne sme obiti jasno različne registrske številke");
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
  assert.equal(worker.prehodnaNapaka(200, { ok: true, insolvency: { status: "unavailable" } }), true,
    "tudi ročna insolvenčna preverba brez uradnega dokaza mora ostati nedokončana in se ponoviti");
  assert.equal(worker.prehodnaNapaka(200, { ok: true, identity: { status: "verified_register" }, insolvency: { status: "not_checked", reason: "official_identity_evidence_unavailable" } }, { faza: "identiteta", request_payload: {} }), false,
    "prva faza z uporabnim rezultatom identitete ne sme pasti v tri ponovitve samo zato, ker insolvenčni dokaz še ni pripravljen");
  assert.equal(worker.prehodnaNapaka(200, { ok: true, insolvency: { status: "unavailable" } }, { faza: "insolvenca", request_payload: { confirmedIdentity: { confirmed: true } } }), true,
    "faza insolvence mora nedokončan uradni rezultat še vedno ponoviti");
  assert.equal(worker.prehodnaNapaka(200, { ok: true, insolvency: { status: "unavailable" } }, { project_monitor_id: "monitor-1" }), true,
    "samodejno spremljanje mora začasno nedosegljiv uradni vir ponoviti in ne sme prepisati zadnjega uspešnega rezultata");
  assert.equal(worker.prehodnaNapaka(200, { ok: true, insolvency: { status: "clear", officialVerification: { status: "unavailable" } } }, { project_monitor_id: "monitor-1" }), true,
    "samodejno spremljanje ne sme zaključiti preverbe brez dokončanega uradnega koraka");
  assert.equal(worker.prehodnaNapaka(200, { ok: true, insolvency: { status: "clear", evidenceStatus: "unavailable", reason: "capture_or_search_failed", officialVerification: { status: "clear" } } }, { project_monitor_id: "monitor-1" }), true,
    "samodejno spremljanje mora prepoznati nepopoln dokaz tudi, kadar zunanji status pomotoma ostane clear");
  assert.equal(worker.prehodnaNapaka(200, { ok: true, retryable: true }), true);
  assert.equal(worker.prehodnaNapaka(200, { ok: true, insolvency: { status: "clear", officialVerification: { status: "clear" } } }), true,
    "status clear brez zajetega uradnega posnetka ni terminalni uspeh");
  assert.equal(worker.prehodnaNapaka(200, { ok: true, insolvency: { status: "clear", officialVerification: { status: "clear", evidenceStatus: "captured", evidenceImage: "data:image/jpeg;base64,QUJD" } } }), false,
    "clear z zajetim uradnim rezultatom ostane terminalni uspeh");
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
  var vzporednaMigracija = fs.readFileSync(path.join(koren, "supabase", "migrations", "20260827010500_monitoring_twenty_parallel_workers.sql"), "utf8");
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
  assert.match(vzporednaMigracija, /limit 20/i, "scheduler mora atomsko uvrstiti do 20 zapadlih monitoringov");
  assert.match(vzporednaMigracija, /20 - count\(\*\) filter/i, "insolvenčna meja mora biti 20");
  assert.match(vzporednaMigracija, /generate_series\(1, demand\.worker_count\)/i, "vsako zapadlo opravilo mora dobiti ločen worker");
  assert.match(vzporednaMigracija, /least\(20,/i, "fan-out mora ostati omejen na 20");
  assert.match(vzporednaMigracija, /source = 'user'[\s\S]*status in \('queued', 'processing'\)/i, "ročne uporabniške poizvedbe morajo ustaviti batch scheduling");
  assert.match(vzporednaMigracija, /source = 'project_monitor'[\s\S]*status = 'queued'[\s\S]*generate_series/i, "heartbeat sme fan-outati samo ob dejanskem monitoring povpraševanju");
  assert.match(vzporednaMigracija, /cron\.unschedule\(v_job_id\)[\s\S]*'\* \* \* \* \*'/i, "stari cron mora biti varno zamenjan z minutnim heartbeat jobom");
  assert.match(workerVir, /največ 20[\s\S]*insolvenčnih/i, "worker mora dokumentirati dvajset hkratnih insolvenčnih slotov");
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
  assert.match(ui, /zakljucekPrebujenegaDelavca/,
    "UI mora po zaključku prebujenega delavca rezultat prebrati takoj");
  assert.match(ui, /preteklo < 3000[\s\S]*processing\" \? 300 : 400/,
    "začetno preverjanje statusa mora biti odzivnejše od starega 1–1,8 s intervala");
  assert.doesNotMatch(ui, /job\.status === \"processing\" \? 1000 : 1800/,
    "stari počasni fiksni interval ne sme ostati v čakalni zanki");
  assert.match(ui, /async function pocakajNaOpravilo\(job, token\)[\s\S]*?while \(true\)[\s\S]*?job\.status === "completed"[\s\S]*?job\.status === "failed"/,
    "UI mora isto opravilo samodejno spremljati do terminalnega stanja brez mrtvega timeout zaslona");
  assert.doesNotMatch(ui, /55 \* 1000|Preverjanje se nadaljuje v ozadju\. Poskusite ponovno/,
    "stara časovna meja ne sme prekiniti samodejnega spremljanja aktivnega opravila");
  assert.match(ui, /krajiTrenutnePoste\.length > 1/, "pri poštni številki z več kraji mora biti izbira izrecna");
  assert.match(ui, /Podjetja nismo našli\. Izberite naslednji korak spodaj\./,
    "prebrana stran brez potrjene identitete ne sme biti napačno označena kot neberljiva");
  assert.match(ui, /stranJeDejanskoNedosegljiva/,
    "sporočilo o neberljivi strani mora biti omejeno na dejanske napake dostopa");
  var api = fs.readFileSync(path.join(koren, "api", "_handlers", "mehka-boniteta.js"), "utf8");
  assert.match(api, /pravniKontrolnik\.click\(\)/,
    "vgrajeni Impressum mora biti pred zajemom dokazila varno odprt");
  assert.match(api, /pripraviOpenRegisterVnosIzImpressuma/,
    "OpenRegister mora prejeti naziv, register in lokacijo iz preverjenega Impressuma");
  var lokalniStreznik = fs.readFileSync(path.join(koren, "scripts", "local-server.js"), "utf8");
  assert.match(lokalniStreznik, /osveziApiCeJeSpremenjen/, "lokalni strežnik mora osvežiti API samo ob spremembi različice");
  assert.match(lokalniStreznik, /novaRazlicica === nalozenaApiRazlicica/);

  console.log("✓ Čakalna vrsta sprejme 100 zahtev: največ 30 skupaj in 20 insolvenčnih.");
  console.log("✓ Ponovitve, lastništvo rezultatov in predpomnilnik delujejo.");
  console.log("✓ Migracija uporablja SKIP LOCKED, RLS in najmanjše privilegije.");
}

main().catch(function (err) {
  console.error(err);
  process.exitCode = 1;
});
