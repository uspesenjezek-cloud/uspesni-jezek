"use strict";

function requestError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function requestJson(req, maxBytes) {
  const limit = Math.min(Math.max(Number(maxBytes) || 16 * 1024, 1024), 128 * 1024);
  const declared = Number(req && req.headers && req.headers["content-length"] || 0);
  if (Number.isFinite(declared) && declared > limit) {
    throw requestError("Zahtevek je prevelik.", 413, "POS_REQUEST_BODY_TOO_LARGE");
  }

  const body = req && req.body;
  if (body == null || body === "") return {};
  let serialized;
  if (Buffer.isBuffer(body)) {
    if (body.length > limit) throw requestError("Zahtevek je prevelik.", 413, "POS_REQUEST_BODY_TOO_LARGE");
    serialized = body.toString("utf8");
  } else if (typeof body === "string") {
    if (Buffer.byteLength(body, "utf8") > limit) throw requestError("Zahtevek je prevelik.", 413, "POS_REQUEST_BODY_TOO_LARGE");
    serialized = body;
  } else if (typeof body === "object" && !Array.isArray(body)) {
    try { serialized = JSON.stringify(body); }
    catch (_) { throw requestError("Telo zahtevka ni veljaven JSON.", 400, "POS_REQUEST_BODY_INVALID"); }
    if (!serialized || Buffer.byteLength(serialized, "utf8") > limit) {
      throw requestError("Zahtevek je prevelik.", 413, "POS_REQUEST_BODY_TOO_LARGE");
    }
    return body;
  } else {
    throw requestError("Telo zahtevka ni veljaven JSON objekt.", 400, "POS_REQUEST_BODY_INVALID");
  }

  let parsed;
  try { parsed = JSON.parse(serialized); }
  catch (_) { throw requestError("Telo zahtevka ni veljaven JSON.", 400, "POS_REQUEST_BODY_INVALID"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw requestError("Telo zahtevka ni veljaven JSON objekt.", 400, "POS_REQUEST_BODY_INVALID");
  }
  return parsed;
}

module.exports = requestJson;
