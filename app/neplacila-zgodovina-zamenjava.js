(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UJZgodovinaZamenjavaState = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var SALDO_TIPI = ["partial_payment", "paid_in_full", "installment_payment", "credit_note", "compensation"];

  function najdiIndeks(kandidati, zamenjava) {
    var seznam = Array.isArray(kandidati) ? kandidati : [];
    if (!zamenjava) return -1;
    var poId = seznam.findIndex(function (kandidat) {
      return kandidat && kandidat.candidateId === zamenjava.sourceCandidateId;
    });
    if (poId >= 0) return poId;
    var indeks = Number(zamenjava.sourceIndex);
    return Number.isInteger(indeks) && indeks >= 0 && indeks < seznam.length ? indeks : -1;
  }

  function zamenjajNaMestu(kandidati, zamenjava, noviKandidat) {
    var indeks = najdiIndeks(kandidati, zamenjava);
    if (indeks < 0 || !noviKandidat) return { ok: false, index: -1 };
    var izvorni = kandidati[indeks];
    noviKandidat.candidateId = izvorni.candidateId || zamenjava.sourceCandidateId;
    noviKandidat.replacedFromType = izvorni.type || null;
    kandidati.splice(indeks, 1, noviKandidat);
    return { ok: true, index: indeks, candidate: noviKandidat };
  }

  function saldoPoKandidatih(zacetniSaldo, kandidati) {
    return Math.max(0, Math.round((Array.isArray(kandidati) ? kandidati : []).reduce(function (saldo, kandidat) {
      if (!kandidat || SALDO_TIPI.indexOf(kandidat.type) < 0) return saldo;
      var znesek = Number(kandidat.amount);
      return Number.isFinite(znesek) && znesek > 0 ? saldo - znesek : saldo;
    }, Number(zacetniSaldo) || 0) * 100) / 100);
  }

  return {
    najdiIndeks: najdiIndeks,
    zamenjajNaMestu: zamenjajNaMestu,
    saldoPoKandidatih: saldoPoKandidatih,
  };
});
