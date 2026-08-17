(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var host = window.location.hostname;
  var isPrivateHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    /^192\.168\./.test(host) ||
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);

  if (!isPrivateHost || params.get("app") !== "1") return;

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

  async function checkForChanges() {
    if (document.hidden || checking || reloading) return;
    checking = true;
    try {
      var signature = await readSignature();
      if (baseline === null) {
        baseline = signature;
      } else if (signature !== baseline) {
        reloading = true;
        var nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("_dev", String(Date.now()));
        window.location.replace(nextUrl.href);
      }
    } finally {
      checking = false;
    }
  }

  window.addEventListener("pageshow", checkForChanges);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) checkForChanges();
  });
  window.setInterval(checkForChanges, 2500);
  checkForChanges();
})();
