(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UJBonitetaFinanceGuard = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function normaliziraj(vrednost) {
    return String(vrednost || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function stevilo(vrednost) {
    if (vrednost == null || vrednost === "") return null;
    var surovo = vrednost && typeof vrednost === "object" ? vrednost.value : vrednost;
    if (surovo == null || surovo === "") return null;
    var rezultat = Number(surovo);
    return Number.isFinite(rezultat) ? rezultat : null;
  }

  function leto(vrednost) {
    var neposredno = Number(vrednost && (vrednost.year || vrednost.fiscalYear));
    if (Number.isInteger(neposredno) && neposredno >= 1900 && neposredno <= 2200) return neposredno;
    var zadetek = String(vrednost && (vrednost.date || vrednost.publicationDate) || "").match(/\b(19|20)\d{2}\b/);
    return zadetek ? Number(zadetek[0]) : null;
  }

  function skorajEnako(a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return Math.abs(a - b) <= Math.max(1, Math.max(Math.abs(a), Math.abs(b)) * 0.0001);
  }

  function jeBilancnaVsota(oznaka) {
    return /^(?:total assets|assets total|balance sheet total|bilanzsumme|summe aktiva|summe passiva|bilancna vsota)$/.test(normaliziraj(oznaka));
  }

  function postavka(items, imena, vzorec) {
    var kljuci = Object.keys(items && typeof items === "object" ? items : {});
    for (var i = 0; i < kljuci.length; i += 1) {
      var kljuc = kljuci[i], item = items[kljuc];
      if (imena.indexOf(normaliziraj(kljuc)) >= 0 || vzorec.test(normaliziraj(item && item.label))) return item;
    }
    return null;
  }

  function podrobnostiPoLetu(company) {
    return (company && Array.isArray(company.financials) ? company.financials : []).reduce(function (rezultat, zapis) {
      var l = leto(zapis);
      if (l && zapis && zapis.items && typeof zapis.items === "object") rezultat[l] = zapis;
      return rezultat;
    }, {});
  }

  function preveriVrednost(vnos, podrobnost) {
    var vrednost = stevilo(vnos), items = podrobnost && podrobnost.items || {};
    if (vrednost === null || vrednost < 0) return { veljavna: false, razlog: "invalid_total_assets" };
    var izrecnaVsota = postavka(items,
      ["totalassets", "total assets", "assets total", "balancesheettotal", "balance sheet total", "bilanzsumme", "summe aktiva", "summe passiva"],
      /^(?:total assets|assets total|balance sheet total|bilanzsumme|summe aktiva|summe passiva)$/);
    var izrecnaVrednost = stevilo(izrecnaVsota);
    if (izrecnaVrednost !== null && izrecnaVrednost >= 0) return { veljavna: true, vrednost: izrecnaVrednost, izrecna: true };

    var obveznosti = stevilo(postavka(items, ["liabilities", "verbindlichkeiten", "obveznosti"], /^(?:liabilities|verbindlichkeiten|obveznosti)$/));
    var kapital = stevilo(postavka(items, ["equity", "eigenkapital", "lastniski kapital"], /^(?:equity|eigenkapital|lastniski kapital)$/));
    var denar = stevilo(postavka(items, ["cash", "cash on hand", "denarna sredstva"], /^(?:cash|cash on hand|denarna sredstva)$/));
    var terjatve = stevilo(postavka(items, ["receivables", "forderungen", "terjatve"], /^(?:receivables|forderungen|terjatve)$/));
    var toleranca = Math.max(1, Math.abs(vrednost) * 0.0001);

    if (obveznosti !== null && kapital !== null && Math.abs(kapital) > toleranca && skorajEnako(vrednost, obveznosti)) {
      return { veljavna: false, razlog: "assets_equal_liabilities_with_nonzero_equity" };
    }
    if (kapital !== null && kapital > 0 && vrednost + toleranca < kapital) {
      return { veljavna: false, razlog: "assets_below_positive_equity" };
    }
    if (denar !== null && terjatve !== null && vrednost + toleranca < denar + terjatve) {
      return { veljavna: false, razlog: "assets_below_known_asset_components" };
    }
    return { veljavna: true, vrednost: vrednost };
  }

  function uskladi(company, detailsCompany) {
    var izvor = company && typeof company === "object" ? company : {};
    var kopija = Object.assign({}, izvor);
    var podrobnosti = podrobnostiPoLetu(detailsCompany);
    var tezave = [];

    kopija.financials = (Array.isArray(izvor.financials) ? izvor.financials : []).map(function (metrika) {
      if (!jeBilancnaVsota(metrika && (metrika.metric || metrika.name || metrika.label))) return metrika;
      var nova = Object.assign({}, metrika);
      nova.values = (Array.isArray(metrika.values) ? metrika.values : []).reduce(function (rezultat, vnos) {
        var l = leto(vnos), preverjeno = preveriVrednost(vnos, l ? podrobnosti[l] : null);
        if (!preverjeno.veljavna) {
          tezave.push({ year: l, metric: "total_assets", reason: preverjeno.razlog, rejectedValue: stevilo(vnos) });
          return rezultat;
        }
        rezultat.push(preverjeno.izrecna ? Object.assign({}, vnos, {
          value: preverjeno.vrednost,
          formattedValue: "",
          correctedByFinancialGuard: true,
        }) : vnos);
        return rezultat;
      }, []);
      return nova;
    });

    if (Array.isArray(izvor.totalAssets)) {
      kopija.totalAssets = izvor.totalAssets.reduce(function (rezultat, vnos) {
        var l = leto(vnos), preverjeno = preveriVrednost(vnos, l ? podrobnosti[l] : null);
        if (!preverjeno.veljavna) {
          tezave.push({ year: l, metric: "total_assets", reason: preverjeno.razlog, rejectedValue: stevilo(vnos) });
          return rezultat;
        }
        rezultat.push(preverjeno.izrecna ? Object.assign({}, vnos, { value: preverjeno.vrednost, correctedByFinancialGuard: true }) : vnos);
        return rezultat;
      }, []);
    }

    kopija.financialGuard = {
      changed: tezave.length > 0,
      issues: tezave.slice(),
      version: "financial-invariants-v1",
    };
    return {
      company: kopija,
      changed: tezave.length > 0 || kopija.financials.some(function (m) { return (m.values || []).some(function (v) { return v.correctedByFinancialGuard; }); }),
      issues: tezave,
      version: "financial-invariants-v1",
    };
  }

  return { uskladi: uskladi, _test: { preveriVrednost: preveriVrednost, jeBilancnaVsota: jeBilancnaVsota, skorajEnako: skorajEnako } };
});
