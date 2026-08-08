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

    function klon(obj) {
      return obj ? JSON.parse(JSON.stringify(obj)) : null;
    }

    function nastaviNapako(pokazi) {
      if (!napaka) return;
      napaka.hidden = !pokazi;
      if (shrani) shrani.disabled = Boolean(pokazi) || shranjevanje;
    }

    function posodobiPomoc() {
      if (!pomoc || !osnutek) return;
      if (osnutek.mode === "manual") {
        pomoc.textContent = "Ročno nastavljen datum";
        return;
      }
      var d = Number(osnutek.termDays) || 0;
      pomoc.textContent = "Privzeto: " + d + " dni od pošiljanja";
    }

    function preracunajSamodejno() {
      if (!osnutek || osnutek.mode !== "automatic") return;
      var n = Number(osnutek.linkedProposalNumber) || 1;
      var days = Number(osnutekPrivzetih[n]) || Number(ctx.getPrivzetiDnevi()[n]) || 5;
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

    function napolniUiIzOsnutka() {
      if (!osnutek) return;
      zgradiStevilke();
      if (samodejno) samodejno.checked = osnutek.mode !== "manual";
      if (datumPolje) datumPolje.value = osnutek.deadlineDate || "";
      oznaciStevilko(Number(osnutek.linkedProposalNumber) || 1);
      posodobiPomoc();
      preveriDatum();
      skrijUrediPrivzeto();

      var ze = Boolean(ctx.getPaymentDeadline() && ctx.getPaymentDeadline().enabled);
      if (shrani) {
        shrani.textContent = ze ? "Shrani spremembe" : "Shrani in dodaj";
      }
      if (odstrani) odstrani.hidden = !ze;
    }

    function napolniOsnutekObOdprtju() {
      var obstojeci = ctx.getPaymentDeadline();
      var linked = obstojeci && obstojeci.linkedProposalNumber
        ? Number(obstojeci.linkedProposalNumber)
        : ctx.stevilkaIzbranegaPredloga();
      if (!(linked >= 1 && linked <= 9)) linked = 1;

      osnutekPrivzetih = klon(ctx.getPrivzetiDnevi());
      var base = ctx.bazaDatumaPosiljanja();
      var days = Number(osnutekPrivzetih[linked]) || 5;

      if (obstojeci && obstojeci.enabled) {
        osnutek = klon(obstojeci);
        if (!osnutek.linkedProposalNumber) osnutek.linkedProposalNumber = linked;
        if (osnutek.mode === "automatic") {
          osnutek.termDays = Number(osnutekPrivzetih[osnutek.linkedProposalNumber]) || days;
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
          termDays: days,
          deadlineDate: UJ.izracunajRok(base, days),
          baseSendDate: base,
          insertedText: "",
          messageLanguage: "sl",
        };
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

    function odpriSheet() {
      if (odprt) return;
      try {
        predOgledPressed = ctx.gumbRok.getAttribute("aria-pressed") === "true";
        prejsnjiFokus = document.activeElement;
        napolniOsnutekObOdprtju();
        napolniUiIzOsnutka();

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
          else if (samodejno) samodejno.focus();
        }, 10);
      } catch (napaka) {
        if (typeof ctx.pokaziNapako === "function") {
          ctx.pokaziNapako(
            "Odpiranje roka plačila ni uspelo. Osvežite stran.",
            napaka && napaka.message ? napaka.message : ""
          );
        }
      }
    }

    function zapriSheet(shraniSpremembe) {
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
      if (casovnikZapiranja) {
        window.clearTimeout(casovnikZapiranja);
        casovnikZapiranja = null;
      }
      document.removeEventListener("keydown", onKeydown, true);
      skrijUrediPrivzeto();
      nastaviNapako(false);
      if (ctx.gumbRok && typeof ctx.gumbRok.focus === "function") {
        ctx.gumbRok.focus();
      } else if (prejsnjiFokus && prejsnjiFokus.focus) {
        prejsnjiFokus.focus();
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
        var novo = {
          enabled: true,
          mode: osnutek.mode === "manual" ? "manual" : "automatic",
          linkedProposalNumber: Number(osnutek.linkedProposalNumber) || 1,
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
        zapriSheet(true);
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

    async function odstraniRok() {
      var trenutni = ctx.getPaymentDeadline();
      if (!trenutni || !trenutni.enabled) {
        zapriSheet(false);
        return;
      }
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
        if (!potrdi) return;
      } else {
        ctx.besediloPolje.value = String(rez.besedilo).slice(0, ctx.najvecZnakov);
      }
      ctx.setPaymentDeadline(null);
      ctx.dodatki.rok = false;
      ctx.dodatekBesedila.rok = "";
      ctx.gumbRok.setAttribute("aria-pressed", "false");
      predOgledPressed = false;
      ctx.posodobiStanjeUrejevalnika();
      ctx.shraniOsnutekLokalno();
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
        zapiranjeDovoljeno = true;
        zapriSheet(false);
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
        }
      });
    }

    if (datumPolje) {
      datumPolje.addEventListener("change", function () {
        if (!osnutek) return;
        osnutek.mode = "manual";
        if (samodejno) samodejno.checked = false;
        osnutek.deadlineDate = datumPolje.value;
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
  }

  root.inicializirajRokPlacilaSheet = inicializirajRokPlacilaSheet;
})(typeof globalThis !== "undefined" ? globalThis : this);
