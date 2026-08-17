"use strict";

var Sentry = require("@sentry/node");
var initialized = false;

function cleanPath(value) {
  return String(value || "/")
    .split("?")[0]
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id")
    .replace(/\/(?:\d{5,}|[A-Za-z0-9_-]{24,})(?=\/|$)/g, "/:id");
}

function scrubEvent(event) {
  delete event.user;
  delete event.request;
  delete event.extra;
  delete event.breadcrumbs;

  if (event.contexts) {
    delete event.contexts.request;
    delete event.contexts.response;
  }

  if (event.exception && Array.isArray(event.exception.values)) {
    event.exception.values.forEach(function (value) {
      value.value = value.type || "Server error";
    });
  }

  if (event.message) event.message = "Server error";
  return event;
}

function ensureInitialized() {
  if (initialized || !process.env.SENTRY_DSN) return Boolean(process.env.SENTRY_DSN);

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeBreadcrumb: function () { return null; },
    beforeSend: scrubEvent,
  });
  initialized = true;
  return true;
}

function captureError(error, context) {
  if (!ensureInitialized()) return null;
  context = context || {};

  return Sentry.withScope(function (scope) {
    if (context.endpoint) scope.setTag("app.endpoint", cleanPath(context.endpoint).slice(0, 100));
    if (context.method) scope.setTag("http.method", String(context.method).slice(0, 12));
    if (context.area) scope.setTag("app.area", String(context.area).slice(0, 60));
    return Sentry.captureException(error instanceof Error ? error : new Error("Server error"));
  });
}

function wrapHandler(handler, endpoint) {
  var wrapped = async function sentryWrappedHandler(req, res) {
    try {
      return await handler(req, res);
    } catch (error) {
      captureError(error, {
        endpoint: endpoint || (req && req.url),
        method: req && req.method,
      });
      if (initialized) await Sentry.flush(1500).catch(function () {});
      throw error;
    }
  };

  Object.keys(handler).forEach(function (key) {
    wrapped[key] = handler[key];
  });
  return wrapped;
}

module.exports = {
  captureError: captureError,
  wrapHandler: wrapHandler,
  flush: function (timeout) {
    return initialized ? Sentry.flush(timeout || 1500) : Promise.resolve(true);
  },
  _test: { cleanPath: cleanPath, scrubEvent: scrubEvent },
};
