"use strict";

const crypto = require("crypto");
const {
  S3Client,
  GetObjectCommand,
  GetObjectLockConfigurationCommand,
  HeadObjectCommand,
  PutObjectCommand
} = require("@aws-sdk/client-s3");

const REQUIRED_REGION = "eu-central-1";
const PROVIDER = "aws_s3_object_lock";
const MAX_TEST_RETENTION_DAYS = 30;
const MAX_ARCHIVE_BYTES = 5 * 1024 * 1024;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

function bool(value) {
  return String(value || "").toLowerCase() === "true";
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function configuration(env) {
  const source = env || process.env;
  const region = String(source.POS_ARCHIVE_S3_REGION || REQUIRED_REGION).trim();
  const bucket = String(source.POS_ARCHIVE_S3_BUCKET || "").trim();
  const accessKeyId = String(source.POS_ARCHIVE_S3_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(source.POS_ARCHIVE_S3_SECRET_ACCESS_KEY || "").trim();
  const sessionToken = String(source.POS_ARCHIVE_S3_SESSION_TOKEN || "").trim();
  const configured = Boolean(bucket && accessKeyId && secretAccessKey);

  if (region !== REQUIRED_REGION) {
    throw codedError("AWS_REGION_NOT_FRANKFURT", "POS arhiv mora biti v regiji eu-central-1 (Frankfurt)." );
  }
  if (bucket && !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw codedError("AWS_BUCKET_INVALID", "Ime AWS arhivskega predala ni veljavno.");
  }
  if ((accessKeyId && !secretAccessKey) || (!accessKeyId && secretAccessKey)) {
    throw codedError("AWS_CREDENTIALS_INCOMPLETE", "AWS arhivski poverilnici nista popolni.");
  }

  return {
    configured,
    provider: PROVIDER,
    region,
    bucket,
    credentials: configured ? { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) } : null,
    liveEnabled: bool(source.POS_ARCHIVE_S3_LIVE_ENABLED),
    testRetentionDays: boundedInteger(source.POS_ARCHIVE_S3_TEST_RETENTION_DAYS, 7, 1, MAX_TEST_RETENTION_DAYS)
  };
}

function codedError(code, message, cause) {
  const error = new Error(message || code);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

function safeErrorCode(error) {
  const ownCode = String(error && (error.code || error.name) || "UNKNOWN_ERROR").toUpperCase();
  const normalized = ownCode.replace(/[^A-Z0-9_]/g, "_").slice(0, 80);
  if (normalized === "NOTFOUND" || normalized === "NOSUCHKEY" || normalized === "NOSUCHVERSION") return "AWS_OBJECT_NOT_FOUND";
  if (normalized.includes("CREDENTIAL")) return "AWS_CREDENTIALS_REJECTED";
  if (normalized.includes("ACCESSDENIED") || normalized.includes("FORBIDDEN")) return "AWS_ACCESS_DENIED";
  if (normalized.includes("TIMEOUT")) return "AWS_TIMEOUT";
  return normalized || "UNKNOWN_ERROR";
}

function hexToBase64(value) {
  const hex = String(value || "");
  if (!/^[0-9a-f]{64}$/.test(hex)) throw codedError("SOURCE_HASH_INVALID", "Izvorna kontrolna vsota ni veljavna.");
  return Buffer.from(hex, "hex").toString("base64");
}

function base64ToHex(value) {
  const text = String(value || "");
  if (!text) return "";
  const buffer = Buffer.from(text, "base64");
  return buffer.length === 32 ? buffer.toString("hex") : "";
}

async function readBodyBounded(body, maxBytes) {
  const limit = Math.min(Math.max(Number(maxBytes) || 0, 1), MAX_ARCHIVE_BYTES);
  if (body && typeof body[Symbol.asyncIterator] === "function") {
    const chunks = [];
    let total = 0;
    for await (const part of body) {
      const chunk = Buffer.from(part);
      total += chunk.length;
      if (total > limit) {
        if (typeof body.destroy === "function") body.destroy();
        throw codedError("AWS_RECOVERY_TOO_LARGE", "Obnovljena AWS kopija presega dovoljeno velikost.");
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, total);
  }
  if (body && typeof body.transformToByteArray === "function") {
    const buffer = Buffer.from(await body.transformToByteArray());
    if (buffer.length > limit) throw codedError("AWS_RECOVERY_TOO_LARGE", "Obnovljena AWS kopija presega dovoljeno velikost.");
    return buffer;
  }
  throw codedError("AWS_RECOVERY_STREAM_UNSUPPORTED", "Obnovljene AWS kopije ni bilo mogoče prebrati.");
}

function objectKey(record) {
  const extension = record.original_media_type === "application/xml" ? "xml" : "pdf";
  const userId = String(record.user_id || "").toLowerCase();
  const recordId = String(record.id || "").toLowerCase();
  const checksum = String(record.sha256 || "").toLowerCase();
  if (!/^[0-9a-f-]{36}$/.test(userId) || !/^[0-9a-f-]{36}$/.test(recordId)) {
    throw codedError("ARCHIVE_ID_INVALID", "Arhivski identifikator ni veljaven.");
  }
  if (!/^[0-9a-f]{64}$/.test(checksum)) throw codedError("SOURCE_HASH_INVALID", "Izvorna kontrolna vsota ni veljavna.");
  return "pos-originals/" + userId + "/" + recordId + "/" + checksum + "." + extension;
}

function retentionFor(record, cfg, nowValue) {
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue || Date.now());
  if (Number.isNaN(now.getTime())) throw codedError("CLOCK_INVALID", "Sistemski čas ni veljaven.");
  if (record.is_test) {
    return {
      // A production-account recovery check must exercise the same immutable
      // lock mode that protects live invoices. The short test retention keeps
      // the bootstrap probe bounded while still proving COMPLIANCE support.
      mode: cfg.liveEnabled ? "COMPLIANCE" : "GOVERNANCE",
      retainUntil: new Date(now.getTime() + cfg.testRetentionDays * 86400000)
    };
  }
  if (!cfg.liveEnabled) {
    throw codedError("LIVE_WORM_NOT_ENABLED", "Produkcijski WORM arhiv še ni izrecno omogočen.");
  }
  const retainUntil = new Date(String(record.retention_not_before || "") + "T23:59:59.999Z");
  if (Number.isNaN(retainUntil.getTime()) || retainUntil <= now) {
    throw codedError("LIVE_RETENTION_INVALID", "Produkcijski datum hrambe ni veljaven.");
  }
  return { mode: "COMPLIANCE", retainUntil };
}

function makeClient(cfg) {
  if (!cfg.configured) throw codedError("AWS_ARCHIVE_NOT_CONFIGURED", "AWS arhiv še ni povezan.");
  return new S3Client({
    region: cfg.region,
    credentials: cfg.credentials,
    maxAttempts: 3,
    retryMode: "standard"
  });
}

async function verifyBucketObjectLock(client, cfg) {
  let result;
  try {
    result = await client.send(new GetObjectLockConfigurationCommand({ Bucket: cfg.bucket }));
  } catch (error) {
    throw codedError(safeErrorCode(error), "Nastavitve AWS Object Lock ni bilo mogoče preveriti.", error);
  }
  if (!result || !result.ObjectLockConfiguration || result.ObjectLockConfiguration.ObjectLockEnabled !== "Enabled") {
    throw codedError("AWS_OBJECT_LOCK_DISABLED", "AWS predal nima omogočenega Object Lock.");
  }
  return result.ObjectLockConfiguration;
}

function isNotFound(error) {
  return Boolean(error && (
    error.name === "NotFound" || error.name === "NoSuchKey" || error.name === "NoSuchVersion" ||
    Number(error.$metadata && error.$metadata.httpStatusCode) === 404
  ));
}

function validateHead(head, record, requiredRetention) {
  const checksumHex = base64ToHex(head && head.ChecksumSHA256);
  const metadataHash = String(head && head.Metadata && head.Metadata.sha256 || "").toLowerCase();
  const remoteSize = Number(head && head.ContentLength);
  const remoteMode = String(head && head.ObjectLockMode || "");
  const remoteRetainUntil = head && head.ObjectLockRetainUntilDate
    ? new Date(head.ObjectLockRetainUntilDate)
    : null;
  const requiredTime = requiredRetention.retainUntil.getTime();

  if (checksumHex !== record.sha256 || metadataHash !== record.sha256) {
    throw codedError("AWS_CHECKSUM_MISMATCH", "Kontrolna vsota AWS kopije se ne ujema z izvirnikom.");
  }
  if (remoteSize !== Number(record.byte_size)) {
    throw codedError("AWS_SIZE_MISMATCH", "Velikost AWS kopije se ne ujema z izvirnikom.");
  }
  if (remoteMode !== requiredRetention.mode || !remoteRetainUntil || remoteRetainUntil.getTime() < requiredTime) {
    throw codedError("AWS_RETENTION_MISMATCH", "AWS kopija nima zahtevanega načina ali roka zaklepa.");
  }
  if (!head.VersionId) throw codedError("AWS_VERSION_MISSING", "AWS kopija nima različice objekta.");

  return {
    bucket: null,
    objectKey: null,
    objectVersionId: String(head.VersionId),
    objectEtag: String(head.ETag || ""),
    remoteChecksumSha256: checksumHex,
    remoteByteSize: remoteSize,
    objectLockMode: remoteMode,
    retainUntil: remoteRetainUntil.toISOString()
  };
}

async function headObject(client, cfg, key, versionId) {
  const input = { Bucket: cfg.bucket, Key: key, ChecksumMode: "ENABLED" };
  if (versionId) input.VersionId = versionId;
  try {
    return await client.send(new HeadObjectCommand(input));
  } catch (error) {
    if (isNotFound(error)) return null;
    throw codedError(safeErrorCode(error), "AWS kopije ni bilo mogoče preveriti.", error);
  }
}

async function copyAndVerify(client, cfg, record, buffer, nowValue) {
  if (!cfg.configured) throw codedError("AWS_ARCHIVE_NOT_CONFIGURED", "AWS arhiv še ni povezan.");
  if (!Buffer.isBuffer(buffer) || buffer.length !== Number(record.byte_size) || buffer.length > MAX_ARCHIVE_BYTES) {
    throw codedError("SOURCE_SIZE_MISMATCH", "Velikost izvirnika pred kopiranjem ni pravilna.");
  }
  const sourceHash = crypto.createHash("sha256").update(buffer).digest("hex");
  if (sourceHash !== record.sha256) {
    throw codedError("SOURCE_HASH_MISMATCH", "Kontrolna vsota izvirnika pred kopiranjem ni pravilna.");
  }
  const key = objectKey(record);
  const existingVersionId = String(record.replica_object_version_id || "");
  const retention = existingVersionId ? {
    mode: String(record.replica_object_lock_mode || ""),
    retainUntil: new Date(record.replica_retain_until)
  } : retentionFor(record, cfg, nowValue);
  if (!/^(GOVERNANCE|COMPLIANCE)$/.test(retention.mode) || Number.isNaN(retention.retainUntil.getTime())) {
    throw codedError("AWS_RETENTION_INVALID", "Shranjeni rok AWS kopije ni veljaven.");
  }
  if (existingVersionId && (record.replica_bucket !== cfg.bucket || record.replica_object_key !== key)) {
    throw codedError("AWS_REPLICA_IDENTITY_MISMATCH", "Shranjena identiteta AWS kopije ni skladna z arhivskim zapisom.");
  }
  let head = await headObject(client, cfg, key, existingVersionId || undefined);

  if (existingVersionId && !head) {
    throw codedError("AWS_OBJECT_NOT_FOUND", "Zaklenjena različica AWS kopije ni bila najdena.");
  }

  if (!head) {
    let uploaded;
    const sourceMetadata = {
      sha256: record.sha256,
      archive_record_id: String(record.id),
      source_table: String(record.source_table || ""),
      source_id: String(record.source_id || "")
    };
    if (record.invoice_id) sourceMetadata.invoice_id = String(record.invoice_id);
    try {
      uploaded = await client.send(new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: buffer,
        ContentLength: buffer.length,
        ContentType: record.original_media_type,
        ChecksumAlgorithm: "SHA256",
        ChecksumSHA256: hexToBase64(record.sha256),
        Metadata: sourceMetadata,
        ServerSideEncryption: "AES256",
        ObjectLockMode: retention.mode,
        ObjectLockRetainUntilDate: retention.retainUntil
      }));
    } catch (error) {
      throw codedError(safeErrorCode(error), "Izvirnika ni bilo mogoče zapisati v AWS WORM arhiv.", error);
    }
    if (!uploaded || !uploaded.VersionId) {
      throw codedError("AWS_VERSION_MISSING", "AWS ni vrnil različice zapisane kopije.");
    }
    head = await headObject(client, cfg, key, uploaded.VersionId);
  }
  if (!head) throw codedError("AWS_OBJECT_NOT_FOUND", "AWS kopija po zapisu ni bila najdena.");

  const result = validateHead(head, record, retention);
  result.bucket = cfg.bucket;
  result.objectKey = key;
  return result;
}

function recoveryIdentity(cfg, record, nowValue, options) {
  const key = objectKey(record);
  const versionId = String(record.replica_object_version_id || "").trim();
  const alternateVersionId = String(record.objectVersionId || "").trim();
  const expectedBucket = String(record.replica_bucket || "").trim();
  const expectedKey = String(record.replica_object_key || "");
  if (!versionId) {
    throw codedError("AWS_VERSION_MISSING", "AWS kopija nima natančno določene shranjene različice.");
  }
  if (alternateVersionId && alternateVersionId !== versionId) {
    throw codedError("AWS_VERSION_AMBIGUOUS", "Identiteta AWS različice je dvoumna.");
  }
  if (expectedBucket !== cfg.bucket || expectedKey !== key) {
    throw codedError("AWS_REPLICA_IDENTITY_MISMATCH", "AWS kopija nima popolne shranjene identitete.");
  }
  const mode = String(record.replica_object_lock_mode || "").trim();
  const retainUntil = new Date(record.replica_retain_until);
  if (!/^(GOVERNANCE|COMPLIANCE)$/.test(mode) || Number.isNaN(retainUntil.getTime())) {
    throw codedError("AWS_RETENTION_INVALID", "Shranjeni zaklep AWS različice ni veljaven.");
  }
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue || Date.now());
  if (Number.isNaN(now.getTime())) throw codedError("CLOCK_INVALID", "Sistemski čas ni veljaven.");

  if (!record.is_test) {
    if (!cfg.liveEnabled) {
      throw codedError("LIVE_WORM_NOT_ENABLED", "Produkcijski WORM arhiv še ni izrecno omogočen.");
    }
    const legalMinimum = new Date(String(record.retention_not_before || "") + "T23:59:59.999Z");
    if (Number.isNaN(legalMinimum.getTime()) || legalMinimum <= now) {
      throw codedError("LIVE_RETENTION_INVALID", "Produkcijski datum hrambe ni veljaven.");
    }
    if (mode !== "COMPLIANCE" || retainUntil.getTime() < legalMinimum.getTime()) {
      throw codedError("AWS_RETENTION_MISMATCH", "Produkcijska AWS kopija nima zahtevanega COMPLIANCE roka.");
    }
    return { key, versionId, mode: "COMPLIANCE", retainUntil };
  }

  const expectedMode = cfg.liveEnabled ? "COMPLIANCE" : "GOVERNANCE";
  if (mode !== expectedMode || retainUntil.getTime() <= now.getTime()) {
    throw codedError("AWS_RETENTION_MISMATCH", "Testna AWS kopija nima pričakovanega aktivnega zaklepa.");
  }
  const lastAttemptRaw = String(record.replica_last_attempt_at || "").trim();
  const copiedAtRaw = String(record.replica_copied_at || "").trim();
  const lastAttemptAt = new Date(lastAttemptRaw);
  const copiedAt = new Date(copiedAtRaw);
  const configuredIntervalMs = cfg.testRetentionDays * 86400000;
  if (lastAttemptRaw && copiedAtRaw
      && !Number.isNaN(lastAttemptAt.getTime()) && !Number.isNaN(copiedAt.getTime())) {
    const earliest = lastAttemptAt.getTime() + configuredIntervalMs - MAX_CLOCK_SKEW_MS;
    const latest = copiedAt.getTime() + configuredIntervalMs + MAX_CLOCK_SKEW_MS;
    if (copiedAt < lastAttemptAt || retainUntil.getTime() < earliest || retainUntil.getTime() > latest) {
      throw codedError("AWS_RETENTION_MISMATCH", "Testni AWS rok se ne ujema s konfiguriranim intervalom.");
    }
  } else {
    const immediateRecovery = options && options.allowUnanchoredTest === true
      && !record.missing_integrity_event_id && !lastAttemptRaw && !copiedAtRaw;
    if (!immediateRecovery) {
      throw codedError("AWS_RETENTION_INVALID", "Testna AWS kopija nima popolnih časovnih dokazov zaklepa.");
    }
    if (retainUntil.getTime() > now.getTime() + configuredIntervalMs + MAX_CLOCK_SKEW_MS) {
      throw codedError("AWS_RETENTION_MISMATCH", "Testni AWS rok presega konfigurirani interval.");
    }
  }
  return { key, versionId, mode: expectedMode, retainUntil };
}

async function recoverAndVerify(client, cfg, record, nowValue, options) {
  const identity = recoveryIdentity(cfg, record, nowValue, options);
  const head = await headObject(client, cfg, identity.key, identity.versionId);
  if (!head) throw codedError("AWS_OBJECT_NOT_FOUND", "Zaklenjena različica AWS kopije ni bila najdena.");
  const verifiedHead = validateHead(head, record, {
    mode: identity.mode,
    retainUntil: identity.retainUntil
  });
  if (verifiedHead.objectVersionId !== identity.versionId) {
    throw codedError("AWS_VERSION_MISMATCH", "AWS je vrnil drugo različico od zahtevane.");
  }
  let response;
  try {
    response = await client.send(new GetObjectCommand({
      Bucket: cfg.bucket,
      Key: identity.key,
      VersionId: identity.versionId,
      ChecksumMode: "ENABLED"
    }));
  } catch (error) {
    throw codedError(safeErrorCode(error), "AWS kopije ni bilo mogoče obnoviti.", error);
  }
  const expectedSize = Number(record.byte_size);
  const declaredSize = Number(response && response.ContentLength);
  if (!response || !response.Body || String(response.VersionId || "") !== identity.versionId
    || !Number.isSafeInteger(expectedSize) || expectedSize < 1
    || expectedSize > MAX_ARCHIVE_BYTES || declaredSize !== expectedSize) {
    throw codedError("AWS_RECOVERY_INVALID", "Obnovljena AWS kopija ni veljavna.");
  }
  const buffer = await readBodyBounded(response.Body, expectedSize);
  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
  if (buffer.length !== Number(record.byte_size) || checksum !== record.sha256) {
    throw codedError("AWS_RECOVERY_HASH_MISMATCH", "Obnovljena AWS kopija se ne ujema z izvirnikom.");
  }
  const responseChecksum = base64ToHex(response.ChecksumSHA256);
  if (responseChecksum && responseChecksum !== checksum) {
    throw codedError("AWS_RECOVERY_HASH_MISMATCH", "AWS kontrolna vsota obnovljene različice se ne ujema.");
  }
  return { sha256: checksum, byteSize: buffer.length, versionId: identity.versionId, buffer };
}

module.exports = {
  PROVIDER,
  REQUIRED_REGION,
  configuration,
  makeClient,
  verifyBucketObjectLock,
  copyAndVerify,
  recoverAndVerify,
  safeErrorCode,
  _test: {
    MAX_ARCHIVE_BYTES,
    MAX_TEST_RETENTION_DAYS,
    MAX_CLOCK_SKEW_MS,
    hexToBase64,
    base64ToHex,
    objectKey,
    recoveryIdentity,
    retentionFor,
    readBodyBounded,
    validateHead
  }
};
