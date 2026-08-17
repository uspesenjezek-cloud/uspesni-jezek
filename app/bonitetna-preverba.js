(function () {
  "use strict";

  var obrazec = document.getElementById("boniteta-obrazec");
  if (!obrazec) return;

  var gumb = document.getElementById("boniteta-gumb");
  var napaka = document.getElementById("boniteta-napaka");
  var potek = document.getElementById("boniteta-potek");
  var rezultat = document.getElementById("boniteta-rezultat");
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
  var izbiraStranke = document.getElementById("boniteta-izbira-stranke");
  var izbiraStrankeSeznam = document.getElementById("boniteta-izbira-stranke-seznam");
  var vnosPodrobnosti = document.getElementById("boniteta-vnos-podrobnosti");
  var nacinVnosa = "";
  var zajemVTehniku = false;
  var profilPovezava = document.getElementById("boniteta-odpri-profil");
  var zaporedjePostnePoizvedbe = 0;
  var krajiTrenutnePoste = [];
  var izrecnoIzbraniKraj = "";
  var generacijaRezultata = 0;
  var zadnjiJobId = "";
  var izbrisiPreverboGumb = document.getElementById("boniteta-izbrisi-preverbo");

  function esc(vrednost) {
    return String(vrednost == null ? "" : vrednost)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function pokaziNapako(sporocilo) {
    napaka.textContent = sporocilo;
    napaka.hidden = false;
  }

  function pocistiNapako() {
    napaka.textContent = "";
    napaka.hidden = true;
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

  async function pridobiToken() {
    var seja = await supabaseKlient.auth.getSession();
    var token = seja && seja.data && seja.data.session && seja.data.session.access_token;
    if (!token) throw new Error("Prijava je potekla. Prijavite se znova.");
    return token;
  }

  async function shraniZakljucenoPreverbo(podatki, vnosObRezultatu, mojaGeneracija) {
    var identiteta = podatki && podatki.identity || {};
    if (!profilPovezava || podatki.confirmationRequired || !identiteta.ime || !["verified_register", "confirmed_impressum"].includes(identiteta.status)) return;
    try {
      var token = await pridobiToken();
      var odgovor = await fetch("/api/boniteta-pro?route=profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          action: "save_check",
          profile: {
            companyId: identiteta.companyId || podatki.identityEvidence && podatki.identityEvidence.companyId || "",
            legalName: identiteta.naziv || identiteta.ime,
            registerNumber: identiteta.registerNumber || podatki.identityEvidence && podatki.identityEvidence.registerNumber || "",
            registerCourt: identiteta.registerCourt || podatki.identityEvidence && podatki.identityEvidence.registerCourt || "",
            companyStatus: identiteta.active === false ? "inactive" : identiteta.active === true ? "active" : "unknown",
            address: { street: identiteta.naslov || "", postal_code: identiteta.postnaStevilka || "", city: identiteta.kraj || "" },
            contact: { website: vnosObRezultatu && vnosObRezultatu.spletnaStran || "" },
            checkedAt: podatki.checkedAt,
            latestCheck: { result: podatki.result || {}, insolvency: podatki.insolvency || {}, identityStatus: identiteta.status, sources: podatki.sources || [] },
          },
        }),
      });
      var shranjeno = await odgovor.json().catch(function () { return {}; });
      if (mojaGeneracija === generacijaRezultata && odgovor.ok && shranjeno.profile && shranjeno.profile.id) {
        profilPovezava.href = "boniteta-profil.html?id=" + encodeURIComponent(shranjeno.profile.id);
        profilPovezava.hidden = false;
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
    var ustvarjeno = await fetchSPonovnimPoskusom("/api/mehka-boniteta-opravilo", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(telo),
      signal: omejitevKlica(15000),
    });
    var ustvarjeniPodatki = null;
    try { ustvarjeniPodatki = await ustvarjeno.json(); } catch (_) {}
    if (!ustvarjeno.ok) throw new Error((ustvarjeniPodatki && ustvarjeniPodatki.napaka) || "Preverjanja ni bilo mogoče dodati v čakalno vrsto.");
    return pocakajNaOpravilo(ustvarjeniPodatki && ustvarjeniPodatki.job, token);
  }

  async function nadaljujOpravilo(jobId) {
    nastaviNalaganje(true);
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
    }
  }

  function nastaviNalaganje(vklopljeno) {
    gumb.disabled = vklopljeno;
    if (vklopljeno) {
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

  function dodajPodatek(dl, oznaka, vrednost) {
    if (!vrednost) return;
    dl.insertAdjacentHTML("beforeend", "<dt>" + esc(oznaka) + "</dt><dd data-fit-text data-fit-text-min=\"8\">" + esc(vrednost) + "</dd>");
  }

  function oznakaStatusaVira(status) {
    if (status === "found") return { tekst: "Najdeno", razred: "green" };
    if (status === "disabled") return { tekst: "Izklopljeno", razred: "yellow" };
    if (status === "manual_available") return { tekst: "Ročno", razred: "yellow" };
    if (status === "not_configured") return { tekst: "Ni povezano", razred: "yellow" };
    if (status === "unsupported_region") return { tekst: "Ni priključeno", razred: "yellow" };
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
      var status = oznakaStatusaVira(vir.status);
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
    generacijaRezultata += 1;
    var mojaGeneracija = generacijaRezultata;
    var vnosObRezultatu = zadnjiVnos ? Object.assign({}, zadnjiVnos) : null;
    var sklep = podatki.result || {};
    rezultat.className = "boniteta-rezultat boniteta-rezultat--" + (sklep.level || "yellow");
    document.getElementById("boniteta-rezultat-naslov").textContent = sklep.title || "Preverjanje zaključeno";
    document.getElementById("boniteta-rezultat-opis").textContent = sklep.message || "";
    document.getElementById("boniteta-status-ikona").textContent = sklep.level === "green" ? "✓" : sklep.level === "red" ? "!" : "?";

    var hwkStatus = document.getElementById("boniteta-hwk-status");
    var hwkPodatki = document.getElementById("boniteta-hwk-podatki");
    var hwkVir = document.getElementById("boniteta-hwk-vir");
    var profil = podatki.publicProfile || {};
    var openregister = podatki.openregister || {};
    var identiteta = podatki.identity || {};
    nastaviHeroPodjetje(identiteta.naziv || identiteta.ime || (zadnjiVnos && zadnjiVnos.ime));
    var dokaziloIdentitete = podatki.identityEvidence || {};
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
    hwkVir.hidden = false;
    identitetaPosnetek.hidden = true;
    identitetaSlika.removeAttribute("src");
    identitetaDokaziloStatus.hidden = true;
    identitetaDokaziloStatus.textContent = "";
    potrditevIdentitete.hidden = true;
    if (identiteta.status === "verified_register") {
      hwkStatus.textContent = identiteta.userConfirmed ? "Register in podatki potrjeni" : "Register najden";
      hwkStatus.className = "boniteta-znacka boniteta-znacka--green";
      identitetaNaslov.textContent = "Registrirana družba";
      dodajPodatek(hwkPodatki, "Pravno ime", identiteta.ime);
      dodajPodatek(hwkPodatki, "Register", identiteta.registerNumber);
      dodajPodatek(hwkPodatki, "Sodišče", identiteta.registerCourt);
      dodajPodatek(hwkPodatki, "Oblika", identiteta.legalForm);
      dodajPodatek(hwkPodatki, "Status", identiteta.active ? "Aktivna" : "Neaktivna");
      dodajPodatek(hwkPodatki, "Potrditev", "Neposredno prek OpenRegister API");
      hwkVir.href = openregister.sourceUrl || "https://openregister.de";
      hwkVir.textContent = "Odpri register podjetij ↗";
    } else if (["probable_impressum", "confirmed_impressum"].includes(identiteta.status) && profil.subjekt) {
      hwkStatus.textContent = identiteta.status === "confirmed_impressum" ? "Uporabnik potrdil" : "Impressum najden";
      hwkStatus.className = "boniteta-znacka boniteta-znacka--yellow";
      identitetaNaslov.textContent = "Podatki iz Impressuma";
      dodajPodatek(hwkPodatki, "Naziv", identiteta.naziv);
      if (identiteta.nosilec || identiteta.entityType !== "company") {
        var primarnaPravnaVloga = Array.isArray(identiteta.vloge) && identiteta.vloge[0] && identiteta.vloge[0].vloga;
        dodajPodatek(hwkPodatki, primarnaPravnaVloga === "Inhaber" ? "Nosilec (Inhaber)" : "Nosilec oziroma zastopnik", identiteta.nosilec || identiteta.ime);
      } else {
        dodajPodatek(hwkPodatki, "Zastopnik", "V Impressumu ni naveden – preverite pravno ime in naslov.");
      }
      dodajPodatek(hwkPodatki, "Naslov", [identiteta.naslov, identiteta.postnaStevilka, identiteta.kraj].filter(Boolean).join(", "));
      dodajPodatek(hwkPodatki, "Stopnja", identiteta.status === "confirmed_impressum" ? "Potrjeno s strani uporabnika" : "Čaka na pregled uporabnika");
      hwkVir.href = profil.sourceUrl || identiteta.sourceUrl || "#";
      hwkVir.textContent = "Odpri Impressum podjetja ↗";
    } else if (["manual_input", "confirmed_manual"].includes(identiteta.status)) {
      hwkStatus.textContent = identiteta.status === "confirmed_manual" ? "Uporabnik potrdil" : "Vir manjka";
      hwkStatus.className = "boniteta-znacka boniteta-znacka--yellow";
      identitetaNaslov.textContent = "Ročno vneseni podatki";
      dodajPodatek(hwkPodatki, "Pravno ime oziroma nosilec", identiteta.ime);
      dodajPodatek(hwkPodatki, "Poslovni naziv", identiteta.naziv);
      dodajPodatek(hwkPodatki, "Naslov", [identiteta.naslov, identiteta.postnaStevilka, identiteta.kraj].filter(Boolean).join(", "));
      dodajPodatek(hwkPodatki, "Stopnja", identiteta.status === "confirmed_manual" ? "Uporabnik je podatke potrdil" : "Ročni vnos ni dokaz pravne identitete");
      hwkVir.hidden = true;
    } else {
      hwkStatus.textContent = "Ni razbrano";
      hwkStatus.className = "boniteta-znacka boniteta-znacka--yellow";
      identitetaNaslov.textContent = "Identiteta";
      dodajPodatek(hwkPodatki, "Rezultat", "Noben avtomatski vir ni vrnil dovolj zanesljive identitete.");
      dodajPodatek(hwkPodatki, "Naslednje", "Preverite spletno stran ali ročno vnesite podatke iz ponudbe oziroma predračuna.");
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
      document.getElementById("boniteta-potrdi-naziv").value = identiteta.naziv || identiteta.ime || (zadnjiVnos && zadnjiVnos.ime) || "";
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
      dodajPodatek(hwkPodatki, "Vneseni naslov", [vnesenaLokacija.naslov, vnesenaLokacija.postnaStevilka, vnesenaLokacija.kraj].filter(Boolean).join(", "));
      var jeUporabniskaPotrditev = ["user_confirmed", "manual_user_confirmed"].includes(ujemanjeLokacije.confirmationType);
      dodajPodatek(hwkPodatki, jeUporabniskaPotrditev ? "Potrjeni naslov" : "Uradni naslov", [uradnaLokacija.naslov, uradnaLokacija.postnaStevilka, uradnaLokacija.kraj].filter(Boolean).join(", "));
      if (ujemanjeLokacije.status === "matched") {
        if (jeUporabniskaPotrditev) {
          dodajPodatek(hwkPodatki, "Potrditev", ujemanjeLokacije.confirmationType === "manual_user_confirmed"
            ? "Podatke je vnesel in potrdil uporabnik; identiteta ni uradno potrjena"
            : "Podatke je s prikazanim Impressumom primerjal uporabnik");
          hwkStatus.textContent = "Uporabnik potrdil";
          hwkStatus.className = "boniteta-znacka boniteta-znacka--yellow";
        } else {
          dodajPodatek(hwkPodatki, "Ujemanje", "Ime in naslov se ujemata z registrom");
          hwkStatus.textContent = "Naslov potrjen";
          hwkStatus.className = "boniteta-znacka boniteta-znacka--green";
        }
      } else if (ujemanjeLokacije.status === "mismatch") {
        dodajPodatek(hwkPodatki, "Ujemanje", "Podatki se ne ujemajo: " + (ujemanjeLokacije.mismatchedFields || []).join(", "));
        hwkStatus.textContent = "Naslov se ne ujema";
        hwkStatus.className = "boniteta-znacka boniteta-znacka--red";
      } else {
        dodajPodatek(hwkPodatki, "Ujemanje", "Uradni vir nima vseh podatkov za primerjavo");
        hwkStatus.textContent = "Naslov ni potrjen";
        hwkStatus.className = "boniteta-znacka boniteta-znacka--yellow";
      }
    }

    // O varnosti posnetka odloča ena strežniška pogodba. Odjemalec se ne
    // navezuje na v11, v12 ali prihodnjo številko zajema.
    var posnetekIdentitetePrikazljiv = dokaziloIdentitete.status === "captured" &&
      dokaziloIdentitete.screenshotReady === true &&
      /^data:image\/jpeg;base64,/.test(dokaziloIdentitete.imageDataUrl || "");
    if (posnetekIdentitetePrikazljiv) {
      identitetaSlika.src = dokaziloIdentitete.imageDataUrl;
      identitetaPrenos.href = dokaziloIdentitete.imageDataUrl;
      identitetaPosnetek.hidden = false;
      if (identitetaUrl && /^https?:\/\//i.test(dokaziloIdentitete.sourceUrl || "")) {
        identitetaUrl.href = dokaziloIdentitete.sourceUrl;
        identitetaUrl.querySelector("output").textContent = dokaziloIdentitete.sourceUrl;
      }
      ponastaviPovecavoPosnetka(identitetaSlika);
      var identitetaPreverjenaOb = new Date(dokaziloIdentitete.capturedAt || podatki.checkedAt || Date.now());
      identitetaCas.textContent = "Zajeto " + new Intl.DateTimeFormat("sl-SI", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(identitetaPreverjenaOb) + " na " + (dokaziloIdentitete.sourceLabel || "registrskem viru");
    } else if (["probable_impressum", "confirmed_impressum"].includes(identiteta.status)) {
      var razlogiDokazila = {
        capture_failed: "Posnetka uporabljenega vira trenutno ni bilo mogoče pripraviti.",
        identity_block_not_found: "Na pravni strani ni bilo mogoče določiti vidnega bloka za dokazni posnetek.",
        source_unavailable: "Pravna stran med zajemom ni bila dosegljiva.",
      };
      identitetaDokaziloStatus.textContent = razlogiDokazila[dokaziloIdentitete.reason] ||
        "Dokazni posnetek ni na voljo. Insolvenčna poizvedba brez prikazljivega dokazila ne bo izvedena.";
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
    var iskanoIme = String(insolvenca.searchedName || identiteta.ime || "").trim();
    var iskaniKraj = String(insolvenca.searchedCity || identiteta.kraj || "");
    if (iskanoIme) dodajPodatek(insolvencaPodatki, "Iskano ime", iskanoIme);
    if (iskaniKraj) dodajPodatek(insolvencaPodatki, "Kraj", iskaniKraj);
    if (insolvenca.searchedPostalCode) dodajPodatek(insolvencaPodatki, "Poštna številka", insolvenca.searchedPostalCode);
    if (insolvenca.searchedCompanyId) dodajPodatek(insolvencaPodatki, "OpenRegister ID", insolvenca.searchedCompanyId);
    if (insolvenca.evidenceStatus === "verified_api") {
      dodajPodatek(insolvencaPodatki, "Vir", insolvenca.sourceLabel || "OpenRegister Insolvency API");
      var apiCas = new Date(insolvenca.checkedAt || podatki.checkedAt || Date.now());
      dodajPodatek(insolvencaPodatki, "Čas poizvedbe", new Intl.DateTimeFormat("sl-SI", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(apiCas));
    }
    var uradnaPotrditev = insolvenca.officialVerification || {};
    var samoUradniPortal = insolvenca.verificationMode === "official_portal_only";
    if (uradnaPotrditev.status) {
      var uradniStatus = {
        confirmed_match: "Isti postopek potrjen",
        clear: "Brez objave",
        unverified: "Zadetek se ne ujema",
        unavailable: "Preverjanje ni uspelo",
      }[uradnaPotrditev.status] || "Ni potrjeno";
      dodajPodatek(insolvencaPodatki, "Državni register", uradniStatus);
      if (uradnaPotrditev.searchedCaseNumber) dodajPodatek(insolvencaPodatki, "Uradno iskana zadeva", uradnaPotrditev.searchedCaseNumber);
      if (uradnaPotrditev.searchedRegister) dodajPodatek(insolvencaPodatki, "Uradno iskan register", uradnaPotrditev.searchedRegister);
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
        dodajPodatek(insolvencaPodatki, predpona + "dolžnik", zadetek.debtor_name);
        dodajPodatek(insolvencaPodatki, predpona + "postopek", [zadetek.case_number, zadetek.court].filter(Boolean).join(" · "));
        dodajPodatek(insolvencaPodatki, predpona + "status", zadetek.current_status);
      });
      if (insolvenca.detailsLimited) dodajPodatek(insolvencaPodatki, "Omejitev", "Prikazanih je prvih 5 zadetkov; preverite tudi ročni vir.");
    } else if (insolvenca.status === "unavailable") {
      insolvencaStatus.textContent = "Ni dosegljivo";
      insolvencaStatus.className = "boniteta-znacka boniteta-znacka--yellow";
      if (samoUradniPortal) insolvencaOpis.textContent = "Uradnega portala Insolvenzbekanntmachungen ni bilo mogoče zanesljivo preveriti ali posneti. Poskusite ponovno pozneje.";
      else if (insolvenca.reason === "insufficient_credits") insolvencaOpis.textContent = "OpenRegister nima dovolj API kreditov za insolvenčno poizvedbo.";
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
    potek.querySelectorAll(".boniteta-potek__korak").forEach(function (korak) {
      korak.classList.remove("is-active");
      korak.classList.remove("is-done");
      if (podatki.confirmationRequired && korak.dataset.bonitetaKorak === "insolvency") korak.classList.add("is-active");
      else korak.classList.add("is-done");
    });
    rezultat.hidden = false;
    if (izbrisiPreverboGumb) izbrisiPreverboGumb.hidden = !zadnjiJobId;
    if (profilPovezava) profilPovezava.hidden = true;
    void shraniZakljucenoPreverbo(podatki, vnosObRezultatu, mojaGeneracija);
    if (window.UJPrilagodiVelikostBesedila) {
      rezultat.querySelectorAll("[data-fit-text]").forEach(window.UJPrilagodiVelikostBesedila);
    }
    rezultat.scrollIntoView({ behavior: "smooth", block: "start" });
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
    osveziOpenRegisterPreklop();
    vnosPodrobnosti.hidden = true;
    izbiraStranke.hidden = true;
    nastaviZajemStatus("", null);
    nastaviZajemKartico(null, null);
    nastaviHeroPodjetje("");
    document.getElementById("boniteta-nacin-slikaj").focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

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
