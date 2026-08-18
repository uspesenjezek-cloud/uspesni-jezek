"use strict";

// Ena sama izvorna točka za trenutno različico zajema, predpomnilnika in
// pogodbe med strežnikom ter vmesnikom. Vmesnik se ne sme odločati po številki
// zajema; prejme samo semantično oznako screenshotReady.
var CAPTURE_VERSION = "identity-evidence-v16-visible-content-overlay-isolation";
var CACHE_VERSION = "impressum-parser-v37-openregister-register-reference";
var CONTRACT_VERSION = "identity-evidence-contract-v1";
var MINIMUM_SAFE_CAPTURE_MAJOR = 16;

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

function obogatiDokazilo(dokazilo) {
  if (!dokazilo || typeof dokazilo !== "object") return dokazilo;
  return Object.assign({}, dokazilo, {
    evidenceContractVersion: CONTRACT_VERSION,
    screenshotReady: jePosnetekPrikazljiv(dokazilo),
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
  obogatiDokazilo: obogatiDokazilo,
  obogatiRezultat: obogatiRezultat,
};
