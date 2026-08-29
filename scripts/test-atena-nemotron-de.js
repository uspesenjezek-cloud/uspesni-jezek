"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const read = (file) => fs.readFileSync(file, "utf8");
const server = read("tools/slovenski-live-prepis/streaming-server.js");
const worker = read("tools/slovenski-live-prepis/nemotron-stream-worker.ps1");
const client = read("app/handy-canary-client.js");
const localServer = read("scripts/local-server.js");
const setup = read("tools/slovenski-live-prepis/setup.ps1");
const izvedba = read("app/izvedba.html");
const zgodovina = read("app/neplacila-zgodovina.html");
const configGenerator = read("scripts/generate-config.js");
const configExample = read("app/config.example.js");

function resolveClientApi(location, speechConfig) {
  const context = { location, ATENA_SPEECH_CONFIG: speechConfig || {} };
  vm.runInNewContext(client, context);
  return context.UJHandyCanary.API;
}

const clientTestContext = { location: { origin: "https://example.invalid", port: "" } };
vm.runInNewContext(client, clientTestContext);
const sanitizeTranscript = clientTestContext.UJHandyCanary._test.sanitizeTranscript;
assert.equal(sanitizeTranscript("55555555555555555"), "");
assert.equal(sanitizeTranscript("Guter Text 55555555555555555"), "Guter Text");
assert.equal(sanitizeTranscript("Rechnung 5555 und 12345678"), "Rechnung 5555 und 12345678");

assert.match(server, /UJ_ATENA_PREPIS_PORT \|\| 8766/);
assert.match(server, /nemotron-3\.5-asr-streaming-0\.6b-Q8_0\.gguf/);
assert.doesNotMatch(server, /canary|qualityRpc|sessionAudio/i);
assert.match(server, /const LANGUAGE = "de-DE"/);
assert.match(server, /nemotron-stream-worker\.ps1/);
assert.match(server, /liveEngine: "nemotron-3\.5-de-streaming"/);
assert.match(server, /RUNTIME_VERSION = process\.env\.UJ_ATENA_TRANSCRIBE_VERSION \|\| "v0\.2\.0"/);
assert.match(server, /"native-direct-feed-r13-1120ms"/);
assert.match(server, /"native-buffered-feed-r13-1120ms"/);
assert.match(server, /runtimeSource = "uj-bundled"/);
assert.match(server, /directFeedSamples = Number/);
assert.match(server, /crypto\.randomUUID\(\)/);
assert.match(server, /x-uj-prepis-session/);
assert.match(server, /validSession\(req, origin\)/);
assert.match(server, /SPEECH_CAPACITY_BUSY/);
assert.match(server, /activeSession \|\| sessionStarting/);
assert.match(server, /MAX_SESSION_SECONDS = 10 \* 60/);
assert.match(server, /MAX_SESSION_IDLE_SECONDS = 90/);
assert.match(server, /MAX_AUDIO_REQUESTS_PER_SECOND = 20/);
assert.match(server, /SESSION_FEED_TIMEOUT_MS = 30000/);
assert.match(server, /SESSION_STOP_TIMEOUT_MS = 45000/);
assert.match(server, /rawAudioStored: false/);
assert.match(server, /releaseExpiredSession/);
assert.match(server, /ensureEngineReady/);
assert.match(server, /restartEngine/);
assert.match(server, /recoverAfterSessionRpcFailure/);
assert.match(server, /waitForWorkerExit/);
assert.match(server, /feedDurationsMs/);
assert.match(server, /function sanitizeTranscript/);
assert.doesNotMatch(server, /resetSession\(\);\s*await withTimeout\(rpc\("start"\)/);
assert.match(server, /PUBLIC_ENDPOINT = "https:\/\/speech\.uspesni-jezek\.de"/);
assert.match(server, /PRODUCTION_ORIGIN = "https:\/\/uspesni-jezek\.vercel\.app"/);
assert.match(server, /UJ_ATENA_ENDPOINT_VERIFIED/);
assert.match(server, /x-forwarded-proto/);
assert.match(server, /x-forwarded-host/);
assert.match(server, /\/auth\/v1\/user/);
assert.match(server, /crypto\.timingSafeEqual/);
assert.match(server, /SUPABASE_PUBLISHABLE_KEY/);

assert.match(worker, /transcribe_open/);
assert.match(worker, /transcribe_stream_begin/);
assert.match(worker, /transcribe_stream_feed/);
assert.match(worker, /transcribe_stream_finalize/);
assert.match(worker, /transcribe_stream_get_text/);
assert.match(worker, /\[string\]\$Language = "de-DE"/);
assert.match(worker, /TranscribeRunParamsV013/);
assert.match(worker, /TranscribeRunParamsV020/);
assert.match(worker, /\$runV020\.language = \$languagePointer/);
assert.match(worker, /\$runV013\.language = \$languagePointer/);
assert.match(worker, /fullText = ConvertFrom-NativeUtf8/);
assert.doesNotMatch(worker, /Invoke-WebRequest|Invoke-RestMethod|https?:\/\//);

assert.match(client, /__dev-atena-speech/);
assert.doesNotMatch(client, /127\.0\.0\.1:8766/);
assert.match(client, /Atenin mobilni govorni servis še ni nastavljen/);
assert.match(client, /EXPECTED_ENGINE = "nemotron-3\.5-de-streaming"/);
assert.match(client, /result\.language === "de-DE"/);
assert.match(client, /streamFeedSamples = 17920/);
assert.match(client, /runtime\.directFeedSamples/);
assert.match(client, /recommendedFeedSamples >= 1280/);
assert.match(client, /X-UJ-Prepis-Session/);
assert.match(client, /TRUSTED_MOBILE_API = "https:\/\/speech\.uspesni-jezek\.de"/);
assert.match(client, /speechConfig\.endpointVerified === true/);
assert.match(client, /requestOptions\.headers\.Authorization = "Bearer " \+ sessionAccessToken/);
assert.match(client, /client\.auth\.getSession\(\)/);
assert.match(client, /sampleRate: 16000/);
assert.match(client, /echoCancellation: false/);
assert.match(client, /noiseSuppression: false/);
assert.match(client, /autoGainControl: false/);
assert.match(client, /await drainCaptureMessages\(\)/);
assert.match(client, /if \(stopping\) return/);
assert.match(client, /recording && !stopping/);
assert.match(client, /Date\.now\(\) - lastCaptureAt < 2500/);
assert.match(client, /restartCaptureIfStalled\(\)/);
assert.match(client, /audioContext\.state !== "running"/);
assert.match(client, /processorNode = await createProcessor\(audioContext\)/);
assert.match(client, /startCaptureWatchdog\(\)/);
assert.match(client, /clearCaptureWatchdog\(\)/);
assert.match(client, /if \(!workletRegistered\)/);
assert.match(client, /worklet\.onprocessorerror/);
assert.match(client, /Math\.round\(sampleRate\*0\.03\)/);
assert.match(client, /command==='flush'/);
assert.match(client, /createScriptProcessor\(1024, 1, 1\)/);
assert.match(client, /watchMicrophoneTracks/);
assert.match(client, /currentTrack\.readyState === "ended"/);
assert.match(client, /failAndStop/);
assert.match(client, /function sanitizeTranscript/);
assert.match(client, /keepalive: true/);
assert.match(client, /catch \(error\) \{\s*lastError = error;/);
assert.match(client, /path === "\/session\/audio" \? 30000/);
assert.match(client, /controller\.abort\(\)/);
assert.doesNotMatch(client, /ATENA_SPEECH_BASE_URL|new URL\(.*speech/i);
assert.equal(resolveClientApi({ origin: "http://localhost:8001", port: "8001" }, {}), "http://localhost:8001/__dev-atena-speech");
assert.equal(resolveClientApi({ origin: "https://uspesni-jezek.vercel.app", port: "" }, {
  baseUrl: "https://speech.uspesni-jezek.de", endpointVerified: true,
}), "https://speech.uspesni-jezek.de");
assert.equal(resolveClientApi({ origin: "https://uspesni-jezek.vercel.app", port: "" }, {
  baseUrl: "https://speech.uspesni-jezek.de", endpointVerified: false,
}), "");
assert.equal(resolveClientApi({ origin: "https://uspesni-jezek.vercel.app", port: "" }, {
  baseUrl: "https://napadalec.example", endpointVerified: true,
}), "");

assert.match(configGenerator, /atenaSpeechBaseUrl = "https:\/\/speech\.uspesni-jezek\.de"/);
assert.match(configGenerator, /ATENA_SPEECH_ENDPOINT_VERIFIED/);
assert.match(configGenerator, /sentryEnvironment === "production"/);
assert.match(configExample, /endpointVerified: false/);

assert.match(localServer, /atenaNemotronModel/);
assert.match(localServer, /atenaNemotronServer/);
assert.match(localServer, /function zazeniLokalniAtenaNemotron/);
assert.match(localServer, /function posredujLokalniAtenaNemotron/);
assert.match(localServer, /port: 8766/);
assert.match(localServer, /zazeniLokalniAtenaNemotron\(\)/);
assert.match(localServer, /ustaviLokalniAtenaNemotron\(\)/);

assert.match(setup, /handy-computer\/nemotron-3\.5-asr-streaming-0\.6b-gguf/);
assert.match(setup, /nemotron-3\.5-asr-streaming-0\.6b-Q8_0\.gguf/);
assert.match(setup, /\$nemotronFile\.lfs\.sha256/);
assert.match(setup, /\$runtimeRelease = "v0\.2\.0"/);
assert.match(setup, /transcribe-native-0\.2\.0-windows-x86_64-cpu-vulkan\.tar\.gz/);
assert.match(izvedba, /handy-canary-client\.js\?v=20260829-atena-nemotron-resilient-v9/);
assert.match(zgodovina, /handy-canary-client\.js\?v=20260829-atena-nemotron-resilient-v9/);

const constraintsContext = { location: { origin: "http://localhost:8001", port: "8001" }, setTimeout };
vm.runInNewContext(client, constraintsContext);
const constraints = constraintsContext.UJHandyCanary._test.microphoneConstraints().audio;
assert.equal(constraints.sampleRate, 16000);
assert.equal(constraints.channelCount, 1);
assert.equal(constraints.echoCancellation, false);
assert.equal(constraints.noiseSuppression, false);
assert.equal(constraints.autoGainControl, false);

async function preveriSamodejnoObnovoZajema() {
  let zdaj = 0;
  let intervalCallback = null;
  let intervalCleared = false;
  let sourceConnects = 0;
  let microphoneCalls = 0;
  let resumeCalls = 0;
  let activeContext = null;
  const firstTrack = { muted: false, readyState: "live", addEventListener() {}, stop() {} };
  const secondTrack = { muted: false, readyState: "live", addEventListener() {}, stop() {} };
  const streams = [
    { getAudioTracks: () => [firstTrack], getTracks: () => [firstTrack] },
    { getAudioTracks: () => [secondTrack], getTracks: () => [secondTrack] },
  ];
  const sourceNode = {
    connect() { sourceConnects += 1; },
    disconnect() {},
  };
  class FakeAudioWorkletNode {
    constructor() { this.port = { onmessage: null, postMessage() {} }; this.onprocessorerror = null; }
    connect() {}
    disconnect() {}
  }
  class FakeAudioContext {
    constructor() {
      activeContext = this;
      this.sampleRate = 16000;
      this.state = "running";
      this.destination = {};
      this.audioWorklet = { addModule: async () => {} };
    }
    resume() { resumeCalls += 1; this.state = "running"; return Promise.resolve(); }
    close() { this.state = "closed"; return Promise.resolve(); }
    createMediaStreamSource() { return sourceNode; }
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; }
  }
  const runtimeContext = {
    location: { origin: "http://localhost:8001", port: "8001" },
    navigator: { mediaDevices: { getUserMedia: async () => streams[Math.min(microphoneCalls++, streams.length - 1)] } },
    AudioContext: FakeAudioContext,
    AudioWorkletNode: FakeAudioWorkletNode,
    URL: { createObjectURL: () => "blob:atena-test", revokeObjectURL() {} },
    Blob: class {},
    Date: { now: () => zdaj },
    setTimeout,
    setInterval(callback) { intervalCallback = callback; return 1; },
    clearInterval() { intervalCleared = true; },
    fetch: async (url) => ({
      ok: true,
      json: async () => String(url).endsWith("/health")
        ? { liveEngine: "nemotron-3.5-de-streaming", language: "de-DE", status: "ready", directFeedSamples: 17920 }
        : String(url).endsWith("/session/start")
          ? { ok: true, sessionId: "watchdog-test" }
          : { ok: true, finalText: "" },
    }),
  };
  vm.runInNewContext(client, runtimeContext);
  const snemalnik = runtimeContext.UJHandyCanary.create({});
  await snemalnik.start("");
  assert.equal(sourceConnects, 1, "začetni zajem mora biti povezan");
  firstTrack.muted = true;
  activeContext.state = "suspended";
  zdaj = 3000;
  intervalCallback();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sourceConnects, 2, "zamrznjen zajem se mora samodejno ponovno povezati");
  assert.equal(microphoneCalls, 2, "utišan mikrofonski track mora biti ponovno pridobljen");
  assert.ok(resumeCalls >= 2, "suspendiran AudioContext se mora ponovno zbuditi");
  await snemalnik.stop();
  assert.equal(intervalCleared, true, "nadzor zajema se mora ob zaključku ustaviti");
}

async function preveriCasovnoOmejitevPovezave() {
  let fetchCalls = 0;
  const runtimeContext = {
    location: { origin: "http://localhost:8001", port: "8001" },
    navigator: {},
    AbortController,
    setTimeout(callback) { queueMicrotask(callback); return 1; },
    clearTimeout() {},
    fetch: async (_url, options) => {
      fetchCalls += 1;
      if (options.signal.aborted) throw new Error("aborted");
      return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted"))));
    },
  };
  vm.runInNewContext(client, runtimeContext);
  const snemalnik = runtimeContext.UJHandyCanary.create({});
  await assert.rejects(snemalnik.health(), /trajala predolgo/);
  assert.equal(fetchCalls, 3, "prehodni izpad se mora trikrat varno poskusiti");
}

Promise.all([preveriSamodejnoObnovoZajema(), preveriCasovnoOmejitevPovezave()]).then(function () {
  console.log("✓ Atena: Nemotron de-DE samodejno obnovi zamrznjen mikrofonski zajem brez Canary prehoda");
}).catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
