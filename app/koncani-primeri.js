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
    skip_current_step: { naslov: "Korak preklican", ikona: "messageX", razred: "preklic", barva: "#f25a24", rgb: "242,90,36" },
    stop_plan: { naslov: "Načrt ustavljen", ikona: "stopCircle", razred: "ustavi", barva: "#d51f32", rgb: "213,31,50" },
    handoff_to_lawyer: { naslov: "Predano odvetniku", ikona: "scales", razred: "odvetnik", barva: "#6941b4", rgb: "105,65,180" },
    postpone_reminder: { naslov: "Opomin prestavljen", ikona: "calendarArrow", razred: "prestavi", barva: "#237bd4", rgb: "35,123,212" },
    payment_promised: { naslov: "Plačilo obljubljeno", ikona: "handshake", razred: "obljuba", barva: "#ef8a00", rgb: "239,138,0" },
  };

  function najdiPoActionId(vrstice, actionId) {
    if (!actionId) return null;
    return (vrstice || []).find(function (v) { return String(v.action_id || "") === String(actionId); }) || null;
  }

  function zadnjiPoVrsti(vrstice, vrsta) {
    var zadetki = (vrstice || []).filter(function (v) { return v.vrsta === vrsta; });
    return zadetki.length ? zadetki[zadetki.length - 1] : null;
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
      rgb: (meta && meta.rgb) || (jePlacilo ? "58,169,156" : "232,149,36"),
    };
  }

  function korakIzUkrepa(ukrep, placila, poravnave) {
    var tip = ukrep.action_type;
    var nastavitve = ukrep.settings && typeof ukrep.settings === "object" ? ukrep.settings : {};
    var placilo = najdiPoActionId(placila, ukrep.action_id);
    var poravnava = najdiPoActionId(poravnave, ukrep.action_id);
    var rezultat;

    if (tip === "partial_payment") {
      if (!placilo) placilo = zadnjiPoVrsti(placila, nastavitve.settlementType === "installment" ? "installment" : "partial");
      var jeObrok = nastavitve.settlementType === "installment" || (placilo && placilo.vrsta === "installment");
      var metaPlacila = (Izidi && Izidi.izid(jeObrok ? "installment" : "partial")) || {};
      rezultat = {
        naslov: jeObrok ? "Prejeti obrok" : "Delno plačilo",
        podrobnost: jeObrok ? "Plačilo v obrokih" : "Denarno plačilo",
        znesek: Number(placilo && placilo.znesek) || Number(nastavitve.paymentAmount) || 0,
        ikona: metaPlacila.ikona || "coinCheck", razred: metaPlacila.razred || "delno",
        barva: metaPlacila.barva || "#3aa99c", rgb: metaPlacila.rgb || "58,169,156",
      };
    } else if (tip === "partial_settlement") {
      if (!poravnava) poravnava = zadnjiPoVrsti(poravnave, nastavitve.kind === "writeoff" ? "cancelled_invoice" : "credit_note");
      var jeOdpust = nastavitve.kind === "writeoff" || (poravnava && poravnava.vrsta === "cancelled_invoice");
      rezultat = {
        naslov: jeOdpust ? "Odpust dolga" : "Dobropis",
        podrobnost: jeOdpust && (nastavitve.reason || (poravnava && poravnava.razlog))
          ? "Delni odpust · razlog shranjen"
          : (jeOdpust ? "Delni odpust" : "Delni dobropis"),
        znesek: Number(poravnava && poravnava.znesek) || Number(nastavitve.amount) || 0,
        ikona: jeOdpust ? "documentX" : "tag", razred: jeOdpust ? "storno" : "dobropis",
        barva: jeOdpust ? "#cf4c4c" : "#e89524", rgb: jeOdpust ? "207,76,76" : "232,149,36",
      };
    } else if (tip === "paid_in_full") {
      var vrstaZakljucka = nastavitve.settlementType || (poravnava && poravnava.vrsta) || "full";
      if (vrstaZakljucka === "full" && !placilo) placilo = zadnjiPoVrsti(placila, "full");
      if (vrstaZakljucka !== "full" && !poravnava) poravnava = zadnjiPoVrsti(poravnave, vrstaZakljucka);
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
        barva: metaZakljucka.barva || "#299b63", rgb: metaZakljucka.rgb || "41,155,99",
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
    ukrepi = Array.isArray(ukrepi) ? ukrepi : [];
    placila = Array.isArray(placila) ? placila : [];
    poravnave = Array.isArray(poravnave) ? poravnave : [];
    var uporabljeni = {};
    var koraki = ukrepi
      .filter(function (u) { return u && u.status === "completed"; })
      .map(function (u) {
        var korak = korakIzUkrepa(u, placila, poravnave);
        if (korak && korak.actionId) uporabljeni[String(korak.actionId)] = true;
        if (korak && korak.financniActionId) uporabljeni[String(korak.financniActionId)] = true;
        return korak;
      })
      .filter(Boolean);

    placila.forEach(function (p) {
      if (!p.action_id || !uporabljeni[String(p.action_id)]) koraki.push(financniKorakIzZapisa(p, "placilo"));
    });
    poravnave.forEach(function (p) {
      if (!p.action_id || !uporabljeni[String(p.action_id)]) koraki.push(financniKorakIzZapisa(p, "poravnava"));
    });

    return koraki.sort(function (a, b) {
      return new Date(a.datumZapisa || a.datum || 0).getTime() - new Date(b.datumZapisa || b.datum || 0).getTime();
    });
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

    placila.sort(function (a, b) { return new Date(a.datum_placila || 0) - new Date(b.datum_placila || 0); });
    poravnave.sort(function (a, b) { return new Date(a.datum_poravnave || 0) - new Date(b.datum_poravnave || 0); });

    var zadnjaPoravnava = poravnave.length ? poravnave[poravnave.length - 1] : null;
    var polnoPlacilo = null;
    for (var i = placila.length - 1; i >= 0; i--) {
      if (placila[i].vrsta === "full") { polnoPlacilo = placila[i]; break; }
    }

    var izidId;
    var datumZakljucka;
    var razlog = null;

    if (zadnjaPoravnava) {
      izidId = zadnjaPoravnava.vrsta;
      datumZakljucka = zadnjaPoravnava.datum_poravnave;
      razlog = zadnjaPoravnava.razlog || null;
    } else if (polnoPlacilo) {
      var predhodni = placila.filter(function (p) { return p !== polnoPlacilo; });
      var imaObrok = predhodni.some(function (p) { return p.vrsta === "installment"; });
      var imaDelno = predhodni.some(function (p) { return p.vrsta === "partial"; });
      izidId = imaObrok ? "installment_completed" : (imaDelno ? "partial_then_full" : "full");
      datumZakljucka = polnoPlacilo.datum_placila;
    } else {
      izidId = "legacy";
      datumZakljucka = zadeva.poravnano_at || null;
    }

    var izid = (Izidi && Izidi.izid(izidId)) || {
      id: izidId, terminalen: true, naslov: "Primer zaključen",
      opis: "Podrobnosti načina zaključka niso na voljo.", razred: "other",
      barva: "#3d7676", rgb: "61,118,118", ikona: "checkCircle", oznakaDatuma: "ZAKLJUČENO",
      financniPrikaz: "neznano", gumb: null,
    };

    var vsotaPlacil = placila.reduce(function (v, p) { return v + (Number(p.znesek) || 0); }, 0);
    var vsotaPoravnav = poravnave.reduce(function (v, p) { return v + (Number(p.znesek) || 0); }, 0);

    var prvotniDolg = Number(zadeva.prvotni_znesek);
    var prejeto = placila.length ? vsotaPlacil : Number(zadeva.placano_skupaj) || 0;
    var nedenarnoPoravnano = poravnave.length ? vsotaPoravnav : Number(zadeva.poravnano_nedenarno) || 0;
    var preostanek = Number(zadeva.preostali_dolg) || 0;

    /* Kar je bilo denarno prejeto PRED nedenarnim zaključkom (za "Več
       informacij" - glavni tok pri kompenzaciji/dobropisu/stornu nikoli ne
       sme kazati te vsote kot "Prejeto"). */
    var prejetoPredZakljuckom = zadnjaPoravnava ? vsotaPlacil : 0;

    return {
      izidId: izidId,
      terminalen: Boolean(izid.terminalen),
      naslov: izid.naslov,
      opis: izid.opis,
      razred: izid.razred,
      barva: izid.barva,
      rgb: izid.rgb,
      ikona: izid.ikona,
      oznakaDatuma: izid.oznakaDatuma,
      financniPrikaz: izid.financniPrikaz,
      datum: datumZakljucka,
      razlog: razlog,
      podjetje: zadeva.ime_dolznika || "Neimenovan dolžnik",
      racun: zadeva.stevilka_racuna || zadeva.opis_dolga || "Brez številke",
      opisDolga: zadeva.opis_dolga || "",
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
        'style="--koncani-accent:' + esc(model.barva) + ';--koncani-rgb:' + esc(model.rgb) + '">' +
        '<div class="koncani-kartica__meta"><span>' + esc(model.oznakaDatuma) + '</span><time class="koncani-kartica__datum">' + esc(formatirajDatum(model.datum)) + '</time></div>' +
        '<div class="koncani-kartica__glavno">' +
          '<span class="koncani-kartica__ikona" aria-hidden="true">' + ikona(model.ikona) + '</span>' +
          '<div class="koncani-kartica__besedilo">' +
            '<h2 class="koncani-kartica__naslov" data-koncani-fit data-fit-min="11">' + esc(model.naslov) + '</h2>' +
            '<p class="koncani-kartica__podjetje" data-koncani-fit data-fit-min="8.5">' + esc(model.podjetje) + '</p>' +
            '<p class="koncani-kartica__racun" data-koncani-fit data-fit-min="8">Račun ' + esc(model.racun) + '</p>' +
          '</div>' +
          '<strong class="koncani-kartica__znesek" data-koncani-fit data-fit-min="12">' + esc(formatirajZnesek(znesekPrimera(model))) + '</strong>' +
        '</div>' +
        '<div class="koncani-kartica__spodaj">' +
          '<div class="koncani-kartica__rezultat">' +
            '<span class="koncani-kartica__rezultat-ikona" aria-hidden="true">' + ikona(model.ikona) + '</span>' +
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
      element.style.fontSize = "";
      var najmanjsa = Number(element.getAttribute("data-fit-min")) || 8;
      var velikost = parseFloat(window.getComputedStyle(element).fontSize) || 14;
      while ((element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) && velikost > najmanjsa) {
        velikost -= 0.5;
        element.style.fontSize = velikost + "px";
      }
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
      return;
    }

    prazno.hidden = true;
    seznam.innerHTML = primeri.map(htmlKartice).join("");
    seznam.hidden = false;
    window.requestAnimationFrame(function () {
      prilagodiBesedilo(seznam);
      var novaKartica = seznam.querySelector(".koncani-kartica.is-newly-completed");
      if (!novaKartica) return;
      var zmanjsanoGibanje = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      novaKartica.scrollIntoView({ behavior: zmanjsanoGibanje ? "auto" : "smooth", block: "center" });
      novaKartica.focus({ preventScroll: true });
      var url = new URL(window.location.href);
      url.searchParams.delete("nov");
      window.history.replaceState(window.history.state || {}, "", url);
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
          : '<strong class="koncani-potek__znesek" data-koncani-fit data-fit-min="9">' + esc(formatirajZnesek(korak.znesek)) + '</strong>';
        return '<article class="koncani-potek__korak koncani-potek__korak--' + esc(korak.razred) + '" ' +
          'style="--potek-accent:' + esc(korak.barva) + ';--potek-rgb:' + esc(korak.rgb) + '">' +
            '<span class="koncani-potek__stevilka" aria-hidden="true">' + (indeks + 1) + '</span>' +
            '<span class="koncani-potek__ikona" aria-hidden="true">' + ikona(korak.ikona) + '</span>' +
            '<span class="koncani-potek__besedilo">' +
              '<strong data-koncani-fit data-fit-min="9">' + esc(korak.naslov) + '</strong>' +
              '<small data-koncani-fit data-fit-min="7.5">' + esc((indeks + 1) + ". korak · " + formatirajDatumKoraka(korak.datum)) + '</small>' +
              '<small class="koncani-potek__opis" data-koncani-fit data-fit-min="7.5">' + esc(korak.podrobnost || "Korak je bil uspešno izveden.") + '</small>' +
            '</span>' +
            vrednost +
          '</article>';
      }).join("") + '</div>' +
    '</section>';
  }

  var DOKUMENT_NASLOV = {
    placano: "Potrdilo o plačilu", delno: "Račun", obrok: "Račun",
    kompenzacija: "Potrdilo o kompenzaciji", dobropis: "Dobropis", storno: "Dobropis",
  };

  function pripraviDokumente(model) {
    var preostanek = Math.max(0, Number(model && model.zneski && model.zneski.prvotniDolg) || 0);
    return ((model && model.potekResitve) || []).filter(function (korak) {
      return korak && korak.znesek != null && Number.isFinite(Number(korak.znesek));
    }).map(function (korak, indeks) {
      var pred = preostanek;
      var znesek = Math.max(0, Number(korak.znesek) || 0);
      var po = Math.max(0, pred - znesek);
      preostanek = po;
      return {
        naslov: DOKUMENT_NASLOV[korak.razred] || "Dokument",
        stevilka: String(model.racun || "—") + "/" + (indeks + 1),
        datum: korak.datum,
        korakNaslov: korak.naslov,
        znesek: znesek,
        pred: pred,
        po: po,
        razred: korak.razred,
      };
    });
  }

  function htmlProdajalecKompaktno() {
    var p = state.prodajalec;
    if (!p) return '<span class="koncani-dokument__namig">Podatki podjetja še niso nastavljeni.</span>';
    return '<b>' + esc(p.imePodjetja || "") + '</b>' +
      (p.naslov ? '<br>' + esc(p.naslov) : '') +
      (p.mesto ? ', ' + esc(p.mesto) : '');
  }

  function htmlPredogledDokumentov(primer) {
    var dokumenti = pripraviDokumente(primer.model);
    if (!dokumenti.length) return "";
    var indeks = Math.min(Math.max(0, Number(state.aktivenDokument) || 0), dokumenti.length - 1);
    var dok = dokumenti[indeks];
    var zavihki = dokumenti.length > 1
      ? '<div class="koncani-dokumenti__zavihki" data-koncani-dokument-drsnik>' + dokumenti.map(function (dokument, i) {
          return '<button type="button" class="koncani-dokumenti__zavihek' + (i === indeks ? ' is-selected' : '') + '" data-koncani-dokument="' + i + '" aria-pressed="' + String(i === indeks) + '" data-koncani-fit data-fit-min="8">' + (i + 1) + '. ' + esc(dokument.naslov.toLowerCase()) + '</button>';
        }).join("") + '</div>' +
        '<div class="koncani-dokumenti__pikice" aria-label="Izbira dokumenta">' + dokumenti.map(function (dokument, i) {
          return '<button type="button" class="koncani-dokumenti__pikica' + (i === indeks ? ' is-selected' : '') + '" data-koncani-dokument="' + i + '" aria-label="Prikaži ' + (i + 1) + '. ' + esc(dokument.naslov.toLowerCase()) + '" aria-pressed="' + String(i === indeks) + '"><span aria-hidden="true"></span></button>';
        }).join("") + '</div>'
      : "";
    return '<section class="koncani-dokumenti" aria-label="Predogled računov">' +
      '<div class="koncani-dokumenti__glava">' +
        '<span class="koncani-dokumenti__ikona" aria-hidden="true">' + ikona("receiptCheck") + '</span>' +
        '<strong>Predogled računov</strong>' +
        '<span class="koncani-dokumenti__stevec" aria-label="' + dokumenti.length + ' dokumentov">' + dokumenti.length + '</span>' +
      '</div>' +
      '<div class="koncani-dokumenti__telo">' + zavihki +
        '<div class="koncani-dokument">' +
          '<div class="koncani-dokument__vrstica"><span>' + htmlProdajalecKompaktno() + '</span><span class="koncani-dokument__desno"><b>' + esc(dok.naslov) + '</b><br>št. ' + esc(dok.stevilka) + '<br>Datum: ' + esc(formatirajDatumInUro(dok.datum)) + '</span></div>' +
          '<div class="koncani-dokument__postavke">' +
            '<div class="koncani-dokument__vrstica"><span>Znesek pred korakom</span><span>' + esc(formatirajZnesek(dok.pred)) + '</span></div>' +
            '<div class="koncani-dokument__vrstica koncani-dokument__vrstica--' + esc(dok.razred) + '"><span>' + esc(dok.korakNaslov) + '</span><span>−' + esc(formatirajZnesek(dok.znesek)) + '</span></div>' +
          '</div>' +
          '<div class="koncani-dokument__skupaj"><span>' + (dok.po <= 0 ? 'Za plačilo' : 'Preostanek') + '</span><span>' + esc(formatirajZnesek(dok.po)) + '</span></div>' +
          '<button type="button" class="koncani-dokument__odpri" data-koncani-dokument-odpri="' + indeks + '">Preglej celoten račun</button>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function htmlPolniDokument(primer, indeks) {
    var dokumenti = pripraviDokumente(primer.model);
    var dok = dokumenti[Math.min(Math.max(0, Number(indeks) || 0), Math.max(0, dokumenti.length - 1))];
    if (!dok) return '<p>Dokument ni na voljo.</p>';
    var p = state.prodajalec;
    var prodajalec = p
      ? '<b>' + esc(p.imePodjetja || "") + '</b><br>' + esc(p.naslov || "") +
        (p.posta || p.mesto ? '<br>' + esc((p.posta || "") + " " + (p.mesto || "")) : "") +
        (p.davcnaStevilka ? '<br>DŠ: ' + esc(p.davcnaStevilka) : "") +
        (p.iban ? '<br>IBAN: ' + esc(p.iban) : "")
      : 'Podatki podjetja še niso nastavljeni.';
    return '<section class="koncani-pdf-pogled" aria-label="Celoten predogled dokumenta">' +
      '<button type="button" class="koncani-pdf-pogled__nazaj" data-koncani-dokument-nazaj>' +
        '<span aria-hidden="true">' + ikona("chevron") + '</span><strong>Nazaj na podrobnosti</strong>' +
      '</button>' +
      '<div class="koncani-pdf-pogled__oznaka">PDF PREDOGLED</div>' +
      '<article class="koncani-pdf" role="document" aria-label="' + esc(dok.naslov + " " + dok.stevilka) + '">' +
        '<div class="koncani-pdf__glava"><div>' + prodajalec + '</div><div class="koncani-pdf__glava-desno"><b>' + esc(dok.naslov) + ' št. ' + esc(dok.stevilka) + '</b><br>Izdano: ' + esc(formatirajDatumInUro(dok.datum)) + '</div></div>' +
        '<div class="koncani-pdf__kupec"><b>Kupec:</b> ' + esc(primer.model.podjetje) + (primer.model.opisDolga ? '<br>Opis: ' + esc(primer.model.opisDolga) : '') + '</div>' +
        '<table class="koncani-pdf__tabela"><thead><tr><th>Postavka</th><th>Znesek</th></tr></thead><tbody>' +
          '<tr><td>Znesek pred korakom</td><td>' + esc(formatirajZnesek(dok.pred)) + '</td></tr>' +
          '<tr><td>' + esc(dok.korakNaslov) + ' · ' + esc(formatirajDatumInUro(dok.datum)) + '</td><td>−' + esc(formatirajZnesek(dok.znesek)) + '</td></tr>' +
        '</tbody></table>' +
        '<div class="koncani-pdf__skupaj"><span>' + (dok.po <= 0 ? 'Za plačilo' : 'Preostanek') + '</span><span>' + esc(formatirajZnesek(dok.po)) + '</span></div>' +
      '</article>' +
      '<p class="koncani-pdf-pogled__opomba">Predogled dokumenta. Prava izdaja PDF bo prikazana tukaj, ko bo račun izdan v koraku poravnave.</p>' +
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
        '<strong data-koncani-fit data-fit-min="9">' + esc(vrednost) + '</strong>' +
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
      '<div class="koncani-izid" style="--koncani-accent:' + esc(model.barva) + ';--koncani-rgb:' + esc(model.rgb) + '">' +
        '<div class="koncani-izid__glava">' +
          '<div class="koncani-izid__naslovna">' +
            '<span class="koncani-izid__ikona" aria-hidden="true">' + ikona(model.ikona) + '</span>' +
            '<h3 class="koncani-izid__naslov" data-koncani-fit data-fit-min="10">' + esc(model.naslov) + '</h3>' +
          '</div>' +
          '<div class="koncani-izid__datum-okvir">' +
            '<span class="koncani-izid__oznaka-datum">' + esc(model.oznakaDatuma) + '</span>' +
            '<time class="koncani-izid__datum" datetime="' + esc(model.datum || "") + '">' +
              esc(datum.glavni) + (datum.leto ? " " + esc(datum.leto) : "") +
            '</time>' +
          '</div>' +
        '</div>' +
        '<p class="koncani-izid__opis" data-koncani-fit data-fit-min="10">' + esc(model.opis) + '</p>' +
      '</div>' +
      htmlPotekResitve(model) +
      htmlPredogledDokumentov(primer) +
      '<div class="koncani-podatki">' +
        htmlKompaktniPodatki(model) +
        '<button type="button" class="koncani-vec-info__gumb" data-koncani-vec-info-preklop aria-expanded="' + String(state.vecInfoOdprto) + '" aria-controls="koncani-vec-info-vsebina">' +
          '<span>Več informacij</span>' +
          '<span class="koncani-vec-info__gumb-ikona' + (state.vecInfoOdprto ? ' is-odprto' : '') + '" aria-hidden="true">' + ikona("chevron") + '</span>' +
        '</button>' +
        '<div class="koncani-vec-info' + (state.vecInfoOdprto ? ' is-odprto' : '') + '" id="koncani-vec-info-vsebina">' +
          '<div class="koncani-vec-info__notranjost">' + htmlVecInfo(model) + '</div>' +
        '</div>' +
      '</div>' +
      '<a class="koncani-odpri-primer" href="izvedba.html?zadevaId=' + esc(primer.id) + '&readonly=1" data-koncani-odpri-primer>' +
        '<span>Odpri celoten primer</span>' +
      '</a>'
    );
  }

  function osveziOdprtePodrobnosti() {
    var primer = state.primeri.find(function (vrednost) { return String(vrednost.id) === String(state.dialogPrimerId); });
    var vsebina = document.querySelector("[data-koncani-podrobnosti-vsebina]");
    if (!primer || !vsebina) return;
    vsebina.innerHTML = state.pregledDokumenta == null
      ? htmlPodrobnosti(primer)
      : htmlPolniDokument(primer, state.pregledDokumenta);
    window.requestAnimationFrame(function () {
      prilagodiBesedilo(vsebina);
      nastaviDokumentniDrsnik(vsebina);
    });
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
    if (!primer || !dialog || !vsebina) return;

    state.dialogPrimerId = primer.id;
    state.vecInfoOdprto = false;
    state.aktivenDokument = 0;
    state.pregledDokumenta = null;
    state.dialogSprozilec = document.activeElement;
    dialog.style.setProperty("--koncani-accent", primer.model.barva);
    dialog.style.setProperty("--koncani-rgb", primer.model.rgb);
    vsebina.innerHTML = htmlPodrobnosti(primer);
    document.body.classList.add("koncani-podrobnosti-odprto", "uj-modal-odprt");
    document.documentElement.classList.add("uj-modal-odprt");
    if (!dialog.open) dialog.showModal();
    window.requestAnimationFrame(function () {
      prilagodiBesedilo(vsebina);
      nastaviDokumentniDrsnik(vsebina);
    });

    if (posodobiUrl !== false) {
      var url = new URL(window.location.href);
      url.searchParams.set("primer", primer.id);
      window.history.pushState({ koncaniPrimer: primer.id }, "", url);
    }
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
    if (vsebina) vsebina.classList.toggle("is-odprto", state.vecInfoOdprto);
    if (ikonaEl) ikonaEl.classList.toggle("is-odprto", state.vecInfoOdprto);
  }

  async function naloziZadeve() {
    var odgovor = await supabaseKlient
      .from("zadeve")
      .select("id,ime_dolznika,opis_dolga,status,stevilka_racuna,prvotni_znesek,placano_skupaj,poravnano_nedenarno,preostali_dolg,poravnano_at,datum_zapadlosti")
      .eq("status", "Rešeno")
      .order("poravnano_at", { ascending: false, nullsFirst: false });
    if (odgovor.error) throw odgovor.error;
    return odgovor.data || [];
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
      var poizvedba = supabaseKlient.from(tabela).select(stolpci).in("zadeva_id", ids.slice(zacetek, zacetek + 60));
      if (dodatniFilter) poizvedba = dodatniFilter(poizvedba);
      var odgovor = await poizvedba;
      if (odgovor.error) throw odgovor.error;
      vsi = vsi.concat(odgovor.data || []);
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

    var placilaVse = await naloziPoDelih("zadeva_placila", "zadeva_id,znesek,vrsta,datum_placila,action_id", ids);
    var poravnaveVse = await naloziPoDelih("zadeva_poravnave", "zadeva_id,vrsta,znesek,datum_poravnave,razlog,action_id", ids);
    var korakiVse = await naloziPoDelih("opomin_koraki", "zadeva_id,step_id,execution_state,sent_at", ids);
    var ukrepiVse = await naloziPoDelih("opomin_ukrepi", "zadeva_id,action_id,step_id,action_type,status,settings,created_at,completed_at", ids);

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

  function poveziDogodke() {
    document.addEventListener("click", function (event) {
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
        osveziOdprtePodrobnosti();
        return;
      }
      var odpriDokument = event.target.closest("[data-koncani-dokument-odpri]");
      if (odpriDokument) {
        state.pregledDokumenta = Number(odpriDokument.getAttribute("data-koncani-dokument-odpri")) || 0;
        osveziOdprtePodrobnosti();
        return;
      }
      if (event.target.closest("[data-koncani-dokument-nazaj]")) {
        state.pregledDokumenta = null;
        osveziOdprtePodrobnosti();
        return;
      }
      if (event.target.closest("[data-koncani-zapri]")) zapriPodrobnosti(true);
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
      var id = new URL(window.location.href).searchParams.get("primer");
      if (id) odpriPodrobnosti(id, false);
      else zapriPodrobnosti(false);
    });
    window.addEventListener("resize", function () {
      window.requestAnimationFrame(function () { prilagodiBesedilo(document); });
    });
  }

  async function inicializiraj() {
    var koren = document.querySelector("[data-koncani-primeri-root]");
    if (!koren) return;
    var nalaganje = document.querySelector("[data-koncani-nalaganje]");
    var napaka = document.querySelector("[data-koncani-napaka]");
    var stevec = document.querySelector("[data-koncani-stevec]");
    poveziDogodke();

    try {
      if (typeof supabaseKlient === "undefined" || !supabaseKlient || !supabaseKlient.auth) {
        throw new Error("Povezava s podatki ni pripravljena.");
      }
      var seja = await supabaseKlient.auth.getSession();
      if (!seja.data || !seja.data.session) {
        window.location.replace("prijava.html");
        return;
      }

      state.novPrimerId = new URL(window.location.href).searchParams.get("nov");
      var nalozeno = await Promise.all([naloziPrimere(), naloziProdajalca()]);
      state.primeri = nalozeno[0];
      state.prodajalec = nalozeno[1];
      stevec.textContent = String(state.primeri.length);
      stevec.setAttribute("aria-label", state.primeri.length + " končanih primerov");
      stevec.hidden = false;
      nalaganje.hidden = true;
      izrisiSeznam();

      var odprtiId = new URL(window.location.href).searchParams.get("primer");
      if (odprtiId) odpriPodrobnosti(odprtiId, false);
    } catch (err) {
      console.error("Končanih primerov ni bilo mogoče naložiti:", err);
      nalaganje.hidden = true;
      napaka.hidden = false;
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
