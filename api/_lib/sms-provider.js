"use strict";

/* Nevtralen adapter do zasebnega SMS endpointa. Brez konfiguracije scheduler
 * ne prevzame nobenega SMS-a. Ciljni endpoint mora spoštovati Idempotency-Key. */
function konfiguriran() {
  return Boolean(process.env.SMS_PROVIDER_URL && process.env.SMS_PROVIDER_TOKEN);
}

async function posljiSms(payload) {
  if (!konfiguriran()) {
    var configError = new Error("SMS ponudnik ni konfiguriran.");
    configError.code = "SMS_PROVIDER_NOT_CONFIGURED";
    configError.nonRetryable = true;
    throw configError;
  }

  var url = String(process.env.SMS_PROVIDER_URL);
  if (!/^https:\/\//i.test(url) && !/^http:\/\/localhost(?::\d+)?\//i.test(url)) {
    var urlError = new Error("SMS_PROVIDER_URL mora uporabljati HTTPS.");
    urlError.code = "INVALID_PROVIDER_URL";
    urlError.nonRetryable = true;
    throw urlError;
  }

  var response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env.SMS_PROVIDER_TOKEN,
      "Idempotency-Key": payload.idempotencyKey,
    },
    body: JSON.stringify({
      to: payload.to,
      message: payload.message,
      idempotencyKey: payload.idempotencyKey,
    }),
    signal: AbortSignal.timeout(10000),
  });

  var data = null;
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) {
    var err = new Error("SMS ponudnik je vrnil napako " + response.status + ".");
    err.code = "SMS_PROVIDER_ERROR";
    err.status = response.status;
    err.nonRetryable = response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429;
    throw err;
  }

  var providerMessageId = data && (data.providerMessageId || data.messageId || data.id || data.sid);
  if (!providerMessageId) {
    var invalidResponse = new Error("SMS ponudnik ni vrnil ID-ja sporočila.");
    invalidResponse.code = "INVALID_PROVIDER_RESPONSE";
    throw invalidResponse;
  }
  return { providerMessageId: String(providerMessageId) };
}

module.exports = { konfiguriran: konfiguriran, posljiSms: posljiSms };
