/* ========== Rok plačila – bottom sheet UI ==========
   Kliče se iz inicializirajSporociloDolzniku (app.js).
   ============================================ */
(function (root) {
  "use strict";

  /**
   * @param {object} ctx
   * @param {HTMLElement} ctx.gumbRok
   * @param {HTMLTextAreaElement} ctx.besediloPolje
   * @param {number} ctx.najvecZnakov
   * @param {() => object|null} ctx.getPaymentDeadline
   * @param {(v: object|null) => void} ctx.setPaymentDeadline
   * @param {() => object} ctx.getPrivzetiDnevi
   * @param {(v: object) => void} ctx.setPrivzetiDnevi
   * @param {() => number} ctx.stevilkaIzbranegaPredloga
   * @param {() => string} ctx.bazaDatumaPosiljanja
   * @param {object} ctx.dodatki
   * @param {object} ctx.dodatekBesedila
   * @param {() => void} ctx.posodobiStanjeUrejevalnika
   * @param {() => void} ctx.shraniOsnutekLokalno
   * @param {(opcije: object) => Promise<boolean>} ctx.potrdiVprasanje
   */
  function inicializirajRokPlacilaSheet(ctx) {
    var UJ = root.UJRokPlacila;
    var sheet = document.getElementById("rok-sheet");
    if (!UJ || !sheet || !ctx || !ctx.gumbRok) {
      if (ctx && ctx.gumbRok && typeof ctx.pokaziNapako === "function") {
        ctx.gumbRok.addEventListener("click", function () {
          ctx.pokaziNapako(
            "Nastavitve roka plačila se niso naložile. Osvežite stran (Ctrl+F5)."
          );
        });
      }
      return;
    }

    // Vedno na body – sicer overflow:hidden na .korak2 odreže panel.
    if (sheet.parentElement !== document.body) {
      document.body.appendChild(sheet);
    }

    var backdrop = document.getElementById("rok-sheet-backdrop");
    var panel = document.getElementById("rok-sheet-panel");
    var naslov = document.getElementById("rok-sheet-naslov");
    var zapri = document.getElementById("rok-sheet-zapri");
    var samodejno = document.getElementById("rok-sheet-samodejno");
    var stevilke = document.getElementById("rok-sheet-stevilke");
    var datumPolje = document.getElementById("rok-sheet-datum");
    var pomoc = document.getElementById("rok-sheet-pomoc");
    var pomocBesedilo = document.getElementById("rok-sheet-pomoc-besedilo");
    var pomocZvezda = document.getElementById("rok-sheet-pomoc-zvezda");
    var recommendationHost = document.getElementById("rok-sheet-recommendation");
    var napaka = document.getElementById("rok-sheet-napaka");
    var urediPovezava = document.getElementById("rok-sheet-uredi-privzeto");
    var urediPanel = document.getElementById("rok-sheet-uredi-privzeto-panel");
    var urediNaslov = document.getElementById("rok-sheet-privzeto-naslov");
    var dneviPolje = document.getElementById("rok-sheet-dnevi");
    var privzetoPreklici = document.getElementById("rok-sheet-privzeto-preklici");
    var privzetoPotrdi = document.getElementById("rok-sheet-privzeto-potrdi");
    var preklici = document.getElementById("rok-sheet-preklici");
    var shrani = document.getElementById("rok-sheet-shrani");
    var odstrani = document.getElementById("rok-sheet-odstrani");

    var odprt = false;
    var osnutek = null;
    var osnutekPrivzetih = null;
    var predOgledPressed = false;
    var shranjevanje = false;
    var prejsnjiFokus = null;
    /* Na telefonu isti tap, ki odpre sheet, pogosto zadene še backdrop in ga takoj zapre. */
    var zapiranjeDovoljeno = false;
    var casovnikZapiranja = null;
    /** Odprtje iz »Možna priporočila« → forsira predlog glede na ton. */
    var forsiraPriporocilo = false;
    var forsiraToneId = null;
    var forsiraTermDays = null;
    var pendingOnClose = null;
    var recCard = null;
    var previousSettingsSnapshot = null;
    var appliedRecommendationKey = null;

    function klon(obj) {
      return obj ? JSON.parse(JSON.stringify(obj)) : null;
    }

    function nastaviNapako(pokazi) {
      if (!napaka) return;
      napaka.hidden = !pokazi;
      if (shrani) shrani.disabled = Boolean(pokazi) || shranjevanje;
    }

    function tonZaRazlago() {
      return (
        forsiraToneId ||
        (typeof ctx.getToneIdZaPriporocila === "function"
          ? ctx.getToneIdZaPriporocila()
          : null) ||
        (typeof ctx.getToneId === "function" ? ctx.getToneId() : null)
      );
    }

    function priporoceniDneviZaTon() {
      var tonId = tonZaRazlago();
      if (
        forsiraPriporocilo &&
        Number.isFinite(Number(forsiraTermDays))
      ) {
        return Number(forsiraTermDays);
      }
      if (typeof ctx.getDneviZaTon === "function" && tonId) {
        var d = Number(ctx.getDneviZaTon(tonId));
        if (Number.isFinite(d) && d > 0) return d;
      }
      return null;
    }

    function posnetekOsnutkaRoka() {
      return osnutek ? klon(osnutek) : null;
    }

    function obnoviOsnutekRoka(snap) {
      if (!snap) return;
      osnutek = klon(snap);
      if (samodejno) samodejno.checked = osnutek.mode !== "manual";
      if (datumPolje) datumPolje.value = osnutek.deadlineDate || "";
      posodobiPomoc();
      preveriDatum();
      skrijUrediPrivzeto();
    }

    function oznaciRokPriporociloSpremenjeno() {
      if (!recCard) return;
      if (recCard.getStatus() === "applied") {
        appliedRecommendationKey = null;
        recCard.setStatus("modified");
      }
    }

    function posodobiRazlagoPriporocila() {
      zagotoviRecCard();
      if (!recCard) return;
      var api = root.UJTonDodatkiPriporocila;
      var RC = root.UJRecommendationCard;
      if (!api || typeof api.sestaviPriporocila !== "function") {
        recCard.setContent({ valueLabel: "", description: "" });
        return;
      }
      var vhodOsnova =
        typeof ctx.getPriporociloVhod === "function"
          ? ctx.getPriporociloVhod()
          : null;
      var vhod = {
        toneId: (vhodOsnova && vhodOsnova.toneId) || tonZaRazlago(),
        overdueDays: vhodOsnova ? vhodOsnova.overdueDays : null,
        amountCents: (vhodOsnova && vhodOsnova.amountCents) || 0,
      };
      if (forsiraToneId) vhod.toneId = forsiraToneId;
      var p = api.sestaviPriporocila(vhod);
      var days = priporoceniDneviZaTon();
      if (days == null) days = p && p.termDays != null ? p.termDays : 14;
      var valueLabel =
        (p && p.rokValueLabel) ||
        (api.oznakaDni ? api.oznakaDni(days) : days + " dni");
      var hash =
        RC && typeof RC.contextHash === "function"
          ? RC.contextHash({
              kind: "rok",
              toneId: vhod.toneId,
              overdueDays: vhod.overdueDays,
              amountCents: vhod.amountCents,
              termDays: days,
              sendDate: ctx.bazaDatumaPosiljanja(),
              priority: ctx.stevilkaIzbranegaPredloga
                ? ctx.stevilkaIzbranegaPredloga()
                : 1,
            })
          : String(days) + "|" + vhod.toneId;
      recCard.setContent({
        valueLabel: valueLabel,
        description: (p && p.rokText) || "",
        contextHash: hash,
        applyAriaLabel: "Uporabi priporočilo za rok plačila " + valueLabel,
        ignoreAriaLabel: "Prezri priporočilo za rok plačila",
      });
      if (
        recCard.getStatus() === "applied" &&
        appliedRecommendationKey &&
        appliedRecommendationKey !== hash
      ) {
        recCard.setStatus("visible");
        appliedRecommendationKey = null;
        previousSettingsSnapshot = null;
      }
    }

    /** En klik: automatic + dnevi tona + datum (brez shranjevanja). */
    function uporabiPriporoceno() {
      if (!osnutek) return;
      var tonId = tonZaRazlago();
      var days = priporoceniDneviZaTon();
      if (days == null && typeof ctx.getDneviZaTon === "function" && tonId) {
        days = Number(ctx.getDneviZaTon(tonId));
      }
      if (!Number.isFinite(days) || days <= 0) days = 14;

      var linked = Number(osnutek.linkedProposalNumber);
      if (!(linked >= 1 && linked <= 9)) {
        linked = Number(ctx.stevilkaIzbranegaPredloga()) || 1;
      }
      if (!(linked >= 1 && linked <= 9)) linked = 1;

      var base = ctx.bazaDatumaPosiljanja();
      osnutek.mode = "automatic";
      osnutek.linkedProposalNumber = linked;
      osnutek.linkedToneId = tonId || osnutek.linkedToneId || null;
      osnutek.termDays = days;
      osnutek.baseSendDate = base;
      osnutek.deadlineDate = UJ.izracunajRok(base, days);

      if (samodejno) samodejno.checked = true;
      if (datumPolje) datumPolje.value = osnutek.deadlineDate;
      oznaciStevilko(linked);
      posodobiPomoc();
      preveriDatum();
      skrijUrediPrivzeto();
      if (recCard) appliedRecommendationKey = recCard.getContextHash();
    }

    function zagotoviRecCard() {
      if (recCard || !recommendationHost || !root.UJRecommendationCard) return;
      recCard = root.UJRecommendationCard.mount(recommendationHost, {
        id: "rok",
        onApply: function () {
          previousSettingsSnapshot = posnetekOsnutkaRoka();
          uporabiPriporoceno();
        },
        onUndo: function () {
          obnoviOsnutekRoka(previousSettingsSnapshot);
          previousSettingsSnapshot = null;
          appliedRecommendationKey = null;
        },
        onReapply: function () {
          previousSettingsSnapshot = posnetekOsnutkaRoka();
          uporabiPriporoceno();
        },
        onIgnore: function () {},
      });
    }

    function nastaviPomocZvezdo(pokazi) {
      if (pomoc) {
        pomoc.classList.toggle("rok-sheet__pomoc--priporoceno", Boolean(pokazi));
      }
      if (pomocZvezda) pomocZvezda.hidden = !pokazi;
    }

    function posodobiPomoc() {
      if (!osnutek) return;
      var cilj = pomocBesedilo || pomoc;
      if (!cilj) return;
      if (osnutek.mode === "manual") {
        cilj.textContent = "Ročno nastavljen datum";
        nastaviPomocZvezdo(false);
        return;
      }
      var d = Number(osnutek.termDays) || 0;
      cilj.textContent = "Privzeto: " + d + " dni od pošiljanja";
      var priporoceni = priporoceniDneviZaTon();
      nastaviPomocZvezdo(
        priporoceni != null && Number(d) === Number(priporoceni)
      );
    }

    function dneviIzTonaAliPredloga() {
      if (forsiraPriporocilo && Number.isFinite(Number(forsiraTermDays))) {
        return Number(forsiraTermDays);
      }
      if (typeof ctx.getDneviZaTon === "function") {
        var tonId =
          (forsiraPriporocilo && forsiraToneId) ||
          (typeof ctx.getToneId === "function" ? ctx.getToneId() : null);
        if (tonId) {
          var dTon = Number(ctx.getDneviZaTon(tonId));
          if (Number.isFinite(dTon) && dTon > 0) return dTon;
        }
      }
      var n = Number(osnutek && osnutek.linkedProposalNumber) || 1;
      return (
        Number(osnutekPrivzetih && osnutekPrivzetih[n]) ||
        Number(ctx.getPrivzetiDnevi()[n]) ||
        5
      );
    }

    function preracunajSamodejno() {
      if (!osnutek || osnutek.mode !== "automatic") return;
      var days = dneviIzTonaAliPredloga();
      var base = ctx.bazaDatumaPosiljanja();
      osnutek.termDays = days;
      osnutek.baseSendDate = base;
      osnutek.deadlineDate = UJ.izracunajRok(base, days);
      if (datumPolje) datumPolje.value = osnutek.deadlineDate;
      posodobiPomoc();
      preveriDatum();
    }

    function preveriDatum() {
      if (!osnutek || !datumPolje) return true;
      var vrednost = datumPolje.value;
      if (!vrednost) {
        nastaviNapako(true);
        if (napaka) napaka.textContent = "Datum je obvezen.";
        return false;
      }
      var base = osnutek.baseSendDate || ctx.bazaDatumaPosiljanja();
      if (UJ.jeDatumPredPosiljanjem(vrednost, base)) {
        if (napaka) {
          napaka.textContent = "Rok plačila ne sme biti pred datumom pošiljanja.";
        }
        nastaviNapako(true);
        return false;
      }
      nastaviNapako(false);
      osnutek.deadlineDate = vrednost;
      return true;
    }

    function oznaciStevilko(n) {
      if (!stevilke) return;
      stevilke.querySelectorAll(".rok-sheet__stevilka").forEach(function (g) {
        g.setAttribute("aria-selected", String(Number(g.dataset.stevilka) === n));
      });
    }

    function zgradiStevilke() {
      if (!stevilke || stevilke.childElementCount) return;
      for (var i = 1; i <= 9; i++) {
        var g = document.createElement("button");
        g.type = "button";
        g.className = "rok-sheet__stevilka";
        g.dataset.stevilka = String(i);
        g.textContent = String(i);
        g.setAttribute("aria-label", "Poveži s predlogom " + i);
        g.setAttribute("aria-selected", "false");
        g.addEventListener("click", function (ev) {
          var stev = Number(ev.currentTarget.dataset.stevilka);
          if (!osnutek) return;
          osnutek.linkedProposalNumber = stev;
          osnutek.mode = "automatic";
          if (samodejno) samodejno.checked = true;
          oznaciStevilko(stev);
          preracunajSamodejno();
          if (urediPanel && !urediPanel.hidden) odpriUrediPrivzeto();
        });
        stevilke.appendChild(g);
      }
    }

    function skrijUrediPrivzeto() {
      if (urediPanel) urediPanel.hidden = true;
    }

    function odpriUrediPrivzeto() {
      if (!osnutek || !urediPanel) return;
      var n = Number(osnutek.linkedProposalNumber) || 1;
      if (urediNaslov) urediNaslov.textContent = "Privzeti rok za predlog " + n;
      if (dneviPolje) {
        dneviPolje.value = String(Number(osnutekPrivzetih[n]) || 5);
      }
      urediPanel.hidden = false;
    }

    function posodobiDatumVidez(vklopljen) {
      if (!datumPolje) return;
      if (vklopljen) datumPolje.classList.add("rok-sheet__datum--vklopljen");
      else datumPolje.classList.remove("rok-sheet__datum--vklopljen");
    }

    function napolniUiIzOsnutka() {
      if (!osnutek) return;
      if (samodejno) samodejno.checked = osnutek.mode !== "manual";
      if (datumPolje) datumPolje.value = osnutek.deadlineDate || "";
      posodobiPomoc();
      preveriDatum();
      skrijUrediPrivzeto();

      var ze = Boolean(ctx.getPaymentDeadline() && ctx.getPaymentDeadline().enabled);
      posodobiDatumVidez(ze);
      if (shrani) {
        shrani.textContent = ze ? "Shrani spremembe" : "Shrani in dodaj";
      }
      if (odstrani) odstrani.hidden = !ze;
    }

    /** Privzeto stanje widgeta (po Izklopi / pred novim vnosom). */
    function resetirajOsnutekNaPrivzeto() {
      osnutekPrivzetih = klon(ctx.getPrivzetiDnevi());
      var linked = ctx.stevilkaIzbranegaPredloga();
      if (!(linked >= 1 && linked <= 9)) linked = 1;
      var base = ctx.bazaDatumaPosiljanja();
      osnutek = {
        enabled: false,
        mode: "automatic",
        linkedProposalNumber: linked,
        termDays: 5,
        deadlineDate: "",
        baseSendDate: base,
        insertedText: "",
        messageLanguage: "sl",
      };
      osnutek.termDays = dneviIzTonaAliPredloga();
      osnutek.deadlineDate = UJ.izracunajRok(base, osnutek.termDays);
      napolniUiIzOsnutka();
      posodobiDatumVidez(false);
    }

    function napolniOsnutekObOdprtju() {
      var obstojeci = ctx.getPaymentDeadline();
      var linked = obstojeci && obstojeci.linkedProposalNumber
        ? Number(obstojeci.linkedProposalNumber)
        : ctx.stevilkaIzbranegaPredloga();
      if (!(linked >= 1 && linked <= 9)) linked = 1;

      osnutekPrivzetih = klon(ctx.getPrivzetiDnevi());
      var base = ctx.bazaDatumaPosiljanja();
      var daysFallback = Number(osnutekPrivzetih[linked]) || 5;
      // Iz »Možna priporočila«: vedno sveži predlog (ne star shranjen rok).
      if (forsiraPriporocilo) {
        var tonId =
          forsiraToneId ||
          (typeof ctx.getToneId === "function" ? ctx.getToneId() : null);
        var daysPriporocilo = dneviIzTonaAliPredloga() || daysFallback;
        osnutek = {
          enabled: false,
          mode: "automatic",
          linkedProposalNumber: linked,
          linkedToneId: tonId || null,
          termDays: daysPriporocilo,
          deadlineDate: UJ.izracunajRok(base, daysPriporocilo),
          baseSendDate: base,
          insertedText: (obstojeci && obstojeci.insertedText) || "",
          messageLanguage:
            (obstojeci && obstojeci.messageLanguage) || "sl",
        };
        return;
      }

      if (obstojeci && obstojeci.enabled) {
        osnutek = klon(obstojeci);
        if (!osnutek.linkedProposalNumber) osnutek.linkedProposalNumber = linked;
        if (osnutek.mode === "automatic") {
          osnutek.termDays = dneviIzTonaAliPredloga() || daysFallback;
          osnutek.baseSendDate = base;
          osnutek.deadlineDate = UJ.izracunajRok(base, osnutek.termDays);
        } else {
          osnutek.baseSendDate = osnutek.baseSendDate || base;
        }
      } else {
        osnutek = {
          enabled: false,
          mode: "automatic",
          linkedProposalNumber: linked,
          termDays: daysFallback,
          deadlineDate: "",
          baseSendDate: base,
          insertedText: "",
          messageLanguage: "sl",
        };
        osnutek.termDays = dneviIzTonaAliPredloga() || daysFallback;
        osnutek.deadlineDate = UJ.izracunajRok(base, osnutek.termDays);
      }
    }

    function getFocusable() {
      if (!panel) return [];
      return Array.prototype.slice.call(
        panel.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(function (el) {
        return el.offsetParent !== null || el === naslov;
      });
    }

    function onKeydown(dogodek) {
      if (!odprt) return;
      if (dogodek.key === "Escape") {
        var potrdiModal = document.getElementById("uj-potrdi-modal");
        if (potrdiModal && !potrdiModal.hidden) return;
        dogodek.preventDefault();
        dogodek.stopPropagation();
        zapiranjeDovoljeno = true;
        zapriSheet(false);
        return;
      }
      if (dogodek.key !== "Tab" || !panel) return;
      var elementi = getFocusable();
      if (!elementi.length) return;
      var prvi = elementi[0];
      var zadnji = elementi[elementi.length - 1];
      if (dogodek.shiftKey && document.activeElement === prvi) {
        dogodek.preventDefault();
        zadnji.focus();
      } else if (!dogodek.shiftKey && document.activeElement === zadnji) {
        dogodek.preventDefault();
        prvi.focus();
      }
    }

    /**
     * @param {{
     *   izPriporocil?: boolean,
     *   toneId?: string,
     *   termDays?: number,
     *   onClose?: (r: { shranjeno: boolean }) => void
     * }} [opcije]
     */
    function odpriSheet(opcije) {
      if (odprt) return;
      var opts = opcije || {};
      forsiraPriporocilo = Boolean(opts.izPriporocil);
      forsiraToneId = opts.toneId ? String(opts.toneId) : null;
      forsiraTermDays =
        opts.termDays != null && Number.isFinite(Number(opts.termDays))
          ? Number(opts.termDays)
          : null;
      pendingOnClose =
        typeof opts.onClose === "function" ? opts.onClose : null;
      try {
        predOgledPressed = ctx.gumbRok.getAttribute("aria-pressed") === "true";
        prejsnjiFokus = document.activeElement;
        napolniOsnutekObOdprtju();
        napolniUiIzOsnutka();
        previousSettingsSnapshot = null;
        appliedRecommendationKey = null;
        posodobiRazlagoPriporocila();
        if (recCard && recCard.getStatus() !== "ignored") {
          recCard.setStatus("visible");
        }

        // Predogled aktivnega gumba – commit šele ob shrani.
        ctx.gumbRok.setAttribute("aria-pressed", "true");

        zapiranjeDovoljeno = false;
        if (casovnikZapiranja) window.clearTimeout(casovnikZapiranja);
        if (sheet.parentElement !== document.body) {
          document.body.appendChild(sheet);
        }
        sheet.hidden = false;
        document.body.classList.add("rok-sheet-odprt");
        odprt = true;
        document.addEventListener("keydown", onKeydown, true);
        casovnikZapiranja = window.setTimeout(function () {
          zapiranjeDovoljeno = true;
          casovnikZapiranja = null;
        }, 450);
        window.setTimeout(function () {
          if (naslov) naslov.focus();
        }, 10);
      } catch (napaka) {
        forsiraPriporocilo = false;
        forsiraToneId = null;
        forsiraTermDays = null;
        pendingOnClose = null;
        if (typeof ctx.pokaziNapako === "function") {
          ctx.pokaziNapako(
            "Odpiranje roka plačila ni uspelo. Osvežite stran.",
            napaka && napaka.message ? napaka.message : ""
          );
        }
      }
    }

    /**
     * @param {boolean} shraniSpremembe
     * @param {{ shranjeno?: boolean }} [meta]
     */
    function zapriSheet(shraniSpremembe, meta) {
      if (!odprt) return;
      if (!shraniSpremembe && !zapiranjeDovoljeno) return;
      if (!shraniSpremembe) {
        ctx.gumbRok.setAttribute("aria-pressed", String(predOgledPressed));
        osnutek = null;
        osnutekPrivzetih = null;
      }
      sheet.hidden = true;
      document.body.classList.remove("rok-sheet-odprt");
      odprt = false;
      zapiranjeDovoljeno = false;
      forsiraPriporocilo = false;
      forsiraToneId = null;
      forsiraTermDays = null;
      if (casovnikZapiranja) {
        window.clearTimeout(casovnikZapiranja);
        casovnikZapiranja = null;
      }
      document.removeEventListener("keydown", onKeydown, true);
      skrijUrediPrivzeto();
      nastaviNapako(false);
      var cb = pendingOnClose;
      pendingOnClose = null;
      var shranjeno = Boolean(meta && meta.shranjeno);
      if (ctx.gumbRok && typeof ctx.gumbRok.focus === "function") {
        ctx.gumbRok.focus();
      } else if (prejsnjiFokus && prejsnjiFokus.focus) {
        prejsnjiFokus.focus();
      }
      if (typeof cb === "function") {
        try {
          cb({ shranjeno: shranjeno });
        } catch (_e) {
          /* ignore */
        }
      }
    }

    function ugotoviJezik() {
      var pd = ctx.getPaymentDeadline();
      if (pd && pd.messageLanguage) return pd.messageLanguage;
      return UJ.ugotoviJezikSporocila(ctx.besediloPolje.value);
    }

    async function shraniInDodaj() {
      if (!osnutek || shranjevanje) return;
      if (!preveriDatum()) return;

      shranjevanje = true;
      if (shrani) {
        shrani.disabled = true;
        shrani.textContent = "Shranjevanje …";
      }

      try {
        if (osnutekPrivzetih && UJ.soDneviNarascajoci(osnutekPrivzetih)) {
          var okPrivzeti = UJ.shraniPrivzeteDni(osnutekPrivzetih);
          if (okPrivzeti) ctx.setPrivzetiDnevi(klon(osnutekPrivzetih));
        }

        var jezik = ugotoviJezik();
        var vrstica = UJ.sestaviVrsticoRoka(osnutek.deadlineDate, jezik);
        var trenutni = ctx.getPaymentDeadline();
        var stara = trenutni && trenutni.insertedText ? trenutni.insertedText : "";

        var rez = UJ.posodobiSistemskoVrstico(
          ctx.besediloPolje.value,
          stara,
          vrstica,
          true
        );

        if (!rez.ok && rez.opozorilo === "spremenjeno") {
          var potrdi = await ctx.potrdiVprasanje({
            naslov: "Vrstica roka je spremenjena",
            opis: "Sistemske vrstice ni več mogoče varno najti. Dodam novo vrstico na konec?",
            potrdiBesedilo: "Dodaj novo",
            stil: "primary",
          });
          if (!potrdi) {
            shranjevanje = false;
            if (shrani) {
              shrani.disabled = false;
              shrani.textContent = trenutni && trenutni.enabled
                ? "Shrani spremembe"
                : "Shrani in dodaj";
            }
            return;
          }
          var osnova = String(ctx.besediloPolje.value || "").replace(/\s+$/, "");
          rez = {
            besedilo: osnova ? osnova + "\n\n" + vrstica : vrstica,
            ok: true,
          };
        }

        ctx.besediloPolje.value = String(rez.besedilo).slice(0, ctx.najvecZnakov);
        var tonId =
          osnutek.linkedToneId ||
          (typeof ctx.getToneId === "function" ? ctx.getToneId() : null);
        var novo = {
          enabled: true,
          mode: osnutek.mode === "manual" ? "manual" : "automatic",
          linkedProposalNumber: Number(osnutek.linkedProposalNumber) || 1,
          linkedToneId: tonId || null,
          termDays: Number(osnutek.termDays) || 5,
          deadlineDate: osnutek.deadlineDate,
          baseSendDate: osnutek.baseSendDate || ctx.bazaDatumaPosiljanja(),
          insertedText: vrstica,
          messageLanguage: jezik,
        };
        ctx.setPaymentDeadline(novo);
        ctx.dodatki.rok = true;
        ctx.dodatekBesedila.rok = vrstica;
        ctx.gumbRok.setAttribute("aria-pressed", "true");
        predOgledPressed = true;
        ctx.posodobiStanjeUrejevalnika();
        ctx.shraniOsnutekLokalno();
        if (typeof ctx.onAfterChange === "function") ctx.onAfterChange();
        zapriSheet(true, { shranjeno: true });
      } catch (_e) {
        if (typeof ctx.pokaziNapako === "function") {
          ctx.pokaziNapako("Shranjevanje roka plačila ni uspelo. Poskusite znova.");
        }
      } finally {
        shranjevanje = false;
        if (shrani && odprt) {
          shrani.disabled = false;
          var ze = Boolean(ctx.getPaymentDeadline() && ctx.getPaymentDeadline().enabled);
          shrani.textContent = ze ? "Shrani spremembe" : "Shrani in dodaj";
        }
      }
    }

    async function odstraniRokIzSporocilaCeObstaja() {
      var trenutni = ctx.getPaymentDeadline();
      if (!trenutni || !trenutni.enabled) return true;
      var rez = UJ.odstraniSistemskoVrstico(
        ctx.besediloPolje.value,
        trenutni.insertedText || ""
      );
      if (!rez.ok && rez.opozorilo === "spremenjeno") {
        var potrdi = await ctx.potrdiVprasanje({
          naslov: "Vrstice ni mogoče odstraniti",
          opis: "Sistemska vrstica je bila ročno spremenjena. Deaktiviram gumb brez brisanja besedila?",
          potrdiBesedilo: "Deaktiviraj",
          stil: "nevarno",
        });
        if (!potrdi) return false;
      } else {
        ctx.besediloPolje.value = String(rez.besedilo).slice(0, ctx.najvecZnakov);
      }
      ctx.setPaymentDeadline(null);
      ctx.dodatki.rok = false;
      ctx.dodatekBesedila.rok = "";
      ctx.posodobiStanjeUrejevalnika();
      ctx.shraniOsnutekLokalno();
      if (typeof ctx.onAfterChange === "function") ctx.onAfterChange();
      return true;
    }

    async function odstraniRok() {
      zapiranjeDovoljeno = true;
      var ok = await odstraniRokIzSporocilaCeObstaja();
      if (!ok) return;
      predOgledPressed = false;
      ctx.gumbRok.setAttribute("aria-pressed", "false");
      posodobiDatumVidez(false);
      zapriSheet(true);
    }

    /** Izklopi: reset UI + odstrani rok (če obstaja) + zapri. */
    async function izklopiRok() {
      zapiranjeDovoljeno = true;
      var ok = await odstraniRokIzSporocilaCeObstaja();
      if (!ok) return;
      resetirajOsnutekNaPrivzeto();
      predOgledPressed = false;
      ctx.gumbRok.setAttribute("aria-pressed", "false");
      posodobiDatumVidez(false);
      zapriSheet(true);
    }

    ctx.gumbRok.addEventListener("click", function (dogodek) {
      dogodek.preventDefault();
      dogodek.stopPropagation();
      // Po koncu trenutnega tipa – sicer mobilni brskalnik tap prestavi na backdrop.
      window.setTimeout(odpriSheet, 0);
    });

    if (backdrop) {
      backdrop.addEventListener("click", function (dogodek) {
        dogodek.preventDefault();
        dogodek.stopPropagation();
        if (!zapiranjeDovoljeno) return;
        zapriSheet(false);
      });
    }
    if (zapri) {
      zapri.addEventListener("click", function () {
        zapiranjeDovoljeno = true;
        zapriSheet(false);
      });
    }
    if (preklici) {
      preklici.addEventListener("click", function () {
        izklopiRok();
      });
    }
    if (shrani) shrani.addEventListener("click", function () { shraniInDodaj(); });
    if (odstrani) odstrani.addEventListener("click", function () { odstraniRok(); });

    if (samodejno) {
      samodejno.addEventListener("change", function () {
        if (!osnutek) return;
        if (samodejno.checked) {
          osnutek.mode = "automatic";
          preracunajSamodejno();
        } else {
          osnutek.mode = "manual";
          posodobiPomoc();
          oznaciRokPriporociloSpremenjeno();
        }
      });
    }

    if (datumPolje) {
      datumPolje.addEventListener("change", function () {
        if (!osnutek) return;
        osnutek.mode = "manual";
        if (samodejno) samodejno.checked = false;
        osnutek.deadlineDate = datumPolje.value;
        oznaciRokPriporociloSpremenjeno();
        posodobiPomoc();
        preveriDatum();
      });
      datumPolje.addEventListener("input", function () {
        if (!osnutek) return;
        if (document.activeElement === datumPolje) {
          osnutek.mode = "manual";
          if (samodejno) samodejno.checked = false;
        }
        preveriDatum();
      });
    }

    if (urediPovezava) {
      urediPovezava.addEventListener("click", function () {
        if (urediPanel && !urediPanel.hidden) skrijUrediPrivzeto();
        else odpriUrediPrivzeto();
      });
    }
    if (privzetoPreklici) {
      privzetoPreklici.addEventListener("click", skrijUrediPrivzeto);
    }
    if (privzetoPotrdi) {
      privzetoPotrdi.addEventListener("click", function () {
        if (!osnutek || !osnutekPrivzetih || !dneviPolje) return;
        var n = Number(osnutek.linkedProposalNumber) || 1;
        var dnevi = Number(dneviPolje.value);
        if (!Number.isFinite(dnevi) || dnevi < 1 || dnevi > 365) {
          if (napaka) {
            napaka.hidden = false;
            napaka.textContent = "Število dni mora biti med 1 in 365.";
          }
          if (shrani) shrani.disabled = true;
          return;
        }
        var kandidat = klon(osnutekPrivzetih);
        kandidat[n] = dnevi;
        if (!UJ.soDneviNarascajoci(kandidat)) {
          if (napaka) {
            napaka.hidden = false;
            napaka.textContent =
              "Privzeti roki od predloga 1 do 9 morajo biti naraščajoči.";
          }
          if (shrani) shrani.disabled = true;
          return;
        }
        osnutekPrivzetih = kandidat;
        osnutek.termDays = dnevi;
        if (osnutek.mode === "automatic") preracunajSamodejno();
        else {
          posodobiPomoc();
          preveriDatum();
        }
        skrijUrediPrivzeto();
      });
    }

    return { odpri: odpriSheet, zapri: zapriSheet };
  }

  root.inicializirajRokPlacilaSheet = inicializirajRokPlacilaSheet;
})(typeof globalThis !== "undefined" ? globalThis : this);
