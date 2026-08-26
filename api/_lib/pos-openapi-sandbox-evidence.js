"use strict";

const crypto = require("node:crypto");

const EXPECTED_EVIDENCE_SHA256 = "58ad80eb85ed2060ca27eaffd2096ff3264e20cfabeee1727b3990b21f0e264b";
const MAX_CAPTURE_DELAY_MS = 2 * 60 * 60 * 1000;
const MAX_EVENT_SPAN_MS = 5 * 60 * 1000;

function canonicalSha256(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function controlledSandboxEvidence(value) {
  const rows = Array.isArray(value && value.cases) ? value.cases : [];
  const normalized = rows.map((entry) => ({
    kind: String(entry && entry.kind || ""),
    type: String(entry && entry.type || ""),
    providerReference: String(entry && entry.providerReference || ""),
    documentNumber: String(entry && entry.documentNumber || ""),
    originalDocumentNumber: String(entry && entry.originalDocumentNumber || ""),
    billingReferenceDocumentNumber: String(entry && entry.billingReferenceDocumentNumber || ""),
    state: String(entry && entry.state || "").toUpperCase(),
    externalStatus: String(entry && entry.externalStatus || "").toLowerCase(),
    providerEventAt: String(entry && entry.providerEventAt || ""),
  }));
  const kinds = new Set(normalized.map((entry) => entry.kind));
  const references = new Set(normalized.map((entry) => entry.providerReference));
  const documents = new Set(normalized.map((entry) => entry.documentNumber));
  const originals = new Set(normalized.map((entry) => entry.originalDocumentNumber));
  const runIds = normalized.map((entry) => {
    const documentMatch = entry.documentNumber.match(/-(\d+)$/);
    const originalMatch = entry.originalDocumentNumber.match(/-(\d+)$/);
    return documentMatch && originalMatch && documentMatch[1] === originalMatch[1] ? documentMatch[1] : "";
  });
  const eventTimes = normalized.map((entry) => Date.parse(entry.providerEventAt));
  const observedOn = String(value && value.observedOn || "");
  const observedDayMatches = normalized.length === 2 && eventTimes.every((time) => (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === observedOn
  ));
  const captureFresh = normalized.length === 2
    && runIds.every(Boolean)
    && new Set(runIds).size === 1
    && eventTimes.every((time) => Number.isFinite(time)
      && time >= Number(runIds[0])
      && time - Number(runIds[0]) <= MAX_CAPTURE_DELAY_MS)
    && Math.max(...eventTimes) - Math.min(...eventTimes) <= MAX_EVENT_SPAN_MS
    && observedDayMatches;
  const identityVerified = normalized.length === 2
    && kinds.size === 2 && kinds.has("cancellation") && kinds.has("credit_note")
    && references.size === 2 && documents.size === 2 && originals.size === 2
    && normalized.every((entry) => entry.type === "381"
      && /^[0-9a-f]{24}$/i.test(entry.providerReference)
      && /^SBX-[A-Za-z0-9-]+$/.test(entry.documentNumber)
      && /^SBX-[A-Za-z0-9-]+$/.test(entry.originalDocumentNumber)
      && /^SBX-[A-Za-z0-9-]+$/.test(entry.billingReferenceDocumentNumber)
      && entry.billingReferenceDocumentNumber === entry.originalDocumentNumber);
  const integrityVerified = Boolean(value)
    && Number(value.version) === 1
    && canonicalSha256(value) === EXPECTED_EVIDENCE_SHA256;
  const complete = identityVerified && captureFresh && integrityVerified;
  const successful = complete && normalized.every((entry) => entry.state === "DONE"
    || (entry.state === "SENT" && entry.externalStatus === "succeeded"));
  return {
    provided: Boolean(value),
    complete,
    successful,
    integrityVerified,
    identityVerified,
    captureFresh,
    cases: normalized,
  };
}

module.exports = {
  EXPECTED_EVIDENCE_SHA256,
  MAX_CAPTURE_DELAY_MS,
  MAX_EVENT_SPAN_MS,
  canonicalSha256,
  controlledSandboxEvidence,
};
