"use strict";

const handlers = Object.freeze({
  soft: require("./_handlers/mehka-boniteta"),
  job: require("./_handlers/mehka-boniteta-opravilo"),
  pro: require("./_handlers/boniteta-pro"),
});

function route(req) {
  if (req.query && req.query.handler) return String(req.query.handler);
  try { return new URL(req.url, "http://localhost").searchParams.get("handler") || ""; }
  catch (_) { return ""; }
}

module.exports = function handler(req, res) {
  const selected = handlers[route(req)];
  if (!selected) return res.status(404).json({ ok: false, napaka: "Neznana bonitetna pot." });
  return selected(req, res);
};

module.exports._test = { route };
