"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const readline = require("node:readline");

const HOST = "127.0.0.1";
const PORT = Number(process.env.UJ_ATENA_PREPIS_PORT || 8766);
const DATA_ROOT = process.env.UJ_SPEECH_HOME || path.join(process.env.LOCALAPPDATA || "", "UspesniJezek", "speech");
const MODEL_NAME = process.env.UJ_ATENA_PREPIS_MODEL_NAME || "nemotron-3.5-asr-streaming-0.6b-Q8_0.gguf";
const LANGUAGE = "de-DE";
const RUNTIME_VERSION = process.env.UJ_ATENA_TRANSCRIBE_VERSION || "v0.2.0";
const RUNTIME_DLL = String(process.env.UJ_ATENA_TRANSCRIBE_DLL || "").trim();
const PRODUCTION_ORIGIN = "https://uspesni-jezek.vercel.app";
const PUBLIC_ENDPOINT = "https://speech.uspesni-jezek.de";
const PUBLIC_HOST = "speech.uspesni-jezek.de";
const PUBLIC_ENDPOINT_VERIFIED = process.env.UJ_ATENA_ENDPOINT_VERIFIED === "true" &&
  String(process.env.UJ_ATENA_PUBLIC_ENDPOINT || "").trim().replace(/\/+$/, "") === PUBLIC_ENDPOINT;
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
const MAX_SESSION_SECONDS = 10 * 60;
const MAX_SESSION_IDLE_SECONDS = 90;
const MAX_SESSION_BYTES = 16000 * 4 * MAX_SESSION_SECONDS;
const MAX_AUDIO_REQUESTS_PER_SECOND = 20;
const SESSION_START_TIMEOUT_MS = 60000;
const SESSION_FEED_TIMEOUT_MS = 30000;
const SESSION_STOP_TIMEOUT_MS = 45000;
const ALLOWED_ORIGINS = new Set(["http://localhost:8001", "http://127.0.0.1:8001", PRODUCTION_ORIGIN]);

let worker = null;
let nextId = 1;
let activeSession = false;
let sessionStarting = false;
let activeSessionId = "";
let activeSessionUserId = "";
let activeSessionTokenHash = "";
let activeSessionStartedAt = 0;
let activeSessionLastSeenAt = 0;
let audioRateWindowStartedAt = 0;
let audioRateWindowCount = 0;
let receivedBytes = 0;
let committedText = "";
let backend = null;
let engineStatus = "loading";
let engineError = "";
let enginePromise = null;
let engineRecoveryPromise = null;
let runtimeSource = "unresolved";
let directFeedSamples = 17920;
const feedDurationsMs = [];
const pending = new Map();

function findFile(root, names) {
  if (!root || !fs.existsSync(root)) return null;
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const queue = [root];
  while (queue.length) {
    const current = queue.shift();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) queue.push(full);
      else if (entry.isFile() && wanted.has(entry.name.toLowerCase())) return full;
    }
  }
  return null;
}

function reply(res, status, body, origin) {
  const payload = Buffer.from(JSON.stringify(body));
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": payload.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }
  res.writeHead(status, headers);
  res.end(payload);
}

function readBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const parts = [];
    let total = 0;
    req.on("data", (part) => {
      total += part.length;
      if (total > maxBytes) {
        reject(new Error("Zvočni paket je prevelik."));
        req.destroy();
        return;
      }
      parts.push(part);
    });
    req.on("end", () => resolve(Buffer.concat(parts)));
    req.on("error", reject);
  });
}

function rejectPending(error) {
  for (const item of pending.values()) item.reject(error);
  pending.clear();
}

function resetSession() {
  activeSession = false;
  activeSessionId = "";
  activeSessionUserId = "";
  activeSessionTokenHash = "";
  activeSessionStartedAt = 0;
  activeSessionLastSeenAt = 0;
  audioRateWindowStartedAt = 0;
  audioRateWindowCount = 0;
  receivedBytes = 0;
  committedText = "";
}

function appendText(left, right) {
  const before = String(left || "").trim();
  const next = String(right || "").trim();
  if (!next) return before;
  if (!before) return next;
  return /^[,.;:!?)]/.test(next) ? `${before}${next}` : `${before} ${next}`;
}

function sanitizeTranscript(value) {
  const text = String(value || "").trim();
  if (/^(\d)\1{7,}$/.test(text)) return "";
  return text.replace(/(?:^|\s)(\d)\1{7,}(?=\s|$|[.,;:!?])/g, " ").replace(/\s{2,}/g, " ").trim();
}

function httpError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code || null;
  return error;
}

function bearerToken(req) {
  const match = /^Bearer\s+([^\s]+)$/i.exec(String(req.headers.authorization || ""));
  return match && match[1].length <= 8192 ? match[1] : "";
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function sameTokenHash(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  return crypto.timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function isPublicRequest(req, origin) {
  return origin === PRODUCTION_ORIGIN || Boolean(req.headers["x-forwarded-host"]);
}

function assertTrustedPublicTransport(req, origin) {
  if (!isPublicRequest(req, origin)) return;
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim().toLowerCase();
  if (!PUBLIC_ENDPOINT_VERIFIED) throw httpError(503, "Mobilni govorni endpoint še ni varnostno aktiviran.", "SPEECH_ENDPOINT_NOT_VERIFIED");
  if (origin !== PRODUCTION_ORIGIN || forwardedProto !== "https" || forwardedHost !== PUBLIC_HOST) {
    throw httpError(403, "Mobilna govorna povezava ni prišla prek zaupanja vrednega TLS prehoda.", "SPEECH_TRANSPORT_REJECTED");
  }
}

async function authenticateRequest(req, origin) {
  assertTrustedPublicTransport(req, origin);
  if (!isPublicRequest(req, origin)) return { userId: "local-development", tokenHash: "" };
  let authUrl;
  try { authUrl = new URL(`${SUPABASE_URL}/auth/v1/user`); } catch (_) { authUrl = null; }
  if (!authUrl || authUrl.protocol !== "https:" || !SUPABASE_PUBLISHABLE_KEY) {
    throw httpError(503, "Preverjanje prijave govornega servisa ni nastavljeno.", "SPEECH_AUTH_NOT_CONFIGURED");
  }
  const token = bearerToken(req);
  if (!token) throw httpError(401, "Za govorni prepis je potrebna veljavna prijava.", "SPEECH_AUTH_REQUIRED");
  const response = await fetch(authUrl, {
    method: "GET",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw httpError(401, "Prijava je potekla ali ni veljavna.", "SPEECH_AUTH_INVALID");
  const user = await response.json().catch(() => null);
  if (!user || typeof user.id !== "string" || !user.id) throw httpError(401, "Prijavljenega uporabnika ni bilo mogoče potrditi.", "SPEECH_AUTH_INVALID");
  return { userId: user.id, tokenHash: tokenHash(token) };
}

function finalizedWordText(result) {
  if (!Array.isArray(result.words)) return "";
  return result.words
    .map((word) => String(word && word.w || "").trim())
    .filter(Boolean)
    .join(" ");
}

function stopWorker() {
  if (worker && !worker.killed) {
    worker.intentionalStop = true;
    worker.kill();
  }
  worker = null;
  resetSession();
  rejectPending(new Error("Lokalni pretočni proces je bil ustavljen."));
}

function waitForWorkerExit(child, timeoutMs = 5000) {
  if (!child || child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    let timer = setTimeout(done, timeoutMs);
    function done() {
      clearTimeout(timer);
      child.removeListener("exit", done);
      resolve();
    }
    child.once("exit", done);
  });
}

function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function launchWorker(dllPath, modelPath) {
  return new Promise((resolve, reject) => {
    const script = path.join(__dirname, "nemotron-stream-worker.ps1");
    const dllDir = path.dirname(dllPath);
    const child = spawn("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script,
      "-DllPath", dllPath, "-ModelPath", modelPath, "-Language", LANGUAGE,
    ], {
      cwd: dllDir,
      windowsHide: true,
      env: { ...process.env, PATH: `${dllDir};${process.env.PATH || ""}` },
      stdio: ["pipe", "pipe", "pipe"],
    });
    worker = child;
    let stderr = "";
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      fn(value);
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish(reject, new Error("Nalaganje pretočnega modela je prekoračilo 4 minute."));
    }, 240000);
    const lines = readline.createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      let message;
      try { message = JSON.parse(line); } catch (_) { return; }
      if (message.event === "ready") {
        backend = "transcribe.cpp " + String(message.runtime || RUNTIME_VERSION);
        finish(resolve, message);
        return;
      }
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.ok) request.resolve(message.result || {});
      else request.reject(new Error(message.error || "Pretočni model ni vrnil rezultata."));
    });
    child.stderr.on("data", (part) => { stderr = (stderr + part.toString("utf8")).slice(-16000); });
    child.on("error", (error) => finish(reject, error));
    child.on("exit", (code) => {
      if (!child.intentionalStop) rejectPending(new Error("Lokalni pretočni proces se je ustavil."));
      if (!child.intentionalStop) resetSession();
      if (!child.intentionalStop && worker === child && engineStatus === "ready") {
        engineStatus = "error";
        engineError = stderr.trim() || `Pretočni proces se je ustavil (koda ${code}).`;
      }
      finish(reject, new Error(stderr.trim() || `Zagon pretočnega pogona ni uspel (koda ${code}).`));
    });
  });
}

async function initializeEngine() {
  if (!process.env.LOCALAPPDATA && !process.env.UJ_SPEECH_HOME) throw new Error("LOCALAPPDATA ni nastavljen; nastavite UJ_SPEECH_HOME.");
  const modelPath = findFile(path.join(DATA_ROOT, "model"), [MODEL_NAME]);
  const runtimeRoot = path.join(DATA_ROOT, "runtime", "transcribe", RUNTIME_VERSION);
  let dllPath = "";
  if (RUNTIME_DLL && fs.existsSync(RUNTIME_DLL)) {
    dllPath = RUNTIME_DLL;
    runtimeSource = "explicit";
  } else {
    dllPath = findFile(runtimeRoot, ["transcribe.dll"]);
    runtimeSource = "uj-bundled";
  }
  directFeedSamples = Number(process.env.UJ_ATENA_FEED_SAMPLES || 17920);
  if (!Number.isInteger(directFeedSamples) || directFeedSamples < 1280 || directFeedSamples > 17920) directFeedSamples = 17920;
  if (!modelPath || !dllPath) throw new Error("Nemotron 3.5 ali lokalni transcribe.cpp runtime manjka. Zaženite npm run setup:slovenski-prepis.");
  await launchWorker(dllPath, modelPath);
  engineStatus = "ready";
  engineError = "";
}

function startEngine() {
  engineStatus = "loading";
  engineError = "";
  enginePromise = initializeEngine().catch((error) => {
    engineStatus = "error";
    engineError = error.message;
    throw error;
  });
  enginePromise.catch(() => null);
  return enginePromise;
}

function restartEngine() {
  if (engineRecoveryPromise) return engineRecoveryPromise;
  engineRecoveryPromise = (async () => {
    const previousWorker = worker;
    stopWorker();
    await waitForWorkerExit(previousWorker);
    return startEngine();
  })().finally(() => { engineRecoveryPromise = null; });
  return engineRecoveryPromise;
}

async function recoverAfterSessionRpcFailure() {
  await withTimeout(restartEngine(), SESSION_START_TIMEOUT_MS, "Obnova Nemotron pogona je trajala predolgo.").catch(() => null);
}

async function ensureEngineReady() {
  if (engineStatus === "ready") return;
  if (engineStatus === "loading" && enginePromise) return enginePromise;
  return startEngine();
}

function rpc(command, extra = {}) {
  if (!worker || worker.killed || engineStatus !== "ready") return Promise.reject(new Error(engineError || "Pretočni model še ni pripravljen."));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.stdin.write(`${JSON.stringify({ id, command, ...extra })}\n`, "utf8", (error) => {
      if (!error) return;
      pending.delete(id);
      reject(error);
    });
  });
}

function health() {
  const sortedFeedTimes = feedDurationsMs.slice().sort((left, right) => left - right);
  const percentile = (ratio) => sortedFeedTimes.length
    ? sortedFeedTimes[Math.min(sortedFeedTimes.length - 1, Math.floor((sortedFeedTimes.length - 1) * ratio))]
    : 0;
  return {
    ok: engineStatus === "ready", status: engineStatus, backend, language: LANGUAGE,
    model: MODEL_NAME, localOnly: true, active: activeSession, error: engineError || null,
    publicEndpoint: PUBLIC_ENDPOINT, publicEndpointVerified: PUBLIC_ENDPOINT_VERIFIED,
    qualityReady: engineStatus === "ready", qualityModel: MODEL_NAME,
    liveEngine: "nemotron-3.5-de-streaming",
    streamingMode: directFeedSamples === 1280 ? "native-direct-feed-r13-1120ms" : "native-buffered-feed-r13-1120ms",
    runtimeSource, directFeedSamples, rawAudioStored: false,
    capacity: { active: activeSession ? 1 : 0, maximum: 1, busy: activeSession },
    limits: {
      sessionSeconds: MAX_SESSION_SECONDS, idleSeconds: MAX_SESSION_IDLE_SECONDS,
      audioRequestsPerSecond: MAX_AUDIO_REQUESTS_PER_SECOND,
      startTimeoutSeconds: SESSION_START_TIMEOUT_MS / 1000,
      feedTimeoutSeconds: SESSION_FEED_TIMEOUT_MS / 1000,
      stopTimeoutSeconds: SESSION_STOP_TIMEOUT_MS / 1000,
    },
    performance: { feedCount: sortedFeedTimes.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95), maxMs: sortedFeedTimes.length ? sortedFeedTimes[sortedFeedTimes.length - 1] : 0 },
  };
}

function validSession(req, origin) {
  if (!activeSession || !activeSessionId || req.headers["x-uj-prepis-session"] !== activeSessionId) return false;
  if (!isPublicRequest(req, origin)) return true;
  assertTrustedPublicTransport(req, origin);
  const requestTokenHash = tokenHash(bearerToken(req));
  return Boolean(activeSessionUserId) && sameTokenHash(requestTokenHash, activeSessionTokenHash);
}

function sessionExpired() {
  const now = Date.now();
  return activeSession && (
    activeSessionStartedAt && now - activeSessionStartedAt > MAX_SESSION_SECONDS * 1000 ||
    activeSessionLastSeenAt && now - activeSessionLastSeenAt > MAX_SESSION_IDLE_SECONDS * 1000
  );
}

function audioRateAllowed() {
  const now = Date.now();
  if (!audioRateWindowStartedAt || now - audioRateWindowStartedAt >= 1000) {
    audioRateWindowStartedAt = now;
    audioRateWindowCount = 0;
  }
  audioRateWindowCount += 1;
  return audioRateWindowCount <= MAX_AUDIO_REQUESTS_PER_SECOND;
}

async function releaseExpiredSession() {
  if (!sessionExpired()) return false;
  try {
    await withTimeout(rpc("stop"), SESSION_STOP_TIMEOUT_MS, "Potekle govorne seje ni bilo mogoče zaključiti.");
    resetSession();
  } catch (_) {
    await recoverAfterSessionRpcFailure();
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    reply(res, 403, { ok: false, error: "Ta izvor nima dostopa do lokalnega prepisa." });
    return;
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-UJ-Prepis-Session",
      "Access-Control-Max-Age": "600", Vary: "Origin",
    });
    res.end();
    return;
  }
  try {
    if (req.method === "GET" && req.url === "/health") {
      assertTrustedPublicTransport(req, origin);
      if (engineStatus === "error") await withTimeout(ensureEngineReady(), 60000, "Ponovni zagon Nemotron pogona je trajal predolgo.");
      reply(res, engineStatus === "error" ? 503 : 200, health(), origin);
      return;
    }
    if (req.method === "POST" && req.url === "/session/start") {
      const identity = await authenticateRequest(req, origin);
      if (engineStatus === "loading" && enginePromise) await enginePromise;
      if (engineStatus !== "ready") throw new Error(engineError || "Pretočni model še ni pripravljen.");
      await releaseExpiredSession();
      if (activeSession || sessionStarting) {
        reply(res, 429, { ok: false, code: "SPEECH_CAPACITY_BUSY", error: "Govorni servis trenutno obdeluje drugo sejo. Poskusite znova čez trenutek." }, origin);
        return;
      }
      sessionStarting = true;
      try {
        await withTimeout(rpc("start"), SESSION_START_TIMEOUT_MS, "Zagon pretočne seje je trajal predolgo.");
      } catch (error) {
        await recoverAfterSessionRpcFailure();
        throw error;
      } finally {
        sessionStarting = false;
      }
      activeSession = true;
      activeSessionId = crypto.randomUUID();
      activeSessionUserId = identity.userId;
      activeSessionTokenHash = identity.tokenHash;
      activeSessionStartedAt = Date.now();
      activeSessionLastSeenAt = activeSessionStartedAt;
      reply(res, 200, { ok: true, backend, language: LANGUAGE, sessionId: activeSessionId, text: "", committedText: "", tentativeText: "", final: false }, origin);
      return;
    }
    if (req.method === "POST" && req.url === "/session/audio") {
      if (!validSession(req, origin)) { reply(res, 409, { ok: false, error: "Snemanje ni zagnano ali seja ni veljavna." }, origin); return; }
      if (await releaseExpiredSession()) { reply(res, 410, { ok: false, error: "Najdaljši čas govorne seje je potekel." }, origin); return; }
      if (!audioRateAllowed()) { reply(res, 429, { ok: false, error: "Zvočni paketi prihajajo prehitro." }, origin); return; }
      const audio = await readBody(req, 2 * 1024 * 1024);
      if (!audio.length || audio.length % 4 !== 0) { reply(res, 400, { ok: false, error: "Pričakovan je 16 kHz mono Float32 PCM." }, origin); return; }
      receivedBytes += audio.length;
      activeSessionLastSeenAt = Date.now();
      if (receivedBytes > MAX_SESSION_BYTES) throw new Error("Posnetek je predolg za eno pretočno sejo.");
      const feedStartedAt = Date.now();
      let result;
      try {
        result = await withTimeout(rpc("feed", { pcm: audio.toString("base64") }), SESSION_FEED_TIMEOUT_MS, "Pretočni prepis je trajal predolgo.");
      } catch (error) {
        await recoverAfterSessionRpcFailure();
        throw error;
      }
      feedDurationsMs.push(Date.now() - feedStartedAt);
      if (feedDurationsMs.length > 120) feedDurationsMs.shift();
      const fullText = sanitizeTranscript(result.fullText);
      committedText = sanitizeTranscript(result.committedText);
      const tentativeText = sanitizeTranscript(result.tentativeText);
      reply(res, 200, {
        ok: true, backend, language: LANGUAGE, text: fullText || appendText(committedText, tentativeText),
        committedText, tentativeText, final: false,
      }, origin);
      return;
    }
    if (req.method === "POST" && req.url === "/session/stop") {
      if (!validSession(req, origin)) { reply(res, 409, { ok: false, error: "Snemanje ni zagnano ali seja ni veljavna." }, origin); return; }
      let result;
      try {
        result = await withTimeout(rpc("stop"), SESSION_STOP_TIMEOUT_MS, "Zaključek pretočnega prepisa je trajal predolgo.");
      } catch (error) {
        await recoverAfterSessionRpcFailure();
        throw error;
      }
      const finalText = sanitizeTranscript(result.fullText || result.committedText);
      resetSession();
      reply(res, 200, {
        ok: true, backend, language: LANGUAGE, text: finalText, finalText,
        committedText: finalText, tentativeText: "",
        final: true, accurate: Boolean(finalText), qualityBackend: backend,
      }, origin);
      return;
    }
    reply(res, 404, { ok: false, error: "Neznana lokalna pot." }, origin);
  } catch (error) {
    reply(res, error.status || 500, { ok: false, code: error.code || undefined, error: error.message }, origin);
  }
});

function openWidget() {
  if (!process.argv.includes("--open")) return;
  const url = "http://localhost:8001/app/slovenski-prepis.html";
  const edgeCandidates = [
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.PROGRAMFILES || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  ];
  const edge = edgeCandidates.find((candidate) => candidate && fs.existsSync(candidate));
  if (edge) {
    const child = spawn(edge, [`--app=${url}`, "--window-size=440,720"], { detached: true, stdio: "ignore" });
    child.unref();
  } else {
    const child = spawn("cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
  }
}

server.listen(PORT, HOST, () => {
  console.log(`Atena Nemotron 3.5 (de-DE): http://${HOST}:${PORT}`);
  console.log("Nemški pretočni model ostaja naložen; zvok ostaja izključno na 127.0.0.1.");
  openWidget();
});
startEngine();
function shutdown() {
  stopWorker();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
