/* ==========================================================
   izvedba-api.js
   Tanek klient za produkcijske API poti strani "Izvedba". Nikoli ne
   piše produkcijskih podatkov v localStorage/sessionStorage - vsako
   dejanje gre prek strežniške API poti, ki kliče atomsko RPC.
   window.UJIzvedbaApi
   ========================================================== */
(function (root) {
  "use strict";

  var lokalniPredogled = false;

  async function pridobiToken() {
    var seja = await supabaseKlient.auth.getSession();
    var token = seja && seja.data && seja.data.session && seja.data.session.access_token;
    if (!token) {
      var napaka = new Error("Prijava je potekla. Prijavite se znova.");
      napaka.code = "NI_PRIJAVLJEN";
      throw napaka;
    }
    return token;
  }

  async function posljiJson(pot, telo) {
    var token = await pridobiToken();
    var odgovor = await fetch(pot, {
      method: telo ? "POST" : "GET",
      headers: Object.assign(
        { Authorization: "Bearer " + token },
        telo ? { "Content-Type": "application/json" } : {}
      ),
      body: telo ? JSON.stringify(telo) : undefined,
    });
    var podatki = null;
    try { podatki = await odgovor.json(); } catch (e) { /* prazen/neveljaven odgovor */ }
    if (!odgovor.ok) {
      var napaka = new Error((podatki && podatki.napaka) || "Zahteva ni uspela.");
      napaka.status = odgovor.status;
      napaka.code = podatki && podatki.code;
      napaka.podatki = podatki;
      throw napaka;
    }
    return podatki;
  }

  async function nalozi(params) {
    var qs = Object.keys(params || {})
      .filter(function (k) { return params[k] != null && params[k] !== ""; })
      .map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); })
      .join("&");
    try {
      lokalniPredogled = false;
      return await posljiJson("/api/pridobi-izvedbo" + (qs ? "?" + qs : ""), null);
    } catch (napaka) {
      /* Lokalni razvojni strežnik nima produkcijske API poti in tabel
         izvedbe. Aktivni načrt je kljub temu varno shranjen na zadevi,
         zato ga za predogled preberemo prek prijavljenega Supabase
         odjemalca. Pri 401/403 nikoli ne obidemo preverjanja dostopa. */
      if (params && params.zadevaId && napaka && [404, 500, 502, 503].indexOf(napaka.status) >= 0) {
        lokalniPredogled = true;
        return naloziLokalniPredogled(params);
      }
      throw napaka;
    }
  }

  function prejemnikiKoraka(step, osnovniTelefon) {
    var rezultat = [];
    var videni = Object.create(null);
    function dodaj(telefon) {
      var vrednost = String(telefon || "").trim();
      if (!vrednost || videni[vrednost]) return;
      videni[vrednost] = true;
      rezultat.push(vrednost);
    }
    if (!step.primaryContacts || step.primaryContacts.sms !== false) dodaj(osnovniTelefon);
    var dodatni = step.customContacts && step.customContacts.phoneNumbers;
    if (Array.isArray(dodatni)) dodatni.forEach(dodaj);
    return rezultat;
  }

  function vrsticeIzNacrta(plan, zadeva) {
    var vrstice = [];
    (plan.steps || []).forEach(function (step, polozaj) {
      if (!step || step.isExcluded || step.kind === "manual_lawyer" || step.deliveryMode === "manual") return;
      var stepId = String(step.stepId || step.id || ("step-" + (polozaj + 1)));
      var stanje = String(step.executionState || step.execution_state || "");
      if (!stanje) {
        var status = String(step.status || "");
        stanje = ["sent", "cancelled", "skipped"].indexOf(status) >= 0 ? status : "scheduled";
        var termin = Date.parse(step.sendAt || step.scheduledAt || "");
        if (stanje === "scheduled" && Number.isFinite(termin) && termin <= Date.now()) stanje = "awaiting_confirmation";
      }
      var telefoni = prejemnikiKoraka(step, zadeva.telefon_dolznika);
      if (!telefoni.length) telefoni = [""];
      telefoni.forEach(function (telefon, recipientIndex) {
        vrstice.push({
          id: "local-" + stepId + "-" + recipientIndex,
          step_id: stepId,
          step_index: Number(step.index || step.order || (polozaj + 1)),
          recipient_index: recipientIndex,
          kanal: "sms",
          status: String(step.status || "scheduled"),
          execution_state: stanje,
          scheduled_at: step.sendAt || step.scheduledAt || null,
          sent_at: step.sentAt || null,
          sporocilo: String(step.finalMessage || step.generatedMessage || ""),
          prejemnik: telefon,
          last_error: null,
          cancel_reason: step.cancelReason || null,
          paused_until: step.pausedUntil || null,
          confirmed_by_user_at: step.confirmedAt || null,
        });
      });
    });
    return vrstice;
  }

  async function naloziLokalniPredogled(params) {
    if (typeof supabaseKlient === "undefined" || !supabaseKlient || !supabaseKlient.from) {
      throw new Error("Povezava s podatki ni pripravljena.");
    }
    var odgovor = await supabaseKlient
      .from("zadeve")
      .select(
        "id,ime_dolznika,opis_dolga,status,znesek,prvotni_znesek,preostali_dolg,placano_skupaj,poravnano_at,telefon_dolznika,email_dolznika,stevilka_racuna,datum_zapadlosti,opomin_nacrt"
      )
      .eq("id", params.zadevaId)
      .single();
    if (odgovor.error || !odgovor.data) {
      throw new Error((odgovor.error && odgovor.error.message) || "Aktivnega primera ni bilo mogo\u010de nalo\u017eiti.");
    }

    var zadeva = odgovor.data;
    var plan = zadeva.opomin_nacrt || {};
    if (!Array.isArray(plan.steps)) throw new Error("Na\u010drt aktivnega primera manjka.");
    var vrstice = vrsticeIzNacrta(plan, zadeva);
    var trenutni = params.stepId && vrstice.find(function (k) { return k.step_id === params.stepId; });
    if (!trenutni) {
      trenutni = vrstice.find(function (k) {
        return ["sent", "cancelled", "skipped"].indexOf(k.execution_state) < 0;
      }) || vrstice[0];
    }
    return {
      ok: true,
      localPreview: true,
      zadeva: {
        id: zadeva.id,
        imeDolznika: zadeva.ime_dolznika,
        opisDolga: zadeva.opis_dolga,
        status: zadeva.status,
        znesek: zadeva.znesek,
        prvotniZnesek: zadeva.prvotni_znesek != null ? zadeva.prvotni_znesek : zadeva.znesek,
        preostaliDolg: zadeva.preostali_dolg != null ? zadeva.preostali_dolg : zadeva.znesek,
        placanoSkupaj: zadeva.placano_skupaj != null ? zadeva.placano_skupaj : 0,
        poravnanoAt: zadeva.poravnano_at || null,
        telefonDolznika: zadeva.telefon_dolznika || "",
        emailDolznika: zadeva.email_dolznika || "",
        stevilkaRacuna: zadeva.stevilka_racuna || "",
        datumZapadlosti: zadeva.datum_zapadlosti || null,
      },
      plan: plan,
      steps: vrstice,
      ukrepi: [],
      currentStepId: trenutni ? trenutni.step_id : null,
      totalSteps: (plan.steps || []).filter(function (s) { return s && !s.isExcluded; }).length,
      emailNaVoljo: false,
    };
  }

  async function executeAction(payload) {
    return posljiJson("/api/izvedi-opomin-ukrep", payload);
  }

  async function posljiZdaj(payload) {
    return posljiJson("/api/poslji-opomin-zdaj", payload);
  }

  /* En Realtime kanal na zadevo, ločen filter na tabelo (KROG 2-7/H).
     onChange se pokliče na vsak relevanten dogodek in ob (ponovni)
     vzpostavitvi povezave - odjemalec (izvedba.js) poskrbi za dedupe. */
  function narociRealtime(zadevaId, onChange, onStatusChange) {
    var kanal = supabaseKlient
      .channel("izvedba-" + zadevaId)
      .on("postgres_changes", { event: "*", schema: "public", table: "zadeve", filter: "id=eq." + zadevaId }, onChange);
    if (!lokalniPredogled) {
      kanal
        .on("postgres_changes", { event: "*", schema: "public", table: "opomin_koraki", filter: "zadeva_id=eq." + zadevaId }, onChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "opomin_ukrepi", filter: "zadeva_id=eq." + zadevaId }, onChange);
    }
    kanal
      .subscribe(function (status) {
        if (typeof onStatusChange === "function") onStatusChange(status);
      });
    return kanal;
  }

  function odjaviRealtime(kanal) {
    if (!kanal) return;
    try { supabaseKlient.removeChannel(kanal); } catch (e) { /* no-op */ }
  }

  root.UJIzvedbaApi = {
    nalozi: nalozi,
    executeAction: executeAction,
    posljiZdaj: posljiZdaj,
    narociRealtime: narociRealtime,
    odjaviRealtime: odjaviRealtime,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
