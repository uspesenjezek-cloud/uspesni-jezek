var UJBauhandwerkersicherung = (function () {
  "use strict";

  var OFFICIAL_URL = "https://www.gesetze-im-internet.de/bgb/__650f.html";
  var TEMPLATE_VERSION = "650f-draft-de-v1";
  var LARGE_PROJECT_CENTS = 5000000;
  var CHANGE_TYPES = { leadership: "Sprememba vodstva", ownership: "Sprememba lastništva", legalForm: "Sprememba pravne oblike" };

  function text(value) { return String(value == null ? "" : value).trim(); }
  function iso(value) { var d = new Date(value); return value && !Number.isNaN(d.getTime()) ? d.toISOString() : ""; }
  function fail(code, message) { var error = new Error(message); error.code = code; error.status = 409; throw error; }
  function moneyCents(value, field) {
    if (value === "" || value == null) fail("MISSING_" + field.toUpperCase(), "Manjka obvezni znesek: " + field + ".");
    var number = typeof value === "string" ? Number(value.replace(/\s/g, "").replace(",", ".")) : Number(value);
    if (!Number.isFinite(number) || number < 0) fail("INVALID_" + field.toUpperCase(), "Znesek »" + field + "« ni veljaven.");
    return Math.round(number * 100);
  }
  function verifiedIdentity(identity) {
    var status = text(identity && identity.status);
    var location = text(identity && (identity.locationStatus || identity.locationMatch));
    return /verified_(?:api|register)|verified_register/.test(status) && /^(?:match|matched)$/.test(location) &&
      text(identity.legalName || identity.name) && text(identity.street) && /^\d{5}$/.test(text(identity.postalCode)) && text(identity.city) && text(identity.sourceUrl);
  }
  function detectChanges(input, now) {
    var checkedAt = iso(input && input.checkedAt || now || new Date().toISOString());
    var events = Array.isArray(input && input.events) ? input.events : [];
    var verified = events.map(function (event) {
      var type = text(event.type || event.category);
      type = /management|leadership|vodstvo/i.test(type) ? "leadership" : /owner|ownership|shareholder|lastni/i.test(type) ? "ownership" : /legal.?form|pravna.?oblik/i.test(type) ? "legalForm" : "";
      if (!type) return null;
      var date = iso(event.date || event.documentDate), sourceUrl = text(event.sourceUrl), source = text(event.source || event.sourceLabel);
      if (!date || !sourceUrl || !/^https?:\/\//i.test(sourceUrl) || !source) return null;
      return { type: type, label: CHANGE_TYPES[type], date: date, source: source, sourceUrl: sourceUrl, checkedAt: checkedAt, detail: text(event.detail || event.description || event.title) };
    }).filter(Boolean).sort(function (a, b) { return b.date.localeCompare(a.date); });
    if (!verified.length) return { status: "unverifiable", tone: "yellow", changes: [], checkedAt: checkedAt, message: "V razpoložljivem registrskem viru ni dokazljivega podatka o nedavni spremembi vodstva, lastništva ali pravne oblike." };
    var cutoff = Date.parse(checkedAt) - 548 * 86400000;
    var recent = verified.filter(function (item) { return Date.parse(item.date) >= cutoff; });
    if (!recent.length) return { status: "verified_no_recent_change", tone: "neutral", changes: [], checkedAt: checkedAt, message: "Vir je preverjen, vendar v zadnjih 18 mesecih ni zabeležene spremembe iz tega sklopa." };
    var material = recent.length > 1 || recent.some(function (item) { return item.type === "ownership" || item.type === "legalForm"; });
    return { status: "verified_change", tone: material ? "red" : "yellow", changes: recent, checkedAt: checkedAt, message: material ? "Več ali pomembnejša registrska sprememba zahteva ročni pregled; sama po sebi ne pomeni insolventnosti." : "Zabeležena je registrska posebnost za povečano previdnost; sama po sebi ne pomeni insolventnosti." };
  }
  function recommend(context) {
    var value = moneyCents(context && context.projectValue, "project_value");
    var eligible = context && context.constructionProject === true && value >= LARGE_PROJECT_CENTS && context.elevatedRisk === true;
    return { eligible: Boolean(eligible), projectValueCents: value, thresholdCents: LARGE_PROJECT_CENTS, label: eligible ? "Preveri možnost Bauhandwerkersicherung po §650f BGB" : "", legalAdvice: false };
  }
  function eligibility(answer) {
    answer = answer || {};
    var missing = ["workType", "customerType", "publicLawException", "consumerContractType", "authorizedConstructionManager", "unpaidAmount", "additionalOrders", "deadline", "deadlineConfirmed"].filter(function (key) { return answer[key] === "" || answer[key] == null; });
    if (missing.length) return { eligible: false, blocked: true, code: "ELIGIBILITY_INCOMPLETE", reason: "Pred pripravo osnutka odgovorite na vsa vprašanja: " + missing.join(", ") + "." };
    if (answer.workType !== "construction") return { eligible: false, blocked: true, code: "NOT_CONSTRUCTION_WORK", reason: "Vnesena vrsta pogodbe oziroma dela ni gradbeni posel." };
    if (answer.customerType === "public" && answer.publicLawException === true) return { eligible: false, blocked: true, code: "PUBLIC_LAW_EXCEPTION", reason: "§650f odst. 6 določa izjemo za navedeno javnopravno osebo oziroma posebno premoženje." };
    if (answer.customerType === "consumer" && ["verbraucherbauvertrag", "bautraegervertrag"].includes(answer.consumerContractType) && answer.authorizedConstructionManager !== true) return { eligible: false, blocked: true, code: "CONSUMER_CONTRACT_EXCEPTION", reason: "§650f odst. 6 določa izjemo za ta potrošniški tip pogodbe; izjema za pooblaščenega Baubetreuerja ni potrjena." };
    if (answer.deadlineConfirmed !== true || !text(answer.deadline)) return { eligible: false, blocked: true, code: "DEADLINE_NOT_CONFIRMED", reason: "Predlagani razumni rok mora uporabnik izrecno potrditi." };
    var unpaid = moneyCents(answer.unpaidAmount, "unpaid_amount"), extras = moneyCents(answer.additionalOrders, "additional_orders");
    return { eligible: true, blocked: false, unpaidCents: unpaid, additionalOrdersCents: extras };
  }
  function calculate(answer) {
    var gate = eligibility(answer); if (!gate.eligible) fail(gate.code, gate.reason);
    var claim = gate.unpaidCents + gate.additionalOrdersCents, ancillary = Math.round(claim * 0.10);
    return { unpaidCents: gate.unpaidCents, additionalOrdersCents: gate.additionalOrdersCents, securedClaimCents: claim, ancillaryClaimsCents: ancillary, totalSecurityCents: claim + ancillary, ancillaryRate: 0.10 };
  }
  function createDraft(input) {
    var identity = input && input.identity || {}; if (!verifiedIdentity(identity)) fail("IDENTITY_EVIDENCE_REQUIRED", "Pred pripravo osnutka morata biti pravna identiteta in naslov potrjena z registrskim dokazom.");
    var calculation = calculate(input.eligibility), contract = input.contract || {};
    if (!text(contract.reference) || !text(contract.project)) fail("CONTRACT_DATA_REQUIRED", "Manjkajo preverjeni podatki pogodbe oziroma projekta.");
    var now = iso(input.checkedAt || new Date().toISOString());
    return { status: "draft", label: "Osnutek – ni pravno svetovanje", templateVersion: TEMPLATE_VERSION, officialSourceUrl: OFFICIAL_URL, checkedAt: now, parties: { contractor: input.contractor, customer: identity }, contract: { reference: text(contract.reference), project: text(contract.project) }, eligibility: input.eligibility, calculation: calculation, deadline: text(input.eligibility.deadline), sendGate: { craftsmanConfirmed: false, legalReviewStatus: "pending", allowed: false } };
  }
  function sendGate(draft, request) {
    if (!draft || draft.status !== "draft") fail("DRAFT_REQUIRED", "Osnutek ne obstaja.");
    if (!request || request.craftsmanConfirmed !== true) fail("CRAFTSMAN_CONFIRMATION_REQUIRED", "Pred pošiljanjem je potrebna izrecna potrditev obrtnika.");
    if (draft.sendGate && draft.sendGate.legalReviewStatus !== "legal_review_approved") fail("LEGAL_REVIEW_REQUIRED", "Pošiljanje je blokirano do statusa legal_review_approved.");
    fail("SEND_TRANSPORT_NOT_CONNECTED", "Samodejno pošiljanje ni povezano; dovoljena sta le predogled in prenos osnutka.");
  }
  function audit(draft, actorId) { return { sources: [{ url: OFFICIAL_URL, checkedAt: draft.checkedAt }], eligibility: draft.eligibility, templateVersion: draft.templateVersion, calculation: draft.calculation, approvedBy: text(actorId) || null, approvedAt: null }; }
  return { OFFICIAL_URL: OFFICIAL_URL, TEMPLATE_VERSION: TEMPLATE_VERSION, LARGE_PROJECT_CENTS: LARGE_PROJECT_CENTS, detectChanges: detectChanges, recommend: recommend, eligibility: eligibility, calculate: calculate, createDraft: createDraft, sendGate: sendGate, audit: audit, _test: { moneyCents: moneyCents, verifiedIdentity: verifiedIdentity } };
})();
if (typeof module === "object" && module.exports) module.exports = UJBauhandwerkersicherung;
