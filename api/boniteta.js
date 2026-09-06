"use strict";

const handlers = Object.freeze({
  soft: require("./_handlers/mehka-boniteta"),
  details: require("./_handlers/mehka-boniteta-podrobnosti"),
  job: require("./_handlers/mehka-boniteta-opravilo"),
  pro: require("./_handlers/boniteta-pro"),
});

function route(req) {
  if (req.query && req.query.handler) return String(req.query.handler);
  try { return new URL(req.url, "http://localhost").searchParams.get("handler") || ""; }
  catch (_) { return ""; }
}

module.exports = function handler(req, res) {
  // Brez lastnostne preverbe bi ?handler=constructor / toString / __proto__
  // nasel podedovano lastnost z Object.prototype in jo poskusil poklicati
  // kot rokovalnik. Zahteva ostane brez odgovora, namesto da vrne 404.
  const pot = route(req);
  const selected = Object.prototype.hasOwnProperty.call(handlers, pot) ? handlers[pot] : null;
  if (typeof selected !== "function") return res.status(404).json({ ok: false, napaka: "Neznana bonitetna pot." });
  return selected(req, res);
};

module.exports._test = { route };
