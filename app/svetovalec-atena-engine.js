(function (root, factory) {
  var api;
  if (typeof module === "object" && module.exports) {
    api = factory(require("./atena-card-schema"), require("./ponudba-moduli-engine"), require("./svetovalec-storitve-engine"), require("./svetovalec-clarification-engine"));
    module.exports = api;
  } else api = factory(root && root.UJAtenaCardSchema, root && root.UJPonudbaModuliEngine, root && root.UJSvetovalecStoritveEngine, root && root.UJSvetovalecClarificationEngine);
  if (root) root.UJSvetovalecAtenaEngine = api;
})(typeof window !== "undefined" ? window : null, function (cardSchema, ponudbaEngine, storitveEngine, clarificationEngine) {
  "use strict";

  var VERSION = "svetovalec-atena-engine-v1";
  var CONTRACT_VERSION = "svetovalec-intent-contract-v1";
  var CONTEXT_VERSION = "svetovalec-interface-context-v1";
  var SERVICE_ROWS = [
    [2001, "ponudba", "Preverite ponudbo", "Preverjanje cene, obsega, plačila, pogodbenih pogojev, tveganj in dokazil pred podpisom.", "Uporabi za ponudbo, predračun ali osnutek posla.", "Ne uporabi za obstoječo ponavljajočo naročnino ali prodajni klic."],
    [2002, "narocnina", "Preverite sklenjene pogodbe", "Pregled rednih stroškov, vezave, podaljšanja, spremembe ali odpovedi naročnine.", "Uporabi za obstoječo ali predlagano ponavljajočo naročnino, članstvo ali licenco.", "Ne uporabi za enkratno ponudbo brez ponavljajoče obveznosti."],
    [2003, "pogajanje", "Pogajajte se ali odpovejte", "Priprava ciljev, meja in naslednjih korakov za pogajanje, spremembo ali odpoved.", "Uporabi, ko želi uporabnik doseči boljše pogoje, zavrniti, spremeniti ali odpovedati.", "Ne uporabi, kadar želi uporabnik samo nevtralno preverjanje dokumenta."],
    [2004, "ponudbe", "Poiščite mi ponudbe", "Priprava in primerjava povpraševanja več izvajalcem ter upravljanje prejetih ponudb.", "Uporabi za iskanje izvajalcev, zbiranje ali primerjavo več ponudb.", "Ne uporabi za pregled ene že izbrane ponudbe."],
    [2005, "klic", "Vas kliče prodajalec?", "Varen sprejem prodajnega klica, zbiranje dejstev in dogovor o nadaljevanju.", "Uporabi za trenutni ali načrtovani prodajni klic in povratni stik.", "Ne uporabi za dokument brez klica ali telefonskega nadaljevanja."]
  ];
  var SERVICES = Object.freeze(SERVICE_ROWS.map(function (row) {
    var engine = row[1] === "ponudba" ? ponudbaEngine : storitveEngine && storitveEngine.get(row[1]);
    var areas = engine && Array.isArray(engine.areas) ? engine.areas : [];
    return Object.freeze({
      id: row[0], code: row[1], title: row[2], description: row[3], useWhen: row[4], doNotUseWhen: row[5],
      interfaceId: "atena:card:svetovalec:" + row[0], actionId: "atena:action:svetovalec:open-service:" + row[1],
      examples: Object.freeze([]),
      areas: Object.freeze(areas.map(function (area) {
        return Object.freeze({ code:String(area.code), label:String(area.label), description:String(area.description || ""), moduleIds:Object.freeze((area.moduleIds || []).map(Number)) });
      }))
    });
  }));
  var SERVICE_BY_CODE = new Map(SERVICES.map(function (service) { return [service.code, service]; }));
  var SERVICE_BY_ID = new Map(SERVICES.map(function (service) { return [service.id, service]; }));

  var INTERFACE_ROWS = [
    [21001,"card","atena:card:svetovalec:company","[data-podjetje-aktivno]","Izbrano podjetje","Kontekst podjetja, na katerega se nanaša uporabnikova zahteva."],
    [21002,"control","atena:control:svetovalec:company-select","[data-podjetje-aktivno-izberi]","Izberi podjetje","Spremeni aktivno podjetje brez semantičnega ugibanja."],
    [21003,"control","atena:control:svetovalec:company-edit","[data-podjetje-uredi]","Uredi podjetje","Odpre obstoječi obrazec podatkov podjetja."],
    [21004,"control","atena:control:svetovalec:company-remove","[data-podjetje-odstrani]","Odstrani podjetje","Odstrani podjetje samo iz trenutnega svetovalnega konteksta."],
    [21005,"control","atena:control:svetovalec:company-rest","[data-podjetja-odpri]","Preostala podjetja","Odpre seznam drugih razpoložljivih podjetij."],
    [21006,"control","atena:control:svetovalec:company-add","[data-podjetje-dodaj]","Dodaj podjetje","Odpre obstoječi obrazec za novo podjetje."],
    [21101,"field","atena:field:svetovalec:request-description","#svetovalec-opis","Opis potrebe","Primarni uporabnikov opis; Luna ga razume, lokalna koda pa ga ne prerazvršča."],
    [21102,"control","atena:control:svetovalec:voice","[data-glas]","Povej na glas","Začne ali konča lokalni prepis v isto opisno polje."],
    [21103,"control","atena:control:svetovalec:camera","[data-domaca-kamera]","Slikaj dokument","Odpre sistemski zajem slike; vsebina ni analizirana samo iz imena datoteke."],
    [21104,"control","atena:control:svetovalec:upload","[data-domaci-uvoz]","Uvozi dokument","Odpre sistemski izbor dokumenta; metapodatki niso semantična vsebina."],
    [21105,"control","atena:control:svetovalec:query","[data-zacni-preverbo]","Poizveduj","Pošlje opis verzioniranemu Luna svetovalnemu contractu."],
    [21106,"control","atena:control:svetovalec:manual","[data-atena-nacin=\"rocno\"]","Ročno izberi","Ohrani ročno pot kot enakovredno varno alternativo."]
  ];
  var INTERFACES = Object.freeze(INTERFACE_ROWS.map(function (row) {
    return Object.freeze({ id:row[0], kind:row[1], interfaceId:row[2], selector:row[3], label:row[4], context:Object.freeze({ version:CONTEXT_VERSION, purpose:row[5], humanReview:true }) });
  }).concat(SERVICES.map(function (service) {
    return Object.freeze({ id:service.id, kind:"card", interfaceId:service.interfaceId, selector:"[data-storitev=\"" + service.code + "\"]", label:service.title, context:Object.freeze({ version:CONTEXT_VERSION, purpose:service.description, useWhen:service.useWhen, doNotUseWhen:service.doNotUseWhen, actionId:service.actionId, humanReview:true }) });
  })));

  function exactKeys(value, keys) {
    if (!value || Object.prototype.toString.call(value) !== "[object Object]") return false;
    var actual = Object.keys(value).sort(), expected = keys.slice().sort();
    return actual.length === expected.length && actual.every(function (key, index) { return key === expected[index]; });
  }
  function areaFor(service, code) { return service && service.areas.find(function (area) { return area.code === String(code || ""); }) || null; }
  function cardForModule(serviceCode, moduleId) { return cardSchema && cardSchema.getCard ? cardSchema.getCard(serviceCode, Number(moduleId)) : null; }
  function validateProposal(proposal, sourceText) {
    var source = String(sourceText || "").trim();
    if (!source || !exactKeys(proposal, ["selections","facts","clarification"])) return null;
    if (!Array.isArray(proposal.selections) || proposal.selections.length > 3 || !Array.isArray(proposal.facts) || proposal.facts.length > 50) return null;
    var seenSelections = new Set(), selectedModules = new Map(), seenFacts = new Set(), normalizedSelections = [];
    for (var i=0;i<proposal.selections.length;i+=1) {
      var item=proposal.selections[i];
      if (!exactKeys(item,["serviceId","areaCode","moduleIds","evidence"]) || !Number.isInteger(item.serviceId)) return null;
      var service=SERVICE_BY_ID.get(item.serviceId); if(!service) return null;
      var area=areaFor(service,item.areaCode); if(!area || !Array.isArray(item.moduleIds) || !item.moduleIds.length || !item.moduleIds.every(function(id){ return Number.isInteger(id) && area.moduleIds.includes(id) && Boolean(cardForModule(service.code,id)); })) return null;
      var selectionKey=item.serviceId+":"+area.code; if(seenSelections.has(selectionKey)) return null;
      if(typeof item.evidence!=="string" || !item.evidence.trim() || source.indexOf(item.evidence)<0) return null;
      var uniqueModules=Array.from(new Set(item.moduleIds)); if(uniqueModules.length!==item.moduleIds.length) return null;
      seenSelections.add(selectionKey);
      if(!selectedModules.has(item.serviceId)) selectedModules.set(item.serviceId,new Set());
      uniqueModules.forEach(function(moduleId){selectedModules.get(item.serviceId).add(moduleId);});
      normalizedSelections.push(Object.freeze({ serviceId:service.id, serviceCode:service.code, serviceTitle:service.title, areaCode:area.code, areaLabel:area.label, moduleIds:Object.freeze(uniqueModules), evidence:item.evidence, actionId:service.actionId, requiresHumanReview:true }));
    }
    var normalizedFacts=[];
    for (var f=0;f<proposal.facts.length;f+=1) {
      var fact=proposal.facts[f];
      if(!exactKeys(fact,["serviceId","fieldId","value","evidence"]) || !Number.isInteger(fact.serviceId) || !Number.isInteger(fact.fieldId) || seenFacts.has(fact.serviceId+":"+fact.fieldId)) return null;
      var factService=SERVICE_BY_ID.get(fact.serviceId); var fieldCard=null,fieldDefinition=null;
      if(!factService || !selectedModules.has(fact.serviceId)) return null;
      (cardSchema.catalog || []).some(function(card){ if(card.flow!==factService.code || !selectedModules.get(fact.serviceId).has(Number(card.moduleId))) return false; fieldDefinition=card.fields.find(function(field){return Number(field.id)===fact.fieldId;})||null; if(fieldDefinition){fieldCard=card;return true;} return false; });
      if(!fieldCard || typeof fact.value!=="string" || !fact.value.trim() || typeof fact.evidence!=="string" || !fact.evidence.trim() || source.indexOf(fact.evidence)<0) return null;
      if(Array.isArray(fieldDefinition.options) && fieldDefinition.options.length && !fieldDefinition.options.some(function(option){return String(option.id)===fact.value.trim();})) return null;
      seenFacts.add(fact.serviceId+":"+fact.fieldId);
      normalizedFacts.push(Object.freeze({serviceId:fact.serviceId,serviceCode:factService.code,fieldId:fact.fieldId,value:fact.value.trim(),evidence:fact.evidence,requiresHumanReview:true}));
    }
    var clarification=clarificationEngine && clarificationEngine.normalize ? clarificationEngine.normalize(proposal.clarification,source) : null;
    if(proposal.clarification!==null && !clarification) return null;
    if(!normalizedSelections.length && !clarification) return null;
    var safeClarification=null;
    if(clarification && clarification.mode==="widget") safeClarification=Object.freeze({mode:"widget",clarificationId:clarification.clarificationId,widgetId:clarification.widgetId,question:null,evidence:clarification.evidence});
    else if(clarification) safeClarification=Object.freeze({mode:"conversation",clarificationId:null,widgetId:null,question:clarification.question,evidence:clarification.evidence||""});
    return Object.freeze({ selections:Object.freeze(normalizedSelections), facts:Object.freeze(normalizedFacts), clarification:safeClarification });
  }
  function lunaContract(options) {
    var requested=options && Array.isArray(options.serviceCodes) ? options.serviceCodes.map(String) : [];
    var allowed=new Set(requested.length ? requested : SERVICES.map(function(service){return service.code;}));
    var contractServices=SERVICES.filter(function(service){return allowed.has(service.code);});
    var contractCards=(cardSchema && cardSchema.catalog || []).filter(function(card){return allowed.has(card.flow);});
    return Object.freeze({ version:CONTRACT_VERSION, contextVersion:CONTEXT_VERSION, services:Object.freeze(contractServices.map(function(service){
      return Object.freeze({id:service.id,code:service.code,title:service.title,description:service.description,useWhen:service.useWhen,doNotUseWhen:service.doNotUseWhen,areas:service.areas});
    })), cards:Object.freeze(contractCards.map(function(card){return Object.freeze({serviceCode:card.flow,areaCode:card.areaCode,moduleId:Number(card.moduleId),title:card.title,question:card.question,description:card.description,fieldIds:Object.freeze(card.fields.map(function(field){return Number(field.id);}))});})),
      fields:Object.freeze(contractCards.reduce(function(all,card){return all.concat(card.fields.map(function(field){return Object.freeze({serviceCode:card.flow,moduleId:Number(card.moduleId),fieldId:Number(field.id),code:String(field.code||""),label:String(field.label||""),type:String(field.type||"text"),required:field.required===true,allowedValues:Object.freeze((field.options||[]).map(function(option){return Object.freeze({id:String(option.id),label:String(option.label)});}))});}));},[])),
      clarifications:clarificationEngine && clarificationEngine.manifest ? clarificationEngine.manifest() : Object.freeze([]) });
  }
  function stamp(rootElement) {
    var scope=rootElement || (typeof document!=="undefined" ? document : null); if(!scope) return {stamped:0,missing:INTERFACES.length};
    var stamped=0,missing=0;
    INTERFACES.forEach(function(binding){ var nodes=Array.from(scope.querySelectorAll(binding.selector)); if(!nodes.length){missing+=1;return;} nodes.forEach(function(node){node.dataset.atenaId=String(binding.id);node.dataset.atenaInterfaceId=binding.interfaceId;node.dataset.atenaContextVersion=CONTEXT_VERSION;stamped+=1;}); });
    return {stamped:stamped,missing:missing};
  }
  function dispatch(actionId, handlers) {
    var service=SERVICES.find(function(item){return item.actionId===String(actionId||"");});
    if(!service || !handlers || typeof handlers.openService!=="function") return false;
    handlers.openService(service.code); return true;
  }
  var idSet=new Set();
  var idValidation=Object.freeze({valid:INTERFACES.every(function(item){var ok=Number.isInteger(item.id)&&item.id>0&&!idSet.has(item.id);idSet.add(item.id);return ok;}),count:INTERFACES.length});
  return Object.freeze({version:VERSION,contractVersion:CONTRACT_VERSION,contextVersion:CONTEXT_VERSION,services:SERVICES,interfaces:INTERFACES,idValidation:idValidation,clarificationEngine:clarificationEngine,getService:function(code){return SERVICE_BY_CODE.get(String(code||""))||null;},lunaContract:lunaContract,validateProposal:validateProposal,stamp:stamp,dispatch:dispatch});
});
