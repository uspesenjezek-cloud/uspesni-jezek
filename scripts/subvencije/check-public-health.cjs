'use strict';
// Existing GitHub Actions observer. Read-only, no provider/account/credential setup.
const DEFAULT_URL = 'https://uspesni-jezek.vercel.app/api/subvencije?action=health';
function classify(status, value, now = Date.now()) {
  const checkedAt = typeof value?.checked_at === 'string' ? Date.parse(value.checked_at) : NaN;
  return Boolean(status === 200 && value && value.ok === true && ['ok', 'warming_up'].includes(value.status) &&
    Array.isArray(value.alerts) && value.alerts.length === 0 &&
    Number.isFinite(checkedAt) && now - checkedAt <= 120000 && checkedAt - now <= 60000);
}
async function checkHealth({ url = DEFAULT_URL, fetchImpl = global.fetch, timeoutMs = 30000, maxBytes = 65536, now = Date.now } = {}) {
  const controller = new AbortController(); let timer, activeReader;
  // Cancellation may itself never settle. Start it, absorb rejection, release
  // the lock synchronously, and keep the observer deadline independent of it.
  function cancel(target) {
    try { Promise.resolve(target?.cancel()).catch(() => {}); } catch (_) {}
  }
  function cleanupReader() {
    const reader = activeReader; activeReader = null;
    if (!reader) return;
    cancel(reader);
    try { reader.releaseLock(); } catch (_) {}
  }
  try {
    const target = new URL(url);
    if (url !== DEFAULT_URL && !(['127.0.0.1', 'localhost'].includes(target.hostname) && target.protocol === 'http:'))
      return { ok: false, code: 'TARGET_REJECTED' };
    const work = async () => {
      const response = await fetchImpl(url, { method: 'GET', redirect: 'error', signal: controller.signal,
        headers: { Accept: 'application/json' } });
      if (controller.signal.aborted) { cancel(response.body); return { ok: false, code: 'TIMEOUT' }; }
      const declared = response.headers.get('content-length');
      if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
        controller.abort(); cancel(response.body); return { ok: false, code: 'BODY_TOO_LARGE' };
      }
      const reader = response.body?.getReader();
      if (!reader) return { ok: false, code: 'INVALID_BODY' };
      activeReader = reader;
      const parts = []; let size = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > maxBytes) { controller.abort(); cleanupReader(); return { ok: false, code: 'BODY_TOO_LARGE' }; }
          parts.push(Buffer.from(value));
        }
      } finally {
        if (activeReader === reader) activeReader = null;
        try { reader.releaseLock(); } catch (_) {}
      }
      let value; try { value = JSON.parse(Buffer.concat(parts).toString('utf8')); }
      catch (_) { return { ok: false, code: 'INVALID_JSON' }; }
      return classify(response.status, value, now()) ? { ok: true, code: 'HEALTHY' } : { ok: false, code: 'UNHEALTHY' };
    };
    const timeout = new Promise(resolve => { timer = setTimeout(() => {
      controller.abort(); resolve({ ok: false, code: 'TIMEOUT' });
    }, Math.max(1, Math.min(timeoutMs, 30000))); });
    return await Promise.race([work(), timeout]);
  } catch (_) { return { ok: false, code: controller.signal.aborted ? 'TIMEOUT' : 'REQUEST_FAILED' }; }
  finally { clearTimeout(timer); controller.abort(); cleanupReader(); }
}
if (require.main === module) checkHealth().then(result => {
  console.log(JSON.stringify(result)); process.exitCode = result.ok ? 0 : 1;
});
module.exports = { DEFAULT_URL, classify, checkHealth };
