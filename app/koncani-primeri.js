/* Končani primeri: seznam dejansko rešenih zadev + "Podrobnosti zaključka".
   Prikaz, besedilo, barve in finančna logika VEDNO izhajajo iz dejanskega
   načina rešitve računa (zadeva_placila / zadeva_poravnave), ne iz uganjene
   hevristike - glej izpeljiPrikazniModel spodaj, ki je čista funkcija in je
   enoten vir resnice za to stran. Izidi (naslov/opis/barva/ikona) prihajajo
   iz nastavitve-izidov.js - istega vira, ki ga uporablja tudi izvedba.js. */
(function (root) {
  "use strict";

  var Izidi = root.UJNastavitveIzidov;
  var K = root.UJIzvedbaKomponente;

  var state = {
    primeri: [], filter: "all", dialogPrimerId: null, novPrimerId: null,
    vecInfoOdprto: false, aktivenDokument: 0, pregledDokumenta: null, prodajalec: null,
    napakaDokumenta: null,
    osvezevanje: null, inicializirano: false, realtimeKanal: null, osveziCasovnik: null,
    zadnjaOsvezitev: 0, fitObserver: null, dogodkiPovezani: false, dialogSprozilec: null,
  };

  function esc(vrednost) {
    return String(vrednost == null ? "" : vrednost)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function ikona(ime) {
    if (ime === "building") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V6l8-4v20M20 22V10l-8-3M2 22h20"/><path d="M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2M9 22v-3h2v3"/></svg>';
    }
    return K && typeof K.ikona === "function" ? K.ikona(ime) : "";
  }

  function formatirajZnesek(znesek) {
    var stevilo = Number(znesek);
    if (!Number.isFinite(stevilo)) return "—";
    return new Intl.NumberFormat("de-DE", {
      style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(stevilo);
  }

  function formatirajDatum(iso) {
    if (!iso) return "—";
    var datum = new Date(iso);
    if (Number.isNaN(datum.getTime())) return "—";
    return new Intl.DateTimeFormat("sl-SI", {
      day: "numeric", month: "short", year: "numeric",
    }).format(datum);
  }

  function razdeliDatum(iso) {
    if (!iso) return { glavni: "—", leto: "" };
    var datum = new Date(iso);
    if (Number.isNaN(datum.getTime())) return { glavni: "—", leto: "" };
    return {
      glavni: new Intl.DateTimeFormat("sl-SI", { day: "numeric", month: "short" }).format(datum),
      leto: new Intl.DateTimeFormat("sl-SI", { year: "numeric" }).format(datum),
    };
  }

  function formatirajDatumInUro(iso) {
    if (!iso) return "—";
    var datum = new Date(iso);
    if (Number.isNaN(datum.getTime())) return "—";
    return new Intl.DateTimeFormat("sl-SI", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(datum);
  }

  function razlogStorna(koda) {
    return {
      duplicate: "Podvojen račun",
      incorrect: "Napačen račun",
      agreement: "Dogovor z dolžnikom",
      other: "Drugo",
    }[koda] || (koda ? String(koda) : "—");
  }

  var VRSTA_PLACILA_OZNAKA = { partial: "Delno plačilo", full: "Plačilo v celoti", installment: "Prejeti obrok" };
  var VRSTA_PORAVNAVE_OZNAKA = { compensation: "Kompenzacija", credit_note: "Dobropis", cancelled_invoice: "Storno" };

  var POTEK_AKCIJE = {
    skip_current_step: { naslov: "Korak preklican", ikona: "messageX", razred: "preklic", barva: "#f25a24", barvaKontrast: "#a83b18", rgb: "242,90,36" },
    stop_plan: { naslov: "Načrt ustavljen", ikona: "stopCircle", razred: "ustavi", barva: "#d51f32", barvaKontrast: "#ad1828", rgb: "213,31,50" },
    handoff_to_lawyer: { naslov: "Predano odvetniku", ikona: "scales", razred: "odvetnik", barva: "#6941b4", barvaKontrast: "#593493", rgb: "105,65,180" },
    postpone_reminder: { naslov: "Opomin prestavljen", ikona: "calendarArrow", razred: "prestavi", barva: "#237bd4", barvaKontrast: "#1d63aa", rgb: "35,123,212" },
    payment_promised: { naslov: "Plačilo obljubljeno", ikona: "handshake", razred: "obljuba", barva: "#ef8a00", barvaKontrast: "#9a5700", rgb: "239,138,0" },
  };

  function najdiPoActionId(vrstice, actionId, uporabljeni) {
    if (!actionId) return null;
    return (vrstice || []).find(function (v) {
      return (!uporabljeni || !uporabljeni.has(v)) && String(v.action_id || "") === String(actionId);
    }) || null;
  }

  function najdiNeuporabljenPoVrsti(vrstice, vrsta, uporabljeni, pricakovaniZnesek) {
    var zadetki = (vrstice || []).filter(function (v) {
      return v.vrsta === vrsta && (!uporabljeni || !uporabljeni.has(v));
    });
    if (!zadetki.length) return null;
    var znesek = Number(pricakovaniZnesek);
    if (Number.isFinite(znesek) && znesek > 0) {
      var istiZnesek = zadetki.find(function (v) { return Math.abs((Number(v.znesek) || 0) - znesek) <= 0.009; });
      if (istiZnesek) return istiZnesek;
    }
    return zadetki[0];
  }

  function financniKorakIzZapisa(zapis, vrstaZapisa) {
    var jePlacilo = vrstaZapisa === "placilo";
    var izidId = zapis.vrsta;
    var meta = (Izidi && Izidi.izid(izidId)) || null;
    if (jePlacilo && izidId === "installment") meta = Izidi && Izidi.izid("installment");
    if (jePlacilo && izidId === "partial") meta = Izidi && Izidi.izid("partial");
    return {
      actionId: zapis.action_id || null,
      actionType: jePlacilo && zapis.vrsta === "full" ? "paid_in_full" : (jePlacilo ? "partial_payment" : "partial_settlement"),
      naslov: (meta && meta.naslov) || (jePlacilo ? (VRSTA_PLACILA_OZNAKA[zapis.vrsta] || zapis.vrsta) : (VRSTA_PORAVNAVE_OZNAKA[zapis.vrsta] || zapis.vrsta)),
      podrobnost: jePlacilo ? "Denarno plačilo" : "Nedenarna poravnava",
      znesek: Number(zapis.znesek) || 0,
      datum: jePlacilo ? zapis.datum_placila : zapis.datum_poravnave,
      ikona: (meta && meta.ikona) || (jePlacilo ? "coinCheck" : "tag"),
      razred: (meta && meta.razred) || (jePlacilo ? "delno" : "dobropis"),
      barva: (meta && meta.barva) || (jePlacilo ? "#3aa99c" : "#e89524"),
      barvaKontrast: (meta && meta.barvaKontrast) || (jePlacilo ? "#237f75" : "#9a5700"),
      rgb: (meta && meta.rgb) || (jePlacilo ? "58,169,156" : "232,149,36"),
    };
  }

  function korakIzUkrepa(ukrep, placila, poravnave, uporabljeniFinancni) {
    var tip = ukrep.action_type;
    var nastavitve = ukrep.settings && typeof ukrep.settings === "object" ? ukrep.settings : {};
    var placilo = najdiPoActionId(placila, ukrep.action_id, uporabljeniFinancni);
    var poravnava = najdiPoActionId(poravnave, ukrep.action_id, uporabljeniFinancni);
    var rezultat;

    if (tip === "partial_payment") {
      if (!placilo) placilo = najdiNeuporabljenPoVrsti(
        placila,
        nastavitve.settlementType === "installment" ? "installment" : "partial",
        uporabljeniFinancni,
        nastavitve.paymentAmount
      );
      var jeObrok = nastavitve.settlementType === "installment" || (placilo && placilo.vrsta === "installment");
      var metaPlacila = (Izidi && Izidi.izid(jeObrok ? "installment" : "partial")) || {};
      rezultat = {
        naslov: jeObrok ? "Prejeti obrok" : "Delno plačilo",
        podrobnost: jeObrok ? "Plačilo v obrokih" : "Denarno plačilo",
        znesek: Number(placilo && placilo.znesek) || Number(nastavitve.paymentAmount) || 0,
        ikona: metaPlacila.ikona || "coinCheck", razred: metaPlacila.razred || "delno",
        barva: metaPlacila.barva || "#3aa99c", barvaKontrast: metaPlacila.barvaKontrast || "#237f75", rgb: metaPlacila.rgb || "58,169,156",
      };
    } else if (tip === "partial_settlement") {
      var pricakovanaVrstaPoravnave = nastavitve.kind === "writeoff"
        ? "cancelled_invoice"
        : (nastavitve.kind === "compensation" ? "compensation" : "credit_note");
      if (!poravnava) poravnava = najdiNeuporabljenPoVrsti(
        poravnave,
        pricakovanaVrstaPoravnave,
        uporabljeniFinancni,
        nastavitve.amount
      );
      var dejanskaVrstaPoravnave = (poravnava && poravnava.vrsta) || pricakovanaVrstaPoravnave;
      var metaPoravnave = (Izidi && Izidi.izid(dejanskaVrstaPoravnave)) || {};
      var jeOdpust = dejanskaVrstaPoravnave === "cancelled_invoice";
      var jeKompenzacija = dejanskaVrstaPoravnave === "compensation";
      rezultat = {
        naslov: jeOdpust ? "Odpust dolga" : (jeKompenzacija ? "Kompenzacija" : "Dobropis"),
        podrobnost: jeOdpust && (nastavitve.reason || (poravnava && poravnava.razlog))
          ? "Delni odpust · razlog shranjen"
          : (jeOdpust ? "Delni odpust" : (jeKompenzacija ? "Delna kompenzacija" : "Delni dobropis")),
        znesek: Number(poravnava && poravnava.znesek) || Number(nastavitve.amount) || 0,
        ikona: metaPoravnave.ikona || (jeOdpust ? "documentX" : "tag"),
        razred: metaPoravnave.razred || (jeOdpust ? "storno" : "dobropis"),
        barva: metaPoravnave.barva || (jeOdpust ? "#cf4c4c" : "#9b5d00"),
        barvaKontrast: metaPoravnave.barvaKontrast || (jeOdpust ? "#a53333" : (jeKompenzacija ? "#236cae" : "#9a5700")),
        rgb: metaPoravnave.rgb || (jeOdpust ? "207,76,76" : "155,93,0"),
      };
    } else if (tip === "paid_in_full") {
      var vrstaZakljucka = nastavitve.settlementType || (poravnava && poravnava.vrsta) || "full";
      if (vrstaZakljucka === "full" && !placilo) {
        placilo = najdiNeuporabljenPoVrsti(placila, "full", uporabljeniFinancni, nastavitve.settlementAmount);
      }
      if (vrstaZakljucka !== "full" && !poravnava) {
        poravnava = najdiNeuporabljenPoVrsti(poravnave, vrstaZakljucka, uporabljeniFinancni, nastavitve.settlementAmount);
      }
      var metaZakljucka = (Izidi && Izidi.izid(vrstaZakljucka)) || (Izidi && Izidi.izid("full")) || {};
      var financniZapis = vrstaZakljucka === "full" ? placilo : poravnava;
      rezultat = {
        naslov: metaZakljucka.naslov || "Primer zaključen",
        podrobnost: vrstaZakljucka === "full" ? "Dolg poravnan v celoti"
          : vrstaZakljucka === "compensation" ? "Končna kompenzacija"
          : vrstaZakljucka === "credit_note" ? "Končni dobropis"
          : vrstaZakljucka === "cancelled_invoice" ? "Razlog storna je shranjen"
          : "Končni korak",
        znesek: Number(financniZapis && financniZapis.znesek) || Number(nastavitve.settlementAmount) || 0,
        ikona: metaZakljucka.ikona || "checkCircle", razred: metaZakljucka.razred || "placano",
        barva: metaZakljucka.barva || "#299b63", barvaKontrast: metaZakljucka.barvaKontrast || "#217a4d", rgb: metaZakljucka.rgb || "41,155,99",
      };
    } else if (POTEK_AKCIJE[tip]) {
      rezultat = Object.assign({}, POTEK_AKCIJE[tip]);
      if (tip === "skip_current_step") rezultat.podrobnost = "Naslednji korak čez " + (Number(nastavitve.nextDelayDays) || 0) + " dni";
      if (tip === "stop_plan") rezultat.podrobnost = nastavitve.resumeMode === "date" && nastavitve.resumeAt ? "Ponovni zagon: " + formatirajDatumInUro(nastavitve.resumeAt) : "Ponovni zagon ročno";
      if (tip === "handoff_to_lawyer") rezultat.podrobnost = nastavitve.timingMode === "custom" && nastavitve.scheduledHandoffAt ? "Predaja: " + formatirajDatumInUro(nastavitve.scheduledHandoffAt) : "Predaja čim prej";
      if (tip === "postpone_reminder") rezultat.podrobnost = "Prestavljen za " + (Number(nastavitve.delayDays) || 0) + " dni";
      if (tip === "payment_promised") rezultat.podrobnost = "Dogovorjeno čakanje: " + (Number(nastavitve.waitDays) || 0) + " dni";
      rezultat.znesek = null;
    } else {
      return null;
    }

    if (placilo && uporabljeniFinancni) uporabljeniFinancni.add(placilo);
    if (poravnava && uporabljeniFinancni) uporabljeniFinancni.add(poravnava);

    var datum = nastavitve.settledAt || (placilo && placilo.datum_placila) || (poravnava && poravnava.datum_poravnave) || ukrep.completed_at || ukrep.created_at;
    return Object.assign(rezultat, {
      actionId: ukrep.action_id || null,
      financniActionId: (placilo && placilo.action_id) || (poravnava && poravnava.action_id) || null,
      actionType: tip,
      datum: datum,
      datumZapisa: ukrep.completed_at || ukrep.created_at || datum,
    });
  }

  function izpeljiPotekResitve(ukrepi, placila, poravnave) {
    ukrepi = Array.isArray(ukrepi) ? ukrepi.slice() : [];
    placila = Array.isArray(placila) ? placila.slice() : [];
    poravnave = Array.isArray(poravnave) ? poravnave.slice() : [];
    var uporabljeniFinancni = new Set();
    ukrepi.sort(function (a, b) {
      var razlika = new Date(a.completed_at || a.created_at || 0).getTime() - new Date(b.completed_at || b.created_at || 0).getTime();
      return razlika || String(a.action_id || a.id || "").localeCompare(String(b.action_id || b.id || ""));
    });
    var koraki = ukrepi
      .filter(function (u) { return u && u.status === "completed"; })
      .map(function (u) {
        return korakIzUkrepa(u, placila, poravnave, uporabljeniFinancni);
      })
      .filter(Boolean);

    placila.forEach(function (p) {
      if (!uporabljeniFinancni.has(p)) koraki.push(financniKorakIzZapisa(p, "placilo"));
    });
    poravnave.forEach(function (p) {
      if (!uporabljeniFinancni.has(p)) koraki.push(financniKorakIzZapisa(p, "poravnava"));
    });

    return koraki.sort(function (a, b) {
      var razlika = new Date(a.datumZapisa || a.datum || 0).getTime() - new Date(b.datumZapisa || b.datum || 0).getTime();
      return razlika || String(a.actionId || a.financniActionId || "").localeCompare(String(b.actionId || b.financniActionId || ""));
    });
  }

  function casovnaVrednost(vrednost) {
    var cas = new Date(vrednost || 0).getTime();
    return Number.isFinite(cas) ? cas : 0;
  }

  function ukrepFinancnegaZapisa(zapis, ukrepi) {
    if (!zapis || !zapis.action_id) return null;
    return (ukrepi || []).find(function (ukrep) {
      return String(ukrep.action_id || "") === String(zapis.action_id);
    }) || null;
  }

  function datumFinancnegaZapisa(dogodek, ukrepi) {
    if (!dogodek || !dogodek.zapis) return null;
    var zapis = dogodek.zapis;
    var ukrep = ukrepFinancnegaZapisa(zapis, ukrepi);
    var nastavitve = ukrep && ukrep.settings && typeof ukrep.settings === "object" ? ukrep.settings : {};
    return nastavitve.settledAt || (ukrep && (ukrep.completed_at || ukrep.created_at)) || zapis.created_at ||
      (dogodek.vrstaZapisa === "placilo" ? zapis.datum_placila : zapis.datum_poravnave) || null;
  }

  function primerjajFinancnaDogodka(a, b, ukrepi) {
    var datumA = a.vrstaZapisa === "placilo" ? a.zapis.datum_placila : a.zapis.datum_poravnave;
    var datumB = b.vrstaZapisa === "placilo" ? b.zapis.datum_placila : b.zapis.datum_poravnave;
    var razlika = casovnaVrednost(datumA) - casovnaVrednost(datumB);
    if (razlika) return razlika;
    razlika = casovnaVrednost(datumFinancnegaZapisa(a, ukrepi)) - casovnaVrednost(datumFinancnegaZapisa(b, ukrepi));
    if (razlika) return razlika;
    razlika = casovnaVrednost(a.zapis.created_at) - casovnaVrednost(b.zapis.created_at);
    if (razlika) return razlika;
    return String(a.zapis.action_id || a.zapis.id || a.vrstaZapisa || "")
      .localeCompare(String(b.zapis.action_id || b.zapis.id || b.vrstaZapisa || ""));
  }

  /* ==========================================================
     ČISTA FUNKCIJA (brez DOM/omrežja) - iz surovih podatkov zadeve sestavi
     celoten prikazni model "Podrobnosti zaključka". Testirana neposredno v
     scripts/test-koncani-primeri-izidi.mjs (glej module.exports spodaj).
     ========================================================== */
  function izpeljiPrikazniModel(zadeva, placila, poravnave, steviloOpominov, ukrepi) {
    zadeva = zadeva || {};
    placila = Array.isArray(placila) ? placila.slice() : [];
    poravnave = Array.isArray(poravnave) ? poravnave.slice() : [];

    placila.sort(function (a, b) {
      return primerjajFinancnaDogodka({ zapis: a, vrstaZapisa: "placilo" }, { zapis: b, vrstaZapisa: "placilo" }, ukrepi);
    });
    poravnave.sort(function (a, b) {
      return primerjajFinancnaDogodka({ zapis: a, vrstaZapisa: "poravnava" }, { zapis: b, vrstaZapisa: "poravnava" }, ukrepi);
    });

    var zadnjaPoravnava = poravnave.length ? poravnave[poravnave.length - 1] : null;
    var polnoPlacilo = null;
    for (var i = placila.length - 1; i >= 0; i--) {
      if (placila[i].vrsta === "full") { polnoPlacilo = placila[i]; break; }
    }

    var dogodekPolnegaPlacila = polnoPlacilo ? { zapis: polnoPlacilo, vrstaZapisa: "placilo" } : null;
    var dogodekPoravnave = zadnjaPoravnava ? { zapis: zadnjaPoravnava, vrstaZapisa: "poravnava" } : null;
    var zakljucniDogodek = dogodekPolnegaPlacila;
    if (dogodekPoravnave && (!zakljucniDogodek || primerjajFinancnaDogodka(zakljucniDogodek, dogodekPoravnave, ukrepi) < 0)) {
      zakljucniDogodek = dogodekPoravnave;
    }
    var zakljucekJePoravnava = Boolean(zakljucniDogodek && zakljucniDogodek.vrstaZapisa === "poravnava");

    var izidId;
    var datumZakljucka;
    var razlog = null;

    if (zakljucekJePoravnava) {
      izidId = zakljucniDogodek.zapis.vrsta;
      razlog = zakljucniDogodek.zapis.razlog || null;
    } else if (zakljucniDogodek) {
      var predhodni = placila.filter(function (p) { return p !== polnoPlacilo; });
      var imaObrok = predhodni.some(function (p) { return p.vrsta === "installment"; });
      var imaDelno = predhodni.some(function (p) { return p.vrsta === "partial"; }) || poravnave.length > 0;
      izidId = imaObrok ? "installment_completed" : (imaDelno ? "partial_then_full" : "full");
    } else {
      izidId = "legacy";
    }
    datumZakljucka = zadeva.poravnano_at || datumFinancnegaZapisa(zakljucniDogodek, ukrepi) || null;

    var izid = (Izidi && Izidi.izid(izidId)) || {
      id: izidId, terminalen: true, naslov: "Primer zaključen",
      opis: "Podrobnosti načina zaključka niso na voljo.", razred: "other",
      barva: "#3d7676", barvaKontrast: "#2d6262", rgb: "61,118,118", ikona: "checkCircle", oznakaDatuma: "ZAKLJUČENO",
      financniPrikaz: "neznano", gumb: null,
    };

    var vsotaPlacil = placila.reduce(function (v, p) { return v + (Number(p.znesek) || 0); }, 0);
    var vsotaPoravnav = poravnave.reduce(function (v, p) { return v + (Number(p.znesek) || 0); }, 0);

    var prvotniDolg = Number(zadeva.prvotni_znesek);
    var agregatPlacil = Number(zadeva.placano_skupaj);
    var agregatPoravnav = Number(zadeva.poravnano_nedenarno);
    var prejeto = Number.isFinite(agregatPlacil) ? agregatPlacil : vsotaPlacil;
    var nedenarnoPoravnano = Number.isFinite(agregatPoravnav) ? agregatPoravnav : vsotaPoravnav;
    var preostanek = Number(zadeva.preostali_dolg) || 0;

    /* Kar je bilo denarno prejeto PRED nedenarnim zaključkom (za "Več
       informacij" - glavni tok pri kompenzaciji/dobropisu/stornu nikoli ne
       sme kazati te vsote kot "Prejeto"). */
    var prejetoPredZakljuckom = zakljucekJePoravnava ? prejeto : 0;

    return {
      izidId: izidId,
      terminalen: Boolean(izid.terminalen),
      naslov: izid.naslov,
      opis: izid.opisZakljucka || izid.opis,
      razred: izid.razred,
      barva: izid.barva,
      barvaKontrast: izid.barvaKontrast || "#2d6262",
      rgb: izid.rgb,
      ikona: izid.ikona,
      oznakaDatuma: izid.oznakaDatuma,
      financniPrikaz: izid.financniPrikaz,
      datum: datumZakljucka,
      razlog: razlog,
      podjetje: zadeva.ime_dolznika || "Neimenovan dolžnik",
      racun: zadeva.stevilka_racuna || zadeva.opis_dolga || "Brez številke",
      opisDolga: zadeva.opis_dolga || "",
      racunDatotekePoti: Array.isArray(zadeva.racun_datoteke_poti) ? zadeva.racun_datoteke_poti.slice() : [],
      datumZapadlosti: zadeva.datum_zapadlosti || null,
      steviloOpominov: Number.isFinite(Number(steviloOpominov)) ? Number(steviloOpominov) : 0,
      zneski: {
        prvotniDolg: prvotniDolg,
        prejeto: prejeto,
        nedenarnoPoravnano: nedenarnoPoravnano,
        preostanek: preostanek,
        prejetoPredZakljuckom: prejetoPredZakljuckom,
      },
      zgodovinaPlacil: placila.map(function (p) {
        return { znesek: Number(p.znesek) || 0, vrsta: p.vrsta, oznaka: VRSTA_PLACILA_OZNAKA[p.vrsta] || p.vrsta, datum: p.datum_placila, actionId: p.action_id || null };
      }),
      zgodovinaPoravnav: poravnave.map(function (p) {
        return { znesek: Number(p.znesek) || 0, vrsta: p.vrsta, oznaka: VRSTA_PORAVNAVE_OZNAKA[p.vrsta] || p.vrsta, datum: p.datum_poravnave, razlog: p.razlog || null };
      }),
      potekResitve: izpeljiPotekResitve(ukrepi, placila, poravnave),
    };
  }

  function znesekPrimera(model) {
    return model.zneski.prvotniDolg;
  }

  function jeNovPrimer(id) {
    return Boolean(state.novPrimerId) && String(id) === String(state.novPrimerId);
  }

  function filterZaModel(model) {
    return model.izidId === "full" || model.izidId === "installment_completed" || model.izidId === "partial_then_full"
      ? "paid"
      : "other";
  }

  function htmlKartice(primer) {
    var model = primer.model;
    var jeNov = jeNovPrimer(primer.id);
    return (
      '<article class="koncani-kartica koncani-kartica--' + esc(model.razred) + (jeNov ? ' is-newly-completed' : '') + '" ' +
        'data-koncani-tip="' + esc(filterZaModel(model)) + '" data-koncani-primer-id="' + esc(primer.id) + '" ' +
        (jeNov ? 'tabindex="-1" aria-label="Pravkar zaključen primer: ' + esc(model.naslov) + '" ' : '') +
        'style="--koncani-accent:' + esc(model.barva) + ';--koncani-contrast:' + esc(model.barvaKontrast) + ';--koncani-rgb:' + esc(model.rgb) + '">' +
        '<div class="koncani-kartica__meta"><span>' + esc(model.oznakaDatuma) + '</span><time class="koncani-kartica__datum">' + esc(formatirajDatum(model.datum)) + '</time></div>' +
        '<div class="koncani-kartica__glavno">' +
          '<span class="koncani-kartica__ikona" aria-hidden="true">' + ikona(model.ikona) + '</span>' +
          '<div class="koncani-kartica__besedilo">' +
            '<h2 class="koncani-kartica__naslov" data-koncani-fit data-fit-min="11">' + esc(model.naslov) + '</h2>' +
            '<p class="koncani-kartica__podjetje" data-koncani-fit data-fit-min="11">' + esc(model.podjetje) + '</p>' +
            '<p class="koncani-kartica__racun" data-koncani-fit data-fit-min="10">Račun ' + esc(model.racun) + '</p>' +
          '</div>' +
          '<strong class="koncani-kartica__znesek" data-koncani-fit data-fit-min="14">' + esc(formatirajZnesek(znesekPrimera(model))) + '</strong>' +
        '</div>' +
        '<div class="koncani-kartica__spodaj">' +
          '<div class="koncani-kartica__rezultat">' +
            '<p>' + esc(model.opis) + '</p>' +
          '</div>' +
          '<button type="button" class="koncani-kartica__podrobnosti" data-koncani-podrobnosti-id="' + esc(primer.id) + '">' +
            '<span>Poglej<br />podrobnosti</span>' +
            '<span class="koncani-kartica__puscica" aria-hidden="true">' + ikona("chevron") + '</span>' +
          '</button>' +
        '</div>' +
      '</article>'
    );
  }

  function prilagodiBesedilo(koren) {
    if (!koren) return;
    koren.querySelectorAll("[data-koncani-fit]").forEach(function (element) {
      element.classList.remove("is-preveliko");
      element.style.fontSize = "";
      var najmanjsa = Number(element.getAttribute("data-fit-min")) || 10;
      var velikost = parseFloat(window.getComputedStyle(element).fontSize) || 14;
      while ((element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) && velikost > najmanjsa) {
        velikost -= 0.5;
        element.style.fontSize = velikost + "px";
      }
      var seVednoPreveliko = element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1;
      element.classList.toggle("is-preveliko", seVednoPreveliko);
      if (seVednoPreveliko) element.setAttribute("title", element.textContent.trim());
      else element.removeAttribute("title");
    });
  }

  function filtriraniPrimeri() {
    if (state.filter === "all") return state.primeri.slice();
    return state.primeri.filter(function (primer) { return filterZaModel(primer.model) === state.filter; });
  }

  function izrisiSeznam() {
    var seznam = document.querySelector("[data-koncani-seznam]");
    var prazno = document.querySelector("[data-koncani-prazno]");
    var praznoNaslov = prazno && prazno.querySelector("h2");
    var praznoOpis = document.querySelector("[data-koncani-prazno-opis]");
    var primeri = filtriraniPrimeri();

    if (!primeri.length) {
      seznam.hidden = true;
      seznam.innerHTML = "";
      prazno.hidden = false;
      if (state.primeri.length) {
        praznoNaslov.textContent = "V tem filtru ni primerov";
        praznoOpis.textContent = "Izberite drug filter za prikaz preostalih zaključenih zadev.";
      } else {
        praznoNaslov.textContent = "Končanih primerov še ni";
        praznoOpis.textContent = "Ko zaključite primer, se bo samodejno prikazal tukaj.";
      }
      if (state.novPrimerId) {
        var prazenUrl = new URL(window.location.href);
        prazenUrl.searchParams.delete("nov");
        window.history.replaceState(window.history.state || {}, "", prazenUrl);
        state.novPrimerId = null;
      }
      return;
    }

    prazno.hidden = true;
    seznam.innerHTML = primeri.map(htmlKartice).join("");
    seznam.hidden = false;
    window.requestAnimationFrame(function () {
      prilagodiBesedilo(seznam);
      var novaKartica = seznam.querySelector(".koncani-kartica.is-newly-completed");
      var url = new URL(window.location.href);
      url.searchParams.delete("nov");
      window.history.replaceState(window.history.state || {}, "", url);
      state.novPrimerId = null;
      if (!novaKartica) return;
      var zmanjsanoGibanje = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      novaKartica.scrollIntoView({ behavior: zmanjsanoGibanje ? "auto" : "smooth", block: "center" });
      novaKartica.focus({ preventScroll: true });
    });
  }

  function nastaviFilter(noviFilter) {
    if (["all", "paid", "other"].indexOf(noviFilter) === -1) return;
    state.filter = noviFilter;
    document.querySelectorAll("[data-koncani-filter]").forEach(function (gumb) {
      var aktiven = gumb.getAttribute("data-koncani-filter") === noviFilter;
      gumb.classList.toggle("is-active", aktiven);
      gumb.setAttribute("aria-selected", String(aktiven));
      gumb.tabIndex = aktiven ? 0 : -1;
    });
    var panel = document.getElementById("koncani-primeri-panel");
    var aktivenGumb = document.querySelector('[data-koncani-filter="' + noviFilter + '"]');
    if (panel && aktivenGumb && aktivenGumb.id) panel.setAttribute("aria-labelledby", aktivenGumb.id);
    izrisiSeznam();
  }

  function formatirajDatumKoraka(iso) {
    if (!iso) return "Datum ni zapisan";
    var datum = new Date(iso);
    if (Number.isNaN(datum.getTime())) return "Datum ni zapisan";
    var vsebujeUro = String(iso).indexOf("T") >= 0;
    return new Intl.DateTimeFormat("sl-SI", vsebujeUro ? {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    } : {
      day: "numeric", month: "short", year: "numeric",
    }).format(datum);
  }

  function htmlPotekResitve(model) {
    var koraki = model.potekResitve || [];
    if (!koraki.length) return "";
    return '<section class="koncani-potek" aria-labelledby="koncani-potek-naslov">' +
      '<div class="koncani-potek__glava">' +
        '<h3 id="koncani-potek-naslov">Potek rešitve</h3>' +
        '<span>' + esc(koraki.length + " " + (koraki.length === 1 ? "korak" : koraki.length === 2 ? "koraka" : koraki.length < 5 ? "koraki" : "korakov")) + '</span>' +
      '</div>' +
      '<div class="koncani-potek__seznam">' + koraki.map(function (korak, indeks) {
        var vrednost = korak.znesek == null
          ? '<span class="koncani-potek__stanje" aria-label="Korak izveden">' + ikona("checkCircle") + '</span>'
          : '<strong class="koncani-potek__znesek" data-koncani-fit data-fit-min="11">' + esc(formatirajZnesek(korak.znesek)) + '</strong>';
        return '<article class="koncani-potek__korak koncani-potek__korak--' + esc(korak.razred) + '" ' +
          'style="--potek-accent:' + esc(korak.barva) + ';--potek-contrast:' + esc(korak.barvaKontrast || model.barvaKontrast) + ';--potek-rgb:' + esc(korak.rgb) + '">' +
            '<span class="koncani-potek__stevilka" aria-hidden="true">' + (indeks + 1) + '</span>' +
            '<span class="koncani-potek__ikona" aria-hidden="true">' + ikona(korak.ikona) + '</span>' +
            '<span class="koncani-potek__besedilo">' +
              '<strong data-koncani-fit data-fit-min="11">' + esc(korak.naslov) + '</strong>' +
              '<small data-koncani-fit data-fit-min="10">' + esc((indeks + 1) + ". korak · " + formatirajDatumKoraka(korak.datum)) + '</small>' +
              '<small class="koncani-potek__opis" data-koncani-fit data-fit-min="10">' + esc(korak.podrobnost || "Korak je bil uspešno izveden.") + '</small>' +
            '</span>' +
            vrednost +
          '</article>';
      }).join("") + '</div>' +
    '</section>';
  }

  function imeDatotekeIzPoti(pot) {
    var zadnjiDel = String(pot || "").split("/").pop() || "Račun";
    try { zadnjiDel = decodeURIComponent(zadnjiDel); } catch (_) {}
    return zadnjiDel.replace(/^\d+-[a-z0-9]+-/i, "") || "Račun";
  }

  function pripraviDokumente(model) {
    return ((model && model.racunDatotekePoti) || []).filter(function (pot) {
      return typeof pot === "string" && pot.trim();
    }).map(function (pot, indeks) {
      var ime = imeDatotekeIzPoti(pot);
      return {
        indeks: indeks,
        pot: pot,
        ime: ime,
        naslov: /\.pdf$/i.test(ime) ? "Račun PDF" : "Slika računa",
      };
    });
  }

  function htmlPredogledDokumentov(primer) {
    var dokumenti = pripraviDokumente(primer.model);
    if (!dokumenti.length) {
      return '<section class="koncani-dokumenti koncani-dokumenti--prazno" aria-label="Izvirni račun">' +
        '<div class="koncani-dokumenti__glava">' +
          '<span class="koncani-dokumenti__ikona" aria-hidden="true">' + ikona("receiptCheck") + '</span>' +
          '<strong>Izvirni račun</strong>' +
        '</div>' +
        '<p>Izvirni račun pri tem primeru ni priložen.</p>' +
      '</section>';
    }
    var indeks = Math.min(Math.max(0, Number(state.aktivenDokument) || 0), dokumenti.length - 1);
    var dok = dokumenti[indeks];
    var zavihki = dokumenti.length > 1
      ? '<div class="koncani-dokumenti__zavihki" data-koncani-dokument-drsnik>' + dokumenti.map(function (dokument, i) {
          return '<button type="button" class="koncani-dokumenti__zavihek' + (i === indeks ? ' is-selected' : '') + '" data-koncani-dokument="' + i + '" aria-pressed="' + String(i === indeks) + '" data-koncani-fit data-fit-min="10">' + (i + 1) + '. račun</button>';
        }).join("") + '</div>' +
        '<div class="koncani-dokumenti__pikice" aria-label="Izbira dokumenta">' + dokumenti.map(function (dokument, i) {
          return '<button type="button" class="koncani-dokumenti__pikica' + (i === indeks ? ' is-selected' : '') + '" data-koncani-dokument="' + i + '" aria-label="Prikaži ' + (i + 1) + '. račun" aria-pressed="' + String(i === indeks) + '"><span aria-hidden="true"></span></button>';
        }).join("") + '</div>'
      : "";
    return '<section class="koncani-dokumenti" aria-label="Izvirni računi">' +
      '<div class="koncani-dokumenti__glava">' +
        '<span class="koncani-dokumenti__ikona" aria-hidden="true">' + ikona("receiptCheck") + '</span>' +
        '<strong>Izvirni računi</strong>' +
        '<span class="koncani-dokumenti__stevec" aria-label="' + dokumenti.length + ' dokumentov">' + dokumenti.length + '</span>' +
      '</div>' +
      '<div class="koncani-dokumenti__telo">' + zavihki +
        '<div class="koncani-dokument">' +
          '<div class="koncani-dokument__vrstica"><span>Priložena datoteka</span><span class="koncani-dokument__desno"><b>' + esc(dok.naslov) + '</b><br>' + esc(dok.ime) + '<br>Račun ' + esc(primer.model.racun) + '</span></div>' +
          (state.napakaDokumenta ? '<p class="koncani-dokument__napaka" role="alert">' + esc(state.napakaDokumenta) + '</p>' : '') +
          '<button type="button" class="koncani-dokument__odpri" data-koncani-dokument-odpri="' + indeks + '">Odpri originalni račun</button>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function htmlKompaktniPodatki(model) {
    return (
      '<div class="koncani-mreza">' +
        htmlPodatkovnoPolje("Podjetje", model.podjetje, "building", "") +
        htmlPodatkovnoPolje("Račun", model.racun, "document", "") +
        htmlPodatkovnoPolje("Zapadlost", formatirajDatum(model.datumZapadlosti), "calendar", "") +
        htmlPodatkovnoPolje("", besediloOpominov(model.steviloOpominov), "bell", " koncani-mreza__polje--opomini") +
      '</div>'
    );
  }

  function htmlPodatkovnoPolje(oznaka, vrednost, ikonaIme, dodatniRazred) {
    return '<div class="koncani-mreza__polje' + dodatniRazred + '">' +
      '<span class="koncani-mreza__ikona" aria-hidden="true">' + ikona(ikonaIme) + '</span>' +
      '<span class="koncani-mreza__besedilo">' +
        (oznaka ? '<small>' + esc(oznaka) + '</small>' : '') +
        '<strong data-koncani-fit data-fit-min="11">' + esc(vrednost) + '</strong>' +
      '</span>' +
    '</div>';
  }

  function besediloOpominov(stevilo) {
    var n = Math.max(0, Number(stevilo) || 0);
    if (n === 1) return "1 poslan opomin";
    if (n === 2) return "2 poslana opomina";
    if (n === 3 || n === 4) return n + " poslani opomini";
    return n + " poslanih opominov";
  }

  function htmlVecInfoVrstica(oznaka, vrednost) {
    return '<div class="koncani-vec-info__vrstica"><span>' + esc(oznaka) + '</span><strong>' + esc(vrednost || "—") + '</strong></div>';
  }

  function htmlVecInfo(model) {
    var deli = [];
    if (model.zgodovinaPlacil.length) {
      deli.push('<h3 class="koncani-vec-info__naslov">Zgodovina plačil</h3>');
      model.zgodovinaPlacil.forEach(function (p) {
        deli.push(htmlVecInfoVrstica(p.oznaka + " · " + formatirajDatum(p.datum), formatirajZnesek(p.znesek)));
      });
    }
    if (model.zgodovinaPoravnav.length) {
      deli.push('<h3 class="koncani-vec-info__naslov">Nedenarna poravnava</h3>');
      model.zgodovinaPoravnav.forEach(function (p) {
        deli.push(htmlVecInfoVrstica(p.oznaka + " · " + formatirajDatum(p.datum), formatirajZnesek(p.znesek)));
        if (p.vrsta === "cancelled_invoice") {
          deli.push(htmlVecInfoVrstica("Razlog storna", razlogStorna(p.razlog)));
        }
      });
    }
    if (model.zneski.prejetoPredZakljuckom > 0) {
      deli.push('<h3 class="koncani-vec-info__naslov">Pred zaključkom</h3>');
      deli.push(htmlVecInfoVrstica("Prejeto pred zaključkom", formatirajZnesek(model.zneski.prejetoPredZakljuckom)));
      deli.push(htmlVecInfoVrstica("Nedenarno poravnano", formatirajZnesek(model.zneski.nedenarnoPoravnano)));
    }
    deli.push('<h3 class="koncani-vec-info__naslov">Opomini</h3>');
    deli.push(htmlVecInfoVrstica("Poslani opomini", String(model.steviloOpominov)));
    deli.push(htmlVecInfoVrstica("Datum zapadlosti", formatirajDatum(model.datumZapadlosti)));
    deli.push(htmlVecInfoVrstica("Datum zaključka", formatirajDatumInUro(model.datum)));
    return deli.join("");
  }

  function htmlPodrobnosti(primer) {
    var model = primer.model;
    var datum = razdeliDatum(model.datum);
    return (
      '<div class="koncani-izid" style="--koncani-accent:' + esc(model.barva) + ';--koncani-contrast:' + esc(model.barvaKontrast) + ';--koncani-rgb:' + esc(model.rgb) + '">' +
        '<div class="koncani-izid__glava">' +
          '<div class="koncani-izid__naslovna">' +
            '<span class="koncani-izid__ikona" aria-hidden="true">' + ikona(model.ikona) + '</span>' +
            '<h3 class="koncani-izid__naslov" data-koncani-fit data-fit-min="13">' + esc(model.naslov) + '</h3>' +
          '</div>' +
          '<div class="koncani-izid__datum-okvir">' +
            '<span class="koncani-izid__oznaka-datum">' + esc(model.oznakaDatuma) + '</span>' +
            '<time class="koncani-izid__datum" datetime="' + esc(model.datum || "") + '">' +
              esc(datum.glavni) + (datum.leto ? " " + esc(datum.leto) : "") +
            '</time>' +
          '</div>' +
        '</div>' +
        '<p class="koncani-izid__opis" data-koncani-fit data-fit-min="11">' + esc(model.opis) + '</p>' +
      '</div>' +
      htmlPotekResitve(model) +
      htmlPredogledDokumentov(primer) +
      '<div class="koncani-podatki">' +
        htmlKompaktniPodatki(model) +
        '<button type="button" class="koncani-vec-info__gumb" data-koncani-vec-info-preklop aria-expanded="' + String(state.vecInfoOdprto) + '" aria-controls="koncani-vec-info-vsebina">' +
          '<span>Več informacij</span>' +
          '<span class="koncani-vec-info__gumb-ikona' + (state.vecInfoOdprto ? ' is-odprto' : '') + '" aria-hidden="true">' + ikona("chevron") + '</span>' +
        '</button>' +
        '<div class="koncani-vec-info' + (state.vecInfoOdprto ? ' is-odprto' : '') + '" id="koncani-vec-info-vsebina" aria-hidden="' + String(!state.vecInfoOdprto) + '">' +
          '<div class="koncani-vec-info__notranjost">' + htmlVecInfo(model) + '</div>' +
        '</div>' +
      '</div>' +
      '<a class="koncani-odpri-primer" href="izvedba.html?zadevaId=' + esc(primer.id) + '&readonly=1" data-koncani-odpri-primer>' +
        '<span>Odpri celoten primer</span>' +
      '</a>'
    );
  }

  function osveziOdprtePodrobnosti(fokusSelektor) {
    var primer = state.primeri.find(function (vrednost) { return String(vrednost.id) === String(state.dialogPrimerId); });
    var vsebina = document.querySelector("[data-koncani-podrobnosti-vsebina]");
    if (!primer || !vsebina) return;
    vsebina.innerHTML = htmlPodrobnosti(primer);
    window.requestAnimationFrame(function () {
      prilagodiBesedilo(vsebina);
      nastaviDokumentniDrsnik(vsebina);
      var fokusni = fokusSelektor && vsebina.querySelector(fokusSelektor);
      if (fokusni && typeof fokusni.focus === "function") fokusni.focus({ preventScroll: true });
    });
  }

  async function odpriIzvirniDokument(indeks) {
    var primer = state.primeri.find(function (vrednost) { return String(vrednost.id) === String(state.dialogPrimerId); });
    var dokumenti = pripraviDokumente(primer && primer.model);
    var dokument = dokumenti[Math.min(Math.max(0, Number(indeks) || 0), Math.max(0, dokumenti.length - 1))];
    if (!dokument || !supabaseKlient || !supabaseKlient.storage) return;

    state.napakaDokumenta = null;
    var novZavihek = window.open("", "_blank");
    if (novZavihek) novZavihek.opener = null;
    try {
      var odgovor = await supabaseKlient.storage.from("racuni-priloge").createSignedUrl(dokument.pot, 60);
      if (odgovor.error || !odgovor.data || !odgovor.data.signedUrl) {
        throw odgovor.error || new Error("Povezava ni na voljo.");
      }
      if (novZavihek) novZavihek.location.replace(odgovor.data.signedUrl);
      else window.location.assign(odgovor.data.signedUrl);
    } catch (err) {
      if (novZavihek) novZavihek.close();
      state.napakaDokumenta = "Originalnega računa trenutno ni bilo mogoče odpreti. Poskusite znova.";
      osveziOdprtePodrobnosti('[data-koncani-dokument-odpri="' + indeks + '"]');
    }
  }

  function nastaviDokumentniDrsnik(koren) {
    var drsnik = koren && koren.querySelector("[data-koncani-dokument-drsnik]");
    if (!drsnik) return;
    var zavihki = Array.prototype.slice.call(drsnik.querySelectorAll("[data-koncani-dokument]"));
    var aktivniIndeks = Math.min(Math.max(0, Number(state.aktivenDokument) || 0), Math.max(0, zavihki.length - 1));

    function korakDrsnika() {
      if (!zavihki[0]) return 1;
      var slog = window.getComputedStyle(drsnik);
      return zavihki[0].getBoundingClientRect().width + (parseFloat(slog.columnGap || slog.gap) || 0);
    }

    drsnik.scrollLeft = Math.min(aktivniIndeks * korakDrsnika(), Math.max(0, drsnik.scrollWidth - drsnik.clientWidth));
    var casovnik = null;
    drsnik.addEventListener("scroll", function () {
      window.clearTimeout(casovnik);
      casovnik = window.setTimeout(function () {
        var zadnjiIndeks = zavihki.length - 1;
        var skrajniOdmik = Math.max(0, drsnik.scrollWidth - drsnik.clientWidth);
        var indeks = drsnik.scrollLeft >= skrajniOdmik - 2
          ? zadnjiIndeks
          : Math.min(zadnjiIndeks, Math.max(0, Math.round(drsnik.scrollLeft / korakDrsnika())));
        if (indeks === state.aktivenDokument) return;
        state.aktivenDokument = indeks;
        osveziOdprtePodrobnosti();
      }, 90);
    }, { passive: true });
  }

  function odpriPodrobnosti(id, posodobiUrl) {
    var primer = state.primeri.find(function (vrednost) { return String(vrednost.id) === String(id); });
    var dialog = document.querySelector("[data-koncani-podrobnosti]");
    var vsebina = document.querySelector("[data-koncani-podrobnosti-vsebina]");
    if (!primer || !dialog || !vsebina) return false;

    state.dialogPrimerId = primer.id;
    state.vecInfoOdprto = false;
    state.aktivenDokument = 0;
    state.pregledDokumenta = null;
    state.napakaDokumenta = null;
    state.dialogSprozilec = document.activeElement;
    dialog.style.setProperty("--koncani-accent", primer.model.barva);
    dialog.style.setProperty("--koncani-contrast", primer.model.barvaKontrast);
    dialog.style.setProperty("--koncani-rgb", primer.model.rgb);
    vsebina.innerHTML = htmlPodrobnosti(primer);
    document.body.classList.add("koncani-podrobnosti-odprto", "uj-modal-odprt");
    document.documentElement.classList.add("uj-modal-odprt");
    if (!dialog.open) dialog.showModal();
    window.requestAnimationFrame(function () {
      prilagodiBesedilo(vsebina);
      nastaviDokumentniDrsnik(vsebina);
      var zapri = dialog.querySelector("[data-koncani-zapri]");
      if (zapri) zapri.focus({ preventScroll: true });
    });

    if (posodobiUrl !== false) {
      var url = new URL(window.location.href);
      url.searchParams.set("primer", primer.id);
      window.history.pushState({ koncaniPrimer: primer.id }, "", url);
    }
    return true;
  }

  function zapriPodrobnosti(posodobiUrl) {
    var trenutniUrl = new URL(window.location.href);
    if (posodobiUrl !== false && trenutniUrl.searchParams.has("primer") && window.history.state && window.history.state.koncaniPrimer) {
      window.history.back();
      return;
    }
    var dialog = document.querySelector("[data-koncani-podrobnosti]");
    if (dialog && dialog.open) dialog.close();
    state.dialogPrimerId = null;
    state.pregledDokumenta = null;
    document.body.classList.remove("koncani-podrobnosti-odprto", "uj-modal-odprt");
    document.documentElement.classList.remove("uj-modal-odprt");
    if (posodobiUrl !== false) {
      trenutniUrl.searchParams.delete("primer");
      window.history.replaceState({}, "", trenutniUrl);
    }
    if (state.dialogSprozilec && typeof state.dialogSprozilec.focus === "function") {
      state.dialogSprozilec.focus();
    }
    state.dialogSprozilec = null;
  }

  function preklopiVecInfo() {
    state.vecInfoOdprto = !state.vecInfoOdprto;
    var gumb = document.querySelector("[data-koncani-vec-info-preklop]");
    var vsebina = document.getElementById("koncani-vec-info-vsebina");
    var ikonaEl = gumb && gumb.querySelector(".koncani-vec-info__gumb-ikona");
    if (gumb) gumb.setAttribute("aria-expanded", String(state.vecInfoOdprto));
    if (vsebina) {
      vsebina.classList.toggle("is-odprto", state.vecInfoOdprto);
      vsebina.setAttribute("aria-hidden", String(!state.vecInfoOdprto));
    }
    if (ikonaEl) ikonaEl.classList.toggle("is-odprto", state.vecInfoOdprto);
  }

  async function naloziVseStrani(ustvariPoizvedbo, velikostStrani) {
    var vsi = [];
    var velikost = Math.max(1, Number(velikostStrani) || 500);
    for (var odmik = 0; ; odmik += velikost) {
      var odgovor = await ustvariPoizvedbo(odmik, odmik + velikost - 1);
      if (!odgovor || odgovor.error) throw (odgovor && odgovor.error) || new Error("Podatkov ni bilo mogoče naložiti.");
      var stran = Array.isArray(odgovor.data) ? odgovor.data : [];
      vsi = vsi.concat(stran);
      if (stran.length < velikost) break;
    }
    return vsi;
  }

  async function naloziZadeve() {
    return naloziVseStrani(function (od, doVkljucno) {
      return supabaseKlient
        .from("zadeve")
        .select("id,ime_dolznika,opis_dolga,status,stevilka_racuna,prvotni_znesek,placano_skupaj,poravnano_nedenarno,preostali_dolg,poravnano_at,datum_zapadlosti,racun_datoteke_poti")
        .eq("status", "Rešeno")
        .order("poravnano_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true })
        .range(od, doVkljucno);
    });
  }

  async function naloziProdajalca() {
    try {
      var odgovor = await supabaseKlient
        .from("pos_business_profiles")
        .select("legal_name,street,postal_code,city,tax_number,vat_id,iban")
        .limit(1);
      if (odgovor.error) throw odgovor.error;
      var p = (odgovor.data || [])[0];
      return p ? {
        imePodjetja: p.legal_name, naslov: p.street, posta: p.postal_code, mesto: p.city,
        davcnaStevilka: p.tax_number, idZaDdv: p.vat_id, iban: p.iban,
      } : null;
    } catch (err) {
      console.warn("Podatkov prodajalca za predogled dokumenta ni bilo mogoče naložiti.", err);
      return null;
    }
  }

  async function naloziPoDelih(tabela, stolpci, ids, dodatniFilter) {
    var vsi = [];
    for (var zacetek = 0; zacetek < ids.length; zacetek += 60) {
      var idsDela = ids.slice(zacetek, zacetek + 60);
      var del = await naloziVseStrani(function (od, doVkljucno) {
        var poizvedba = supabaseKlient.from(tabela).select(stolpci).in("zadeva_id", idsDela);
        if (dodatniFilter) poizvedba = dodatniFilter(poizvedba);
        return poizvedba.order("id", { ascending: true }).range(od, doVkljucno);
      });
      vsi = vsi.concat(del);
    }
    return vsi;
  }

  function grupirajPoZadevi(vrstice) {
    return vrstice.reduce(function (mapa, vrstica) {
      var kljuc = vrstica.zadeva_id;
      if (!mapa[kljuc]) mapa[kljuc] = [];
      mapa[kljuc].push(vrstica);
      return mapa;
    }, {});
  }

  function steviloPoslanihOpominov(koraki) {
    var unikatni = {};
    koraki.forEach(function (k) {
      if (k.execution_state === "sent") unikatni[k.step_id] = true;
    });
    return Object.keys(unikatni).length;
  }

  async function naloziPrimere() {
    var zadeve = await naloziZadeve();
    if (!zadeve.length) return [];
    var ids = zadeve.map(function (z) { return z.id; });

    var placilaVse = await naloziPoDelih("zadeva_placila", "id,zadeva_id,znesek,vrsta,datum_placila,action_id,created_at", ids);
    var poravnaveVse = await naloziPoDelih("zadeva_poravnave", "id,zadeva_id,vrsta,znesek,datum_poravnave,razlog,action_id,created_at", ids);
    var korakiVse = await naloziPoDelih("opomin_koraki", "id,zadeva_id,step_id,execution_state,sent_at", ids);
    var ukrepiVse = await naloziPoDelih("opomin_ukrepi", "id,zadeva_id,action_id,step_id,action_type,status,settings,created_at,completed_at", ids);

    var placilaPoZadevi = grupirajPoZadevi(placilaVse);
    var poravnavePoZadevi = grupirajPoZadevi(poravnaveVse);
    var korakiPoZadevi = grupirajPoZadevi(korakiVse);
    var ukrepiPoZadevi = grupirajPoZadevi(ukrepiVse);

    return zadeve.map(function (zadeva) {
      var model = izpeljiPrikazniModel(
        zadeva,
        placilaPoZadevi[zadeva.id] || [],
        poravnavePoZadevi[zadeva.id] || [],
        steviloPoslanihOpominov(korakiPoZadevi[zadeva.id] || []),
        ukrepiPoZadevi[zadeva.id] || []
      );
      return { id: zadeva.id, model: model };
    }).sort(function (a, b) {
      return new Date(b.model.datum || 0).getTime() - new Date(a.model.datum || 0).getTime();
    });
  }

  function sCasovnoOmejitvijo(obljuba, milisekunde) {
    return new Promise(function (resolve, reject) {
      var koncano = false;
      var casovnik = window.setTimeout(function () {
        if (koncano) return;
        koncano = true;
        reject(new Error("Nalaganje je trajalo predolgo. Poskusite znova."));
      }, milisekunde);
      Promise.resolve(obljuba).then(function (vrednost) {
        if (koncano) return;
        koncano = true;
        window.clearTimeout(casovnik);
        resolve(vrednost);
      }, function (napaka) {
        if (koncano) return;
        koncano = true;
        window.clearTimeout(casovnik);
        reject(napaka);
      });
    });
  }

  function odstraniPrimerIzUrl() {
    var url = new URL(window.location.href);
    if (!url.searchParams.has("primer")) return;
    url.searchParams.delete("primer");
    window.history.replaceState({}, "", url);
  }

  function sinhronizirajPrimerIzUrl() {
    var id = new URL(window.location.href).searchParams.get("primer");
    if (!id) {
      zapriPodrobnosti(false);
      return;
    }
    if (!odpriPodrobnosti(id, false)) {
      odstraniPrimerIzUrl();
      zapriPodrobnosti(false);
    }
  }

  function poveziDogodke() {
    if (state.dogodkiPovezani) return;
    state.dogodkiPovezani = true;
    document.addEventListener("click", function (event) {
      if (event.target.closest("[data-koncani-ponovi]")) {
        if (state.inicializirano) osveziPrimere({ zacetno: !state.primeri.length });
        else inicializiraj();
        return;
      }
      var filter = event.target.closest("[data-koncani-filter]");
      if (filter) {
        nastaviFilter(filter.getAttribute("data-koncani-filter"));
        return;
      }
      var podrobnosti = event.target.closest("[data-koncani-podrobnosti-id]");
      if (podrobnosti) {
        odpriPodrobnosti(podrobnosti.getAttribute("data-koncani-podrobnosti-id"), true);
        return;
      }
      if (event.target.closest("[data-koncani-vec-info-preklop]")) {
        preklopiVecInfo();
        return;
      }
      var zavihekDokumenta = event.target.closest("[data-koncani-dokument]");
      if (zavihekDokumenta) {
        state.aktivenDokument = Number(zavihekDokumenta.getAttribute("data-koncani-dokument")) || 0;
        var jePikica = zavihekDokumenta.classList.contains("koncani-dokumenti__pikica");
        osveziOdprtePodrobnosti((jePikica ? ".koncani-dokumenti__pikica" : ".koncani-dokumenti__zavihek") + '[data-koncani-dokument="' + state.aktivenDokument + '"]');
        return;
      }
      var odpriDokument = event.target.closest("[data-koncani-dokument-odpri]");
      if (odpriDokument) {
        odpriIzvirniDokument(Number(odpriDokument.getAttribute("data-koncani-dokument-odpri")) || 0);
        return;
      }
      if (event.target.closest("[data-koncani-zapri]")) zapriPodrobnosti(true);
    });

    document.addEventListener("keydown", function (event) {
      var trenutni = event.target.closest && event.target.closest("[data-koncani-filter]");
      if (!trenutni) return;
      var tipke = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
      if (tipke.indexOf(event.key) === -1) return;
      var zavihki = Array.prototype.slice.call(document.querySelectorAll("[data-koncani-filter]"));
      var indeks = zavihki.indexOf(trenutni);
      if (indeks < 0) return;
      event.preventDefault();
      if (event.key === "Home") indeks = 0;
      else if (event.key === "End") indeks = zavihki.length - 1;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") indeks = (indeks - 1 + zavihki.length) % zavihki.length;
      else indeks = (indeks + 1) % zavihki.length;
      nastaviFilter(zavihki[indeks].getAttribute("data-koncani-filter"));
      zavihki[indeks].focus();
    });

    var dialog = document.querySelector("[data-koncani-podrobnosti]");
    if (dialog) {
      dialog.addEventListener("click", function (event) {
        if (event.target === dialog) zapriPodrobnosti(true);
      });
      dialog.addEventListener("cancel", function (event) {
        event.preventDefault();
        zapriPodrobnosti(true);
      });
    }

    window.addEventListener("popstate", function () {
      sinhronizirajPrimerIzUrl();
    });
    window.addEventListener("resize", function () {
      window.requestAnimationFrame(function () { prilagodiBesedilo(document); });
    });
    window.addEventListener("pageshow", function (event) {
      if (state.inicializirano && (event.persisted || Date.now() - state.zadnjaOsvezitev > 1000)) osveziPrimere({ tiho: true });
    });
    document.addEventListener("visibilitychange", function () {
      if (state.inicializirano && document.visibilityState === "visible" && Date.now() - state.zadnjaOsvezitev > 1000) {
        osveziPrimere({ tiho: true });
      }
    });
    window.addEventListener("beforeunload", function () {
      if (state.osveziCasovnik) window.clearTimeout(state.osveziCasovnik);
      if (state.realtimeKanal && supabaseKlient && typeof supabaseKlient.removeChannel === "function") {
        supabaseKlient.removeChannel(state.realtimeKanal);
      }
    });

    if (typeof ResizeObserver === "function") {
      state.fitObserver = new ResizeObserver(function () {
        window.requestAnimationFrame(function () { prilagodiBesedilo(document); });
      });
      var koren = document.querySelector("[data-koncani-primeri-root]");
      var dialogZaOpazovanje = document.querySelector("[data-koncani-podrobnosti]");
      if (koren) state.fitObserver.observe(koren);
      if (dialogZaOpazovanje) state.fitObserver.observe(dialogZaOpazovanje);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { prilagodiBesedilo(document); });
    }
  }

  function razporediOsvezitev() {
    if (state.osveziCasovnik) window.clearTimeout(state.osveziCasovnik);
    state.osveziCasovnik = window.setTimeout(function () {
      state.osveziCasovnik = null;
      osveziPrimere({ tiho: true });
    }, 220);
  }

  function nastaviRealtime(userId) {
    if (state.realtimeKanal || !userId || !supabaseKlient || typeof supabaseKlient.channel !== "function") return;
    state.realtimeKanal = supabaseKlient
      .channel("koncani-primeri-" + userId)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "zadeve", filter: "obrtnik_id=eq." + userId,
      }, razporediOsvezitev)
      .subscribe();
  }

  async function osveziPrimere(moznosti) {
    if (state.osvezevanje) return state.osvezevanje;
    var nastavitve = moznosti || {};
    var koren = document.querySelector("[data-koncani-primeri-root]");
    var nalaganje = document.querySelector("[data-koncani-nalaganje]");
    var napaka = document.querySelector("[data-koncani-napaka]");
    var napakaBesedilo = document.querySelector("[data-koncani-napaka-besedilo]");
    var stevec = document.querySelector("[data-koncani-stevec]");
    if (!koren) return null;

    koren.setAttribute("aria-busy", "true");
    if (napaka) napaka.hidden = true;
    if (nalaganje && (nastavitve.zacetno || !state.primeri.length)) nalaganje.hidden = false;

    state.osvezevanje = (async function () {
      try {
        var primeri = await sCasovnoOmejitvijo(naloziPrimere(), 20000);
        state.primeri = primeri;
        state.zadnjaOsvezitev = Date.now();
        if (stevec) {
          stevec.textContent = String(primeri.length);
          stevec.setAttribute("aria-label", primeri.length + " končanih primerov");
          stevec.hidden = false;
        }
        izrisiSeznam();
        sinhronizirajPrimerIzUrl();
        return primeri;
      } catch (err) {
        console.error("Končanih primerov ni bilo mogoče naložiti:", err);
        if (napakaBesedilo) napakaBesedilo.textContent = err && err.message
          ? err.message
          : "Končanih primerov trenutno ni bilo mogoče naložiti.";
        if (napaka) napaka.hidden = false;
        return null;
      } finally {
        if (nalaganje) nalaganje.hidden = true;
        koren.setAttribute("aria-busy", "false");
        state.osvezevanje = null;
      }
    })();
    return state.osvezevanje;
  }

  async function inicializiraj() {
    var koren = document.querySelector("[data-koncani-primeri-root]");
    if (!koren) return;
    var nalaganje = document.querySelector("[data-koncani-nalaganje]");
    var napaka = document.querySelector("[data-koncani-napaka]");
    var napakaBesedilo = document.querySelector("[data-koncani-napaka-besedilo]");
    poveziDogodke();

    try {
      if (typeof supabaseKlient === "undefined" || !supabaseKlient || !supabaseKlient.auth) {
        throw new Error("Povezava s podatki ni pripravljena.");
      }
      var seja = await sCasovnoOmejitvijo(supabaseKlient.auth.getSession(), 12000);
      if (!seja.data || !seja.data.session) {
        window.location.replace("prijava.html");
        return;
      }

      state.novPrimerId = new URL(window.location.href).searchParams.get("nov");
      state.inicializirano = true;
      nastaviRealtime(seja.data.session.user && seja.data.session.user.id);
      await osveziPrimere({ zacetno: true });
    } catch (err) {
      console.error("Končanih primerov ni bilo mogoče naložiti:", err);
      if (napakaBesedilo) napakaBesedilo.textContent = err && err.message
        ? err.message
        : "Končanih primerov trenutno ni bilo mogoče naložiti.";
      if (nalaganje) nalaganje.hidden = true;
      if (napaka) napaka.hidden = false;
    } finally {
      koren.setAttribute("aria-busy", "false");
    }
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      izpeljiPrikazniModel: izpeljiPrikazniModel,
      izpeljiPotekResitve: izpeljiPotekResitve,
      pripraviDokumente: pripraviDokumente,
      steviloPoslanihOpominov: steviloPoslanihOpominov,
      naloziVseStrani: naloziVseStrani,
    };
  }

  /* Testni/razvojni kavelj - omogoča ročno preverjanje "Podrobnosti
     zaključka" brez prijave/Supabase (glej npr. javascript_tool preverjanje
     v razvoju). Ne vpliva na produkcijsko delovanje strani. */
  root.UJKoncaniPrimeriDebug = {
    izpeljiPrikazniModel: izpeljiPrikazniModel,
    htmlPodrobnosti: htmlPodrobnosti,
    htmlKartice: htmlKartice,
    prilagodiBesedilo: prilagodiBesedilo,
    prikaziPrimer: function (primer, prodajalec) {
      state.primeri = [primer];
      state.prodajalec = prodajalec || null;
      odpriPodrobnosti(primer.id, false);
    },
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", inicializiraj, { once: true });
    } else {
      inicializiraj();
    }
  }
})(typeof window !== "undefined" ? window : this);
