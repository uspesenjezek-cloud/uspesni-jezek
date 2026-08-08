/**
 * Centralne omejitve prilog računa (korak 3 – Vsebina koraka).
 * Ne spreminjaj teh vrednosti kar v komponentah – uvozi od tukaj.
 */
(function (root) {
  "use strict";

  var MAX_ATTACHMENTS_PER_STEP = 10;
  var MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
  var MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024;
  var ALLOWED_ATTACHMENT_MIME_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "image/*",
  ];

  var ACCEPT_ATTR =
    "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,image/*";

  function jeMimeDovoljen(mime, ime) {
    var m = String(mime || "").toLowerCase();
    var n = String(ime || "").toLowerCase();
    if (m === "application/pdf" || n.endsWith(".pdf")) return true;
    if (m.indexOf("image/") === 0) return true;
    if (/\.(jpe?g|png|webp|heic|heif)$/i.test(n)) return true;
    return false;
  }

  root.UJPrilogeKonstante = {
    MAX_ATTACHMENTS_PER_STEP: MAX_ATTACHMENTS_PER_STEP,
    MAX_FILE_SIZE_BYTES: MAX_FILE_SIZE_BYTES,
    MAX_TOTAL_ATTACHMENT_BYTES: MAX_TOTAL_ATTACHMENT_BYTES,
    ALLOWED_ATTACHMENT_MIME_TYPES: ALLOWED_ATTACHMENT_MIME_TYPES,
    ACCEPT_ATTR: ACCEPT_ATTR,
    jeMimeDovoljen: jeMimeDovoljen,
  };
})(typeof window !== "undefined" ? window : globalThis);
