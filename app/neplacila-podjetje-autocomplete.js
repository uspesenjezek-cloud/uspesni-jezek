(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (!root || !root.document) return;
  root.UJPodjetjeAutocomplete = api;
  if (root.document.readyState === "loading") {
    root.document.addEventListener("DOMContentLoaded", function () { api.init(root.document, root); });
  } else {
    api.init(root.document, root);
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var CACHE_KEY = "uj:boniteta:company-suggestions:v1";
  var INDEX_VERSION = "2019-02-05-fast-prefix-v3";
  var STOP_WORDS = { ag: 1, co: 1, eg: 1, gbr: 1, gmbh: 1, kg: 1, mbh: 1, ohg: 1, partg: 1, se: 1, ug: 1, und: 1 };

  function text(value) { return String(value == null ? "" : value).trim(); }
  function normalize(value) {
    return text(value).replace(/ß/g, "ss").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("de-DE").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  }
  function fast(value) {
    return normalize(value).replace(/\s+/g, "");
  }
  function tokens(value) {
    var all = Array.from(new Set(normalize(value).split(" ").filter(function (token) { return token.length >= 2; })));
    var useful = all.filter(function (token) { return !STOP_WORDS[token]; });
    return useful.length ? useful : all;
  }
  function scoreName(name, query) {
    var wanted = normalize(query), found = normalize(name);
    if (!wanted || !found) return -1;
    var wantedTokens = tokens(query), foundTokens = new Set(found.split(" "));
    if (wantedTokens.some(function (token) { return !foundTokens.has(token); })) return -1;
    var score = wanted === found ? 2000 : found.indexOf(wanted) >= 0 ? 1400 : 0;
    score += wantedTokens.length * 250;
    score -= Math.max(0, foundTokens.size - normalize(query).split(" ").length) * 2;
    return score;
  }
  function candidateKey(company) {
    return text(company.companyId || company.company_id || company.id) ||
      [company.name, company.registerNumber || company.register_number, company.registerCourt || company.register_court]
        .filter(Boolean).join("|").toLocaleLowerCase("de-DE");
  }
  function first() {
    for (var i = 0; i < arguments.length; i += 1) if (text(arguments[i])) return text(arguments[i]);
    return "";
  }
  function mapObject(source) {
    var x = source && typeof source === "object" ? source : {};
    var address = x.address && typeof x.address === "object" ? x.address : {};
    var contact = x.contact && typeof x.contact === "object" ? x.contact : {};
    var latest = x.latest_check && typeof x.latest_check === "object" ? x.latest_check : {};
    var identity = latest.identity && typeof latest.identity === "object" ? latest.identity : {};
    return {
      companyId: first(x.companyId, x.company_id, x.id),
      name: first(x.name, x.legal_name, x.legalName, identity.name, identity.naziv, identity.ime),
      city: first(x.city, address.city),
      registerType: first(x.registerType, x.register_type),
      registerNumber: first(x.registerNumber, x.register_number),
      registerCourt: first(x.registerCourt, x.register_court),
      legalForm: first(x.legalForm, x.legal_form),
      identityProof: first(x.identityProof, x.identity_proof),
      checkedAt: first(x.checkedAt, x.checked_at),
      active: x.active !== false && x.company_status !== "inactive",
      vatId: first(x.vatId, x.vat_id, x.taxId, x.tax_id, contact.vatId, contact.vat_id, identity.vatId, identity.vat_id),
      contactPerson: first(x.contactPerson, x.contact_person, contact.contactPerson, contact.contact_person),
      phone: first(x.phone, contact.phone, identity.phone),
      email: first(x.email, contact.email, identity.email),
      source: first(x.source, x.company_id ? "saved_profile" : "cached_suggestion"),
    };
  }
  function mapRow(row) {
    if (!Array.isArray(row) || !text(row[0])) return null;
    return {
      name: text(row[0]), city: text(row[1]), registerType: text(row[2]), registerNumber: text(row[3]),
      registerCourt: text(row[4]), active: row[5] !== false, companyId: text(row[6]), source: "offeneregister",
      legalForm: "", identityProof: "", checkedAt: "", vatId: "", contactPerson: "", phone: "", email: "",
    };
  }
  function merge(primary, secondary) {
    var result = new Map();
    (primary || []).concat(secondary || []).forEach(function (item) {
      var mapped = Array.isArray(item) ? mapRow(item) : mapObject(item);
      var key = mapped && mapped.name && candidateKey(mapped);
      if (!key) return;
      if (!result.has(key)) result.set(key, mapped);
      else result.set(key, Object.assign({}, mapped, result.get(key)));
    });
    return Array.from(result.values());
  }
  function shardKey(query) { return (fast(query).slice(0, 2) + "__").slice(0, 2); }
  function prefix(query) {
    var legal = /^(gmbh|mbh|ag|kg|ohg|ug|eg|ev|se|co)$/i;
    var parts = text(query).split(/\s+/), selected = [];
    for (var i = 0; i < parts.length && selected.length < 3; i += 1) {
      var token = fast(parts[i]);
      if (!token || legal.test(token)) break;
      selected.push(token);
    }
    return selected.join("") || fast(query);
  }
  function filterRows(rows, query) {
    var start = prefix(query), limit = Math.max(48, text(query).length + 24);
    return (Array.isArray(rows) ? rows : []).filter(function (row) {
      return Array.isArray(row) && row[0] && fast(text(row[0]).slice(0, limit)).indexOf(start) === 0;
    }).slice(0, 240);
  }
  function rank(companies, query) {
    return (companies || []).map(function (company) { return { company: company, score: scoreName(company.name, query) }; })
      .filter(function (entry) { return entry.score >= 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .map(function (entry) { return entry.company; }).slice(0, 8);
  }
  function availableFields(company) {
    return [company.vatId && "davčna", company.contactPerson && "kontaktna oseba", company.phone && "telefon", company.email && "e-pošta"].filter(Boolean);
  }
  function sameCompany(left, right) {
    var leftId = text(left && (left.companyId || left.company_id || left.id));
    var rightId = text(right && (right.companyId || right.company_id || right.id));
    if (leftId && rightId) return leftId === rightId;
    var leftMapped = mapObject(left), rightMapped = mapObject(right);
    return Boolean(
      normalize(leftMapped.name) && normalize(leftMapped.name) === normalize(rightMapped.name) &&
      (!leftMapped.registerNumber || !rightMapped.registerNumber || leftMapped.registerNumber === rightMapped.registerNumber)
    );
  }
  function enrichCandidate(company, sources) {
    var match = (sources || []).find(function (source) { return sameCompany(company, source); });
    if (!match) return company;
    var enriched = Object.assign({}, company, mapObject(company));
    var supplement = mapObject(match);
    Object.keys(supplement).forEach(function (key) {
      if (!text(enriched[key]) && text(supplement[key])) enriched[key] = supplement[key];
    });
    return enriched;
  }

  function init(doc, win) {
    var input = doc.getElementById("naziv-podjetja");
    var list = doc.getElementById("naziv-podjetja-predlogi");
    var status = doc.getElementById("naziv-podjetja-status");
    if (!input || !list || input.dataset.companyAutocompleteReady === "true") return;
    input.dataset.companyAutocompleteReady = "true";
    var cached = [], profiles = [], profilesPromise = null, timer = 0, generation = 0, activeIndex = -1, shown = [], choosing = false;
    var accessToken = "";

    try { cached = JSON.parse(win.localStorage.getItem(CACHE_KEY) || "[]"); } catch (_) { cached = []; }
    function close() {
      list.hidden = true; list.innerHTML = ""; shown = []; activeIndex = -1;
      input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant");
    }
    function dismiss() {
      generation += 1;
      win.clearTimeout(timer);
      close();
    }
    function setStatus(message) {
      status.textContent = message || ""; status.hidden = !message;
    }
    function setHiddenValue(id, value) {
      var field = doc.getElementById(id);
      if (field) field.value = text(value);
    }
    function setCompanyIdentity(company, verifiedAt) {
      setHiddenValue("openregister-company-id", company.companyId || company.company_id);
      setHiddenValue("openregister-register-type", company.registerType || company.register_type);
      setHiddenValue("openregister-register-number", company.registerNumber || company.register_number);
      setHiddenValue("openregister-register-court", company.registerCourt || company.register_court);
      setHiddenValue("openregister-legal-form", company.legalForm || company.legal_form);
      setHiddenValue("openregister-verified-at", verifiedAt || company.checkedAt || company.checked_at);
    }
    function clearCompanyIdentity() { setCompanyIdentity({}, ""); }
    function details(company) {
      var register = [company.registerType, company.registerNumber].filter(Boolean).join(" ");
      return [register, company.registerCourt || company.city].filter(Boolean).join(" · ") || "Podjetje iz skupnega imenika";
    }
    function fill(id, value, overwrite) {
      var field = doc.getElementById(id);
      if (!field || !text(value)) return false;
      if (!overwrite && text(field.value)) return false;
      field.value = text(value);
      field.dispatchEvent(new win.Event("input", { bubbles: true }));
      field.dispatchEvent(new win.Event("change", { bubbles: true }));
      field.classList.add("obrazec__polje--imenik-izpolnjeno");
      field.addEventListener("input", function remove() { field.classList.remove("obrazec__polje--imenik-izpolnjeno"); field.removeEventListener("input", remove); }, { once: true });
      return true;
    }
    async function choose(company) {
      if (company && company.registryLookup) return searchRegistry(company.query);
      generation += 1;
      win.clearTimeout(timer);
      close();
      choosing = true;
      input.dataset.selectedCompany = candidateKey(company);
      setCompanyIdentity(company, company.identityProof ? new Date().toISOString() : company.checkedAt);
      var filled = [];
      if (fill("naziv-podjetja", company.name, true)) filled.push("naziv");
      choosing = false;
      setStatus("Dopolnjujem dosegljive podatke podjetja …");
      if (profilesPromise) await profilesPromise;
      company = enrichCandidate(company, profiles.concat(cached));
      setCompanyIdentity(company, company.identityProof ? new Date().toISOString() : company.checkedAt);
      if (company.identityProof && accessToken) {
        setStatus("Shranjujem preverjeno podjetje …");
        try {
          var saveResponse = await win.fetch("/api/boniteta-pro", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
            body: JSON.stringify({ action: "debtor_company_select", identityProof: company.identityProof }),
          });
          var saveData = await saveResponse.json().catch(function () { return {}; });
          if (!saveResponse.ok || !saveData.ok) throw new Error(saveData.napaka || "Podjetja ni bilo mogoče shraniti.");
          setCompanyIdentity(company, new Date().toISOString());
        } catch (error) {
          delete input.dataset.selectedCompany;
          clearCompanyIdentity();
          setStatus(error && error.message || "Podjetja ni bilo mogoče shraniti.");
          return;
        }
      }
      choosing = true;
      if (fill("davcna-stevilka", company.vatId)) filled.push("davčna");
      if (fill("kontaktna-oseba", company.contactPerson)) filled.push("kontaktna oseba");
      if (fill("telefon-dolznika", company.phone)) filled.push("telefon");
      if (fill("email-dolznika", company.email)) filled.push("e-pošta");
      choosing = false;
      setCompanyIdentity(company, company.identityProof ? new Date().toISOString() : company.checkedAt);
      setStatus(company.identityProof
        ? "Podjetje je preverjeno in shranjeno" + (company.creditsUsed === 1 ? " · porabljen 1 kredit." : " · brez novega kredita.")
        : filled.length > 1 ? "Izpolnjeni podatki: " + filled.join(", ") + "." : "Naziv podjetja je izpolnjen. Druge podatke dopolnite, če so na voljo.");
    }
    function registryAction(query) { return { registryLookup: true, query: query, name: "Ni med zadetki? Preveri v OpenRegisterju", registerCourt: "Največ 1 kredit · rezultat se shrani za naslednjič" }; }
    function renderRegistryAction(query) { render([registryAction(query)]); }
    async function searchRegistry(query) {
      close();
      if (!accessToken) { setStatus("Za 1-kreditno preverjanje se najprej prijavite."); return; }
      var ownGeneration = ++generation;
      setStatus("Preverjam OpenRegister · največ 1 kredit …");
      try {
        var response = await win.fetch("/api/boniteta-pro", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
          body: JSON.stringify({ action: "debtor_company_search", query: query }),
        });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok || !data.ok) throw new Error(data.napaka || "OpenRegister trenutno ni dosegljiv.");
        if (ownGeneration !== generation) return;
        var results = (data.results || []).map(function (company) {
          return Object.assign(mapObject(company), { creditsUsed: Number(data.creditsUsed || 0) });
        });
        render(rank(results, query));
        setStatus(results.length
          ? (data.creditsUsed === 1 ? "Najdeno v OpenRegisterju · porabljen 1 kredit. Izberite podjetje." : "Najdeno v shranjenih podatkih · brez novega kredita. Izberite podjetje.")
          : "OpenRegister ni našel ustreznega podjetja. Podatke vnesite ročno.");
      } catch (error) {
        if (ownGeneration === generation) setStatus(error && error.message || "OpenRegister trenutno ni dosegljiv.");
      }
    }
    function render(results) {
      shown = results; list.innerHTML = ""; activeIndex = -1;
      results.forEach(function (company, index) {
        var button = doc.createElement("button");
        button.type = "button"; button.className = "podjetje-autocomplete__zadetek"; button.id = "naziv-podjetja-predlog-" + index;
        if (company.registryLookup) button.classList.add("podjetje-autocomplete__zadetek--register");
        button.setAttribute("role", "option"); button.setAttribute("aria-selected", "false");
        var fields = availableFields(company);
        button.innerHTML = '<span><strong></strong><small></small></span><b>' + (company.registryLookup ? "Preveri" : fields.length ? "Izpolni " + (fields.length + 1) : "Izberi") + "</b>";
        button.querySelector("strong").textContent = company.name;
        button.querySelector("small").textContent = company.registryLookup ? company.registerCourt : details(company);
        button.addEventListener("click", function () { void choose(company); });
        list.appendChild(button);
      });
      list.hidden = !results.length; input.setAttribute("aria-expanded", results.length ? "true" : "false");
    }
    async function loadProfiles() {
      var client = typeof supabaseKlient !== "undefined" ? supabaseKlient : null;
      if (!client || !client.auth) return;
      try {
        var sessionResult = await client.auth.getSession();
        var token = sessionResult && sessionResult.data && sessionResult.data.session && sessionResult.data.session.access_token;
        if (!token) return;
        accessToken = token;
        var responses = await Promise.all([
          win.fetch("/api/boniteta-pro?route=profiles", { headers: { Authorization: "Bearer " + token }, cache: "no-store" }),
          win.fetch("/api/boniteta-pro", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ action: "debtor_company_list" }), cache: "no-store" }),
        ]);
        var data = await responses[0].json();
        var debtorData = await responses[1].json().catch(function () { return {}; });
        if (responses[0].ok && Array.isArray(data.profiles)) {
          profiles = data.profiles.concat(responses[1].ok && Array.isArray(debtorData.companies) ? debtorData.companies : []);
          if (doc.activeElement === input && text(input.value).length >= 3 && !input.dataset.selectedCompany) void search();
        }
      } catch (_) {}
    }
    async function search() {
      var query = text(input.value).replace(/\s+/g, " "), ownGeneration = ++generation;
      if (query.length < 3) { close(); setStatus(""); return; }
      try {
        var key = shardKey(query);
        var responses = await Promise.all([
          win.fetch("/app/company-index/" + encodeURIComponent(key) + ".json.gz?v=" + encodeURIComponent(INDEX_VERSION), { cache: "force-cache" }),
          win.fetch("/app/company-index/verified-additions.json?v=1", { cache: "force-cache" }),
        ]);
        var rows = responses[0].ok ? await responses[0].json() : [];
        var additions = responses[1].ok ? await responses[1].json() : [];
        if (doc.activeElement !== input || ownGeneration !== generation || query !== text(input.value).replace(/\s+/g, " ")) return;
        var local = filterRows(rows, query).concat(additions || []);
        var matches = rank(merge(profiles.concat(cached), local), query);
        render(matches.length ? matches.concat([registryAction(query)]) : [registryAction(query)]);
        if (!matches.length) setStatus("Podjetja še ni v imeniku. Preverite ga v OpenRegisterju z največ 1 kreditom ali ga vnesite ročno.");
        else setStatus("");
      } catch (_) {
        if (ownGeneration === generation) { close(); setStatus("Imenik trenutno ni dosegljiv. Podatke vnesite ročno."); }
      }
    }
    function move(delta) {
      var buttons = Array.from(list.querySelectorAll("button"));
      if (!buttons.length) return;
      activeIndex = (activeIndex + delta + buttons.length) % buttons.length;
      buttons.forEach(function (button, index) { button.setAttribute("aria-selected", index === activeIndex ? "true" : "false"); });
      input.setAttribute("aria-activedescendant", buttons[activeIndex].id); buttons[activeIndex].scrollIntoView({ block: "nearest" });
    }
    input.addEventListener("input", function (event) {
      if (choosing) return;
      if (event.isTrusted) { delete input.dataset.selectedCompany; clearCompanyIdentity(); setStatus(""); }
      win.clearTimeout(timer); timer = win.setTimeout(search, 180);
    });
    input.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); move(event.key === "ArrowDown" ? 1 : -1); }
      else if (event.key === "Enter" && activeIndex >= 0 && shown[activeIndex]) { event.preventDefault(); choose(shown[activeIndex]); }
      else if (event.key === "Escape") dismiss();
    });
    doc.addEventListener("pointerdown", function (event) { if (!event.target.closest(".obrazec__polje--podjetje-iskanje")) dismiss(); });
    input.closest(".obrazec__polje--podjetje-iskanje").addEventListener("focusout", function () {
      win.setTimeout(function () {
        if (!input.closest(".obrazec__polje--podjetje-iskanje").contains(doc.activeElement)) dismiss();
      }, 0);
    });
    doc.querySelectorAll("[data-vrsta-dolznika]").forEach(function (button) { button.addEventListener("click", dismiss); });
    doc.addEventListener("uj:izberi-podjetje", function (event) {
      if (!event.detail || !text(event.detail.name)) return;
      event.preventDefault();
      void choose(event.detail);
    });
    profilesPromise = loadProfiles();
  }

  return { init: init, normalize: normalize, scoreName: scoreName, mapObject: mapObject, mapRow: mapRow, merge: merge, rank: rank, availableFields: availableFields, sameCompany: sameCompany, enrichCandidate: enrichCandidate };
});
