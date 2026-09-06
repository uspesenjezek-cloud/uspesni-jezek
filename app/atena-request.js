(function (root) {
  "use strict";

  var DEFAULT_TIMEOUT_MS = 50000;

  function create(options) {
    options = options || {};
    var timeoutMs = Math.max(1000, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS);
    var controller = new AbortController();
    var timeoutReached = false;
    var disposed = false;
    var timer = root.setTimeout(function () {
      timer = 0;
      disposed = true;
      timeoutReached = true;
      controller.abort();
    }, timeoutMs);
    function dispose() {
      if (disposed) return;
      disposed = true;
      root.clearTimeout(timer);
      timer = 0;
    }
    function abort() {
      dispose();
      if (!controller.signal.aborted) controller.abort();
    }
    return {
      signal: controller.signal,
      abort: abort,
      timedOut: function () { return timeoutReached; },
      dispose: dispose,
    };
  }

  function createRetryGate(options) {
    options = options || {};
    var now = typeof options.now === "function" ? options.now : Date.now;
    var setIntervalFn = options.setInterval || root.setInterval.bind(root);
    var clearIntervalFn = options.clearInterval || root.clearInterval.bind(root);
    var onTick = typeof options.onTick === "function" ? options.onTick : function () {};
    var blockedUntil = 0;
    var timer = 0;

    function remainingMs() { return Math.max(0, blockedUntil - now()); }
    function dispose() {
      if (timer) clearIntervalFn(timer);
      timer = 0;
    }
    function tick() {
      if (!remainingMs()) dispose();
      onTick(remainingMs());
    }
    function block(retryAfterMs) {
      var duration = Math.max(0, Number(retryAfterMs) || 0);
      dispose();
      blockedUntil = duration ? now() + duration : 0;
      if (duration) timer = setIntervalFn(tick, 250);
      tick();
    }
    return {
      block: block,
      isBlocked: function () { return remainingMs() > 0; },
      remainingMs: remainingMs,
      dispose: dispose,
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
    createRetryGate: createRetryGate,
    errorFromPayload: errorFromPayload,
    networkError: networkError,
    isRetryable: isRetryable,
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
