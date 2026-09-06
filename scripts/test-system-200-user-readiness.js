"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const capacity = require("../api/_lib/runtime-capacity");
const scheduler = require("../api/_lib/scheduler-core");
const bonitetaQueue = require("../api/_lib/mehka-boniteta-queue");

const root = path.resolve(__dirname, "..");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function percentile(values, ratio) {
  const sorted = values.slice().sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] || 0);
}

function metrics(values) {
  return { p50Ms: percentile(values, 0.5), p95Ms: percentile(values, 0.95), maxMs: Math.round(Math.max.apply(null, values) || 0) };
}

async function testPdfBackpressure() {
  const duplicateGate = capacity.createGate({ maxActive: 2, maxQueue: 32, waitTimeoutMs: 1000 });
  let duplicateExecutions = 0;
  const duplicateLatencies = [];
  const duplicateResults = await Promise.all(Array.from({ length: 200 }, async function () {
    const started = performance.now();
    const result = await duplicateGate.run("same-document", async function () {
      duplicateExecutions += 1;
      await wait(15);
      return "one-pdf";
    });
    duplicateLatencies.push(performance.now() - started);
    return result;
  }));
  assert.equal(duplicateExecutions, 1);
  assert.equal(new Set(duplicateResults).size, 1);

  const uniqueGate = capacity.createGate({ maxActive: 4, maxQueue: 20, waitTimeoutMs: 1000, retryAfterMs: 250 });
  let active = 0;
  let maxActive = 0;
  const uniqueLatencies = [];
  const uniqueResults = await Promise.all(Array.from({ length: 200 }, async function (_, index) {
    const started = performance.now();
    try {
      await uniqueGate.run("document-" + index, async function () {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await wait(20);
        active -= 1;
      });
      uniqueLatencies.push(performance.now() - started);
      return "completed";
    } catch (error) {
      uniqueLatencies.push(performance.now() - started);
      assert.equal(error.status, 503);
      assert.equal(error.retryable, true);
      return error.code;
    }
  }));
  assert.ok(maxActive <= 4);
  assert.equal(uniqueResults.length, 200);
  assert.ok(uniqueResults.filter((value) => value === "RUNTIME_CAPACITY_BUSY").length > 0);
  return {
    duplicate: Object.assign({ requests: 200, executions: duplicateExecutions }, metrics(duplicateLatencies)),
    unique: Object.assign({ requests: 200, maxActive, safelyRejected: uniqueResults.filter((value) => value === "RUNTIME_CAPACITY_BUSY").length }, metrics(uniqueLatencies)),
  };
}

async function testWorkerBound() {
  let active = 0;
  let maxActive = 0;
  const latencies = [];
  const startedAll = performance.now();
  await scheduler.zOmejenoVzporednostjo(Array.from({ length: 200 }, (_, index) => index), 5, async function () {
    const started = performance.now();
    active += 1;
    maxActive = Math.max(maxActive, active);
    await wait(2);
    active -= 1;
    latencies.push(performance.now() - started);
  });
  assert.equal(maxActive, 5);
  return Object.assign({ requests: 200, maxActive, totalMs: Math.round(performance.now() - startedAll) }, metrics(latencies));
}

async function testBonitetaAdmission() {
  const previousMode = process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE;
  process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE = "true";
  bonitetaQueue._test.ponastaviPomnilnik();
  await Promise.all(Array.from({ length: 200 }, function (_, index) {
    return bonitetaQueue.ustvari({}, "readiness-user-" + index, {
      ime: "Readiness podjetje " + index,
      spletnaStran: "https://readiness-" + index + ".example.test",
      confirmedIdentity: index < 100 ? { confirmed: true, name: "Readiness podjetje " + index, companyId: "DE-HRB-" + index } : null,
    });
  }));
  const started = performance.now();
  const claimed = (await Promise.all(Array.from({ length: 200 }, function () {
    return bonitetaQueue.prevzemi({}, 1);
  }))).flat();
  const unique = new Set(claimed.map((job) => job.id));
  const insolvency = claimed.filter((job) => job.faza === "insolvenca").length;
  assert.equal(unique.size, claimed.length);
  assert.ok(claimed.length <= 30);
  assert.ok(insolvency <= 20);
  bonitetaQueue._test.ponastaviPomnilnik();
  if (previousMode == null) delete process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE;
  else process.env.MEHKA_BONITETA_IN_MEMORY_QUEUE = previousMode;
  return { requests: 200, claimed: claimed.length, insolvencyClaimed: insolvency, maxGlobal: 30, maxInsolvency: 20, elapsedMs: Math.round(performance.now() - started) };
}

function sourceContracts() {
  const supabase = fs.readFileSync(path.join(root, "api/_lib/supabase-server.js"), "utf8");
  const invoiceAi = fs.readFileSync(path.join(root, "api/citaj-racun.js"), "utf8");
  const confirmStep = fs.readFileSync(path.join(root, "api/potrdi-korak.js"), "utf8");
  const stripe = fs.readFileSync(path.join(root, "api/_handlers/pos-stripe-checkout.js"), "utf8");
  const sms = fs.readFileSync(path.join(root, "api/_lib/sms-provider.js"), "utf8");
  const openregister = fs.readFileSync(path.join(root, "api/_lib/openregister-pro-client.js"), "utf8");
  return {
    authLocalJwks: /jwtVerify\(/.test(supabase) && /timeoutDuration:\s*3000/.test(supabase),
    supabaseTimeouts: /fetchZOmejitvijo/.test(supabase) && /12000/.test(supabase),
    posIdempotency: /idempotencyKey/.test(stripe) && /requestId/.test(stripe),
    smsTimeoutAndIdempotency: /Idempotency-Key/.test(sms) && /AbortSignal\.timeout\(10000\)/.test(sms),
    openregisterTimeout: /AbortSignal\.timeout/.test(openregister) || /signal:\s*controller\.signal/.test(openregister),
    invoiceAiAuthenticated: /preveriUporabnika/.test(invoiceAi),
    invoiceAiTimeout: /AbortSignal|AbortController|fetchZOmejitvijo/.test(invoiceAi),
    invoiceAiAdmission: /createDistributedCoordinator|runtime-capacity/.test(invoiceAi),
    confirmStepSharedAuthAndTimeout: /supabase-server/.test(confirmStep) && /fetchZOmejitvijo/.test(confirmStep),
  };
}

async function testSafeHttpBurst(url) {
  if (!url) return { skipped: true };
  const latencies = [];
  const responses = await Promise.all(Array.from({ length: 200 }, async function () {
    const started = performance.now();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "error" });
      await response.arrayBuffer();
      latencies.push(performance.now() - started);
      return response.status;
    } catch (error) {
      latencies.push(performance.now() - started);
      return String(error && error.name || "ERROR");
    }
  }));
  const ok = responses.filter((status) => status === 200).length;
  assert.equal(ok, 200);
  return Object.assign({ url, requests: 200, http200: ok }, metrics(latencies));
}

async function main() {
  const started = performance.now();
  const result = {
    http: await testSafeHttpBurst(String(process.env.SYSTEM_READINESS_HTTP_URL || "")),
    pdf: await testPdfBackpressure(),
    workers: await testWorkerBound(),
    boniteta: await testBonitetaAdmission(),
    contracts: sourceContracts(),
  };
  const blockers = Object.entries(result.contracts).filter((entry) => entry[1] !== true).map((entry) => entry[0]);
  result.blockers = blockers;
  result.totalMs = Math.round(performance.now() - started);
  console.log(JSON.stringify(result, null, 2));
  if (blockers.length) {
    console.error("System 200-user readiness: BLOCKED (" + blockers.join(", ") + ")");
    process.exitCode = 2;
  } else {
    console.log("System 200-user readiness: PASS");
  }
}

main().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
