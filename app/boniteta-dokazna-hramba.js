(function (root) {
  "use strict";

  var DB_NAME = "uspesni-jezek-boniteta-dokazi";
  var DB_VERSION = 1;
  var STORE_NAME = "insolvencni-posnetki";
  var MAX_IMAGE_BYTES = 8 * 1024 * 1024;

  function veljavenId(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
  }

  function kljuc(userId, profileId) {
    if (!veljavenId(userId) || !veljavenId(profileId)) return "";
    return String(userId).toLowerCase() + ":" + String(profileId).toLowerCase();
  }

  function podatkiSlike(dataUrl) {
    var ujemanje = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\r\n]+)$/i.exec(String(dataUrl || ""));
    if (!ujemanje) return null;
    var base64 = ujemanje[2].replace(/\s/g, "");
    if (!/^(?:[a-z0-9+/]{4})*(?:[a-z0-9+/]{2}==|[a-z0-9+/]{3}=)?$/i.test(base64)) return null;
    var velikost = Math.floor(base64.length * 3 / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
    if (velikost <= 0 || velikost > MAX_IMAGE_BYTES) return null;
    return { mimeType: ujemanje[1].toLowerCase(), base64: base64, size: velikost };
  }

  function odpriBazo() {
    return new Promise(function (resolve, reject) {
      if (!root.indexedDB) return reject(new Error("IndexedDB ni na voljo."));
      var zahteva = root.indexedDB.open(DB_NAME, DB_VERSION);
      zahteva.onupgradeneeded = function () {
        if (!zahteva.result.objectStoreNames.contains(STORE_NAME)) zahteva.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      };
      zahteva.onsuccess = function () { resolve(zahteva.result); };
      zahteva.onerror = function () { reject(zahteva.error || new Error("Dokazne hrambe ni bilo mogoče odpreti.")); };
    });
  }

  function pretvoriVBlob(slika) {
    var surovo = root.atob(slika.base64);
    var bajti = new Uint8Array(surovo.length);
    for (var i = 0; i < surovo.length; i += 1) bajti[i] = surovo.charCodeAt(i);
    return new Blob([bajti], { type: slika.mimeType });
  }

  function blobVDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var bralnik = new FileReader();
      bralnik.onload = function () { resolve(String(bralnik.result || "")); };
      bralnik.onerror = function () { reject(bralnik.error || new Error("Dokaznega posnetka ni bilo mogoče prebrati.")); };
      bralnik.readAsDataURL(blob);
    });
  }

  function transakcija(nacin, opravilo) {
    return odpriBazo().then(function (baza) {
      return new Promise(function (resolve, reject) {
        var tx = baza.transaction(STORE_NAME, nacin);
        var trgovina = tx.objectStore(STORE_NAME);
        var rezultat;
        try { rezultat = opravilo(trgovina); } catch (napaka) { baza.close(); reject(napaka); return; }
        tx.oncomplete = function () { baza.close(); resolve(rezultat && rezultat.result); };
        tx.onerror = function () { baza.close(); reject(tx.error || new Error("Dokazne hrambe ni bilo mogoče posodobiti.")); };
        tx.onabort = tx.onerror;
      });
    });
  }

  async function shrani(userId, profileId, insolvency) {
    var key = kljuc(userId, profileId);
    var official = insolvency && insolvency.officialVerification || {};
    var slika = official.evidenceStatus === "captured" ? podatkiSlike(official.evidenceImage) : null;
    if (!key || !slika) return false;
    var metadata = Object.assign({}, official);
    delete metadata.evidenceImage;
    await transakcija("readwrite", function (trgovina) {
      return trgovina.put({
        key: key,
        userId: String(userId).toLowerCase(),
        profileId: String(profileId).toLowerCase(),
        evidenceBlob: pretvoriVBlob(slika),
        officialVerification: metadata,
        savedAt: new Date().toISOString(),
      });
    });
    return true;
  }

  async function preberi(userId, profileId) {
    var key = kljuc(userId, profileId);
    if (!key) return null;
    var zapis = await transakcija("readonly", function (trgovina) { return trgovina.get(key); });
    if (!zapis || zapis.key !== key || !(zapis.evidenceBlob instanceof Blob) || !["image/jpeg", "image/png", "image/webp"].includes(zapis.evidenceBlob.type) || zapis.evidenceBlob.size <= 0 || zapis.evidenceBlob.size > MAX_IMAGE_BYTES) return null;
    var evidenceImage = await blobVDataUrl(zapis.evidenceBlob);
    if (!podatkiSlike(evidenceImage)) return null;
    return Object.assign({}, zapis.officialVerification || {}, { evidenceStatus: "captured", evidenceImage: evidenceImage });
  }

  async function izbrisi(userId, profileId) {
    var key = kljuc(userId, profileId);
    if (!key) return false;
    await transakcija("readwrite", function (trgovina) { return trgovina.delete(key); });
    return true;
  }

  var api = { shrani: shrani, preberi: preberi, izbrisi: izbrisi, _test: { kljuc: kljuc, podatkiSlike: podatkiSlike, MAX_IMAGE_BYTES: MAX_IMAGE_BYTES } };
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UJBonitetaDokaznaHramba = api;
})(typeof window !== "undefined" ? window : globalThis);
