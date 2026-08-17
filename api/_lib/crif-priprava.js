"use strict";

var SUBJECT_TYPES = new Set(["company", "sole_trader", "private_person"]);
var PAYMENT_TIMINGS = new Set(["prepayment", "milestone", "after_completion", "invoice", "installments", "other"]);
var NOTICE_METHODS = new Set(["email", "pdf", "in_person", "portal"]);

function text(value, max) { return String(value == null ? "" : value).trim().slice(0, max || 500); }
function date(value) { var result = text(value, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) return ""; var parsed = new Date(result + "T12:00:00Z"); return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === result ? result : ""; }
function cents(value) { var number = Number(String(value == null ? "" : value).replace(",", ".")); return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : -1; }
function monthsBetween(start, end) { if (!start || !end) return 0; var a = new Date(start + "T12:00:00Z"), b = new Date(end + "T12:00:00Z"); return Math.max(0, Math.ceil((b - a) / 2629800000)); }

function providerStatus() {
  var contract = process.env.CRIF_PLATFORM_AGREEMENT === "active";
  var credentials = Boolean(process.env.CRIF_API_BASE_URL && process.env.CRIF_API_KEY);
  return {
    provider: "crif",
    mode: contract && credentials ? (process.env.CRIF_API_MODE === "production" ? "production" : "uat") : "disabled",
    enabled: contract && credentials,
    contractGate: contract ? (credentials ? "ready" : "credentials_required") : "platform_agreement_required",
  };
}

function recommend(input) {
  var subjectType = SUBJECT_TYPES.has(input && input.subjectType) ? input.subjectType : "company";
  var exposure = Math.max(0, cents(input && input.openExposure));
  var value = Math.max(0, cents(input && input.projectValue));
  var risk = Math.max(exposure, value);
  var product = "FinanzCheck";
  var level = "basic";
  if (subjectType !== "company") { product = "CreditCheck ONE"; level = "person"; }
  else if (risk >= 15000000) { product = "Vollauskunft"; level = "full"; }
  else if (risk >= 5000000) { product = "Kreditauskunft"; level = "extended"; }
  else if (risk >= 1000000) { product = "BoniCheck Kompakt"; level = "compact"; }
  var durationMonths = monthsBetween(date(input && input.projectStartDate), date(input && input.projectEndDate));
  return {
    product: product,
    level: level,
    durationMonths: durationMonths,
    monitoringRecommended: durationMonths >= 3 && exposure >= 1000000,
    reason: subjectType !== "company" ? "Preverjanje fizične osebe ali samostojnega podjetnika." :
      (risk >= 15000000 ? "Zelo visoka izpostavljenost zahteva najširši poslovni vpogled." :
      risk >= 5000000 ? "Visoka izpostavljenost zahteva razširjene finančne podatke." :
      risk >= 1000000 ? "Srednja izpostavljenost zahteva kompaktno bonitetno poročilo." :
      "Nižja izpostavljenost zahteva osnovno finančno preverjanje."),
  };
}

function validate(input) {
  var source = input && typeof input === "object" ? input : {};
  var subjectType = text(source.subjectType, 30);
  if (!SUBJECT_TYPES.has(subjectType)) throw Object.assign(new Error("Izberite vrsto stranke."), { status: 400 });
  var subject = source.subject && typeof source.subject === "object" ? source.subject : {};
  var cleanSubject = {
    legalName: text(subject.legalName, 240), firstName: text(subject.firstName, 120), lastName: text(subject.lastName, 120),
    dateOfBirth: date(subject.dateOfBirth), registerNumber: text(subject.registerNumber, 120),
    street: text(subject.street, 160), postalCode: text(subject.postalCode, 10).replace(/\D/g, ""), city: text(subject.city, 100), country: "DE",
  };
  if (subjectType === "company" && !cleanSubject.legalName) throw Object.assign(new Error("Vnesite pravno ime podjetja."), { status: 400 });
  if (subjectType !== "company" && (!cleanSubject.firstName || !cleanSubject.lastName || !cleanSubject.dateOfBirth)) throw Object.assign(new Error("Za fizično osebo vnesite ime, priimek in datum rojstva."), { status: 400 });
  if (cleanSubject.street.length < 3 || !/^\d{5}$/.test(cleanSubject.postalCode) || cleanSubject.city.length < 2) throw Object.assign(new Error("Vnesite celoten nemški naslov stranke."), { status: 400 });
  var projectValue = cents(source.projectValue), openExposure = cents(source.openExposure);
  if (projectValue <= 0 || openExposure < 0 || openExposure > projectValue) throw Object.assign(new Error("Preverite vrednost posla in odprto izpostavljenost."), { status: 400 });
  var start = date(source.projectStartDate), end = date(source.projectEndDate);
  if (!start || !end || end < start || end < new Date().toISOString().slice(0, 10)) throw Object.assign(new Error("Vnesite veljaven začetek in prihodnji konec posla."), { status: 400 });
  var paymentTiming = text(source.paymentTiming, 30);
  if (!PAYMENT_TIMINGS.has(paymentTiming)) throw Object.assign(new Error("Izberite način plačila."), { status: 400 });
  if (!source.financialRiskConfirmed || !source.businessPurposeConfirmed) throw Object.assign(new Error("Potrdite konkreten posel, finančni riziko in poslovni namen preverbe."), { status: 400 });
  if (text(source.legitimateInterest, 1000).length < 10) throw Object.assign(new Error("Na kratko opišite konkreten finančni riziko tega posla."), { status: 400 });
  var naturalPerson = subjectType !== "company", noticeMethod = text(source.noticeMethod, 30), noticeDeliveredAt = text(source.noticeDeliveredAt, 40);
  var noticeTime = noticeDeliveredAt ? new Date(noticeDeliveredAt) : null;
  if (naturalPerson && (!source.noticeDelivered || !NOTICE_METHODS.has(noticeMethod) || !noticeTime || Number.isNaN(noticeTime.getTime()) || noticeTime.getTime() > Date.now() + 300000)) throw Object.assign(new Error("Osebo je treba pred preverbo obvestiti o obdelavi podatkov in zabeležiti veljaven način ter čas obvestila."), { status: 400 });
  var monitoringRequested = Boolean(source.monitoringRequested), monitoringEndDate = monitoringRequested ? date(source.monitoringEndDate || end) : null;
  if (monitoringRequested && (!monitoringEndDate || monitoringEndDate > end)) throw Object.assign(new Error("Spremljanje se mora končati najpozneje ob koncu poslovnega razmerja."), { status: 400 });
  if (monitoringRequested && text(source.monitoringReason, 500).length < 10) throw Object.assign(new Error("Na kratko opišite razlog in odprto izpostavljenost za spremljanje."), { status: 400 });
  var recommendation = recommend(source), provider = providerStatus();
  return {
    subjectType: subjectType, subject: cleanSubject, projectReference: text(source.projectReference, 160),
    projectValueCents: projectValue, openExposureCents: openExposure, currency: "EUR", paymentTiming: paymentTiming,
    projectStartDate: start, projectEndDate: end, legitimateInterest: text(source.legitimateInterest, 1000), legalBasis: "art_6_1_f",
    financialRiskConfirmed: true, businessPurposeConfirmed: true, noticeRequired: naturalPerson,
    noticeVersion: naturalPerson ? "crif-art13-de-v1" : null, noticeMethod: naturalPerson ? noticeMethod : null,
    noticeDeliveredAt: naturalPerson ? noticeDeliveredAt : null, monitoringRequested: monitoringRequested,
    monitoringEndDate: monitoringEndDate, monitoringReason: monitoringRequested ? text(source.monitoringReason, 500) : null,
    recommendation: recommendation, provider: provider,
  };
}

module.exports = { validate: validate, recommend: recommend, providerStatus: providerStatus, _test: { cents: cents, monthsBetween: monthsBetween } };
