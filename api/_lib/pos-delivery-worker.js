"use strict";

const crypto = require("node:crypto");
const supabase = require("./supabase-server");
const { processClaimed, rpcRow } = require("./pos-delivery-runner");
const { deliveryReadiness } = require("./pos-delivery-providers");

const MAX_PER_RUN = 3;

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(body));
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function bearer(req) {
  const match = String(req.headers && req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function cronAuthorized(req) {
  const secret = String(process.env.CRON_SECRET || "");
  return secret.length >= 16 && safeEqual(bearer(req), secret);
}

function candidateQuery(status, at, limit, provider, isTest) {
  const timeColumn = status === "processing" ? "locked_at" : "next_attempt_at";
  const operator = status === "processing" ? "lt" : "lte";
  return "status=eq." + status +
    "&provider=eq." + encodeURIComponent(provider || "sandbox") +
    "&is_test=eq." + (isTest === false ? "false" : "true") +
    "&" + timeColumn + "=" + operator + "." + encodeURIComponent(at) +
    "&select=*&order=" + timeColumn + ".asc&limit=" + Math.max(1, Math.min(MAX_PER_RUN, Number(limit) || 1));
}

async function modeCandidates(cfg, limit, provider, isTest, now) {
  const queued = await supabase.pridobiVrstice(cfg, "pos_invoice_deliveries", candidateQuery("queued", now.toISOString(), limit, provider, isTest));
  const remaining = Math.max(0, limit - queued.length);
  if (!remaining) return queued.slice(0, limit);
  const staleAt = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
  const stale = await supabase.pridobiVrstice(cfg, "pos_invoice_deliveries", candidateQuery("processing", staleAt, remaining, provider, isTest));
  return queued.concat(stale);
}

async function candidates(cfg, limit) {
  const now = new Date();
  const rows = await modeCandidates(cfg, limit, "sandbox", true, now);
  const readiness = deliveryReadiness();
  if (readiness.liveEnabled && rows.length < limit) rows.push(...await modeCandidates(cfg, limit - rows.length, "resend", false, now));
  const seen = new Set();
  return rows.filter((row) => {
    if (!row || !row.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  }).slice(0, limit);
}

async function claim(cfg, candidate, workerId) {
  return rpcRow(await supabase.pokliciRpc(cfg, "pos_claim_invoice_delivery", {
    p_delivery_id: candidate.id,
    p_user_id: candidate.user_id,
    p_worker_id: workerId,
  }));
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { ok: false, napaka: "Dovoljena sta GET in POST." });
  if (!cronAuthorized(req)) return json(res, 401, { ok: false, napaka: "Dostop do delavca ni dovoljen." });
  let cfg;
  try { cfg = supabase.konfiguracija(); }
  catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }
  try {
    const rows = await candidates(cfg, MAX_PER_RUN);
    const results = [];
    for (const candidate of rows) {
      const workerId = crypto.randomUUID();
      const claimed = await claim(cfg, candidate, workerId);
      if (!claimed) continue;
      const result = await processClaimed(cfg, claimed, workerId);
      results.push({ id: claimed.id, ok: result.ok, provider: claimed.provider, status: result.delivery && result.delivery.status || "processing", retryable: Boolean(result.error && result.error.retryable) });
    }
    const readiness = deliveryReadiness();
    return json(res, 200, {
      ok: true,
      mode: readiness.mode,
      sandbox: !readiness.liveEnabled,
      processed: results.length,
      completed: results.filter((entry) => entry.ok).length,
      retrying: results.filter((entry) => entry.status === "queued").length,
      failed: results.filter((entry) => entry.status === "failed").length,
    });
  } catch (error) {
    console.error("[pos-dostava-delavec]", error && error.stack || error);
    return json(res, 503, { ok: false, napaka: "Dostavni delavec trenutno ni dosegljiv." });
  }
}

module.exports = handler;
module.exports._test = { bearer, candidateQuery, candidates, cronAuthorized, safeEqual };
