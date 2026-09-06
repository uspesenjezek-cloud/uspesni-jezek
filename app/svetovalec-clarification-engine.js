(function (root, factory) {
  var api;
  if (typeof module === "object" && module.exports) {
    api = factory(require("./atena-widget-contract"));
    module.exports = api;
  } else api = factory(root && root.UJAtenaWidgetContract);
  if (root) root.UJSvetovalecClarificationEngine = api;
})(typeof window !== "undefined" ? window : null, function (widgetContract) {
  "use strict";

  var VERSION = "svetovalec-clarification-v1";
  var CONTEXT_VERSION = "svetovalec-clarification-context-v1";

  function option(id, label, answerText, serviceCodes) {
    return Object.freeze({ id:id, label:label, answerText:answerText, serviceCodes:Object.freeze((serviceCodes || []).slice()) });
  }
  function definition(id, widgetId, question, purpose, options, selectionMode) {
    var approved = widgetContract && widgetContract.byId && widgetContract.byId[widgetId];
    if (!approved) throw new Error("Svetovalec clarification uporablja neodobren Nazorjev widget: " + widgetId);
    return Object.freeze({
      id:id,
      interfaceId:"atena:card:svetovalec:clarification:" + id,
      contextVersion:CONTEXT_VERSION,
      widgetId:widgetId,
      widgetInterfaceId:approved.interfaceId,
      question:question,
      purpose:purpose,
      selectionMode:selectionMode === "multiple" ? "multiple" : "single",
      options:Object.freeze(options.slice()),
    });
  }

  var DEFINITIONS = Object.freeze([
    definition("namen-dejanja", "mreza-izbir", "Kaj želite doseči?", "Loči nevtralni pregled od pogajanja, odpovedi ali zbiranja ponudb.", [
      option("preveri", "Preveriti", "Želim samo preveriti pogoje.", ["ponudba", "narocnina"]),
      option("pogajaj", "Izboljšati pogoje", "Želim se pogajati za boljše pogoje.", ["pogajanje"]),
      option("odpovej", "Odpovedati", "Želim pogodbo ali naročnino odpovedati.", ["pogajanje", "narocnina"]),
      option("primerjaj", "Primerjati ponudbe", "Želim zbrati ali primerjati več ponudb.", ["ponudbe"]),
    ], "multiple"),
    definition("enkratno-ali-ponavljajoce", "dvojni-segment", "Za kakšno obveznost gre?", "Razlikuje enkratni posel od redne naročnine ali samodejnega podaljšanja.", [
      option("enkratno", "Enkratni posel", "Gre za enkratno ponudbo ali pogodbo.", ["ponudba"]),
      option("ponavljajoce", "Redna naročnina", "Gre za ponavljajočo naročnino ali vezavo.", ["narocnina"]),
    ]),
    definition("ponudba-ze-obstaja", "da-ne-ne-vem", "Ali ponudbo že imate?", "Loči pregled ene ponudbe od iskanja in primerjave izvajalcev.", [
      option("da", "Da", "Ponudbo že imam in jo želim preveriti.", ["ponudba"]),
      option("ne", "Ne", "Ponudbe še nimam; želim poiskati izvajalce.", ["ponudbe"]),
      option("vec", "Imam jih več", "Imam več ponudb in jih želim primerjati.", ["ponudbe"]),
    ]),
    definition("vrsta-dokumenta", "navpicni-izbor", "Kaj želite preveriti?", "Določi materialni predmet pregleda brez ugibanja iz imena datoteke.", [
      option("ponudba", "Ponudbo ali predračun", "Preveriti želim ponudbo ali predračun.", ["ponudba"]),
      option("pogodba", "Pogodbo", "Preveriti želim pogodbo.", ["ponudba", "narocnina"]),
      option("pogoji", "Splošne pogoje", "Preveriti želim splošne pogoje.", ["ponudba", "narocnina"]),
      option("narocnina", "Naročnino ali vezavo", "Preveriti želim naročnino ali vezavo.", ["narocnina"]),
    ], "multiple"),
    definition("glavna-skrb", "navpicni-izbor", "Kaj vas najbolj skrbi?", "Usmeri pregled na ceno, obseg, rok, plačilo ali odpoved.", [
      option("cena", "Cena in dodatni stroški", "Najprej preverite ceno in dodatne stroške.", ["ponudba", "narocnina"]),
      option("obseg", "Kaj je vključeno", "Najprej preverite obseg in kaj je vključeno.", ["ponudba"]),
      option("rok", "Rok in izvedba", "Najprej preverite rok in izvedbo.", ["ponudba", "ponudbe"]),
      option("placilo", "Plačilni pogoji", "Najprej preverite plačilne pogoje.", ["ponudba", "narocnina"]),
      option("odpoved", "Odpoved in vezava", "Najprej preverite odpoved in vezavo.", ["narocnina", "pogajanje"]),
    ], "multiple"),
    definition("prodajni-klic", "da-ne-ne-vem", "Ali prodajalec čaka na odgovor zdaj?", "Loči takojšnjo pomoč med klicem od priprave na poznejši stik.", [
      option("zdaj", "Da, zdaj", "Prodajalec je trenutno na zvezi.", ["klic"]),
      option("pozneje", "Ne, pozneje", "Na prodajni klic se želim pripraviti za pozneje.", ["klic"]),
      option("ne-vem", "Ne vem", "Ne vem, kdaj bo prodajalec znova poklical.", ["klic"]),
    ]),
    definition("stevilo-ponudnikov", "stevilcna-lestvica", "Koliko izvajalcev želite primerjati?", "Zajame majhno število primerljivih ponudnikov brez prostega tipkanja.", [
      option("2", "2", "Primerjati želim 2 izvajalca.", ["ponudbe"]),
      option("3", "3", "Primerjati želim 3 izvajalce.", ["ponudbe"]),
      option("4", "4", "Primerjati želim 4 izvajalce.", ["ponudbe"]),
      option("5", "5+", "Primerjati želim najmanj 5 izvajalcev.", ["ponudbe"]),
    ]),
  ]);
  var BY_ID = Object.freeze(DEFINITIONS.reduce(function (all, item) { all[item.id] = item; return all; }, {}));

  function normalize(value, sourceText) {
    if (value == null) return null;
    if (typeof value === "string") return Object.freeze({ mode:"conversation", question:value.trim(), evidence:"", recordRequired:true });
    if (!value || typeof value !== "object") return null;
    if (value.mode === "widget") {
      var item = BY_ID[String(value.clarificationId || "")];
      if (!item || value.widgetId !== item.widgetId) return null;
      var evidence = String(value.evidence || "").trim();
      if (!evidence || String(sourceText || "").indexOf(evidence) < 0) return null;
      return Object.freeze({ mode:"widget", clarificationId:item.id, widgetId:item.widgetId, evidence:evidence, definition:item, recordRequired:false });
    }
    if (value.mode === "conversation") {
      var question = String(value.question || "").trim();
      var fallbackEvidence = String(value.evidence || "").trim();
      if (!question || question.length > 180 || (fallbackEvidence && String(sourceText || "").indexOf(fallbackEvidence) < 0)) return null;
      return Object.freeze({ mode:"conversation", question:question, evidence:fallbackEvidence, recordRequired:true });
    }
    return null;
  }

  function answer(clarificationId, optionId) {
    var item = BY_ID[String(clarificationId || "")];
    var requested = Array.isArray(optionId) ? optionId : [optionId];
    var ids = requested.map(function (value) { return String(value || ""); }).filter(function (value, index, all) { return value && all.indexOf(value) === index; });
    if (!item || !ids.length || (item.selectionMode !== "multiple" && ids.length !== 1)) return null;
    var selected = ids.map(function (id) { return item.options.find(function (entry) { return entry.id === id; }); });
    if (selected.some(function (entry) { return !entry; })) return null;
    var serviceCodes = Array.from(new Set(selected.reduce(function (all, entry) { return all.concat(entry.serviceCodes); }, [])));
    return Object.freeze({
      clarificationId:item.id,
      widgetId:item.widgetId,
      optionId:selected.length === 1 ? selected[0].id : "",
      optionIds:Object.freeze(selected.map(function (entry) { return entry.id; })),
      answerText:selected.map(function (entry) { return entry.answerText; }).join(" "),
      serviceCodes:Object.freeze(serviceCodes)
    });
  }

  function manifest() {
    return Object.freeze(DEFINITIONS.map(function (item) {
      return Object.freeze({ id:item.id, widgetId:item.widgetId, purpose:item.purpose, selectionMode:item.selectionMode, optionIds:Object.freeze(item.options.map(function (entry) { return entry.id; })) });
    }));
  }

  function plan(initialId, answers) {
    var start = BY_ID[String(initialId || "")] ? String(initialId) : "namen-dejanja";
    var answered = Array.isArray(answers) ? answers : [];
    var byId = answered.reduce(function (all, entry) {
      if (entry && entry.clarificationId) all[entry.clarificationId] = entry;
      return all;
    }, {});
    var ids;
    if (start === "namen-dejanja") {
      var purposeIds = byId[start] && Array.isArray(byId[start].optionIds) ? byId[start].optionIds : [];
      ids = purposeIds.indexOf("primerjaj") >= 0
        ? [start, "ponudba-ze-obstaja", "stevilo-ponudnikov", "glavna-skrb"]
        : [start, "enkratno-ali-ponavljajoce", "vrsta-dokumenta", "glavna-skrb"];
    } else if (start === "ponudba-ze-obstaja") {
      var offerIds = byId[start] && Array.isArray(byId[start].optionIds) ? byId[start].optionIds : [];
      ids = offerIds.some(function (id) { return id === "ne" || id === "vec"; })
        ? [start, "stevilo-ponudnikov", "glavna-skrb"]
        : [start, "vrsta-dokumenta", "glavna-skrb"];
    } else if (start === "enkratno-ali-ponavljajoce") ids = [start, "vrsta-dokumenta", "glavna-skrb"];
    else if (start === "vrsta-dokumenta") ids = [start, "glavna-skrb"];
    else ids = [start];
    return Object.freeze(ids.filter(function (id, index, all) { return BY_ID[id] && all.indexOf(id) === index; }));
  }

  return Object.freeze({ version:VERSION, contextVersion:CONTEXT_VERSION, definitions:DEFINITIONS, byId:BY_ID, ids:Object.freeze(DEFINITIONS.map(function (item) { return item.id; })), widgetIds:Object.freeze(Array.from(new Set(DEFINITIONS.map(function (item) { return item.widgetId; })))), normalize:normalize, answer:answer, plan:plan, manifest:manifest });
});
