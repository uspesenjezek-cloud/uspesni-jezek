/* ========== Obročno plačilo – mobilni celozaslonski urejevalnik ========== */
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
    var naslov = document.getElementById("obrocno-sheet-naslov");
    var gumbZapri = document.getElementById("obrocno-sheet-zapri");
    var vklop = document.getElementById("obrocno-sheet-vklop");
    var vklopOpis = document.getElementById("obrocno-sheet-vklop-opis");
    var vklopStanje = document.getElementById("obrocno-sheet-vklop-stanje");
    var vklopPomoc = document.getElementById("obrocno-sheet-vklop-pomoc");
    var nastavitve = document.getElementById("obrocno-sheet-nastavitve");
    var znacka = document.getElementById("obrocno-sheet-znacka");
    var znesekEl = document.getElementById("obrocno-sheet-znesek");
    var opozorilo = document.getElementById("obrocno-sheet-opozorilo");
    var stevilke = document.getElementById("obrocno-sheet-stevilke");
    var razmik = document.getElementById("obrocno-sheet-razmik");
    var seznam = document.getElementById("obrocno-sheet-seznam");
    var telo = sheet.querySelector(".rok-sheet__telo");
    var skupaj = document.getElementById("obrocno-sheet-skupaj");
    var napaka = document.getElementById("obrocno-sheet-napaka");
    var addon = document.getElementById("obrocno-sheet-addon");
    var enakomerno = document.getElementById("obrocno-sheet-enakomerno");
    var preklici = document.getElementById("obrocno-sheet-preklici");
    var shrani = document.getElementById("obrocno-sheet-shrani");
    var nogaGlobal = document.getElementById("obrocno-sheet-noga-global");
    var editAkcije = document.getElementById("obrocno-sheet-edit-akcije");
    var editPreklici = document.getElementById("obrocno-sheet-edit-preklici");
    var editOk = document.getElementById("obrocno-sheet-edit-ok");
    var live = document.getElementById("obrocno-sheet-live");
    var undoEl = document.getElementById("obrocno-sheet-undo");
    var dodatekObrocnoStanje = document.getElementById("dodatek-obrocno-stanje");

    var odprt = false;
    var osnutek = null;
    var shranjevanje = false;
    var prejsnjiFokus = null;
    var zapiranjeDovoljeno = false;
    var casovnikZapiranja = null;
    var undoPaket = null;
    var undoCasovnik = null;
    var scrollY = 0;
    var scrollFokusCasovnik = null;
    var draftEnabled = false;
    var originalEnabled = false;
    var originalPlan = null;
    var editingInstallmentId = null;
    var editSnapshotCents = null;
    var editInputEl = null;
    var potrjujemUrejanje = false;

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

    function besediloIntervala(type) {
      if (type === "weekly") return "tedensko";
      if (type === "biweekly") return "vsaka 2 tedna";
      if (type === "monthly") return "mesečno";
      return "";
    }

    /** Posodobi gumb in stanje na glavni strani (samo ob Shrani / Prekliči). */
    function posodobiZunanjoKartico(planOrNull) {
      var total =
        typeof ctx.getTotalDebtCents === "function"
          ? ctx.getTotalDebtCents()
          : 0;
      var aktiven =
        planOrNull &&
        planOrNull.enabled &&
        UJ.jePlanUporaben(planOrNull, total);
      if (ctx.gumbObrocno) {
        ctx.gumbObrocno.setAttribute("aria-pressed", aktiven ? "true" : "false");
      }
      if (dodatekObrocnoStanje) {
        if (!aktiven) {
          dodatekObrocnoStanje.textContent = "Izklopljeno";
        } else {
          var n =
            planOrNull.installmentCount ||
            (planOrNull.installments && planOrNull.installments.length) ||
            0;
          var interval = besediloIntervala(planOrNull.intervalType);
          dodatekObrocnoStanje.textContent = interval
            ? n + " obrokov • " + interval
            : n + " obrokov";
        }
      }
    }

    function posodobiVisualViewport() {
      var vv = window.visualViewport;
      if (!vv) return;
      document.documentElement.style.setProperty(
        "--visual-viewport-height",
        vv.height + "px"
      );
      document.documentElement.style.setProperty(
        "--visual-viewport-top",
        vv.offsetTop + "px"
      );
    }

    function vklopiViewportPoslusalce() {
      posodobiVisualViewport();
      if (!window.visualViewport) return;
      window.visualViewport.addEventListener("resize", posodobiVisualViewport);
      window.visualViewport.addEventListener("scroll", posodobiVisualViewport);
    }

    function izklopiViewportPoslusalce() {
      if (!window.visualViewport) return;
      window.visualViewport.removeEventListener("resize", posodobiVisualViewport);
      window.visualViewport.removeEventListener("scroll", posodobiVisualViewport);
      document.documentElement.style.removeProperty("--visual-viewport-height");
      document.documentElement.style.removeProperty("--visual-viewport-top");
    }

    function zakleniOzadje() {
      scrollY = window.scrollY || window.pageYOffset || 0;
      document.body.classList.add("obrocno-sheet-odprt");
      document.body.style.position = "fixed";
      document.body.style.top = "-" + scrollY + "px";
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
    }

    function odkleniOzadje() {
      document.body.classList.remove("obrocno-sheet-odprt");
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      window.scrollTo(0, scrollY);
    }

    function premakniKarticoVVidno(el) {
      if (!el) return;
      if (scrollFokusCasovnik) clearTimeout(scrollFokusCasovnik);
      scrollFokusCasovnik = setTimeout(function () {
        scrollFokusCasovnik = null;
        var kartica = el.closest ? el.closest(".obrocno-sheet__vrstica") : null;
        var cilj = kartica || el;
        try {
          cilj.scrollIntoView({ block: "center", behavior: "smooth" });
        } catch (_e) {
          cilj.scrollIntoView(true);
        }
      }, 250);
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
          if (!draftEnabled) return;
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

    function nastaviKontroleOnemogocene(onemogocene) {
      if (stevilke) {
        stevilke.querySelectorAll("button").forEach(function (b) {
          b.disabled = onemogocene;
          b.setAttribute("aria-disabled", onemogocene ? "true" : "false");
        });
      }
      if (razmik) {
        razmik.disabled = onemogocene;
        razmik.setAttribute("aria-disabled", onemogocene ? "true" : "false");
      }
      if (enakomerno) {
        enakomerno.disabled = onemogocene;
        enakomerno.setAttribute("aria-disabled", onemogocene ? "true" : "false");
      }
      if (seznam) {
        seznam.querySelectorAll(".obrocno-sheet__znesek").forEach(function (inp) {
          inp.disabled = onemogocene;
          inp.setAttribute("aria-disabled", onemogocene ? "true" : "false");
        });
        seznam.querySelectorAll(".obrocno-sheet__datum-native").forEach(function (inp) {
          inp.disabled = onemogocene;
          inp.setAttribute("aria-disabled", onemogocene ? "true" : "false");
        });
        var samoDva =
          osnutek &&
          (osnutek.installments || []).length <= UJ.MIN_OBROKOV;
        seznam.querySelectorAll(".obrocno-sheet__odstrani-vrstico").forEach(function (b) {
          b.disabled = onemogocene || samoDva;
        });
      }
    }

    function posodobiVklopUi() {
      if (vklop) {
        vklop.setAttribute("aria-checked", draftEnabled ? "true" : "false");
        vklop.setAttribute("aria-label", "Vključi/Izključi obročno plačilo");
      }
      if (vklopStanje) {
        vklopStanje.textContent = draftEnabled ? "Vključeno" : "Izklopljeno";
      }
      if (vklopOpis) {
        vklopOpis.textContent = draftEnabled
          ? "Razdelite dolg na več plačil."
          : "Vključite, če želite ponuditi obroke.";
      }

      var shranjen = ctx.getInstallmentPlan ? ctx.getInstallmentPlan() : null;
      var total =
        typeof ctx.getTotalDebtCents === "function"
          ? ctx.getTotalDebtCents()
          : 0;
      var imaShranjen =
        shranjen &&
        shranjen.enabled &&
        UJ.jePlanUporaben(shranjen, total);
      var pokaziPomoc = !draftEnabled && (originalEnabled || imaShranjen);
      if (vklopPomoc) vklopPomoc.hidden = !pokaziPomoc;

      if (nastavitve) {
        nastavitve.classList.toggle(
          "obrocno-sheet__nastavitve--disabled",
          !draftEnabled
        );
      }
      nastaviKontroleOnemogocene(!draftEnabled);
      posodobiPovzetek();
    }

    function preklopiVklop() {
      draftEnabled = !draftEnabled;
      if (draftEnabled && !osnutek) {
        var total =
          typeof ctx.getTotalDebtCents === "function"
            ? ctx.getTotalDebtCents()
            : 0;
        osnutek = sveziPredlog(total);
        osnutek = UJ.uskladiSteviloVrstic(osnutek);
      }
      if (draftEnabled && osnutek) {
        osnutek = UJ.osveziAddon(osnutek, jezikAddon());
      }
      posodobiVklopUi();
      izrisi();
    }

    async function spremeniStevilo(st) {
      if (!osnutek || !draftEnabled) return;
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
      var v = draftEnabled ? UJ.validatePlan(osnutek) : { ok: true, errors: [], warnings: [] };
      if (skupaj) {
        var sum = UJ.vsotaCents(osnutek.installments);
        skupaj.textContent =
          "Skupaj " +
          UJ.formatCentsSl(sum) +
          (sum === osnutek.totalDebtCents
            ? ""
            : " / " + UJ.formatCentsSl(osnutek.totalDebtCents));
        skupaj.classList.toggle("obrocno-sheet__skupaj--ok", v.ok);
        skupaj.classList.toggle("obrocno-sheet__skupaj--napaka", !v.ok);
      }
      var sporociloNapake = "";
      if (draftEnabled) {
        if (!v.ok && v.errors.length) {
          sporociloNapake = "Shranjevanje ni mogoče: " + v.errors[0].message;
        } else if (v.warnings.length) {
          sporociloNapake = v.warnings[0].message;
        }
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
        if (draftEnabled && !v.ok && sporociloNapake) {
          napakaNoga.hidden = false;
          napakaNoga.textContent = sporociloNapake;
        } else {
          napakaNoga.hidden = true;
          napakaNoga.textContent = "";
        }
      }
      if (shrani && !shranjevanje) {
        var lahkoShrani = !draftEnabled || v.ok;
        shrani.disabled = !lahkoShrani;
        shrani.textContent = "Shrani spremembe";
        if (draftEnabled && !v.ok && sporociloNapake) {
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

    function preostaliDolgZaRocni(id) {
      var total = Math.round(Number(osnutek.totalDebtCents) || 0);
      var drugi = 0;
      (osnutek.installments || []).forEach(function (r) {
        if (r.id === id) return;
        if (r.amountMode === "manual") drugi += Number(r.amountCents) || 0;
      });
      return total - drugi;
    }

    function maxDovoljenZnesek(id, cents) {
      var maxDovoljeno = preostaliDolgZaRocni(id);
      var autoOstane = (osnutek.installments || []).filter(function (r) {
        return r.id !== id && r.amountMode !== "manual";
      }).length;
      return autoOstane > 0 ? maxDovoljeno - autoOstane : maxDovoljeno;
    }

    function napakaPodZneskomEl() {
      if (!editInputEl) return null;
      var blok = editInputEl.closest
        ? editInputEl.closest(".obrocno-sheet__vrstica-polja")
        : null;
      if (!blok) return null;
      var prviStolpec = blok.firstElementChild;
      return prviStolpec
        ? prviStolpec.querySelector(".obrocno-sheet__znesek-napaka-vrstica")
        : null;
    }

    function pocistiNapakoUrejanja() {
      if (editInputEl) {
        editInputEl.classList.remove("obrocno-sheet__znesek--napaka");
      }
      var errEl = napakaPodZneskomEl();
      if (errEl) {
        errEl.hidden = true;
        errEl.textContent = "";
      }
    }

    function prikaziNapakoUrejanja(sporocilo) {
      if (editInputEl) {
        editInputEl.classList.add("obrocno-sheet__znesek--napaka");
      }
      var errEl = napakaPodZneskomEl();
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = sporocilo;
      }
    }

    function validateEditAmount() {
      var rez = { ok: false, message: "" };
      if (!editInputEl || !osnutek || !editingInstallmentId) {
        if (editOk) editOk.disabled = true;
        return rez;
      }
      var raw = String(editInputEl.value || "").trim();
      if (!raw) {
        rez.message = "Vnesite znesek.";
        if (editOk) editOk.disabled = true;
        return rez;
      }
      var cents = UJ.parseAmountToCents(raw);
      if (cents == null || cents <= 0) {
        rez.message = "Neveljaven znesek.";
        if (editOk) editOk.disabled = true;
        return rez;
      }
      var maxZnesek = maxDovoljenZnesek(editingInstallmentId, cents);
      if (cents > maxZnesek) {
        rez.message = "Znesek obroka presega preostali dolg.";
        if (editOk) editOk.disabled = true;
        return rez;
      }
      rez.ok = true;
      if (editOk) editOk.disabled = false;
      return rez;
    }

    function izhodIzUrejanjaZneska() {
      if (editInputEl) {
        editInputEl.classList.remove("obrocno-sheet__znesek--napaka");
      }
      var art =
        seznam && editingInstallmentId
          ? seznam.querySelector('[data-id="' + editingInstallmentId + '"]')
          : null;
      if (art) art.classList.remove("obrocno-sheet__vrstica--urejanje");
      sheet.classList.remove("obrocno-sheet--ureja-znesek");
      if (editAkcije) editAkcije.hidden = true;
      if (nogaGlobal) nogaGlobal.hidden = false;
      editingInstallmentId = null;
      editSnapshotCents = null;
      editInputEl = null;
    }

    function prekliciUrejanjeZneska(brezBlur) {
      if (!editingInstallmentId || !editInputEl) {
        izhodIzUrejanjaZneska();
        return;
      }
      var input = editInputEl;
      input.value = UJ.formatCentsPolje(editSnapshotCents);
      pocistiNapakoUrejanja();
      izhodIzUrejanjaZneska();
      if (!brezBlur) {
        potrjujemUrejanje = true;
        input.blur();
      }
    }

    function potrdiUrejanjeZneska() {
      if (!editInputEl || !osnutek || !editingInstallmentId) return;
      var input = editInputEl;
      var id = editingInstallmentId;
      var raw = String(input.value || "").trim();
      if (!raw) {
        prikaziNapakoUrejanja("Vnesite znesek.");
        return;
      }
      var cents = UJ.parseAmountToCents(raw);
      if (cents == null || cents <= 0) {
        prikaziNapakoUrejanja("Vnesite veljaven znesek.");
        return;
      }
      var maxZnesek = maxDovoljenZnesek(id, cents);
      if (cents > maxZnesek) {
        prikaziNapakoUrejanja("Znesek obroka presega preostali dolg.");
        return;
      }
      if (Number.isFinite(editSnapshotCents) && cents === editSnapshotCents) {
        prekliciUrejanjeZneska(false);
        return;
      }
      osnutek = UJ.nastaviRocniZnesek(osnutek, id, cents);
      osnutek = UJ.osveziAddon(osnutek, jezikAddon());
      pocistiNapakoUrejanja();
      osveziVrsticeBrezFokusa();
      potrjujemUrejanje = true;
      input.blur();
      izhodIzUrejanjaZneska();
      sporoci("Zneski preračunani.");
    }

    function vstopiVUrejanjeZneska(row, znesek, art) {
      if (editingInstallmentId && editingInstallmentId !== row.id) {
        prekliciUrejanjeZneska(true);
      }
      editingInstallmentId = row.id;
      editSnapshotCents = Number(znesek.dataset.zacetniCenti) || 0;
      editInputEl = znesek;
      sheet.classList.add("obrocno-sheet--ureja-znesek");
      art.classList.add("obrocno-sheet__vrstica--urejanje");
      if (editAkcije) editAkcije.hidden = false;
      if (nogaGlobal) nogaGlobal.hidden = true;
      znesek.value = UJ.formatCentsEditable(editSnapshotCents);
      znesek.classList.remove("obrocno-sheet__znesek--napaka");
      pocistiNapakoUrejanja();
      validateEditAmount();
      premakniKarticoVVidno(art);
    }

    /** Posodobi prikaze zneskov/datumov brez uničenja fokusa. */
    function osveziVrsticeBrezFokusa() {
      if (!seznam || !osnutek) return;
      (osnutek.installments || []).forEach(function (row) {
        var art = seznam.querySelector('[data-id="' + row.id + '"]');
        if (!art) return;
        var naslovV = art.querySelector(".obrocno-sheet__vrstica-naslov");
        if (naslovV) naslovV.textContent = row.order + ". obrok";

        var badge = art.querySelector(".obrocno-sheet__rocno");
        if (row.amountMode === "manual") {
          if (!badge) {
            badge = document.createElement("span");
            badge.className = "obrocno-sheet__rocno";
            badge.textContent = "Ročno";
            var levo = art.querySelector(".obrocno-sheet__vrstica-levo");
            if (levo) levo.appendChild(badge);
          }
        } else if (badge) {
          badge.remove();
        }

        var input = art.querySelector(".obrocno-sheet__znesek");
        if (input && document.activeElement !== input) {
          input.value = UJ.formatCentsPolje(row.amountCents);
          input.dataset.zacetniCenti = String(row.amountCents);
          input.classList.toggle(
            "obrocno-sheet__znesek--rocno",
            row.amountMode === "manual"
          );
          input.classList.remove("obrocno-sheet__znesek--napaka");
        }

        var besedilo = art.querySelector(".obrocno-sheet__datum-besedilo");
        var native = art.querySelector(".obrocno-sheet__datum-native");
        var ovoj = art.querySelector(".obrocno-sheet__datum-ovoj");
        if (besedilo) besedilo.textContent = UJ.formatDateSl(row.dueDate);
        if (native) {
          if (document.activeElement !== native) {
            native.value = row.dueDate || "";
          }
          var idx = Number(art.dataset.index);
          if (Number.isFinite(idx)) {
            native.min = minDatumZaObrok(idx);
          }
        }
        if (ovoj) ovoj.classList.remove("obrocno-sheet__datum-ovoj--napaka");

        var x = art.querySelector(".obrocno-sheet__odstrani-vrstico");
        if (x) {
          var samoDva = (osnutek.installments || []).length <= UJ.MIN_OBROKOV;
          x.disabled = !draftEnabled || samoDva;
          x.setAttribute("aria-label", "Odstrani " + row.order + ". obrok");
        }
      });
      posodobiPovzetek();
    }

    function minDatumZaObrok(index) {
      if (!osnutek) return UJ.danesYYYYMMDD();
      if (index <= 0) {
        var danes = UJ.danesYYYYMMDD();
        var first =
          osnutek.installments[0] && osnutek.installments[0].dueDate;
        if (first && first < danes) return first;
        return danes;
      }
      var prev = osnutek.installments[index - 1];
      if (!prev || !prev.dueDate) return UJ.danesYYYYMMDD();
      return UJ.dodajKoledarskeDni(prev.dueDate, 1);
    }

    function izrisiVrstice() {
      if (!seznam || !osnutek) return;
      if (editingInstallmentId) {
        prekliciUrejanjeZneska(true);
      }
      osnutek = UJ.uskladiSteviloVrstic(osnutek);
      seznam.innerHTML = "";
      var samoDva = (osnutek.installments || []).length <= UJ.MIN_OBROKOV;
      var onemogocene = !draftEnabled;

      (osnutek.installments || []).forEach(function (row, index) {
        var art = document.createElement("article");
        art.className = "obrocno-sheet__vrstica";
        art.dataset.id = row.id;
        art.dataset.index = String(index);

        var glava = document.createElement("div");
        glava.className = "obrocno-sheet__vrstica-glava";

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

        var x = document.createElement("button");
        x.type = "button";
        x.className = "obrocno-sheet__odstrani-vrstico";
        x.setAttribute("aria-label", "Odstrani " + row.order + ". obrok");
        x.textContent = "×";
        x.disabled = onemogocene || samoDva;
        x.addEventListener("click", function () {
          odstraniVrstico(row.id);
        });

        glava.appendChild(levo);
        glava.appendChild(x);

        var polja = document.createElement("div");
        polja.className = "obrocno-sheet__vrstica-polja";

        var znesekBlok = document.createElement("div");
        var znesekOznaka = document.createElement("label");
        znesekOznaka.className = "obrocno-sheet__polje-oznaka";
        znesekOznaka.textContent = "Znesek";
        var moneyOvoj = document.createElement("div");
        moneyOvoj.className = "obrocno-sheet__money-ovoj";
        var znesek = document.createElement("input");
        znesek.type = "text";
        znesek.inputMode = "decimal";
        znesek.setAttribute("enterkeyhint", "done");
        znesek.autocomplete = "off";
        znesek.className = "obrocno-sheet__znesek";
        if (row.amountMode === "manual") {
          znesek.classList.add("obrocno-sheet__znesek--rocno");
        }
        znesek.value = UJ.formatCentsPolje(row.amountCents);
        znesek.setAttribute("aria-label", "Znesek " + row.order + ". obroka");
        znesek.dataset.zacetniCenti = String(row.amountCents);
        znesek.dataset.installmentId = row.id;
        znesek.disabled = onemogocene;
        if (onemogocene) znesek.setAttribute("aria-disabled", "true");

        znesek.addEventListener("focus", function () {
          if (!draftEnabled) {
            znesek.blur();
            return;
          }
          vstopiVUrejanjeZneska(row, znesek, art);
        });
        znesek.addEventListener("input", function () {
          var next = UJ.filtrirajZnesekVnos(znesek.value);
          if (next !== znesek.value) znesek.value = next;
          validateEditAmount();
        });
        znesek.addEventListener("blur", function () {
          if (potrjujemUrejanje) {
            potrjujemUrejanje = false;
            return;
          }
          if (editingInstallmentId === row.id) {
            prekliciUrejanjeZneska(true);
          }
        });
        znesek.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") {
            ev.preventDefault();
            potrdiUrejanjeZneska();
          }
        });

        var eur = document.createElement("span");
        eur.className = "obrocno-sheet__money-eur";
        eur.setAttribute("aria-hidden", "true");
        eur.textContent = "€";
        moneyOvoj.appendChild(znesek);
        moneyOvoj.appendChild(eur);

        var napakaVrstica = document.createElement("p");
        napakaVrstica.className = "obrocno-sheet__znesek-napaka-vrstica";
        napakaVrstica.hidden = true;

        znesekBlok.appendChild(znesekOznaka);
        znesekBlok.appendChild(moneyOvoj);
        znesekBlok.appendChild(napakaVrstica);

        var datumBlok = document.createElement("div");
        var datumOznaka = document.createElement("span");
        datumOznaka.className = "obrocno-sheet__polje-oznaka";
        datumOznaka.textContent = "Datum plačila";
        var datumOvoj = document.createElement("div");
        datumOvoj.className = "obrocno-sheet__datum-ovoj";

        var prikaz = document.createElement("div");
        prikaz.className = "obrocno-sheet__datum-prikaz";
        prikaz.setAttribute("aria-hidden", "true");
        var datumBesedilo = document.createElement("span");
        datumBesedilo.className = "obrocno-sheet__datum-besedilo";
        datumBesedilo.textContent = UJ.formatDateSl(row.dueDate);
        var datumIkona = document.createElement("span");
        datumIkona.className = "obrocno-sheet__datum-ikona";
        datumIkona.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>';
        prikaz.appendChild(datumBesedilo);
        prikaz.appendChild(datumIkona);

        var native = document.createElement("input");
        native.type = "date";
        native.className = "obrocno-sheet__datum-native";
        native.value = row.dueDate || "";
        native.min = minDatumZaObrok(index);
        native.setAttribute("aria-label", "Datum " + row.order + ". obroka");
        native.disabled = onemogocene;
        if (onemogocene) native.setAttribute("aria-disabled", "true");

        native.addEventListener("focus", function () {
          if (!draftEnabled) return;
          premakniKarticoVVidno(art);
        });
        native.addEventListener("change", function () {
          if (!draftEnabled) return;
          var iso = native.value;
          if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;

          var minDov = minDatumZaObrok(index);
          if (
            iso < minDov ||
            (index > 0 && iso <= osnutek.installments[index - 1].dueDate)
          ) {
            datumOvoj.classList.add("obrocno-sheet__datum-ovoj--napaka");
            native.value = row.dueDate || "";
            sporoci("Datum obroka mora biti poznejši od prejšnjega obroka.");
            if (napaka) {
              napaka.hidden = false;
              napaka.textContent =
                "Datum obroka mora biti poznejši od prejšnjega obroka.";
            }
            return;
          }

          datumOvoj.classList.remove("obrocno-sheet__datum-ovoj--napaka");
          osnutek = UJ.nastaviDatum(osnutek, row.id, iso);
          osnutek = UJ.osveziAddon(osnutek, jezikAddon());
          if (razmik) razmik.value = osnutek.intervalType;
          osveziVrsticeBrezFokusa();
        });

        datumOvoj.appendChild(prikaz);
        datumOvoj.appendChild(native);
        datumBlok.appendChild(datumOznaka);
        datumBlok.appendChild(datumOvoj);

        polja.appendChild(znesekBlok);
        polja.appendChild(datumBlok);

        art.appendChild(glava);
        art.appendChild(polja);
        seznam.appendChild(art);
      });
    }

    function odstraniVrstico(id) {
      if (!draftEnabled) return;
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
      if (undoEl) undoEl.hidden = false;
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
      nastaviKontroleOnemogocene(!draftEnabled);
      posodobiPovzetek();
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
      var existingUporaben =
        existing &&
        existing.enabled &&
        UJ.jePlanUporaben(existing, total);

      if (existingUporaben) {
        osnutek = klon(existing);
        osnutek.totalDebtCents = total;
        osnutek = UJ.uskladiSteviloVrstic(osnutek);
        if (UJ.vsotaCents(osnutek.installments) !== total) {
          osnutek = UJ.enakomernoRazdeli(osnutek);
        }
        osnutek = UJ.osveziAddon(osnutek, jezikAddon());
        draftEnabled = true;
      } else {
        osnutek = sveziPredlog(total);
        osnutek = UJ.uskladiSteviloVrstic(osnutek);
        draftEnabled = false;
      }

      originalEnabled = Boolean(existingUporaben);
      originalPlan = existing ? klon(existing) : null;

      editingInstallmentId = null;
      editSnapshotCents = null;
      editInputEl = null;
      potrjujemUrejanje = false;

      if (znesekEl) znesekEl.textContent = UJ.formatCentsSl(total);
      napolniOpozorilo();
      posodobiVklopUi();
      izrisi();

      prejsnjiFokus = document.activeElement;
      sheet.hidden = false;
      odprt = true;
      zakleniOzadje();
      vklopiViewportPoslusalce();
      if (telo) telo.scrollTop = 0;
      zapiranjeDovoljeno = false;
      if (casovnikZapiranja) clearTimeout(casovnikZapiranja);
      casovnikZapiranja = setTimeout(function () {
        zapiranjeDovoljeno = true;
      }, 400);
      window.setTimeout(function () {
        if (naslov) naslov.focus();
      }, 10);
    }

    function zapriSheet(brezObnove) {
      if (editingInstallmentId) {
        prekliciUrejanjeZneska(true);
      }
      odprt = false;
      if (sheet) sheet.hidden = true;
      izklopiViewportPoslusalce();
      odkleniOzadje();
      if (scrollFokusCasovnik) clearTimeout(scrollFokusCasovnik);
      osnutek = null;
      draftEnabled = false;
      originalEnabled = false;
      originalPlan = null;
      if (!brezObnove) {
        var plan = ctx.getInstallmentPlan ? ctx.getInstallmentPlan() : null;
        posodobiZunanjoKartico(plan);
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
      if (shranjevanje) return;

      if (!draftEnabled) {
        shranjevanje = true;
        if (shrani) {
          shrani.disabled = true;
          shrani.textContent = "Shranjujem …";
        }
        if (preklici) preklici.disabled = true;
        try {
          odstraniAddonIzBesedila();
          if (ctx.dodatki) ctx.dodatki.obrocno = false;
          if (ctx.dodatekBesedila) ctx.dodatekBesedila.obrocno = "";
          if (ctx.setInstallmentPlan) ctx.setInstallmentPlan(null);
          posodobiZunanjoKartico(null);
          if (typeof ctx.posodobiStanjeUrejevalnika === "function") {
            ctx.posodobiStanjeUrejevalnika();
          }
          if (typeof ctx.shraniOsnutekLokalno === "function") {
            ctx.shraniOsnutekLokalno();
          }
          zapriSheet(true);
        } finally {
          shranjevanje = false;
          if (preklici) preklici.disabled = false;
          if (shrani) {
            shrani.disabled = false;
            shrani.textContent = "Shrani spremembe";
          }
        }
        return;
      }

      if (!osnutek) return;
      osnutek = UJ.osveziAddon(osnutek, jezikAddon());
      var v = UJ.validatePlan(osnutek);
      if (!v.ok) {
        posodobiPovzetek();
        return;
      }

      var rok = ctx.getPaymentDeadline ? ctx.getPaymentDeadline() : null;
      if (rok && rok.enabled) {
        var okRok = await ctx.potrdiVprasanje({
          naslov: "Nadomestim rok plačila?",
          opis:
            "Obročno plačilo bo nadomestilo enkratni rok plačila. Želite nadaljevati?",
          potrdiBesedilo: "Nadaljuj",
          stil: "primary",
        });
        if (!okRok) return;
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
      if (shrani) {
        shrani.disabled = true;
        shrani.textContent = "Shranjujem …";
      }
      if (preklici) preklici.disabled = true;
      try {
        osnutek.enabled = true;
        osnutek.addonManuallyEdited = false;
        osnutek.updatedAt = new Date().toISOString();
        vstaviAddon(osnutek.addonText);
        if (ctx.dodatki) ctx.dodatki.obrocno = true;
        if (ctx.dodatekBesedila) ctx.dodatekBesedila.obrocno = osnutek.addonText;
        if (ctx.setInstallmentPlan) ctx.setInstallmentPlan(klon(osnutek));
        posodobiZunanjoKartico(klon(osnutek));
        if (typeof ctx.posodobiStanjeUrejevalnika === "function") {
          ctx.posodobiStanjeUrejevalnika();
        }
        if (typeof ctx.shraniOsnutekLokalno === "function") {
          ctx.shraniOsnutekLokalno();
        }
        zapriSheet(true);
      } finally {
        shranjevanje = false;
        if (preklici) preklici.disabled = false;
        if (shrani) {
          shrani.disabled = false;
          shrani.textContent = "Shrani spremembe";
        }
      }
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

    if (vklop) {
      vklop.addEventListener("click", function () {
        if (!odprt) return;
        preklopiVklop();
      });
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
    if (editPreklici) {
      editPreklici.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        prekliciUrejanjeZneska(false);
      });
    }
    if (editOk) {
      editOk.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        potrdiUrejanjeZneska();
      });
    }
    if (enakomerno) {
      enakomerno.addEventListener("click", async function () {
        if (!osnutek || !draftEnabled) return;
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
        if (!osnutek || !draftEnabled) return;
        osnutek = UJ.nastaviRazmik(osnutek, razmik.value);
        osnutek = UJ.osveziAddon(osnutek, jezikAddon());
        izrisi();
      });
    }
    if (undoEl) {
      undoEl.addEventListener("click", function () {
        if (!undoPaket || !osnutek || !draftEnabled) return;
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
        if (editingInstallmentId) {
          prekliciUrejanjeZneska(false);
        } else {
          zapriSheet(false);
        }
      }
    });

    return { odpri: odpri, zapri: zapriSheet, posodobiZunanjoKartico: posodobiZunanjoKartico };
  }

  root.inicializirajObrocnoSheet = inicializirajObrocnoSheet;
})(typeof globalThis !== "undefined" ? globalThis : this);
