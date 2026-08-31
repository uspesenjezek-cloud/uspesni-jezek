/* ========== Urejevalnik predlog (korak 3 – Načrt opominjanja) ==========
   Poln editor po vzoru modala "Uredi predlogo" na 2. koraku (app.js).
   Ponovno uporablja obstoječe CSS razrede iz app/styles.css.

   Podatkovni sloj je DELJEN z 2. korakom: isti localStorage ključa
   "neplacilo-moji-predlogi" / "neplacilo-predlogi-nastavitve" (+ "-uid").

   API:
     window.inicializirajPredlogiUrejevalnik(ctx) -> { odpri, zapri }
   ctx: { podatkiKorak1, toneId, jezik, potrdiVprasanje, onUporabi, onZaprto,
          rokSheetApi, obrocnoSheetApi, trrSheetApi, pokaziNapako }
   ============================================ */
(function (root) {
  "use strict";

  var KLJUC_MOJI = "neplacilo-moji-predlogi";
  var KLJUC_NASTAVITVE = "neplacilo-predlogi-nastavitve";
  var NAJVEC_STEVILK = 9;

  /* Enaki ikoni kot na koraku 2 (app.js), da so gumbi vizualno enaki. */
  var IKONA_SVINCNIKA =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>';
  var IKONA_KLJUKICE =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

  function kljucZaUid(osnova, uid) {
    return uid ? osnova + "-" + uid : osnova;
  }

  function naloziMojePredloge(uid) {
    try {
      var surovo = localStorage.getItem(kljucZaUid(KLJUC_MOJI, uid));
      var seznam = surovo ? JSON.parse(surovo) : [];
      if (!Array.isArray(seznam)) return [];
      return seznam
        .filter(function (p) {
          return p && typeof p.besedilo === "string" && p.besedilo.trim();
        })
        .map(function (p) {
          return {
            id: String(p.id || "moj-" + Date.now()),
            naslov: String(p.naslov || "Moj predlog"),
            besedilo: String(p.besedilo).slice(0, 1000),
            jeMoj: true,
            toneId: p.toneId || null,
            language: p.language || "de",
            source: "user",
            order: Number(p.order) || null,
            isRecommended: false,
            paymentSettings: p.paymentSettings || null,
            overridesSystemId: p.overridesSystemId || null,
            ikona: p.ikona || "message-circle",
          };
        });
    } catch (_e) {
      return [];
    }
  }

  function shraniMojePredloge(uid, seznam) {
    try {
      localStorage.setItem(
        kljucZaUid(KLJUC_MOJI, uid),
        JSON.stringify(seznam || [])
      );
    } catch (_e) {
      /* prezri (zasebni način) */
    }
  }

  function naloziNastavitve(uid) {
    try {
      var surovo = localStorage.getItem(kljucZaUid(KLJUC_NASTAVITVE, uid));
      var podatki = surovo ? JSON.parse(surovo) : {};
      return {
        stevilke:
          podatki && podatki.stevilke && typeof podatki.stevilke === "object"
            ? podatki.stevilke
            : {},
        skritiIds: Array.isArray(podatki && podatki.skritiIds)
          ? podatki.skritiIds.map(String)
          : [],
      };
    } catch (_e) {
      return { stevilke: {}, skritiIds: [] };
    }
  }

  function shraniNastavitve(uid, nastavitve) {
    try {
      localStorage.setItem(
        kljucZaUid(KLJUC_NASTAVITVE, uid),
        JSON.stringify(nastavitve || { stevilke: {}, skritiIds: [] })
      );
    } catch (_e) {
      /* prezri */
    }
  }

  function najdiProstoStevilko(zasedene, zeliOd) {
    var zacetek = Math.max(1, Math.min(NAJVEC_STEVILK, Number(zeliOd) || 1));
    for (var n = zacetek; n <= NAJVEC_STEVILK; n++) {
      if (!zasedene[n]) return n;
    }
    for (var m = 1; m < zacetek; m++) {
      if (!zasedene[m]) return m;
    }
    return null;
  }

  /* Poenostavljena kopija sestaviSeznamPredlogov (app.js) */
  function sestaviSeznam(mojiPredlogi, vgrajeniPredlogi, nastavitve, tonId, jezik) {
    var skriti = {};
    (nastavitve.skritiIds || []).forEach(function (id) {
      skriti[id] = true;
    });
    var vsi = mojiPredlogi
      .concat(vgrajeniPredlogi)
      .filter(function (p) {
        return !skriti[p.id];
      });
    var filtrirani = window.UJTonPredloge
      ? window.UJTonPredloge.filtrirajPredloge(vsi, tonId, jezik)
      : vsi;
    var zasedene = {};
    filtrirani.forEach(function (p) {
      var z = Number(nastavitve.stevilke[p.id]);
      if (Number.isInteger(z) && z >= 1 && z <= NAJVEC_STEVILK && !zasedene[z]) {
        p.stevilka = z;
        zasedene[z] = true;
      } else {
        p.stevilka = null;
      }
    });
    filtrirani.forEach(function (p, i) {
      if (p.stevilka != null) return;
      var prosta = najdiProstoStevilko(zasedene, Number(p.order) || i + 1);
      p.stevilka = prosta != null ? prosta : i + 1;
      zasedene[p.stevilka] = true;
    });
    filtrirani.sort(function (a, b) {
      return (Number(a.stevilka) || 99) - (Number(b.stevilka) || 99);
    });
    return filtrirani;
  }

  /* ---------- pomožne funkcije za paymentSettings (brez DOM) ---------- */
  function normalizirajPS(raw) {
    if (window.UJPredlogaPaymentSettings && typeof window.UJPredlogaPaymentSettings.normalizirajPaymentSettings === "function") {
      return window.UJPredlogaPaymentSettings.normalizirajPaymentSettings(raw);
    }
    return raw || null;
  }

  function zacetniPaket(toneId) {
    if (window.UJPredlogaPaymentSettings && typeof window.UJPredlogaPaymentSettings.zacetniPaketZaUrejanje === "function") {
      return window.UJPredlogaPaymentSettings.zacetniPaketZaUrejanje(toneId);
    }
    return { version: 1, rok: { enabled: false, mode: "automatic", termDays: 14 }, obrocno: { enabled: false, installmentCount: 4, intervalType: "monthly" }, trr: { enabled: false } };
  }

  function paketIzTona(toneId) {
    if (window.UJPredlogaPaymentSettings && typeof window.UJPredlogaPaymentSettings.paketIzTona === "function") {
      return window.UJPredlogaPaymentSettings.paketIzTona(toneId);
    }
    var p = zacetniPaket(toneId);
    p.rok.enabled = true;
    return p;
  }

  /* ---------- izvoz testljive čiste logike ---------- */
  function izracunajVelikostMreze(obstojeceSteviloPredlog, jeNova) {
    var N = Math.min(NAJVEC_STEVILK, Math.max(1, Number(obstojeceSteviloPredlog) + (jeNova ? 1 : 0)));
    return N;
  }

  function premakniPredlogoPoPrioriteti(ids, premakniId, ciljId, zaCiljem) {
    var rezultat = (Array.isArray(ids) ? ids : []).map(String);
    var izvor = rezultat.indexOf(String(premakniId));
    if (izvor < 0) return rezultat;
    var premaknjeni = rezultat.splice(izvor, 1)[0];
    var cilj = rezultat.indexOf(String(ciljId));
    if (cilj < 0) {
      rezultat.splice(izvor, 0, premaknjeni);
      return rezultat;
    }
    rezultat.splice(cilj + (zaCiljem ? 1 : 0), 0, premaknjeni);
    return rezultat;
  }

  var MODAL_ID = "predlogi-urejevalnik-modal";
  var VSEBINA_ID = "predlogi-urejevalnik-vsebina";
  var FORMA_ID = "predlogi-urejevalnik-forma";

  var _instanca = null;

  function inicializirajPredlogiUrejevalnik(zacetniCtx) {
    if (_instanca) {
      _instanca.posodobiCtx(zacetniCtx);
      return _instanca.api;
    }
    _instanca = ustvariInstanco(zacetniCtx);
    return _instanca.api;
  }

  function ustvariInstanco(ctx) {
    ctx = ctx || {};
    var jezik = ctx.jezik || "de";
    var tonId = ctx.toneId || "friendly";
    var mojUid = null;
    var modal = null;
    var vsebinaEl = null;

    var naloziStanje = {
      mojiPredlogi: [],
      nastavitve: { stevilke: {}, skritiIds: [] },
    };

    function pridobiUidAsync() {
      if (typeof supabaseKlient === "undefined" || !supabaseKlient || !supabaseKlient.auth) {
        return Promise.resolve(null);
      }
      return supabaseKlient.auth
        .getSession()
        .then(function (res) {
          var u =
            res &&
            res.data &&
            res.data.session &&
            res.data.session.user &&
            res.data.session.user.id;
          return u || null;
        })
        .catch(function () {
          return null;
        });
    }

    function osveziPodatke() {
      return pridobiUidAsync().then(function (uid) {
        mojUid = uid;
        naloziStanje.mojiPredlogi = naloziMojePredloge(uid);
        naloziStanje.nastavitve = naloziNastavitve(uid);
      });
    }

    function vgrajeniPredlogi() {
      if (!window.UJTonPredloge || !window.UJTonPredloge.sestaviSistemskePredloge) {
        return [];
      }
      return window.UJTonPredloge.sestaviSistemskePredloge(
        ctx.podatkiKorak1 || {},
        jezik
      );
    }

    function trenutniSeznam() {
      return sestaviSeznam(
        naloziStanje.mojiPredlogi,
        vgrajeniPredlogi(),
        naloziStanje.nastavitve,
        tonId,
        jezik
      );
    }

    function shraniVse() {
      shraniMojePredloge(mojUid, naloziStanje.mojiPredlogi);
      shraniNastavitve(mojUid, naloziStanje.nastavitve);
    }

    function shraniVrstniRedPredlog(ids) {
      var vidniIds = (Array.isArray(ids) ? ids : []).map(String);
      var stevilke = naloziStanje.nastavitve.stevilke || {};
      vidniIds.forEach(function (id) {
        delete stevilke[id];
      });
      vidniIds.forEach(function (id, indeks) {
        if (indeks < NAJVEC_STEVILK) stevilke[id] = indeks + 1;
      });
      naloziStanje.nastavitve.stevilke = stevilke;
      naloziStanje.mojiPredlogi = naloziStanje.mojiPredlogi.map(function (predlog) {
        var indeks = vidniIds.indexOf(String(predlog.id));
        if (indeks >= 0) predlog.order = indeks + 1;
        return predlog;
      });
      shraniVse();
    }

    function animirajPremikKartic(seznamEl, predPremikom) {
      Array.prototype.forEach.call(seznamEl.querySelectorAll(".predlog-kartica"), function (kartica) {
        var prej = predPremikom[kartica.dataset.predlogId];
        if (!prej) return;
        var zdaj = kartica.getBoundingClientRect();
        var dx = prej.left - zdaj.left;
        var dy = prej.top - zdaj.top;
        if (!dx && !dy) return;
        kartica.style.transition = "none";
        kartica.style.transform = "translate(" + dx + "px," + dy + "px)";
        kartica.getBoundingClientRect();
        kartica.style.transition = "transform 190ms cubic-bezier(.2,.8,.2,1)";
        kartica.style.transform = "";
        kartica.addEventListener("transitionend", function pocisti() {
          kartica.style.transition = "";
          kartica.removeEventListener("transitionend", pocisti);
        });
      });
    }

    function pripraviVlecenjePredloge(kartica, seznamEl, predlog, tipkovniRocaj) {
      var stanje = null;
      var DOLGI_PRITISK_MS = 300;

      function pocistiCasovnik() {
        if (!stanje || !stanje.dolgiPritiskCasovnik) return;
        clearTimeout(stanje.dolgiPritiskCasovnik);
        stanje.dolgiPritiskCasovnik = null;
      }

      function zakljuci(event, preklicano) {
        if (!stanje) return;
        var jeAktivno = stanje.aktivno;
        pocistiCasovnik();
        if (stanje.rafId) {
          cancelAnimationFrame(stanje.rafId);
          stanje.rafId = null;
          izrisiVlecenje();
        }
        if (stanje.ghost && stanje.ghost.parentNode) stanje.ghost.parentNode.removeChild(stanje.ghost);
        kartica.classList.remove("predlog-kartica--vlecenje");
        kartica.classList.remove("predlog-kartica--dolg-pritisk");
        document.body.classList.remove("predloga-se-vlece");
        window.removeEventListener("pointermove", premakni);
        window.removeEventListener("pointerup", spusti);
        window.removeEventListener("pointercancel", preklici);
        window.removeEventListener("touchmove", zadrziDotikMedVlecenjem);
        try {
          if (kartica.hasPointerCapture && kartica.hasPointerCapture(stanje.pointerId)) {
            kartica.releasePointerCapture(stanje.pointerId);
          }
        } catch (e) {
          // Kazalec je lahko medtem že prenehal obstajati.
        }
        stanje = null;
        if (!jeAktivno) return;
        if (preklicano) {
          izrisiSeznam();
          return;
        }
        var ids = Array.prototype.map.call(
          seznamEl.querySelectorAll(".predlog-kartica"),
          function (el) { return el.dataset.predlogId; }
        );
        shraniVrstniRedPredlog(ids);
        kartica.dataset.premaknjeno = "true";
        kartica.classList.add("predlog-kartica--spuscena");
        setTimeout(izrisiSeznam, 170);
        if (event) event.preventDefault();
      }

      function zacni(event) {
        if (!stanje || stanje.aktivno) return;
        var rect = kartica.getBoundingClientRect();
        var ghost = kartica.cloneNode(true);
        ghost.className += " predlog-kartica--ghost";
        ghost.removeAttribute("role");
        ghost.setAttribute("aria-hidden", "true");
        ghost.style.width = rect.width + "px";
        ghost.style.height = rect.height + "px";
        ghost.style.left = rect.left + "px";
        ghost.style.top = rect.top + "px";
        document.body.appendChild(ghost);
        stanje.ghost = ghost;
        stanje.aktivno = true;
        stanje.odmikX = event.clientX - rect.left;
        stanje.odmikY = event.clientY - rect.top;
        stanje.ghostZacetniX = rect.left;
        stanje.ghostZacetniY = rect.top;
        ghost.style.setProperty("--predlog-ghost-x", "0px");
        ghost.style.setProperty("--predlog-ghost-y", "0px");
        kartica.classList.add("predlog-kartica--vlecenje");
        document.body.classList.add("predloga-se-vlece");
        try {
          if (kartica.setPointerCapture) kartica.setPointerCapture(stanje.pointerId);
        } catch (e) {
          // Nekateri brskalniki ne dovolijo poznega zajema dotika.
        }
      }

      function zadrziDotikMedVlecenjem(event) {
        if (!stanje || !stanje.aktivno || !event.cancelable) return;
        event.preventDefault();
      }

      function izrisiVlecenje() {
        if (!stanje || !stanje.aktivno || !stanje.ghost) return;
        stanje.rafId = null;
        var x = stanje.zadnjiX;
        var y = stanje.zadnjiY;
        stanje.ghost.style.setProperty(
          "--predlog-ghost-x",
          x - stanje.odmikX - stanje.ghostZacetniX + "px"
        );
        stanje.ghost.style.setProperty(
          "--predlog-ghost-y",
          y - stanje.odmikY - stanje.ghostZacetniY + "px"
        );

        var podKazalcem = document.elementFromPoint(x, y);
        var cilj = podKazalcem && podKazalcem.closest ? podKazalcem.closest(".predlog-kartica") : null;
        if (!cilj || cilj === kartica || cilj.parentNode !== seznamEl) return;
        var ciljRect = cilj.getBoundingClientRect();
        var zaCiljem = y > ciljRect.top + ciljRect.height / 2;
        var pravoMesto = zaCiljem ? cilj.nextSibling : cilj;
        if (pravoMesto === kartica || (zaCiljem && cilj.nextSibling === kartica)) return;
        var prej = {};
        Array.prototype.forEach.call(seznamEl.querySelectorAll(".predlog-kartica"), function (el) {
          prej[el.dataset.predlogId] = el.getBoundingClientRect();
        });
        seznamEl.insertBefore(kartica, pravoMesto);
        animirajPremikKartic(seznamEl, prej);
      }

      function premakni(event) {
        if (!stanje || event.pointerId !== stanje.pointerId) return;
        stanje.zadnjiX = event.clientX;
        stanje.zadnjiY = event.clientY;
        var razdalja = Math.hypot(event.clientX - stanje.zacetniX, event.clientY - stanje.zacetniY);
        if (!stanje.pripravljen) {
          if (razdalja >= 8) zakljuci(event, true);
          return;
        }
        if (!stanje.aktivno && razdalja < 6) return;
        if (!stanje.aktivno) zacni(event);
        event.preventDefault();
        if (!stanje.rafId) stanje.rafId = requestAnimationFrame(izrisiVlecenje);
      }

      function spusti(event) { zakljuci(event, false); }
      function preklici(event) { zakljuci(event, true); }

      kartica.addEventListener("pointerdown", function (event) {
        if (event.button != null && event.button !== 0) return;
        if (event.target.closest(".preview-button, .predlog-gumb--uporabi")) return;
        var zahtevaDolgiPritisk = event.pointerType === "touch" || event.pointerType === "pen";
        stanje = {
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          zacetniX: event.clientX,
          zacetniY: event.clientY,
          zadnjiX: event.clientX,
          zadnjiY: event.clientY,
          pripravljen: !zahtevaDolgiPritisk,
          aktivno: false,
          ghost: null,
          rafId: null,
          dolgiPritiskCasovnik: null,
        };
        if (zahtevaDolgiPritisk) {
          stanje.dolgiPritiskCasovnik = setTimeout(function () {
            if (!stanje || stanje.pointerId !== event.pointerId) return;
            stanje.dolgiPritiskCasovnik = null;
            stanje.pripravljen = true;
            kartica.dataset.premaknjeno = "true";
            kartica.classList.add("predlog-kartica--dolg-pritisk");
            zacni({ clientX: stanje.zadnjiX, clientY: stanje.zadnjiY });
          }, DOLGI_PRITISK_MS);
        }
        window.addEventListener("pointermove", premakni, { passive: false });
        window.addEventListener("pointerup", spusti);
        window.addEventListener("pointercancel", preklici);
        if (zahtevaDolgiPritisk) {
          window.addEventListener("touchmove", zadrziDotikMedVlecenjem, { passive: false });
        }
      });

      tipkovniRocaj.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        var ids = Array.prototype.map.call(
          seznamEl.querySelectorAll(".predlog-kartica"),
          function (el) { return el.dataset.predlogId; }
        );
        var indeks = ids.indexOf(String(predlog.id));
        var noviIndeks = indeks + (event.key === "ArrowUp" ? -1 : 1);
        if (noviIndeks < 0 || noviIndeks >= ids.length) return;
        ids = premakniPredlogoPoPrioriteti(ids, predlog.id, ids[noviIndeks], event.key === "ArrowDown");
        shraniVrstniRedPredlog(ids);
        izrisiSeznam();
        var noviRocaj = seznamEl.querySelector('[data-predlog-id="' + String(predlog.id).replace(/"/g, '\\"') + '"] .predlog-kartica__stevilka');
        if (noviRocaj) noviRocaj.focus();
      });
    }

    function pokaziNapako(msg) {
      if (typeof ctx.pokaziNapako === "function") {
        ctx.pokaziNapako(msg);
      }
    }

    function bazaDatumaPosiljanja() {
      return ctx.bazaDatumaPosiljanja
        ? ctx.bazaDatumaPosiljanja()
        : new Date().toISOString().slice(0, 10);
    }

    // --- Localne spremenljivke za formo (vzorec ustvariInstanco) ---
    var forma = null;
    var formaNaslovVnos = null;
    var formaUrejevalnik = null;
    var formaJezNova = false;
    var formaUrejanId = null;
    var predlogUrejan = null;        // ← delovna kopija (kot odprtPredlog v app.js)
    var modalIzbranaStevilka = 1;
    var recommendationSnapshot = null;
    var modalStevilkeMreza = null;
    var modalStevilkaOvoj = null;
    var modalPredlagajTon = null;
    var modalPredlagajTonHint = null;
    var modalPredlagajTonStanje = null;
    var modalPriporociloVrstica = null;
    var modalPriporociloNaslov = null;
    var modalDodatekRok = null;
    var modalDodatekRokStanje = null;
    var modalDodatekObrocno = null;
    var modalDodatekObrocnoStanje = null;
    var modalDodatekTrr = null;
    var modalDodatekTrrStanje = null;
    var modalNaslovGlava = null;
    var modalShraniGumb = null;
    var modalIzbrisiGumb = null;
    var modalPrekliciGumb = null;
    var izbranaPredlogaZaPremikId = null;

    // --- Sheet draft variables (za sheet callbacks, prekopirano iz app.js) ---
    var predlogaSheetSaved = false;
    var predlogaDraftDeadline = null;
    var predlogaDraftPlan = null;
    var modalDodatkiKlikPavzaDo = 0;
    var modalDodatkiPavzaCasovnik = null;

    function pavzirajKlikeNaModalDodatke(ms) {
      var delay = Number(ms) > 0 ? Number(ms) : 450;
      modalDodatkiKlikPavzaDo = Date.now() + delay;
      if (modal) modal.classList.add("template-editor--sheet-pavza");
      if (modalDodatkiPavzaCasovnik) clearTimeout(modalDodatkiPavzaCasovnik);
      modalDodatkiPavzaCasovnik = setTimeout(function () {
        modalDodatkiPavzaCasovnik = null;
        if (Date.now() >= modalDodatkiKlikPavzaDo && modal) {
          modal.classList.remove("template-editor--sheet-pavza");
        }
      }, delay);
    }

    function modalDodatkiKlikDovoljen() {
      return Date.now() >= modalDodatkiKlikPavzaDo;
    }

    function poZaprtjuSheetaNadPredlogo() {
      pavzirajKlikeNaModalDodatke(450);
      if (modalNaslovGlava && typeof modalNaslovGlava.focus === "function") {
        try { modalNaslovGlava.focus(); } catch (_e) { /* ignore */ }
      }
    }

    function tonZaModalPlacila() {
      return (predlogUrejan && predlogUrejan.toneId) || tonId || "friendly";
    }

    function labelTona(t) {
      var id = String(t || "");
      if (id === "friendly" || id === "very_friendly") return "Prijazen";
      if (id === "firm" || id === "neutral") return "Odločen";
      if (id === "strict" || id === "very_strict") return "Strog";
      return "Predlagani";
    }

    // --- Funkcije kopirane/prilagojene iz app.js ---

    function privzetaStevilkaZaNovPredlog() {
      var seznam = trenutniSeznam();
      var zasedene = {};
      seznam.forEach(function (p) {
        var s = Number(naloziStanje.nastavitve.stevilke[p.id]) || p.stevilka;
        if (s >= 1 && s <= NAJVEC_STEVILK) zasedene[s] = true;
      });
      return najdiProstoStevilko(zasedene, 1) || 1;
    }

    function posodobiModalStevilkeUI() {
      if (!modalStevilkeMreza) return;
      var gumbi = modalStevilkeMreza.querySelectorAll(".korak2-modal__stevilka-izbira");
      for (var i = 0; i < gumbi.length; i++) {
        var n = Number(gumbi[i].dataset.stevilka);
        gumbi[i].setAttribute("aria-selected", n === modalIzbranaStevilka ? "true" : "false");
      }
    }

    function pripraviModalStevilke() {
      if (!modalStevilkeMreza) return;
      var seznam = trenutniSeznam();
      var velikost = izracunajVelikostMreze(seznam.length, !!(predlogUrejan && predlogUrejan.jeNov));
      modalStevilkeMreza.replaceChildren();
      for (var n = 1; n <= velikost; n++) {
        var gumb = document.createElement("button");
        gumb.type = "button";
        gumb.className = "korak2-modal__stevilka-izbira" + (n === 1 ? " korak2-modal__stevilka-izbira--prioriteta" : "");
        gumb.dataset.stevilka = String(n);
        gumb.setAttribute("role", "option");
        gumb.textContent = n === 1 ? "★ " + n : String(n);
        gumb.addEventListener("click", (function (stev) {
          return function () {
            modalIzbranaStevilka = stev;
            posodobiModalStevilkeUI();
            skrijPriporociloVrstico();
          };
        })(n));
        modalStevilkeMreza.appendChild(gumb);
      }
    }

    function posodobiModalDodatkeKartice() {
      var p = normalizirajPS(
        predlogUrejan && predlogUrejan.paymentSettings
      ) || zacetniPaket(tonZaModalPlacila());

      if (modalDodatekRok) {
        modalDodatekRok.setAttribute("aria-pressed", p.rok.enabled ? "true" : "false");
        modalDodatekRok.setAttribute(
          "aria-label",
          "Nastavi rok plačila. Trenutno: " + (p.rok.enabled ? "Vklopljeno" : "Izklopljeno")
        );
      }
      if (modalDodatekRokStanje) {
        modalDodatekRokStanje.textContent = p.rok.enabled ? "Vklopljeno" : "Izklopljeno";
      }
      if (modalDodatekObrocno) {
        modalDodatekObrocno.setAttribute("aria-pressed", p.obrocno.enabled ? "true" : "false");
        modalDodatekObrocno.setAttribute(
          "aria-label",
          "Nastavi obročno ali delno plačilo. Trenutno: " + (p.obrocno.enabled ? "Vklopljeno" : "Izklopljeno")
        );
      }
      if (modalDodatekObrocnoStanje) {
        modalDodatekObrocnoStanje.textContent = p.obrocno.enabled ? "Vklopljeno" : "Izklopljeno";
      }
      if (modalDodatekTrr) {
        modalDodatekTrr.setAttribute("aria-pressed", p.trr.enabled ? "true" : "false");
        modalDodatekTrr.setAttribute(
          "aria-label",
          "Nastavi TRR. Trenutno: " + (p.trr.enabled ? "Vklopljeno" : "Izklopljeno")
        );
      }
      if (modalDodatekTrrStanje) {
        if (!p.trr.enabled) {
          modalDodatekTrrStanje.textContent = "Izklopljeno";
        } else {
          var podatki = ctx.podatkiKorak1 || {};
          var iban = (podatki.iban || "").trim();
          var konec = iban ? iban.slice(-4) : "";
          modalDodatekTrrStanje.textContent = konec ? "Privzeti • …" + konec : "Privzeti";
        }
      }
    }

    function posodobiPredlagajTonGumb() {
      var imaBesedilo = Boolean(formaUrejevalnik && formaUrejevalnik.value.trim());
      if (modalPredlagajTon) modalPredlagajTon.disabled = !imaBesedilo;
      if (modalPredlagajTonHint) modalPredlagajTonHint.hidden = imaBesedilo;
    }

    function skrijPriporociloVrstico() {
      recommendationSnapshot = null;
      if (modalPriporociloVrstica) modalPriporociloVrstica.hidden = true;
      if (modalPredlagajTon) modalPredlagajTon.hidden = false;
      if (modalPredlagajTonStanje) {
        modalPredlagajTonStanje.textContent = "Uporabi priporočilo";
      }
    }

    function posnetekTrenutnegaOsnutka() {
      return {
        naslov: (formaNaslovVnos && formaNaslovVnos.value) || "",
        besedilo: (formaUrejevalnik && formaUrejevalnik.value) || "",
        stevilka: modalIzbranaStevilka,
        toneId: (predlogUrejan && predlogUrejan.toneId) || null,
        paymentSettings: normalizirajPS(
          predlogUrejan && predlogUrejan.paymentSettings
        ),
      };
    }

    function napolniUiIzPosnetka(snap) {
      if (!snap || !predlogUrejan) return;
      if (formaNaslovVnos) formaNaslovVnos.value = snap.naslov || "";
      if (formaUrejevalnik) formaUrejevalnik.value = snap.besedilo || "";
      modalIzbranaStevilka = Number(snap.stevilka) || 1;
      predlogUrejan.toneId = snap.toneId || predlogUrejan.toneId;
      predlogUrejan.paymentSettings =
        normalizirajPS(snap.paymentSettings) || zacetniPaket(tonZaModalPlacila());
      posodobiModalStevilkeUI();
      posodobiModalDodatkeKartice();
      posodobiPredlagajTonGumb();
    }

    function predlagajTonZaPredlogo() {
      if (!predlogUrejan || !formaUrejevalnik) return;
      var besedilo = formaUrejevalnik.value.trim();
      if (!besedilo) {
        posodobiPredlagajTonGumb();
        if (modalPredlagajTonHint) modalPredlagajTonHint.hidden = false;
        return;
      }
      recommendationSnapshot = posnetekTrenutnegaOsnutka();

      var recToneId = tonZaModalPlacila();
      if (window.UJTonPriporocilo && typeof window.UJTonPriporocilo.getRecommendedTone === "function") {
        var rec = window.UJTonPriporocilo.getRecommendedTone({
          originalDueDate: (ctx.podatkiKorak1 || {}).datumZapadlosti || null,
          totalDebtCents: null,
          evaluationDate: bazaDatumaPosiljanja(),
        });
        if (rec && rec.recommendedToneId) recToneId = rec.recommendedToneId;
      }
      predlogUrejan.toneId = recToneId;

      var paket = null;
      if (window.UJPredlogaPaymentSettings && typeof window.UJPredlogaPaymentSettings.paketIzTona === "function") {
        paket = window.UJPredlogaPaymentSettings.paketIzTona(recToneId);
      }
      if (!paket) {
        paket = zacetniPaket(recToneId);
        paket.rok.enabled = true;
      }
      paket.trr = { enabled: true };
      predlogUrejan.paymentSettings = paket;

      if (window.UJRokPlacila && typeof window.UJRokPlacila.stevilkaZaTon === "function") {
        var n = Number(window.UJRokPlacila.stevilkaZaTon(recToneId));
        if (n >= 1 && n <= NAJVEC_STEVILK) modalIzbranaStevilka = n;
      } else if (recToneId === "friendly" || recToneId === "very_friendly") {
        modalIzbranaStevilka = 1;
      } else if (recToneId === "firm" || recToneId === "neutral") {
        modalIzbranaStevilka = 5;
      } else {
        modalIzbranaStevilka = 8;
      }

      posodobiModalStevilkeUI();
      posodobiModalDodatkeKartice();
      if (modalPriporociloNaslov) {
        modalPriporociloNaslov.textContent = labelTona(recToneId);
      }
      if (modalPredlagajTonStanje) {
        modalPredlagajTonStanje.textContent = "✓ Priporočilo uporabljeno";
      }
      if (modalPriporociloVrstica) modalPriporociloVrstica.hidden = false;
    }

    function razveljaviPriporociloTona() {
      if (!recommendationSnapshot) return;
      napolniUiIzPosnetka(recommendationSnapshot);
      skrijPriporociloVrstico();
    }

    // --- Sheet odpiranje (prilagojeno za ctx API-je) ---

    function odpriModalDodatekRok() {
      if (!modalDodatkiKlikDovoljen()) return;
      var rokApi = ctx.rokSheetApi;
      if (!rokApi || typeof rokApi.odpri !== "function") {
        pokaziNapako("Nastavitve roka plačila se niso naložile. Osvežite stran (Ctrl+F5).");
        return;
      }
      var p = normalizirajPS(predlogUrejan && predlogUrejan.paymentSettings) || zacetniPaket(tonZaModalPlacila());
      var days = Number(p.rok.termDays) || 14;
      var base = bazaDatumaPosiljanja();

      window.setTimeout(function () {
        if (!document.body.classList.contains("template-editor-odprt")) return;
        rokApi.odpri({
          termDays: days,
          toneId: tonZaModalPlacila(),
          onClose: function () {
            // Preberi paymentDeadline iz step-3 globala (prek getterja v ctx)
            var pd = ctx.getPaymentDeadline ? ctx.getPaymentDeadline() : null;
            if (pd && pd.enabled) {
              predlogUrejan.paymentSettings = normalizirajPS({
                version: 1,
                rok: { enabled: true, mode: "automatic", termDays: Number(pd.termDays) || days },
                obrocno: { enabled: false, installmentCount: 4, intervalType: "monthly" },
                trr: { enabled: ((predlogUrejan.paymentSettings && predlogUrejan.paymentSettings.trr) || {}).enabled || false },
              });
              skrijPriporociloVrstico();
              posodobiModalDodatkeKartice();
            } else if (pd) {
              // Rok je izklopljen v paymentDeadline
              var cur = predlogUrejan.paymentSettings || zacetniPaket(tonZaModalPlacila());
              cur.rok.enabled = false;
              predlogUrejan.paymentSettings = normalizirajPS(cur);
              posodobiModalDodatkeKartice();
            }
            predlogaSheetSaved = false;
            predlogaDraftDeadline = null;
            poZaprtjuSheetaNadPredlogo();
          },
        });
      }, 0);
    }

    function odpriModalDodatekObrocno() {
      if (!modalDodatkiKlikDovoljen()) return;
      var obApi = ctx.obrocnoSheetApi;
      if (!obApi || typeof obApi.odpri !== "function") {
        pokaziNapako("Nastavitve obročnega ali delnega plačila se niso naložile. Osvežite stran (Ctrl+F5).");
        return;
      }
      var p = normalizirajPS(predlogUrejan && predlogUrejan.paymentSettings) || zacetniPaket(tonZaModalPlacila());
      var totalZaPredlogo = 10000;
      if (window.UJObrocno) {
        var x = window.UJObrocno.eurosToCents((ctx.podatkiKorak1 || {}).znesek);
        if (x != null && x > 0) totalZaPredlogo = x;
      }

      window.setTimeout(function () {
        if (!document.body.classList.contains("template-editor-odprt")) return;
        obApi.odpri({
          toneId: tonZaModalPlacila(),
          predlogaNacin: true,
          totalDebtCents: totalZaPredlogo,
          zacetnoEnabled: Boolean(p.obrocno && p.obrocno.enabled),
          zacetnoStevilo: p.obrocno && p.obrocno.enabled ? Number(p.obrocno.installmentCount) || 2 : null,
          zacetnoInterval: p.obrocno && p.obrocno.enabled ? p.obrocno.intervalType || "monthly" : null,
          onClose: function () {
            // Preberi installmentPlan iz step-3 globala (prek getterja v ctx)
            var ip = ctx.getInstallmentPlan ? ctx.getInstallmentPlan() : null;
            if (ip && ip.enabled) {
              predlogUrejan.paymentSettings = normalizirajPS({
                version: 1,
                rok: { enabled: false, mode: "automatic", termDays: 14 },
                obrocno: {
                  enabled: true,
                  installmentCount: Number(ip.installmentCount) || (ip.installments && ip.installments.length) || 2,
                  intervalType: ip.intervalType || "monthly",
                },
                trr: { enabled: ((predlogUrejan.paymentSettings && predlogUrejan.paymentSettings.trr) || {}).enabled || false },
              });
              skrijPriporociloVrstico();
              posodobiModalDodatkeKartice();
            } else if (ip) {
              var cur = predlogUrejan.paymentSettings || zacetniPaket(tonZaModalPlacila());
              cur.obrocno.enabled = false;
              predlogUrejan.paymentSettings = normalizirajPS(cur);
              posodobiModalDodatkeKartice();
            }
            predlogaSheetSaved = false;
            predlogaDraftPlan = null;
            poZaprtjuSheetaNadPredlogo();
          },
        });
      }, 0);
    }

    function odpriModalDodatekTrr() {
      if (!modalDodatkiKlikDovoljen()) return;
      var trrApi = ctx.trrSheetApi;
      if (!trrApi || typeof trrApi.odpri !== "function") {
        pokaziNapako("Nastavitve TRR se niso naložile. Osvežite stran (Ctrl+F5).");
        return;
      }
      trrApi.odpri({
        onClose: function () {
          // Preberi trrAccount iz step-3 globala (prek getterja v ctx)
          var ta = ctx.getTrrAccount ? ctx.getTrrAccount() : null;
          if (predlogUrejan) {
            var cur = normalizirajPS(predlogUrejan.paymentSettings) || zacetniPaket(tonZaModalPlacila());
            var trrEnabled = Boolean(ta && ta.accountId);
            predlogUrejan.paymentSettings = normalizirajPS({
              version: 1,
              rok: cur.rok,
              obrocno: cur.obrocno,
              trr: { enabled: trrEnabled },
            });
            if (trrEnabled) skrijPriporociloVrstico();
          }
          posodobiModalDodatkeKartice();
          poZaprtjuSheetaNadPredlogo();
        },
      });
    }

    // --- Obstoječe funkcije ---

    function zapri() {
      if (!modal) return;
      izbranaPredlogaZaPremikId = null;
      prikaziSeznamView();
      modal.hidden = true;
      document.body.classList.remove("template-editor-odprt");
      if (typeof ctx.onZaprto === "function") ctx.onZaprto();
    }

    function izrisiSeznam() {
      if (!vsebinaEl) return;
      var seznam = trenutniSeznam();
      var stariSeznam = document.getElementById("predlogi-urejevalnik-seznam");
      var navodilo = document.getElementById("predlogi-urejevalnik-razporejanje-navodilo");
      if (!stariSeznam) return;

      stariSeznam.innerHTML = "";
      stariSeznam.classList.toggle("predlog-kartica__seznam--izbira-mesta", Boolean(izbranaPredlogaZaPremikId));
      if (navodilo) {
        navodilo.textContent = izbranaPredlogaZaPremikId
          ? "Zdaj kliknite kartico na mestu, kamor jo želite premakniti."
          : "Kartico za trenutek pridržite in jo povlecite. Kratek poteg še vedno normalno pomika seznam.";
        navodilo.classList.toggle("template-editor__razporejanje-navodilo--aktivno", Boolean(izbranaPredlogaZaPremikId));
      }
      if (!seznam.length) {
        var prazno = document.createElement("p");
        prazno.className = "template-editor__hint";
        prazno.textContent = "Ni predlog za ta ton.";
        stariSeznam.appendChild(prazno);
        return;
      }

      seznam.forEach(function (predlog) {
        var kartica = document.createElement("div");
        kartica.className = "predlog-kartica" +
          (predlog.stevilka === 1 ? " predlog-kartica--prioriteta" : "") +
          (String(predlog.id) === String(izbranaPredlogaZaPremikId) ? " predlog-kartica--izbrana-za-premik" : "");
        kartica.setAttribute("role", "listitem");
        kartica.dataset.predlogId = String(predlog.id);

        var stOvoj = document.createElement("span");
        stOvoj.className = "predlog-kartica__stevilka-ovoj";
        var stGumb = document.createElement("button");
        stGumb.type = "button";
        stGumb.className = "predlog-kartica__stevilka" +
          (predlog.stevilka === 1 ? " predlog-kartica__stevilka--prioriteta" : "");
        stGumb.setAttribute(
          "aria-label",
          "Premaknite predlogo in spremenite prioriteto (trenutno " + predlog.stevilka + ")"
        );
        stGumb.setAttribute("title", "Povlecite kartico za spremembo prioritete");
        stGumb.textContent = predlog.stevilka === 1 ? "★ " + predlog.stevilka : String(predlog.stevilka);
        stOvoj.appendChild(stGumb);

        var naslov = document.createElement("span");
        naslov.className = "predlog-kartica__naslov";
        naslov.textContent = predlog.naslov;

        var opis = document.createElement("span");
        opis.className = "predlog-kartica__opis";
        opis.textContent = predlog.besedilo;
        opis.setAttribute("title", predlog.besedilo);

        var akcije = document.createElement("span");
        akcije.className = "predlog-kartica__akcije";

        var uredi = document.createElement("button");
        uredi.type = "button";
        uredi.className = "preview-button";
        uredi.innerHTML = IKONA_SVINCNIKA + "<span>Uredi</span>";
        uredi.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          odpriFormo(predlog);
        });

        var uporabi = document.createElement("button");
        uporabi.type = "button";
        uporabi.className = "predlog-gumb predlog-gumb--uporabi";
        uporabi.innerHTML = IKONA_KLJUKICE + "Uporabi";
        uporabi.addEventListener("click", function (event) {
          event.stopPropagation();
          if (typeof ctx.onUporabi === "function") {
            ctx.onUporabi(predlog);
          }
          zapri();
        });

        akcije.appendChild(uporabi);

        kartica.appendChild(stOvoj);
        kartica.appendChild(naslov);
        kartica.appendChild(opis);
        kartica.appendChild(uredi);
        kartica.appendChild(akcije);
        stariSeznam.appendChild(kartica);
        pripraviVlecenjePredloge(kartica, stariSeznam, predlog, stGumb);
        kartica.addEventListener("click", function (event) {
          if (event.target.closest(".preview-button, .predlog-gumb--uporabi")) return;
          if (kartica.dataset.premaknjeno === "true") {
            delete kartica.dataset.premaknjeno;
            return;
          }
          if (!izbranaPredlogaZaPremikId) {
            izbranaPredlogaZaPremikId = String(predlog.id);
            izrisiSeznam();
            return;
          }
          if (String(izbranaPredlogaZaPremikId) === String(predlog.id)) {
            izbranaPredlogaZaPremikId = null;
            izrisiSeznam();
            return;
          }

          var ids = Array.prototype.map.call(
            stariSeznam.querySelectorAll(".predlog-kartica"),
            function (el) { return el.dataset.predlogId; }
          );
          var noviIds = premakniPredlogoPoPrioriteti(
            ids,
            izbranaPredlogaZaPremikId,
            predlog.id,
            ids.indexOf(String(izbranaPredlogaZaPremikId)) < ids.indexOf(String(predlog.id))
          );
          var prej = {};
          Array.prototype.forEach.call(stariSeznam.querySelectorAll(".predlog-kartica"), function (el) {
            prej[el.dataset.predlogId] = el.getBoundingClientRect();
          });
          noviIds.forEach(function (id) {
            var el = stariSeznam.querySelector('[data-predlog-id="' + String(id).replace(/"/g, '\\"') + '"]');
            if (el) stariSeznam.appendChild(el);
          });
          var premaknjena = stariSeznam.querySelector('[data-predlog-id="' + String(izbranaPredlogaZaPremikId).replace(/"/g, '\\"') + '"]');
          izbranaPredlogaZaPremikId = null;
          shraniVrstniRedPredlog(noviIds);
          animirajPremikKartic(stariSeznam, prej);
          stariSeznam.classList.remove("predlog-kartica__seznam--izbira-mesta");
          if (premaknjena) premaknjena.classList.add("predlog-kartica--spuscena");
          if (navodilo) {
            navodilo.textContent = "Razpored je shranjen. Kliknite kartico za nov premik.";
            navodilo.classList.remove("template-editor__razporejanje-navodilo--aktivno");
          }
          setTimeout(izrisiSeznam, 210);
        });
      });
    }

    function zamenjajStevilko(predlog) {
      var ovoj = document.createElement("div");
      ovoj.className = "predlog-kartica__stevilke-mreza";
      ovoj.style.gridColumn = "1 / -1";
      ovoj.style.padding = "10px 12px";
      for (var n = 1; n <= NAJVEC_STEVILK; n++) {
        var gumb = document.createElement("button");
        gumb.type = "button";
        gumb.className = "predlog-kartica__stevilka-izbira" +
          (n === 1 ? " predlog-kartica__stevilka-izbira--prioriteta" : "");
        gumb.setAttribute("role", "option");
        gumb.setAttribute("aria-selected", String(predlog.stevilka === n));
        gumb.textContent = n === 1 ? "★ " + n : String(n);
        gumb.addEventListener("click", (function (stev) {
          return function () {
            naloziStanje.nastavitve.stevilke[predlog.id] = stev;
            naloziStanje.nastavitve.stevilke = naloziStanje.nastavitve.stevilke || {};
            shraniVse();
            izrisiSeznam();
          };
        })(n));
        ovoj.appendChild(gumb);
      }
      var kartica = ovoj.closest ? ovoj.closest(".predlog-kartica") : null;
      if (kartica) {
        ovoj.style.gridColumn = "1 / -1";
        kartica.appendChild(ovoj);
      } else {
        izrisiSeznam();
      }
    }

    function prikaziSeznamView() {
      var seznamEl = document.getElementById("predlogi-urejevalnik-seznam");
      var novaEl = document.getElementById("predlogi-urejevalnik-nova");
      if (forma) forma.hidden = true;
      predlogUrejan = null;
      if (seznamEl) seznamEl.hidden = false;
      if (novaEl) novaEl.hidden = false;
      if (vsebinaEl) vsebinaEl.scrollTop = 0;
    }

    function nazajAliZapri() {
      if (forma && !forma.hidden) {
        prikaziSeznamView();
        izrisiSeznam();
        return;
      }
      zapri();
    }

    /* ======== FORMA ======== */

    function odpriFormo(predlog) {
      if (!forma) return;

      // Pogled zamenjaj takoj. Dodatni izračuni spodaj ne smejo preprečiti
      // prikaza obrazca, če vsebuje posamezna stara predloga nepopolne podatke.
      var seznamEl = document.getElementById("predlogi-urejevalnik-seznam");
      var novaEl = document.getElementById("predlogi-urejevalnik-nova");
      if (seznamEl) seznamEl.hidden = true;
      if (novaEl) novaEl.hidden = true;
      forma.hidden = false;
      if (vsebinaEl) vsebinaEl.scrollTop = 0;

      formaJezNova = Boolean(predlog && predlog.jeNova);
      formaUrejanId = predlog && predlog.id ? String(predlog.id) : null;

      var obstojeciPaket = normalizirajPS(predlog && predlog.paymentSettings);
      predlogUrejan = {
        id: (predlog && predlog.id) || null,
        naslov: (predlog && predlog.naslov) || "",
        besedilo: (predlog && predlog.besedilo) || "",
        jeMoj: !!(predlog && predlog.jeMoj),
        jeNov: !!(predlog && predlog.jeNova),
        toneId: (predlog && predlog.toneId) || null,
        paymentSettings: obstojeciPaket || zacetniPaket(tonId),
        ikona: (predlog && predlog.ikona) || "message-circle",
        isRecommended: !!(predlog && predlog.isRecommended),
        overridesSystemId: (predlog && predlog.overridesSystemId) || null,
      };
      recommendationSnapshot = null;
      if (modalPriporociloVrstica) modalPriporociloVrstica.hidden = true;

      if (modalNaslovGlava) {
        modalNaslovGlava.textContent = formaJezNova ? "Nova predloga" : "Uredi predlogo";
      }
      if (formaNaslovVnos) formaNaslovVnos.value = (predlogUrejan.naslov || "").slice(0, 80);
      if (formaUrejevalnik) formaUrejevalnik.value = (predlogUrejan.besedilo || "").slice(0, 1000);
      posodobiPredlagajTonGumb();

      if (modalShraniGumb) {
        modalShraniGumb.textContent = formaJezNova ? "Shrani predlogo" : "Shrani spremembe";
      }
      if (modalIzbrisiGumb) {
        modalIzbrisiGumb.hidden = formaJezNova;
      }
      if (modalPrekliciGumb) {
        modalPrekliciGumb.hidden = !formaJezNova;
      }

      if (modalStevilkaOvoj) modalStevilkaOvoj.hidden = false;
      pripraviModalStevilke();
      if (formaJezNova) {
        modalIzbranaStevilka = privzetaStevilkaZaNovPredlog();
      } else {
        var trenutna = Number(
          (predlog && predlog.stevilka) || naloziStanje.nastavitve.stevilke[(predlog && predlog.id) || ""]
        );
        modalIzbranaStevilka =
          Number.isInteger(trenutna) && trenutna >= 1 && trenutna <= NAJVEC_STEVILK
            ? trenutna
            : privzetaStevilkaZaNovPredlog();
      }
      posodobiModalStevilkeUI();
      posodobiModalDodatkeKartice();

    }

    function shraniFormo() {
      if (!formaUrejevalnik || !predlogUrejan) return;
      var naslov = (formaNaslovVnos ? formaNaslovVnos.value : "").trim().slice(0, 80);
      var besedilo = formaUrejevalnik.value.trim().slice(0, 1000);
      if (!naslov) {
        pokaziNapako("Vnesite ime predloge.");
        if (formaNaslovVnos) { formaNaslovVnos.focus(); }
        return;
      }
      if (!besedilo) {
        pokaziNapako("Vnesite besedilo predloge.");
        if (formaUrejevalnik) formaUrejevalnik.focus();
        return;
      }
      if (!(modalIzbranaStevilka >= 1 && modalIzbranaStevilka <= NAJVEC_STEVILK)) {
        pokaziNapako("Izberite številko predloge.");
        return;
      }

      var paymentSettingsZaShraniti =
        normalizirajPS(predlogUrejan.paymentSettings || zacetniPaket(tonZaModalPlacila())) ||
        zacetniPaket(tonZaModalPlacila());
      var toneZaShraniti = predlogUrejan.toneId || tonId;
      var orderZaShraniti = Number(modalIzbranaStevilka) || null;

      // Veja A: Nova predloga
      if (predlogUrejan.jeNov) {
        var novPredlog = {
          id: "moj-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
          naslov: naslov,
          ikona: predlogUrejan.ikona || "message-circle",
          stilIkone: "",
          besedilo: besedilo,
          jeMoj: true,
          toneId: toneZaShraniti,
          language: jezik,
          source: "user",
          isRecommended: false,
          order: orderZaShraniti,
          overridesSystemId: null,
          paymentSettings: paymentSettingsZaShraniti,
        };
        naloziStanje.mojiPredlogi = [novPredlog].concat(naloziStanje.mojiPredlogi);
        naloziStanje.nastavitve.stevilke[novPredlog.id] = modalIzbranaStevilka;
        shraniVse();
        forma.hidden = true;
        predlogUrejan = null;
        prikaziSeznamView();
        izrisiSeznam();
        return;
      }

      // Veja B: Sistemska predloga → shrani kot uporabniški override
      if (!predlogUrejan.jeMoj) {
        var systemId = String(predlogUrejan.id);
        var obstojeci = null;
        naloziStanje.mojiPredlogi.forEach(function (p) {
          if (String(p.overridesSystemId || "") === systemId) obstojeci = p;
        });
        var idZaStevilko;
        if (obstojeci) {
          idZaStevilko = obstojeci.id;
          naloziStanje.mojiPredlogi = naloziStanje.mojiPredlogi.map(function (p) {
            if (p.id === obstojeci.id) {
              return {
                id: p.id,
                naslov: naslov,
                ikona: p.ikona || "message-circle",
                stilIkone: "",
                besedilo: besedilo,
                jeMoj: true,
                toneId: toneZaShraniti,
                language: jezik,
                source: "user",
                isRecommended: Boolean(predlogUrejan.isRecommended),
                order: orderZaShraniti,
                overridesSystemId: systemId,
                paymentSettings: paymentSettingsZaShraniti,
              };
            }
            return p;
          });
        } else {
          var np = {
            id: "moj-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
            naslov: naslov,
            ikona: predlogUrejan.ikona || "message-circle",
            stilIkone: "",
            besedilo: besedilo,
            jeMoj: true,
            toneId: toneZaShraniti,
            language: jezik,
            source: "user",
            isRecommended: Boolean(predlogUrejan.isRecommended),
            order: orderZaShraniti,
            overridesSystemId: systemId,
            paymentSettings: paymentSettingsZaShraniti,
          };
          naloziStanje.mojiPredlogi = [np].concat(naloziStanje.mojiPredlogi);
          idZaStevilko = np.id;
        }
        // Skrij sistemsko predlogo
        if (!Array.isArray(naloziStanje.nastavitve.skritiIds)) {
          naloziStanje.nastavitve.skritiIds = [];
        }
        if (naloziStanje.nastavitve.skritiIds.indexOf(systemId) < 0) {
          naloziStanje.nastavitve.skritiIds.push(systemId);
        }
        delete naloziStanje.nastavitve.stevilke[systemId];
        naloziStanje.nastavitve.stevilke[idZaStevilko] = modalIzbranaStevilka;
        shraniVse();
        forma.hidden = true;
        predlogUrejan = null;
        prikaziSeznamView();
        izrisiSeznam();
        return;
      }

      // Veja C: Obstajajoča moja predloga → overwrite
      var idMojega = predlogUrejan.id;
      naloziStanje.mojiPredlogi = naloziStanje.mojiPredlogi.map(function (p) {
        if (String(p.id) === String(idMojega)) {
          return {
            id: p.id,
            naslov: naslov,
            ikona: p.ikona || "message-circle",
            stilIkone: "",
            besedilo: besedilo,
            jeMoj: true,
            toneId: toneZaShraniti || p.toneId || tonId,
            language: p.language || jezik,
            source: "user",
            isRecommended: p.isRecommended || false,
            order: orderZaShraniti,
            overridesSystemId: p.overridesSystemId || null,
            paymentSettings: paymentSettingsZaShraniti,
          };
        }
        return p;
      });
      naloziStanje.nastavitve.stevilke[idMojega] = modalIzbranaStevilka;
      shraniVse();
      forma.hidden = true;
      predlogUrejan = null;
      prikaziSeznamView();
      izrisiSeznam();
    }

    function izbrisiFormo() {
      var nadaljuj = function () {
        if (!predlogUrejan) return;
        if (predlogUrejan.jeNov) {
          forma.hidden = true;
          predlogUrejan = null;
          prikaziSeznamView();
          return;
        }
        var id = predlogUrejan.id;
        if (predlogUrejan.jeMoj) {
          naloziStanje.mojiPredlogi = naloziStanje.mojiPredlogi.filter(function (p) {
            return String(p.id) !== String(id);
          });
        } else {
          if (!Array.isArray(naloziStanje.nastavitve.skritiIds)) {
            naloziStanje.nastavitve.skritiIds = [];
          }
          if (naloziStanje.nastavitve.skritiIds.indexOf(String(id)) < 0) {
            naloziStanje.nastavitve.skritiIds.push(String(id));
          }
        }
        delete naloziStanje.nastavitve.stevilke[String(id)];
        shraniVse();
        forma.hidden = true;
        predlogUrejan = null;
        prikaziSeznamView();
        izrisiSeznam();
      };
      var potrdi = ctx.potrdiVprasanje || root.potrdiVprasanje;
      if (typeof potrdi === "function") {
        var opis = predlogUrejan ? predlogUrejan.naslov : "";
        potrdi({
          naslov: "Odstranim predlogo?",
          opis: "»" + opis + "«",
          potrdiBesedilo: "Odstrani",
          stil: "nevarno",
        }).then(function (ok) {
          if (ok) nadaljuj();
        });
      } else {
        nadaljuj();
      }
    }

    /* ======== GRADNJA MODALA ======== */

    function zgradiModal() {
      if (document.getElementById(MODAL_ID)) {
        modal = document.getElementById(MODAL_ID);
        vsebinaEl = document.getElementById(VSEBINA_ID);
        forma = document.getElementById(FORMA_ID);
        formaNaslovVnos = document.getElementById("predlogi-urejevalnik-forma-naslov");
        formaUrejevalnik = document.getElementById("predlogi-urejevalnik-forma-besedilo");
        modalStevilkeMreza = document.getElementById("predlogi-urejevalnik-stevilke-mreza");
        modalStevilkaOvoj = document.getElementById("predlogi-urejevalnik-stevilka-ovoj");
        modalPredlagajTon = document.getElementById("predlogi-urejevalnik-predlagaj-ton");
        modalPredlagajTonHint = document.getElementById("predlogi-urejevalnik-predlagaj-ton-hint");
        modalPredlagajTonStanje = document.getElementById("predlogi-urejevalnik-predlagaj-ton-stanje");
        modalPriporociloVrstica = document.getElementById("predlogi-urejevalnik-priporocilo-vrstica");
        modalPriporociloNaslov = document.getElementById("predlogi-urejevalnik-priporocilo-naslov");
        modalDodatekRok = document.getElementById("predlogi-urejevalnik-dodatek-rok");
        modalDodatekRokStanje = document.getElementById("predlogi-urejevalnik-dodatek-rok-stanje");
        modalDodatekObrocno = document.getElementById("predlogi-urejevalnik-dodatek-obrocno");
        modalDodatekObrocnoStanje = document.getElementById("predlogi-urejevalnik-dodatek-obrocno-stanje");
        modalDodatekTrr = document.getElementById("predlogi-urejevalnik-dodatek-trr");
        modalDodatekTrrStanje = document.getElementById("predlogi-urejevalnik-dodatek-trr-stanje");
        modalNaslovGlava = document.getElementById("predlogi-urejevalnik-forma-naslov-glava");
        modalShraniGumb = document.getElementById("predlogi-urejevalnik-shrani");
        modalIzbrisiGumb = document.getElementById("predlogi-urejevalnik-izbrisi");
        modalPrekliciGumb = document.getElementById("predlogi-urejevalnik-preklici");
        return;
      }
      modal = document.createElement("div");
      modal.className = "template-editor";
      modal.id = MODAL_ID;
      modal.hidden = true;
      modal.innerHTML =
        '<button type="button" class="template-editor__backdrop" id="predlogi-urejevalnik-backdrop" aria-label="Zapri"></button>' +
        '<div class="template-editor__shell" role="dialog" aria-modal="true" aria-labelledby="predlogi-urejevalnik-naslov">' +
        '<header class="template-editor__header">' +
        '<h2 class="template-editor__title" id="predlogi-urejevalnik-naslov" tabindex="-1">Predloge</h2>' +
        '<button type="button" class="template-editor__zapri" id="predlogi-urejevalnik-zapri" aria-label="Zapri"><span aria-hidden="true">×</span></button>' +
        "</header>" +
        '<div class="template-editor__content" id="' + VSEBINA_ID + '">' +

        // --- FORMA (prikaže se ob Uredi) ---
        '<div id="' + FORMA_ID + '" hidden>' +
        '<h3 class="template-editor__subtitle" id="predlogi-urejevalnik-forma-naslov-glava">Uredi predlogo</h3>' +

        // suggest-tone-button (enak kot korak 2)
        '<button type="button" class="suggest-tone-button" id="predlogi-urejevalnik-predlagaj-ton">' +
        '<span class="suggest-tone-button__header">' +
        '<span class="suggest-tone-button__star" aria-hidden="true">★</span>' +
        '<span class="suggest-tone-button__title">Priporočilo sistema</span>' +
        '<span class="suggest-tone-button__badge">Ton</span>' +
        "</span>" +
        '<span class="suggest-tone-button__description">Predlagamo ton glede na dolg in zapadlost.</span>' +
        '<span class="suggest-tone-button__action" id="predlogi-urejevalnik-predlagaj-ton-stanje">Uporabi priporočilo</span>' +
        "</button>" +
        '<p class="template-editor__hint" id="predlogi-urejevalnik-predlagaj-ton-hint" hidden>Najprej vnesite besedilo predloge.</p>' +

        // Naslov
        '<label class="template-editor__label" for="predlogi-urejevalnik-forma-naslov">Ime predloge</label>' +
        '<input class="template-editor__ime" id="predlogi-urejevalnik-forma-naslov" maxlength="80" placeholder="Jasen poziv" autocomplete="off" />' +

        // Številčna mrežica (zamenja plavajoči zamenjajStevilko)
        '<div class="template-editor__stevilka" id="predlogi-urejevalnik-stevilka-ovoj">' +
        '<span class="template-editor__label">Številka</span>' +
        '<div class="template-editor__stevilke" id="predlogi-urejevalnik-stevilke-mreza" role="listbox" aria-label="Številka predloge"></div>' +
        "</div>" +

        // Besedilo
        '<label class="template-editor__label" for="predlogi-urejevalnik-forma-besedilo">Besedilo</label>' +
        '<textarea class="template-body-textarea" id="predlogi-urejevalnik-forma-besedilo" rows="6" maxlength="1000"></textarea>' +

        // Dodatki predloge
        '<section class="template-editor__dodatki" aria-labelledby="predlogi-urejevalnik-placila-oznaka">' +
        '<h3 class="template-editor__label" id="predlogi-urejevalnik-placila-oznaka">Dodatki predloge</h3>' +
        '<p class="template-editor__opis">Te nastavitve se uporabijo vsakič, ko izberete to predlogo.</p>' +
        '<div class="sporocilo-dodatki__gumbi template-addons" role="group" aria-label="Dodatki predloge">' +
        '<button type="button" class="sporocilo-dodatek sporocilo-dodatek--priporocilo" id="predlogi-urejevalnik-dodatek-rok" aria-pressed="false" aria-label="Nastavi rok plačila. Trenutno: Izklopljeno">' +
        '<span class="sporocilo-dodatek__zvezda" aria-hidden="true" title="Sistemsko priporočilo">★</span>' +
        '<span class="sporocilo-dodatek__ikona" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg></span>' +
        '<span class="sporocilo-dodatek__naslov">Rok plačila</span>' +
        '<span class="sporocilo-dodatek__stanje" id="predlogi-urejevalnik-dodatek-rok-stanje">Izklopljeno</span>' +
        "</button>" +
        '<button type="button" class="sporocilo-dodatek sporocilo-dodatek--priporocilo" id="predlogi-urejevalnik-dodatek-obrocno" aria-pressed="false" aria-label="Nastavi obročno ali delno plačilo. Trenutno: Izklopljeno">' +
        '<span class="sporocilo-dodatek__zvezda" aria-hidden="true" title="Sistemsko priporočilo">★</span>' +
        '<span class="sporocilo-dodatek__ikona" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg></span>' +
        '<span class="sporocilo-dodatek__naslov">Obročno/delno plačilo</span>' +
        '<span class="sporocilo-dodatek__stanje" id="predlogi-urejevalnik-dodatek-obrocno-stanje">Izklopljeno</span>' +
        "</button>" +
        '<button type="button" class="sporocilo-dodatek" id="predlogi-urejevalnik-dodatek-trr" aria-pressed="false" aria-label="Nastavi TRR. Trenutno: Izklopljeno">' +
        '<span class="sporocilo-dodatek__ikona" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg></span>' +
        '<span class="sporocilo-dodatek__naslov">TRR</span>' +
        '<span class="sporocilo-dodatek__stanje" id="predlogi-urejevalnik-dodatek-trr-stanje">Izklopljeno</span>' +
        "</button>" +
        "</div>" +
        "</section>" +

        // Akcije
        '<div class="template-editor__actions">' +
        '<button type="button" class="template-editor__shrani" id="predlogi-urejevalnik-shrani">Shrani predlogo</button>' +
        '<button type="button" class="template-editor__izbrisi" id="predlogi-urejevalnik-izbrisi">Izbriši predlogo</button>' +
        '<button type="button" class="template-editor__preklici" id="predlogi-urejevalnik-preklici">Prekliči</button>' +
        "</div>" +
        "</div>" +
        // --- KONEC FORME ---

        // + Nova predloga gumb (zunaj forme, v seznamskem pogledu)
        '<button type="button" class="template-editor__shrani" id="predlogi-urejevalnik-nova" style="width:100%;margin-bottom:12px">+ Nova predloga</button>' +
        '<p class="template-editor__razporejanje-navodilo" id="predlogi-urejevalnik-razporejanje-navodilo" aria-live="polite">Kliknite kartico in nato njeno novo mesto. Lahko jo tudi povlečete za številko.</p>' +
        '<div class="predlog-kartica__seznam" id="predlogi-urejevalnik-seznam" role="list"></div>' +
        "</div>" +
        "</div>";
      document.body.appendChild(modal);

      // Pridobi reference
      vsebinaEl = document.getElementById(VSEBINA_ID);
      forma = document.getElementById(FORMA_ID);
      formaNaslovVnos = document.getElementById("predlogi-urejevalnik-forma-naslov");
      formaUrejevalnik = document.getElementById("predlogi-urejevalnik-forma-besedilo");
      modalStevilkeMreza = document.getElementById("predlogi-urejevalnik-stevilke-mreza");
      modalStevilkaOvoj = document.getElementById("predlogi-urejevalnik-stevilka-ovoj");
      modalPredlagajTon = document.getElementById("predlogi-urejevalnik-predlagaj-ton");
      modalPredlagajTonHint = document.getElementById("predlogi-urejevalnik-predlagaj-ton-hint");
      modalPredlagajTonStanje = document.getElementById("predlogi-urejevalnik-predlagaj-ton-stanje");
      modalPriporociloVrstica = document.getElementById("predlogi-urejevalnik-priporocilo-vrstica");
      modalPriporociloNaslov = document.getElementById("predlogi-urejevalnik-priporocilo-naslov");
      modalDodatekRok = document.getElementById("predlogi-urejevalnik-dodatek-rok");
      modalDodatekRokStanje = document.getElementById("predlogi-urejevalnik-dodatek-rok-stanje");
      modalDodatekObrocno = document.getElementById("predlogi-urejevalnik-dodatek-obrocno");
      modalDodatekObrocnoStanje = document.getElementById("predlogi-urejevalnik-dodatek-obrocno-stanje");
      modalDodatekTrr = document.getElementById("predlogi-urejevalnik-dodatek-trr");
      modalDodatekTrrStanje = document.getElementById("predlogi-urejevalnik-dodatek-trr-stanje");
      modalNaslovGlava = document.getElementById("predlogi-urejevalnik-forma-naslov-glava");
      modalShraniGumb = document.getElementById("predlogi-urejevalnik-shrani");
      modalIzbrisiGumb = document.getElementById("predlogi-urejevalnik-izbrisi");
      modalPrekliciGumb = document.getElementById("predlogi-urejevalnik-preklici");

      // Za naslov forme (header znotraj forme) uporabimo ID izmenično
      // Na koraku 2 je "predogled-naslov-glava" naslov glave dialoga
      // Tukaj uporabimo "predlogi-urejevalnik-naslov" kot header modala,
      // za formo pa nimamo ločenega naslova, ker je header vedno "Predloge"

      // Event listenerji
      document.getElementById("predlogi-urejevalnik-zapri").addEventListener("click", nazajAliZapri);
      document.getElementById("predlogi-urejevalnik-backdrop").addEventListener("click", zapri);
      document.getElementById("predlogi-urejevalnik-preklici").addEventListener("click", function () {
        forma.hidden = true;
        predlogUrejan = null;
        prikaziSeznamView();
      });
      document.getElementById("predlogi-urejevalnik-shrani").addEventListener("click", shraniFormo);
      document.getElementById("predlogi-urejevalnik-izbrisi").addEventListener("click", izbrisiFormo);
      document.getElementById("predlogi-urejevalnik-nova").addEventListener("click", function () {
        odpriFormo({ jeNova: true, naslov: "", besedilo: "", jeMoj: true, paymentSettings: null });
      });

      // Suggest tone button
      document.getElementById("predlogi-urejevalnik-predlagaj-ton").addEventListener("click", predlagajTonZaPredlogo);
      var razveljaviBtn = document.getElementById("predlogi-urejevalnik-razveljavi-priporocilo");
      if (razveljaviBtn) razveljaviBtn.addEventListener("click", razveljaviPriporociloTona);

      // Dodatki gumbi
      document.getElementById("predlogi-urejevalnik-dodatek-rok").addEventListener("click", odpriModalDodatekRok);
      document.getElementById("predlogi-urejevalnik-dodatek-obrocno").addEventListener("click", odpriModalDodatekObrocno);
      document.getElementById("predlogi-urejevalnik-dodatek-trr").addEventListener("click", odpriModalDodatekTrr);

      document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && modal && !modal.hidden) nazajAliZapri();
      });
    }

    var api = {
      odpri: function () {
        zgradiModal();
        osveziPodatke().then(function () {
          if (!modal) return;
          prikaziSeznamView();
          izrisiSeznam();
          modal.hidden = false;
          document.body.classList.add("template-editor-odprt");
        });
      },
      zapri: zapri,
    };

    return {
      api: api,
      posodobiCtx: function (novCtx) {
        ctx = novCtx || {};
        jezik = ctx.jezik || "de";
        tonId = ctx.toneId || "friendly";
      },
    };
  }

  // --- Izvoz ---
  root.inicializirajPredlogiUrejevalnik = inicializirajPredlogiUrejevalnik;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      inicializirajPredlogiUrejevalnik: inicializirajPredlogiUrejevalnik,
      izracunajVelikostMreze: izracunajVelikostMreze,
      premakniPredlogoPoPrioriteti: premakniPredlogoPoPrioriteti,
    };
  }
})(typeof window !== "undefined" ? window : this);
