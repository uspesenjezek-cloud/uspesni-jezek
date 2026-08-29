/* ==========================================================
   izvedba-komponente.js
   Čisto vizualne render funkcije za produkcijsko stran "Izvedba".
   Brez fixture/localStorage odvisnosti - vse podatke prejme kot
   argumente. Ikone so izločene iz zacasno-obvestila.js/zacasno-global.js
   prototipa (samo SVG, brez simulacijske logike).
   window.UJIzvedbaKomponente
   ========================================================== */
(function (root) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  var IKONE = {
    message: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M8 14v6M16 4v6"/></svg>',
    document: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg>',
    xCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>',
    messageX: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="m9 9 6 6m0-6-6 6"/></svg>',
    stopCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><rect x="8" y="8" width="8" height="8" rx="1" fill="currentColor" stroke="none"/></svg>',
    calendarArrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M16 2v4M8 2v4M3 9h18M12 15h6m-2-2 2 2-2 2"/></svg>',
    coinCheck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9.5" cy="11.5" r="7.5"/><path d="M12.8 7.8a4.3 4.3 0 1 0 0 7.4M6.2 10.1h5.7M6.2 12.8h5.2"/><circle cx="18" cy="17" r="4" fill="white"/><path d="m16.4 17 1.1 1.1 2.2-2.3"/></svg>',
    cardDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="15" height="11" rx="2"/><path d="M3 9h15M7 13h3"/><circle cx="18" cy="17" r="4" fill="white"/><path d="M18 14.8v4.4m-2-2 2 2 2-2"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.34 5.66"/><path d="M20 4v7h-7"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
    scales: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M5 8l-3 6a3 3 0 0 0 6 0zM19 8l-3 6a3 3 0 0 0 6 0zM5 8h14M8 3h8"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    handshake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 1.5"/><circle cx="18" cy="17" r="4" fill="white"/><path d="m16.4 17 1.1 1.1 2.2-2.3"/></svg>',
    coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M16 7.5a5.2 5.2 0 1 0 0 9M6.5 10.2h7M6.5 13h6.4"/></svg>',
    swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h11l-3-3M17 17H6l3 3M18 7l-3 3M6 17l3-3"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13 11 22l-9-9V4a2 2 0 0 1 2-2h9z"/><circle cx="8" cy="8" r="1.5"/></svg>',
    documentX: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6"/><path d="m9 13 6 6m0-6-6 6"/></svg>',
    documentMinus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h9M14 2v6h6v4"/><path d="M8 13h5M8 17h3"/><circle cx="18" cy="18" r="4" fill="white"/><path d="M16 18h4"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    bellOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 18H3s3-2 3-9a6.1 6.1 0 0 1 .29-1.86"/><path d="M10.27 3.18A6 6 0 0 1 18 9c0 2.08.27 3.72.65 4.97"/><path d="m3 3 18 18"/></svg>',
    receiptCheck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6"/><path d="m9 13 2 2 4-4"/></svg>',
    thumbsUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="10" width="7" height="11" rx="3"/><path d="M9 12 13 7.5c.8-.9 1.2-2 1.3-3.2l.1-1.1a2 2 0 0 1 3.9.5c.3 1.8-.1 3.6-.9 5.2L16.8 10H20a2 2 0 0 1 1.9 2.6l-2 6.7A2.5 2.5 0 0 1 17.5 21H9"/></svg>',
  };

  var STANJE_OZNAKE = {
    scheduled: "Načrtovano",
    awaiting_confirmation: "Čaka potrditev",
    ready_to_send: "Pripravljeno",
    processing: "V pošiljanju",
    sent: "Poslano",
    failed: "Napaka",
    paused: "Ustavljeno",
    skipped: "Preskočeno",
    cancelled: "Preklicano",
    handed_over: "Predano",
  };

  var AKCIJE_META = {
    send_reminder: { naslov: "Pošlji opomin", ikona: "message", gumb: "Pošlji opomin zdaj" },
    skip_current_step: { naslov: "Prekliči samo ta korak", ikona: "warning", gumb: "Prekliči ta korak" },
    stop_plan: { naslov: "Ustavi celoten načrt", ikona: "pause", gumb: "Ustavi načrt" },
    handoff_to_lawyer: { naslov: "Posreduj takoj odvetniku", ikona: "scales", gumb: "Pripravi predajo odvetniku" },
    postpone_reminder: { naslov: "Prestavi opomin", ikona: "clock", gumb: "Prestavi opomin" },
    payment_promised: { naslov: "Dolžnik je obljubil plačilo", ikona: "handshake", gumb: "Počakaj {waitDays} dni" },
    partial_payment: { naslov: "Račun je delno poravnan", ikona: "coin", gumb: "Shrani delno plačilo" },
    cancelled_invoice: { naslov: "Račun storniran", ikona: "documentX", gumb: "Potrdi storno računa" },
  };

  function ikona(ime) {
    return IKONE[ime] || IKONE.message;
  }

  function oznakaStanja(state) {
    return STANJE_OZNAKE[state] || state;
  }

  function formatirajEur(znesek) {
    var n = Number(znesek);
    if (!Number.isFinite(n)) return "";
    return n.toLocaleString("sl-SI", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }

  function formatirajDatumUro(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("sl-SI", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  }

  function barvniRazredKoraka(stepIndex) {
    if (Number(stepIndex) >= 10) return "opomin-nacrt__stage--predaja";
    return "opomin-nacrt__stage--eskalacija-" + Math.max(1, Math.min(9, Number(stepIndex) || 1));
  }

  /* Zgornji vodoravni swipe trak korakov. `koraki` = seznam {stepId,
     naslov, stepIndex, executionState, scheduledAt}, vsak vključen korak
     enkrat (agregirano prek kanalov). */
  /* Koraki s temi stanji so dejansko izvedeni - krogec dobi polno barvo in
     kljukico namesto številke, da je na prvi pogled vidno, kaj je opravljeno.
     Namerno izključeni: skipped/cancelled/failed - ti niso bili uspešno
     izvedeni, čeprav so "zaključeni" v smislu, da nanje ni več čakanja. */
  function jeKorakIzveden(executionState) {
    return executionState === "sent" || executionState === "handed_over";
  }

  function izrisiSwipeTrak(koraki, trenutniStepId) {
    if (!koraki.length) return "";
    var kartice = koraki.map(function (k, i) {
      var razred = barvniRazredKoraka(k.stepIndex);
      var izbran = k.stepId === trenutniStepId;
      var izveden = jeKorakIzveden(k.executionState);
      return (
        '<button type="button" class="izvedba-mini-korak ' + razred + (izbran ? " is-current" : "") + (izveden ? " is-done" : "") + '" ' +
        'data-swipe-step="' + esc(k.stepId) + '" aria-current="' + (izbran ? "true" : "false") + '" ' +
        'aria-label="' + esc((i + 1) + " od " + koraki.length + ": " + k.naslov + ", " + oznakaStanja(k.executionState)) + '">' +
        '<span class="izvedba-mini-korak__stevilka" aria-hidden="true">' + (izveden ? "✓" : esc(i + 1)) + "</span>" +
        '<span class="izvedba-mini-korak__naslov" data-izvedba-fit data-fit-min="8">' + esc(k.naslov) + "</span>" +
        '<span class="izvedba-mini-korak__cas">' + esc(formatirajDatumUro(k.scheduledAt)) + "</span>" +
        '<span class="sr-only">' + esc(oznakaStanja(k.executionState)) + "</span>" +
        "</button>" +
        (i < koraki.length - 1
          ? '<span class="izvedba-mini-povezava" aria-hidden="true"></span>'
          : "")
      );
    });
    return '<div class="izvedba-mini-trak" role="list">' + kartice.join("") + "</div>";
  }

  /* Sestavi ID vhodnega kontrolnika za dostopno ime (aria-label na
     +/- gumbih, output z aria-live). */
  function izrisiStevec(actionType, polje, vrednost, enota, prikaz) {
    var idIzhoda = "izv-stevec-" + actionType + "-" + polje;
    var besediloIzhoda = prikaz != null ? prikaz : vrednost + " " + enota;
    return (
      '<div class="izvedba-stevec" data-action-control data-stevec-polje="' + esc(polje) + '">' +
      '<button type="button" class="izvedba-stevec__gumb" data-stevec-korak="-1" aria-label="Zmanjšaj ' + esc(enota) + '">' + ikona("minus") + "</button>" +
      '<output class="izvedba-stevec__izhod" id="' + idIzhoda + '" aria-live="polite">' + esc(besediloIzhoda) + "</output>" +
      '<button type="button" class="izvedba-stevec__gumb" data-stevec-korak="1" aria-label="Povečaj ' + esc(enota) + '">' + ikona("plus") + "</button>" +
      "</div>"
    );
  }

  function izrisiSegmentiranKontrolnik(actionType, polje, opcije, izbrana) {
    var gumbi = opcije.map(function (opcija) {
      var jeIzbrana = opcija.vrednost === izbrana;
      return (
        '<button type="button" class="izvedba-segment__gumb' + (jeIzbrana ? " is-selected" : "") + '" ' +
        'data-action-control data-izvedba-fit data-fit-min="8.5" data-segment-polje="' + esc(polje) + '" data-segment-vrednost="' + esc(opcija.vrednost) + '" ' +
        'aria-pressed="' + (jeIzbrana ? "true" : "false") + '">' + esc(opcija.oznaka) + "</button>"
      );
    });
    return '<div class="izvedba-segment" role="group" aria-label="' + esc(polje) + '">' + gumbi.join("") + "</div>";
  }

  function izrisiZnesekVnos(actionType, polje, vrednost) {
    var idVnosa = "izv-znesek-" + actionType + "-" + polje;
    return (
      '<div class="izvedba-znesek" data-action-control>' +
      '<label class="izvedba-znesek__label" for="' + idVnosa + '">Preostali dolg (€)</label>' +
      '<input class="izvedba-znesek__vnos" id="' + idVnosa + '" data-znesek-polje="' + esc(polje) + '" ' +
      'type="number" inputmode="decimal" step="0.01" min="0" value="' + esc(vrednost != null ? vrednost : "") + '" />' +
      "</div>"
    );
  }

  /* Ena kartica ukrepa. `nastavitveHtml` je notranja vsebina kontrolnikov
     (steber/segment/vnos), ki jo sestavi izvedba.js glede na actionType. */
  function izrisiKartico(actionType, izbran, nastavitveHtml, opozorilo) {
    var meta = AKCIJE_META[actionType] || { naslov: actionType, ikona: "message" };
    var opozoriloHtml = opozorilo
      ? '<p class="izvedba-kartica__opozorilo">' + esc(opozorilo) + "</p>"
      : "";
    return (
      '<button type="button" class="izvedba-kartica' + (izbran ? " is-selected" : "") + '" ' +
      'data-action-type="' + esc(actionType) + '" aria-pressed="' + (izbran ? "true" : "false") + '">' +
      '<span class="izvedba-kartica__kljukica" aria-hidden="true">' + ikona("checkCircle") + "</span>" +
      '<span class="izvedba-kartica__glava">' +
      '<span class="izvedba-kartica__ikona" aria-hidden="true">' + ikona(meta.ikona) + "</span>" +
      '<span class="izvedba-kartica__naslov">' + esc(meta.naslov) + "</span>" +
      "</span>" +
      (nastavitveHtml ? '<span class="izvedba-kartica__nastavitve">' + nastavitveHtml + "</span>" : "") +
      opozoriloHtml +
      "</button>"
    );
  }

  root.UJIzvedbaKomponente = {
    IKONE: IKONE,
    AKCIJE_META: AKCIJE_META,
    ikona: ikona,
    esc: esc,
    oznakaStanja: oznakaStanja,
    formatirajEur: formatirajEur,
    formatirajDatumUro: formatirajDatumUro,
    barvniRazredKoraka: barvniRazredKoraka,
    izrisiSwipeTrak: izrisiSwipeTrak,
    izrisiStevec: izrisiStevec,
    izrisiSegmentiranKontrolnik: izrisiSegmentiranKontrolnik,
    izrisiZnesekVnos: izrisiZnesekVnos,
    izrisiKartico: izrisiKartico,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.UJIzvedbaKomponente;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
