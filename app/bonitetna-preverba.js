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
  var krajPredlogi = document.getElementById("boniteta-kraj-predlogi");
  var dodatniPreklop = document.getElementById("boniteta-dodatni-preklop");
  var dodatniPodatki = document.getElementById("boniteta-dodatni-podatki");
  var spletnaPolje = document.getElementById("boniteta-spletna-stran");
  var heroSpletnaPolje = document.getElementById("boniteta-hero-spletna-stran");
  var heroSpletnaPocisti = document.getElementById("boniteta-hero-pocisti");
  var heroSpletnaStatus = document.getElementById("boniteta-hero-status");
  var heroPodnaslov = document.getElementById("boniteta-hero-podnaslov");
  var heroPreveriGumb = document.getElementById("boniteta-flow-start");
  var privzetiHeroPreveriGumb = heroPreveriGumb ? heroPreveriGumb.innerHTML : "";
  var heroNalaganjeCasovnik = 0;
  var heroNalaganjeKorak = 0;
  var heroPoudarekCasovnik = 0;
  var HERO_NALAGANJE_BESEDILA = [
    "Preverjam register …",
    "Preverjam sedež …",
    "Preverjam status …",
    "Preverjam finance …",
    "Preverjam vodstvo …",
    "Preverjam povezave …",
    "Preverjam insolventnost …",
    "Primerjam podatke …",
    "Sestavljam rezultat …",
  ];
  var heroSpletnaOkvir = document.querySelector(".boniteta-hero__iskanje");
  var heroSpletnaLabel = document.getElementById("boniteta-hero-label");
  var privzetiHeroPodnaslov = heroPodnaslov ? heroPodnaslov.textContent : "Preveri novo stranko";
  var privzetaHeroOznaka = heroSpletnaLabel ? heroSpletnaLabel.textContent : "Podjetje, oseba ali spletna stran";
  var privzetiHeroPlaceholder = heroSpletnaPolje ? heroSpletnaPolje.placeholder : "Ime, oseba, podjetje ali URL";
  var privzetiHeroInputMode = heroSpletnaPolje ? heroSpletnaPolje.getAttribute("inputmode") || "search" : "search";
  var hero = heroSpletnaOkvir && heroSpletnaOkvir.closest(".boniteta-hero");
  var heroZadetki = document.getElementById("boniteta-hero-zadetki");
  var heroPodjetje = document.getElementById("boniteta-hero-podjetje");
  var heroPodjetjeIme = document.getElementById("boniteta-hero-podjetje-ime");
  var heroPodjetjeOdstrani = document.getElementById("boniteta-hero-podjetje-odstrani");
  var spletnaRezervaRazlog = "";
  var rezervnoRegistrskoIme = "";
  var privzetiGumb = gumb.innerHTML;
  var zadnjaSamodejnaPosta = "";
  var samodejniKraj = "";
  var potrjenoBrezSpletne = true;
  var zadnjiVnos = null;
  var zadnjaOpenRegisterReferenca = "";
  var neposrednaInsolvencnaPreverba = false;
  var generacijaNeposredneInsolvence = 0;
  var generacijaOdpiranjaShranjengaProfila = 0;
  var izbranoOpenRegisterPodjetje = null;
  var autocompleteZaporedje = 0;
  var zadnjaAutocompletePoizvedba = "";
  var zadnjiAutocompleteZadetki = [];
  var brezplacniAutocompleteZadetki = [];
  var brezplacniAutocompleteNalozeni = false;
  var brezplacniAutocompleteNalaganje = null;
  var BREZPLACNI_AUTOCOMPLETE_KLJUC = "uj:boniteta:company-suggestions:v1";
  var ODPRTI_REGISTER_INDEX_RAZLICICA = "2019-02-05-fast-prefix-v3";
  var odprtiRegisterDelci = new Map();
  var odprtiRegisterNalaganja = new Map();
  var odprtiRegisterDodatki = null;
  var odprtiRegisterDodatkiNalaganje = null;
  var odprtiRegisterCasovnik = 0;
  var northDataPrikazanaPoizvedba = "";
  var northDataUradnaRezervaPoizvedba = "";
  var potrditevIdentitete = document.getElementById("boniteta-potrditev-identitete");
  var potrditevNapaka = document.getElementById("boniteta-potrditev-napaka");
  var potrditevGumb = document.getElementById("boniteta-potrditev-gumb");
  var identitetaNadaljuj = document.getElementById("boniteta-identiteta-nadaljuj");
  var insolvencaOkno = document.getElementById("boniteta-insolvenca-okno");
  var insolvencaNazaj = document.getElementById("boniteta-insolvenca-nazaj");
  var insolvencaNazajSpodaj = document.getElementById("boniteta-insolvenca-nazaj-spodaj");
  var insolvencaSklop = document.getElementById("boniteta-insolvenca-sklop");
  var insolvencaKorak = document.getElementById("boniteta-insolvenca-korak");
  var insolvencaOknoNaslov = document.getElementById("boniteta-insolvenca-okno-naslov");
  var insolvencaOknoOpis = document.getElementById("boniteta-insolvenca-okno-opis");
  var potrditevDokaz = document.getElementById("boniteta-potrditev-dokaz");
  var potrditevDokazSlika = document.getElementById("boniteta-potrditev-dokaz-slika");
  var potrditevDokazVir = document.getElementById("boniteta-potrditev-dokaz-vir");
  var potrditevDokazCas = document.getElementById("boniteta-potrditev-dokaz-cas");
  var potrditevDokazNapaka = document.getElementById("boniteta-potrditev-dokaz-napaka");
  var potrditevApiDokaz = document.getElementById("boniteta-potrditev-api-dokaz");
  var potrditevApiDokazVir = document.getElementById("boniteta-potrditev-api-dokaz-vir");
  var potrditevApiDokazIme = document.getElementById("boniteta-potrditev-api-dokaz-ime");
  var potrditevApiDokazNaslov = document.getElementById("boniteta-potrditev-api-dokaz-naslov");
  var potrditevApiDokazRegister = document.getElementById("boniteta-potrditev-api-dokaz-register");
  var potrditevApiDokazId = document.getElementById("boniteta-potrditev-api-dokaz-id");
  var potrditevApiDokazCas = document.getElementById("boniteta-potrditev-api-dokaz-cas");
  var potrditevCheckbox = document.getElementById("boniteta-potrdi-checkbox");
  var potrditevDokaziloPripravljeno = false;
  var vrstaStatus = document.getElementById("boniteta-vrsta-status");
  var zajemStatus = document.getElementById("boniteta-zajem-status");
  var zajemStatusBesedilo = document.getElementById("boniteta-zajem-status-besedilo");
  var zajemFotoaparat = document.getElementById("boniteta-zajem-fotoaparat");
  var zajemDatoteka = document.getElementById("boniteta-zajem-datoteka");
  var zajemSklop = document.getElementById("boniteta-zajem");
  var zajemLocilo = zajemSklop && zajemSklop.querySelector(".boniteta-zajem__locilo");
  var spletnaRezerva = document.getElementById("boniteta-spletna-rezerva");
  var spletnaRezervaOznaka = document.getElementById("boniteta-spletna-rezerva-oznaka");
  var spletnaRezervaNaslov = document.getElementById("boniteta-spletna-rezerva-naslov");
  var spletnaRezervaOpis = document.getElementById("boniteta-spletna-rezerva-opis");
  var rezervaSpletnaGumb = document.getElementById("boniteta-rezerva-spletna");
  var rezervaBrezSpletneGumb = document.getElementById("boniteta-rezerva-brez-spletne");
  var izbiraStranke = document.getElementById("boniteta-izbira-stranke");
  var izbiraStrankeSeznam = document.getElementById("boniteta-izbira-stranke-seznam");
  var vnosPodrobnosti = document.getElementById("boniteta-vnos-podrobnosti");
  var rocniModalZapri = document.getElementById("boniteta-rocni-modal-zapri");
  var rocniModalOzadje = document.getElementById("boniteta-rocni-modal-ozadje");
  var nacinVnosa = "";
  var zajemVTehniku = false;
  var preverjanjeVTehniku = false;
  var univerzalnoIskanjeVTehniku = false;
  var profilPovezava = document.getElementById("boniteta-odpri-profil");
  var inlineProfil = document.getElementById("boniteta-inline-profil");
  var razsiritveSklop = document.getElementById("boniteta-razsiritve");
  var razsiritveOdpri = document.getElementById("boniteta-razsiritve-odpri");
  var razsiritveMoznosti = document.getElementById("boniteta-razsiritve-moznosti");
  var podjetjeSklop = document.getElementById("boniteta-hwk-sklop");
  var podjetjeGlava = document.getElementById("boniteta-podjetje-glava");
  var podjetjeMonogram = document.getElementById("boniteta-podjetje-monogram");
  var podjetjeIme = document.getElementById("boniteta-podjetje-ime");
  var podjetjePreverjeno = document.getElementById("boniteta-podjetje-preverjeno");
  var podjetjePregled = document.getElementById("boniteta-podjetje-pregled");
  var podjetjePodnaslov = document.getElementById("boniteta-podjetje-podnaslov");
  var podjetjeKljucni = document.getElementById("boniteta-podjetje-kljucni");
  var podjetjePogledi = document.getElementById("boniteta-podjetje-pogledi");
  var podjetjeNavigacija = document.getElementById("boniteta-podjetje-navigacija");
  var podjetjeUstanovitev = document.getElementById("boniteta-podjetje-ustanovitev");
  var podjetjeUstanovitevDatum = document.getElementById("boniteta-podjetje-ustanovitev-datum");
  var podjetjeUstanovitevStarost = document.getElementById("boniteta-podjetje-ustanovitev-starost");
  var podjetjeUstanovitevLeta = document.getElementById("boniteta-podjetje-ustanovitev-leta");
  var podjetjeUstanovitevLetaEnota = document.getElementById("boniteta-podjetje-ustanovitev-leta-enota");
  var podjetjeUstanovitevMeseci = document.getElementById("boniteta-podjetje-ustanovitev-meseci");
  var podjetjeUstanovitevMeseciEnota = document.getElementById("boniteta-podjetje-ustanovitev-meseci-enota");
  var podjetjeStatusPodjetja = document.getElementById("boniteta-podjetje-status-podjetja");
  var hwkStatus = document.getElementById("boniteta-hwk-status");
  var hwkPodatki = document.getElementById("boniteta-hwk-podatki");
  var podjetjePodrobnosti = document.getElementById("boniteta-podjetje-podrobnosti");
  var izbraniPodjetjePogled = "kljucni";
  var izstopaImaEkstremniFokus = false;
  var popolnostLok = document.getElementById("boniteta-popolnost-lok");
  var popolnostVrednost = document.getElementById("boniteta-popolnost-vrednost");
  var osnovniOpomba = document.getElementById("boniteta-osnovni-opomba");
  var zaporedjePostnePoizvedbe = 0;
  var krajiTrenutnePoste = [];
  var izrecnoIzbraniKraj = "";
  var generacijaRezultata = 0;
  var zadnjiJobId = "";
  var zadnjiInsolvencniRezultatPripravljen = false;
  var zadnjiProfilId = "";
  var zadnjiRegistrskiPodatki = null;
  var zadnjaRegistrskaIdentiteta = null;
  var izbrisiPreverboGumb = document.getElementById("boniteta-izbrisi-preverbo");
  var monitoringPrimerjava = document.getElementById("boniteta-monitoring-primerjava");
  var monitoringPrimerjavaPodjetje = document.getElementById("boniteta-monitoring-primerjava-podjetje");
  var monitoringPrimerjavaStatus = document.getElementById("boniteta-monitoring-primerjava-status");
  var monitoringPrimerjavaIkona = document.getElementById("boniteta-monitoring-primerjava-ikona");
  var monitoringPrimerjavaOznaka = document.getElementById("boniteta-monitoring-primerjava-oznaka");
  var monitoringPrimerjavaOpis = document.getElementById("boniteta-monitoring-primerjava-opis");
  var monitoringPrimerjavaZnacka = document.getElementById("boniteta-monitoring-primerjava-znacka");
  var monitoringPrimerjavaPrej = document.getElementById("boniteta-monitoring-primerjava-prej");
  var monitoringPrimerjavaZdaj = document.getElementById("boniteta-monitoring-primerjava-zdaj");
  var monitoringPrimerjavaStevilo = document.getElementById("boniteta-monitoring-primerjava-stevilo");
  var monitoringPrimerjavaSeznam = document.getElementById("boniteta-monitoring-primerjava-seznam");

  function nastaviRezultatKotOkno(vklopljeno) {
    document.body.classList.toggle("boniteta-rezultat-je-okno", Boolean(vklopljeno));
    if (rezultatOkno) rezultatOkno.hidden = !vklopljeno;
  }

  function nastaviMonitoringPrimerjavo(odprto) {
    document.body.classList.toggle("boniteta-monitoring-primerjava-je-okno", Boolean(odprto));
    if (monitoringPrimerjava) monitoringPrimerjava.hidden = !odprto;
    if (!odprto && monitoringPrimerjava) monitoringPrimerjava.classList.remove("is-minor", "is-danger");
  }

  function lokalnaMonitoringPrimerjava(type) {
    if (!/^(?:localhost|127\.0\.0\.1)$/.test(window.location.hostname)) return null;
    if (type === "minor") return {
      type: "minor",
      previousCheckedAt: "2026-08-26T09:48:00.000Z",
      currentCheckedAt: "2026-08-27T10:19:00.000Z",
      previousDetail: "Prejšnji podatki · 26. 8. 2026 ob 11:48",
      currentDetail: "Kontaktni podatki posodobljeni · 27. 8. 2026 ob 12:19",
      changes: [
        { key: "phone", label: "Telefon", before: "+49 30 236 78 10", after: "+49 30 236 78 29", tone: "minor" },
        { key: "website", label: "Spletna stran", before: "www.benjamin-klotz.de", after: "www.klotz-bau.de", tone: "minor" },
      ],
    };
    if (type === "danger") return {
      type: "danger",
      previousCheckedAt: "2026-08-26T09:48:00.000Z",
      currentCheckedAt: "2026-08-27T10:19:00.000Z",
      previousDetail: "Brez insolvenčne objave · 26. 8. 2026 ob 11:48",
      currentDetail: "Nova insolvenčna objava · 27. 8. 2026 ob 12:19",
      changes: [
        { key: "insolvency", label: "Insolvenčne objave", before: "Brez zaznanih insolvenčnih objav", after: "Zaznana nova uradna insolvenčna objava", tone: "danger" },
      ],
    };
    return null;
  }

  function monitoringPrimerjalnoStanje(profile, options) {
    var config = options || {};
    var preview = lokalnaMonitoringPrimerjava(String(config.monitoringPreviewState || "").toLowerCase());
    if (preview) return preview;
    var latest = profile && profile.latest_check || {};
    var raw = config.monitoringState || config.monitoring && config.monitoring.card_state || latest.monitoringCardState || null;
    if (!raw || typeof raw !== "object") return null;
    var type = String(raw.type || raw.state || "").toLowerCase().replace(/-/g, "_");
    if (type === "minor_change") type = "minor";
    if (type === "major_change" || type === "negative_change") type = "danger";
    if (!/^(?:minor|danger)$/.test(type)) return null;
    return Object.assign({}, raw, { type: type });
  }

  function monitoringPrimerjavaCas(value, fallback) {
    var date = new Date(value || "");
    if (isFinite(date)) return new Intl.DateTimeFormat("sl-SI", { timeZone: "Europe/Ljubljana", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date).replace(",", " ob");
    var detail = String(fallback || ""), parts = detail.split("·");
    return String(parts[parts.length - 1] || detail || "Čas ni shranjen").trim();
  }

  function monitoringPrimerjavaSpremembe(state) {
    var rows = Array.isArray(state && state.changes) ? state.changes.filter(function (change) {
      return change && (change.label || change.key) && (change.before != null || change.after != null);
    }).slice(0, 20) : [];
    if (rows.length) return rows;
    return [{
      key: "legacy-summary",
      label: "Povzetek spremembe",
      before: state && state.previousDetail || "Prejšnja vrednost ni bila podrobno shranjena",
      after: state && state.currentDetail || "Nova vrednost ni bila podrobno shranjena",
      tone: state && state.type === "danger" ? "danger" : "minor",
    }];
  }

  function prikaziMonitoringPrimerjavo(profile, state) {
    if (!monitoringPrimerjava || !state) return;
    var danger = state.type === "danger", changes = monitoringPrimerjavaSpremembe(state);
    monitoringPrimerjava.classList.toggle("is-minor", !danger);
    monitoringPrimerjava.classList.toggle("is-danger", danger);
    monitoringPrimerjavaPodjetje.textContent = profile && profile.legal_name || "Podjetje";
    monitoringPrimerjavaOznaka.textContent = danger ? "Pomembna sprememba" : "Manjša sprememba";
    monitoringPrimerjavaOpis.textContent = danger
      ? "Nova preverba vsebuje pomemben podatek, ki zahteva vaš pregled. Spodaj je označena natančna razlika."
      : "Spremenili so se osnovni ali kontaktni podatki. Spodaj je označeno, kaj je bilo prej in kaj velja zdaj.";
    monitoringPrimerjavaZnacka.textContent = danger ? "POMEMBNO" : "MANJŠA";
    monitoringPrimerjavaIkona.innerHTML = danger
      ? '<svg viewBox="0 0 24 24"><path d="M12 4 3.5 19h17L12 4Z"/><path d="M12 9v4.5M12 16.5h.01"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M6 5v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V6"/><path d="m14 10 4-4 4 4"/></svg>';
    monitoringPrimerjavaPrej.textContent = monitoringPrimerjavaCas(state.previousCheckedAt, state.previousDetail);
    monitoringPrimerjavaZdaj.textContent = monitoringPrimerjavaCas(state.currentCheckedAt, state.currentDetail);
    monitoringPrimerjavaStevilo.textContent = String(changes.length);
    monitoringPrimerjavaSeznam.innerHTML = changes.map(function (change) {
      var tone = change.tone === "danger" || danger && change.key === "insolvency" ? "danger" : "minor";
      return '<article class="boniteta-monitoring-sprememba is-' + tone + '">' +
        '<div class="boniteta-monitoring-sprememba__glava"><strong data-fit-text data-fit-text-min="9">' + esc(change.label || change.key || "Spremenjeni podatek") + '</strong><span>' + (tone === "danger" ? "POMEMBNO" : "MANJŠA SPREMEMBA") + '</span></div>' +
        '<div class="boniteta-monitoring-sprememba__vrednosti"><span class="boniteta-monitoring-sprememba__prej"><small>PREJ</small><strong data-fit-text data-fit-text-min="9">' + esc(change.before == null || change.before === "" ? "Ni podatka" : change.before) + '</strong><i class="boniteta-monitoring-sprememba__x" aria-hidden="true">×</i></span><i aria-hidden="true">→</i><span><small>ZDAJ</small><strong data-fit-text data-fit-text-min="9">' + esc(change.after == null || change.after === "" ? "Ni podatka" : change.after) + '</strong></span></div>' +
        '</article>';
    }).join("");
    nastaviInsolvencnoOkno(false, false);
    nastaviRezultatKotOkno(true);
    nastaviMonitoringPrimerjavo(true);
    rezultat.hidden = false;
    if (potek) potek.hidden = true;
    if (window.UJPrilagodiVelikostBesedila) monitoringPrimerjava.querySelectorAll("[data-fit-text]").forEach(window.UJPrilagodiVelikostBesedila);
    monitoringPrimerjava.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function zapriMonitoringPrimerjavo() {
    nastaviMonitoringPrimerjavo(false);
    window.dispatchEvent(new CustomEvent("uj:boniteta:monitoring-comparison-close"));
  }

  [document.getElementById("boniteta-monitoring-primerjava-nazaj"), document.getElementById("boniteta-monitoring-primerjava-nazaj-spodaj")].filter(Boolean).forEach(function (button) {
    button.addEventListener("click", zapriMonitoringPrimerjavo);
  });

  function nastaviInsolvencnoOkno(odprto, rezultatPripravljen) {
    if (!insolvencaOkno) return;
    document.body.classList.toggle("boniteta-insolvenca-je-okno", Boolean(odprto));
    insolvencaOkno.hidden = !odprto;
    if (!odprto) return;
    if (insolvencaSklop) insolvencaSklop.hidden = !rezultatPripravljen;
    if (potrditevIdentitete) potrditevIdentitete.hidden = Boolean(rezultatPripravljen);
    if (potrditevDokaz) potrditevDokaz.hidden = Boolean(rezultatPripravljen) || !potrditevDokaziloPripravljeno || !potrditevDokazSlika.getAttribute("src");
    if (potrditevApiDokaz) potrditevApiDokaz.hidden = Boolean(rezultatPripravljen) || potrditevApiDokaz.dataset.ready !== "true";
    if (potrditevDokazNapaka && rezultatPripravljen) potrditevDokazNapaka.hidden = true;
    if (!rezultatPripravljen && potrditevIdentitete && potrditevIdentitete.hidden) {
      potrditevIdentitete.hidden = false;
      potrditevNapaka.textContent = "Podatki za potrditev niso bili pripravljeni. Vrnite se na podatke podjetja in poskusite ponovno.";
      potrditevNapaka.hidden = false;
    }
    if (insolvencaKorak) insolvencaKorak.textContent = rezultatPripravljen
      ? "2. KORAK · INSOLVENČNA PREVERBA"
      : "1. KORAK · POTRDITEV PODATKOV";
    if (insolvencaOknoNaslov) insolvencaOknoNaslov.textContent = rezultatPripravljen ? "Rezultat preverbe" : "Preverite podatke";
    var jeOseba = zadnjaRegistrskaIdentiteta && zadnjaRegistrskaIdentiteta.entityType === "person";
    if (insolvencaOknoOpis) insolvencaOknoOpis.textContent = rezultatPripravljen
      ? "Preverili smo potrjeno identiteto " + (jeOseba ? "osebe." : "podjetja.")
      : "Primerjajte podatke s prikazanim uradnim virom in jih potrdite.";
    insolvencaOkno.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function potrditvenaPolja() {
    return ["boniteta-potrdi-ime", "boniteta-potrdi-naziv", "boniteta-potrdi-nosilec", "boniteta-potrdi-naslov", "boniteta-potrdi-posta", "boniteta-potrdi-kraj"]
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);
  }

  function soPotrditveniPodatkiVeljavni() {
    var ime = document.getElementById("boniteta-potrdi-ime").value.trim();
    var naslov = document.getElementById("boniteta-potrdi-naslov").value.trim();
    var posta = document.getElementById("boniteta-potrdi-posta").value.replace(/\D/g, "");
    var kraj = document.getElementById("boniteta-potrdi-kraj").value.trim();
    return Boolean(ime && naslov.length >= 3 && /^\d{5}$/.test(posta) && kraj.length >= 2);
  }

  function posodobiPotrditevIdentitete() {
    if (!potrditevIdentitete || !potrditevCheckbox || !potrditevGumb) return;
    var potrjenoInVeljavno = potrditevCheckbox.checked && soPotrditveniPodatkiVeljavni() && potrditevDokaziloPripravljeno;
    potrditevIdentitete.classList.toggle("is-confirmed", potrjenoInVeljavno);
    potrditvenaPolja().forEach(function (polje) { polje.readOnly = potrjenoInVeljavno; });
    potrditevGumb.disabled = !potrjenoInVeljavno || potrditevGumb.classList.contains("is-loading");
  }

  function dopolniPraznaPotrditvenaPoljaIzRegistra() {
    var podatki = zadnjiRegistrskiPodatki || {};
    var imaRegistrskiVir = Boolean(zadnjaRegistrskaIdentiteta || podatki.identity);
    if (!imaRegistrskiVir) {
      posodobiPotrditevIdentitete();
      return;
    }
    var identiteta = zadnjaRegistrskaIdentiteta || podatki.identity || {};
    var zadnji = zadnjiVnos || {};
    var jeDruzba = identiteta.entityType === "company";
    var osebe = jeDruzba ? odgovorneOsebe(northDataPodjetje(podatki)) : [];
    if (!osebe.length) osebe = odgovorneOsebeIzIdentitete(identiteta);
    var nosilec = identiteta.nosilec || povzetekOdgovornihOseb(osebe).ime || "";

    function dopolni(id, vrednost) {
      var polje = document.getElementById(id);
      if (!polje) return null;
      if (!polje.value.trim() && String(vrednost || "").trim()) polje.value = String(vrednost).trim();
      prilagodiVnos(polje);
      return polje;
    }

    var ime = jeDruzba
      ? (identiteta.naziv || identiteta.ime || zadnji.ime || "")
      : (identiteta.ime || identiteta.naziv || zadnji.ime || "");
    var obstojeceImePolje = document.getElementById("boniteta-potrdi-ime");
    var imeJeBiloPrazno = Boolean(obstojeceImePolje && !obstojeceImePolje.value.trim());
    var potrdiImePolje = dopolni("boniteta-potrdi-ime", ime);
    var potrdiNazivPolje = dopolni("boniteta-potrdi-naziv", identiteta.poslovniNaziv || identiteta.naziv || identiteta.ime || zadnji.ime || "");
    var potrdiNosilecPolje = dopolni("boniteta-potrdi-nosilec", nosilec);
    dopolni("boniteta-potrdi-naslov", identiteta.naslov || zadnji.naslov || "");
    dopolni("boniteta-potrdi-posta", identiteta.postnaStevilka || zadnji.postnaStevilka || "");
    dopolni("boniteta-potrdi-kraj", identiteta.kraj || zadnji.kraj || "");

    var imeOznaka = document.getElementById("boniteta-potrdi-ime-oznaka");
    if (imeJeBiloPrazno && imeOznaka && imeOznaka.firstChild) imeOznaka.firstChild.nodeValue = jeDruzba ? "Pravno ime " : "Osebno ime ";
    var nazivOvoj = document.getElementById("boniteta-potrdi-naziv-ovoj");
    if (nazivOvoj && potrdiImePolje && potrdiNazivPolje) {
      nazivOvoj.hidden = potrdiNazivPolje.value.trim().toLocaleLowerCase("de") === potrdiImePolje.value.trim().toLocaleLowerCase("de");
    }
    var nosilecOvoj = document.getElementById("boniteta-potrdi-nosilec-ovoj");
    if (nosilecOvoj && potrdiNosilecPolje) nosilecOvoj.hidden = !jeDruzba && !potrdiNosilecPolje.value.trim();
    posodobiPotrditevIdentitete();
  }

  function zacniInsolvencnoPreverboBrezPonovnegaPotrjevanja() {
    var podatki = zadnjiRegistrskiPodatki || {};
    var identiteta = zadnjaRegistrskaIdentiteta || podatki.identity || {};
    if (identiteta.status !== "verified_register") return false;
    var companyId = identiteta.companyId || (podatki.identityEvidence && podatki.identityEvidence.companyId) || "";
    if (!companyId) return false;
    zadnjaOpenRegisterReferenca = companyId;
    zadnjiVnos = Object.assign({}, zadnjiVnos || {}, {
      ime: identiteta.naziv || identiteta.ime || "",
      naslov: identiteta.naslov || "",
      postnaStevilka: identiteta.postnaStevilka || "",
      kraj: identiteta.kraj || "",
      registerNumber: identiteta.registerNumber || (podatki.identityEvidence && podatki.identityEvidence.registerNumber) || "",
      registerCourt: identiteta.registerCourt || (podatki.identityEvidence && podatki.identityEvidence.registerCourt) || "",
      openRegisterCompanyId: companyId,
      uporabiOpenRegisterIdentiteto: true,
    });
    dopolniPraznaPotrditvenaPoljaIzRegistra();
    potrditevCheckbox.checked = true;
    posodobiPotrditevIdentitete();
    if (potrditevGumb.disabled) {
      potrditevCheckbox.checked = false;
      posodobiPotrditevIdentitete();
      return false;
    }
    identitetaNadaljuj.disabled = true;
    identitetaNadaljuj.classList.add("is-loading");
    identitetaNadaljuj.setAttribute("aria-busy", "true");
    var naslov = identitetaNadaljuj.querySelector(".boniteta-identiteta-nadaljuj__vsebina > strong");
    var opis = identitetaNadaljuj.querySelector(".boniteta-identiteta-nadaljuj__vsebina > span");
    if (naslov) naslov.textContent = "Preverjam insolventnost";
    if (opis) opis.textContent = "Preverjanje uradnih objav je v teku …";
    neposrednaInsolvencnaPreverba = true;
    potrditevGumb.click();
    return true;
  }

  function jeUporabenNeposredniInsolvencniRezultat(podatki) {
    var identiteta = podatki && podatki.identity || {};
    var status = podatki && podatki.insolvency && podatki.insolvency.status;
    var imaIdentiteto = Boolean(identiteta.ime || identiteta.naziv) && [
      "verified_register", "confirmed_impressum",
    ].includes(identiteta.status);
    if (!imaIdentiteto) return false;
    return ["clear", "possible_match"].includes(status) && imaUradniInsolvencniPosnetek(podatki);
  }

  function nastaviNalaganjePotrditve(vklopljeno) {
    if (!potrditevGumb) return;
    var oznaka = potrditevGumb.querySelector("[data-potrditev-gumb-label]");
    potrditevGumb.classList.toggle("is-loading", Boolean(vklopljeno));
    potrditevGumb.setAttribute("aria-busy", String(Boolean(vklopljeno)));
    if (oznaka) {
      oznaka.textContent = vklopljeno ? "Preverjam insolventnost" : "Preveri insolventnost";
      if (window.UJPrilagodiVelikostBesedila) window.UJPrilagodiVelikostBesedila(oznaka);
    }
    if (vklopljeno) potrditevGumb.disabled = true;
  }
  window.UJBonitetaNastaviNalaganjePotrditve = nastaviNalaganjePotrditve;

  function jeZakljucenShranjeniInsolvencniRezultat(podatki) {
    var insolvenca = podatki && podatki.insolvency || {};
    var official = insolvenca.officialVerification || {};
    return Boolean(
      podatki && podatki.__shranjeniProfil === true &&
      podatki.confirmationRequired !== true &&
      ["clear", "possible_match"].includes(String(insolvenca.status || "")) &&
      (official.checkedAt || insolvenca.checkedAt || podatki.checkedAt)
    );
  }

  function nastaviKarticoInsolvenceZakljuceno(podatki) {
    if (!identitetaNadaljuj) return;
    var insolvenca = podatki && podatki.insolvency || {};
    var statusi = {
      clear: "Brez zaznanih objav",
      possible_match: "Možen zadetek – preglejte podatke",
    };
    var status = statusi[insolvenca.status] || "Preverba je zaključena";
    var maliNaslov = identitetaNadaljuj.querySelector(".boniteta-identiteta-nadaljuj__vsebina > small");
    var naslov = identitetaNadaljuj.querySelector(".boniteta-identiteta-nadaljuj__vsebina > strong");
    var opis = identitetaNadaljuj.querySelector(".boniteta-identiteta-nadaljuj__vsebina > span");
    var rezultatGumba = identitetaNadaljuj.querySelector(".boniteta-identiteta-nadaljuj__vsebina b em");
    var rezultatIkona = identitetaNadaljuj.querySelector(".boniteta-identiteta-nadaljuj__vsebina b > i:last-child");
    var glavnaIkona = identitetaNadaljuj.querySelector(".boniteta-identiteta-nadaljuj__ikona-rezultat");
    identitetaNadaljuj.hidden = false;
    identitetaNadaljuj.disabled = false;
    identitetaNadaljuj.classList.add("is-complete");
    identitetaNadaljuj.dataset.status = insolvenca.status || "unknown";
    identitetaNadaljuj.setAttribute("aria-label", status + ". Preverjanje uradnih insolvenčnih objav je zaključeno. Odpri rezultat.");
    if (podjetjePreverjeno && podatki && podatki.checkedAt) {
      podjetjePreverjeno.textContent = opisCasaPreverbe(podatki.checkedAt).replace(/^p/, "P");
    }
    if (maliNaslov) maliNaslov.textContent = "INSOLVENČNE OBJAVE PREVERJENE";
    if (naslov) naslov.textContent = status;
    if (opis) opis.textContent = insolvenca.status === "clear"
      ? "V uradnem viru ni najdenih objav."
      : insolvenca.status === "possible_match"
      ? "Možna objava zahteva ročni pregled."
      : "Uradni vir ni vrnil novega rezultata.";
    if (rezultatGumba) {
      rezultatGumba.innerHTML = "";
      var oznaka = document.createElement("small");
      oznaka.textContent = "REZULTAT";
      rezultatGumba.appendChild(oznaka);
      rezultatGumba.appendChild(document.createTextNode(status));
    }
    if (rezultatIkona) rezultatIkona.textContent = insolvenca.status === "clear" ? "✓" : "!";
    if (glavnaIkona) glavnaIkona.textContent = insolvenca.status === "clear" ? "✓" : "!";
    if (window.UJPrilagodiVelikostBesedila) {
      identitetaNadaljuj.querySelectorAll("[data-fit-text]").forEach(window.UJPrilagodiVelikostBesedila);
    }
  }
  window.UJBonitetaNastaviKarticoInsolvenceZakljuceno = nastaviKarticoInsolvenceZakljuceno;

  function uveljaviZakljucenShranjeniInsolvencniRezultat(podatki) {
    if (!jeZakljucenShranjeniInsolvencniRezultat(podatki)) return false;
    zadnjiInsolvencniRezultatPripravljen = true;
    nastaviKarticoInsolvenceZakljuceno(podatki);
    if (insolvencaSklop) insolvencaSklop.hidden = false;
    return true;
  }

  function nastaviKarticoInsolvenceZaNadaljevanje(podatki) {
    if (!identitetaNadaljuj) return;
    var maliNaslov = identitetaNadaljuj.querySelector(".boniteta-identiteta-nadaljuj__vsebina > small");
    var naslov = identitetaNadaljuj.querySelector(".boniteta-identiteta-nadaljuj__vsebina > strong");
    var opis = identitetaNadaljuj.querySelector(".boniteta-identiteta-nadaljuj__vsebina > span");
    identitetaNadaljuj.disabled = false;
    identitetaNadaljuj.classList.remove("is-complete");
    delete identitetaNadaljuj.dataset.status;
    identitetaNadaljuj.setAttribute("aria-label", "Preveri insolventnost. Preverjanje uradnih objav.");
    if (maliNaslov) maliNaslov.textContent = "2. KORAK";
    if (naslov) naslov.textContent = "Preveri insolventnost";
    if (opis) opis.textContent = "Preverjanje uradnih objav";
    if (podjetjePreverjeno && podatki && podatki.identity && podatki.identity.status === "verified_register") {
      podjetjePreverjeno.textContent = "Podatki podjetja so potrjeni";
    }
    if (window.UJPrilagodiVelikostBesedila) {
      identitetaNadaljuj.querySelectorAll("[data-fit-text]").forEach(window.UJPrilagodiVelikostBesedila);
    }
  }
  window.UJBonitetaNastaviKarticoInsolvenceZaNadaljevanje = nastaviKarticoInsolvenceZaNadaljevanje;

  function nastaviKarticoInsolvenceNedokoncano(podatki) {
    nastaviKarticoInsolvenceZaNadaljevanje(podatki);
    if (!identitetaNadaljuj) return;
    var maliNaslov = identitetaNadaljuj.querySelector(".boniteta-identiteta-nadaljuj__vsebina > small");
    var naslov = identitetaNadaljuj.querySelector(".boniteta-identiteta-nadaljuj__vsebina > strong");
    var opis = identitetaNadaljuj.querySelector(".boniteta-identiteta-nadaljuj__vsebina > span");
    identitetaNadaljuj.hidden = false;
    identitetaNadaljuj.setAttribute("aria-label", "Insolvenčna preverba ni zaključena. Pravilni podatki so pripravljeni; preverite uradni vir znova.");
    if (maliNaslov) maliNaslov.textContent = "2. KORAK NI ZAKLJUČEN";
    if (naslov) naslov.textContent = "Preveri insolventnost znova";
    if (opis) opis.textContent = "Podatki podjetja so potrjeni; manjka uradni dokazni posnetek.";
  }

  function pripraviOpenRegisterTestnoPotrditev() {
    if (!rezultat || rezultat.dataset.testPreviewSource !== "openregister") return false;
    document.getElementById("boniteta-potrditev-naslov").textContent = "Preverite podatke pred insolvenčno poizvedbo";
    document.getElementById("boniteta-potrditev-opis").textContent = "To so izmišljeni testni podatki. Potrditev ne sproži API-poizvedbe in ne porabi kreditov.";
    document.getElementById("boniteta-potrditev-kljukica").textContent = "Podatki so pravilni";
    document.getElementById("boniteta-potrditev-kljukica-opis").textContent = "Potrdite za testno nadaljevanje";
    document.getElementById("boniteta-potrdi-ime-oznaka").firstChild.nodeValue = "Pravno ime ";
    document.getElementById("boniteta-potrdi-ime").value = "OPEN Testbau GmbH";
    document.getElementById("boniteta-potrdi-naziv").value = "OPEN Testbau GmbH";
    document.getElementById("boniteta-potrdi-nosilec").value = "Anna Testperson";
    document.getElementById("boniteta-potrdi-nosilec-ovoj").hidden = false;
    document.getElementById("boniteta-potrdi-naslov").value = "Musterstraße 18";
    document.getElementById("boniteta-potrdi-posta").value = "10115";
    document.getElementById("boniteta-potrdi-kraj").value = "Berlin";
    document.getElementById("boniteta-potrdi-checkbox").checked = false;
    potrditevDokaziloPripravljeno = true;
    if (potrditevApiDokaz) {
      potrditevApiDokaz.dataset.ready = "true";
      potrditevApiDokaz.hidden = false;
    }
    if (potrditevApiDokazVir) potrditevApiDokazVir.href = "https://openregister.de";
    if (potrditevApiDokazIme) potrditevApiDokazIme.textContent = "OPEN Testbau GmbH";
    if (potrditevApiDokazNaslov) potrditevApiDokazNaslov.textContent = "Musterstraße 18, 10115 Berlin";
    if (potrditevApiDokazRegister) potrditevApiDokazRegister.textContent = "HRB 123456 · Berlin (Charlottenburg)";
    if (potrditevApiDokazId) potrditevApiDokazId.textContent = "DE-HRB-F1103-123456";
    if (potrditevApiDokazCas) potrditevApiDokazCas.textContent = "Testni strukturirani registrski zapis; posnetek ni potreben.";
    posodobiPotrditevIdentitete();
    potrditevNapaka.hidden = true;
    potrditevIdentitete.hidden = false;
    if (insolvencaSklop) insolvencaSklop.hidden = true;
    zadnjiInsolvencniRezultatPripravljen = false;
    return true;
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
  window.UJBonitetaNastaviInsolvencnoOkno = nastaviInsolvencnoOkno;

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

  function nastaviHeroNapako(sporocilo) {
    if (!heroSpletnaStatus) return;
    heroSpletnaStatus.classList.add("is-error");
    heroSpletnaStatus.textContent = String(sporocilo || "Prišlo je do napake.");
    heroSpletnaStatus.hidden = false;
  }

  function pocistiHeroSporocilo() {
    if (!heroSpletnaStatus) return;
    heroSpletnaStatus.classList.remove("is-error");
    heroSpletnaStatus.textContent = "";
    heroSpletnaStatus.hidden = true;
  }

  function pokaziSpletnoNapako(sporocilo) {
    pocistiNapako();
    vnosPodrobnosti.hidden = true;
    nastaviHeroNapako(sporocilo);
    if (heroSpletnaPolje) heroSpletnaPolje.setAttribute("aria-invalid", "true");
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
    var prejsnjiRazlog = spletnaRezervaRazlog;
    spletnaRezervaRazlog = prikazi ? String(razlog || "") : "";
    spletnaRezerva.hidden = !prikazi;
    zajemSklop.classList.toggle("is-spletna-rezerva", Boolean(prikazi));
    zajemSklop.setAttribute("aria-labelledby", prikazi ? "boniteta-spletna-rezerva-naslov" : "boniteta-zajem-naslov");
    if (zajemLocilo) zajemLocilo.hidden = Boolean(prikazi);
    if (opis && spletnaRezervaOpis) spletnaRezervaOpis.textContent = opis;
    var niRegistrskegaZadetka = razlog === "openregister_not_found";
    if (spletnaRezervaOznaka) spletnaRezervaOznaka.textContent = niRegistrskegaZadetka
      ? "PODJETJA NISMO NAŠLI"
      : "PODATKOV NISMO MOGLI POTRDITI";
    if (spletnaRezervaNaslov) spletnaRezervaNaslov.textContent = niRegistrskegaZadetka
      ? "Kako želite nadaljevati?"
      : "Dodajte drug vir podatkov";
    if (!prikazi) {
      if (prejsnjiRazlog === "openregister_not_found") nastaviHeroZaSpletnoRezervo(false);
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
    if (niRegistrskegaZadetka) nastaviHeroZaSpletnoRezervo(true);
    if (heroSpletnaStatus) {
      var stranJeDejanskoNedosegljiva = [
        "website_not_public", "website_redirect_failed", "website_not_html", "website_too_large",
        "website_unreachable", "website_server_error", "website_rate_limited",
      ].includes(String(razlog || ""));
      heroSpletnaStatus.textContent = stranJeDejanskoNedosegljiva
        ? "Spletne strani ni bilo mogoče prebrati. Izberite naslednji korak spodaj."
        : "Podjetja nismo našli. Izberite naslednji korak spodaj.";
      heroSpletnaStatus.dataset.spletnaRezerva = "true";
      heroSpletnaStatus.hidden = false;
    }
    window.requestAnimationFrame(function () {
      var prviGumb = niRegistrskegaZadetka
        ? heroSpletnaPolje
        : rezervaSpletnaGumb || document.getElementById("boniteta-nacin-slikaj");
      if (prviGumb) prviGumb.focus({ preventScroll: true });
    });
  }

  function prikaziPotPoNeuspesnemRegistrskemIskanju(query, vrstaVnosa) {
    var iskanoIme = String(query || "").trim().replace(/\s+/g, " ");
    rezervnoRegistrskoIme = iskanoIme;
    if (iskanoIme) izpolniRazbranoPolje("boniteta-ime", iskanoIme);
    nastaviSpletnoRezervo(
      true,
      vrstaVnosa === "oseba"
        ? "Vnesite spletno stran osebe ali nadaljujte brez nje."
        : "Vnesite spletno stran podjetja ali nadaljujte brez nje.",
      "openregister_not_found"
    );
  }

  function poudariVnosSpletneStrani() {
    if (!heroSpletnaPolje) return;
    window.clearTimeout(heroPoudarekCasovnik);
    heroSpletnaPolje.classList.remove("is-guided-focus");
    void heroSpletnaPolje.offsetWidth;
    heroSpletnaPolje.classList.add("is-guided-focus");
    heroPoudarekCasovnik = window.setTimeout(function () {
      heroSpletnaPolje.classList.remove("is-guided-focus");
    }, 1000);
  }

  function nastaviHeroZaSpletnoRezervo(vklopljeno) {
    if (!hero || !heroSpletnaPolje || !heroSpletnaOkvir || !heroSpletnaLabel) return;
    hero.classList.toggle("is-website-fallback", Boolean(vklopljeno));
    if (vklopljeno) {
      izbranoOpenRegisterPodjetje = null;
      autocompleteZaporedje += 1;
      nastaviHeroPodjetje("");
      if (heroPodnaslov) heroPodnaslov.textContent = "Vnesite spletno stran";
      heroSpletnaLabel.textContent = "Vnesite spletno stran";
      heroSpletnaPolje.value = "";
      heroSpletnaPolje.placeholder = "www.podjetje.de";
      heroSpletnaPolje.setAttribute("inputmode", "url");
      heroSpletnaPolje.removeAttribute("aria-invalid");
      odpriAutocomplete(false);
      pocistiHeroSporocilo();
      poudariVnosSpletneStrani();
      return;
    }
    if (heroPodnaslov) heroPodnaslov.textContent = privzetiHeroPodnaslov;
    heroSpletnaLabel.textContent = privzetaHeroOznaka;
    heroSpletnaPolje.placeholder = privzetiHeroPlaceholder;
    heroSpletnaPolje.setAttribute("inputmode", privzetiHeroInputMode);
    heroSpletnaPolje.classList.remove("is-guided-focus");
  }

  function jeNeuspesnaSpletnaIdentifikacija(podatki) {
    return nacinVnosa === "spletna" && podatki && podatki.identity && podatki.identity.status === "unresolved";
  }

  function jeNeuspesnaRegistrskaIdentifikacija(podatki) {
    return nacinVnosa === "register" && podatki && podatki.identity && podatki.identity.status === "unresolved";
  }

  function vzpostaviPovecavoPosnetkov() {
    var stopnje = [50, 75, 100, 125, 150, 200, 250, 300, 400];
    document.querySelectorAll("[data-posnetek-povecava]").forEach(function (pregledovalnik) {
      var slika = pregledovalnik.querySelector("img");
      var okno = pregledovalnik.querySelector("[data-posnetek-okno]");
      var obsegOrodij = pregledovalnik.closest("figure") || pregledovalnik;
      var pomanjsaj = obsegOrodij.querySelector("[data-posnetek-pomanjsaj]");
      var povecaj = obsegOrodij.querySelector("[data-posnetek-povecaj]");
      var prilagodi = obsegOrodij.querySelector("[data-posnetek-prilagodi]");
      var izpis = obsegOrodij.querySelector("[data-posnetek-stopnja]");
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
        if (prilagodi) prilagodi.disabled = odstotek === 100;
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
      if (prilagodi) prilagodi.addEventListener("click", ponastaviPovecavo);
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

  function nastaviBrezSpletne(izbrano, brezFokusa) {
    potrjenoBrezSpletne = Boolean(izbrano);
    if (potrjenoBrezSpletne) {
      spletnaPolje.value = "";
    } else if (!brezFokusa) spletnaPolje.focus();
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
    heroSpletnaLabel.textContent = vrednost ? "Izbrano podjetje" : "Podjetje, oseba ali spletna stran";
    if (heroPodjetjeIme) {
      heroPodjetjeIme.textContent = vrednost;
      if (vrednost && window.UJPrilagodiVelikostBesedila) window.UJPrilagodiVelikostBesedila(heroPodjetjeIme);
    }
  }

  function posodobiHeroPocisti() {
    if (!heroSpletnaPocisti || !heroSpletnaPolje) return;
    heroSpletnaPocisti.hidden = !heroSpletnaPolje.value.length;
  }

  function pocistiCelotenHeroVnos() {
    ponastaviNovoPreverbo();
    posodobiHeroPocisti();
    if (heroSpletnaPolje) heroSpletnaPolje.focus({ preventScroll: true });
  }

  function razvrstiUniverzalniVnos(vrednost) {
    var izvirnik = String(vrednost || "").trim().replace(/\s+/g, " ");
    var brezOklepajev = izvirnik.replace(/^\[([^\]]+)\]\([^\)]+\)$/, "$1").trim();
    var jeSpletnaStran = /^(?:https?:\/\/|www\.)/i.test(brezOklepajev) || /^[^\s@]+\.[a-z]{2,}(?:[\/?#]|$)/i.test(brezOklepajev);
    if (jeSpletnaStran) {
      return {
        vrsta: "spletna_stran",
        vrednost: /^(?:https?:\/\/)/i.test(brezOklepajev) ? brezOklepajev : "https://" + brezOklepajev,
      };
    }
    if (/angaben\s+gem[aä]ß\s*§?\s*5|impressum|anbieterkennzeichnung/i.test(brezOklepajev)) {
      return { vrsta: "naslov_impressuma", vrednost: brezOklepajev };
    }
    if (/\b(?:HRB|HRA|PR|GnR|VR)\s*[-.:/]?\s*\d+/i.test(brezOklepajev) || /\bDE-(?:HRB|HRA|PR|GNR|VR)-[A-Z0-9-]+/i.test(brezOklepajev)) {
      return { vrsta: "register", vrednost: brezOklepajev };
    }
    var poslovneBesede = /\b(?:gmbh|ug|haftungsbeschr[aä]nkt|ag|kg|ohg|gbr|e\.?\s*k\.?|partg|se|verein|stiftung|genossenschaft|haustechnik|heizung|sanit[aä]r|elektro|bau|service|technik|meister|betrieb|montage|handwerk|immobilien|consulting|logistik|transporte|gas|wasser)\b/i;
    var osebniTokeni = brezOklepajev.split(/\s+/).filter(Boolean);
    var samoIme = osebniTokeni.length >= 2 && osebniTokeni.length <= 4 &&
      osebniTokeni.every(function (token) { return /^[\p{L}][\p{L}'’-]+$/u.test(token); }) &&
      !poslovneBesede.test(brezOklepajev);
    return { vrsta: samoIme ? "oseba" : "podjetje", vrednost: brezOklepajev };
  }

  function jedroUniverzalnegaNaziva(vrednost) {
    return normalizirajAutocompleteBesede(vrednost)
      .split(" ")
      .filter(function (token) {
        return !/^(?:gmbh|ug|ag|kg|ohg|gbr|ek|partg|se|mbh|haftungsbeschrankt)$/.test(token);
      })
      .join(" ");
  }

  function zanesljivEnolicniZadetek(zadetki, query) {
    var iskanoJedro = jedroUniverzalnegaNaziva(query);
    if (!iskanoJedro) return null;
    var enaki = (Array.isArray(zadetki) ? zadetki : []).filter(function (company) {
      return jedroUniverzalnegaNaziva(company && company.name) === iskanoJedro;
    });
    var enolicni = enaki.filter(function (company, index, all) {
      return all.findIndex(function (candidate) {
        return kljucAutocompletePodjetja(candidate) === kljucAutocompletePodjetja(company);
      }) === index;
    });
    return enolicni.length === 1 ? enolicni[0] : null;
  }

  function vsiTrenutniZadetki(query) {
    return zdruziAutocompleteZaPrikaz(
      filtrirajAutocompleteZadetke(query),
      zadnjaAutocompletePoizvedba === query ? zadnjiAutocompleteZadetki : []
    );
  }

  async function izvediUniverzalnoIskanje() {
    if (univerzalnoIskanjeVTehniku || preverjanjeVTehniku) return false;
    if (izbranoOpenRegisterPodjetje) {
      await izvediBonitetnoPreverbo();
      return true;
    }
    var razvrstitev = razvrstiUniverzalniVnos(heroSpletnaPolje && heroSpletnaPolje.value);
    var query = razvrstitev.vrednost;
    if (!query || query.length < 3) {
      nastaviHeroNapako("Vnesite ime podjetja, ime in priimek, registrsko številko ali spletno stran.");
      if (heroSpletnaPolje) heroSpletnaPolje.focus();
      return false;
    }
    if (razvrstitev.vrsta === "naslov_impressuma") {
      nastaviHeroNapako("To je naslov razdelka Impressum. Prilepite spletni naslov strani, na kateri je ta razdelek.");
      if (heroSpletnaPolje) heroSpletnaPolje.focus();
      return false;
    }
    if (razvrstitev.vrsta === "spletna_stran") {
      spletnaPolje.value = razvrstitev.vrednost;
      izpolniRazbranoPolje("boniteta-ime", "");
      nastaviBrezSpletne(false, true);
      nacinVnosa = "spletna";
      nastaviRocniPopup(false);
      vnosPodrobnosti.hidden = true;
      await izvediBonitetnoPreverbo();
      return true;
    }

    univerzalnoIskanjeVTehniku = true;
    var iskalniGumb = document.getElementById("boniteta-nacin-spletna");
    if (iskalniGumb) iskalniGumb.disabled = true;
    if (heroPreveriGumb) heroPreveriGumb.disabled = true;
    pocistiHeroSporocilo();
    try {
      await naloziBrezplacneAutocompleteZadetke();
      var odprtiZadetki = [];
      try { odprtiZadetki = await naloziOdprtiRegisterZadetke(query); } catch (_) {}
      var kandidati = zdruziAutocompleteZaPrikaz(filtrirajAutocompleteZadetke(query), odprtiZadetki);
      var zanesljiv = zanesljivEnolicniZadetek(kandidati, query);
      if (zanesljiv) {
        izberiAutocompletePodjetje(zanesljiv);
        await izvediBonitetnoPreverbo();
        return true;
      }

      if (razvrstitev.vrsta !== "register") {
        await poisciNorthDataPodjetja();
        kandidati = vsiTrenutniZadetki(query);
        zanesljiv = zanesljivEnolicniZadetek(kandidati, query);
        if (zanesljiv) {
          izberiAutocompletePodjetje(zanesljiv);
          await izvediBonitetnoPreverbo();
          return true;
        }
      }

      await poisciAutocompletePodjetja();
      kandidati = vsiTrenutniZadetki(query);
      zanesljiv = zanesljivEnolicniZadetek(kandidati, query);
      if (zanesljiv) {
        izberiAutocompletePodjetje(zanesljiv);
        await izvediBonitetnoPreverbo();
        return true;
      }
      if (kandidati.length) {
        izrisiAutocompleteZadetke(kandidati);
        nastaviHeroNapako(razvrstitev.vrsta === "oseba"
          ? "Našli smo več možnih zapisov za to osebo. Izberite podjetje, ki mu pripada."
          : "Našli smo več možnih podjetij. Izberite pravi registrski zapis.");
        return false;
      }
      prikaziPotPoNeuspesnemRegistrskemIskanju(query, razvrstitev.vrsta);
      return false;
    } catch (error) {
      nastaviHeroNapako(error && error.message || "Iskanja trenutno ni mogoče dokončati.");
      return false;
    } finally {
      univerzalnoIskanjeVTehniku = false;
      if (iskalniGumb) iskalniGumb.disabled = false;
      if (heroPreveriGumb && !preverjanjeVTehniku) heroPreveriGumb.disabled = false;
    }
  }

  function odpriAutocomplete(odprto) {
    var prikazi = Boolean(odprto && heroZadetki && heroZadetki.children.length);
    if (heroZadetki) heroZadetki.hidden = !prikazi;
    if (heroSpletnaPolje) heroSpletnaPolje.setAttribute("aria-expanded", String(prikazi));
    if (hero) hero.classList.toggle("is-autocomplete-open", prikazi);
  }

  async function openRegisterApi(telo) {
    var token = await pridobiToken(false, true);
    var odgovor = await fetchSPonovnimPoskusom("/api/openregister-pro", {
      method: "POST",
      headers: glaveCakalneVrste(token, true),
      body: JSON.stringify(telo),
      signal: omejitevKlica(20000),
    });
    var podatki = null;
    try { podatki = await odgovor.json(); } catch (_) {}
    if (!odgovor.ok) throw new Error(podatki && podatki.napaka || "OpenRegister trenutno ni dosegljiv.");
    return podatki || {};
  }

  async function northDataAutocompleteApi(query) {
    for (var authPoskus = 0; authPoskus < 2; authPoskus += 1) {
      var token = await pridobiToken(authPoskus > 0, true);
      // Plačljivega klica ne ponavljamo po omrežni napaki. Ponovitev je dovoljena
      // samo po HTTP 401, ko je strežnik zahtevo zavrnil še pred zagonom actorja.
      var odgovor = await fetch("/api/openregister-pro", {
        method: "POST",
        headers: glaveCakalneVrste(token, true),
        body: JSON.stringify({ action: "northdata_autocomplete", query: query }),
        signal: omejitevKlica(40000),
      });
      var podatki = null;
      try { podatki = await odgovor.json(); } catch (_) {}
      if (odgovor.status === 401 && authPoskus === 0) continue;
      if (!odgovor.ok) throw new Error(podatki && podatki.napaka || "Novejših imen podjetij trenutno ni mogoče poiskati.");
      return podatki || {};
    }
    throw new Error("Prijave ni bilo mogoče osvežiti. Ponovno odprite stran.");
  }

  function nastaviIskalniGumbZaUradnoRezervo(uradnaRezerva) {
    var iskalniGumb = document.getElementById("boniteta-nacin-spletna");
    if (!iskalniGumb) return;
    var opis = uradnaRezerva
      ? "Preveri neposredno v registru · največ 1 kredit"
      : "Samodejno določi vir in poišči osebo ali podjetje";
    iskalniGumb.setAttribute("aria-label", opis);
    iskalniGumb.title = opis;
  }

  function prvaVrednost() {
    for (var i = 0; i < arguments.length; i += 1) {
      var value = arguments[i];
      if (value !== undefined && value !== null && String(value).trim()) return value;
    }
    return "";
  }

  function normalizirajOpenRegisterPodjetje(company, osnovni) {
    var x = company && typeof company === "object" ? company : {};
    var fallback = osnovni && typeof osnovni === "object" ? osnovni : {};
    var name = x.name && typeof x.name === "object" ? x.name : {};
    var addressRoot = x.address && typeof x.address === "object" ? x.address : {};
    var address = addressRoot.current && typeof addressRoot.current === "object"
      ? addressRoot.current
      : Array.isArray(x.addresses) && x.addresses[0] || addressRoot;
    var register = x.register && typeof x.register === "object"
      ? x.register
      : Array.isArray(x.registers) && x.registers[0] || {};
    var contact = x.contact && typeof x.contact === "object" ? x.contact : {};
    var website = String(prvaVrednost(contact.website_url, contact.website, x.website_url, "")).trim();
    if (website && !/^https?:\/\//i.test(website)) website = "https://" + website.replace(/^\/+/, "");
    return {
      companyId: String(prvaVrednost(x.id, register.company_id, x.company_id, fallback.company_id)).trim(),
      name: String(prvaVrednost(typeof x.name === "string" ? x.name : "", name.name, x.legal_name, fallback.name)).trim(),
      street: String(prvaVrednost(address.street, address.address, x.street, fallback.street, "")).trim(),
      postalCode: String(prvaVrednost(address.postal_code, address.postalCode, x.postal_code, fallback.postal_code, fallback.postalCode, "")).replace(/\D/g, "").slice(0, 5),
      city: String(prvaVrednost(address.city, x.city, fallback.city, "")).trim(),
      registerType: String(prvaVrednost(register.register_type, x.register_type, fallback.register_type, "")).trim(),
      registerNumber: String(prvaVrednost(register.register_number, x.register_number, fallback.register_number, "")).trim(),
      registerCourt: String(prvaVrednost(register.register_court, x.register_court, fallback.register_court, "")).trim(),
      vatId: String(prvaVrednost(contact.vat_id, x.vat_id, "")).trim(),
      website: website,
      identityProof: String(prvaVrednost(x.identity_proof, fallback.identity_proof, "")).trim(),
      suggestionProof: String(prvaVrednost(x.suggestion_proof, fallback.suggestion_proof, "")).trim(),
      source: String(prvaVrednost(x.source, fallback.source, "")).trim(),
      sourceId: String(prvaVrednost(x.source_id, fallback.source_id, "")).trim(),
    };
  }

  function izrisiAutocompleteZadetke(results) {
    if (!heroZadetki) return;
    heroZadetki.innerHTML = "";
    (Array.isArray(results) ? results : []).slice(0, 8).forEach(function (company) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "boniteta-hero__zadetek";
      button.setAttribute("role", "option");
      var name = document.createElement("strong");
      name.textContent = company.name || "Podjetje";
      var details = document.createElement("small");
      details.textContent = [company.register_type, company.register_number, company.register_court || company.city].filter(Boolean).join(" · ") || "Nemški register";
      var status = document.createElement("span");
      status.textContent = company.active === false ? "Neaktivno" : "Izberi";
      button.appendChild(name);
      button.appendChild(details);
      button.appendChild(status);
      button.addEventListener("click", function () { void izberiAutocompletePodjetje(company); });
      button.addEventListener("keydown", function (dogodek) {
        if (dogodek.key !== "ArrowDown" && dogodek.key !== "ArrowUp") return;
        dogodek.preventDefault();
        var buttons = Array.from(heroZadetki.querySelectorAll("button"));
        var index = buttons.indexOf(button) + (dogodek.key === "ArrowDown" ? 1 : -1);
        (buttons[index] || (dogodek.key === "ArrowDown" ? buttons[0] : heroSpletnaPolje)).focus();
      });
      heroZadetki.appendChild(button);
    });
    odpriAutocomplete(heroZadetki.children.length > 0);
  }

  function kljucAutocompletePodjetja(company) {
    return String(company && (company.company_id || company.companyId || company.id) || "").trim() ||
      [company && company.name, company && company.register_number, company && company.register_court]
        .filter(Boolean).join("|").toLocaleLowerCase("de-DE");
  }

  function zdruziBrezplacneAutocompleteZadetke(results) {
    var zdruzeni = new Map();
    brezplacniAutocompleteZadetki.concat(Array.isArray(results) ? results : []).forEach(function (company) {
      var key = kljucAutocompletePodjetja(company);
      if (key && company && company.name) {
        var shranljivo = Object.assign({}, company);
        delete shranljivo.identity_proof;
        delete shranljivo.identityProof;
        zdruzeni.set(key, shranljivo);
      }
    });
    brezplacniAutocompleteZadetki = Array.from(zdruzeni.values()).slice(-120);
    try {
      localStorage.setItem(BREZPLACNI_AUTOCOMPLETE_KLJUC, JSON.stringify(brezplacniAutocompleteZadetki));
    } catch (_) {}
  }

  function preberiBrezplacneAutocompleteZadetke() {
    try {
      var shranjeni = JSON.parse(localStorage.getItem(BREZPLACNI_AUTOCOMPLETE_KLJUC) || "[]");
      zdruziBrezplacneAutocompleteZadetke(Array.isArray(shranjeni) ? shranjeni : []);
    } catch (_) {}
  }

  function profilVAutocompleteZadetek(profile) {
    var address = profile && profile.address && typeof profile.address === "object" ? profile.address : {};
    var companyId = String(profile && (profile.company_id || profile.companyId) || "").trim();
    var name = String(profile && (profile.legal_name || profile.name) || "").trim();
    if (!companyId || !name) return null;
    return {
      company_id: companyId,
      name: name,
      register_number: String(profile.register_number || "").trim(),
      register_court: String(profile.register_court || "").trim(),
      street: String(address.street || address.address || "").trim(),
      postal_code: String(address.postal_code || address.postalCode || "").trim(),
      city: String(address.city || "").trim(),
      active: profile.company_status !== "inactive",
    };
  }

  async function naloziBrezplacneAutocompleteZadetke() {
    if (brezplacniAutocompleteNalozeni) return brezplacniAutocompleteZadetki;
    if (brezplacniAutocompleteNalaganje) return brezplacniAutocompleteNalaganje;
    brezplacniAutocompleteNalaganje = (async function () {
      try {
        var token = await pridobiToken(false, true);
        var odgovor = await fetch("/api/boniteta-pro?route=profiles", {
          headers: glaveCakalneVrste(token, false),
          signal: omejitevKlica(12000),
        });
        var data = await odgovor.json().catch(function () { return {}; });
        if (odgovor.ok) {
          zdruziBrezplacneAutocompleteZadetke((data.profiles || []).map(profilVAutocompleteZadetek).filter(Boolean));
        }
      } catch (_) {
        // Lokalno shranjeni predlogi ostanejo uporabni tudi brez povezave.
      } finally {
        brezplacniAutocompleteNalozeni = true;
        brezplacniAutocompleteNalaganje = null;
      }
      return brezplacniAutocompleteZadetki;
    })();
    return brezplacniAutocompleteNalaganje;
  }

  function filtrirajAutocompleteZadetke(query) {
    if (!String(query || "").trim() || !brezplacniAutocompleteZadetki.length) return [];
    return brezplacniAutocompleteZadetki.map(function (company) {
      return { company: company, score: oceniAutocompleteZadetek(company, query) };
    }).filter(function (entry) {
      return entry.score >= 0;
    }).sort(function (a, b) {
      return b.score - a.score;
    }).map(function (entry) {
      return entry.company;
    });
  }

  function normalizirajAutocompleteBesede(value) {
    return String(value || "")
      .replace(/ß/g, "ss")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("de-DE")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function autocompleteIskalniTokeni(value) {
    var nepomembni = {
      ag: true, co: true, das: true, der: true, die: true, eg: true, gbr: true,
      gmbh: true, hra: true, hrb: true, kg: true, mbh: true, ohg: true,
      partg: true, se: true, ug: true, und: true, von: true, zu: true,
    };
    var vsi = Array.from(new Set(normalizirajAutocompleteBesede(value).split(" ").filter(function (token) {
      return token.length >= 2;
    })));
    var razlikovalni = vsi.filter(function (token) { return !nepomembni[token]; });
    return razlikovalni.length ? razlikovalni : vsi;
  }

  function oceniAutocompleteNaziv(naziv, query) {
    var iskano = normalizirajAutocompleteBesede(query);
    var najdeno = normalizirajAutocompleteBesede(naziv);
    if (!iskano || !najdeno) return -1;
    var vsiIskani = Array.from(new Set(iskano.split(" ").filter(function (token) { return token.length >= 2; })));
    var razlikovalni = autocompleteIskalniTokeni(query);
    var najdeni = new Set(najdeno.split(" "));
    if (razlikovalni.some(function (token) { return !najdeni.has(token); })) return -1;
    var zadeti = vsiIskani.filter(function (token) { return najdeni.has(token); }).length;
    var score = iskano === najdeno ? 2000 : najdeno.indexOf(iskano) >= 0 ? 1400 : 0;
    score += razlikovalni.length * 250;
    score += vsiIskani.length ? Math.round(500 * zadeti / vsiIskani.length) : 0;
    var besedeNaziva = najdeno.split(" ");
    var zadnjiIndex = -1;
    if (razlikovalni.every(function (token) {
      var index = besedeNaziva.indexOf(token, zadnjiIndex + 1);
      if (index < 0) return false;
      zadnjiIndex = index;
      return true;
    })) score += 120;
    score -= Math.max(0, najdeni.size - vsiIskani.length) * 2;
    return score;
  }

  function oceniAutocompleteZadetek(company, query) {
    var nazivScore = oceniAutocompleteNaziv(company && company.name, query);
    if (nazivScore < 0) return -1;
    var dodatno = normalizirajAutocompleteBesede([
      company && company.register_type,
      company && company.register_number,
      company && company.register_court,
      company && company.city,
    ].filter(Boolean).join(" "));
    var dodatniTokeni = normalizirajAutocompleteBesede(query).split(" ").filter(function (token) {
      return token.length >= 2 && dodatno.split(" ").indexOf(token) >= 0;
    });
    return nazivScore + dodatniTokeni.length * 40;
  }

  function normalizirajOdprtiRegisterNiz(value) {
    return normalizirajAutocompleteBesede(value).replace(/\s+/g, "");
  }

  function odprtiRegisterKljuc(query) {
    return (normalizirajOdprtiRegisterNiz(query).slice(0, 2) + "__").slice(0, 2);
  }

  function odprtiRegisterZapisVPodjetje(row) {
    if (!Array.isArray(row) || !row[0]) return null;
    return {
      company_id: "",
      name: String(row[0] || ""),
      city: "",
      register_type: "",
      register_number: "",
      register_court: "",
      active: true,
      source_id: "",
      source: "offeneregister",
    };
  }

  function normalizirajHitroPredpono(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[äáàâãå]/g, "a")
      .replace(/[öóòôõ]/g, "o")
      .replace(/[üúùû]/g, "u")
      .replace(/[éèêë]/g, "e")
      .replace(/[íìîï]/g, "i")
      .replace(/[ýÿ]/g, "y")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "");
  }

  function jedroOdprtiRegisterPoizvedbe(query) {
    var pravneOblike = /^(gmbh|mbh|ag|kg|ohg|ug|eg|ev|se|co)$/i;
    var tokeni = String(query || "").trim().split(/\s+/).filter(Boolean);
    var jedro = [];
    for (var i = 0; i < tokeni.length && jedro.length < 3; i += 1) {
      var token = normalizirajHitroPredpono(tokeni[i]);
      if (!token || pravneOblike.test(token)) break;
      jedro.push(token);
    }
    return jedro.join("") || normalizirajHitroPredpono(query);
  }

  function najdiOdprtiRegisterKandidate(rows, query) {
    var predpona = jedroOdprtiRegisterPoizvedbe(query);
    if (!predpona) return [];
    var kandidati = [];
    var dolzinaVzorcev = Math.max(48, String(query || "").length + 24);
    for (var i = 0; i < rows.length && kandidati.length < 240; i += 1) {
      var row = rows[i];
      if (!Array.isArray(row) || !row[0]) continue;
      var imePredpona = normalizirajHitroPredpono(String(row[0]).slice(0, dolzinaVzorcev));
      if (imePredpona.indexOf(predpona) === 0) kandidati.push(row);
    }
    return kandidati;
  }

  function naloziOdprtiRegisterDelec(key) {
    var rows = odprtiRegisterDelci.get(key);
    if (rows) return Promise.resolve(rows);
    var loading = odprtiRegisterNalaganja.get(key);
    if (loading) return loading;
    loading = fetch("/app/company-index/" + encodeURIComponent(key) + ".json.gz?v=" + encodeURIComponent(ODPRTI_REGISTER_INDEX_RAZLICICA), {
      cache: "force-cache",
    }).then(function (response) {
      if (response.status === 404) return [];
      if (!response.ok) throw new Error("Odprtega seznama trenutno ni mogoče prebrati.");
      return response.json();
    }).then(function (data) {
      var parsed = Array.isArray(data) ? data : [];
      odprtiRegisterDelci.set(key, parsed);
      return parsed;
    }).finally(function () {
      odprtiRegisterNalaganja.delete(key);
    });
    odprtiRegisterNalaganja.set(key, loading);
    return loading;
  }

  function naloziOdprtiRegisterDodatke() {
    if (odprtiRegisterDodatki) return Promise.resolve(odprtiRegisterDodatki);
    if (odprtiRegisterDodatkiNalaganje) return odprtiRegisterDodatkiNalaganje;
    odprtiRegisterDodatkiNalaganje = fetch("/app/company-index/verified-additions.json?v=1", {
      cache: "force-cache",
    }).then(function (response) {
      if (!response.ok) return [];
      return response.json();
    }).then(function (data) {
      odprtiRegisterDodatki = Array.isArray(data) ? data : [];
      return odprtiRegisterDodatki;
    }).catch(function () {
      odprtiRegisterDodatki = [];
      return odprtiRegisterDodatki;
    }).finally(function () {
      odprtiRegisterDodatkiNalaganje = null;
    });
    return odprtiRegisterDodatkiNalaganje;
  }

  async function naloziOdprtiRegisterZadetke(query) {
    var normalized = normalizirajOdprtiRegisterNiz(query);
    if (normalized.length < 3) return [];
    var key = odprtiRegisterKljuc(query);
    var rows = await naloziOdprtiRegisterDelec(key);
    var dodatki = await naloziOdprtiRegisterDodatke();
    var kandidati = najdiOdprtiRegisterKandidate(rows, query).concat(dodatki);
    return kandidati.map(odprtiRegisterZapisVPodjetje).filter(Boolean).map(function (company) {
      return { company: company, score: oceniAutocompleteZadetek(company, query) };
    }).filter(function (entry) {
      return entry.score >= 0;
    }).sort(function (a, b) {
      return b.score - a.score;
    }).map(function (entry) {
      return entry.company;
    }).filter(function (company, index, all) {
      return all.findIndex(function (candidate) {
        return kljucAutocompletePodjetja(candidate) === kljucAutocompletePodjetja(company);
      }) === index;
    }).slice(0, 16);
  }

  function zdruziAutocompleteZaPrikaz(primary, secondary) {
    var unique = new Map();
    (Array.isArray(primary) ? primary : []).concat(Array.isArray(secondary) ? secondary : []).forEach(function (company) {
      var key = kljucAutocompletePodjetja(company);
      if (key && !unique.has(key)) unique.set(key, company);
    });
    return Array.from(unique.values()).slice(0, 8);
  }

  async function poisciAutocompletePodjetja() {
    var query = String(heroSpletnaPolje && heroSpletnaPolje.value || "").trim().replace(/\s+/g, " ");
    var mojeZaporedje = ++autocompleteZaporedje;
    if (query.length < 3) {
      if (heroZadetki) heroZadetki.innerHTML = "";
      odpriAutocomplete(false);
      if (query) nastaviHeroNapako("Vnesite vsaj tri znake imena ali podjetja.");
      else pocistiHeroSporocilo();
      return;
    }
    if (query === zadnjaAutocompletePoizvedba) {
      izrisiAutocompleteZadetke(zadnjiAutocompleteZadetki);
      if (heroSpletnaStatus) {
        heroSpletnaStatus.textContent = zadnjiAutocompleteZadetki.length
          ? "Izberite pravo podjetje s seznama. Ponovljeni prikaz ni porabil novega kredita."
          : "Za vpisano ime ni registrskih zadetkov.";
        heroSpletnaStatus.hidden = false;
      }
      if (!zadnjiAutocompleteZadetki.length) prikaziPotPoNeuspesnemRegistrskemIskanju(query);
      return;
    }
    if (heroSpletnaStatus) {
      heroSpletnaStatus.textContent = "Izvajam končno registrsko iskanje · največ 1 kredit …";
      heroSpletnaStatus.hidden = false;
    }
    try {
      var data = await openRegisterApi({ action: "identity_search", query: query });
      if (mojeZaporedje !== autocompleteZaporedje || query !== heroSpletnaPolje.value.trim().replace(/\s+/g, " ")) return;
      zadnjaAutocompletePoizvedba = query;
      zadnjiAutocompleteZadetki = Array.isArray(data.results) ? data.results : [];
      zdruziBrezplacneAutocompleteZadetke(zadnjiAutocompleteZadetki);
      izrisiAutocompleteZadetke(zadnjiAutocompleteZadetki);
      if (heroSpletnaStatus) {
        heroSpletnaStatus.textContent = zadnjiAutocompleteZadetki.length
          ? "Izberite pravo podjetje. Končna preverba tega izbora ne bo porabila dodatnega kredita. Iskanje: " + (data.creditsUsed === 0 ? "0 kreditov." : "1 kredit.")
          : "Za vpisano ime ni registrskih zadetkov.";
        heroSpletnaStatus.hidden = false;
      }
      if (!zadnjiAutocompleteZadetki.length) prikaziPotPoNeuspesnemRegistrskemIskanju(query);
    } catch (error) {
      if (mojeZaporedje !== autocompleteZaporedje) return;
      odpriAutocomplete(false);
      nastaviHeroNapako(error.message || "Podjetij trenutno ni mogoče poiskati.");
    }
  }

  async function poisciNorthDataPodjetja() {
    var query = String(heroSpletnaPolje && heroSpletnaPolje.value || "").trim().replace(/\s+/g, " ");
    if (query.length < 3) {
      if (heroSpletnaStatus) {
        heroSpletnaStatus.textContent = "Vnesite vsaj tri znake imena ali podjetja.";
        heroSpletnaStatus.hidden = false;
      }
      if (heroSpletnaPolje) {
        heroSpletnaPolje.setAttribute("aria-invalid", "true");
        heroSpletnaPolje.focus();
      }
      return;
    }
    if (northDataUradnaRezervaPoizvedba === query) {
      return poisciAutocompletePodjetja();
    }
    var mojeZaporedje = ++autocompleteZaporedje;
    var shranjeniNorthData = filtrirajAutocompleteZadetke(query).filter(function (company) {
      return company && company.source === "northdata_names";
    });
    if (shranjeniNorthData.length) {
      northDataPrikazanaPoizvedba = query;
      northDataUradnaRezervaPoizvedba = "";
      izrisiAutocompleteZadetke(zdruziAutocompleteZaPrikaz(filtrirajAutocompleteZadetke(query), shranjeniNorthData));
      nastaviIskalniGumbZaUradnoRezervo(false);
      if (heroSpletnaStatus) {
        heroSpletnaStatus.textContent = "Prikazani so že shranjeni novejši predlogi · 0 novega stroška.";
        heroSpletnaStatus.hidden = false;
      }
      return;
    }
    var iskalniGumb = document.getElementById("boniteta-nacin-spletna");
    if (iskalniGumb) iskalniGumb.disabled = true;
    if (heroSpletnaStatus) {
      heroSpletnaStatus.textContent = "Iščem novejša imena v North Data · največ približno 0,013 $ …";
      heroSpletnaStatus.hidden = false;
    }
    try {
      var data = await northDataAutocompleteApi(query);
      if (mojeZaporedje !== autocompleteZaporedje || query !== heroSpletnaPolje.value.trim().replace(/\s+/g, " ")) return;
      var northDataZadetki = Array.isArray(data.results) ? data.results : [];
      northDataPrikazanaPoizvedba = query;
      if (northDataZadetki.length) {
        northDataUradnaRezervaPoizvedba = "";
        nastaviIskalniGumbZaUradnoRezervo(false);
        zdruziBrezplacneAutocompleteZadetke(northDataZadetki);
        var lokalniZadetki = filtrirajAutocompleteZadetke(query);
        var odprtiZadetki = [];
        try { odprtiZadetki = await naloziOdprtiRegisterZadetke(query); } catch (_) {}
        if (mojeZaporedje !== autocompleteZaporedje) return;
        izrisiAutocompleteZadetke(zdruziAutocompleteZaPrikaz(lokalniZadetki, odprtiZadetki));
        if (heroSpletnaStatus) {
          heroSpletnaStatus.textContent = data.cached
            ? "Prikazani so predpomnjeni predlogi North Data · 0 novega stroška."
            : "Prikazani so novejši predlogi North Data. OpenRegister kredit se porabi šele po izbiri in začetku preverbe.";
          heroSpletnaStatus.hidden = false;
        }
      } else {
        northDataUradnaRezervaPoizvedba = query;
        nastaviIskalniGumbZaUradnoRezervo(true);
        odpriAutocomplete(false);
        if (heroSpletnaStatus) {
          heroSpletnaStatus.textContent = "North Data ni našel podjetja. Ponovno pritisnite lupo za neposredno uradno iskanje · največ 1 kredit.";
          heroSpletnaStatus.hidden = false;
        }
      }
    } catch (error) {
      if (mojeZaporedje !== autocompleteZaporedje) return;
      northDataPrikazanaPoizvedba = query;
      northDataUradnaRezervaPoizvedba = query;
      nastaviIskalniGumbZaUradnoRezervo(true);
      if (heroSpletnaStatus) {
        heroSpletnaStatus.textContent = (error.message || "North Data trenutno ni dosegljiv.") + " Ponovno pritisnite lupo za neposredno uradno iskanje · največ 1 kredit.";
        heroSpletnaStatus.hidden = false;
      }
    } finally {
      if (iskalniGumb) iskalniGumb.disabled = false;
    }
  }

  function izberiAutocompletePodjetje(company) {
    odpriAutocomplete(false);
    var selected = normalizirajOpenRegisterPodjetje({}, company);
    var jePredlogImenika = selected.source === "offeneregister" ||
      selected.source === "northdata_names" && Boolean(selected.suggestionProof);
    if ((!selected.companyId && !selected.registerNumber && !jePredlogImenika) || !selected.name) {
      nastaviHeroNapako("Izbrani registrski zadetek nima dovolj podatkov.");
      return;
    }
    izbranoOpenRegisterPodjetje = selected;
    nacinVnosa = "register";
    izpolniRazbranoPolje("boniteta-ime", selected.name);
    izpolniRazbranoPolje("boniteta-register", [selected.registerType, selected.registerNumber].filter(Boolean).join(" "));
    nastaviHeroPodjetje(selected.name);
    if (vnosPodrobnosti) vnosPodrobnosti.hidden = true;
    pocistiHeroSporocilo();
  }

  window.UJBonitetaZacniIzbranoPodjetje = function () {
    // Mobilni WebView ne zagotavlja zanesljivega `requestSubmit()` niti
    // programskega klika skritega gumba. Oba vidna vhoda zato pokličeta isto
    // kanonično funkcijo, ki vsebuje validacijo, nalaganje in deduplikacijo.
    void izvediUniverzalnoIskanje();
    return true;
  };

  function ponastaviAutocompletePodjetje() {
    if (!izbranoOpenRegisterPodjetje) return;
    izbranoOpenRegisterPodjetje = null;
    autocompleteZaporedje += 1;
    nastaviHeroPodjetje("");
    if (heroSpletnaPolje) {
      heroSpletnaPolje.value = "";
      heroSpletnaPolje.disabled = false;
      heroSpletnaPolje.focus();
    }
    if (heroSpletnaStatus) heroSpletnaStatus.hidden = true;
    if (vnosPodrobnosti) vnosPodrobnosti.hidden = true;
    ["boniteta-ime", "boniteta-naslov-podjetja", "boniteta-posta", "boniteta-kraj", "boniteta-register", "boniteta-davcna", "boniteta-spletna-stran"].forEach(function (id) {
      izpolniRazbranoPolje(id, "");
    });
    nastaviBrezSpletne(false, true);
  }

  function urediAutocompletePodjetje() {
    if (!izbranoOpenRegisterPodjetje || !heroSpletnaPolje) return;
    var trenutnoIme = String(izbranoOpenRegisterPodjetje.name || heroPodjetjeIme && heroPodjetjeIme.textContent || "").trim();
    ponastaviAutocompletePodjetje();
    heroSpletnaPolje.value = trenutnoIme;
    heroSpletnaPolje.dispatchEvent(new Event("input", { bubbles: false }));
    heroSpletnaPolje.focus();
    heroSpletnaPolje.select();
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

  function nastaviRocniPopup(vklopljeno) {
    if (!vnosPodrobnosti) return;
    vnosPodrobnosti.classList.toggle("is-rocni-popup", Boolean(vklopljeno));
    vnosPodrobnosti.toggleAttribute("role", Boolean(vklopljeno));
    if (vklopljeno) vnosPodrobnosti.setAttribute("role", "dialog");
    vnosPodrobnosti.setAttribute("aria-modal", vklopljeno ? "true" : "false");
    document.body.classList.toggle("boniteta-rocni-popup-odprt", Boolean(vklopljeno));
    if (rocniModalZapri) rocniModalZapri.hidden = !vklopljeno;
    if (rocniModalOzadje) rocniModalOzadje.hidden = !vklopljeno;
  }

  function zapriRocniPopup() {
    if (!vnosPodrobnosti || !vnosPodrobnosti.classList.contains("is-rocni-popup")) return;
    nastaviRocniPopup(false);
    vnosPodrobnosti.hidden = true;
    if (nacinVnosa === "rocno" || nacinVnosa === "dokument") nacinVnosa = "";
    var rocniGumb = document.getElementById("boniteta-nacin-rocno");
    if (rocniGumb) rocniGumb.focus();
  }

  function nastaviNacinVnosa(nacin, brezPremika) {
    nacinVnosa = nacin;
    var rocniVnos = nacin === "rocno";
    var popupVnos = rocniVnos || nacin === "dokument";
    var rocniVnosBrezIdentitete = rocniVnos &&
      !String(document.getElementById("boniteta-ime").value || "").trim() &&
      !String(spletnaPolje.value || "").trim();
    vnosPodrobnosti.classList.toggle("is-rocni-popup-brez-identitete", rocniVnosBrezIdentitete);
    nastaviRocniPopup(popupVnos);
    document.querySelectorAll("[data-boniteta-rocni-podatek]").forEach(function (element) {
      element.hidden = false;
    });
    if (dodatniPreklop) {
      dodatniPreklop.hidden = !popupVnos;
      dodatniPreklop.setAttribute("aria-expanded", "false");
    }
    if (dodatniPodatki) dodatniPodatki.hidden = popupVnos;
    vnosPodrobnosti.hidden = false;
    document.getElementById("boniteta-vnos-oznaka").textContent = nacin === "dokument" ? "POTRDITEV RAZBRANIH PODATKOV" : "ROČNI VNOS";
    document.getElementById("boniteta-vnos-naslov").textContent = nacin === "dokument" ? "Preverite razbrane podatke" : "Koga želite preveriti?";
    document.getElementById("boniteta-vnos-opis").textContent = nacin === "dokument"
        ? "Preverite, da vsi podatki pripadajo izbrani stranki, in jih po potrebi popravite."
        : rocniVnos
          ? "Vnesite ime in naslov. Ostale podatke poiščemo sami."
          : potrjenoBrezSpletne
            ? "Vnesite ime in celoten naslov. Podatke bomo shranili kot ročni vnos, vendar jih ne bomo prikazali kot preverjeno identiteto."
            : "Vnesite ime in celoten naslov; spletna stran je priporočljiva, ni pa obvezna.";
    document.getElementById("boniteta-vnos-namig").textContent = "Preverite, da ime in celoten naslov pripadata isti izbrani stranki.";
    gumb.querySelector("span").textContent = rocniVnos ? "Preveri stranko" : "Preveri podatke";
    if (window.UJPrilagodiVelikostBesedila) {
      vnosPodrobnosti.querySelectorAll("[data-fit-text]").forEach(window.UJPrilagodiVelikostBesedila);
    }
    if (!brezPremika) {
      window.requestAnimationFrame(function () {
        document.getElementById("boniteta-ime").focus();
        if (!popupVnos) vnosPodrobnosti.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    izbiraStranke.hidden = true;
    nastaviNacinVnosa("dokument");
    if (/^\d{5}$/.test(document.getElementById("boniteta-posta").value)) {
      void dolociKrajIzPoste(document.getElementById("boniteta-posta").value);
    }
  }

  function izrisiRazbraneStranke(stranke) {
    izbiraStrankeSeznam.innerHTML = "";
    if (stranke.length === 1) {
      izbiraStranke.hidden = true;
      izberiRazbranoStranko(stranke[0], null);
      return false;
    }
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
    return true;
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
      var zahtevaIzbiroStranke = izrisiRazbraneStranke(telo.stranke);
      nastaviZajemKartico(datoteka, "uspeh");
      nastaviZajemStatus(zahtevaIzbiroStranke
        ? "Dokument je prebran. Izberite stranko za preverjanje."
        : "Dokument je prebran. Preverite razbrane podatke.", "uspeh");
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
      if (krajPredlogi) krajPredlogi.hidden = true;
      kraji.forEach(function (kraj) {
        var moznost = document.createElement("option");
        moznost.value = kraj;
        krajiSeznam.appendChild(moznost);
      });
      if (!kraji.length) {
        if (krajPredlogi) krajPredlogi.hidden = false;
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
            krajStatus.textContent = "Izberite kraj";
          });
          krajiIzbira.appendChild(gumbKraja);
        });
        krajiIzbira.hidden = false;
        if (krajPredlogi) krajPredlogi.hidden = false;
        krajStatus.textContent = "Izberite kraj";
      } else {
        krajStatus.textContent = "";
        if (krajPredlogi) krajPredlogi.hidden = true;
      }
    } catch (_) {
      if (mojaPoizvedba !== zaporedjePostnePoizvedbe || postaPolje.value.replace(/\D/g, "") !== posta) return;
      if (krajPredlogi) krajPredlogi.hidden = false;
      krajStatus.textContent = "Kraja ni bilo mogoče določiti – vnesite ga ročno.";
    }
  }

  function jeLokalniPredogled() {
    try {
      return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname) &&
        new URLSearchParams(window.location.search).get("app-preview") === "1";
    } catch (_) {
      return false;
    }
  }

  function glaveCakalneVrste(token, json) {
    var glave = { Authorization: "Bearer " + token };
    if (json) glave["Content-Type"] = "application/json";
    if (jeLokalniPredogled()) glave["X-UJ-Local-Preview"] = "1";
    return glave;
  }

  async function pridobiToken(prisilnoOsvezi, zahtevajPravoPrijavo) {
    if (jeLokalniPredogled() && !zahtevajPravoPrijavo) return "local-preview";
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
    if (podatki && podatki.__shranjeniProfil) return;
    if (podatki.confirmationRequired || !identiteta.ime || !["verified_register", "confirmed_impressum"].includes(identiteta.status)) return;
    if (!imaUradniInsolvencniPosnetek(podatki) || !["clear", "possible_match"].includes(podatki.insolvency && podatki.insolvency.status)) return;
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
              result: podatki.result || {}, insolvency: podatki.insolvency || {},
              identityStatus: identiteta.status,
              entityType: identiteta.entityType || "",
              identityName: identiteta.ime || "",
              businessName: identiteta.naziv || "",
              queueJobId: zadnjiJobId,
              sources: podatki.sources || [],
              northData: podatki.northData || null,
              northDataDetails: podatki.northDataDetails || null,
            },
          },
        }),
      });
      var shranjeno = await odgovor.json().catch(function () { return {}; });
      if (mojaGeneracija === generacijaRezultata && odgovor.ok && shranjeno.profile && shranjeno.profile.id) {
        zadnjiProfilId = shranjeno.profile.id;
        try {
          var sejaZaDokaz = await supabaseKlient.auth.getSession();
          var uporabnikZaDokaz = sejaZaDokaz && sejaZaDokaz.data && sejaZaDokaz.data.session && sejaZaDokaz.data.session.user;
          if (uporabnikZaDokaz && window.UJBonitetaDokaznaHramba) {
            await window.UJBonitetaDokaznaHramba.shrani(uporabnikZaDokaz.id, shranjeno.profile.id, podatki.insolvency);
          }
        } catch (_) {
          // Oddaljeno opravilo ostane glavni vir; lokalna hramba je varna trajna rezerva.
        }
        var profilUrl = new URL(window.location.href);
        profilUrl.searchParams.set("profile", shranjeno.profile.id);
        profilUrl.searchParams.delete("job");
        profilUrl.searchParams.delete("northdataRun");
        profilUrl.hash = "new";
        window.history.replaceState(window.history.state || {}, "", profilUrl.pathname + profilUrl.search + profilUrl.hash);
        if (profilPovezava) {
          profilPovezava.dataset.profileId = shranjeno.profile.id;
          profilPovezava.hidden = true;
        }
        window.dispatchEvent(new CustomEvent("uj:boniteta:comparison-profile-saved", { detail: { profileId: shranjeno.profile.id, name: identiteta.naziv || identiteta.ime || "" } }));
        var shranjeniNorthData = shranjeno.profile.latest_check && shranjeno.profile.latest_check.northData;
        var shranjeneNorthDataPodrobnosti = shranjeno.profile.latest_check && shranjeno.profile.latest_check.northDataDetails;
        if (shranjeniNorthData && shranjeniNorthData.status === "found") {
          var prejsnjiPogled = izbraniPodjetjePogled;
          podatki.northData = shranjeniNorthData;
          podatki.northDataDetails = shranjeneNorthDataPodrobnosti || podatki.northDataDetails || null;
          zadnjiRegistrskiPodatki = podatki;
          izrisiRegistrskoPodjetje(podatki, identiteta);
          nastaviPodjetjePogled(prejsnjiPogled === "kljucni" ? "kljucni" : prejsnjiPogled);
        }
        if (razsiritveSklop) {
          razsiritveSklop.hidden = true;
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
    var opis;
    if (job.cached) {
      opis = "Uporabljen je svež rezultat iste preverbe – ponoven obisk virov ni potreben.";
    } else if (job.reused) {
      opis = "Isto preverjanje že poteka – prikazujemo njegovo trenutno stanje brez nove poizvedbe.";
    } else if (job.status === "processing") {
      opis = "Preverjanje uradnih virov poteka" +
        (job.attempts > 1 ? " (ponovni poskus " + job.attempts + "/" + job.maxAttempts + ")" : "") + ".";
    } else if (job.status === "queued") {
      opis = job.position > 1
        ? "Preverjanje varno čaka v vrsti. Pred vami je še " + (job.position - 1) + " zahtev."
        : "Preverjanje je naslednje v čakalni vrsti.";
    } else {
      opis = "Preverjanje je zaključeno.";
    }
    vrstaStatus.textContent = opis;
    if (nacinVnosa === "spletna" && heroSpletnaStatus) {
      heroSpletnaStatus.textContent = opis;
      heroSpletnaStatus.hidden = false;
    }
  }

  function odpriPodrobnostiProfila(profileId, section) {
    if (!profileId || !window.UJBonitetaOdpriProfil) return;
    window.UJBonitetaOdpriProfil(profileId, section || "overview");
  }

  if (profilPovezava) profilPovezava.addEventListener("click", function () {
    odpriPodrobnostiProfila(profilPovezava.dataset.profileId || zadnjiProfilId, "overview");
  });

  if (razsiritveSklop) razsiritveSklop.querySelectorAll("[data-boniteta-razsiritev]").forEach(function (povezava) {
    povezava.addEventListener("click", function (dogodek) {
      dogodek.preventDefault();
      odpriPodrobnostiProfila(povezava.dataset.profileId || zadnjiProfilId, povezava.dataset.bonitetaRazsiritev);
    });
  });

  async function pocakajNaOpravilo(job, token) {
    if (!job || !job.id) throw new Error("Čakalna vrsta ni vrnila veljavnega preverjanja.");
    zadnjiJobId = job.id;
    opisiStanjeOpravila(job);
    if (job.status === "completed" && job.result) return job.result;

    var konec = Date.now() + 55 * 1000;
    var zacetekCakanja = Date.now();
    var naslednjePrebujanje = 0;
    var zakljucekPrebujenegaDelavca = null;
    while (Date.now() < konec) {
      // Vsak odprt uporabnik lahko varno prebudi enega delavca. Baza tudi pri
      // 100 sočasnih klicih globalno dovoli 30 opravil, od tega največ 10
      // insolvenčnih poizvedb na uradni portal.
      if (Date.now() >= naslednjePrebujanje) {
        naslednjePrebujanje = Date.now() + 15000;
        // Delavec lahko zaradi zunanjega vira dela do ene minute. Njegovega
        // HTTP odgovora ne čakamo, saj moramo medtem uporabniku prikazovati
        // sveže stanje trajno shranjenega opravila.
        zakljucekPrebujenegaDelavca = fetch("/api/mehka-boniteta-delavec", {
          method: "POST",
          headers: glaveCakalneVrste(token, true),
          body: "{}",
          signal: omejitevKlica(65000),
        }).then(function () {
          return true;
        }).catch(function () {
          // Opravilo je trajno shranjeno; naslednja statusna poizvedba pokaže,
          // ali ga je medtem prevzel drug delavec.
          return true;
        });
      }

      var odgovor = await fetchSPonovnimPoskusom("/api/mehka-boniteta-opravilo?id=" + encodeURIComponent(job.id), {
        headers: glaveCakalneVrste(token, false),
        signal: omejitevKlica(15000),
      });
      var podatki = null;
      try { podatki = await odgovor.json(); } catch (_) {}
      if (!odgovor.ok) throw new Error((podatki && podatki.napaka) || "Stanja preverjanja ni bilo mogoče prebrati.");
      job = podatki && podatki.job;
      opisiStanjeOpravila(job);
      if (job.status === "completed" && job.result) return job.result;
      if (job.status === "failed") {
        throw new Error(job.error || "Preverjanje ni uspelo niti po treh poskusih.");
      }
      var preteklo = Date.now() - zacetekCakanja;
      // Prvih nekaj sekund preverjamo odzivneje. Pozneje interval podaljšamo,
      // da dolgotrajna zunanja preverba ne obremenjuje baze po nepotrebnem.
      var zamik = preteklo < 3000
        ? (job.status === "processing" ? 300 : 400)
        : preteklo < 10000
          ? (job.status === "processing" ? 500 : 650)
          : (job.status === "processing" ? 850 : 1200);
      if (zakljucekPrebujenegaDelavca) {
        // Če je delavec, ki smo ga pravkar prebudili, že končal, ne čakamo
        // slepo do naslednjega intervala, temveč rezultat preberemo takoj.
        var delavecJeKoncal = await Promise.race([
          zakljucekPrebujenegaDelavca,
          pocakaj(zamik).then(function () { return false; }),
        ]);
        if (delavecJeKoncal) zakljucekPrebujenegaDelavca = null;
      } else {
        await pocakaj(zamik);
      }
    }
    throw new Error("Preverjanje se nadaljuje v ozadju. Poskusite ponovno čez nekaj trenutkov; sistem bo uporabil isto opravilo in ne bo ponovil poizvedbe.");
  }

  async function izvediPrekoCakalneVrste(telo, token) {
    var ustvarjeno = null;
    var ustvarjeniPodatki = null;
    for (var authPoskus = 0; authPoskus < 3; authPoskus += 1) {
      ustvarjeno = await fetchSPonovnimPoskusom("/api/mehka-boniteta-opravilo", {
        method: "POST",
        headers: glaveCakalneVrste(token, true),
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

  function vnosZaPonovnoPreverboProfila(profile) {
    var latest = profile && profile.latest_check || {};
    var identity = latest.identity && typeof latest.identity === "object" ? latest.identity : {};
    var address = profile && profile.address || {};
    var contact = profile && profile.contact || {};
    var identityStatus = latest.identityStatus || latest.identity_status || identity.status || "";
    var companyId = String(profile && profile.company_id || identity.companyId || identity.company_id || "").trim();
    var legalName = String(profile && profile.legal_name || identity.naziv || identity.ime || "").trim();
    var street = String(address.street || address.address || "").trim();
    var postalCode = String(address.postal_code || address.postalCode || "").replace(/\D/g, "");
    var city = String(address.city || "").trim();
    var website = String(contact.website || contact.url || "").trim();
    var registerNumber = String(profile && profile.register_number || identity.registerNumber || "").trim();
    var registerCourt = String(profile && profile.register_court || identity.registerCourt || "").trim();
    var verifiedRegister = Boolean(companyId) && (identityStatus === "verified_register" || Boolean(registerNumber && registerCourt));
    var confirmedImpressum = identityStatus === "confirmed_impressum" && Boolean(website);
    if ((!verifiedRegister && !confirmedImpressum) || !legalName || street.length < 3 || !/^\d{5}$/.test(postalCode) || city.length < 2) {
      throw new Error("Za neposredno novo preverbo mora imeti profil preverjeno identiteto in popoln naslov.");
    }
    return {
      ime: legalName,
      naslov: street,
      postnaStevilka: postalCode,
      kraj: city,
      spletnaStran: website,
      registerNumber: companyId ? registerNumber : "",
      registerCourt: companyId ? registerCourt : "",
      openRegisterCompanyId: companyId,
      uporabiOpenRegisterIdentiteto: true,
      recheckMode: "saved_profile",
      confirmedIdentity: {
        name: latest.identityName || identity.ime || legalName,
        businessName: latest.businessName || identity.naziv || legalName,
        street: street,
        postalCode: postalCode,
        city: city,
        companyId: companyId,
        confirmed: true,
      },
    };
  }

  window.UJBonitetaPonovnoPreveriProfil = async function (profile) {
    if (preverjanjeVTehniku) throw new Error("Preverjanje že poteka.");
    preverjanjeVTehniku = true;
    pocistiNapako();
    try {
      var token = await pridobiToken();
      zadnjiVnos = vnosZaPonovnoPreverboProfila(profile);
      zadnjaOpenRegisterReferenca = zadnjiVnos.openRegisterCompanyId || "";
      var podatki = await izvediPrekoCakalneVrste(zadnjiVnos, token);
      izrisi(podatki);
      return podatki;
    } finally {
      preverjanjeVTehniku = false;
    }
  };

  async function nadaljujOpravilo(jobId) {
    var samoSpletniVnos = nacinVnosa === "spletna";
    var spletnaNapaka = false;
    nastaviNalaganje(true);
    if (samoSpletniVnos && heroSpletnaStatus) {
      heroSpletnaStatus.textContent = "Iščemo podjetje in posodabljamo podatke obrtnika …";
      heroSpletnaStatus.hidden = false;
    }
    try {
      var token = await pridobiToken();
      var odgovor = await fetchSPonovnimPoskusom("/api/mehka-boniteta-opravilo?id=" + encodeURIComponent(jobId), {
        headers: glaveCakalneVrste(token, false),
        signal: omejitevKlica(15000),
      });
      var podatki = null;
      try { podatki = await odgovor.json(); } catch (_) {}
      if (!odgovor.ok || !podatki || !podatki.job) throw new Error((podatki && podatki.napaka) || "Preverjanja ni bilo mogoče odpreti.");
      zadnjiVnos = podatki.job.request || {};
      nacinVnosa = zadnjiVnos.spletnaStran ? "spletna" : zadnjiVnos.openRegisterCompanyId || zadnjiVnos.companyIndexSource === "offeneregister" ? "register" : "rocno";
      izpolniRazbranoPolje("boniteta-ime", zadnjiVnos.ime);
      izpolniRazbranoPolje("boniteta-naslov-podjetja", zadnjiVnos.naslov);
      izpolniRazbranoPolje("boniteta-posta", zadnjiVnos.postnaStevilka);
      izpolniRazbranoPolje("boniteta-kraj", zadnjiVnos.kraj);
      izpolniRazbranoPolje("boniteta-register", zadnjiVnos.registerNumber);
      izpolniRazbranoPolje("boniteta-davcna", zadnjiVnos.vatId);
      izpolniRazbranoPolje("boniteta-spletna-stran", zadnjiVnos.spletnaStran);
      if (heroSpletnaPolje) heroSpletnaPolje.value = zadnjiVnos.spletnaStran || "";
      samoSpletniVnos = nacinVnosa === "spletna";
      if (nacinVnosa === "register") {
        izbranoOpenRegisterPodjetje = {
          companyId: zadnjiVnos.openRegisterCompanyId,
          name: zadnjiVnos.ime,
          registerType: String(zadnjiVnos.registerNumber || "").split(/\s+/)[0] || "",
          registerNumber: String(zadnjiVnos.registerNumber || "").replace(/^\S+\s+/, ""),
          registerCourt: zadnjiVnos.registerCourt || "",
          source: zadnjiVnos.companyIndexSource || "",
        };
        nastaviHeroPodjetje(zadnjiVnos.ime);
        vnosPodrobnosti.hidden = true;
      } else if (samoSpletniVnos) vnosPodrobnosti.hidden = true;
      else nastaviNacinVnosa(nacinVnosa, true);
      var rezultatOpravila = await pocakajNaOpravilo(podatki.job, token);
      izrisi(rezultatOpravila);
    } catch (err) {
      potek.hidden = true;
      spletnaNapaka = samoSpletniVnos;
      if (spletnaNapaka) pokaziSpletnoNapako(err.message || "Preverjanja ni bilo mogoče nadaljevati.");
      else pokaziNapako(err.message || "Preverjanja ni bilo mogoče nadaljevati.");
    } finally {
      nastaviNalaganje(false);
      if (samoSpletniVnos && heroSpletnaStatus && !spletnaNapaka) heroSpletnaStatus.hidden = true;
    }
  }

  function ustaviHeroNalaganje() {
    if (heroNalaganjeCasovnik) window.clearTimeout(heroNalaganjeCasovnik);
    heroNalaganjeCasovnik = 0;
    heroNalaganjeKorak = 0;
  }

  function prikaziHeroNalaganjeKorak() {
    if (!heroPreveriGumb || !heroPreveriGumb.classList.contains("is-loading")) return;
    if (heroNalaganjeKorak >= HERO_NALAGANJE_BESEDILA.length) return;
    var oznaka = heroPreveriGumb.querySelector("[data-boniteta-loading-text]");
    if (!oznaka) return;
    oznaka.textContent = HERO_NALAGANJE_BESEDILA[heroNalaganjeKorak];
    oznaka.classList.remove("is-changing");
    void oznaka.offsetWidth;
    oznaka.classList.add("is-changing");
    if (window.UJPrilagodiVelikostBesedila) window.UJPrilagodiVelikostBesedila(oznaka);
    heroNalaganjeKorak += 1;
    if (heroNalaganjeKorak < HERO_NALAGANJE_BESEDILA.length) {
      heroNalaganjeCasovnik = window.setTimeout(prikaziHeroNalaganjeKorak, 1500);
    }
  }

  function zacniHeroNalaganje() {
    ustaviHeroNalaganje();
    prikaziHeroNalaganjeKorak();
  }

  function nastaviNalaganje(vklopljeno) {
    var spletnoIskanje = nacinVnosa === "spletna";
    var registrskoIskanje = nacinVnosa === "register";
    gumb.disabled = vklopljeno;
    if (spletnoIskanje && heroSpletnaPolje) heroSpletnaPolje.disabled = vklopljeno;
    if (heroPreveriGumb) {
      heroPreveriGumb.disabled = vklopljeno;
      heroPreveriGumb.setAttribute("aria-busy", String(vklopljeno));
      heroPreveriGumb.classList.toggle("is-loading", vklopljeno);
      heroPreveriGumb.innerHTML = vklopljeno
        ? '<span class="crif-flow-picker__start-copy"><i class="boniteta-gumb__spinner" aria-hidden="true"></i><span class="crif-flow-picker__start-status" data-boniteta-loading-text data-fit-text data-fit-text-min="10">Preverjam podjetje …</span></span><b class="crif-flow-picker__start-progress" aria-hidden="true"><i></i><i></i><i></i></b>'
        : privzetiHeroPreveriGumb;
      if (vklopljeno) zacniHeroNalaganje();
      else ustaviHeroNalaganje();
    }
    if (vklopljeno) {
      /* Med nalaganjem ostanemo v trenutnem koraku. Celozaslonski prikaz
         »Rezultat preverbe« je rezerviran samo za dejansko pripravljen rezultat. */
      nastaviRezultatKotOkno(false);
      gumb.classList.add("is-loading");
      gumb.innerHTML = '<span class="boniteta-gumb__spinner" aria-hidden="true"></span><span>Preverjam uradne vire …</span>';
      potek.hidden = true;
      rezultat.hidden = true;
      if (vrstaStatus) vrstaStatus.textContent = "Preverjanje dodajam v varno čakalno vrsto …";
      if ((spletnoIskanje || registrskoIskanje) && heroSpletnaStatus) {
        heroSpletnaStatus.classList.remove("is-error");
        heroSpletnaStatus.textContent = "Iščemo podjetje in preverjamo uradne vire …";
        heroSpletnaStatus.hidden = false;
      }
    } else {
      gumb.classList.remove("is-loading");
      gumb.innerHTML = privzetiGumb;
      var oznakaGumba = gumb.querySelector("span");
      if (oznakaGumba) oznakaGumba.textContent = nacinVnosa === "spletna" ? "Poišči Impressum" : "Preveri podatke";
    }
  }

  window.UJBonitetaPonastaviNeveljavenProfil = function (sporocilo) {
    generacijaRezultata += 1;
    preverjanjeVTehniku = false;
    zadnjiProfilId = "";
    izbranoOpenRegisterPodjetje = null;
    nastaviNalaganje(false);
    nastaviRezultatKotOkno(false);
    nastaviInsolvencnoOkno(false, false);
    document.body.classList.remove("boniteta-register-result");
    if (rezultat) rezultat.hidden = true;
    if (inlineProfil) inlineProfil.hidden = true;
    nastaviHeroPodjetje("");
    if (heroSpletnaPolje) {
      heroSpletnaPolje.value = "";
      heroSpletnaPolje.disabled = false;
      heroSpletnaPolje.removeAttribute("aria-invalid");
      posodobiHeroPocisti();
    }
    if (heroSpletnaStatus) {
      heroSpletnaStatus.classList.add("is-error");
      heroSpletnaStatus.textContent = sporocilo || "Ta profil ne obstaja več. Začnite novo preverbo.";
      heroSpletnaStatus.hidden = false;
    }
  };

  function dodajPodatek(dl, oznaka, vrednost, barva) {
    if (!vrednost) return;
    if (!barva) {
      dl.insertAdjacentHTML("beforeend", "<dt>" + esc(oznaka) + "</dt><dd data-fit-text data-fit-text-min=\"8\">" + esc(vrednost) + "</dd>");
      return;
    }
    var dovoljeneBarve = ["blue", "green", "violet", "amber", "neutral"];
    var ton = dovoljeneBarve.includes(barva) ? barva : "neutral";
    var jeDolgInsolvencniPodatek = dl && dl.id === "boniteta-insolvenca-podatki" && String(vrednost).length > 54;
    dl.insertAdjacentHTML("beforeend", '<div class="boniteta-podatek boniteta-podatek--' + ton + (jeDolgInsolvencniPodatek ? ' boniteta-podatek--wide' : '') + '">' +
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

  function formatirajDenar(vrednost, brezCentov) {
    if (!Number.isFinite(Number(vrednost))) return "—";
    return new Intl.NumberFormat("sl-SI", {
      style: "currency", currency: "EUR",
      minimumFractionDigits: brezCentov ? 0 : 2,
      maximumFractionDigits: brezCentov ? 0 : 2,
    }).format(Number(vrednost));
  }

  function normalizirajMetriko(vrednost) {
    return String(vrednost || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9čšžäöüß]+/g, " ").trim();
  }

  function jeFinancnaMetrika(vrednost, vrsta) {
    var oznaka = normalizirajMetriko(vrednost);
    return vrsta === "assets"
      ? /total assets|balance sheet total|bilanzsumme|bilan[cč]na vsota|summe aktiva|assets total/.test(oznaka)
      : /earnings|net income|net profit|annual result|profit loss|jahresuberschuss|jahresergebnis|bilanzgewinn|poslovni rezultat|cisti dobicek/.test(oznaka);
  }

  function financnaVrednost(vrednost) {
    var stevilka = Number(vrednost && typeof vrednost === "object" ? vrednost.value : vrednost);
    return Number.isFinite(stevilka) ? stevilka : null;
  }

  function financnoLeto(vrednost) {
    var neposredno = Number(vrednost && typeof vrednost === "object" ? vrednost.year : "");
    if (Number.isFinite(neposredno) && neposredno > 1900) return neposredno;
    var datum = String(vrednost && typeof vrednost === "object" ? vrednost.date || vrednost.publicationDate || "" : "");
    var zadetek = datum.match(/\b(19|20)\d{2}\b/);
    return zadetek ? Number(zadetek[0]) : null;
  }

  function financnaSerija(company, vrsta) {
    var rezultat = [];
    function dodaj(vnos) {
      var leto = financnoLeto(vnos), vrednost = financnaVrednost(vnos);
      if (!leto || vrednost === null) return;
      var obstojeca = rezultat.find(function (postavka) { return postavka.year === leto; });
      if (obstojeca) obstojeca.value = vrednost;
      else rezultat.push({ year: leto, value: vrednost });
    }
    (company && Array.isArray(company.financials) ? company.financials : []).forEach(function (metrika) {
      if (!jeFinancnaMetrika(metrika && (metrika.metric || metrika.name || metrika.label), vrsta)) return;
      (Array.isArray(metrika.values) ? metrika.values : []).forEach(dodaj);
    });
    var neposredna = company && company[vrsta === "assets" ? "totalAssets" : "earnings"];
    if (Array.isArray(neposredna)) neposredna.forEach(dodaj);
    if (vrsta === "assets") (company && Array.isArray(company.balanceSheets) ? company.balanceSheets : []).forEach(function (izkaz) {
      var leto = financnoLeto(izkaz);
      var vrstica = (Array.isArray(izkaz.lines) ? izkaz.lines : []).find(function (postavka) {
        return jeFinancnaMetrika(postavka && postavka.name, "assets");
      });
      if (leto && vrstica) dodaj({ year: leto, value: vrstica.value });
    });
    return rezultat.sort(function (a, b) { return a.year - b.year; });
  }

  function odstotekSpremembe(prejsnja, trenutna) {
    if (!prejsnja || !Number.isFinite(prejsnja.value) || !Number.isFinite(trenutna.value)) return null;
    if (prejsnja.value === 0) return trenutna.value === 0 ? 0 : null;
    return (trenutna.value - prejsnja.value) / Math.abs(prejsnja.value) * 100;
  }

  function lepKorakMerila(najvec) {
    if (!najvec) return 1;
    var grob = najvec / 3;
    var potenca = Math.pow(10, Math.floor(Math.log10(grob)));
    var kolicnik = grob / potenca;
    var lep = kolicnik <= 1 ? 1 : kolicnik <= 2.5 ? 2.5 : kolicnik <= 5 ? 5 : 10;
    return lep * potenca;
  }

  function kratkoMerilo(vrednost) {
    var abs = Math.abs(vrednost);
    var zapis = abs >= 1000000 ? (abs / 1000000).toLocaleString("sl-SI", { maximumFractionDigits: 1 }) + " mio"
      : abs >= 1000 ? (abs / 1000).toLocaleString("sl-SI", { maximumFractionDigits: 1 }) + "k"
        : abs.toLocaleString("sl-SI", { maximumFractionDigits: 0 });
    return (vrednost < 0 ? "−" : "") + zapis + " €";
  }

  function financniGrafHtml(serija, oznaka) {
    if (!serija.length) return '<p class="boniteta-podjetje-prazno">Za ta kazalnik ni zabeležene časovnice.</p>';
    var najvec = Math.max.apply(Math, serija.map(function (v) { return Math.abs(v.value); })) || 1;
    var korak = lepKorakMerila(najvec * 1.08);
    var maksimum = Math.ceil(najvec / korak) * korak;
    var imaMinus = serija.some(function (v) { return v.value < 0; });
    var os = [maksimum, maksimum / 2, 0].concat(imaMinus ? [-maksimum / 2] : []);
    var stolpci = serija.map(function (vnos, indeks) {
      var sprememba = indeks ? odstotekSpremembe(serija[indeks - 1], vnos) : null;
      var visina = Math.max(vnos.value === 0 ? 3 : 8, Math.round(Math.abs(vnos.value) / maksimum * (vnos.value < 0 ? 60 : 128)));
      var razred = vnos.value < 0 ? " is-negative" : "";
      var mehurcek = sprememba === null ? "" : '<span class="boniteta-finance__odstotek' + (sprememba < 0 ? ' is-negative' : '') + '">' + (sprememba > 0 ? "+" : sprememba < 0 ? "−" : "") + Math.abs(sprememba).toLocaleString("sl-SI", { maximumFractionDigits: 0 }) + '%</span>';
      var steviloSegmentov = Math.max(1, Math.min(10, Math.round(visina / 12)));
      var segmenti = Array.from({ length: steviloSegmentov }, function (_, indeksSegmenta) {
        var tonSegmenta = steviloSegmentov === 1 ? 3 : Math.round(indeksSegmenta / (steviloSegmentov - 1) * 3);
        return '<i data-segment-tone="' + tonSegmenta + '"></i>';
      }).join("");
      return '<div class="boniteta-finance__leto' + razred + '" style="--bar-size:' + visina + 'px;--segment-count:' + steviloSegmentov + '">' + mehurcek +
        '<div class="boniteta-finance__stolpec" aria-hidden="true">' + segmenti + '</div>' +
        '<small>' + vnos.year + '</small><strong data-fit-text data-fit-text-min="10">' + esc(formatirajDenar(vnos.value, true)) + '</strong></div>';
    }).join("");
    return '<div class="boniteta-finance__graf" role="img" aria-label="' + esc(oznaka) + ' po letih">' +
      '<div class="boniteta-finance__merilo">' + os.map(function (v) { return '<span>' + esc(kratkoMerilo(v)) + '</span>'; }).join("") + '</div>' +
      '<div class="boniteta-finance__drsnik"><div class="boniteta-finance__leta">' + stolpci + '</div></div></div>';
  }

  function northDataPodrobnosti(podatki) {
    var details = podatki && podatki.northDataDetails;
    return details && details.status === "found" && details.company ? details.company : null;
  }

  function zadnjaDopolnilnaBilanca(company) {
    return (company && Array.isArray(company.financials) ? company.financials : []).filter(function (entry) {
      return entry && Number.isFinite(Number(entry.fiscalYear)) && entry.items && typeof entry.items === "object";
    }).sort(function (a, b) { return Number(b.fiscalYear) - Number(a.fiscalYear); })[0] || null;
  }

  function kratkiUvidHtml(naslov, kratko) {
    return '<section class="boniteta-kratki-uvid" data-kratki-uvid>' +
      '<div class="boniteta-kratki-uvid__besedilo"><span>NA KRATKO</span><strong>' + esc(naslov) + '</strong>' +
      '<p>' + esc(kratko) + '</p></div></section>';
  }

  function dopolnilniVpogledHtml(company) {
    var bilanca = zadnjaDopolnilnaBilanca(company);
    if (!bilanca) return "";
    var items = bilanca.items || {};
    function vrednost(key, oznaka, oblika) {
      var item = items[key];
      if (!item || !Number.isFinite(Number(item.value))) return "";
      var zapis = oblika === "percent" ? Number(item.value).toLocaleString("sl-SI", { maximumFractionDigits: 1 }) + " %"
        : oblika === "count" ? "pribl. " + Number(item.value).toLocaleString("sl-SI", { maximumFractionDigits: 0 })
          : formatirajDenar(Number(item.value), true);
      return '<article class="boniteta-finance-detail' + (item.estimate ? ' is-estimate' : '') + '"><span>' + esc(oznaka) + '</span><strong data-fit-text data-fit-text-min="10">' + esc(zapis) + '</strong><small>' + (item.estimate ? 'Ocena vira' : 'Objavljeno') + '</small></article>';
    }
    var kartice = [
      vrednost("Cash", "Denarna sredstva"), vrednost("Receivables", "Terjatve"),
      vrednost("Liabilities", "Obveznosti"), vrednost("Equity", "Lastniški kapital"),
      vrednost("EquityRatio", "Delež kapitala", "percent"), vrednost("ROE", "Donos na kapital", "percent"),
    ].filter(Boolean).join("");
    var zaposleni = vrednost("Employees", "Zaposleni", "count");
    var pokritost = items.Cash && items.Liabilities && Number(items.Liabilities.value) > 0
      ? Number(items.Cash.value) / Number(items.Liabilities.value) : null;
    var razmerje = Number.isFinite(pokritost) ? '<div class="boniteta-finance-detail__razmerje"><span>Denar glede na obveznosti</span><strong>' + esc(pokritost.toLocaleString("sl-SI", { maximumFractionDigits: 1 }) + '×') + '</strong><small>Izračun iz objavljenih postavk; ni jamstvo plačilne sposobnosti.</small></div>' : '';
    var vir = [bilanca.sourceTitle, bilanca.sourceDate ? "objavljeno " + formatirajDatumPodjetja(String(bilanca.sourceDate).slice(0, 10)) : ""].filter(Boolean).join(" · ");
    return '<section class="boniteta-finance-details"><div class="boniteta-finance-details__glava"><div><span>Dopolnilni vpogled</span><h5>Stanje na dan 31. 12. ' + esc(bilanca.fiscalYear) + '</h5></div><b>North Data</b></div>' +
      (zaposleni ? '<div class="boniteta-finance-details__zaposleni">' + zaposleni + '<p>Število zaposlenih je približna ocena vira in ni uradno objavljena bilančna postavka.</p></div>' : '') +
      (kartice ? '<div class="boniteta-finance-details__mreza">' + kartice + '</div>' : '') + razmerje +
      (vir ? '<p class="boniteta-finance-details__vir">Vir postavk: ' + esc(vir) + '</p>' : '') + '</section>';
  }

  function izrisiFinance(company, vrsta) {
    var rezultat = financnaSerija(company, "earnings");
    var sredstva = financnaSerija(company, "assets");
    var zahtevana = vrsta === "assets" || vrsta === "earnings" ? vrsta : "";
    var izbrana = zahtevana === "earnings" && rezultat.length ? "earnings"
      : zahtevana === "assets" && sredstva.length ? "assets"
        : rezultat.length ? "earnings" : sredstva.length ? "assets" : "earnings";
    var serija = izbrana === "assets" ? sredstva : rezultat;
    var zadnjiVnos = serija[serija.length - 1];
    var financniScenarij = scenarijIzstopa(serija, izbrana);
    var financnaOznaka = izbrana === "assets" ? "Bilančna vsota" : "Poslovni rezultat";
    var financniNaslov = financniScenarij ? financniScenarij.status : financnaOznaka + " je objavljen za leto " + zadnjiVnos.year + ".";
    var financnoKratko = "Zadnja objavljena vrednost: " + formatirajDenar(zadnjiVnos.value, true) + " (" + zadnjiVnos.year + ").";
    var financnoPodrobno = financniScenarij
      ? financnaOznaka + " se je med letoma " + financniScenarij.prejsnja.year + " in " + financniScenarij.zadnja.year + " spremenil iz " + formatirajDenar(financniScenarij.prejsnja.value, true) + " na " + formatirajDenar(financniScenarij.zadnja.value, true) + "."
      : "Za primerjavo trenda je trenutno objavljeno samo eno leto podatkov.";
    function financeGumb(vrednost, oznaka, naVoljo) {
      return '<button type="button" data-finance-vrsta="' + vrednost + '" role="tab" aria-selected="' + (izbrana === vrednost) + '"' +
        (naVoljo ? '' : ' disabled aria-disabled="true" title="Ta časovnica ni objavljena"') + '><span>' + oznaka + '</span>' +
        (naVoljo ? '' : '<small>Ni na voljo</small>') + '</button>';
    }
    var omejitev = sredstva.length && !rezultat.length
      ? '<p class="boniteta-finance__dosegljivost"><span aria-hidden="true">i</span>Objavljena je bilančna vsota; časovnica poslovnega rezultata ni na voljo.</p>'
      : rezultat.length && !sredstva.length
        ? '<p class="boniteta-finance__dosegljivost"><span aria-hidden="true">i</span>Objavljen je poslovni rezultat; časovnica bilančne vsote ni na voljo.</p>'
        : '';
    var opozoriloVarovalke = izbrana === "assets" && company && company.financialGuard && Array.isArray(company.financialGuard.issues) && company.financialGuard.issues.length
      ? '<p class="boniteta-finance__dosegljivost"><span aria-hidden="true">!</span>Ena ali več bilančnih vrednosti ni prikazanih zaradi neskladja med finančnimi postavkami vira.</p>'
      : '';
    podjetjePodrobnosti.innerHTML = kratkiUvidHtml(financniNaslov, financnoKratko, financnoPodrobno) + '<div class="boniteta-pogled__glava"><div><h4>Finančni vpogled</h4><p>' + (izbrana === "assets" ? "Bilančna vsota po letih" : "Poslovni rezultat po letih") + '</p></div></div>' +
      '<div class="boniteta-finance__izbira" role="tablist" aria-label="Finančni kazalnik">' +
      financeGumb("earnings", "Poslovni rezultat", rezultat.length > 0) +
      financeGumb("assets", "Bilančna vsota", sredstva.length > 0) + '</div>' + omejitev + opozoriloVarovalke +
      financniGrafHtml(serija, izbrana === "assets" ? "Bilančna vsota" : "Poslovni rezultat") +
      '<p class="boniteta-pogled__opomba"><span aria-hidden="true">i</span>Znesek je pod stolpcem, odstotek pa kaže spremembo glede na prejšnje leto.</p>';
    podjetjePodrobnosti.querySelectorAll("[data-finance-vrsta]").forEach(function (gumb) {
      if (!gumb.disabled) gumb.addEventListener("click", function () { izrisiFinance(company, gumb.dataset.financeVrsta); prilagodiPodjetjePogled(); });
    });
    var drsnik = podjetjePodrobnosti.querySelector(".boniteta-finance__drsnik");
    if (drsnik) requestAnimationFrame(function () { drsnik.scrollLeft = drsnik.scrollWidth; });
  }

  function izrisiPlus() {
    var podrobnosti = northDataPodrobnosti(zadnjiRegistrskiPodatki);
    var bilanca = zadnjaDopolnilnaBilanca(podrobnosti);
    var vsebina = dopolnilniVpogledHtml(northDataPodrobnosti(zadnjiRegistrskiPodatki));
    var postavke = bilanca ? Object.keys(bilanca.items || {}).filter(function (kljuc) { return Number.isFinite(Number(bilanca.items[kljuc] && bilanca.items[kljuc].value)); }) : [];
    var uvid = bilanca ? kratkiUvidHtml(
      "Dopolnilni podatki so objavljeni za leto " + bilanca.fiscalYear + ".",
      "Na voljo je " + postavke.length + " številčnih postavk iz dopolnilnega vira.",
      "Spodaj so prikazane samo objavljene ali jasno označene ocenjene vrednosti; ocene niso predstavljene kot uradna bilanca."
    ) : "";
    podjetjePodrobnosti.innerHTML = uvid + (vsebina || '<p class="boniteta-podjetje-prazno">Dopolnilni podatki za to podjetje niso na voljo.</p>');
  }

  function varniDogodki(company) {
    return (company && Array.isArray(company.events) ? company.events : []).filter(function (dogodek) {
      return dogodek && (dogodek.date || dogodek.title || dogodek.description);
    });
  }

  function jeDogodekVodstva(dogodek) {
    return /officer|director|management|geschaftsfuhr|prokur|vodstv|vertreter/.test(normalizirajMetriko([dogodek && dogodek.category, dogodek && dogodek.type, dogodek && dogodek.title, dogodek && dogodek.description].join(" ")));
  }

  function datumDogodka(dogodek) {
    return String(dogodek && dogodek.date || "").slice(0, 10);
  }

  function vrstaDogodkaPoti(dogodek) {
    if (dogodek && dogodek.potType) return dogodek.potType;
    var zapis = normalizirajMetriko([dogodek && dogodek.category, dogodek && dogodek.type, dogodek && dogodek.title, dogodek && dogodek.description].join(" "));
    if (/capital|kapital|stammkapital|einlage/.test(zapis)) return "capital";
    if (/officer|director|management|geschaftsfuhr|prokur|vodstv|vertreter/.test(zapis)) return "leadership";
    if (/finance|financial|abschluss|bilanz|earnings|resultat/.test(zapis)) return "finance";
    if (/found|ustanov|grundung|incorporat/.test(zapis)) return "foundation";
    return "record";
  }

  function ikonaDogodkaPoti(vrsta) {
    var ikone = {
      foundation: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13h24M7 13v12M13 13v12M19 13v12M25 13v12M4 26h24M16 4 4 11h24z"/></svg>',
      capital: '<svg viewBox="0 0 32 32"><ellipse cx="16" cy="9" rx="9" ry="4"/><path d="M7 9v7c0 2.2 4 4 9 4s9-1.8 9-4V9M7 16v7c0 2.2 4 4 9 4s9-1.8 9-4v-7"/></svg>',
      leadership: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="10" r="5"/><path d="M4 27c0-6 3.3-10 9-10 3 0 5.3 1.1 6.8 3M25 17v10M20 22h10"/></svg>',
      finance: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h12l6 6v18H7zM19 4v7h7M11 23v-5M16 23v-9M21 23v-6"/></svg>',
      record: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h12l6 6v18H7zM19 4v7h7M11 16h10M11 21h10"/></svg>'
    };
    return ikone[vrsta] || ikone.record;
  }

  function imeOsebePoti(oseba) {
    return String(oseba && (oseba.name || [oseba.givenName, oseba.familyName].filter(Boolean).join(" ")) || "").trim();
  }

  function izrisiPot(company) {
    var tocke = [];
    if (company && company.foundingDate) tocke.push({ date: company.foundingDate, title: "Ustanovitev", text: "Začetek poslovne poti podjetja", potType: "foundation" });
    var dogodki = varniDogodki(company).slice().sort(function (a, b) { return datumDogodka(a).localeCompare(datumDogodka(b)); });
    dogodki.forEach(function (dogodek) {
      var naslov = String(dogodek.title || dogodek.category || "Zabeležena sprememba").trim();
      var opis = String(dogodek.description || "").trim();
      if (!naslov && !opis) return;
      var datum = datumDogodka(dogodek);
      var vrsta = vrstaDogodkaPoti(dogodek);
      var osebe = { current: [], former: [] };
      if (vrsta === "leadership") (company && Array.isArray(company.officers) ? company.officers : []).forEach(function (oseba) {
        var status = statusOsebe(oseba);
        if (datumOsebe(oseba, status) === datum) osebe[status].push(imeOsebePoti(oseba));
      });
      tocke.push({ date: datum, title: naslov, text: opis, potType: vrsta, people: osebe });
    });
    var zadnjeFinance = financnaSerija(company, "earnings").slice(-1)[0] || financnaSerija(company, "assets").slice(-1)[0];
    if (zadnjeFinance) tocke.push({ date: String(zadnjeFinance.year) + "-12-31", title: "Zadnje finance", text: "Finančni podatki za leto " + zadnjeFinance.year, potType: "finance" });
    var videne = {};
    tocke = tocke.filter(function (tocka) { var kljuc = tocka.date + tocka.title; if (videne[kljuc]) return false; videne[kljuc] = true; return true; })
      .sort(function (a, b) { return String(a.date || "").localeCompare(String(b.date || "")); });
    var skupinePoDatumu = [];
    tocke.forEach(function (tocka) {
      var zadnjaSkupina = skupinePoDatumu[skupinePoDatumu.length - 1];
      if (zadnjaSkupina && zadnjaSkupina.date === tocka.date) zadnjaSkupina.items.push(tocka);
      else skupinePoDatumu.push({ date: tocka.date, items: [tocka] });
    });
    tocke = skupinePoDatumu;
    if (tocke.length > 7) tocke = [tocke[0]].concat(tocke.slice(-6));
    var prvaTocka = tocke[0];
    var zadnjaTocka = tocke[tocke.length - 1];
    var potNaslov = tocke.length === 1 ? "Na voljo je 1 časovna točka." : "Na voljo je " + tocke.length + " časovnih točk.";
    var potKratko = prvaTocka && zadnjaTocka ? "Prvi prikazani zapis je iz leta " + String(prvaTocka.date || "").slice(0, 4) + ", zadnji pa iz leta " + String(zadnjaTocka.date || "").slice(0, 4) + "." : "Časovnica še nima zanesljivih datumov.";
    var potPodrobno = zadnjaTocka && zadnjaTocka.items && zadnjaTocka.items[0] ? "Zadnji prikazani dogodek: " + String(zadnjaTocka.items[0].title || "Zabeležena sprememba") + ". Dogodki so povzeti iz razpoložljivih registrskih in finančnih zapisov." : "Za ta pogled ni dovolj razpoložljivih zapisov.";
    function osebeDogodkaHtml(tocka) {
      if (!tocka.people) return "";
      return '<ul class="boniteta-pot__osebe">' +
        tocka.people.current.map(function (ime) { return '<li class="is-current"><strong data-fit-text data-fit-text-min="7">' + esc(ime) + '</strong><span>imenovan</span></li>'; }).join("") +
        tocka.people.former.map(function (ime) { return '<li class="is-former"><strong data-fit-text data-fit-text-min="7">' + esc(ime) + '</strong><span>zaključil funkcijo</span></li>'; }).join("") + '</ul>';
    }
    function obdobjePoDogodkuHtml(tocka, indeks) {
      var naslednja = tocke[indeks + 1];
      if (!naslednja || !tocka.date || !naslednja.date) return "";
      var zacetek = new Date(String(tocka.date).slice(0, 10) + "T12:00:00Z");
      var konec = new Date(String(naslednja.date).slice(0, 10) + "T12:00:00Z");
      if (Number.isNaN(zacetek.getTime()) || Number.isNaN(konec.getTime())) return "";
      var zacetnoLeto = zacetek.getUTCFullYear();
      var koncnoLeto = konec.getUTCFullYear();
      var meseci = Math.max(1, (koncnoLeto - zacetnoLeto) * 12 + konec.getUTCMonth() - zacetek.getUTCMonth());
      var steviloCrtic = meseci <= 12 ? 1 : meseci <= 48 ? 2 : meseci <= 96 ? 3 : 4;
      var meseciKratko = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "avg", "sep", "okt", "nov", "dec"];
      var oznaka = zacetnoLeto === koncnoLeto
        ? meseciKratko[zacetek.getUTCMonth()] + " → " + meseciKratko[konec.getUTCMonth()] + " " + koncnoLeto
        : zacetnoLeto + " → " + koncnoLeto;
      var crtice = Array.from({ length: steviloCrtic }, function () { return "<b></b>"; }).join("");
      return '<span class="boniteta-pot__obdobje" aria-label="Obdobje ' + esc(oznaka) + '"><small aria-hidden="true">' + esc(oznaka) + '</small><i aria-hidden="true">' + crtice + '</i></span>';
    }
    function karticaDogodkaHtml(tocka, indeks) {
      var zapisi = tocka.items || [tocka];
      var glavniZapis = zapisi.find(function (zapis) { return vrstaDogodkaPoti(zapis) === "leadership"; }) || zapisi[0];
      var vrsta = vrstaDogodkaPoti(glavniZapis);
      var leto = String(tocka.date || "").slice(0, 4);
      var zdruzeno = zapisi.length > 1;
      var obdobje = obdobjePoDogodkuHtml(tocka, indeks);
      function posameznaKartica(zapis, polozaj, dodatniZapisi) {
        var vrstaZapisa = vrstaDogodkaPoti(zapis);
        var osebe = osebeDogodkaHtml(zapis);
        var razredOseb = osebe ? " has-people" : "";
        var opis = osebe ? "" : zapis.text;
        var dodatno = dodatniZapisi > 0 ? '<small class="boniteta-pot__dodatni-dogodki">+ ' + dodatniZapisi + ' ' + (dodatniZapisi === 1 ? 'dodaten dogodek' : 'dodatna dogodka') + ' na isti datum</small>' : '';
        return '<article class="boniteta-pot__kartica boniteta-pot__kartica--' + polozaj + ' is-' + vrstaZapisa + razredOseb + '"><span class="boniteta-pot__ikona" aria-hidden="true">' + ikonaDogodkaPoti(vrstaZapisa) + '</span><div class="boniteta-pot__vsebina"><time datetime="' + esc(tocka.date) + '"><b>' + esc(leto || String(indeks + 1).padStart(2, "0")) + '</b><span>' + esc(formatirajDatumPodjetja(tocka.date) || "Datum ni naveden") + '</span></time>' +
          '<strong data-fit-text data-fit-text-min="9">' + esc(zapis.title) + '</strong>' + (opis ? '<p>' + esc(opis) + '</p>' : '') + dodatno + '</div>' + osebe + '</article>';
      }
      if (zdruzeno) return '<li class="is-' + vrsta + ' is-grouped has-top has-bottom"><span class="boniteta-pot-podjetja__stevilka is-count" aria-label="' + zapisi.length + ' dogodkov na isti datum">' + zapisi.length + '</span>' + obdobje +
        posameznaKartica(zapisi[0], "top", 0) + posameznaKartica(zapisi[1], "bottom", Math.max(0, zapisi.length - 2)) + '</li>';
      var polozaj = indeks % 2 === 0 ? "top" : "bottom";
      return '<li class="is-' + vrsta + ' has-' + polozaj + '"><span class="boniteta-pot-podjetja__stevilka" aria-hidden="true">' + ikonaDogodkaPoti(vrsta) + '</span>' + obdobje + posameznaKartica(glavniZapis, polozaj, 0) + '</li>';
    }
    podjetjePodrobnosti.innerHTML = kratkiUvidHtml(potNaslov, potKratko, potPodrobno) + '<div class="boniteta-pogled__glava"><div><h4>Pot podjetja</h4><p>Ključni uradno zabeleženi dogodki</p></div></div>' +
      (tocke.length ? '<div class="boniteta-pot__drsnik" tabindex="0" aria-label="Vodoravna časovnica podjetja"><ol class="boniteta-pot-podjetja">' + tocke.map(karticaDogodkaHtml).join("") + '</ol></div>' +
        '<div class="boniteta-pot__upravljanje"><span>Povlecite po poti podjetja</span><i aria-hidden="true"><b></b></i></div>' +
        '<p class="boniteta-pogled__opomba boniteta-pot__opomba"><span aria-hidden="true">i</span>Dogodki temeljijo na razpoložljivih registrskih podatkih.</p>' : '<p class="boniteta-podjetje-prazno">Časovnica za to podjetje še nima dodatnih zapisov.</p>');
    var drsnik = podjetjePodrobnosti.querySelector(".boniteta-pot__drsnik");
    var napredek = podjetjePodrobnosti.querySelector(".boniteta-pot__upravljanje i b");
    if (drsnik && napredek) {
      var posodobiNapredek = function () {
        var maksimum = Math.max(1, drsnik.scrollWidth - drsnik.clientWidth);
        napredek.style.transform = "scaleX(" + Math.max(.18, Math.min(1, .18 + drsnik.scrollLeft / maksimum * .82)).toFixed(3) + ")";
      };
      drsnik.addEventListener("scroll", posodobiNapredek, { passive: true });
      requestAnimationFrame(posodobiNapredek);
    }
  }

  function vodstveniDogodek(company) {
    return varniDogodki(company).filter(jeDogodekVodstva).sort(function (a, b) { return datumDogodka(b).localeCompare(datumDogodka(a)); })[0] || null;
  }

  function scenarijIzstopa(serija, vrsta) {
    if (!Array.isArray(serija) || serija.length < 2) return null;
    var prejsnja = serija[serija.length - 2], zadnja = serija[serija.length - 1];
    var razlika = zadnja.value - prejsnja.value;
    var odstotek = odstotekSpremembe(prejsnja, zadnja);
    var relativnaSprememba = odstotek === null ? (razlika === 0 ? 0 : 100) : Math.abs(odstotek);
    var stabilno = relativnaSprememba < .5;
    var scenarij = { vrsta: vrsta, oznaka: vrsta === "assets" ? "Bilančna vsota" : "Poslovni rezultat", prejsnja: prejsnja, zadnja: zadnja, odstotek: odstotek };
    if (stabilno) return Object.assign(scenarij, { status: vrsta === "assets" ? "Bilančna vsota je stabilna" : "Rezultat je stabilen", smer: "neutral", ton: "neutral" });
    if (vrsta === "assets") return Object.assign(scenarij, razlika > 0
      ? { status: "Bilančna vsota raste", smer: "up", ton: "positive" }
      : { status: "Bilančna vsota se zmanjšuje", smer: "down", ton: "negative" });
    if (prejsnja.value >= 0 && zadnja.value < 0) return Object.assign(scenarij, { status: "Prehod v izgubo", smer: "down", ton: "negative" });
    if (prejsnja.value < 0 && zadnja.value >= 0) return Object.assign(scenarij, { status: "Povratek v dobiček", smer: "up", ton: "positive" });
    if (prejsnja.value < 0 && zadnja.value < 0) return Object.assign(scenarij, razlika > 0
      ? { status: "Izguba se zmanjšuje", smer: "up", ton: "positive" }
      : { status: "Izguba se povečuje", smer: "down", ton: "negative" });
    return Object.assign(scenarij, razlika > 0
      ? { status: "Rezultat se izboljšuje", smer: "up", ton: "positive" }
      : { status: "Rezultat se slabša", smer: "down", ton: "negative" });
  }

  function polozajDogodkaNaGrafu(dogodek, serija) {
    if (!dogodek || !Array.isArray(serija) || serija.length < 2) return null;
    var datum = Date.parse(datumDogodka(dogodek) + "T12:00:00Z");
    var prejsnja = serija[serija.length - 2], zadnja = serija[serija.length - 1];
    var zacetek = Date.UTC(prejsnja.year, 0, 1), konec = Date.UTC(zadnja.year, 11, 31, 23, 59, 59);
    if (!Number.isFinite(datum) || datum < zacetek || datum > konec || konec <= zacetek) return null;
    return Number(Math.max(4, Math.min(96, (datum - zacetek) / (konec - zacetek) * 100)).toFixed(2));
  }

  function primerjavaHtml(scenarij) {
    if (!scenarij) return "";
    var prejsnja = scenarij.prejsnja, zadnja = scenarij.zadnja;
    var razredTona = scenarij.ton === "positive" ? "is-positive" : scenarij.ton === "negative" ? "is-negative" : "is-neutral";
    var razredVrednosti = zadnja.value < 0 ? "is-negative" : scenarij.ton === "positive" ? "is-positive" : "";
    return '<article class="boniteta-izstopa__primerjava has-status">' +
      '<mark class="' + razredTona + '">' + esc(scenarij.status) + '</mark>' +
      '<div><span><em>' + prejsnja.year + '</em><strong data-fit-text data-fit-text-min="9">' + esc(formatirajDenar(prejsnja.value, true)) + '</strong></span><b aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></b><span><em>' + zadnja.year + '</em><strong data-fit-text data-fit-text-min="9" class="' + razredVrednosti + '">' + esc(formatirajDenar(zadnja.value, true)) + '</strong></span></div></article>';
  }

  function financnaCrtaHtml(serija, markerX, scenarij) {
    if (serija.length < 2 || !scenarij) return { html: "", markerX: null, markerY: 50 };
    var prejsnja = scenarij.prejsnja, zadnja = scenarij.zadnja;
    var pada = scenarij.smer === "down", stabilno = scenarij.smer === "neutral";
    var relativnaSprememba = scenarij.odstotek === null ? 100 : Math.abs(scenarij.odstotek);
    var razpon = stabilno ? 2 : 10 + Math.min(24, relativnaSprememba * .12);
    var zacetekY = stabilno ? 40 : pada ? 40 - razpon / 2 : 40 + razpon / 2;
    var konecY = stabilno ? 40 : pada ? 40 + razpon / 2 : 40 - razpon / 2;
    var xKoordinate = [0, 8, 16, 24, 32, 40, 48, 55, 63, 72, 81, 90, 100];
    var valovanje = [0, -3.5, 2.2, -4.2, 1.6, -1.8, 1.5, 0, 3, -2, 5, -1, 0];
    var koordinati = xKoordinate.map(function (x, i) {
      var trend = zacetekY + (konecY - zacetekY) * x / 100;
      var amplituda = stabilno ? .3 : 1;
      return { x: x, y: Number((trend + valovanje[i] * (pada ? 1 : -1) * amplituda).toFixed(1)) };
    });
    var tocke = koordinati.map(function (p) { return p.x + "," + p.y; }).join(" ");
    var gladkaPot = "M " + koordinati[0].x + " " + koordinati[0].y;
    for (var i = 0; i < koordinati.length - 1; i += 1) {
      var p0 = koordinati[Math.max(0, i - 1)], p1 = koordinati[i], p2 = koordinati[i + 1], p3 = koordinati[Math.min(koordinati.length - 1, i + 2)];
      var c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      var c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      gladkaPot += " C " + c1x.toFixed(2) + " " + c1y.toFixed(2) + " " + c2x.toFixed(2) + " " + c2y.toFixed(2) + " " + p2.x + " " + p2.y;
    }
    function yPriX(x) {
      for (var j = 0; j < koordinati.length - 1; j += 1) {
        if (x < koordinati[j].x || x > koordinati[j + 1].x) continue;
        var delez = (x - koordinati[j].x) / (koordinati[j + 1].x - koordinati[j].x || 1);
        return koordinati[j].y + (koordinati[j + 1].y - koordinati[j].y) * delez;
      }
      return koordinati[Math.floor(koordinati.length / 2)].y;
    }
    var zacetnaBarva = prejsnja.value < 0 ? "#ef654f" : "#18aa9b";
    var koncnaBarva = zadnja.value < 0 || scenarij.ton === "negative" ? "#f04435" : scenarij.ton === "positive" ? "#1aa653" : "#15958e";
    var poligon = "0,78 " + tocke + " 100,78";
    var dejanskiMarkerX = Number.isFinite(markerX) ? markerX : null;
    var markerY = dejanskiMarkerX === null ? 50 : Number((yPriX(dejanskiMarkerX) / 82 * 80).toFixed(2));
    return { html: '<svg class="boniteta-izstopa__crta" viewBox="0 0 100 82" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="boniteta-izstopa-polnilo" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + zacetnaBarva + '" stop-opacity=".15"/><stop offset="1" stop-color="' + koncnaBarva + '" stop-opacity=".1"/></linearGradient><linearGradient id="boniteta-izstopa-poteza" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + zacetnaBarva + '"/><stop offset="1" stop-color="' + koncnaBarva + '"/></linearGradient></defs><polygon points="' + poligon + '" fill="url(#boniteta-izstopa-polnilo)"/><path d="' + gladkaPot + '" fill="none" stroke="url(#boniteta-izstopa-poteza)" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>', markerX: dejanskiMarkerX, markerY: markerY };
  }

  function izrisiIzstopaLegacy(company) {
    var rezultat = financnaSerija(company, "earnings");
    var sredstva = financnaSerija(company, "assets");
    var dogodek = vodstveniDogodek(company);
    var osnovnaVrsta = rezultat.length >= 2 ? "earnings" : sredstva.length >= 2 ? "assets" : "";
    var osnovnaSerija = osnovnaVrsta === "earnings" ? rezultat : osnovnaVrsta === "assets" ? sredstva : [];
    var scenarij = scenarijIzstopa(osnovnaSerija, osnovnaVrsta);
    var markerX = polozajDogodkaNaGrafu(dogodek, osnovnaSerija);
    var crta = financnaCrtaHtml(osnovnaSerija, markerX, scenarij);
    var skupine = { current: [], former: [] };
    (company && Array.isArray(company.officers) ? company.officers : []).forEach(function (oseba) { skupine[statusOsebe(oseba)].push(oseba); });
    var datumSpremembe = datumDogodka(dogodek);
    var trenutnaOseba = skupine.current.find(function (oseba) { return datumOsebe(oseba, "current") === datumSpremembe; }) || skupine.current[0];
    var preteklaOseba = skupine.former.find(function (oseba) { return datumOsebe(oseba, "former") === datumSpremembe; }) || skupine.former[0];
    function imeOsebe(oseba) { return oseba ? String(oseba.name || [oseba.givenName, oseba.familyName].filter(Boolean).join(" ")).trim() : ""; }
    var zadnjiSredstvi = sredstva[sredstva.length - 1], prejsnjaSredstva = sredstva[sredstva.length - 2];
    var sredstvaOdstotek = zadnjiSredstvi && prejsnjaSredstva ? odstotekSpremembe(prejsnjaSredstva, zadnjiSredstvi) : null;
    var najvecSredstev = zadnjiSredstvi && prejsnjaSredstva ? Math.max(Math.abs(zadnjiSredstvi.value), Math.abs(prejsnjaSredstva.value), 1) : 1;
    var bilancnaKartica = osnovnaVrsta !== "assets" && zadnjiSredstvi && prejsnjaSredstva ? '<article class="boniteta-izstopa__kartica boniteta-izstopa__kartica--bilanca"><div class="boniteta-izstopa__kartica-glava"><span class="boniteta-izstopa__kartica-ikona" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5h12l6 6v16H7z"/><path d="M19 5v7h7M11 16h10M11 20h7"/><ellipse cx="23" cy="24" rx="5" ry="2.2"/><path d="M18 24v4c0 1.2 2.2 2.2 5 2.2s5-1 5-2.2v-4"/></svg></span><strong>Bilančna vsota</strong></div><div class="boniteta-izstopa__bilanca-vrednosti"><b>' + esc(formatirajDenar(prejsnjaSredstva.value, true)) + '</b><b>' + esc(formatirajDenar(zadnjiSredstvi.value, true)) + '</b><small>' + prejsnjaSredstva.year + ' → ' + zadnjiSredstvi.year + '</small></div><div class="boniteta-izstopa__bilanca-meri"><span><em>' + prejsnjaSredstva.year + '</em><i style="--mera:' + Math.max(12, Math.abs(prejsnjaSredstva.value) / najvecSredstev * 100).toFixed(1) + '%"></i></span><span><em>' + zadnjiSredstvi.year + '</em><i style="--mera:' + Math.max(12, Math.abs(zadnjiSredstvi.value) / najvecSredstev * 100).toFixed(1) + '%"></i></span></div>' + (sredstvaOdstotek === null ? '' : '<mark class="' + (sredstvaOdstotek < 0 ? 'is-negative' : '') + '">' + (sredstvaOdstotek > 0 ? '+' : sredstvaOdstotek < 0 ? '−' : '') + Math.abs(sredstvaOdstotek).toLocaleString("sl-SI", { maximumFractionDigits: 1 }) + ' %</mark>') + '</article>' : '';
    var imaObeOsebi = Boolean(trenutnaOseba && preteklaOseba);
    var osebeHtml = (trenutnaOseba ? '<li class="is-current"><strong data-fit-text data-fit-text-min="9">' + esc(imeOsebe(trenutnaOseba)) + '</strong></li>' : '') + (preteklaOseba ? '<li class="is-former"><strong data-fit-text data-fit-text-min="9">' + esc(imeOsebe(preteklaOseba)) + '</strong></li>' : '');
    var puscicaVodstva = imaObeOsebi ? '<span class="boniteta-izstopa__vodstvo-puscica" aria-hidden="true"><svg viewBox="0 0 18 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="boniteta-vodstvo-puscica" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#df4a43"/><stop offset="1" stop-color="#19a653"/></linearGradient></defs><path d="M9 42V7M3.5 13 9 7l5.5 6"/></svg></span>' : '';
    var vodstvoKartica = dogodek && (osebeHtml || dogodek.title) ? '<article class="boniteta-izstopa__kartica boniteta-izstopa__kartica--vodstvo"><div class="boniteta-izstopa__kartica-glava"><span class="boniteta-izstopa__kartica-ikona is-green" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="14" cy="10" r="5"/><path d="M5 27c0-6 3.5-10 9-10s9 4 9 10M25 15v10M20 20h10"/></svg></span><strong>Vodstvo</strong></div>' + (osebeHtml ? '<div class="boniteta-izstopa__vodstvo-potek' + (imaObeOsebi ? '' : ' is-single') + '">' + puscicaVodstva + '<ul>' + osebeHtml + '</ul></div>' : '') + '<time>' + esc(formatirajDatumPodjetja(datumSpremembe) || datumSpremembe) + '</time><mark>' + esc(dogodek.title || "Sprememba vodstva") + '</mark></article>' : '';
    var imaMarker = crta.markerX !== null && Boolean(dogodek);
    var marker = imaMarker ? '<div class="boniteta-izstopa__marker" style="--marker-x:' + crta.markerX + '%;--marker-y:' + crta.markerY + 'px"><span></span></div><p class="boniteta-izstopa__dogodek-napis" style="--marker-y:' + crta.markerY + 'px"><time>' + esc(formatirajDatumPodjetja(datumSpremembe) || datumSpremembe) + '</time><strong data-fit-text data-fit-text-min="10">' + esc(dogodek.title || "Sprememba vodstva") + '</strong></p>' : "";
    var spodnjeKartice = [bilancnaKartica, vodstvoKartica].filter(Boolean);
    var spodaj = spodnjeKartice.length ? '<div class="boniteta-izstopa__spodaj' + (spodnjeKartice.length === 1 ? ' is-single' : '') + '">' + spodnjeKartice.join("") + '</div>' : '';
    var ikona = scenarij && scenarij.smer === "up" ? '<path d="M22 36V9M14 17l8-8 8 8"/>' : scenarij && scenarij.smer === "neutral" ? '<path d="M8 22h28M29 15l7 7-7 7"/>' : '<path d="M22 8v27M14 27l8 8 8-8"/>';
    var vsebina = "";
    if (scenarij) vsebina = '<section class="boniteta-izstopa__graf ' + (imaMarker ? 'has-marker' : 'without-marker') + (spodnjeKartice.length ? '' : ' is-no-secondary') + '"><div class="boniteta-izstopa__zgoraj"><span class="boniteta-izstopa__rezultat-ikona is-' + scenarij.smer + '" aria-hidden="true"><svg viewBox="0 0 44 44">' + ikona + '</svg></span>' + primerjavaHtml(scenarij) + '<div class="boniteta-izstopa__risba">' + crta.html + marker + '</div></div>' + spodaj + '</section>';
    else if (spodnjeKartice.length) vsebina = '<section class="boniteta-izstopa__graf is-event-only"><div class="boniteta-izstopa__spodaj is-single">' + spodnjeKartice.join("") + '</div></section>';
    else vsebina = '<p class="boniteta-podjetje-prazno">Za zanesljiv povzetek še ni dovolj primerljivih podatkov.</p>';
    podjetjePodrobnosti.innerHTML = '<div class="boniteta-pogled__glava boniteta-pogled__glava--izstopa"><div><h4>Kaj izstopa</h4></div></div>' +
      '<p class="boniteta-pogled__opomba boniteta-pogled__opomba--uvod"><span aria-hidden="true">i</span>Povzetek temelji na razpoložljivih podatkih. Časovno sovpadanje ne pomeni vzročne povezave.</p>' + vsebina;
  }

  function kratkiDatumSignala(vrednost) {
    if (!vrednost) return "";
    var datum = new Date(String(vrednost).slice(0, 10) + "T12:00:00Z");
    if (Number.isNaN(datum.getTime())) return "";
    return new Intl.DateTimeFormat("sl-SI", { month: "short", year: "numeric", timeZone: "UTC" }).format(datum);
  }

  function tonSignalaOznaka(signal) {
    if (signal.tone === "critical") return "Kritično";
    if (signal.tone === "warning") return "Pomembno";
    if (signal.tone === "positive") return "Pozitivno";
    if (signal.tone === "info") return "Informativno";
    return "Kontekst";
  }

  function ikonaSignala(id) {
    var ikone = {
      profit_to_loss: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 7v29M13 27l9 9 9-9"/></svg>',
      loss_to_profit: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 36V7M13 16l9-9 9 9"/></svg>',
      profit_drop: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12v24h28M12 17l8 7 6-4 10 10M30 30h6v-6"/></svg>',
      profit_growth: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 36h28M12 31l8-8 6 4 10-13M30 14h6v6"/></svg>',
      profit_decline_multi: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12v24h28M12 17l8 7 6-4 10 10M30 30h6v-6"/></svg>',
      assets_change: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10h24M13 10 7 32h12l-6-22Zm18 0-6 22h12l-6-22ZM6 35h32"/></svg>',
      liquidity_weaker: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 5S10 19 10 28a12 12 0 0 0 24 0C34 19 22 5 22 5Z"/></svg>',
      negative_equity: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12l10 9 7-5 11 16M30 32h6v-6"/></svg>',
      equity_decline_material: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12l10 9 7-5 11 16M30 32h6v-6"/></svg>',
      capital_stronger: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 35h28M12 31l8-9 6 5 10-15M30 12h6v6"/></svg>',
      leadership_turnover: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="15" r="6"/><path d="M5 36c0-8 4-13 11-13s11 5 11 13M31 11v19M25 17l6-6 6 6"/></svg>',
      reorganization: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M31 14a13 13 0 0 0-21 4M10 10v8h8M13 30a13 13 0 0 0 21-4M34 34v-8h-8"/></svg>',
      ug_to_gmbh: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 34h28M11 34V19h22v15M8 19h28L22 8 8 19ZM17 25v5M22 25v5M27 25v5"/></svg>',
      majority_owner: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="16" r="6"/><circle cx="29" cy="17" r="5"/><path d="M5 36c0-8 4-13 11-13s11 5 11 13M25 25c7 0 12 4 13 11"/></svg>',
      stable_management: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 5 13 5v10c0 9-5 15-13 19C14 35 9 29 9 20V10l13-5Z"/><path d="m15 22 5 5 9-10"/></svg>',
      court_change: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16h30M10 16v17M18 16v17M26 16v17M34 16v17M6 34h32M22 6 6 14h32L22 6Z"/></svg>',
      new_company: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="10" width="26" height="25" rx="3"/><path d="M9 17h26M15 6v8M29 6v8M15 23h5M24 23h5M15 29h5"/></svg>',
      contact_mismatch: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="19" cy="14" r="7"/><path d="M6 36c0-9 5-15 13-15 4 0 7 1 9 4M29 28l9 9M38 28l-9 9"/></svg>',
      director_network: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="22" cy="13" r="7"/><path d="M9 37c0-10 5-16 13-16s13 6 13 16"/></svg>',
      filing_gap: '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 6h16l8 8v24H10zM26 6v9h9M22 20v8M22 34h.01"/></svg>'
    };
    return ikone[id] || '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="22" cy="22" r="16"/><path d="M22 19v10M22 13h.01"/></svg>';
  }

  function stolpciSignala(serija, ton, poudariPredznak) {
    var vrednosti = (serija || []).filter(function (v) { return v && Number.isFinite(Number(v.value)); });
    var maksimum = Math.max.apply(Math, vrednosti.map(function (v) { return Math.abs(Number(v.value)); }).concat([1]));
    var pozitivniMaksimum = Math.max.apply(Math, vrednosti.filter(function (v) { return Number(v.value) >= 0; }).map(function (v) { return Number(v.value); }).concat([0]));
    var negativniMaksimum = Math.max.apply(Math, vrednosti.filter(function (v) { return Number(v.value) < 0; }).map(function (v) { return Math.abs(Number(v.value)); }).concat([0]));
    var osRazpon = 60;
    var staObaPredznaka = pozitivniMaksimum > 0 && negativniMaksimum > 0;
    var osnovnoMerilo = osRazpon / Math.max(1, pozitivniMaksimum + negativniMaksimum);
    var polozajNicle = pozitivniMaksimum > 0 && negativniMaksimum === 0
      ? 64
      : pozitivniMaksimum === 0 && negativniMaksimum > 0
        ? 4
        : Math.max(12, Math.min(56, Math.round(4 + pozitivniMaksimum * osnovnoMerilo)));
    var prostorNadNiclo = Math.max(1, polozajNicle - 4);
    var prostorPodNiclo = Math.max(1, 64 - polozajNicle);
    var meriloOsi = staObaPredznaka
      ? Math.min(prostorNadNiclo / pozitivniMaksimum, prostorPodNiclo / negativniMaksimum)
      : pozitivniMaksimum > 0 ? osRazpon / pozitivniMaksimum : osRazpon / Math.max(1, negativniMaksimum);
    return '<div class="boniteta-signal__stolpci' + (poudariPredznak ? ' is-trend' : '') + '">' + vrednosti.map(function (v) {
      var visina = poudariPredznak ? Math.max(6, Math.round(Math.abs(Number(v.value)) * meriloOsi)) : Math.max(20, Math.round(Math.abs(v.value) / maksimum * 70));
      var razredStolpca = poudariPredznak ? (Number(v.value) < 0 ? "loss" : "profit") : ton;
      var blizuNicle = poudariPredznak && Number(v.value) >= 0 && pozitivniMaksimum > 0 && Number(v.value) <= pozitivniMaksimum * .35;
      var graf = poudariPredznak
        ? '<em class="boniteta-signal__stolpec-os" style="--signal-zero:' + polozajNicle + 'px"><i class="is-' + esc(razredStolpca) + (blizuNicle ? ' is-near-zero' : '') + '" style="--signal-bar:' + visina + 'px"></i></em>'
        : '<i class="is-' + esc(razredStolpca) + '" style="--signal-bar:' + visina + '%"></i>';
      return '<span><b data-fit-text data-fit-text-min="7">' + esc(formatirajDenar(v.value, true)) + '</b>' + graf + '<small>' + esc(v.year) + '</small></span>';
    }).join("") + '</div>';
  }

  function oznakaSpremembeSignala(signal) {
    if (signal.changeLabel) return String(signal.changeLabel);
    if (signal.changeKind === "loss" && Number.isFinite(Number(signal.lossRatio))) {
      var razmerjeIzgube = Number(signal.lossRatio);
      if (razmerjeIzgube >= 2) return razmerjeIzgube.toLocaleString("sl-SI", { maximumFractionDigits: 1 }) + "× večja izguba";
      var spremembaIzgube = Math.abs(razmerjeIzgube - 1) * 100;
      return spremembaIzgube.toLocaleString("sl-SI", { maximumFractionDigits: 1 }) + " % " + (razmerjeIzgube > 1 ? "večja" : "manjša") + " izguba";
    }
    return signal.change == null ? "" : (signal.change > 0 ? "+" : "−") + Math.abs(signal.change).toLocaleString("sl-SI", { maximumFractionDigits: 1 }) + " %";
  }

  function veljavneTockeSignala(signal, polje, najmanj) {
    var tocke = signal && Array.isArray(signal[polje]) ? signal[polje] : [];
    if (tocke.length < najmanj) return false;
    var prejsnjeLeto = -Infinity;
    return tocke.every(function (tocka) {
      var leto = Number(tocka && tocka.year), vrednost = Number(tocka && tocka.value);
      var veljavno = Number.isInteger(leto) && leto >= 1900 && leto <= 2200 && Number.isFinite(vrednost) && leto > prejsnjeLeto;
      prejsnjeLeto = leto;
      return veljavno;
    });
  }

  function signalImaVarnePodatke(signal) {
    if (!signal || !signal.id || !signal.title || !signal.summary || !signal.layout) return false;
    if (!["critical", "warning", "positive", "info", "neutral"].includes(signal.tone)) return false;
    if (signal.layout === "transition") {
      if (!veljavneTockeSignala(signal, "values", 2)) return false;
      var prehodPrej = Number(signal.values[0].value), prehodZdaj = Number(signal.values[signal.values.length - 1].value);
      return signal.id === "profit_to_loss" ? prehodPrej >= 0 && prehodZdaj < 0 : signal.id === "loss_to_profit" ? prehodPrej < 0 && prehodZdaj >= 0 : false;
    }
    if (signal.layout === "bars") {
      if (!veljavneTockeSignala(signal, "series", 2) || !oznakaSpremembeSignala(signal)) return false;
      if (signal.changeKind === "loss") return Array.isArray(signal.lossYears) && signal.lossYears.length >= 2 && signal.lossYears.every(function (v) { return Number.isInteger(Number(v)); }) && Number.isFinite(Number(signal.lossTotal)) && Number(signal.lossTotal) > 0;
      return true;
    }
    if (signal.layout === "compare-bars") return veljavneTockeSignala(signal, "values", 2) && signal.values.every(function (v) { return Number(v.value) >= 0; }) && Number.isFinite(Number(signal.change));
    if (signal.layout === "liquidity") return Number.isFinite(Number(signal.change)) && Number(signal.change) <= 0 && Number.isFinite(Number(signal.secondaryChange)) && Number(signal.secondaryChange) >= 0;
    if (signal.layout === "capital") return veljavneTockeSignala(signal, "values", 1) && signal.values.length <= 2;
    if (signal.layout === "equity-alert") return veljavneTockeSignala(signal, "values", 2) && signal.values.every(function (v) { return Number(v.value) > 0; }) && Number(signal.change) <= -20;
    if (signal.layout === "leadership") return Array.isArray(signal.changes) && signal.changes.length > 0 && signal.changes.every(function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v && v.date || "")); });
    if (signal.layout === "reorganization") return Array.isArray(signal.eventTypes) && new Set(signal.eventTypes).size >= 3;
    if (signal.layout === "ownership") return [signal.before, signal.after].every(function (v) { return Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100; }) && Number(signal.after) > Number(signal.before);
    if (signal.layout === "stable") return /^\d{4}-\d{2}-\d{2}$/.test(String(signal.date || "")) && Number.isInteger(Number(signal.years)) && Number(signal.years) >= 1;
    if (signal.layout === "court") return Boolean(String(signal.text || "").trim());
    if (signal.layout === "new-company") return /^\d{4}-\d{2}-\d{2}$/.test(String(signal.date || "")) && Number.isFinite(Number(signal.ageMonths)) && Number(signal.ageMonths) >= 0;
    if (signal.layout === "network") return [signal.activeCompanies, signal.liquidatingCompanies].every(function (v) { return Number.isFinite(Number(v)) && Number(v) >= 0; });
    if (signal.layout === "filing-gap") return Array.isArray(signal.missingYears) && signal.missingYears.length > 0 && signal.missingYears.every(function (v) { return Number.isInteger(Number(v)); });
    return ["legal-form", "mismatch"].includes(signal.layout);
  }

  function grafPrehodaSignalaLegacy(signal) {
    var navzdol = signal.id === "profit_to_loss";
    return '<svg class="boniteta-signal__trend" viewBox="0 0 300 72" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="signal-fill-' + esc(signal.id) + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + (navzdol ? '#3da67a' : '#ef765f') + '" stop-opacity=".14"/><stop offset="1" stop-color="' + (navzdol ? '#e33f3f' : '#168b68') + '" stop-opacity=".18"/></linearGradient></defs><path d="M0 ' + (navzdol ? '16 C45 10 55 26 96 22 S148 17 166 36 S218 47 242 51 S274 48 300 64' : '58 C44 51 72 59 106 48 S145 43 165 31 S215 28 239 18 S274 20 300 8') + ' L300 72 L0 72Z" fill="url(#signal-fill-' + esc(signal.id) + ')"/><path d="M0 ' + (navzdol ? '16 C45 10 55 26 96 22 S148 17 166 36 S218 47 242 51 S274 48 300 64' : '58 C44 51 72 59 106 48 S145 43 165 31 S215 28 239 18 S274 20 300 8') + '" fill="none" stroke="' + (navzdol ? '#c9232b' : '#087d68') + '" stroke-width="2"/></svg>';
  }

  function grafPrehodaSignala(signal) {
    var navzdol = signal.id === "profit_to_loss";
    grafPrehodaSignala.zaporedje = (grafPrehodaSignala.zaporedje || 0) + 1;
    var grafId = esc(signal.id) + "-" + grafPrehodaSignala.zaporedje;
    var pot = navzdol
      ? "M0 16 C45 10 55 26 96 22 S148 17 166 36 S218 47 242 51 S274 48 300 64"
      : "M0 58 C44 51 72 59 106 48 S145 43 165 31 S215 28 239 18 S274 20 300 8";
    var prelomX = 166, prelomY = navzdol ? 36 : 31;
    return '<svg class="boniteta-signal__trend" viewBox="0 0 300 72" preserveAspectRatio="none" aria-hidden="true"><defs>' +
      '<linearGradient id="signal-fill-' + grafId + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + (navzdol ? '#3da67a' : '#ef765f') + '" stop-opacity=".16"/><stop offset="52%" stop-color="' + (navzdol ? '#3da67a' : '#ef765f') + '" stop-opacity=".08"/><stop offset="55%" stop-color="' + (navzdol ? '#e33f3f' : '#168b68') + '" stop-opacity=".1"/><stop offset="1" stop-color="' + (navzdol ? '#e33f3f' : '#168b68') + '" stop-opacity=".2"/></linearGradient>' +
      '<linearGradient id="signal-line-' + grafId + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + (navzdol ? '#087d68' : '#d94b3c') + '"/><stop offset="52%" stop-color="' + (navzdol ? '#087d68' : '#d94b3c') + '"/><stop offset="55%" stop-color="' + (navzdol ? '#c9232b' : '#087d68') + '"/><stop offset="1" stop-color="' + (navzdol ? '#c9232b' : '#087d68') + '"/></linearGradient></defs>' +
      '<path d="' + pot + ' L300 72 L0 72Z" fill="url(#signal-fill-' + grafId + ')"/><path d="' + pot + '" fill="none" stroke="url(#signal-line-' + grafId + ')" stroke-width="2"/>' +
      '<circle cx="' + prelomX + '" cy="' + prelomY + '" r="3.5" fill="#fff" stroke="#203b4b" stroke-width="1.4"/></svg>';
  }

  function vizualSignala(signal) {
    var vrednosti = signal.values || [], prej = vrednosti[0], zdaj = vrednosti[vrednosti.length - 1];
    if (signal.layout === "transition") return '<div class="boniteta-signal__primerjava"><span><small>' + esc(prej && prej.year) + '</small><b data-fit-text data-fit-text-min="9">' + esc(formatirajDenar(prej && prej.value, true)) + '</b></span><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></i><span><small>' + esc(zdaj && zdaj.year) + '</small><b class="is-' + esc(signal.tone) + '" data-fit-text data-fit-text-min="9">' + esc(formatirajDenar(zdaj && zdaj.value, true)) + '</b></span></div>' + grafPrehodaSignala(signal);
    if (signal.layout === "bars") return '<div class="boniteta-signal__poudarek"><b>' + esc(oznakaSpremembeSignala(signal)) + '</b></div>' + stolpciSignala(signal.series, signal.tone, true);
    if (signal.layout === "compare-bars") return '<div class="boniteta-signal__compare-bars-layout"><div class="boniteta-signal__primerjalni-povzetek"><div class="boniteta-signal__primerjava is-compact"><span><b data-fit-text data-fit-text-min="10">' + esc(formatirajDenar(prej && prej.value, true)) + '</b><small>' + esc(prej && prej.year) + '</small></span><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></i><span><b data-fit-text data-fit-text-min="10">' + esc(formatirajDenar(zdaj && zdaj.value, true)) + '</b><small>' + esc(zdaj && zdaj.year) + '</small></span></div>' + (signal.change == null ? '' : '<strong class="boniteta-signal__sprememba">' + (signal.change > 0 ? '+' : '−') + Math.abs(signal.change).toLocaleString("sl-SI", { maximumFractionDigits: 1 }) + ' %</strong>') + '</div>' + stolpciSignala(vrednosti, signal.tone) + '</div>';
    if (signal.layout === "liquidity") {
      var padecDenarja = Math.abs(Number(signal.change) || 0);
      var rastObveznosti = Math.abs(Number(signal.secondaryChange) || 0);
      return '<div class="boniteta-signal__likvidnost">' +
        '<span class="is-down"><small>Denar</small><b>' + (signal.change > 0 ? '+' : '−') + padecDenarja.toLocaleString("sl-SI", { maximumFractionDigits: 0 }) + ' %</b><em aria-hidden="true"><i style="--liquidity-bar:' + Math.min(100, padecDenarja) + '%"></i></em></span>' +
        '<span class="is-up"><small>Obveznosti</small><b>+' + rastObveznosti.toLocaleString("sl-SI", { maximumFractionDigits: 0 }) + ' %</b><em aria-hidden="true"><i style="--liquidity-bar:' + Math.min(100, rastObveznosti) + '%"></i></em></span>' +
        '</div>';
    }
    if (signal.layout === "capital") return '<div class="boniteta-signal__kapital"><span><b data-fit-text data-fit-text-min="8">' + esc(prej ? formatirajDenar(prej.value, true) : formatirajDenar(zdaj && zdaj.value, true)) + '</b><small>' + esc(prej ? prej.year : zdaj && zdaj.year) + '</small></span>' + (prej ? '<i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></i><span class="is-now"><b data-fit-text data-fit-text-min="8">' + esc(formatirajDenar(zdaj.value, true)) + '</b><small>' + esc(zdaj.year) + '</small></span>' : '') + '</div>';
    if (signal.layout === "equity-alert") return '<div class="boniteta-signal__kapital boniteta-signal__kapital--alarm"><span><b data-fit-text data-fit-text-min="9">' + esc(formatirajDenar(prej.value, true)) + '</b><small>' + esc(prej.year) + '</small></span><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></i><span class="is-now"><b data-fit-text data-fit-text-min="9">' + esc(formatirajDenar(zdaj.value, true)) + '</b><small>' + esc(zdaj.year) + '</small></span></div>';
    if (signal.layout === "leadership") return '<div class="boniteta-signal__menjave-vodstva">' + (signal.changes || []).map(function (sprememba) {
      var nastopili = (sprememba.appointed || []).join(", ");
      var zakljucili = (sprememba.departed || []).join(", ");
      var osebe = zakljucili || nastopili
        ? (zakljucili ? '<b class="is-former" data-fit-text data-fit-text-min="7"><small>−</small>' + esc(zakljucili) + '</b>' : '') + (zakljucili && nastopili ? '<i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></i>' : '') + (nastopili ? '<b class="is-current" data-fit-text data-fit-text-min="7"><small>+</small>' + esc(nastopili) + '</b>' : '')
        : '<b class="is-detail" data-fit-text data-fit-text-min="7">' + esc(sprememba.detail || "Osebe v viru niso navedene") + '</b>';
      return '<div><time>' + esc(kratkiDatumSignala(sprememba.date)) + '</time><span>' + osebe + '</span></div>';
    }).join("") + '</div>';
    if (signal.layout === "reorganization") {
      var oznake = { leadership: "Vodstvo", address: "Sedež", purpose: "Dejavnost", ownership: "Lastništvo", capital: "Kapital", legalForm: "Oblika", court: "Sodišče", name: "Naziv" };
      return '<div class="boniteta-signal__ploscice is-three">' + (signal.eventTypes || []).map(function (v) { return '<span><small>Spremenjeno</small><b>' + esc(oznake[v] || v) + '</b></span>'; }).join('') + '</div>';
    }
    if (signal.layout === "legal-form") return '<div class="boniteta-signal__preobrazba"><span><small>Prejšnja oblika</small><strong>UG</strong></span><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></i><span class="is-now"><small>Nova oblika</small><strong>GmbH</strong></span>' + (signal.date ? '<time>Sprememba · ' + esc(formatirajDatumPodjetja(signal.date)) + '</time>' : '') + '</div>';
    if (signal.layout === "ownership") return '<div class="boniteta-signal__ploscice"><span><small>Prej</small><b>' + esc(signal.before) + ' %</b></span><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></i><span class="is-now"><small>Zdaj</small><b>' + esc(signal.after) + ' %</b></span></div>';
    if (signal.layout === "stable") return '<div class="boniteta-signal__ploscice"><span><small>Od leta</small><b>' + esc(signal.date && signal.date.slice(0, 4)) + '</b></span><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></i><span class="is-now"><small>Trajanje</small><b>' + esc(signal.years) + ' let</b></span></div>';
    if (signal.layout === "court") {
      var kraja = String(signal.text || "").split(/\s+(?:to|nach|→)\s+/i);
      var prejsnjeSodisce = kraja.length > 1 ? kraja[0] : "Ni navedeno";
      var novoSodisce = kraja.length > 1 ? kraja[kraja.length - 1] : String(signal.text || "Sprememba zabeležena");
      var lokacijskaIkona = '<svg viewBox="0 0 24 26" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 24S20 17 20 9A8 8 0 0 0 4 9c0 8 8 15 8 15Z"/><circle cx="12" cy="9" r="2.5"/></svg>';
      return '<div class="boniteta-signal__sodisce"><span>' + lokacijskaIkona + '<small>Prejšnje sodišče</small><b data-fit-text data-fit-text-min="8">' + esc(prejsnjeSodisce) + '</b></span><i class="boniteta-signal__sodisce-pot" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></i><span class="is-now">' + lokacijskaIkona + '<small>Novo sodišče</small><b data-fit-text data-fit-text-min="8">' + esc(novoSodisce) + '</b></span>' + (signal.date ? '<time>Sprememba · ' + esc(formatirajDatumPodjetja(signal.date)) + '</time>' : '') + '</div>';
    }
    if (signal.layout === "new-company") {
      var starostMeseci = Math.max(0, Number(signal.ageMonths) || 0);
      var oznakaStarosti = starostMeseci === 0 ? "Manj kot 1 mesec" : starostMeseci === 1 ? "1 mesec" : starostMeseci < 5 ? starostMeseci + " mesece" : starostMeseci + " mesecev";
      return '<div class="boniteta-signal__ploscice is-two"><span><small>Ustanovljeno</small><b data-fit-text data-fit-text-min="8">' + esc(formatirajDatumPodjetja(signal.date)) + '</b></span><span class="is-now"><small>Starost podjetja</small><b>' + esc(oznakaStarosti) + '</b></span></div>';
    }
    if (signal.layout === "mismatch") return '<div class="boniteta-signal__neujemanje"><span>Register</span><i>≠</i><span>Spletni kontakt</span></div>';
    if (signal.layout === "network") {
      var aktivneDruzbe = Math.max(0, Number(signal.activeCompanies) || 0);
      var druzbeVLikvidaciji = Math.max(0, Number(signal.liquidatingCompanies) || 0);
      var vsePovezaneDruzbe = aktivneDruzbe + druzbeVLikvidaciji;
      var aktivniDelez = vsePovezaneDruzbe ? aktivneDruzbe / vsePovezaneDruzbe * 100 : 100;
      return '<div class="boniteta-signal__omrezje"><span class="is-active"><small>Aktivne družbe</small><b>' + esc(aktivneDruzbe) + '</b></span><span class="is-risk"><small>V likvidaciji</small><b>' + esc(druzbeVLikvidaciji) + '</b></span><em aria-hidden="true"><i class="is-active" style="--network-share:' + aktivniDelez + '%"></i><i class="is-risk" style="--network-share:' + (100 - aktivniDelez) + '%"></i></em></div>';
    }
    if (signal.layout === "filing-gap") {
      var manjkajoceLeto = Number(signal.missingYears[signal.missingYears.length - 1]);
      var objavljenaLeta = new Set((signal.years || []).map(Number));
      return '<div class="boniteta-signal__ploscice is-three">' + [manjkajoceLeto - 1, manjkajoceLeto, manjkajoceLeto + 1].map(function (leto) {
        var manjka = !objavljenaLeta.has(leto);
        return '<span class="' + (manjka ? 'is-missing' : 'is-ok') + '"><small>' + esc(leto) + '</small><b>' + (manjka ? 'Manjka' : 'Objavljeno') + '</b></span>';
      }).join('') + '</div>';
    }
    return "";
  }

  function karticaSignalaHtml(signal) {
    if (!signalImaVarnePodatke(signal)) return niPodatkovSignalHtml({ id: signal && signal.id || "unknown", title: signal && signal.title || "Podatka ni mogoče zanesljivo prikazati" });
    var prikaziZnacko = signal.layout === "transition" || signal.layout === "stable" || signal.layout === "mismatch" || signal.layout === "equity-alert";
    var badge = prikaziZnacko ? '<span class="boniteta-signal__znacka">' + (signal.layout === "equity-alert" ? '−' + Math.abs(Number(signal.change)).toLocaleString("sl-SI", { maximumFractionDigits: 1 }) + ' %' : esc(tonSignalaOznaka(signal))) + '</span>' : "";
    var action = signal.action ? '<button type="button" class="boniteta-signal__akcija" data-signal-action="' + esc(signal.action) + '">Preveri podatke</button>' : "";
    var besediloPovzetka = signal.summary;
    if (signal.changeKind === "loss" && Array.isArray(signal.lossYears) && signal.lossYears.length >= 2 && Number(signal.lossTotal) > 0) {
      var prvaIzguba = signal.lossYears[0], zadnjaIzguba = signal.lossYears[signal.lossYears.length - 1];
      besediloPovzetka = "V " + signal.lossYears.length + " letih (" + prvaIzguba + (prvaIzguba === zadnjaIzguba ? "" : "–" + zadnjaIzguba) + ") je skupna objavljena izguba znašala " + formatirajDenar(signal.lossTotal, true) + ".";
    }
    var summary = signal.layout === "stable" ? "" : '<p>' + esc(besediloPovzetka) + '</p>';
    karticaSignalaHtml.zaporedje = (karticaSignalaHtml.zaporedje || 0) + 1;
    var previdnost = signal.financialCautionLevel === "extreme";
    var razlogPonovitve = previdnost ? String(signal.recheckReason || "financial_caution") : "";
    var imeIntervala = "financial-recheck-" + esc(signal.id) + "-" + karticaSignalaHtml.zaporedje;
    var financialRecheck = previdnost ? '<aside class="boniteta-financni-alarm__predlog"><strong>Naš predlog</strong><p>To je heads-up iz zadnjih objavljenih poslovnih podatkov, ne napoved prihodnosti ali dokaz današnjega stanja. Pri večjem poslu bodite vseeno previdni: dogovorite se za avans, krajši plačilni rok ali zavarovanje plačila.</p></aside><section class="boniteta-financni-alarm__ponovitev" data-financial-recheck-mode="recommended"><h6>Ponovno preverjanje</h6><div class="boniteta-financni-alarm__nacini" data-active="recommended" aria-label="Način ponovnega preverjanja">' + [{ value: "recommended", label: "Priporočeno" }, { value: "manual", label: "Ročno" }, { value: "off", label: "Izklopljeno" }].map(function (nacin) { return '<label><input type="radio" name="' + imeIntervala + '-mode" value="' + nacin.value + '"' + (nacin.value === "recommended" ? ' checked' : '') + ' data-financial-recheck-mode><span>' + nacin.label + '</span></label>'; }).join("") + '</div><div class="boniteta-financni-alarm__urejevalnik"><span class="boniteta-financni-alarm__cez">Čez</span><div class="boniteta-financni-alarm__korak"><button type="button" aria-label="Zmanjšaj obdobje" data-financial-recheck-step="-1">−</button><input type="number" min="1" max="12" step="1" value="3" inputmode="numeric" aria-label="Vrednost obdobja" data-financial-recheck-value><button type="button" aria-label="Povečaj obdobje" data-financial-recheck-step="1">+</button></div><div class="boniteta-financni-alarm__enote" data-active="months" aria-label="Enota obdobja">' + [{ value: "days", label: "Dnevi" }, { value: "weeks", label: "Tedni" }, { value: "months", label: "Meseci" }].map(function (enota) { return '<label><input type="radio" name="' + imeIntervala + '" value="' + enota.value + '"' + (enota.value === "months" ? ' checked' : '') + ' data-financial-recheck-unit><span>' + enota.label + '</span></label>'; }).join("") + '</div></div><button class="boniteta-financni-alarm__shrani" type="button" data-financial-recheck>Nastavi priporočeno preverbo</button><output data-financial-recheck-status aria-live="polite"></output></section>' : "";
    return '<article class="boniteta-signal boniteta-signal--' + esc(signal.tone) + ' boniteta-signal--' + esc(signal.layout || "default") + (previdnost ? ' is-financial-caution' : '') + '"' + (previdnost ? ' data-financial-caution data-financial-recheck-reason="' + esc(razlogPonovitve) + '"' : '') + '>' +
      '<span class="boniteta-signal__ikona" aria-hidden="true">' + ikonaSignala(signal.id) + '</span>' +
      '<div class="boniteta-signal__vsebina"><header><h5 data-fit-text data-fit-text-min="10">' + esc(signal.title) + '</h5>' + badge + '</header>' +
      vizualSignala(signal) + summary + financialRecheck + (signal.person ? '<strong class="boniteta-signal__oseba" data-fit-text data-fit-text-min="8">' + esc(signal.person) + '</strong>' : '') + action + '</div></article>';
  }

  function datumPonovnePreverbe(dni) {
    var datum = new Date();
    datum.setHours(12, 0, 0, 0);
    datum.setDate(datum.getDate() + Number(dni));
    return datum;
  }

  var FINANCNE_ENOTE = {
    days: { factor: 1, max: 365, label: "dni" },
    weeks: { factor: 7, max: 52, label: "tednov" },
    months: { factor: 30, max: 12, label: "mesece" },
  };
  var nastavljenFinancniDatum = null;

  function prikaziNastavljenoFinancnoPonovitev(datum) {
    nastavljenFinancniDatum = new Date(datum);
    var besedilo = "Preverba je že nastavljena za " + nastavljenFinancniDatum.toLocaleDateString("sl-SI") + ".";
    document.querySelectorAll("[data-financial-recheck-status]").forEach(function (izpis) {
      izpis.textContent = besedilo;
      izpis.classList.remove("is-error");
      izpis.classList.add("is-success");
    });
    document.querySelectorAll("[data-financial-recheck]").forEach(function (gumb) {
      gumb.textContent = "Preverba že nastavljena";
      gumb.dataset.financialRecheckScheduled = "true";
    });
    window.requestAnimationFrame(osveziVisinoSignalnihVrtiljakov);
  }

  function osveziVisinoSignalnihVrtiljakov() {
    document.querySelectorAll("[data-signal-carousel-track]").forEach(function (sled) {
      var aktivniGumb = sled.closest("[data-signal-carousel]").querySelector('[data-signal-carousel-button][aria-current="true"]');
      var aktivnaKartica = sled.querySelector('[data-signal-carousel-slide="' + (aktivniGumb ? aktivniGumb.dataset.signalCarouselButton : "0") + '"]');
      if (aktivnaKartica) sled.style.height = aktivnaKartica.offsetHeight + "px";
    });
  }

  function posodobiFinancnoEnoto(input, prejsnjaEnota) {
    var kartica = input.closest("[data-financial-caution]");
    var vrednost = kartica && kartica.querySelector("[data-financial-recheck-value]");
    var izbirnik = input.closest(".boniteta-financni-alarm__enote");
    var novaEnota = FINANCNE_ENOTE[input.value];
    var staraEnota = FINANCNE_ENOTE[prejsnjaEnota] || novaEnota;
    if (!vrednost || !novaEnota) return;
    var trenutna = Number(vrednost.value);
    vrednost.value = Math.max(1, Math.min(novaEnota.max, Math.round((trenutna * staraEnota.factor) / novaEnota.factor) || 1));
    vrednost.min = "1";
    vrednost.max = String(novaEnota.max);
    if (izbirnik) izbirnik.dataset.active = input.value;
    kartica.dataset.financialRecheckUnit = input.value;
  }

  function posodobiFinancniNacin(input) {
    var kartica = input.closest("[data-financial-caution]");
    var ponovitev = input.closest(".boniteta-financni-alarm__ponovitev");
    var izbirnik = input.closest(".boniteta-financni-alarm__nacini");
    var vrednost = kartica && kartica.querySelector("[data-financial-recheck-value]");
    var meseci = kartica && kartica.querySelector('[data-financial-recheck-unit][value="months"]');
    var gumb = kartica && kartica.querySelector("[data-financial-recheck]");
    var status = kartica && kartica.querySelector("[data-financial-recheck-status]");
    var nacin = input.value;
    if (!kartica || !ponovitev || !gumb) return;
    ponovitev.dataset.financialRecheckMode = nacin;
    if (izbirnik) izbirnik.dataset.active = nacin;
    if (nacin === "recommended" && vrednost && meseci) {
      meseci.checked = true;
      vrednost.value = "3";
      posodobiFinancnoEnoto(meseci, kartica.dataset.financialRecheckUnit || "months");
    }
    ponovitev.querySelectorAll("[data-financial-recheck-step], [data-financial-recheck-value], [data-financial-recheck-unit]").forEach(function (polje) { polje.disabled = nacin !== "manual"; });
    gumb.textContent = nacin === "off" ? "Izklopi ponovno preverjanje" : nacin === "manual" ? "Shrani nastavitev" : "Nastavi priporočeno preverbo";
    if (status) { status.textContent = ""; status.classList.remove("is-error", "is-success"); }
  }

  function spremeniFinancnoVrednost(gumb) {
    var kartica = gumb.closest("[data-financial-caution]");
    var vrednost = kartica && kartica.querySelector("[data-financial-recheck-value]");
    if (!vrednost) return;
    var trenutna = Number(vrednost.value);
    var min = Number(vrednost.min) || 1;
    var max = Number(vrednost.max) || 365;
    vrednost.value = String(Math.max(min, Math.min(max, (Number.isInteger(trenutna) ? trenutna : min) + Number(gumb.dataset.financialRecheckStep || 0))));
    vrednost.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function intervalFinancnePonovitve(kartica) {
    var enotaInput = kartica && kartica.querySelector("[data-financial-recheck-unit]:checked");
    var vrednostInput = kartica && kartica.querySelector("[data-financial-recheck-value]");
    var enota = FINANCNE_ENOTE[enotaInput && enotaInput.value];
    var vrednost = Number(vrednostInput && vrednostInput.value);
    if (!enota || !Number.isInteger(vrednost) || vrednost < 1 || vrednost > enota.max) return 0;
    return vrednost * enota.factor;
  }

  async function nastaviFinancnoPonovnoPreverbo(gumb) {
    var kartica = gumb.closest("[data-financial-caution]");
    var ponovitev = gumb.closest(".boniteta-financni-alarm__ponovitev");
    var status = kartica && kartica.querySelector("[data-financial-recheck-status]");
    var nacin = ponovitev && ponovitev.dataset.financialRecheckMode || "recommended";
    var dni = intervalFinancnePonovitve(kartica);
    if (!status) return;
    status.classList.remove("is-error", "is-success");
    if (nacin === "off") {
      gumb.disabled = true;
      status.textContent = "Izklapljam …";
      try {
        if (zadnjiProfilId && !document.body.classList.contains("boniteta-test-mode")) {
          var tokenIzklop = await pridobiToken();
          var odgovorIzklop = await fetch("/api/boniteta-pro", { method: "POST", headers: glaveCakalneVrste(tokenIzklop, true), body: JSON.stringify({ action: "financial_recheck_delete", profileId: zadnjiProfilId, reason: kartica.dataset.financialRecheckReason || "financial_caution" }) });
          var teloIzklop = await odgovorIzklop.json().catch(function () { return {}; });
          if (!odgovorIzklop.ok || !teloIzklop.ok) throw new Error(teloIzklop.napaka || "Nastavitve ni bilo mogoče izklopiti.");
        }
        status.textContent = "Ponovno preverjanje je izklopljeno.";
        status.classList.add("is-success");
      } catch (errIzklop) {
        status.textContent = errIzklop && errIzklop.message || "Nastavitve ni bilo mogoče izklopiti.";
        status.classList.add("is-error");
      } finally { gumb.disabled = false; }
      return;
    }
    if (!dni || dni > 365) {
      status.textContent = "Vnesite celo število v dovoljenem razponu.";
      status.classList.add("is-error");
      return;
    }
    gumb.disabled = true;
    status.textContent = "Nastavljam …";
    try {
      var datum = datumPonovnePreverbe(dni);
      if (zadnjiProfilId && !document.body.classList.contains("boniteta-test-mode")) {
        var token = await pridobiToken();
        var odgovor = await fetch("/api/boniteta-pro", { method: "POST", headers: glaveCakalneVrste(token, true), body: JSON.stringify({ action: "financial_recheck_save", profileId: zadnjiProfilId, intervalDays: dni, reason: kartica.dataset.financialRecheckReason || "financial_caution" }) });
        var telo = await odgovor.json().catch(function () { return {}; });
        if (!odgovor.ok || !telo.ok) throw new Error(telo.napaka || "Nastavitve ni bilo mogoče shraniti.");
        datum = new Date(telo.recheck && telo.recheck.scheduled_for || datum);
      }
      prikaziNastavljenoFinancnoPonovitev(datum);
    } catch (err) {
      status.textContent = err && err.message || "Nastavitve ni bilo mogoče shraniti.";
      status.classList.add("is-error");
    } finally { gumb.disabled = false; }
  }

  function prazenSignalHtml(pokritost) {
    var vrstice = [
      { ok: pokritost.register, label: "Register", status: pokritost.register ? "Preverjen" : "Ni preverjen" },
      { ok: pokritost.management, label: "Vodstvo", status: pokritost.management ? "Preverjeno" : "Ni potrjeno" },
      { ok: pokritost.finance, label: "Finance", status: pokritost.finance ? "Preverjene" : "Ni podatkov" }
    ];
    return '<article class="boniteta-signal boniteta-signal--empty"><div class="boniteta-signal__vsebina"><header><h5>Nič pomembnega ne izstopa</h5></header><div class="boniteta-signal__scit"><svg viewBox="0 0 90 90" aria-hidden="true"><path d="m45 6 31 12v24c0 21-12 35-31 44C26 77 14 63 14 42V18L45 6Z"/><path d="m28 46 12 12 23-27"/></svg></div><p>V razpoložljivih podatkih ni pomembnih odstopanj ali neskladij.</p><div class="boniteta-signal__pokritost">' + vrstice.map(function (v) { return '<span class="' + (v.ok ? 'is-ok' : 'is-limited') + '"><i aria-hidden="true">' + (v.ok ? '✓' : '○') + '</i><small>' + esc(v.label) + '</small><b>' + esc(v.status) + '</b></span>'; }).join("") + '</div></div></article>';
  }

  function niPodatkovSignalHtml(signal) {
    return '<article class="boniteta-signal boniteta-signal--missing" data-manjka-signal="' + esc(signal.id) + '">' +
      '<span class="boniteta-signal__ikona" aria-hidden="true">' + ikonaSignala(signal.id) + '</span>' +
      '<div class="boniteta-signal__vsebina"><header><h5 data-fit-text data-fit-text-min="10">' + esc(signal.title) + '</h5><span class="boniteta-signal__znacka">Ni podatkov</span></header>' +
      '<div class="boniteta-signal__ni-podatkov"><strong>Ni dovolj podatkov za prikaz</strong><span>Ta grafika se bo samodejno izpolnila, ko bodo v uporabljenih virih na voljo ustrezni podatki.</span></div>' +
      '</div></article>';
  }

  function modelSignalovPodjetja(company) {
    var signalniApi = window.UJBonitetaSignali;
    var identiteta = zadnjaRegistrskaIdentiteta || {};
    var lokacija = zadnjiRegistrskiPodatki && zadnjiRegistrskiPodatki.locationMatch || {};
    return signalniApi ? signalniApi.izpelji(company || {}, {
      identityStatus: identiteta.status,
      locationStatus: lokacija.status,
      contactMismatch: Boolean(zadnjiRegistrskiPodatki && zadnjiRegistrskiPodatki.contactMismatch)
    }) : { signals: [], coverage: { register: false, management: false, finance: false }, empty: true };
  }

  function signalniVrtiljakHtml(signali) {
    if (signali.length < 2) return '<div class="boniteta-signali__seznam">' + signali.map(karticaSignalaHtml).join("") + '</div>';
    var stevilo = signali.length;
    var navigacija = signali.map(function (_, indeks) {
      var zaporedna = indeks + 1;
      return '<button type="button" data-signal-carousel-button="' + indeks + '" aria-label="Prikaži ugotovitev ' + zaporedna + ' od ' + stevilo + '" aria-current="' + (indeks === 0 ? 'true' : 'false') + '">' + zaporedna + '</button>';
    }).join("");
    var kartice = signali.map(function (signal, indeks) {
      return '<div class="boniteta-signali__slide" data-signal-carousel-slide="' + indeks + '">' + karticaSignalaHtml(signal) + '</div>';
    }).join("");
    return '<div class="boniteta-signali__vrtiljak" data-signal-carousel><div class="boniteta-signali__vrtiljak-glava"><span>Povlecite ali izberite</span><div class="boniteta-signali__vrtiljak-stevilke" role="group" aria-label="Ugotovitve">' + navigacija + '</div></div><div class="boniteta-signali__seznam" data-signal-carousel-track>' + kartice + '</div></div>';
  }

  function nastaviSignalniVrtiljak(koren) {
    var vrtiljak = koren.querySelector("[data-signal-carousel]");
    if (!vrtiljak) return;
    var sled = vrtiljak.querySelector("[data-signal-carousel-track]");
    var kartice = Array.from(vrtiljak.querySelectorAll("[data-signal-carousel-slide]"));
    var gumbi = Array.from(vrtiljak.querySelectorAll("[data-signal-carousel-button]"));
    var okvirAnimacije = 0;

    function oznaciAktivno() {
      okvirAnimacije = 0;
      var aktivniIndeks = kartice.reduce(function (najblizji, kartica, indeks) {
        return Math.abs(kartica.offsetLeft - sled.scrollLeft) < Math.abs(kartice[najblizji].offsetLeft - sled.scrollLeft) ? indeks : najblizji;
      }, 0);
      gumbi.forEach(function (gumb, indeks) { gumb.setAttribute("aria-current", indeks === aktivniIndeks ? "true" : "false"); });
      sled.style.height = kartice[aktivniIndeks].offsetHeight + "px";
    }

    gumbi.forEach(function (gumb, indeks) {
      gumb.addEventListener("click", function () {
        sled.scrollTo({ left: kartice[indeks].offsetLeft, behavior: "smooth" });
      });
    });
    sled.addEventListener("scroll", function () {
      if (!okvirAnimacije) okvirAnimacije = window.requestAnimationFrame(oznaciAktivno);
    }, { passive: true });
    window.addEventListener("resize", oznaciAktivno);
    oznaciAktivno();
  }

  function izrisiIzstopa(company) {
    var signalniApi = window.UJBonitetaSignali;
    var model = modelSignalovPodjetja(company);
    var primerjajSignale = signalniApi && typeof signalniApi.primerjajSignale === "function" ? signalniApi.primerjajSignale : function (a, b) { return String(a && a.id || "").localeCompare(String(b && b.id || "")); };
    var prednostniSignali = (model.signals || []).slice().sort(primerjajSignale);
    var dejanskiSignali = (model.allSignals || prednostniSignali).slice().sort(primerjajSignale);
    var ekstremniSignali = prednostniSignali.filter(function (signal) { return signal.financialCautionLevel === "extreme"; });
    var prikazaniPrednostniSignali = prednostniSignali;
    izstopaImaEkstremniFokus = ekstremniSignali.length > 0;
    rezultat.classList.toggle("is-company-signal-focus", izbraniPodjetjePogled === "izstopa" && izstopaImaEkstremniFokus);
    var vsebina = model.empty ? prazenSignalHtml(model.coverage) : signalniVrtiljakHtml(prikazaniPrednostniSignali);
    var katalogKartic = signalniApi && typeof window.UJBonitetaSignalneTestneKartice === "function" ? window.UJBonitetaSignalneTestneKartice() : [];
    var razlicicaTestneGalerije = new URLSearchParams(window.location.search).get("dodatno-test") || "vse";
    var jeTestnaGalerija = document.body.classList.contains("boniteta-test-mode") && razlicicaTestneGalerije === "vse";
    var testneKartice = jeTestnaGalerija ? katalogKartic : [];
    var testnaGalerija = testneKartice.map(function (fixture) {
      var testniModel = signalniApi.izpelji(fixture.company || {}, fixture.context || {});
      if (fixture.id === "empty") return prazenSignalHtml(testniModel.coverage);
      var signal = (testniModel.allSignals || []).find(function (item) { return item.id === fixture.id; });
      return signal ? karticaSignalaHtml(signal) : "";
    }).join("");
    var dejanskiIdji = dejanskiSignali.reduce(function (rezultat, signal) { rezultat[signal.id] = true; return rezultat; }, {});
    var manjkajociSignali = jeTestnaGalerija ? [] : katalogKartic.map(function (fixture) {
      if (fixture.id === "empty" || dejanskiIdji[fixture.id]) return null;
      var testniModel = signalniApi.izpelji(fixture.company || {}, fixture.context || {});
      return (testniModel.allSignals || []).find(function (item) { return item.id === fixture.id; }) || null;
    }).filter(Boolean).sort(function (a, b) { return Number(b.priority || 0) - Number(a.priority || 0); });
    var dejanskeKartice = dejanskiSignali.map(karticaSignalaHtml).join("");
    var praznaKartica = model.empty ? prazenSignalHtml(model.coverage) : "";
    var realnaGalerija = '<p class="boniteta-signali__galerija-povzetek"><strong>Najdenih ugotovitev: ' + dejanskiSignali.length + '</strong><span>·</span>Brez podatkov: ' + manjkajociSignali.length + '</p>' + praznaKartica + dejanskeKartice + manjkajociSignali.map(niPodatkovSignalHtml).join("");
    var galerija = testnaGalerija || realnaGalerija;
    var steviloGalerije = testnaGalerija ? testneKartice.length : dejanskiSignali.length + manjkajociSignali.length + (model.empty ? 1 : 0);
    var gumbGalerije = galerija ? '<button type="button" class="boniteta-signali__vse-gumb" data-vse-signalne-kartice aria-expanded="false"><span class="boniteta-signali__vse-gumb-tekst">Vse grafike</span><b>' + steviloGalerije + '</b></button>' : "";
    var kriticniSignali = dejanskiSignali.filter(function (signal) { return signal.tone === "critical"; }).length;
    var signalNaslov = model.empty ? "V podatkih ni izpostavljenih pomembnih ugotovitev."
      : dejanskiSignali.length === 1 ? "Zaznana je 1 pomembna ugotovitev."
        : dejanskiSignali.length === 2 ? "Zaznani sta 2 pomembni ugotovitvi."
          : dejanskiSignali.length < 5 ? "Zaznane so " + dejanskiSignali.length + " pomembne ugotovitve."
            : "Zaznanih je " + dejanskiSignali.length + " pomembnih ugotovitev.";
    var kriticnoBesedilo = kriticniSignali === 1 ? "Med njimi je 1 kritično opozorilo."
      : kriticniSignali === 2 ? "Med njimi sta 2 kritični opozorili."
        : kriticniSignali < 5 ? "Med njimi so " + kriticniSignali + " kritična opozorila."
          : "Med njimi je " + kriticniSignali + " kritičnih opozoril.";
    var signalKratko = model.empty ? "To velja samo za trenutno razpoložljive vire." : (kriticniSignali ? kriticnoBesedilo : "Nobena prikazana ugotovitev ni označena kot kritična.");
    var prviSignal = dejanskiSignali[0];
    var signalPodrobno = prviSignal ? "Najprej preverite: " + String(prviSignal.title || prviSignal.label || "prvo prikazano ugotovitev") + ". Manjkajoč podatek sam po sebi ni negativen signal." : "Povzetek ne potrjuje odsotnosti tveganja; pove le, da v trenutno dosegljivih podatkih ni izpostavljenega signala.";
    podjetjePodrobnosti.innerHTML = kratkiUvidHtml(signalNaslov, signalKratko, signalPodrobno) + '<section class="boniteta-signali"><div class="boniteta-pogled__glava boniteta-pogled__glava--izstopa"><div><h4>Kaj izstopa</h4><p>Prikazujemo samo pomembne spremembe in povezane dogodke.</p></div>' + gumbGalerije + '</div><p class="boniteta-pogled__opomba boniteta-pogled__opomba--uvod"><span aria-hidden="true">i</span>Manjkajoč podatek ni samodejno negativen signal. Prikazane so največ tri prednostne ugotovitve, razvrščene od najbolj do najmanj pomembne.</p><div class="boniteta-signali__privzeto">' + vsebina + '</div>' + (galerija ? '<div class="boniteta-signali__galerija" data-signalna-galerija hidden>' + galerija + '</div>' : '') + '</section>';
    nastaviSignalniVrtiljak(podjetjePodrobnosti);
    var gumbVseh = podjetjePodrobnosti.querySelector("[data-vse-signalne-kartice]");
    if (gumbVseh) gumbVseh.addEventListener("click", function () {
      var odprto = gumbVseh.getAttribute("aria-expanded") === "true";
      var zacetniPolozajGumba = gumbVseh.getBoundingClientRect().top;
      var privzeto = podjetjePodrobnosti.querySelector(".boniteta-signali__privzeto");
      var vse = podjetjePodrobnosti.querySelector("[data-signalna-galerija]");
      gumbVseh.setAttribute("aria-expanded", odprto ? "false" : "true");
      gumbVseh.querySelector(".boniteta-signali__vse-gumb-tekst").textContent = odprto ? "Vse grafike" : "Zapri grafike";
      if (odprto) {
        if (privzeto) privzeto.hidden = false;
        if (vse) vse.hidden = true;
      } else {
        if (vse) vse.hidden = false;
        if (privzeto) privzeto.hidden = true;
      }
      if (!odprto && window.UJPrilagodiVelikostBesedila) vse.querySelectorAll("[data-fit-text]").forEach(window.UJPrilagodiVelikostBesedila);
      function ohraniPolozajGumba() { window.scrollBy(0, gumbVseh.getBoundingClientRect().top - zacetniPolozajGumba); }
      ohraniPolozajGumba();
      window.requestAnimationFrame(function () {
        ohraniPolozajGumba();
        window.requestAnimationFrame(ohraniPolozajGumba);
      });
    });
    podjetjePodrobnosti.querySelectorAll("[data-signal-action]").forEach(function (gumb) {
      gumb.addEventListener("click", function () { nastaviPodjetjePogled(gumb.dataset.signalAction || "kljucni"); });
    });
    podjetjePodrobnosti.querySelectorAll("[data-financial-recheck]").forEach(function (gumb) {
      gumb.addEventListener("click", function () { nastaviFinancnoPonovnoPreverbo(gumb); });
    });
    podjetjePodrobnosti.querySelectorAll("[data-financial-recheck-unit]").forEach(function (input) {
      var kartica = input.closest("[data-financial-caution]");
      if (input.checked && kartica) kartica.dataset.financialRecheckUnit = input.value;
      input.addEventListener("change", function () {
        var prejsnjaEnota = kartica && kartica.dataset.financialRecheckUnit || "months";
        posodobiFinancnoEnoto(input, prejsnjaEnota);
      });
    });
    podjetjePodrobnosti.querySelectorAll("input[data-financial-recheck-mode]").forEach(function (input) {
      input.addEventListener("change", function () { posodobiFinancniNacin(input); });
      if (input.checked) posodobiFinancniNacin(input);
    });
    podjetjePodrobnosti.querySelectorAll("[data-financial-recheck-step]").forEach(function (gumb) {
      gumb.addEventListener("click", function () { spremeniFinancnoVrednost(gumb); });
    });
    if (nastavljenFinancniDatum) prikaziNastavljenoFinancnoPonovitev(nastavljenFinancniDatum);
  }

  function statusOsebe(oseba) {
    var zapis = normalizirajMetriko([oseba && oseba.status, oseba && oseba.role, oseba && oseba.action].join(" "));
    return oseba && (oseba.endDate || oseba.endedAt || oseba.to) || /former|ceased|ended|resigned|ehemalig|ausgeschieden|abberufen/.test(zapis) ? "former" : "current";
  }

  function datumOsebe(oseba, vrsta) {
    var kljuci = vrsta === "former" ? ["endDate", "endedAt", "to", "date"] : ["startDate", "appointedAt", "from", "date"];
    for (var i = 0; i < kljuci.length; i += 1) {
      var kljuc = kljuci[i];
      if (oseba && oseba[kljuc]) return String(oseba[kljuc]).slice(0, 10);
    }
    return "";
  }

  function kapitalPodjetja(company) {
    var vrstice = [];
    (company && Array.isArray(company.balanceSheets) ? company.balanceSheets : []).forEach(function (izkaz) { vrstice = vrstice.concat(izkaz.lines || []); });
    var kapital = vrstice.find(function (v) { return /share capital|stammkapital|gezeichnetes kapital|registered capital/.test(normalizirajMetriko(v && v.name)); });
    if (kapital && Number.isFinite(Number(kapital.value))) return formatirajDenar(kapital.value, true);
    var zapis = varniDogodki(company).map(function (v) { return [v.title, v.description].join(" "); }).join(" ");
    var zadetek = zapis.match(/(?:kapital|capital)[^\d]{0,30}([\d.]+(?:,\d{1,2})?)\s*€/i);
    return zadetek ? zadetek[1] + " €" : "";
  }

  function izrisiDodatno(company, identiteta) {
    var osebe = company && Array.isArray(company.officers) ? company.officers : [];
    var povezaneDruzbe = (company && Array.isArray(company.relatedCompanies) ? company.relatedCompanies : []).filter(function (povezava) {
      var ime = String(povezava && povezava.name || "");
      return Boolean(povezava && povezava.registerKey || /\b(?:GmbH|AG|KG|UG|OHG|SE|e\.\s*V\.)\b/i.test(ime));
    });
    var euid = (company && Array.isArray(company.nationalIds) ? company.nationalIds : []).find(function (v) { return /euid/i.test(String(v && v.source)); });
    var lei = String(company && company.leiCode || "").trim();
    var trenutnoVodstvo = osebe.filter(function (oseba) { return statusOsebe(oseba) === "current"; });
    var nevtralnaOsebaIkona = '<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="10" r="6"/><path d="M6 28v-2.5c0-5.1 4.1-9.2 9.2-9.2h1.6c5.1 0 9.2 4.1 9.2 9.2V28"/></svg>';
    function osebaHtml(oseba, vrsta) {
      var ime = String(oseba.name || [oseba.givenName, oseba.familyName].filter(Boolean).join(" ")).trim();
      var vloga = String(oseba.role || "Vloga ni navedena").trim();
      return '<li class="is-' + vrsta + '"><span class="boniteta-dodatno__avatar" aria-hidden="true">' + nevtralnaOsebaIkona + '</span><div><strong data-fit-text data-fit-text-min="10">' + esc(ime) + '</strong><span class="boniteta-dodatno__vloga">' + esc(vloga) + '</span></div></li>';
    }
    var preverjenoDatum = zadnjiRegistrskiPodatki && zadnjiRegistrskiPodatki.checkedAt ? new Date(zadnjiRegistrskiPodatki.checkedAt) : null;
    var preverjenoBesedilo = preverjenoDatum && !Number.isNaN(preverjenoDatum.getTime())
      ? new Intl.DateTimeFormat("sl-SI", { day: "numeric", month: "numeric", year: "numeric" }).format(preverjenoDatum)
      : "";
    var identifikatorji = [];
    if (euid && euid.value) identifikatorji.push('<div><dt>EUID</dt><dd data-fit-text data-fit-text-min="8">' + esc(euid.value) + '</dd></div>');
    if (lei) identifikatorji.push('<div><dt>LEI</dt><dd data-fit-text data-fit-text-min="8">' + esc(lei) + '</dd></div>');
    function povezavaHtml(povezava) {
      var ime = String(povezava && povezava.name || "Neimenovano podjetje").trim();
      var odnosi = povezava && Array.isArray(povezava.relationships) ? povezava.relationships.filter(Boolean).join(", ") : "";
      var lokacija = [povezava && povezava.city, povezava && povezava.registerKey].filter(Boolean).join(" · ");
      var opis = odnosi || String(povezava && povezava.description || "Povezava je navedena brez podrobnejšega opisa.").trim();
      return '<li><span class="boniteta-dodatno__povezava-ikona" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="10" height="13" rx="2"/><rect x="18" y="7" width="9" height="17" rx="2"/><path d="M15 17h3M9 15h2M9 19h2M22 12h2M22 16h2M22 20h2"/></svg></span><div><strong data-fit-text data-fit-text-min="9">' + esc(ime) + '</strong><span>' + esc(opis) + '</span>' + (lokacija ? '<small>' + esc(lokacija) + '</small>' : '') + '</div></li>';
    }
    var vidnePovezave = povezaneDruzbe.slice(0, 3);
    var dodatnePovezave = povezaneDruzbe.slice(3, 8);
    var povezaveHtml = povezaneDruzbe.length ? '<section class="boniteta-dodatno__modul boniteta-dodatno__povezave"><h5>Povezana podjetja</h5><ul>' + vidnePovezave.map(povezavaHtml).join("") + '</ul>' +
      (dodatnePovezave.length ? '<details class="boniteta-dodatno__povezave-vec"><summary><span class="is-closed">Prikaži še ' + dodatnePovezave.length + ' povezav</span><span class="is-open">Skrij dodatne povezave</span><b aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></b></summary><ul>' + dodatnePovezave.map(povezavaHtml).join("") + '</ul></details>' : '') + '</section>' : "";
    var identifikatorjiHtml = identifikatorji.length ? '<section class="boniteta-dodatno__modul boniteta-dodatno__identifikatorji"><h5>Dodatni identifikatorji</h5><dl class="boniteta-dodatno__zapisi' + (identifikatorji.length === 1 ? ' is-single' : '') + '">' + identifikatorji.join("") + '</dl><footer class="boniteta-dodatno__noga"><small><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></span>Posodobljeno' + (preverjenoBesedilo ? ' ' + esc(preverjenoBesedilo) : '') + '</small></footer></section>' : "";
    var vodstvoHtml = trenutnoVodstvo.length ? '<section class="boniteta-dodatno__modul boniteta-dodatno__osebe"><h5>Trenutno vodstvo</h5><ul>' + trenutnoVodstvo.map(function (v) { return osebaHtml(v, "current"); }).join("") + '</ul></section>' : "";
    var moduli = [vodstvoHtml, povezaveHtml, identifikatorjiHtml].filter(Boolean);
    var dodatnoNaslov = "Zbrani so dodatni registrski podatki.";
    var dodatnoKratko = "Vodstvo: " + trenutnoVodstvo.length + " · Povezana podjetja: " + povezaneDruzbe.length + " · Identifikatorji: " + identifikatorji.length + ".";
    var vodstvoBesedilo = trenutnoVodstvo.length === 1 ? "1 trenutno odgovorna oseba"
      : trenutnoVodstvo.length === 2 ? "2 trenutno odgovorni osebi"
        : trenutnoVodstvo.length < 5 ? trenutnoVodstvo.length + " trenutno odgovorne osebe"
          : trenutnoVodstvo.length + " trenutno odgovornih oseb";
    var povezaveBesedilo = povezaneDruzbe.length === 1 ? "1 povezano podjetje"
      : povezaneDruzbe.length === 2 ? "2 povezani podjetji"
        : povezaneDruzbe.length < 5 ? povezaneDruzbe.length + " povezana podjetja"
          : povezaneDruzbe.length + " povezanih podjetij";
    var dodatnoPodrobno = trenutnoVodstvo.length
      ? "Register navaja " + vodstvoBesedilo + (povezaneDruzbe.length ? " in " + povezaveBesedilo + "." : ".")
      : "Trenutno vodstvo v tem viru ni navedeno; prikazani so le drugi dejansko dosegljivi dodatni podatki.";
    var glava = trenutnoVodstvo.length && !povezaneDruzbe.length && !identifikatorji.length
      ? { naslov: "Vodstvo podjetja", opis: "Trenutne osebe v registrskih podatkih" }
      : povezaneDruzbe.length && !trenutnoVodstvo.length && !identifikatorji.length
        ? { naslov: "Povezave podjetja", opis: "Povezane družbe iz registrskih podatkov" }
        : identifikatorji.length && !trenutnoVodstvo.length && !povezaneDruzbe.length
          ? { naslov: "Dodatni podatki podjetja", opis: "Nepodvojeni registrski identifikatorji" }
          : { naslov: "Vodstvo in povezave", opis: "Osebe, povezave in dodatni identifikatorji" };
    podjetjePodrobnosti.innerHTML = kratkiUvidHtml(dodatnoNaslov, dodatnoKratko, dodatnoPodrobno) + '<div class="boniteta-pogled__glava"><div><h4>' + esc(glava.naslov) + '</h4><p>' + esc(glava.opis) + '</p></div></div>' +
      '<div class="boniteta-dodatno__moduli">' + moduli.join("") + '</div>' +
      (moduli.length ? '' : '<p class="boniteta-dodatno__brez-modulov">Za podjetje ni dodatnih nepodvojenih podatkov.</p>');
  }

  function prilagodiPodjetjePogled() {
    if (!window.UJPrilagodiVelikostBesedila || !podjetjePregled) return;
    podjetjePregled.querySelectorAll("[data-fit-text]").forEach(window.UJPrilagodiVelikostBesedila);
  }

  function razpolozljivostPodjetjePogledov(company) {
    var imaFinance = financnaSerija(company, "earnings").length > 0 || financnaSerija(company, "assets").length > 0;
    var imaPlus = Boolean(zadnjaDopolnilnaBilanca(northDataPodrobnosti(zadnjiRegistrskiPodatki)));
    var imaPot = Boolean(company && company.foundingDate) || varniDogodki(company).length > 0 || imaFinance;
    var imaVodstvo = (company && Array.isArray(company.officers) ? company.officers : []).some(function (oseba) { return statusOsebe(oseba) === "current"; });
    var imaPovezave = (company && Array.isArray(company.relatedCompanies) ? company.relatedCompanies : []).some(function (povezava) {
      var ime = String(povezava && povezava.name || "");
      return Boolean(povezava && povezava.registerKey || /\b(?:GmbH|AG|KG|UG|OHG|SE|e\.\s*V\.)\b/i.test(ime));
    });
    var imaEuid = (company && Array.isArray(company.nationalIds) ? company.nationalIds : []).some(function (v) { return v && v.value && /euid/i.test(String(v.source)); });
    var imaDodatno = imaVodstvo || imaPovezave || imaEuid || Boolean(String(company && company.leiCode || "").trim());
    return { kljucni: true, izstopa: true, plus: imaPlus, finance: imaFinance, pot: imaPot, dodatno: imaDodatno };
  }

  function posodobiRazpolozljivostPodjetjePogledov(company) {
    var razpolozljivost = razpolozljivostPodjetjePogledov(company);
    var signalniModel = modelSignalovPodjetja(company);
    var niPomembnihUgotovitev = signalniModel.empty;
    var steviloKriticnihOpozoril = (signalniModel.allSignals || []).filter(function (signal) { return signal.tone === "critical"; }).length;
    podjetjePregled.querySelectorAll("[data-podjetje-pogled]").forEach(function (gumb) {
      var pogled = gumb.dataset.podjetjePogled;
      var jeNaVoljo = razpolozljivost[pogled] !== false;
      var oznaka = (gumb.querySelector("b") || gumb).textContent.trim();
      gumb.classList.toggle("is-empty-result", pogled === "izstopa" && niPomembnihUgotovitev);
      if (pogled === "izstopa") {
        var znacka = gumb.querySelector("[data-izstopa-opozorila]");
        gumb.classList.toggle("has-material-alert", steviloKriticnihOpozoril > 0);
        gumb.classList.toggle("has-extreme-alert", steviloKriticnihOpozoril > 0);
        if (znacka) { znacka.hidden = steviloKriticnihOpozoril === 0; znacka.textContent = String(steviloKriticnihOpozoril); }
      }
      gumb.disabled = !jeNaVoljo;
      gumb.setAttribute("aria-disabled", jeNaVoljo ? "false" : "true");
      var dostopnaOznaka = pogled === "izstopa" && steviloKriticnihOpozoril > 0 ? oznaka + " – " + steviloKriticnihOpozoril + (steviloKriticnihOpozoril === 1 ? " kritično opozorilo" : " kritična opozorila") : oznaka;
      gumb.setAttribute("aria-label", jeNaVoljo ? dostopnaOznaka : oznaka + " – informacije niso na voljo");
    });
  }

  function sproziUtripFinancnegaOpozorila(gumb) {
    if (!gumb || !gumb.classList.contains("has-material-alert") || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gumb.classList.remove("is-alert-pulsing");
    void gumb.offsetWidth;
    gumb.classList.add("is-alert-pulsing");
  }

  function razpolozljiviPodjetjePogledi() {
    return Array.from(podjetjePregled.querySelectorAll("[data-podjetje-pogled]:not(:disabled)")).map(function (gumb) { return gumb.dataset.podjetjePogled; });
  }

  function nastaviPodjetjePogled(pogled, fokus) {
    var dovoljeni = ["kljucni", "finance", "pot", "izstopa", "plus", "dodatno"];
    if (!dovoljeni.includes(pogled)) pogled = "kljucni";
    podjetjePregled.querySelectorAll(".is-alert-pulsing").forEach(function (gumb) { gumb.classList.remove("is-alert-pulsing"); });
    var ciljniGumb = podjetjePregled.querySelector('[data-podjetje-pogled="' + pogled + '"]');
    if (ciljniGumb && ciljniGumb.disabled) pogled = "kljucni";
    izbraniPodjetjePogled = pogled;
    var kljucni = pogled === "kljucni";
    podjetjeKljucni.hidden = !kljucni;
    podjetjePodrobnosti.hidden = kljucni;
    podjetjePregled.dataset.pogled = pogled;
    rezultat.classList.toggle("is-company-signal-focus", pogled === "izstopa" && izstopaImaEkstremniFokus);
    podjetjePregled.querySelectorAll("[data-podjetje-pogled]").forEach(function (gumb) {
      var aktiven = gumb.dataset.podjetjePogled === pogled;
      gumb.setAttribute("aria-selected", aktiven ? "true" : "false");
      gumb.classList.toggle("is-active", aktiven);
      gumb.tabIndex = aktiven ? 0 : -1;
    });
    if (!kljucni) {
      var company = northDataPodjetje(zadnjiRegistrskiPodatki);
      if (pogled === "finance") izrisiFinance(company);
      else if (pogled === "plus") izrisiPlus();
      else if (pogled === "pot") izrisiPot(company);
      else if (pogled === "izstopa") izrisiIzstopa(company);
      else izrisiDodatno(company, zadnjaRegistrskaIdentiteta || {});
    }
    if (fokus) {
      var aktivni = podjetjePregled.querySelector('[data-podjetje-pogled="' + pogled + '"]');
      if (aktivni) aktivni.focus();
    }
    requestAnimationFrame(prilagodiPodjetjePogled);
  }

  if (podjetjePregled) {
    podjetjePregled.querySelectorAll("[data-podjetje-pogled]").forEach(function (gumb) {
      gumb.addEventListener("click", function () { nastaviPodjetjePogled(gumb.dataset.podjetjePogled); });
      gumb.addEventListener("keydown", function (dogodek) {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(dogodek.key)) return;
        dogodek.preventDefault();
        var pogledi = razpolozljiviPodjetjePogledi();
        var indeks = pogledi.indexOf(izbraniPodjetjePogled);
        if (dogodek.key === "Home") indeks = 0;
        else if (dogodek.key === "End") indeks = pogledi.length - 1;
        else indeks = (indeks + (dogodek.key === "ArrowRight" ? 1 : -1) + pogledi.length) % pogledi.length;
        nastaviPodjetjePogled(pogledi[indeks], true);
      });
    });
    var dotik = null;
    podjetjePogledi.addEventListener("pointerdown", function (dogodek) {
      if (dogodek.pointerType === "mouse" || dogodek.target.closest("button, details, .boniteta-finance__drsnik, .boniteta-pot__drsnik")) return;
      dotik = { x: dogodek.clientX, y: dogodek.clientY };
    });
    podjetjePogledi.addEventListener("pointerup", function (dogodek) {
      if (!dotik) return;
      var dx = dogodek.clientX - dotik.x, dy = dogodek.clientY - dotik.y;
      dotik = null;
      if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy)) return;
      var pogledi = razpolozljiviPodjetjePogledi();
      var indeks = pogledi.indexOf(izbraniPodjetjePogled) + (dx < 0 ? 1 : -1);
      if (indeks >= 0 && indeks < pogledi.length) nastaviPodjetjePogled(pogledi[indeks]);
    });
  }

  function northDataPodjetje(podatki) {
    var northData = podatki && podatki.northData;
    if (!northData || northData.status !== "found" || !northData.company) return null;
    var guard = window.UJBonitetaFinanceGuard;
    var details = northDataPodrobnosti(podatki);
    return guard && typeof guard.uskladi === "function" ? guard.uskladi(northData.company, details).company : northData.company;
  }

  function formatirajDatumPodjetja(vrednost) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(vrednost || ""))) return "";
    var datum = new Date(String(vrednost) + "T12:00:00Z");
    if (Number.isNaN(datum.getTime())) return "";
    return new Intl.DateTimeFormat("sl-SI", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(datum);
  }

  function starostPodjetja(vrednost) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(vrednost || ""))) return "";
    var deli = String(vrednost).split("-").map(Number);
    var danes = new Date();
    var skupnoMesecev = (danes.getFullYear() - deli[0]) * 12 + (danes.getMonth() + 1 - deli[1]);
    if (danes.getDate() < deli[2]) skupnoMesecev -= 1;
    if (skupnoMesecev < 0) return "";
    var leta = Math.floor(skupnoMesecev / 12);
    var meseci = skupnoMesecev % 12;
    return {
      leta: leta,
      letaEnota: leta === 1 ? "leto" : leta === 2 ? "leti" : leta === 3 || leta === 4 ? "leta" : "let",
      meseci: meseci,
      meseciEnota: meseci === 1 ? "mesec" : meseci === 2 ? "meseca" : meseci === 3 || meseci === 4 ? "mesece" : "mesecev"
    };
  }

  function odgovorneOsebe(company) {
    var osebe = company && Array.isArray(company.officers) ? company.officers : [];
    return osebe.reduce(function (rezultat, vrednost) {
      if (!vrednost) return rezultat;
      var ime = String(vrednost.name || [vrednost.givenName, vrednost.familyName].filter(Boolean).join(" ")).trim();
      if (!ime) return rezultat;
      var vloga = String(vrednost.role || "Zastopnik").trim();
      var obstojeca = rezultat.find(function (oseba) { return oseba.ime.toLocaleLowerCase("sl-SI") === ime.toLocaleLowerCase("sl-SI"); });
      if (obstojeca) {
        if (vloga && !obstojeca.vloga.split(" · ").includes(vloga)) obstojeca.vloga += " · " + vloga;
        return rezultat;
      }
      rezultat.push({ ime: ime, vloga: vloga });
      return rezultat;
    }, []);
  }

  function odgovorneOsebeIzIdentitete(identiteta) {
    var vloge = identiteta && Array.isArray(identiteta.vloge) ? identiteta.vloge : [];
    var imena = identiteta && Array.isArray(identiteta.zastopniki) ? identiteta.zastopniki.slice() : [];
    if (!imena.length && identiteta && identiteta.nosilec) imena.push(identiteta.nosilec);
    return imena.reduce(function (rezultat, vrednost) {
      var ime = String(vrednost || "").trim();
      if (!ime || rezultat.some(function (oseba) { return oseba.ime.toLocaleLowerCase("sl-SI") === ime.toLocaleLowerCase("sl-SI"); })) return rezultat;
      var zapisVloge = vloge.find(function (vloga) {
        return String(vloga && vloga.ime || "").trim().toLocaleLowerCase("sl-SI") === ime.toLocaleLowerCase("sl-SI");
      });
      rezultat.push({ ime: ime, vloga: String(zapisVloge && zapisVloge.vloga || "Zastopnik").trim() });
      return rezultat;
    }, []);
  }

  function pravnaOblikaIzNaziva(vrednost) {
    var naziv = String(vrednost || "");
    if (/\bGmbH\s*&\s*Co\.?\s*KG\b/i.test(naziv)) return "GmbH & Co. KG";
    if (/\bUG\s*\(haftungsbeschr(?:ä|a)nkt\)\b/i.test(naziv)) return "UG (haftungsbeschränkt)";
    if (/\be\.?\s*K\.?\b/i.test(naziv)) return "e.K.";
    var zadetek = naziv.match(/\b(?:GmbH|mbH|AG|GbR|OHG|KG|PartG|eG|e\.?\s*V\.?)\b/i);
    return zadetek ? zadetek[0].replace(/^gmbh$/i, "GmbH").replace(/^gbr$/i, "GbR").replace(/^ohg$/i, "OHG") : "";
  }

  function dodatneOdgovorneOsebeBesedilo(stevilo) {
    if (stevilo === 1) return "+ 1 druga oseba";
    if (stevilo === 2) return "+ 2 drugi osebi";
    if (stevilo === 3 || stevilo === 4) return "+ " + stevilo + " druge osebe";
    return "+ " + stevilo + " drugih oseb";
  }

  function povzetekOdgovornihOseb(osebe) {
    if (!osebe.length) return { oznaka: "Osebe", ime: "", opis: "" };
    if (osebe.length === 1) return { oznaka: "Osebe", ime: osebe[0].ime, opis: osebe[0].vloga };
    if (osebe.length === 2) return { oznaka: "Osebe", ime: osebe.map(function (oseba) { return oseba.ime; }).join("\n"), opis: "" };
    return { oznaka: "Osebe", ime: osebe[0].ime, opis: dodatneOdgovorneOsebeBesedilo(osebe.length - 1) };
  }

  function dodajSkupinoKljucnihPodatkov(vrsta, naslov) {
    var skupina = document.createElement("div");
    skupina.className = "boniteta-kljucni-skupina boniteta-kljucni-skupina--" + vrsta;
    skupina.insertAdjacentHTML("beforeend", '<div class="boniteta-kljucni-skupina__naslov">' + esc(naslov) + '</div>');
    hwkPodatki.appendChild(skupina);
    return skupina;
  }

  function ikonaPodjetja(vrsta) {
    var ikone = {
      dejavnost: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6V4h6v2M4 7.5h16v12H4zM4 11c5 3 11 3 16 0M10 11.5h4v3h-4z"/></svg>',
      oseba: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.6-4.4 3-6.5 7.5-6.5s6.9 2.1 7.5 6.5"/></svg>',
      sedez: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.4"/></svg>',
      oblika: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5M10 13h5M10 17h5"/></svg>',
      register: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h16M6 9v9M10 9v9M14 9v9M18 9v9M3 19h18M12 3l9 5H3z"/></svg>',
      sodisce: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h16M6 9v9M10 9v9M14 9v9M18 9v9M3 19h18M12 3l9 5H3z"/></svg>',
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

  function stanjeKarticePodjetja(podatki, identiteta, vrsta, vrednost) {
    if (!vrednost) return "red";
    var lokacija = podatki && podatki.locationMatch || {};
    if (vrsta === "sedez" && lokacija.status === "mismatch") return "red";
    if (["verified_register", "confirmed_impressum"].includes(identiteta.status) && !(podatki && podatki.confirmationRequired)) return "green";
    return "yellow";
  }

  function dodajKarticoPodjetja(dl, vrsta, oznaka, vrednost, stanje, podvrednost) {
    var oznakeStanj = {
      green: { znak: "✓", opis: "Podatek je uradno potrjen" },
      yellow: { znak: "i", opis: "Podatek potrebuje dodatno pozornost" },
      red: { znak: "!", opis: "Podatek manjka ali se ne ujema" },
    };
    var prikazStanja = oznakeStanj[stanje] || oznakeStanj.yellow;
    var najmanjsaVelikost = vrsta === "dejavnost" ? "6" : "8";
    var jeKratkaVrednost = ["oblika", "register", "sodisce"].includes(vrsta);
    var najvecVrstic = vrsta === "dejavnost" ? "4" : vrsta === "sedez" || vrsta === "oseba" ? "2" : jeKratkaVrednost ? "1" : "3";
    var jeVecvrsticnaOseba = vrsta === "oseba" && String(vrednost || "").includes("\n");
    dl.insertAdjacentHTML("beforeend", '<div class="boniteta-podjetje-kartica boniteta-podjetje-kartica--' + vrsta + ' is-state-' + stanje + '">' +
      '<span class="boniteta-podjetje-kartica__ikona">' + ikonaPodjetja(vrsta) + '</span>' +
      '<div class="boniteta-podjetje-kartica__vsebina"><dt data-fit-text data-fit-text-min="6">' + esc(oznaka) + '</dt><dd' + (jeVecvrsticnaOseba ? ' class="is-multiple"' : '') + ' data-fit-text data-fit-text-min="' + najmanjsaVelikost + '" data-fit-text-lines="' + najvecVrstic + '" data-fit-text-container=".boniteta-podjetje-kartica">' + esc(vrednost || "Ni podatka") + '</dd>' + (podvrednost ? '<small data-fit-text data-fit-text-min="6">' + esc(podvrednost) + '</small>' : '') + '</div>' +
      '<span class="boniteta-podjetje-kartica__grafika">' + grafikaPodjetja(vrsta) + '</span>' +
      '<span class="boniteta-podjetje-kartica__kljukica" aria-label="' + prikazStanja.opis + '">' + prikazStanja.znak + '</span>' +
      '</div>');
    if (vrsta === "oseba" && vrednost) {
      var karticaOseb = dl.lastElementChild;
      karticaOseb.classList.add("is-interactive");
      karticaOseb.setAttribute("role", "button");
      karticaOseb.setAttribute("tabindex", "0");
      karticaOseb.setAttribute("aria-controls", "boniteta-podjetje-podrobnosti");
      karticaOseb.setAttribute("aria-label", "Prikaži vse odgovorne osebe");
      karticaOseb.addEventListener("click", function () { nastaviPodjetjePogled("dodatno"); });
      karticaOseb.addEventListener("keydown", function (dogodek) {
        if (dogodek.key !== "Enter" && dogodek.key !== " ") return;
        dogodek.preventDefault();
        nastaviPodjetjePogled("dodatno");
      });
    }
  }

  function izrisiRegistrskoPodjetje(podatki, identiteta) {
    hwkPodatki.innerHTML = "";
    podjetjeKljucni.querySelectorAll("[data-kratki-uvid]").forEach(function (uvid) { uvid.remove(); });
    var jeOseba = identiteta.entityType === "person";
    var ime = identiteta.entityType === "company"
      ? identiteta.naziv || identiteta.ime || "Podjetje"
      : identiteta.ime || identiteta.naziv || "Oseba";
    var naslov = identiteta.naslov || "";
    var kraj = [identiteta.postnaStevilka, identiteta.kraj].filter(Boolean).join(" ");
    podjetjeSklop.classList.add("is-register-card");
    podjetjeSklop.classList.toggle("is-person-card", jeOseba);
    podjetjeGlava.hidden = false;
    podjetjePodnaslov.hidden = false;
    podjetjeMonogram.textContent = zacetniciPodjetja(ime);
    podjetjeIme.textContent = ime;
    podjetjePreverjeno.textContent = opisCasaPreverbe(podatki && podatki.checkedAt).replace(/^p/, "P");
    zadnjiRegistrskiPodatki = podatki;
    zadnjaRegistrskaIdentiteta = identiteta;
    var company = jeOseba ? null : northDataPodjetje(podatki);
    var osebe = odgovorneOsebe(company);
    if (!osebe.length) osebe = odgovorneOsebeIzIdentitete(identiteta);
    var osebePovzetek = povzetekOdgovornihOseb(osebe);
    var datum = !jeOseba && company && company.foundingDate || "";
    var dejavnost = String(company && company.corporatePurpose || identiteta.purpose || "").trim();
    var pravnaOblika = identiteta.legalForm || pravnaOblikaIzNaziva(ime);
    var poslovniNaziv = jeOseba && identiteta.naziv && identiteta.naziv !== identiteta.ime ? identiteta.naziv : "";
    var imaOdgovornoOsebo = osebe.length > 0;
    var sedez = [naslov, kraj].filter(Boolean).join(" · ");
    var stanjaKartic = {
      dejavnost: dejavnost ? stanjeKarticePodjetja(podatki, identiteta, "dejavnost", dejavnost) : null,
      oseba: stanjeKarticePodjetja(podatki, identiteta, "oseba", osebePovzetek.ime),
      sedez: stanjeKarticePodjetja(podatki, identiteta, "sedez", sedez),
      oblika: stanjeKarticePodjetja(podatki, identiteta, "oblika", pravnaOblika),
      register: stanjeKarticePodjetja(podatki, identiteta, "register", identiteta.registerNumber),
      sodisce: stanjeKarticePodjetja(podatki, identiteta, "sodisce", identiteta.registerCourt),
      naziv: stanjeKarticePodjetja(podatki, identiteta, "oblika", poslovniNaziv),
    };
    var vsaStanja = [stanjaKartic.sedez];
    if (dejavnost) vsaStanja.push(stanjaKartic.dejavnost);
    if (jeOseba && poslovniNaziv) vsaStanja.push(stanjaKartic.naziv);
    if (!jeOseba && imaOdgovornoOsebo) vsaStanja.push(stanjaKartic.oseba);
    if (!jeOseba && pravnaOblika) vsaStanja.push(stanjaKartic.oblika);
    if (identiteta.registerNumber) vsaStanja.push(stanjaKartic.register);
    if (!jeOseba && !imaOdgovornoOsebo && identiteta.registerCourt) vsaStanja.push(stanjaKartic.sodisce);
    var stanjeMreze = vsaStanja.includes("red") ? "red" : vsaStanja.includes("yellow") ? "yellow" : "green";
    var potrjenaStanja = vsaStanja.filter(function (stanje) { return stanje === "green"; }).length;
    var pregledNaslov = identiteta.active === true ? "Ja — podjetje je v registru aktivno." : identiteta.active === false ? "Pozor — register kaže neaktivno podjetje." : "Status podjetja v viru ni določen.";
    var pregledKratko = "Na enem mestu je prikazanih " + vsaStanja.length + " ključnih podatkov podjetja.";
    var pregledPodrobno = potrjenaStanja + " od " + vsaStanja.length + " prikazanih podatkov ima potrjeno stanje; ostali so jasno označeni za dodatno pozornost.";
    hwkPodatki.classList.remove("is-state-green", "is-state-yellow", "is-state-red");
    hwkPodatki.classList.add("is-state-" + stanjeMreze);
    // Postavitev je odvisna od dejansko prikazanih polj, ne od vira. Tako
    // prazna North Data polja ne ustvarijo nevidnega stolpca ali prekrivanja.
    hwkPodatki.classList.remove("has-northdata");
    hwkPodatki.classList.add("is-grouped");
    hwkPodatki.classList.toggle("has-responsible", imaOdgovornoOsebo);
    hwkPodatki.classList.toggle("has-purpose", Boolean(dejavnost));
    hwkPodatki.classList.toggle("is-person", jeOseba);
    podjetjeUstanovitev.hidden = !datum;
    if (datum) {
      var starost = starostPodjetja(datum);
      podjetjeUstanovitevDatum.textContent = formatirajDatumPodjetja(datum);
      podjetjeUstanovitevLeta.textContent = starost.leta;
      podjetjeUstanovitevLetaEnota.textContent = starost.letaEnota;
      podjetjeUstanovitevMeseci.textContent = "in " + starost.meseci;
      podjetjeUstanovitevMeseciEnota.textContent = starost.meseciEnota;
      podjetjeUstanovitevStarost.setAttribute("aria-label", starost.leta + " " + starost.letaEnota + " in " + starost.meseci + " " + starost.meseciEnota + " poslovanja");
    }
    if (podjetjeStatusPodjetja) {
      var podjetjeJeAktivno = identiteta.active === true;
      var podjetjeJeNeaktivno = identiteta.active === false;
      podjetjeStatusPodjetja.textContent = podjetjeJeAktivno ? "Aktivno" : podjetjeJeNeaktivno ? "Neaktivno" : "Ni podatka";
      podjetjeStatusPodjetja.classList.toggle("is-active", podjetjeJeAktivno);
      podjetjeStatusPodjetja.classList.toggle("is-inactive", podjetjeJeNeaktivno);
      podjetjeStatusPodjetja.classList.toggle("is-unknown", !podjetjeJeAktivno && !podjetjeJeNeaktivno);
    }
    var podatkiSeznam = dodajSkupinoKljucnihPodatkov("seznam", "Podatki");
    podatkiSeznam.insertAdjacentHTML("afterbegin", kratkiUvidHtml(pregledNaslov, pregledKratko, pregledPodrobno));
    dodajKarticoPodjetja(podatkiSeznam, "sedez", jeOseba ? "Naslov" : "Sedež", sedez, stanjaKartic.sedez);
    if (dejavnost) dodajKarticoPodjetja(podatkiSeznam, "dejavnost", "Dejavnost", dejavnost, stanjaKartic.dejavnost);
    if (jeOseba && poslovniNaziv) dodajKarticoPodjetja(podatkiSeznam, "oblika", "Poslovni naziv", poslovniNaziv, stanjaKartic.naziv);
    if (!jeOseba && imaOdgovornoOsebo) dodajKarticoPodjetja(podatkiSeznam, "oseba", osebePovzetek.oznaka, osebePovzetek.ime, stanjaKartic.oseba, osebePovzetek.opis);
    if (identiteta.registerNumber || (!jeOseba && pravnaOblika)) dodajKarticoPodjetja(podatkiSeznam, "register", "Register", [pravnaOblika, identiteta.registerNumber].filter(Boolean).join(" · "), stanjaKartic.register);
    if (!jeOseba && !imaOdgovornoOsebo && identiteta.registerCourt) dodajKarticoPodjetja(podatkiSeznam, "sodisce", "Sodišče", identiteta.registerCourt, stanjaKartic.sodisce);
    podjetjePregled.hidden = false;
    podjetjeNavigacija.hidden = false;
    posodobiRazpolozljivostPodjetjePogledov(company);
    nastaviPodjetjePogled("kljucni");
    window.setTimeout(function () {
      sproziUtripFinancnegaOpozorila(podjetjePregled.querySelector('[data-podjetje-pogled="izstopa"]'));
    }, 260);
  }

  window.UJBonitetaPrikaziRegistrskoPodjetje = function (podatki) {
    var identiteta = podatki && podatki.identity || {};
    var naslov = document.getElementById("boniteta-identiteta-naslov");
    var jeOseba = identiteta.entityType === "person";
    var jeRocno = ["manual_input", "confirmed_manual"].includes(identiteta.status);
    var jeImpressum = ["probable_impressum", "confirmed_impressum"].includes(identiteta.status);
    var statusBesedilo = jeRocno
      ? identiteta.status === "confirmed_manual" ? "Uporabnik potrdil" : "Preveri podatke"
      : jeImpressum
      ? identiteta.status === "confirmed_impressum" ? "Potrjeno" : "Preveri podatke"
      : identiteta.active === true ? "Aktivno" : identiteta.active === false ? "Neaktivno" : "Status ni znan";
    var statusRazred = jeRocno
      ? "boniteta-znacka--yellow"
      : jeImpressum
      ? identiteta.status === "confirmed_impressum" ? "boniteta-znacka--green" : "boniteta-znacka--yellow"
      : identiteta.active === true ? "boniteta-znacka--green" : identiteta.active === false ? "boniteta-znacka--red" : "boniteta-znacka--yellow";
    if (!identiteta.ime && !identiteta.naziv) return;
    document.body.classList.add("boniteta-register-result");
    hwkPodatki.innerHTML = "";
    hwkStatus.textContent = statusBesedilo;
    hwkStatus.className = "boniteta-znacka " + statusRazred;
    if (naslov) naslov.textContent = jeOseba ? "Podatki osebe" : "Podatki podjetja";
    if (podjetjePregled) podjetjePregled.setAttribute("aria-label", jeOseba ? "Podatki osebe" : "Podatki podjetja");
    if (insolvencaNazaj) insolvencaNazaj.setAttribute("aria-label", jeOseba ? "Nazaj na podatke osebe" : "Nazaj na podatke podjetja");
    if (insolvencaNazajSpodaj) insolvencaNazajSpodaj.textContent = jeOseba ? "Nazaj na podatke osebe" : "Nazaj na podatke podjetja";
    izrisiRegistrskoPodjetje(podatki, identiteta);
    if (identitetaNadaljuj) identitetaNadaljuj.hidden = false;
    if (window.UJPrilagodiVelikostBesedila) podjetjeSklop.querySelectorAll("[data-fit-text]").forEach(window.UJPrilagodiVelikostBesedila);
  };

  window.UJBonitetaPonastaviRegistrskoPodjetje = function () {
    document.body.classList.remove("boniteta-register-result");
    podjetjeSklop.classList.remove("is-register-card", "is-person-card");
    podjetjeGlava.hidden = true;
    podjetjePregled.hidden = true;
    podjetjeUstanovitev.hidden = true;
    podjetjePodrobnosti.innerHTML = "";
    zadnjiProfilId = "";
    zadnjiRegistrskiPodatki = null;
    zadnjaRegistrskaIdentiteta = null;
    hwkPodatki.classList.remove("is-state-green", "is-state-yellow", "is-state-red", "has-northdata", "has-responsible", "has-purpose", "is-grouped", "is-person");
    izbraniPodjetjePogled = "kljucni";
    if (identitetaNadaljuj) identitetaNadaljuj.hidden = true;
  };

  function prikazljivUradniInsolvencniPosnetek(official) {
    if (!official || official.evidenceStatus !== "captured") return "";
    var ujemanje = /^data:(image\/(?:jpeg|png|webp));base64,([\s\S]+)$/i.exec(String(official.evidenceImage || "").trim());
    if (!ujemanje) return "";
    var base64 = ujemanje[2].replace(/\s/g, "");
    if (!base64 || !/^(?:[a-z0-9+/]{4})*(?:[a-z0-9+/]{2}==|[a-z0-9+/]{3}=)?$/i.test(base64)) return "";
    return "data:" + ujemanje[1].toLowerCase() + ";base64," + base64;
  }

  function izrisiMetodologijo(podatki) {
    var ovoj = document.getElementById("boniteta-metodologija");
    if (!ovoj) return;
    var identiteta = podatki && podatki.identity || {};
    var lokacija = podatki && podatki.locationMatch || {};
    var insolvenca = podatki && podatki.insolvency || {};
    var uradno = insolvenca.officialVerification || {};
    var vhod = uradno.inputVerification || {};
    var imaPosnetek = Boolean(prikazljivUradniInsolvencniPosnetek(uradno));
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
    if ((uradno.status === "confirmed_match" || insolvenca.status === "possible_match") && imaPosnetek) {
      naslov = "Najdena je možna insolvenčna objava.";
      opis = "Pred odločitvijo preglejte uradni posnetek in vse prikazane objave.";
      ton = "alert";
    } else if ((uradno.status === "clear" || uradno.status === "confirmed_match" || ["clear", "possible_match"].includes(insolvenca.status)) && !imaPosnetek) {
      naslov = "Uradni posnetek ni na voljo.";
      opis = "Rezultat brez prikazljivega uradnega posnetka ni dokončan. Preverjanje ponovite.";
      ton = "review";
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

  function sestaviPrimerjalnePodatke(podatki) {
    var identiteta = podatki && podatki.identity || {};
    var insolvenca = podatki && podatki.insolvency || {};
    var company = northDataPodjetje(podatki);
    var details = northDataPodrobnosti(podatki);
    var bilanca = zadnjaDopolnilnaBilanca(details);
    var pregled = [], finance = [];
    function dodajPregled(key, label, value, source) {
      var zapis = value === 0 ? "0" : String(value == null ? "" : value).trim();
      if (zapis) pregled.push({ key: key, label: label, value: zapis, source: source });
    }
    function dodajFinance(key, label, raw, value, year, kind, series) {
      var stevilo = Number(raw);
      if (!Number.isFinite(stevilo)) return;
      finance.push({ key: key, label: label, raw: stevilo, value: value, year: year || "", kind: kind || "money", source: "North Data", series: (Array.isArray(series) ? series : []).map(function (vnos) { return { year: Number(vnos.year), value: Number(vnos.value) }; }).filter(function (vnos) { return Number.isFinite(vnos.year) && Number.isFinite(vnos.value); }) });
    }
    var sedez = [identiteta.naslov, [identiteta.postnaStevilka, identiteta.kraj].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    dodajPregled("status", "Status", identiteta.active === true ? "Aktivno" : identiteta.active === false ? "Neaktivno" : "", "OpenRegister");
    dodajPregled("insolvency", "Insolventnost", insolvenca.status === "clear" ? "Brez zadetka" : insolvenca.status === "possible_match" ? "Možen zadetek" : insolvenca.status ? "Preverjanje ni zaključeno" : "", "OpenRegister");
    dodajPregled("legalForm", "Pravna oblika", identiteta.legalForm, "OpenRegister");
    dodajPregled("registerNumber", "Register", identiteta.registerNumber, "OpenRegister");
    dodajPregled("registerCourt", "Registrsko sodišče", identiteta.registerCourt, "OpenRegister");
    dodajPregled("headquarters", "Sedež", sedez, "OpenRegister");
    dodajPregled("foundingDate", "Ustanovljeno", company && company.foundingDate ? formatirajDatumPodjetja(company.foundingDate) : "", "North Data");
    dodajPregled("purpose", "Dejavnost", company && company.corporatePurpose || identiteta.purpose, company && company.corporatePurpose ? "North Data" : "OpenRegister");
    var odgovorne = company && Array.isArray(company.officers) ? company.officers.filter(function (oseba) { return statusOsebe(oseba) === "current"; }).map(function (oseba) { return String(oseba.name || [oseba.givenName, oseba.familyName].filter(Boolean).join(" ")).trim(); }).filter(Boolean) : [];
    dodajPregled("management", "Vodstvo", odgovorne.join(", "), "North Data");
    var povezane = company && Array.isArray(company.relatedCompanies) ? company.relatedCompanies.filter(function (v) { return v && (v.name || v.registerKey); }) : [];
    if (povezane.length) dodajPregled("relatedCompanies", "Povezana podjetja", povezane.length.toLocaleString("sl-SI"), "North Data");
    var euid = company && Array.isArray(company.nationalIds) ? company.nationalIds.find(function (v) { return v && v.value && /euid/i.test(String(v.source)); }) : null;
    dodajPregled("euid", "EUID", euid && euid.value, "North Data");
    dodajPregled("lei", "LEI", company && company.leiCode, "North Data");

    var rezultatSerija = financnaSerija(company, "earnings"), sredstvaSerija = financnaSerija(company, "assets");
    var rezultat = rezultatSerija.slice(-1)[0];
    var sredstva = sredstvaSerija.slice(-1)[0];
    if (rezultat) dodajFinance("earnings", "Poslovni rezultat", rezultat.value, formatirajDenar(rezultat.value, true), rezultat.year, "money", rezultatSerija);
    if (sredstva) dodajFinance("assets", "Bilančna vsota", sredstva.value, formatirajDenar(sredstva.value, true), sredstva.year, "money", sredstvaSerija);
    var oznake = { Cash: "Denarna sredstva", Receivables: "Terjatve", Liabilities: "Obveznosti", Equity: "Lastniški kapital", EquityRatio: "Delež kapitala", ROE: "Donos na kapital", Employees: "Zaposleni" };
    var vrste = { EquityRatio: "percent", ROE: "percent", Employees: "count" };
    if (bilanca && bilanca.items) Object.keys(bilanca.items).forEach(function (key) {
      var item = bilanca.items[key];
      if (!item || !Number.isFinite(Number(item.value))) return;
      var kind = vrste[key] || "money";
      var prikaz = kind === "percent" ? Number(item.value).toLocaleString("sl-SI", { maximumFractionDigits: 1 }) + " %"
        : kind === "count" ? Number(item.value).toLocaleString("sl-SI", { maximumFractionDigits: 0 })
          : formatirajDenar(Number(item.value), true);
      var podrobnaSerija = (details && Array.isArray(details.financials) ? details.financials : []).map(function (izkaz) { var postavka = izkaz && izkaz.items && izkaz.items[key]; return { year: Number(izkaz && izkaz.fiscalYear), value: Number(postavka && postavka.value) }; }).filter(function (vnos) { return Number.isFinite(vnos.year) && Number.isFinite(vnos.value); }).sort(function (a, b) { return a.year - b.year; });
      if (key === "Employees") {
        dodajPregled("employees", "Zaposleni", (item.estimate ? "pribl. " : "") + prikaz, "North Data");
        return;
      }
      dodajFinance("detail:" + key, oznake[key] || key, item.value, prikaz, bilanca.fiscalYear, kind, podrobnaSerija);
    });
    var signalniModel = company ? modelSignalovPodjetja(company) : { allSignals: [] };
    var opozorila = (signalniModel.allSignals || []).filter(function (signal) { return signal && (signal.tone === "warning" || signal.tone === "critical"); }).map(function (signal) {
      return { key: signal.id || signal.title, label: signal.title || signal.label || "Opozorilo", tone: signal.tone, category: signal.category || "data", detail: signal.summary || signal.description || "" };
    });
    var governance = window.UJBauhandwerkersicherung ? window.UJBauhandwerkersicherung.detectChanges({ checkedAt: podatki && podatki.checkedAt, events: (company && Array.isArray(company.events) ? company.events : []).map(function (event) { return Object.assign({}, event, { type: event.type || event.category, source: event.source || "Registrski dogodek", sourceUrl: event.sourceUrl || podatki && podatki.northData && podatki.northData.sourceUrl || "" }); }) }) : { status: "unverifiable", tone: "yellow", changes: [] };
    if (governance.status === "verified_change") opozorila.push({ key: "governance_change", label: "Vodstvo in lastništvo", tone: governance.tone === "red" ? "critical" : "warning", category: "governance", detail: governance.message });
    return { overview: pregled, finance: finance, warnings: opozorila, warningsAvailable: Boolean(company), governance: governance, sources: ["OpenRegister", company || details ? "North Data" : ""].filter(Boolean) };
  }

  window.UJBonitetaSestaviPrimerjalnePodatke = sestaviPrimerjalnePodatke;

  window.UJBonitetaSestaviPrimerjalnePodatke = sestaviPrimerjalnePodatke;

  function izrisi(podatki, moznostiPrikaza) {
    nastaviMonitoringPrimerjavo(false);
    window.UJBonitetaZadnjiRezultat = podatki;
    window.dispatchEvent(new CustomEvent("uj:boniteta:result-data", { detail: { data: podatki } }));
    var jeLokalniAudit = Boolean(moznostiPrikaza && moznostiPrikaza.lokalniAudit === true &&
      /^(?:localhost|127\.0\.0\.1)$/.test(window.location.hostname));
    if (jeNeuspesnaSpletnaIdentifikacija(podatki)) {
      nastaviSpletnoRezervo(true, opisNeuspeleSpletnePoizvedbe(podatki), podatki && podatki.publicProfile && podatki.publicProfile.reason);
      return;
    }
    if (jeNeuspesnaRegistrskaIdentifikacija(podatki)) {
      prikaziPotPoNeuspesnemRegistrskemIskanju(zadnjiVnos && zadnjiVnos.ime, "podjetje");
      return;
    }
    var nadaljujVInsolvencnemOknu = document.body.classList.contains("boniteta-insolvenca-je-okno");
    if (inlineProfil && !(podatki && podatki.__shranjeniProfil)) inlineProfil.hidden = true;
    generacijaRezultata += 1;
    var mojaGeneracija = generacijaRezultata;
    zadnjiProfilId = "";
    zadnjiRegistrskiPodatki = null;
    zadnjaRegistrskaIdentiteta = null;
    nastaviRazsiritveOdprte(false);
    var vnosObRezultatu = zadnjiVnos ? Object.assign({}, zadnjiVnos) : null;
    var sklep = podatki.result || {};
    rezultat.className = "boniteta-rezultat boniteta-rezultat--" + (sklep.level || "yellow");

    var hwkVir = document.getElementById("boniteta-hwk-vir");
    var profil = podatki.publicProfile || {};
    var openregister = podatki.openregister || {};
    var identiteta = podatki.identity || {};
    var insolvencniStatus = podatki.insolvency && podatki.insolvency.status;
    var imaPrikazljivUradniPosnetek = Boolean(prikazljivUradniInsolvencniPosnetek(
      podatki.insolvency && podatki.insolvency.officialVerification
    ));
    var jeZakljucenShranjeniRezultat = jeZakljucenShranjeniInsolvencniRezultat(podatki);
    zadnjiInsolvencniRezultatPripravljen = !podatki.confirmationRequired && Boolean(
      ["clear", "possible_match"].includes(insolvencniStatus) && (imaPrikazljivUradniPosnetek || jeZakljucenShranjeniRezultat)
    );
    var imaNedokoncanoInsolvencnoPreverbo = Boolean(insolvencniStatus && insolvencniStatus !== "not_checked" && !zadnjiInsolvencniRezultatPripravljen);
    nastaviKarticoInsolvenceZaNadaljevanje(podatki);
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
    var identitetaCas = document.getElementById("boniteta-identiteta-cas");
    var identitetaUrl = document.getElementById("boniteta-identiteta-url");
    var identitetaDokaziloStatus = document.getElementById("boniteta-identiteta-dokazilo-status");
    var omejitev = document.getElementById("boniteta-omejitev");
    hwkPodatki.innerHTML = "";
    document.body.classList.remove("boniteta-register-result");
    podjetjeSklop.classList.remove("is-register-card");
    podjetjeGlava.hidden = true;
    podjetjePodnaslov.hidden = true;
    if (identitetaNadaljuj) identitetaNadaljuj.hidden = true;
    hwkVir.hidden = false;
    identitetaPosnetek.hidden = true;
    identitetaSlika.removeAttribute("src");
    identitetaDokaziloStatus.hidden = true;
    identitetaDokaziloStatus.className = "boniteta-dokazilo-status";
    identitetaDokaziloStatus.textContent = "";
    potrditevIdentitete.hidden = true;
    potrditevDokaziloPripravljeno = false;
    potrditevCheckbox.checked = false;
    potrditevIdentitete.classList.remove("is-confirmed");
    potrditvenaPolja().forEach(function (polje) { polje.readOnly = false; });
    potrditevGumb.disabled = true;
    if (potrditevDokaz) potrditevDokaz.hidden = true;
    if (potrditevDokazSlika) potrditevDokazSlika.removeAttribute("src");
    if (potrditevApiDokaz) {
      potrditevApiDokaz.hidden = true;
      potrditevApiDokaz.dataset.ready = "false";
    }
    if (potrditevDokazNapaka) potrditevDokazNapaka.hidden = true;
    var identitetaImaKompaktniPrikaz = Boolean(identiteta.ime || identiteta.naziv) && [
      "verified_register", "probable_impressum", "confirmed_impressum", "manual_input", "confirmed_manual",
    ].includes(identiteta.status);
    if (identitetaImaKompaktniPrikaz) {
      window.UJBonitetaPrikaziRegistrskoPodjetje(podatki);
      if (identiteta.status === "verified_register") {
        hwkVir.href = openregister.sourceUrl || "https://openregister.de";
        hwkVir.textContent = "Odpri register podjetij ↗";
      } else if (["probable_impressum", "confirmed_impressum"].includes(identiteta.status)) {
        hwkVir.href = profil.sourceUrl || identiteta.sourceUrl || "#";
        hwkVir.textContent = identiteta.entityType === "person" ? "Odpri uporabljeni vir ↗" : "Odpri Impressum podjetja ↗";
      } else {
        hwkVir.hidden = true;
      }
    } else {
      prikaziPotPoNeuspesnemRegistrskemIskanju(zadnjiVnos && zadnjiVnos.ime, "podjetje");
      return;
    }

    if (omejitev) {
      var openregisterRazlog = podatki && podatki.openregister && podatki.openregister.reason;
      omejitev.textContent = identiteta.status === "verified_register"
        ? "Identiteta je pridobljena iz registra. Odsotnost insolvenčnega zadetka kljub temu ni popolna bonitetna garancija."
        : identiteta.status === "confirmed_impressum"
          ? "Podatke iz Impressuma ste potrdili. North Data in uradna insolvenčna poizvedba se izvedeta v naslednjem koraku; rezultat ni bonitetna garancija."
          : identiteta.status === "probable_impressum" && openregisterRazlog === "insufficient_credits"
            ? "OpenRegisterjev ključ, ki ga uporablja aplikacija, trenutno nima dostopa do API kvote. Podatki so razbrani iz Impressuma; potrdite jih za nadaljevanje z North Data in insolvenčno preverbo."
            : identiteta.status === "probable_impressum"
              ? "Podatki so razbrani iz Impressuma in še niso potrjeni. Pred North Data in insolvenčno preverbo jih primerjajte s prikazanim virom."
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
      document.getElementById("boniteta-potrditev-kljukica").textContent = "Podatki so pravilni";
      document.getElementById("boniteta-potrditev-kljukica-opis").textContent = jeRocniVnos
        ? "Za nadaljevanje je potreben preverljiv vir"
        : "Potrdite za nadaljevanje";
      var potrjujePravnoDruzbo = identiteta.entityType === "company";
      var potrdiImePolje = document.getElementById("boniteta-potrdi-ime");
      var potrdiNazivPolje = document.getElementById("boniteta-potrdi-naziv");
      var potrdiNazivOvoj = document.getElementById("boniteta-potrdi-naziv-ovoj");
      var potrdiNosilecPolje = document.getElementById("boniteta-potrdi-nosilec");
      var potrdiNosilecOvoj = document.getElementById("boniteta-potrdi-nosilec-ovoj");
      document.getElementById("boniteta-potrdi-ime-oznaka").firstChild.nodeValue = potrjujePravnoDruzbo ? "Pravno ime " : "Osebno ime ";
      potrdiImePolje.value = potrjujePravnoDruzbo
        ? (identiteta.naziv || identiteta.ime || (zadnjiVnos && zadnjiVnos.ime) || "")
        : (identiteta.ime || (zadnjiVnos && zadnjiVnos.ime) || "");
      document.getElementById("boniteta-potrdi-naziv").value = identiteta.poslovniNaziv || identiteta.naziv || identiteta.ime || (zadnjiVnos && zadnjiVnos.ime) || "";
      potrdiNazivOvoj.hidden = potrdiNazivPolje.value.trim().toLocaleLowerCase("de") === potrdiImePolje.value.trim().toLocaleLowerCase("de");
      potrdiNosilecPolje.value = identiteta.nosilec || "";
      potrdiNosilecOvoj.hidden = !potrjujePravnoDruzbo && !identiteta.nosilec;
      document.getElementById("boniteta-potrdi-naslov").value = identiteta.naslov || (zadnjiVnos && zadnjiVnos.naslov) || "";
      document.getElementById("boniteta-potrdi-posta").value = identiteta.postnaStevilka || (zadnjiVnos && zadnjiVnos.postnaStevilka) || "";
      document.getElementById("boniteta-potrdi-kraj").value = identiteta.kraj || (zadnjiVnos && zadnjiVnos.kraj) || "";
      [potrdiImePolje, potrdiNazivPolje, potrdiNosilecPolje,
        document.getElementById("boniteta-potrdi-naslov"), document.getElementById("boniteta-potrdi-posta"),
        document.getElementById("boniteta-potrdi-kraj")].forEach(prilagodiVnos);
      document.getElementById("boniteta-potrdi-checkbox").checked = false;
      posodobiPotrditevIdentitete();
    }
    if (identitetaNadaljuj && (podatki.confirmationRequired || zadnjiInsolvencniRezultatPripravljen || imaNedokoncanoInsolvencnoPreverbo || identiteta.status === "verified_register")) {
      var nadaljujNaslov = identitetaNadaljuj.querySelector(".boniteta-identiteta-nadaljuj__vsebina > strong");
      var nadaljujOpis = identitetaNadaljuj.querySelector(".boniteta-identiteta-nadaljuj__vsebina > span");
      identitetaNadaljuj.hidden = false;
      if (identiteta.status !== "verified_register") {
        if (nadaljujNaslov) nadaljujNaslov.textContent = zadnjiInsolvencniRezultatPripravljen ? "Preverba je zaključena" : "Podatki so pripravljeni za pregled";
        if (nadaljujOpis) nadaljujOpis.textContent = zadnjiInsolvencniRezultatPripravljen
          ? "Odprite rezultat insolvenčne preverbe za potrjene podatke."
          : "Pred uradno poizvedbo preverite ime in celoten naslov.";
      }
    }
    if (zadnjiInsolvencniRezultatPripravljen) nastaviKarticoInsolvenceZakljuceno(podatki);
    else if (imaNedokoncanoInsolvencnoPreverbo) nastaviKarticoInsolvenceNedokoncano(podatki);
    if (insolvencaSklop) insolvencaSklop.hidden = !zadnjiInsolvencniRezultatPripravljen;
    if (nadaljujVInsolvencnemOknu && (podatki.confirmationRequired || zadnjiInsolvencniRezultatPripravljen)) {
      nastaviInsolvencnoOkno(true, zadnjiInsolvencniRezultatPripravljen);
    }

    if (ujemanjeLokacije.status) {
      var vnesenaLokacija = ujemanjeLokacije.entered || {};
      var uradnaLokacija = ujemanjeLokacije.official || {};
      var jeUporabniskaPotrditev = ["user_confirmed", "manual_user_confirmed"].includes(ujemanjeLokacije.confirmationType);
      if (ujemanjeLokacije.status === "matched") {
        if (jeUporabniskaPotrditev) {
          if (!identitetaImaKompaktniPrikaz) dodajPodatek(hwkPodatki, "Potrditev", ujemanjeLokacije.confirmationType === "manual_user_confirmed"
            ? "Podatke je vnesel in potrdil uporabnik; identiteta ni uradno potrjena"
            : "Podatke je s prikazanim Impressumom primerjal uporabnik", "neutral");
          hwkStatus.textContent = "Uporabnik potrdil";
          hwkStatus.className = "boniteta-znacka boniteta-znacka--yellow";
        } else if (identiteta.status !== "verified_register") {
          if (!identitetaImaKompaktniPrikaz) dodajPodatek(hwkPodatki, "Ujemanje", "Ime in naslov se ujemata z registrom", "green");
          hwkStatus.textContent = "Naslov potrjen";
          hwkStatus.className = "boniteta-znacka boniteta-znacka--green";
        }
      } else if (ujemanjeLokacije.status === "mismatch") {
        if (!identitetaImaKompaktniPrikaz) {
          dodajPodatek(hwkPodatki, "Vneseni naslov", [vnesenaLokacija.naslov, vnesenaLokacija.postnaStevilka, vnesenaLokacija.kraj].filter(Boolean).join(", "), "neutral");
          dodajPodatek(hwkPodatki, "Uradni naslov", [uradnaLokacija.naslov, uradnaLokacija.postnaStevilka, uradnaLokacija.kraj].filter(Boolean).join(", "), "green");
          dodajPodatek(hwkPodatki, "Ujemanje", "Podatki se ne ujemajo: " + (ujemanjeLokacije.mismatchedFields || []).join(", "), "amber");
        }
        hwkStatus.textContent = "Naslov se ne ujema";
        hwkStatus.className = "boniteta-znacka boniteta-znacka--red";
      } else {
        if (!identitetaImaKompaktniPrikaz) dodajPodatek(hwkPodatki, "Ujemanje", "Uradni vir nima vseh podatkov za primerjavo", "amber");
        hwkStatus.textContent = "Naslov ni potrjen";
        hwkStatus.className = "boniteta-znacka boniteta-znacka--yellow";
      }
    }

    // OpenRegisterjev strukturirani API-zapis je samostojen uradni dokaz.
    // Zanj posnetek ni potreben; odjemalec zaupa semantični odločitvi strežnika.
    var apiDokaziloIdentitetePripravljeno = dokaziloIdentitete.status === "verified_api" &&
      dokaziloIdentitete.evidenceReady === true &&
      dokaziloIdentitete.evidenceKind === "structured_api";
    if (apiDokaziloIdentitetePripravljeno) {
      potrditevDokaziloPripravljeno = true;
      if (potrditevApiDokaz) {
        potrditevApiDokaz.dataset.ready = "true";
        potrditevApiDokaz.hidden = !podatki.confirmationRequired;
      }
      if (potrditevApiDokazVir) potrditevApiDokazVir.href = dokaziloIdentitete.sourceUrl;
      if (potrditevApiDokazIme) potrditevApiDokazIme.textContent = dokaziloIdentitete.officialName;
      if (potrditevApiDokazNaslov) potrditevApiDokazNaslov.textContent = [
        dokaziloIdentitete.officialStreet,
        [dokaziloIdentitete.officialPostalCode, dokaziloIdentitete.officialCity].filter(Boolean).join(" "),
      ].filter(Boolean).join(", ");
      if (potrditevApiDokazRegister) potrditevApiDokazRegister.textContent = [
        dokaziloIdentitete.registerNumber,
        dokaziloIdentitete.registerCourt,
      ].filter(Boolean).join(" · ");
      if (potrditevApiDokazId) potrditevApiDokazId.textContent = dokaziloIdentitete.companyId;
      if (potrditevApiDokazCas) {
        var apiPreverjenOb = new Date(dokaziloIdentitete.verifiedAt || podatki.checkedAt || Date.now());
        potrditevApiDokazCas.textContent = "Preverjeno " + new Intl.DateTimeFormat("sl-SI", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(apiPreverjenOb) + ". Strukturirani registrski zapis; posnetek ni potreben.";
      }
      identitetaDokaziloStatus.textContent = "Identiteta je potrjena s strukturiranim OpenRegister API-zapisom. Posnetek ni potreben.";
      identitetaDokaziloStatus.className = "boniteta-dokazilo-status is-openregister-preview";
      identitetaDokaziloStatus.hidden = false;
    }

    // Za Impressum oziroma nestrukturiran spletni vir ostane dokazni posnetek.
    var posnetekIdentitetePrikazljiv = prikazanoDokaziloIdentitete.status === "captured" &&
      prikazanoDokaziloIdentitete.screenshotReady === true &&
      /^data:image\/jpeg;base64,/.test(prikazanoDokaziloIdentitete.imageDataUrl || "");
    if (posnetekIdentitetePrikazljiv) {
      identitetaSlika.src = prikazanoDokaziloIdentitete.imageDataUrl;
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
      if (podatki.confirmationRequired && potrditevDokaz && potrditevDokazSlika) {
        potrditevDokaziloPripravljeno = true;
        potrditevDokazSlika.src = prikazanoDokaziloIdentitete.imageDataUrl;
        ponastaviPovecavoPosnetka(potrditevDokazSlika);
        potrditevDokaz.hidden = false;
        potrditevDokazVir.href = /^https?:\/\//i.test(prikazanoDokaziloIdentitete.sourceUrl || "")
          ? prikazanoDokaziloIdentitete.sourceUrl
          : (profil.sourceUrl || identiteta.sourceUrl || "#");
        potrditevDokazCas.textContent = "Zajeto " + new Intl.DateTimeFormat("sl-SI", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(identitetaPreverjenaOb);
      }
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
    if (podatki.confirmationRequired && !potrditevDokaziloPripravljeno && potrditevDokazNapaka) {
      potrditevDokazNapaka.textContent = "Preverljiv uradni dokaz identitete ni na voljo. Zaradi varnosti insolvenčne poizvedbe ni mogoče nadaljevati.";
      potrditevDokazNapaka.hidden = false;
    }
    posodobiPotrditevIdentitete();

    izrisiVire(podatki.sources);

    var insolvenca = podatki.insolvency || {};
    var insolvencaStatus = document.getElementById("boniteta-insolvenca-status");
    var insolvencaOpis = document.getElementById("boniteta-insolvenca-opis");
    var insolvencaIzidIkona = document.getElementById("boniteta-insolvenca-izid-ikona");
    var insolvencaIzidZnacka = document.getElementById("boniteta-insolvenca-izid-znacka");
    var insolvencaPodatki = document.getElementById("boniteta-insolvenca-podatki");
    var insolvencaApiVir = document.getElementById("boniteta-insolvenca-api-vir");
    var insolvencaPosnetek = document.getElementById("boniteta-insolvenca-posnetek");
    var insolvencaSlika = document.getElementById("boniteta-insolvenca-slika");
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
    var prikazljivPosnetek = prikazljivUradniInsolvencniPosnetek(uradnaPotrditev);
    var preverjenaPolja = uradnaPotrditev.inputVerification && uradnaPotrditev.inputVerification.fields || {};
    var oznaceniToni = uradnaPotrditev.screenshotAnnotation && Array.isArray(uradnaPotrditev.screenshotAnnotation.highlightedTones)
      ? uradnaPotrditev.screenshotAnnotation.highlightedTones : [];
    var imaBarvniDokaz = Boolean(prikazljivPosnetek) &&
      uradnaPotrditev.inputVerification && uradnaPotrditev.inputVerification.status === "matched" &&
      uradnaPotrditev.screenshotAnnotation && uradnaPotrditev.screenshotAnnotation.status === "applied";
    var barvniNamig = document.getElementById("boniteta-barvna-primerjava-namig");
    var iskanoIme = String(insolvenca.searchedName || identiteta.ime || "").trim();
    var iskaniKraj = String(insolvenca.searchedCity || identiteta.kraj || "");
    var jeIskanaOseba = Boolean(String(preverjenaPolja.ime || "").trim());
    var imeIzObrazca = (jeIskanaOseba
      ? [preverjenaPolja.ime, preverjenaPolja.firmaPriimek]
      : [preverjenaPolja.firmaPriimek, preverjenaPolja.ime]).filter(Boolean).join(" ");
    var prikazanoIskalnoIme = imeIzObrazca || iskanoIme;
    var imaWildcardIme = /[*?]/.test(prikazanoIskalnoIme);
    var oznakaImena = jeIskanaOseba
      ? (imaWildcardIme ? "Iskalni niz osebe" : "Ime in priimek")
      : (imaWildcardIme ? "Iskalni niz podjetja" : "Ime podjetja");
    var registerIzObrazca = [preverjenaPolja.registrskoSodisce,
      [preverjenaPolja.vrstaRegistra, preverjenaPolja.registrskaStevilka].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
    var zadevaIzObrazca = [preverjenaPolja.oddelek, preverjenaPolja.oznaka,
      preverjenaPolja.stevilka && preverjenaPolja.leto ? preverjenaPolja.stevilka + "/" + preverjenaPolja.leto : ""].filter(Boolean).join(" ");
    var prikazaniToni = {
      blue: Boolean(imaBarvniDokaz && oznaceniToni.includes("blue") && imeIzObrazca),
      green: Boolean(imaBarvniDokaz && oznaceniToni.includes("green") && String(preverjenaPolja.kraj || "").trim()),
      violet: Boolean(imaBarvniDokaz && oznaceniToni.includes("violet") && registerIzObrazca),
      amber: Boolean(imaBarvniDokaz && oznaceniToni.includes("amber") && zadevaIzObrazca),
    };
    var imaPrikazanoBarvnoPovezavo = Object.keys(prikazaniToni).some(function (ton) { return prikazaniToni[ton]; });
    if (barvniNamig) barvniNamig.hidden = !imaPrikazanoBarvnoPovezavo;
    var legendaPrimerjave = insolvencaPosnetek.querySelector(".boniteta-barvna-primerjava__legenda");
    if (legendaPrimerjave) {
      legendaPrimerjave.hidden = !imaPrikazanoBarvnoPovezavo;
      legendaPrimerjave.querySelectorAll("[data-primerjava-ton]").forEach(function (znacka) {
        var ton = znacka.dataset.primerjavaTon;
        if (ton === "blue") znacka.textContent = oznakaImena;
        znacka.hidden = !prikazaniToni[ton];
      });
    }
    var potrjenoPravnoIme = String(identiteta.naziv || identiteta.ime || "").trim();
    if (imaWildcardIme && potrjenoPravnoIme && normalizirajAutocompleteBesede(potrjenoPravnoIme) !== normalizirajAutocompleteBesede(prikazanoIskalnoIme)) {
      dodajPodatek(insolvencaPodatki, jeIskanaOseba ? "Potrjeno ime" : "Potrjeno pravno ime", potrjenoPravnoIme, "neutral");
    }
    dodajPodatek(insolvencaPodatki, oznakaImena, prikazanoIskalnoIme, prikazaniToni.blue ? "blue" : "neutral");
    dodajPodatek(insolvencaPodatki, "Kraj", preverjenaPolja.kraj || iskaniKraj, prikazaniToni.green ? "green" : "neutral");
    if (registerIzObrazca || uradnaPotrditev.searchedRegister) {
      dodajPodatek(insolvencaPodatki, "Register", registerIzObrazca || uradnaPotrditev.searchedRegister, prikazaniToni.violet ? "violet" : "neutral");
    }
    if (zadevaIzObrazca || uradnaPotrditev.searchedCaseNumber) {
      dodajPodatek(insolvencaPodatki, "Zadeva", zadevaIzObrazca || uradnaPotrditev.searchedCaseNumber, prikazaniToni.amber ? "amber" : "neutral");
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
      var uradniStatus = !prikazljivPosnetek && ["clear", "confirmed_match"].includes(uradnaPotrditev.status)
        ? "Posnetek ni na voljo"
        : {
        confirmed_match: "Isti postopek potrjen",
        clear: "Brez objave",
        unverified: "Zadetek se ne ujema",
        unavailable: "Rezultat ni bil osvežen",
      }[uradnaPotrditev.status] || "Ni potrjeno";
      dodajPodatek(insolvencaPodatki, "Uradni insolvenčni register", uradniStatus, "neutral");
    }
    if (insolvenca.status === "clear") {
      var uradnoBrezZadetka = uradnaPotrditev.status === "clear" && Boolean(prikazljivPosnetek);
      insolvencaStatus.textContent = samoUradniPortal
        ? (uradnoBrezZadetka ? "Ni najdenih insolvenčnih objav" : uradnaPotrditev.status === "clear" ? "Uradni posnetek ni na voljo" : "Uradni vir ni potrjen")
        : (uradnoBrezZadetka ? "Ni najdenih insolvenčnih objav" : uradnaPotrditev.status === "clear" ? "Uradni posnetek ni na voljo" : "Drugi vir ni potrjen");
      insolvencaStatus.className = "boniteta-znacka boniteta-znacka--" + (uradnoBrezZadetka && identiteta.status !== "confirmed_impressum" ? "green" : "yellow");
      insolvencaOpis.textContent = uradnoBrezZadetka
        ? "Za preverjene iskalne podatke v uradnem insolvenčnem registru ni bila najdena objava."
        : uradnaPotrditev.status === "clear"
        ? "Rezultat brez prikazljivega uradnega posnetka ni dokončan. Preverjanje ponovite."
        : "OpenRegister ni vrnil objave, vendar preverjanja na državnem portalu ni bilo mogoče dokončati.";
    } else if (insolvenca.status === "possible_match") {
      var dvojnoPotrjeno = uradnaPotrditev.status === "confirmed_match" && Boolean(prikazljivPosnetek);
      if (!prikazljivPosnetek) {
        insolvencaStatus.textContent = "Uradni posnetek ni na voljo";
        insolvencaStatus.className = "boniteta-znacka boniteta-znacka--yellow";
        insolvencaOpis.textContent = "Rezultat brez prikazljivega uradnega posnetka ni dokončan. Preverjanje ponovite.";
      } else {
        insolvencaStatus.textContent = samoUradniPortal ? "Možen zadetek v uradnem registru" : (dvojnoPotrjeno ? "Potrjeno v dveh virih" : "Možen zadetek");
        insolvencaStatus.className = "boniteta-znacka boniteta-znacka--red";
        insolvencaOpis.textContent = samoUradniPortal
          ? "Uradni portal Insolvenzbekanntmachungen je vrnil možen postopek za potrjeno ime in kraj. Preglejte objavo in posnetek."
          : dvojnoPotrjeno
          ? "OpenRegister in državni portal sta vrnila isti postopek za isto pravno osebo, kraj in registrsko številko."
          : "OpenRegister je vrnil najmanj en možen postopek, državni portal pa istega postopka ni dokončno potrdil. Potreben je ročni pregled.";
      }
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
      } else if (insolvenca.reason === "official_identity_evidence_unavailable") {
        insolvencaOpis.textContent = "OpenRegister je našel podjetje, vendar strukturiranega dokaza ni bilo mogoče varno shraniti. Samodejno nadaljevanje je ustavljeno.";
      } else if (insolvenca.reason === "official_identity_incomplete") {
        insolvencaOpis.textContent = "OpenRegisterjev zapis nima celotnega uradnega naslova ali registrske oznake, zato North Data in insolvenčna preverba nista bila sprožena.";
      } else if (insolvenca.reason === "registered_merchant_owner_required") {
        insolvencaOpis.textContent = "Gre za samostojnega registriranega trgovca. Dodajte spletno stran podjetja ali neposredni URL Impressuma, da lahko potrdimo osebnega nosilca.";
      } else if (insolvenca.reason === "registered_merchant_evidence_unavailable") {
        insolvencaOpis.textContent = "Osebni nosilec je razbran, vendar dokaznega posnetka Impressuma ni bilo mogoče pripraviti. Preverjanje se zaradi varnosti ni nadaljevalo.";
      } else if (insolvenca.reason === "user_confirmation_required") {
        insolvencaOpis.textContent = "Najprej preglejte razbrane podatke, jih po potrebi popravite in kliknite »Podatki so pravilni – preveri insolventnost«.";
      } else {
        insolvencaOpis.textContent = "Podatki za insolvenčno poizvedbo še niso potrjeni.";
      }
    }
    var izidJePotrjen = insolvenca.status === "clear" && uradnaPotrditev.status === "clear" && Boolean(prikazljivPosnetek);
    var izidJeOpozorilo = insolvenca.status !== "possible_match" || !prikazljivPosnetek;
    if (insolvencaIzidIkona) insolvencaIzidIkona.textContent = izidJePotrjen ? "✓" : (izidJeOpozorilo ? "!" : "×");
    if (insolvencaIzidZnacka) {
      insolvencaIzidZnacka.textContent = izidJePotrjen ? "BREZ OBJAVE" : (izidJeOpozorilo ? "PREVERITE" : "ZADETEK");
      insolvencaIzidZnacka.className = "boniteta-insolvenca-izid__znacka boniteta-insolvenca-izid__znacka--" + (izidJePotrjen ? "green" : (izidJeOpozorilo ? "yellow" : "red"));
    }
    if (prikazljivPosnetek) {
      insolvencaSlika.src = prikazljivPosnetek;
      insolvencaPosnetek.hidden = false;
      ponastaviPovecavoPosnetka(insolvencaSlika);
      var uradnoPreverjenoOb = new Date(uradnaPotrditev.checkedAt || podatki.checkedAt || Date.now());
      var uradniCas = new Intl.DateTimeFormat("sl-SI", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(uradnoPreverjenoOb).replace(",", " ·");
      insolvencaCas.textContent = uradniCas;
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
    if (inlineProfil) inlineProfil.hidden = true;
    {
      var primerjalnaIdentiteta = podatki.identity || {};
      var primerjalnaInsolvenca = podatki.insolvency || {};
      window.dispatchEvent(new CustomEvent("uj:boniteta:comparison-result", { detail: {
        complete: zadnjiInsolvencniRezultatPripravljen,
        name: primerjalnaIdentiteta.naziv || primerjalnaIdentiteta.ime || vnosObRezultatu && vnosObRezultatu.ime || "Podjetje",
        profileId: zadnjiProfilId || "",
        resultTitle: podatki.result && podatki.result.title || "Osnovna preverba zaključena",
        insolvencyLabel: zadnjiInsolvencniRezultatPripravljen ? (primerjalnaInsolvenca.status === "clear" ? "Brez zadetka v uradnih virih" : primerjalnaInsolvenca.status === "possible_match" ? "Možen insolvenčni zadetek" : "Uradni vir trenutno ni dosegljiv") : "Insolvenčna preverba še ni zaključena",
        comparisonData: sestaviPrimerjalnePodatke(podatki),
      }}));
    }
    if (!jeLokalniAudit) void shraniZakljucenoPreverbo(podatki, vnosObRezultatu, mojaGeneracija);
    if (window.UJPrilagodiVelikostBesedila) {
      rezultat.querySelectorAll("[data-fit-text]").forEach(window.UJPrilagodiVelikostBesedila);
    }
    (rezultatOkno || rezultat).scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (/^(?:localhost|127\.0\.0\.1)$/.test(window.location.hostname)) {
    window.UJBonitetaAuditIzrisi = function (podatki) {
      return izrisi(podatki, { lokalniAudit: true });
    };
  }

  function rezultatIzShranjengaProfila(profile) {
    var latest = profile && profile.latest_check || {};
    var shranjenaUradnaPolja = latest.insolvency && latest.insolvency.officialVerification && latest.insolvency.officialVerification.inputVerification && latest.insolvency.officialVerification.inputVerification.fields || {};
    var address = profile && profile.address || {};
    var companyId = String(profile && profile.company_id || "");
    var legalName = String(profile && profile.legal_name || "");
    var imaPravnoOblikoDruzbe = Boolean(String(profile && profile.legal_form || "").trim() || pravnaOblikaIzNaziva(legalName));
    var entityType = companyId || imaPravnoOblikoDruzbe
      ? "company"
      : String(latest.entityType || (String(shranjenaUradnaPolja.ime || "").trim() ? "person" : "person"));
    var shranjenoOsebnoIme = [shranjenaUradnaPolja.ime, shranjenaUradnaPolja.firmaPriimek].filter(Boolean).join(" ").trim();
    var identityName = String(entityType === "company" ? legalName : latest.identityName || shranjenoOsebnoIme || legalName);
    var businessName = String(entityType === "company" ? legalName : latest.businessName || legalName);
    var shranjeniStatusIdentitete = String(latest.identityStatus || "");
    var identityStatus = companyId
      ? "verified_register"
      : ["probable_impressum", "confirmed_impressum", "confirmed_manual"].includes(shranjeniStatusIdentitete)
        ? shranjeniStatusIdentitete
        : "confirmed_impressum";
    var registerNumber = String(profile && profile.register_number || "");
    var registerCourt = String(profile && profile.register_court || "");
    var street = String(address.street || address.address || "");
    var postalCode = String(address.postal_code || address.postalCode || "");
    var city = String(address.city || "");
    var active = profile && profile.company_status === "active" ? true : profile && profile.company_status === "inactive" ? false : null;
    return {
      __shranjeniProfil: true,
      checkedAt: profile && (profile.checked_at || profile.updated_at) || new Date().toISOString(),
      confirmationRequired: false,
      result: latest.result || { level: "yellow", title: "Shranjena preverba", message: "Prikazani so zadnji shranjeni podatki podjetja." },
      identity: {
        status: identityStatus,
        entityType: entityType,
        ime: identityName,
        naziv: businessName,
        companyId: companyId,
        registerNumber: registerNumber,
        registerCourt: registerCourt,
        legalForm: String(profile && profile.legal_form || ""),
        naslov: street,
        postnaStevilka: postalCode,
        kraj: city,
        active: active,
      },
      identityEvidence: companyId ? {
        status: "verified_api",
        evidenceReady: true,
        evidenceKind: "structured_api",
        companyId: companyId,
        officialName: legalName,
        officialStreet: street,
        officialPostalCode: postalCode,
        officialCity: city,
        registerNumber: registerNumber,
        registerCourt: registerCourt,
        verifiedAt: profile && profile.checked_at,
        sourceUrl: "https://openregister.de",
      } : {},
      openregister: { sourceUrl: "https://openregister.de" },
      locationMatch: { status: "matched", confirmationType: companyId ? "registry" : "user_confirmed" },
      sources: Array.isArray(latest.sources) ? latest.sources : [],
      insolvency: latest.insolvency || { status: "not_checked", reason: "saved_profile_without_insolvency" },
      northData: latest.northData || null,
      northDataDetails: latest.northDataDetails || null,
      publicProfile: {},
    };
  }

  function imaUradniInsolvencniPosnetek(podatki) {
    var official = podatki && podatki.insolvency && podatki.insolvency.officialVerification || {};
    return Boolean(prikazljivUradniInsolvencniPosnetek(official));
  }

  function uskladiCasZUradnimInsolvencnimDokazom(podatki) {
    var official = podatki && podatki.insolvency && podatki.insolvency.officialVerification || {};
    if (official.checkedAt && Number.isFinite(new Date(official.checkedAt).getTime())) podatki.checkedAt = official.checkedAt;
    return podatki;
  }

  async function dopolniShranjeniRezultatZDokazilom(profile, fallback) {
    if (imaUradniInsolvencniPosnetek(fallback)) return uskladiCasZUradnimInsolvencnimDokazom(fallback);
    try {
      var sejaZaDokaz = await supabaseKlient.auth.getSession();
      var uporabnikZaDokaz = sejaZaDokaz && sejaZaDokaz.data && sejaZaDokaz.data.session && sejaZaDokaz.data.session.user;
      var lokalniDokaz = uporabnikZaDokaz && window.UJBonitetaDokaznaHramba
        ? await window.UJBonitetaDokaznaHramba.preberi(uporabnikZaDokaz.id, profile.id)
        : null;
      if (lokalniDokaz) {
        var zLokalnimDokazom = Object.assign({}, fallback);
        zLokalnimDokazom.insolvency = Object.assign({}, fallback.insolvency || {});
        zLokalnimDokazom.insolvency.officialVerification = Object.assign({}, fallback.insolvency && fallback.insolvency.officialVerification || {}, lokalniDokaz);
        if (["clear", "possible_match"].includes(zLokalnimDokazom.insolvency.status) && imaUradniInsolvencniPosnetek(zLokalnimDokazom)) {
          return uskladiCasZUradnimInsolvencnimDokazom(zLokalnimDokazom);
        }
      }
    } catch (_) {
      // Če lokalna hramba ni na voljo, nadaljuj z uporabniško izolirano čakalno vrsto.
    }
    var latest = profile && profile.latest_check || {};
    var queueJobId = String(latest.queueJobId || latest.queue_job_id || "");
    try {
      var token = await pridobiToken();
      var poti = [];
      if (/^[0-9a-f-]{32,36}$/i.test(queueJobId)) poti.push("/api/mehka-boniteta-opravilo?id=" + encodeURIComponent(queueJobId));
      poti.push("/api/mehka-boniteta-opravilo?profileId=" + encodeURIComponent(profile.id));
      var job = null;
      for (var indeksPoti = 0; indeksPoti < poti.length; indeksPoti += 1) {
        var odgovor = await fetchSPonovnimPoskusom(poti[indeksPoti], {
          headers: glaveCakalneVrste(token, false),
          signal: omejitevKlica(20000),
        });
        var payload = await odgovor.json().catch(function () { return {}; });
        var kandidat = payload && payload.job;
        if (odgovor.ok && kandidat && kandidat.status === "completed" && kandidat.result && imaUradniInsolvencniPosnetek(kandidat.result)) {
          job = kandidat;
          break;
        }
      }
      if (!job) return fallback;
      zadnjiJobId = job.id || queueJobId;
      var polniRezultat = Object.assign({}, fallback, job.result, { __shranjeniProfil: true });
      if (fallback.identity && fallback.identity.companyId) {
        polniRezultat.identity = Object.assign({}, job.result.identity || {}, fallback.identity);
        polniRezultat.identityEvidence = Object.assign({}, job.result.identityEvidence || {}, fallback.identityEvidence || {});
        polniRezultat.locationMatch = fallback.locationMatch;
      }
      if (!polniRezultat.northData) polniRezultat.northData = fallback.northData;
      if (!polniRezultat.northDataDetails) polniRezultat.northDataDetails = fallback.northDataDetails;
      try {
        var sejaPoVrsti = await supabaseKlient.auth.getSession();
        var uporabnikPoVrsti = sejaPoVrsti && sejaPoVrsti.data && sejaPoVrsti.data.session && sejaPoVrsti.data.session.user;
        if (uporabnikPoVrsti && window.UJBonitetaDokaznaHramba) {
          await window.UJBonitetaDokaznaHramba.shrani(uporabnikPoVrsti.id, profile.id, polniRezultat.insolvency);
        }
      } catch (_) {}
      return uskladiCasZUradnimInsolvencnimDokazom(polniRezultat);
    } catch (_) {
      return fallback;
    }
  }

  window.UJBonitetaPrikaziShranjeniProfil = async function (profile, section, options) {
    if (!profile || !profile.id) return;
    var mojaGeneracijaOdpiranja = ++generacijaOdpiranjaShranjengaProfila;
    generacijaNeposredneInsolvence += 1;
    neposrednaInsolvencnaPreverba = false;
    nastaviNalaganjePotrditve(false);
    nastaviInsolvencnoOkno(false, false);
    if (identitetaNadaljuj) {
      identitetaNadaljuj.classList.remove("is-loading");
      identitetaNadaljuj.removeAttribute("aria-busy");
    }
    zadnjiVnos = {
      ime: profile.legal_name || "",
      naslov: profile.address && (profile.address.street || profile.address.address) || "",
      postnaStevilka: profile.address && (profile.address.postal_code || profile.address.postalCode) || "",
      kraj: profile.address && profile.address.city || "",
      registerNumber: profile.register_number || "",
      registerCourt: profile.register_court || "",
      openRegisterCompanyId: profile.company_id || "",
      uporabiOpenRegisterIdentiteto: Boolean(profile.company_id),
    };
    var shranjeniRezultat = rezultatIzShranjengaProfila(profile);
    var rezultatZDokazilom = await dopolniShranjeniRezultatZDokazilom(profile, shranjeniRezultat);
    if (mojaGeneracijaOdpiranja !== generacijaOdpiranjaShranjengaProfila) return;
    izrisi(rezultatZDokazilom);
    uveljaviZakljucenShranjeniInsolvencniRezultat(rezultatZDokazilom);
    if (options && options.monitoring && document.getElementById("boniteta-eno-spremljaj")) {
      document.getElementById("boniteta-eno-spremljaj").hidden = true;
    }
    var monitoringState = options && options.monitoringComparison ? monitoringPrimerjalnoStanje(profile, options) : null;
    if (monitoringState) prikaziMonitoringPrimerjavo(profile, monitoringState);
    else if (section === "insolvency" && imaUradniInsolvencniPosnetek(rezultatZDokazilom)) nastaviInsolvencnoOkno(true, true);
    zadnjiProfilId = profile.id;
    if (profilPovezava) {
      profilPovezava.dataset.profileId = profile.id;
      profilPovezava.hidden = true;
    }
    if (razsiritveSklop) {
      razsiritveSklop.hidden = true;
    }
  };

  async function izvediBonitetnoPreverbo(dogodek) {
    if (dogodek && typeof dogodek.preventDefault === "function") dogodek.preventDefault();
    if (preverjanjeVTehniku) return;
    pocistiNapako();
    var samoSpletniVnos = nacinVnosa === "spletna";
    var registrskiVnosJeSamoIme = Boolean(izbranoOpenRegisterPodjetje && (
      izbranoOpenRegisterPodjetje.source === "offeneregister" || izbranoOpenRegisterPodjetje.source === "northdata_names"
    ));
    var registrskiVnos = nacinVnosa === "register" && Boolean(izbranoOpenRegisterPodjetje && (
      izbranoOpenRegisterPodjetje.companyId || izbranoOpenRegisterPodjetje.registerNumber || registrskiVnosJeSamoIme
    ));
    if (!registrskiVnos && !obrazec.reportValidity()) return;

    var posta = samoSpletniVnos || registrskiVnos ? "" : document.getElementById("boniteta-posta").value.replace(/\D/g, "");
    var spletnaStran = spletnaPolje.value.trim();
    var rocnoIme = samoSpletniVnos ? "" : registrskiVnos ? izbranoOpenRegisterPodjetje.name : document.getElementById("boniteta-ime").value.trim();
    var rocniNaslov = samoSpletniVnos || registrskiVnos ? "" : document.getElementById("boniteta-naslov-podjetja").value.trim();
    var rocniKraj = samoSpletniVnos || registrskiVnos ? "" : krajPolje.value.trim();
    if (!spletnaStran && !registrskiVnos && (!rocnoIme || rocniNaslov.length < 3 || !/^\d{5}$/.test(posta) || rocniKraj.length < 2)) {
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

    preverjanjeVTehniku = true;
    nastaviNalaganje(true);
    try {
      var token = await pridobiToken();
      zadnjiVnos = {
        ime: rocnoIme,
        naslov: rocniNaslov,
        postnaStevilka: posta,
        kraj: rocniKraj,
        spletnaStran: spletnaStran,
        registerNumber: samoSpletniVnos || registrskiVnosJeSamoIme ? "" : document.getElementById("boniteta-register").value.trim(),
        registerCourt: registrskiVnosJeSamoIme ? "" : izbranoOpenRegisterPodjetje && izbranoOpenRegisterPodjetje.registerCourt || "",
        vatId: samoSpletniVnos ? "" : document.getElementById("boniteta-davcna").value.trim(),
        openRegisterCompanyId: izbranoOpenRegisterPodjetje && izbranoOpenRegisterPodjetje.companyId || "",
        openRegisterIdentityProof: izbranoOpenRegisterPodjetje && izbranoOpenRegisterPodjetje.identityProof || "",
        companyIndexSource: izbranoOpenRegisterPodjetje && izbranoOpenRegisterPodjetje.source || "",
        companyIndexId: registrskiVnosJeSamoIme ? "" : izbranoOpenRegisterPodjetje && izbranoOpenRegisterPodjetje.sourceId || "",
        companyIndexProof: izbranoOpenRegisterPodjetje && izbranoOpenRegisterPodjetje.suggestionProof || "",
        uporabiOpenRegisterIdentiteto: true,
      };
      zadnjaOpenRegisterReferenca = "";
      var podatki = await izvediPrekoCakalneVrste(zadnjiVnos, token);
      izrisi(podatki);
      if (nacinVnosa === "rocno") {
        nastaviRocniPopup(false);
        vnosPodrobnosti.hidden = true;
      }
    } catch (err) {
      potek.hidden = true;
      nastaviRezultatKotOkno(false);
      var sporociloNapake = err && (err.name === "TimeoutError" || err.name === "AbortError")
        ? "Strežnik se ni odzval pravočasno. Preverjanje je varno shranjeno; poskusite ponovno."
        : err.message || "Preverjanje trenutno ni mogoče.";
      if (samoSpletniVnos) pokaziSpletnoNapako(sporociloNapake);
      else if (registrskiVnos && heroSpletnaStatus) {
        heroSpletnaStatus.textContent = sporociloNapake;
        heroSpletnaStatus.classList.add("is-error");
        heroSpletnaStatus.hidden = false;
      } else pokaziNapako(sporociloNapake);
    } finally {
      preverjanjeVTehniku = false;
      nastaviNalaganje(false);
    }
  }

  obrazec.addEventListener("submit", izvediBonitetnoPreverbo);

  potrditevGumb.addEventListener("click", async function () {
    potrditevNapaka.hidden = true;
    var jeNeposrednaZahteva = neposrednaInsolvencnaPreverba;
    var generacijaNeposredneZahteve = jeNeposrednaZahteva ? ++generacijaNeposredneInsolvence : 0;
    var jeOpenRegisterTestniPredogled = rezultat && rezultat.dataset.testPreviewSource === "openregister";
    if (!zadnjiVnos && !jeOpenRegisterTestniPredogled) return;
    var potrjenoIme = document.getElementById("boniteta-potrdi-ime").value.trim();
    var potrjeniNaziv = document.getElementById("boniteta-potrdi-naziv").value.trim();
    var potrjeniNosilec = document.getElementById("boniteta-potrdi-nosilec").value.trim();
    if (jeNeposrednaZahteva && zadnjaRegistrskaIdentiteta && zadnjaRegistrskaIdentiteta.entityType === "company") {
      potrjeniNosilec = "";
    }
    var potrjeniNaslov = document.getElementById("boniteta-potrdi-naslov").value.trim();
    var potrjenaPosta = document.getElementById("boniteta-potrdi-posta").value.replace(/\D/g, "");
    var potrjeniKraj = document.getElementById("boniteta-potrdi-kraj").value.trim();
    var potrjeno = document.getElementById("boniteta-potrdi-checkbox").checked;
    try {
      if (!potrditevDokaziloPripravljeno) {
        throw new Error("Brez preverljivega uradnega dokaza identitete insolvenčne poizvedbe ni mogoče izvesti.");
      }
      if (!potrjenoIme || potrjeniNaslov.length < 3 || !/^\d{5}$/.test(potrjenaPosta) || potrjeniKraj.length < 2 || !potrjeno) {
        throw new Error("Preglejte ime in celoten naslov ter potrdite pravilnost podatkov.");
      }
      if (jeOpenRegisterTestniPredogled) {
        potrditevIdentitete.hidden = true;
        zadnjiInsolvencniRezultatPripravljen = true;
        nastaviKarticoInsolvenceZakljuceno({ insolvency: { status: "clear" } });
        nastaviInsolvencnoOkno(true, true);
        return;
      }
      nastaviNalaganjePotrditve(true);
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
      if (jeNeposrednaZahteva && generacijaNeposredneZahteve !== generacijaNeposredneInsolvence) return;
      if (jeNeposrednaZahteva && !jeUporabenNeposredniInsolvencniRezultat(podatki)) {
        throw new Error("Insolvenčna preverba ni vrnila popolnega uradnega rezultata. Poskusite ponovno.");
      }
      izrisi(podatki);
      if (jeNeposrednaZahteva) nastaviInsolvencnoOkno(true, true);
    } catch (napakaPotrditve) {
      if (jeNeposrednaZahteva && generacijaNeposredneZahteve !== generacijaNeposredneInsolvence) return;
      var sporociloPotrditve = napakaPotrditve && (napakaPotrditve.name === "TimeoutError" || napakaPotrditve.name === "AbortError")
        ? "Strežnik se ni odzval pravočasno. Poskusite ponovno."
        : napakaPotrditve.message || "Potrditev podatkov ni uspela.";
      potrditevNapaka.textContent = sporociloPotrditve;
      potrditevNapaka.hidden = jeNeposrednaZahteva;
      if (jeNeposrednaZahteva) {
        nastaviInsolvencnoOkno(false, false);
        nastaviKarticoInsolvenceNedokoncano(zadnjiRegistrskiPodatki);
        var neposredniOpis = identitetaNadaljuj.querySelector(".boniteta-identiteta-nadaljuj__vsebina > span");
        if (neposredniOpis) neposredniOpis.textContent = sporociloPotrditve;
      }
    } finally {
      if (jeNeposrednaZahteva && generacijaNeposredneZahteve !== generacijaNeposredneInsolvence) return;
      nastaviNalaganjePotrditve(false);
      posodobiPotrditevIdentitete();
      if (identitetaNadaljuj && identitetaNadaljuj.classList.contains("is-loading")) {
        identitetaNadaljuj.classList.remove("is-loading");
        identitetaNadaljuj.removeAttribute("aria-busy");
        if (!zadnjiInsolvencniRezultatPripravljen) identitetaNadaljuj.disabled = false;
      }
      if (jeNeposrednaZahteva) neposrednaInsolvencnaPreverba = false;
    }
  });

  if (potrditevCheckbox) potrditevCheckbox.addEventListener("change", function () {
    potrditevNapaka.hidden = true;
    if (potrditevCheckbox.checked && (!soPotrditveniPodatkiVeljavni() || !potrditevDokaziloPripravljeno)) {
      potrditevCheckbox.checked = false;
      potrditevNapaka.textContent = potrditevDokaziloPripravljeno
        ? "Najprej dopolnite pravno ime in celoten naslov."
        : "Za potrditev mora biti na voljo preverljiv uradni dokaz identitete.";
      potrditevNapaka.hidden = false;
    }
    posodobiPotrditevIdentitete();
  });

  potrditvenaPolja().forEach(function (polje) {
    polje.addEventListener("input", function () {
      if (potrditevCheckbox.checked) potrditevCheckbox.checked = false;
      potrditevNapaka.hidden = true;
      posodobiPotrditevIdentitete();
    });
  });

  if (identitetaNadaljuj) {
    identitetaNadaljuj.addEventListener("click", function () {
      if (zadnjiInsolvencniRezultatPripravljen || identitetaNadaljuj.classList.contains("is-complete")) {
        nastaviInsolvencnoOkno(true, true);
        return;
      }
      if (pripraviOpenRegisterTestnoPotrditev()) {
        potrditevCheckbox.checked = true;
        posodobiPotrditevIdentitete();
        potrditevGumb.click();
        return;
      }
      if (zacniInsolvencnoPreverboBrezPonovnegaPotrjevanja()) return;
      dopolniPraznaPotrditvenaPoljaIzRegistra();
      nastaviInsolvencnoOkno(true, false);
    });
  }

  function nazajNaPodatkePodjetja() {
    nastaviInsolvencnoOkno(false, false);
    podjetjeSklop.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (insolvencaNazaj) insolvencaNazaj.addEventListener("click", nazajNaPodatkePodjetja);
  if (insolvencaNazajSpodaj) insolvencaNazajSpodaj.addEventListener("click", nazajNaPodatkePodjetja);

  function ponastaviNovoPreverbo() {
    generacijaRezultata += 1;
    if (window.UJBonitetaZapriProfil) window.UJBonitetaZapriProfil();
    nastaviRezultatKotOkno(false);
    rezultat.hidden = true;
    nastaviMonitoringPrimerjavo(false);
    nastaviInsolvencnoOkno(false, false);
    potek.hidden = true;
    pocistiNapako();
    nacinVnosa = "";
    zadnjiVnos = null;
    izbranoOpenRegisterPodjetje = null;
    autocompleteZaporedje += 1;
    zadnjiJobId = "";
    zadnjiProfilId = "";
    zadnjiRegistrskiPodatki = null;
    zadnjaRegistrskaIdentiteta = null;
    zadnjiInsolvencniRezultatPripravljen = false;
    if (izbrisiPreverboGumb) izbrisiPreverboGumb.hidden = true;
    zadnjaOpenRegisterReferenca = "";
    zadnjaSamodejnaPosta = "";
    samodejniKraj = "";
    krajiTrenutnePoste = [];
    izrecnoIzbraniKraj = "";
    zaporedjePostnePoizvedbe += 1;
    obrazec.reset();
    nastaviBrezSpletne(true, true);
    krajStatus.textContent = "";
    krajiSeznam.innerHTML = "";
    krajiIzbira.innerHTML = "";
    krajiIzbira.hidden = true;
    if (krajPredlogi) krajPredlogi.hidden = true;
    potrditevIdentitete.hidden = true;
    if (profilPovezava) profilPovezava.hidden = true;
    if (razsiritveSklop) razsiritveSklop.hidden = true;
    vnosPodrobnosti.hidden = true;
    izbiraStranke.hidden = true;
    nastaviZajemStatus("", null);
    nastaviZajemKartico(null, null);
    nastaviSpletnoRezervo(false);
    if (heroSpletnaPolje) {
      heroSpletnaPolje.value = "";
      heroSpletnaPolje.disabled = false;
      heroSpletnaPolje.removeAttribute("aria-invalid");
    }
    if (heroSpletnaStatus) {
      heroSpletnaStatus.textContent = "";
      heroSpletnaStatus.classList.remove("is-error");
      heroSpletnaStatus.hidden = true;
    }
    if (heroZadetki) heroZadetki.innerHTML = "";
    odpriAutocomplete(false);
    nastaviHeroPodjetje("");
    var novaPot = new URL(window.location.href);
    ["profile", "id", "section", "northdataRun", "ime", "job"].forEach(function (parameter) {
      novaPot.searchParams.delete(parameter);
    });
    novaPot.hash = "new";
    window.history.replaceState(window.history.state || {}, "", novaPot.pathname + novaPot.search + novaPot.hash);
    document.getElementById("boniteta-nacin-slikaj").focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.getElementById("boniteta-ponovi").addEventListener("click", ponastaviNovoPreverbo);
  window.UJBonitetaPonastaviNovoPreverbo = ponastaviNovoPreverbo;

  function pojdiEnBonitetniKorakNazaj() {
    if (document.body.classList.contains("boniteta-rezultat-je-okno")) {
      document.getElementById("boniteta-ponovi").click();
      if (window.UJBonitetaIzberiTok) window.UJBonitetaIzberiTok("soft");
      return true;
    }

    /* Bonitetni center je samostojen prvi korak. Ne uporabljaj history.back(),
       ker je lahko dejanski prejsnji vnos nov zavihek ali stran zunaj appa
       (npr. po neposrednem odpiranju povezave oziroma location.replace). */
    window.location.replace("index.html");
    return true;
  }

  window.UJPoskusiNotranjiKorakNazaj = pojdiEnBonitetniKorakNazaj;

  function nastaviVarnoBrskalniskoNavigacijo() {
    var KLJUC_IZSTOP = "ujBonitetaIzstop";
    var KLJUC_AKTIVNO = "ujBonitetaAktivno";
    var trenutnoStanje = window.history.state || {};

    /* Neposredno odprta stran ima lahko za sabo samo Chromov nov zavihek.
       Trenutni vnos zato postane varen izstop, nad njim pa ostane aktivni
       vnos Bonitetnega centra, ki ga uporabnik dejansko vidi. */
    if (!trenutnoStanje[KLJUC_AKTIVNO]) {
      var izstopnoStanje = Object.assign({}, trenutnoStanje);
      izstopnoStanje[KLJUC_IZSTOP] = true;
      window.history.replaceState(izstopnoStanje, "", window.location.href);
      window.history.pushState((function () {
        var stanje = {};
        stanje[KLJUC_AKTIVNO] = true;
        return stanje;
      })(), "", window.location.href);
    }

    window.addEventListener("popstate", function (dogodek) {
      if (dogodek.state && dogodek.state[KLJUC_IZSTOP]) {
        window.location.replace("index.html");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", nastaviVarnoBrskalniskoNavigacijo, { once: true });
  } else {
    nastaviVarnoBrskalniskoNavigacijo();
  }

  if (izbrisiPreverboGumb) izbrisiPreverboGumb.addEventListener("click", async function () {
    if (!zadnjiJobId || !window.confirm("Ali res želite izbrisati vse prejšnje in trenutne podatke tega preverjanja, rezultate ter dokazne posnetke?")) return;
    izbrisiPreverboGumb.disabled = true;
    izbrisiPreverboGumb.textContent = "Brišem preverbo …";
    try {
      var token = await pridobiToken();
      var odgovor = await fetch("/api/mehka-boniteta-opravilo?id=" + encodeURIComponent(zadnjiJobId), {
        method: "DELETE",
        headers: glaveCakalneVrste(token, false),
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
      if (krajPredlogi) krajPredlogi.hidden = true;
      if (krajPolje.value.trim() === samodejniKraj) krajPolje.value = "";
      samodejniKraj = "";
      return;
    }
    void dolociKrajIzPoste(dogodek.target.value);
  });

  if (dodatniPreklop && dodatniPodatki) dodatniPreklop.addEventListener("click", function () {
    var odprto = dodatniPreklop.getAttribute("aria-expanded") !== "true";
    dodatniPreklop.setAttribute("aria-expanded", String(odprto));
    dodatniPodatki.hidden = !odprto;
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

  if (rezervaSpletnaGumb) rezervaSpletnaGumb.addEventListener("click", function () {
    pocistiNapako();
    var razvrstitev = razvrstiUniverzalniVnos(heroSpletnaPolje && heroSpletnaPolje.value);
    if (razvrstitev.vrsta !== "spletna_stran") {
      nastaviHeroNapako("Zgoraj vnesite spletno stran, na primer www.podjetje.de.");
      if (heroSpletnaPolje) {
        heroSpletnaPolje.setAttribute("aria-invalid", "true");
        heroSpletnaPolje.focus();
        poudariVnosSpletneStrani();
      }
      return;
    }
    heroSpletnaPolje.value = razvrstitev.vrednost;
    spletnaPolje.value = razvrstitev.vrednost;
    prilagodiVnos(spletnaPolje);
    posodobiHeroPocisti();
    nastaviSpletnoRezervo(false);
    nastaviBrezSpletne(false, true);
    nacinVnosa = "spletna";
    rezervnoRegistrskoIme = "";
    nastaviRocniPopup(false);
    vnosPodrobnosti.hidden = true;
    heroSpletnaPolje.removeAttribute("aria-invalid");
    pocistiHeroSporocilo();
    if (heroPreveriGumb) heroPreveriGumb.focus({ preventScroll: true });
  });

  if (rezervaBrezSpletneGumb) rezervaBrezSpletneGumb.addEventListener("click", function () {
    pocistiNapako();
    var iskanoIme = rezervnoRegistrskoIme || String(heroSpletnaPolje && heroSpletnaPolje.value || "").trim().replace(/\s+/g, " ");
    nastaviSpletnoRezervo(false);
    if (iskanoIme) izpolniRazbranoPolje("boniteta-ime", iskanoIme);
    rezervnoRegistrskoIme = "";
    nastaviBrezSpletne(true, true);
    nastaviNacinVnosa("rocno");
  });

  spletnaPolje.addEventListener("input", function () {
    potrjenoBrezSpletne = !spletnaPolje.value.trim();
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
    if (heroVrednost.length < 3) {
      nastaviHeroNapako("Vnesite vsaj tri znake imena, podjetja, registra ali spletne strani.");
      if (heroSpletnaPolje) {
        heroSpletnaPolje.setAttribute("aria-invalid", "true");
        heroSpletnaPolje.focus();
      }
      return;
    }
    heroSpletnaPolje.removeAttribute("aria-invalid");
    void izvediUniverzalnoIskanje();
  });

  if (heroSpletnaPolje) {
    heroSpletnaPolje.addEventListener("input", function () {
      posodobiHeroPocisti();
      var vodeniSpletniVnos = spletnaRezervaRazlog === "openregister_not_found" && !spletnaRezerva.hidden;
      if (!vodeniSpletniVnos) nastaviSpletnoRezervo(false);
      pocistiHeroSporocilo();
      heroSpletnaPolje.removeAttribute("aria-invalid");
      izbranoOpenRegisterPodjetje = null;
      autocompleteZaporedje += 1;
      var query = heroSpletnaPolje.value.trim().replace(/\s+/g, " ");
      if (vodeniSpletniVnos) {
        if (heroZadetki) heroZadetki.innerHTML = "";
        odpriAutocomplete(false);
        return;
      }
      if (northDataPrikazanaPoizvedba !== query) {
        northDataPrikazanaPoizvedba = "";
        northDataUradnaRezervaPoizvedba = "";
        nastaviIskalniGumbZaUradnoRezervo(false);
      }
      var lokalniZadetki = query.length >= 3 ? filtrirajAutocompleteZadetke(query) : [];
      if (lokalniZadetki.length) izrisiAutocompleteZadetke(lokalniZadetki);
      else {
        if (heroZadetki) heroZadetki.innerHTML = "";
        odpriAutocomplete(false);
      }
      if (heroSpletnaStatus) {
        var dovoljDolgo = query.length >= 3;
        heroSpletnaStatus.textContent = lokalniZadetki.length
          ? "Izberite shranjeno podjetje. Tipkanje ne porablja kreditov."
          : dovoljDolgo
            ? "Iščem v brezplačnem seznamu podjetij …"
            : query ? "Vnesite vsaj tri znake imena ali podjetja." : "";
        heroSpletnaStatus.hidden = !query;
      }
      if (!brezplacniAutocompleteNalozeni) void naloziBrezplacneAutocompleteZadetke().then(function () {
        var trenutniQuery = heroSpletnaPolje.value.trim().replace(/\s+/g, " ");
        if (trenutniQuery !== query || trenutniQuery.length < 3) return;
        var noviLokalniZadetki = filtrirajAutocompleteZadetke(trenutniQuery);
        if (noviLokalniZadetki.length) {
          izrisiAutocompleteZadetke(noviLokalniZadetki);
          heroSpletnaStatus.textContent = "Izberite shranjeno podjetje. Tipkanje ne porablja kreditov.";
          heroSpletnaStatus.hidden = false;
        }
      });
      clearTimeout(odprtiRegisterCasovnik);
      if (normalizirajOdprtiRegisterNiz(query).length >= 2) {
        void naloziOdprtiRegisterDelec(odprtiRegisterKljuc(query)).catch(function () {});
      }
      if (query.length >= 3) {
        var mojeZaporedje = autocompleteZaporedje;
        odprtiRegisterCasovnik = setTimeout(function () {
          void naloziOdprtiRegisterZadetke(query).then(function (odprtiZadetki) {
            if (mojeZaporedje !== autocompleteZaporedje) return;
            var trenutniQuery = heroSpletnaPolje.value.trim().replace(/\s+/g, " ");
            if (trenutniQuery !== query) return;
            var shranjeniZadetki = filtrirajAutocompleteZadetke(query);
            var prikaz = zdruziAutocompleteZaPrikaz(shranjeniZadetki, odprtiZadetki);
            if (prikaz.length) izrisiAutocompleteZadetke(prikaz);
            else {
              if (heroZadetki) heroZadetki.innerHTML = "";
              odpriAutocomplete(false);
            }
            if (heroSpletnaStatus) {
              heroSpletnaStatus.textContent = prikaz.length
                ? "Izberite podjetje. Predlogi in tipkanje so brezplačni."
                : "Podjetja ni v lokalnem seznamu. Pritisnite lupo za novejše predloge North Data · največ približno 0,013 $.";
              heroSpletnaStatus.hidden = false;
            }
          }).catch(function () {
            if (mojeZaporedje !== autocompleteZaporedje || !heroSpletnaStatus) return;
            heroSpletnaStatus.textContent = "Lokalni seznam trenutno ni dosegljiv. Pritisnite lupo za novejše predloge North Data · največ približno 0,013 $.";
            heroSpletnaStatus.hidden = false;
          });
        }, 35);
      }
    });
    heroSpletnaPolje.addEventListener("keydown", function (dogodek) {
      if (dogodek.key === "ArrowDown" && heroZadetki && !heroZadetki.hidden) {
        dogodek.preventDefault();
        var prvi = heroZadetki.querySelector("button");
        if (prvi) prvi.focus();
      } else if (dogodek.key === "Escape") {
        odpriAutocomplete(false);
      } else if (dogodek.key === "Enter") {
        dogodek.preventDefault();
        void izvediUniverzalnoIskanje();
      }
    });
  }

  if (heroSpletnaPocisti) heroSpletnaPocisti.addEventListener("click", pocistiCelotenHeroVnos);

  preberiBrezplacneAutocompleteZadetke();
  void naloziBrezplacneAutocompleteZadetke();

  if (heroPodjetjeOdstrani) heroPodjetjeOdstrani.addEventListener("click", ponastaviAutocompletePodjetje);
  if (heroPodjetje) {
    heroPodjetje.addEventListener("click", function (dogodek) {
      if (dogodek.target.closest("#boniteta-hero-podjetje-odstrani")) return;
      urediAutocompletePodjetje();
    });
    heroPodjetje.addEventListener("keydown", function (dogodek) {
      if (dogodek.key !== "Enter" && dogodek.key !== " ") return;
      dogodek.preventDefault();
      urediAutocompletePodjetje();
    });
  }
  document.addEventListener("click", function (dogodek) {
    if (heroSpletnaOkvir && !heroSpletnaOkvir.contains(dogodek.target)) odpriAutocomplete(false);
  });

  document.getElementById("boniteta-nacin-rocno").addEventListener("click", function () {
    pocistiNapako();
    nastaviSpletnoRezervo(false);
    var zacetnaVrednost = String(heroSpletnaPolje && heroSpletnaPolje.value || "").trim().replace(/\s+/g, " ");
    var jeSpletnaStran = /^(?:https?:\/\/|www\.)/i.test(zacetnaVrednost) || /^[^\s]+\.[a-z]{2,}(?:[\/?#]|$)/i.test(zacetnaVrednost);
    if (jeSpletnaStran) {
      spletnaPolje.value = zacetnaVrednost;
      izpolniRazbranoPolje("boniteta-ime", "");
      nastaviBrezSpletne(false, true);
    } else {
      spletnaPolje.value = "";
      izpolniRazbranoPolje("boniteta-ime", zacetnaVrednost);
      nastaviBrezSpletne(true, true);
    }
    nastaviNacinVnosa("rocno");
  });

  if (rocniModalZapri) rocniModalZapri.addEventListener("click", zapriRocniPopup);
  if (rocniModalOzadje) rocniModalOzadje.addEventListener("click", zapriRocniPopup);
  document.addEventListener("keydown", function (dogodek) {
    if (dogodek.key === "Escape" && vnosPodrobnosti && vnosPodrobnosti.classList.contains("is-rocni-popup")) {
      dogodek.preventDefault();
      zapriRocniPopup();
    }
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
  if (zacetnoIme && heroSpletnaPolje) {
    heroSpletnaPolje.value = zacetnoIme;
    prilagodiVnos(heroSpletnaPolje);
  }
  posodobiHeroPocisti();
  if (/^[0-9a-f-]{32,36}$/i.test(zacetniJobId)) void nadaljujOpravilo(zacetniJobId);
  var lokalniPredogledNalaganja = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) &&
    zacetniParametri.get("loading-preview") === "1";
  if (lokalniPredogledNalaganja) window.setTimeout(function () { nastaviNalaganje(true); }, 0);
  var lokalniPredogledNeuspesnegaRegistra = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) &&
    zacetniParametri.get("register-miss-preview") === "1";
  if (lokalniPredogledNeuspesnegaRegistra) window.setTimeout(function () {
    var imePredogleda = (zacetniParametri.get("register-miss-name") || "Testno registrsko podjetje mbH").trim().slice(0, 240);
    nacinVnosa = "register";
    zadnjiVnos = { ime: imePredogleda };
    izbranoOpenRegisterPodjetje = { name: imePredogleda, source: "offeneregister" };
    nastaviHeroPodjetje(imePredogleda);
    izrisi({
      identity: { status: "unresolved", ime: imePredogleda },
      publicProfile: { status: "not_provided" },
      openregister: { status: "not_found", reason: "not_found", sourceUrl: "https://openregister.de" },
    }, { lokalniAudit: true });
  }, 0);
  var lokalniPredogledNalaganjaPotrditve = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) &&
    zacetniParametri.get("confirmation-loading-preview") === "1";
  if (lokalniPredogledNalaganjaPotrditve) window.setTimeout(function () {
    if (!pripraviOpenRegisterTestnoPotrditev()) return;
    nastaviInsolvencnoOkno(true, false);
    nastaviNalaganjePotrditve(true);
  }, 80);

})();
