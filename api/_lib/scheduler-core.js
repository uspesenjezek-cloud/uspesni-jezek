"use strict";

async function zOmejenoVzporednostjo(items, concurrency, worker) {
  var cursor = 0;
  var count = Math.max(1, Math.min(Number(concurrency) || 1, items.length || 1));
  async function run() {
    while (cursor < items.length) {
      var index = cursor++;
      await worker(items[index], index);
    }
  }
  var workers = [];
  for (var i = 0; i < count; i++) workers.push(run());
  await Promise.all(workers);
}

async function obdelajZapadle(options) {
  var rows = await options.claim(Math.max(1, Math.min(Number(options.limit) || 50, 50)));
  if (!Array.isArray(rows)) rows = [];
  var summary = { claimed: rows.length, sent: 0, failed: 0, finalizeFailed: 0 };

  await zOmejenoVzporednostjo(rows, options.concurrency || 5, async function (row) {
    try {
      var result = await options.sendSms({
        to: row.prejemnik,
        message: row.sporocilo,
        idempotencyKey: row.idempotency_key,
        channel: row.kanal,
      });
      var finished = await options.finish({
        id: row.id,
        claimToken: row.claim_token,
        success: true,
        providerMessageId: result && result.providerMessageId,
        error: null,
        terminal: false,
      });
      if (finished) summary.sent++;
      else summary.finalizeFailed++;
    } catch (err) {
      var finishedFailure = await options.finish({
        id: row.id,
        claimToken: row.claim_token,
        success: false,
        providerMessageId: null,
        error: String((err && err.message) || "Neznana napaka").slice(0, 1000),
        terminal: Boolean(err && err.nonRetryable),
      });
      if (finishedFailure) summary.failed++;
      else summary.finalizeFailed++;
    }
  });
  return summary;
}

module.exports = {
  obdelajZapadle: obdelajZapadle,
  zOmejenoVzporednostjo: zOmejenoVzporednostjo,
};
