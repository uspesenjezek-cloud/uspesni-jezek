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
  const atenaPogovor = document.querySelector("[data-atena-pogovor]");
  const atenaPogovorGlava = document.querySelector("[data-atena-pogovor-glava]");
  const atenaPogovorPonastavi = document.querySelector("[data-atena-pogovor-ponastavi]");
  const atenaPogovorPreklop = document.querySelector("[data-atena-pogovor-preklop]");
  const atenaPogovorPreklopBesedilo = document.querySelector("[data-atena-pogovor-preklop-besedilo]");
  const atenaKoraki = document.querySelector("[data-atena-koraki]");
  const atenaKorakiStevec = document.querySelector("[data-atena-koraki-stevec]");
  const atenaKorakiNaslov = document.querySelector("[data-atena-koraki-naslov]");
  const atenaKorakiKrogi = document.querySelector("[data-atena-koraki-krogi]");
  const atenaPrimarniBesedilo = document.querySelector("[data-atena-primarni-besedilo]");
  const ATENA_ANALIZA_STATUS_BESEDILA = [
    "Berem vaš opis …",
    "Preverjam dokument …",
    "Iščem ključne pogoje …",
    "Razvrščam področja …",
    "Pripravljam pregled …",
  ];
  let svetovalecCanary = null;
  let atenaSnemanjeCilj = opis;
  let atenaSnemanjeAktivno = false;
  let atenaPrekinitevPoZagonu = false;
  let atenaRavenGlasu = 0;
  let atenaAnalizaAktivna = false;
  let atenaAnalizaStatusCasovnik = 0;
  let atenaAnalizaStatusKorak = 0;
  let atenaKontekstZaklepAktiven = false;
  let atenaKontekstZaklepStanja = [];
  const atenaPogovornaSporocila = [];
  let atenaPogovorTipkanje = null;
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
  const atenaCardCombinationsEngine = window.UJAtenaCardCombinationsEngine || null;
  const atenaCardCombinations = window.UJAtenaCardCombinations || null;
  const atenaCardCombinationsAdapter = window.UJAtenaCardCombinationsAdapter || null;
  const svetovalecAtenaEngine = window.UJSvetovalecAtenaEngine || null;
  const svetovalecClarificationEngine = window.UJSvetovalecClarificationEngine || null;
  const svetovalecConversationFlow = window.UJSvetovalecConversationFlow || null;
  const atenaPredlogi = document.querySelector("[data-atena-predlogi]");
  const lunaKarticePoStoritvi = new Map();
  let lunaKarticeFacts = [];
  let lunaKarticeSourceText = "";
  let lunaVprasanjaAktivna = false;
  let atenaPojasniloOdgovor = null;
  let atenaConversationFlow = null;
  let atenaSklopZahtevaAktivna = false;
  const ATENA_FLOW_STORAGE_KEY = "uj_atena_svetovalec_conversation_flow_v2";
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
  const ponudbaPodjetje = document.querySelector("[data-ponudba-podjetje]");
  const ponudbaPodjetjeIme = document.querySelector("[data-ponudba-podjetje-ime]");
  const ponudbaKorakiOpis = document.querySelector("[data-ponudba-koraki-opis]");
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
  const podjetjePopup = document.createElement("dialog");
  podjetjePopup.className = "podjetje-popup";
  podjetjePopup.setAttribute("aria-labelledby", "podjetje-obrazec-naslov");
  if (podjetjeObrazec) {
    document.body.append(podjetjePopup);
    podjetjePopup.append(podjetjeObrazec);
    const innerModal = document.querySelector(".podjetje-modal");
    if (innerModal) podjetjePopup.append(innerModal);
    podjetjePopup.addEventListener("cancel", e => { e.preventDefault(); zapriPodjetjeObrazec(); });
  }

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

  if (svetovalecAtenaEngine) {
    const registerRezultat = svetovalecAtenaEngine.stamp(document);
    if (!svetovalecAtenaEngine.idValidation.valid || registerRezultat.missing) {
      console.warn("[svetovalec-atena-register]", JSON.stringify({ idValidation: svetovalecAtenaEngine.idValidation, stamp: registerRezultat }));
    }
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
    osveziPonudbaPodjetje(null);
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
    podjetje = window.UJCompanyContact.save(podjetje);
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
      element.closest(".podjetje-povzetek__vrstica")?.classList.toggle("is-filled", Boolean(vrednost));
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
      gumb.setAttribute("role", "checkbox");
      gumb.setAttribute("aria-checked", zacasnaIzbira.split(" · ").includes(moznost) ? "true" : "false");
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
        const izbor=zacasnaIzbira.split(" · ").filter(Boolean);
        const i=izbor.indexOf(moznost);if(i<0)izbor.push(moznost);else izbor.splice(i,1);
        zacasnaIzbira=izbor.join(" · ");
        gumb.setAttribute("aria-checked",String(i<0));
      });
      modalMoznosti.appendChild(gumb);
    });
  }

  podjetjeModal.querySelector('[data-dejstva-preklic]').addEventListener('click',()=>zapriModal(true));
  podjetjeModal.querySelector('[data-dejstva-shrani]').addEventListener('click',()=>{
    const known=IZBIRE[odprtaIzbira].moznosti;
    const selected=zacasnaIzbira.split(' · ').filter(v=>known.includes(v));
    const own=podjetjeModal.querySelector('[data-dejstva-lastno]').value.trim();
    if(own)selected.push(own);
    odgovori[odprtaIzbira]=selected.join(' · ');osveziPovzetke();zapriModal(true);
  });
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
    podjetjeObrazec.append(podjetjeModal);
    podjetjeObrazec.style.position='relative';
    fokusPredModalom = sprozilec || document.activeElement;
    odprtaIzbira = vrsta;
    zacasnaIzbira = odgovori[vrsta] || "";
    if (modalNaslov) modalNaslov.textContent = nastavitev.naslov;
    if (modalPomoc) modalPomoc.textContent = nastavitev.pomoc;
    if (modalIkona) modalIkona.innerHTML = nastavitev.ikona;
    izrisiModalneMoznosti();
    const own=podjetjeModal.querySelector('[data-dejstva-lastno]');
    const known=nastavitev.moznosti;
    own.value=zacasnaIzbira.split(' · ').filter(v=>v&&!known.includes(v)).join(' · ');
    podjetjeModal.hidden = false;
    podjetjeModal.removeAttribute('style');
    const formRect=podjetjeObrazec.getBoundingClientRect();
    const anchorRect=sprozilec.getBoundingClientRect();
    const panelBottom=anchorRect.top-formRect.top-6;
    const available=Math.max(180,anchorRect.top-Math.max(formRect.top,12)-12);
    podjetjeModal.style.setProperty('position','absolute','important');
    podjetjeModal.style.setProperty('inset','auto 0 auto 0','important');
    podjetjeModal.style.height='auto';
    podjetjeModal.style.maxHeight='none';
    const panelHeight=Math.ceil(podjetjeModal.getBoundingClientRect().height);
    podjetjeModal.style.setProperty('top',Math.max(0,panelBottom-panelHeight)+'px','important');
    podjetjeModal.style.zIndex='30';
    podjetjeModal.style.transformOrigin='bottom center';
    podjetjeModal.style.boxShadow='0 -6px 22px rgba(35,80,73,.18)';
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      podjetjeModal.animate([{clipPath:'inset(100% 0 0 0)',opacity:0},{clipPath:'inset(0 0 0 0)',opacity:1}],{duration:240,easing:'ease-out'});
    }
    if (podjetjeObrazec) podjetjeObrazec.style.marginBottom = "";
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
    const podatki = window.UJCompanyContact.full(podjetje || window.UJCompanyContact.active());
    if (podjetjeIme) podjetjeIme.value = varnoBesedilo(podatki.name);
    ["phone","email","website"].forEach(key=>{document.querySelector("[data-podjetje-"+key+"]").value=varnoBesedilo(podatki[key]);});
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
    if (!podjetjePopup.open) podjetjePopup.showModal();
    document.body.classList.add("is-podjetje-obrazec-open");
    izrisiDejavnosti();
    izrisiPredlogeDejavnosti("");
    osveziPovzetke();
    podjetjeIme?.focus({ preventScroll: true });
  }

  function zapriPodjetjeObrazec() {
    if (!podjetjeObrazec || podjetjeObrazec.hidden) return false;
    zapriModal(false);
    podjetjeObrazec.hidden = true;
    podjetjePopup.close();
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
    podjetje = window.UJCompanyContact.full(podjetje);
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

  function osveziPonudbaPodjetje(podjetje) {
    const ime = varnoBesedilo(podjetje && podjetje.name);
    if (ponudbaPodjetje) ponudbaPodjetje.hidden = !ime;
    if (!ponudbaPodjetjeIme) return;
    ponudbaPodjetjeIme.textContent = ime;
    if (ime && window.UJPrilagodiVelikostBesedila) window.UJPrilagodiVelikostBesedila(ponudbaPodjetjeIme);
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
    osveziPonudbaPodjetje(podjetje);
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

  let skupniImenik = null;
  let imenikLoading = null;
  async function odpriIzbirnik() {
    const button = companySearchRow.querySelector("button");
    if (imenikLoading) return;
    button.disabled = true;
    imenikLoading = (async () => {
      if (!skupniImenik) {
        const response = await fetch("neplacila.html", {signal:AbortSignal.timeout(10000)});
        if (!response.ok) throw new Error("Imenika ni mogoče odpreti.");
        const source = new DOMParser().parseFromString(await response.text(), "text/html");
        const sheet = source.getElementById("podjetja-sheet");
        if (!sheet || !window.UJNedavnaPodjetja) throw new Error("Imenika ni mogoče odpreti.");
        const host = document.createElement("div"); host.hidden = true;
        host.innerHTML = '<div id="nedavna-podjetja"><div id="nedavna-podjetja-trak"></div><button id="nedavna-podjetja-vec" type="button"></button></div>';
        sheet.classList.add("scit-imenik");
        const subtitle = sheet.querySelector(".ocena-sheet__podnaslov"); if (subtitle) subtitle.hidden = true;
        document.body.append(host, sheet);
        skupniImenik = window.UJNedavnaPodjetja.init(document, window, {
          allowEmpty:true, contactOnly:true, storagePrefix:"uj_scit_podjetja_", eventPrefix:"uj:scit:",
          onEdit(company) { odpriPodjetjeObrazec(company); },
          onSelect(company) {
            nastaviAktivnoPodjetje(company);
            companySearch.value = company.name;
            zapriIzbirnik();
            companySearch.focus({preventScroll:true});
          }
        });
      }
      skupniImenik.refresh([]);
      skupniImenik.open();
    })();
    try { await imenikLoading; }
    catch (error) { if (podjetjaStanje) podjetjaStanje.textContent = error.message; }
    finally { imenikLoading = null; button.disabled = false; }
  }

  const companySwitch = document.createElement("div");
  companySwitch.className = "svetovalec-contact-switch";
  companySwitch.innerHTML = '<button type="button" aria-pressed="true">Imenik</button><button type="button" aria-pressed="false">Dodaj novo</button>';
  const companySearchRow = document.createElement("div");
  companySearchRow.className = "svetovalec-contact-search";
  companySearchRow.innerHTML = '<svg class="svetovalec-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="12" cy="9" r="2.5"/><path d="M8 17c.7-2 2-3 4-3s3.3 1 4 3"/></svg><input type="search" placeholder="Išči podjetje" aria-label="Išči podjetje" autocomplete="off"><button type="button">Odpri imenik</button>';
  const companySearch = companySearchRow.querySelector("input");
  const quickCompanies = document.createElement("div"); quickCompanies.className = "svetovalec-contact-results"; quickCompanies.hidden = true;
  companySearchRow.append(quickCompanies);
  podjetjaSklop.prepend(companySwitch, companySearchRow);
  companySwitch.children[0].onclick = () => { zapriPodjetjeObrazec(); companySearch.focus(); };
  companySwitch.children[1].onclick = () => { companySwitch.classList.add("je-novo"); companySwitch.children[0].setAttribute("aria-pressed","false"); companySwitch.children[1].setAttribute("aria-pressed","true"); odpriPodjetjeObrazec(null); };
  podjetjePopup.addEventListener("close", () => { companySwitch.classList.remove("je-novo"); companySwitch.children[0].setAttribute("aria-pressed","true"); companySwitch.children[1].setAttribute("aria-pressed","false"); companySearch.value = trenutnoPodjetje().name || ""; });
  companySearchRow.querySelector("button").onclick = () => { quickCompanies.hidden = true; odpriIzbirnik(); };
  function renderQuickCompanies() {
    const query = companySearch.value.trim().toLocaleLowerCase("sl");
    quickCompanies.replaceChildren(); quickCompanies.hidden = !query;
    if (!query) return;
    const matches = razpolozljivaPodjetja.filter(c => c.name.toLocaleLowerCase("sl").includes(query)).slice(0,8);
    matches.forEach(company => {
      const button = document.createElement("button"); button.type = "button"; button.textContent = company.name;
      button.onclick = () => { nastaviAktivnoPodjetje(company); companySearch.value = company.name; quickCompanies.hidden = true; };
      quickCompanies.append(button);
    });
    if (!matches.length) { const text = document.createElement("p"); text.textContent = "Ni zadetkov."; quickCompanies.append(text); }
  }
  companySearch.addEventListener("input", () => { renderQuickCompanies(); naloziPodjetja().then(renderQuickCompanies); });
  document.addEventListener("click", e => { if (!companySearchRow.contains(e.target)) quickCompanies.hidden = true; });
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
        phone: document.querySelector("[data-podjetje-phone]").value.trim(),
        email: document.querySelector("[data-podjetje-email]").value.trim(),
        website: document.querySelector("[data-podjetje-website]").value.trim(),
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
    document.querySelectorAll("[data-ponudba-atena-glas]").forEach(function (gumb) {
      const modalAktiven = aktivno && atenaSnemanjeCilj && atenaSnemanjeCilj.matches("[data-ponudba-atena-opis]");
      gumb.classList.toggle("is-recording", modalAktiven);
      gumb.setAttribute("aria-pressed", String(modalAktiven));
      gumb.setAttribute("aria-label", modalAktiven ? "Prekini snemanje" : "Povej na glas");
      gumb.disabled = atenaAnalizaAktivna || atenaPrekinitevPoZagonu;
      const napis = gumb.querySelector("span");
      if (napis) napis.textContent = modalAktiven ? "Ustavi" : "Povej";
    });
    if (!aktivno) posodobiAtenaGlasnost(0);
  }

  function pomakniAtenaPogovorNaKonec() {
    if (!atenaPogovor) return;
    window.requestAnimationFrame(function () {
      atenaPogovor.scrollTop = atenaPogovor.scrollHeight;
    });
  }

  function odpriAtenaPogovor() {
    if (!atenaPogovor) return;
    atenaPogovor.hidden = false;
    if (atenaPogovorGlava) atenaPogovorGlava.hidden = false;
    document.body.classList.add("has-atena-pogovor");
    if (opis) opis.placeholder = "Napišite nadaljevanje …";
  }

  function nastaviAtenaPogovorStrnjen(strnjen) {
    const jeStrnjen = Boolean(strnjen);
    document.body.classList.toggle("is-atena-pogovor-strnjen", jeStrnjen);
    if (atenaPogovorPreklop) {
      atenaPogovorPreklop.setAttribute("aria-expanded", String(!jeStrnjen));
      atenaPogovorPreklop.setAttribute("aria-label", jeStrnjen ? "Razširi pogovor" : "Skrči pogovor");
    }
    if (atenaPogovorPreklopBesedilo) atenaPogovorPreklopBesedilo.textContent = jeStrnjen ? "Prikaži" : "Skrči";
    if (!jeStrnjen) pomakniAtenaPogovorNaKonec();
  }

  function ponastaviAtenaPogovor() {
    atenaConversationFlow = null;
    atenaPojasniloOdgovor = null;
    atenaPogovornaSporocila.length = 0;
    skrijAtenaTipkanje();
    shraniAtenaConversationFlow();
    pocistiAtenaPredloge();
    pocistiLunaKartice();
    if (atenaPogovor) { atenaPogovor.innerHTML = ""; atenaPogovor.hidden = true; }
    if (atenaPogovorGlava) atenaPogovorGlava.hidden = true;
    if (atenaKoraki) atenaKoraki.hidden = true;
    document.body.classList.remove("has-atena-pogovor", "has-atena-guided-flow", "is-atena-flow-draft", "is-atena-pogovor-strnjen");
    if (opis) { opis.value = ""; opis.placeholder = "Vprašajte Ateno …"; }
    if (gumbPreverba) gumbPreverba.disabled = false;
    if (atenaPrimarniBesedilo) atenaPrimarniBesedilo.textContent = "Poizveduj";
    pokaziStatus("", false);
    window.requestAnimationFrame(prilagodiVisinoAtenaDoma);
  }

  function dodajAtenaPogovornoSporocilo(vloga, besedilo, shrani) {
    const vsebina = varnoBesedilo(besedilo);
    if (!atenaPogovor || !vsebina) return null;
    odpriAtenaPogovor();
    const sporocilo = document.createElement("p");
    sporocilo.className = "svetovalec-atena-pogovor__sporocilo svetovalec-atena-pogovor__sporocilo--" + vloga;
    sporocilo.textContent = vsebina;
    atenaPogovor.appendChild(sporocilo);
    if (shrani !== false) atenaPogovornaSporocila.push({ vloga: vloga, besedilo: vsebina });
    pomakniAtenaPogovorNaKonec();
    return sporocilo;
  }

  function shraniAtenaPogovorniFallback(pojasnilo, sourceText) {
    if (!pojasnilo || pojasnilo.mode !== "conversation") return;
    try {
      const key = "uj_atena_svetovalec_fallbacks_v1";
      const obstojeci = JSON.parse(window.localStorage.getItem(key) || "[]");
      const vrstice = Array.isArray(obstojeci) ? obstojeci.slice(-199) : [];
      vrstice.push({
        id: "svetovalec-fallback-" + Date.now().toString(36),
        recordedAt: new Date().toISOString(),
        flow: "svetovalec",
        engineVersion: svetovalecClarificationEngine && svetovalecClarificationEngine.version || "unknown",
        sourceText: varnoBesedilo(sourceText).slice(0, 1200),
        question: pojasnilo.question,
        evidence: pojasnilo.evidence || "",
        status: "unreviewed",
      });
      window.localStorage.setItem(key, JSON.stringify(vrstice));
    } catch (_error) {
      // Zasebni način lahko blokira localStorage; pogovor zato ne sme odpovedati.
    }
  }

  function dodajAtenaPojasnilniWidget(pojasnilo, sourceText, options) {
    const nastavitve = options || {};
    const normalized = nastavitve.definition ? { definition:nastavitve.definition } : svetovalecClarificationEngine && svetovalecClarificationEngine.normalize
      ? svetovalecClarificationEngine.normalize(pojasnilo, sourceText || sestaviAtenaPogovorniVir())
      : null;
    const definition = normalized && normalized.definition;
    if (!atenaPogovor || !definition) return null;
    odpriAtenaPogovor();
    const kartica = document.createElement("section");
    kartica.className = "svetovalec-atena-mini-widget";
    kartica.dataset.atenaInterfaceId = definition.interfaceId;
    kartica.dataset.atenaContextVersion = definition.contextVersion;
    kartica.dataset.atenaWidgetId = definition.widgetInterfaceId;
    kartica.dataset.templateCard = definition.widgetId;
    kartica.setAttribute("aria-label", definition.question);
    const vprasanje = document.createElement("strong");
    vprasanje.textContent = definition.question;
    const izbire = document.createElement("div");
    izbire.className = "svetovalec-atena-mini-widget__izbire";
    izbire.setAttribute("role", "group");
    izbire.setAttribute("aria-label", definition.question);
    const jeVecIzbir = definition.selectionMode === "multiple";
    const izbraniOptionIds = new Set(Array.isArray(nastavitve.selectedOptionIds) ? nastavitve.selectedOptionIds : []);
    kartica.dataset.selectionMode = jeVecIzbir ? "multiple" : "single";
    let potrdi = null;
    function oddajPojasnilo(optionIds, focusTarget) {
      const odgovor = svetovalecClarificationEngine.answer(definition.id, optionIds);
      if (!odgovor) return;
      if (typeof nastavitve.onAnswer === "function") {
        nastavitve.onAnswer(odgovor);
        if (focusTarget) focusTarget.blur();
        return;
      }
      atenaPojasniloOdgovor = odgovor;
      kartica.classList.add("is-answered");
      izbire.querySelectorAll("button").forEach(function (candidate) { candidate.disabled = true; });
      if (potrdi) potrdi.disabled = true;
      if (opis) {
        opis.value = odgovor.answerText;
        opis.dispatchEvent(new Event("input", { bubbles:true }));
      }
      window.requestAnimationFrame(function () { if (gumbPreverba) gumbPreverba.click(); });
      if (focusTarget) focusTarget.blur();
    }
    definition.options.forEach(function (option) {
      const gumb = document.createElement("button");
      gumb.type = "button";
      gumb.textContent = option.label;
      gumb.dataset.atenaClarificationOption = option.id;
      gumb.setAttribute("aria-pressed", String(izbraniOptionIds.has(option.id)));
      gumb.addEventListener("click", function () {
        if (jeVecIzbir) {
          if (izbraniOptionIds.has(option.id)) izbraniOptionIds.delete(option.id);
          else izbraniOptionIds.add(option.id);
          gumb.setAttribute("aria-pressed", String(izbraniOptionIds.has(option.id)));
          if (potrdi) potrdi.disabled = izbraniOptionIds.size === 0;
          return;
        }
        gumb.setAttribute("aria-pressed", "true");
        oddajPojasnilo(option.id, gumb);
      });
      izbire.appendChild(gumb);
    });
    kartica.appendChild(vprasanje);
    kartica.appendChild(izbire);
    if (jeVecIzbir) {
      potrdi = document.createElement("button");
      potrdi.type = "button";
      potrdi.className = "svetovalec-atena-mini-widget__potrdi";
      potrdi.textContent = nastavitve.selectedOptionIds && nastavitve.selectedOptionIds.length ? "Posodobi izbor" : "Izberi";
      potrdi.disabled = izbraniOptionIds.size === 0;
      potrdi.addEventListener("click", function () { oddajPojasnilo(Array.from(izbraniOptionIds), potrdi); });
      kartica.appendChild(potrdi);
    }
    atenaPogovor.appendChild(kartica);
    if (nastavitve.preserveTop) {
      window.requestAnimationFrame(function () { atenaPogovor.scrollTop = 0; });
    } else pomakniAtenaPogovorNaKonec();
    if (jeVecIzbir && !nastavitve.preserveTop) {
      window.requestAnimationFrame(function () {
        atenaPogovor.scrollTop = Math.max(0, kartica.offsetTop - atenaPogovor.offsetTop - 4);
      });
    }
    return kartica;
  }

  function shraniAtenaConversationFlow() {
    if (!svetovalecConversationFlow) return;
    try {
      if (atenaConversationFlow) window.localStorage.setItem(ATENA_FLOW_STORAGE_KEY, svetovalecConversationFlow.serialize ? svetovalecConversationFlow.serialize(atenaConversationFlow) : JSON.stringify(atenaConversationFlow));
      else window.localStorage.removeItem(ATENA_FLOW_STORAGE_KEY);
    } catch (_error) {}
  }

  function nastaviAtenaFlowPrimarniGumb() {
    if (!atenaPrimarniBesedilo || !atenaConversationFlow) return;
    atenaPrimarniBesedilo.textContent = atenaConversationFlow.status === "preview" ? "Potrdi in nadaljuj" : atenaConversationFlow.status === "ready" ? "Poglej predogled" : atenaConversationFlow.status === "replanning" || atenaConversationFlow.status === "batch-ready" ? "Pripravljam naslednji sklop …" : "Odgovorite zgoraj";
    if (gumbPreverba) gumbPreverba.disabled = ["draft","batch-ready","replanning"].includes(atenaConversationFlow.status);
  }

  function izrisiAtenaFlowKorake() {
    if (!atenaConversationFlow || !atenaKoraki || !atenaKorakiKrogi) return;
    atenaKoraki.hidden = false;
    const sections = atenaConversationFlow.sections || [];
    const sectionIndex = Math.max(0, sections.findIndex(function (section) { return section.id === atenaConversationFlow.activeSectionId; }));
    const section = sections[sectionIndex] || { label:"Pogovor", questionIds:atenaConversationFlow.planIds };
    const ids = section.questionIds || [];
    const activeId = atenaConversationFlow.activeQuestionId || atenaConversationFlow.planIds[atenaConversationFlow.activeStepIndex];
    const active = Math.max(0, ids.indexOf(activeId));
    const definition = atenaConversationFlow.questionById && atenaConversationFlow.questionById[activeId];
    if (atenaKorakiStevec) atenaKorakiStevec.textContent = "Sklop " + (sectionIndex + 1) + " od " + sections.length + " · " + section.label;
    if (atenaKorakiNaslov) atenaKorakiNaslov.textContent = "Korak " + (active + 1) + " od " + ids.length;
    atenaKorakiKrogi.innerHTML = "";
    ids.forEach(function (id, index) {
      const answered = Boolean(atenaConversationFlow.answersByQuestionId && atenaConversationFlow.answersByQuestionId[id]);
      const button = document.createElement("button");
      button.type = "button";
      button.className = (answered ? "is-complete " : "") + (index === active ? "is-active" : "");
      button.disabled = !answered && index !== active;
      button.setAttribute("aria-label", "Korak " + (index + 1) + (answered ? ", odgovor shranjen" : ""));
      if (index === active) button.setAttribute("aria-current", "step");
      button.innerHTML = "<span>" + (index + 1) + "</span>";
      button.addEventListener("click", function () {
        const next = svetovalecConversationFlow.goToQuestion(atenaConversationFlow, id);
        if (!next) return;
        atenaConversationFlow = next;
        shraniAtenaConversationFlow();
        izrisiAtenaConversationFlow();
      });
      atenaKorakiKrogi.appendChild(button);
    });
  }

  const ATENA_VODENI_RENDERERJI = Object.freeze({
    "mreza-izbir":"grid", "hierarhicni-izbor":"tags", "iskalni-izbirnik":"search", "dvojni-segment":"segments", "da-ne-ne-vem":"segments", "navpicni-izbor":"vertical",
    "izbirnik-oznak":"tags", "drsnik-razpona":"slider", "matrika-tveganja":"risk", "kontrolni-seznam-dokazil":"evidence",
    "odlocitvena-pot":"path", "primerjava-moznosti":"comparison", "ciljni-pas":"target-band", "pogajalski-prostor":"negotiation",
    "razvrscanje-prioritet":"ranking", "cenovni-most":"price-bridge", "skupine-odstopanj":"deviations", "sprememba-in-potrditev":"review",
    "kolicina-in-enota":"quantity", "natancen-znesek":"money", "datum-z-gotovostjo":"date", "besedilni-vnos":"text", "dokazilo":"text"
  });

  function izrisiAtenaVodenoVprasanje(question, answer) {
    const kartica = document.createElement("section");
    const renderer = ATENA_VODENI_RENDERERJI[question.widgetId];
    if (!renderer) throw new Error("Manjka namenski renderer za Nazorjevin widget: " + question.widgetId);
    kartica.className = "svetovalec-atena-mini-widget svetovalec-atena-mini-widget--vodeno";
    kartica.classList.add("svetovalec-atena-mini-widget--" + renderer);
    if (answer) kartica.classList.add("is-answered");
    if (question.id === atenaConversationFlow.activeQuestionId) {
      kartica.classList.add("is-active-question");
      kartica.setAttribute("aria-current", "step");
    }
    kartica.dataset.atenaQuestionId = question.id;
    kartica.dataset.atenaInterfaceId = question.interfaceId || "atena:card:svetovalec:" + question.id;
    kartica.dataset.atenaContextVersion = question.contextVersion || "atena-interface-context-v2";
    kartica.dataset.atenaWidgetId = "atena:widget:" + question.widgetId;
    kartica.dataset.templateCard = question.widgetId;
    kartica.dataset.atenaRenderer = renderer;
    kartica.dataset.selectionMode = question.kind === "multiple" ? "multiple" : "single";
    kartica.dataset.answerCount = String(question.options.length);
    kartica.dataset.cardLayout = question.layoutVariant || "choice-" + question.options.length;
    kartica.dataset.atenaContext = JSON.stringify(question.context || {});
    const naslov = document.createElement("strong");
    naslov.textContent = question.question;
    kartica.appendChild(naslov);
    const freeMode = atenaConversationFlow.inputModeByQuestionId && atenaConversationFlow.inputModeByQuestionId[question.id] === "free-text";
    if (freeMode) {
      const textarea = document.createElement("textarea");
      textarea.className = "svetovalec-atena-mini-widget__lastni-vnos";
      textarea.placeholder = "Napišite svoj odgovor …";
      textarea.value = answer && answer.source === "free-text" ? answer.rawText : "";
      textarea.dataset.atenaInterfaceId = "atena:field:svetovalec:" + question.id + ":answer";
      const akcije = document.createElement("div"); akcije.className = "svetovalec-atena-mini-widget__akcije";
      const nazaj = document.createElement("button"); nazaj.type = "button"; nazaj.textContent = "Nazaj na izbire";
      nazaj.addEventListener("click", function () { atenaConversationFlow = svetovalecConversationFlow.closeFreeText(atenaConversationFlow, question.id); izrisiAtenaConversationFlow(); });
      const shrani = document.createElement("button"); shrani.type = "button"; shrani.className = "is-primary"; shrani.textContent = "Shrani odgovor";
      shrani.addEventListener("click", function () {
        const next = svetovalecConversationFlow.answerQuestion(atenaConversationFlow, question.id, { source:"free-text", rawText:textarea.value });
        if (!next) { textarea.focus(); return; }
        atenaConversationFlow = next; shraniAtenaConversationFlow(); izrisiAtenaConversationFlow(); nadaljujAtenaPoSklopu();
      });
      akcije.appendChild(nazaj); akcije.appendChild(shrani); kartica.appendChild(textarea); kartica.appendChild(akcije);
    } else {
      const selected = new Set(answer && answer.source === "widget" ? answer.value : []);
      const izbire = document.createElement("div"); izbire.className = "svetovalec-atena-mini-widget__izbire svetovalec-atena-mini-widget__izbire--" + renderer; izbire.setAttribute("role","group");
      let potrdi = null;
      const shraniWidgetOdgovor = function (values) {
        const next = svetovalecConversationFlow.answerQuestion(atenaConversationFlow, question.id, { source:"widget", value:values });
        if (!next) return false;
        atenaConversationFlow = next; shraniAtenaConversationFlow(); izrisiAtenaConversationFlow(); nadaljujAtenaPoSklopu(); return true;
      };
      const narediIzbiro = function (option, index) {
        const button = document.createElement("button"); button.type = "button"; button.className = "svetovalec-atena-mini-widget__odgovor"; button.setAttribute("aria-pressed", String(selected.has(option.id)));
        button.dataset.atenaInterfaceId = "atena:field:svetovalec:" + question.id + ":answer:" + option.id;
        button.dataset.optionId = option.id;
        if (["path","price-bridge"].includes(renderer)) {
          const number = document.createElement("span"); number.className = "svetovalec-atena-option__number"; number.textContent = String(index + 1); button.appendChild(number);
        }
        if (["risk","evidence","deviations"].includes(renderer)) {
          const mark = document.createElement("span"); mark.className = "svetovalec-atena-option__mark"; mark.setAttribute("aria-hidden","true"); button.appendChild(mark);
        }
        const label = document.createElement("span"); label.className = "svetovalec-atena-option__label"; label.textContent = option.label; button.appendChild(label);
        button.addEventListener("click", function () {
          if (question.kind === "multiple") {
            const exclusive = Array.isArray(option.exclusiveWith) && option.exclusiveWith.includes("*");
            if (selected.has(option.id)) selected.delete(option.id);
            else if (exclusive) { selected.clear(); selected.add(option.id); }
            else { question.options.filter(function (candidate) { return Array.isArray(candidate.exclusiveWith) && candidate.exclusiveWith.includes("*"); }).forEach(function (candidate) { selected.delete(candidate.id); }); selected.add(option.id); }
            izbire.querySelectorAll(".svetovalec-atena-mini-widget__odgovor").forEach(function (candidate) { candidate.setAttribute("aria-pressed", String(selected.has(candidate.dataset.optionId))); });
            if (potrdi) potrdi.disabled = selected.size < Number(question.minSelections || 1);
            return;
          }
          selected.clear(); selected.add(option.id);
          izbire.querySelectorAll(".svetovalec-atena-mini-widget__odgovor").forEach(function (candidate) { candidate.setAttribute("aria-pressed", String(candidate.dataset.optionId === option.id)); });
          if (potrdi) potrdi.disabled = false;
        });
        return button;
      };
      if (renderer === "slider") {
        izbire.classList.add("svetovalec-atena-mini-widget__izbire--slider");
        const vrednost = document.createElement("output"); vrednost.className = "svetovalec-atena-slider__vrednost";
        const sliderSpec = question.sliderSpec || question.answerSpec || {};
        const sliderMin = Number(question.minValue == null ? (sliderSpec.min == null ? 1 : sliderSpec.min) : question.minValue);
        const sliderMax = Number(question.maxValue == null ? (sliderSpec.max == null ? 5 : sliderSpec.max) : question.maxValue);
        const sliderStep = Number(question.stepValue == null ? (sliderSpec.step == null ? 1 : sliderSpec.step) : question.stepValue);
        const sliderSuffix = question.valueSuffix || sliderSpec.suffix || "";
        const slider = document.createElement("input"); slider.type = "range"; slider.min = String(sliderMin); slider.max = String(sliderMax); slider.step = String(sliderStep); slider.value = selected.values().next().value || String(sliderMin);
        slider.dataset.atenaInterfaceId = "atena:field:svetovalec:" + question.id + ":answer";
        const izpisiSlider = function () { vrednost.value = slider.value; vrednost.textContent = slider.value + sliderSuffix; slider.setAttribute("aria-valuetext", slider.value + sliderSuffix); };
        slider.setAttribute("aria-label", question.question); izpisiSlider();
        const oznake = document.createElement("div"); oznake.className = "svetovalec-atena-slider__oznake";
        const minOznaka = document.createElement("span"); minOznaka.textContent = sliderSpec.minLabel || (sliderMin + sliderSuffix);
        const maxOznaka = document.createElement("span"); maxOznaka.textContent = sliderSpec.maxLabel || (sliderMax + sliderSuffix);
        oznake.appendChild(minOznaka); oznake.appendChild(maxOznaka);
        potrdi = document.createElement("button"); potrdi.type = "button"; potrdi.className = "svetovalec-atena-mini-widget__potrdi"; potrdi.textContent = answer ? "Posodobi oceno" : "Potrdi oceno"; potrdi.disabled = !answer && sliderSpec.requiresInteraction === true;
        slider.addEventListener("input", function () { izpisiSlider(); potrdi.disabled = false; });
        potrdi.addEventListener("click", function () { shraniWidgetOdgovor([slider.value]); });
        izbire.appendChild(vrednost); izbire.appendChild(slider); izbire.appendChild(oznake); kartica.appendChild(izbire); kartica.appendChild(potrdi);
      } else if (["quantity","money","date","text"].includes(renderer)) {
        const typed = document.createElement("label"); typed.className = "svetovalec-atena-typed svetovalec-atena-typed--" + renderer;
        const input = renderer === "text" ? document.createElement("textarea") : document.createElement("input"); input.dataset.atenaInterfaceId = "atena:field:svetovalec:" + question.id + ":answer";
        if (renderer !== "text") input.type = renderer === "date" ? "date" : renderer === "quantity" ? "number" : "text";
        if (renderer === "money") input.inputMode = "decimal";
        if (renderer === "quantity") { input.inputMode = "numeric"; input.min = String(question.minValue == null ? 1 : question.minValue); input.max = String(question.maxValue == null ? 999 : question.maxValue); }
        input.value = selected.values().next().value || "";
        input.placeholder = renderer === "money" ? "0,00" : renderer === "quantity" ? "0" : renderer === "text" ? "Napišite odgovor …" : "";
        typed.appendChild(input);
        let unitSelect = null;
        const units = question.answerSpec && Array.isArray(question.answerSpec.units) ? question.answerSpec.units : [];
        if (renderer === "quantity" && units.length) {
          unitSelect = document.createElement("select"); unitSelect.className = "svetovalec-atena-typed__unit"; unitSelect.setAttribute("aria-label", "Enota");
          units.forEach(function (unit) { const choice=document.createElement("option"); choice.value=unit; choice.textContent=unit === "days" ? "dni" : unit === "months" ? "mesecev" : unit; unitSelect.appendChild(choice); });
          if (answer && answer.value && answer.value[1]) unitSelect.value = answer.value[1]; typed.appendChild(unitSelect);
        }
        if (renderer === "money" || question.valueSuffix) { const suffix = document.createElement("span"); suffix.textContent = renderer === "money" ? "€ / mesec" : question.valueSuffix; typed.appendChild(suffix); }
        izbire.appendChild(typed); kartica.appendChild(izbire);
        potrdi = document.createElement("button"); potrdi.type="button"; potrdi.className="svetovalec-atena-mini-widget__potrdi"; potrdi.textContent=answer?"Posodobi odgovor":"Potrdi";
        const validate = function () { const raw=input.value.trim(); const normalized=raw.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", "."); const numeric=Number(normalized); potrdi.disabled=!raw||((renderer==="quantity"||renderer==="money")&&(!Number.isFinite(numeric)||numeric<Number(question.minValue==null?0:question.minValue)||numeric>Number(question.maxValue==null?Number.MAX_SAFE_INTEGER:question.maxValue))); };
        input.addEventListener("input",validate); potrdi.addEventListener("click",function(){if(!potrdi.disabled)shraniWidgetOdgovor(unitSelect?[input.value.trim(),unitSelect.value]:[input.value.trim()]);}); validate(); kartica.appendChild(potrdi);
      } else if (renderer === "target-band") {
        const vrednost = document.createElement("output"); vrednost.className = "svetovalec-atena-target__vrednost";
        const slider = document.createElement("input"); slider.type = "range"; slider.min = "0"; slider.max = String(Math.max(0, question.options.length - 1)); slider.step = "1";
        let targetIndex = Math.max(0, question.options.findIndex(function (item) { return selected.has(item.id); })); slider.value = String(targetIndex);
        slider.dataset.atenaInterfaceId = "atena:field:svetovalec:" + question.id + ":answer";
        const osvezi = function () { const option = question.options[Number(slider.value)] || question.options[0]; vrednost.value = option ? option.label : ""; vrednost.textContent = option ? option.label : ""; };
        slider.addEventListener("input", osvezi); osvezi(); izbire.appendChild(vrednost); izbire.appendChild(slider); kartica.appendChild(izbire);
        potrdi = document.createElement("button"); potrdi.type = "button"; potrdi.className = "svetovalec-atena-mini-widget__potrdi"; potrdi.textContent = answer ? "Posodobi cilj" : "Potrdi cilj";
        potrdi.addEventListener("click", function () { const option = question.options[Number(slider.value)] || question.options[0]; if (option) shraniWidgetOdgovor([option.id]); }); kartica.appendChild(potrdi);
      } else if (renderer === "search") {
        const search = document.createElement("input"); search.type = "search"; search.className = "svetovalec-atena-search"; search.placeholder = "Poiščite storitev ali področje …"; search.setAttribute("aria-label","Poiščite predmet preverjanja");
        const list = document.createElement("div"); list.className = "svetovalec-atena-search__results";
        question.options.forEach(function (option, index) { list.appendChild(narediIzbiro(option,index)); });
        search.addEventListener("input", function () { const needle = search.value.trim().toLocaleLowerCase("sl"); Array.from(list.children).forEach(function (button) { button.hidden = Boolean(needle) && !button.textContent.toLocaleLowerCase("sl").includes(needle); }); });
        izbire.appendChild(search); izbire.appendChild(list); kartica.appendChild(izbire);
        potrdi = document.createElement("button"); potrdi.type = "button"; potrdi.className = "svetovalec-atena-mini-widget__potrdi"; potrdi.textContent = answer ? "Posodobi izbor" : "Izberi"; potrdi.disabled = selected.size !== 1;
        potrdi.addEventListener("click", function () { shraniWidgetOdgovor(Array.from(selected)); }); kartica.appendChild(potrdi);
      } else if (renderer === "ranking") {
        const order = answer && answer.source === "widget" ? answer.value.slice() : [];
        const list = document.createElement("ol"); list.className = "svetovalec-atena-ranking";
        const repaint = function () {
          list.innerHTML = "";
          question.options.forEach(function (option) {
            const row = document.createElement("li"); const rank = order.indexOf(option.id); row.classList.toggle("is-selected",rank>=0);
            const choose = document.createElement("button"); choose.type="button"; choose.className="svetovalec-atena-ranking__choose"; choose.setAttribute("aria-pressed",String(rank>=0)); choose.textContent=(rank>=0?(rank+1)+". ":"")+option.label;
            choose.addEventListener("click",function(){const at=order.indexOf(option.id);if(at>=0)order.splice(at,1);else order.push(option.id);repaint();potrdi.disabled=order.length<Number(question.minSelections||1);}); row.appendChild(choose);
            if(rank>=0){const controls=document.createElement("span"); controls.className="svetovalec-atena-ranking__controls"; [["↑",-1,"Premakni navzgor"],["↓",1,"Premakni navzdol"]].forEach(function(spec){const move=document.createElement("button");move.type="button";move.textContent=spec[0];move.setAttribute("aria-label",spec[2]);move.disabled=rank+spec[1]<0||rank+spec[1]>=order.length;move.addEventListener("click",function(){const other=rank+spec[1],value=order[rank];order[rank]=order[other];order[other]=value;repaint();});controls.appendChild(move);});row.appendChild(controls);} list.appendChild(row);
          });
        };
        potrdi = document.createElement("button"); potrdi.type="button"; potrdi.className="svetovalec-atena-mini-widget__potrdi"; potrdi.textContent=answer?"Posodobi vrstni red":"Potrdi prioritete"; potrdi.disabled=order.length<Number(question.minSelections||1); potrdi.addEventListener("click",function(){shraniWidgetOdgovor(order.slice());});
        repaint(); izbire.appendChild(list); kartica.appendChild(izbire); kartica.appendChild(potrdi);
      } else {
        question.options.forEach(function (option) {
          izbire.appendChild(narediIzbiro(option, question.options.indexOf(option)));
        });
        kartica.appendChild(izbire);
        if (question.kind === "single") {
          potrdi = document.createElement("button"); potrdi.type = "button"; potrdi.className = "svetovalec-atena-mini-widget__potrdi"; potrdi.textContent = answer ? "Posodobi izbor" : "Izberi"; potrdi.disabled = selected.size !== 1;
          potrdi.addEventListener("click", function () { shraniWidgetOdgovor(Array.from(selected)); }); kartica.appendChild(potrdi);
        }
      }
      if (question.kind === "multiple" && renderer !== "ranking") {
        potrdi = document.createElement("button"); potrdi.type = "button"; potrdi.className = "svetovalec-atena-mini-widget__potrdi"; potrdi.textContent = answer ? "Posodobi izbor" : "Izberi"; potrdi.disabled = selected.size < Number(question.minSelections || 1);
        potrdi.addEventListener("click", function () { shraniWidgetOdgovor(Array.from(selected)); });
        kartica.appendChild(potrdi);
      }
      if (question.allowFreeText) {
        const own = document.createElement("button"); own.type = "button"; own.className = "svetovalec-atena-mini-widget__napisi-sam"; own.textContent = "Napiši sam";
        own.dataset.atenaInterfaceId = "atena:control:svetovalec:" + question.id + ":answer:write-own";
        own.addEventListener("click", function () { atenaConversationFlow = svetovalecConversationFlow.openFreeText(atenaConversationFlow, question.id); izrisiAtenaConversationFlow(); });
        const inlineOwn = ["grid", "segments", "tags", "negotiation"].includes(renderer);
        if (inlineOwn) izbire.appendChild(own);
        else if (potrdi && potrdi.parentNode === kartica) kartica.insertBefore(own, potrdi);
        else kartica.appendChild(own);
      }
    }
    atenaPogovor.appendChild(kartica);
    return kartica;
  }

  function izrisiAtenaPredogled() {
    const preview = document.createElement("section");
    preview.className = "svetovalec-atena-preview";
    preview.dataset.atenaInterfaceId = "atena:svetovalec:conversation-preview:v1";
    const heading = document.createElement("h3"); heading.textContent = "Predogled vaše zahteve"; preview.appendChild(heading);
    const list = document.createElement("dl"); list.className = "svetovalec-atena-preview__odgovori";
    atenaConversationFlow.answers.forEach(function (answer) {
      const definition = atenaConversationFlow.questionById[answer.questionId];
      const row = document.createElement("div"); const dt = document.createElement("dt"); const dd = document.createElement("dd");
      dt.textContent = definition.question; dd.textContent = answer.source === "free-text" ? answer.rawText : answer.optionIds.map(function (id) { const option = definition.options.find(function (item) { return item.id === id; }); return option ? option.label : id; }).join(", ");
      row.appendChild(dt); row.appendChild(dd); list.appendChild(row);
    });
    preview.appendChild(list);
    const serviceCodes = atenaConversationFlow.result && atenaConversationFlow.result.serviceCodes || [];
    if (serviceCodes.length) {
      const outcome = document.createElement("p");
      outcome.className = "svetovalec-atena-preview__izid";
      outcome.textContent = "Nadaljevanje: " + serviceCodes.map(function (code) {
        const button = document.querySelector('[data-storitev="' + code + '"]');
        const title = button && button.querySelector(".storitev-kartica__naslov, .storitev-klic__besedilo h2");
        return title ? title.textContent.trim() : code;
      }).join(", ");
      preview.appendChild(outcome);
    }
    atenaPogovor.appendChild(preview);
  }

  function izrisiAtenaConversationFlow() {
    if (!atenaConversationFlow || !atenaPogovor) return;
    odpriAtenaPogovor();
    document.body.classList.add("has-atena-guided-flow");
    document.body.classList.toggle("is-atena-flow-draft", atenaConversationFlow.status === "draft");
    atenaPogovor.innerHTML = "";
    dodajAtenaPogovornoSporocilo("uporabnik", atenaConversationFlow.sourceText, false);
    dodajAtenaPogovornoSporocilo("atena", "Imam par vprašanj, da razumem celotno situacijo.", false);
    izrisiAtenaFlowKorake();
    const activeId = atenaConversationFlow.activeQuestionId || atenaConversationFlow.planIds[atenaConversationFlow.activeStepIndex];
    atenaConversationFlow.questionIds.forEach(function (id) {
      izrisiAtenaVodenoVprasanje(atenaConversationFlow.questionById[id], atenaConversationFlow.answersByQuestionId[id]);
    });
    if (atenaConversationFlow.status === "preview") izrisiAtenaPredogled();
    nastaviAtenaFlowPrimarniGumb();
    window.requestAnimationFrame(function () {
      const cilj = atenaConversationFlow.status === "preview"
        ? atenaPogovor.querySelector(".svetovalec-atena-preview")
        : Array.from(atenaPogovor.querySelectorAll("[data-atena-question-id]")).find(function (element) { return element.dataset.atenaQuestionId === activeId; });
      atenaPogovor.scrollTop = cilj ? Math.max(0, cilj.offsetTop - atenaPogovor.offsetTop - 6) : atenaPogovor.scrollHeight;
    });
  }

  function zacniAtenaConversationFlow(pojasnilo, sourceText) {
    const normalized = svetovalecClarificationEngine.normalize(pojasnilo, sourceText);
    if (!normalized || normalized.mode !== "widget" || !svetovalecConversationFlow) return false;
    atenaConversationFlow = svetovalecConversationFlow.create(sourceText, normalized.clarificationId);
    if (!atenaConversationFlow) return false;
    shraniAtenaConversationFlow(); izrisiAtenaConversationFlow(); return true;
  }

  function dolociAtenaFlowStoritve() {
    if (!atenaConversationFlow) return [];
    if (atenaConversationFlow.actionCode) return [atenaConversationFlow.actionCode];
    let candidates = [];
    atenaConversationFlow.answers.forEach(function (answer) {
      const codes = Array.isArray(answer.serviceCodes) ? answer.serviceCodes : [];
      if (!codes.length) return;
      if (!candidates.length) candidates = codes.slice();
      else {
        const intersection = candidates.filter(function (code) { return codes.includes(code); });
        if (intersection.length) candidates = intersection;
      }
    });
    if (candidates.length > 1) {
      const optionIds = atenaConversationFlow.answers.reduce(function (all, answer) { return all.concat(answer.optionIds || []); }, []);
      if (optionIds.some(function (id) { return id === "pogajaj" || id === "odpovej"; }) && candidates.includes("pogajanje")) return ["pogajanje"];
      if (optionIds.some(function (id) { return id === "ponavljajoce" || id === "narocnina"; }) && candidates.includes("narocnina")) return ["narocnina"];
      if (candidates.includes("ponudba")) return ["ponudba"];
    }
    return candidates.slice(0, 3);
  }

  function pokaziAtenaTipkanje() {
    if (!atenaPogovor) return;
    if (atenaPogovorTipkanje) atenaPogovorTipkanje.remove();
    odpriAtenaPogovor();
    const sporocilo = document.createElement("p");
    sporocilo.className = "svetovalec-atena-pogovor__sporocilo svetovalec-atena-pogovor__sporocilo--atena is-typing";
    sporocilo.setAttribute("aria-label", "Atena pripravlja odgovor");
    sporocilo.innerHTML = "<i></i><i></i><i></i>";
    atenaPogovor.appendChild(sporocilo);
    atenaPogovorTipkanje = sporocilo;
    pomakniAtenaPogovorNaKonec();
  }

  function skrijAtenaTipkanje() {
    if (atenaPogovorTipkanje) atenaPogovorTipkanje.remove();
    atenaPogovorTipkanje = null;
  }

  function sestaviAtenaPogovorniVir() {
    return atenaPogovornaSporocila
      .filter(function (sporocilo) { return sporocilo.vloga === "uporabnik"; })
      .map(function (sporocilo) { return sporocilo.besedilo; })
      .join("\n");
  }

  function odgovorAteneZaIzbore(selections) {
    const izbori = Array.isArray(selections) ? selections : [];
    if (izbori.length === 1) {
      const selection = izbori[0];
      const stevilo = new Set(selection.moduleIds || []).size || 1;
      return "Razumem. Za »" + selection.serviceTitle + "« sem pripravila " + vprasanjaBesedilo(stevilo) + ". Tapnite »Odgovori«.";
    }
    return "Razumem. Označila sem " + izbori.length + " ustrezne kartice. Pri izbrani tapnite »Odgovori«.";
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
        const cilj = atenaSnemanjeCilj || opis;
        if (!cilj) return;
        cilj.value = String(text || "").slice(0, 2000);
        cilj.dispatchEvent(new Event("input", { bubbles: true }));
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

  function pripraviPonudbaIzOpisa(besedilo, storitevKoda, ostaniVObrazcu) {
    const izvor = varnoBesedilo(besedilo);
    ponudbaOsnutek.sourceText = izvor;
    if (opis && opis.value !== izvor) opis.value = izvor;
    if (ponudbaEngine && izvor && !ponudbaOsnutek.profileId) {
      const plan = ponudbaEngine.poisciProfile(izvor, 1)[0];
      if (plan) ponudbaOsnutek.profileId = plan.id;
    }
    ponudbaOsnutek.reviewReady = true;
    shraniPonudbaOsnutek();
    posodobiPonudbaPovzetek();
    const predlogi = izrisiAtenaPredloge(izvor, storitevKoda);
    const prvoPodrocje = predlogi.find(function (predlog) { return ponudbaPodrocje(predlog.code) && !jePodrocjeKoncano(predlog.code); }) ||
      predlogi.find(function (predlog) { return ponudbaPodrocje(predlog.code); }) ||
      ponudbaEngine.areas.find(function (area) { return !jePodrocjeKoncano(area.code); }) || ponudbaEngine.areas[0];
    if (prvoPodrocje) {
      if (ostaniVObrazcu && ponudbaObrazec && !ponudbaObrazec.hidden) {
        shraniPonudbaKorak(false);
        if (nastaviPonudbaAktivnoPodrocje(prvoPodrocje.code)) izrisiPonudbaPolja();
      } else {
        odpriPonudbaObrazec(prvoPodrocje.code);
      }
    }
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
    formDescription: "Preverite ključne podatke ponudbe.",
    stepHelper: "da ponudbo bolje razumemo.",
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
    window.requestAnimationFrame(prilagodiVisinoAtenaDoma);
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
      opis.placeholder = document.body.classList.contains("has-atena-pogovor")
        ? "Napišite nadaljevanje …"
        : "Npr. Želim preveriti ponudbo, pogodbo ali pogoje naročnine …";
      opis.setAttribute("aria-label", "Opišite, kaj naj preverimo ali uredimo");
    }
    if (atenaPrimarniBesedilo) atenaPrimarniBesedilo.textContent = "Poizveduj";
    if (ponudbaKarticeGumb) ponudbaKarticeGumb.textContent = "Kartice";
    pocistiAtenaPredloge();
    pokaziStatus("", false);
    window.requestAnimationFrame(prilagodiVisinoAtenaDoma);
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

  function lunaKarticaElementi(serviceCode) {
    const gumb = Array.from(document.querySelectorAll("[data-storitev]")).find(function (element) {
      return element.dataset.storitev === serviceCode;
    });
    if (!gumb) return null;
    const jeKlic = serviceCode === "klic";
    const kartica = jeKlic ? gumb.closest(".storitev-klic") : gumb;
    if (!kartica) return null;
    return {
      gumb: gumb,
      kartica: kartica,
      bubble: kartica.querySelector(jeKlic ? ".storitev-klic__predlogi" : ".storitev-kartica__predlogi"),
      action: kartica.querySelector(jeKlic ? ".storitev-klic__gumb > span" : ".storitev-kartica__akcija > span"),
    };
  }

  function vprasanjaBesedilo(stevilo) {
    const n = Math.max(1, Number(stevilo) || 1);
    if (n === 1) return "1 vprašanje";
    if (n === 2) return "2 vprašanji";
    if (n === 3 || n === 4) return n + " vprašanja";
    return n + " vprašanj";
  }

  function shraniInZamenjajBesedilo(element, besedilo) {
    if (!element) return;
    if (!element.hasAttribute("data-atena-original-text")) {
      element.dataset.atenaOriginalText = element.textContent;
      element.dataset.atenaOriginalHidden = element.hidden ? "true" : "false";
    }
    element.hidden = false;
    element.textContent = besedilo;
  }

  function pocistiLunaKartice() {
    document.querySelectorAll(".is-atena-relevant").forEach(function (kartica) {
      kartica.classList.remove("is-atena-relevant");
      kartica.removeAttribute("data-atena-vprasanja");
    });
    document.querySelectorAll("[data-atena-original-text]").forEach(function (element) {
      element.textContent = element.dataset.atenaOriginalText || "";
      element.hidden = element.dataset.atenaOriginalHidden === "true";
      element.removeAttribute("data-atena-original-text");
      element.removeAttribute("data-atena-original-hidden");
    });
    lunaKarticePoStoritvi.clear();
    lunaKarticeFacts = [];
    lunaKarticeSourceText = "";
  }

  function oznaciLunaKartice(selections, facts, sourceText) {
    pocistiLunaKartice();
    lunaKarticeFacts = Array.isArray(facts) ? facts.slice() : [];
    lunaKarticeSourceText = sourceText;
    (selections || []).forEach(function (selection) {
      const code = selection.serviceCode;
      if (!lunaKarticePoStoritvi.has(code)) lunaKarticePoStoritvi.set(code, { selections: [], moduleIds: new Set() });
      const skupina = lunaKarticePoStoritvi.get(code);
      skupina.selections.push(selection);
      (selection.moduleIds || []).forEach(function (moduleId) { skupina.moduleIds.add(Number(moduleId)); });
    });
    lunaKarticePoStoritvi.forEach(function (skupina, code) {
      const elementi = lunaKarticaElementi(code);
      if (!elementi) return;
      const stevilo = skupina.moduleIds.size || skupina.selections.length;
      elementi.kartica.classList.add("is-atena-relevant");
      elementi.kartica.dataset.atenaVprasanja = String(stevilo);
      shraniInZamenjajBesedilo(elementi.bubble, vprasanjaBesedilo(stevilo));
      shraniInZamenjajBesedilo(elementi.action, "Odgovori");
    });
  }

  function odpriLunaKartico(serviceCode) {
    const skupina = lunaKarticePoStoritvi.get(serviceCode);
    if (!skupina || !skupina.selections.length) return false;
    lunaVprasanjaAktivna = true;
    const odprto = uporabiLunaIzbor(skupina.selections[0], lunaKarticeFacts, lunaKarticeSourceText, true);
    if (odprto) pocistiLunaKartice();
    else lunaVprasanjaAktivna = false;
    return odprto;
  }

  document.querySelectorAll("[data-predloga]").forEach(function (gumb) {
    gumb.addEventListener("click", function () {
      if (gumb.hasAttribute("data-storitev")) {
        if (odpriLunaKartico(gumb.dataset.storitev)) return;
        lunaVprasanjaAktivna = false;
        odpriPonudbaNacin(gumb.dataset.storitev);
        odpriPonudbaObrazec(null);
        return;
      }
      odpriOpis(gumb.getAttribute("data-predloga") || "");
    });
  });

  function prilagodiVisinoAtenaDoma() {
    if (!opis) return;
    opis.style.height = "44px";
    const visina = Math.min(132, Math.max(44, opis.scrollHeight));
    opis.style.height = visina + "px";
    opis.style.overflowY = opis.scrollHeight > 132 ? "auto" : "hidden";
  }

  if (opis) {
    opis.addEventListener("focus", posodobiPonudbaStrnitev);
    opis.addEventListener("input", function () {
      posodobiPonudbaStrnitev();
      prilagodiVisinoAtenaDoma();
    });
    opis.addEventListener("blur", function () { window.setTimeout(posodobiPonudbaStrnitev, 0); });
    window.requestAnimationFrame(prilagodiVisinoAtenaDoma);
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
  let ponudbaOsnutek = { profileId: null, offerModelIds: [], salesChannelIds: [], answers: {}, reaktivniSklopi: {}, completedModuleIds: [], sourceText: "", reviewReady: false };

  function prazenPonudbaOsnutek() {
    return { profileId:null, offerModelIds:[], salesChannelIds:[], answers:{}, reaktivniSklopi:{}, completedModuleIds:[], sourceText:"", reviewReady:false };
  }

  function preberiPonudbaOsnutek() {
    const osnutek = prazenPonudbaOsnutek();
    try {
      const shranjeno = JSON.parse(window.localStorage.getItem(PONUDBA_OSNUTEK_SHRAMBA) || "null");
      if (shranjeno && typeof shranjeno === "object" && !Array.isArray(shranjeno)) {
        const obnovljeno = Object.assign(osnutek, shranjeno);
        if (!obnovljeno.answers || typeof obnovljeno.answers !== "object" || Array.isArray(obnovljeno.answers)) obnovljeno.answers = {};
        if (!obnovljeno.reaktivniSklopi || typeof obnovljeno.reaktivniSklopi !== "object" || Array.isArray(obnovljeno.reaktivniSklopi)) obnovljeno.reaktivniSklopi = {};
        return obnovljeno;
      }
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
      overviewTitle:"Kaj lahko preverimo?", status:"Izberite področja ali Ateni opišite, kaj vas skrbi.", formDescription:"Preverite ključne podatke ponudbe.", stepHelper:"da ponudbo bolje razumemo.", accent:"#e49a10", tint:"#fff8e9"
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

  function ponudbaReaktivnaNapakaHtml(besedilo) {
    return '<p class="ponudba-obrazec__sistemska-napaka" data-ponudba-reaktivna-napaka role="alert">' + pobegniHtml(besedilo) + '</p>';
  }

  function ponudbaReaktivnaDefinicija(definicijaId) {
    return atenaCardCombinations && typeof atenaCardCombinations.preberi === "function" ? atenaCardCombinations.preberi(definicijaId) : null;
  }

  function ponudbaReaktivniScopeId(kartica, definicija) {
    return atenaCardCombinationsAdapter && atenaCardCombinationsAdapter.sestaviScopeId
      ? atenaCardCombinationsAdapter.sestaviScopeId(kartica, definicija && definicija.id)
      : "";
  }

  function ponudbaReaktivnaStaticnaPoljaHtml(kartica, polja, definicija) {
    const razdeljeno = definicija && atenaCardCombinationsAdapter && atenaCardCombinationsAdapter.razdeliPolja
      ? atenaCardCombinationsAdapter.razdeliPolja(definicija, polja)
      : { staticna:polja || [] };
    if (!razdeljeno.staticna.length) return "";
    return atenaCardRenderer && atenaCardRenderer.moduleContentHtml
      ? atenaCardRenderer.moduleContentHtml(kartica, razdeljeno.staticna, ponudbaOsnutek.answers)
      : ponudbaPoljaRazpored(razdeljeno.staticna);
  }

  function ponudbaReaktivnePonovitveHtml(definicija, scopeId, pogled, polja) {
    const rezultat = atenaCardCombinationsAdapter && atenaCardCombinationsAdapter.ponovitveHtml
      ? atenaCardCombinationsAdapter.ponovitveHtml(definicija, scopeId, pogled, polja)
      : null;
    return rezultat && rezultat.ok ? rezultat.html : ponudbaReaktivnaNapakaHtml("Reaktivnega sklopa ni mogoče prikazati, ker manjka definicija polja.");
  }

  function ponudbaReaktivniPovzetkiHtml(definicija, pogled) {
    return atenaCardCombinationsAdapter && atenaCardCombinationsAdapter.povzetkiHtml
      ? atenaCardCombinationsAdapter.povzetkiHtml(definicija, pogled)
      : ponudbaReaktivnaNapakaHtml("Povzetka reaktivnega sklopa trenutno ni mogoče prikazati.");
  }

  function ponudbaReaktivniStevecHtml(definicija, scopeId, pogled) {
    return '<div class="atena-polje atena-polje--polno atena-polje--sestavljeno" data-reaktivni-stevec-vrstica>' +
      '<span class="atena-polje__oznaka">' + pobegniHtml(definicija.stevec.label || "Število") + '</span>' +
      '<div class="atena-kolicina">' +
        '<button type="button" data-reaktivni-stevec-korak="-1" aria-label="Zmanjšaj">−</button>' +
        '<input type="number" inputmode="numeric" value="' + pogled.stevilo + '" min="' + definicija.stevec.min + '" max="' + definicija.stevec.max + '" step="1" data-reaktivni-stevec data-reaktivni-scope-id="' + pobegniHtml(scopeId) + '" data-reaktivni-definicija-id="' + pobegniHtml(definicija.id) + '" aria-label="' + pobegniHtml(definicija.stevec.label || "Število") + '">' +
        '<button type="button" data-reaktivni-stevec-korak="1" aria-label="Povečaj">+</button>' +
      '</div></div>';
  }

  function ponudbaReaktivniSklopHtml(kartica, polja) {
    if (!kartica || !kartica.kombinacijaId) return "";
    const staticnaPolja = ponudbaReaktivnaStaticnaPoljaHtml(kartica, polja, null);
    if (!atenaCardCombinationsEngine || !atenaCardCombinations || !atenaCardCombinationsAdapter || !atenaCardRenderer || typeof atenaCardRenderer.fieldHtml !== "function") return ponudbaReaktivnaNapakaHtml("Reaktivnega sklopa trenutno ni mogoče varno prikazati.") + staticnaPolja;
    const definicija = ponudbaReaktivnaDefinicija(kartica.kombinacijaId);
    if (!definicija) return ponudbaReaktivnaNapakaHtml("Ta reaktivni sklop ni prepoznan. Osvežite stran in poskusite znova.") + staticnaPolja;
    const scopeId = ponudbaReaktivniScopeId(kartica, definicija);
    if (!scopeId) return ponudbaReaktivnaNapakaHtml("Reaktivni sklop nima veljavnega obsega kartice.") + staticnaPolja;
    const pripravljeno = atenaCardCombinationsAdapter.pripraviZacetnoStanje
      ? atenaCardCombinationsAdapter.pripraviZacetnoStanje(definicija, ponudbaOsnutek.reaktivniSklopi[scopeId], ponudbaOsnutek.answers, scopeId)
      : null;
    if (!pripravljeno || !pripravljeno.ok) return ponudbaReaktivnaNapakaHtml("Definicija reaktivnega sklopa ni veljavna.") + staticnaPolja;
    const prej = ponudbaOsnutek.reaktivniSklopi[scopeId];
    if (JSON.stringify(prej || null) !== JSON.stringify(pripravljeno.stanje) || pripravljeno.preseljeniFieldIds.length) {
      ponudbaOsnutek.reaktivniSklopi[scopeId] = pripravljeno.stanje;
      ponudbaOsnutek.answers = Object.assign({}, pripravljeno.odgovori);
      shraniPonudbaOsnutek();
    }
    const pogled = atenaCardCombinationsEngine.preberiPogled(definicija, pripravljeno.stanje, scopeId);
    return '<div data-reaktivni-sklop-root data-reaktivni-scope-id="' + pobegniHtml(scopeId) + '" data-reaktivni-definicija-id="' + pobegniHtml(definicija.id) + '">' +
      ponudbaReaktivniStevecHtml(definicija, scopeId, pogled) +
      '<div data-reaktivni-ponovitve>' + ponudbaReaktivnePonovitveHtml(definicija, scopeId, pogled, polja) + '</div>' +
      '<div data-reaktivni-povzetki>' + ponudbaReaktivniPovzetkiHtml(definicija, pogled) + '</div>' +
    '</div>' + ponudbaReaktivnaStaticnaPoljaHtml(kartica, polja, definicija);
  }

  function ponudbaReaktivniRoot(scopeId) {
    if (!ponudbaObrazecPolja) return null;
    return Array.from(ponudbaObrazecPolja.querySelectorAll("[data-reaktivni-sklop-root]")).find(function (root) { return root.dataset.reaktivniScopeId === scopeId; }) || null;
  }

  function ponudbaReaktivnaAktivnaKartica(scopeId) {
    const schema = trenutnaPonudbaShema();
    const modul = schema && schema.modules && schema.modules[0];
    const kartica = modul && atenaCardSchema && atenaCardSchema.getCard ? atenaCardSchema.getCard(aktivnaStoritevKoda, modul.id) : null;
    const definicija = kartica && ponudbaReaktivnaDefinicija(kartica.kombinacijaId);
    if (!kartica || !definicija || ponudbaReaktivniScopeId(kartica, definicija) !== scopeId) return null;
    return { kartica:kartica, definicija:definicija, polja:kartica.fields || modul.fields };
  }

  function osveziPonudbaReaktivniSklop(definicija, scopeId, pogled, osveziPonovitve) {
    const root = ponudbaReaktivniRoot(scopeId);
    if (!root) return;
    const stevec = root.querySelector("[data-reaktivni-stevec]");
    if (stevec) { stevec.value = String(pogled.stevilo); stevec.setAttribute("value", String(pogled.stevilo)); }
    if (osveziPonovitve) {
      const aktivno = ponudbaReaktivnaAktivnaKartica(scopeId);
      const ponovitve = root.querySelector("[data-reaktivni-ponovitve]");
      if (aktivno && ponovitve) {
        ponovitve.innerHTML = ponudbaReaktivnePonovitveHtml(definicija, scopeId, pogled, aktivno.polja);
        atenaCardRenderer.hydrate(ponovitve);
      }
    }
    const povzetki = root.querySelector("[data-reaktivni-povzetki]");
    if (povzetki) povzetki.innerHTML = ponudbaReaktivniPovzetkiHtml(definicija, pogled);
  }

  function obdelajPonudbaReaktivnoSpremembo(target) {
    if (!target || !atenaCardCombinationsEngine || !atenaCardCombinationsAdapter) return false;
    const stevec = target.closest && target.closest("[data-reaktivni-stevec]");
    const fieldRoot = target.closest && target.closest("[data-atena-field-root][data-atena-storage-key][data-atena-instance-key]");
    const lastnik = stevec || fieldRoot;
    const scopeId = lastnik && lastnik.dataset.reaktivniScopeId;
    const definicija = ponudbaReaktivnaDefinicija(lastnik && lastnik.dataset.reaktivniDefinicijaId);
    if (!definicija || !scopeId) return false;
    const obnovljeno = atenaCardCombinationsEngine.obnovi(definicija, ponudbaOsnutek.reaktivniSklopi[scopeId]);
    if (!obnovljeno.ok) return false;
    const rezultat = atenaCardCombinationsAdapter.izvediSpremembo(definicija, scopeId, obnovljeno.stanje, target);
    if (!rezultat.ok) return false;
    if (!rezultat.changedKeys.length) return true;
    ponudbaOsnutek.reaktivniSklopi[scopeId] = rezultat.stanje;
    osveziPonudbaReaktivniSklop(definicija, scopeId, rezultat.pogled, rezultat.changedKeys.includes("stevilo"));
    shraniPonudbaOsnutek();
    return true;
  }

  function ponudbaPosebniModulHtml(modul) {
    const profil = ponudbaEngine.profiles.find(function (row) { return row.id === Number(ponudbaProfil.value); });
    const model = ponudbaEngine.offerModels.find(function (row) { return row.id === Number(ponudbaModel.value); });
    const kanal = ponudbaEngine.salesChannels.find(function (row) { return row.id === Number(ponudbaKanal.value); });
    const odgovori = Object.keys(ponudbaOsnutek.answers || {}).filter(function (id) { return varnoBesedilo(ponudbaOsnutek.answers[id]); }).length;
    const koncani = (ponudbaOsnutek.completedModuleIds || []).filter(function (id) { return id !== 4027; }).length;
    return atenaCardRenderer && atenaCardRenderer.specialModuleContentHtml
      ? atenaCardRenderer.specialModuleContentHtml(modul, { profileLabel:profil && profil.label, modelLabel:model && model.label, channelLabel:kanal && kanal.label, completedCount:koncani, totalModules:27, answerCount:odgovori })
      : "";
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
    cena: "Preverite ceno, DDV in dodatne stroške.",
    obseg: "Preverite, kaj ponudba vključuje in česa ne.",
    placilo: "Preverite roke, obroke in način plačila.",
    pogodba: "Preverite trajanje, odpoved in spremembe.",
    garancija: "Preverite jamstvo, kritje in reklamacije.",
    tveganja: "Preverite ponudnika, dokazila in obljube."
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
    const izvor = varnoBesedilo(ponudbaOsnutek.sourceText || (opis && opis.value));
    const schema = trenutnaPonudbaShema();
    const modul = schema && schema.modules && schema.modules[0];
    const vprasanje = lunaVprasanjaAktivna && modul ? ponudbaVprasanje(modul) : "";
    return '<aside class="ponudba-obrazec__atena-povzetek" aria-label="Atenin vnos za ' + pobegniHtml(naslov) + '">' +
      (vprasanje ? '<p class="ponudba-obrazec__atena-vprasanje" data-ponudba-atena-vprasanje>' + pobegniHtml(vprasanje) + '</p>' : '') +
      '<div class="ponudba-obrazec__atena-vnos">' +
        '<textarea rows="1" maxlength="2000" data-ponudba-atena-opis aria-label="' + (vprasanje ? 'Odgovorite na Atenino vprašanje' : 'Opišite, kaj naj Atena preveri') + '" placeholder="' + (vprasanje ? 'Napišite odgovor …' : 'Vprašajte Ateno …') + '">' + (vprasanje ? '' : pobegniHtml(izvor)) + '</textarea>' +
        '<div class="ponudba-obrazec__atena-orodja">' +
          '<button type="button" class="ponudba-obrazec__atena-orodje ponudba-obrazec__atena-orodje--glas" data-ponudba-atena-glas aria-label="Povej na glas"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/></svg><span class="sr-only">Povej</span></button>' +
          '<span class="ponudba-obrazec__atena-locilo" aria-hidden="true"></span>' +
          '<button type="button" class="ponudba-obrazec__atena-orodje ponudba-obrazec__atena-orodje--kamera" data-ponudba-atena-slika aria-label="Slikaj ponudbo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3h5Z"/><circle cx="12" cy="13" r="3"/></svg></button>' +
          '<button type="button" class="ponudba-obrazec__atena-orodje ponudba-obrazec__atena-orodje--uvoz" data-ponudba-atena-slika aria-label="Uvozi dokument"><svg class="ponudba-obrazec__atena-uvoz" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V5"/><path d="m8 9 4-4 4 4"/><path d="M5 19h14"/></svg></button>' +
          '<button type="button" class="ponudba-obrazec__atena-izberi" data-ponudba-atena-izberi><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg><span>' + (vprasanje ? 'Odgovori' : 'Poizveduj') + '</span></button>' +
        '</div>' +
      '</div>' +
    '</aside>';
  }

  function izrisiPonudbaObrazecPodrocja() {
    if (!ponudbaObrazecPodrocja) return;
    const area = ponudbaPodrocje(ponudbaAktivnoPodrocje);
    if (ponudbaObrazecPodrocjeNaslov) ponudbaObrazecPodrocjeNaslov.textContent = area ? area.label : aktivnaStoritevMeta.summaryTitle;
    if (ponudbaObrazecPodrocjeOpis) ponudbaObrazecPodrocjeOpis.textContent = PONUDBA_PODROCJE_OPISI[ponudbaAktivnoPodrocje] || aktivnaStoritevMeta.formDescription;
    const podrocja = ponudbaEngine ? ponudbaEngine.areas : [];
    let uvod = document.querySelector('.ponudba-kader');
    if (!uvod) {
      uvod=document.createElement('section');uvod.className='ponudba-kader';
      uvod.innerHTML='<div class="ponudba-kader__grafika" aria-hidden="true"></div><div class="ponudba-kader__opis"><small>KAJ PREVERIMO</small><h3></h3><p></p><ul></ul></div>';
      ponudbaObrazecPodrocja.before(uvod);
    }
    const grafika = uvod.querySelector('.ponudba-kader__grafika');
    grafika.replaceChildren();
    if (aktivnaStoritevKoda === 'ponudba' && ['cena', 'obseg', 'placilo', 'pogodba', 'garancija', 'tveganja'].includes(ponudbaAktivnoPodrocje)) {
      const slika = document.createElement('img');
      slika.src = ponudbaAktivnoPodrocje === 'cena' ? 'assets/jezomir-cena-contours-v12.png' : ponudbaAktivnoPodrocje === 'obseg' ? 'assets/jezomir-obseg-contours-v12.png' : ponudbaAktivnoPodrocje === 'placilo' ? 'assets/jezomir-placilo-contours-v12.png' : ponudbaAktivnoPodrocje === 'pogodba' ? 'assets/jezomir-pogodba-color-v13.png' : ponudbaAktivnoPodrocje === 'garancija' ? 'assets/jezomir-garancija-contours-v12.png' : 'assets/jezomir-tveganja-contours-v12.png';
      slika.alt = '';
      slika.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain;';
      grafika.append(slika);
    }
    if (!uvod._fitObserver) {
      const fit = () => {
        uvod.querySelectorAll('.ponudba-kader__opis > small, .ponudba-kader__opis h3, .ponudba-kader__opis p, .ponudba-kader__opis li').forEach(el => {
          el.style.fontSize = '';
          let size = parseFloat(getComputedStyle(el).fontSize);
          const maxLines = el.tagName === 'H3' ? 2 : el.tagName === 'P' ? 3 : 1;
          const range = document.createRange(); range.selectNodeContents(el);
          const fits = () => {
            const rects = Array.from(range.getClientRects());
            return new Set(rects.map(r => Math.round(r.top))).size <= maxLines && rects.every(r => r.right <= el.getBoundingClientRect().right + 1);
          };
          while (!fits() && size > 9) { size -= .25; el.style.fontSize = size + 'px'; }
        });
        const paragraph = uvod.querySelector('.ponudba-kader__opis p');
        const paragraphRange = document.createRange();
        paragraphRange.selectNodeContents(paragraph);
        const paragraphLines = new Set(Array.from(paragraphRange.getClientRects()).map(rect => Math.round(rect.top))).size;
        uvod.classList.toggle('ponudba-kader--three-lines', paragraphLines >= 3);
      };
      uvod._fit = fit;
      uvod._fitObserver = new ResizeObserver(fit);
      uvod._fitObserver.observe(uvod);
      document.fonts.ready.then(fit);
    }
    requestAnimationFrame(() => uvod._fit());
    const uvodi={
      cena:['Jasna cena. Brez presenečenj.','Preverimo ceno, DDV in doplačila, da poznate končni znesek.',['Osnovna cena','DDV in doplačila','Skupni znesek']],
      obseg:['Kaj dobite za svoj denar?','Preverimo, kaj ponudba vključuje in kaj boste morali naročiti posebej.',['Vključene storitve','Izključitve','Dodatna naročila']],
      placilo:['Plačilo ob pravem času.','Preverimo način plačila, predplačilo in dogovorjene roke.',['Predplačilo','Obroki','Roki plačila']],
      pogodba:['Jasni pogoji sodelovanja.','Pregledamo trajanje pogodbe, vezavo in možnosti prekinitve.',['Trajanje','Vezava','Prekinitev']],
      garancija:['Kaj velja po nakupu?','Preverimo jamstva ter postopek ob napakah ali reklamaciji.',['Garancija','Reklamacije','Odprava napak']],
      tveganja:['Opazimo drobni tisk.','Preverimo omejitve in obveznosti, ki lahko vplivajo na vašo odločitev.',['Omejitve','Obveznosti','Možna tveganja']]
    };
    const storitveniUvodi = {
      narocnina: {
        storitev:['Plačujete tisto, kar uporabljate?','Preverimo vsebino naročnine, uporabo in kakovost izvedbe.'],
        stroski:['Poznajte celoten strošek.','Pregledamo redna plačila, dodatke in spremembe cene.'],
        trajanje:['Ne zamudite pomembnega roka.','Preverimo vezavo, podaljšanje in rok za odločitev.'],
        izstop:['Sprememba brez presenečenj.','Preverimo vaš cilj, stroške in prenos ob izstopu.'],
        dokazila:['Dogovor naj bo dokazljiv.','Pregledamo obvestila, vaš odziv in dokumente.']
      },
      pogajanje: {
        cilj:['Jasen cilj. Jasne meje.','Določimo, kaj želite doseči in česa ne sprejmete.'],
        izhodisce:['Začnimo pri dejstvih.','Pregledamo dogovor, razlog za spremembo in sogovornika.'],
        okvir:['Pripravite pogajalski okvir.','Določimo ciljni rezultat, sprejemljivo mejo in alternativo.'],
        odpoved:['Pripravimo varen zaključek.','Preverimo želeni konec, pogoje in posledice izstopa.'],
        dokazila:['Pravo sporočilo ob pravem času.','Zberemo obljube in dokumente ter določimo način pogovora.']
      },
      ponudbe: {
        potreba:['Najprej opredelimo rezultat.','Pojasnimo, kaj potrebujete in kaj bo pomenilo uspeh.'],
        zahteve:['Primerljive ponudbe se začnejo tu.','Določimo obseg, nujne zahteve in vaš prispevek.'],
        proracun:['Jasen proračun za ponudnike.','Določimo cenovni okvir, obračun in plačilne pogoje.'],
        rok:['Uskladimo čas in izvedbo.','Opredelimo roke, lokacijo in časovne omejitve.'],
        izbor:['Izberimo primerne ponudnike.','Določimo koga vključiti in kako primerjati ponudbe.']
      }
    };
    const storitveniUvod = storitveniUvodi[aktivnaStoritevKoda]?.[ponudbaAktivnoPodrocje];
    const postavkeUvoda = (area?.moduleIds || []).map(id => ponudbaEngine.modules.find(modul => modul.id === id)?.label).filter(Boolean).slice(0,3);
    if (aktivnaStoritevKoda === 'ponudbe' && ponudbaAktivnoPodrocje === 'izbor') {
      postavkeUvoda.splice(0,3,'Ponudniki in izključitve','Merila primerjave','Število ponudb');
    }
    const uvodPodatki = aktivnaStoritevKoda === 'ponudba'
      ? uvodi[ponudbaAktivnoPodrocje] || [area?.label || aktivnaStoritevMeta.summaryTitle,aktivnaStoritevMeta.formDescription,[]]
      : storitveniUvod ? [...storitveniUvod,postavkeUvoda] : [area?.label || aktivnaStoritevMeta.summaryTitle,aktivnaStoritevMeta.formDescription,[]];
    uvod.querySelector('h3').textContent=uvodPodatki[0];uvod.querySelector('p').textContent=uvodPodatki[1];
    uvod.querySelector('ul').replaceChildren(...uvodPodatki[2].map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
    ponudbaObrazecPodrocja.dataset.ponudbaStevilo = String(podrocja.length);
    ponudbaObrazecPodrocja.dataset.ponudbaPostavitev = "enotna";
    ponudbaObrazecPodrocja.innerHTML = podrocja.map(function (podrocje) {
      const koncani = podrocje.moduleIds.filter(function (id) { return ponudbaOsnutek.completedModuleIds.includes(id); }).length;
      const skupaj = podrocje.moduleIds.length;
      const aktiven = podrocje.code === ponudbaAktivnoPodrocje;
      const koncano = koncani === skupaj;
      const prviModul = ponudbaModulPoId(podrocje.moduleIds[0]);
      const podrocniRazredi = ["cena", "obseg", "placilo", "pogodba", "garancija", "tveganja"];
      const razred = podrocniRazredi.includes(podrocje.code) ? podrocje.code : ponudbaKarticaRazred(prviModul ? prviModul.code : "Q");
      const odstotek = skupaj ? Math.round(koncani / skupaj * 100) : 0;
      return '<button type="button" class="ponudba-obrazec__podrocje ponudba-obrazec__podrocje--' + razred + (aktiven ? ' is-aktiven' : '') + (koncano ? ' is-koncan' : '') + '" aria-pressed="' + (aktiven ? 'true' : 'false') + '" aria-label="' + pobegniHtml(podrocje.label + ', ' + koncani + ' od ' + skupaj) + '" data-ponudba-podrocje-nav="' + pobegniHtml(podrocje.code) + '">' +
        '<span class="ponudba-obrazec__podrocje-ikona" aria-hidden="true">' + ponudbaKarticaIkona(prviModul ? prviModul.code : "Q") + '</span>' +
        '<span class="ponudba-obrazec__podrocje-besedilo"><strong><span data-fit-text data-fit-text-min="7">' + pobegniHtml(podrocje.label) + '</span><small>' + koncani + '/' + skupaj + '</small></strong><span class="ponudba-obrazec__podrocje-napredek" aria-hidden="true"><span style="width:' + odstotek + '%"></span></span></span>' +
      '</button>';
    }).join("");
  }

  function ponudbaPrviNedokoncanIndex(moduli) {
    const index = moduli.findIndex(function (id) { return !ponudbaOsnutek.completedModuleIds.includes(id); });
    return index < 0 ? 0 : index;
  }

  function nastaviPonudbaAktivnoPodrocje(koda) {
    const area = ponudbaPodrocje(koda);
    if (!area) return false;
    ponudbaAktivnoPodrocje = area.code;
    ponudbaObrazec.dataset.ponudbaObrazecPodrocje = area.code;
    ponudbaAktivniModuli = area.moduleIds.slice();
    ponudbaKorakIndex = ponudbaPrviNedokoncanIndex(ponudbaAktivniModuli);
    ponudbaPotrditevAktivna = false;
    ponudbaRazsirjenoVprasanjeIndex = null;
    ponudbaAktivniModulId = ponudbaAktivniModuli[ponudbaKorakIndex];
    return true;
  }

  function ponudbaVsiModuli() {
    if (!ponudbaEngine) return [];
    return Array.from(new Set(ponudbaEngine.areas.reduce(function (all, area) { return all.concat(area.moduleIds); }, [])));
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
    return atenaCardRenderer && typeof atenaCardRenderer.moduleIconHtml === "function"
      ? atenaCardRenderer.moduleIconHtml(koda)
      : "";
  }

  function ponudbaVprasanje(modul) {
    return modul.question || modul.label;
  }

  function pripraviPonudbaKarticeVpogled() {
    if (!ponudbaEngine || !ponudbaKarticeVpogled || ponudbaKarticeVpogled.children.length) return;
    ponudbaKarticeVpogled.innerHTML = ponudbaVsiModuli().map(function (moduleId) {
      const modul = ponudbaModulPoId(moduleId);
      const schema = ponudbaEngine.sestavi({
        profileId: Number(ponudbaProfil.value) || null,
        offerModelIds: ponudbaModel.value ? [Number(ponudbaModel.value)] : [],
        salesChannelIds: ponudbaKanal.value ? [Number(ponudbaKanal.value)] : [],
        moduleIds: [modul.id]
      });
      const prikazanModul = schema.modules[0] || Object.assign({}, modul, { fields: [] });
      const kartica = atenaCardSchema && atenaCardSchema.getCard ? atenaCardSchema.getCard(aktivnaStoritevKoda, modul.id) : null;
      const obogatenaPolja = kartica && kartica.fields ? kartica.fields : (atenaCardSchema && atenaCardSchema.decorateFields ? atenaCardSchema.decorateFields(prikazanModul.fields) : prikazanModul.fields);
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

  function prilagodiVisinoPonudbaAtenaTextarea(control) {
    if (!control || !control.matches("textarea[data-ponudba-atena-opis]")) return;
    control.style.minHeight = "0";
    control.style.height = "0";
    const zahtevanaVisina = control.scrollHeight + 2;
    const visina = Math.min(132, Math.max(44, zahtevanaVisina));
    control.style.minHeight = "44px";
    control.style.height = visina + "px";
    control.style.overflowY = zahtevanaVisina > 132 ? "auto" : "hidden";
    const ovoj = control.closest(".ponudba-obrazec__atena-vnos");
    if (ovoj) ovoj.classList.toggle("is-expanded", visina > 44);
  }

  function osveziVisinePonudbaTextarea() {
    if (ponudbaObrazecPolja) ponudbaObrazecPolja.querySelectorAll("textarea[data-ponudba-samorastoci]").forEach(prilagodiVisinoPonudbaTextarea);
    if (ponudbaAtenaPovzetek) ponudbaAtenaPovzetek.querySelectorAll("textarea[data-ponudba-atena-opis]").forEach(prilagodiVisinoPonudbaAtenaTextarea);
  }

  function izrisiPonudbaKorake() {
    if (!ponudbaKoraki) return;
    const prikaziKorake = !ponudbaPotrditevAktivna && ponudbaAktivniModuli.length > 1;
    if (ponudbaKorakiOpis) {
      const stevilo = ponudbaAktivniModuli.length;
      const vprasanja = stevilo === 2 ? "kratki vprašanji" : (stevilo === 3 || stevilo === 4 ? "kratka vprašanja" : "kratkih vprašanj");
      ponudbaKorakiOpis.textContent = stevilo + " " + vprasanja + ", " + aktivnaStoritevMeta.stepHelper;
      ponudbaKorakiOpis.hidden = true;
    }
    ponudbaKoraki.hidden = !prikaziKorake;
    ponudbaKoraki.innerHTML = prikaziKorake ? ponudbaAktivniModuli.map(function (moduleId, index) {
      const modul = ponudbaModulPoId(moduleId);
      const aktiven = index === ponudbaKorakIndex;
      const koncan = ponudbaOsnutek.completedModuleIds.includes(moduleId);
      const oznaka = "Odpri vprašanje " + (index + 1) + " od " + ponudbaAktivniModuli.length + (modul ? ": " + ponudbaVprasanje(modul) : "");
      return '<button type="button" class="ponudba-obrazec__korak' + (aktiven ? ' is-aktiven' : '') + (koncan ? ' is-koncan' : '') + '" aria-label="' + pobegniHtml(oznaka) + '"' + (aktiven ? ' aria-current="step"' : '') + ' data-ponudba-korak-index="' + index + '"><span aria-hidden="true">' + (index + 1) + '</span></button>';
    }).join("") : "";
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
        '<span class="ponudba-pregled__stevilka" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></span>' +
        '<div class="ponudba-pregled__vprasanje-telo"><header><small>' + (index + 1) + ' · ' + pobegniHtml(modul.label) + '</small><span>' + doplaciloZnacka + '<button type="button" data-ponudba-potrditev-uredi-index="' + index + '">Spremeni</button></span></header>' +
        (glavna ? '<strong class="ponudba-pregled__glavna-vrednost" data-fit-text data-fit-text-min="11">' + pobegniHtml(glavna.vrednost) + '</strong><p class="ponudba-pregled__glavni-opis">' + pobegniHtml(glavna.label) + (hiterPovzetek ? ' · ' + pobegniHtml(hiterPovzetek.label) + ': ' + pobegniHtml(hiterPovzetek.vrednost) : '') + '</p>' : '<p class="ponudba-pregled__brez-vrednosti">Podatki so potrjeni v tem koraku.</p>') +
        podrobnostiHtml + '</div>' +
      '</article>';
    }).join("");

    return '<div class="ponudba-pregled ponudba-obrazec__polje--polno" data-ponudba-potrditev-pregled>' +
      cenovniPovzetekHtml() +
      '<section class="ponudba-pregled__casovnica" aria-label="' + pobegniHtml(area ? area.label : aktivnaStoritevMeta.summaryTitle) + '">' + moduli + '</section>' +
      '<section class="ponudba-pregled__zakljucek"><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></span><div><strong>Vsi podatki so pregledani</strong><p>' + odgovorPolja.length + (odgovorPolja.length === 1 ? ' odgovor je pripravljen' : ' odgovorov je pripravljenih') + ' za potrditev.</p></div></section>' +
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
    const obogatenaPolja = kartica && kartica.fields ? kartica.fields : (atenaCardSchema && atenaCardSchema.decorateFields ? atenaCardSchema.decorateFields(modul.fields) : modul.fields);
    const vsebina = kartica && kartica.kombinacijaId
      ? ponudbaReaktivniSklopHtml(kartica, obogatenaPolja)
      : modul.fields.length && atenaCardRenderer && atenaCardRenderer.moduleContentHtml
      ? atenaCardRenderer.moduleContentHtml(kartica, obogatenaPolja, ponudbaOsnutek.answers)
      : modul.fields.length ? ponudbaPoljaRazpored(modul.fields) : ponudbaPosebniModulHtml(modul);
    if (ponudbaAtenaPovzetek) ponudbaAtenaPovzetek.innerHTML = ponudbaAtenaPovzetekHtml();
    const uporabiAtenaQuestionShell = Boolean(atenaCardRenderer && atenaCardRenderer.questionShellHtml);
    ponudbaObrazec.dataset.atenaQuestionShell = uporabiAtenaQuestionShell ? "true" : "false";
    ponudbaObrazecPolja.innerHTML = uporabiAtenaQuestionShell
      ? atenaCardRenderer.questionShellHtml({ interfaceId:kartica && kartica.interfaceId, questionWidget:kartica && kartica.questionWidget, ariaLabel:vprasanje, iconHtml:ponudbaKarticaIkona(modul.code), title:modul.label, description:"Vsi manjkajoči podatki tega vprašanja so združeni tukaj.", question:vprasanje, step:ponudbaKorakIndex + 1, total:ponudbaAktivniModuli.length, contentHtml:vsebina, showClose:true })
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
    const zapriTudiVmesniNacin = document.body.classList.contains("is-ponudba-mode");
    ponudbaObrazec.hidden = true; document.body.classList.remove("is-ponudba-obrazec-odprt", "uj-modal-odprt");
    delete ponudbaObrazec.dataset.ponudbaObrazecPodrocje;
    if (zapriTudiVmesniNacin) zapriPonudbaNacin();
    if (vrniFokus && ponudbaPrejsnjiFokus) ponudbaPrejsnjiFokus.focus({ preventScroll: true });
    ponudbaAktivniModulId = null; ponudbaAktivnoPodrocje = null; ponudbaAktivniModuli = []; ponudbaKorakIndex = 0; ponudbaPotrditevAktivna = false; ponudbaRazsirjenoVprasanjeIndex = null; lunaVprasanjaAktivna = false; return true;
  }

  function odpriPonudbaObrazec(gumbAliKoda) {
    if (!ponudbaEngine || !ponudbaObrazec) return;
    pripraviPonudbaKatalog();
    const jeGumb = gumbAliKoda && typeof gumbAliKoda !== "string";
    const zahtevanaKoda = jeGumb && gumbAliKoda.hasAttribute("data-ponudba-vse") ? null : jeGumb ? gumbAliKoda.dataset.ponudbaPodrocje : gumbAliKoda;
    const privzetoPodrocje = ponudbaEngine.areas.find(function (area) { return !jePodrocjeKoncano(area.code); }) || ponudbaEngine.areas[0];
    if (!nastaviPonudbaAktivnoPodrocje(zahtevanaKoda || (privzetoPodrocje && privzetoPodrocje.code))) return;
    ponudbaPrejsnjiFokus = jeGumb ? gumbAliKoda : gumbPreverba;
    if (ponudbaKontekst) ponudbaKontekst.hidden = true;
    if (ponudbaKontekstPreklop) ponudbaKontekstPreklop.setAttribute("aria-expanded", "false");
    ponudbaProfil.value = ponudbaOsnutek.profileId ? String(ponudbaOsnutek.profileId) : "";
    ponudbaModel.value = ponudbaOsnutek.offerModelIds[0] ? String(ponudbaOsnutek.offerModelIds[0]) : "";
    ponudbaKanal.value = ponudbaOsnutek.salesChannelIds[0] ? String(ponudbaOsnutek.salesChannelIds[0]) : "";
    osveziPonudbaPodjetje(trenutnoPodjetje());
    izrisiPonudbaPolja(); ponudbaObrazec.hidden = false; document.body.classList.add("is-ponudba-obrazec-odprt", "uj-modal-odprt");
    osveziVisinePonudbaTextarea();
    const prvi = ponudbaObrazecPolja.querySelector("select, input, textarea, button"); if (prvi) prvi.focus({ preventScroll: true });
  }

  function shraniPonudbaKorak(preveri) {
    if (!ponudbaObrazecPolja) return false;
    if (preveri && (!atenaCardRenderer || typeof atenaCardRenderer.validate !== "function" || typeof atenaCardRenderer.collectValues !== "function")) {
      prikaziNapakoManjkajocegaRendererja();
      return false;
    }
    var prejsnjaSistemskaNapaka = ponudbaObrazecPolja.querySelector("[data-ponudba-renderer-napaka]");
    if (prejsnjaSistemskaNapaka) prejsnjaSistemskaNapaka.remove();
    if (preveri && !atenaCardRenderer.validate(ponudbaObrazecPolja)) return false;
    if (preveri && !ponudbaObrazecPolja.reportValidity()) return false;
    ponudbaOsnutek.profileId = Number(ponudbaProfil.value) || null;
    ponudbaOsnutek.offerModelIds = ponudbaModel.value ? [Number(ponudbaModel.value)] : [];
    ponudbaOsnutek.salesChannelIds = ponudbaKanal.value ? [Number(ponudbaKanal.value)] : [];
    const vrednosti = atenaCardRenderer && atenaCardRenderer.collectValues
      ? atenaCardRenderer.collectValues(ponudbaObrazecPolja)
      : Object.fromEntries(Array.from(ponudbaObrazecPolja.querySelectorAll("[data-ponudba-field]")).map(function (control) { return [control.dataset.ponudbaField, control.value]; }));
    const trenutnaShema = trenutnaPonudbaShema();
    const prikazanaPolja = trenutnaShema && trenutnaShema.modules[0] ? trenutnaShema.modules[0].fields : [];
    const prikazanaKartica = trenutnaShema && trenutnaShema.modules[0] && atenaCardSchema && atenaCardSchema.getCard ? atenaCardSchema.getCard(aktivnaStoritevKoda, trenutnaShema.modules[0].id) : null;
    const prikazanaDefinicija = prikazanaKartica && ponudbaReaktivnaDefinicija(prikazanaKartica.kombinacijaId);
    if (prikazanaDefinicija && atenaCardCombinationsAdapter && atenaCardCombinationsAdapter.posodobiStaticneOdgovore) {
      ponudbaOsnutek.answers = Object.assign({}, atenaCardCombinationsAdapter.posodobiStaticneOdgovore(prikazanaDefinicija, prikazanaPolja, vrednosti, ponudbaOsnutek.answers));
    } else {
      prikazanaPolja.forEach(function (field) {
        const value = varnoBesedilo(vrednosti[field.id]);
        if (value) ponudbaOsnutek.answers[field.id] = value;
        else delete ponudbaOsnutek.answers[field.id];
      });
    }
    if (preveri && ponudbaAktivniModulId && !ponudbaOsnutek.completedModuleIds.includes(ponudbaAktivniModulId)) ponudbaOsnutek.completedModuleIds.push(ponudbaAktivniModulId);
    shraniPonudbaOsnutek();
    return true;
  }

  function prikaziNapakoManjkajocegaRendererja() {
    var obstojeca = ponudbaObrazecPolja && ponudbaObrazecPolja.querySelector("[data-ponudba-renderer-napaka]");
    var napaka = obstojeca || document.createElement("p");
    napaka.className = "ponudba-obrazec__sistemska-napaka";
    napaka.setAttribute("data-ponudba-renderer-napaka", "");
    napaka.setAttribute("role", "alert");
    napaka.tabIndex = -1;
    napaka.textContent = "Vprašanj trenutno ni mogoče varno preveriti. Osvežite stran in poskusite znova.";
    if (!obstojeca && ponudbaObrazecPolja) ponudbaObrazecPolja.prepend(napaka);
    napaka.focus({ preventScroll: true });
    if (napaka.scrollIntoView) napaka.scrollIntoView({ block: "center", behavior: "smooth" });
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
      ? "Pregled vseh " + ponudbaVsiModuli().length + " vprašanj šestih kategorij."
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
    if (!Number.isInteger(ciljniIndex) || !ponudbaAktivniModuli[ciljniIndex] || (!ponudbaPotrditevAktivna && ciljniIndex === ponudbaKorakIndex)) return;
    shraniPonudbaKorak(false); ponudbaPotrditevAktivna = false; ponudbaKorakIndex = ciljniIndex; ponudbaAktivniModulId = ponudbaAktivniModuli[ciljniIndex]; izrisiPonudbaPolja();
  });
  if (ponudbaObrazecPodrocja) ponudbaObrazecPodrocja.addEventListener("click", function (dogodek) {
    const gumb = dogodek.target.closest("[data-ponudba-podrocje-nav]");
    if (!gumb || gumb.dataset.ponudbaPodrocjeNav === ponudbaAktivnoPodrocje) return;
    shraniPonudbaKorak(false);
    if (!nastaviPonudbaAktivnoPodrocje(gumb.dataset.ponudbaPodrocjeNav)) return;
    izrisiPonudbaPolja();
  });
  if (atenaPogovorPreklop) atenaPogovorPreklop.addEventListener("click", function () {
    nastaviAtenaPogovorStrnjen(!document.body.classList.contains("is-atena-pogovor-strnjen"));
  });
  if (atenaPogovorPonastavi) atenaPogovorPonastavi.addEventListener("click", ponastaviAtenaPogovor);
  if (ponudbaAtenaPovzetek) {
    ponudbaAtenaPovzetek.addEventListener("input", function (dogodek) {
      const vnos = dogodek.target.closest("[data-ponudba-atena-opis]");
      if (!vnos) return;
      prilagodiVisinoPonudbaAtenaTextarea(vnos);
      if (lunaVprasanjaAktivna) return;
      ponudbaOsnutek.sourceText = varnoBesedilo(vnos.value);
      if (opis && opis.value !== ponudbaOsnutek.sourceText) opis.value = ponudbaOsnutek.sourceText;
      shraniPonudbaOsnutek();
    });
    ponudbaAtenaPovzetek.addEventListener("click", async function (dogodek) {
      const slika = dogodek.target.closest("[data-ponudba-atena-slika]");
      if (slika) {
        if (datoteka) datoteka.click();
        return;
      }
      const glas = dogodek.target.closest("[data-ponudba-atena-glas]");
      if (glas) {
        const vnos = ponudbaAtenaPovzetek.querySelector("[data-ponudba-atena-opis]");
        if (!vnos || !gumbGlas) return;
        atenaSnemanjeCilj = vnos;
        ponudbaOsnutek.sourceText = varnoBesedilo(vnos.value);
        if (opis) opis.value = ponudbaOsnutek.sourceText;
        gumbGlas.dataset.atenaSnemanjeModal = "true";
        gumbGlas.click();
        return;
      }
      const izberi = dogodek.target.closest("[data-ponudba-atena-izberi]");
      if (!izberi) return;
      const vnos = ponudbaAtenaPovzetek.querySelector("[data-ponudba-atena-opis]");
      const izvor = varnoBesedilo(vnos && vnos.value);
      const imaDatoteko = Boolean(datoteka && datoteka.files && datoteka.files.length);
      if (lunaVprasanjaAktivna) {
        if (!izvor) {
          pokaziStatus("Napišite odgovor na trenutno vprašanje.", true);
          if (vnos) vnos.focus();
          return;
        }
        const schema = trenutnaPonudbaShema();
        const modul = schema && schema.modules && schema.modules[0];
        if (!modul) return;
        const napis = izberi.querySelector("span");
        izberi.disabled = true;
        if (napis) napis.textContent = "Preverjam …";
        try {
          const vprasanje = ponudbaVprasanje(modul);
          const analiza = [ponudbaOsnutek.sourceText, "Vprašanje: " + vprasanje, "Odgovor uporabnika: " + izvor].filter(Boolean).join("\n");
          const rezultat = await razcleniSvetovalecZLuno(analiza);
          const fieldIds = new Set((modul.fields || []).map(function (field) { return Number(field.id); }));
          (rezultat.facts || []).filter(function (fact) {
            return fact.serviceId === (svetovalecAtenaEngine.getService(aktivnaStoritevKoda) || {}).id && fieldIds.has(Number(fact.fieldId));
          }).forEach(function (fact) {
            ponudbaOsnutek.answers[fact.fieldId] = fact.value;
          });
          shraniPonudbaOsnutek();
          izrisiPonudbaPolja();
          if (!premakniPonudbaKorak(1)) {
            const novoPolje = ponudbaAtenaPovzetek.querySelector("[data-ponudba-atena-opis]");
            if (novoPolje) { novoPolje.value = izvor; prilagodiVisinoPonudbaAtenaTextarea(novoPolje); }
            pokaziStatus("Odgovor je shranjen. Dopolnite še označene manjkajoče podatke.", true);
          } else {
            pokaziStatus("Odgovor je shranjen. Atena je pripravila naslednje vprašanje.", false);
          }
        } catch (error) {
          pokaziStatus(error && error.message || "Odgovora trenutno ni bilo mogoče obdelati.", true);
          if (vnos) vnos.focus();
        } finally {
          const trenutniGumb = ponudbaAtenaPovzetek.querySelector("[data-ponudba-atena-izberi]");
          if (trenutniGumb) {
            trenutniGumb.disabled = false;
            const trenutniNapis = trenutniGumb.querySelector("span");
            if (trenutniNapis) trenutniNapis.textContent = "Odgovori";
          }
        }
        return;
      }
      if (!izvor && !imaDatoteko) {
        pokaziStatus("Opišite situacijo ali dodajte ponudbo.", true);
        if (vnos) vnos.focus();
        return;
      }
      const predlogi = pripraviPonudbaIzOpisa(izvor, aktivnaStoritevKoda, true);
      pokaziStatus(predlogi.length
        ? "Atena je izbrala " + predlogi.length + " najpomembnejša področja."
        : "Atena je osvežila korake pregleda.", false);
    });
  }
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
      if (dogodek.target.closest("[data-ponudba-obrazec-zapri]")) { zapriPonudbaObrazec(true); return; }
      const reaktivniKorak = dogodek.target.closest("[data-reaktivni-stevec-korak]");
      if (reaktivniKorak) {
        const reaktivniRoot = reaktivniKorak.closest("[data-reaktivni-sklop-root]");
        const reaktivniStevec = reaktivniRoot && reaktivniRoot.querySelector("[data-reaktivni-stevec]");
        if (reaktivniStevec) {
          reaktivniStevec.value = String(Number(reaktivniStevec.value || 0) + Number(reaktivniKorak.dataset.reaktivniStevecKorak || 0));
          obdelajPonudbaReaktivnoSpremembo(reaktivniStevec);
        }
        return;
      }
      const spremeniVprasanje = dogodek.target.closest("[data-atena-question-change]");
      if (spremeniVprasanje) {
        const prviVnos = ponudbaObrazecPolja.querySelector(".ponudba-obrazec__modul-polja [data-atena-select-toggle]:not([disabled]), .ponudba-obrazec__modul-polja input:not([type=hidden]):not([disabled]), .ponudba-obrazec__modul-polja textarea:not([disabled]), .ponudba-obrazec__modul-polja select:not([data-atena-select-source]):not([disabled]), .ponudba-obrazec__modul-polja button:not([disabled])");
        if (prviVnos) {
          prviVnos.focus({ preventScroll: true });
          if (prviVnos.scrollIntoView) prviVnos.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        return;
      }
      if (atenaCardRenderer && atenaCardRenderer.handleClick && atenaCardRenderer.handleClick(dogodek, ponudbaObrazecPolja)) {
        obdelajPonudbaReaktivnoSpremembo(dogodek.target);
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
      obdelajPonudbaReaktivnoSpremembo(dogodek.target);
      prilagodiVisinoPonudbaTextarea(dogodek.target);
      if (PONUDBA_DOPLACILO_POLJA.includes(Number(dogodek.target.dataset.ponudbaField))) izrisiPonudbaObrazecPodrocja();
    });
    ponudbaObrazecPolja.addEventListener("change", function (dogodek) {
      if (atenaCardRenderer && atenaCardRenderer.handleChange) atenaCardRenderer.handleChange(dogodek, ponudbaObrazecPolja);
      obdelajPonudbaReaktivnoSpremembo(dogodek.target);
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
      window.location.href = "prodajni-scit-mockup.html";
    });
  });

  const gumbKamera = document.querySelector("[data-domaca-kamera]");
  const gumbDatoteka = document.querySelector("[data-domaci-uvoz]");
  if (datoteka) {
    if (gumbKamera) gumbKamera.addEventListener("click", function () {
      datoteka.setAttribute("capture", "environment");
      datoteka.click();
    });
    if (gumbDatoteka) gumbDatoteka.addEventListener("click", function () {
      datoteka.removeAttribute("capture");
      datoteka.click();
    });
    datoteka.addEventListener("change", function () {
      const izbrana = datoteka.files && datoteka.files[0];
      pokaziStatus(izbrana ? "Dodano: " + izbrana.name : "", false);
    });
  }

  if (gumbGlas) {
    gumbGlas.addEventListener("click", function () {
      if (gumbGlas.dataset.atenaSnemanjeModal !== "true") atenaSnemanjeCilj = opis;
      delete gumbGlas.dataset.atenaSnemanjeModal;
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

  function jeLokalniSvetovalecPredogled() {
    return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname) && (
      globalThis.UJ_LOKALNI_APP_PREDOGLED === true ||
      new URLSearchParams(window.location.search).get("app-preview") === "1" ||
      sessionStorage.getItem("app-iphone-preview") === "1"
    );
  }

  async function svetovalecAccessToken() {
    if (jeLokalniSvetovalecPredogled()) return "local-preview";
    if (typeof supabaseKlient === "undefined" || !supabaseKlient || !supabaseKlient.auth) throw new Error("Prijava ni na voljo. Osvežite stran in poskusite znova.");
    let rezultat = await supabaseKlient.auth.getSession();
    if (rezultat && rezultat.error) throw rezultat.error;
    let seja = rezultat && rezultat.data && rezultat.data.session;
    if (!seja || !seja.access_token) {
      rezultat = await supabaseKlient.auth.refreshSession();
      if (rezultat && rezultat.error) throw rezultat.error;
      seja = rezultat && rezultat.data && rezultat.data.session;
    }
    if (!seja || !seja.access_token) throw new Error("Prijava je potekla. Prijavite se znova.");
    return seja.access_token;
  }

  function svetovalecRequestId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return "advisor:" + globalThis.crypto.randomUUID();
    return "advisor:" + Date.now().toString(36) + ":" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }

  function lunaKontekstPodjetja() {
    const trenutno = trenutnoPodjetje();
    const podatki = najdiPodjetjePodatke(trenutno && trenutno.name) || trenutno || {};
    return {
      name: varnoBesedilo(podatki.name),
      activities: Array.isArray(podatki.dejavnosti) ? podatki.dejavnosti.slice(0, 12) : [],
      role: varnoBesedilo(podatki.vloga),
      relationship: varnoBesedilo(podatki.odnos),
      collaboration: varnoBesedilo(podatki.sodelovanje),
      contact: varnoBesedilo(podatki.stik),
    };
  }

  function preveriLunaSvetovalecRezultat(data, requestId, sourceText) {
    const localGraphContract = Boolean(data && data.contractVersion === "svetovalec-intent-contract-v2" && data.questionBatch && data.questionBatch.source === "local-graph");
    if (!svetovalecAtenaEngine || !data || data.ok !== true || data.requestId !== requestId || (!localGraphContract && data.contractVersion !== svetovalecAtenaEngine.contractVersion) || !Array.isArray(data.selections) || !Array.isArray(data.facts)) return false;
    const izbraneStoritve = new Set();
    const izbraniPari = new Set();
    const izbraniModuli = new Map();
    const izboriVeljavni = data.selections.length <= 3 && data.selections.every(function (selection) {
      const service = svetovalecAtenaEngine.getService(selection.serviceCode);
      const area = service && service.areas.find(function (candidate) { return candidate.code === selection.areaCode; });
      const par = selection.serviceId + ":" + selection.areaCode;
      if (!service || service.id !== selection.serviceId || !area || izbraniPari.has(par) || !Array.isArray(selection.moduleIds) || !selection.moduleIds.length || selection.moduleIds.some(function (id) { return !area.moduleIds.includes(Number(id)); }) || typeof selection.evidence !== "string" || sourceText.indexOf(selection.evidence) < 0) return false;
      izbraneStoritve.add(service.id);
      izbraniPari.add(par);
      if (!izbraniModuli.has(service.id)) izbraniModuli.set(service.id, new Set());
      selection.moduleIds.forEach(function (id) { izbraniModuli.get(service.id).add(Number(id)); });
      return true;
    });
    if (!izboriVeljavni) return false;
    const dejstvaVeljavna = data.facts.every(function (fact) {
      let fieldDefinition = null;
      const factValue = typeof fact.value === "string" ? fact.value.trim() : "";
      const fieldCard = (atenaCardSchema.catalog || []).find(function (card) {
        if (card.flow !== fact.serviceCode || !izbraniModuli.get(fact.serviceId).has(Number(card.moduleId))) return false;
        fieldDefinition = card.fields.find(function (field) { return Number(field.id) === fact.fieldId; }) || null;
        return Boolean(fieldDefinition);
      });
      const kanonicnaIzbira = !fieldDefinition || !Array.isArray(fieldDefinition.options) || !fieldDefinition.options.length || fieldDefinition.options.some(function (option) { return String(option.id) === factValue; });
      return izbraneStoritve.has(fact.serviceId) && Number.isInteger(fact.fieldId) && Boolean(factValue) && typeof fact.evidence === "string" && sourceText.indexOf(fact.evidence) >= 0 && Boolean(fieldCard) && kanonicnaIzbira;
    });
    const pojasniloVeljavno = data.clarification === null || Boolean(svetovalecClarificationEngine && svetovalecClarificationEngine.normalize(data.clarification, sourceText));
    const batchVeljaven = data.clarification
      ? data.questionBatch === null
      : Boolean(data.questionBatch && data.questionBatch.source === "local-graph" && data.questionBatch.graphVersion === "svetovalec-question-graph-v1" && ["ask","review"].includes(data.questionBatch.state) && Array.isArray(data.questionBatch.questions) && (data.questionBatch.state === "review" ? data.questionBatch.questions.length === 0 : data.questionBatch.questions.length >= 3 && data.questionBatch.questions.length <= 4) && data.questionBatch.questions.every(function (question) { if (!question || !question.interfaceId || !question.fieldInterfaceId || question.contextVersion !== "atena-interface-context-v3" || !Array.isArray(question.options) || !ATENA_VODENI_RENDERERJI[question.widgetId]) return false; if (question.kind === "single" || question.kind === "multiple") return question.options.length >= 2; return ["range","money","date","quantity","text"].includes(question.kind) && question.options.length === 0; }) && typeof data.questionBatch.evidence === "string" && sourceText.includes(data.questionBatch.evidence));
    return dejstvaVeljavna && pojasniloVeljavno && batchVeljaven && (data.selections.length > 0 || Boolean(data.clarification) || Boolean(data.questionBatch));
  }

  async function nadaljujAtenaPoSklopu() {
    if (atenaSklopZahtevaAktivna || !atenaConversationFlow || atenaConversationFlow.status !== "batch-ready" || !svetovalecConversationFlow.conversationContext) return;
    const context = svetovalecConversationFlow.conversationContext(atenaConversationFlow);
    if (!context) return;
    const sessionId = atenaConversationFlow.id;
    const revision = atenaConversationFlow.revision;
    const replanning = svetovalecConversationFlow.setReplanning(atenaConversationFlow);
    if (!replanning) return;
    atenaConversationFlow = replanning; atenaSklopZahtevaAktivna = true; shraniAtenaConversationFlow(); izrisiAtenaConversationFlow(); pokaziStatus("Pripravljam naslednji sklop vprašanj.", false);
    try {
      const result = await razcleniSvetovalecZLuno(atenaConversationFlow.sourceText, context);
      if (!atenaConversationFlow || atenaConversationFlow.id !== sessionId || atenaConversationFlow.revision !== revision) return;
      const next = svetovalecConversationFlow.appendBatch(atenaConversationFlow, result.questionBatch);
      if (!next) throw new Error("Luna ni vrnila veljavnega naslednjega sklopa.");
      atenaConversationFlow = next; shraniAtenaConversationFlow(); izrisiAtenaConversationFlow();
      pokaziStatus(next.status === "ready" ? "Odgovori so pripravljeni za predogled." : "Luna je prilagodila naslednji sklop vašim odgovorom.", false);
    } catch (error) {
      if (atenaConversationFlow && atenaConversationFlow.id === sessionId) { atenaConversationFlow.status = "batch-ready"; shraniAtenaConversationFlow(); izrisiAtenaConversationFlow(); }
      pokaziStatus(error && error.message || "Naslednjega sklopa trenutno ni mogoče pripraviti.", true);
    } finally { atenaSklopZahtevaAktivna = false; }
  }

  function uporabiLunaIzbor(selection, facts, sourceText, odpriObrazec) {
    if (!selection || !svetovalecAtenaEngine.dispatch(selection.actionId, { openService: odpriPonudbaNacin })) return false;
    ponudbaOsnutek.sourceText = sourceText;
    ponudbaOsnutek.reviewReady = true;
    (facts || []).filter(function (fact) { return fact.serviceId === selection.serviceId; }).forEach(function (fact) {
      ponudbaOsnutek.answers[fact.fieldId] = fact.value;
    });
    shraniPonudbaOsnutek();
    posodobiPonudbaPovzetek();
    if (odpriObrazec) odpriPonudbaObrazec(selection.areaCode);
    return true;
  }

  function izrisiLunaSvetovalecPredloge(selections, facts, sourceText) {
    if (!atenaCardRenderer || !atenaPredlogi) return;
    const predlogi = selections.map(function (selection) {
      return { code: selection.serviceCode + ":" + selection.areaCode, label: selection.serviceTitle + " · " + selection.areaLabel, moduleIds: selection.moduleIds, ariaLabel: "Odpri " + selection.serviceTitle + ", področje " + selection.areaLabel, selection: selection };
    });
    atenaCardRenderer.renderAreas(atenaPredlogi, predlogi, { heading: "Atena je prepoznala več ločenih potreb", onOpen: function (predlog) {
      uporabiLunaIzbor(predlog.selection, facts, sourceText, true);
    }});
  }

  async function razcleniSvetovalecZLuno(sourceText, conversation) {
    const accessToken = await svetovalecAccessToken();
    const requestId = svetovalecRequestId();
    const file = datoteka && datoteka.files && datoteka.files[0];
    const headers = { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" };
    if (jeLokalniSvetovalecPredogled()) headers["X-UJ-Local-Preview"] = "1";
    const response = await fetch("/api/razcleni-svetovalec", {
      method: "POST", headers: headers,
      body: JSON.stringify({ requestId: requestId, text: sourceText, activeServiceCode: document.body.classList.contains("is-ponudba-mode") ? aktivnaStoritevKoda : null, clarificationAnswer:atenaPojasniloOdgovor, conversation:conversation || null, company: lunaKontekstPodjetja(), attachment: file ? { name:file.name, type:file.type, size:file.size } : null })
    });
    const data = await response.json().catch(function () { return null; });
    if (!response.ok) throw new Error(data && data.napaka || "Atena trenutno ni dosegljiva.");
    if (!preveriLunaSvetovalecRezultat(data, requestId, sourceText)) throw new Error("Atenin odgovor ni skladen z veljavnim katalogom.");
    return data;
  }

  if (gumbPreverba) {
    gumbPreverba.addEventListener("click", async function () {
      const novVnos = varnoBesedilo(opis && opis.value);
      if (!document.body.classList.contains("is-ponudba-mode") && novVnos && atenaConversationFlow && varnoBesedilo(atenaConversationFlow.sourceText) !== novVnos) {
        atenaConversationFlow = null;
        shraniAtenaConversationFlow();
      }
      if (atenaConversationFlow && atenaConversationFlow.status === "preview") {
        const confirmed = svetovalecConversationFlow.confirm(atenaConversationFlow);
        if (!confirmed) return;
        const serviceCodes = confirmed.result.serviceCodes || [];
        atenaConversationFlow = null;
        shraniAtenaConversationFlow();
        document.body.classList.remove("has-atena-guided-flow", "is-atena-flow-draft");
        if (atenaKoraki) atenaKoraki.hidden = true;
        const target = serviceCodes.map(function (code) { return document.querySelector('[data-storitev="' + code + '"]'); }).find(Boolean);
        if (target) target.click();
        else pokaziStatus("Izbranega nadaljevanja trenutno ni mogoče odpreti.", true);
        return;
      }
      if (atenaConversationFlow && atenaConversationFlow.status === "ready") {
        const serviceCodes = dolociAtenaFlowStoritve();
        const preview = svetovalecConversationFlow.preview(atenaConversationFlow, { serviceCodes:serviceCodes });
        if (!preview) { pokaziStatus("Preverite vse odgovore, preden odprete predogled.", true); return; }
        atenaConversationFlow = preview;
        shraniAtenaConversationFlow();
        izrisiAtenaConversationFlow();
        pokaziStatus("Preverite predogled in ga nato potrdite.", false);
        return;
      }
      const imaOpis = Boolean(opis && opis.value.trim());
      const imaDatoteko = Boolean(datoteka && datoteka.files && datoteka.files.length);
      if (!imaOpis && !imaDatoteko) {
        pokaziStatus("Opišite, kaj potrebujete, ali dodajte ponudbo.", true);
        if (opis) opis.focus();
        return;
      }
      if (!imaOpis && imaDatoteko) {
        pokaziStatus("Dodajte še kratek opis. Ime datoteke samo po sebi ni vsebina dokumenta.", true);
        if (opis) opis.focus();
        return;
      }
      const mirujoceBesedilo = atenaPrimarniBesedilo ? atenaPrimarniBesedilo.textContent : "Začni preverbo";
      const opisObZagonu = varnoBesedilo(opis && opis.value);
      dodajAtenaPogovornoSporocilo("uporabnik", opisObZagonu, true);
      const pogovorniVir = document.body.classList.contains("is-ponudba-mode") ? sestaviAtenaPogovorniVir() : opisObZagonu;
      if (opis) opis.value = "";
      prilagodiVisinoAtenaDoma();
      pokaziAtenaTipkanje();
      let koncnoBesedilo = mirujoceBesedilo;
      pocistiLunaKartice();
      const analizaZacetek = zacniAtenaAnalizo();
      try {
        await pocakajNaAtenaRazsiritev(analizaZacetek);
        const lunaRezultat = await razcleniSvetovalecZLuno(pogovorniVir);
        skrijAtenaTipkanje();
        if (lunaRezultat.questionBatch && svetovalecConversationFlow) {
          const lunaFlow = svetovalecConversationFlow.create(pogovorniVir, lunaRezultat.questionBatch);
          if (!lunaFlow) throw new Error("Lunin načrt vprašanj ni veljaven.");
          atenaConversationFlow = lunaFlow;
          shraniAtenaConversationFlow();
          izrisiAtenaConversationFlow();
          pokaziStatus("Luna je pripravila naslednje korake.", false);
        } else if (lunaRezultat.clarification) {
          pocistiAtenaPredloge();
          const pojasnilo = svetovalecClarificationEngine.normalize(lunaRezultat.clarification, pogovorniVir);
          if (pojasnilo && pojasnilo.mode === "widget") {
            pokaziStatus(pojasnilo.definition.question, false);
            if (!zacniAtenaConversationFlow(lunaRezultat.clarification, pogovorniVir)) dodajAtenaPojasnilniWidget(lunaRezultat.clarification, pogovorniVir);
          } else if (pojasnilo) {
            pokaziStatus(pojasnilo.question, false);
            dodajAtenaPogovornoSporocilo("atena", pojasnilo.question, true);
            shraniAtenaPogovorniFallback(pojasnilo, pogovorniVir);
            if (opis) opis.focus();
          }
        } else {
          zapriPonudbaNacin();
          oznaciLunaKartice(lunaRezultat.selections, lunaRezultat.facts, pogovorniVir);
          dodajAtenaPogovornoSporocilo("atena", odgovorAteneZaIzbore(lunaRezultat.selections), true);
          pokaziStatus(lunaKarticePoStoritvi.size === 1
            ? "Atena je označila pravo kartico. Kliknite »Odgovori« za nadaljevanje."
            : "Atena je označila ustrezne kartice. Kliknite »Odgovori« pri tisti, s katero želite začeti.", false);
        }
        atenaPojasniloOdgovor = null;
        koncnoBesedilo = document.body.classList.contains("is-ponudba-mode")
          ? (ponudbaOsnutek.reviewReady ? "Posodobi pregled" : aktivnaStoritevMeta.primary)
          : "Poizveduj";
      } catch (error) {
        skrijAtenaTipkanje();
        const sporociloNapake = error && error.message || "Preverbe trenutno ni bilo mogoče pripraviti.";
        pokaziStatus(sporociloNapake, true);
        dodajAtenaPogovornoSporocilo("atena", sporociloNapake, true);
      } finally {
        koncajAtenaAnalizo(koncnoBesedilo);
      }
    });
  }

  if (svetovalecConversationFlow) {
    try {
      const restored = svetovalecConversationFlow.restore(window.localStorage.getItem(ATENA_FLOW_STORAGE_KEY));
      if (restored && restored.status !== "confirmed") { atenaConversationFlow = restored; izrisiAtenaConversationFlow(); }
    } catch (_error) {}
  }

  window.addEventListener("pagehide", function () {
    ustaviAtenaAnalizaStatus();
    atenaAnalizaAktivna = false;
    atenaPrekinitevPoZagonu = false;
    nastaviAtenaKontekstZaklep(false);
  });
})();
