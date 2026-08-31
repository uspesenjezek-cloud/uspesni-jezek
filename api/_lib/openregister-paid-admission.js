"use strict";

var crypto = require("node:crypto");
var db = require("./supabase-server");

var KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;
var FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;

function boundedInteger(value, fallback, min, max) {
  var parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function limits(env) {
  var source = env || process.env;
  return {
    dailyCredits: boundedInteger(source.BONITETA_OPENREGISTER_DAILY_CREDIT_LIMIT, 100, 25, 1000),
    concurrent: boundedInteger(source.BONITETA_OPENREGISTER_CONCURRENT_LIMIT, 1, 1, 4),
  };
}

function normalizedKey(value) {
  var key = String(value || "").trim();
  if (!KEY_PATTERN.test(key)) {
    throw Object.assign(new Error("Za plačljivo poizvedbo manjka veljaven ključ zahteve."), {
      status: 400,
      code: "IDEMPOTENCY_KEY_REQUIRED",
      retryable: false,
    });
  }
  return key;
}

function fingerprint(input) {
  var source = input || {};
  var canonical = JSON.stringify({
    version: 1,
    action: String(source.action || ""),
    profileId: String(source.profileId || ""),
    binding: String(source.binding || ""),
    credits: Number(source.credits || 0),
  });
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

function normalizedDecision(value) {
  if (Array.isArray(value)) return value[0] || {};
  return value && typeof value === "object" ? value : {};
}

function decisionError(decision) {
  var source = normalizedDecision(decision);
  var error = new Error(String(source.napaka || "Plačljive poizvedbe trenutno ni mogoče začeti."));
  error.status = boundedInteger(source.statusCode, 409, 400, 599);
  error.code = String(source.code || "PAID_ACTION_REJECTED").slice(0, 80);
  error.retryable = source.retryable === true;
  error.retryAfterMs = boundedInteger(source.retryAfterMs, 0, 0, 120000);
  return error;
}

function publicFailure(error) {
  var source = error || {};
  var status = boundedInteger(source.status, 502, 400, 599);
  var code = String(source.code || "OPENREGISTER_REQUEST_FAILED").slice(0, 80);
  var message = String(source.message || "OpenRegister podatkov ni bilo mogoče pridobiti.").slice(0, 500);
  return {
    statusCode: status,
    payload: {
      ok: false,
      code: code,
      retryable: source.retryable === true,
      napaka: message,
    },
  };
}

async function execute(options, provider) {
  var input = options || {};
  if (typeof provider !== "function") throw new TypeError("Plačljiva operacija potrebuje izvajalca.");
  var key = normalizedKey(input.idempotencyKey);
  var userId = String(input.userId || "");
  var action = String(input.action || "");
  var profileId = input.profileId ? String(input.profileId) : null;
  var binding = String(input.binding || "");
  var credits = boundedInteger(input.credits, 0, 1, 100);
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[a-z][a-z0-9_]{1,63}$/.test(action) || !binding || !credits) {
    throw Object.assign(new Error("Plačljiva operacija ni veljavno vezana na uporabnika in vir."), {
      status: 400,
      code: "PAID_ACTION_BINDING_INVALID",
      retryable: false,
    });
  }
  if (profileId && !/^[0-9a-f-]{36}$/i.test(profileId)) {
    throw Object.assign(new Error("Plačljiva operacija nima veljavnega profila."), {
      status: 400,
      code: "PAID_ACTION_PROFILE_INVALID",
      retryable: false,
    });
  }

  var requestFingerprint = fingerprint({ action: action, profileId: profileId, binding: binding, credits: credits });
  if (!FINGERPRINT_PATTERN.test(requestFingerprint)) throw new Error("Prstnega odtisa zahteve ni bilo mogoče ustvariti.");
  var configured = limits(input.env);
  var rpc = typeof input.rpc === "function" ? input.rpc : function (name, payload) {
    return db.pokliciRpc(input.cfg, name, payload);
  };
  var admission = normalizedDecision(await rpc("sprejmi_boniteta_openregister_zahtevo", {
    p_user_id: userId,
    p_idempotency_key: key,
    p_fingerprint: requestFingerprint,
    p_action: action,
    p_profile_id: profileId,
    p_binding: binding,
    p_credits: credits,
    p_daily_credit_limit: configured.dailyCredits,
    p_concurrent_limit: configured.concurrent,
  }));

  if (admission.action === "replay") {
    return {
      statusCode: boundedInteger(admission.httpStatus, 200, 100, 599),
      payload: admission.responsePayload && typeof admission.responsePayload === "object" ? admission.responsePayload : {},
      replayed: true,
    };
  }
  if (admission.action !== "start" || !/^[0-9a-f-]{36}$/i.test(String(admission.leaseToken || ""))) {
    throw decisionError(admission);
  }

  var outcome;
  try {
    var payload = await provider();
    outcome = {
      statusCode: 200,
      payload: payload && typeof payload === "object" ? payload : { ok: true, result: payload },
    };
  } catch (error) {
    outcome = publicFailure(error);
  }

  var finished;
  try {
    finished = normalizedDecision(await rpc("zakljuci_boniteta_openregister_zahtevo", {
      p_user_id: userId,
      p_idempotency_key: key,
      p_fingerprint: requestFingerprint,
      p_lease_token: String(admission.leaseToken),
      p_http_status: outcome.statusCode,
      p_response_payload: outcome.payload,
    }));
  } catch (error) {
    throw Object.assign(new Error("Rezultat plačljive poizvedbe je negotov in je zaradi varnosti ne bomo samodejno ponovili."), {
      status: 503,
      code: "PAID_ACTION_PERSISTENCE_UNCERTAIN",
      retryable: false,
      cause: error,
    });
  }
  if (!finished.ok) {
    throw Object.assign(new Error("Rezultata plačljive poizvedbe ni bilo mogoče varno potrditi; samodejna ponovitev je ustavljena."), {
      status: 503,
      code: "PAID_ACTION_PERSISTENCE_UNCERTAIN",
      retryable: false,
    });
  }
  return { statusCode: outcome.statusCode, payload: outcome.payload, replayed: false };
}

module.exports = {
  execute: execute,
  fingerprint: fingerprint,
  limits: limits,
  normalizedKey: normalizedKey,
  _test: {
    boundedInteger: boundedInteger,
    decisionError: decisionError,
    publicFailure: publicFailure,
  },
};
