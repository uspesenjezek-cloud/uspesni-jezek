/* Skupna nastavitev vklopljenih kartic za PC in telefon. */
(function (root) {
  "use strict";

  var TABELA = "opomin_kartice_nastavitve";
  var TABELA_OSNUTEK = "opomin_osnutek_sync";
  var KLJUC_PLANA = "neplacilo-korak3-nacrt";
  var KLJUC_KORAK1 = "neplacilo-korak1-podatki";
  var KLJUC_KORAK2 = "neplacilo-korak2-podatki";
  var CLIENT_ID =
    "uj-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  var uporabnikId = null;
  var kanal = null;
  var osnutekKanal = null;
  var nalaganje = null;
  var oddaljenaNastavitev = null;
  var zapisovalnaVrsta = Promise.resolve();
  var zadnjiPredajaPodpis = null;
  var zadnjiOsnutekCas = 0;
  var dovoljenoShranjevanjeOsnutka = false;

  function preberiJson(kljuc) {
    try {
      var surovo = sessionStorage.getItem(kljuc);
      return surovo ? JSON.parse(surovo) : null;
    } catch (_e) {
      return null;
    }
  }

  function preberiPlan() {
    try {
      var surovo = sessionStorage.getItem(KLJUC_PLANA);
      var plan = surovo ? JSON.parse(surovo) : null;
      return plan && Array.isArray(plan.steps) ? plan : null;
    } catch (_e) {
      return null;
    }
  }

  function shraniPlanVSejo(plan) {
    if (!plan || !Array.isArray(plan.steps)) return;
    plan.stages = plan.steps;
    sessionStorage.setItem(KLJUC_PLANA, JSON.stringify(plan));
  }

  function preberiCelotenOsnutek(plan) {
    var k1 = preberiJson(KLJUC_KORAK1);
    var k2 = preberiJson(KLJUC_KORAK2);
    var nacrt = plan || preberiPlan();
    if (!k1 || !k2 || !nacrt || !Array.isArray(nacrt.steps)) return null;
    return {
      korak1: JSON.parse(JSON.stringify(k1)),
      korak2: JSON.parse(JSON.stringify(k2)),
      nacrt: JSON.parse(JSON.stringify(nacrt)),
    };
  }

  function uporabiCelotenOsnutek(vrstica) {
    if (!vrstica || !vrstica.korak1 || !vrstica.korak2 || !vrstica.nacrt) {
      return false;
    }
    sessionStorage.setItem(KLJUC_KORAK1, JSON.stringify(vrstica.korak1));
    sessionStorage.setItem(KLJUC_KORAK2, JSON.stringify(vrstica.korak2));
    shraniPlanVSejo(JSON.parse(JSON.stringify(vrstica.nacrt)));
    zadnjiOsnutekCas = Date.parse(vrstica.sync_updated_at || "") || Date.now();
    dovoljenoShranjevanjeOsnutka = true;
    return true;
  }

  function jeAppleMobilnaNaprava() {
    var nav = root.navigator || {};
    var ua = String(nav.userAgent || "");
    return (
      /iPhone|iPad|iPod/i.test(ua) ||
      (nav.platform === "MacIntel" && Number(nav.maxTouchPoints || 0) > 1)
    );
  }

  function vkljuceniIndeksi(plan) {
    var indeksi = (plan.steps || [])
      .filter(function (step) { return !step.isExcluded; })
      .map(function (step) { return Number(step.index); })
      .filter(function (index) {
        return Number.isInteger(index) && index >= 1 && index <= 10;
      });
    if (indeksi.indexOf(1) < 0) indeksi.unshift(1);
    if (indeksi.indexOf(10) < 0) indeksi.push(10);
    return indeksi;
  }

  function predajaKorak(plan) {
    var koraki = (plan && plan.steps) || [];
    for (var i = koraki.length - 1; i >= 0; i -= 1) {
      if (koraki[i].kind === "manual_lawyer" || koraki[i].deliveryMode === "manual") {
        return koraki[i];
      }
    }
    return null;
  }

  function predajaPodatki(plan) {
    var korak = predajaKorak(plan);
    if (!korak || !korak.lawyerHandoff) return null;
    return JSON.parse(JSON.stringify({
      title: korak.title || "Predaja odvetniku",
      scheduledAt: korak.scheduledAt || korak.sendAt || null,
      status: korak.status || "draft",
      lawyerHandoff: korak.lawyerHandoff,
    }));
  }

  function predajaPodpis(plan) {
    return JSON.stringify(predajaPodatki(plan));
  }

  function predajaImaIzbranegaOdvetnika(podatki) {
    var snapshot =
      podatki && podatki.lawyerHandoff && podatki.lawyerHandoff.lawyerSnapshot;
    return Boolean(snapshot && String(snapshot.name || "").trim());
  }

  function uporabiPredajo(plan, podatki, updatedAt) {
    if (!plan || !predajaImaIzbranegaOdvetnika(podatki)) return false;
    var korak = predajaKorak(plan);
    if (!korak) return false;
    var oddaljeniCas = Date.parse(updatedAt || "") || 0;
    var lokalniCas = Date.parse(plan._predajaUpdatedAt || "") || 0;
    if (lokalniCas > oddaljeniCas) return false;
    korak.title = podatki.title || korak.title;
    if (podatki.scheduledAt) {
      korak.scheduledAt = podatki.scheduledAt;
      korak.sendAt = podatki.scheduledAt;
    }
    korak.status = podatki.status || korak.status;
    korak.lawyerHandoff = JSON.parse(JSON.stringify(podatki.lawyerHandoff));
    plan._predajaUpdatedAt = updatedAt || new Date().toISOString();
    zadnjiPredajaPodpis = predajaPodpis(plan);
    return true;
  }

  function uporabiIndekse(plan, indeksi, settingsUpdatedAt) {
    if (!plan || !Array.isArray(plan.steps)) return plan;
    var dovoljeni = new Set((indeksi || []).map(Number));
    dovoljeni.add(1);
    var zadnji = plan.steps[plan.steps.length - 1];
    if (zadnji) dovoljeni.add(Number(zadnji.index));
    plan.steps.forEach(function (step) {
      step.isExcluded = !dovoljeni.has(Number(step.index));
    });
    var N = root.UJOpominNacrt;
    if (N && typeof N.preracunajOdmikePoIzkljucitvi === "function") {
      plan = N.preracunajOdmikePoIzkljucitvi(plan);
    }
    if (N && typeof N.uskladiOffseteIzDatumov === "function") {
      plan = N.uskladiOffseteIzDatumov(plan);
    }
    plan._karticeUpdatedAt = settingsUpdatedAt || new Date().toISOString();
    shraniPlanVSejo(plan);
    return plan;
  }

  async function pridobiUporabnika() {
    if (uporabnikId) return uporabnikId;
    if (typeof supabaseKlient === "undefined" || !supabaseKlient.auth) return null;
    var rezultat = await supabaseKlient.auth.getUser();
    uporabnikId = rezultat && rezultat.data && rezultat.data.user
      ? rezultat.data.user.id
      : null;
    return uporabnikId;
  }

  async function shraniNastavitev(indeksi, predaja, predajaUpdatedAt, settingsUpdatedAt) {
    var uid = await pridobiUporabnika();
    if (!uid) return false;
    var rezultat = await supabaseKlient.rpc("sinhroniziraj_opomin_kartice", {
      p_vkljuceni_indeksi: indeksi,
      p_client_id: CLIENT_ID,
      p_settings_updated_at: settingsUpdatedAt || new Date().toISOString(),
      p_predaja_odvetniku: predaja,
      p_predaja_updated_at: predajaUpdatedAt || null,
    });
    if (rezultat.error) throw rezultat.error;
    return true;
  }

  async function shraniCelotenOsnutek(osnutek, syncUpdatedAt) {
    if (!osnutek || !dovoljenoShranjevanjeOsnutka) return false;
    var rezultat = await supabaseKlient.rpc("sinhroniziraj_opomin_osnutek", {
      p_korak1: osnutek.korak1,
      p_korak2: osnutek.korak2,
      p_nacrt: osnutek.nacrt,
      p_client_id: CLIENT_ID,
      p_sync_updated_at: syncUpdatedAt,
    });
    if (rezultat.error) throw rezultat.error;
    zadnjiOsnutekCas = Date.parse(syncUpdatedAt || "") || Date.now();
    return true;
  }

  function narociShranjevanje(plan) {
    if (!plan) return;
    plan._karticeUpdatedAt = new Date().toISOString();
    var indeksiObKliki = vkljuceniIndeksi(plan);
    var podpisObKliki = predajaPodpis(plan);
    var predajaObKliki = predajaPodatki(plan);
    var veljavnaPredaja = predajaImaIzbranegaOdvetnika(predajaObKliki);
    if (veljavnaPredaja && zadnjiPredajaPodpis !== podpisObKliki) {
      plan._predajaUpdatedAt = new Date().toISOString();
      zadnjiPredajaPodpis = podpisObKliki;
      shraniPlanVSejo(plan);
    }
    if (!veljavnaPredaja) predajaObKliki = null;
    var predajaCasObKliki = plan._predajaUpdatedAt || plan.updatedAt || null;
    var celotenOsnutekObKliki = preberiCelotenOsnutek(plan);
    var osnutekCasObKliki = new Date().toISOString();
    zapisovalnaVrsta = zapisovalnaVrsta
      .catch(function () {
        /* Prejsnja napaka ne sme ustaviti naslednjega uporabnikovega klika. */
      })
      .then(function () {
        return Promise.all([
          shraniNastavitev(
            indeksiObKliki,
            predajaObKliki,
            predajaCasObKliki,
            plan._karticeUpdatedAt
          ),
          shraniCelotenOsnutek(celotenOsnutekObKliki, osnutekCasObKliki),
        ]);
      })
      .catch(function (napaka) {
        console.warn("Nastavitev kartic se ni sinhronizirala:", napaka);
      });
    return zapisovalnaVrsta;
  }

  function zacniPoslusanjeOsnutka(uid) {
    if (osnutekKanal || !uid) return;
    osnutekKanal = supabaseKlient
      .channel("opomin-osnutek-" + uid)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: TABELA_OSNUTEK,
          filter: "user_id=eq." + uid,
        },
        function (dogodek) {
          var vrstica = dogodek && dogodek.new;
          if (!vrstica || vrstica.client_id === CLIENT_ID) return;
          var oddaljeniCas = Date.parse(vrstica.sync_updated_at || "") || 0;
          if (oddaljeniCas && oddaljeniCas <= zadnjiOsnutekCas) return;
          if (uporabiCelotenOsnutek(vrstica)) root.location.reload();
        }
      )
      .subscribe();
  }

  async function naloziCelotenOsnutek(uid, lokalniPlan) {
    var rezultat = await supabaseKlient
      .from(TABELA_OSNUTEK)
      .select("korak1,korak2,nacrt,client_id,sync_updated_at")
      .eq("user_id", uid)
      .maybeSingle();
    if (rezultat.error) throw rezultat.error;
    if (rezultat.data) {
      uporabiCelotenOsnutek(rezultat.data);
    } else if (jeAppleMobilnaNaprava()) {
      /* Pri prvem prehodu je iPhone uporabnikov potrjeni vir najnovejsega
         osnutka. PC do prvega skupnega zapisa samo bere in zato ne more
         prepisati telefona s starejsimi lokalnimi podatki. */
      var lokalniOsnutek = preberiCelotenOsnutek(lokalniPlan);
      if (lokalniOsnutek) {
        dovoljenoShranjevanjeOsnutka = true;
        await shraniCelotenOsnutek(lokalniOsnutek, new Date().toISOString());
      }
    }
    zacniPoslusanjeOsnutka(uid);
  }

  function zacniPoslusanje(uid) {
    if (kanal || !uid) return;
    kanal = supabaseKlient
      .channel("opomin-kartice-" + uid)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: TABELA,
          filter: "user_id=eq." + uid,
        },
        function (dogodek) {
          var vrstica = dogodek && dogodek.new;
          if (!vrstica || vrstica.client_id === CLIENT_ID) return;
          var plan = preberiPlan();
          if (!plan) {
            oddaljenaNastavitev = vrstica;
            return;
          }
          var spremenjeno = uporabiPredajo(
            plan,
            vrstica.predaja_odvetniku,
            vrstica.predaja_updated_at
          );
          uporabiIndekse(
            plan,
            vrstica.vkljuceni_indeksi,
            vrstica.settings_updated_at
          );
          if (spremenjeno || vrstica.settings_updated_at) root.location.reload();
        }
      )
      .subscribe();
  }

  async function naloziPredZagonom() {
    if (nalaganje) return nalaganje;
    nalaganje = (async function () {
      var uid = await pridobiUporabnika();
      var plan = preberiPlan();
      if (!uid) return false;
      await naloziCelotenOsnutek(uid, plan);
      plan = preberiPlan();
      var rezultat = await supabaseKlient
        .from(TABELA)
        .select("vkljuceni_indeksi,client_id,settings_updated_at,predaja_odvetniku,predaja_updated_at")
        .eq("user_id", uid)
        .maybeSingle();
      if (rezultat.error) throw rezultat.error;
      if (!rezultat.data) {
        if (plan) {
          plan._predajaUpdatedAt = plan._predajaUpdatedAt || plan.updatedAt || new Date().toISOString();
          zadnjiPredajaPodpis = predajaPodpis(plan);
          await shraniNastavitev(
            vkljuceniIndeksi(plan),
            predajaPodatki(plan),
            plan._predajaUpdatedAt,
            plan._karticeUpdatedAt || new Date().toISOString()
          );
        }
      } else if (!plan) {
        oddaljenaNastavitev = rezultat.data;
      } else {
        /* Ob zagonu je baza edini vir resnice. Lokalni osnutek se nikoli
           samodejno ne poslje nazaj, zato stara naprava ne more prepisati
           novejse izbire samo zato, ker je bila osvezena. */
        uporabiIndekse(
          plan,
          rezultat.data.vkljuceni_indeksi,
          rezultat.data.settings_updated_at
        );
        var remoteCas = Date.parse(rezultat.data.predaja_updated_at || "") || 0;
        var localCas = Date.parse(plan._predajaUpdatedAt || plan.updatedAt || "") || 0;
        var oddaljenaVeljavna = predajaImaIzbranegaOdvetnika(
          rezultat.data.predaja_odvetniku
        );
        var lokalnaPredaja = predajaPodatki(plan);
        var lokalnaVeljavna = predajaImaIzbranegaOdvetnika(lokalnaPredaja);
        if (oddaljenaVeljavna && (!lokalnaVeljavna || remoteCas >= localCas)) {
          uporabiPredajo(plan, rezultat.data.predaja_odvetniku, rezultat.data.predaja_updated_at);
          shraniPlanVSejo(plan);
        } else if (lokalnaVeljavna) {
          plan._predajaUpdatedAt = plan._predajaUpdatedAt || plan.updatedAt || new Date().toISOString();
          zadnjiPredajaPodpis = predajaPodpis(plan);
          await shraniNastavitev(
            vkljuceniIndeksi(plan),
            lokalnaPredaja,
            plan._predajaUpdatedAt,
            rezultat.data.settings_updated_at
          );
        }
      }
      zacniPoslusanje(uid);
      return true;
    })().catch(function (napaka) {
      console.warn("Nastavitve kartic ni bilo mogoce naloziti:", napaka);
      return false;
    });
    return nalaganje;
  }

  function uporabiNaPlan(plan) {
    if (!plan || !oddaljenaNastavitev) return plan;
    plan = uporabiIndekse(
      plan,
      oddaljenaNastavitev.vkljuceni_indeksi,
      oddaljenaNastavitev.settings_updated_at
    );
    uporabiPredajo(
      plan,
      oddaljenaNastavitev.predaja_odvetniku,
      oddaljenaNastavitev.predaja_updated_at
    );
    zadnjiPredajaPodpis = predajaPodpis(plan);
    oddaljenaNastavitev = null;
    return plan;
  }

  root.UJOpominKarticeSync = {
    naloziPredZagonom: naloziPredZagonom,
    narociShranjevanje: narociShranjevanje,
    uporabiNaPlan: uporabiNaPlan,
  };
})(window);
