"use strict";

function capacityError(code, message, retryAfterMs) {
  var error = new Error(message || "Strežnik trenutno obdeluje več zahtev.");
  error.code = code || "RUNTIME_CAPACITY_BUSY";
  error.status = 503;
  error.retryable = true;
  error.retryAfterMs = Math.max(250, Number(retryAfterMs) || 1000);
  return error;
}

function createGate(options) {
  options = options || {};
  var maxActive = Math.max(1, Math.min(32, Number(options.maxActive) || 2));
  var maxQueue = Math.max(0, Math.min(500, Number(options.maxQueue) || 32));
  var waitTimeoutMs = Math.max(250, Math.min(30000, Number(options.waitTimeoutMs) || 8000));
  var active = 0;
  var maxObservedActive = 0;
  var queue = [];
  var inflight = new Map();

  function release() {
    active = Math.max(0, active - 1);
    while (queue.length) {
      var next = queue.shift();
      if (next.done) continue;
      next.done = true;
      clearTimeout(next.timer);
      active += 1;
      maxObservedActive = Math.max(maxObservedActive, active);
      next.resolve();
      break;
    }
  }

  function acquire() {
    if (active < maxActive) {
      active += 1;
      maxObservedActive = Math.max(maxObservedActive, active);
      return Promise.resolve();
    }
    if (queue.length >= maxQueue) {
      return Promise.reject(capacityError("RUNTIME_CAPACITY_BUSY", options.busyMessage, options.retryAfterMs));
    }
    return new Promise(function (resolve, reject) {
      var entry = { resolve: resolve, reject: reject, done: false, timer: null };
      entry.timer = setTimeout(function () {
        if (entry.done) return;
        entry.done = true;
        var index = queue.indexOf(entry);
        if (index >= 0) queue.splice(index, 1);
        reject(capacityError("RUNTIME_CAPACITY_TIMEOUT", options.timeoutMessage || options.busyMessage, options.retryAfterMs));
      }, waitTimeoutMs);
      queue.push(entry);
    });
  }

  function run(key, operation) {
    var normalizedKey = String(key || "");
    if (normalizedKey && inflight.has(normalizedKey)) return inflight.get(normalizedKey);
    var acquired = false;
    var promise = acquire().then(function () {
      acquired = true;
      return operation();
    }).finally(function () {
      if (acquired) release();
    });
    if (normalizedKey) {
      inflight.set(normalizedKey, promise);
      promise.finally(function () {
        if (inflight.get(normalizedKey) === promise) inflight.delete(normalizedKey);
      }).catch(function () {});
    }
    return promise;
  }

  return {
    run: run,
    stats: function () { return { active: active, queued: queue.length, inflight: inflight.size, maxObservedActive: maxObservedActive, maxActive: maxActive, maxQueue: maxQueue }; },
  };
}

var gates = globalThis.__UJ_RUNTIME_CAPACITY_GATES__ || new Map();
globalThis.__UJ_RUNTIME_CAPACITY_GATES__ = gates;

function sharedGate(name, options) {
  var key = String(name || "default");
  if (!gates.has(key)) gates.set(key, createGate(options));
  return gates.get(key);
}

module.exports = { capacityError: capacityError, createGate: createGate, sharedGate: sharedGate };
