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

  function zdruziPodjetjaSStiki(podjetja, shranjeni) {
    var popravki = shranjeni && typeof shranjeni === "object" ? shranjeni : {};
    var rezultat = (Array.isArray(podjetja) ? podjetja : []).map(function (podjetje) {
      var kljuc = besedilo(podjetje && podjetje.companyId) || normalizirajIme(podjetje && podjetje.name);
      var popravek = popravki[kljuc];
      podjetje.storageKey = kljuc;
      if (!popravek || typeof popravek !== "object") return podjetje;
      ["name", "vatId", "contactPerson", "phone", "email", "usedAt"].forEach(function (polje) {
        if (Object.prototype.hasOwnProperty.call(popravek, polje)) podjetje[polje] = besedilo(popravek[polje]);
      });
      return podjetje;
    });
    var obstojeci = new Set(rezultat.map(function (podjetje) {
      return besedilo(podjetje && podjetje.storageKey)
        || besedilo(podjetje && podjetje.companyId)
        || normalizirajIme(podjetje && podjetje.name);
    }));
    Object.keys(popravki).forEach(function (kljuc) {
      var stik = popravki[kljuc];
      if (obstojeci.has(kljuc) || !stik || !besedilo(stik.name)) return;
      rezultat.push({
        storageKey: kljuc,
        companyId: besedilo(stik.companyId),
        name: besedilo(stik.name),
        registerType: besedilo(stik.registerType),
        registerNumber: besedilo(stik.registerNumber),
        registerCourt: besedilo(stik.registerCourt),
        legalForm: besedilo(stik.legalForm),
        checkedAt: besedilo(stik.checkedAt),
        vatId: besedilo(stik.vatId),
        contactPerson: besedilo(stik.contactPerson),
        phone: besedilo(stik.phone),
        email: besedilo(stik.email),
        usedAt: besedilo(stik.usedAt),
        cases: [],
      });
      obstojeci.add(kljuc);
    });
    return rezultat;
  }

  function razvrstiPodjetja(podjetja, nacin) {
    var kopija = (Array.isArray(podjetja) ? podjetja : []).slice();
    function aktivniDolg(podjetje) {
      return (Array.isArray(podjetje && podjetje.cases) ? podjetje.cases : []).reduce(function (vsota, primer) {
        return vsota + (jeResenaZadeva(primer) ? 0 : (Number(primer && primer.amount) || 0));
      }, 0);
    }
    function najstarejsaZapadlost(podjetje) {
      var datumi = (Array.isArray(podjetje && podjetje.cases) ? podjetje.cases : []).filter(function (primer) {
        return !jeResenaZadeva(primer) && cas(primer && primer.dueAt);
      }).map(function (primer) { return cas(primer.dueAt); });
      return datumi.length ? Math.min.apply(Math, datumi) : Number.POSITIVE_INFINITY;
    }
    if (nacin === "az") {
      return kopija.sort(function (a, b) {
        return a.name.localeCompare(b.name, "sl", { sensitivity: "base" });
      });
    }
    if (nacin === "critical") {
      return kopija.sort(function (a, b) {
        return sistemskaOcena(a).score - sistemskaOcena(b).score || aktivniDolg(b) - aktivniDolg(a);
      });
    }
    if (nacin === "highest_debt") {
      return kopija.sort(function (a, b) { return aktivniDolg(b) - aktivniDolg(a); });
    }
    if (nacin === "oldest") {
      return kopija.sort(function (a, b) { return najstarejsaZapadlost(a) - najstarejsaZapadlost(b); });
    }
    return kopija.sort(function (a, b) {
      return cas(b.usedAt) - cas(a.usedAt);
    });
  }

  function uporabiHitriPogled(podjetja, pogled) {
    var seznam = (Array.isArray(podjetja) ? podjetja : []).slice();
    if (pogled === "missing_contact") {
      seznam = seznam.filter(function (podjetje) { return !besedilo(podjetje && podjetje.phone) || !besedilo(podjetje && podjetje.email); });
      return razvrstiPodjetja(seznam, "critical");
    }
    return razvrstiPodjetja(seznam, pogled);
  }

  var KATEGORIJE_SHRAMBA = "uj_neplacila_podjetja_kategorije_v1";
  var OPOMBE_SHRAMBA = "uj_neplacila_podjetja_opombe_v1";
  var PODATKI_SHRAMBA = "uj_neplacila_podjetja_podatki_v1";
  var IZBRISANA_PODJETJA_SHRAMBA = "uj_neplacila_podjetja_izbrisana_v1";
  var PODJETJA_VRSTNI_RED_SHRAMBA = "uj_neplacila_podjetja_vrstni_red_v1";

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
    var dovoljeneBarve = ["#469c98", "#d99a32", "#d96f5f", "#5f8fc7", "#8468b8", "#7c8a88"];
    var dovoljeniPogledi = ["critical", "highest_debt", "oldest", "recent", "az"];
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
      var color = besedilo(kategorija && kategorija.color).toLowerCase();
      var defaultView = besedilo(kategorija && kategorija.defaultView);
      return {
        id: id,
        name: ime.slice(0, 40),
        companyKeys: kljuci,
        color: dovoljeneBarve.includes(color) ? color : "#469c98",
        defaultView: dovoljeniPogledi.includes(defaultView) ? defaultView : "critical",
      };
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

  function zamenjajKljuca(vrstniRed, prviKljuc, drugiKljuc) {
    var kopija = (Array.isArray(vrstniRed) ? vrstniRed : []).slice();
    var prviIndeks = kopija.indexOf(prviKljuc);
    var drugiIndeks = kopija.indexOf(drugiKljuc);
    if (prviIndeks < 0 || drugiIndeks < 0 || prviIndeks === drugiIndeks) return kopija;
    var zacasni = kopija[prviIndeks];
    kopija[prviIndeks] = kopija[drugiIndeks];
    kopija[drugiIndeks] = zacasni;
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
    var kategorijaIzbiraGumb = doc.getElementById("podjetja-sheet-kategorija-izbira");
    var kategorijaIzbiraOznaka = doc.getElementById("podjetja-sheet-kategorija-izbira-oznaka");
    var kategorijaIzbiraStevilo = doc.getElementById("podjetja-sheet-kategorija-izbira-stevilo");
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
    var kategorijaBarve = Array.from(doc.querySelectorAll('input[name="podjetja-kategorija-barva"]'));
    var kategorijaPrivzetiPogled = doc.getElementById("podjetja-sheet-kategorija-privzeti-pogled");
    var kategorijaPrivzeti = doc.getElementById("podjetja-sheet-kategorija-privzeti");
    var kategorijaPrivzetiGumb = doc.getElementById("podjetja-sheet-kategorija-privzeti-gumb");
    var kategorijaPrivzetiVrednost = doc.getElementById("podjetja-sheet-kategorija-privzeti-vrednost");
    var kategorijaPrivzetiMeni = doc.getElementById("podjetja-sheet-kategorija-privzeti-meni");
    var kategorijaPrivzetiMoznosti = Array.from(doc.querySelectorAll("[data-podjetja-privzeti-pogled]"));
    var hitriPogledi = doc.getElementById("podjetja-sheet-hitri-pogledi");
    var hitriPogledGumbi = Array.from(doc.querySelectorAll("[data-podjetja-hitri-pogled]"));
    var hitriVecGumb = doc.getElementById("podjetja-sheet-hitri-vec");
    var hitriVecMeni = doc.getElementById("podjetja-sheet-hitri-vec-meni");
    var kategorijaNastavitveZapri = doc.querySelector("[data-podjetja-kategorija-nastavitve-zapri]");
    if (!sklop || !trak || !vec || !sheet || !sheetSeznam || !iskanje || !nedavnaGumb || !dodajVKategorijeGumb || !dodajPrekliciGumb || !dodajNavodilo || !dodajNavodiloVrstica || !dodajPotrdiGumb || !kategorijeSeznam || !kategorijeViewport || !kategorijePikice || !kategorijaVseGumb || !kategorijaVseStevilo || !kategorijaIzbiraGumb || !kategorijaIzbiraOznaka || !kategorijaIzbiraStevilo || !novaKategorijaGumb || !kategorijaObrazec || !kategorijaIme || !kategorijaNastavitve || !kategorijaUrediIme || !kategorijaPovzetek || !kategorijaIzbrisi || !kategorijaPrivzetiPogled || !kategorijaPrivzeti || !kategorijaPrivzetiGumb || !kategorijaPrivzetiVrednost || !kategorijaPrivzetiMeni || !hitriPogledi || !hitriVecGumb || !hitriVecMeni || sklop.dataset.ready === "true") return;
    sklop.dataset.ready = "true";

    var podjetja = [];
    var kategorije = preberiKategorije();
    var vrstniRedPodjetij = preberiVrstniRedPodjetij();
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
    var aktivniHitriPogled = "recent";
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

    function preberiVrstniRedPodjetij() {
      try {
        var shranjeni = JSON.parse(win.localStorage.getItem(PODJETJA_VRSTNI_RED_SHRAMBA) || "[]");
        return (Array.isArray(shranjeni) ? shranjeni : []).map(besedilo).filter(Boolean);
      } catch (napaka) {
        return [];
      }
    }

    function shraniVrstniRedPodjetij() {
      try {
        win.localStorage.setItem(PODJETJA_VRSTNI_RED_SHRAMBA, JSON.stringify(vrstniRedPodjetij));
      } catch (napaka) {
        /* Ročno zaporedje ostane veljavno v trenutni seji. */
      }
    }

    function urediPodjetjaPoKljucih(seznam, vrstniRed) {
      var mesta = new Map((Array.isArray(vrstniRed) ? vrstniRed : []).map(function (kljuc, indeks) { return [kljuc, indeks]; }));
      return (Array.isArray(seznam) ? seznam : []).slice().sort(function (a, b) {
        var mestoA = mesta.has(kljucPodjetja(a)) ? mesta.get(kljucPodjetja(a)) : Number.MAX_SAFE_INTEGER;
        var mestoB = mesta.has(kljucPodjetja(b)) ? mesta.get(kljucPodjetja(b)) : Number.MAX_SAFE_INTEGER;
        return mestoA - mestoB;
      });
    }

    function zdruziPrikazaniVrstniRed(osnovni, prikazani) {
      var novi = (Array.isArray(prikazani) ? prikazani : []).slice();
      var dovoljeni = new Set(novi);
      var indeks = 0;
      return (Array.isArray(osnovni) ? osnovni : []).map(function (kljuc) {
        if (!dovoljeni.has(kljuc)) return kljuc;
        var zamenjava = novi[indeks];
        indeks += 1;
        return zamenjava;
      });
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
      kategorijeViewport.hidden = true;
      kategorijaIzbiraGumb.setAttribute("aria-expanded", "false");
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

    function predogledBarveKategorije(barva, kategorijaId, poudari) {
      var iskaniId = kategorijaId || urejanaKategorijaId;
      var element = Array.from(kategorijeSeznam.querySelectorAll("[data-kategorija-id]")).find(function (moznost) {
        return moznost.dataset.kategorijaId === iskaniId;
      });
      if (!element) return;
      element.style.setProperty("--kategorija-barva", barva);
      element.style.setProperty("--kategorija-barva-mehka", barva + "1f");
      element.classList.toggle("podjetja-sheet__kategorija-element--barva-predogled", poudari !== false);
    }

    function zapriNastavitveKategorije() {
      var kategorija = urejanaKategorija();
      if (kategorija) predogledBarveKategorije(kategorija.color, kategorija.id, false);
      urejanaKategorijaId = "";
      kategorijaNastavitve.hidden = true;
      kategorijaUrediIme.value = "";
      kategorijaUrediIme.setCustomValidity("");
      kategorijaPrivzetiMeni.hidden = true;
      kategorijaPrivzetiGumb.setAttribute("aria-expanded", "false");
    }

    function nastaviPrivzetiPogled(vrednost) {
      var moznost = kategorijaPrivzetiMoznosti.find(function (gumb) {
        return gumb.dataset.podjetjaPrivzetiPogled === vrednost;
      }) || kategorijaPrivzetiMoznosti[0];
      kategorijaPrivzetiPogled.value = moznost.dataset.podjetjaPrivzetiPogled;
      kategorijaPrivzetiVrednost.textContent = moznost.textContent;
      kategorijaPrivzetiMoznosti.forEach(function (gumb) {
        var izbrana = gumb === moznost;
        gumb.classList.toggle("podjetja-sheet__kategorija-privzeti-moznost--izbrana", izbrana);
        gumb.setAttribute("aria-selected", izbrana ? "true" : "false");
      });
    }

    function odpriPrivzetiMeni() {
      kategorijaPrivzetiMeni.hidden = false;
      kategorijaPrivzetiMeni.classList.remove("podjetja-sheet__kategorija-privzeti-meni--gor");
      var okvirGumba = kategorijaPrivzetiGumb.getBoundingClientRect();
      var spodnjaMeja = win.innerHeight - 12;
      var spodnjaNavigacija = doc.getElementById("app-testna-vrstica");
      if (spodnjaNavigacija) {
        var vrhNavigacije = spodnjaNavigacija.getBoundingClientRect().top;
        if (vrhNavigacije > 0) spodnjaMeja = Math.min(spodnjaMeja, vrhNavigacije - 8);
      }
      var visinaMenija = kategorijaPrivzetiMeni.scrollHeight;
      var premaloSpodaj = okvirGumba.bottom + 5 + visinaMenija > spodnjaMeja;
      var dovoljZgoraj = okvirGumba.top - 5 - visinaMenija > 8;
      kategorijaPrivzetiMeni.classList.toggle("podjetja-sheet__kategorija-privzeti-meni--gor", premaloSpodaj && dovoljZgoraj);
      kategorijaPrivzetiGumb.setAttribute("aria-expanded", "true");
    }

    function posodobiHitrePoglede() {
      hitriPogledi.hidden = dodajanjeVKategorijo;
      if (dodajanjeVKategorijo) {
        hitriVecMeni.hidden = true;
        hitriVecGumb.setAttribute("aria-expanded", "false");
      }
      hitriPogledGumbi.forEach(function (gumb) {
        var aktiven = gumb.dataset.podjetjaHitriPogled === aktivniHitriPogled;
        gumb.classList.toggle("podjetja-sheet__hitri-pogled--aktiven", aktiven);
        gumb.setAttribute("aria-pressed", aktiven ? "true" : "false");
      });
      hitriVecGumb.classList.toggle("podjetja-sheet__hitri-pogled--aktiven", ["oldest", "missing_contact", "recent", "az"].includes(aktivniHitriPogled));
    }

    function odpriNastavitveKategorije(kategorija) {
      if (!urejanjeKategorij || dodajanjeVKategorijo) return;
      urejanaKategorijaId = kategorija.id;
      kategorijaUrediIme.value = kategorija.name;
      kategorijaBarve.forEach(function (izbira) { izbira.checked = izbira.value === kategorija.color; });
      nastaviPrivzetiPogled(kategorija.defaultView);
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
        var vrstniRedSpremenjen = false;
        var duh = null;
        var zacetniOkvir = null;
        var zadnjiX = zacetniX;
        var zadnjiY = zacetniY;
        var rafId = null;
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
          win.removeEventListener("touchmove", zadrziDotikMedPremikanjem);
          try {
            if (element.hasPointerCapture && element.hasPointerCapture(pointerId)) {
              element.releasePointerCapture(pointerId);
            }
          } catch (e) {
            // Kazalec je lahko medtem že prenehal obstajati.
          }
        }

        function zacniPremikanje() {
          if (premikanje) return;
          premikanje = true;
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
          duh.style.setProperty("--kategorija-duh-x", "0px");
          duh.style.setProperty("--kategorija-duh-y", "0px");
          doc.body.appendChild(duh);
          element.classList.add("podjetja-sheet__kategorija-element--premikanje");
          try {
            if (element.setPointerCapture) element.setPointerCapture(pointerId);
          } catch (e) {
            // Nekateri brskalniki ne dovolijo poznega zajema dotika.
          }
        }

        function zadrziDotikMedPremikanjem(dogodek) {
          if (!premikanje || !dogodek.cancelable) return;
          dogodek.preventDefault();
        }

        function izrisiPremikanje() {
          rafId = null;
          if (!premikanje || !duh || !zacetniOkvir) return;
          duh.style.setProperty("--kategorija-duh-x", zadnjiX - zacetniX + "px");
          duh.style.setProperty("--kategorija-duh-y", zadnjiY - zacetniY + "px");
          var cilj = Array.from(doc.querySelectorAll(".podjetja-sheet__kategorije-dok .podjetja-sheet__kategorija-element")).find(function (moznost) {
            if (moznost === element) return false;
            var okvir = moznost.getBoundingClientRect();
            return zadnjiX >= okvir.left && zadnjiX <= okvir.right
              && zadnjiY >= okvir.top && zadnjiY <= okvir.bottom;
          });
          if (cilj && cilj.dataset.kategorijaId !== zadnjiCiljId) {
            zadnjiCiljId = cilj.dataset.kategorijaId;
            vrstniRedSpremenjen = true;
            predogledKategorij = zamenjajKategoriji(predogledKategorij, kategorija.id, zadnjiCiljId);
            zamenjajVidniMesti(element, cilj);
          } else if (!cilj) {
            zadnjiCiljId = "";
          }
          var meja = kategorijeViewport.getBoundingClientRect();
          var zdaj = Date.now();
          if (zdaj - zadnjaMenjavaStrani > 420 && zadnjiX > meja.right - 20) {
            prikaziStranKategorij(aktivnaStranKategorij + 1, true);
            zadnjaMenjavaStrani = zdaj;
          } else if (zdaj - zadnjaMenjavaStrani > 420 && zadnjiX < meja.left + 20) {
            prikaziStranKategorij(aktivnaStranKategorij - 1, true);
            zadnjaMenjavaStrani = zdaj;
          }
        }

        function medPremikanjem(dogodek) {
          if (dogodek.pointerId !== pointerId) return;
          zadnjiX = dogodek.clientX;
          zadnjiY = dogodek.clientY;
          var razdalja = Math.hypot(dogodek.clientX - zacetniX, dogodek.clientY - zacetniY);
          if (!pripravljen) {
            if (razdalja >= 8) {
              pocistiCasovnik();
              pocistiPoslusalce();
            }
            return;
          }
          if (!premikanje && razdalja < 8) return;
          if (!premikanje) zacniPremikanje();
          dogodek.preventDefault();
          if (!rafId) rafId = win.requestAnimationFrame(izrisiPremikanje);
        }

        function koncajPremikanje(dogodek) {
          if (dogodek.pointerId !== pointerId) return;
          pocistiCasovnik();
          if (rafId) {
            win.cancelAnimationFrame(rafId);
            rafId = null;
            izrisiPremikanje();
          }
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
          if (vrstniRedSpremenjen) {
            shraniKategorije();
          }
          element.dataset.premaknjeno = "true";
          var koncniOkvir = element.getBoundingClientRect();
          if (duh) {
            duh.classList.add("podjetja-sheet__kategorija-element--spuscena");
            duh.style.setProperty("--kategorija-duh-x", koncniOkvir.left - zacetniOkvir.left + "px");
            duh.style.setProperty("--kategorija-duh-y", koncniOkvir.top - zacetniOkvir.top + "px");
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
            zacniPremikanje();
          }, DOLGI_PRITISK_MS);
        }

        win.addEventListener("pointermove", medPremikanjem, { passive: false });
        win.addEventListener("pointerup", koncajPremikanje);
        win.addEventListener("pointercancel", koncajPremikanje);
        if (zahtevaDolgiPritisk) {
          win.addEventListener("touchmove", zadrziDotikMedPremikanjem, { passive: false });
        }
      });
    }

    function narediKategorijo(kategorija, mesto) {
      var element = doc.createElement("div");
      var aktiven = kategorija.id === (dodajanjeVKategorijo ? ciljnaKategorijaId : aktivnaKategorijaId);
      element.className = "podjetja-sheet__kategorija-element podjetja-sheet__kategorija-element--mesto-" + mesto;
      element.dataset.kategorijaId = kategorija.id;
      element.style.setProperty("--kategorija-barva", kategorija.color);
      element.style.setProperty("--kategorija-barva-mehka", kategorija.color + "1f");
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
          kategorijeViewport.hidden = true;
          kategorijaIzbiraGumb.setAttribute("aria-expanded", "false");
          odpriNastavitveKategorije(kategorija);
          return;
        }
        aktivnaKategorijaId = kategorija.id;
        aktivniHitriPogled = kategorija.defaultView;
        nedavnaGumb.classList.remove("podjetja-sheet__nedavna-gumb--aktiven");
        nedavnaGumb.setAttribute("aria-pressed", "false");
        kategorijeViewport.hidden = true;
        kategorijaIzbiraGumb.setAttribute("aria-expanded", "false");
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
      var izbranaKategorija = aktivnaKategorija() || kategorije[0] || null;
      kategorijaIzbiraOznaka.textContent = izbranaKategorija ? "Kategorija: " + izbranaKategorija.name : "Kategorija";
      kategorijaIzbiraStevilo.textContent = String(izbranaKategorija ? izbranaKategorija.companyKeys.length : 0);
      kategorijaIzbiraGumb.disabled = kategorije.length < 1;
      if (kategorijePrazno) kategorijePrazno.hidden = kategorije.length > 0;
      if (kategorijeUrediGumb) {
        kategorijeUrediGumb.hidden = kategorije.length < 1;
        kategorijeUrediGumb.classList.toggle("podjetja-sheet__kategorije-uredi--aktivno", urejanjeKategorij);
        kategorijeUrediGumb.setAttribute("aria-pressed", urejanjeKategorij ? "true" : "false");
        kategorijeUrediGumb.innerHTML = urejanjeKategorij
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span>Končano</span>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg><span>Uredi</span>';
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

    function omogociPremikanjePodjetja(vrstica, podjetje, prikazaniKljuci) {
      vrstica.dataset.podjetjeKljuc = kljucPodjetja(podjetje);
      vrstica.addEventListener("pointerdown", function (zacetniDogodek) {
        if (zacetniDogodek.button !== 0 || dodajanjeVKategorijo || zacetniDogodek.target.closest("button, input, textarea, select, label, a")) return;
        var DOLGI_PRITISK_MS = 300;
        var pointerId = zacetniDogodek.pointerId;
        var zacetniX = zacetniDogodek.clientX;
        var zacetniY = zacetniDogodek.clientY;
        var zahtevaDolgiPritisk = zacetniDogodek.pointerType === "touch" || zacetniDogodek.pointerType === "pen";
        var pripravljen = !zahtevaDolgiPritisk;
        var premikanje = false;
        var dolgiPritiskCasovnik = null;
        var duh = null;
        var zacetniOkvir = null;
        var zadnjiX = zacetniX;
        var zadnjiY = zacetniY;
        var rafId = null;
        var zadnjiCiljKljuc = "";
        var vrstniRedSpremenjen = false;
        var predogledKljucov = prikazaniKljuci.slice();

        function pocisti() {
          if (dolgiPritiskCasovnik) win.clearTimeout(dolgiPritiskCasovnik);
          if (rafId) win.cancelAnimationFrame(rafId);
          win.removeEventListener("pointermove", medPremikanjem);
          win.removeEventListener("pointerup", koncajPremikanje);
          win.removeEventListener("pointercancel", koncajPremikanje);
          win.removeEventListener("touchmove", zadrziDotik, { passive: false });
          try {
            if (vrstica.hasPointerCapture && vrstica.hasPointerCapture(pointerId)) vrstica.releasePointerCapture(pointerId);
          } catch (_napaka) {}
        }

        function zacniPremikanje() {
          if (premikanje) return;
          premikanje = true;
          zacetniOkvir = vrstica.getBoundingClientRect();
          duh = vrstica.cloneNode(true);
          duh.classList.add("podjetja-sheet__podjetje-vrstica--duh");
          duh.removeAttribute("data-podjetje-kljuc");
          duh.style.left = zacetniOkvir.left + "px";
          duh.style.top = zacetniOkvir.top + "px";
          duh.style.width = zacetniOkvir.width + "px";
          duh.style.height = zacetniOkvir.height + "px";
          doc.body.appendChild(duh);
          vrstica.classList.add("podjetja-sheet__podjetje-vrstica--premikanje");
          try { if (vrstica.setPointerCapture) vrstica.setPointerCapture(pointerId); } catch (_napaka) {}
        }

        function zadrziDotik(dogodek) {
          if (premikanje && dogodek.cancelable) dogodek.preventDefault();
        }

        function izrisiPremikanje() {
          rafId = null;
          if (!premikanje || !duh) return;
          duh.style.setProperty("--podjetje-duh-x", zadnjiX - zacetniX + "px");
          duh.style.setProperty("--podjetje-duh-y", zadnjiY - zacetniY + "px");
          var cilj = Array.from(sheetSeznam.querySelectorAll(".podjetja-sheet__podjetje-vrstica")).find(function (moznost) {
            if (moznost === vrstica) return false;
            var okvir = moznost.getBoundingClientRect();
            return zadnjiX >= okvir.left && zadnjiX <= okvir.right && zadnjiY >= okvir.top && zadnjiY <= okvir.bottom;
          });
          if (cilj && cilj.dataset.podjetjeKljuc !== zadnjiCiljKljuc) {
            zadnjiCiljKljuc = cilj.dataset.podjetjeKljuc;
            predogledKljucov = zamenjajKljuca(predogledKljucov, vrstica.dataset.podjetjeKljuc, zadnjiCiljKljuc);
            vrstniRedSpremenjen = true;
            zamenjajVidniMesti(vrstica, cilj);
          } else if (!cilj) {
            zadnjiCiljKljuc = "";
          }
        }

        function medPremikanjem(dogodek) {
          if (dogodek.pointerId !== pointerId) return;
          zadnjiX = dogodek.clientX;
          zadnjiY = dogodek.clientY;
          var razdalja = Math.hypot(zadnjiX - zacetniX, zadnjiY - zacetniY);
          if (!pripravljen) {
            if (razdalja >= 8) pocisti();
            return;
          }
          if (!premikanje && razdalja < 8) return;
          if (!premikanje) zacniPremikanje();
          dogodek.preventDefault();
          if (!rafId) rafId = win.requestAnimationFrame(izrisiPremikanje);
        }

        function koncajPremikanje(dogodek) {
          if (dogodek.pointerId !== pointerId) return;
          if (rafId) {
            win.cancelAnimationFrame(rafId);
            rafId = null;
            izrisiPremikanje();
          }
          pocisti();
          vrstica.classList.remove("podjetja-sheet__podjetje-vrstica--dolg-pritisk");
          if (!premikanje) return;
          if (dogodek.type !== "pointercancel" && vrstniRedSpremenjen) {
            var kategorija = aktivnaKategorija();
            if (kategorija && !iskalniNiz) {
              kategorija.companyKeys = zdruziPrikazaniVrstniRed(kategorija.companyKeys, predogledKljucov);
              shraniKategorije();
            } else {
              var osnovniKljuci = podjetja.map(kljucPodjetja);
              vrstniRedPodjetij = zdruziPrikazaniVrstniRed(osnovniKljuci, predogledKljucov);
              podjetja = urediPodjetjaPoKljucih(podjetja, vrstniRedPodjetij);
              shraniVrstniRedPodjetij();
              izrisiHitriSeznam();
            }
            aktivniHitriPogled = "recent";
          }
          if (duh) {
            duh.classList.add("podjetja-sheet__podjetje-vrstica--spuscena");
            var koncniOkvir = vrstica.getBoundingClientRect();
            duh.style.setProperty("--podjetje-duh-x", koncniOkvir.left - zacetniOkvir.left + "px");
            duh.style.setProperty("--podjetje-duh-y", koncniOkvir.top - zacetniOkvir.top + "px");
          }
          win.setTimeout(function () {
            if (duh) duh.remove();
            vrstica.classList.remove("podjetja-sheet__podjetje-vrstica--premikanje");
            izrisiSheet();
          }, 175);
        }

        if (zahtevaDolgiPritisk) {
          dolgiPritiskCasovnik = win.setTimeout(function () {
            pripravljen = true;
            vrstica.classList.add("podjetja-sheet__podjetje-vrstica--dolg-pritisk");
            zacniPremikanje();
          }, DOLGI_PRITISK_MS);
        }
        win.addEventListener("pointermove", medPremikanjem, { passive: false });
        win.addEventListener("pointerup", koncajPremikanje);
        win.addEventListener("pointercancel", koncajPremikanje);
        if (zahtevaDolgiPritisk) win.addEventListener("touchmove", zadrziDotik, { passive: false });
      });
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
      prikazanaPodjetja = uporabiHitriPogled(prikazanaPodjetja, aktivniHitriPogled);
      if (aktivniHitriPogled === "recent" && !iskalniNiz) {
        prikazanaPodjetja = urediPodjetjaPoKljucih(prikazanaPodjetja, kategorija ? kategorija.companyKeys : vrstniRedPodjetij);
      }
      var prikazaniKljuci = prikazanaPodjetja.map(kljucPodjetja);
      posodobiHitrePoglede();
      if (sheetSeznamNaslov) {
        var nasloviPogledov = {
          critical: "Kritični primeri",
          highest_debt: "Podjetja z najvišjim dolgom",
          oldest: "Najdlje neplačani primeri",
          missing_contact: "Podjetja brez kontakta",
          recent: "Nedavno uporabljena podjetja",
          az: "Podjetja A–Ž",
        };
        sheetSeznamNaslov.textContent = dodajanjeVKategorijo
          ? "Nedavno uporabljena podjetja"
          : kategorija
          ? (nasloviPogledov[aktivniHitriPogled] + " v kategoriji " + kategorija.name + (iskalniNiz ? " · rezultati iskanja" : ""))
          : vseKategorije
            ? (iskalniNiz ? "Vsa podjetja · rezultati iskanja" : "Vsa podjetja")
            : (iskalniNiz ? "Rezultati iskanja" : "Nedavno uporabljena podjetja");
      }
      if (!dodajanjeVKategorijo && prikazanaPodjetja.length > 1) {
        var namigRazporejanje = doc.createElement("p");
        namigRazporejanje.className = "podjetja-sheet__kartice-namig";
        namigRazporejanje.innerHTML = '<span aria-hidden="true">↕</span><span>Pridržite in povlecite kartico za razporejanje.</span>';
        sheetSeznam.appendChild(namigRazporejanje);
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
          kartica.setAttribute("aria-description", "Kartico lahko pridržite in povlečete na drugo mesto.");
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
        if (!dodajanjeVKategorijo) omogociPremikanjePodjetja(vrstica, podjetje, prikazaniKljuci);
        sheetSeznam.appendChild(vrstica);
      });
    }

    function odpriSheet() {
      if (!podjetja.length) return;
      prejsnjiFokus = doc.activeElement;
      aktivnaKategorijaId = "";
      aktivniHitriPogled = "recent";
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
      aktivniHitriPogled = "az";
      iskalniNiz = "";
      iskanje.value = "";
      nedavnaGumb.classList.remove("podjetja-sheet__nedavna-gumb--aktiven");
      nedavnaGumb.setAttribute("aria-pressed", "false");
      izrisiKategorije();
      izrisiSheet();
    });
    kategorijaIzbiraGumb.addEventListener("click", function () {
      if (kategorijaIzbiraGumb.disabled) return;
      var odprto = kategorijaIzbiraGumb.getAttribute("aria-expanded") === "true";
      kategorijeViewport.hidden = odprto;
      kategorijaIzbiraGumb.setAttribute("aria-expanded", odprto ? "false" : "true");
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
      kategorijeViewport.hidden = !urejanjeKategorij;
      kategorijaIzbiraGumb.setAttribute("aria-expanded", urejanjeKategorij ? "true" : "false");
    });
    novaKategorijaGumb.addEventListener("click", function () {
      kategorijeViewport.hidden = true;
      kategorijaIzbiraGumb.setAttribute("aria-expanded", "false");
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
      kategorije.push({ id: id, name: ime.slice(0, 40), companyKeys: [], color: "#469c98", defaultView: "critical" });
      aktivnaKategorijaId = id;
      aktivniHitriPogled = "critical";
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
    kategorijaBarve.forEach(function (izbira) {
      izbira.addEventListener("change", function () {
        if (izbira.checked) predogledBarveKategorije(izbira.value);
      });
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
      var izbranaBarva = kategorijaBarve.find(function (izbira) { return izbira.checked; });
      kategorija.color = izbranaBarva ? izbranaBarva.value : "#469c98";
      kategorija.defaultView = kategorijaPrivzetiPogled.value;
      if (aktivnaKategorijaId === kategorija.id) aktivniHitriPogled = kategorija.defaultView;
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
    kategorijaPrivzetiGumb.addEventListener("click", function () {
      var odprto = kategorijaPrivzetiGumb.getAttribute("aria-expanded") === "true";
      if (odprto) {
        kategorijaPrivzetiMeni.hidden = true;
        kategorijaPrivzetiGumb.setAttribute("aria-expanded", "false");
      } else {
        odpriPrivzetiMeni();
      }
    });
    kategorijaPrivzetiMoznosti.forEach(function (gumb) {
      gumb.addEventListener("click", function () {
        nastaviPrivzetiPogled(gumb.dataset.podjetjaPrivzetiPogled);
        kategorijaPrivzetiMeni.hidden = true;
        kategorijaPrivzetiGumb.setAttribute("aria-expanded", "false");
        kategorijaPrivzetiGumb.focus({ preventScroll: true });
      });
    });
    doc.addEventListener("pointerdown", function (dogodek) {
      if (!kategorijeViewport.hidden && !kategorijeViewport.contains(dogodek.target) && !kategorijaIzbiraGumb.contains(dogodek.target)) {
        kategorijeViewport.hidden = true;
        kategorijaIzbiraGumb.setAttribute("aria-expanded", "false");
      }
      if (!kategorijaPrivzetiMeni.hidden && !kategorijaPrivzeti.contains(dogodek.target)) {
        kategorijaPrivzetiMeni.hidden = true;
        kategorijaPrivzetiGumb.setAttribute("aria-expanded", "false");
      }
    });
    win.addEventListener("resize", function () {
      if (!kategorijaPrivzetiMeni.hidden) odpriPrivzetiMeni();
    });
    hitriVecGumb.addEventListener("click", function () {
      var odprto = hitriVecGumb.getAttribute("aria-expanded") === "true";
      hitriVecGumb.setAttribute("aria-expanded", odprto ? "false" : "true");
      hitriVecMeni.hidden = odprto;
    });
    hitriPogledGumbi.forEach(function (gumb) {
      if (!gumb.dataset.podjetjaHitriPogled) return;
      gumb.addEventListener("click", function () {
        if (dodajanjeVKategorijo) return;
        aktivniHitriPogled = gumb.dataset.podjetjaHitriPogled;
        hitriVecMeni.hidden = true;
        hitriVecGumb.setAttribute("aria-expanded", "false");
        izrisiSheet();
      });
    });
    doc.addEventListener("keydown", function (dogodek) {
      if (dogodek.key === "Escape" && !kategorijeViewport.hidden) {
        kategorijeViewport.hidden = true;
        kategorijaIzbiraGumb.setAttribute("aria-expanded", "false");
        kategorijaIzbiraGumb.focus({ preventScroll: true });
        return;
      }
      if (dogodek.key === "Escape" && !kategorijaPrivzetiMeni.hidden) {
        kategorijaPrivzetiMeni.hidden = true;
        kategorijaPrivzetiGumb.setAttribute("aria-expanded", "false");
        kategorijaPrivzetiGumb.focus({ preventScroll: true });
        return;
      }
      if (dogodek.key === "Escape" && !sheet.hidden) zapriSheet();
    });
    doc.addEventListener("uj:zadeve-nalozene", function (dogodek) {
      var shranjeniPodatki = preberiShranjenePodatke();
      podjetja = zdruziPodjetjaSStiki(podjetjaIzZadev(dogodek.detail), shranjeniPodatki).filter(function (podjetje) {
        return !izbrisaniKljuciPodjetij.has(kljucPodjetja(podjetje));
      });
      podjetja = urediPodjetjaPoKljucih(podjetja, vrstniRedPodjetij);
      izrisiHitriSeznam();
      if (!sheet.hidden) {
        izrisiKategorije();
        izrisiSheet();
      }
    });
    doc.addEventListener("uj:podjetje-shranjeno", function (dogodek) {
      var detail = dogodek.detail && typeof dogodek.detail === "object" ? dogodek.detail : {};
      var kljuc = besedilo(detail.key);
      if (!kljuc || !detail.company) return;
      var prejsnjiKljuc = besedilo(detail.previousKey);
      if (prejsnjiKljuc && prejsnjiKljuc !== kljuc) {
        podjetja = podjetja.filter(function (podjetje) { return kljucPodjetja(podjetje) !== prejsnjiKljuc; });
      }
      var samoNoviStik = {};
      samoNoviStik[kljuc] = detail.company;
      podjetja = zdruziPodjetjaSStiki(podjetja, samoNoviStik);
      izbrisaniKljuciPodjetij.delete(kljuc);
      shraniIzbrisaneKljuciPodjetij();
      podjetja = razvrstiPodjetja(podjetja, "recent");
      izrisiHitriSeznam();
      if (!sheet.hidden) {
        izrisiKategorije();
        izrisiSheet();
      }
    });
    doc.addEventListener("uj:podjetje-odstranjeno-iz-stikov", function (dogodek) {
      var kljuc = besedilo(dogodek.detail && dogodek.detail.key);
      if (!kljuc) return;
      podjetja = podjetja.filter(function (podjetje) {
        return kljucPodjetja(podjetje) !== kljuc
          || (Array.isArray(podjetje.cases) && podjetje.cases.length > 0);
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
    zdruziPodjetjaSStiki: zdruziPodjetjaSStiki,
    sistemskaOcena: sistemskaOcena,
    povzetekZgodovine: povzetekZgodovine,
    razlagaSpremljanja: razlagaSpremljanja,
    razvrstiPodjetja: razvrstiPodjetja,
    uporabiHitriPogled: uporabiHitriPogled,
    filtrirajPodjetja: filtrirajPodjetja,
    normalizirajKategorije: normalizirajKategorije,
    premakniKategorijo: premakniKategorijo,
    premakniKategorijoNaMesto: premakniKategorijoNaMesto,
    zamenjajKategoriji: zamenjajKategoriji,
    zamenjajKljuca: zamenjajKljuca,
    razdeliKategorijeNaStrani: razdeliKategorijeNaStrani,
    razvrstiKategorijePoId: razvrstiKategorijePoId,
  };
});
