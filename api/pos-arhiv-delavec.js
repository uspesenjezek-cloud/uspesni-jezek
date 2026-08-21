"use strict";

const crypto = require("crypto");
const supabase = require("./_lib/supabase-server");
const archive = require("./_lib/pos-archive");

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(body));
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { ok: false });
  const expected = String(process.env.CRON_SECRET || "");
  const provided = String(req.headers && req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(provided, expected)) return json(res, 401, { ok: false });
  let cfg;
  try { cfg = supabase.konfiguracija(); }
  catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }

  try {
    const rows = await supabase.pokliciRpc(cfg, "pos_archive_integrity_batch", { p_limit: 10 });
    const counts = { verified: 0, failed: 0 };
    for (const record of (Array.isArray(rows) ? rows : [])) {
      const result = await archive.verifyAndRecord(cfg, record);
      if (result.verification.result === "verified") counts.verified += 1;
      else counts.failed += 1;
    }
    return json(res, counts.failed ? 409 : 200, { ok: counts.failed === 0, checked: counts.verified + counts.failed, counts: counts });
  } catch (error) {
    return json(res, Number(error && error.status || 500), { ok: false, napaka: "Periodično preverjanje arhiva ni uspelo." });
  }
};
