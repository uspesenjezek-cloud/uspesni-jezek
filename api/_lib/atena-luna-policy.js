"use strict";

/*
 * Enotna izvajalna politika za vse Atenine semantične tokove.
 * Luna je edini semantični razlagalec. Te meje so infrastrukturne varovalke
 * za request/response velikost in čakanje, ne poslovni ali jezikovni filtri.
 */

var MODEL = "gpt-5.6-luna";
var REASONING_EFFORT = "high";
var MAX_OUTPUT_TOKENS = 6000;
var MODEL_TIMEOUT_MS = 30000;
var MODEL_TIMEOUT_MAX_MS = 45000;
var MAX_SOURCE_TEXT_LENGTH = 12000;
var MAX_CLARIFICATION_ANSWER_LENGTH = 1200;
var MAX_CLARIFICATION_ROUNDS = 2;
var MAX_STRUCTURED_ITEMS = 50;
var MAX_REQUEST_BODY_BYTES = 128 * 1024;
var REQUESTS_PER_MINUTE = 12;
var RETRY_MAX_ATTEMPTS = 2;
var RETRY_BASE_DELAY_MS = 250;
var RETRY_MAX_DELAY_MS = 1500;
var SEMANTIC_AUTHORITY_VERSION = "luna-semantic-authority-v3";
var REASONING_METHOD_VERSION = "luna-compositional-reasoning-v1";
var REQUEST_PROFILES = Object.freeze({
  history: Object.freeze({
    reasoningEffort: "low",
    maxOutputTokens: 1600,
    timeoutMs: 18000,
    timeoutMaxMs: 25000,
  }),
});
var ADAPTER_OPERATIONS = Object.freeze([
  "schema_validation",
  "catalog_id_mapping",
  "exact_evidence_validation",
  "explicit_relation_materialization",
  "deterministic_arithmetic",
  "ledger_application",
  "human_review_projection",
]);

function reasoningMethodInstructions() {
  return "HARD COMPOSITIONAL REASONING METHOD (" + REASONING_METHOD_VERSION + "): read the complete source before choosing IDs. Identify every atomic claim, event, outcome or action with exact evidence, then its relations: conjunction, sequence, condition, fallback, alternative, exception, negation, cause, time, repetition, quantity and ownership. Preserve each independent atom in source order; never let a primary clause hide a fallback, later clause, exception or negated contrast. A relation changes how or when an atom applies, not whether it exists. Keep clauses together only for one indivisible catalog item. Resolve pronouns and omitted repeated words from the whole source, but never invent facts. Audit the whole source clause by clause: each material span must be mapped, excluded by the flow boundary or covered by one clarification. Apply across languages, typos, inflection, colloquial wording and reordered clauses; examples are demonstrations, never keyword rules.";
}

function semanticAuthorityInstructions() {
  return reasoningMethodInstructions() + " HARD SEMANTIC AUTHORITY BOUNDARY (" + SEMANTIC_AUTHORITY_VERSION + "): Luna is the only component allowed to interpret the user's wording, decide event or goal boundaries, choose card IDs, assign source facts to cards, and decide which compatible fields those facts populate. The local adapter MUST NOT reread the source to infer synonyms, categories, dates, amounts, cadence, ordinals, intent, or ownership after Luna responds; it MUST NOT replace a card, move a fact between cards, manufacture a missing semantic relation, or silently repair Luna's semantic decision. The adapter may only validate the closed schema and catalog IDs, verify exact evidence, materialize relations explicitly returned by Luna, perform deterministic arithmetic explicitly required by those returned relations, apply the fixed ledger effect of the selected card, and project the result for human review. EVIDENCE HARD RULE: every card evidence and field evidence string must be copied verbatim as a contiguous substring of sourceText; never translate, normalize, correct or paraphrase evidence. Use the shortest exact source quote that proves the card or field. Therefore return every needed card, field, ordinal, relation and normalized value yourself. If material meaning is uncertain, return one clarification question instead of relying on local rescue.";
}

function assertAdapterOperations(operations) {
  (Array.isArray(operations) ? operations : []).forEach(function (operation) {
    if (!ADAPTER_OPERATIONS.includes(operation)) {
      var error = new Error("ATENA_FORBIDDEN_POST_LUNA_OPERATION:" + String(operation || "unknown"));
      error.code = "ATENA_FORBIDDEN_POST_LUNA_OPERATION";
      throw error;
    }
  });
  return true;
}

function isPlainObject(value) {
  if (!value || Object.prototype.toString.call(value) !== "[object Object]") return false;
  var prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value, keys) {
  if (!isPlainObject(value) || !Array.isArray(keys)) return false;
  var actual = Object.keys(value).sort();
  var expected = keys.slice().sort();
  return actual.length === expected.length && actual.every(function (key, index) { return key === expected[index]; });
}

function exactEvidenceSpan(sourceText, evidenceText) {
  if (typeof sourceText !== "string" || typeof evidenceText !== "string" || !evidenceText.trim()) return null;
  var start = sourceText.indexOf(evidenceText);
  return start < 0 ? null : { start: start, end: start + evidenceText.length, text: evidenceText };
}

function evidenceIsLinked(sourceText, evidenceText) {
  return Boolean(exactEvidenceSpan(sourceText, evidenceText));
}

function validClarification(value, options) {
  options = options || {};
  if (!hasExactKeys(value, ["question", "answer", "clauseId", "round"])) return false;
  var question = typeof value.question === "string" ? value.question.trim() : "";
  var answer = typeof value.answer === "string" ? value.answer.trim() : "";
  var clauseId = typeof value.clauseId === "string" ? value.clauseId.trim() : "";
  var maxQuestionLength = Number(options.maxQuestionLength) || 180;
  var maxAnswerLength = Number(options.maxAnswerLength) || MAX_CLARIFICATION_ANSWER_LENGTH;
  var maxRounds = Number(options.maxRounds) || MAX_CLARIFICATION_ROUNDS;
  return Boolean(question) && question.length <= maxQuestionLength && Boolean(answer) && answer.length <= maxAnswerLength &&
    /^clause-\d+$/.test(clauseId) && Number.isInteger(value.round) && value.round >= 1 && value.round <= maxRounds;
}

function responseText(payload) {
  if (payload && typeof payload.output_text === "string") return payload.output_text;
  var parts = [];
  var output = payload && Array.isArray(payload.output) ? payload.output : [];
  output.forEach(function (item) {
    (item && Array.isArray(item.content) ? item.content : []).forEach(function (content) {
      if (content && typeof content.text === "string") parts.push(content.text);
    });
  });
  return parts.join("");
}

var UNSUPPORTED_RESPONSE_SCHEMA_KEYS = new Set([
  "contains", "default", "dependentRequired", "dependentSchemas", "format", "maxContains", "minContains",
  "patternProperties", "propertyNames", "unevaluatedItems", "unevaluatedProperties", "uniqueItems",
]);

function assertPortableResponseSchema(schema) {
  function visit(node, path) {
    if (Array.isArray(node)) {
      node.forEach(function (item, index) { visit(item, path + "[" + index + "]"); });
      return;
    }
    if (!isPlainObject(node)) return;
    Object.keys(node).forEach(function (key) {
      if (UNSUPPORTED_RESPONSE_SCHEMA_KEYS.has(key)) {
        var keywordError = new Error("ATENA_UNSUPPORTED_RESPONSE_SCHEMA_KEY:" + path + ":" + key);
        keywordError.code = "ATENA_UNSUPPORTED_RESPONSE_SCHEMA_KEY";
        throw keywordError;
      }
    });
    var types = Array.isArray(node.type) ? node.type : [node.type];
    if (types.includes("object")) {
      if (node.additionalProperties !== false || !isPlainObject(node.properties) || !Array.isArray(node.required)) {
        var objectError = new Error("ATENA_NON_STRICT_RESPONSE_OBJECT:" + path);
        objectError.code = "ATENA_NON_STRICT_RESPONSE_OBJECT";
        throw objectError;
      }
      var propertyKeys = Object.keys(node.properties).sort();
      var requiredKeys = node.required.slice().sort();
      if (new Set(requiredKeys).size !== requiredKeys.length || propertyKeys.length !== requiredKeys.length ||
          !propertyKeys.every(function (key, index) { return key === requiredKeys[index]; })) {
        var requiredError = new Error("ATENA_NON_STRICT_RESPONSE_REQUIRED:" + path);
        requiredError.code = "ATENA_NON_STRICT_RESPONSE_REQUIRED";
        throw requiredError;
      }
    }
    if (types.includes("array") && (!node.items || !Number.isInteger(node.maxItems) || node.maxItems < 0)) {
      var arrayError = new Error("ATENA_UNBOUNDED_RESPONSE_ARRAY:" + path);
      arrayError.code = "ATENA_UNBOUNDED_RESPONSE_ARRAY";
      throw arrayError;
    }
    Object.keys(node).forEach(function (key) { visit(node[key], path + "." + key); });
  }
  visit(schema, "$schema");
  return true;
}

function requestProfile(name) {
  return REQUEST_PROFILES[String(name || "")] || null;
}

function requestDefaults(profileName) {
  var profile = requestProfile(profileName);
  return {
    model: MODEL,
    store: false,
    reasoning: { effort: profile ? profile.reasoningEffort : REASONING_EFFORT },
    max_output_tokens: profile ? profile.maxOutputTokens : MAX_OUTPUT_TOKENS,
  };
}

function timeout(value) {
  return Math.min(MODEL_TIMEOUT_MAX_MS, Math.max(100, Number(value) || MODEL_TIMEOUT_MS));
}

function wait(ms, sleepImpl) {
  if (typeof sleepImpl === "function") return sleepImpl(ms);
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function retryDelay(attempt, randomImpl, retryAfterMs) {
  if (Number.isFinite(retryAfterMs) && retryAfterMs >= 0) return retryAfterMs;
  var random = typeof randomImpl === "function" ? Number(randomImpl()) : Math.random();
  if (!Number.isFinite(random)) random = 0.5;
  random = Math.max(0, Math.min(1, random));
  return Math.min(RETRY_MAX_DELAY_MS, Math.round(RETRY_BASE_DELAY_MS * Math.pow(2, Math.max(0, attempt - 1)) * (0.75 + random * 0.5)));
}

function transportError(code, message, retryable, providerStatus, cause) {
  var error = new Error(message);
  error.code = code;
  error.status = 503;
  error.retryable = retryable === true;
  error.providerStatus = Number.isInteger(providerStatus) ? providerStatus : null;
  if (cause && cause.name) error.causeName = String(cause.name).slice(0, 80);
  return error;
}

function classifyTransportFailure(error, providerStatus) {
  if (Number.isInteger(providerStatus)) {
    if (providerStatus === 429) return transportError("LUNA_RATE_LIMITED", "Luna je trenutno preobremenjena.", true, providerStatus);
    if (providerStatus >= 500 && providerStatus <= 599) return transportError("LUNA_PROVIDER_ERROR", "Luna trenutno ni dosegljiva.", true, providerStatus);
    return transportError("LUNA_PROVIDER_REJECTED", "Luna zahteve ni sprejela.", false, providerStatus);
  }
  if (error && error.name === "AbortError") return transportError("LUNA_TIMEOUT", "Luna se ni pravočasno odzvala.", true, null, error);
  return transportError("LUNA_UNAVAILABLE", "Luna trenutno ni dosegljiva.", true, null, error);
}

function retryAfterMs(response) {
  if (!response || !response.headers || typeof response.headers.get !== "function") return null;
  var raw = response.headers.get("retry-after");
  if (!raw) return null;
  var seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  var dateMs = Date.parse(raw);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : null;
}

async function requestOpenAi(options) {
  options = options || {};
  if (typeof options.body !== "string" || !options.body || Buffer.byteLength(options.body, "utf8") > MAX_REQUEST_BODY_BYTES) {
    var requestError = new Error("Lunina zahteva ni veljavna.");
    requestError.code = "LUNA_INVALID_REQUEST";
    requestError.status = 400;
    requestError.retryable = false;
    throw requestError;
  }
  var fetchImpl = options.fetchImpl || fetch;
  var totalTimeoutMs = options.timeoutMs == null ? MODEL_TIMEOUT_MAX_MS : timeout(options.timeoutMs);
  var maxAttempts = Math.max(1, Math.min(RETRY_MAX_ATTEMPTS, Number(options.maxAttempts) || RETRY_MAX_ATTEMPTS));
  var startedAt = Date.now();
  var deadline = startedAt + totalTimeoutMs;
  var lastError = null;
  for (var attempt = 1; attempt <= maxAttempts; attempt += 1) {
    var remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      lastError = classifyTransportFailure({ name: "AbortError" });
      break;
    }
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, Math.min(MODEL_TIMEOUT_MS, remainingMs));
    var response = null;
    try {
      response = await fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: "Bearer " + options.apiKey, "Content-Type": "application/json" },
        body: options.body,
        signal: controller.signal,
      });
      var payload = await response.json().catch(function () { return {}; });
      if (response.ok) {
        var successElapsedMs = Date.now() - startedAt;
        if (attempt > 1) console.info("[atena-luna-transport]", JSON.stringify({ outcome: "recovered", attempts: attempt, elapsedMs: successElapsedMs, providerStatus: response.status }));
        return { response: response, payload: payload, attempts: attempt, elapsedMs: successElapsedMs };
      }
      lastError = classifyTransportFailure(null, response.status);
      lastError.retryAfterMs = retryAfterMs(response);
    } catch (error) {
      lastError = classifyTransportFailure(error);
    } finally {
      clearTimeout(timer);
    }
    lastError.attempts = attempt;
    lastError.elapsedMs = Date.now() - startedAt;
    if (!lastError.retryable || attempt >= maxAttempts) break;
    var delayMs = retryDelay(attempt, options.randomImpl, lastError.retryAfterMs);
    if (Date.now() + delayMs >= deadline) break;
    await wait(delayMs, options.sleepImpl);
  }
  if (!lastError) lastError = classifyTransportFailure({ name: "AbortError" });
  lastError.attempts = lastError.attempts || maxAttempts;
  lastError.elapsedMs = Date.now() - startedAt;
  console.warn("[atena-luna-transport]", JSON.stringify({
    outcome: "failed",
    code: lastError.code || "LUNA_UNAVAILABLE",
    attempts: lastError.attempts,
    elapsedMs: lastError.elapsedMs,
    providerStatus: lastError.providerStatus,
    causeName: lastError.causeName || null,
  }));
  throw lastError;
}

var SAFE_ERROR_CODES = new Set([
  "INVALID_TEXT", "INVALID_CLARIFICATION", "LUNA_NOT_CONFIGURED", "LUNA_TIMEOUT", "LUNA_UNAVAILABLE",
  "LUNA_RATE_LIMITED", "LUNA_PROVIDER_ERROR", "LUNA_PROVIDER_REJECTED", "LUNA_INVALID_AGREEMENT_PLAN",
  "LUNA_INVALID_GOAL_PLAN", "LUNA_INVALID_HISTORY_PLAN", "LUNA_INVALID_REQUEST", "AI_CAPACITY_UNAVAILABLE",
  "DOCUMENT_AI_TIMEOUT", "DOCUMENT_AI_RATE_LIMITED", "DOCUMENT_AI_PROVIDER_ERROR",
  "DOCUMENT_AI_UNAVAILABLE", "DOCUMENT_AI_INVALID_RESPONSE",
]);

function errorOutcome(error, fallbackMessage) {
  var known = error && SAFE_ERROR_CODES.has(error.code);
  var safeRetryAfterMs = known && Number.isFinite(Number(error.retryAfterMs))
    ? Math.max(0, Math.min(60000, Math.round(Number(error.retryAfterMs))))
    : undefined;
  return {
    statusCode: Number.isInteger(error && error.status) ? error.status : 503,
    payload: {
      ok: false,
      code: known ? error.code : "AI_UNAVAILABLE",
      retryable: known && error.retryable === true,
      retryAfterMs: safeRetryAfterMs,
      attempts: known && Number.isInteger(error.attempts) ? error.attempts : undefined,
      napaka: known && error.message ? error.message : fallbackMessage,
    },
  };
}

function ensureIdempotencyRuntime(runtime) {
  if (!runtime.cache) runtime.cache = new Map();
  if (!runtime.inflight) runtime.inflight = new Map();
  return runtime;
}

function isRetryableOutcome(outcome) {
  return Boolean(outcome && outcome.payload && outcome.payload.retryable === true);
}

function assertOutcome(outcome) {
  if (!isPlainObject(outcome) || !Number.isInteger(outcome.statusCode) || outcome.statusCode < 100 || outcome.statusCode > 599 || !isPlainObject(outcome.payload)) {
    var error = new Error("Atenin rezultat ni veljaven.");
    error.code = "AI_CAPACITY_UNAVAILABLE";
    error.status = 503;
    error.retryable = true;
    throw error;
  }
  return outcome;
}

function reserveRateLimit(users, userId, now, windowMs, maxRequests) {
  var entry = users.get(userId);
  if (!entry || now - entry.startedAt >= windowMs) entry = { startedAt: now, count: 0 };
  entry.count += 1;
  users.set(userId, entry);
  return entry.count <= maxRequests;
}

function distributedDecisionOutcome(decision, messages) {
  messages = messages || {};
  var action = String(decision && decision.action || "");
  var retryAfterMs = Math.max(250, Math.min(60000, Number(decision && decision.retryAfterMs) || 1000));
  if (action === "cached") {
    var statusCode = Number(decision.httpStatus);
    if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599 || !decision.payload || typeof decision.payload !== "object") {
      return { statusCode: 503, payload: { ok: false, code: "AI_CAPACITY_UNAVAILABLE", retryable: true, napaka: messages.unavailable || "Atena trenutno ni dosegljiva." } };
    }
    return { statusCode: statusCode, payload: decision.payload };
  }
  if (action === "conflict") return { statusCode: 409, payload: { ok: false, code: "REQUEST_ID_REUSED", retryable: false, napaka: "Ta zahteva je bila že uporabljena za drugo vsebino." } };
  if (action === "in_progress") return { statusCode: 409, payload: { ok: false, code: "AI_REQUEST_IN_PROGRESS", retryable: true, retryAfterMs: retryAfterMs, napaka: messages.inProgress || "Atena to zahtevo že obdeluje. Poskusite znova čez trenutek." } };
  if (action === "rate_limited") return { statusCode: 429, payload: { ok: false, code: "RATE_LIMITED", retryable: true, retryAfterMs: retryAfterMs, napaka: "Preveč zaporednih zahtev. Poskusite znova čez minuto." } };
  if (action === "busy") return { statusCode: 503, payload: { ok: false, code: "AI_BUSY", retryable: true, retryAfterMs: retryAfterMs, napaka: messages.busy || "Atena trenutno obdeluje več zahtev. Poskusite znova čez trenutek." } };
  if (action === "invalid") return { statusCode: 400, payload: { ok: false, code: "INVALID_INPUT", retryable: false, napaka: "Zahteva ni veljavna." } };
  return null;
}

function createDistributedCoordinator(options) {
  options = options || {};
  if (options.enabled === false || typeof options.rpc !== "function") return null;
  return {
    begin: async function () {
      var decision = await options.rpc("atena_begin_ai_request", {
        p_request_key: options.key,
        p_request_id: options.requestId,
        p_request_kind: options.kind,
        p_contract_version: options.contractVersion,
        p_fingerprint: options.fingerprint,
      });
      var blocked = distributedDecisionOutcome(decision, options.messages);
      if (blocked) return { outcome: blocked };
      if (!decision || decision.action !== "start" || !/^[0-9a-f-]{36}$/i.test(String(decision.leaseToken || ""))) {
        var error = new Error(options.unavailableMessage || "Atenin sprejemnik zahtev ni dosegljiv.");
        error.code = "AI_CAPACITY_UNAVAILABLE";
        error.status = 503;
        error.retryable = true;
        throw error;
      }
      return { leaseToken: String(decision.leaseToken) };
    },
    finish: async function (leaseToken, outcome) {
      var payload = {
        p_request_key: options.key,
        p_fingerprint: options.fingerprint,
        p_lease_token: leaseToken,
        p_http_status: outcome.statusCode,
        p_payload: outcome.payload,
      };
      function verified(result) {
        if (result && result.ok === true) return result;
        var error = new Error("Atenin zaključek zahteve ni bil potrjen.");
        error.code = "AI_ADMISSION_FINISH_FAILED";
        error.retryable = true;
        throw error;
      }
      try {
        return verified(await options.rpc("atena_finish_ai_request", payload));
      } catch (_firstError) {
        await wait(100);
        return verified(await options.rpc("atena_finish_ai_request", payload));
      }
    },
  };
}

async function executeIdempotent(runtime, options, operation) {
  ensureIdempotencyRuntime(runtime);
  var cached = runtime.cache.get(options.key);
  if (cached) {
    if (cached.fingerprint !== options.fingerprint) return { statusCode: 409, payload: { ok: false, code: "REQUEST_ID_REUSED", retryable: false, napaka: "Ta zahteva je bila že uporabljena za drugo vsebino." } };
    return assertOutcome(cached.outcome || { statusCode: 200, payload: cached.payload });
  }
  var active = runtime.inflight.get(options.key);
  if (active) {
    if (active.fingerprint !== options.fingerprint) return { statusCode: 409, payload: { ok: false, code: "REQUEST_ID_REUSED", retryable: false, napaka: "Ta zahteva se že izvaja z drugo vsebino." } };
    return active.promise;
  }
  if (typeof options.beforeStart === "function") {
    var blocked = options.beforeStart();
    if (blocked) return assertOutcome(blocked);
  }
  var entry = { fingerprint: options.fingerprint, promise: null };
  entry.promise = Promise.resolve().then(async function () {
    var admission = options.coordinator ? await options.coordinator.begin() : null;
    if (admission && admission.outcome) return assertOutcome(admission.outcome);
    var outcome;
    try {
      outcome = await operation();
    } catch (error) {
      outcome = errorOutcome(error, options.fallbackMessage || "Atena trenutno ni dosegljiva.");
    }
    outcome = assertOutcome(outcome);
    if (admission && admission.leaseToken) {
      try {
        await options.coordinator.finish(admission.leaseToken, outcome);
      } catch (finishError) {
        entry.distributedPersistenceFailed = true;
        console.warn("[atena-admission-finish]", JSON.stringify({
          code: String(finishError && (finishError.code || finishError.name) || "UNKNOWN"),
          causeName: String(finishError && finishError.name || "Error"),
        }));
      }
    }
    return outcome;
  }).then(function (outcome) {
    if (!entry.distributedPersistenceFailed && !isRetryableOutcome(outcome)) runtime.cache.set(options.key, { createdAt: Date.now(), fingerprint: options.fingerprint, outcome: outcome, payload: outcome.payload });
    return outcome;
  }).catch(function (error) {
    var outcome = errorOutcome(error, options.fallbackMessage || "Atena trenutno ni dosegljiva.");
    if (!entry.distributedPersistenceFailed && !isRetryableOutcome(outcome)) runtime.cache.set(options.key, { createdAt: Date.now(), fingerprint: options.fingerprint, outcome: outcome, payload: outcome.payload });
    return outcome;
  }).finally(function () {
    if (runtime.inflight.get(options.key) === entry) runtime.inflight.delete(options.key);
  });
  runtime.inflight.set(options.key, entry);
  return entry.promise;
}

module.exports = Object.freeze({
  MODEL: MODEL,
  REASONING_EFFORT: REASONING_EFFORT,
  MAX_OUTPUT_TOKENS: MAX_OUTPUT_TOKENS,
  MODEL_TIMEOUT_MS: MODEL_TIMEOUT_MS,
  MODEL_TIMEOUT_MAX_MS: MODEL_TIMEOUT_MAX_MS,
  MAX_SOURCE_TEXT_LENGTH: MAX_SOURCE_TEXT_LENGTH,
  MAX_CLARIFICATION_ANSWER_LENGTH: MAX_CLARIFICATION_ANSWER_LENGTH,
  MAX_CLARIFICATION_ROUNDS: MAX_CLARIFICATION_ROUNDS,
  MAX_STRUCTURED_ITEMS: MAX_STRUCTURED_ITEMS,
  MAX_REQUEST_BODY_BYTES: MAX_REQUEST_BODY_BYTES,
  REQUESTS_PER_MINUTE: REQUESTS_PER_MINUTE,
  RETRY_MAX_ATTEMPTS: RETRY_MAX_ATTEMPTS,
  SEMANTIC_AUTHORITY_VERSION: SEMANTIC_AUTHORITY_VERSION,
  REASONING_METHOD_VERSION: REASONING_METHOD_VERSION,
  REQUEST_PROFILES: REQUEST_PROFILES,
  ADAPTER_OPERATIONS: ADAPTER_OPERATIONS,
  semanticAuthorityInstructions: semanticAuthorityInstructions,
  reasoningMethodInstructions: reasoningMethodInstructions,
  assertAdapterOperations: assertAdapterOperations,
  isPlainObject: isPlainObject,
  hasExactKeys: hasExactKeys,
  exactEvidenceSpan: exactEvidenceSpan,
  evidenceIsLinked: evidenceIsLinked,
  validClarification: validClarification,
  responseText: responseText,
  assertPortableResponseSchema: assertPortableResponseSchema,
  requestProfile: requestProfile,
  requestDefaults: requestDefaults,
  timeout: timeout,
  retryDelay: retryDelay,
  classifyTransportFailure: classifyTransportFailure,
  requestOpenAi: requestOpenAi,
  errorOutcome: errorOutcome,
  ensureIdempotencyRuntime: ensureIdempotencyRuntime,
  reserveRateLimit: reserveRateLimit,
  distributedDecisionOutcome: distributedDecisionOutcome,
  createDistributedCoordinator: createDistributedCoordinator,
  executeIdempotent: executeIdempotent,
});
