/* ========== Rok plačila – čista logika (brez DOM) ==========
   Uporaba: brskalnik (window.UJRokPlacila) ali Node testi (module.exports).
   ============================================ */
(function (root) {
  "use strict";

  var KLJUC_PRIVZETIH = "neplacilo-rok-placila-privzeti";

  /** Privzeti koledarski dnevi od pošiljanja po številki predloga 1–9 (stari način). */
  var PRIVZETI_DNEVI = {
    1: 3,
    2: 5,
    3: 7,
    4: 10,
    5: 14,
    6: 21,
    7: 30,
    8: 45,
    9: 60,
  };

  /**
   * Privzeti dodatni rok po tonu sporočila (glavni način).
   * Zelo prijazen = daljši rok … Strog = najkrajši.
   */
  var PRIVZETI_DNEVI_PO_TONU = {
    very_friendly: 21,
    friendly: 14,
    neutral: 10,
    firm: 7,
    strict: 3,
  };

  /**
   * Predlog obročnega načrta po tonu (hook za poznejši widget).
   * Ne vsebuje UI – samo podatki.
   */
  var PRIVZETI_OBROCNI_PO_TONU = {
    very_friendly: { installments: 6, firstDelayDays: 14, gapDays: 30 },
    friendly: { installments: 4, firstDelayDays: 10, gapDays: 21 },
    neutral: { installments: 3, firstDelayDays: 7, gapDays: 21 },
    firm: { installments: 2, firstDelayDays: 5, gapDays: 14 },
    strict: { installments: 2, firstDelayDays: 3, gapDays: 7 },
  };

  function dneviZaTon(toneId) {
    var d = PRIVZETI_DNEVI_PO_TONU[toneId];
    return Number.isFinite(d) ? d : PRIVZETI_DNEVI_PO_TONU.neutral;
  }

  function predlogObrocnegaZaTon(toneId) {
    var p = PRIVZETI_OBROCNI_PO_TONU[toneId] || PRIVZETI_OBROCNI_PO_TONU.neutral;
    return {
      toneId: toneId || "neutral",
      installments: p.installments,
      firstDelayDays: p.firstDelayDays,
      gapDays: p.gapDays,
    };
  }

  function sestaviBesediloObrocnegaPredloga(toneId, jezik) {
    var p = predlogObrocnegaZaTon(toneId);
    var j = jezik || "de";
    if (j === "sl") {
      return (
        "Možno je obročno plačilo: " +
        p.installments +
        " obrokov, prvi obrok čez " +
        p.firstDelayDays +
        " dni (razmik " +
        p.gapDays +
        " dni)."
      );
    }
    if (j === "en") {
      return (
        "Installment payment possible: " +
        p.installments +
        " installments, first due in " +
        p.firstDelayDays +
        " days (every " +
        p.gapDays +
        " days)."
      );
    }
    return (
      "Ratenzahlung möglich: " +
      p.installments +
      " Raten, erste Rate in " +
      p.firstDelayDays +
      " Tagen (Abstand " +
      p.gapDays +
      " Tage)."
    );
  }

  function klonPrivzetih() {
    var o = {};
    for (var k = 1; k <= 9; k++) o[k] = PRIVZETI_DNEVI[k];
    return o;
  }

  function formatLocalYYYYMMDD(dt) {
    var y = dt.getFullYear();
    var m = String(dt.getMonth() + 1).padStart(2, "0");
    var d = String(dt.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function parseLocalYYYYMMDD(yyyyMmDd) {
    if (!yyyyMmDd || !/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return null;
    var deli = yyyyMmDd.split("-").map(Number);
    var dt = new Date(deli[0], deli[1] - 1, deli[2]);
    if (
      dt.getFullYear() !== deli[0] ||
      dt.getMonth() !== deli[1] - 1 ||
      dt.getDate() !== deli[2]
    ) {
      return null;
    }
    return dt;
  }

  function danesYYYYMMDD() {
    return formatLocalYYYYMMDD(new Date());
  }

  /** Koledarski dnevi brez UTC premika. */
  function dodajKoledarskeDni(yyyyMmDd, dnevi) {
    var dt = parseLocalYYYYMMDD(yyyyMmDd);
    if (!dt) return "";
    dt.setDate(dt.getDate() + Number(dnevi));
    return formatLocalYYYYMMDD(dt);
  }

  function formatirajDatumZaPrikaz(yyyyMmDd, jezik) {
    var dt = parseLocalYYYYMMDD(yyyyMmDd);
    if (!dt) return yyyyMmDd || "";
    var j = jezik || "sl";
    var dan = dt.getDate();
    var mesec = dt.getMonth() + 1;
    var leto = dt.getFullYear();
    if (j === "de") {
      return (
        String(dan).padStart(2, "0") +
        "." +
        String(mesec).padStart(2, "0") +
        "." +
        leto
      );
    }
    if (j === "en") {
      var meseci = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return dan + " " + meseci[mesec - 1] + " " + leto;
    }
    return dan + ". " + mesec + ". " + leto;
  }

  function ugotoviJezikSporocila(besedilo) {
    var t = String(besedilo || "").toLowerCase();
    if (
      /rechnung|zahlungsfrist|sehr geehrte|bitte überweisen|bitte ueberweisen|betrag/.test(
        t
      )
    ) {
      return "de";
    }
    if (/payment deadline|invoice|dear\s|please transfer/.test(t)) return "en";
    return "sl";
  }

  function sestaviVrsticoRoka(yyyyMmDd, jezik) {
    var prikaz = formatirajDatumZaPrikaz(yyyyMmDd, jezik);
    if (jezik === "de") return "Zahlungsfrist: " + prikaz + ".";
    if (jezik === "en") return "Payment deadline: " + prikaz + ".";
    return "Rok plačila: " + prikaz + ".";
  }

  /**
   * Zamenja ali doda sistemsko vrstico. Vrne { besedilo, ok, opozorilo }.
   * Če insertedText obstaja v besedilu – zamenjaj.
   * Če enabled in ni najdeno – dodaj na konec (z prazno vrstico).
   * Če uporabnik spremenil vrstico – opozorilo.
   */
  function posodobiSistemskoVrstico(besedilo, insertedText, novaVrstica, enabled) {
    var tekst = String(besedilo || "");
    var stara = String(insertedText || "");
    var nova = String(novaVrstica || "");

    if (!enabled) {
      if (stara && tekst.indexOf(stara) !== -1) {
        var vzorec = "\n\n" + stara;
        if (tekst.indexOf(vzorec) !== -1) tekst = tekst.split(vzorec).join("");
        else tekst = tekst.split(stara).join("");
        tekst = tekst.replace(/\s+$/, "");
      }
      return { besedilo: tekst, ok: true, opozorilo: "" };
    }

    if (stara && tekst.indexOf(stara) !== -1) {
      tekst = tekst.split(stara).join(nova);
      return { besedilo: tekst, ok: true, opozorilo: "" };
    }

    if (stara && stara.length > 0) {
      return {
        besedilo: tekst,
        ok: false,
        opozorilo: "spremenjeno",
      };
    }

    var osnova = tekst.replace(/\s+$/, "");
    tekst = osnova ? osnova + "\n\n" + nova : nova;
    return { besedilo: tekst, ok: true, opozorilo: "" };
  }

  function odstraniSistemskoVrstico(besedilo, insertedText) {
    return posodobiSistemskoVrstico(besedilo, insertedText, "", false);
  }

  function jeDatumPredPosiljanjem(rokYYYYMMDD, posiljanjeYYYYMMDD) {
    var rok = parseLocalYYYYMMDD(rokYYYYMMDD);
    var baza = parseLocalYYYYMMDD(posiljanjeYYYYMMDD);
    if (!rok || !baza) return false;
    return rok.getTime() < baza.getTime();
  }

  function soDneviNarascajoci(dneviPoStevilki) {
    var prej = 0;
    for (var k = 1; k <= 9; k++) {
      var d = Number(dneviPoStevilki[k]);
      if (!Number.isFinite(d) || d < 1 || d > 365) return false;
      if (d <= prej) return false;
      prej = d;
    }
    return true;
  }

  function naloziPrivzeteDni(storage) {
    var store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    var baza = klonPrivzetih();
    if (!store) return baza;
    try {
      var surovo = store.getItem(KLJUC_PRIVZETIH);
      if (!surovo) return baza;
      var seznam = JSON.parse(surovo);
      if (!Array.isArray(seznam)) return baza;
      seznam.forEach(function (vnos) {
        var n = Number(vnos && vnos.proposalNumber);
        var dnevi = Number(vnos && vnos.days);
        if (n >= 1 && n <= 9 && dnevi >= 1 && dnevi <= 365) baza[n] = dnevi;
      });
    } catch (_e) {
      /* ignoriraj */
    }
    return baza;
  }

  function shraniPrivzeteDni(dneviPoStevilki, storage) {
    var store = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (!store) return false;
    if (!soDneviNarascajoci(dneviPoStevilki)) return false;
    var seznam = [];
    var zdaj = new Date().toISOString();
    for (var k = 1; k <= 9; k++) {
      seznam.push({
        proposalNumber: k,
        days: Number(dneviPoStevilki[k]),
        updatedAt: zdaj,
      });
    }
    store.setItem(KLJUC_PRIVZETIH, JSON.stringify(seznam));
    return true;
  }

  function izracunajRok(baseSendDate, termDays) {
    return dodajKoledarskeDni(baseSendDate || danesYYYYMMDD(), termDays);
  }

  var api = {
    KLJUC_PRIVZETIH: KLJUC_PRIVZETIH,
    PRIVZETI_DNEVI: PRIVZETI_DNEVI,
    PRIVZETI_DNEVI_PO_TONU: PRIVZETI_DNEVI_PO_TONU,
    PRIVZETI_OBROCNI_PO_TONU: PRIVZETI_OBROCNI_PO_TONU,
    dneviZaTon: dneviZaTon,
    predlogObrocnegaZaTon: predlogObrocnegaZaTon,
    sestaviBesediloObrocnegaPredloga: sestaviBesediloObrocnegaPredloga,
    klonPrivzetih: klonPrivzetih,
    formatLocalYYYYMMDD: formatLocalYYYYMMDD,
    parseLocalYYYYMMDD: parseLocalYYYYMMDD,
    danesYYYYMMDD: danesYYYYMMDD,
    dodajKoledarskeDni: dodajKoledarskeDni,
    formatirajDatumZaPrikaz: formatirajDatumZaPrikaz,
    ugotoviJezikSporocila: ugotoviJezikSporocila,
    sestaviVrsticoRoka: sestaviVrsticoRoka,
    posodobiSistemskoVrstico: posodobiSistemskoVrstico,
    odstraniSistemskoVrstico: odstraniSistemskoVrstico,
    jeDatumPredPosiljanjem: jeDatumPredPosiljanjem,
    soDneviNarascajoci: soDneviNarascajoci,
    naloziPrivzeteDni: naloziPrivzeteDni,
    shraniPrivzeteDni: shraniPrivzeteDni,
    izracunajRok: izracunajRok,
  };

  root.UJRokPlacila = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
