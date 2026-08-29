(function () {
  "use strict";

  var zahtevanoSamodejnoOsvezevanje =
    new URLSearchParams(window.location.search).get("app-auto-refresh") === "1";

  var host = window.location.hostname;
  var isPrivateHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    /^192\.168\./.test(host) ||
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  var samodejnoOsvezevanje = zahtevanoSamodejnoOsvezevanje || isPrivateHost;
  if (!samodejnoOsvezevanje) return;
  var isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (!isPrivateHost && !isStandalone) return;

  var buildElement = document.querySelector('meta[name="uj-build-version"]');
  var documentBuild = buildElement ? buildElement.getAttribute("content") || "" : "";

  var watchedUrls = [new URL(window.location.pathname, window.location.href).href];
  document.querySelectorAll('link[rel="stylesheet"][href], script[src]').forEach(function (element) {
    var value = element.href || element.src;
    if (!value) return;
    var url = new URL(value, window.location.href);
    if (url.origin === window.location.origin) watchedUrls.push(url.href);
  });

  var baseline = null;
  var checking = false;
  var reloading = false;

  function reloadFreshPage() {
    reloading = true;
    var nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("_dev", String(Date.now()));
    window.location.replace(nextUrl.href);
  }

  function header(response, name) {
    return response.headers.get(name) || "";
  }

  async function readSignature() {
    var parts = await Promise.all(
      watchedUrls.map(async function (url) {
        try {
          var response = await fetch(url, {
            method: "HEAD",
            cache: "no-store",
            credentials: "same-origin"
          });
          return [
            url,
            response.status,
            header(response, "etag"),
            header(response, "last-modified"),
            header(response, "content-length")
          ].join("|");
        } catch (_error) {
          return url + "|unavailable";
        }
      })
    );
    return parts.join("\n");
  }

  async function readServerBuild() {
    try {
      var pageUrl = new URL(window.location.href);
      pageUrl.hash = "";
      pageUrl.searchParams.set("_uj_check", String(Date.now()));
      var response = await fetch(pageUrl.href, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Cache-Control": "no-cache" }
      });
      if (!response.ok) return "";
      var html = await response.text();
      var match = html.match(
        /<meta\s+name=["']uj-build-version["']\s+content=["']([^"']+)["']/i
      );
      return match ? match[1] : "";
    } catch (_error) {
      return "";
    }
  }

  async function checkForChanges() {
    if (document.hidden || checking || reloading) return;
    checking = true;
    try {
      var serverBuild = await readServerBuild();
      if (documentBuild && serverBuild && serverBuild !== documentBuild) {
        reloadFreshPage();
        return;
      }

      var signature = await readSignature();
      if (baseline === null) {
        baseline = signature;
      } else if (signature !== baseline) {
        reloadFreshPage();
      }
    } finally {
      checking = false;
    }
  }

  window.addEventListener("pageshow", checkForChanges);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) checkForChanges();
  });
  if (isPrivateHost) window.setInterval(checkForChanges, 2500);
  checkForChanges();
})();
