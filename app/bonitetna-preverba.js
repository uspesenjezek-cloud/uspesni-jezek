(function () {
  "use strict";

  var obrazec = document.getElementById("boniteta-obrazec");
  if (!obrazec) return;

  var gumb = document.getElementById("boniteta-gumb");
  var napaka = document.getElementById("boniteta-napaka");
  var potek = document.getElementById("boniteta-potek");
  var rezultat = document.getElementById("boniteta-rezultat");
  var rezultatOkno = document.getElementById("boniteta-rezultat-okno");
  var postaPolje = document.getElementById("boniteta-posta");
  var krajPolje = document.getElementById("boniteta-kraj");
  var krajStatus = document.getElementById("boniteta-kraj-status");
  var krajiSeznam = document.getElementById("boniteta-kraji");
  var krajiIzbira = document.getElementById("boniteta-kraj-izbira");
  var spletnaPolje = document.getElementById("boniteta-spletna-stran");
  var heroSpletnaPolje = document.getElementById("boniteta-hero-spletna-stran");
  var heroSpletnaStatus = document.getElementById("boniteta-hero-status");
  var heroSpletnaOkvir = document.querySelector(".boniteta-hero__iskanje");
  var heroSpletnaLabel = document.getElementById("boniteta-hero-label");
  var heroPodjetje = document.getElementById("boniteta-hero-podjetje");
  var heroPodjetjeIme = document.getElementById("boniteta-hero-podjetje-ime");
  var brezSpletneGumb = document.getElementById("boniteta-brez-spletne");
  var spletnaStatus = document.getElementById("boniteta-spletna-status");
  var privzetiGumb = gumb.innerHTML;
  var zadnjaSamodejnaPosta = "";
  var samodejniKraj = "";
  var potrjenoBrezSpletne = false;
  var zadnjiVnos = null;
  var zadnjaOpenRegisterReferenca = "";
  var potrditevIdentitete = document.getElementById("boniteta-potrditev-identitete");
  var potrditevNapaka = document.getElementById("boniteta-potrditev-napaka");
  var potrditevGumb = document.getElementById("boniteta-potrditev-gumb");
  var openregisterIdentiteta = document.getElementById("boniteta-openregister-identiteta");
  var openregisterStatus = document.getElementById("boniteta-openregister-status");
  var vrstaStatus = document.getElementById("boniteta-vrsta-status");
  var zajemStatus = document.getElementById("boniteta-zajem-status");
  var zajemStatusBesedilo = document.getElementById("boniteta-zajem-status-besedilo");
  var zajemFotoaparat = document.getElementById("boniteta-zajem-fotoaparat");
  var zajemDatoteka = document.getElementById("boniteta-zajem-datoteka");
  var zajemSklop = document.getElementById("boniteta-zajem");
  var zajemLocilo = zajemSklop && zajemSklop.querySelector(".boniteta-zajem__locilo");
  var spletnaRezerva = document.getElementById("boniteta-spletna-rezerva");
  var spletnaRezervaOpis = document.getElementById("boniteta-spletna-rezerva-opis");
  var izbiraStranke = document.getElementById("boniteta-izbira-stranke");
  var izbiraStrankeSeznam = document.getElementById("boniteta-izbira-stranke-seznam");
  var vnosPodrobnosti = document.getElementById("boniteta-vnos-podrobnosti");
  var nacinVnosa = "";
  var zajemVTehniku = false;
  var profilPovezava = document.getElementById("boniteta-odpri-profil");
  var razsiritveSklop = document.getElementById("boniteta-razsiritve");
  var razsiritveOdpri = document.getElementById("boniteta-razsiritve-odpri");
  var razsiritveMoznosti = document.getElementById("boniteta-razsiritve-moznosti");
  var podjetjeSklop = document.getElementById("boniteta-hwk-sklop");
  var podjetjeGlava = document.getElementById("boniteta-podjetje-glava");
  var podjetjeMonogram = document.getElementById("boniteta-podjetje-monogram");
  var podjetjeIme = document.getElementById("boniteta-podjetje-ime");
  var podjetjePreverjeno = document.getElementById("boniteta-podjetje-preverjeno");
  var podjetjePodnaslov = document.getElementById("boniteta-podjetje-podnaslov");
  var hwkStatus = document.getElementById("boniteta-hwk-status");
  var hwkPodatki = document.getElementById("boniteta-hwk-podatki");
  var popolnostLok = document.getElementById("boniteta-popolnost-lok");
  var popolnostVrednost = document.getElementById("boniteta-popolnost-vrednost");
  var osnovniOpomba = document.getElementById("boniteta-osnovni-opomba");
  var zaporedjePostnePoizvedbe = 0;
  var krajiTrenutnePoste = [];
  var izrecnoIzbraniKraj = "";
  var generacijaRezultata = 0;
  var zadnjiJobId = "";
  var izbrisiPreverboGumb = document.getElementById("boniteta-izbrisi-preverbo");

  function nastaviRezultatKotOkno(vklopljeno) {
    document.body.classList.toggle("boniteta-rezultat-je-okno", Boolean(vklopljeno));
    if (rezultatOkno) rezultatOkno.hidden = !vklopljeno;
  }

  function nastaviRazsiritveOdprte(odprto) {
    if (!razsiritveOdpri || !razsiritveMoznosti) return;
    razsiritveMoznosti.hidden = !odprto;
    razsiritveOdpri.setAttribute("aria-expanded", odprto ? "true" : "false");
    razsiritveOdpri.classList.toggle("is-open", odprto);
    var naslov = razsiritveOdpri.querySelector("strong");
    if (naslov) naslov.textContent = odprto ? "Skrij podrobne možnosti" : "Poglej podrobne možnosti";
    if (odprto && window.UJPrilagodiVelikostBesedila) razsiritveMoznosti.querySelectorAll("[data-fit-text]").forEach(window.UJPrilagodiVelikostBesedila);
  }

  if (razsiritveOdpri) razsiritveOdpri.addEventListener("click", function () {
    nastaviRazsiritveOdprte(razsiritveOdpri.getAttribute("aria-expanded") !== "true");
  });

  window.UJBonitetaNastaviRezultatKotOkno = nastaviRezultatKotOkno;

  function esc(vrednost) {
    return String(vrednost == null ? "" : vrednost)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function izrisiOsnovniPregled(podatki) {
    if (!popolnostLok || !popolnostVrednost) return;
    var identiteta = podatki && podatki.identity || {};
    var registrska = identiteta.status === "verified_register";
    var lokacija = [identiteta.postnaStevilka, identiteta.kraj].filter(Boolean).join(" ");
    var polja = [
      { oznaka: "Pravno ime", vrednost: identiteta.ime || identiteta.naziv || "Ni podatka", najdeno: Boolean(identiteta.ime || identiteta.naziv) },
      { oznaka: "Register", vrednost: identiteta.registerNumber || "Ni podatka", najdeno: Boolean(identiteta.registerNumber) },
      { oznaka: "Registrsko sodišče", vrednost: identiteta.registerCourt || "Ni podatka", najdeno: Boolean(identiteta.registerCourt) },
      { oznaka: "Pravna oblika", vrednost: identiteta.legalForm || "Ni podatka", najdeno: Boolean(identiteta.legalForm) },
      { oznaka: "Kraj", vrednost: lokacija || "Ni podatka", najdeno: Boolean(lokacija) },
      { oznaka: "Registrski status", vrednost: identiteta.active === true ? "Aktivno" : identiteta.active === false ? "Neaktivno" : "Ni podatka", najdeno: typeof identiteta.active === "boolean" },
    ];
    var najdenih = registrska ? polja.filter(function (polje) { return polje.najdeno; }).length : 0;
    var odstotek = registrska ? Math.round(najdenih / polja.length * 100) : 0;
    popolnostLok.style.strokeDashoffset = String(302 - 302 * odstotek / 100);
    popolnostLok.style.opacity = registrska ? "1" : ".18";
    popolnostVrednost.textContent = registrska ? odstotek + " %" : "—";
    popolnostVrednost.parentElement.setAttribute("aria-label", registrska ? "Najdenih je " + odstotek + " odstotkov osnovnih registrskih polj" : "Osnovni registrski podatki niso potrjeni");
    if (osnovniOpomba) osnovniOpomba.textContent = registrska
      ? "Prikazana popolnost pomeni le, koliko osnovnih registrskih polj je vir vrnil. Ne meri plačilne sposobnosti ali insolventnosti."
      : "Podjetje ni bilo potrjeno prek registra, zato popolnosti registrskih polj ne ocenjujemo.";
  }

  function nastaviKredite(credits) {
    var naslov = document.getElementById("boniteta-krediti-naslov");
    var opis = document.getElementById("boniteta-krediti-opis");
    var stevilo = document.getElementById("boniteta-krediti-stevilo");
    var lok = document.getElementById("boniteta-krediti-lok");
    if (!naslov || !opis || !stevilo || !lok) return;
    if (!credits || !Number.isFinite(credits.remaining) || !Number.isFinite(credits.detailedChecksAvailable)) {
      naslov.textContent = "Stanje kreditov trenutno ni na voljo";
      opis.textContent = "Cena posameznega sklopa je kljub temu prikazana na kartici.";
      stevilo.textContent = "—";
      lok.style.setProperty("--credit-progress", "0deg");
      return;
    }
    naslov.textContent = credits.detailedChecksAvailable + " vključenih podrobnih preveritev po 10 kreditov";
    var del = Number.isFinite(credits.included) && credits.included > 0 ? Math.max(0, Math.min(1, credits.remaining / credits.included)) : 0;
    var konecObdobja = "";
    if (credits.periodEnd) {
      var datumKonca = new Date(credits.periodEnd);
      if (!Number.isNaN(datumKonca.getTime())) konecObdobja = ". Obdobje se konča " + datumKonca.toLocaleDateString("sl-SI") + ".";
    }
    opis.textContent = "V povezanem OpenRegister paketu je še " + credits.remaining.toLocaleString("sl-SI") + (Number.isFinite(credits.included) ? " od " + credits.included.toLocaleString("sl-SI") : "") + " kreditov" + (konecObdobja || ".");
    stevilo.textContent = String(credits.detailedChecksAvailable);
    lok.style.setProperty("--credit-progress", Math.round(del * 360) + "deg");
  }

  async function naloziKredite(mojaGeneracija) {
    try {
      var token = await pridobiToken();
      var odgovor = await fetch("/api/boniteta-pro?route=openregister&action=credits", { headers: { Authorization: "Bearer " + token } });
      var telo = await odgovor.json().catch(function () { return {}; });
      if (mojaGeneracija !== generacijaRezultata) return;
      nastaviKredite(odgovor.ok && telo.ok ? telo.credits : null);
    } catch (_) {
      if (mojaGeneracija === generacijaRezultata) nastaviKredite(null);
    }
  }

  function nastaviTestniGrafi() {
    if (!rezultat || rezultat.dataset.testPreview !== "true") return;
    if (rezultat.dataset.testPreviewSource === "openregister") {
      if (popolnostVrednost) popolnostVrednost.textContent = "100 %";
      if (popolnostLok) {
        popolnostLok.style.strokeDashoffset = "0";
        popolnostLok.style.opacity = "1";
      }
      if (osnovniOpomba) osnovniOpomba.textContent = "Vseh šest osnovnih registrskih polj je v testnem OpenRegister odzivu izpolnjenih. To ni bonitetna ocena.";
      nastaviKredite({ remaining: 120, included: 500, detailedChecksAvailable: 12 });
      var naslov = document.getElementById("boniteta-krediti-naslov");
      if (naslov) naslov.textContent = "TESTNI PRIKAZ · " + naslov.textContent;
      return;
    }
    if (popolnostVrednost) popolnostVrednost.textContent = "—";
    if (popolnostLok) popolnostLok.style.opacity = ".18";
    if (osnovniOpomba) osnovniOpomba.textContent = "V testnem predogledu registrski podatki niso pridobljeni.";
    nastaviKredite(null);
  }

  if (typeof MutationObserver !== "undefined") {
    new MutationObserver(nastaviTestniGrafi).observe(rezultat, { attributes: true, attributeFilter: ["data-test-preview"] });
  }

  function pokaziNapako(sporocilo) {
    napaka.textContent = sporocilo;
    napaka.hidden = false;
  }

  function pocistiNapako() {
    napaka.textContent = "";
    napaka.hidden = true;
  }

  function opisNeuspeleSpletnePoizvedbe(podatki) {
    var razlog = podatki && podatki.publicProfile && podatki.publicProfile.reason;
    var opisi = {
      website_not_public: "Povezava ne vodi do javno dostopne spletne strani.",
      website_redirect_failed: "Spletna stran ima nedelujočo ali predolgo preusmeritev.",
      website_not_html: "Povezava ne vodi do berljive spletne strani.",
      website_too_large: "Spletna stran je prevelika za varno samodejno branje.",
      website_unreachable: "Spletna stran se ni odzvala ali je blokirala samodejni dostop.",
      website_server_error: "Spletni strežnik podjetja trenutno vrača napako.",
      website_rate_limited: "Spletna stran trenutno omejuje samodejni dostop.",
      impressum_not_found: "Na spletni strani nismo našli berljivega Impressuma.",
      legal_identity_incomplete: "Na strani ni bilo dovolj podatkov za zanesljivo potrditev podjetja.",
    };
    return (opisi[razlog] || "Spletna stran ni vrnila dovolj zanesljivih podatkov o podjetju.") +
      " Nadaljujte z računom, ponudbo ali ročnim vnosom. Pred insolvenčno preverbo boste podatke še pregledali.";
  }

  function nastaviSpletnoRezervo(prikazi, opis, razlog) {
    if (!spletnaRezerva || !zajemSklop) return;
    spletnaRezerva.hidden = !prikazi;
    zajemSklop.classList.toggle("is-spletna-rezerva", Boolean(prikazi));
    zajemSklop.setAttribute("aria-labelledby", prikazi ? "boniteta-spletna-rezerva-naslov" : "boniteta-zajem-naslov");
    if (zajemLocilo) zajemLocilo.hidden = Boolean(prikazi);
    if (opis && spletnaRezervaOpis) spletnaRezervaOpis.textContent = opis;
    if (!prikazi) {
      if (heroSpletnaStatus && heroSpletnaStatus.dataset.spletnaRezerva === "true") {
        heroSpletnaStatus.hidden = true;
        delete heroSpletnaStatus.dataset.spletnaRezerva;
      }
      return;
    }
    potek.hidden = true;
    rezultat.hidden = true;
    nastaviRezultatKotOkno(false);
    vnosPodrobnosti.hidden = true;
    if (heroSpletnaStatus) {
      var stranJeDejanskoNedosegljiva = [
        "website_not_public", "website_redirect_failed", "website_not_html", "website_too_large",
        "website_unreachable", "website_server_error", "website_rate_limited",
      ].includes(String(razlog || ""));
      heroSpletnaStatus.textContent = stranJeDejanskoNedosegljiva
        ? "Spletne strani ni bilo mogoče prebrati. Izberite drug način vnosa spodaj."
        : "Spletna stran je bila prebrana, vendar podjetja ni bilo mogoče zanesljivo potrditi. Izberite drug način vnosa spodaj.";
      heroSpletnaStatus.dataset.spletnaRezerva = "true";
      heroSpletnaStatus.hidden = false;
    }
    window.requestAnimationFrame(function () {
      zajemSklop.scrollIntoView({ behavior: "smooth", block: "center" });
      var prviGumb = document.getElementById("boniteta-nacin-slikaj");
      if (prviGumb) prviGumb.focus({ preventScroll: true });
    });
  }

  function jeNeuspesnaSpletnaIdentifikacija(podatki) {
    return nacinVnosa === "spletna" && podatki && podatki.identity && podatki.identity.status === "unresolved";
  }

  function osveziOpenRegisterPreklop() {
    var vklopljen = Boolean(openregisterIdentiteta && openregisterIdentiteta.checked);
    if (openregisterStatus) openregisterStatus.textContent = vklopljen ? "ON" : "OFF";
  }

  function vzpostaviPovecavoPosnetkov() {
    var stopnje = [50, 75, 100, 125, 150, 200, 250, 300, 400];
    document.querySelectorAll("[data-posnetek-povecava]").forEach(function (pregledovalnik) {
      var slika = pregledovalnik.querySelector("img");
      var okno = pregledovalnik.querySelector("[data-posnetek-okno]");
      var pomanjsaj = pregledovalnik.querySelector("[data-posnetek-pomanjsaj]");
      var povecaj = pregledovalnik.querySelector("[data-posnetek-povecaj]");
      var prilagodi = pregledovalnik.querySelector("[data-posnetek-prilagodi]");
      var izpis = pregledovalnik.querySelector("[data-posnetek-stopnja]");
      var indeks = stopnje.indexOf(100);

      function nastaviPovecavo(noviIndeks) {
        noviIndeks = Math.max(0, Math.min(stopnje.length - 1, noviIndeks));
        var razmerjeX = okno.scrollWidth > 0 ? (okno.scrollLeft + okno.clientWidth / 2) / okno.scrollWidth : 0.5;
        var razmerjeY = okno.scrollHeight > 0 ? (okno.scrollTop + okno.clientHeight / 2) / okno.scrollHeight : 0;
        indeks = noviIndeks;
        var odstotek = stopnje[indeks];
        slika.style.width = odstotek + "%";
        izpis.value = odstotek + " %";
        izpis.textContent = odstotek + " %";
        pomanjsaj.disabled = indeks === 0;
        povecaj.disabled = indeks === stopnje.length - 1;
        prilagodi.disabled = odstotek === 100;
        window.requestAnimationFrame(function () {
          okno.scrollLeft = Math.max(0, razmerjeX * okno.scrollWidth - okno.clientWidth / 2);
          okno.scrollTop = Math.max(0, razmerjeY * okno.scrollHeight - okno.clientHeight / 2);
        });
      }

      function ponastaviPovecavo() {
        okno.scrollLeft = 0;
        okno.scrollTop = 0;
        nastaviPovecavo(stopnje.indexOf(100));
      }

      pomanjsaj.addEventListener("click", function () { nastaviPovecavo(indeks - 1); });
      povecaj.addEventListener("click", function () { nastaviPovecavo(indeks + 1); });
      prilagodi.addEventListener("click", ponastaviPovecavo);
      okno.addEventListener("keydown", function (dogodek) {
        if (dogodek.key === "+" || dogodek.key === "=") {
          dogodek.preventDefault();
          nastaviPovecavo(indeks + 1);
        } else if (dogodek.key === "-") {
          dogodek.preventDefault();
          nastaviPovecavo(indeks - 1);
        } else if (dogodek.key === "0") {
          dogodek.preventDefault();
          ponastaviPovecavo();
        }
      });
      slika.addEventListener("dblclick", function () {
        nastaviPovecavo(indeks >= stopnje.indexOf(200) ? stopnje.indexOf(100) : stopnje.indexOf(200));
      });
      slika.addEventListener("load", ponastaviPovecavo);
      pregledovalnik.ponastaviPovecavo = ponastaviPovecavo;
      ponastaviPovecavo();
    });
  }

  function ponastaviPovecavoPosnetka(slika) {
    var pregledovalnik = slika && slika.closest("[data-posnetek-povecava]");
    if (pregledovalnik && typeof pregledovalnik.ponastaviPovecavo === "function") {
      window.requestAnimationFrame(pregledovalnik.ponastaviPovecavo);
    }
  }

  function nastaviBrezSpletne(izbrano) {
    potrjenoBrezSpletne = Boolean(izbrano);
    brezSpletneGumb.setAttribute("aria-pressed", String(potrjenoBrezSpletne));
    brezSpletneGumb.classList.toggle("is-selected", potrjenoBrezSpletne);
    brezSpletneGumb.querySelector("span").textContent = potrjenoBrezSpletne ? "✓" : "○";
    spletnaPolje.disabled = potrjenoBrezSpletne;
    if (potrjenoBrezSpletne) {
      spletnaPolje.value = "";
      spletnaStatus.textContent = "Potrjeno: preverba bo izvedena brez Impressuma in je lahko manj zanesljiva.";
    } else {
      spletnaStatus.textContent = "Spletna stran nam pomaga najti pravo ime nosilca v Impressumu.";
      spletnaPolje.focus();
    }
  }

  function prilagodiVnos(polje) {
    if (window.UJPrilagodiVelikostVnosa) window.UJPrilagodiVelikostVnosa(polje);
    polje.dispatchEvent(new Event("input", { bubbles: false }));
  }

  function nastaviZajemStatus(besedilo, stanje) {
    if (!zajemStatus || !zajemStatusBesedilo) return;
    zajemStatus.classList.toggle("ai-zajem__status--napaka", stanje === "napaka");
    zajemStatusBesedilo.textContent = besedilo || "";
    zajemStatus.hidden = !besedilo;
    var spinner = zajemStatus.querySelector(".ai-zajem__spinner");
    if (spinner) spinner.hidden = stanje !== "nalaganje";
  }

  function nastaviHeroPodjetje(ime) {
    var vrednost = String(ime || "").trim();
    if (!heroPodjetje || !heroSpletnaOkvir || !heroSpletnaLabel) return;
    heroPodjetje.hidden = !vrednost;
    heroSpletnaOkvir.hidden = Boolean(vrednost);
    heroSpletnaLabel.textContent = vrednost ? "Prepoznano podjetje" : "Spletna stran podjetja";
    if (heroPodjetjeIme) {
      heroPodjetjeIme.textContent = vrednost;
      if (vrednost && window.UJPrilagodiVelikostBesedila) window.UJPrilagodiVelikostBesedila(heroPodjetjeIme);
    }
  }

  function nastaviZajemKartico(datoteka, stanje) {
    var gumbId = datoteka && datoteka.type === "application/pdf" ? "boniteta-nacin-uvozi" : "boniteta-nacin-slikaj";
    ["boniteta-nacin-slikaj", "boniteta-nacin-uvozi"].forEach(function (id) {
      var kartica = document.getElementById(id);
      if (!kartica) return;
      var izbrana = Boolean(datoteka && id === gumbId);
      kartica.classList.toggle("is-selected", izbrana);
      var datotekaIzpis = kartica.querySelector("[data-zajem-datoteka]");
      var uspehIzpis = kartica.querySelector("[data-zajem-uspeh]");
      if (datotekaIzpis) {
        datotekaIzpis.textContent = izbrana ? String(datoteka.name || "Dokument").slice(0, 80) : "";
        datotekaIzpis.hidden = !izbrana;
      }
      if (uspehIzpis) uspehIzpis.hidden = !(izbrana && stanje === "uspeh");
    });
  }

  function nastaviZajemGumbe(onemogoceni) {
    ["boniteta-nacin-slikaj", "boniteta-nacin-uvozi", "boniteta-nacin-spletna", "boniteta-nacin-rocno"].forEach(function (id) {
      var element = document.getElementById(id);
      if (element) element.disabled = Boolean(onemogoceni);
    });
  }

  function stisniSlikoZaBoniteto(datoteka) {
    return new Promise(function (resolve, reject) {
      var slika = new Image();
      var url = URL.createObjectURL(datoteka);
      slika.onload = function () {
        URL.revokeObjectURL(url);
        var sirina = slika.width;
        var visina = slika.height;
        var meja = 1600;
        if (sirina > meja || visina > meja) {
          if (sirina >= visina) {
            visina = Math.round(visina / sirina * meja);
            sirina = meja;
          } else {
            sirina = Math.round(sirina / visina * meja);
            visina = meja;
          }
        }
        var platno = document.createElement("canvas");
        platno.width = sirina;
        platno.height = visina;
        platno.getContext("2d").drawImage(slika, 0, 0, sirina, visina);
        platno.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error("Slike ni bilo mogoče pripraviti za branje."));
        }, "image/jpeg", 0.82);
      };
      slika.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Slike ni bilo mogoče prebrati."));
      };
      slika.src = url;
    });
  }

  function blobVBase64ZaBoniteto(blob) {
    return new Promise(function (resolve, reject) {
      var bralnik = new FileReader();
      bralnik.onload = function () {
        var vrednost = String(bralnik.result || "");
        resolve(vrednost.slice(vrednost.indexOf(",") + 1));
      };
      bralnik.onerror = function () { reject(new Error("Datoteke ni bilo mogoče prebrati.")); };
      bralnik.readAsDataURL(blob);
    });
  }

  function nastaviNacinVnosa(nacin, brezPremika) {
    nacinVnosa = nacin;
    var samoSpletna = nacin === "spletna";
    document.querySelectorAll("[data-boniteta-rocni-podatek]").forEach(function (element) {
      element.hidden = samoSpletna;
    });
    vnosPodrobnosti.hidden = false;
    document.getElementById("boniteta-vnos-oznaka").textContent = samoSpletna ? "SPLETNA STRAN" : nacin === "dokument" ? "POTRDITEV RAZBRANIH PODATKOV" : "ROČNI VNOS";
    document.getElementById("boniteta-vnos-naslov").textContent = samoSpletna ? "Prilepite spletno povezavo" : nacin === "dokument" ? "Preverite razbrane podatke" : "Vnesite podatke stranke";
    document.getElementById("boniteta-vnos-opis").textContent = samoSpletna
      ? "Iz povezave bomo poiskali Impressum in razbrali pravno identiteto."
      : nacin === "dokument"
        ? "Preverite, da vsi podatki pripadajo izbrani stranki, in jih po potrebi popravite."
        : "Vnesite ime in celoten naslov; spletna stran je priporočljiva, ni pa obvezna.";
    document.getElementById("boniteta-vnos-namig").textContent = samoSpletna
      ? "Vnesite neposredno povezavo do strani podjetja ali njegovega Impressuma."
      : "Preverite, da ime in celoten naslov pripadata isti izbrani stranki.";
    gumb.querySelector("span").textContent = samoSpletna ? "Poišči Impressum" : "Preveri podatke";
    if (window.UJPrilagodiVelikostBesedila) {
      vnosPodrobnosti.querySelectorAll("[data-fit-text]").forEach(window.UJPrilagodiVelikostBesedila);
    }
    if (!brezPremika) {
      window.requestAnimationFrame(function () {
        (samoSpletna ? spletnaPolje : document.getElementById("boniteta-ime")).focus();
        vnosPodrobnosti.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  }

  function izpolniRazbranoPolje(id, vrednost) {
    var polje = document.getElementById(id);
    if (!polje) return;
    polje.value = vrednost || "";
    prilagodiVnos(polje);
  }

  function oznakaVloge(vloga) {
    return { izdajatelj: "Izdajatelj", prejemnik: "Prejemnik", drugo: "Druga stranka" }[vloga] || "Stranka";
  }

  function izberiRazbranoStranko(stranka, kartica) {
    izbiraStrankeSeznam.querySelectorAll("button").forEach(function (gumbStranke) {
      gumbStranke.classList.toggle("is-selected", gumbStranke === kartica);
      gumbStranke.setAttribute("aria-pressed", String(gumbStranke === kartica));
    });
    izpolniRazbranoPolje("boniteta-ime", stranka.pravnoIme || stranka.poslovniNaziv);
    izpolniRazbranoPolje("boniteta-naslov-podjetja", stranka.ulica);
    izpolniRazbranoPolje("boniteta-posta", String(stranka.postnaStevilka || "").replace(/\D/g, "").slice(0, 5));
    izpolniRazbranoPolje("boniteta-kraj", stranka.kraj);
    izpolniRazbranoPolje("boniteta-register", stranka.registerNumber);
    izpolniRazbranoPolje("boniteta-davcna", stranka.vatId);
    nastaviHeroPodjetje(stranka.pravnoIme || stranka.poslovniNaziv);
    if (stranka.spletnaStran) {
      nastaviBrezSpletne(false);
      izpolniRazbranoPolje("boniteta-spletna-stran", stranka.spletnaStran);
    } else {
      nastaviBrezSpletne(true);
    }
    nastaviNacinVnosa("dokument");
    if (/^\d{5}$/.test(document.getElementById("boniteta-posta").value)) {
      void dolociKrajIzPoste(document.getElementById("boniteta-posta").value);
    }
  }

  function izrisiRazbraneStranke(stranke) {
    izbiraStrankeSeznam.innerHTML = "";
    stranke.forEach(function (stranka) {
      var kartica = document.createElement("button");
      kartica.type = "button";
      kartica.className = "boniteta-izbira-stranke__kartica";
      kartica.setAttribute("aria-pressed", "false");
      var ime = document.createElement("strong");
      ime.textContent = stranka.pravnoIme || stranka.poslovniNaziv || "Neznana stranka";
      ime.setAttribute("data-fit-text", "");
      var vloga = document.createElement("span");
      vloga.className = "boniteta-izbira-stranke__vloga";
      vloga.textContent = oznakaVloge(stranka.vloga);
      var naslov = document.createElement("span");
      naslov.className = "boniteta-izbira-stranke__naslov";
      naslov.textContent = [stranka.ulica, stranka.postnaStevilka, stranka.kraj].filter(Boolean).join(", ") || "Naslov ni bil zanesljivo razbran";
      kartica.appendChild(ime);
      kartica.appendChild(vloga);
      kartica.appendChild(naslov);
      kartica.addEventListener("click", function () { izberiRazbranoStranko(stranka, kartica); });
      izbiraStrankeSeznam.appendChild(kartica);
    });
    izbiraStranke.hidden = false;
    vnosPodrobnosti.hidden = true;
    if (window.UJPrilagodiVelikostBesedila) {
      izbiraStranke.querySelectorAll("[data-fit-text]").forEach(window.UJPrilagodiVelikostBesedila);
    }
    izbiraStranke.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function obdelajDokumentZaBoniteto(datoteka) {
    if (!datoteka || zajemVTehniku) return;
    nastaviSpletnoRezervo(false);
    zajemVTehniku = true;
    nastaviZajemKartico(datoteka, "nalaganje");
    nastaviZajemGumbe(true);
    nastaviZajemStatus("Beremo stranke in njihove podatke …", "nalaganje");
    try {
      var mediaType;
      var blob = datoteka;
      if (datoteka.type === "application/pdf") {
        if (datoteka.size > 3 * 1024 * 1024) throw new Error("PDF je prevelik za samodejno branje (največ 3 MB)." );
        mediaType = "application/pdf";
      } else if (datoteka.type && datoteka.type.indexOf("image/") === 0) {
        blob = await stisniSlikoZaBoniteto(datoteka);
        mediaType = "image/jpeg";
      } else {
        throw new Error("Podprte so slike in PDF dokumenti.");
      }
      var odgovor = await fetch("/api/citaj-racun", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namen: "bonitetna_preverba", mediaType: mediaType, podatki: await blobVBase64ZaBoniteto(blob) }),
      });
      var telo = await odgovor.json().catch(function () { return null; });
      if (!odgovor.ok || !telo || !telo.ok || !Array.isArray(telo.stranke) || !telo.stranke.length) {
        throw new Error(telo && telo.napaka || "Strank na dokumentu ni bilo mogoče zanesljivo razbrati.");
      }
      izrisiRazbraneStranke(telo.stranke);
      nastaviZajemKartico(datoteka, "uspeh");
      nastaviZajemStatus("Dokument je prebran. Izberite stranko za preverjanje.", "uspeh");
    } catch (napakaZajema) {
      izbiraStranke.hidden = true;
      nastaviZajemKartico(datoteka, "napaka");
      nastaviZajemStatus(napakaZajema.message || "Dokumenta ni bilo mogoče prebrati.", "napaka");
    } finally {
      zajemVTehniku = false;
      nastaviZajemGumbe(false);
      if (zajemDatoteka) zajemDatoteka.value = "";
      if (zajemFotoaparat) zajemFotoaparat.value = "";
    }
  }

  async function dolociKrajIzPoste(posta) {
    if (!/^\d{5}$/.test(posta) || posta === zadnjaSamodejnaPosta) return;
    zadnjaSamodejnaPosta = posta;
    var mojaPoizvedba = ++zaporedjePostnePoizvedbe;
    krajiTrenutnePoste = [];
    izrecnoIzbraniKraj = "";
    krajStatus.textContent = "Iščem kraj …";
    try {
      var odgovor = await fetch("/api/nemcija-posta?postalCode=" + encodeURIComponent(posta));
      var podatki = await odgovor.json();
      var kraji = odgovor.ok && Array.isArray(podatki.cities) ? podatki.cities : [];
      if (mojaPoizvedba !== zaporedjePostnePoizvedbe || postaPolje.value.replace(/\D/g, "") !== posta) return;
      krajiTrenutnePoste = kraji.slice();
      krajiSeznam.innerHTML = "";
      krajiIzbira.innerHTML = "";
      krajiIzbira.hidden = true;
      kraji.forEach(function (kraj) {
        var moznost = document.createElement("option");
        moznost.value = kraj;
        krajiSeznam.appendChild(moznost);
      });
      if (!kraji.length) {
        krajStatus.textContent = "Kraj ni bil najden – vnesite ga ročno.";
        return;
      }
      if (kraji.length === 1 && (!krajPolje.value.trim() || krajPolje.value.trim() === samodejniKraj)) {
        samodejniKraj = kraji[0];
        izrecnoIzbraniKraj = kraji[0];
        krajPolje.value = samodejniKraj;
        prilagodiVnos(krajPolje);
      }
      if (kraji.length > 1) {
        if (krajPolje.value.trim() === samodejniKraj || !kraji.includes(krajPolje.value.trim())) {
          krajPolje.value = "";
          samodejniKraj = "";
        }
        kraji.forEach(function (kraj) {
          var gumbKraja = document.createElement("button");
          gumbKraja.type = "button";
          gumbKraja.textContent = kraj;
          gumbKraja.className = "boniteta-kraj-izbira__gumb";
          gumbKraja.classList.toggle("is-selected", krajPolje.value.trim() === kraj);
          gumbKraja.addEventListener("click", function () {
            krajPolje.value = kraj;
            samodejniKraj = kraj;
            izrecnoIzbraniKraj = kraj;
            krajiIzbira.querySelectorAll("button").forEach(function (gumb) {
              gumb.classList.toggle("is-selected", gumb === gumbKraja);
            });
            prilagodiVnos(krajPolje);
            krajStatus.textContent = "Izbran kraj: " + kraj + ".";
          });
          krajiIzbira.appendChild(gumbKraja);
        });
        krajiIzbira.hidden = false;
        krajStatus.textContent = "Ta poštna številka ima več krajev – izberite pravilnega.";
      } else {
        krajStatus.textContent = "Kraj je določen samodejno.";
      }
    } catch (_) {
      if (mojaPoizvedba !== zaporedjePostnePoizvedbe || postaPolje.value.replace(/\D/g, "") !== posta) return;
      krajStatus.textContent = "Kraja ni bilo mogoče določiti – vnesite ga ročno.";
    }
  }

  async function pridobiToken(prisilnoOsvezi) {
    var seja = await supabaseKlient.auth.getSession();
    if (seja && seja.error) throw seja.error;
    var trenutnaSeja = seja && seja.data && seja.data.session;
    var poteceKmalu = trenutnaSeja && trenutnaSeja.expires_at && trenutnaSeja.expires_at * 1000 < Date.now() + 60000;
    if (prisilnoOsvezi || !trenutnaSeja || poteceKmalu) {
      var osvezena = await supabaseKlient.auth.refreshSession();
      if (osvezena && osvezena.error) throw osvezena.error;
      trenutnaSeja = osvezena && osvezena.data && osvezena.data.session;
    }
    var token = trenutnaSeja && trenutnaSeja.access_token;
    if (!token) throw new Error("Prijava je potekla. Prijavite se znova.");
    return token;
  }

  async function shraniZakljucenoPreverbo(podatki, vnosObRezultatu, mojaGeneracija) {
    var identiteta = podatki && podatki.identity || {};
    var uradniCompanyId = identiteta.companyId || podatki.identityEvidence && podatki.identityEvidence.companyId || "";
    if (!profilPovezava || podatki.confirmationRequired || !identiteta.ime || !["verified_register", "confirmed_impressum"].includes(identiteta.status)) return;
    try {
      var token = await pridobiToken();
      var odgovor = await fetch("/api/boniteta-pro?route=profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          action: "save_check",
          profile: {
            companyId: uradniCompanyId,
            legalName: identiteta.naziv || identiteta.ime,
            registerNumber: uradniCompanyId ? identiteta.registerNumber || podatki.identityEvidence && podatki.identityEvidence.registerNumber || "" : "",
            registerCourt: uradniCompanyId ? identiteta.registerCourt || podatki.identityEvidence && podatki.identityEvidence.registerCourt || "" : "",
            companyStatus: identiteta.active === false ? "inactive" : identiteta.active === true ? "active" : "unknown",
            address: { street: identiteta.naslov || "", postal_code: identiteta.postnaStevilka || "", city: identiteta.kraj || "" },
            contact: { website: vnosObRezultatu && vnosObRezultatu.spletnaStran || "" },
            checkedAt: podatki.checkedAt,
            latestCheck: {
              result: podatki.result || {},
              insolvency: podatki.insolvency || {},
              northData: podatki.northData || null,
              identityStatus: identiteta.status,
              sources: podatki.sources || [],
            },
          },
        }),
      });
      var shranjeno = await odgovor.json().catch(function () { return {}; });
      if (mojaGeneracija === generacijaRezultata && odgovor.ok && shranjeno.profile && shranjeno.profile.id) {
        profilPovezava.href = "boniteta-profil.html?id=" + encodeURIComponent(shranjeno.profile.id);
        profilPovezava.hidden = false;
        var imaRegister = Boolean(identiteta.companyId || podatki.identityEvidence && podatki.identityEvidence.companyId);
        if (razsiritveSklop) {
          razsiritveSklop.hidden = !imaRegister;
          razsiritveSklop.querySelectorAll("[data-boniteta-razsiritev]").forEach(function (povezava) {
            povezava.href = "boniteta-profil.html?id=" + encodeURIComponent(shranjeno.profile.id) + "#" + encodeURIComponent(povezava.dataset.bonitetaRazsiritev);
          });
          if (imaRegister && window.UJPrilagodiVelikostBesedila) razsiritveSklop.querySelectorAll("[data-fit-text]").forEach(window.UJPrilagodiVelikostBesedila);
          if (imaRegister) void naloziKredite(mojaGeneracija);
        }
      }
    } catch (_) {
      // Osnovni rezultat ostane uporaben tudi, če profil trenutno ni mogoče shraniti.
    }
  }

  function pocakaj(ms) {
    return new Promise(function (resolve) { window.setTimeout(resolve, ms); });
  }

  function jeOmreznaNapaka(napakaKlica) {
    var sporocilo = String(napakaKlica && napakaKlica.message || "");
    return napakaKlica instanceof TypeError || /failed to fetch|networkerror|network request failed|load failed/i.test(sporocilo);
  }

  async function fetchSPonovnimPoskusom(url, moznosti) {
    try {
      return await fetch(url, moznosti);
    } catch (napakaKlica) {
      if (!jeOmreznaNapaka(napakaKlica)) throw napakaKlica;
      await pocakaj(700);
      try {
        return await fetch(url, moznosti);
      } catch (ponovljenaNapaka) {
        if (jeOmreznaNapaka(ponovljenaNapaka)) {
          throw new Error("Povezava z aplikacijskim strežnikom je prekinjena. Osvežite stran in poskusite znova.");
        }
        throw ponovljenaNapaka;
      }
    }
  }

  function omejitevKlica(ms) {
    return typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(ms)
      : undefined;
  }

  function opisiStanjeOpravila(job) {
    if (!vrstaStatus || !job) return;
    if (job.cached) {
      vrstaStatus.textContent = "Uporabljen je svež rezultat iste preverbe – ponoven obisk virov ni potreben.";
    } else if (job.reused) {
      vrstaStatus.textContent = "Isto preverjanje že poteka – prikazujemo njegovo trenutno stanje brez nove poizvedbe.";
    } else if (job.status === "processing") {
      vrstaStatus.textContent = "Preverjanje uradnih virov poteka" +
        (job.attempts > 1 ? " (ponovni poskus " + job.attempts + "/" + job.maxAttempts + ")" : "") + ".";
    } else if (job.status === "queued") {
      vrstaStatus.textContent = job.position > 1
        ? "Preverjanje varno čaka v vrsti. Pred vami je še " + (job.position - 1) + " zahtev."
        : "Preverjanje je naslednje v čakalni vrsti.";
    } else {
      vrstaStatus.textContent = "Preverjanje je zaključeno.";
    }
  }

  async function pocakajNaOpravilo(job, token) {
    if (!job || !job.id) throw new Error("Čakalna vrsta ni vrnila veljavnega preverjanja.");
    zadnjiJobId = job.id;
    opisiStanjeOpravila(job);
    if (job.status === "completed" && job.result) return job.result;

    var konec = Date.now() + 55 * 1000;
    var naslednjePrebujanje = 0;
    while (Date.now() < konec) {
      // Vsak odprt uporabnik lahko varno prebudi enega delavca. Baza tudi pri
      // 100 sočasnih klicih globalno dovoli 30 opravil, od tega največ 10
      // insolvenčnih poizvedb na uradni portal.
      if (Date.now() >= naslednjePrebujanje) {
        naslednjePrebujanje = Date.now() + 15000;
        // Delavec lahko zaradi zunanjega vira dela do ene minute. Njegovega
        // HTTP odgovora ne čakamo, saj moramo medtem uporabniku prikazovati
        // sveže stanje trajno shranjenega opravila.
        fetch("/api/mehka-boniteta-delavec", {
          method: "POST",
          headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
          body: "{}",
          signal: omejitevKlica(65000),
        }).catch(function () {
          // Opravilo je trajno shranjeno; naslednja statusna poizvedba pokaže,
          // ali ga je medtem prevzel drug delavec.
        });
      }

      var odgovor = await fetchSPonovnimPoskusom("/api/mehka-boniteta-opravilo?id=" + encodeURIComponent(job.id), {
        headers: { Authorization: "Bearer " + token },
        signal: omejitevKlica(15000),
      });
      var podatki = null;
      try { podatki = await odgovor.json(); } catch (_) {}
      if (!odgovor.ok) throw new Error((podatki && podatki.napaka) || "Stanja preverjanja ni bilo mogoče prebrati.");
      job = podatki && podatki.job;
      opisiStanjeOpravila(job);
      if (job.status === "completed" && job.result) return job.result;
      if (job.status === "failed") {
        if (job.result) return job.result;
        throw new Error(job.error || "Preverjanje ni uspelo niti po treh poskusih.");
      }
      await pocakaj(job.status === "processing" ? 1000 : 1800);
    }
    throw new Error("Preverjanje se nadaljuje v ozadju. Poskusite ponovno čez nekaj trenutkov; sistem bo uporabil isto opravilo in ne bo ponovil poizvedbe.");
  }

  async function izvediPrekoCakalneVrste(telo, token) {
    var ustvarjeno = null;
    var ustvarjeniPodatki = null;
    for (var authPoskus = 0; authPoskus < 3; authPoskus += 1) {
      ustvarjeno = await fetchSPonovnimPoskusom("/api/mehka-boniteta-opravilo", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(telo),
        signal: omejitevKlica(15000),
      });
      ustvarjeniPodatki = null;
      try { ustvarjeniPodatki = await ustvarjeno.json(); } catch (_) {}
      if (ustvarjeno.ok) break;
      var authZacasna = ustvarjeniPodatki && ustvarjeniPodatki.retryable === true &&
        ["AUTH_SERVER_UNAVAILABLE", "AUTH_TIMEOUT"].includes(ustvarjeniPodatki.code);
      var sejaNeveljavna = ustvarjeniPodatki && ["AUTH_SESSION_INVALID", "AUTH_SESSION_REFRESH_REQUIRED"].includes(ustvarjeniPodatki.code);
      if (sejaNeveljavna && authPoskus === 0) {
        token = await pridobiToken(true);
        continue;
      }
      if (!authZacasna || authPoskus === 2) break;
      await pocakaj(authPoskus === 0 ? 500 : 1200);
      token = await pridobiToken(authPoskus > 0);
    }
    if (!ustvarjeno.ok) throw new Error((ustvarjeniPodatki && ustvarjeniPodatki.napaka) || "Preverjanja ni bilo mogoče dodati v čakalno vrsto.");
    return pocakajNaOpravilo(ustvarjeniPodatki && ustvarjeniPodatki.job, token);
  }

  async function nadaljujOpravilo(jobId) {
    nastaviNalaganje(true);
    if (samoSpletniVnos && heroSpletnaStatus) {
      heroSpletnaStatus.textContent = "Iščemo podjetje in posodabljamo podatke obrtnika …";
      heroSpletnaStatus.hidden = false;
    }
    try {
      var token = await pridobiToken();
      var odgovor = await fetchSPonovnimPoskusom("/api/mehka-boniteta-opravilo?id=" + encodeURIComponent(jobId), {
        headers: { Authorization: "Bearer " + token },
        signal: omejitevKlica(15000),
      });
      var podatki = null;
      try { podatki = await odgovor.json(); } catch (_) {}
      if (!odgovor.ok || !podatki || !podatki.job) throw new Error((podatki && podatki.napaka) || "Preverjanja ni bilo mogoče odpreti.");
      zadnjiVnos = podatki.job.request || {};
      nacinVnosa = zadnjiVnos.spletnaStran ? "spletna" : "rocno";
      izpolniRazbranoPolje("boniteta-ime", zadnjiVnos.ime);
      izpolniRazbranoPolje("boniteta-naslov-podjetja", zadnjiVnos.naslov);
      izpolniRazbranoPolje("boniteta-posta", zadnjiVnos.postnaStevilka);
      izpolniRazbranoPolje("boniteta-kraj", zadnjiVnos.kraj);
      izpolniRazbranoPolje("boniteta-register", zadnjiVnos.registerNumber);
      izpolniRazbranoPolje("boniteta-davcna", zadnjiVnos.vatId);
      izpolniRazbranoPolje("boniteta-spletna-stran", zadnjiVnos.spletnaStran);
      if (heroSpletnaPolje) heroSpletnaPolje.value = zadnjiVnos.spletnaStran || "";
      nastaviNacinVnosa(nacinVnosa, true);
      var rezultatOpravila = await pocakajNaOpravilo(podatki.job, token);
      izrisi(rezultatOpravila);
    } catch (err) {
      potek.hidden = true;
      pokaziNapako(err.message || "Preverjanja ni bilo mogoče nadaljevati.");
    } finally {
      nastaviNalaganje(false);
      if (samoSpletniVnos && heroSpletnaStatus) heroSpletnaStatus.hidden = true;
    }
  }

  function nastaviNalaganje(vklopljeno) {
    gumb.disabled = vklopljeno;
    if (vklopljeno) {
      nastaviRezultatKotOkno(true);
      gumb.classList.add("is-loading");
      gumb.innerHTML = '<span class="boniteta-gumb__spinner" aria-hidden="true"></span><span>Preverjam uradne vire …</span>';
      potek.hidden = false;
      rezultat.hidden = true;
      if (vrstaStatus) vrstaStatus.textContent = "Preverjanje dodajam v varno čakalno vrsto …";
    } else {
      gumb.classList.remove("is-loading");
      gumb.innerHTML = privzetiGumb;
      var oznakaGumba = gumb.querySelector("span");
      if (oznakaGumba) oznakaGumba.textContent = nacinVnosa === "spletna" ? "Poišči Impressum" : "Preveri podatke";
    }
  }

  function dodajPodatek(dl, oznaka, vrednost, barva) {
    if (!vrednost) return;
    if (!barva) {
      dl.insertAdjacentHTML("beforeend", "<dt>" + esc(oznaka) + "</dt><dd data-fit-text data-fit-text-min=\"8\">" + esc(vrednost) + "</dd>");
      return;
    }
    var dovoljeneBarve = ["blue", "green", "violet", "amber", "neutral"];
    var ton = dovoljeneBarve.includes(barva) ? barva : "neutral";
    dl.insertAdjacentHTML("beforeend", '<div class="boniteta-podatek boniteta-podatek--' + ton + '">' +
      '<dt><span class="boniteta-podatek__pika" aria-hidden="true"></span>' + esc(oznaka) + '</dt>' +
      '<dd data-fit-text data-fit-text-min="8">' + esc(vrednost) + "</dd></div>");
  }

  function zacetniciPodjetja(ime) {
    var pravneOblike = /^(gmbh|ug|ag|kg|ohg|gbr|e\.k\.?|mbh|co\.?|kgaa)$/i;
    var besede = String(ime || "")
      .replace(/&/g, " ")
      .split(/\s+/)
      .map(function (beseda) { return beseda.replace(/[^A-Za-zÀ-ž0-9]/g, ""); })
      .filter(function (beseda) { return beseda && !pravneOblike.test(beseda); });
    if (!besede.length) return "—";
    return besede.slice(0, 2).map(function (beseda) { return beseda.charAt(0); }).join("").toUpperCase();
  }

  function opisCasaPreverbe(vrednost) {
    var datum = new Date(vrednost || Date.now());
    if (Number.isNaN(datum.getTime())) datum = new Date();
    var danes = new Date();
    var istiDan = datum.getFullYear() === danes.getFullYear() && datum.getMonth() === danes.getMonth() && datum.getDate() === danes.getDate();
    var ura = new Intl.DateTimeFormat("sl-SI", { hour: "2-digit", minute: "2-digit" }).format(datum);
    if (istiDan) return "preverjeno danes ob " + ura;
    return "preverjeno " + new Intl.DateTimeFormat("sl-SI", { day: "numeric", month: "numeric", year: "numeric" }).format(datum) + " ob " + ura;
  }

  function ikonaPodjetja(vrsta) {
    var ikone = {
      sedez: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.4"/></svg>',
      oblika: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5M10 13h5M10 17h5"/></svg>',
      register: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16M6 9v9M10 9v9M14 9v9M18 9v9M3 19h18M12 3l9 5H3z"/></svg>',
      sodisce: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16M6 9v9M10 9v9M14 9v9M18 9v9M3 19h18M12 3l9 5H3z"/></svg>',
    };
    return ikone[vrsta] || "";
  }

  function grafikaPodjetja(vrsta) {
    var grafike = {
      sedez: '<svg viewBox="0 0 160 80" aria-hidden="true"><path d="M3 74h154M13 74V50h22v24M40 74V38h28v36M74 74V47h23v27M103 74V29h34v45M112 29V17h16v12M120 17V7M116 12h8M20 58h8M20 65h8M48 47h6M59 47h6M48 57h6M59 57h6M82 55h7M82 64h7M111 40h8M125 40h8M111 51h8M125 51h8M111 62h8M125 62h8"/></svg>',
      oblika: '<svg viewBox="0 0 84 84" aria-hidden="true"><path d="M20 8h29l15 15v53H20zM49 8v16h16M29 36h26M29 47h26M29 58h18M14 15H8v61h43"/></svg>',
      register: '<svg viewBox="0 0 90 72" aria-hidden="true"><path d="M10 59h70M16 54h58M21 25h48v29H21zM28 31v17M39 31v17M51 31v17M62 31v17M15 25h60L45 8zM8 63h74"/></svg>',
      sodisce: '<svg viewBox="0 0 150 76" aria-hidden="true"><path d="M8 66h134M16 61h118M24 30h102v31H24zM35 35v21M53 35v21M72 35v21M91 35v21M109 35v21M17 30h116L75 7zM8 70h134M75 14 95 26H55z"/></svg>',
    };
    return grafike[vrsta] || "";
  }

  function dodajKarticoPodjetja(dl, vrsta, oznaka, vrednost) {
    var potrjeno = Boolean(vrednost);
    dl.insertAdjacentHTML("beforeend", '<div class="boniteta-podjetje-kartica boniteta-podjetje-kartica--' + vrsta + (potrjeno ? ' is-verified' : ' is-missing') + '">' +
      '<span class="boniteta-podjetje-kartica__ikona">' + ikonaPodjetja(vrsta) + '</span>' +
      '<div class="boniteta-podjetje-kartica__vsebina"><dt>' + esc(oznaka) + '</dt><dd data-fit-text data-fit-text-min="8">' + esc(vrednost || "Ni podatka") + '</dd></div>' +
      '<span class="boniteta-podjetje-kartica__grafika">' + grafikaPodjetja(vrsta) + '</span>' +
      (potrjeno ? '<span class="boniteta-podjetje-kartica__kljukica" aria-label="Podatek je potrjen">✓</span>' : '') +
      '</div>');
  }

  function izrisiRegistrskoPodjetje(podatki, identiteta) {
    var ime = identiteta.ime || identiteta.naziv || "Podjetje";
    var naslov = identiteta.naslov || "";
    var kraj = [identiteta.postnaStevilka, identiteta.kraj].filter(Boolean).join(" ");
    podjetjeSklop.classList.add("is-register-card");
    podjetjeGlava.hidden = false;
    podjetjePodnaslov.hidden = false;
    podjetjeMonogram.textContent = zacetniciPodjetja(ime);
    podjetjeIme.textContent = ime;
    podjetjePreverjeno.textContent = "Identiteta potrjena · " + opisCasaPreverbe(podatki && podatki.checkedAt);
    dodajKarticoPodjetja(hwkPodatki, "sedez", "Sedež", [naslov, kraj].filter(Boolean).join(" · "));
    dodajKarticoPodjetja(hwkPodatki, "oblika", "Pravna oblika", identiteta.legalForm);
    dodajKarticoPodjetja(hwkPodatki, "register", "Register", identiteta.registerNumber);
    dodajKarticoPodjetja(hwkPodatki, "sodisce", "Sodišče", identiteta.registerCourt);
  }

  window.UJBonitetaPrikaziRegistrskoPodjetje = function (podatki) {
    var identiteta = podatki && podatki.identity || {};
    var naslov = document.getElementById("boniteta-identiteta-naslov");
    var statusBesedilo = identiteta.active === true ? "Aktivno" : identiteta.active === false ? "Neaktivno" : "Status ni znan";
    var statusRazred = identiteta.active === true ? "boniteta-znacka--green" : identiteta.active === false ? "boniteta-znacka--red" : "boniteta-znacka--yellow";
    if (!identiteta.ime && !identiteta.naziv) return;
    hwkPodatki.innerHTML = "";
    hwkStatus.textContent = statusBesedilo;
    hwkStatus.className = "boniteta-znacka " + statusRazred;
    if (naslov) naslov.textContent = "Podatki podjetja";
    izrisiRegistrskoPodjetje(podatki, identiteta);
    if (window.UJPrilagodiVelikostBesedila) podjetjeSklop.querySelectorAll("[data-fit-text]").forEach(window.UJPrilagodiVelikostBesedila);
  };

  window.UJBonitetaPonastaviRegistrskoPodjetje = function () {
    podjetjeSklop.classList.remove("is-register-card");
    podjetjeGlava.hidden = true;
    podjetjePodnaslov.hidden = true;
  };

  function izrisiMetodologijo(podatki) {
    var ovoj = document.getElementById("boniteta-metodologija");
    if (!ovoj) return;
    var identiteta = podatki && podatki.identity || {};
    var lokacija = podatki && podatki.locationMatch || {};
    var insolvenca = podatki && podatki.insolvency || {};
    var uradno = insolvenca.officialVerification || {};
    var vhod = uradno.inputVerification || {};
    var imaPosnetek = uradno.evidenceStatus === "captured" && /^data:image\/jpeg;base64,/.test(uradno.evidenceImage || "");
    var koraki = {
      identity: identiteta.status === "verified_register"
        ? { stanje: "done", ikona: "✓", tekst: "Uradno potrjeno" }
        : identiteta.status === "confirmed_impressum"
          ? { stanje: "review", ikona: "✓", tekst: "Uporabnik potrdil" }
          : identiteta.status === "probable_impressum"
            ? { stanje: "review", ikona: "!", tekst: "Potrdite podatke" }
            : { stanje: "waiting", ikona: "?", tekst: "Ni potrjeno" },
      location: lokacija.status === "matched"
        ? { stanje: ["user_confirmed", "manual_user_confirmed"].includes(lokacija.confirmationType) ? "review" : "done", ikona: "✓", tekst: "Podatki se ujemajo" }
        : lokacija.status === "mismatch"
          ? { stanje: "alert", ikona: "!", tekst: "Ne ujema se" }
          : { stanje: "waiting", ikona: "?", tekst: "Ni potrjeno" },
      query: vhod.status === "matched"
        ? { stanje: "done", ikona: "✓", tekst: "Vnos preverjen" }
        : (insolvenca.searchedName && (insolvenca.searchedCity || insolvenca.searchedPostalCode))
          ? { stanje: "review", ikona: "✓", tekst: "Podatki poslani" }
          : { stanje: "waiting", ikona: "?", tekst: podatki && podatki.confirmationRequired ? "Čaka potrditev" : "Ni izvedeno" },
      evidence: imaPosnetek && uradno.status === "clear"
        ? { stanje: "done", ikona: "✓", tekst: "Brez objave + dokaz" }
        : imaPosnetek && uradno.status === "confirmed_match"
          ? { stanje: "alert", ikona: "!", tekst: "Objava potrjena" }
          : uradno.status === "unavailable" || insolvenca.status === "unavailable"
            ? { stanje: "review", ikona: "!", tekst: "Vir ni dosegljiv" }
            : uradno.status === "unverified"
              ? { stanje: "review", ikona: "!", tekst: "Potreben pregled" }
              : { stanje: "waiting", ikona: "?", tekst: "Ni dokazila" },
    };
    Object.keys(koraki).forEach(function (ime) {
      var element = ovoj.querySelector('[data-metodologija-korak="' + ime + '"]');
      if (!element) return;
      var stanje = koraki[ime];
      element.className = "boniteta-metodologija__korak is-" + stanje.stanje;
      element.querySelector(".boniteta-metodologija__ikona").textContent = stanje.ikona;
      element.querySelector("b").textContent = stanje.tekst;
    });

    var skupno = document.getElementById("boniteta-metodologija-skupno");
    var povzetek = document.getElementById("boniteta-metodologija-povzetek");
    var naslov = "Preverba še ni zaključena.";
    var opis = "Spodaj vidite, kateri korak zahteva dopolnitev ali ponovni poskus.";
    var ton = "waiting";
    if (uradno.status === "confirmed_match" || insolvenca.status === "possible_match") {
      naslov = "Najdena je možna insolvenčna objava.";
      opis = "Pred odločitvijo preglejte uradni posnetek in vse prikazane objave.";
      ton = "alert";
    } else if (koraki.evidence.stanje === "done") {
      naslov = "Uradna insolvenčna preverba je zaključena.";
      opis = "Za prikazano ime in lokacijo ni bilo najdene objave; rezultat ni bonitetna garancija.";
      ton = koraki.identity.stanje === "done" && koraki.location.stanje === "done" ? "done" : "review";
    } else if (podatki && podatki.confirmationRequired) {
      naslov = "Pred nadaljevanjem potrdite identiteto in naslov.";
      opis = "Uradna insolvenčna poizvedba se do takrat ne izvede.";
      ton = "review";
    }
    skupno.className = "boniteta-metodologija__sklep is-" + ton;
    skupno.textContent = ton === "done" ? "4/4 zaključeno" : ton === "alert" ? "Potreben pregled" : ton === "review" ? "Potrebna pozornost" : "Ni zaključeno";
    povzetek.className = "boniteta-metodologija__povzetek is-" + ton;
    povzetek.querySelector("span").textContent = ton === "done" ? "✓" : ton === "alert" ? "!" : "i";
    povzetek.querySelector("strong").textContent = naslov;
    povzetek.querySelector("small").textContent = opis;
  }

  function oznakaStatusaVira(status, reason) {
    if (status === "found") return { tekst: "Najdeno", razred: "green" };
    if (status === "disabled") return { tekst: "Izklopljeno", razred: "yellow" };
    if (status === "manual_available") return { tekst: "Ročno", razred: "yellow" };
    if (status === "not_configured") return { tekst: "Ni povezano", razred: "yellow" };
    if (status === "unsupported_region") return { tekst: "Ni priključeno", razred: "yellow" };
    if (status === "unavailable" && reason === "insufficient_credits") return { tekst: "Kvota ni na voljo", razred: "yellow" };
    if (status === "unavailable" && reason === "rate_limited") return { tekst: "Začasno omejeno", razred: "yellow" };
    if (status === "unavailable") return { tekst: "Nedosegljivo", razred: "yellow" };
    if (status === "ambiguous") return { tekst: "Več zadetkov", razred: "yellow" };
    if (status === "not_provided") return { tekst: "Brez vnosa", razred: "" };
    if (status === "skipped") return { tekst: "Ni potrebno", razred: "green" };
    return { tekst: "Brez zadetka", razred: "" };
  }

  function izrisiVire(viri) {
    var vsebnik = document.getElementById("boniteta-viri");
    vsebnik.innerHTML = "";
    (Array.isArray(viri) ? viri : []).forEach(function (vir) {
      var status = oznakaStatusaVira(vir.status, vir.reason);
      var vrstica = document.createElement("div");
      vrstica.className = "boniteta-vir-vrstica";
      var naslov = document.createElement("div");
      naslov.className = "boniteta-vir-vrstica__naslov";
      naslov.setAttribute("data-fit-text", "");
      naslov.setAttribute("data-fit-text-min", "8");
      naslov.textContent = vir.label || "Vir";
      var znacka = document.createElement("span");
      znacka.className = "boniteta-vir-vrstica__status" + (status.razred ? " boniteta-vir-vrstica__status--" + status.razred : "");
      znacka.textContent = status.tekst;
      naslov.appendChild(znacka);
      vrstica.appendChild(naslov);
      if (/^https?:\/\//i.test(String(vir.sourceUrl || ""))) {
        var povezava = document.createElement("a");
        povezava.className = "boniteta-vir-vrstica__akcija";
        povezava.href = vir.sourceUrl;
        povezava.target = "_blank";
        povezava.rel = "noopener";
        povezava.textContent = "Odpri ↗";
        vrstica.appendChild(povezava);
      }
      var opis = document.createElement("p");
      opis.className = "boniteta-vir-vrstica__opis";
      opis.textContent = vir.message || "";
      vrstica.appendChild(opis);
      vsebnik.appendChild(vrstica);
    });
  }

  function izrisi(podatki) {
    if (jeNeuspesnaSpletnaIdentifikacija(podatki)) {
      nastaviSpletnoRezervo(true, opisNeuspeleSpletnePoizvedbe(podatki), podatki && podatki.publicProfile && podatki.publicProfile.reason);
      return;
    }
    generacijaRezultata += 1;
    var mojaGeneracija = generacijaRezultata;
    nastaviRazsiritveOdprte(false);
    var vnosObRezultatu = zadnjiVnos ? Object.assign({}, zadnjiVnos) : null;
    var sklep = podatki.result || {};
    rezultat.className = "boniteta-rezultat boniteta-rezultat--" + (sklep.level || "yellow");
    document.getElementById("boniteta-rezultat-naslov").textContent = sklep.title || "Preverjanje zaključeno";
    document.getElementById("boniteta-rezultat-opis").textContent = sklep.message || "";
    document.getElementById("boniteta-status-ikona").textContent = sklep.level === "green" ? "✓" : sklep.level === "red" ? "!" : "?";

    var hwkVir = document.getElementById("boniteta-hwk-vir");
    var profil = podatki.publicProfile || {};
    var openregister = podatki.openregister || {};
    var identiteta = podatki.identity || {};
    izrisiOsnovniPregled(podatki);
    nastaviHeroPodjetje(identiteta.naziv || identiteta.ime || (zadnjiVnos && zadnjiVnos.ime));
    var dokaziloIdentitete = podatki.identityEvidence || {};
    var dokaziloImpressuma = podatki.impressumEvidence || {};
    var prikazanoDokaziloIdentitete = dokaziloImpressuma.status === "captured" && dokaziloImpressuma.screenshotReady === true
      ? dokaziloImpressuma
      : dokaziloIdentitete;
    var ujemanjeLokacije = podatki.locationMatch || {};
    var identitetaNaslov = document.getElementById("boniteta-identiteta-naslov");
    var identitetaPosnetek = document.getElementById("boniteta-identiteta-posnetek");
    var identitetaSlika = document.getElementById("boniteta-identiteta-slika");
    var identitetaPrenos = document.getElementById("boniteta-identiteta-prenos");
    var identitetaCas = document.getElementById("boniteta-identiteta-cas");
    var identitetaUrl = document.getElementById("boniteta-identiteta-url");
    var identitetaDokaziloStatus = document.getElementById("boniteta-identiteta-dokazilo-status");
    var omejitev = document.getElementById("boniteta-omejitev");
    hwkPodatki.innerHTML = "";
    podjetjeSklop.classList.remove("is-register-card");
    podjetjeGlava.hidden = true;
    podjetjePodnaslov.hidden = true;
    hwkVir.hidden = false;
    identitetaPosnetek.hidden = true;
    identitetaSlika.removeAttribute("src");
    identitetaDokaziloStatus.hidden = true;
    identitetaDokaziloStatus.className = "boniteta-dokazilo-status";
    identitetaDokaziloStatus.textContent = "";
    potrditevIdentitete.hidden = true;
    if (identiteta.status === "verified_register") {
      window.UJBonitetaPrikaziRegistrskoPodjetje(podatki);
      hwkVir.href = openregister.sourceUrl || "https://openregister.de";
      hwkVir.textContent = "Odpri register podjetij ↗";
    } else if (["probable_impressum", "confirmed_impressum"].includes(identiteta.status) && profil.subjekt) {
      hwkStatus.textContent = identiteta.status === "confirmed_impressum" ? "Uporabnik potrdil" : "Impressum najden";
      hwkStatus.className = "boniteta-znacka boniteta-znacka--yellow";
      identitetaNaslov.textContent = "Podatki iz Impressuma";
      dodajPodatek(hwkPodatki, "Naziv", identiteta.naziv, "blue");
      if (identiteta.nosilec || identiteta.entityType !== "company") {
        var primarnaPravnaVloga = Array.isArray(identiteta.vloge) && identiteta.vloge[0] && identiteta.vloge[0].vloga;
        dodajPodatek(hwkPodatki, primarnaPravnaVloga === "Inhaber" ? "Nosilec (Inhaber)" : "Nosilec oziroma zastopnik", identiteta.nosilec || identiteta.ime, "neutral");
      } else {
        dodajPodatek(hwkPodatki, "Zastopnik", "V Impressumu ni naveden – preverite pravno ime in naslov.", "neutral");
      }
      dodajPodatek(hwkPodatki, "Naslov", [identiteta.naslov, identiteta.postnaStevilka, identiteta.kraj].filter(Boolean).join(", "), "green");
      dodajPodatek(hwkPodatki, "Stopnja", identiteta.status === "confirmed_impressum" ? "Potrjeno s strani uporabnika" : "Čaka na pregled uporabnika", "neutral");
      hwkVir.href = profil.sourceUrl || identiteta.sourceUrl || "#";
      hwkVir.textContent = "Odpri Impressum podjetja ↗";
    } else if (["manual_input", "confirmed_manual"].includes(identiteta.status)) {
      hwkStatus.textContent = identiteta.status === "confirmed_manual" ? "Uporabnik potrdil" : "Vir manjka";
      hwkStatus.className = "boniteta-znacka boniteta-znacka--yellow";
      identitetaNaslov.textContent = "Ročno vneseni podatki";
      dodajPodatek(hwkPodatki, "Pravno ime oziroma nosilec", identiteta.ime, "blue");
      dodajPodatek(hwkPodatki, "Poslovni naziv", identiteta.naziv, "neutral");
      dodajPodatek(hwkPodatki, "Naslov", [identiteta.naslov, identiteta.postnaStevilka, identiteta.kraj].filter(Boolean).join(", "), "green");
      dodajPodatek(hwkPodatki, "Stopnja", identiteta.status === "confirmed_manual" ? "Uporabnik je podatke potrdil" : "Ročni vnos ni dokaz pravne identitete", "neutral");
      hwkVir.hidden = true;
    } else {
      hwkStatus.textContent = "Ni razbrano";
      hwkStatus.className = "boniteta-znacka boniteta-znacka--yellow";
      identitetaNaslov.textContent = "Identiteta";
      dodajPodatek(hwkPodatki, "Rezultat", "Noben avtomatski vir ni vrnil dovolj zanesljive identitete.", "neutral");
      dodajPodatek(hwkPodatki, "Naslednje", "Preverite spletno stran ali ročno vnesite podatke iz ponudbe oziroma predračuna.", "neutral");
      hwkVir.href = profil.sourceUrl || (zadnjiVnos && zadnjiVnos.spletnaStran) || "#";
      hwkVir.textContent = "Odpri vneseno spletno stran ↗";
    }

    if (omejitev) {
      omejitev.textContent = identiteta.status === "verified_register"
        ? "Identiteta je pridobljena iz registra. Odsotnost insolvenčnega zadetka kljub temu ni popolna bonitetna garancija."
        : ["probable_impressum", "confirmed_impressum"].includes(identiteta.status)
          ? "Podatki iz Impressuma so uporabniško potrjeni in niso uradni registrski izpis. Odsotnost insolvenčnega zadetka ni popolna bonitetna garancija."
          : "Ročno vneseni podatki niso preverljiv pravni vir. Insolvenčna poizvedba ni bila izvedena in rezultat ni bonitetna garancija.";
    }

    if (podatki.confirmationRequired) {
      var jeRocniVnos = identiteta.status === "manual_input";
      zadnjaOpenRegisterReferenca = identiteta.companyId || dokaziloIdentitete.companyId || "";
      potrditevIdentitete.hidden = false;
      potrditevNapaka.hidden = true;
      document.getElementById("boniteta-potrditev-naslov").textContent = jeRocniVnos ? "Vnesite in potrdite podatke za insolvenčno poizvedbo" : "Preverite podatke pred insolvenčno poizvedbo";
      document.getElementById("boniteta-potrditev-opis").textContent = jeRocniVnos
        ? "OpenRegister in spletna stran identitete nista potrdila. Dopolnite vsa polja; po potrditvi bomo s temi podatki preverili uradni insolvenčni register."
        : "Primerjajte polja s prikazanim virom. Če je sistem kaj narobe razbral, podatek popravite.";
      document.getElementById("boniteta-potrditev-kljukica").textContent = jeRocniVnos
        ? "Potrjujem, da sem vse podatke vnesel pravilno in želim z njimi izvesti insolvenčno poizvedbo."
        : "Podatke sem primerjal s prikazanim virom in so pravilni.";
      var potrjujePravnoDruzbo = identiteta.entityType === "company";
      var potrdiImePolje = document.getElementById("boniteta-potrdi-ime");
      var potrdiNazivPolje = document.getElementById("boniteta-potrdi-naziv");
      var potrdiNosilecPolje = document.getElementById("boniteta-potrdi-nosilec");
      var potrdiNosilecOvoj = document.getElementById("boniteta-potrdi-nosilec-ovoj");
      document.getElementById("boniteta-potrdi-ime-oznaka").firstChild.nodeValue = potrjujePravnoDruzbo ? "Pravno ime " : "Osebno ime ";
      potrdiImePolje.value = potrjujePravnoDruzbo
        ? (identiteta.naziv || identiteta.ime || (zadnjiVnos && zadnjiVnos.ime) || "")
        : (identiteta.ime || (zadnjiVnos && zadnjiVnos.ime) || "");
      document.getElementById("boniteta-potrdi-naziv").value = identiteta.poslovniNaziv || identiteta.naziv || identiteta.ime || (zadnjiVnos && zadnjiVnos.ime) || "";
      potrdiNosilecPolje.value = identiteta.nosilec || "";
      potrdiNosilecOvoj.hidden = !potrjujePravnoDruzbo && !identiteta.nosilec;
      document.getElementById("boniteta-potrdi-naslov").value = identiteta.naslov || (zadnjiVnos && zadnjiVnos.naslov) || "";
      document.getElementById("boniteta-potrdi-posta").value = identiteta.postnaStevilka || (zadnjiVnos && zadnjiVnos.postnaStevilka) || "";
      document.getElementById("boniteta-potrdi-kraj").value = identiteta.kraj || (zadnjiVnos && zadnjiVnos.kraj) || "";
      [potrdiImePolje, potrdiNazivPolje, potrdiNosilecPolje,
        document.getElementById("boniteta-potrdi-naslov"), document.getElementById("boniteta-potrdi-posta"),
        document.getElementById("boniteta-potrdi-kraj")].forEach(prilagodiVnos);
      document.getElementById("boniteta-potrdi-checkbox").checked = false;
    }

    if (ujemanjeLokacije.status) {
      var vnesenaLokacija = ujemanjeLokacije.entered || {};
      var uradnaLokacija = ujemanjeLokacije.official || {};
      var jeUporabniskaPotrditev = ["user_confirmed", "manual_user_confirmed"].includes(ujemanjeLokacije.confirmationType);
      if (ujemanjeLokacije.status === "matched") {
        if (jeUporabniskaPotrditev) {
          dodajPodatek(hwkPodatki, "Potrditev", ujemanjeLokacije.confirmationType === "manual_user_confirmed"
            ? "Podatke je vnesel in potrdil uporabnik; identiteta ni uradno potrjena"
            : "Podatke je s prikazanim Impressumom primerjal uporabnik", "neutral");
          hwkStatus.textContent = "Uporabnik potrdil";
          hwkStatus.className = "boniteta-znacka boniteta-znacka--yellow";
        } else if (identiteta.status !== "verified_register") {
          dodajPodatek(hwkPodatki, "Ujemanje", "Ime in naslov se ujemata z registrom", "green");
          hwkStatus.textContent = "Naslov potrjen";
          hwkStatus.className = "boniteta-znacka boniteta-znacka--green";
        }
      } else if (ujemanjeLokacije.status === "mismatch") {
        dodajPodatek(hwkPodatki, "Vneseni naslov", [vnesenaLokacija.naslov, vnesenaLokacija.postnaStevilka, vnesenaLokacija.kraj].filter(Boolean).join(", "), "neutral");
        dodajPodatek(hwkPodatki, "Uradni naslov", [uradnaLokacija.naslov, uradnaLokacija.postnaStevilka, uradnaLokacija.kraj].filter(Boolean).join(", "), "green");
        dodajPodatek(hwkPodatki, "Ujemanje", "Podatki se ne ujemajo: " + (ujemanjeLokacije.mismatchedFields || []).join(", "), "amber");
        hwkStatus.textContent = "Naslov se ne ujema";
        hwkStatus.className = "boniteta-znacka boniteta-znacka--red";
      } else {
        dodajPodatek(hwkPodatki, "Ujemanje", "Uradni vir nima vseh podatkov za primerjavo", "amber");
        hwkStatus.textContent = "Naslov ni potrjen";
        hwkStatus.className = "boniteta-znacka boniteta-znacka--yellow";
      }
    }

    // O varnosti posnetka odloča ena strežniška pogodba. Odjemalec se ne
    // navezuje na v11, v12 ali prihodnjo številko zajema.
    var posnetekIdentitetePrikazljiv = prikazanoDokaziloIdentitete.status === "captured" &&
      prikazanoDokaziloIdentitete.screenshotReady === true &&
      /^data:image\/jpeg;base64,/.test(prikazanoDokaziloIdentitete.imageDataUrl || "");
    if (posnetekIdentitetePrikazljiv) {
      identitetaSlika.src = prikazanoDokaziloIdentitete.imageDataUrl;
      identitetaPrenos.href = prikazanoDokaziloIdentitete.imageDataUrl;
      identitetaPosnetek.hidden = false;
      if (identitetaUrl && /^https?:\/\//i.test(prikazanoDokaziloIdentitete.sourceUrl || "")) {
        identitetaUrl.href = prikazanoDokaziloIdentitete.sourceUrl;
        identitetaUrl.querySelector("output").textContent = prikazanoDokaziloIdentitete.sourceUrl;
      }
      ponastaviPovecavoPosnetka(identitetaSlika);
      var identitetaPreverjenaOb = new Date(prikazanoDokaziloIdentitete.capturedAt || podatki.checkedAt || Date.now());
      identitetaCas.textContent = "Zajeto " + new Intl.DateTimeFormat("sl-SI", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(identitetaPreverjenaOb) + " na " + (prikazanoDokaziloIdentitete.sourceLabel || "registrskem viru");
    } else if (["probable_impressum", "confirmed_impressum"].includes(identiteta.status) ||
        (identiteta.status === "verified_register" && identiteta.impressumSourceUrl)) {
      var razlogiDokazila = {
        capture_failed: "Posnetka uporabljenega vira trenutno ni bilo mogoče pripraviti.",
        identity_block_not_found: "Na pravni strani ni bilo mogoče določiti vidnega bloka za dokazni posnetek.",
        source_unavailable: "Pravna stran med zajemom ni bila dosegljiva.",
      };
      var manjkajoceDokazilo = identiteta.status === "verified_register" ? dokaziloImpressuma : dokaziloIdentitete;
      identitetaDokaziloStatus.textContent = razlogiDokazila[manjkajoceDokazilo.reason] ||
        (identiteta.status === "verified_register"
          ? "Dopolnilni posnetek Impressuma ni na voljo. OpenRegister ostaja uradni dokaz identitete."
          : "Dokazni posnetek ni na voljo. Insolvenčna poizvedba brez prikazljivega dokazila ne bo izvedena.");
      identitetaDokaziloStatus.hidden = false;
    }

    izrisiVire(podatki.sources);

    var insolvenca = podatki.insolvency || {};
    var insolvencaStatus = document.getElementById("boniteta-insolvenca-status");
    var insolvencaOpis = document.getElementById("boniteta-insolvenca-opis");
    var insolvencaPodatki = document.getElementById("boniteta-insolvenca-podatki");
    var insolvencaApiVir = document.getElementById("boniteta-insolvenca-api-vir");
    var insolvencaPosnetek = document.getElementById("boniteta-insolvenca-posnetek");
    var insolvencaSlika = document.getElementById("boniteta-insolvenca-slika");
    var insolvencaPrenos = document.getElementById("boniteta-insolvenca-prenos");
    var insolvencaCas = document.getElementById("boniteta-insolvenca-cas");
    var objaveOkvir = document.getElementById("boniteta-objave");
    var objaveGumb = document.getElementById("boniteta-objave-gumb");
    var objaveGumbTekst = document.getElementById("boniteta-objave-gumb-tekst");
    var objaveSeznam = document.getElementById("boniteta-objave-seznam");
    insolvencaPodatki.innerHTML = "";
    insolvencaPosnetek.hidden = true;
    insolvencaSlika.removeAttribute("src");
    objaveOkvir.hidden = true;
    objaveSeznam.hidden = true;
    objaveSeznam.innerHTML = "";
    objaveGumb.setAttribute("aria-expanded", "false");
    insolvencaApiVir.hidden = insolvenca.evidenceStatus !== "verified_api";
    insolvencaApiVir.href = insolvenca.apiSourceUrl || "https://docs.openregister.de/endpoint/search-insolvency";
    var uradnaPotrditev = insolvenca.officialVerification || {};
    var preverjenaPolja = uradnaPotrditev.inputVerification && uradnaPotrditev.inputVerification.fields || {};
    var imaBarvniDokaz = uradnaPotrditev.evidenceStatus === "captured" &&
      uradnaPotrditev.inputVerification && uradnaPotrditev.inputVerification.status === "matched" &&
      uradnaPotrditev.screenshotAnnotation && uradnaPotrditev.screenshotAnnotation.status === "applied";
    var barvniNamig = document.getElementById("boniteta-barvna-primerjava-namig");
    if (barvniNamig) barvniNamig.hidden = !imaBarvniDokaz;
    var iskanoIme = String(insolvenca.searchedName || identiteta.ime || "").trim();
    var iskaniKraj = String(insolvenca.searchedCity || identiteta.kraj || "");
    var imeIzObrazca = [preverjenaPolja.firmaPriimek, preverjenaPolja.ime].filter(Boolean).join(" ");
    var registerIzObrazca = [preverjenaPolja.registrskoSodisce,
      [preverjenaPolja.vrstaRegistra, preverjenaPolja.registrskaStevilka].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
    var zadevaIzObrazca = [preverjenaPolja.oddelek, preverjenaPolja.oznaka,
      preverjenaPolja.stevilka && preverjenaPolja.leto ? preverjenaPolja.stevilka + "/" + preverjenaPolja.leto : ""].filter(Boolean).join(" ");
    var legendaPrimerjave = insolvencaPosnetek.querySelector(".boniteta-barvna-primerjava__legenda");
    if (legendaPrimerjave) {
      legendaPrimerjave.hidden = !imaBarvniDokaz;
      legendaPrimerjave.querySelectorAll("[data-primerjava-ton]").forEach(function (znacka) {
        var ton = znacka.dataset.primerjavaTon;
        znacka.hidden = !imaBarvniDokaz || (ton === "violet" && !registerIzObrazca) || (ton === "amber" && !zadevaIzObrazca);
      });
    }
    dodajPodatek(insolvencaPodatki, "Ime podjetja", imeIzObrazca || iskanoIme, imaBarvniDokaz ? "blue" : "neutral");
    dodajPodatek(insolvencaPodatki, "Kraj", preverjenaPolja.kraj || iskaniKraj, imaBarvniDokaz ? "green" : "neutral");
    if (registerIzObrazca || uradnaPotrditev.searchedRegister) {
      dodajPodatek(insolvencaPodatki, "Register", registerIzObrazca || uradnaPotrditev.searchedRegister, imaBarvniDokaz ? "violet" : "neutral");
    }
    if (zadevaIzObrazca || uradnaPotrditev.searchedCaseNumber) {
      dodajPodatek(insolvencaPodatki, "Zadeva", zadevaIzObrazca || uradnaPotrditev.searchedCaseNumber, imaBarvniDokaz ? "amber" : "neutral");
    }
    if (insolvenca.searchedPostalCode) dodajPodatek(insolvencaPodatki, "Poštna številka", insolvenca.searchedPostalCode, "neutral");
    if (insolvenca.searchedCompanyId) dodajPodatek(insolvencaPodatki, "OpenRegister ID", insolvenca.searchedCompanyId, "neutral");
    if (insolvenca.evidenceStatus === "verified_api") {
      dodajPodatek(insolvencaPodatki, "Vir", insolvenca.sourceLabel || "OpenRegister Insolvency API", "neutral");
      var apiCas = new Date(insolvenca.checkedAt || podatki.checkedAt || Date.now());
      dodajPodatek(insolvencaPodatki, "Čas poizvedbe", new Intl.DateTimeFormat("sl-SI", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(apiCas), "neutral");
    }
    var samoUradniPortal = insolvenca.verificationMode === "official_portal_only";
    if (uradnaPotrditev.status) {
      var uradniStatus = {
        confirmed_match: "Isti postopek potrjen",
        clear: "Brez objave",
        unverified: "Zadetek se ne ujema",
        unavailable: "Preverjanje ni uspelo",
      }[uradnaPotrditev.status] || "Ni potrjeno";
      dodajPodatek(insolvencaPodatki, "Državni register", uradniStatus, "neutral");
    }
    if (insolvenca.status === "clear") {
      var uradnoBrezZadetka = uradnaPotrditev.status === "clear";
      insolvencaStatus.textContent = samoUradniPortal
        ? (uradnoBrezZadetka ? "Brez zadetka v uradnem registru" : "Uradni vir ni potrjen")
        : (uradnoBrezZadetka ? "Brez zadetka v dveh virih" : "Drugi vir ni potrjen");
      insolvencaStatus.className = "boniteta-znacka boniteta-znacka--" + (uradnoBrezZadetka && identiteta.status !== "confirmed_impressum" ? "green" : "yellow");
      insolvencaOpis.textContent = samoUradniPortal && uradnoBrezZadetka
        ? "Uradni portal Insolvenzbekanntmachungen za potrjeno ime in kraj ni vrnil insolvenčne objave."
        : uradnoBrezZadetka
        ? "OpenRegister in državni portal za isto preverjeno identiteto nista vrnila insolvenčne objave."
        : "OpenRegister ni vrnil objave, vendar preverjanja na državnem portalu ni bilo mogoče dokončati.";
    } else if (insolvenca.status === "possible_match") {
      var dvojnoPotrjeno = uradnaPotrditev.status === "confirmed_match";
      insolvencaStatus.textContent = samoUradniPortal ? "Možen zadetek v uradnem registru" : (dvojnoPotrjeno ? "Potrjeno v dveh virih" : "Možen zadetek");
      insolvencaStatus.className = "boniteta-znacka boniteta-znacka--red";
      insolvencaOpis.textContent = samoUradniPortal
        ? "Uradni portal Insolvenzbekanntmachungen je vrnil možen postopek za potrjeno ime in kraj. Preglejte objavo in posnetek."
        : dvojnoPotrjeno
        ? "OpenRegister in državni portal sta vrnila isti postopek za isto pravno osebo, kraj in registrsko številko."
        : "OpenRegister je vrnil najmanj en možen postopek, državni portal pa istega postopka ni dokončno potrdil. Potreben je ročni pregled.";
      (insolvenca.matches || []).forEach(function (zadetek, indeks) {
        var predpona = "Zadetek " + (indeks + 1) + " – ";
        dodajPodatek(insolvencaPodatki, predpona + "dolžnik", zadetek.debtor_name, "blue");
        dodajPodatek(insolvencaPodatki, predpona + "postopek", [zadetek.case_number, zadetek.court].filter(Boolean).join(" · "), "amber");
        dodajPodatek(insolvencaPodatki, predpona + "status", zadetek.current_status, "neutral");
      });
      if (insolvenca.detailsLimited) dodajPodatek(insolvencaPodatki, "Omejitev", "Prikazanih je prvih 5 zadetkov; preverite tudi ročni vir.", "neutral");
    } else if (insolvenca.status === "unavailable") {
      insolvencaStatus.textContent = "Ni dosegljivo";
      insolvencaStatus.className = "boniteta-znacka boniteta-znacka--yellow";
      if (samoUradniPortal) insolvencaOpis.textContent = "Uradnega portala Insolvenzbekanntmachungen ni bilo mogoče zanesljivo preveriti ali posneti. Poskusite ponovno pozneje.";
      else if (insolvenca.reason === "insufficient_credits") insolvencaOpis.textContent = "Kvota ponudnika za insolvenčno poizvedbo trenutno ni na voljo.";
      else if (insolvenca.reason === "not_configured") insolvencaOpis.textContent = "OpenRegister API ključ ni nastavljen ali ni veljaven.";
      else if (insolvenca.reason === "rate_limited") insolvencaOpis.textContent = "OpenRegister je začasno omejil število poizvedb. Poskusite ponovno pozneje.";
      else insolvencaOpis.textContent = "OpenRegister Insolvency API trenutno ni vrnil rezultata. Poskusite ponovno pozneje.";
    } else {
      insolvencaStatus.textContent = "Ni preverjeno";
      insolvencaStatus.className = "boniteta-znacka boniteta-znacka--yellow";
      if (insolvenca.reason === "location_mismatch") {
        insolvencaOpis.textContent = "Vneseni naslov, kraj ali poštna številka se ne ujema z uradnim zadetkom, zato insolvenčna preverba ni bila izvedena.";
      } else if (insolvenca.reason === "location_unverifiable") {
        insolvencaOpis.textContent = "Uradni vir nima vseh podatkov za zanesljivo potrditev naslova, zato insolvenčna preverba ni bila izvedena.";
      } else if (insolvenca.reason === "identity_evidence_unavailable") {
        insolvencaOpis.textContent = "Posnetka oziroma podatkov uporabljenega vira ni bilo mogoče shraniti, zato insolvenčna preverba ni bila izvedena.";
      } else if (insolvenca.reason === "identity_source_required") {
        insolvencaOpis.textContent = "Ročni vnos ni dokaz pravne identitete. Dodajte spletno stran z dejanskim Impressumom ali vključite OpenRegister.";
      } else if (insolvenca.reason === "user_confirmation_required") {
        insolvencaOpis.textContent = "Najprej preglejte razbrane podatke, jih po potrebi popravite in kliknite »Podatki so pravilni – preveri insolventnost«.";
      } else {
        insolvencaOpis.textContent = "Podatki za insolvenčno poizvedbo še niso potrjeni.";
      }
    }
    if (uradnaPotrditev.evidenceStatus === "captured" && /^data:image\/jpeg;base64,/.test(uradnaPotrditev.evidenceImage || "")) {
      insolvencaSlika.src = uradnaPotrditev.evidenceImage;
      insolvencaPrenos.href = uradnaPotrditev.evidenceImage;
      insolvencaPosnetek.hidden = false;
      ponastaviPovecavoPosnetka(insolvencaSlika);
      var uradnoPreverjenoOb = new Date(uradnaPotrditev.checkedAt || podatki.checkedAt || Date.now());
      insolvencaCas.textContent = "Zajeto " + new Intl.DateTimeFormat("sl-SI", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(uradnoPreverjenoOb) + " na Insolvenzbekanntmachungen";
    }
    var uradneObjave = Array.isArray(uradnaPotrditev.publications) ? uradnaPotrditev.publications : [];
    if (uradneObjave.length) {
      objaveOkvir.hidden = false;
      objaveGumbTekst.textContent = "Preglej vseh " + uradneObjave.length + " uradnih objav";
      uradneObjave.forEach(function (objava, indeks) {
        var clanek = document.createElement("article");
        clanek.className = "boniteta-objava";
        var naslov = document.createElement("h4");
        naslov.textContent = [objava.publicationDate || "Objava " + (indeks + 1), objava.caseNumber].filter(Boolean).join(" · ");
        var meta = document.createElement("p");
        meta.className = "boniteta-objava__meta";
        meta.textContent = [objava.court, objava.debtorName, objava.city, objava.register].filter(Boolean).join(" · ");
        var besedilo = document.createElement("p");
        besedilo.className = "boniteta-objava__besedilo";
        besedilo.textContent = objava.text || "Besedilo objave ni na voljo.";
        clanek.appendChild(naslov);
        clanek.appendChild(meta);
        clanek.appendChild(besedilo);
        objaveSeznam.appendChild(clanek);
      });
      objaveGumb.onclick = function () {
        var odpri = objaveSeznam.hidden;
        objaveSeznam.hidden = !odpri;
        objaveGumb.setAttribute("aria-expanded", odpri ? "true" : "false");
      };
    } else {
      objaveGumb.onclick = null;
    }
    izrisiMetodologijo(podatki);
    potek.querySelectorAll(".boniteta-potek__korak").forEach(function (korak) {
      korak.classList.remove("is-active");
      korak.classList.remove("is-done");
      if (podatki.confirmationRequired && korak.dataset.bonitetaKorak === "insolvency") korak.classList.add("is-active");
      else korak.classList.add("is-done");
    });
    nastaviRezultatKotOkno(true);
    rezultat.hidden = false;
    if (izbrisiPreverboGumb) izbrisiPreverboGumb.hidden = !zadnjiJobId;
    if (profilPovezava) profilPovezava.hidden = true;
    if (razsiritveSklop) razsiritveSklop.hidden = true;
    void shraniZakljucenoPreverbo(podatki, vnosObRezultatu, mojaGeneracija);
    if (window.UJPrilagodiVelikostBesedila) {
      rezultat.querySelectorAll("[data-fit-text]").forEach(window.UJPrilagodiVelikostBesedila);
    }
    (rezultatOkno || rezultat).scrollIntoView({ behavior: "smooth", block: "start" });
  }

  obrazec.addEventListener("submit", async function (dogodek) {
    dogodek.preventDefault();
    pocistiNapako();
    if (!obrazec.reportValidity()) return;

    var samoSpletniVnos = nacinVnosa === "spletna";
    var posta = samoSpletniVnos ? "" : document.getElementById("boniteta-posta").value.replace(/\D/g, "");
    var spletnaStran = spletnaPolje.value.trim();
    if (!spletnaStran && !potrjenoBrezSpletne) {
      pokaziNapako("Vnesite spletno stran ali kliknite »Nima spletne strani«.");
      spletnaPolje.focus();
      return;
    }
    var rocnoIme = samoSpletniVnos ? "" : document.getElementById("boniteta-ime").value.trim();
    var rocniNaslov = samoSpletniVnos ? "" : document.getElementById("boniteta-naslov-podjetja").value.trim();
    var rocniKraj = samoSpletniVnos ? "" : krajPolje.value.trim();
    if (!spletnaStran && (!rocnoIme || rocniNaslov.length < 3 || !/^\d{5}$/.test(posta) || rocniKraj.length < 2)) {
      pokaziNapako("Brez spletne strani izpolnite ime, ulico s hišno številko, poštno številko in kraj.");
      return;
    }
    if (posta && !/^\d{5}$/.test(posta)) {
      pokaziNapako("Poštna številka mora vsebovati pet številk ali pa polje pustite prazno.");
      return;
    }
    if (posta && krajiTrenutnePoste.length > 1 && izrecnoIzbraniKraj !== rocniKraj) {
      pokaziNapako("Ta poštna številka ima več krajev. Izberite pravilnega z enim od prikazanih gumbov.");
      krajPolje.focus();
      return;
    }

    nastaviNalaganje(true);
    try {
      var token = await pridobiToken();
      zadnjiVnos = {
        ime: rocnoIme,
        naslov: rocniNaslov,
        postnaStevilka: posta,
        kraj: rocniKraj,
        spletnaStran: spletnaStran,
        registerNumber: samoSpletniVnos ? "" : document.getElementById("boniteta-register").value.trim(),
        vatId: samoSpletniVnos ? "" : document.getElementById("boniteta-davcna").value.trim(),
        uporabiOpenRegisterIdentiteto: Boolean(openregisterIdentiteta && openregisterIdentiteta.checked),
      };
      zadnjaOpenRegisterReferenca = "";
      var podatki = await izvediPrekoCakalneVrste(zadnjiVnos, token);
      izrisi(podatki);
    } catch (err) {
      potek.hidden = true;
      nastaviRezultatKotOkno(false);
      pokaziNapako(err && (err.name === "TimeoutError" || err.name === "AbortError")
        ? "Strežnik se ni odzval pravočasno. Preverjanje je varno shranjeno; poskusite ponovno."
        : err.message || "Preverjanje trenutno ni mogoče.");
    } finally {
      nastaviNalaganje(false);
    }
  });

  potrditevGumb.addEventListener("click", async function () {
    potrditevNapaka.hidden = true;
    if (!zadnjiVnos) return;
    var potrjenoIme = document.getElementById("boniteta-potrdi-ime").value.trim();
    var potrjeniNaziv = document.getElementById("boniteta-potrdi-naziv").value.trim();
    var potrjeniNosilec = document.getElementById("boniteta-potrdi-nosilec").value.trim();
    var potrjeniNaslov = document.getElementById("boniteta-potrdi-naslov").value.trim();
    var potrjenaPosta = document.getElementById("boniteta-potrdi-posta").value.replace(/\D/g, "");
    var potrjeniKraj = document.getElementById("boniteta-potrdi-kraj").value.trim();
    var potrjeno = document.getElementById("boniteta-potrdi-checkbox").checked;
    try {
      if (!potrjenoIme || potrjeniNaslov.length < 3 || !/^\d{5}$/.test(potrjenaPosta) || potrjeniKraj.length < 2 || !potrjeno) {
        throw new Error("Preglejte ime in celoten naslov ter potrdite pravilnost podatkov.");
      }
      potrditevGumb.disabled = true;
      potrditevGumb.textContent = "Preverjam insolventnost …";
      var token = await pridobiToken();
      var telo = Object.assign({}, zadnjiVnos, {
        confirmedIdentity: {
          name: potrjenoIme,
          businessName: potrjeniNaziv,
          representativeName: potrjeniNosilec,
          street: potrjeniNaslov,
          postalCode: potrjenaPosta,
          city: potrjeniKraj,
          companyId: zadnjaOpenRegisterReferenca,
          confirmed: true,
        },
      });
      var podatki = await izvediPrekoCakalneVrste(telo, token);
      izrisi(podatki);
    } catch (napakaPotrditve) {
      potrditevNapaka.textContent = napakaPotrditve && (napakaPotrditve.name === "TimeoutError" || napakaPotrditve.name === "AbortError")
        ? "Strežnik se ni odzval pravočasno. Poskusite ponovno."
        : napakaPotrditve.message || "Potrditev podatkov ni uspela.";
      potrditevNapaka.hidden = false;
    } finally {
      potrditevGumb.disabled = false;
      potrditevGumb.textContent = "Podatki so pravilni – preveri insolventnost";
    }
  });

  document.getElementById("boniteta-ponovi").addEventListener("click", function () {
    generacijaRezultata += 1;
    nastaviRezultatKotOkno(false);
    rezultat.hidden = true;
    potek.hidden = true;
    pocistiNapako();
    nacinVnosa = "";
    zadnjiVnos = null;
    zadnjiJobId = "";
    if (izbrisiPreverboGumb) izbrisiPreverboGumb.hidden = true;
    zadnjaOpenRegisterReferenca = "";
    zadnjaSamodejnaPosta = "";
    samodejniKraj = "";
    krajiTrenutnePoste = [];
    izrecnoIzbraniKraj = "";
    zaporedjePostnePoizvedbe += 1;
    obrazec.reset();
    potrjenoBrezSpletne = false;
    brezSpletneGumb.setAttribute("aria-pressed", "false");
    brezSpletneGumb.classList.remove("is-selected");
    brezSpletneGumb.querySelector("span").textContent = "○";
    spletnaPolje.disabled = false;
    spletnaStatus.textContent = "Spletna stran nam pomaga najti pravo ime nosilca v Impressumu.";
    krajStatus.textContent = "";
    krajiSeznam.innerHTML = "";
    krajiIzbira.innerHTML = "";
    krajiIzbira.hidden = true;
    potrditevIdentitete.hidden = true;
    if (profilPovezava) profilPovezava.hidden = true;
    if (razsiritveSklop) razsiritveSklop.hidden = true;
    osveziOpenRegisterPreklop();
    vnosPodrobnosti.hidden = true;
    izbiraStranke.hidden = true;
    nastaviZajemStatus("", null);
    nastaviZajemKartico(null, null);
    nastaviSpletnoRezervo(false);
    nastaviHeroPodjetje("");
    document.getElementById("boniteta-nacin-slikaj").focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  function pojdiEnBonitetniKorakNazaj() {
    if (!document.body.classList.contains("boniteta-rezultat-je-okno")) return false;
    document.getElementById("boniteta-ponovi").click();
    if (window.UJBonitetaIzberiTok) window.UJBonitetaIzberiTok("soft");
    return true;
  }

  window.UJPoskusiNotranjiKorakNazaj = pojdiEnBonitetniKorakNazaj;

  if (izbrisiPreverboGumb) izbrisiPreverboGumb.addEventListener("click", async function () {
    if (!zadnjiJobId || !window.confirm("Ali res želite izbrisati vse prejšnje in trenutne podatke tega preverjanja, rezultate ter dokazne posnetke?")) return;
    izbrisiPreverboGumb.disabled = true;
    izbrisiPreverboGumb.textContent = "Brišem preverbo …";
    try {
      var token = await pridobiToken();
      var odgovor = await fetch("/api/mehka-boniteta-opravilo?id=" + encodeURIComponent(zadnjiJobId), {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
        signal: omejitevKlica(15000),
      });
      var podatki = null;
      try { podatki = await odgovor.json(); } catch (_) {}
      if (!odgovor.ok) throw new Error((podatki && podatki.napaka) || "Preverbe ni bilo mogoče izbrisati.");
      zadnjiJobId = "";
      document.getElementById("boniteta-ponovi").click();
    } catch (napakaIzbrisa) {
      pokaziNapako(napakaIzbrisa.message || "Preverbe ni bilo mogoče izbrisati.");
      izbrisiPreverboGumb.disabled = false;
      izbrisiPreverboGumb.textContent = "Izbriši vse podatke tega preverjanja";
    }
  });

  postaPolje.addEventListener("input", function (dogodek) {
    dogodek.target.value = dogodek.target.value.replace(/\D/g, "").slice(0, 5);
    if (dogodek.target.value.length < 5) {
      zaporedjePostnePoizvedbe += 1;
      zadnjaSamodejnaPosta = "";
      krajiTrenutnePoste = [];
      izrecnoIzbraniKraj = "";
      krajStatus.textContent = "";
      krajiIzbira.innerHTML = "";
      krajiIzbira.hidden = true;
      if (krajPolje.value.trim() === samodejniKraj) krajPolje.value = "";
      samodejniKraj = "";
      return;
    }
    void dolociKrajIzPoste(dogodek.target.value);
  });

  var crifFlowKartice = document.querySelectorAll(".crif-flow-picker__option");
  crifFlowKartice.forEach(function (kartica) {
    kartica.addEventListener("click", function () {
      crifFlowKartice.forEach(function (druga) {
        var izbrana = druga === kartica;
        druga.classList.toggle("is-active", izbrana);
        druga.setAttribute("aria-pressed", String(izbrana));
      });
    });
  });

  brezSpletneGumb.addEventListener("click", function () {
    pocistiNapako();
    nastaviBrezSpletne(!potrjenoBrezSpletne);
  });

  spletnaPolje.addEventListener("input", function () {
    if (potrjenoBrezSpletne) nastaviBrezSpletne(false);
    spletnaStatus.textContent = spletnaPolje.value.trim()
      ? "Iz Impressuma bomo poskusili pridobiti ime nosilca."
      : "Spletna stran nam pomaga najti pravo ime nosilca v Impressumu.";
  });

  document.getElementById("boniteta-nacin-slikaj").addEventListener("click", function () {
    if (!zajemVTehniku) zajemFotoaparat.click();
  });

  document.getElementById("boniteta-nacin-uvozi").addEventListener("click", function () {
    if (!zajemVTehniku) zajemDatoteka.click();
  });

  document.getElementById("boniteta-nacin-spletna").addEventListener("click", function () {
    pocistiNapako();
    nastaviSpletnoRezervo(false);
    var heroVrednost = String(heroSpletnaPolje && heroSpletnaPolje.value || "").trim();
    if (!heroVrednost) {
      if (heroSpletnaStatus) {
        heroSpletnaStatus.textContent = "Vnesite spletno stran podjetja.";
        heroSpletnaStatus.hidden = false;
      }
      if (heroSpletnaPolje) {
        heroSpletnaPolje.setAttribute("aria-invalid", "true");
        heroSpletnaPolje.focus();
      }
      return;
    }
    if (heroSpletnaStatus) heroSpletnaStatus.hidden = true;
    heroSpletnaPolje.removeAttribute("aria-invalid");
    nastaviBrezSpletne(false);
    spletnaPolje.value = heroVrednost;
    prilagodiVnos(spletnaPolje);
    nastaviNacinVnosa("spletna", true);
    obrazec.requestSubmit();
  });

  if (heroSpletnaPolje) {
    heroSpletnaPolje.addEventListener("input", function () {
      nastaviSpletnoRezervo(false);
      heroSpletnaPolje.removeAttribute("aria-invalid");
      if (heroSpletnaStatus) heroSpletnaStatus.hidden = true;
    });
    heroSpletnaPolje.addEventListener("keydown", function (dogodek) {
      if (dogodek.key !== "Enter") return;
      dogodek.preventDefault();
      document.getElementById("boniteta-nacin-spletna").click();
    });
  }

  document.getElementById("boniteta-nacin-rocno").addEventListener("click", function () {
    pocistiNapako();
    nastaviSpletnoRezervo(false);
    nastaviNacinVnosa("rocno");
  });

  zajemFotoaparat.addEventListener("change", function () {
    if (zajemFotoaparat.files && zajemFotoaparat.files[0]) void obdelajDokumentZaBoniteto(zajemFotoaparat.files[0]);
  });

  zajemDatoteka.addEventListener("change", function () {
    if (zajemDatoteka.files && zajemDatoteka.files[0]) void obdelajDokumentZaBoniteto(zajemDatoteka.files[0]);
  });

  vzpostaviPovecavoPosnetkov();

  var zacetniParametri = new URLSearchParams(window.location.search);
  var zacetnoIme = (zacetniParametri.get("ime") || "").trim().slice(0, 240);
  var zacetniJobId = (zacetniParametri.get("job") || "").trim();
  if (zacetnoIme) {
    nastaviNacinVnosa("rocno");
    document.getElementById("boniteta-ime").value = zacetnoIme;
    prilagodiVnos(document.getElementById("boniteta-ime"));
  }
  if (/^[0-9a-f-]{32,36}$/i.test(zacetniJobId)) void nadaljujOpravilo(zacetniJobId);

  if (openregisterIdentiteta) {
    openregisterIdentiteta.addEventListener("change", osveziOpenRegisterPreklop);
    osveziOpenRegisterPreklop();
  }
})();
