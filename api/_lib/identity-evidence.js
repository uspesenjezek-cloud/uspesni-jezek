"use strict";

var crypto = require("node:crypto");

// Ena sama izvorna točka za trenutno različico zajema, predpomnilnika in
// pogodbe med strežnikom ter vmesnikom. Vmesnik se ne sme odločati po številki
// zajema ali ponovno presojati API-polij; prejme semantični oznaki evidenceReady
// in evidenceKind.
var CAPTURE_VERSION = "identity-evidence-v24-full-page-focused";
var CACHE_VERSION = "impressum-parser-v63-full-page-focused";
var CONTRACT_VERSION = "identity-evidence-contract-v3-validated-screenshot";
var MINIMUM_SAFE_CAPTURE_MAJOR = 24;
var PROOF_TTL_MS = 60 * 60 * 1000;
var TRACKING_QUERY_KEYS = new Set(["gad_source", "gad_campaignid", "gbraid", "gclid"]);

function omeji(vrednost, najvec) {
  return String(vrednost == null ? "" : vrednost).trim().replace(/\s+/g, " ").slice(0, najvec || 500);
}

function kanonizirajSpletniUrl(vrednost) {
  try {
    var surovo = String(vrednost || "").trim();
    if (surovo && !/^[a-z][a-z0-9+.-]*:\/\//i.test(surovo)) surovo = "https://" + surovo;
    var url = new URL(surovo);
    if (!/^https?:$/.test(url.protocol)) return "";
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    url.hash = "";
    Array.from(url.searchParams.keys()).forEach(function (kljuc) {
      if (TRACKING_QUERY_KEYS.has(String(kljuc || "").toLowerCase())) url.searchParams.delete(kljuc);
    });
    var urejeni = Array.from(url.searchParams.entries()).sort(function (a, b) {
      return a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0]);
    });
    url.search = "";
    urejeni.forEach(function (par) { url.searchParams.append(par[0], par[1]); });
    return url.toString();
  } catch (_) {
    return "";
  }
}

function jeVeljavenJpegDataUrl(vrednost) {
  return /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(String(vrednost || ""));
}

function jeVeljavenVir(vrednost) {
  return /^https?:\/\//i.test(String(vrednost || ""));
}

function normalizirajPrimerjavo(vrednost) {
  return String(vrednost || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function kanonicnaIdentiteta(identiteta) {
  var vir = identiteta && typeof identiteta === "object" ? identiteta : {};
  var jeDruzba = vir.entityType === "company";
  var legalName = omeji(vir.legalName || (jeDruzba ? vir.naziv || vir.ime : ""), 240);
  var personName = jeDruzba ? "" : omeji(vir.personName || vir.nosilec || vir.ime, 180);
  var businessName = omeji(vir.businessName || vir.poslovniNaziv || vir.naziv || (jeDruzba ? vir.ime : ""), 240);
  return {
    entityType: jeDruzba ? "company" : vir.entityType === "person" ? "person" : "unknown",
    legalName: legalName,
    personName: personName,
    businessName: businessName,
    representativeName: omeji(vir.representativeName || vir.nosilec || "", 180),
    street: omeji(vir.street || vir.naslov, 180),
    postalCode: omeji(vir.postalCode || vir.postnaStevilka, 10),
    city: omeji(vir.city || vir.kraj, 120),
    registerNumber: omeji(vir.registerNumber, 160),
    registerCourt: omeji(vir.registerCourt, 160),
    vatId: omeji(vir.vatId, 100),
  };
}

function kanonicnaPotrjenaIdentiteta(potrjena, vrsta) {
  var vir = potrjena && typeof potrjena === "object" ? potrjena : {};
  return kanonicnaIdentiteta({
    entityType: vrsta || vir.entityType,
    legalName: (vrsta || vir.entityType) === "company" ? vir.businessName || vir.name : "",
    personName: (vrsta || vir.entityType) === "company" ? "" : vir.name,
    businessName: vir.businessName,
    representativeName: vir.representativeName,
    street: vir.street,
    postalCode: vir.postalCode,
    city: vir.city,
    registerNumber: vir.registerNumber,
    registerCourt: vir.registerCourt,
    vatId: vir.vatId,
  });
}

function stabilniJson(vrednost) {
  if (Array.isArray(vrednost)) return "[" + vrednost.map(stabilniJson).join(",") + "]";
  if (!vrednost || typeof vrednost !== "object") return JSON.stringify(vrednost);
  return "{" + Object.keys(vrednost).sort().map(function (kljuc) {
    return JSON.stringify(kljuc) + ":" + stabilniJson(vrednost[kljuc]);
  }).join(",") + "}";
}

function sha256(vrednost) {
  return crypto.createHash("sha256").update(vrednost).digest("hex");
}

function hashPosnetka(imageDataUrl) {
  var ujemanje = String(imageDataUrl || "").match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  if (!ujemanje) return "";
  try { return sha256(Buffer.from(ujemanje[1], "base64")); } catch (_) { return ""; }
}

function skrivnostDokazila() {
  var vrednost = omeji(process.env.BONITETA_RESOURCE_PROOF_SECRET || process.env.OPENREGISTER_IDENTITY_PROOF_SECRET || process.env.OPENREGISTER_API_KEY, 2000);
  if (!vrednost) throw Object.assign(new Error("Strežniška konfiguracija dokazila identitete manjka."), {
    status: 503,
    code: "IDENTITY_EVIDENCE_PROOF_NOT_CONFIGURED",
  });
  return vrednost;
}

function ustvariVezavoDokazila(podatki) {
  var vir = podatki && typeof podatki === "object" ? podatki : {};
  var jedro = {
    contractVersion: CONTRACT_VERSION,
    ownerId: omeji(vir.ownerId, 100),
    evidenceJobId: omeji(vir.evidenceJobId || vir.jobId, 100),
    canonicalInputUrl: kanonizirajSpletniUrl(vir.canonicalInputUrl || vir.inputUrl),
    finalLegalUrl: kanonizirajSpletniUrl(vir.finalLegalUrl || vir.sourceUrl),
    identity: kanonicnaIdentiteta(vir.identity),
    screenshotSha256: omeji(vir.screenshotSha256 || hashPosnetka(vir.imageDataUrl), 80),
    capturedAt: omeji(vir.capturedAt, 80),
  };
  if (!jedro.ownerId || !jedro.evidenceJobId || !jedro.canonicalInputUrl || !jedro.finalLegalUrl ||
      !/^[a-f0-9]{64}$/.test(jedro.screenshotSha256) || !jedro.capturedAt) {
    throw Object.assign(new Error("Dokazila identitete ni mogoče vezati na isto opravilo in vir."), {
      status: 409,
      code: "IDENTITY_EVIDENCE_BINDING_INCOMPLETE",
    });
  }
  var fingerprint = sha256(stabilniJson(jedro));
  return Object.assign({}, jedro, {
    evidenceId: "evidence-" + fingerprint.slice(0, 32),
    fingerprint: fingerprint,
  });
}

function podpisiVezavoDokazila(vezava, zdaj) {
  var payload = {
    v: 1,
    exp: Number(zdaj || Date.now()) + PROOF_TTL_MS,
    binding: vezava,
  };
  var zapis = Buffer.from(stabilniJson(payload)).toString("base64url");
  return zapis + "." + crypto.createHmac("sha256", skrivnostDokazila()).update(zapis).digest("base64url");
}

function preveriPodpisDokazila(token, zdaj) {
  var deli = String(token || "").trim().split(".");
  if (deli.length !== 2 || !deli[0] || !deli[1]) return null;
  var pricakovani = crypto.createHmac("sha256", skrivnostDokazila()).update(deli[0]).digest();
  var prejeti;
  try { prejeti = Buffer.from(deli[1], "base64url"); } catch (_) { return null; }
  if (pricakovani.length !== prejeti.length || !crypto.timingSafeEqual(pricakovani, prejeti)) return null;
  var payload;
  try { payload = JSON.parse(Buffer.from(deli[0], "base64url").toString("utf8")); } catch (_) { return null; }
  if (!payload || payload.v !== 1 || Number(payload.exp) < Number(zdaj || Date.now()) || !payload.binding) return null;
  var vezava = payload.binding;
  var jedro = Object.assign({}, vezava);
  delete jedro.evidenceId;
  delete jedro.fingerprint;
  var ponovno = ustvariVezavoDokazila(jedro);
  return ponovno.fingerprint === vezava.fingerprint && ponovno.evidenceId === vezava.evidenceId
    ? { exp: Number(payload.exp), binding: ponovno }
    : null;
}

function staIdentitetiEnaki(a, b) {
  var prva = kanonicnaIdentiteta(a);
  var druga = kanonicnaIdentiteta(b);
  return Object.keys(prva).every(function (kljuc) {
    if (kljuc === "postalCode") return prva[kljuc] === druga[kljuc];
    return normalizirajPrimerjavo(prva[kljuc]) === normalizirajPrimerjavo(druga[kljuc]);
  });
}

function preveriDokaziloZaPotrditev(token, pricakovano, zdaj) {
  var payload;
  try { payload = preveriPodpisDokazila(token, zdaj); } catch (_) { return { ok: false, reason: "proof_not_configured" }; }
  if (!payload) return { ok: false, reason: "proof_invalid_or_expired" };
  var vezava = payload.binding;
  var vhod = pricakovano && typeof pricakovano === "object" ? pricakovano : {};
  if (vezava.ownerId !== omeji(vhod.ownerId, 100)) return { ok: false, reason: "owner_mismatch" };
  if (vezava.evidenceJobId !== omeji(vhod.evidenceJobId, 100)) return { ok: false, reason: "job_mismatch" };
  if (vezava.fingerprint !== omeji(vhod.fingerprint, 80)) return { ok: false, reason: "fingerprint_mismatch" };
  if (vezava.screenshotSha256 !== omeji(vhod.screenshotSha256, 80)) return { ok: false, reason: "screenshot_hash_mismatch" };
  if (vezava.canonicalInputUrl !== kanonizirajSpletniUrl(vhod.canonicalInputUrl || vhod.inputUrl)) return { ok: false, reason: "input_url_mismatch" };
  if (vezava.finalLegalUrl !== kanonizirajSpletniUrl(vhod.finalLegalUrl || vhod.sourceUrl)) return { ok: false, reason: "legal_url_mismatch" };
  if (vhod.evidenceShown !== true) return { ok: false, reason: "evidence_not_shown" };
  if (!staIdentitetiEnaki(vezava.identity, kanonicnaPotrjenaIdentiteta(vhod.confirmedIdentity, vezava.identity.entityType))) {
    return { ok: false, reason: "confirmed_fields_mismatch" };
  }
  if (vhod.currentIdentity && !staIdentitetiEnaki(vezava.identity, vhod.currentIdentity)) {
    return { ok: false, reason: "current_identity_mismatch" };
  }
  return { ok: true, binding: vezava, exp: payload.exp };
}

function imaUjemajocoValidacijoPosnetka(dokazilo) {
  return Boolean(dokazilo &&
    dokazilo.contentValidationStatus === "matched" &&
    dokazilo.provenanceStatus === "same_legal_block" &&
    Array.isArray(dokazilo.validatedFields) &&
    dokazilo.validatedFields.length > 0 &&
    dokazilo.validatedIdentity && typeof dokazilo.validatedIdentity === "object");
}

function jePosnetekPrikazljiv(dokazilo) {
  if (!dokazilo || dokazilo.status !== "captured") return false;
  if (!jeVeljavenJpegDataUrl(dokazilo.imageDataUrl) || !jeVeljavenVir(dokazilo.sourceUrl)) return false;
  if (dokazilo.screenshotReady === false) return false;
  if (!imaUjemajocoValidacijoPosnetka(dokazilo)) return false;
  if (dokazilo.evidenceMode === "user_uploaded_official_screenshot") return true;

  // Delno siv prekrivni sloj ali skoraj prazen rezervni izris je bilo mogoče
  // zajeti tudi v starejših različicah. Zato stare avtomatske JPEG-e razveljavimo,
  // četudi so nekoč že nosili screenshotReady=true. Odjemalec še vedno prejme
  // samo novo semantično odločitev strežnika, ne pravila o številki različice.
  var zajem = String(dokazilo.captureVersion || "").match(/^identity-evidence-v(\d+)(?:-|$)/);
  return Boolean(zajem && Number(zajem[1]) >= MINIMUM_SAFE_CAPTURE_MAJOR &&
    dokazilo.viewportOverlaysRemoved === true);
}

function jeImpressumDokaziloPripravljenoZaPotrditev(dokazilo, identiteta) {
  if (!jePosnetekPrikazljiv(dokazilo) ||
      !["impressum_identity_confirmation", "public_directory_identity_confirmation"].includes(dokazilo.evidenceRole) ||
      dokazilo.identityCompleteness !== "complete" ||
      dokazilo.proofStatus !== "signed" || !dokazilo.evidenceProof ||
      !dokazilo.evidenceFingerprint || !dokazilo.evidenceJobId ||
      !dokazilo.evidenceId || !/^[a-f0-9]{64}$/.test(String(dokazilo.screenshotSha256 || ""))) return false;
  var polja = dokazilo.validatedFields || [];
  if (!polja.includes("street") || !polja.includes("postalCode") || !polja.includes("city") ||
      (!polja.includes("legalName") && !polja.includes("personName"))) return false;

  if (!identiteta) return true;
  var potrjeno = dokazilo.validatedIdentity || {};
  var jePravnaOseba = identiteta.entityType === "company";
  var pricakovanoIme = jePravnaOseba
    ? identiteta.naziv || identiteta.ime
    : identiteta.nosilec || identiteta.ime;
  return normalizirajPrimerjavo(potrjeno.identityName) === normalizirajPrimerjavo(pricakovanoIme) &&
    normalizirajPrimerjavo(potrjeno.street) === normalizirajPrimerjavo(identiteta.naslov) &&
    String(potrjeno.postalCode || "").trim() === String(identiteta.postnaStevilka || "").trim() &&
    normalizirajPrimerjavo(potrjeno.city) === normalizirajPrimerjavo(identiteta.kraj);
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
  return jeApiDokaziloUporabno(dokazilo) || jeImpressumDokaziloPripravljenoZaPotrditev(dokazilo);
}

function obogatiDokazilo(dokazilo) {
  if (!dokazilo || typeof dokazilo !== "object") return dokazilo;
  var screenshotReady = jePosnetekPrikazljiv(dokazilo);
  var apiReady = jeApiDokaziloUporabno(dokazilo);
  var confirmationReady = jeImpressumDokaziloPripravljenoZaPotrditev(dokazilo);
  return Object.assign({}, dokazilo, {
    evidenceContractVersion: CONTRACT_VERSION,
    screenshotReady: screenshotReady,
    evidenceReady: confirmationReady || apiReady,
    evidenceKind: apiReady ? "structured_api" : screenshotReady ? "screenshot" : "",
    evidenceStatus: apiReady || confirmationReady ? "validated" : screenshotReady ? "review_only" : "unavailable",
    confirmationReady: confirmationReady,
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
  PROOF_TTL_MS: PROOF_TTL_MS,
  kanonizirajSpletniUrl: kanonizirajSpletniUrl,
  kanonicnaIdentiteta: kanonicnaIdentiteta,
  kanonicnaPotrjenaIdentiteta: kanonicnaPotrjenaIdentiteta,
  staIdentitetiEnaki: staIdentitetiEnaki,
  hashPosnetka: hashPosnetka,
  ustvariVezavoDokazila: ustvariVezavoDokazila,
  podpisiVezavoDokazila: podpisiVezavoDokazila,
  preveriDokaziloZaPotrditev: preveriDokaziloZaPotrditev,
  jePosnetekPrikazljiv: jePosnetekPrikazljiv,
  jeImpressumDokaziloPripravljenoZaPotrditev: jeImpressumDokaziloPripravljenoZaPotrditev,
  jeApiDokaziloUporabno: jeApiDokaziloUporabno,
  jeDokaziloUporabno: jeDokaziloUporabno,
  obogatiDokazilo: obogatiDokazilo,
  obogatiRezultat: obogatiRezultat,
};
