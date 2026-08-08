/* ========== Obročno plačilo – bottom sheet UI ========== */
(function (root) {
  "use strict";

  function inicializirajObrocnoSheet(ctx) {
    var UJ = root.UJObrocno;
    var Rok = root.UJRokPlacila;
    var sheet = document.getElementById("obrocno-sheet");
    if (!UJ || !sheet || !ctx || !ctx.gumbObrocno) {
      if (ctx && ctx.gumbObrocno) {
        ctx.gumbObrocno.addEventListener("click", function () {
          if (typeof ctx.pokaziNapako === "function") {
            ctx.pokaziNapako(
              "Nastavitve obročnega plačila se niso naložile. Osvežite stran (Ctrl+F5)."
            );
          }
        });
      }
      return;
    }

    if (sheet.parentElement !== document.body) {
      document.body.appendChild(sheet);
    }

    var backdrop = document.getElementById("obrocno-sheet-backdrop");
    var panel = document.getElementById("obrocno-sheet-panel");
    var naslov = document.getElementById("obrocno-sheet-naslov");
    var gumbZapri = document.getElementById("obrocno-sheet-zapri");
    var znacka = document.getElementById("obrocno-sheet-znacka");
    var znesekEl = document.getElementById("obrocno-sheet-znesek");
    var opozorilo = document.getElementById("obrocno-sheet-opozorilo");
    var stevilke = document.getElementById("obrocno-sheet-stevilke");
    var razmik = document.getElementById("obrocno-sheet-razmik");
    var seznam = document.getElementById("obrocno-sheet-seznam");
    var skupaj = document.getElementById("obrocno-sheet-skupaj");
    var napaka = document.getElementById("obrocno-sheet-napaka");
    var addon = document.getElementById("obrocno-sheet-addon");
    var enakomerno = document.getElementById("obrocno-sheet-enakomerno");
    var preklici = document.getElementById("obrocno-sheet-preklici");
    var shrani = document.getElementById("obrocno-sheet-shrani");
    var odstrani = document.getElementById("obrocno-sheet-odstrani");
    var live = document.getElementById("obrocno-sheet-live");
    var undoEl = document.getElementById("obrocno-sheet-undo");

    var odprt = false;
    var osnutek = null;
    var shranjevanje = false;
    var prejsnjiFokus = null;
    var zapiranjeDovoljeno = false;
    var casovnikZapiranja = null;
    var undoPaket = null;
    var undoCasovnik = null;

    function klon(o) {
      return o ? JSON.parse(JSON.stringify(o)) : null;
    }

    function sporoci(besedilo) {
      if (live) live.textContent = besedilo || "";
    }

    function jezikAddon() {
      if (typeof ctx.getJezik === "function") return ctx.getJezik();
      if (Rok && ctx.besediloPolje) {
        return Rok.ugotoviJezikSporocila(ctx.besediloPolje.value);
      }
      return "de";
    }

    function zgradiStevilke() {
      if (!stevilke) return;
      stevilke.innerHTML = "";
      for (var n = UJ.MIN_OBROKOV; n <= UJ.MAX_OBROKOV; n++) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "rok-sheet__stevilka obrocno-sheet__stevilka";
        b.textContent = String(n);
        b.setAttribute("aria-label", "Izberi " + n + " obrokov");
        b.dataset.n = String(n);
        b.addEventListener("click", function (ev) {
          var st = Number(ev.currentTarget.dataset.n);
          spremeniStevilo(st);
        });
        stevilke.appendChild(b);
      }
    }

    function posodobiStevilkeUi() {
      if (!stevilke || !osnutek) return;
      stevilke.querySelectorAll("button").forEach(function (b) {
        var sel = Number(b.dataset.n) === osnutek.installmentCount;
        b.setAttribute("aria-selected", sel ? "true" : "false");
        if (sel) {
          b.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
        }
      });
    }

    async function spremeniStevilo(st) {
      if (!osnutek) return;
      var current = osnutek.installmentCount;
      if (st === current) return;
      if (st < current) {
        var odrezani = osnutek.installments.slice(st);
        var imaRocne = odrezani.some(function (r) {
          return r.amountMode === "manual";
        });
        if (imaRocne) {
          var ok = await ctx.potrdiVprasanje({
            naslov: "Zmanjšam število obrokov?",
            opis:
              "Sprememba števila obrokov bo odstranila ročno nastavljen obrok. Želite nadaljevati?",
            potrdiBesedilo: "Nadaljuj",
            stil: "primary",
          });
          if (!ok) return;
        }
      }
      osnutek = UJ.nastaviSteviloObrokov(osnutek, st);
      osnutek = UJ.osveziAddon(osnutek, jezikAddon());
      izrisi();
    }

    function posodobiPovzetek() {
      if (!osnutek) return;
      var v = UJ.validatePlan(osnutek);
      if (skupaj) {
        skupaj.textContent = "Skupaj " + UJ.formatCentsSl(osnutek.totalDebtCents);
        skupaj.classList.toggle("obrocno-sheet__skupaj--ok", v.ok);
        skupaj.classList.toggle("obrocno-sheet__skupaj--napaka", !v.ok);
      }
      var sporociloNapake = "";
      if (!v.ok && v.errors.length) {
        sporociloNapake =
          "Shranjevanje ni mogoče: " + v.errors[0].message;
      } else if (v.warnings.length) {
        sporociloNapake = v.warnings[0].message;
      }
      if (napaka) {
        if (sporociloNapake) {
          napaka.hidden = false;
          napaka.textContent = sporociloNapake;
        } else {
          napaka.hidden = true;
          napaka.textContent = "";
        }
      }
      var napakaNoga = document.getElementById("obrocno-sheet-napaka-noga");
      if (napakaNoga) {
        if (!v.ok && sporociloNapake) {
          napakaNoga.hidden = false;
          napakaNoga.textContent = sporociloNapake;
        } else {
          napakaNoga.hidden = true;
          napakaNoga.textContent = "";
        }
      }
      if (shrani) {
        shrani.disabled = !v.ok || shranjevanje;
        if (!v.ok && sporociloNapake) {
          shrani.setAttribute("aria-describedby", "obrocno-sheet-napaka-noga");
          shrani.title = sporociloNapake;
        } else {
          shrani.removeAttribute("aria-describedby");
          shrani.removeAttribute("title");
        }
      }
      if (addon) addon.textContent = osnutek.addonText || "";
      if (znacka) {
        znacka.textContent =
          osnutek.source === "custom" ? "Prilagojen načrt" : "Samodejni predlog";
      }
    }

    function izrisiVrstice() {
      if (!seznam || !osnutek) return;
      osnutek = UJ.uskladiSteviloVrstic(osnutek);
      seznam.innerHTML = "";
      (osnutek.installments || []).forEach(function (row) {
        var art = document.createElement("article");
        art.className = "obrocno-sheet__vrstica";
        art.dataset.id = row.id;

        // Ena vodoravna vrstica (mockup): naslov | znesek | datum | ×
        var levo = document.createElement("div");
        levo.className = "obrocno-sheet__vrstica-levo";
        var naslovV = document.createElement("span");
        naslovV.className = "obrocno-sheet__vrstica-naslov";
        naslovV.textContent = row.order + ". obrok";
        levo.appendChild(naslovV);
        if (row.amountMode === "manual") {
          var badge = document.createElement("span");
          badge.className = "obrocno-sheet__rocno";
          badge.textContent = "Ročno";
          levo.appendChild(badge);
        }

        var znesek = document.createElement("input");
        znesek.type = "text";
        znesek.inputMode = "decimal";
        znesek.className = "obrocno-sheet__znesek";
        if (row.amountMode === "manual") {
          znesek.className += " obrocno-sheet__znesek--rocno";
        }
        znesek.value = UJ.formatCentsSl(row.amountCents);
        znesek.setAttribute("aria-label", "Znesek " + row.order + ". obroka");
        znesek.addEventListener("blur", function () {
          potrdiZnesek(row.id, znesek);
        });
        znesek.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") {
            ev.preventDefault();
            znesek.blur();
          }
        });

        var datumOvoj = document.createElement("div");
        datumOvoj.className = "obrocno-sheet__datum-ovoj";
        var datum = document.createElement("input");
        datum.type = "date";
        datum.className = "obrocno-sheet__datum";
        datum.value = row.dueDate || "";
        datum.setAttribute("aria-label", "Datum " + row.order + ". obroka");
        datum.addEventListener("change", function () {
          osnutek = UJ.nastaviDatum(osnutek, row.id, datum.value);
          osnutek = UJ.osveziAddon(osnutek, jezikAddon());
          if (razmik) razmik.value = osnutek.intervalType;
          izrisi();
        });
        var datumIkona = document.createElement("span");
        datumIkona.className = "obrocno-sheet__datum-ikona";
        datumIkona.setAttribute("aria-hidden", "true");
        datumIkona.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>';
        datumOvoj.appendChild(datum);
        datumOvoj.appendChild(datumIkona);

        var x = document.createElement("button");
        x.type = "button";
        x.className = "obrocno-sheet__odstrani-vrstico";
        x.setAttribute("aria-label", "Odstrani " + row.order + ". obrok");
        x.textContent = "×";
        x.addEventListener("click", function () {
          odstraniVrstico(row.id);
        });

        art.appendChild(levo);
        art.appendChild(znesek);
        art.appendChild(datumOvoj);
        art.appendChild(x);
        seznam.appendChild(art);
      });
    }

    function potrdiZnesek(id, input) {
      var cents = UJ.parseAmountToCents(input.value);
      if (cents == null || cents <= 0) {
        sporoci("Neveljaven znesek.");
        izrisi();
        return;
      }
      osnutek = UJ.nastaviRocniZnesek(osnutek, id, cents);
      osnutek = UJ.osveziAddon(osnutek, jezikAddon());
      izrisi();
      sporoci("Zneski preračunani.");
    }

    function odstraniVrstico(id) {
      var rez = UJ.odstraniObrok(osnutek, id);
      if (!rez.ok) {
        if (rez.code === "min_two") {
          ctx.potrdiVprasanje({
            naslov: "Najmanj dva obroka",
            opis:
              "Obročno plačilo mora vsebovati najmanj dva obroka. Za enkratno plačilo uporabite možnost »Rok plačila«.",
            potrdiBesedilo: "V redu",
            samoEnGumb: true,
            stil: "primary",
          });
        }
        return;
      }
      osnutek = UJ.osveziAddon(rez.plan, jezikAddon());
      undoPaket = rez.undo;
      if (undoCasovnik) clearTimeout(undoCasovnik);
      if (undoEl) {
        undoEl.hidden = false;
      }
      undoCasovnik = setTimeout(function () {
        undoPaket = null;
        if (undoEl) undoEl.hidden = true;
      }, 5000);
      izrisi();
      sporoci("Obrok odstranjen.");
    }

    function izrisi() {
      if (osnutek) osnutek = UJ.uskladiSteviloVrstic(osnutek);
      posodobiStevilkeUi();
      if (razmik && osnutek) razmik.value = osnutek.intervalType;
      izrisiVrstice();
      posodobiPovzetek();
      var shranjen = ctx.getInstallmentPlan && ctx.getInstallmentPlan();
      var shranjenOk =
        shranjen &&
        shranjen.enabled &&
        UJ.jePlanUporaben(shranjen, osnutek ? osnutek.totalDebtCents : 0);
      if (odstrani) odstrani.hidden = !shranjenOk;
      if (shrani) {
        shrani.textContent = shranjenOk ? "Shrani spremembe" : "Shrani in dodaj";
      }
    }

    function napolniOpozorilo() {
      if (!opozorilo || !osnutek) return;
      var d = osnutek.overdueDaysSnapshot;
      if (d != null && d < 0) {
        opozorilo.hidden = false;
        opozorilo.textContent =
          "Račun še ni zapadel. Račun zapade čez " + Math.abs(d) + " dni.";
      } else {
        opozorilo.hidden = true;
      }
    }

    function sveziPredlog(total) {
      return UJ.getInstallmentSuggestion({
        totalDebtCents: total,
        originalDueDate:
          typeof ctx.getOriginalDueDate === "function"
            ? ctx.getOriginalDueDate()
            : null,
        plannedSendDate:
          typeof ctx.bazaDatumaPosiljanja === "function"
            ? ctx.bazaDatumaPosiljanja()
            : UJ.danesYYYYMMDD(),
        linkedProposalNumber:
          typeof ctx.stevilkaIzbranegaPredloga === "function"
            ? ctx.stevilkaIzbranegaPredloga()
            : null,
        toneId: typeof ctx.getToneId === "function" ? ctx.getToneId() : null,
        language: jezikAddon(),
      });
    }

    function odpri() {
      var total =
        typeof ctx.getTotalDebtCents === "function"
          ? ctx.getTotalDebtCents()
          : 0;
      if (!Number.isFinite(total) || total <= 0) {
        if (typeof ctx.pokaziNapako === "function") {
          ctx.pokaziNapako(
            "Znesek dolga ni na voljo. Preverite vnos v prvem koraku."
          );
        }
        return;
      }

      var existing = ctx.getInstallmentPlan ? ctx.getInstallmentPlan() : null;
      if (existing && existing.enabled && UJ.jePlanUporaben(existing, total)) {
        osnutek = klon(existing);
        osnutek.totalDebtCents = total;
        osnutek = UJ.uskladiSteviloVrstic(osnutek);
        osnutek = UJ.osveziAddon(osnutek, jezikAddon());
      } else {
        // Stari/pokvarjen načrt zavrzi – vedno svež predlog iz koraka 1.
        if (existing && typeof ctx.setInstallmentPlan === "function") {
          ctx.setInstallmentPlan(null);
        }
        if (ctx.dodatki) ctx.dodatki.obrocno = false;
        osnutek = sveziPredlog(total);
        osnutek = UJ.uskladiSteviloVrstic(osnutek);
      }

      if (znesekEl) znesekEl.textContent = UJ.formatCentsSl(osnutek.totalDebtCents);
      napolniOpozorilo();
      izrisi();

      prejsnjiFokus = document.activeElement;
      sheet.hidden = false;
      odprt = true;
      document.body.style.overflow = "hidden";
      zapiranjeDovoljeno = false;
      if (casovnikZapiranja) clearTimeout(casovnikZapiranja);
      casovnikZapiranja = setTimeout(function () {
        zapiranjeDovoljeno = true;
      }, 400);
      if (ctx.gumbObrocno) ctx.gumbObrocno.setAttribute("aria-pressed", "true");
      window.setTimeout(function () {
        if (naslov) naslov.focus();
      }, 10);
    }

    function zapriSheet(brezObnove) {
      odprt = false;
      if (sheet) sheet.hidden = true;
      document.body.style.overflow = "";
      osnutek = null;
      if (!brezObnove) {
        var plan = ctx.getInstallmentPlan ? ctx.getInstallmentPlan() : null;
        var total =
          typeof ctx.getTotalDebtCents === "function"
            ? ctx.getTotalDebtCents()
            : 0;
        var aktiven = plan && plan.enabled && UJ.jePlanUporaben(plan, total);
        if (ctx.gumbObrocno) {
          ctx.gumbObrocno.setAttribute("aria-pressed", aktiven ? "true" : "false");
        }
      }
      if (prejsnjiFokus && typeof prejsnjiFokus.focus === "function") {
        try {
          prejsnjiFokus.focus();
        } catch (_e) {
          if (ctx.gumbObrocno) ctx.gumbObrocno.focus();
        }
      } else if (ctx.gumbObrocno) {
        ctx.gumbObrocno.focus();
      }
    }

    function vstaviAddon(besedilo) {
      if (!Rok || !ctx.besediloPolje) {
        var osnova = ctx.besediloPolje.value.replace(/\s+$/, "");
        ctx.besediloPolje.value = (osnova ? osnova + "\n\n" + besedilo : besedilo).slice(
          0,
          ctx.najvecZnakov || 1000
        );
        return;
      }
      var stara = (ctx.dodatekBesedila && ctx.dodatekBesedila.obrocno) || "";
      var rez = Rok.posodobiSistemskoVrstico(
        ctx.besediloPolje.value,
        stara,
        besedilo,
        true
      );
      ctx.besediloPolje.value = String(rez.besedilo).slice(0, ctx.najvecZnakov || 1000);
    }

    function odstraniAddonIzBesedila() {
      var stara = (ctx.dodatekBesedila && ctx.dodatekBesedila.obrocno) || "";
      if (!stara || !ctx.besediloPolje) return;
      if (Rok) {
        var rez = Rok.posodobiSistemskoVrstico(
          ctx.besediloPolje.value,
          stara,
          "",
          false
        );
        ctx.besediloPolje.value = String(rez.besedilo);
      } else if (ctx.besediloPolje.value.includes(stara)) {
        ctx.besediloPolje.value = ctx.besediloPolje.value.split(stara).join("").trim();
      }
    }

    async function shraniPlan() {
      if (!osnutek || shranjevanje) return;
      osnutek = UJ.osveziAddon(osnutek, jezikAddon());
      var v = UJ.validatePlan(osnutek);
      if (!v.ok) {
        posodobiPovzetek();
        return;
      }

      // Konflikt z rokom
      var rok = ctx.getPaymentDeadline ? ctx.getPaymentDeadline() : null;
      if (rok && rok.enabled) {
        var ok = await ctx.potrdiVprasanje({
          naslov: "Nadomestim rok plačila?",
          opis:
            "Obročno plačilo bo nadomestilo enkratni rok plačila. Želite nadaljevati?",
          potrdiBesedilo: "Nadaljuj",
          stil: "primary",
        });
        if (!ok) return;
        if (rok.insertedText && Rok) {
          var r = Rok.posodobiSistemskoVrstico(
            ctx.besediloPolje.value,
            rok.insertedText,
            "",
            false
          );
          ctx.besediloPolje.value = String(r.besedilo);
        }
        if (ctx.setPaymentDeadline) ctx.setPaymentDeadline(null);
        if (ctx.dodatki) ctx.dodatki.rok = false;
        if (ctx.dodatekBesedila) ctx.dodatekBesedila.rok = "";
        if (ctx.gumbRok) ctx.gumbRok.setAttribute("aria-pressed", "false");
      }

      // Ročno urejen dodatek
      var obstojeci = ctx.getInstallmentPlan ? ctx.getInstallmentPlan() : null;
      if (
        obstojeci &&
        obstojeci.addonManuallyEdited &&
        ctx.dodatekBesedila &&
        ctx.dodatekBesedila.obrocno
      ) {
        var zamenjaj = await ctx.potrdiVprasanje({
          naslov: "Zamenjam dodatek?",
          opis:
            "Dodatek o obročnem plačilu ste v sporočilu ročno spremenili. Sistemski tekst bo zamenjan. Nadaljujem?",
          potrdiBesedilo: "Zamenjaj",
          stil: "primary",
        });
        if (!zamenjaj) return;
      }

      shranjevanje = true;
      if (shrani) shrani.disabled = true;
      try {
        osnutek.enabled = true;
        osnutek.addonManuallyEdited = false;
        osnutek.updatedAt = new Date().toISOString();
        vstaviAddon(osnutek.addonText);
        if (ctx.dodatki) ctx.dodatki.obrocno = true;
        if (ctx.dodatekBesedila) ctx.dodatekBesedila.obrocno = osnutek.addonText;
        if (ctx.setInstallmentPlan) ctx.setInstallmentPlan(klon(osnutek));
        if (ctx.gumbObrocno) ctx.gumbObrocno.setAttribute("aria-pressed", "true");
        if (typeof ctx.posodobiStanjeUrejevalnika === "function") {
          ctx.posodobiStanjeUrejevalnika();
        }
        if (typeof ctx.shraniOsnutekLokalno === "function") {
          ctx.shraniOsnutekLokalno();
        }
        zapriSheet(true);
      } finally {
        shranjevanje = false;
      }
    }

    async function odstraniPlan() {
      var ok = await ctx.potrdiVprasanje({
        naslov: "Odstranim obročno plačilo?",
        opis: "Dodatek bo odstranjen iz sporočila.",
        potrdiBesedilo: "Odstrani",
        stil: "nevarno",
      });
      if (!ok) return;
      odstraniAddonIzBesedila();
      if (ctx.dodatki) ctx.dodatki.obrocno = false;
      if (ctx.dodatekBesedila) ctx.dodatekBesedila.obrocno = "";
      if (ctx.setInstallmentPlan) ctx.setInstallmentPlan(null);
      if (ctx.gumbObrocno) ctx.gumbObrocno.setAttribute("aria-pressed", "false");
      if (typeof ctx.posodobiStanjeUrejevalnika === "function") {
        ctx.posodobiStanjeUrejevalnika();
      }
      if (typeof ctx.shraniOsnutekLokalno === "function") {
        ctx.shraniOsnutekLokalno();
      }
      zapriSheet(true);
    }

    zgradiStevilke();

    ctx.gumbObrocno.addEventListener("click", function () {
      if (odprt) return;
      odpri();
    });

    function poskusiZapri() {
      if (!zapiranjeDovoljeno) return;
      zapriSheet(false);
    }

    if (backdrop) backdrop.addEventListener("click", poskusiZapri);
    if (gumbZapri) {
      gumbZapri.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        zapriSheet(false);
      });
    }
    if (preklici) {
      preklici.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        zapriSheet(false);
      });
    }
    if (shrani) {
      shrani.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (shrani.disabled) {
          posodobiPovzetek();
          var noga = document.getElementById("obrocno-sheet-napaka-noga");
          if (noga && !noga.hidden) {
            noga.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
          return;
        }
        shraniPlan();
      });
    }
    if (odstrani) odstrani.addEventListener("click", function () { odstraniPlan(); });
    if (enakomerno) {
      enakomerno.addEventListener("click", async function () {
        if (!osnutek) return;
        var imaRocne = osnutek.installments.some(function (r) {
          return r.amountMode === "manual";
        });
        if (imaRocne) {
          var ok = await ctx.potrdiVprasanje({
            naslov: "Enakomerno razdelim?",
            opis: "Vse oznake »Ročno« bodo odstranjene.",
            potrdiBesedilo: "Razdeli",
            stil: "primary",
          });
          if (!ok) return;
        }
        osnutek = UJ.enakomernoRazdeli(osnutek);
        osnutek = UJ.osveziAddon(osnutek, jezikAddon());
        izrisi();
      });
    }
    if (razmik) {
      razmik.addEventListener("change", function () {
        if (!osnutek) return;
        osnutek = UJ.nastaviRazmik(osnutek, razmik.value);
        osnutek = UJ.osveziAddon(osnutek, jezikAddon());
        izrisi();
      });
    }
    if (undoEl) {
      undoEl.addEventListener("click", function () {
        if (!undoPaket || !osnutek) return;
        osnutek = UJ.razveljaviOdstranitev(osnutek, undoPaket);
        osnutek = UJ.osveziAddon(osnutek, jezikAddon());
        undoPaket = null;
        undoEl.hidden = true;
        if (undoCasovnik) clearTimeout(undoCasovnik);
        izrisi();
        sporoci("Odstranitev razveljavljena.");
      });
    }

    document.addEventListener("keydown", function (ev) {
      if (!odprt) return;
      if (ev.key === "Escape") {
        ev.preventDefault();
        zapriSheet(false);
      }
    });

    return { odpri: odpri, zapri: zapriSheet };
  }

  root.inicializirajObrocnoSheet = inicializirajObrocnoSheet;
})(typeof globalThis !== "undefined" ? globalThis : this);
