"use strict";

const supabase = require("./supabase-server");
const { buildDeliveryPackage } = require("./pos-delivery-package");
const { providerFor } = require("./pos-delivery-providers");

function rpcRow(value) {
  if (Array.isArray(value)) return value[0] || null;
  if (value && typeof value === "object" && value.id) return value;
  return null;
}

async function finish(cfg, delivery, workerId, result) {
  return rpcRow(await supabase.pokliciRpc(cfg, "pos_finish_invoice_delivery", {
    p_delivery_id: delivery.id,
    p_user_id: delivery.user_id,
    p_worker_id: workerId,
    p_success: Boolean(result.success),
    p_provider_reference: result.providerReference || "",
    p_error: result.error || "",
    p_retryable: Boolean(result.retryable),
  }));
}

async function processClaimed(cfg, claimed, workerId) {
  try {
    const deliveryPackage = await buildDeliveryPackage(cfg, claimed);
    const provider = providerFor(claimed.provider);
    const providerResult = await provider.deliver(deliveryPackage);
    const completed = await finish(cfg, claimed, workerId, {
      success: true,
      providerReference: providerResult.providerReference,
      retryable: false,
    });
    return { ok: true, delivery: completed, providerResult };
  } catch (error) {
    const failed = await finish(cfg, claimed, workerId, {
      success: false,
      retryable: Boolean(error && error.retryable),
      error: String(error && error.message || "Dostava ni uspela.").slice(0, 1000),
    });
    return { ok: false, delivery: failed, error };
  }
}

module.exports = { finish, processClaimed, rpcRow };
