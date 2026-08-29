"use strict";

// Ena sama izvorna točka za trenutno različico zajema, predpomnilnika in
// pogodbe med strežnikom ter vmesnikom. Vmesnik se ne sme odločati po številki
// zajema ali ponovno presojati API-polij; prejme semantični oznaki evidenceReady
// in evidenceKind.
var CAPTURE_VERSION = "identity-evidence-v17-preserve-legal-modal";
var CACHE_VERSION = "impressum-parser-v49-scrapling-acquisition-fallback";
var CONTRACT_VERSION = "identity-evidence-contract-v2-structured-api";
var MINIMUM_SAFE_CAPTURE_MAJOR = 17;

function jeVeljavenJpegDataUrl(vrednost) {
  return /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(String(vrednost || ""));
}

function jeVeljavenVir(vrednost) {
  return /^https?:\/\//i.test(String(vrednost || ""));
}

function jePosnetekPrikazljiv(dokazilo) {
  if (!dokazilo || dokazilo.status !== "captured") return false;
  if (!jeVeljavenJpegDataUrl(dokazilo.imageDataUrl) || !jeVeljavenVir(dokazilo.sourceUrl)) return false;
  if (dokazilo.screenshotReady === false) return false;
  if (dokazilo.evidenceMode === "user_uploaded_official_screenshot") return true;

  // Delno siv prekrivni sloj ali skoraj prazen rezervni izris je bilo mogoče
  // zajeti tudi v starejših različicah. Zato stare avtomatske JPEG-e razveljavimo,
  // četudi so nekoč že nosili screenshotReady=true. Odjemalec še vedno prejme
  // samo novo semantično odločitev strežnika, ne pravila o številki različice.
  var zajem = String(dokazilo.captureVersion || "").match(/^identity-evidence-v(\d+)(?:-|$)/);
  return Boolean(zajem && Number(zajem[1]) >= MINIMUM_SAFE_CAPTURE_MAJOR &&
    dokazilo.viewportOverlaysRemoved === true);
}

function jeApiDokaziloUporabno(dokazilo) {
  if (!dokazilo || dokazilo.status !== "verified_api") return false;
  return jeVeljavenVir(dokazilo.sourceUrl) &&
    Boolean(String(dokazilo.companyId || "").trim()) &&
    Boolean(String(dokazilo.officialName || "").trim()) &&
    String(dokazilo.officialStreet || "").trim().length >= 3 &&
    /^\d{5}$/.test(String(dokazilo.officialPostalCode || "").trim()) &&
    String(dokazilo.officialCity || "").trim().length >= 2 &&
    Boolean(String(dokazilo.registerNumber || "").trim());
}

function jeDokaziloUporabno(dokazilo) {
  return jeApiDokaziloUporabno(dokazilo) || jePosnetekPrikazljiv(dokazilo);
}

function obogatiDokazilo(dokazilo) {
  if (!dokazilo || typeof dokazilo !== "object") return dokazilo;
  var screenshotReady = jePosnetekPrikazljiv(dokazilo);
  var apiReady = jeApiDokaziloUporabno(dokazilo);
  return Object.assign({}, dokazilo, {
    evidenceContractVersion: CONTRACT_VERSION,
    screenshotReady: screenshotReady,
    evidenceReady: screenshotReady || apiReady,
    evidenceKind: apiReady ? "structured_api" : screenshotReady ? "screenshot" : "",
  });
}

function obogatiRezultat(rezultat) {
  if (!rezultat || typeof rezultat !== "object" || !rezultat.identityEvidence) return rezultat;
  return Object.assign({}, rezultat, { identityEvidence: obogatiDokazilo(rezultat.identityEvidence) });
}

module.exports = {
  CAPTURE_VERSION: CAPTURE_VERSION,
  CACHE_VERSION: CACHE_VERSION,
  CONTRACT_VERSION: CONTRACT_VERSION,
  jePosnetekPrikazljiv: jePosnetekPrikazljiv,
  jeApiDokaziloUporabno: jeApiDokaziloUporabno,
  jeDokaziloUporabno: jeDokaziloUporabno,
  obogatiDokazilo: obogatiDokazilo,
  obogatiRezultat: obogatiRezultat,
};
