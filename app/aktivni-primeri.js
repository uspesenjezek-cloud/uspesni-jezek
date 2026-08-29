/* Namenski seznam aktivnih primerov.
   Prikaže samo zadeve z dejansko aktiviranim načrtom. Klik vedno odpre
   produkcijsko Izvedbo za izbrani primer. */
(function () {
  "use strict";

  var BARVE = [
    { barva: "#6cae90", rgb: "108,174,144" },
    { barva: "#87af72", rgb: "135,175,114" },
    { barva: "#c3a13b", rgb: "195,161,59" },
    { barva: "#c49025", rgb: "196,144,37" },
    { barva: "#c8842e", rgb: "200,132,46" },
    { barva: "#c8773f", rgb: "200,119,63" },
    { barva: "#c76b46", rgb: "199,107,70" },
    { barva: "#c65d57", rgb: "198,93,87" },
    { barva: "#b95660", rgb: "185,86,96" },
  ];
  var VIJOLICNA = { barva: "#8762aa", rgb: "135,98,170" };

  function esc(vrednost) {
    return String(vrednost == null ? "" : vrednost)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatirajZnesek(znesek) {
    var stevilo = Number(znesek);
    if (!isFinite(stevilo)) return "—";
    return new Intl.NumberFormat("sl-SI", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(stevilo);
  }

  function formatirajDatum(iso) {
    if (!iso) return "";
    var datum = new Date(iso);
    if (isNaN(datum.getTime())) return "";
    return new Intl.DateTimeFormat("sl-SI", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(datum);
  }

  function vkljuceniKoraki(plan) {
    return plan && Array.isArray(plan.steps)
      ? plan.steps.filter(function (korak) { return !korak.isExcluded; })
      : [];
  }

  function jeZakljucenKorak(korak) {
    return ["sent", "cancelled", "skipped", "completed"].indexOf(String(korak.status || "")) >= 0;
  }

  function trenutniKorak(plan) {
    var koraki = vkljuceniKoraki(plan);
    for (var i = 0; i < koraki.length; i += 1) {
      if (!jeZakljucenKorak(koraki[i])) {
        return { korak: koraki[i], polozaj: i + 1, skupaj: koraki.length };
      }
    }
    return koraki.length
      ? { korak: koraki[koraki.length - 1], polozaj: koraki.length, skupaj: koraki.length }
      : null;
  }

  function barvaKoraka(podatek) {
    if (!podatek || !podatek.korak) return BARVE[0];
    if (podatek.korak.kind === "manual_lawyer" || podatek.korak.deliveryMode === "manual") {
      return VIJOLICNA;
    }
    return BARVE[Math.min(Math.max(podatek.polozaj - 1, 0), BARVE.length - 1)];
  }

  function naslovKoraka(korak) {
    if (!korak) return "Primer je v obravnavi";
    return korak.title || korak.name || korak.label || "Naslednji korak";
  }

  function htmlKartice(zadeva) {
    var plan = {
      serverActivatedAt: zadeva.opomin_aktiviran || null,
      steps: Array.isArray(zadeva.opomin_koraki) ? zadeva.opomin_koraki : [],
    };
    var aktiviran = Boolean(plan.serverActivatedAt);
    var podatekKoraka = aktiviran ? trenutniKorak(plan) : null;
    var barva = barvaKoraka(podatekKoraka);
    var korak = podatekKoraka && podatekKoraka.korak;
    var termin = korak && (korak.sendAt || korak.scheduledAt);
    var status = "Načrt aktiven";
    var podnaslov = podatekKoraka
      ? podatekKoraka.polozaj + ". od " + podatekKoraka.skupaj + " korakov · " + naslovKoraka(korak)
      : "Primer je pripravljen za izvedbo";
    var datum = termin
      ? "Naslednji korak: " + formatirajDatum(termin)
      : (zadeva.datum_zapadlosti ? "Zapadlost: " + formatirajDatum(zadeva.datum_zapadlosti) : "");
    var cilj = "izvedba.html?zadevaId=" + encodeURIComponent(zadeva.id);

    return (
      '<a class="aktivni-primer" href="' + esc(cilj) + '" ' +
        'style="--primer-barva:' + esc(barva.barva) + ';--primer-rgb:' + esc(barva.rgb) + '">' +
        '<span class="aktivni-primer__vrh">' +
          '<strong class="aktivni-primer__ime" data-primer-fit>' + esc(zadeva.ime_dolznika || "Neimenovan dolžnik") + "</strong>" +
          '<strong class="aktivni-primer__znesek" data-primer-fit>' + esc(formatirajZnesek(zadeva.preostali_dolg != null ? zadeva.preostali_dolg : zadeva.znesek)) + "</strong>" +
        "</span>" +
        '<span class="aktivni-primer__sredina">' +
          '<span class="aktivni-primer__korak" data-primer-fit>' + esc(podnaslov) + "</span>" +
          (datum ? '<span class="aktivni-primer__datum">' + esc(datum) + "</span>" : "") +
        "</span>" +
        '<span class="aktivni-primer__spodaj">' +
          '<span class="aktivni-primer__status"><span aria-hidden="true"></span>' + esc(status) + "</span>" +
          '<span class="aktivni-primer__odpri">Odpri <span aria-hidden="true"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m9 18 6-6-6-6\"/></svg></span></span>' +
        "</span>" +
      "</a>"
    );
  }

  function prilagodiBesedilo(koren) {
    koren.querySelectorAll("[data-primer-fit]").forEach(function (element) {
      element.style.fontSize = "";
      var najmanjsa = 10;
      var velikost = parseFloat(window.getComputedStyle(element).fontSize) || 14;
      while ((element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight) && velikost > najmanjsa) {
        velikost -= 0.5;
        element.style.fontSize = velikost + "px";
      }
    });
  }

  async function inicializiraj() {
    var koren = document.querySelector("[data-aktivni-primeri-root]");
    if (!koren) return;

    var vsebina = koren.querySelector("[data-aktivni-primeri-vsebina]");
    var seznam = koren.querySelector("[data-aktivni-primeri-seznam]");
    var stevec = koren.querySelector("[data-aktivni-primeri-stevec]");
    var napaka = koren.querySelector("[data-aktivni-primeri-napaka]");
    var nalaganje = koren.querySelector("[data-aktivni-primeri-nalaganje]");
    var prazno = koren.querySelector("[data-aktivni-primeri-prazno]");

    try {
      if (typeof supabaseKlient === "undefined" || !supabaseKlient || !supabaseKlient.auth) {
        throw new Error("Povezava s podatki ni pripravljena.");
      }

      var seja = await supabaseKlient.auth.getSession();
      if (!seja.data || !seja.data.session) {
        window.location.replace("prijava.html");
        return;
      }

      var odgovor = await supabaseKlient
        .from("zadeve")
        .select(
          "id, ime_dolznika, znesek, preostali_dolg, datum_zapadlosti, status, ustvarjeno_at, opomin_aktiviran:opomin_nacrt->>serverActivatedAt, opomin_koraki:opomin_nacrt->steps"
        )
        .neq("status", "Rešeno")
        .not("opomin_nacrt->>serverActivatedAt", "is", null)
        .order("ustvarjeno_at", { ascending: false });

      if (odgovor.error) {
        console.error("Aktivnih primerov ni bilo mogoče naložiti:", odgovor.error);
        throw odgovor.error;
      }

      var primeri = (odgovor.data || []).filter(function (zadeva) {
        return zadeva &&
          zadeva.status !== "Rešeno" &&
          zadeva.opomin_aktiviran;
      });

      if (nalaganje) nalaganje.hidden = true;

      if (primeri.length) {
        seznam.innerHTML = primeri.map(htmlKartice).join("");
        stevec.textContent = String(primeri.length);
        stevec.setAttribute("aria-label", primeri.length + " aktivnih primerov");
        stevec.hidden = false;
        vsebina.hidden = false;
        window.requestAnimationFrame(function () { prilagodiBesedilo(seznam); });
      } else {
        vsebina.hidden = true;
        if (prazno) prazno.hidden = false;
      }
    } catch (_napaka) {
      if (nalaganje) nalaganje.hidden = true;
      vsebina.hidden = true;
      napaka.hidden = false;
    } finally {
      koren.setAttribute("aria-busy", "false");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inicializiraj, { once: true });
  } else {
    inicializiraj();
  }
})();
