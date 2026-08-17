import * as Sentry from "@sentry/browser";

(function zacetekSentryja() {
  "use strict";

  var config = globalThis.SENTRY_CONFIG ||
    (typeof SENTRY_CONFIG !== "undefined" ? SENTRY_CONFIG : {});
  if (!config.dsn || !/^https:\/\//i.test(String(config.dsn))) return;

  function varnaPot(pathname) {
    return String(pathname || "/")
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id")
      .replace(/\/(?:\d{5,}|[A-Za-z0-9_-]{24,})(?=\/|$)/g, "/:id");
  }

  function pocistiDogodek(event) {
    delete event.user;
    delete event.request;
    delete event.extra;
    delete event.breadcrumbs;

    if (event.contexts) {
      delete event.contexts.response;
      delete event.contexts.request;
    }

    if (event.exception && Array.isArray(event.exception.values)) {
      event.exception.values.forEach(function (value) {
        value.value = value.type || "JavaScript error";
      });
    }

    if (event.message) event.message = "Client error";
    event.transaction = varnaPot(globalThis.location && globalThis.location.pathname);
    return event;
  }

  Sentry.init({
    dsn: String(config.dsn),
    environment: String(config.environment || "production"),
    release: config.release ? String(config.release) : undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeBreadcrumb: function () { return null; },
    beforeSend: pocistiDogodek,
  });

  if (globalThis.document && globalThis.document.documentElement) {
    globalThis.document.documentElement.setAttribute("data-sentry-ready", "true");
  }

  globalThis.UspesniJezekSentry = Object.freeze({
    captureException: function (error, area) {
      Sentry.withScope(function (scope) {
        if (area) scope.setTag("app.area", String(area).slice(0, 60));
        Sentry.captureException(error);
      });
    },
  });
})();
