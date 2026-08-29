(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (!root || !root.document) return;
  root.UJNedavnaPodjetja = api;
  if (root.document.readyState === "loading") {
    root.document.addEventListener("DOMContentLoaded", function () {
      api.init(root.document, root);
    });
  } else {
    api.init(root.document, root);
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  function besedilo(vrednost) {
    return String(vrednost == null ? "" : vrednost).trim();
  }

  function normalizirajIme(vrednost) {
    return besedilo(vrednost)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("sl-SI")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function cas(vrednost) {
    var rezultat = Date.parse(vrednost || "");
    return Number.isFinite(rezultat) ? rezultat : 0;
  }

  function preslikajZadevo(zadeva) {
    return {
      companyId: besedilo(zadeva.openregister_company_id),
      name: besedilo(zadeva.naziv_podjetja || zadeva.ime_dolznika),
      registerType: besedilo(zadeva.register_type),
      registerNumber: besedilo(zadeva.register_number),
      registerCourt: besedilo(zadeva.register_court),
      legalForm: besedilo(zadeva.legal_form),
      checkedAt: besedilo(zadeva.podjetje_preverjeno_at),
      vatId: besedilo(zadeva.davcna_stevilka),
      contactPerson: besedilo(zadeva.kontaktna_oseba),
      phone: besedilo(zadeva.telefon_dolznika),
      email: besedilo(zadeva.email_dolznika),
      usedAt: besedilo(zadeva.ustvarjeno_at),
      cases: [{
        id: besedilo(zadeva.id),
        amount: Number(zadeva.znesek) || 0,
        dueAt: besedilo(zadeva.datum_zapadlosti),
        status: besedilo(zadeva.status),
        createdAt: besedilo(zadeva.ustvarjeno_at),
      }],
    };
  }

  function podjetjaIzZadev(zadeve) {
    var urejene = (Array.isArray(zadeve) ? zadeve : []).slice().sort(function (a, b) {
      return cas(b && b.ustvarjeno_at) - cas(a && a.ustvarjeno_at);
    });
    var poKljucu = new Map();

    urejene.forEach(function (zadeva) {
      if (!zadeva || zadeva.vrsta_dolznika === "fizicna_oseba") return;
      var podjetje = preslikajZadevo(zadeva);
      if (!podjetje.name) return;
      var kljuc = podjetje.companyId || normalizirajIme(podjetje.name);
      if (!kljuc) return;
      if (!poKljucu.has(kljuc)) {
        poKljucu.set(kljuc, podjetje);
        return;
      }
      var obstojeco = poKljucu.get(kljuc);
      Object.keys(podjetje).forEach(function (polje) {
        if (polje === "cases") return;
        if (!obstojeco[polje] && podjetje[polje]) obstojeco[polje] = podjetje[polje];
      });
      obstojeco.cases = obstojeco.cases.concat(podjetje.cases);
    });

    return Array.from(poKljucu.values());
  }

  function razvrstiPodjetja(podjetja, nacin) {
    var kopija = (Array.isArray(podjetja) ? podjetja : []).slice();
    if (nacin === "az") {
      return kopija.sort(function (a, b) {
        return a.name.localeCompare(b.name, "sl", { sensitivity: "base" });
      });
    }
    return kopija.sort(function (a, b) {
      return cas(b.usedAt) - cas(a.usedAt);
    });
  }

  var KATEGORIJE_SHRAMBA = "uj_neplacila_podjetja_kategorije_v1";
  var OPOMBE_SHRAMBA = "uj_neplacila_podjetja_opombe_v1";
  var PODATKI_SHRAMBA = "uj_neplacila_podjetja_podatki_v1";
  var IZBRISANA_PODJETJA_SHRAMBA = "uj_neplacila_podjetja_izbrisana_v1";

  function jeResenaZadeva(zadeva) {
    return normalizirajIme(zadeva && zadeva.status) === "reseno";
  }

  function sistemskaOcena(podjetje, danes) {
    var primeri = Array.isArray(podjetje && podjetje.cases) ? podjetje.cases : [];
    var zdaj = cas(danes) || Date.now();
    var tocke = 90;
    primeri.forEach(function (primer) {
      var resen = jeResenaZadeva(primer);
      if (resen) {
        tocke += 2;
        return;
      }
      tocke -= 8;
      if (cas(primer.dueAt) && cas(primer.dueAt) < zdaj) tocke -= 7;
      if (normalizirajIme(primer.status) === "predano odvetniku") tocke -= 14;
    });
    tocke = Math.max(20, Math.min(99, tocke));
    return {
      score: tocke,
      label: tocke >= 82 ? "Zanesljiv" : tocke >= 60 ? "Spremljaj" : "Pozornost",
    };
  }

  function kratekDatum(vrednost) {
    var datum = new Date(vrednost || "");
    return Number.isNaN(datum.getTime()) ? "" : datum.toLocaleDateString("sl-SI");
  }

  function povzetekZgodovine(podjetje, danes) {
    var primeri = Array.isArray(podjetje && podjetje.cases) ? podjetje.cases : [];
    if (!primeri.length) return "";
    var steviloPrimerov = primeri.length;
    var sklonPrimerov = steviloPrimerov === 1
      ? " pretekli primer"
      : steviloPrimerov === 2
        ? " pretekla primera"
        : steviloPrimerov <= 4
          ? " pretekli primeri"
          : " preteklih primerov";
    var deli = [steviloPrimerov + sklonPrimerov];
    var zadnjiDatum = kratekDatum(primeri[0] && primeri[0].createdAt);
    if (zadnjiDatum) deli.push("Zadnjič dolžnik " + zadnjiDatum);
    var aktiven = primeri.find(function (primer) { return !jeResenaZadeva(primer); });
    if (aktiven) {
      var podrobnosti = [];
      if (aktiven.amount) {
        podrobnosti.push(new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(aktiven.amount) + " €");
      }
      var danesCas = cas(danes) || Date.now();
      var zapadlostCas = cas(aktiven.dueAt);
      if (zapadlostCas && zapadlostCas <= danesCas) {
        var dnevi = Math.floor((danesCas - zapadlostCas) / 86400000);
        podrobnosti.push(dnevi + (dnevi === 1 ? " dan" : " dni"));
      }
      deli.push("Aktiven" + (podrobnosti.length ? " " + podrobnosti.join(" / ") : ""));
    }
    return deli.join(" • ");
  }

  function razlagaSpremljanja(podjetje, danes) {
    var primeri = Array.isArray(podjetje && podjetje.cases) ? podjetje.cases : [];
    if (!primeri.length) return "Za to podjetje še ni zabeleženih preteklih primerov.";
    var steviloPrimerov = primeri.length;
    var sklonPrimerov = steviloPrimerov === 1
      ? " pretekli primer"
      : steviloPrimerov === 2
        ? " pretekla primera"
        : steviloPrimerov <= 4
          ? " pretekle primere"
          : " preteklih primerov";
    var uvod = "Podjetje ima " + steviloPrimerov + sklonPrimerov + ".";
    var aktiven = primeri.find(function (primer) { return !jeResenaZadeva(primer); });
    if (!aktiven) return uvod + " Trenutno nima aktivne obveznosti.";
    var znesek = aktiven.amount
      ? new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(aktiven.amount) + " €"
      : "neznan znesek";
    var danesCas = cas(danes) || Date.now();
    var zapadlostCas = cas(aktiven.dueAt);
    var odprto = "";
    if (zapadlostCas && zapadlostCas <= danesCas) {
      var dnevi = Math.floor((danesCas - zapadlostCas) / 86400000);
      odprto = " in je odprta že " + dnevi + (dnevi === 1 ? " dan" : " dni");
    }
    return uvod + " Aktivna obveznost znaša " + znesek + odprto + ", zato je priporočeno redno spremljanje plačil.";
  }

  function normalizirajKategorije(vrednost) {
    var uporabljeniIdji = new Set();
    return (Array.isArray(vrednost) ? vrednost : []).map(function (kategorija, indeks) {
      var ime = besedilo(kategorija && kategorija.name);
      if (!ime) return null;
      var osnovniId = besedilo(kategorija && kategorija.id) || "kategorija-" + indeks + "-" + normalizirajIme(ime).replace(/\s+/g, "-");
      var id = osnovniId;
      var stevec = 2;
      while (uporabljeniIdji.has(id)) {
        id = osnovniId + "-" + stevec;
        stevec += 1;
      }
      uporabljeniIdji.add(id);
      var kljuci = Array.from(new Set((Array.isArray(kategorija && kategorija.companyKeys) ? kategorija.companyKeys : []).map(besedilo).filter(Boolean)));
      return { id: id, name: ime.slice(0, 40), companyKeys: kljuci };
    }).filter(Boolean);
  }

  function razvrstiKategorijePoId(kategorije, idji) {
    var poIdju = new Map((Array.isArray(kategorije) ? kategorije : []).map(function (kategorija) {
      return [kategorija.id, kategorija];
    }));
    var urejene = (Array.isArray(idji) ? idji : []).map(function (id) {
      var kategorija = poIdju.get(id);
      poIdju.delete(id);
      return kategorija;
    }).filter(Boolean);
    return urejene.concat(Array.from(poIdju.values()));
  }

  function premakniKategorijo(kategorije, id, smer) {
    var kopija = (Array.isArray(kategorije) ? kategorije : []).slice();
    var indeks = kopija.findIndex(function (kategorija) { return kategorija.id === id; });
    var noviIndeks = indeks + smer;
    if (indeks < 0 || noviIndeks < 0 || noviIndeks >= kopija.length) return kopija;
    var premaknjena = kopija.splice(indeks, 1)[0];
    kopija.splice(noviIndeks, 0, premaknjena);
    return kopija;
  }

  function premakniKategorijoNaMesto(kategorije, id, ciljniId) {
    var kopija = (Array.isArray(kategorije) ? kategorije : []).slice();
    var izvorniIndeks = kopija.findIndex(function (kategorija) { return kategorija.id === id; });
    var ciljniIndeks = kopija.findIndex(function (kategorija) { return kategorija.id === ciljniId; });
    if (izvorniIndeks < 0 || ciljniIndeks < 0 || izvorniIndeks === ciljniIndeks) return kopija;
    var premaknjena = kopija.splice(izvorniIndeks, 1)[0];
    var prilagojeniCiljniIndeks = kopija.findIndex(function (kategorija) { return kategorija.id === ciljniId; });
    var mestoVstavitve = izvorniIndeks < ciljniIndeks ? prilagojeniCiljniIndeks + 1 : prilagojeniCiljniIndeks;
    kopija.splice(mestoVstavitve, 0, premaknjena);
    return kopija;
  }

  function zamenjajKategoriji(kategorije, prviId, drugiId) {
    var kopija = (Array.isArray(kategorije) ? kategorije : []).slice();
    var prviIndeks = kopija.findIndex(function (kategorija) { return kategorija.id === prviId; });
    var drugiIndeks = kopija.findIndex(function (kategorija) { return kategorija.id === drugiId; });
    if (prviIndeks < 0 || drugiIndeks < 0 || prviIndeks === drugiIndeks) return kopija;
    var zacasna = kopija[prviIndeks];
    kopija[prviIndeks] = kopija[drugiIndeks];
    kopija[drugiIndeks] = zacasna;
    return kopija;
  }

  function razdeliKategorijeNaStrani(kategorije, velikost) {
    var rezultat = [];
    var seznam = Array.isArray(kategorije) ? kategorije : [];
    var naStran = Math.max(1, Number(velikost) || 7);
    for (var indeks = 0; indeks < seznam.length; indeks += naStran) {
      rezultat.push(seznam.slice(indeks, indeks + naStran));
    }
    return rezultat.length ? rezultat : [[]];
  }

  function filtrirajPodjetja(podjetja, poizvedba) {
    var iskano = normalizirajIme(poizvedba);
    if (!iskano) return (Array.isArray(podjetja) ? podjetja : []).slice();
    return (Array.isArray(podjetja) ? podjetja : []).filter(function (podjetje) {
      return normalizirajIme([
        podjetje && podjetje.name,
        podjetje && podjetje.vatId,
        podjetje && podjetje.contactPerson,
      ].filter(Boolean).join(" ")).includes(iskano);
    });
  }

  function init(doc, win) {
    var sklop = doc.getElementById("nedavna-podjetja");
    var trak = doc.getElementById("nedavna-podjetja-trak");
    var vec = doc.getElementById("nedavna-podjetja-vec");
    var sheet = doc.getElementById("podjetja-sheet");
    var sheetNaslov = doc.getElementById("podjetja-sheet-naslov");
    var sheetSeznam = doc.getElementById("podjetja-sheet-seznam");
    var sheetSeznamNaslov = doc.getElementById("podjetja-sheet-seznam-naslov");
    var dodajVKategorijeGumb = doc.getElementById("podjetja-sheet-dodaj-v-kategorije");
    var dodajPrekliciGumb = doc.getElementById("podjetja-sheet-dodaj-preklici");
    var dodajNavodilo = doc.getElementById("podjetja-sheet-dodaj-navodilo");
    var dodajNavodiloVrstica = doc.getElementById("podjetja-sheet-dodaj-navodilo-vrstica");
    var dodajPotrdiGumb = doc.getElementById("podjetja-sheet-dodaj-potrdi");
    var iskanje = doc.getElementById("podjetja-sheet-iskanje");
    var nedavnaGumb = doc.getElementById("podjetja-sheet-nedavna");
    var kategorijeSeznam = doc.getElementById("podjetja-sheet-kategorije-seznam");
    var kategorijeViewport = doc.getElementById("podjetja-sheet-kategorije-viewport");
    var kategorijePikice = doc.getElementById("podjetja-sheet-kategorije-pikice");
    var kategorijaVseGumb = doc.getElementById("podjetja-sheet-kategorija-vse");
    var kategorijaVseStevilo = doc.getElementById("podjetja-sheet-vse-stevilo");
    var kategorijePrazno = doc.getElementById("podjetja-sheet-kategorije-prazno");
    var kategorijeUrediGumb = doc.getElementById("podjetja-sheet-kategorije-uredi");
    var novaKategorijaGumb = doc.getElementById("podjetja-sheet-nova-kategorija");
    var kategorijaObrazec = doc.getElementById("podjetja-sheet-kategorija-obrazec");
    var kategorijaIme = doc.getElementById("podjetja-sheet-kategorija-ime");
    var kategorijaPreklic = doc.querySelector("[data-podjetja-kategorija-preklic]");
    var kategorijaNastavitve = doc.getElementById("podjetja-sheet-kategorija-nastavitve");
    var kategorijaUrediIme = doc.getElementById("podjetja-sheet-kategorija-uredi-ime");
    var kategorijaPovzetek = doc.getElementById("podjetja-sheet-kategorija-povzetek");
    var kategorijaIzbrisi = doc.getElementById("podjetja-sheet-kategorija-izbrisi");
    var kategorijaNastavitveZapri = doc.querySelector("[data-podjetja-kategorija-nastavitve-zapri]");
    if (!sklop || !trak || !vec || !sheet || !sheetSeznam || !iskanje || !nedavnaGumb || !dodajVKategorijeGumb || !dodajPrekliciGumb || !dodajNavodilo || !dodajNavodiloVrstica || !dodajPotrdiGumb || !kategorijeSeznam || !kategorijeViewport || !kategorijePikice || !kategorijaVseGumb || !kategorijaVseStevilo || !novaKategorijaGumb || !kategorijaObrazec || !kategorijaIme || !kategorijaNastavitve || !kategorijaUrediIme || !kategorijaPovzetek || !kategorijaIzbrisi || sklop.dataset.ready === "true") return;
    sklop.dataset.ready = "true";

    var podjetja = [];
    var kategorije = preberiKategorije();
    var izbrisaniKljuciPodjetij = preberiIzbrisaneKljuciPodjetij();
    var aktivnaKategorijaId = "";
    var urejanjeKategorij = false;
    var aktivnaStranKategorij = 0;
    var iskalniNiz = "";
    var prejsnjiFokus = null;
    var izbraniKljuc = "";
    var dodajanjeVKategorijo = false;
    var izbraniKljuciZaKategorijo = new Set();
    var ciljnaKategorijaId = "";
    var urejanaKategorijaId = "";
    var VSE_KATEGORIJE_ID = "__vse__";
    var KATEGORIJ_NA_STRAN = 6;

    function premicneKategorije() {
      return kategorije.slice();
    }

    function stranKategorije(indeks) {
      return indeks <= 0 ? 0 : Math.floor(indeks / KATEGORIJ_NA_STRAN);
    }

    function preberiKategorije() {
      try {
        return normalizirajKategorije(JSON.parse(win.localStorage.getItem(KATEGORIJE_SHRAMBA) || "[]"));
      } catch (napaka) {
        return [];
      }
    }

    function shraniKategorije() {
      try {
        win.localStorage.setItem(KATEGORIJE_SHRAMBA, JSON.stringify(kategorije));
      } catch (napaka) {
        /* Lokalno shranjevanje je lahko izklopljeno; trenutna seja vseeno deluje. */
      }
    }

    function preberiOpombe() {
      try {
        var shranjene = JSON.parse(win.localStorage.getItem(OPOMBE_SHRAMBA) || "{}");
        return shranjene && typeof shranjene === "object" ? shranjene : {};
      } catch (napaka) {
        return {};
      }
    }

    function shraniOpombo(kljuc, vrednost) {
      if (!kljuc) return;
      var opombe = preberiOpombe();
      var opomba = besedilo(vrednost).slice(0, 120);
      if (opomba) opombe[kljuc] = opomba;
      else delete opombe[kljuc];
      try {
        win.localStorage.setItem(OPOMBE_SHRAMBA, JSON.stringify(opombe));
      } catch (napaka) {
        /* Opomba ostane v polju tudi, če je lokalna shramba nedosegljiva. */
      }
    }

    function preberiShranjenePodatke() {
      try {
        var shranjeni = JSON.parse(win.localStorage.getItem(PODATKI_SHRAMBA) || "{}");
        return shranjeni && typeof shranjeni === "object" ? shranjeni : {};
      } catch (napaka) {
        return {};
      }
    }

    function uporabiShranjenePodatke(podjetje, shranjeni) {
      var izvorniKljuc = besedilo(podjetje && podjetje.companyId) || normalizirajIme(podjetje && podjetje.name);
      var popravek = shranjeni && shranjeni[izvorniKljuc];
      podjetje.storageKey = izvorniKljuc;
      if (!popravek || typeof popravek !== "object") return podjetje;
      ["name", "vatId", "contactPerson", "phone", "email"].forEach(function (polje) {
        if (Object.prototype.hasOwnProperty.call(popravek, polje)) podjetje[polje] = besedilo(popravek[polje]);
      });
      return podjetje;
    }

    function shraniPodatkePodjetja(kljuc, podjetje) {
      if (!kljuc) return;
      var shranjeni = preberiShranjenePodatke();
      shranjeni[kljuc] = {
        name: besedilo(podjetje.name),
        vatId: besedilo(podjetje.vatId),
        contactPerson: besedilo(podjetje.contactPerson),
        phone: besedilo(podjetje.phone),
        email: besedilo(podjetje.email),
      };
      try {
        win.localStorage.setItem(PODATKI_SHRAMBA, JSON.stringify(shranjeni));
      } catch (napaka) {
        /* Popravki ostanejo v trenutni seji tudi brez lokalne shrambe. */
      }
    }

    function preberiIzbrisaneKljuciPodjetij() {
      try {
        var shranjeni = JSON.parse(win.localStorage.getItem(IZBRISANA_PODJETJA_SHRAMBA) || "[]");
        return new Set((Array.isArray(shranjeni) ? shranjeni : []).map(besedilo).filter(Boolean));
      } catch (napaka) {
        return new Set();
      }
    }

    function shraniIzbrisaneKljuciPodjetij() {
      try {
        win.localStorage.setItem(IZBRISANA_PODJETJA_SHRAMBA, JSON.stringify(Array.from(izbrisaniKljuciPodjetij)));
      } catch (napaka) {
        /* Odstranitev vseeno ostane vidna do osvežitve trenutne strani. */
      }
    }

    function kljucPodjetja(podjetje) {
      return besedilo(podjetje && podjetje.storageKey)
        || besedilo(podjetje && podjetje.companyId)
        || normalizirajIme(podjetje && podjetje.name);
    }

    function oznaciIzbraniPill() {
      Array.from(trak.querySelectorAll(".nedavna-podjetja__pill")).forEach(function (gumb) {
        var izbran = Boolean(izbraniKljuc) && gumb.dataset.podjetjeKljuc === izbraniKljuc;
        gumb.classList.toggle("nedavna-podjetja__pill--izbran", izbran);
        gumb.setAttribute("aria-pressed", izbran ? "true" : "false");
      });
    }

    function oznakaDatuma(vrednost) {
      var datum = new Date(vrednost || "");
      if (Number.isNaN(datum.getTime())) return "Prejšnje podjetje";
      return "Nazadnje uporabljeno " + datum.toLocaleDateString("sl-SI");
    }

    function zapriSheet() {
      sheet.hidden = true;
      kategorijaObrazec.hidden = true;
      kategorijaIme.value = "";
      zapriNastavitveKategorije();
      dodajanjeVKategorijo = false;
      izbraniKljuciZaKategorijo.clear();
      ciljnaKategorijaId = "";
      posodobiDodajanjeVKategorijo();
      if (prejsnjiFokus && typeof prejsnjiFokus.focus === "function") {
        prejsnjiFokus.focus({ preventScroll: true });
      }
      prejsnjiFokus = null;
    }

    function izberiPodjetje(podjetje) {
      izbraniKljuc = kljucPodjetja(podjetje);
      oznaciIzbraniPill();
      var podjetjeGumb = doc.querySelector('[data-vrsta-dolznika="podjetje"]');
      if (podjetjeGumb && podjetjeGumb.getAttribute("aria-pressed") !== "true") {
        podjetjeGumb.click();
      }
      var dogodek = new win.CustomEvent("uj:izberi-podjetje", {
        bubbles: true,
        cancelable: true,
        detail: podjetje,
      });
      var obravnavano = !doc.dispatchEvent(dogodek);
      if (!obravnavano) {
        var naziv = doc.getElementById("naziv-podjetja");
        if (naziv) {
          naziv.value = podjetje.name;
          naziv.dispatchEvent(new win.Event("input", { bubbles: true }));
          naziv.dispatchEvent(new win.Event("change", { bubbles: true }));
        }
      }
      zapriSheet();
    }

    function narediPill(podjetje) {
      var gumb = doc.createElement("button");
      gumb.type = "button";
      gumb.className = "nedavna-podjetja__pill";
      gumb.setAttribute("role", "listitem");
      gumb.setAttribute("aria-pressed", "false");
      gumb.dataset.podjetjeKljuc = kljucPodjetja(podjetje);
      if (gumb.dataset.podjetjeKljuc === izbraniKljuc) {
        gumb.classList.add("nedavna-podjetja__pill--izbran");
        gumb.setAttribute("aria-pressed", "true");
      }
      gumb.setAttribute("aria-label", "Izberi podjetje " + podjetje.name);
      var napis = doc.createElement("span");
      napis.textContent = podjetje.name;
      napis.setAttribute("data-fit-text", "");
      napis.setAttribute("data-fit-text-lines", "2");
      napis.setAttribute("data-fit-text-min", "9");
      gumb.appendChild(napis);
      gumb.addEventListener("click", function () { izberiPodjetje(podjetje); });
      return gumb;
    }

    function izrisiHitriSeznam() {
      trak.innerHTML = "";
      podjetja.forEach(function (podjetje) {
        trak.appendChild(narediPill(podjetje));
      });
      sklop.hidden = false;
      vec.disabled = podjetja.length === 0;
    }

    function aktivnaKategorija() {
      return kategorije.find(function (kategorija) { return kategorija.id === aktivnaKategorijaId; }) || null;
    }

    function ciljnaKategorija() {
      return kategorije.find(function (kategorija) { return kategorija.id === ciljnaKategorijaId; }) || null;
    }

    function urejanaKategorija() {
      return kategorije.find(function (kategorija) { return kategorija.id === urejanaKategorijaId; }) || null;
    }

    function zapriNastavitveKategorije() {
      urejanaKategorijaId = "";
      kategorijaNastavitve.hidden = true;
      kategorijaUrediIme.value = "";
      kategorijaUrediIme.setCustomValidity("");
    }

    function odpriNastavitveKategorije(kategorija) {
      if (!urejanjeKategorij || dodajanjeVKategorijo) return;
      urejanaKategorijaId = kategorija.id;
      kategorijaUrediIme.value = kategorija.name;
      kategorijaUrediIme.setCustomValidity("");
      kategorijaPovzetek.textContent = kategorija.companyKeys.length + (kategorija.companyKeys.length === 1 ? " podjetje" : " podjetij");
      kategorijaNastavitve.hidden = false;
      kategorijaUrediIme.focus({ preventScroll: true });
    }

    function posodobiDodajanjeVKategorijo() {
      var pripravljeno = dodajanjeVKategorijo && izbraniKljuciZaKategorijo.size > 0 && Boolean(ciljnaKategorija());
      dodajVKategorijeGumb.textContent = "Dodaj v kategorije";
      dodajVKategorijeGumb.disabled = !dodajanjeVKategorijo && kategorije.length === 0;
      dodajVKategorijeGumb.classList.toggle("podjetja-sheet__dodaj-v-kategorije--aktivno", dodajanjeVKategorijo);
      dodajVKategorijeGumb.setAttribute("aria-pressed", dodajanjeVKategorijo ? "true" : "false");
      dodajNavodiloVrstica.hidden = !dodajanjeVKategorijo;
      if (dodajanjeVKategorijo) {
        dodajNavodilo.textContent = izbraniKljuciZaKategorijo.size === 0
          ? "Izberite podjetje spodaj in kategorijo zgoraj."
          : ciljnaKategorija()
            ? "Izbira je pripravljena za dodajanje."
            : "Izberite še kategorijo zgoraj.";
      }
      dodajPotrdiGumb.disabled = !pripravljeno;
      nedavnaGumb.disabled = dodajanjeVKategorijo;
      kategorijaVseGumb.disabled = dodajanjeVKategorijo;
      if (kategorijeUrediGumb) kategorijeUrediGumb.disabled = dodajanjeVKategorijo;
    }

    function posodobiPikice() {
      Array.from(kategorijePikice.children).forEach(function (pikica, indeks) {
        var aktivna = indeks === aktivnaStranKategorij;
        pikica.classList.toggle("podjetja-sheet__kategorije-pikica--aktivna", aktivna);
        pikica.setAttribute("aria-current", aktivna ? "true" : "false");
      });
    }

    function prikaziStranKategorij(indeks, gladko) {
      var steviloStrani = razdeliKategorijeNaStrani(premicneKategorije(), KATEGORIJ_NA_STRAN).length;
      aktivnaStranKategorij = Math.max(0, Math.min(indeks, steviloStrani - 1));
      win.requestAnimationFrame(function () {
        kategorijeViewport.scrollTo({
          left: aktivnaStranKategorij * kategorijeViewport.clientWidth,
          behavior: gladko ? "smooth" : "auto",
        });
        posodobiPikice();
      });
    }

    function razredMesta(element) {
      return Array.from(element.classList).find(function (razred) {
        return razred.indexOf("podjetja-sheet__kategorija-element--mesto-") === 0;
      }) || "";
    }

    function zamenjajVidniMesti(izvor, cilj) {
      var stariOkvirCilja = cilj.getBoundingClientRect();
      var izvorniRazred = razredMesta(izvor);
      var ciljniRazred = razredMesta(cilj);
      var izvornoMesto = doc.createComment("kategorija-izvor");
      var ciljnoMesto = doc.createComment("kategorija-cilj");
      izvor.parentNode.replaceChild(izvornoMesto, izvor);
      cilj.parentNode.replaceChild(ciljnoMesto, cilj);
      if (izvorniRazred) izvor.classList.replace(izvorniRazred, ciljniRazred);
      if (ciljniRazred) cilj.classList.replace(ciljniRazred, izvorniRazred);
      izvornoMesto.parentNode.replaceChild(cilj, izvornoMesto);
      ciljnoMesto.parentNode.replaceChild(izvor, ciljnoMesto);
      var noviOkvirCilja = cilj.getBoundingClientRect();
      cilj.style.transition = "none";
      cilj.style.transform = "translate3d(" + (stariOkvirCilja.left - noviOkvirCilja.left) + "px, " + (stariOkvirCilja.top - noviOkvirCilja.top) + "px, 0)";
      cilj.offsetWidth;
      win.requestAnimationFrame(function () {
        cilj.style.transition = "transform 190ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 190ms ease";
        cilj.style.transform = "";
        win.setTimeout(function () {
          cilj.style.transition = "";
        }, 210);
      });
    }

    function omogociPremikanjeKategorije(element, kategorija) {
      element.addEventListener("pointerdown", function (zacetniDogodek) {
        if (zacetniDogodek.button !== 0 || zacetniDogodek.target.closest("button:not(.podjetja-sheet__kategorija-gumb)")) return;
        var DOLGI_PRITISK_MS = 300;
        var pointerId = zacetniDogodek.pointerId;
        var zacetniX = zacetniDogodek.clientX;
        var zacetniY = zacetniDogodek.clientY;
        var zahtevaDolgiPritisk = zacetniDogodek.pointerType === "touch" || zacetniDogodek.pointerType === "pen";
        var pripravljen = !zahtevaDolgiPritisk;
        var dolgiPritiskCasovnik = null;
        var premikanje = false;
        var zadnjaMenjavaStrani = 0;
        var zadnjiCiljId = "";
        var duh = null;
        var zacetniOkvir = null;
        var predogledKategorij = kategorije.slice();

        function pocistiCasovnik() {
          if (!dolgiPritiskCasovnik) return;
          win.clearTimeout(dolgiPritiskCasovnik);
          dolgiPritiskCasovnik = null;
        }

        function pocistiPoslusalce() {
          win.removeEventListener("pointermove", medPremikanjem);
          win.removeEventListener("pointerup", koncajPremikanje);
          win.removeEventListener("pointercancel", koncajPremikanje);
        }

        function zacniPremikanje() {
          element.classList.remove("podjetja-sheet__kategorija-element--dolg-pritisk");
          zacetniOkvir = element.getBoundingClientRect();
          duh = element.cloneNode(true);
          duh.classList.remove("podjetja-sheet__kategorija-element--premikanje");
          duh.classList.add("podjetja-sheet__kategorija-element--duh");
          duh.removeAttribute("data-kategorija-id");
          duh.style.left = zacetniOkvir.left + "px";
          duh.style.top = zacetniOkvir.top + "px";
          duh.style.width = zacetniOkvir.width + "px";
          duh.style.height = zacetniOkvir.height + "px";
          doc.body.appendChild(duh);
          element.classList.add("podjetja-sheet__kategorija-element--premikanje");
        }

        function medPremikanjem(dogodek) {
          if (dogodek.pointerId !== pointerId) return;
          var razdalja = Math.hypot(dogodek.clientX - zacetniX, dogodek.clientY - zacetniY);
          if (!pripravljen) {
            if (razdalja >= 8) {
              pocistiCasovnik();
              pocistiPoslusalce();
            }
            return;
          }
          if (!premikanje && razdalja < 8) return;
          if (!premikanje) {
            premikanje = true;
            zacniPremikanje();
          }
          dogodek.preventDefault();
          duh.style.left = (zacetniOkvir.left + dogodek.clientX - zacetniX) + "px";
          duh.style.top = (zacetniOkvir.top + dogodek.clientY - zacetniY) + "px";
          var cilj = Array.from(doc.querySelectorAll(".podjetja-sheet__kategorije-dok .podjetja-sheet__kategorija-element")).find(function (moznost) {
            if (moznost === element) return false;
            var okvir = moznost.getBoundingClientRect();
            return dogodek.clientX >= okvir.left && dogodek.clientX <= okvir.right
              && dogodek.clientY >= okvir.top && dogodek.clientY <= okvir.bottom;
          });
          if (cilj && cilj.dataset.kategorijaId !== zadnjiCiljId) {
            zadnjiCiljId = cilj.dataset.kategorijaId;
            predogledKategorij = zamenjajKategoriji(predogledKategorij, kategorija.id, zadnjiCiljId);
            zamenjajVidniMesti(element, cilj);
          } else if (!cilj) {
            zadnjiCiljId = "";
          }
          var meja = kategorijeViewport.getBoundingClientRect();
          var zdaj = Date.now();
          if (zdaj - zadnjaMenjavaStrani > 420 && dogodek.clientX > meja.right - 20) {
            prikaziStranKategorij(aktivnaStranKategorij + 1, true);
            zadnjaMenjavaStrani = zdaj;
          } else if (zdaj - zadnjaMenjavaStrani > 420 && dogodek.clientX < meja.left + 20) {
            prikaziStranKategorij(aktivnaStranKategorij - 1, true);
            zadnjaMenjavaStrani = zdaj;
          }
        }

        function koncajPremikanje(dogodek) {
          if (dogodek.pointerId !== pointerId) return;
          pocistiCasovnik();
          pocistiPoslusalce();
          element.classList.remove("podjetja-sheet__kategorija-element--dolg-pritisk");
          if (!premikanje) {
            win.setTimeout(function () { delete element.dataset.premaknjeno; }, 0);
            return;
          }
          if (dogodek.type === "pointercancel") {
            if (duh) duh.remove();
            element.classList.remove("podjetja-sheet__kategorija-element--premikanje");
            izrisiKategorije();
            return;
          }
          kategorije = predogledKategorij;
          aktivnaStranKategorij = stranKategorije(Math.max(0, kategorije.findIndex(function (vrednost) { return vrednost.id === kategorija.id; })));
          if (zadnjiCiljId) {
            shraniKategorije();
          }
          element.dataset.premaknjeno = "true";
          var koncniOkvir = element.getBoundingClientRect();
          if (duh) {
            duh.classList.add("podjetja-sheet__kategorija-element--spuscena");
            duh.style.left = koncniOkvir.left + "px";
            duh.style.top = koncniOkvir.top + "px";
          }
          win.setTimeout(function () {
            if (duh) duh.remove();
            element.classList.remove("podjetja-sheet__kategorija-element--premikanje");
            delete element.dataset.premaknjeno;
            izrisiKategorije();
          }, 175);
        }

        if (zahtevaDolgiPritisk) {
          dolgiPritiskCasovnik = win.setTimeout(function () {
            dolgiPritiskCasovnik = null;
            pripravljen = true;
            element.dataset.premaknjeno = "true";
            element.classList.add("podjetja-sheet__kategorija-element--dolg-pritisk");
          }, DOLGI_PRITISK_MS);
        }

        win.addEventListener("pointermove", medPremikanjem, { passive: false });
        win.addEventListener("pointerup", koncajPremikanje);
        win.addEventListener("pointercancel", koncajPremikanje);
      });
    }

    function narediKategorijo(kategorija, mesto) {
      var element = doc.createElement("div");
      var aktiven = kategorija.id === (dodajanjeVKategorijo ? ciljnaKategorijaId : aktivnaKategorijaId);
      element.className = "podjetja-sheet__kategorija-element podjetja-sheet__kategorija-element--mesto-" + mesto;
      element.dataset.kategorijaId = kategorija.id;
      var gumb = doc.createElement("button");
      gumb.type = "button";
      gumb.className = "podjetja-sheet__kategorija-gumb" + (aktiven ? " podjetja-sheet__kategorija-gumb--aktiven" : "");
      gumb.setAttribute("role", "tab");
      gumb.setAttribute("aria-selected", aktiven ? "true" : "false");
      if (!dodajanjeVKategorijo) gumb.setAttribute("aria-description", "Kategorijo lahko pridržite in povlečete na drugo mesto.");
      var ime = doc.createElement("span");
      ime.textContent = kategorija.name;
      ime.setAttribute("data-fit-text", "");
      ime.setAttribute("data-fit-text-min", "9");
      var stevilo = doc.createElement("span");
      stevilo.className = "podjetja-sheet__kategorija-stevilo";
      stevilo.textContent = String(kategorija.companyKeys.length);
      gumb.appendChild(ime);
      gumb.appendChild(stevilo);
      gumb.addEventListener("click", function () {
        if (element.dataset.premaknjeno === "true") {
          delete element.dataset.premaknjeno;
          return;
        }
        if (dodajanjeVKategorijo) {
          ciljnaKategorijaId = kategorija.id;
          izrisiKategorije();
          posodobiDodajanjeVKategorijo();
          return;
        }
        if (urejanjeKategorij) {
          odpriNastavitveKategorije(kategorija);
          return;
        }
        aktivnaKategorijaId = kategorija.id;
        nedavnaGumb.classList.remove("podjetja-sheet__nedavna-gumb--aktiven");
        nedavnaGumb.setAttribute("aria-pressed", "false");
        izrisiKategorije();
        izrisiSheet();
      });
      element.appendChild(gumb);
      if (urejanjeKategorij) {
        element.classList.add("podjetja-sheet__kategorija-element--urejanje");
        var nastavitveGumb = doc.createElement("button");
        nastavitveGumb.type = "button";
        nastavitveGumb.className = "podjetja-sheet__kategorija-nastavitve-gumb";
        nastavitveGumb.setAttribute("aria-label", "Nastavitve kategorije " + kategorija.name);
        nastavitveGumb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.97a1.7 1.7 0 0 0-.34-1.88l-.06-.06L7.03 4.2l.06.06A1.7 1.7 0 0 0 8.97 4.6 1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.03 1.52 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></svg>';
        nastavitveGumb.addEventListener("click", function () { odpriNastavitveKategorije(kategorija); });
        element.appendChild(nastavitveGumb);
      }
      if (!dodajanjeVKategorijo) omogociPremikanjeKategorije(element, kategorija);
      return element;
    }

    function izrisiKategorije() {
      var strani = razdeliKategorijeNaStrani(premicneKategorije(), KATEGORIJ_NA_STRAN);
      if (aktivnaStranKategorij >= strani.length) aktivnaStranKategorij = strani.length - 1;
      kategorijeSeznam.innerHTML = "";
      kategorijePikice.innerHTML = "";
      kategorijaVseStevilo.textContent = String(podjetja.length);
      var vseAktivno = aktivnaKategorijaId === VSE_KATEGORIJE_ID;
      if (dodajanjeVKategorijo) vseAktivno = false;
      kategorijaVseGumb.classList.toggle("podjetja-sheet__kategorija-vse--aktivna", vseAktivno);
      kategorijaVseGumb.setAttribute("aria-selected", vseAktivno ? "true" : "false");
      if (kategorijePrazno) kategorijePrazno.hidden = kategorije.length > 0;
      if (kategorijeUrediGumb) {
        kategorijeUrediGumb.hidden = kategorije.length < 1;
        kategorijeUrediGumb.classList.toggle("podjetja-sheet__kategorije-uredi--aktivno", urejanjeKategorij);
        kategorijeUrediGumb.setAttribute("aria-pressed", urejanjeKategorij ? "true" : "false");
        kategorijeUrediGumb.textContent = urejanjeKategorij ? "Končano" : "Uredi kategorije";
      }
      strani.forEach(function (kategorijeStrani, indeksStrani) {
        var stran = doc.createElement("div");
        stran.className = "podjetja-sheet__kategorije-stran";
        stran.dataset.stran = String(indeksStrani);
        kategorijeStrani.forEach(function (kategorija, indeks) {
          stran.appendChild(narediKategorijo(kategorija, indeks + 1));
        });
        kategorijeSeznam.appendChild(stran);
        var pikica = doc.createElement("button");
        pikica.type = "button";
        pikica.className = "podjetja-sheet__kategorije-pikica";
        pikica.setAttribute("aria-label", "Prikaži stran kategorij " + (indeksStrani + 1));
        pikica.addEventListener("click", function () { prikaziStranKategorij(indeksStrani, true); });
        kategorijePikice.appendChild(pikica);
      });
      kategorijePikice.hidden = strani.length < 2;
      prikaziStranKategorij(aktivnaStranKategorij, false);
      posodobiDodajanjeVKategorijo();
    }

    function izrisiSheet() {
      sheetSeznam.innerHTML = "";
      var kategorija = dodajanjeVKategorijo ? null : aktivnaKategorija();
      var vseKategorije = !dodajanjeVKategorijo && aktivnaKategorijaId === VSE_KATEGORIJE_ID;
      var prikazanaPodjetja;
      if (kategorija && !iskalniNiz) {
        prikazanaPodjetja = podjetja.filter(function (podjetje) {
          return kategorija.companyKeys.includes(kljucPodjetja(podjetje));
        });
      } else {
        prikazanaPodjetja = filtrirajPodjetja(podjetja, iskalniNiz);
      }
      prikazanaPodjetja = razvrstiPodjetja(prikazanaPodjetja, kategorija || vseKategorije ? "az" : "nedavna");
      if (sheetSeznamNaslov) {
        sheetSeznamNaslov.textContent = dodajanjeVKategorijo
          ? "Nedavno uporabljena podjetja"
          : kategorija
          ? kategorija.name + (iskalniNiz ? " · rezultati iskanja" : "")
          : vseKategorije
            ? (iskalniNiz ? "Vsa podjetja · rezultati iskanja" : "Vsa podjetja")
            : (iskalniNiz ? "Rezultati iskanja" : "Nedavno uporabljena podjetja");
      }
      if (!prikazanaPodjetja.length) {
        var prazno = doc.createElement("p");
        prazno.className = "podjetja-sheet__seznam-prazno";
        prazno.textContent = kategorija && !iskalniNiz
          ? "V tej kategoriji še ni podjetij. V iskalnik vpišite podjetje in ga dodajte."
          : "Ni podjetij, ki bi ustrezala iskanju.";
        sheetSeznam.appendChild(prazno);
        return;
      }
      prikazanaPodjetja.forEach(function (podjetje, indeksPodjetja) {
        var kljuc = kljucPodjetja(podjetje);
        var izbranZaKategorijo = dodajanjeVKategorijo && izbraniKljuciZaKategorijo.has(kljuc);
        var vrstica = doc.createElement("div");
        vrstica.className = "podjetja-sheet__podjetje-vrstica";
        var ikona = doc.createElement("span");
        ikona.className = "podjetja-sheet__podjetje-ikona";
        ikona.setAttribute("aria-hidden", "true");
        ikona.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4M9 9h.01M15 9h.01M9 13h.01M15 13h.01"/></svg>';
        if (dodajanjeVKategorijo) {
          var gumb = doc.createElement("button");
          gumb.type = "button";
          gumb.className = "podjetja-sheet__podjetje podjetja-sheet__podjetje--izbira"
            + (izbranZaKategorijo ? " podjetja-sheet__podjetje--izbrano" : "");
          gumb.setAttribute("aria-pressed", izbranZaKategorijo ? "true" : "false");
          gumb.setAttribute("aria-label", "Izberi podjetje " + podjetje.name);
          var besediloPodjetja = doc.createElement("span");
          besediloPodjetja.className = "podjetja-sheet__podjetje-besedilo";
          var ime = doc.createElement("strong");
          ime.textContent = podjetje.name;
          ime.setAttribute("data-fit-text", "");
          ime.setAttribute("data-fit-text-min", "9");
          var opis = doc.createElement("small");
          opis.textContent = oznakaDatuma(podjetje.usedAt);
          var puscica = doc.createElement("span");
          puscica.className = "podjetja-sheet__podjetje-puscica podjetja-sheet__podjetje-puscica--izbira";
          puscica.setAttribute("aria-hidden", "true");
          puscica.textContent = izbranZaKategorijo ? "●" : "○";
          besediloPodjetja.appendChild(ime);
          besediloPodjetja.appendChild(opis);
          gumb.appendChild(ikona);
          gumb.appendChild(besediloPodjetja);
          gumb.appendChild(puscica);
          gumb.addEventListener("click", function () {
            if (izbranZaKategorijo) {
              izbraniKljuciZaKategorijo.delete(kljuc);
            } else if (kljuc) {
              izbraniKljuciZaKategorijo.add(kljuc);
            }
            izrisiSheet();
            posodobiDodajanjeVKategorijo();
          });
          vrstica.appendChild(gumb);
        } else {
          var kartica = doc.createElement("article");
          kartica.className = "podjetja-sheet__podjetje podjetja-sheet__podjetje--bogato";
          function ikonaKontaktnegaPolja(kljucPolja) {
            if (kljucPolja === "phone") {
              return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z"/></svg>';
            }
            if (kljucPolja === "email") {
              return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
            }
            if (kljucPolja === "vatId") {
              return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></svg>';
            }
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
          }
          var ocena = sistemskaOcena(podjetje);
          var statusPodjetja = ocena.score >= 82
            ? { razred: "dobra", napis: "Zanesljivo" }
            : ocena.score >= 60
              ? { razred: "srednja", napis: "Potrebno spremljanje" }
              : { razred: "nizka", napis: "Potrebna pozornost" };
          var ikoneStatusa = {
            dobra: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>',
            srednja: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/></svg>',
            nizka: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.7 20h18.6Z"/><path d="M12 9v4M12 17h.01"/></svg>',
          };
          ikona.classList.add("podjetja-sheet__podjetje-ikona--status", "podjetja-sheet__podjetje-ikona--status-" + statusPodjetja.razred);
          ikona.innerHTML = ikoneStatusa[statusPodjetja.razred];
          var podrobnostiId = "podjetje-podrobnosti-" + indeksPodjetja + "-" + normalizirajIme(kljuc).replace(/\s+/g, "-");
          var glava = doc.createElement("div");
          glava.className = "podjetja-sheet__podjetje-glava";
          var naslov = doc.createElement("div");
          naslov.className = "podjetja-sheet__podjetje-naslov";
          var bogatoIme = doc.createElement("strong");
          bogatoIme.textContent = podjetje.name;
          bogatoIme.title = podjetje.name;
          bogatoIme.setAttribute("data-fit-text", "");
          bogatoIme.setAttribute("data-fit-text-min", "8");
          var status = doc.createElement("span");
          status.className = "podjetja-sheet__status podjetja-sheet__status--" + statusPodjetja.razred;
          status.innerHTML = '<span class="podjetja-sheet__status-napis"></span>';
          status.querySelector(".podjetja-sheet__status-napis").textContent = statusPodjetja.napis;
          naslov.appendChild(status);
          naslov.appendChild(bogatoIme);
          var izbrisi = doc.createElement("button");
          izbrisi.type = "button";
          izbrisi.className = "podjetja-sheet__podjetje-izbrisi";
          izbrisi.setAttribute("aria-label", "Izbriši podjetje " + podjetje.name);
          izbrisi.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 10v6M14 10v6"/></svg>';
          var razsiri = doc.createElement("button");
          razsiri.type = "button";
          razsiri.className = "podjetja-sheet__podjetje-razsiri";
          razsiri.setAttribute("aria-expanded", "false");
          razsiri.setAttribute("aria-controls", podrobnostiId);
          razsiri.setAttribute("aria-label", "Prikaži vse podatke za " + podjetje.name);
          razsiri.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
          glava.appendChild(ikona);
          glava.appendChild(naslov);
          glava.appendChild(izbrisi);
          glava.appendChild(razsiri);
          kartica.appendChild(glava);
          var kontaktniPovzetek = doc.createElement("div");
          kontaktniPovzetek.className = "podjetja-sheet__kontaktni-podatki";
          [
            { key: "phone", label: "Telefon", value: podjetje.phone },
            { key: "email", label: "E-pošta", value: podjetje.email },
            { key: "vatId", label: "Davčna številka", value: podjetje.vatId },
            { key: "contactPerson", label: "Kontaktna oseba", value: podjetje.contactPerson },
          ].forEach(function (polje) {
            var podatek = doc.createElement("div");
            podatek.className = "podjetja-sheet__kontaktni-podatek";
            var ikonaPodatka = doc.createElement("span");
            ikonaPodatka.className = "podjetja-sheet__kontaktni-podatek-ikona";
            ikonaPodatka.setAttribute("aria-hidden", "true");
            ikonaPodatka.innerHTML = ikonaKontaktnegaPolja(polje.key);
            var besediloPodatka = doc.createElement("span");
            besediloPodatka.className = "podjetja-sheet__kontaktni-podatek-besedilo";
            var oznakaPodatka = doc.createElement("span");
            oznakaPodatka.textContent = polje.label;
            var vrednostPodatka = doc.createElement("strong");
            vrednostPodatka.textContent = besedilo(polje.value) || "Ni podatka";
            vrednostPodatka.classList.toggle("je-prazno", !besedilo(polje.value));
            besediloPodatka.appendChild(oznakaPodatka);
            besediloPodatka.appendChild(vrednostPodatka);
            podatek.appendChild(ikonaPodatka);
            podatek.appendChild(besediloPodatka);
            kontaktniPovzetek.appendChild(podatek);
          });
          kartica.appendChild(kontaktniPovzetek);
          var podrobnosti = doc.createElement("div");
          podrobnosti.className = "podjetja-sheet__podjetje-podrobnosti";
          podrobnosti.id = podrobnostiId;
          podrobnosti.hidden = true;
          var podatkiSklop = doc.createElement("section");
          podatkiSklop.className = "podjetja-sheet__osnovni-podatki";
          podatkiSklop.setAttribute("aria-label", "Osnovni podatki podjetja");
          var podatkiMreza = doc.createElement("div");
          podatkiMreza.className = "podjetja-sheet__osnovni-podatki-mreza";
          var podatkovnaPolja = [
            { key: "vatId", label: "Davčna številka", value: podjetje.vatId },
            { key: "contactPerson", label: "Kontaktna oseba", value: podjetje.contactPerson },
            { key: "phone", label: "Telefon", value: podjetje.phone },
            { key: "email", label: "E-pošta", value: podjetje.email },
          ];
          var podatkovniVnosi = [];
          podatkovnaPolja.forEach(function (polje) {
            var ovojPolja = doc.createElement("label");
            ovojPolja.className = "podjetja-sheet__osnovni-podatek" + (polje.wide ? " podjetja-sheet__osnovni-podatek--sirina" : "");
            var vsebinaPolja = doc.createElement("span");
            vsebinaPolja.className = "podjetja-sheet__osnovni-podatek-vsebina";
            var oznakaPolja = doc.createElement("span");
            oznakaPolja.textContent = polje.label;
            var vnosPolja = doc.createElement("input");
            vnosPolja.type = "text";
            vnosPolja.value = besedilo(polje.value);
            vnosPolja.placeholder = "Ni podatka";
            vnosPolja.readOnly = true;
            vnosPolja.dataset.podjetjePolje = polje.key;
            vnosPolja.setAttribute("aria-label", polje.label);
            vnosPolja.setAttribute("aria-readonly", "true");
            vsebinaPolja.appendChild(oznakaPolja);
            vsebinaPolja.appendChild(vnosPolja);
            if (!polje.wide) {
              var ikonaPolja = doc.createElement("span");
              ikonaPolja.className = "podjetja-sheet__osnovni-podatek-ikona";
              ikonaPolja.setAttribute("aria-hidden", "true");
              ikonaPolja.innerHTML = ikonaKontaktnegaPolja(polje.key);
              ovojPolja.appendChild(ikonaPolja);
            }
            ovojPolja.appendChild(vsebinaPolja);
            podatkiMreza.appendChild(ovojPolja);
            podatkovniVnosi.push(vnosPolja);
          });
          podatkiSklop.appendChild(podatkiMreza);
          podrobnosti.appendChild(podatkiSklop);
          var zgodovina = povzetekZgodovine(podjetje);
          if (zgodovina) {
            var zgodovinaVrstica = doc.createElement("p");
            zgodovinaVrstica.className = "podjetja-sheet__zgodovina";
            var zgodovinaBesedilo = doc.createElement("span");
            zgodovinaBesedilo.textContent = zgodovina;
            zgodovinaBesedilo.setAttribute("data-fit-text", "");
            zgodovinaBesedilo.setAttribute("data-fit-text-lines", "2");
            zgodovinaBesedilo.setAttribute("data-fit-text-min", "7");
            zgodovinaVrstica.appendChild(zgodovinaBesedilo);
            var imaAktivenPrimer = (podjetje.cases || []).some(function (primer) { return !jeResenaZadeva(primer); });
            if (!imaAktivenPrimer) {
              var brezOdprtih = doc.createElement("em");
              brezOdprtih.textContent = "Brez odprtih primerov";
              zgodovinaVrstica.appendChild(brezOdprtih);
            }
            zgodovinaVrstica.title = zgodovina;
            podrobnosti.appendChild(zgodovinaVrstica);
          }
          var razlaga = doc.createElement("p");
          razlaga.className = "podjetja-sheet__razlaga";
          razlaga.innerHTML = '<span class="podjetja-sheet__razlaga-ikona" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg></span><span class="podjetja-sheet__razlaga-besedilo"></span>';
          razlaga.querySelector(".podjetja-sheet__razlaga-besedilo").textContent = razlagaSpremljanja(podjetje);
          podrobnosti.appendChild(razlaga);
          var noga = doc.createElement("div");
          noga.className = "podjetja-sheet__podjetje-noga";
          noga.hidden = true;
          var urediPodatke = doc.createElement("button");
          urediPodatke.type = "button";
          urediPodatke.className = "podjetja-sheet__uredi-podatke";
          urediPodatke.textContent = "Uredi podatke";
          var opombaOvoj = doc.createElement("label");
          opombaOvoj.className = "podjetja-sheet__opomba";
          var opombaIkona = doc.createElement("span");
          opombaIkona.className = "podjetja-sheet__opomba-ikona";
          opombaIkona.setAttribute("aria-hidden", "true");
          opombaIkona.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>';
          var opombaVsebina = doc.createElement("span");
          opombaVsebina.className = "podjetja-sheet__opomba-vsebina";
          var opombaNapis = doc.createElement("span");
          opombaNapis.textContent = "Moja opomba";
          var opomba = doc.createElement("input");
          opomba.type = "text";
          opomba.maxLength = 120;
          opomba.placeholder = "Dodaj opombo";
          opomba.value = besedilo(preberiOpombe()[kljuc]);
          ["click", "pointerdown", "keydown"].forEach(function (imeDogodka) {
            opomba.addEventListener(imeDogodka, function (dogodek) { dogodek.stopPropagation(); });
          });
          opomba.addEventListener("change", function () { shraniOpombo(kljuc, opomba.value); });
          opombaVsebina.appendChild(opombaNapis);
          opombaVsebina.appendChild(opomba);
          opombaOvoj.appendChild(opombaIkona);
          opombaOvoj.appendChild(opombaVsebina);
          var urejanjePodatkov = false;
          urediPodatke.addEventListener("click", function () {
            if (urejanjePodatkov) {
              podatkovniVnosi.forEach(function (vnos) {
                var kljucPolja = vnos.dataset.podjetjePolje;
                var vrednost = besedilo(vnos.value);
                if (kljucPolja === "name" && !vrednost) {
                  vrednost = podjetje.name;
                }
                vnos.value = vrednost;
                podjetje[kljucPolja] = vrednost;
              });
              shraniPodatkePodjetja(kljuc, podjetje);
              bogatoIme.textContent = podjetje.name;
            }
            urejanjePodatkov = !urejanjePodatkov;
            podatkiSklop.classList.toggle("podjetja-sheet__osnovni-podatki--urejanje", urejanjePodatkov);
            podatkovniVnosi.forEach(function (vnos) {
              vnos.readOnly = !urejanjePodatkov;
              vnos.setAttribute("aria-readonly", urejanjePodatkov ? "false" : "true");
            });
            urediPodatke.classList.toggle("podjetja-sheet__uredi-podatke--shrani", urejanjePodatkov);
            urediPodatke.textContent = urejanjePodatkov ? "Shrani podatke" : "Uredi podatke";
            if (urejanjePodatkov && podatkovniVnosi.length) podatkovniVnosi[0].focus({ preventScroll: true });
          });
          var uporabi = doc.createElement("button");
          uporabi.type = "button";
          uporabi.className = "podjetja-sheet__uporabi-podatke";
          uporabi.hidden = true;
          uporabi.innerHTML = "<span>Uporabi podatke</span><b aria-hidden=\"true\">›</b>";
          uporabi.addEventListener("click", function () { izberiPodjetje(podjetje); });
          noga.appendChild(urediPodatke);
          noga.appendChild(opombaOvoj);
          podrobnosti.appendChild(noga);
          podrobnosti.appendChild(uporabi);
          kartica.appendChild(podrobnosti);
          razsiri.addEventListener("click", function () {
            var razsirjena = podrobnosti.hidden;
            podrobnosti.hidden = !razsirjena;
            kartica.classList.toggle("podjetja-sheet__podjetje--razsirjeno", razsirjena);
            razsiri.setAttribute("aria-expanded", razsirjena ? "true" : "false");
            razsiri.setAttribute("aria-label", (razsirjena ? "Skrij podrobnosti za " : "Prikaži vse podatke za ") + podjetje.name);
          });
          izbrisi.addEventListener("click", function () {
            var potrjeno = typeof win.confirm !== "function"
              || win.confirm("Ali želite podjetje " + podjetje.name + " odstraniti iz seznama za ponovni vnos?");
            if (!potrjeno) return;
            izbrisaniKljuciPodjetij.add(kljuc);
            shraniIzbrisaneKljuciPodjetij();
            podjetja = podjetja.filter(function (moznost) { return kljucPodjetja(moznost) !== kljuc; });
            kategorije.forEach(function (moznost) {
              moznost.companyKeys = moznost.companyKeys.filter(function (vrednost) { return vrednost !== kljuc; });
            });
            if (izbraniKljuc === kljuc) izbraniKljuc = "";
            shraniKategorije();
            izrisiHitriSeznam();
            izrisiKategorije();
            izrisiSheet();
          });
          vrstica.appendChild(kartica);
        }
        if (kategorija && iskalniNiz) {
          var dodano = kategorija.companyKeys.includes(kljuc);
          var dodajGumb = doc.createElement("button");
          dodajGumb.type = "button";
          dodajGumb.className = "podjetja-sheet__kategorija-toggle" + (dodano ? " podjetja-sheet__kategorija-toggle--dodano" : "");
          dodajGumb.setAttribute("aria-pressed", dodano ? "true" : "false");
          dodajGumb.setAttribute("aria-label", (dodano ? "Odstrani podjetje iz kategorije " : "Dodaj podjetje v kategorijo ") + kategorija.name);
          dodajGumb.textContent = dodano ? "Dodano" : "Dodaj";
          dodajGumb.addEventListener("click", function () {
            if (dodano) {
              kategorija.companyKeys = kategorija.companyKeys.filter(function (vrednost) { return vrednost !== kljuc; });
            } else if (kljuc) {
              kategorija.companyKeys.push(kljuc);
            }
            shraniKategorije();
            izrisiKategorije();
            izrisiSheet();
          });
          vrstica.appendChild(dodajGumb);
        }
        sheetSeznam.appendChild(vrstica);
      });
    }

    function odpriSheet() {
      if (!podjetja.length) return;
      prejsnjiFokus = doc.activeElement;
      aktivnaKategorijaId = "";
      urejanjeKategorij = false;
      dodajanjeVKategorijo = false;
      izbraniKljuciZaKategorijo.clear();
      ciljnaKategorijaId = "";
      zapriNastavitveKategorije();
      iskalniNiz = "";
      iskanje.value = "";
      nedavnaGumb.classList.add("podjetja-sheet__nedavna-gumb--aktiven");
      nedavnaGumb.setAttribute("aria-pressed", "true");
      izrisiKategorije();
      izrisiSheet();
      posodobiDodajanjeVKategorijo();
      sheet.hidden = false;
      if (sheetNaslov) sheetNaslov.focus({ preventScroll: true });
    }

    vec.addEventListener("click", odpriSheet);
    doc.querySelectorAll("[data-podjetja-zapri]").forEach(function (gumb) {
      gumb.addEventListener("click", zapriSheet);
    });
    dodajVKategorijeGumb.addEventListener("click", function () {
      if (dodajanjeVKategorijo) {
        prekliciDodajanjeVKategorijo();
        return;
      }
      urejanjeKategorij = false;
      zapriNastavitveKategorije();
      dodajanjeVKategorijo = true;
      izbraniKljuciZaKategorijo.clear();
      ciljnaKategorijaId = "";
      aktivnaKategorijaId = "";
      iskalniNiz = "";
      iskanje.value = "";
      nedavnaGumb.classList.remove("podjetja-sheet__nedavna-gumb--aktiven");
      nedavnaGumb.setAttribute("aria-pressed", "false");
      izrisiKategorije();
      izrisiSheet();
    });
    function potrdiDodajanjeVKategorijo() {
      var kategorija = ciljnaKategorija();
      if (!kategorija || izbraniKljuciZaKategorijo.size === 0) return;
      izbraniKljuciZaKategorijo.forEach(function (kljuc) {
        if (!kategorija.companyKeys.includes(kljuc)) kategorija.companyKeys.push(kljuc);
      });
      shraniKategorije();
      aktivnaKategorijaId = kategorija.id;
      dodajanjeVKategorijo = false;
      izbraniKljuciZaKategorijo.clear();
      ciljnaKategorijaId = "";
      izrisiKategorije();
      izrisiSheet();
    }
    function prekliciDodajanjeVKategorijo() {
      dodajanjeVKategorijo = false;
      izbraniKljuciZaKategorijo.clear();
      ciljnaKategorijaId = "";
      aktivnaKategorijaId = "";
      nedavnaGumb.classList.add("podjetja-sheet__nedavna-gumb--aktiven");
      nedavnaGumb.setAttribute("aria-pressed", "true");
      izrisiKategorije();
      izrisiSheet();
    }
    dodajPrekliciGumb.addEventListener("click", prekliciDodajanjeVKategorijo);
    dodajPotrdiGumb.addEventListener("click", potrdiDodajanjeVKategorijo);
    iskanje.addEventListener("input", function () {
      iskalniNiz = iskanje.value;
      izrisiSheet();
    });
    nedavnaGumb.addEventListener("click", function () {
      if (dodajanjeVKategorijo) return;
      aktivnaKategorijaId = "";
      iskalniNiz = "";
      iskanje.value = "";
      nedavnaGumb.classList.add("podjetja-sheet__nedavna-gumb--aktiven");
      nedavnaGumb.setAttribute("aria-pressed", "true");
      izrisiKategorije();
      izrisiSheet();
    });
    kategorijaVseGumb.addEventListener("click", function () {
      if (dodajanjeVKategorijo) return;
      aktivnaKategorijaId = VSE_KATEGORIJE_ID;
      iskalniNiz = "";
      iskanje.value = "";
      nedavnaGumb.classList.remove("podjetja-sheet__nedavna-gumb--aktiven");
      nedavnaGumb.setAttribute("aria-pressed", "false");
      izrisiKategorije();
      izrisiSheet();
    });
    var cakanjeNaPikice = false;
    kategorijeViewport.addEventListener("scroll", function () {
      if (cakanjeNaPikice) return;
      cakanjeNaPikice = true;
      win.requestAnimationFrame(function () {
        var sirina = kategorijeViewport.clientWidth || 1;
        aktivnaStranKategorij = Math.round(kategorijeViewport.scrollLeft / sirina);
        posodobiPikice();
        cakanjeNaPikice = false;
      });
    }, { passive: true });
    if (kategorijeUrediGumb) kategorijeUrediGumb.addEventListener("click", function () {
      if (dodajanjeVKategorijo) return;
      urejanjeKategorij = !urejanjeKategorij;
      if (!urejanjeKategorij) zapriNastavitveKategorije();
      izrisiKategorije();
    });
    novaKategorijaGumb.addEventListener("click", function () {
      kategorijaObrazec.hidden = false;
      kategorijaIme.value = "";
      kategorijaIme.setCustomValidity("");
      kategorijaIme.focus({ preventScroll: true });
    });
    kategorijaIme.addEventListener("input", function () {
      kategorijaIme.setCustomValidity("");
    });
    kategorijaObrazec.addEventListener("submit", function (dogodek) {
      dogodek.preventDefault();
      var ime = besedilo(kategorijaIme.value);
      if (!ime) return;
      var obstaja = kategorije.some(function (kategorija) {
        return normalizirajIme(kategorija.name) === normalizirajIme(ime);
      });
      if (obstaja) {
        kategorijaIme.setCustomValidity("Kategorija s tem imenom že obstaja.");
        kategorijaIme.reportValidity();
        return;
      }
      kategorijaIme.setCustomValidity("");
      var id = win.crypto && typeof win.crypto.randomUUID === "function"
        ? win.crypto.randomUUID()
        : "kategorija-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
      kategorije.push({ id: id, name: ime.slice(0, 40), companyKeys: [] });
      aktivnaKategorijaId = id;
      aktivnaStranKategorij = stranKategorije(kategorije.length - 1);
      kategorijaObrazec.hidden = true;
      kategorijaIme.value = "";
      nedavnaGumb.classList.remove("podjetja-sheet__nedavna-gumb--aktiven");
      nedavnaGumb.setAttribute("aria-pressed", "false");
      shraniKategorije();
      izrisiKategorije();
      izrisiSheet();
    });
    if (kategorijaPreklic) kategorijaPreklic.addEventListener("click", function () {
      kategorijaObrazec.hidden = true;
      kategorijaIme.value = "";
      kategorijaIme.setCustomValidity("");
    });
    kategorijaUrediIme.addEventListener("input", function () {
      kategorijaUrediIme.setCustomValidity("");
    });
    kategorijaNastavitve.addEventListener("submit", function (dogodek) {
      dogodek.preventDefault();
      var kategorija = urejanaKategorija();
      var ime = besedilo(kategorijaUrediIme.value);
      if (!kategorija) return;
      if (!ime) {
        kategorijaUrediIme.setCustomValidity("Vnesite ime kategorije.");
        kategorijaUrediIme.reportValidity();
        return;
      }
      var obstaja = kategorije.some(function (moznost) {
        return moznost.id !== kategorija.id && normalizirajIme(moznost.name) === normalizirajIme(ime);
      });
      if (obstaja) {
        kategorijaUrediIme.setCustomValidity("Kategorija s tem imenom že obstaja.");
        kategorijaUrediIme.reportValidity();
        return;
      }
      kategorija.name = ime.slice(0, 40);
      shraniKategorije();
      zapriNastavitveKategorije();
      izrisiKategorije();
      izrisiSheet();
    });
    kategorijaIzbrisi.addEventListener("click", function () {
      var kategorija = urejanaKategorija();
      if (!kategorija) return;
      kategorije = kategorije.filter(function (moznost) { return moznost.id !== kategorija.id; });
      if (aktivnaKategorijaId === kategorija.id) aktivnaKategorijaId = VSE_KATEGORIJE_ID;
      if (ciljnaKategorijaId === kategorija.id) ciljnaKategorijaId = "";
      zapriNastavitveKategorije();
      shraniKategorije();
      izrisiKategorije();
      izrisiSheet();
    });
    if (kategorijaNastavitveZapri) kategorijaNastavitveZapri.addEventListener("click", zapriNastavitveKategorije);
    doc.addEventListener("keydown", function (dogodek) {
      if (dogodek.key === "Escape" && !sheet.hidden) zapriSheet();
    });
    doc.addEventListener("uj:zadeve-nalozene", function (dogodek) {
      var shranjeniPodatki = preberiShranjenePodatke();
      podjetja = podjetjaIzZadev(dogodek.detail).map(function (podjetje) {
        return uporabiShranjenePodatke(podjetje, shranjeniPodatki);
      }).filter(function (podjetje) {
        return !izbrisaniKljuciPodjetij.has(kljucPodjetja(podjetje));
      });
      izrisiHitriSeznam();
      if (!sheet.hidden) {
        izrisiKategorije();
        izrisiSheet();
      }
    });
  }

  return {
    init: init,
    normalizirajIme: normalizirajIme,
    podjetjaIzZadev: podjetjaIzZadev,
    sistemskaOcena: sistemskaOcena,
    povzetekZgodovine: povzetekZgodovine,
    razlagaSpremljanja: razlagaSpremljanja,
    razvrstiPodjetja: razvrstiPodjetja,
    filtrirajPodjetja: filtrirajPodjetja,
    normalizirajKategorije: normalizirajKategorije,
    premakniKategorijo: premakniKategorijo,
    premakniKategorijoNaMesto: premakniKategorijoNaMesto,
    zamenjajKategoriji: zamenjajKategoriji,
    razdeliKategorijeNaStrani: razdeliKategorijeNaStrani,
    razvrstiKategorijePoId: razvrstiKategorijePoId,
  };
});
