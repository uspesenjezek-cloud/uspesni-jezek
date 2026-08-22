"use strict";

const crypto = require("crypto");
const supabase = require("./supabase-server");
const providerJson = require("./provider-json");

const CHECKER_VERSION = "pos-archive-integrity-v1";
const MAX_BYTES = 5 * 1024 * 1024;

function encodedPath(path) {
  return String(path || "").split("/").map(encodeURIComponent).join("/");
}

function hash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function readObject(cfg, record) {
  const response = await supabase.fetchZOmejitvijo(
    cfg.url + "/storage/v1/object/" + encodeURIComponent(record.storage_bucket) + "/" + encodedPath(record.storage_path),
    { headers: supabase.serviceHeaders(cfg, { Accept: record.original_media_type || "application/octet-stream" }) },
    20000
  );
  if (response.status === 400 || response.status === 404) return null;
  if (!response.ok) throw Object.assign(new Error("Arhiviranega originala ni bilo mogoče prebrati."), { status: response.status });
  return providerJson.readBuffer(response, {
    maxBytes: MAX_BYTES,
    code: "POS_ARCHIVE_OBJECT_TOO_LARGE",
    message: "Arhivirani original presega dovoljeno velikost."
  });
}

async function verifyRecord(cfg, record) {
  let buffer;
  try {
    buffer = await readObject(cfg, record);
  } catch (error) {
    return {
      result: "error", observed_sha256: null, observed_byte_size: null,
      checker_version: CHECKER_VERSION,
      details: { code: "STORAGE_READ_FAILED", status: Number(error && error.status || 0) || null }
    };
  }
  if (!buffer) {
    return {
      result: "missing", observed_sha256: null, observed_byte_size: null,
      checker_version: CHECKER_VERSION, details: { code: "OBJECT_MISSING" }
    };
  }
  const observedHash = hash(buffer);
  const observedSize = buffer.length;
  const sizeMatches = observedSize === Number(record.byte_size);
  const hashMatches = observedHash === record.sha256;
  return {
    result: !sizeMatches ? "size_mismatch" : !hashMatches ? "hash_mismatch" : "verified",
    observed_sha256: observedHash,
    observed_byte_size: observedSize,
    checker_version: CHECKER_VERSION,
    details: { hashMatches: hashMatches, sizeMatches: sizeMatches }
  };
}

async function writeEvent(cfg, record, verification) {
  const response = await supabase.fetchZOmejitvijo(cfg.url + "/rest/v1/pos_archive_integrity_events", {
    method: "POST",
    headers: supabase.serviceHeaders(cfg, { "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(Object.assign({
      user_id: record.user_id,
      archive_record_id: record.id
    }, verification))
  }, 12000);
  if (!response.ok) throw Object.assign(new Error("Rezultata preverjanja arhiva ni bilo mogoče shraniti."), { status: response.status });
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

async function verifyAndRecord(cfg, record) {
  const verification = await verifyRecord(cfg, record);
  const event = await writeEvent(cfg, record, verification);
  return { record: record, verification: verification, event: event };
}

module.exports = {
  CHECKER_VERSION,
  hash,
  readObject,
  verifyRecord,
  verifyAndRecord,
  _test: { encodedPath, MAX_BYTES }
};
