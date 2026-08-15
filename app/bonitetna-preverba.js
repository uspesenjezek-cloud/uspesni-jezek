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
  var brezSpletneGumb = document.getElementById("boniteta-brez-spletne");
  var spletnaStatus = document.getElementById("boniteta-spletna-status");
  var privzetiGumb = gumb.innerHTML;
  var zadnjaSamodejnaPosta = "";
  var samodejniKraj = "";
  var potrjenoBrezSpletne = false;
  var zadnjiVnos = null;
  var potrditevIdentitete = document.getElementById("boniteta-potrditev-identitete");
  var potrditevNapaka = document.getElementById("boniteta-potrditev-napaka");
  var potrditevGumb = document.getElementById("boniteta-potrditev-gumb");

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

  async function dolociKrajIzPoste(posta) {
    if (!/^\d{5}$/.test(posta) || posta === zadnjaSamodejnaPosta) return;
    zadnjaSamodejnaPosta = posta;
    krajStatus.textContent = "Iščem kraj …";
    try {
      var odgovor = await fetch("/api/nemcija-posta?postalCode=" + encodeURIComponent(posta));
      var podatki = await odgovor.json();
      var kraji = odgovor.ok && Array.isArray(podatki.cities) ? podatki.cities : [];
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
      krajStatus.textContent = "Kraja ni bilo mogoče določiti – vnesite ga ročno.";
    }
  }

  async function pridobiToken() {
    var seja = await supabaseKlient.auth.getSession();
    var token = seja && seja.data && seja.data.session && seja.data.session.access_token;
    if (!token) throw new Error("Prijava je potekla. Prijavite se znova.");
    return token;
  }

  function nastaviNalaganje(vklopljeno) {
    gumb.disabled = vklopljeno;
    if (vklopljeno) {
      gumb.classList.add("is-loading");
      gumb.innerHTML = '<span class="boniteta-gumb__spinner" aria-hidden="true"></span><span>Preverjam uradne vire …</span>';
      potek.hidden = false;
      rezultat.hidden = true;
    } else {
      gumb.classList.remove("is-loading");
      gumb.innerHTML = privzetiGumb;
    }
  }

  function dodajPodatek(dl, oznaka, vrednost) {
    if (!vrednost) return;
    dl.insertAdjacentHTML("beforeend", "<dt>" + esc(oznaka) + "</dt><dd data-fit-text data-fit-text-min=\"8\">" + esc(vrednost) + "</dd>");
  }

  function oznakaStatusaVira(status) {
    if (status === "found") return { tekst: "Najdeno", razred: "green" };
    if (status === "manual_available") return { tekst: "Ročno", razred: "yellow" };
    if (status === "not_configured") return { tekst: "Ni povezano", razred: "yellow" };
    if (status === "unsupported_region") return { tekst: "Ni priključeno", razred: "yellow" };
    if (status === "unavailable") return { tekst: "Nedosegljivo", razred: "yellow" };
    if (status === "ambiguous") return { tekst: "Več zadetkov", razred: "yellow" };
    if (status === "not_provided") return { tekst: "Brez vnosa", razred: "" };
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
    var dokaziloIdentitete = podatki.identityEvidence || {};
    var ujemanjeLokacije = podatki.locationMatch || {};
    var identitetaNaslov = document.getElementById("boniteta-identiteta-naslov");
    var identitetaPosnetek = document.getElementById("boniteta-identiteta-posnetek");
    var identitetaSlika = document.getElementById("boniteta-identiteta-slika");
    var identitetaPrenos = document.getElementById("boniteta-identiteta-prenos");
    var identitetaCas = document.getElementById("boniteta-identiteta-cas");
    hwkPodatki.innerHTML = "";
    hwkVir.hidden = false;
    identitetaPosnetek.hidden = true;
    identitetaSlika.removeAttribute("src");
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
      dodajPodatek(hwkPodatki, "Nosilec", identiteta.ime);
      dodajPodatek(hwkPodatki, "Naslov", [identiteta.naslov, identiteta.postnaStevilka, identiteta.kraj].filter(Boolean).join(", "));
      dodajPodatek(hwkPodatki, "Stopnja", identiteta.status === "confirmed_impressum" ? "Potrjeno s strani uporabnika" : "Čaka na pregled uporabnika");
      hwkVir.href = profil.sourceUrl || identiteta.sourceUrl || "#";
      hwkVir.textContent = "Odpri Impressum podjetja ↗";
    } else {
      hwkStatus.textContent = "Ni razbrano";
      hwkStatus.className = "boniteta-znacka boniteta-znacka--yellow";
      identitetaNaslov.textContent = "Identiteta";
      dodajPodatek(hwkPodatki, "Rezultat", "Noben avtomatski vir ni vrnil dovolj zanesljive identitete.");
      dodajPodatek(hwkPodatki, "Naslednje", "Preverite spletno stran ali ročno vnesite podatke iz ponudbe oziroma predračuna.");
      hwkVir.href = profil.sourceUrl || (zadnjiVnos && zadnjiVnos.spletnaStran) || "#";
      hwkVir.textContent = "Odpri vneseno spletno stran ↗";
    }

    if (podatki.confirmationRequired) {
      potrditevIdentitete.hidden = false;
      potrditevNapaka.hidden = true;
      document.getElementById("boniteta-potrdi-ime").value = identiteta.ime || "";
      document.getElementById("boniteta-potrdi-naziv").value = identiteta.naziv || identiteta.ime || "";
      document.getElementById("boniteta-potrdi-naslov").value = identiteta.naslov || (zadnjiVnos && zadnjiVnos.naslov) || "";
      document.getElementById("boniteta-potrdi-posta").value = identiteta.postnaStevilka || (zadnjiVnos && zadnjiVnos.postnaStevilka) || "";
      document.getElementById("boniteta-potrdi-kraj").value = identiteta.kraj || (zadnjiVnos && zadnjiVnos.kraj) || "";
      document.getElementById("boniteta-potrdi-checkbox").checked = false;
    }

    if (ujemanjeLokacije.status) {
      var vnesenaLokacija = ujemanjeLokacije.entered || {};
      var uradnaLokacija = ujemanjeLokacije.official || {};
      dodajPodatek(hwkPodatki, "Vneseni naslov", [vnesenaLokacija.naslov, vnesenaLokacija.postnaStevilka, vnesenaLokacija.kraj].filter(Boolean).join(", "));
      dodajPodatek(hwkPodatki, ujemanjeLokacije.confirmationType === "user_confirmed" ? "Potrjeni naslov" : "Uradni naslov", [uradnaLokacija.naslov, uradnaLokacija.postnaStevilka, uradnaLokacija.kraj].filter(Boolean).join(", "));
      if (ujemanjeLokacije.status === "matched") {
        if (ujemanjeLokacije.confirmationType === "user_confirmed") {
          dodajPodatek(hwkPodatki, "Potrditev", "Podatke je s prikazanim Impressumom primerjal uporabnik");
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

    if (dokaziloIdentitete.status === "captured" && /^data:image\/jpeg;base64,/.test(dokaziloIdentitete.imageDataUrl || "")) {
      identitetaSlika.src = dokaziloIdentitete.imageDataUrl;
      identitetaPrenos.href = dokaziloIdentitete.imageDataUrl;
      identitetaPosnetek.hidden = false;
      var identitetaPreverjenaOb = new Date(dokaziloIdentitete.capturedAt || podatki.checkedAt || Date.now());
      identitetaCas.textContent = "Zajeto " + new Intl.DateTimeFormat("sl-SI", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(identitetaPreverjenaOb) + " na " + (dokaziloIdentitete.sourceLabel || "registrskem viru");
    }

    izrisiVire(podatki.sources);

    var insolvenca = podatki.insolvency || {};
    var insolvencaStatus = document.getElementById("boniteta-insolvenca-status");
    var insolvencaOpis = document.getElementById("boniteta-insolvenca-opis");
    var insolvencaPodatki = document.getElementById("boniteta-insolvenca-podatki");
    var insolvencaPosnetek = document.getElementById("boniteta-insolvenca-posnetek");
    var insolvencaSlika = document.getElementById("boniteta-insolvenca-slika");
    var insolvencaPrenos = document.getElementById("boniteta-insolvenca-prenos");
    var insolvencaCas = document.getElementById("boniteta-insolvenca-cas");
    insolvencaPodatki.innerHTML = "";
    insolvencaPosnetek.hidden = true;
    insolvencaSlika.removeAttribute("src");
    var iskanoIme = String(insolvenca.searchedName || identiteta.ime || "").trim().split(/\s+/).filter(Boolean);
    var iskaniPriimek = String(insolvenca.searchedLastName || (iskanoIme.length > 1 ? iskanoIme[iskanoIme.length - 1] : iskanoIme[0]) || "");
    var iskanoOsebnoIme = String(insolvenca.searchedFirstName || (iskanoIme.length > 1 ? iskanoIme.slice(0, -1).join(" ") : ""));
    var iskaniKraj = String(insolvenca.searchedCity || identiteta.kraj || "");
    if (iskaniPriimek) dodajPodatek(insolvencaPodatki, "Priimek", iskaniPriimek);
    if (iskanoOsebnoIme) dodajPodatek(insolvencaPodatki, "Ime", iskanoOsebnoIme);
    if (iskaniKraj) dodajPodatek(insolvencaPodatki, "Kraj", iskaniKraj);
    if (insolvenca.status === "clear") {
      insolvencaStatus.textContent = "Brez zadetka";
      insolvencaStatus.className = "boniteta-znacka boniteta-znacka--" + (identiteta.status === "confirmed_impressum" ? "yellow" : "green");
      insolvencaOpis.textContent = identiteta.status === "confirmed_impressum"
        ? "Za uporabniško potrjene podatke " + insolvenca.searchedName + " in kraj " + insolvenca.searchedCity + " ni bila najdena javna insolvenčna objava."
        : "Za " + insolvenca.searchedName + " in kraj " + insolvenca.searchedCity + " ni najdenih javnih insolvenčnih objav.";
    } else if (insolvenca.status === "possible_match") {
      insolvencaStatus.textContent = "Možen zadetek";
      insolvencaStatus.className = "boniteta-znacka boniteta-znacka--red";
      insolvencaOpis.textContent = "Najdena je najmanj ena možna objava. Pred sodelovanjem je treba ročno potrditi identiteto.";
    } else if (insolvenca.status === "unavailable") {
      insolvencaStatus.textContent = "Ni dosegljivo";
      insolvencaStatus.className = "boniteta-znacka boniteta-znacka--yellow";
      insolvencaOpis.textContent = "Uradni insolvenčni portal trenutno ni vrnil rezultata. Poskusite ponovno pozneje.";
    } else {
      insolvencaStatus.textContent = "Ni preverjeno";
      insolvencaStatus.className = "boniteta-znacka boniteta-znacka--yellow";
      if (insolvenca.reason === "location_mismatch") {
        insolvencaOpis.textContent = "Vneseni naslov, kraj ali poštna številka se ne ujema z uradnim zadetkom, zato insolvenčna preverba ni bila izvedena.";
      } else if (insolvenca.reason === "location_unverifiable") {
        insolvencaOpis.textContent = "Uradni vir nima vseh podatkov za zanesljivo potrditev naslova, zato insolvenčna preverba ni bila izvedena.";
      } else if (insolvenca.reason === "identity_evidence_unavailable") {
        insolvencaOpis.textContent = "Posnetka oziroma podatkov uporabljenega vira ni bilo mogoče shraniti, zato insolvenčna preverba ni bila izvedena.";
      } else if (insolvenca.reason === "user_confirmation_required") {
        insolvencaOpis.textContent = "Najprej preglejte razbrane podatke, jih po potrebi popravite in kliknite »Podatki so pravilni – preveri insolventnost«.";
      } else {
        insolvencaOpis.textContent = "Podatki za insolvenčno poizvedbo še niso potrjeni.";
      }
    }
    if (insolvenca.evidenceStatus === "captured" && /^data:image\/jpeg;base64,/.test(insolvenca.evidenceImage || "")) {
      insolvencaSlika.src = insolvenca.evidenceImage;
      insolvencaPrenos.href = insolvenca.evidenceImage;
      insolvencaPosnetek.hidden = false;
      var preverjenoOb = new Date(insolvenca.evidenceCapturedAt || podatki.checkedAt || Date.now());
      insolvencaCas.textContent = "Zajeto " + new Intl.DateTimeFormat("sl-SI", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(preverjenoOb) + " na Insolvenzbekanntmachungen";
    }

    potek.querySelectorAll(".boniteta-potek__korak").forEach(function (korak) {
      korak.classList.remove("is-active");
      korak.classList.remove("is-done");
      if (podatki.confirmationRequired && korak.dataset.bonitetaKorak === "insolvency") korak.classList.add("is-active");
      else korak.classList.add("is-done");
    });
    rezultat.hidden = false;
    if (window.UJPrilagodiVelikostBesedila) {
      rezultat.querySelectorAll("[data-fit-text]").forEach(window.UJPrilagodiVelikostBesedila);
    }
    rezultat.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  obrazec.addEventListener("submit", async function (dogodek) {
    dogodek.preventDefault();
    pocistiNapako();
    if (!obrazec.reportValidity()) return;

    var posta = document.getElementById("boniteta-posta").value.replace(/\D/g, "");
    var spletnaStran = spletnaPolje.value.trim();
    if (!spletnaStran && !potrjenoBrezSpletne) {
      pokaziNapako("Vnesite spletno stran ali kliknite »Nima spletne strani«.");
      spletnaPolje.focus();
      return;
    }
    var rocnoIme = document.getElementById("boniteta-ime").value.trim();
    var rocniNaslov = document.getElementById("boniteta-naslov-podjetja").value.trim();
    var rocniKraj = krajPolje.value.trim();
    if (!spletnaStran && (!rocnoIme || rocniNaslov.length < 3 || !/^\d{5}$/.test(posta) || rocniKraj.length < 2)) {
      pokaziNapako("Brez spletne strani izpolnite ime, ulico s hišno številko, poštno številko in kraj.");
      return;
    }
    if (posta && !/^\d{5}$/.test(posta)) {
      pokaziNapako("Poštna številka mora vsebovati pet številk ali pa polje pustite prazno.");
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
      };
      var odgovor = await fetch("/api/mehka-boniteta", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(zadnjiVnos),
      });
      var podatki = null;
      try { podatki = await odgovor.json(); } catch (_) {}
      if (!odgovor.ok) throw new Error((podatki && podatki.napaka) || "Preverjanje ni uspelo.");
      izrisi(podatki);
    } catch (err) {
      potek.hidden = true;
      pokaziNapako(err.message || "Preverjanje trenutno ni mogoče.");
    } finally {
      nastaviNalaganje(false);
    }
  });

  potrditevGumb.addEventListener("click", async function () {
    potrditevNapaka.hidden = true;
    if (!zadnjiVnos) return;
    var potrjenoIme = document.getElementById("boniteta-potrdi-ime").value.trim();
    var potrjeniNaziv = document.getElementById("boniteta-potrdi-naziv").value.trim();
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
          street: potrjeniNaslov,
          postalCode: potrjenaPosta,
          city: potrjeniKraj,
          confirmed: true,
        },
      });
      var odgovor = await fetch("/api/mehka-boniteta", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(telo),
      });
      var podatki = null;
      try { podatki = await odgovor.json(); } catch (_) {}
      if (!odgovor.ok) throw new Error((podatki && podatki.napaka) || "Potrditve podatkov ni bilo mogoče sprejeti.");
      izrisi(podatki);
    } catch (napakaPotrditve) {
      potrditevNapaka.textContent = napakaPotrditve.message || "Potrditev podatkov ni uspela.";
      potrditevNapaka.hidden = false;
    } finally {
      potrditevGumb.disabled = false;
      potrditevGumb.textContent = "Podatki so pravilni – preveri insolventnost";
    }
  });

  document.getElementById("boniteta-ponovi").addEventListener("click", function () {
    rezultat.hidden = true;
    potek.hidden = true;
    pocistiNapako();
    document.getElementById("boniteta-ime").focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  postaPolje.addEventListener("input", function (dogodek) {
    dogodek.target.value = dogodek.target.value.replace(/\D/g, "").slice(0, 5);
    if (dogodek.target.value.length < 5) {
      zadnjaSamodejnaPosta = "";
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
})();
