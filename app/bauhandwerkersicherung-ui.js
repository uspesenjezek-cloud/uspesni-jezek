(function () {
  "use strict";
  var model = window.UJBauhandwerkersicherung, root = document.getElementById("boniteta-650f");
  if (!model || !root) return;
  var current = window.UJBonitetaZadnjiRezultat || null, storageKey = "uj_boniteta_650f_followup_v1", offerTransferKey = "uj_boniteta_offer_transfer_v1";
  function esc(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }
  function risk(data) { var company = data && data.northData && data.northData.company || {}, signals = window.UJBonitetaSignali && window.UJBonitetaSignali.build ? window.UJBonitetaSignali.build(company).allSignals : []; return /yellow|red|critical|warning/i.test(String(data && data.result && data.result.level || "")) || signals.some(function (item) { return item.tone === "warning" || item.tone === "critical"; }); }
  function projectContext() {
    var profile = null;
    try { profile = JSON.parse(localStorage.getItem("uj_boniteta_poslovni_profil_v1") || "null"); } catch (_) {}
    var valueNode = document.getElementById("boniteta-priporocilo-vrednost");
    var value = valueNode ? Number(String(valueNode.value || "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".")) : NaN;
    return { constructionProject: Boolean(profile && profile.dejavnost === "gradbenistvo"), projectValue: value };
  }
  function selection() {
    try { return JSON.parse(sessionStorage.getItem(storageKey) || "null"); } catch (_) { return null; }
  }
  function updateChoice(selected) {
    var button = root.querySelector("[data-650f-acknowledge]"), status = root.querySelector("[data-650f-choice-status]");
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    try { sessionStorage.setItem(storageKey, JSON.stringify({ selected: selected, updatedAt: new Date().toISOString() })); } catch (_) {}
    status.textContent = selected ? "Izbrano: pri ponudbi bomo odprli preverjanje možnosti §650f." : root.dataset.recommended === "true" ? "Priporočeno za dodatno preverjanje pri ponudbi." : "Možnost lahko preverite pri pripravi ponudbe.";
    status.className = "boniteta-650f__status" + (selected ? " is-eligible" : "");
  }
  function renderRecommendation(force) {
    var context = force || projectContext(), recommendation;
    try { recommendation = model.recommend({ constructionProject: context.constructionProject, projectValue: context.projectValue, elevatedRisk: risk(current) }); }
    catch (_) { recommendation = { eligible: false }; }
    var widget = root.querySelector("[data-650f-widget]");
    root.dataset.recommended = recommendation.eligible ? "true" : "false";
    root.hidden = false;
    widget.hidden = false;
    var saved = selection();
    updateChoice(Boolean(saved && saved.selected));
  }
  function monitoringReason() {
    if (risk(current)) return "Preverba kaže povečano previdnost. Spremljanje lahko pravočasno pokaže nove registrske spremembe ali uradne insolvenčne objave; to samo po sebi ne pomeni insolventnosti.";
    return "Podjetje je trenutno preverjeno, vendar se lahko registrski podatki in uradne objave pozneje spremenijo. Spremljanje zmanjša potrebo po ročnem ponavljanju preverbe.";
  }
  function transferableIdentity(data) {
    var identity = data && data.identity || {}, status = String(identity.status || ""), street = String(identity.naslov || identity.street || "").trim(), postalCode = String(identity.postnaStevilka || identity.postalCode || "").trim(), city = String(identity.kraj || identity.city || "").trim();
    if (["verified_register", "confirmed_impressum"].indexOf(status) === -1 || !String(identity.naziv || identity.ime || "").trim() || !street || !/^\d{5}$/.test(postalCode) || !city) return null;
    return { name: String(identity.naziv || identity.ime).trim(), street: street, postalCode: postalCode, city: city, entityType: String(identity.entityType || "company"), registerNumber: String(identity.registerNumber || ""), registerCourt: String(identity.registerCourt || ""), companyId: String(identity.companyId || ""), sourceUrl: String(identity.sourceUrl || ""), identityStatus: status };
  }
  function profileTransferData(profile) {
    var latest = profile && profile.latest_check || {}, address = profile && profile.address || {}, companyId = String(profile && profile.company_id || ""), identityStatus = companyId ? "verified_register" : String(latest.identityStatus || "");
    return { checkedAt: profile && (profile.checked_at || profile.updated_at), result: latest.result || {}, insolvency: latest.insolvency || {}, identity: { status: identityStatus, naziv: latest.businessName || profile && profile.legal_name, ime: latest.identityName || profile && profile.legal_name, entityType: latest.entityType || "company", naslov: address.street || address.address, postnaStevilka: address.postal_code || address.postalCode, kraj: address.city, registerNumber: profile && profile.register_number, registerCourt: profile && profile.register_court, companyId: companyId, sourceUrl: companyId ? "https://openregister.de" : "" } };
  }
  function offerTransferItem(data, profileId) {
    var company = transferableIdentity(data), selected = selection(), checkedAt = data && data.checkedAt || new Date().toISOString();
    if (!company) return null;
    return { sourceProfileId: String(profileId || ""), company: company, verification: { checkedAt: checkedAt, sourceUrl: company.sourceUrl, identityStatus: company.identityStatus, registerNumber: company.registerNumber, registerCourt: company.registerCourt }, resultSummary: { level: String(data && data.result && data.result.level || ""), title: String(data && data.result && data.result.title || "Preverba zaključena"), insolvencyStatus: String(data && data.insolvency && data.insolvency.status || "unverifiable") }, recommendations: [{ key: "payment_security_650f", selected: Boolean(selected && selected.selected), status: "eligibility_review_required" }] };
  }
  function offerTransferPayload(profiles) {
    var list = Array.isArray(profiles) && profiles.length ? profiles.map(function (profile) { return offerTransferItem(profileTransferData(profile), profile.id); }) : [offerTransferItem(current, new URLSearchParams(location.search).get("profile") || "")], transferredAt = new Date().toISOString(), expiresAt = new Date(Date.now() + 86400000).toISOString();
    if (!list.length || list.some(function (item) { return !item; })) return null;
    if (list.length === 1) return Object.assign({ version: 1, transferredAt: transferredAt, expiresAt: expiresAt }, list[0]);
    return { version: 2, transferredAt: transferredAt, expiresAt: expiresAt, companies: list };
  }
  function updateOfferTransferAction() {
    var button = document.getElementById("boniteta-prenesi-v-ponudbo"), available = Boolean(transferableIdentity(current)), wrap;
    if (!button) return;
    button.hidden = !available;
    if (available) {
      wrap = document.getElementById("boniteta-eno-spremljanje-vstop");
      if (wrap) wrap.hidden = false;
    }
  }
  function transferToOffer(event) {
    var profiles = event && event.detail && event.detail.profiles, payload = offerTransferPayload(profiles);
    if (!payload) return;
    try { sessionStorage.setItem(offerTransferKey, JSON.stringify(payload)); }
    catch (_) { return; }
    location.href = "pos-terminal.html?from=boniteta";
  }
  function openOfferTransferOptions() {
    if (!transferableIdentity(current)) return;
    window.dispatchEvent(new CustomEvent("uj:boniteta:open-offer-transfer", { detail: { reason: monitoringReason() } }));
  }
  root.querySelector("[data-650f-acknowledge]").addEventListener("click", function () { updateChoice(this.getAttribute("aria-pressed") !== "true"); });
  document.getElementById("boniteta-prenesi-v-ponudbo").addEventListener("click", openOfferTransferOptions);
  window.addEventListener("uj:boniteta:offer-transfer-confirmed", transferToOffer);
  window.addEventListener("uj:boniteta:result-data", function (event) { current = event.detail && event.detail.data; if (!current) return; renderRecommendation(); updateOfferTransferAction(); });
  renderRecommendation();
  updateOfferTransferAction();
  if (/^(?:localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get("bau650f-preview") === "eligible") {
    current = { checkedAt: new Date().toISOString(), result: { level: "yellow" }, locationMatch: { status: "match" }, identity: { status: "verified_register", naziv: "OPEN Testbau GmbH", naslov: "Musterstraße 18", postnaStevilka: "10115", kraj: "Berlin", sourceUrl: "https://openregister.de" }, northData: { sourceUrl: "https://www.handelsregister.de", company: { events: [{ category: "Management", date: new Date(Date.now() - 50 * 86400000).toISOString(), title: "Sprememba vodstva", description: "Anna Beispiel je nastopila funkcijo.", source: "Handelsregister", sourceUrl: "https://www.handelsregister.de" }] } } };
    var resultRoot = document.getElementById("boniteta-rezultat");
    if (resultRoot) { resultRoot.hidden = false; Array.prototype.forEach.call(resultRoot.children, function (child) { if (child !== root) child.hidden = true; }); }
    renderRecommendation({ constructionProject: true, projectValue: 75000 });
  }
})();
