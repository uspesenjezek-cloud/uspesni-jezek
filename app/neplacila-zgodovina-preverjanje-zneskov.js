(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.UJZgodovinaPreverjanjeZneskov = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var PLACILO = /plačal|placal|plačano|placano|poravnal|poravnano|nakazal|nakazilo|obrok|dobropis|kompenzacij|pobot/i;
  var STEVILA = /\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?/g;
  var STEVILO_BESEDA = {
    en: 1, ena: 1, eno: 1, enkrat: 1,
    dva: 2, dve: 2, dvakrat: 2,
    tri: 3, trije: 3, trikrat: 3,
    štiri: 4, stirje: 4, štirje: 4, štirikrat: 4, stirikrat: 4,
    pet: 5, petkrat: 5,
  };

  function vStevilo(surovo) {
    var niz = String(surovo || "").replace(/\s/g, "");
    if (niz.indexOf(",") >= 0) niz = niz.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(?:\.\d{3})+$/.test(niz)) niz = niz.replace(/\./g, "");
    var stevilo = Number(niz);
    return Number.isFinite(stevilo) ? stevilo : null;
  }

  function jeDatumAliStevec(opis, zacetek, konec, surovo, vrednost) {
    var prej = opis.slice(Math.max(0, zacetek - 18), zacetek);
    var potem = opis.slice(konec, Math.min(opis.length, konec + 22));
    if (/[./-]\s*$/.test(prej) || /^\s*[./-]\s*\d/.test(potem)) return true;
    if (/^\s*(?:obrok(?:i|e|ov)?|krat|dni|dan|mesecev|mesece|let|tednov|tedne)\b/i.test(potem)) return true;
    if (vrednost >= 1900 && vrednost <= 2100 && /datum|leta|leto|zapadl|izdan|račun|racun/i.test(prej + potem)) return true;
    return !/[€]|\beur\b|evr/i.test(prej + surovo + potem) && vrednost < 20;
  }

  function vsotaJasnihZneskov(opis) {
    var vsota = 0;
    var ujemanje;
    STEVILA.lastIndex = 0;
    while ((ujemanje = STEVILA.exec(opis))) {
      var vrednost = vStevilo(ujemanje[0]);
      if (!vrednost || jeDatumAliStevec(opis, ujemanje.index, STEVILA.lastIndex, ujemanje[0], vrednost)) continue;
      var okolica = opis.slice(Math.max(0, ujemanje.index - 55), Math.min(opis.length, STEVILA.lastIndex + 55));
      if (PLACILO.test(okolica) || /[€]|\beur\b|evr/i.test(okolica)) vsota += vrednost;
    }
    return Math.round(vsota * 100) / 100;
  }

  function vsotaPonovljenihZneskov(opis) {
    var najvecja = 0;
    var vzorec = /\b(\d+|en|ena|eno|enkrat|dva|dve|dvakrat|tri|trije|trikrat|štiri|stirje|štirje|štirikrat|stirikrat|pet|petkrat)\s+(?:obrok(?:i|e|ov)?\s+)?po\s+(\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi;
    var ujemanje;
    while ((ujemanje = vzorec.exec(opis))) {
      var krat = /^\d+$/.test(ujemanje[1]) ? Number(ujemanje[1]) : STEVILO_BESEDA[String(ujemanje[1]).toLowerCase()];
      var znesek = vStevilo(ujemanje[2]);
      if (krat > 0 && znesek > 0) najvecja = Math.max(najvecja, krat * znesek);
    }
    return Math.round(najvecja * 100) / 100;
  }

  function oceni(opis, dolg) {
    var besedilo = String(opis || "").trim();
    var meja = Number(dolg);
    if (!besedilo || !Number.isFinite(meja) || meja <= 0 || !PLACILO.test(besedilo)) {
      return { presega: false, vsota: 0, dolg: Number.isFinite(meja) ? meja : 0 };
    }
    var vsota = Math.max(vsotaJasnihZneskov(besedilo), vsotaPonovljenihZneskov(besedilo));
    return { presega: vsota > meja + 0.009, vsota: vsota, dolg: meja };
  }

  return { oceni: oceni, vStevilo: vStevilo };
});
