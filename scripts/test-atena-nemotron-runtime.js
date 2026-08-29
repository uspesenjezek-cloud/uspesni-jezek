"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const API = process.env.UJ_ATENA_RUNTIME_API || "http://127.0.0.1:8766";
const audioPath = process.argv[2];
const repeats = Math.max(1, Math.min(30, Number(process.argv[3] || 1) || 1));

if (!audioPath) throw new Error("Uporaba: node scripts/test-atena-nemotron-runtime.js <16k-mono.wav|f32> [ponovitve]");

function wavToFloat32(file) {
  const input = fs.readFileSync(file);
  if (path.extname(file).toLowerCase() === ".f32") return Buffer.from(input);
  assert.equal(input.toString("ascii", 0, 4), "RIFF", "pričakovan je RIFF WAV");
  let offset = 12;
  let format = null;
  let data = null;
  while (offset + 8 <= input.length) {
    const id = input.toString("ascii", offset, offset + 4);
    const size = input.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      format = {
        code: input.readUInt16LE(offset + 8), channels: input.readUInt16LE(offset + 10),
        sampleRate: input.readUInt32LE(offset + 12), bits: input.readUInt16LE(offset + 22),
      };
    }
    if (id === "data") data = input.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size & 1);
  }
  assert.deepEqual(format, { code: 1, channels: 1, sampleRate: 16000, bits: 16 }, "WAV mora biti PCM16 mono 16 kHz");
  assert.ok(data && data.length, "WAV nima zvočnih podatkov");
  const output = Buffer.allocUnsafe(data.length * 2);
  for (let index = 0; index < data.length / 2; index += 1) {
    output.writeFloatLE(data.readInt16LE(index * 2) / 32768, index * 4);
  }
  return output;
}

async function json(pathname, options) {
  const response = await fetch(API + pathname, options);
  const body = await response.json().catch(() => ({}));
  assert.equal(response.ok, true, JSON.stringify(body));
  assert.equal(body.ok, true, JSON.stringify(body));
  return body;
}

function percentile(values, ratio) {
  const sorted = values.slice().sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))] || 0;
}

(async () => {
  const source = wavToFloat32(audioPath);
  const audio = Buffer.concat(Array.from({ length: repeats }, () => source));
  const seconds = audio.length / 4 / 16000;
  const health = await json("/health");
  const chunkSamples = Number(health.directFeedSamples) || 17920;
  const chunkBytes = chunkSamples * 4;
  const started = await json("/session/start", { method: "POST" });
  const headers = { "Content-Type": "application/octet-stream", "X-UJ-Prepis-Session": started.sessionId };
  const feedTimes = [];
  let liveText = "";
  try {
    for (let offset = 0; offset < audio.length; offset += chunkBytes) {
      const chunkStarted = performance.now();
      const result = await json("/session/audio", { method: "POST", headers, body: audio.subarray(offset, Math.min(audio.length, offset + chunkBytes)) });
      feedTimes.push(performance.now() - chunkStarted);
      liveText = String(result.text || "");
    }
    const final = await json("/session/stop", { method: "POST", headers });
    assert.ok(String(final.finalText || "").trim(), "Nemotron mora vrniti končni nemški tekst");
    const after = await json("/health");
    assert.equal(after.active, false, "seja mora biti po stop sproščena");
    console.log(JSON.stringify({
      seconds, repeats, chunks: feedTimes.length, liveText, finalText: final.finalText,
      p50Ms: Math.round(percentile(feedTimes, 0.5)), p95Ms: Math.round(percentile(feedTimes, 0.95)),
      maxMs: Math.round(Math.max(...feedTimes)), realtimeRatio: Number((feedTimes.reduce((a, b) => a + b, 0) / 1000 / seconds).toFixed(3)),
      serverPerformance: after.performance,
    }, null, 2));
  } catch (error) {
    await fetch(API + "/session/stop", { method: "POST", headers }).catch(() => {});
    throw error;
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
