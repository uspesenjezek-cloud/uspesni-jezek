"use strict";

function jeLoopback(req) {
  var naslov = String(req && req.socket && req.socket.remoteAddress || "").toLowerCase();
  return naslov === "127.0.0.1" || naslov === "::1" || naslov === "::ffff:127.0.0.1";
}

function preveri(req) {
  if (process.env.UJ_LOCAL_PREVIEW_SERVER !== "true") return null;
  if (!jeLoopback(req)) return null;
  if (String(req && req.headers && req.headers["x-uj-local-preview"] || "") !== "1") return null;
  if (!/^Bearer\s+local-preview$/i.test(String(req && req.headers && req.headers.authorization || ""))) return null;
  return {
    ok: true,
    user: { id: "00000000-0000-4000-8000-000000000001", email: "local-preview@localhost" },
    token: "local-preview",
    verification: "local_preview_loopback",
  };
}

module.exports = { preveri: preveri, _test: { jeLoopback: jeLoopback } };
