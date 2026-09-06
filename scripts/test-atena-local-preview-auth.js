"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var auth = require("../api/_lib/atena-local-preview-auth");

var previous = process.env.UJ_LOCAL_PREVIEW_SERVER;
function request(address, token, preview) {
  return { socket: { remoteAddress: address }, headers: { authorization: token, "x-uj-local-preview": preview } };
}

try {
  delete process.env.UJ_LOCAL_PREVIEW_SERVER;
  assert.equal(auth.preveri(request("127.0.0.1", "Bearer local-preview", "1")), null, "produkcijski proces ne sme sprejeti lokalnega žetona");
  process.env.UJ_LOCAL_PREVIEW_SERVER = "true";
  assert.equal(auth.preveri(request("10.0.0.5", "Bearer local-preview", "1")), null, "nelokalni odjemalec ne sme uporabiti predoglednega žetona");
  assert.equal(auth.preveri(request("127.0.0.1", "Bearer wrong", "1")), null);
  assert.equal(auth.preveri(request("127.0.0.1", "Bearer local-preview", "0")), null);
  assert.equal(auth.preveri(request("::1", "Bearer local-preview", "1")).verification, "local_preview_loopback");
  assert.equal(auth.preveri(request("::ffff:127.0.0.1", "Bearer local-preview", "1")).user.id, "00000000-0000-4000-8000-000000000001");

  var root = path.join(__dirname, "..");
  var goalUi = fs.readFileSync(path.join(root, "app", "neplacila-cilj.js"), "utf8");
  var historyUi = fs.readFileSync(path.join(root, "app", "neplacila-zgodovina.js"), "utf8");
  var authGuard = fs.readFileSync(path.join(root, "app", "auth-zascita.js"), "utf8");
  var goalHtml = fs.readFileSync(path.join(root, "app", "neplacila-cilj.html"), "utf8");
  var historyHtml = fs.readFileSync(path.join(root, "app", "neplacila-zgodovina.html"), "utf8");
  var server = fs.readFileSync(path.join(root, "scripts", "local-server.js"), "utf8");
  [goalUi, historyUi].forEach(function (source) {
    assert.match(source, /app-preview/);
    assert.match(source, /UJ_LOKALNI_APP_PREDOGLED === true/);
    assert.match(source, /sessionStorage\.getItem\("app-iphone-preview"\) === "1"/);
    assert.match(source, /return "local-preview"/);
    assert.match(source, /X-UJ-Local-Preview/);
  });
  assert.match(authGuard, /UJ_LOKALNI_APP_PREDOGLED/);
  assert.match(authGuard, /lokalniNaslov\.searchParams\.set\("app-preview", "1"\)/);
  assert.match(authGuard, /window\.history\.replaceState\(window\.history\.state, "", lokalniNaslov\.href\)/);
  [goalHtml, historyHtml].forEach(function (source) {
    assert.match(source, /auth-zascita\.js\?v=20260830-preview-continuity-v1/);
    assert.match(source, /preview-continuity-v1/);
  });
  assert.match(server, /process\.env\.UJ_LOCAL_PREVIEW_SERVER = "true"/);
  ["razcleni-cilj.js", "razcleni-dogovor.js", "razcleni-zgodovino.js"].forEach(function (file) {
    var source = fs.readFileSync(path.join(root, "api", "_handlers", file), "utf8");
    assert.match(source, /localPreviewAuth\.preveri\(req\) \|\| await db\.preveriUporabnika/);
  });
  console.log("OK Atena local preview auth: loopback-only žeton za cilj, dogovor in zgodovino; produkcijski auth ostane obvezen");
} finally {
  if (previous == null) delete process.env.UJ_LOCAL_PREVIEW_SERVER;
  else process.env.UJ_LOCAL_PREVIEW_SERVER = previous;
}
