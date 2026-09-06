"use strict";

/*
 * Enoten, enoklicni AI SDK transport za Atenine strukturirane Luna tokove.
 * Semantika ostane v posameznem toku; ta modul upravlja samo ponudnika,
 * Zod-validacijo, omejen transportni retry, timeout in merjenje porabe.
 */

var ai = require("ai");
var createOpenAI = require("@ai-sdk/openai").createOpenAI;
var lunaPolicy = require("./atena-luna-policy");

var SDK_ADAPTER_VERSION = "atena-ai-sdk-v1";

function numeric(value) {
  var number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function usageShape(usage) {
  usage = usage || {};
  return {
    inputTokens: numeric(usage.inputTokens),
    outputTokens: numeric(usage.outputTokens),
    totalTokens: numeric(usage.totalTokens),
  };
}

function nestedValue(error, key) {
  var current = error;
  for (var depth = 0; current && depth < 8; depth += 1) {
    if (current[key] != null) return current[key];
    current = current.cause;
  }
  return null;
}

function isStructuredOutputError(error) {
  return ai.NoObjectGeneratedError.isInstance(error) || ai.NoOutputGeneratedError.isInstance(error);
}

function retryAfterMs(error) {
  var headers = nestedValue(error, "responseHeaders");
  var raw = headers && (headers["retry-after"] || headers["Retry-After"]);
  if (!raw) return null;
  var seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  var dateMs = Date.parse(raw);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : null;
}

function legacyResponsesPayload(payload, model) {
  payload = payload && typeof payload === "object" ? payload : {};
  if (Array.isArray(payload.output)) return payload;
  if (typeof payload.output_text !== "string") return payload;
  return {
    id: "resp_atena_test",
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    status: "completed",
    incomplete_details: null,
    model: model,
    output: [{
      id: "msg_atena_test",
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text: payload.output_text, annotations: [] }],
    }],
    usage: payload.usage || {
      input_tokens: 0,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: 0,
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: 0,
    },
  };
}

function sdkFetch(fetchImpl, model, telemetry, legacyRequestBody) {
  var implementation = fetchImpl || fetch;
  return async function (input, init) {
    telemetry.calls += 1;
    var delegatedInit = fetchImpl && typeof legacyRequestBody === "string"
      ? Object.assign({}, init, { body: legacyRequestBody })
      : init;
    var response = await implementation(input, delegatedInit);
    if (typeof Response !== "undefined" && response instanceof Response) return response;
    if (!response || typeof response.json !== "function") return response;
    var payload = await response.json().catch(function () { return {}; });
    var headers = new Headers({ "content-type": "application/json" });
    if (response.headers && typeof response.headers.get === "function") {
      var retryAfter = response.headers.get("retry-after");
      if (retryAfter) headers.set("retry-after", retryAfter);
    }
    return new Response(JSON.stringify(legacyResponsesPayload(payload, model)), {
      status: Number(response.status) || (response.ok === false ? 500 : 200),
      headers: headers,
    });
  };
}

function sleep(ms, sleepImpl) {
  if (typeof sleepImpl === "function") return sleepImpl(ms);
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function generateStructured(options) {
  options = options || {};
  if (!options.apiKey || !options.schema || !options.schemaName || !options.model) {
    var setupError = new Error("ATENA_AI_SDK_INVALID_CONFIGURATION");
    setupError.code = "ATENA_AI_SDK_INVALID_CONFIGURATION";
    throw setupError;
  }
  var measuredBytes = Buffer.byteLength(String(options.instructions || "") + String(options.input || ""), "utf8");
  var requestBytes = Number.isFinite(Number(options.requestBytes)) ? Number(options.requestBytes) : measuredBytes;
  if (requestBytes > lunaPolicy.MAX_REQUEST_BODY_BYTES) {
    var requestError = new Error("Lunina zahteva ni veljavna.");
    requestError.code = "LUNA_INVALID_REQUEST";
    requestError.status = 400;
    requestError.retryable = false;
    throw requestError;
  }
  var maxAttempts = Math.max(1, Math.min(lunaPolicy.RETRY_MAX_ATTEMPTS, Number(options.maxAttempts) || lunaPolicy.RETRY_MAX_ATTEMPTS));
  var totalTimeoutMs = options.timeoutMs == null ? lunaPolicy.MODEL_TIMEOUT_MAX_MS : lunaPolicy.timeout(options.timeoutMs);
  var startedAt = Date.now();
  var deadline = startedAt + totalTimeoutMs;
  var telemetry = { calls: 0 };
  var provider = createOpenAI({ apiKey: options.apiKey, fetch: sdkFetch(options.fetchImpl, options.model, telemetry, options.legacyRequestBody) });
  var lastError = null;

  for (var attempt = 1; attempt <= maxAttempts; attempt += 1) {
    var remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      lastError = lunaPolicy.classifyTransportFailure({ name: "AbortError" });
      break;
    }
    try {
      var result = await ai.generateText({
        model: provider.responses(options.model),
        system: String(options.instructions || ""),
        prompt: String(options.input || ""),
        output: ai.Output.object({ name: options.schemaName, schema: options.schema }),
        maxOutputTokens: Number(options.maxOutputTokens) || lunaPolicy.MAX_OUTPUT_TOKENS,
        maxRetries: 0,
        timeout: Math.min(lunaPolicy.MODEL_TIMEOUT_MS, remainingMs),
        providerOptions: { openai: {
          store: false,
          safetyIdentifier: options.safetyIdentifier || undefined,
          reasoningEffort: options.reasoningEffort || lunaPolicy.REASONING_EFFORT,
          reasoningSummary: null,
          promptCacheKey: options.promptCacheKey || undefined,
          promptCacheRetention: options.promptCacheRetention || undefined,
          textVerbosity: options.textVerbosity || undefined,
        } },
      });
      return {
        output: result.output,
        usage: usageShape(result.usage),
        attempts: attempt,
        calls: telemetry.calls,
        elapsedMs: Date.now() - startedAt,
        adapterVersion: SDK_ADAPTER_VERSION,
      };
    } catch (error) {
      if (isStructuredOutputError(error)) {
        error.code = "ATENA_AI_SDK_INVALID_OUTPUT";
        error.retryable = false;
        error.attempts = attempt;
        error.elapsedMs = Date.now() - startedAt;
        throw error;
      }
      var statusCode = Number(nestedValue(error, "statusCode"));
      var errorName = nestedValue(error, "name");
      lastError = lunaPolicy.classifyTransportFailure(errorName === "AbortError" ? { name: "AbortError" } : error, Number.isInteger(statusCode) && statusCode > 0 ? statusCode : undefined);
      lastError.attempts = attempt;
      lastError.elapsedMs = Date.now() - startedAt;
      lastError.retryAfterMs = retryAfterMs(error);
      if (!lastError.retryable || attempt >= maxAttempts) break;
      var delayMs = lunaPolicy.retryDelay(attempt, options.randomImpl, lastError.retryAfterMs);
      if (Date.now() + delayMs >= deadline) break;
      await sleep(delayMs, options.sleepImpl);
    }
  }
  if (!lastError) lastError = lunaPolicy.classifyTransportFailure({ name: "AbortError" });
  lastError.attempts = lastError.attempts || maxAttempts;
  lastError.elapsedMs = Date.now() - startedAt;
  throw lastError;
}

module.exports = {
  SDK_ADAPTER_VERSION: SDK_ADAPTER_VERSION,
  generateStructured: generateStructured,
  isStructuredOutputError: isStructuredOutputError,
  _test: { legacyResponsesPayload: legacyResponsesPayload, usageShape: usageShape },
};
