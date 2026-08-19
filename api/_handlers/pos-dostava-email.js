"use strict";

const crypto = require("node:crypto");
const supabase = require("../_lib/supabase-server");
const { processClaimed, rpcRow } = require("../_lib/pos-delivery-runner");
const { deliveryReadiness } = require("../_lib/pos-delivery-providers");

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").setHeader("Cache-Control", "private, no-store, max-age=0").end(JSON.stringify(body));
}

function uuid(value) {
  const text = String(value || "");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : "";
}

function publicResult(delivery) {
  if (!delivery) return null;
  return {
    id: delivery.id,
    status: delivery.status,
    provider: delivery.provider,
    providerReference: delivery.provider_reference || "",
    attemptCount: delivery.attempt_count,
    nextAttemptAt: delivery.next_attempt_at,
    sentAt: delivery.sent_at,
    deliveredAt: delivery.delivered_at,
    lastError: delivery.last_error,
    isTest: Boolean(delivery.is_test),
  };
}

function detailMessage(error, fallback) {
  const details = error && error.details;
  return String(details && (details.message || details.hint) || fallback);
}

async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { ok: false, napaka: "Dovoljena sta GET in POST." });
  let publicCfg;
  try { publicCfg = supabase.uporabniskaKonfiguracija(); }
  catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }
  const auth = await supabase.preveriUporabnika(req, publicCfg);
  if (!auth.ok) return json(res, auth.status, { ok: false, code: auth.code, napaka: auth.napaka });
  const readiness = deliveryReadiness();
  if (req.method === "GET") return json(res, 200, { ok: true, delivery: readiness });
  if (!readiness.liveEnabled) {
    return json(res, 409, { ok: false, code: "EMAIL_DELIVERY_NOT_ENABLED", napaka: "Pravo e-poštno pošiljanje še ni vključeno.", delivery: readiness });
  }
  const deliveryId = uuid(req.body && req.body.deliveryId || req.query && req.query.deliveryId);
  if (!deliveryId) return json(res, 400, { ok: false, napaka: "Neveljavna dostava." });
  if (!(req.body && req.body.confirmed === true)) return json(res, 400, { ok: false, napaka: "Pred pošiljanjem je potrebna izrecna potrditev." });

  let cfg;
  try { cfg = supabase.konfiguracija(); }
  catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }
  try {
    const queued = rpcRow(await supabase.pokliciRpc(cfg, "pos_queue_live_invoice_delivery", {
      p_delivery_id: deliveryId,
      p_user_id: auth.user.id,
      p_confirmed: true,
    }));
    if (!queued) return json(res, 409, { ok: false, napaka: "Dostave ni bilo mogoče pripraviti za pošiljanje." });
    if (queued.status === "sent" || queued.status === "delivered") {
      return json(res, 200, { ok: true, alreadyCompleted: true, delivery: publicResult(queued) });
    }
    const workerId = crypto.randomUUID();
    const claimed = rpcRow(await supabase.pokliciRpc(cfg, "pos_claim_invoice_delivery", {
      p_delivery_id: queued.id,
      p_user_id: auth.user.id,
      p_worker_id: workerId,
    }));
    if (!claimed) return json(res, 202, { ok: true, queued: true, delivery: publicResult(queued) });
    const result = await processClaimed(cfg, claimed, workerId);
    if (!result.ok) {
      return json(res, result.error && result.error.retryable ? 503 : 502, {
        ok: false,
        code: result.error && result.error.code || "EMAIL_DELIVERY_FAILED",
        napaka: result.error && result.error.message || "E-poštno pošiljanje ni uspelo.",
        delivery: publicResult(result.delivery),
      });
    }
    return json(res, 200, { ok: true, sent: true, delivery: publicResult(result.delivery) });
  } catch (error) {
    console.error("[pos-dostava-email]", error && error.stack || error);
    return json(res, Number(error && error.status) === 409 ? 409 : 502, {
      ok: false,
      code: error && error.code || "EMAIL_DELIVERY_FAILED",
      napaka: detailMessage(error, "E-poštnega pošiljanja ni bilo mogoče izvesti."),
    });
  }
}

module.exports = handler;
module.exports._test = { detailMessage, publicResult, uuid };
