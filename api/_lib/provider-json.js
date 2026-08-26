"use strict";

async function readJson(response, options) {
  const settings = options || {};
  const maxBytes = Math.min(Math.max(Number(settings.maxBytes) || 1024 * 1024, 1024), 8 * 1024 * 1024);
  const fail = function () {
    const error = new Error(settings.message || "Odgovor ponudnika je prevelik.");
    error.code = settings.code || "PROVIDER_RESPONSE_TOO_LARGE";
    error.retryable = true;
    throw error;
  };
  const declared = Number(response && response.headers && response.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) fail();
  if (!response || !response.body || typeof response.body.getReader !== "function") {
    if (response && typeof response.arrayBuffer === "function") {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > maxBytes) fail();
      try { return JSON.parse(buffer.toString("utf8")); } catch (_) { return null; }
    }
    try { return await response.json(); } catch (_) { return null; }
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    const chunk = Buffer.from(part.value);
    total += chunk.length;
    if (total > maxBytes) {
      await reader.cancel().catch(function () {});
      fail();
    }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks, total).toString("utf8")); } catch (_) { return null; }
}

async function readText(response, options) {
  const settings = options || {};
  const maxBytes = Math.min(Math.max(Number(settings.maxBytes) || 1024 * 1024, 1024), 8 * 1024 * 1024);
  const fail = function () {
    const error = new Error(settings.message || "Odgovor ponudnika je prevelik.");
    error.code = settings.code || "PROVIDER_RESPONSE_TOO_LARGE";
    error.retryable = true;
    throw error;
  };
  const declared = Number(response && response.headers && response.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) fail();
  if (!response || !response.body || typeof response.body.getReader !== "function") {
    if (response && typeof response.arrayBuffer === "function") {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > maxBytes) fail();
      return buffer.toString("utf8");
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) fail();
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    const chunk = Buffer.from(part.value);
    total += chunk.length;
    if (total > maxBytes) {
      await reader.cancel().catch(function () {});
      fail();
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total).toString("utf8");
}

async function readBuffer(response, options) {
  const settings = options || {};
  const maxBytes = Math.min(Math.max(Number(settings.maxBytes) || 1024 * 1024, 1024), 8 * 1024 * 1024);
  const fail = function () {
    const error = new Error(settings.message || "Odgovor ponudnika je prevelik.");
    error.code = settings.code || "PROVIDER_RESPONSE_TOO_LARGE";
    error.retryable = true;
    throw error;
  };
  const declared = Number(response && response.headers && response.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) fail();
  if (!response || !response.body || typeof response.body.getReader !== "function") {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) fail();
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    const chunk = Buffer.from(part.value);
    total += chunk.length;
    if (total > maxBytes) {
      await reader.cancel().catch(function () {});
      fail();
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

module.exports = { readJson, readText, readBuffer };
