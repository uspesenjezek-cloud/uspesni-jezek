var sentry = require("../_lib/sentry");
"use strict";

var db = require("../_lib/supabase-server");
var queue = require("../_lib/mehka-boniteta-queue");
var primaryClient = require("../_lib/apify-northdata-client");
var detailsClient = require("../_lib/apify-northdata-details-client");
var detailsProof = require("../_lib/northdata-details-proof");
var financialGuard = require("../../app/bonitetna-finance-guard");

function json(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function jeLokalnaZahteva(req) {
  var naslov = String(req && req.socket && req.socket.remoteAddress || "").toLowerCase();
  return naslov === "127.0.0.1" || naslov === "::1" || naslov === "::ffff:127.0.0.1";
}

function jeLokalniPredogled(req) {
  return process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE === "true" && jeLokalnaZahteva(req) &&
    String(req && req.headers && req.headers["x-uj-local-preview"] || "") === "1" &&
    /^Bearer\s+local-preview$/i.test(String(req && req.headers && req.headers.authorization || ""));
}

function openRegisterKotPotrditev(openregister) {
  var company = openregister && openregister.status === "found" && openregister.company;
  if (!company) return null;
  return {
    status: "found",
    company: {
      name: company.name,
      registerNumber: [company.register_court, company.register_type, company.register_number].filter(Boolean).join(" "),
      sourceUrl: primaryClient.NORTH_DATA_ROOT,
    },
  };
}

async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, napaka: "Samo POST." });
  var cfg;
  try { cfg = db.konfiguracija(); }
  catch (_) {
    var url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
    var key = String(process.env.SUPABASE_ANON_KEY || "");
    if (!url || !key) return json(res, 500, { ok: false, napaka: "Strežniška konfiguracija manjka." });
    cfg = { url: url, serviceKey: key };
  }
  var auth = jeLokalniPredogled(req)
    ? { ok: true, token: "", user: { id: "00000000-0000-0000-0000-000000000001" } }
    : await db.preveriUporabnika(req, cfg);
  if (!auth.ok) return json(res, auth.status, { ok: false, code: auth.code || "AUTH_FAILED", napaka: auth.napaka });

  var body = req.body && typeof req.body === "object" ? req.body : {};
  var jobId = String(body.jobId || "");
  var proof = String(body.proof || "");
  var requestedSource = ["primary", "details", "finalize"].includes(String(body.source || ""))
    ? String(body.source)
    : "finalize";
  if (!/^[0-9a-f-]{32,36}$/i.test(jobId) || !proof) {
    return json(res, 400, { ok: false, code: "NORTHDATA_DETAILS_REQUEST_INVALID", napaka: "Manjka veljavna dopolnilna zahteva." });
  }
  try {
    var job = await queue.pridobi(cfg, auth.user.id, jobId);
    var result = job && job.result;
    var request = result && result.northDataDetailsRequest;
    var jeVzporedniTok = request && request.mode === "northdata_parallel_runs_after_openregister";
    var verified = jeVzporedniTok
      ? detailsProof.verifyPending(proof, auth.user.id)
      : detailsProof.verify(proof, auth.user.id);
    if (!verified) return json(res, 403, { ok: false, code: "NORTHDATA_DETAILS_PROOF_INVALID", napaka: "Dopolnilna zahteva je potekla ali ni veljavna." });
    if (!job || job.status !== "completed" || !result || !request || request.status !== "pending" || request.proof !== proof ||
        !(jeVzporedniTok
          ? detailsProof.matchesPending(verified, result.openregister, request.primaryBackgroundRun, request.backgroundRun)
          : detailsProof.matches(verified, result.openregister, result.northData)) ||
        !result.identity || result.identity.status !== "verified_register") {
      return json(res, 409, { ok: false, code: "NORTHDATA_DETAILS_JOB_MISMATCH", napaka: "Dopolnilni podatki niso vezani na to zaključeno preverbo." });
    }

    var startedAt = Date.now();
    var identity = result.identity;
    var northData = result.northData;
    var primarySource = null;
    var dokončajPrimary = function () {
      return primaryClient.completeStartedRun(
        request.primaryBackgroundRun,
        result.openregister,
        result.identity,
        { disableCache: request.forceFresh === true }
      );
    };
    var uradnaPotrditev = openRegisterKotPotrditev(result.openregister);
    var dokončajDetails = function (primaryForVerification) {
      return detailsClient.completeStartedRun(
        request.backgroundRun,
        result.openregister,
        identity,
        primaryForVerification || uradnaPotrditev,
        { disableCache: request.forceFresh === true }
      );
    };

    if (jeVzporedniTok && requestedSource === "primary") {
      var samoPrimary = await dokončajPrimary();
      return json(res, 200, {
        ok: true, partial: "primary", allDone: false, jobId: jobId,
        identity: samoPrimary.identity || identity,
        northData: samoPrimary.northData,
        primarySource: samoPrimary.source,
      });
    }
    if (jeVzporedniTok && requestedSource === "details") {
      var samoDetails = await dokončajDetails(uradnaPotrditev);
      return json(res, 200, {
        ok: true, partial: "details", allDone: false, jobId: jobId,
        northDataDetails: samoDetails.northDataDetails,
        source: samoDetails.source,
      });
    }

    // Novi tok prebere oba že vzporedno začeta runa. Stari fallback ostane
    // združljiv z opravili, ustvarjenimi pred uvedbo ozadnega ND1.
    var noDetails = { status: "skipped", reason: "primary_northdata_required" };
    var enriched;
    if (jeVzporedniTok) {
      var zakljucka = await Promise.all([dokončajPrimary(), dokončajDetails(uradnaPotrditev)]);
      var primary = zakljucka[0];
      enriched = zakljucka[1];
      identity = primary.identity || identity;
      northData = primary.northData;
      primarySource = primary.source;
      if (enriched.northDataDetails && enriched.northDataDetails.status === "found" &&
          northData && northData.status === "found") {
        enriched.northDataDetails = detailsClient.confirmWithPrimary(enriched.northDataDetails, northData);
        enriched.source = detailsClient.sourceEntry(enriched.northDataDetails);
      }
    } else {
      enriched = northData && northData.status === "found" && request.backgroundRun && request.backgroundRun.runId
        ? await detailsClient.completeStartedRun(request.backgroundRun, result.openregister, identity, northData, {
            disableCache: request.forceFresh === true,
          })
        : await detailsClient.enrichAfterPrimary(result.openregister, identity, northData, {
            disableCache: request.forceFresh === true,
          });
    }
    var details = enriched.northDataDetails;
    if (northData && northData.status === "found" && northData.company) {
      var guarded = financialGuard.uskladi(northData.company, details && details.status === "found" ? details.company : null);
      var dopolnilniDogodki = details && details.status === "found" && details.company &&
        Array.isArray(details.company.events) ? details.company.events : [];
      northData = Object.assign({}, northData, {
        company: Object.assign({}, guarded.company, {
          events: dopolnilniDogodki.length ? dopolnilniDogodki : guarded.company.events,
        }),
        financialGuard: { version: guarded.version, changed: guarded.changed, issues: guarded.issues },
      });
    }
    await queue.dopolniNorthDataPodrobnosti(cfg, auth.user.id, jobId, proof, northData, details, enriched.source, identity, primarySource);
    console.info("[mehka-boniteta:northdata-timing]", {
      phase: "details_background",
      elapsedMs: Date.now() - startedAt,
      status: details && details.status,
    });
    return json(res, 200, {
      ok: true,
      allDone: Boolean(details && details.status === "found"),
      jobId: jobId,
      identity: identity,
      northData: northData,
      northDataDetails: details,
      primarySource: primarySource,
      source: enriched.source,
    });
  } catch (error) {
    console.error("[mehka-boniteta-podrobnosti]", error.code || error.message);
    return json(res, error.status || 502, {
      ok: false,
      code: error.code || "NORTHDATA_DETAILS_FAILED",
      napaka: "Dodatnih finančnih podatkov trenutno ni bilo mogoče dopolniti. Osnovni rezultat ostaja pripravljen.",
    });
  }
}

module.exports = sentry.wrapHandler(handler, "/api/mehka-boniteta-podrobnosti");
module.exports._test = { jeLokalniPredogled: jeLokalniPredogled };
