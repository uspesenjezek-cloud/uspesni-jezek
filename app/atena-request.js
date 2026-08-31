(function (root) {
  "use strict";

  var DEFAULT_TIMEOUT_MS = 50000;

  function create(options) {
    options = options || {};
    var timeoutMs = Math.max(1000, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS);
    var controller = new AbortController();
    var timeoutReached = false;
    var timer = root.setTimeout(function () {
      timeoutReached = true;
      controller.abort();
    }, timeoutMs);
    return {
      signal: controller.signal,
      abort: function () { controller.abort(); },
      timedOut: function () { return timeoutReached; },
      dispose: function () { root.clearTimeout(timer); },
    };
  }

  function errorFromPayload(payload, fallbackMessage) {
    payload = payload && typeof payload === "object" ? payload : {};
    var error = new Error(String(payload.napaka || fallbackMessage || "Atenina zahteva ni uspela."));
    error.code = String(payload.code || "AI_UNAVAILABLE").slice(0, 80);
    error.retryable = payload.retryable === true;
    error.retryAfterMs = Number.isFinite(Number(payload.retryAfterMs)) ? Number(payload.retryAfterMs) : null;
    return error;
  }

  function isRetryable(error) {
    return Boolean(error && (
      error.retryable === true ||
      error.code === "NETWORK_ERROR" ||
      error.name === "TimeoutError" ||
      error.name === "AbortError"
    ));
  }

  function networkError(error) {
    if (error && error.name === "TypeError") {
      error.code = "NETWORK_ERROR";
      error.retryable = true;
    }
    return error;
  }

  root.UJAtenaRequest = Object.freeze({
    DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
    create: create,
    errorFromPayload: errorFromPayload,
    networkError: networkError,
    isRetryable: isRetryable,
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
