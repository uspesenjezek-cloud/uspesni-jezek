/* ========== TRR sheet: Podatki za nakazilo (korak 2) ==========
   Vzorec: app/rok-placila-sheet.js / app/obrocno-sheet.js
   ============================================================ */
(function (root) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizirajIban(raw) {
    return String(raw || "")
      .replace(/\s+/g, "")
      .toUpperCase();
  }

  function formatirajIbanPrikaz(iban) {
    var cisto = normalizirajIban(iban);
    return cisto.replace(/(.{4})/g, "$1 ").trim();
  }

  function jeVeljavenSiIban(raw) {
    var cisto = normalizirajIban(raw);
    return /^SI56\d{15}$/.test(cisto);
  }

  function sestaviVrstico(iban, sklic) {
    var ib = formatirajIbanPrikaz(iban);
    var sk = String(sklic || "").trim();
    if (!ib) return "";
    if (sk) return "Plačilo izvedite na TRR " + ib + ", sklic " + sk + ".";
    return "Plačilo izvedite na TRR " + ib + ".";
  }

  function inicializirajTrrSheet(ctx) {
    var sheet = document.getElementById("trr-sheet");
    var panel = document.getElementById("trr-sheet-panel");
    var naslov = document.getElementById("trr-sheet-naslov");
    var backdrop = document.getElementById("trr-sheet-backdrop");
    var zapriGumb = document.getElementById("trr-sheet-zapri");
    var prekliciGumb = document.getElementById("trr-sheet-preklici");
    var shraniGumb = document.getElementById("trr-sheet-shrani");
    var vkljuci = document.getElementById("trr-sheet-vkljuci");
    var vsebina = document.getElementById("trr-sheet-vsebina");
    var seznamEl = document.getElementById("trr-sheet-seznam");
    var praznoEl = document.getElementById("trr-sheet-prazno");
    var novGumb = document.getElementById("trr-sheet-nov");
    var novForma = document.getElementById("trr-sheet-nov-forma");
    var seznamOvoj = document.getElementById("trr-sheet-seznam-ovoj");
    var novIme = document.getElementById("trr-sheet-nov-ime");
    var novNaziv = document.getElementById("trr-sheet-nov-naziv");
    var novIban = document.getElementById("trr-sheet-nov-iban");
    var novNapaka = document.getElementById("trr-sheet-nov-napaka");
    var novPreklici = document.getElementById("trr-sheet-nov-preklici");
    var novShrani = document.getElementById("trr-sheet-nov-shrani");
    var sklicEl = document.getElementById("trr-sheet-sklic");
    var namenEl = document.getElementById("trr-sheet-namen");
    var previewEl = document.getElementById("trr-sheet-preview");
    var napakaEl = document.getElementById("trr-sheet-napaka");

    var odprt = false;
    var zapiranjeDovoljeno = false;
    var casovnikZapiranja = null;
    var pendingOnClose = null;
    var prejsnjiFokus = null;
    var shranjevanje = false;
    var racuni = [];
    var osnutek = null;

    function nastaviNapako(prikazi, besedilo) {
      if (!napakaEl) return;
      if (!prikazi) {
        napakaEl.hidden = true;
        napakaEl.textContent = "";
        return;
      }
      napakaEl.hidden = false;
      napakaEl.textContent = besedilo || "Prišlo je do napake.";
    }

    function nastaviNovNapako(prikazi, besedilo) {
      if (!novNapaka) return;
      if (!prikazi) {
        novNapaka.hidden = true;
        novNapaka.textContent = "";
        return;
      }
      novNapaka.hidden = false;
      novNapaka.textContent = besedilo || "";
    }

    function getK1() {
      return typeof ctx.getPodatkiKorak1 === "function"
        ? ctx.getPodatkiKorak1() || {}
        : {};
    }

    function privzetiSklic() {
      var k1 = getK1();
      var st = String(k1.stevilkaRacuna || "").trim();
      return st ? "SI00" + st : "";
    }

    function privzetiNamen() {
      var k1 = getK1();
      var st = String(k1.stevilkaRacuna || "").trim();
      if (st) return "Plačilo računa " + st;
      var ime = String(k1.imeDolznika || "").trim();
      return ime ? "Plačilo dolga " + ime : "Plačilo dolga";
    }

    function izbranRacun() {
      if (!osnutek || !osnutek.accountId) return null;
      for (var i = 0; i < racuni.length; i++) {
        if (String(racuni[i].id) === String(osnutek.accountId)) return racuni[i];
      }
      return null;
    }

    function posodobiPreview() {
      if (!previewEl) return;
      var r = izbranRacun();
      var sklic = sklicEl ? String(sklicEl.value || "").trim() : "";
      if (!r) {
        previewEl.textContent = "Izberite račun.";
        return;
      }
      previewEl.textContent = sestaviVrstico(r.iban, sklic) || "—";
    }

    function posodobiVsebinaVidnost() {
      var on = Boolean(vkljuci && vkljuci.checked);
      if (vsebina) vsebina.hidden = !on;
      if (shraniGumb) {
        shraniGumb.textContent = on ? "Shrani spremembe" : "Shrani (brez TRR)";
      }
    }

    function htmlKartica(r, izbran) {
      var badge = r.je_privzet
        ? '<span class="trr-sheet__badge">Privzeti</span>'
        : "";
      return (
        '<label class="trr-sheet__kartica' +
        (izbran ? " trr-sheet__kartica--izbrana" : "") +
        '">' +
        '<input type="radio" name="trr-sheet-racun" value="' +
        esc(r.id) +
        '"' +
        (izbran ? " checked" : "") +
        " />" +
        '<span class="trr-sheet__kartica-telo">' +
        '<span class="trr-sheet__kartica-vrh">' +
        '<span class="trr-sheet__kartica-ime">' +
        esc(r.ime) +
        "</span>" +
        badge +
        "</span>" +
        '<span class="trr-sheet__kartica-naziv">' +
        esc(r.naziv_podjetja) +
        "</span>" +
        '<span class="trr-sheet__kartica-iban">' +
        esc(formatirajIbanPrikaz(r.iban)) +
        "</span>" +
        "</span>" +
        "</label>"
      );
    }

    function izrisiSeznam() {
      if (!seznamEl) return;
      var izbranId = osnutek && osnutek.accountId ? String(osnutek.accountId) : "";
      if (!racuni.length) {
        seznamEl.innerHTML = "";
        if (praznoEl) praznoEl.hidden = false;
        return;
      }
      if (praznoEl) praznoEl.hidden = true;
      seznamEl.innerHTML = racuni
        .map(function (r) {
          return htmlKartica(r, String(r.id) === izbranId);
        })
        .join("");
      seznamEl.querySelectorAll('input[name="trr-sheet-racun"]').forEach(function (inp) {
        inp.addEventListener("change", function () {
          if (!osnutek) return;
          osnutek.accountId = inp.value;
          posodobiPreview();
          izrisiSeznam();
        });
      });
    }

    function pokaziNovFormo(prikazi) {
      if (novForma) novForma.hidden = !prikazi;
      if (seznamOvoj) seznamOvoj.hidden = Boolean(prikazi);
      if (novGumb) novGumb.hidden = Boolean(prikazi);
      nastaviNovNapako(false);
      if (prikazi) {
        if (novIme) novIme.value = "";
        if (novNaziv) novNaziv.value = "";
        if (novIban) novIban.value = "";
        if (novIme) novIme.focus();
      }
    }

    async function naloziRacune() {
      racuni = [];
      var klient = ctx.supabaseKlient;
      if (!klient || !klient.from) return;
      var rez = await klient
        .from("trr_racuni")
        .select("id, ime, naziv_podjetja, iban, je_privzet, ustvarjeno_at")
        .order("je_privzet", { ascending: false })
        .order("ustvarjeno_at", { ascending: true });
      if (rez.error) {
        nastaviNapako(
          true,
          "TRR računov ni bilo mogoče naložiti. Preverite povezavo ali migracijo."
        );
        return;
      }
      racuni = Array.isArray(rez.data) ? rez.data : [];
    }

    function izberiPrivzetiAliObstojeci() {
      var trenutni = typeof ctx.getTrrAccount === "function" ? ctx.getTrrAccount() : null;
      var sklic = trenutni && trenutni.sklic != null ? String(trenutni.sklic) : privzetiSklic();
      var namen =
        trenutni && trenutni.namen != null ? String(trenutni.namen) : privzetiNamen();
      var accountId = trenutni && trenutni.accountId ? String(trenutni.accountId) : "";
      if (!accountId && racuni.length) {
        var priv = racuni.find(function (r) {
          return r.je_privzet;
        });
        accountId = String((priv || racuni[0]).id);
      }
      osnutek = {
        accountId: accountId || null,
        sklic: sklic,
        namen: namen,
        vkljuceno: Boolean(trenutni && trenutni.accountId),
      };
      if (vkljuci) vkljuci.checked = osnutek.vkljuceno;
      if (sklicEl) sklicEl.value = osnutek.sklic;
      if (namenEl) namenEl.value = osnutek.namen;
      posodobiVsebinaVidnost();
      izrisiSeznam();
      posodobiPreview();
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

    async function odpri(opcije) {
      if (odprt || !sheet) return;
      var opts = opcije || {};
      pendingOnClose =
        typeof opts.onClose === "function" ? opts.onClose : null;
      prejsnjiFokus = document.activeElement;
      nastaviNapako(false);
      pokaziNovFormo(false);
      try {
        await naloziRacune();
        izberiPrivzetiAliObstojeci();
        document.body.appendChild(sheet);
        sheet.hidden = false;
        document.body.classList.add("rok-sheet-odprt");
        odprt = true;
        zapiranjeDovoljeno = false;
        document.addEventListener("keydown", onKeydown, true);
        if (casovnikZapiranja) window.clearTimeout(casovnikZapiranja);
        casovnikZapiranja = window.setTimeout(function () {
          zapiranjeDovoljeno = true;
          casovnikZapiranja = null;
        }, 450);
        window.setTimeout(function () {
          if (naslov) naslov.focus();
        }, 10);
      } catch (napaka) {
        pendingOnClose = null;
        odprt = false;
        if (sheet) sheet.hidden = true;
        var rokElCatch = document.getElementById("rok-sheet");
        if (!rokElCatch || rokElCatch.hidden) {
          document.body.classList.remove("rok-sheet-odprt");
        }
        if (typeof root.UJSprostiGlavniScroll === "function") {
          root.UJSprostiGlavniScroll();
        }
        if (typeof ctx.pokaziNapako === "function") {
          ctx.pokaziNapako(
            "Odpiranje TRR nastavitev ni uspelo.",
            napaka && napaka.message ? napaka.message : ""
          );
        }
      }
    }

    function zapriSheet(shraniSpremembe, meta) {
      if (!odprt) return;
      if (!shraniSpremembe && !zapiranjeDovoljeno) return;
      sheet.hidden = true;
      odprt = false;
      osnutek = null;
      var rokEl = document.getElementById("rok-sheet");
      if (!rokEl || rokEl.hidden) {
        document.body.classList.remove("rok-sheet-odprt");
      }
      if (typeof root.UJSprostiGlavniScroll === "function") {
        root.UJSprostiGlavniScroll();
      }
      document.removeEventListener("keydown", onKeydown, true);
      if (casovnikZapiranja) {
        window.clearTimeout(casovnikZapiranja);
        casovnikZapiranja = null;
      }
      var cb = pendingOnClose;
      pendingOnClose = null;
      var shranjeno = Boolean(meta && meta.shranjeno);
      if (prejsnjiFokus && typeof prejsnjiFokus.focus === "function") {
        try {
          prejsnjiFokus.focus();
        } catch (_e) {}
      }
      prejsnjiFokus = null;
      if (typeof cb === "function") {
        try {
          cb({ shranjeno: shranjeno });
        } catch (_e2) {}
      }
    }

    function zapriNaSilo() {
      if (!odprt) return;
      sheet.hidden = true;
      odprt = false;
      osnutek = null;
      pendingOnClose = null;
      var rokEl = document.getElementById("rok-sheet");
      if (!rokEl || rokEl.hidden) {
        document.body.classList.remove("rok-sheet-odprt");
      }
      if (typeof root.UJSprostiGlavniScroll === "function") {
        root.UJSprostiGlavniScroll();
      }
      document.removeEventListener("keydown", onKeydown, true);
      if (casovnikZapiranja) {
        window.clearTimeout(casovnikZapiranja);
        casovnikZapiranja = null;
      }
    }

    async function shraniNovRacun() {
      var ime = novIme ? String(novIme.value || "").trim() : "";
      var naziv = novNaziv ? String(novNaziv.value || "").trim() : "";
      var iban = normalizirajIban(novIban && novIban.value);
      if (!ime) {
        nastaviNovNapako(true, "Vnesite ime računa.");
        return;
      }
      if (!naziv) {
        nastaviNovNapako(true, "Vnesite naziv podjetja.");
        return;
      }
      if (!jeVeljavenSiIban(iban)) {
        nastaviNovNapako(
          true,
          "IBAN ni veljaven. Pričakovana oblika: SI56 + 15 števk."
        );
        return;
      }
      var klient = ctx.supabaseKlient;
      if (!klient || !klient.from) {
        nastaviNovNapako(true, "Povezava s podatkovno bazo ni na voljo.");
        return;
      }
      if (novShrani) novShrani.disabled = true;
      try {
        var jePrvi = racuni.length === 0;
        var rez = await klient
          .from("trr_racuni")
          .insert({
            ime: ime,
            naziv_podjetja: naziv,
            iban: iban,
            je_privzet: jePrvi,
          })
          .select("id, ime, naziv_podjetja, iban, je_privzet, ustvarjeno_at")
          .single();
        if (rez.error) {
          nastaviNovNapako(
            true,
            rez.error.message || "Shranjevanje računa ni uspelo."
          );
          return;
        }
        racuni.push(rez.data);
        if (!osnutek) osnutek = {};
        osnutek.accountId = String(rez.data.id);
        pokaziNovFormo(false);
        izrisiSeznam();
        posodobiPreview();
      } finally {
        if (novShrani) novShrani.disabled = false;
      }
    }

    async function shraniInDodaj() {
      if (shranjevanje) return;
      nastaviNapako(false);
      var vkljuceno = Boolean(vkljuci && vkljuci.checked);
      var r = izbranRacun();
      if (vkljuceno && !r) {
        nastaviNapako(true, "Izberite TRR račun ali dodajte novega.");
        return;
      }
      var sklic = sklicEl ? String(sklicEl.value || "").trim().slice(0, 25) : "";
      var namen = namenEl ? String(namenEl.value || "").trim().slice(0, 120) : "";
      var vrstica = vkljuceno ? sestaviVrstico(r.iban, sklic) : "";
      var trenutni =
        typeof ctx.getTrrAccount === "function" ? ctx.getTrrAccount() : null;
      var stara = trenutni && trenutni.insertedText ? trenutni.insertedText : "";
      var UJ = root.UJRokPlacila;
      if (!UJ || typeof UJ.posodobiSistemskoVrstico !== "function") {
        nastaviNapako(true, "Sistemska funkcija za vrstico ni naložena.");
        return;
      }

      shranjevanje = true;
      if (shraniGumb) {
        shraniGumb.disabled = true;
        shraniGumb.textContent = "Shranjevanje …";
      }

      try {
        var rez = UJ.posodobiSistemskoVrstico(
          ctx.besediloPolje.value,
          stara,
          vrstica,
          vkljuceno
        );

        if (!rez.ok && rez.opozorilo === "spremenjeno") {
          var potrdi = await ctx.potrdiVprasanje({
            naslov: "Vrstica TRR je spremenjena",
            opis: "Sistemske vrstice ni več mogoče varno najti. Dodam novo vrstico na konec?",
            potrdiBesedilo: "Dodaj novo",
            stil: "primary",
          });
          if (!potrdi) {
            shranjevanje = false;
            if (shraniGumb) {
              shraniGumb.disabled = false;
              shraniGumb.textContent = "Shrani spremembe";
            }
            return;
          }
          var osnova = String(ctx.besediloPolje.value || "").replace(/\s+$/, "");
          rez = {
            besedilo: vkljuceno
              ? osnova
                ? osnova + "\n\n" + vrstica
                : vrstica
              : osnova,
            ok: true,
          };
        }

        ctx.besediloPolje.value = String(rez.besedilo).slice(0, ctx.najvecZnakov);

        var novo = null;
        if (vkljuceno && r) {
          novo = {
            accountId: String(r.id),
            accountLabel: String(r.ime || "TRR"),
            ibanLastFour: normalizirajIban(r.iban).slice(-4),
            iban: normalizirajIban(r.iban),
            sklic: sklic,
            namen: namen,
            insertedText: vrstica,
          };
        }
        ctx.setTrrAccount(novo);

        if (ctx.dodatki) ctx.dodatki.trr = vkljuceno;
        if (ctx.dodatekBesedila) ctx.dodatekBesedila.trr = vrstica;
        if (ctx.gumbTrr) {
          ctx.gumbTrr.setAttribute("aria-pressed", String(vkljuceno));
        }

        if (typeof ctx.posodobiStanjeUrejevalnika === "function") {
          ctx.posodobiStanjeUrejevalnika();
        }
        if (typeof ctx.shraniOsnutekLokalno === "function") {
          ctx.shraniOsnutekLokalno();
        }
        zapiranjeDovoljeno = true;
        zapriSheet(true, { shranjeno: true });
      } catch (_e) {
        if (typeof ctx.pokaziNapako === "function") {
          ctx.pokaziNapako("Shranjevanje TRR ni uspelo. Poskusite znova.");
        }
      } finally {
        shranjevanje = false;
        if (shraniGumb) {
          shraniGumb.disabled = false;
          if (odprt) {
            shraniGumb.textContent = vkljuci && vkljuci.checked
              ? "Shrani spremembe"
              : "Shrani (brez TRR)";
          } else {
            shraniGumb.textContent = "Shrani spremembe";
          }
        }
      }
    }

    if (backdrop) {
      backdrop.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!zapiranjeDovoljeno) return;
        zapriSheet(false);
      });
    }
    if (zapriGumb) {
      zapriGumb.addEventListener("click", function () {
        zapiranjeDovoljeno = true;
        zapriSheet(false);
      });
    }
    if (prekliciGumb) {
      prekliciGumb.addEventListener("click", function () {
        zapiranjeDovoljeno = true;
        zapriSheet(false);
      });
    }
    if (shraniGumb) shraniGumb.addEventListener("click", shraniInDodaj);
    if (vkljuci) {
      vkljuci.addEventListener("change", function () {
        if (osnutek) osnutek.vkljuceno = vkljuci.checked;
        posodobiVsebinaVidnost();
        posodobiPreview();
      });
    }
    if (sklicEl) {
      sklicEl.addEventListener("input", function () {
        if (osnutek) osnutek.sklic = sklicEl.value;
        posodobiPreview();
      });
    }
    if (namenEl) {
      namenEl.addEventListener("input", function () {
        if (osnutek) osnutek.namen = namenEl.value;
      });
    }
    if (novGumb) {
      novGumb.addEventListener("click", function () {
        pokaziNovFormo(true);
      });
    }
    if (novPreklici) {
      novPreklici.addEventListener("click", function () {
        pokaziNovFormo(false);
      });
    }
    if (novShrani) novShrani.addEventListener("click", shraniNovRacun);

    // Klik na TRR kartico (kot rok-placila-sheet na gumbRok) – vedno odpre sheet,
    // tudi če še ni nobenega računa v Supabase.
    if (ctx.gumbTrr && typeof ctx.gumbTrr.addEventListener === "function") {
      ctx.gumbTrr.addEventListener("click", function (dogodek) {
        dogodek.preventDefault();
        dogodek.stopPropagation();
        window.setTimeout(function () {
          if (odprt) return;
          odpri({});
        }, 0);
      });
    }

    return { odpri: odpri, zapri: zapriSheet, zapriNaSilo: zapriNaSilo };
  }

  root.inicializirajTrrSheet = inicializirajTrrSheet;
})(typeof window !== "undefined" ? window : this);
