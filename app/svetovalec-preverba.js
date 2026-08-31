(function () {
  "use strict";

  const opis = document.getElementById("svetovalec-opis");
  const datoteka = document.getElementById("svetovalec-datoteka");
  const status = document.querySelector("[data-atena-status]");
  const gumbGlas = document.querySelector("[data-glas]");
  const gumbPreverba = document.querySelector("[data-zacni-preverbo]");
  const atenaAkcije = document.querySelector("[data-atena-akcije]");
  const atenaGlasBesedilo = document.querySelector("[data-atena-glas-besedilo]");
  const atenaGlasnost = document.querySelector("[data-atena-voice-meter]");
  const atenaAnalizaLoader = document.querySelector("[data-atena-analiza-loader]");
  const atenaNaslov = document.querySelector("[data-atena-naslov]");
  const atenaPodnaslov = document.querySelector("[data-atena-podnaslov]");
  const atenaPrimarniBesedilo = document.querySelector("[data-atena-primarni-besedilo]");
  const ATENA_ANALIZA_STATUS_BESEDILA = [
    "Berem vaš opis …",
    "Preverjam dokument …",
    "Iščem ključne pogoje …",
    "Razvrščam področja …",
    "Pripravljam pregled …",
  ];
  let svetovalecCanary = null;
  let atenaSnemanjeAktivno = false;
  let atenaPrekinitevPoZagonu = false;
  let atenaRavenGlasu = 0;
  let atenaAnalizaAktivna = false;
  let atenaAnalizaStatusCasovnik = 0;
  let atenaAnalizaStatusKorak = 0;
  let atenaKontekstZaklepAktiven = false;
  let atenaKontekstZaklepStanja = [];
  const atenaNacinGumbi = Array.from(document.querySelectorAll("[data-atena-nacin]"));
  const atenaOpisPanel = document.querySelector("[data-atena-opis-panel]");
  const atenaRocnoPanel = document.querySelector("[data-atena-rocno-panel]");
  const ponudbaModuli = document.querySelector("[data-ponudba-moduli]");
  const ponudbaModuliStatus = document.querySelector("[data-ponudba-moduli-status]");
  const ponudbaPodrocja = document.querySelector("[data-ponudba-podrocja]");
  const ponudbaKarticeGumb = document.querySelector("[data-ponudba-kartice]");
  const ponudbaKarticeVpogled = document.querySelector("[data-ponudba-kartice-vpogled]");
  const ponudbaOsnovniEngine = window.UJPonudbaModuliEngine || null;
  const svetovalecStoritveEngine = window.UJSvetovalecStoritveEngine || null;
  const atenaCardSchema = window.UJAtenaCardSchema || null;
  const atenaCardRenderer = window.UJAtenaCardRenderer || null;
  const atenaPredlogi = document.querySelector("[data-atena-predlogi]");
  let ponudbaEngine = ponudbaOsnovniEngine;
  const ponudbaObrazec = document.querySelector("[data-ponudba-obrazec]");
  const ponudbaObrazecNaslov = document.querySelector("[data-ponudba-obrazec-naslov]");
  const ponudbaObrazecOpis = document.querySelector("[data-ponudba-obrazec-opis]");
  const ponudbaObrazecIkona = document.querySelector(".ponudba-obrazec__glava-ikona");
  const ponudbaObrazecPolja = document.querySelector("[data-ponudba-obrazec-polja]");
  const ponudbaAtenaPovzetek = document.querySelector("[data-ponudba-atena-povzetek]");
  const ponudbaObrazecPodrocja = document.querySelector("[data-ponudba-obrazec-podrocja]");
  const ponudbaObrazecPodrocjeNaslov = document.querySelector("[data-ponudba-obrazec-podrocje-naslov]");
  const ponudbaObrazecPodrocjeOpis = document.querySelector("[data-ponudba-obrazec-podrocje-opis]");
  const ponudbaKoraki = document.querySelector("[data-ponudba-koraki]");
  const ponudbaKontekst = document.querySelector("[data-ponudba-kontekst]");
  const ponudbaKontekstPreklop = document.querySelector("[data-ponudba-kontekst-preklop]");
  const ponudbaProfil = document.querySelector("[data-ponudba-profil]");
  const ponudbaModel = document.querySelector("[data-ponudba-model]");
  const ponudbaKanal = document.querySelector("[data-ponudba-kanal]");
  const podjetjaSklop = document.querySelector(".svetovalec-podjetja");
  const podjetjaOdpri = document.querySelector("[data-podjetja-odpri]");
  const podjetjaZapri = document.querySelector("[data-podjetja-zapri]");
  const podjetjaIzbirnik = document.getElementById("svetovalec-podjetja-izbirnik");
  const podjetjaMoznosti = document.querySelector("[data-podjetja-moznosti]");
  const podjetjaStanje = document.querySelector("[data-podjetja-stanje]");
  const aktivnoPodjetje = document.querySelector("[data-podjetje-aktivno]");
  const aktivnoPodjetjeIzberi = document.querySelector("[data-podjetje-aktivno-izberi]");
  const aktivnoPodjetjeIme = document.querySelector("[data-podjetje-aktivno-ime]");
  const podjetjeDodaj = document.querySelector("[data-podjetje-dodaj]");
  const podjetjeUredi = document.querySelector("[data-podjetje-uredi]");
  const podjetjeOdstrani = document.querySelector("[data-podjetje-odstrani]");
  const podjetjeObrazec = document.querySelector("[data-podjetje-obrazec]");
  const podjetjeObrazecZapri = document.querySelector("[data-podjetje-obrazec-zapri]");
  const podjetjeIme = document.querySelector("[data-podjetje-ime]");
  const dejavnostVnos = document.querySelector("[data-dejavnost-vnos]");
  const dejavnostPredlogi = document.querySelector("[data-dejavnost-predlogi]");
  const dejavnostCipsi = document.querySelector("[data-dejavnost-cipsi]");
  const podjetjePopolnost = document.querySelector("[data-podjetje-popolnost]");
  const podjetjeNapaka = document.querySelector("[data-podjetje-napaka]");
  const podjetjeShrani = document.querySelector("[data-podjetje-shrani]");
  const podjetjeModal = document.querySelector("[data-podjetje-modal]");
  const modalNaslov = document.querySelector("[data-modal-naslov]");
  const modalPomoc = document.querySelector("[data-modal-pomoc]");
  const modalIkona = document.querySelector("[data-modal-ikona]");
  const modalMoznosti = document.querySelector("[data-modal-moznosti]");
  const IZBRANO_PODJETJE_SHRAMBA = "uj_svetovalec_izbrano_podjetje_v1";
  const PODJETJA_PODATKI_SHRAMBA = "uj_svetovalec_podjetja_podatki_v1";
  const ODSTRANJENA_PODJETJA_SHRAMBA = "uj_svetovalec_odstranjena_podjetja_v1";
  let PONUDBA_OSNUTEK_SHRAMBA = "uj_svetovalec_ponudba_osnutek_v1";
  const dejavnostiEngine = window.UJDejavnostiEngine || null;
  const DEJAVNOSTI_REZERVA = ["Računovodstvo", "Izdelava spletnih strani", "Elektroinštalacije", "Vodovodne inštalacije"];
  const IZBIRE = {
    vloga: {
      naslov: "Vloga ponudnika",
      pomoc: "Izberite možnost, ki najbolje opiše podjetje.",
      ikona: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="3" /><path d="M5 21v-4a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v4M8 17v4M16 17v4" /></svg>',
      moznosti: ["Storitve izvajajo sami", "Agencija", "Preprodajalec", "Posrednik / zastopnik", "Portal / platforma", "Proizvajalec", "Ne vem"],
    },
    odnos: {
      naslov: "Odnos s podjetjem",
      pomoc: "Izberite trenutno stanje odnosa s podjetjem.",
      ikona: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.1.1l2-2A5 5 0 0 0 12 4l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" /></svg>',
      moznosti: ["Prvi stik", "Prejel sem ponudbo", "Razmišljam o menjavi", "Že uporabljam storitve", "Aktivna naročnina", "Želim prekiniti", "Nekdanji ponudnik"],
    },
    sodelovanje: {
      naslov: "Vrsta sodelovanja",
      pomoc: "Izberite obliko sodelovanja s podjetjem.",
      ikona: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18m-12 5 2 2 4-4" /></svg>',
      moznosti: ["Enkratni nakup", "Posamezen projekt", "Redno sodelovanje", "Naročnina ali pogodba", "Še ne sodelujemo"],
    },
    stik: {
      naslov: "Način stika",
      pomoc: "Izberite, kako ste prišli v stik s podjetjem.",
      ikona: '<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></svg>',
      moznosti: ["Hladni prodajni klic", "Nepričakovana e-pošta", "Oglas", "Poslovni portal", "Sejem / osebni obisk", "Priporočilo", "Našel sam", "Že sodelovali", "Drugo"],
    },
  };
  let razpolozljivaPodjetja = [];
  let podjetjaNalozena = false;
  let urejanoPodjetje = null;
  let dejavnosti = [];
  let glavnaDejavnost = "";
  let odgovori = { vloga: "", odnos: "", sodelovanje: "", stik: "" };
  let odprtaIzbira = "";
  let zacasnaIzbira = "";
  let fokusPredModalom = null;

  function varnoBesedilo(vrednost) {
    return String(vrednost == null ? "" : vrednost).trim();
  }

  function pobegniHtml(vrednost) {
    return String(vrednost == null ? "" : vrednost).replace(/[&<>"']/g, function (znak) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[znak];
    });
  }

  function kljucImena(ime) {
    return varnoBesedilo(ime).toLocaleLowerCase("sl-SI");
  }

  function preberiPodjetjaPodatke() {
    try {
      const podatki = JSON.parse(window.localStorage.getItem(PODJETJA_PODATKI_SHRAMBA) || "[]");
      return Array.isArray(podatki) ? podatki.filter(function (podjetje) {
        return podjetje && varnoBesedilo(podjetje.name);
      }) : [];
    } catch (napaka) {
      return [];
    }
  }

  function preberiOdstranjenaPodjetja() {
    try {
      const podatki = JSON.parse(window.localStorage.getItem(ODSTRANJENA_PODJETJA_SHRAMBA) || "[]");
      return Array.isArray(podatki) ? podatki.map(varnoBesedilo).filter(Boolean) : [];
    } catch (napaka) {
      return [];
    }
  }

  function jePodjetjeOdstranjeno(ime) {
    const kljuc = kljucImena(ime);
    return preberiOdstranjenaPodjetja().some(function (odstranjeno) { return odstranjeno === kljuc; });
  }

  function nastaviPodjetjeOdstranjeno(ime, odstranjeno) {
    const kljuc = kljucImena(ime);
    if (!kljuc) return;
    const kljuci = preberiOdstranjenaPodjetja().filter(function (obstojeci) { return obstojeci !== kljuc; });
    if (odstranjeno) kljuci.push(kljuc);
    try {
      window.localStorage.setItem(ODSTRANJENA_PODJETJA_SHRAMBA, JSON.stringify(kljuci));
    } catch (napaka) {
      /* Odstranitev ostane vidna v trenutni seji. */
    }
  }

  function pocistiAktivnoPodjetje() {
    try { window.localStorage.removeItem(IZBRANO_PODJETJE_SHRAMBA); } catch (napaka) { /* Brez trajne shrambe. */ }
    if (aktivnoPodjetjeIme) aktivnoPodjetjeIme.textContent = "Izberite podjetje";
    if (aktivnoPodjetjeIzberi) {
      aktivnoPodjetjeIzberi.disabled = true;
      aktivnoPodjetjeIzberi.setAttribute("aria-pressed", "false");
      aktivnoPodjetjeIzberi.setAttribute("aria-label", "Izberite podjetje na seznamu");
    }
    if (podjetjeUredi) {
      podjetjeUredi.disabled = true;
      podjetjeUredi.setAttribute("aria-label", "Najprej izberite podjetje");
    }
    if (podjetjeOdstrani) {
      podjetjeOdstrani.disabled = true;
      podjetjeOdstrani.setAttribute("aria-label", "Najprej izberite podjetje");
    }
    if (podjetjaSklop) podjetjaSklop.classList.remove("has-podjetje-izbrano");
    prilagodiImePodjetja();
  }

  function odstraniPodjetjeIzPrimera(podjetje) {
    const ime = varnoBesedilo(podjetje && podjetje.name);
    const kljuc = kljucImena(ime);
    if (!kljuc) return;
    nastaviPodjetjeOdstranjeno(ime, true);
    try {
      const lokalna = preberiPodjetjaPodatke().filter(function (obstojece) {
        return kljucImena(obstojece && obstojece.name) !== kljuc;
      });
      window.localStorage.setItem(PODJETJA_PODATKI_SHRAMBA, JSON.stringify(lokalna));
    } catch (napaka) {
      /* Seznam se vseeno osveži v trenutni seji. */
    }
    razpolozljivaPodjetja = razpolozljivaPodjetja.filter(function (obstojece) {
      return kljucImena(obstojece && obstojece.name) !== kljuc;
    });
    if (kljucImena(trenutnoPodjetje().name) === kljuc) {
      const naslednje = razpolozljivaPodjetja[0];
      if (naslednje) nastaviAktivnoPodjetje(naslednje);
      else pocistiAktivnoPodjetje();
    }
    izrisiPodjetja();
    if (podjetjaStanje) podjetjaStanje.textContent = ime + " je odstranjeno iz tega primera.";
  }

  function shraniPodjetjePodatke(podjetje) {
    const podjetja = preberiPodjetjaPodatke();
    const prejsnjiKljuc = kljucImena(urejanoPodjetje && urejanoPodjetje.name);
    const noviKljuc = kljucImena(podjetje.name);
    const ostala = podjetja.filter(function (obstojece) {
      const kljuc = kljucImena(obstojece && obstojece.name);
      return kljuc !== noviKljuc && (!prejsnjiKljuc || kljuc !== prejsnjiKljuc);
    });
    ostala.unshift(podjetje);
    try {
      window.localStorage.setItem(PODJETJA_PODATKI_SHRAMBA, JSON.stringify(ostala));
    } catch (napaka) {
      /* Obrazec ostane uporaben tudi, če trajna lokalna shramba ni na voljo. */
    }
  }

  function osveziPovzetke() {
    Object.keys(IZBIRE).forEach(function (vrsta) {
      const element = document.querySelector('[data-povzetek="' + vrsta + '"]');
      if (!element) return;
      const vrednost = varnoBesedilo(odgovori[vrsta]);
      element.textContent = vrednost || "Izberite";
      element.classList.toggle("is-empty", !vrednost);
      if (window.UJPrilagodiVelikostBesedila) window.UJPrilagodiVelikostBesedila(element);
    });

    const popolno = Boolean(
      varnoBesedilo(podjetjeIme && podjetjeIme.value) &&
      dejavnosti.length &&
      odgovori.vloga &&
      odgovori.odnos &&
      odgovori.sodelovanje &&
      odgovori.stik
    );
    if (podjetjePopolnost) {
      podjetjePopolnost.classList.toggle("is-complete", popolno);
      const besedilo = podjetjePopolnost.querySelector("span");
      if (besedilo) besedilo.textContent = popolno
        ? "Vsa osnovna dejstva so izbrana."
        : "Izberite vsa osnovna dejstva.";
    }
    return popolno;
  }

  function odstraniDejavnost(ime) {
    const kljuc = kljucImena(ime);
    dejavnosti = dejavnosti.filter(function (dejavnost) { return kljucImena(dejavnost) !== kljuc; });
    if (kljucImena(glavnaDejavnost) === kljuc) glavnaDejavnost = dejavnosti[0] || "";
    izrisiDejavnosti();
  }

  function nastaviGlavnoDejavnost(ime) {
    if (dejavnosti.some(function (dejavnost) { return kljucImena(dejavnost) === kljucImena(ime); })) {
      glavnaDejavnost = ime;
      izrisiDejavnosti();
    }
  }

  function dodajDejavnost(ime) {
    const cistoIme = varnoBesedilo(ime).replace(/^[,;]+|[,;]+$/g, "");
    if (!cistoIme || dejavnosti.some(function (dejavnost) { return kljucImena(dejavnost) === kljucImena(cistoIme); })) return;
    dejavnosti.push(cistoIme.slice(0, 60));
    if (!glavnaDejavnost) glavnaDejavnost = dejavnosti[0];
    if (dejavnostVnos) dejavnostVnos.value = "";
    izrisiDejavnosti();
    izrisiPredlogeDejavnosti("");
  }

  function izrisiDejavnosti() {
    if (!dejavnostCipsi) return;
    dejavnostCipsi.innerHTML = "";
    dejavnosti.forEach(function (dejavnost) {
      const cip = document.createElement("span");
      cip.className = "podjetje-obrazec__cip";

      const glavna = document.createElement("button");
      glavna.type = "button";
      glavna.className = "podjetje-obrazec__cip-glavna";
      glavna.setAttribute("aria-label", "Nastavi " + dejavnost + " kot glavno dejavnost");
      glavna.innerHTML = '<strong></strong><i aria-hidden="true">☆</i><small></small>';
      glavna.querySelector("strong").textContent = dejavnost;
      const jeGlavna = kljucImena(dejavnost) === kljucImena(glavnaDejavnost);
      glavna.querySelector("i").textContent = jeGlavna ? "★" : "☆";
      glavna.querySelector("small").textContent = jeGlavna ? "glavna dejavnost" : "";
      glavna.addEventListener("click", function () { nastaviGlavnoDejavnost(dejavnost); });

      const odstrani = document.createElement("button");
      odstrani.type = "button";
      odstrani.className = "podjetje-obrazec__cip-odstrani";
      odstrani.setAttribute("aria-label", "Odstrani dejavnost " + dejavnost);
      odstrani.textContent = "×";
      odstrani.addEventListener("click", function () { odstraniDejavnost(dejavnost); });

      cip.appendChild(glavna);
      cip.appendChild(odstrani);
      dejavnostCipsi.appendChild(cip);
    });
    osveziPovzetke();
  }

  function izrisiPredlogeDejavnosti(iskanje) {
    if (!dejavnostPredlogi) return;
    dejavnostPredlogi.innerHTML = "";
    const poizvedba = varnoBesedilo(iskanje);
    if (!poizvedba) {
      dejavnostPredlogi.hidden = true;
      if (dejavnostVnos) dejavnostVnos.setAttribute("aria-expanded", "false");
      return;
    }
    const predlogi = dejavnostiEngine
      ? dejavnostiEngine.predlagaj(poizvedba, { limit: 12, izloci: dejavnosti })
      : DEJAVNOSTI_REZERVA.filter(function (ime) {
        return kljucImena(ime).includes(kljucImena(poizvedba))
          && !dejavnosti.some(function (dejavnost) { return kljucImena(dejavnost) === kljucImena(ime); });
      }).map(function (ime) { return { ime: ime, skupina: "Dejavnosti" }; });
    predlogi.forEach(function (zapis) {
      const gumb = document.createElement("button");
      gumb.type = "button";
      gumb.className = "podjetje-obrazec__predlog";
      gumb.setAttribute("role", "option");
      gumb.textContent = zapis.ime;
      gumb.title = zapis.skupina || "Dejavnost";
      gumb.setAttribute("aria-label", "Dodaj dejavnost " + zapis.ime + (zapis.skupina ? ", " + zapis.skupina : ""));
      gumb.addEventListener("click", function () { dodajDejavnost(zapis.ime); });
      dejavnostPredlogi.appendChild(gumb);
    });
    const odprto = predlogi.length > 0 && document.activeElement === dejavnostVnos;
    dejavnostPredlogi.hidden = !odprto;
    if (dejavnostVnos) dejavnostVnos.setAttribute("aria-expanded", odprto ? "true" : "false");
  }

  function zapriModal(vrniFokus) {
    if (!podjetjeModal || podjetjeModal.hidden) return;
    const sidro = fokusPredModalom && fokusPredModalom.isConnected ? fokusPredModalom : null;
    const sidroVrh = sidro ? sidro.getBoundingClientRect().top : null;
    podjetjeModal.hidden = true;
    document.querySelectorAll("[data-izbira-odpri]").forEach(function (gumb) {
      gumb.setAttribute("aria-expanded", "false");
    });
    odprtaIzbira = "";
    zacasnaIzbira = "";
    if (sidro && Number.isFinite(sidroVrh)) {
      window.scrollBy(0, sidro.getBoundingClientRect().top - sidroVrh);
    }
    if (podjetjeObrazec) podjetjeObrazec.style.marginBottom = "";
    if (vrniFokus && fokusPredModalom && fokusPredModalom.focus) {
      fokusPredModalom.focus({ preventScroll: true });
    }
  }

  function izrisiModalneMoznosti() {
    if (!modalMoznosti || !odprtaIzbira || !IZBIRE[odprtaIzbira]) return;
    modalMoznosti.innerHTML = "";
    IZBIRE[odprtaIzbira].moznosti.forEach(function (moznost) {
      const gumb = document.createElement("button");
      gumb.type = "button";
      gumb.className = "podjetje-modal__moznost";
      gumb.setAttribute("role", "radio");
      gumb.setAttribute("aria-checked", moznost === zacasnaIzbira ? "true" : "false");
      const besedilo = document.createElement("span");
      besedilo.textContent = moznost;
      besedilo.setAttribute("data-fit-text", "");
      besedilo.setAttribute("data-fit-text-min", "8");
      const radio = document.createElement("i");
      radio.className = "podjetje-modal__radio";
      radio.setAttribute("aria-hidden", "true");
      gumb.appendChild(besedilo);
      gumb.appendChild(radio);
      gumb.addEventListener("click", function () {
        odgovori[odprtaIzbira] = moznost;
        osveziPovzetke();
        zapriModal(true);
      });
      modalMoznosti.appendChild(gumb);
    });
  }

  function odpriModal(vrsta, sprozilec) {
    const nastavitev = IZBIRE[vrsta];
    if (!podjetjeModal || !nastavitev) return;
    if (!podjetjeModal.hidden && odprtaIzbira === vrsta) {
      zapriModal(true);
      return;
    }
    const sprozilecVrh = sprozilec && sprozilec.getBoundingClientRect
      ? sprozilec.getBoundingClientRect().top
      : null;
    const kartice = sprozilec
      ? Array.from(document.querySelectorAll("[data-izbira-odpri]"))
      : [];
    const indeksKartice = kartice.indexOf(sprozilec);
    const mreza = sprozilec && sprozilec.closest(".podjetje-povzetek__mreza");
    if (mreza && indeksKartice >= 0) {
      const zacetekVrstice = Math.floor(indeksKartice / 2) * 2;
      mreza.insertBefore(podjetjeModal, kartice[zacetekVrstice]);
    }
    fokusPredModalom = sprozilec || document.activeElement;
    odprtaIzbira = vrsta;
    zacasnaIzbira = odgovori[vrsta] || "";
    if (modalNaslov) modalNaslov.textContent = nastavitev.naslov;
    if (modalPomoc) modalPomoc.textContent = nastavitev.pomoc;
    if (modalIkona) modalIkona.innerHTML = nastavitev.ikona;
    izrisiModalneMoznosti();
    podjetjeModal.hidden = false;
    if (podjetjeObrazec) podjetjeObrazec.style.marginBottom = podjetjeModal.offsetHeight + 16 + "px";
    document.querySelectorAll("[data-izbira-odpri]").forEach(function (gumb) {
      gumb.setAttribute("aria-expanded", gumb === sprozilec ? "true" : "false");
    });
    const poravnajSprozilec = function () {
      if (!sprozilec || podjetjeModal.hidden || odprtaIzbira !== vrsta || !Number.isFinite(sprozilecVrh)) return;
      window.scrollBy(0, sprozilec.getBoundingClientRect().top - sprozilecVrh);
    };
    window.requestAnimationFrame(function () {
      poravnajSprozilec();
      const izbrani = modalMoznosti && modalMoznosti.querySelector('[aria-checked="true"]');
      const prvi = modalMoznosti && modalMoznosti.querySelector("button");
      const cilj = izbrani || prvi || document.querySelector(".podjetje-modal__zapri");
      if (cilj) cilj.focus({ preventScroll: true });
      window.setTimeout(poravnajSprozilec, 220);
    });
  }

  function najdiPodjetjePodatke(ime) {
    const kljuc = kljucImena(ime);
    return preberiPodjetjaPodatke().find(function (podjetje) {
      return kljucImena(podjetje && podjetje.name) === kljuc;
    }) || null;
  }

  function odpriPodjetjeObrazec(podjetje) {
    if (!podjetjeObrazec) return;
    zapriIzbirnik(false);
    urejanoPodjetje = podjetje || null;
    if (podjetjeUredi) {
      podjetjeUredi.classList.toggle("is-active", Boolean(podjetje));
      podjetjeUredi.setAttribute("aria-pressed", podjetje ? "true" : "false");
    }
    if (podjetjeDodaj) {
      podjetjeDodaj.classList.toggle("is-active", !podjetje);
      podjetjeDodaj.setAttribute("aria-pressed", podjetje ? "false" : "true");
      podjetjeDodaj.setAttribute("aria-label", podjetje ? "Dodaj podjetje" : "Zapri dodajanje podjetja");
    }
    const podatki = podjetje || {};
    if (podjetjeIme) podjetjeIme.value = varnoBesedilo(podatki.name);
    dejavnosti = Array.isArray(podatki.dejavnosti) ? podatki.dejavnosti.map(varnoBesedilo).filter(Boolean) : [];
    glavnaDejavnost = varnoBesedilo(podatki.glavnaDejavnost) || dejavnosti[0] || "";
    odgovori = {
      vloga: varnoBesedilo(podatki.vloga),
      odnos: varnoBesedilo(podatki.odnos),
      sodelovanje: varnoBesedilo(podatki.sodelovanje),
      stik: varnoBesedilo(podatki.stik),
    };
    if (podjetjeShrani) podjetjeShrani.textContent = podjetje ? "Shrani spremembe" : "Dodaj podjetje";
    if (podjetjeNapaka) podjetjeNapaka.textContent = "";
    podjetjeObrazec.hidden = false;
    document.body.classList.add("is-podjetje-obrazec-open");
    izrisiDejavnosti();
    izrisiPredlogeDejavnosti("");
    osveziPovzetke();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function zapriPodjetjeObrazec() {
    if (!podjetjeObrazec || podjetjeObrazec.hidden) return false;
    zapriModal(false);
    podjetjeObrazec.hidden = true;
    document.body.classList.remove("is-podjetje-obrazec-open");
    if (podjetjeUredi) {
      podjetjeUredi.classList.remove("is-active");
      podjetjeUredi.setAttribute("aria-pressed", "false");
    }
    if (podjetjeDodaj) {
      podjetjeDodaj.classList.remove("is-active");
      podjetjeDodaj.setAttribute("aria-pressed", "false");
      podjetjeDodaj.setAttribute("aria-label", "Dodaj podjetje");
    }
    if (podjetjeNapaka) podjetjeNapaka.textContent = "";
    return true;
  }

  function preberiIzbranoPodjetje() {
    try {
      const shranjeno = JSON.parse(window.localStorage.getItem(IZBRANO_PODJETJE_SHRAMBA) || "null");
      return shranjeno && varnoBesedilo(shranjeno.name) ? shranjeno : null;
    } catch (napaka) {
      return null;
    }
  }

  function shraniIzbranoPodjetje(podjetje) {
    try {
      window.localStorage.setItem(IZBRANO_PODJETJE_SHRAMBA, JSON.stringify({
        id: varnoBesedilo(podjetje && podjetje.id),
        name: varnoBesedilo(podjetje && podjetje.name),
      }));
    } catch (napaka) {
      /* Izbor ostane aktiven v trenutni seji tudi brez lokalne shrambe. */
    }
  }

  function trenutnoPodjetje() {
    const shranjeno = preberiIzbranoPodjetje();
    if (shranjeno) return shranjeno;
    return { id: "", name: varnoBesedilo(aktivnoPodjetjeIme && aktivnoPodjetjeIme.textContent) };
  }

  function prilagodiImePodjetja() {
    if (aktivnoPodjetjeIme && window.UJPrilagodiVelikostBesedila) {
      window.UJPrilagodiVelikostBesedila(aktivnoPodjetjeIme);
    }
  }

  function nastaviAktivnoPodjetje(podjetje) {
    const ime = varnoBesedilo(podjetje && podjetje.name);
    if (!ime || !aktivnoPodjetjeIme) return;
    aktivnoPodjetjeIme.textContent = ime;
    if (aktivnoPodjetjeIzberi) {
      aktivnoPodjetjeIzberi.disabled = false;
      aktivnoPodjetjeIzberi.setAttribute("aria-pressed", "true");
      aktivnoPodjetjeIzberi.setAttribute("aria-label", "Izberi podjetje " + ime);
    }
    if (podjetjeUredi) {
      podjetjeUredi.disabled = false;
      podjetjeUredi.setAttribute("aria-label", "Uredi podjetje " + ime);
    }
    if (podjetjeOdstrani) {
      podjetjeOdstrani.disabled = false;
      podjetjeOdstrani.setAttribute("aria-label", "Odstrani podjetje " + ime + " iz tega okenca");
    }
    shraniIzbranoPodjetje(podjetje);
    if (podjetjaSklop) podjetjaSklop.classList.add("has-podjetje-izbrano");
    prilagodiImePodjetja();
  }

  function zdruziPodjetja(podjetja) {
    const poImenu = new Map();
    podjetja.forEach(function (podjetje) {
      const ime = varnoBesedilo(podjetje && podjetje.name);
      const kljuc = kljucImena(ime);
      if (!kljuc || poImenu.has(kljuc)) return;
      poImenu.set(kljuc, { id: varnoBesedilo(podjetje && podjetje.id), name: ime });
    });
    return Array.from(poImenu.values());
  }

  function izrisiPodjetja() {
    if (!podjetjaMoznosti) return;
    const aktivno = trenutnoPodjetje();
    podjetjaMoznosti.innerHTML = "";
    razpolozljivaPodjetja.forEach(function (podjetje) {
      const izbrano = kljucImena(podjetje.name) === kljucImena(aktivno.name);
      const vrstica = document.createElement("div");
      vrstica.className = "svetovalec-podjetja__moznost";
      vrstica.setAttribute("role", "listitem");
      vrstica.setAttribute("aria-selected", izbrano ? "true" : "false");
      const gumb = document.createElement("button");
      gumb.type = "button";
      gumb.className = "svetovalec-podjetja__moznost-izberi";
      gumb.setAttribute("aria-pressed", izbrano ? "true" : "false");
      gumb.setAttribute("aria-label", (izbrano ? "Odznači podjetje " : "Izberi podjetje ") + podjetje.name);
      const ime = document.createElement("span");
      ime.textContent = podjetje.name;
      const kljukica = document.createElement("i");
      kljukica.setAttribute("aria-hidden", "true");
      kljukica.textContent = "✓";
      gumb.appendChild(ime);
      gumb.appendChild(kljukica);
      gumb.addEventListener("click", function (dogodek) {
        dogodek.stopPropagation();
        if (izbrano) {
          pocistiAktivnoPodjetje();
          izrisiPodjetja();
          if (podjetjaStanje) podjetjaStanje.textContent = "Podjetje ni več izbrano. Na seznamu ostaja shranjeno.";
          return;
        }
        nastaviAktivnoPodjetje(podjetje);
        if (podjetjaSklop) podjetjaSklop.classList.add("has-podjetje-izbrano");
        zapriIzbirnik(false);
      });
      const izbrisi = document.createElement("button");
      izbrisi.type = "button";
      izbrisi.className = "svetovalec-podjetja__moznost-izbrisi";
      izbrisi.setAttribute("aria-label", "Izbriši podjetje " + podjetje.name + " iz tega primera");
      izbrisi.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></svg>';
      izbrisi.addEventListener("click", function () { odstraniPodjetjeIzPrimera(podjetje); });
      vrstica.appendChild(gumb);
      vrstica.appendChild(izbrisi);
      podjetjaMoznosti.appendChild(vrstica);
    });
  }

  async function naloziPodjetja() {
    if (podjetjaNalozena) return;
    podjetjaNalozena = true;
    const aktivno = trenutnoPodjetje();
    const lokalnaPodjetja = preberiPodjetjaPodatke().map(function (podjetje) {
      return { id: varnoBesedilo(podjetje && podjetje.id), name: varnoBesedilo(podjetje && podjetje.name) };
    });
    razpolozljivaPodjetja = zdruziPodjetja([aktivno].concat(lokalnaPodjetja)).filter(function (podjetje) {
      return !jePodjetjeOdstranjeno(podjetje.name);
    });
    izrisiPodjetja();
    if (podjetjaStanje) podjetjaStanje.textContent = "Nalagam podjetja …";
    try {
      const odgovor = await window.fetch("/api/boniteta-pro?route=profiles", { headers: { Accept: "application/json" } });
      if (!odgovor.ok) throw new Error("Podjetij ni bilo mogoče naložiti.");
      const podatki = await odgovor.json();
      const profili = Array.isArray(podatki && podatki.profiles) ? podatki.profiles : [];
      razpolozljivaPodjetja = zdruziPodjetja([aktivno].concat(lokalnaPodjetja, profili.map(function (profil) {
        return { id: profil && profil.id, name: profil && profil.legal_name };
      }))).filter(function (podjetje) { return !jePodjetjeOdstranjeno(podjetje.name); });
      izrisiPodjetja();
      if (podjetjaStanje) {
        podjetjaStanje.textContent = razpolozljivaPodjetja.length > 1
          ? ""
          : "Druga shranjena podjetja še niso dodana.";
      }
    } catch (napaka) {
      if (podjetjaStanje) podjetjaStanje.textContent = "Prikazano je trenutno razpoložljivo podjetje.";
    }
  }

  function zapriIzbirnik(vrniFokus) {
    if (!podjetjaIzbirnik || podjetjaIzbirnik.hidden) return;
    podjetjaIzbirnik.hidden = true;
    if (podjetjaOdpri) podjetjaOdpri.setAttribute("aria-expanded", "false");
    if (vrniFokus && podjetjaOdpri) podjetjaOdpri.focus({ preventScroll: true });
    else if (podjetjaOdpri && document.activeElement === podjetjaOdpri) podjetjaOdpri.blur();
  }

  function odpriIzbirnik() {
    if (!podjetjaIzbirnik || !podjetjaOdpri) return;
    if (podjetjaSklop) podjetjaSklop.classList.remove("has-podjetje-izbrano");
    if (aktivnoPodjetjeIzberi) aktivnoPodjetjeIzberi.setAttribute("aria-pressed", "false");
    podjetjaIzbirnik.hidden = false;
    podjetjaOdpri.setAttribute("aria-expanded", "true");
    naloziPodjetja();
  }

  const zacetnoPodjetje = preberiIzbranoPodjetje();
  if (zacetnoPodjetje && !jePodjetjeOdstranjeno(zacetnoPodjetje.name)) nastaviAktivnoPodjetje(zacetnoPodjetje);
  else if (jePodjetjeOdstranjeno(trenutnoPodjetje().name)) pocistiAktivnoPodjetje();
  if (podjetjaOdpri) {
    podjetjaOdpri.addEventListener("click", function () {
      if (podjetjaIzbirnik && !podjetjaIzbirnik.hidden) zapriIzbirnik(false);
      else odpriIzbirnik();
    });
  }
  if (podjetjaZapri) podjetjaZapri.addEventListener("click", function () { zapriIzbirnik(false); });
  if (aktivnoPodjetjeIzberi) {
    aktivnoPodjetjeIzberi.addEventListener("click", function () {
      if (aktivnoPodjetjeIzberi.disabled) return;
      if (aktivnoPodjetjeIzberi.getAttribute("aria-pressed") === "true") {
        pocistiAktivnoPodjetje();
        return;
      }
      zapriIzbirnik(false);
      if (podjetjaSklop) podjetjaSklop.classList.add("has-podjetje-izbrano");
      aktivnoPodjetjeIzberi.setAttribute("aria-pressed", "true");
    });
  }
  document.addEventListener("keydown", function (dogodek) {
    if (dogodek.key === "Escape") {
      if (podjetjeModal && !podjetjeModal.hidden) zapriModal(true);
      else zapriIzbirnik(true);
    }
  });
  document.addEventListener("click", function (dogodek) {
    if (!podjetjaSklop || podjetjaSklop.contains(dogodek.target)) return;
    zapriIzbirnik(false);
  });

  if (podjetjeDodaj) {
    podjetjeDodaj.addEventListener("click", function () {
      if (podjetjeObrazec && !podjetjeObrazec.hidden && podjetjeDodaj.classList.contains("is-active")) {
        zapriPodjetjeObrazec();
        podjetjeDodaj.focus({ preventScroll: true });
        return;
      }
      odpriPodjetjeObrazec(null);
    });
  }
  if (podjetjeObrazecZapri) {
    podjetjeObrazecZapri.addEventListener("click", function () {
      const ciljFokusa = urejanoPodjetje ? podjetjeUredi : podjetjeDodaj;
      if (!zapriPodjetjeObrazec()) return;
      if (ciljFokusa) ciljFokusa.focus({ preventScroll: true });
    });
  }
  if (podjetjeUredi) {
    podjetjeUredi.addEventListener("click", function () {
      if (podjetjeObrazec && !podjetjeObrazec.hidden && podjetjeUredi.classList.contains("is-active")) {
        zapriPodjetjeObrazec();
        podjetjeUredi.focus({ preventScroll: true });
        return;
      }
      const trenutno = trenutnoPodjetje();
      odpriPodjetjeObrazec(najdiPodjetjePodatke(trenutno.name) || { name: trenutno.name });
    });
  }
  if (podjetjeOdstrani) {
    podjetjeOdstrani.addEventListener("click", function () {
      if (podjetjeOdstrani.disabled) return;
      const trenutno = trenutnoPodjetje();
      if (!varnoBesedilo(trenutno.name)) return;
      if (podjetjeObrazec && !podjetjeObrazec.hidden) zapriPodjetjeObrazec();
      odstraniPodjetjeIzPrimera(najdiPodjetjePodatke(trenutno.name) || trenutno);
    });
  }
  if (podjetjeIme) podjetjeIme.addEventListener("input", osveziPovzetke);
  if (dejavnostVnos) {
    dejavnostVnos.addEventListener("focus", function () {
      izrisiPredlogeDejavnosti(dejavnostVnos.value);
    });
    dejavnostVnos.addEventListener("blur", function () {
      window.setTimeout(function () {
        if (dejavnostPredlogi) dejavnostPredlogi.hidden = true;
        dejavnostVnos.setAttribute("aria-expanded", "false");
      }, 120);
    });
    dejavnostVnos.addEventListener("input", function () {
      izrisiPredlogeDejavnosti(dejavnostVnos.value);
    });
    dejavnostVnos.addEventListener("keydown", function (dogodek) {
      if (dogodek.key === "Escape") {
        dogodek.preventDefault();
        if (dejavnostPredlogi) dejavnostPredlogi.hidden = true;
        dejavnostVnos.setAttribute("aria-expanded", "false");
        return;
      }
      if (dogodek.key !== "Enter" && dogodek.key !== "," && dogodek.key !== ";") return;
      dogodek.preventDefault();
      dodajDejavnost(dejavnostVnos.value);
    });
  }
  document.querySelectorAll("[data-izbira-odpri]").forEach(function (gumb) {
    gumb.addEventListener("click", function () {
      odpriModal(gumb.getAttribute("data-izbira-odpri"), gumb);
    });
  });
  document.querySelectorAll("[data-podjetje-modal-zapri]").forEach(function (gumb) {
    gumb.addEventListener("click", function () { zapriModal(true); });
  });
  if (podjetjeShrani) {
    podjetjeShrani.addEventListener("click", function () {
      const ime = varnoBesedilo(podjetjeIme && podjetjeIme.value);
      if (!ime) {
        if (podjetjeNapaka) podjetjeNapaka.textContent = "Vnesite ime podjetja.";
        if (podjetjeIme) podjetjeIme.focus({ preventScroll: true });
        return;
      }
      if (!dejavnosti.length) {
        if (podjetjeNapaka) podjetjeNapaka.textContent = "Dodajte najmanj eno dejavnost podjetja.";
        if (dejavnostVnos) dejavnostVnos.focus({ preventScroll: true });
        return;
      }
      const manjkajocaIzbira = Object.keys(IZBIRE).find(function (vrsta) { return !odgovori[vrsta]; });
      if (manjkajocaIzbira) {
        if (podjetjeNapaka) podjetjeNapaka.textContent = "Izberite še: " + IZBIRE[manjkajocaIzbira].naslov.toLocaleLowerCase("sl-SI") + ".";
        const sprozilec = document.querySelector('[data-izbira-odpri="' + manjkajocaIzbira + '"]');
        odpriModal(manjkajocaIzbira, sprozilec);
        return;
      }
      const shranjeno = {
        id: varnoBesedilo(urejanoPodjetje && urejanoPodjetje.id),
        name: ime,
        dejavnosti: dejavnosti.slice(),
        glavnaDejavnost: glavnaDejavnost || dejavnosti[0],
        vloga: odgovori.vloga,
        odnos: odgovori.odnos,
        sodelovanje: odgovori.sodelovanje,
        stik: odgovori.stik,
      };
      nastaviPodjetjeOdstranjeno(shranjeno.name, false);
      shraniPodjetjePodatke(shranjeno);
      nastaviAktivnoPodjetje(shranjeno);
      razpolozljivaPodjetja = zdruziPodjetja([shranjeno].concat(razpolozljivaPodjetja));
      podjetjaNalozena = false;
      zapriPodjetjeObrazec();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  window.UJPoskusiNotranjiKorakNazaj = function () {
    if (podjetjeModal && !podjetjeModal.hidden) {
      zapriModal(true);
      return true;
    }
    if (document.body.classList.contains("is-ponudba-mode")) {
      zapriPonudbaNacin();
      return true;
    }
    return zapriPodjetjeObrazec();
  };

  function pokaziStatus(besedilo, napaka) {
    if (!status) return;
    status.textContent = besedilo || "";
    status.classList.toggle("is-error", Boolean(napaka));
  }

  function jeAtenaSnemalnoStanje(stanje) {
    return ["starting", "recording", "transcribing", "stopping"].includes(stanje);
  }

  function zacniAtenaRazsiritev(razred, preveri) {
    if (!atenaAkcije) return;
    atenaAkcije.classList.remove(razred);
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        if (preveri()) atenaAkcije.classList.add(razred);
      });
    });
  }

  function posodobiAtenaGlasnost(vrednost) {
    atenaRavenGlasu = Math.min(1, Math.max(0, Number(vrednost) || 0));
    if (!atenaGlasnost) return;
    const faktorji = [0.56, 0.82, 1, 0.76, 0.5];
    Array.from(atenaGlasnost.children).forEach(function (stolpec, indeks) {
      const nivo = Math.max(0.12, Math.min(1, atenaRavenGlasu * faktorji[indeks] + atenaRavenGlasu * atenaRavenGlasu * (indeks % 2 ? 0.14 : 0.24)));
      stolpec.style.setProperty("--voice-bar", nivo.toFixed(3));
    });
  }

  function nastaviAtenaKontekstZaklep(zaklenjeno) {
    if (zaklenjeno && !atenaKontekstZaklepAktiven) {
      atenaKontekstZaklepStanja = Array.from(document.querySelectorAll(
        "[data-storitev], [data-predloga], [data-dodaj-ponudbo], [data-ponudba-podrocje], [data-ponudba-vse], [data-ponudba-kartice]"
      )).map(function (gumb) {
        const stanje = { gumb: gumb, disabled: gumb.disabled };
        gumb.disabled = true;
        return stanje;
      });
      atenaKontekstZaklepAktiven = true;
      return;
    }
    if (!zaklenjeno && atenaKontekstZaklepAktiven) {
      atenaKontekstZaklepStanja.forEach(function (stanje) {
        stanje.gumb.disabled = stanje.disabled;
      });
      atenaKontekstZaklepStanja = [];
      atenaKontekstZaklepAktiven = false;
    }
  }

  function posodobiAtenaSnemanjeUi() {
    const aktivno = atenaSnemanjeAktivno;
    nastaviAtenaKontekstZaklep(atenaAnalizaAktivna || aktivno);
    if (atenaAkcije && !aktivno) atenaAkcije.classList.remove("is-recording");
    if (gumbGlas) {
      gumbGlas.classList.toggle("is-recording", aktivno);
      gumbGlas.setAttribute("aria-label", aktivno ? "Prekini snemanje" : "Povej na glas");
      gumbGlas.setAttribute("aria-pressed", String(aktivno));
      gumbGlas.disabled = atenaAnalizaAktivna || atenaPrekinitevPoZagonu;
    }
    if (atenaGlasBesedilo) atenaGlasBesedilo.textContent = aktivno ? "Prekini snemanje" : "Povej na glas";
    if (atenaGlasnost) atenaGlasnost.hidden = !aktivno;
    if (gumbPreverba) gumbPreverba.disabled = atenaAnalizaAktivna || aktivno;
    if (!aktivno) posodobiAtenaGlasnost(0);
  }

  function ustaviAtenaAnalizaStatus() {
    if (atenaAnalizaStatusCasovnik) window.clearInterval(atenaAnalizaStatusCasovnik);
    atenaAnalizaStatusCasovnik = 0;
    atenaAnalizaStatusKorak = 0;
    if (atenaPrimarniBesedilo) atenaPrimarniBesedilo.classList.remove("is-changing");
  }

  function posodobiAtenaAnalizaStatus() {
    if (!atenaPrimarniBesedilo || !atenaAnalizaAktivna) return;
    atenaPrimarniBesedilo.textContent = ATENA_ANALIZA_STATUS_BESEDILA[atenaAnalizaStatusKorak];
    atenaPrimarniBesedilo.classList.remove("is-changing");
    void atenaPrimarniBesedilo.offsetWidth;
    atenaPrimarniBesedilo.classList.add("is-changing");
    atenaAnalizaStatusKorak = (atenaAnalizaStatusKorak + 1) % ATENA_ANALIZA_STATUS_BESEDILA.length;
  }

  function zacniAtenaAnalizo() {
    const zacetek = Date.now();
    atenaAnalizaAktivna = true;
    pokaziStatus("", false);
    nastaviAtenaKontekstZaklep(true);
    if (atenaAkcije) atenaAkcije.classList.remove("is-recording", "is-analyzing");
    if (gumbPreverba) {
      gumbPreverba.disabled = true;
      gumbPreverba.setAttribute("aria-busy", "true");
    }
    if (gumbGlas) gumbGlas.disabled = true;
    if (opis) opis.disabled = true;
    if (atenaAnalizaLoader) atenaAnalizaLoader.hidden = false;
    atenaNacinGumbi.forEach(function (gumb) { gumb.disabled = true; });
    ustaviAtenaAnalizaStatus();
    atenaAnalizaAktivna = true;
    posodobiAtenaAnalizaStatus();
    atenaAnalizaStatusCasovnik = window.setInterval(posodobiAtenaAnalizaStatus, 1200);
    zacniAtenaRazsiritev("is-analyzing", function () { return atenaAnalizaAktivna; });
    return zacetek;
  }

  function koncajAtenaAnalizo(mirujoceBesedilo) {
    ustaviAtenaAnalizaStatus();
    atenaAnalizaAktivna = false;
    if (atenaAkcije) atenaAkcije.classList.remove("is-analyzing");
    if (gumbPreverba) gumbPreverba.removeAttribute("aria-busy");
    if (atenaAnalizaLoader) atenaAnalizaLoader.hidden = true;
    if (opis) opis.disabled = false;
    atenaNacinGumbi.forEach(function (gumb) { gumb.disabled = false; });
    if (atenaPrimarniBesedilo) atenaPrimarniBesedilo.textContent = mirujoceBesedilo;
    posodobiAtenaSnemanjeUi();
  }

  function pocakajNaAtenaRazsiritev(zacetek) {
    const preostanek = 900 - (Date.now() - zacetek);
    return preostanek > 0 ? new Promise(function (resolve) { window.setTimeout(resolve, preostanek); }) : Promise.resolve();
  }

  function pocakajNaAtenaOdzivSnemanja(zacetek) {
    const preostanek = 650 - (Date.now() - zacetek);
    return preostanek > 0 ? new Promise(function (resolve) { window.setTimeout(resolve, preostanek); }) : Promise.resolve();
  }

  function zagotoviSvetovalecCanary() {
    if (svetovalecCanary) return svetovalecCanary;
    if (!window.UJHandyCanary) throw new Error("Lokalni Handy/Canary vmesnik ni naložen.");
    svetovalecCanary = window.UJHandyCanary.create({
      onText: function (text) {
        if (!opis) return;
        opis.value = String(text || "").slice(0, 2000);
        opis.dispatchEvent(new Event("input", { bubbles: true }));
      },
      onState: function (podatek) {
        const prejAktivno = atenaSnemanjeAktivno;
        atenaSnemanjeAktivno = jeAtenaSnemalnoStanje(podatek && podatek.state);
        if (!atenaSnemanjeAktivno) {
          atenaPrekinitevPoZagonu = false;
          atenaRavenGlasu = 0;
        }
        posodobiAtenaSnemanjeUi();
        if (!prejAktivno && atenaSnemanjeAktivno) {
          zacniAtenaRazsiritev("is-recording", function () { return atenaSnemanjeAktivno; });
        }
        if (atenaSnemanjeAktivno) posodobiAtenaGlasnost(atenaRavenGlasu);
        if (podatek && podatek.message) pokaziStatus(podatek.message, false);
      },
      onLevel: function (podatek) {
        posodobiAtenaGlasnost(podatek && podatek.level);
      },
      onError: function (error) {
        atenaSnemanjeAktivno = false;
        atenaPrekinitevPoZagonu = false;
        atenaRavenGlasu = 0;
        posodobiAtenaSnemanjeUi();
        pokaziStatus(error && error.message || "Lokalni prepis ni uspel.", true);
      },
    });
    return svetovalecCanary;
  }

  function nastaviAtenaNacin(nacin) {
    const rocno = nacin === "rocno";
    if (rocno && atenaSnemanjeAktivno) {
      if (svetovalecCanary && svetovalecCanary.isRecording()) {
        svetovalecCanary.stop().catch(function () {});
      } else {
        atenaPrekinitevPoZagonu = true;
        posodobiAtenaSnemanjeUi();
      }
    }
    atenaNacinGumbi.forEach(function (gumb) {
      const izbran = gumb.dataset.atenaNacin === (rocno ? "rocno" : "opis");
      gumb.classList.toggle("is-selected", izbran);
      gumb.setAttribute("aria-selected", izbran ? "true" : "false");
      gumb.tabIndex = izbran ? 0 : -1;
    });
    if (atenaOpisPanel) atenaOpisPanel.hidden = rocno;
    if (atenaRocnoPanel) atenaRocnoPanel.hidden = !rocno;
    if (rocno) pocistiAtenaPredloge();
  }

  function pocistiAtenaPredloge() {
    if (!atenaPredlogi) return;
    atenaPredlogi.innerHTML = "";
    atenaPredlogi.hidden = true;
  }

  function izrisiAtenaPredloge(besedilo, storitevKoda) {
    if (!atenaPredlogi || !atenaCardSchema || !atenaCardRenderer) return [];
    const ciljnaStoritev = storitevKoda || aktivnaStoritevKoda;
    const predlogi = atenaCardSchema.relevantAreas(besedilo, ciljnaStoritev, 3);
    atenaCardRenderer.renderAreas(atenaPredlogi, predlogi, {
      onOpen: function (predlog) {
        const gumb = ponudbaModulGumbi.find(function (kandidat) { return kandidat.dataset.ponudbaPodrocje === predlog.code; });
        if (gumb) odpriPonudbaObrazec(gumb);
      }
    });
    return predlogi;
  }

  function odpriOpis(predloga) {
    if (!opis) return;
    nastaviAtenaNacin("opis");
    if (!opis.value.trim()) opis.value = predloga || "";
    opis.focus({ preventScroll: true });
    opis.setSelectionRange(opis.value.length, opis.value.length);
    opis.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function posodobiPonudbaStrnitev() {
    const strnjeno = document.body.classList.contains("is-ponudba-mode") && Boolean(
      document.activeElement === opis || varnoBesedilo(opis && opis.value)
    );
    document.body.classList.toggle("is-ponudba-pisanje", strnjeno);
  }

  let aktivnaStoritevKoda = "ponudba";
  let aktivnaStoritevMeta = {
    title: "Preverite ponudbo",
    summaryTitle: "Povzetek ponudbe",
    intro: "Opišite po svoje ali dodajte ponudbo.",
    placeholder: "Npr. Preveri ceno, vključeno montažo in možnost odpovedi …",
    primary: "Sestavi pregled",
    overviewTitle: "Kaj lahko preverimo?",
    status: "Izberite področja ali Ateni opišite, kaj vas skrbi.",
    accent: "#e49a10",
    tint: "#fff8e9"
  };

  function odpriPonudbaNacin(storitevKoda) {
    nastaviAktivnoStoritev(storitevKoda || "ponudba");
    nastaviAtenaNacin("opis");
    document.body.classList.add("is-ponudba-mode");
    if (ponudbaModuli) ponudbaModuli.hidden = false;
    if (opis) {
      opis.value = varnoBesedilo(ponudbaOsnutek.sourceText);
      opis.placeholder = aktivnaStoritevMeta.placeholder;
      opis.setAttribute("aria-label", "Opišite, kaj naj Atena pripravi za storitev " + aktivnaStoritevMeta.title);
    }
    posodobiPonudbaPovzetek();
    pocistiAtenaPredloge();
    pokaziStatus("", false);
    posodobiPonudbaStrnitev();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function zapriPonudbaNacin() {
    document.body.classList.remove("is-ponudba-mode", "is-ponudba-pisanje", "is-ponudba-povzetek");
    delete document.body.dataset.storitevTema;
    document.body.style.removeProperty("--svetovalec-storitev-barva");
    document.body.style.removeProperty("--svetovalec-storitev-ozadje");
    if (ponudbaModuli) ponudbaModuli.hidden = true;
    if (atenaNaslov) atenaNaslov.textContent = "Kaj naj preverimo ali uredimo?";
    if (atenaPodnaslov) atenaPodnaslov.textContent = "Povejte Ateni, kaj naj preveri ali uredi.";
    if (opis) {
      opis.placeholder = "Npr. Želim preveriti ponudbo, pogodbo ali pogoje naročnine …";
      opis.setAttribute("aria-label", "Opišite, kaj naj preverimo ali uredimo");
    }
    if (atenaPrimarniBesedilo) atenaPrimarniBesedilo.textContent = "Začni preverbo";
    if (ponudbaKarticeGumb) ponudbaKarticeGumb.textContent = "Kartice";
    pocistiAtenaPredloge();
    pokaziStatus("", false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  atenaNacinGumbi.forEach(function (gumb, indeks) {
    gumb.addEventListener("click", function () {
      nastaviAtenaNacin(gumb.dataset.atenaNacin);
    });
    gumb.addEventListener("keydown", function (dogodek) {
      if (dogodek.key !== "ArrowLeft" && dogodek.key !== "ArrowRight") return;
      dogodek.preventDefault();
      const smer = dogodek.key === "ArrowRight" ? 1 : -1;
      const naslednji = atenaNacinGumbi[(indeks + smer + atenaNacinGumbi.length) % atenaNacinGumbi.length];
      if (!naslednji) return;
      nastaviAtenaNacin(naslednji.dataset.atenaNacin);
      naslednji.focus();
    });
  });

  document.querySelectorAll("[data-predloga]").forEach(function (gumb) {
    gumb.addEventListener("click", function () {
      if (gumb.hasAttribute("data-storitev")) {
        odpriPonudbaNacin(gumb.dataset.storitev);
        return;
      }
      odpriOpis(gumb.getAttribute("data-predloga") || "");
    });
  });

  if (opis) {
    opis.addEventListener("focus", posodobiPonudbaStrnitev);
    opis.addEventListener("input", posodobiPonudbaStrnitev);
    opis.addEventListener("blur", function () { window.setTimeout(posodobiPonudbaStrnitev, 0); });
  }

  let ponudbaModulGumbi = Array.from(document.querySelectorAll("[data-ponudba-podrocje]"));
  const ponudbaVse = document.querySelector("[data-ponudba-vse]");
  let ponudbaAktivniModulId = null;
  let ponudbaAktivnoPodrocje = null;
  let ponudbaAktivniModuli = [];
  let ponudbaKorakIndex = 0;
  let ponudbaPotrditevAktivna = false;
  let ponudbaRazsirjenoVprasanjeIndex = null;
  let ponudbaDotikX = null;
  let ponudbaDotikY = null;
  let ponudbaPrejsnjiFokus = null;
  let ponudbaOsnutek = { profileId: null, offerModelIds: [], salesChannelIds: [], answers: {}, completedModuleIds: [], sourceText: "", reviewReady: false };

  function prazenPonudbaOsnutek() {
    return { profileId:null, offerModelIds:[], salesChannelIds:[], answers:{}, completedModuleIds:[], sourceText:"", reviewReady:false };
  }

  function preberiPonudbaOsnutek() {
    const osnutek = prazenPonudbaOsnutek();
    try {
      const shranjeno = JSON.parse(window.localStorage.getItem(PONUDBA_OSNUTEK_SHRAMBA) || "null");
      if (shranjeno && typeof shranjeno === "object") return Object.assign(osnutek, shranjeno);
    } catch (_error) {}
    return osnutek;
  }

  function shraniPonudbaOsnutek() {
    try { window.localStorage.setItem(PONUDBA_OSNUTEK_SHRAMBA, JSON.stringify(ponudbaOsnutek)); } catch (_error) {}
  }

  ponudbaOsnutek = preberiPonudbaOsnutek();

  function dodajMoznost(select, value, label) {
    const option = document.createElement("option"); option.value = String(value); option.textContent = label; select.appendChild(option);
  }

  function pripraviPonudbaKatalog() {
    if (!ponudbaEngine || !ponudbaProfil) return;
    ponudbaProfil.innerHTML = '<option value="">Izberite vrsto sogovornika</option>';
    ponudbaModel.innerHTML = '<option value="">Izberite vrsto naloge</option>';
    ponudbaKanal.innerHTML = '<option value="">Izberite način stika</option>';
    ponudbaEngine.families.forEach(function (family) {
      const group = document.createElement("optgroup"); group.label = family.label;
      ponudbaEngine.profiles.filter(function (profile) { return profile.familyId === family.id; }).forEach(function (profile) {
        const option = document.createElement("option"); option.value = String(profile.id); option.textContent = profile.label; group.appendChild(option);
      });
      ponudbaProfil.appendChild(group);
    });
    ponudbaEngine.offerModels.forEach(function (model) { dodajMoznost(ponudbaModel, model.id, model.label); });
    ponudbaEngine.salesChannels.forEach(function (channel) { dodajMoznost(ponudbaKanal, channel.id, channel.label); });
    ponudbaProfil.value = ponudbaOsnutek.profileId ? String(ponudbaOsnutek.profileId) : "";
    ponudbaModel.value = ponudbaOsnutek.offerModelIds[0] ? String(ponudbaOsnutek.offerModelIds[0]) : "";
    ponudbaKanal.value = ponudbaOsnutek.salesChannelIds[0] ? String(ponudbaOsnutek.salesChannelIds[0]) : "";
  }

  function areaVizualnaSkupina(area) {
    if (area && area.icon) return area.icon;
    if (["cena", "obseg", "placilo", "pogodba", "garancija", "tveganja"].includes(area && area.code)) return area.code;
    return "obseg";
  }

  function kodaIkonePodrocja(skupina) {
    return { cena:"P", obseg:"S", placilo:"T", pogodba:"K", garancija:"G", tveganja:"R" }[skupina] || "S";
  }

  function izrisiPodrocjaAktivneStoritve() {
    if (!ponudbaPodrocja || !ponudbaEngine || !ponudbaVse) return;
    ponudbaPodrocja.querySelectorAll("[data-ponudba-podrocje]").forEach(function (gumb) { gumb.remove(); });
    ponudbaEngine.areas.forEach(function (area) {
      const skupina = areaVizualnaSkupina(area);
      const gumb = document.createElement("button");
      gumb.type = "button";
      gumb.className = "ponudba-modul ponudba-modul--" + skupina;
      gumb.setAttribute("aria-pressed", jePodrocjeKoncano(area.code) ? "true" : "false");
      gumb.setAttribute("aria-haspopup", "dialog");
      gumb.dataset.ponudbaPodrocje = area.code;
      gumb.innerHTML = '<span class="ponudba-modul__ikona" aria-hidden="true">' + ponudbaKarticaIkona(kodaIkonePodrocja(skupina)) + '</span>' +
        '<span><strong>' + pobegniHtml(area.label) + '</strong><small>' + pobegniHtml(area.description) + '</small></span>' +
        '<i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m7 12 3 3 7-7" /></svg></i>' +
        '<span class="ponudba-modul__status" data-ponudba-modul-status>' + predlogiBesedilo(area.moduleIds.length) + '</span>';
      ponudbaPodrocja.insertBefore(gumb, ponudbaVse);
    });
    ponudbaModulGumbi = Array.from(ponudbaPodrocja.querySelectorAll("[data-ponudba-podrocje]"));
    poveziPonudbaPodrocja();
  }

  function nastaviKontekstOznake(jePonudba) {
    if (!ponudbaKontekst) return;
    const oznake = ponudbaKontekst.querySelectorAll("label > span");
    const besedila = jePonudba
      ? ["Vrsta ponudnika", "Oblika ponudbe", "Kako je ponudba prišla do vas"]
      : ["Vrsta sogovornika", "Vrsta naloge", "Način dosedanjega stika"];
    oznake.forEach(function (oznaka, index) { if (besedila[index]) oznaka.textContent = besedila[index]; });
  }

  function nastaviAktivnoStoritev(koda) {
    const novaKoda = String(koda || "ponudba");
    const novaStoritev = novaKoda === "ponudba"
      ? null
      : (svetovalecStoritveEngine && svetovalecStoritveEngine.get(novaKoda));
    if (novaKoda !== "ponudba" && !novaStoritev) return false;
    if (aktivnaStoritevKoda !== novaKoda) shraniPonudbaOsnutek();
    aktivnaStoritevKoda = novaKoda;
    ponudbaEngine = novaStoritev || ponudbaOsnovniEngine;
    aktivnaStoritevMeta = novaStoritev || {
      title:"Preverite ponudbo", summaryTitle:"Povzetek ponudbe", intro:"Opišite po svoje ali dodajte ponudbo.",
      placeholder:"Npr. Preveri ceno, vključeno montažo in možnost odpovedi …", primary:"Sestavi pregled",
      overviewTitle:"Kaj lahko preverimo?", status:"Izberite področja ali Ateni opišite, kaj vas skrbi.", accent:"#e49a10", tint:"#fff8e9"
    };
    PONUDBA_OSNUTEK_SHRAMBA = novaKoda === "ponudba" ? "uj_svetovalec_ponudba_osnutek_v1" : "uj_svetovalec_" + novaKoda + "_osnutek_v1";
    ponudbaOsnutek = preberiPonudbaOsnutek();
    ponudbaAktivniModulId = null;
    ponudbaAktivnoPodrocje = null;
    ponudbaAktivniModuli = [];
    ponudbaKorakIndex = 0;
    ponudbaPotrditevAktivna = false;
    ponudbaRazsirjenoVprasanjeIndex = null;
    document.body.dataset.storitevTema = novaKoda;
    document.body.style.setProperty("--svetovalec-storitev-barva", aktivnaStoritevMeta.accent);
    document.body.style.setProperty("--svetovalec-storitev-ozadje", aktivnaStoritevMeta.tint);
    const pregledNaslov = document.querySelector("[data-storitev-podrocja-naslov]");
    if (pregledNaslov) pregledNaslov.textContent = aktivnaStoritevMeta.overviewTitle;
    if (ponudbaModuliStatus) ponudbaModuliStatus.textContent = aktivnaStoritevMeta.status;
    if (ponudbaKarticeVpogled) { ponudbaKarticeVpogled.hidden = true; ponudbaKarticeVpogled.innerHTML = ""; }
    if (ponudbaPodrocja) ponudbaPodrocja.hidden = false;
    if (ponudbaKarticeGumb) { ponudbaKarticeGumb.setAttribute("aria-expanded", "false"); ponudbaKarticeGumb.classList.remove("is-active"); }
    pripraviPonudbaKatalog();
    nastaviKontekstOznake(novaKoda === "ponudba");
    izrisiPodrocjaAktivneStoritve();
    posodobiIzbraneModule();
    return true;
  }

  function ponudbaPoljeHtml(field, polnaSirina) {
    const vrednost = ponudbaOsnutek.answers && ponudbaOsnutek.answers[field.id] != null ? String(ponudbaOsnutek.answers[field.id]) : "";
    const obvezno = field.required ? " required" : "";
    const oznaka = field.label + (field.required ? " *" : "");
    const razred = "ponudba-obrazec__polje" + (polnaSirina ? " ponudba-obrazec__polje--polno" : "");
    let control = "";
    if (field.type === "textarea") control = '<textarea rows="1" data-ponudba-samorastoci data-ponudba-field="' + field.id + '"' + obvezno + '>' + pobegniHtml(vrednost) + "</textarea>";
    else if (field.type === "select") {
      control = '<select data-ponudba-field="' + field.id + '" aria-label="' + pobegniHtml(oznaka) + '"' + obvezno + '><option value="">Izberite možnost</option>' + field.options.map(function (option) {
        return '<option value="' + pobegniHtml(option.id) + '"' + (option.id === vrednost ? " selected" : "") + '>' + pobegniHtml(option.label) + '</option>';
      }).join("") + '</select>';
    }
    else control = '<input type="' + (field.type === "date" ? "date" : "text") + '" inputmode="' + (field.type === "money" ? "decimal" : "text") + '" value="' + pobegniHtml(vrednost) + '" data-ponudba-field="' + field.id + '"' + obvezno + " />";
    return '<div class="' + razred + '"><span>' + pobegniHtml(oznaka) + '</span>' + control + (field.help ? '<small>' + pobegniHtml(field.help) + "</small>" : "") + "</div>";
  }

  function ponudbaPoljaRazpored(fields) {
    const polna = new Set();
    let par = [];
    function zakljuciPar() {
      if (par.length % 2) polna.add(par[par.length - 1].id);
      par = [];
    }
    fields.forEach(function (field) {
      if (field.type === "textarea") {
        zakljuciPar();
        polna.add(field.id);
        return;
      }
      par.push(field);
    });
    zakljuciPar();
    return fields.map(function (field) { return ponudbaPoljeHtml(field, polna.has(field.id)); }).join("");
  }

  function ponudbaPosebniModulHtml(modul) {
    if (modul.code === "C00") {
      const profil = ponudbaEngine.profiles.find(function (row) { return row.id === Number(ponudbaProfil.value); });
      const model = ponudbaEngine.offerModels.find(function (row) { return row.id === Number(ponudbaModel.value); });
      const kanal = ponudbaEngine.salesChannels.find(function (row) { return row.id === Number(ponudbaKanal.value); });
      return '<div class="ponudba-obrazec__potrditve ponudba-obrazec__polje--polno" aria-label="Povzetek razumevanja">' + [
        ["Vrsta ponudnika", profil && profil.label],
        ["Oblika ponudbe", model && model.label],
        ["Vir ponudbe", kanal && kanal.label]
      ].map(function (vrstica) { return '<div class="ponudba-obrazec__potrditev"><span>' + pobegniHtml(vrstica[0]) + '</span><strong>' + pobegniHtml(vrstica[1] || "Še ni izbrano") + "</strong></div>"; }).join("") + "</div>";
    }
    const odgovori = Object.keys(ponudbaOsnutek.answers || {}).filter(function (id) { return varnoBesedilo(ponudbaOsnutek.answers[id]); }).length;
    const koncani = (ponudbaOsnutek.completedModuleIds || []).filter(function (id) { return id !== 4027; }).length;
    return '<div class="ponudba-obrazec__potrditve ponudba-obrazec__polje--polno" aria-label="Končni povzetek"><div class="ponudba-obrazec__potrditev"><span>Potrjeni moduli</span><strong>' + koncani + ' od 27</strong></div><div class="ponudba-obrazec__potrditev"><span>Zbrani odgovori</span><strong>' + odgovori + '</strong></div></div>';
  }

  function ponudbaPodrocje(koda) {
    return ponudbaEngine && ponudbaEngine.areas.find(function (area) { return area.code === koda; });
  }

  const PONUDBA_ATENA_PREDLOGI = Object.freeze({
    cena: "preverite skupno ceno, DDV, dodatne in ponavljajoče stroške ter pogoje popustov",
    obseg: "preverite, kaj je vključeno, kaj manjka in kaj morate zagotoviti sami",
    placilo: "preverite roke, obroke, mejnike ter način in čas plačila",
    pogodba: "preverite trajanje, podaljšanje, odpoved in možnost spremembe pogojev",
    garancija: "preverite trajanje jamstva, kritje, izključitve in postopek reklamacije",
    tveganja: "preverite ponudnika, podizvajalce, dokazila, podatke in ustne obljube"
  });

  const PONUDBA_PODROCJE_OPISI = Object.freeze({
    cena: "Uredite podatke po korakih, da ponudba ne bo skrivala dodatnih stroškov.",
    obseg: "Uredite obseg po korakih, da bo jasno, kaj ponudba vključuje in česa ne.",
    placilo: "Uredite plačilo po korakih, da bodo roki, obroki in pogoji jasni.",
    pogodba: "Uredite pogodbene pogoje po korakih, preden sprejmete dolgoročne obveznosti.",
    garancija: "Uredite jamstvo po korakih, da bodo kritje, izključitve in reklamacije jasni.",
    tveganja: "Uredite tveganja po korakih, da preverite ponudnika, dokazila in obljube."
  });
  const PONUDBA_DOPLACILO_POLJA = Object.freeze([5105, 5306, 5609]);

  function ponudbaVrednostPolja(fieldId) {
    const prikazanoPolje = ponudbaObrazecPolja && ponudbaObrazecPolja.querySelector('[data-ponudba-field="' + fieldId + '"]');
    if (prikazanoPolje) return varnoBesedilo(prikazanoPolje.value);
    return varnoBesedilo(ponudbaOsnutek.answers && ponudbaOsnutek.answers[fieldId]);
  }

  function ponudbaEvrskiZnesek(besedilo) {
    const vrednost = varnoBesedilo(besedilo);
    const ujemanje = vrednost.match(/(\d[\d .]*(?:,\d{1,2})?)\s*(?:€|EUR)/i) || vrednost.match(/^\s*(\d[\d .]*(?:,\d{1,2})?)\s*$/);
    if (!ujemanje) return null;
    let zapis = ujemanje[1].replace(/\s/g, "");
    if (zapis.includes(",")) zapis = zapis.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(?:\.\d{3})+$/.test(zapis)) zapis = zapis.replace(/\./g, "");
    const znesek = Number(zapis);
    return Number.isFinite(znesek) && znesek > 0 ? znesek : null;
  }

  function ponudbaDoplaciloZaModul(modul) {
    if (!modul || !ponudbaEngine) return null;
    const postavke = ponudbaEngine.fields.filter(function (field) {
      return field.moduleId === modul.id && PONUDBA_DOPLACILO_POLJA.includes(field.id);
    }).map(function (field) {
      return { label: field.label, value: ponudbaVrednostPolja(field.id) };
    }).filter(function (postavka) { return postavka.value; });
    if (!postavke.length) return null;
    const prviZnesek = postavke.map(function (postavka) { return ponudbaEvrskiZnesek(postavka.value); }).find(function (znesek) { return znesek !== null; });
    const oznaka = prviZnesek === undefined
      ? "Doplačilo"
      : "+" + new Intl.NumberFormat("sl-SI", { maximumFractionDigits: 2 }).format(prviZnesek) + " €";
    return { label: oznaka, items: postavke };
  }

  function ponudbaDoplaciloPodrobnostiHtml(doplacilo) {
    if (!doplacilo) return "";
    return '<aside class="ponudba-obrazec__doplacilo-podrobnosti" data-ponudba-doplacilo-podrobnosti>' +
      '<div><small>Razčlenitev doplačila</small><strong>' + pobegniHtml(doplacilo.label) + '</strong></div>' +
      doplacilo.items.map(function (postavka) { return '<p><b>' + pobegniHtml(postavka.label) + ':</b> ' + pobegniHtml(postavka.value) + '</p>'; }).join("") +
    '</aside>';
  }

  function ponudbaAtenaPovzetekHtml() {
    const area = ponudbaPodrocje(ponudbaAktivnoPodrocje);
    const naslov = area ? area.label : aktivnaStoritevMeta.summaryTitle;
    const predlog = PONUDBA_ATENA_PREDLOGI[ponudbaAktivnoPodrocje] || "preverite vsa ključna dejstva in manjkajoče podatke";
    const povzetek = predlog.charAt(0).toUpperCase() + predlog.slice(1) + ".";
    return '<aside class="ponudba-obrazec__atena-povzetek" aria-label="Atenin povzetek za ' + pobegniHtml(naslov) + '">' +
      '<div class="ponudba-obrazec__atena-povzetek-glava"><span aria-hidden="true">A</span><small>Atenino priporočilo</small><strong>' + pobegniHtml(naslov) + '</strong></div>' +
      '<p><strong>Priporočamo:</strong> ' + pobegniHtml(povzetek) + '</p>' +
    '</aside>';
  }

  function izrisiPonudbaObrazecPodrocja() {
    if (!ponudbaObrazecPodrocja) return;
    const area = ponudbaPodrocje(ponudbaAktivnoPodrocje);
    if (ponudbaObrazecPodrocjeNaslov) ponudbaObrazecPodrocjeNaslov.textContent = area ? area.label : aktivnaStoritevMeta.summaryTitle;
    if (ponudbaObrazecPodrocjeOpis) ponudbaObrazecPodrocjeOpis.textContent = PONUDBA_PODROCJE_OPISI[ponudbaAktivnoPodrocje] || "Uredite vsa vprašanja po korakih in nato potrdite zbrane odgovore.";
    const steviloKartic = ponudbaAktivniModuli.length;
    ponudbaObrazecPodrocja.dataset.ponudbaStevilo = String(steviloKartic);
    if (steviloKartic === 1) {
      ponudbaRazsirjenoVprasanjeIndex = null;
      const enojniModul = ponudbaModulPoId(ponudbaAktivniModuli[0]);
      const enojnoDoplacilo = ponudbaDoplaciloZaModul(enojniModul);
      ponudbaObrazecPodrocja.innerHTML = enojniModul ? '<article class="ponudba-obrazec__podrocje ponudba-obrazec__podrocje--enojni ponudba-obrazec__podrocje--' + ponudbaKarticaRazred(enojniModul.code) + '" aria-label="' + pobegniHtml(ponudbaVprasanje(enojniModul)) + '">' +
        '<span class="ponudba-obrazec__podrocje-podrobnosti-ikona" aria-hidden="true">' + ponudbaKarticaIkona(enojniModul.code) + '</span>' +
        '<span class="ponudba-obrazec__podrocje-podrobnosti-besedilo"><strong>' + pobegniHtml(ponudbaVprasanje(enojniModul)) + '</strong><small>' + pobegniHtml(enojniModul.description) + '</small></span>' +
        ponudbaDoplaciloPodrobnostiHtml(enojnoDoplacilo) +
      '</article>' : '';
      return;
    }
    const kartice = ponudbaAktivniModuli.map(function (id, index) {
      const modul = ponudbaModulPoId(id);
      if (!modul) return "";
      const aktiven = !ponudbaPotrditevAktivna && index === ponudbaKorakIndex;
      const koncan = ponudbaOsnutek.completedModuleIds.includes(id);
      const razsirjen = index === ponudbaRazsirjenoVprasanjeIndex;
      const doplacilo = ponudbaDoplaciloZaModul(modul);
      return '<button type="button" class="ponudba-obrazec__podrocje ponudba-obrazec__podrocje--' + ponudbaKarticaRazred(modul.code) + (aktiven ? ' is-aktiven' : '') + (koncan ? ' is-koncan' : '') + (razsirjen ? ' is-razsirjen' : '') + (doplacilo ? ' ima-doplacilo' : '') + '" aria-pressed="' + (aktiven ? 'true' : 'false') + '" aria-expanded="' + (razsirjen ? 'true' : 'false') + '" aria-controls="ponudba-vprasanje-podrobnosti-' + id + '" data-ponudba-vprasanje-index="' + index + '">' +
        '<span class="ponudba-obrazec__podrocje-ikona" aria-hidden="true">' + ponudbaKarticaIkona(modul.code) + '</span>' +
        (doplacilo ? '<span class="ponudba-obrazec__podrocje-doplacilo" data-ponudba-doplacilo aria-label="Doplačilo">+€</span>' : '') +
        '<span class="ponudba-obrazec__podrocje-besedilo"><strong>' + pobegniHtml(modul.label) + '</strong></span>' +
        '<i aria-label="Vprašanje ' + (index + 1) + '">' + (koncan && !aktiven ? '✓' : index + 1) + '</i>' +
      '</button>';
    }).join("");
    const razsirjeniModulId = ponudbaRazsirjenoVprasanjeIndex === null ? null : ponudbaAktivniModuli[ponudbaRazsirjenoVprasanjeIndex];
    const razsirjeniModul = razsirjeniModulId ? ponudbaModulPoId(razsirjeniModulId) : null;
    const razsirjenoDoplacilo = ponudbaDoplaciloZaModul(razsirjeniModul);
    const podrobnosti = razsirjeniModul ? '<article class="ponudba-obrazec__podrocje-podrobnosti" id="ponudba-vprasanje-podrobnosti-' + razsirjeniModul.id + '" data-ponudba-vprasanje-podrobnosti>' +
      '<span class="ponudba-obrazec__podrocje-podrobnosti-ikona" aria-hidden="true">' + ponudbaKarticaIkona(razsirjeniModul.code) + '</span>' +
      '<span class="ponudba-obrazec__podrocje-podrobnosti-besedilo"><strong>' + pobegniHtml(ponudbaVprasanje(razsirjeniModul)) + '</strong><small>' + pobegniHtml(razsirjeniModul.description) + '</small></span>' +
      '<i aria-hidden="true">' + (ponudbaRazsirjenoVprasanjeIndex + 1) + '</i>' +
      ponudbaDoplaciloPodrobnostiHtml(razsirjenoDoplacilo) +
    '</article>' : '';
    ponudbaObrazecPodrocja.innerHTML = kartice + podrobnosti;
  }

  function ponudbaVsiModuli() {
    return ponudbaEngine ? ponudbaEngine.modules.map(function (modul) { return modul.id; }) : [];
  }

  function ponudbaKarticaRazred(koda) {
    if (koda.charAt(0) === "P") return "cena";
    if (["S", "Q"].includes(koda.charAt(0))) return "obseg";
    if (koda.charAt(0) === "T") return "placilo";
    if (["C", "K"].includes(koda.charAt(0))) return "pogodba";
    if (koda.charAt(0) === "G") return "garancija";
    if (koda.charAt(0) === "R") return "tveganja";
    return "obseg";
  }

  function ponudbaKarticaIkona(koda) {
    const skupina = koda.charAt(0);
    if (skupina === "P") return '<svg viewBox="0 0 24 24"><path d="M20 12 12 20 4 12V4h8l8 8Z"/><path d="M8 8h.01"/></svg>';
    if (["S", "Q"].includes(skupina)) return '<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>';
    if (skupina === "T") return '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>';
    if (["C", "K"].includes(skupina)) return '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>';
    if (skupina === "G") return '<svg viewBox="0 0 24 24"><path d="M12 3 14 5l3-.2.8 2.9L20 10l-2.2 2.3.2 3-3 .7-2 2.2-2-2.2-3-.7.2-3L6 10l2.2-2.3.8-2.9 3 .2 2-2Z"/><path d="m9 10 2 2 4-4"/></svg>';
    if (skupina === "R") return '<svg viewBox="0 0 24 24"><path d="M10.3 3.8 2.5 17.3A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.7L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>';
    return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>';
  }

  function ponudbaVprasanje(modul) {
    return modul.question || modul.label;
  }

  function pripraviPonudbaKarticeVpogled() {
    if (!ponudbaEngine || !ponudbaKarticeVpogled || ponudbaKarticeVpogled.children.length) return;
    ponudbaKarticeVpogled.innerHTML = ponudbaEngine.modules.map(function (modul) {
      const schema = ponudbaEngine.sestavi({
        profileId: Number(ponudbaProfil.value) || null,
        offerModelIds: ponudbaModel.value ? [Number(ponudbaModel.value)] : [],
        salesChannelIds: ponudbaKanal.value ? [Number(ponudbaKanal.value)] : [],
        moduleIds: [modul.id]
      });
      const prikazanModul = schema.modules[0] || Object.assign({}, modul, { fields: [] });
      const kartica = atenaCardSchema && atenaCardSchema.getCard ? atenaCardSchema.getCard(aktivnaStoritevKoda, modul.id) : null;
      const obogatenaPolja = atenaCardSchema && atenaCardSchema.decorateFields ? atenaCardSchema.decorateFields(prikazanModul.fields) : prikazanModul.fields;
      const vsebina = prikazanModul.fields.length && atenaCardRenderer && atenaCardRenderer.moduleContentHtml
        ? atenaCardRenderer.moduleContentHtml(kartica, obogatenaPolja, ponudbaOsnutek.answers)
        : prikazanModul.fields.length ? ponudbaPoljaRazpored(prikazanModul.fields) : ponudbaPosebniModulHtml(prikazanModul);
      return '<article class="ponudba-kartica-polna ponudba-kartica-polna--' + ponudbaKarticaRazred(modul.code) + '" data-ponudba-kartica-id="' + pobegniHtml(modul.code) + '">' +
        '<header class="ponudba-kartica-polna__glava">' +
          '<span class="ponudba-kartica-polna__ikona" aria-hidden="true">' + ponudbaKarticaIkona(modul.code) + '</span>' +
          '<span class="ponudba-kartica-polna__naslov"><strong>' + pobegniHtml(ponudbaVprasanje(modul)) + '</strong><small>' + pobegniHtml(modul.description) + '</small></span>' +
          '<button type="button" class="ponudba-kartica-polna__spremeni">Spremeni</button>' +
          '<button type="button" class="ponudba-kartica-polna__zapri" aria-label="Odstrani ' + pobegniHtml(modul.code) + '">×</button>' +
        '</header>' +
        '<div class="ponudba-kartica-polna__polja">' + vsebina + '</div>' +
        '<footer class="ponudba-kartica-polna__noga"><button type="button">Spremeni opis</button><button type="button">Naprej</button></footer>' +
      '</article>';
    }).join("");
  }

  function trenutnaPonudbaShema() {
    if (!ponudbaEngine || !ponudbaAktivniModulId) return null;
    return ponudbaEngine.sestavi({ profileId: Number(ponudbaProfil.value) || null, offerModelIds: ponudbaModel.value ? [Number(ponudbaModel.value)] : [], salesChannelIds: ponudbaKanal.value ? [Number(ponudbaKanal.value)] : [], moduleIds: [ponudbaAktivniModulId] });
  }

  function ponudbaModulPoId(id) {
    return ponudbaEngine && ponudbaEngine.modules.find(function (modul) { return modul.id === id; });
  }

  function prilagodiVisinoPonudbaTextarea(control) {
    if (!control || !control.matches("textarea[data-ponudba-samorastoci]")) return;
    control.style.height = "auto";
    control.style.height = Math.max(36, control.scrollHeight) + "px";
  }

  function osveziVisinePonudbaTextarea() {
    if (!ponudbaObrazecPolja) return;
    ponudbaObrazecPolja.querySelectorAll("textarea[data-ponudba-samorastoci]").forEach(prilagodiVisinoPonudbaTextarea);
  }

  function izrisiPonudbaKorake() {
    if (!ponudbaKoraki) return;
    const skupnoKorakov = ponudbaAktivniModuli.length;
    const trenutniKorak = ponudbaPotrditevAktivna ? skupnoKorakov : Math.min(ponudbaKorakIndex + 1, skupnoKorakov);
    const napredekStopinje = Math.round((trenutniKorak / skupnoKorakov) * 360);
    ponudbaKoraki.hidden = false;
    ponudbaKoraki.style.setProperty("--ponudba-napredek", napredekStopinje + "deg");
    ponudbaKoraki.setAttribute("role", "progressbar");
    ponudbaKoraki.setAttribute("aria-valuemin", "1");
    ponudbaKoraki.setAttribute("aria-valuemax", String(skupnoKorakov));
    ponudbaKoraki.setAttribute("aria-valuenow", String(trenutniKorak));
    ponudbaKoraki.setAttribute("aria-label", "Korak " + trenutniKorak + " od " + skupnoKorakov);
    ponudbaKoraki.innerHTML = '<span class="ponudba-obrazec__korak-stevec"><strong>' + trenutniKorak + '</strong><small>/' + skupnoKorakov + '</small></span>';
  }

  function ponudbaPotrditevPodrocjaHtml() {
    const area = ponudbaPodrocje(ponudbaAktivnoPodrocje);
    const izvornaAktivnaPolja = ponudbaEngine.fields.filter(function (field) { return ponudbaAktivniModuli.includes(field.moduleId); });
    const aktivnaPolja = atenaCardSchema && atenaCardSchema.decorateFields ? atenaCardSchema.decorateFields(izvornaAktivnaPolja) : izvornaAktivnaPolja;
    const odgovorPolja = aktivnaPolja.filter(function (field) { return varnoBesedilo(ponudbaOsnutek.answers && ponudbaOsnutek.answers[field.id]); });

    function vrednostZaPregled(field) {
      const vrednost = varnoBesedilo(ponudbaOsnutek.answers && ponudbaOsnutek.answers[field.id]);
      if (!vrednost) return "";
      if (atenaCardRenderer && atenaCardRenderer.displayValue) return atenaCardRenderer.displayValue(field, vrednost);
      if (field.type === "select") {
        const moznost = (field.options || []).find(function (option) { return String(option.id) === vrednost; });
        return moznost ? moznost.label : vrednost;
      }
      if (field.type === "money") {
        const znesek = ponudbaEvrskiZnesek(vrednost);
        if (znesek !== null) return new Intl.NumberFormat("sl-SI", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(znesek) + " €";
      }
      return vrednost;
    }

    const osnovnoPolje = aktivnaPolja.find(function (field) { return field.id === 5101; });
    const ddvPolje = aktivnaPolja.find(function (field) { return field.id === 5102; });
    const ponavljajocePolje = aktivnaPolja.find(function (field) { return field.id === 5106; });
    const porabaPolje = aktivnaPolja.find(function (field) { return field.id === 5108; });
    const osnovnoBesedilo = osnovnoPolje ? varnoBesedilo(ponudbaOsnutek.answers[osnovnoPolje.id]) : "";
    const osnovnaCena = ponudbaEvrskiZnesek(osnovnoBesedilo);
    const ddv = ddvPolje ? vrednostZaPregled(ddvPolje) : "";
    const ponavljajoci = ponavljajocePolje ? vrednostZaPregled(ponavljajocePolje) : "";
    const poraba = porabaPolje ? vrednostZaPregled(porabaPolje) : "";
    const doplacila = aktivnaPolja.filter(function (field) { return PONUDBA_DOPLACILO_POLJA.includes(field.id); }).map(function (field) {
      const opis = varnoBesedilo(ponudbaOsnutek.answers[field.id]);
      return opis ? { field: field, opis: opis, znesek: ponudbaEvrskiZnesek(opis) } : null;
    }).filter(Boolean);
    const znanaDoplacila = doplacila.filter(function (postavka) { return postavka.znesek !== null; });
    const doplacilaSkupaj = znanaDoplacila.reduce(function (vsota, postavka) { return vsota + postavka.znesek; }, 0);
    const skupaj = osnovnaCena === null || znanaDoplacila.length !== doplacila.length ? null : osnovnaCena + doplacilaSkupaj;
    const denar = function (znesek) { return new Intl.NumberFormat("sl-SI", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(znesek) + " €"; };

    function cenovniPovzetekHtml() {
      if (!osnovnoBesedilo && !ddv && !ponavljajoci && !poraba && !doplacila.length) return "";
      const koncniZnesek = skupaj !== null
        ? denar(skupaj)
        : (osnovnaCena !== null && !doplacila.length
          ? denar(osnovnaCena)
          : (osnovnoPolje ? vrednostZaPregled(osnovnoPolje) : osnovnoBesedilo));
      const cenaOznaka = skupaj !== null || (osnovnaCena !== null && !doplacila.length)
        ? "Skupaj enkratno"
        : "Enkratna cena";
      const cenaOpis = doplacila.length
        ? (znanaDoplacila.length === doplacila.length
          ? "Osnovna cena in " + doplacila.length + (doplacila.length === 1 ? " doplačilo" : " doplačila")
          : "Del doplačil nima navedene cene")
        : "Brez dodatnih enkratnih stroškov";
      const znacke = [];
      if (ddv) znacke.push('<span>DDV: ' + pobegniHtml(ddv) + '</span>');
      znacke.push('<span>' + ponudbaAktivniModuli.length + '/' + ponudbaAktivniModuli.length + '</span>');
      return '<section class="ponudba-pregled__cene" data-ponudba-potrditev-cene>' +
        '<div class="ponudba-pregled__cena-glava"><div><small>' + cenaOznaka + '</small><strong data-fit-text data-fit-text-min="12">' + pobegniHtml(koncniZnesek || "Cena ni navedena") + '</strong><p>' + pobegniHtml(cenaOpis) + '</p></div><div class="ponudba-pregled__cena-znacke">' + znacke.join("") + '</div></div>' +
        ((ponavljajoci || poraba) ? '<p class="ponudba-pregled__cena-opomba">Redni stroški in cena po porabi so prikazani pri pripadajočem koraku.</p>' : '') +
      '</section>';
    }

    function koncniIzracunHtml() {
      if (!doplacila.length) return "";
      const osnovnaVrednost = osnovnaCena !== null ? denar(osnovnaCena) : (osnovnoBesedilo || "Cena ni navedena");
      const vrstice = '<p><span>Osnovna cena</span><strong>' + pobegniHtml(osnovnaVrednost) + '</strong></p>' + doplacila.map(function (postavka) {
        return '<p><span>' + pobegniHtml(postavka.field.label) + '</span><strong>' + pobegniHtml(postavka.znesek !== null ? '+' + denar(postavka.znesek) : 'Cena ni navedena') + '</strong></p>';
      }).join("");
      const znesek = skupaj !== null ? denar(skupaj) : "Cena še ni dokončna";
      const opomba = skupaj !== null
        ? "Vključena so vsa navedena enkratna doplačila."
        : "Končni znesek se izračuna, ko bodo navedene vse cene doplačil.";
      return '<section class="ponudba-pregled__izracun" data-ponudba-koncni-izracun>' +
        '<header><span aria-hidden="true">+€</span><div><small>Doplačila</small><strong>Končni izračun</strong></div></header>' +
        '<div class="ponudba-pregled__izracun-vrstice">' + vrstice + '</div>' +
        '<footer><div><small>Skupaj enkratno</small><strong data-fit-text data-fit-text-min="11">' + pobegniHtml(znesek) + '</strong></div><p>' + pobegniHtml(opomba) + '</p></footer>' +
      '</section>';
    }

    const moduli = ponudbaAktivniModuli.map(function (id, index) {
      const modul = ponudbaModulPoId(id);
      if (!modul) return "";
      const vrednosti = aktivnaPolja.filter(function (field) { return field.moduleId === id; }).map(function (field) {
        const vrednost = vrednostZaPregled(field);
        return vrednost ? { label: field.label, vrednost: vrednost, field: field } : null;
      }).filter(Boolean);
      const glavna = vrednosti[0] || null;
      const hiterPovzetek = vrednosti[1] || null;
      const podrobnosti = vrednosti.slice(2);
      const doplacilaModula = vrednosti.filter(function (postavka) { return PONUDBA_DOPLACILO_POLJA.includes(postavka.field.id); });
      const znanaDoplacilaModula = doplacilaModula.map(function (postavka) { return ponudbaEvrskiZnesek(postavka.vrednost); }).filter(function (znesek) { return znesek !== null; });
      const doplaciloModula = znanaDoplacilaModula.reduce(function (vsota, znesek) { return vsota + znesek; }, 0);
      const doplaciloZnacka = doplacilaModula.length
        ? '<b class="ponudba-pregled__doplacilo-znacka">' + (znanaDoplacilaModula.length === doplacilaModula.length ? '+' + pobegniHtml(new Intl.NumberFormat("sl-SI", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(doplaciloModula)) + ' €' : 'Doplačilo') + '</b>'
        : '';
      const podrobnostiHtml = podrobnosti.length ? '<details class="ponudba-pregled__podrobnosti"><summary>Prikaži še ' + podrobnosti.length + (podrobnosti.length === 1 ? ' podatek' : ' podatke') + '</summary><div>' + podrobnosti.map(function (postavka) {
        return '<p><span>' + pobegniHtml(postavka.label) + '</span><strong data-fit-text data-fit-text-min="9">' + pobegniHtml(postavka.vrednost) + '</strong></p>';
      }).join("") + '</div></details>' : '';
      return '<article class="ponudba-pregled__vprasanje">' +
        '<span class="ponudba-pregled__stevilka" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></span>' +
        '<div class="ponudba-pregled__vprasanje-telo"><header><small>' + (index + 1) + ' · ' + pobegniHtml(modul.label) + '</small><span>' + doplaciloZnacka + '<button type="button" data-ponudba-potrditev-uredi-index="' + index + '">Spremeni</button></span></header>' +
        (glavna ? '<strong class="ponudba-pregled__glavna-vrednost" data-fit-text data-fit-text-min="11">' + pobegniHtml(glavna.vrednost) + '</strong><p class="ponudba-pregled__glavni-opis">' + pobegniHtml(glavna.label) + (hiterPovzetek ? ' · ' + pobegniHtml(hiterPovzetek.label) + ': ' + pobegniHtml(hiterPovzetek.vrednost) : '') + '</p>' : '<p class="ponudba-pregled__brez-vrednosti">Podatki so potrjeni v tem koraku.</p>') +
        podrobnostiHtml + '</div>' +
      '</article>';
    }).join("");

    return '<div class="ponudba-pregled ponudba-obrazec__polje--polno" data-ponudba-potrditev-pregled>' +
      cenovniPovzetekHtml() +
      '<section class="ponudba-pregled__casovnica" aria-label="' + pobegniHtml(area ? area.label : aktivnaStoritevMeta.summaryTitle) + '">' + moduli + '</section>' +
      '<section class="ponudba-pregled__zakljucek"><span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></span><div><strong>Vsi podatki so pregledani</strong><p>' + odgovorPolja.length + (odgovorPolja.length === 1 ? ' odgovor je pripravljen' : ' odgovorov je pripravljenih') + ' za potrditev.</p></div></section>' +
      koncniIzracunHtml() +
    '</div>';
  }

  function izrisiPonudbaPolja() {
    if (ponudbaObrazec) ponudbaObrazec.toggleAttribute("data-ponudba-potrditev", ponudbaPotrditevAktivna);
    if (ponudbaPotrditevAktivna) {
      ponudbaAktivniModulId = null;
      ponudbaObrazecNaslov.textContent = "Preglejte in potrdite";
      if (ponudbaObrazecOpis) ponudbaObrazecOpis.textContent = "Preverite ključne podatke. Vsak korak lahko še spremenite.";
      if (ponudbaObrazecIkona) ponudbaObrazecIkona.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>';
      if (ponudbaAtenaPovzetek) ponudbaAtenaPovzetek.innerHTML = ponudbaAtenaPovzetekHtml();
      ponudbaObrazecPolja.innerHTML = '<section class="ponudba-obrazec__modul" aria-label="Potrdite področje"><div class="ponudba-obrazec__modul-polja">' + ponudbaPotrditevPodrocjaHtml() + '</div></section>';
      izrisiPonudbaObrazecPodrocja();
      izrisiPonudbaKorake();
      if (ponudbaShrani) ponudbaShrani.textContent = ponudbaAktivnoPodrocje === "vse" ? "Potrdi vse" : "Potrdi področje";
      const ponudbaNazajPotrditev = document.querySelector("[data-ponudba-obrazec-preklici]");
      if (ponudbaNazajPotrditev) ponudbaNazajPotrditev.textContent = "Nazaj";
      ponudbaObrazecPolja.scrollTop = 0;
      return;
    }
    const schema = trenutnaPonudbaShema(); if (!schema || !ponudbaObrazecPolja) return;
    const modul = schema.modules[0]; if (!modul) return;
    const vprasanje = ponudbaVprasanje(modul);
    const naslovKartice = "Dopolnite " + (ponudbaKorakIndex + 1) + "/" + ponudbaAktivniModuli.length + " · " + modul.label;
    ponudbaObrazecNaslov.textContent = naslovKartice;
    if (ponudbaObrazecOpis) ponudbaObrazecOpis.textContent = "Vsi manjkajoči podatki tega vprašanja so združeni tukaj.";
    if (ponudbaObrazecIkona) ponudbaObrazecIkona.innerHTML = ponudbaKarticaIkona(modul.code);
    const kartica = atenaCardSchema && atenaCardSchema.getCard ? atenaCardSchema.getCard(aktivnaStoritevKoda, modul.id) : null;
    const obogatenaPolja = atenaCardSchema && atenaCardSchema.decorateFields ? atenaCardSchema.decorateFields(modul.fields) : modul.fields;
    const vsebina = modul.fields.length && atenaCardRenderer && atenaCardRenderer.moduleContentHtml
      ? atenaCardRenderer.moduleContentHtml(kartica, obogatenaPolja, ponudbaOsnutek.answers)
      : modul.fields.length ? ponudbaPoljaRazpored(modul.fields) : ponudbaPosebniModulHtml(modul);
    if (ponudbaAtenaPovzetek) ponudbaAtenaPovzetek.innerHTML = ponudbaAtenaPovzetekHtml();
    ponudbaObrazecPolja.innerHTML = atenaCardRenderer && atenaCardRenderer.questionShellHtml
      ? atenaCardRenderer.questionShellHtml({ ariaLabel:vprasanje, iconHtml:ponudbaKarticaIkona(modul.code), title:modul.label, description:"Vsi manjkajoči podatki tega vprašanja so združeni tukaj.", question:vprasanje, step:ponudbaKorakIndex + 1, total:ponudbaAktivniModuli.length, contentHtml:vsebina })
      : '<section class="ponudba-obrazec__modul" aria-label="' + pobegniHtml(vprasanje) + '"><div class="ponudba-obrazec__modul-polja">' + vsebina + '</div></section>';
    if (atenaCardRenderer && atenaCardRenderer.hydrate) atenaCardRenderer.hydrate(ponudbaObrazecPolja);
    window.requestAnimationFrame(osveziVisinePonudbaTextarea);
    izrisiPonudbaObrazecPodrocja();
    izrisiPonudbaKorake();
    if (ponudbaShrani) ponudbaShrani.textContent = "Naprej";
    const ponudbaNazaj = document.querySelector("[data-ponudba-obrazec-preklici]");
    if (ponudbaNazaj) ponudbaNazaj.textContent = ponudbaKorakIndex ? "Nazaj" : "Zapri";
    ponudbaObrazecPolja.scrollTop = 0;
  }

  function zapriPonudbaObrazec(vrniFokus) {
    if (!ponudbaObrazec || ponudbaObrazec.hidden) return false;
    ponudbaObrazec.hidden = true; document.body.classList.remove("is-ponudba-obrazec-odprt", "uj-modal-odprt");
    delete ponudbaObrazec.dataset.ponudbaObrazecPodrocje;
    if (vrniFokus && ponudbaPrejsnjiFokus) ponudbaPrejsnjiFokus.focus({ preventScroll: true });
    ponudbaAktivniModulId = null; ponudbaAktivnoPodrocje = null; ponudbaAktivniModuli = []; ponudbaKorakIndex = 0; ponudbaPotrditevAktivna = false; ponudbaRazsirjenoVprasanjeIndex = null; return true;
  }

  function odpriPonudbaObrazec(gumb) {
    if (!ponudbaEngine || !ponudbaObrazec) return;
    pripraviPonudbaKatalog();
    ponudbaAktivnoPodrocje = gumb.hasAttribute("data-ponudba-vse") ? "vse" : gumb.dataset.ponudbaPodrocje;
    ponudbaObrazec.dataset.ponudbaObrazecPodrocje = ponudbaAktivnoPodrocje;
    const area = ponudbaAktivnoPodrocje === "vse" ? null : ponudbaPodrocje(ponudbaAktivnoPodrocje);
    ponudbaAktivniModuli = area ? area.moduleIds.slice() : ponudbaVsiModuli();
    ponudbaKorakIndex = 0;
    ponudbaPotrditevAktivna = false;
    ponudbaRazsirjenoVprasanjeIndex = null;
    ponudbaAktivniModulId = ponudbaAktivniModuli[0]; ponudbaPrejsnjiFokus = gumb;
    if (ponudbaKontekst) ponudbaKontekst.hidden = true;
    if (ponudbaKontekstPreklop) ponudbaKontekstPreklop.setAttribute("aria-expanded", "false");
    ponudbaProfil.value = ponudbaOsnutek.profileId ? String(ponudbaOsnutek.profileId) : "";
    ponudbaModel.value = ponudbaOsnutek.offerModelIds[0] ? String(ponudbaOsnutek.offerModelIds[0]) : "";
    ponudbaKanal.value = ponudbaOsnutek.salesChannelIds[0] ? String(ponudbaOsnutek.salesChannelIds[0]) : "";
    izrisiPonudbaPolja(); ponudbaObrazec.hidden = false; document.body.classList.add("is-ponudba-obrazec-odprt", "uj-modal-odprt");
    osveziVisinePonudbaTextarea();
    const prvi = ponudbaObrazecPolja.querySelector("select, input, textarea, button"); if (prvi) prvi.focus({ preventScroll: true });
  }

  function shraniPonudbaKorak(preveri) {
    if (!ponudbaObrazecPolja) return false;
    if (preveri && atenaCardRenderer && atenaCardRenderer.validate && !atenaCardRenderer.validate(ponudbaObrazecPolja)) return false;
    if (preveri && !ponudbaObrazecPolja.reportValidity()) return false;
    ponudbaOsnutek.profileId = Number(ponudbaProfil.value) || null;
    ponudbaOsnutek.offerModelIds = ponudbaModel.value ? [Number(ponudbaModel.value)] : [];
    ponudbaOsnutek.salesChannelIds = ponudbaKanal.value ? [Number(ponudbaKanal.value)] : [];
    const vrednosti = atenaCardRenderer && atenaCardRenderer.collectValues
      ? atenaCardRenderer.collectValues(ponudbaObrazecPolja)
      : Object.fromEntries(Array.from(ponudbaObrazecPolja.querySelectorAll("[data-ponudba-field]")).map(function (control) { return [control.dataset.ponudbaField, control.value]; }));
    const trenutnaShema = trenutnaPonudbaShema();
    const prikazanaPolja = trenutnaShema && trenutnaShema.modules[0] ? trenutnaShema.modules[0].fields : [];
    prikazanaPolja.forEach(function (field) {
      const value = varnoBesedilo(vrednosti[field.id]);
      if (value) ponudbaOsnutek.answers[field.id] = value;
      else delete ponudbaOsnutek.answers[field.id];
    });
    if (preveri && ponudbaAktivniModulId && !ponudbaOsnutek.completedModuleIds.includes(ponudbaAktivniModulId)) ponudbaOsnutek.completedModuleIds.push(ponudbaAktivniModulId);
    shraniPonudbaOsnutek();
    return true;
  }

  function premakniPonudbaKorak(smer) {
    if (ponudbaPotrditevAktivna) {
      if (smer >= 0) return false;
      ponudbaRazsirjenoVprasanjeIndex = null;
      ponudbaPotrditevAktivna = false;
      ponudbaKorakIndex = ponudbaAktivniModuli.length - 1;
      ponudbaAktivniModulId = ponudbaAktivniModuli[ponudbaKorakIndex];
      izrisiPonudbaPolja();
      return true;
    }
    if (smer > 0 && ponudbaKorakIndex === ponudbaAktivniModuli.length - 1) {
      if (!shraniPonudbaKorak(true)) return false;
      ponudbaRazsirjenoVprasanjeIndex = null;
      ponudbaPotrditevAktivna = true;
      izrisiPonudbaPolja();
      return true;
    }
    const noviIndex = ponudbaKorakIndex + smer;
    if (noviIndex < 0 || noviIndex >= ponudbaAktivniModuli.length) return false;
    if (smer > 0 && !shraniPonudbaKorak(true)) return false;
    if (smer < 0) shraniPonudbaKorak(false);
    ponudbaRazsirjenoVprasanjeIndex = null;
    ponudbaKorakIndex = noviIndex;
    ponudbaAktivniModulId = ponudbaAktivniModuli[ponudbaKorakIndex];
    ponudbaObrazecPolja.dataset.smer = smer > 0 ? "naprej" : "nazaj";
    izrisiPonudbaPolja();
    window.setTimeout(function () { if (ponudbaObrazecPolja) delete ponudbaObrazecPolja.dataset.smer; }, 220);
    const prvi = ponudbaObrazecPolja.querySelector("select, input, textarea, button");
    if (prvi) prvi.focus({ preventScroll: true });
    return true;
  }

  function zakljuciPonudbaObrazec() {
    if (!ponudbaPotrditevAktivna) return;
    ponudbaModulGumbi.forEach(function (gumb) { gumb.setAttribute("aria-pressed", jePodrocjeKoncano(gumb.dataset.ponudbaPodrocje) ? "true" : "false"); });
    const shranjeno = document.querySelector("[data-ponudba-shranjeno]");
    if (shranjeno) { shranjeno.hidden = false; shranjeno.textContent = "1 zahtevek shranjen"; }
    posodobiIzbraneModule();
    zapriPonudbaObrazec(true);
  }

  function jePodrocjeKoncano(koda) {
    const area = ponudbaPodrocje(koda);
    return Boolean(area && area.moduleIds.every(function (id) { return ponudbaOsnutek.completedModuleIds.includes(id); }));
  }

  function predlogiBesedilo(stevilo) {
    if (stevilo === 1) return "1 predlog";
    if (stevilo === 2) return "2 predloga";
    if (stevilo === 3 || stevilo === 4) return stevilo + " predlogi";
    return stevilo + " predlogov";
  }

  function ponudbaStatusPodrocja(koda) {
    const area = ponudbaPodrocje(koda);
    if (!area) return { stanje: "open", besedilo: "" };
    const besedilo = predlogiBesedilo(area.moduleIds.length);
    if (!ponudbaOsnutek.reviewReady) return { stanje: "open", besedilo: besedilo };
    const koncani = area.moduleIds.filter(function (id) { return ponudbaOsnutek.completedModuleIds.includes(id); }).length;
    if (!koncani) return { stanje: "open", besedilo: besedilo };
    if (koncani === area.moduleIds.length) return { stanje: "success", besedilo: besedilo };
    return { stanje: "warning", besedilo: besedilo };
  }

  function posodobiPonudbaPovzetek() {
    const ponudbaNacin = document.body.classList.contains("is-ponudba-mode");
    const pripravljen = ponudbaNacin && Boolean(ponudbaOsnutek.reviewReady);
    const predlaganiGumb = pripravljen ? ponudbaModulGumbi.find(function (gumb) {
      return !jePodrocjeKoncano(gumb.dataset.ponudbaPodrocje);
    }) : null;
    document.body.classList.toggle("is-ponudba-povzetek", pripravljen);
    if (ponudbaNacin) {
      if (atenaNaslov) atenaNaslov.textContent = pripravljen ? aktivnaStoritevMeta.summaryTitle : aktivnaStoritevMeta.title;
      if (atenaPodnaslov) atenaPodnaslov.textContent = pripravljen ? "Atena je pripravila notranji pregled za vašo potrditev." : aktivnaStoritevMeta.intro;
      if (atenaPrimarniBesedilo) atenaPrimarniBesedilo.textContent = pripravljen ? "Posodobi pregled" : aktivnaStoritevMeta.primary;
      if (ponudbaKarticeGumb) ponudbaKarticeGumb.textContent = pripravljen ? "Tapnite kartico" : "Kartice";
    }
    ponudbaModulGumbi.forEach(function (gumb) {
      const stanje = ponudbaStatusPodrocja(gumb.dataset.ponudbaPodrocje);
      const oznaka = gumb.querySelector("[data-ponudba-modul-status]");
      gumb.dataset.ponudbaStatus = stanje.stanje;
      gumb.dataset.ponudbaPredlagano = gumb === predlaganiGumb ? "true" : "false";
      if (oznaka) oznaka.textContent = stanje.besedilo;
    });
  }

  function posodobiIzbraneModule() {
    const izbrani = ponudbaModulGumbi.filter(function (gumb) { return gumb.getAttribute("aria-pressed") === "true"; });
    if (ponudbaVse) ponudbaVse.setAttribute("aria-pressed", ponudbaVsiModuli().every(function (id) { return ponudbaOsnutek.completedModuleIds.includes(id); }) ? "true" : "false");
    if (ponudbaModuliStatus) ponudbaModuliStatus.textContent = izbrani.length
      ? "Izbrano: " + izbrani.map(function (gumb) { return gumb.querySelector("strong").textContent; }).join(", ") + "."
      : aktivnaStoritevMeta.status;
    posodobiPonudbaPovzetek();
  }

  function poveziPonudbaPodrocja() {
    ponudbaModulGumbi.forEach(function (gumb) {
      if (gumb.dataset.ponudbaPovezano === "true") return;
      gumb.dataset.ponudbaPovezano = "true";
      gumb.addEventListener("click", function () { odpriPonudbaObrazec(gumb); });
    });
  }

  poveziPonudbaPodrocja();

  if (ponudbaEngine) {
    pripraviPonudbaKatalog();
    ponudbaModulGumbi.forEach(function (gumb) { gumb.setAttribute("aria-pressed", jePodrocjeKoncano(gumb.dataset.ponudbaPodrocje) ? "true" : "false"); });
    posodobiIzbraneModule();
  }

  if (ponudbaKarticeGumb && ponudbaKarticeVpogled && ponudbaPodrocja) ponudbaKarticeGumb.addEventListener("click", function () {
    pripraviPonudbaKarticeVpogled();
    const odprto = ponudbaKarticeVpogled.hidden;
    ponudbaKarticeVpogled.hidden = !odprto;
    ponudbaPodrocja.hidden = odprto;
    ponudbaKarticeGumb.setAttribute("aria-expanded", odprto ? "true" : "false");
    ponudbaKarticeGumb.classList.toggle("is-active", odprto);
    if (ponudbaModuliStatus) ponudbaModuliStatus.textContent = odprto
      ? "Začasni pregled vseh " + ponudbaEngine.modules.length + " kartic."
      : aktivnaStoritevMeta.status;
  });

  [ponudbaProfil, ponudbaModel, ponudbaKanal].forEach(function (select) { if (select) select.addEventListener("change", function () { shraniPonudbaKorak(false); izrisiPonudbaPolja(); }); });
  document.querySelectorAll("[data-ponudba-obrazec-zapri]").forEach(function (gumb) { gumb.addEventListener("click", function () { zapriPonudbaObrazec(true); }); });
  const ponudbaNazaj = document.querySelector("[data-ponudba-obrazec-preklici]");
  if (ponudbaNazaj) ponudbaNazaj.addEventListener("click", function () {
    if (ponudbaPotrditevAktivna || ponudbaKorakIndex > 0) premakniPonudbaKorak(-1);
    else zapriPonudbaObrazec(true);
  });
  if (ponudbaKoraki) ponudbaKoraki.addEventListener("click", function (dogodek) {
    const potrditev = dogodek.target.closest("[data-ponudba-potrditev-korak]");
    if (potrditev && !potrditev.disabled) {
      ponudbaPotrditevAktivna = true;
      izrisiPonudbaPolja();
      return;
    }
    const gumb = dogodek.target.closest("[data-ponudba-korak-index]"); if (!gumb || gumb.disabled) return;
    const ciljniIndex = Number(gumb.dataset.ponudbaKorakIndex);
    if (!ponudbaPotrditevAktivna && ciljniIndex === ponudbaKorakIndex) return;
    if (ciljniIndex > ponudbaKorakIndex && !ponudbaOsnutek.completedModuleIds.includes(ponudbaAktivniModuli[ciljniIndex])) return;
    shraniPonudbaKorak(false); ponudbaPotrditevAktivna = false; ponudbaKorakIndex = ciljniIndex; ponudbaAktivniModulId = ponudbaAktivniModuli[ciljniIndex]; izrisiPonudbaPolja();
  });
  if (ponudbaObrazecPodrocja) ponudbaObrazecPodrocja.addEventListener("click", function (dogodek) {
    const gumb = dogodek.target.closest("[data-ponudba-vprasanje-index]");
    if (!gumb) return;
    const ciljniIndex = Number(gumb.dataset.ponudbaVprasanjeIndex);
    const seZapira = ponudbaRazsirjenoVprasanjeIndex === ciljniIndex;
    ponudbaRazsirjenoVprasanjeIndex = seZapira ? null : ciljniIndex;
    if (seZapira || ciljniIndex === ponudbaKorakIndex) {
      izrisiPonudbaObrazecPodrocja();
      return;
    }
    shraniPonudbaKorak(false);
    ponudbaPotrditevAktivna = false;
    ponudbaKorakIndex = ciljniIndex;
    ponudbaAktivniModulId = ponudbaAktivniModuli[ciljniIndex];
    izrisiPonudbaPolja();
  });
  if (ponudbaKontekstPreklop && ponudbaKontekst) ponudbaKontekstPreklop.addEventListener("click", function () {
    ponudbaKontekst.hidden = !ponudbaKontekst.hidden; ponudbaKontekstPreklop.setAttribute("aria-expanded", ponudbaKontekst.hidden ? "false" : "true");
  });
  if (ponudbaObrazec) ponudbaObrazec.addEventListener("click", function (dogodek) { if (dogodek.target === ponudbaObrazec) zapriPonudbaObrazec(true); });
  document.addEventListener("keydown", function (dogodek) { if (dogodek.key === "Escape" && ponudbaObrazec && !ponudbaObrazec.hidden) { dogodek.preventDefault(); zapriPonudbaObrazec(true); } });
  const ponudbaShrani = document.querySelector("[data-ponudba-obrazec-shrani]");
  if (ponudbaShrani) ponudbaShrani.addEventListener("click", function () {
    if (ponudbaPotrditevAktivna) zakljuciPonudbaObrazec();
    else premakniPonudbaKorak(1);
  });
  if (ponudbaObrazecPolja) {
    ponudbaObrazecPolja.addEventListener("click", function (dogodek) {
      const spremeniVprasanje = dogodek.target.closest("[data-atena-question-change]");
      if (spremeniVprasanje) {
        const prviVnos = ponudbaObrazecPolja.querySelector(".ponudba-obrazec__modul-polja input:not([type=hidden]):not([disabled]), .ponudba-obrazec__modul-polja textarea:not([disabled]), .ponudba-obrazec__modul-polja select:not([disabled]), .ponudba-obrazec__modul-polja button:not([disabled])");
        if (prviVnos) {
          prviVnos.focus({ preventScroll: true });
          if (prviVnos.scrollIntoView) prviVnos.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        return;
      }
      if (atenaCardRenderer && atenaCardRenderer.handleClick && atenaCardRenderer.handleClick(dogodek, ponudbaObrazecPolja)) {
        if (PONUDBA_DOPLACILO_POLJA.includes(Number(dogodek.target.closest("[data-atena-field-root]") && dogodek.target.closest("[data-atena-field-root]").dataset.atenaFieldId))) izrisiPonudbaObrazecPodrocja();
        return;
      }
      const gumb = dogodek.target.closest("[data-ponudba-potrditev-uredi-index]");
      if (!gumb) return;
      const ciljniIndex = Number(gumb.dataset.ponudbaPotrditevUrediIndex);
      if (!Number.isInteger(ciljniIndex) || !ponudbaAktivniModuli[ciljniIndex]) return;
      ponudbaPotrditevAktivna = false;
      ponudbaRazsirjenoVprasanjeIndex = ciljniIndex;
      ponudbaKorakIndex = ciljniIndex;
      ponudbaAktivniModulId = ponudbaAktivniModuli[ciljniIndex];
      izrisiPonudbaPolja();
    });
    ponudbaObrazecPolja.addEventListener("input", function (dogodek) {
      if (atenaCardRenderer && atenaCardRenderer.handleInput) atenaCardRenderer.handleInput(dogodek, ponudbaObrazecPolja);
      prilagodiVisinoPonudbaTextarea(dogodek.target);
      if (PONUDBA_DOPLACILO_POLJA.includes(Number(dogodek.target.dataset.ponudbaField))) izrisiPonudbaObrazecPodrocja();
    });
    ponudbaObrazecPolja.addEventListener("change", function (dogodek) {
      if (atenaCardRenderer && atenaCardRenderer.handleChange) atenaCardRenderer.handleChange(dogodek, ponudbaObrazecPolja);
    });
    ponudbaObrazecPolja.addEventListener("touchstart", function (dogodek) {
      if (dogodek.touches.length !== 1 || dogodek.target.closest("input, textarea, select, button, label")) { ponudbaDotikX = null; ponudbaDotikY = null; return; }
      ponudbaDotikX = dogodek.touches[0].clientX; ponudbaDotikY = dogodek.touches[0].clientY;
    }, { passive: true });
    ponudbaObrazecPolja.addEventListener("touchend", function (dogodek) {
      if (ponudbaDotikX == null || !dogodek.changedTouches.length) return;
      const dx = dogodek.changedTouches[0].clientX - ponudbaDotikX;
      const dy = dogodek.changedTouches[0].clientY - ponudbaDotikY;
      ponudbaDotikX = null; ponudbaDotikY = null;
      if (Math.abs(dx) < 55 || Math.abs(dx) <= Math.abs(dy) * 1.25) return;
      premakniPonudbaKorak(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  if (ponudbaVse) {
    ponudbaVse.addEventListener("click", function () {
      odpriPonudbaObrazec(ponudbaVse);
    });
  }

  document.querySelectorAll("[data-hiter-klic]").forEach(function (gumb) {
    gumb.addEventListener("click", function () {
      odpriPonudbaNacin("klic");
    });
  });

  const gumbDatoteka = document.querySelector("[data-dodaj-ponudbo]");
  if (gumbDatoteka && datoteka) {
    gumbDatoteka.addEventListener("click", function () {
      datoteka.click();
    });
    datoteka.addEventListener("change", function () {
      const izbrana = datoteka.files && datoteka.files[0];
      pokaziStatus(izbrana ? "Dodano: " + izbrana.name : "", false);
    });
  }

  if (gumbGlas) {
    gumbGlas.addEventListener("click", function () {
      try {
        const lokalniCanary = zagotoviSvetovalecCanary();
        if (lokalniCanary.isRecording()) {
          lokalniCanary.stop().catch(function (error) {
            pokaziStatus(error && error.message || "Prepisa ni bilo mogoče zaključiti.", true);
          });
        } else if (atenaSnemanjeAktivno) {
          atenaPrekinitevPoZagonu = true;
          posodobiAtenaSnemanjeUi();
        } else {
          const snemanjeZacetek = Date.now();
          atenaSnemanjeAktivno = true;
          atenaPrekinitevPoZagonu = false;
          posodobiAtenaSnemanjeUi();
          pokaziStatus("Odpiram mikrofon …", false);
          zacniAtenaRazsiritev("is-recording", function () { return atenaSnemanjeAktivno; });
          lokalniCanary.start(opis ? opis.value : "").then(function () {
            if (atenaPrekinitevPoZagonu && lokalniCanary.isRecording()) return lokalniCanary.stop();
          }).catch(async function (error) {
            await pocakajNaAtenaOdzivSnemanja(snemanjeZacetek);
            atenaSnemanjeAktivno = false;
            atenaPrekinitevPoZagonu = false;
            atenaRavenGlasu = 0;
            posodobiAtenaSnemanjeUi();
            pokaziStatus(error && error.name === "NotAllowedError"
              ? "Dovoljenje za mikrofon je zavrnjeno."
              : error && error.message || "Lokalnega prepisa ni bilo mogoče začeti.", true);
          });
        }
      } catch (error) {
        pokaziStatus(error && error.message || "Lokalnega prepisa ni bilo mogoče začeti.", true);
      }
    });
  }

  if (gumbPreverba) {
    gumbPreverba.addEventListener("click", async function () {
      const imaOpis = Boolean(opis && opis.value.trim());
      const imaDatoteko = Boolean(datoteka && datoteka.files && datoteka.files.length);
      if (!imaOpis && !imaDatoteko) {
        pokaziStatus("Opišite, kaj potrebujete, ali dodajte ponudbo.", true);
        if (opis) opis.focus();
        return;
      }
      const mirujoceBesedilo = atenaPrimarniBesedilo ? atenaPrimarniBesedilo.textContent : "Začni preverbo";
      const ponudbaNacinObZagonu = document.body.classList.contains("is-ponudba-mode");
      const opisObZagonu = varnoBesedilo(opis && opis.value);
      const storitevKodaObZagonu = aktivnaStoritevKoda;
      let koncnoBesedilo = mirujoceBesedilo;
      const analizaZacetek = zacniAtenaAnalizo();
      try {
        await pocakajNaAtenaRazsiritev(analizaZacetek);
        if (ponudbaNacinObZagonu) {
        ponudbaOsnutek.sourceText = opisObZagonu;
        shraniPonudbaOsnutek();
        if (ponudbaEngine && opisObZagonu && !ponudbaOsnutek.profileId) {
          const plan = ponudbaEngine.poisciProfile(opisObZagonu, 1)[0];
          if (plan) ponudbaOsnutek.profileId = plan.id;
        }
        ponudbaOsnutek.reviewReady = true;
        shraniPonudbaOsnutek();
        posodobiPonudbaPovzetek();
        koncnoBesedilo = atenaPrimarniBesedilo ? atenaPrimarniBesedilo.textContent : "Posodobi pregled";
        const atenaPredlaganaPodrocja = izrisiAtenaPredloge(ponudbaOsnutek.sourceText, storitevKodaObZagonu);
        const izbraniModuli = ponudbaModulGumbi.filter(function (gumb) { return gumb.getAttribute("aria-pressed") === "true"; }).length;
        pokaziStatus(atenaPredlaganaPodrocja.length
          ? "Atena je predlagala " + atenaPredlaganaPodrocja.length + " najpomembnejša področja. Vsa področja ostajajo spodaj."
          : izbraniModuli
            ? "Opis in izbrana področja so pripravljeni za Atenine korake."
            : "Opis je pripravljen. Atena bo iz njega določila področja pregleda.", false);
        } else {
          pokaziStatus("Primer je pripravljen za naslednji korak in človeški pregled.", false);
        }
      } catch (error) {
        pokaziStatus(error && error.message || "Preverbe trenutno ni bilo mogoče pripraviti.", true);
      } finally {
        koncajAtenaAnalizo(koncnoBesedilo);
      }
    });
  }

  window.addEventListener("pagehide", function () {
    ustaviAtenaAnalizaStatus();
    atenaAnalizaAktivna = false;
    atenaPrekinitevPoZagonu = false;
    nastaviAtenaKontekstZaklep(false);
  });
})();
