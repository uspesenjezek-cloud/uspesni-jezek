"use strict";

const crypto = require("node:crypto");
const supabase = require("../_lib/supabase-server");
const { processClaimed, rpcRow } = require("../_lib/pos-delivery-runner");
const requestJson = require("../_lib/pos-request-json");
const requestQuery = require("../_lib/pos-request-query");
const MAX_BODY_BYTES = 16 * 1024;

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8")
    .setHeader("Cache-Control", "private, no-store, max-age=0").end(JSON.stringify(body));
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
    channel: delivery.channel,
    documentFormat: delivery.document_format,
    providerReference: delivery.provider_reference || "",
    attemptCount: delivery.attempt_count,
    maxAttempts: delivery.max_attempts,
    nextAttemptAt: delivery.next_attempt_at,
    completedAt: delivery.completed_at,
    lastError: delivery.last_error,
    isTest: Boolean(delivery.is_test),
    sent: false,
    delivered: false,
  };
}

async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, napaka: "Metoda ni dovoljena." });
  let cfg;
  try { cfg = supabase.konfiguracija(); }
  catch (error) { return json(res, 500, { ok: false, napaka: error.message }); }

  const auth = await supabase.preveriUporabnika(req, cfg);
  if (!auth.ok) return json(res, auth.status || 401, { ok: false, code: auth.code, napaka: auth.napaka });
  let body;
  try { body = requestJson(req, MAX_BODY_BYTES); }
  catch (error) { return json(res, error.status || 400, { ok: false, code: error.code, napaka: error.message }); }
  const deliveryId = uuid(body.deliveryId || requestQuery(req).deliveryId);
  if (!deliveryId) return json(res, 400, { ok: false, napaka: "Neveljavna dostava." });

  const workerId = crypto.randomUUID();
  let claimed;
  try {
    claimed = rpcRow(await supabase.pokliciRpc(cfg, "pos_claim_invoice_delivery", {
      p_delivery_id: deliveryId,
      p_user_id: auth.user.id,
      p_worker_id: workerId,
    }));
    if (!claimed) {
      const rows = await supabase.pridobiVrstice(
        cfg,
        "pos_invoice_deliveries",
        "id=eq." + encodeURIComponent(deliveryId) + "&user_id=eq." + encodeURIComponent(auth.user.id) + "&select=*"
      );
      const current = rows[0] || null;
      if (current && current.status === "test_completed") {
        return json(res, 200, { ok: true, alreadyCompleted: true, delivery: publicResult(current) });
      }
      return json(res, 409, {
        ok: false,
        napaka: current && current.status === "queued"
          ? "Naslednji poskus še ni na vrsti."
          : "Sandbox dostave trenutno ni mogoče prevzeti.",
        delivery: publicResult(current),
      });
    }

    const result = await processClaimed(cfg, claimed, workerId);
    if (!result.ok) {
      return json(res, result.error && result.error.retryable ? 503 : 502, {
        ok: false,
        code: result.error && result.error.code || "DELIVERY_SANDBOX_FAILED",
        napaka: result.error && result.error.message || "Sandbox preizkus ni uspel.",
        delivery: publicResult(result.delivery),
      });
    }
    return json(res, 200, {
      ok: true,
      sandbox: true,
      sent: false,
      delivered: false,
      simulatedChannel: result.providerResult && result.providerResult.simulatedChannel || claimed.channel,
      delivery: publicResult(result.delivery),
    });
  } catch (error) {
    let failed = null;
    if (claimed && claimed.id) {
      try {
        failed = rpcRow(await supabase.pokliciRpc(cfg, "pos_finish_invoice_delivery", {
          p_delivery_id: claimed.id,
          p_user_id: auth.user.id,
          p_worker_id: workerId,
          p_success: false,
          p_provider_reference: "",
          p_error: String(error && error.message || "Sandbox preizkus ni uspel.").slice(0, 1000),
          p_retryable: Boolean(error && error.retryable),
        }));
      } catch (finishError) {
        console.error("[pos-dostava-sandbox:finish]", finishError && finishError.stack || finishError);
      }
    }
    console.error("[pos-dostava-sandbox]", error && error.stack || error);
    return json(res, error && error.retryable ? 503 : 502, {
      ok: false,
      code: error && error.code || "DELIVERY_SANDBOX_FAILED",
      napaka: error && error.message || "Sandbox preizkus ni uspel.",
      delivery: publicResult(failed),
    });
  }
}

module.exports = handler;
module.exports._test = { uuid, publicResult, MAX_BODY_BYTES };
