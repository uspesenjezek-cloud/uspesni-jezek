(function (root, factory) {
  var api;
  if (typeof module === "object" && module.exports) {
    api = factory(require("./ponudba-moduli-engine"), require("./svetovalec-storitve-engine"), require("./atena-card-templates"));
    module.exports = api;
  } else api = factory(root && root.UJPonudbaModuliEngine, root && root.UJSvetovalecStoritveEngine, root && root.UJAtenaCardTemplates);
  if (root) root.UJAtenaCardSchema = api;
})(typeof window !== "undefined" ? window : null, function (ponudbaEngine, storitveEngine, templateLibrary) {
  "use strict";

  var VERSION = "atena-card-schema-v4";
  var CANONICAL_TEMPLATES = Object.freeze((templateLibrary && templateLibrary.templates || []).filter(function (template) { return template.approved; }));
  var CANONICAL_TEMPLATE_IDS = Object.freeze(CANONICAL_TEMPLATES.map(function (template) { return template.id; }));
  var TEMPLATE_BY_INTERACTION = Object.freeze({
    "choice-segments":"da-ne-ne-vem", "choice-grid":"mreza-izbir", "choice-list":"navpicni-izbor",
    "dropdown":"spustni-seznam", "short-text":"besedilni-vnos", "quantity-unit":"kolicina-in-enota",
    "rate":"znesek-ali-odstotek", "deadline":"datum-z-gotovostjo", "duration":"kolicina-in-enota",
    "payment-method":"navpicni-izbor", "schedule":"termin-in-pogostost", "duration-pair":"kolicina-in-enota",
    "availability":"drsnik-razpona", "money":"natancen-znesek", "money-or-percent":"znesek-ali-odstotek",
    "date":"datum-z-gotovostjo", "long-text":"besedilni-vnos", "list-builder":"seznam-postavk",
    "document-upload":"dokazilo", "confirmation":"dvojni-segment"
  });
  if (CANONICAL_TEMPLATES.length !== 30 || CANONICAL_TEMPLATES.some(function (template) { return !template.approved; })) {
    throw new Error("Atena UI: manjka potrjena knjižnica 30 kanoničnih zasnov kartic.");
  }
  var FLOW_LABELS = Object.freeze({
    ponudba:"Preverite ponudbo", narocnina:"Preverite naročnino",
    pogajanje:"Pogajajte se ali odpovejte", ponudbe:"Uredite mi ponudbe",
    klic:"Vas kliče prodajalec?"
  });
  var INTERACTION_REASONS = Object.freeze({
    "choice-segments":"Dve ali tri kratke, medsebojno izključujoče možnosti ostanejo hkrati vidne kot veliki tap-gumbi.",
    "choice-grid":"Štiri kratke možnosti se na telefonu berejo kot mreža 2 × 2 brez stisnjenih čipov.",
    "choice-list":"Možnosti so daljše ali številnejše, zato uporabljajo navpični izbor z dovolj prostora za celotno besedilo.",
    "dropdown":"Sekundarni standardizirani seznam uporablja dropdown, da ne prevzame prostora glavnemu dejanju.",
    "short-text":"Odgovor je eno kratko ime, kraj ali druga jedrnata vrednost in ne potrebuje večvrstičnega vnosa.",
    "quantity-unit":"Odgovor ni samo številka: količina in obračunska enota se zajameta skupaj in se shranita kot ena preverljiva vrednost.",
    "rate":"Cena po porabi ali uspehu potrebuje vrednost ter osnovo obračuna; sam slider bi izgubil zahtevano natančnost.",
    "deadline":"Odgovor je lahko datum, približno obdobje ali relativni rok, zato dobi neposredni vnos in jasni možnosti »Ne vem« ter »Približno«.",
    "duration":"Majhna časovna količina uporablja stepper in izrecno enoto; enkratno oziroma nedoločen čas ostaneta veliki bližnjici.",
    "payment-method":"Način plačila je majhen, znan nabor velikih možnosti z možnostjo »Drugo«.",
    "schedule":"Termin je lahko časovno okno ali pogostost, zato uporablja neposredni vnos z varnimi časovnimi bližnjicami.",
    "duration-pair":"Odzivni in odpravljalni čas sta dve ločeni časovni obveznosti in morata biti razvidna v istem kontrolnem sklopu.",
    "availability":"Razpoložljivost je lahko odstotek SLA ali delovni čas; uporabnik najprej izbere pomen in nato vnese ustrezno vrednost.",
    "money":"Znesek mora biti natančen, zato uporablja numerični vnos z valuto in ne približnega sliderja.",
    "money-or-percent":"Predplačilo je lahko znesek ali odstotek, zato uporabnik izbere enoto in vnese natančno številko.",
    "date":"Ko je smiseln točen datum, se uporabi namenski date picker z možnostma »Ne vem« in »Približno«.",
    "long-text":"Vsebina zahteva razlago ali prepis pogojev, zato dobi dovolj visok, samorastoč večvrstični vnos.",
    "list-builder":"Uporabnik mora navesti več ločenih postavk; urejevalnik seznama ohrani vsako postavko pregledno in popravljivo.",
    "document-upload":"Vprašanje zahteva dejansko dokazilo, zato uporablja nalaganje z imenom datoteke, opombo, odstranitvijo in napako.",
    "confirmation":"Kartica ne zbira novega dejstva, temveč prikaže dejanski povzetek za potrditev ali vrnitev v urejanje."
  });
  var FIELD_UI_GROUPS = Object.freeze({
    "choice-segments":[5602,5102,5206,16113,16320,16413],
    "choice-grid":[5001,16104,16105,16108,16121,16216,16318,16415,16416],
    "choice-list":[5002,5003,16116,16201,16217,16309,16403,16410,16419],
    "dropdown":[5701],
    "short-text":[5407,5601,5611,16102,16206,16313,16401,16402],
    "quantity-unit":[5103,5208,16103,16304],
    "rate":[5108],
    "deadline":[5302,16115],
    "duration":[5305,5401,5402,5501,16111,16112,16114],
    "payment-method":[5308],
    "schedule":[5309,16405,16418],
    "duration-pair":[5505],
    "availability":[5507],
    "money":[5101,5106,5307,16107,16307,16308,16407],
    "money-or-percent":[5303],
    "date":[5301,16117,16210,16211,16311,16312,16404,16417],
    "list-builder":[16202,16317,16411],
    "document-upload":[5702,16122,16215],
    "long-text":[5104,5105,5107,5201,5202,5203,5204,5205,5207,5304,5306,5403,5404,5405,5406,5408,5502,5503,5504,5506,5603,5604,5605,5606,5607,5608,5609,5610,5612,16101,16106,16109,16110,16118,16119,16120,16203,16204,16205,16207,16208,16209,16212,16213,16214,16218,16301,16302,16303,16305,16306,16310,16314,16315,16316,16319,16406,16408,16409,16412,16414,16420]
  });
  var FIELD_UI_OVERRIDES = Object.freeze({
    5002:{ otherFieldId:5611 },
    5602:{ showWhen:{ fieldId:5001, values:["posrednik"] } },
    5611:{ showWhen:{ fieldId:5002, values:["obstojeci","hladni-klic","priporocilo","drugo"] } },
    5103:{ units:["kos","ura","dan","m²","m","kg","uporabnik","lokacija","drugo"] },
    5208:{ units:["licenca","uporabnik","naprava","lokacija","drugo"] },
    5308:{ options:["nakazilo:Nakazilo","kartica:Kartica","direktna:Direktna obremenitev","drugo:Drugo"] },
    16103:{ units:["uporabnik","naprava","telefonska številka","lokacija","drugo"] },
    16106:{ showWhen:{ fieldId:16105, values:["delno","ne","ne-vem"] } },
    16114:{ showWhen:{ fieldId:16113, values:["da","nejasno"] } },
    16117:{ showWhen:{ fieldId:16116, values:["spremeni","odpovej"] } },
    16304:{ units:["kos","ura","dan","m²","m","kg","uporabnik","vozilo","lokacija","drugo"] },
    16405:{ quickValues:["Čim prej","Dopoldne","Popoldne"] },
    16418:{ quickValues:["Čim prej","Dopoldne","Po 15.00"] }
  });
  var MODULE_UI_ROWS = [
    [4000,"confirmation",[]],[4001,"conditional",[]],[4002,"conditional",[]],[4003,"stacked",[]],
    [4004,"stacked",[]],[4005,"stacked",[]],[4006,"stacked",[]],[4007,"stacked",[]],[4008,"stacked",[]],
    [4009,"stacked",[]],[4010,"stacked",[]],[4011,"stacked",[]],[4012,"progressive",[5104,5107]],
    [4013,"stacked",[]],[4014,"progressive",[5303,5306,5307,5308]],[4015,"stacked",[]],
    [4016,"progressive",[5402]],[4017,"stacked",[]],[4018,"progressive",[5406,5407]],[4019,"stacked",[]],
    [4020,"progressive",[5503]],[4021,"progressive",[5506,5507]],[4022,"progressive",[5603,5604,5605,5610]],
    [4023,"stacked",[]],[4024,"stacked",[]],[4025,"stacked",[]],[4026,"stacked",[]],[4027,"confirmation",[]],
    [6101,"stacked",[]],[6102,"stacked",[]],[6103,"conditional",[]],[6104,"stacked",[]],[6105,"stacked",[]],
    [6106,"stacked",[]],[6107,"stacked",[]],[6108,"conditional",[]],[6109,"stacked",[]],[6110,"conditional",[]],
    [6111,"stacked",[]],[6112,"stacked",[]],[6113,"stacked",[]],[6114,"stacked",[]],[6115,"stacked",[]],
    [6201,"stacked",[]],[6202,"stacked",[]],[6203,"stacked",[]],[6204,"stacked",[]],[6205,"stacked",[]],
    [6206,"stacked",[]],[6207,"stacked",[]],[6208,"stacked",[]],[6209,"paired",[]],[6210,"stacked",[]],
    [6211,"stacked",[]],[6212,"stacked",[]],[6213,"stacked",[]],[6214,"stacked",[]],[6215,"progressive",[16218]],
    [6301,"stacked",[]],[6302,"stacked",[]],[6303,"stacked",[]],[6304,"stacked",[]],[6305,"stacked",[]],
    [6306,"stacked",[]],[6307,"paired",[]],[6308,"stacked",[]],[6309,"stacked",[]],[6310,"stacked",[]],
    [6311,"stacked",[]],[6312,"stacked",[]],[6313,"stacked",[]],[6314,"stacked",[]],[6315,"stacked",[]],[6316,"stacked",[]],
    [6401,"paired",[]],[6402,"stacked",[]],[6403,"paired",[]],[6404,"stacked",[]],[6405,"paired",[]],
    [6406,"stacked",[]],[6407,"stacked",[]],[6408,"stacked",[]],[6409,"stacked",[]],[6410,"stacked",[]],
    [6411,"stacked",[]],[6412,"stacked",[]],[6413,"stacked",[]],[6414,"paired",[]],[6415,"stacked",[]]
  ];
  var MODULE_UI = new Map(MODULE_UI_ROWS.map(function (row) {
    var reason = row[1] === "confirmation" ? INTERACTION_REASONS.confirmation :
      row[1] === "progressive" ? "Najpomembnejša polja ostanejo vidna, dodatni pogoji pa se razkrijejo v isti kartici brez stiskanja vsebine." :
      row[1] === "conditional" ? "Nadaljnje polje se pokaže samo, kadar ga zahteva prejšnji odgovor, zato kartica ostane kratka in vsebinsko pravilna." :
      row[1] === "paired" ? "Dve kratki sorodni vrednosti sta na namizju v paru, na telefonu pa se varno zložita navpično." :
      "Vsa polja tega vprašanja so neposredno povezana in ostanejo vidna v eni rastoči mobilni kartici.";
    return [row[0], Object.freeze({ layout:row[1], secondaryFieldIds:Object.freeze(row[2].slice()), reason:reason })];
  }));
  function parseOverrideOptions(options) {
    return (options || []).map(function (entry) {
      var parts = String(entry).split(":");
      return Object.freeze({ id:parts.shift(), label:parts.join(":") });
    });
  }
  function buildFieldUiIndex() {
    var index = new Map();
    Object.keys(FIELD_UI_GROUPS).forEach(function (interaction) {
      FIELD_UI_GROUPS[interaction].forEach(function (id) {
        if (index.has(id)) throw new Error("Atena UI: polje " + id + " je razvrščeno dvakrat.");
        var override = FIELD_UI_OVERRIDES[id] || {};
        var templateId = TEMPLATE_BY_INTERACTION[interaction];
        if (!CANONICAL_TEMPLATE_IDS.includes(templateId)) throw new Error("Atena UI: interakcija " + interaction + " nima potrjene kanonične zasnove.");
        index.set(id, Object.freeze(Object.assign({ interaction:interaction, templateId:templateId, reason:INTERACTION_REASONS[interaction], fullWidth:!["short-text","money","date"].includes(interaction) }, override,
          override.options ? { options:Object.freeze(parseOverrideOptions(override.options)) } : {})));
      });
    });
    return index;
  }
  var FIELD_UI = buildFieldUiIndex();
  function enrichField(field) {
    var ui = FIELD_UI.get(Number(field.id));
    if (!ui) throw new Error("Atena UI: manjka vsebinska presoja za polje " + field.id + " (" + field.label + ").");
    return Object.freeze(Object.assign({}, field, { ui:ui }));
  }
  function normaliziraj(value) {
    return String(value == null ? "" : value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  function tokeni(value) {
    return normaliziraj(value).split(" ").filter(function (token) { return token.length > 2; });
  }
  function engineZa(flow) {
    if (flow === "ponudba") return ponudbaEngine || null;
    return storitveEngine && storitveEngine.get ? storitveEngine.get(flow) : null;
  }
  function areaZaModul(engine, moduleId) {
    return engine.areas.find(function (area) { return area.moduleIds.includes(moduleId); }) || null;
  }
  function answerType(fields) {
    if (!fields.length) return "confirmation";
    if (fields.length === 1) return fields[0].type === "select" ? "single-choice" : fields[0].type;
    return fields.every(function (field) { return field.type === "select"; }) ? "choices" : "mixed-form";
  }
  function layoutHint(fields) {
    var choices = fields.reduce(function (all, field) { return all.concat(field.options || []); }, []);
    if (fields.length === 1 && choices.length > 0 && choices.length <= 4 && choices.every(function (choice) { return choice.label.length <= 24; })) return "compact-grid";
    if (fields.length === 1 && choices.length) return "choice-list";
    if (fields.length <= 2) return "compact-form";
    return "progressive-form";
  }
  function kartica(flow, engine, module) {
    var area = areaZaModul(engine, module.id);
    var fields = engine.fields.filter(function (field) { return field.moduleId === module.id; }).map(enrichField);
    var moduleUi = MODULE_UI.get(Number(module.id));
    if (!moduleUi) throw new Error("Atena UI: manjka vsebinska presoja za modul " + module.id + " (" + module.label + ").");
    var choices = fields.reduce(function (all, field) { return all.concat((field.options || []).map(function (option) {
      return Object.freeze({ id:option.id, label:option.label, fieldId:field.id });
    })); }, []);
    var hasOther = choices.some(function (choice) { return choice.id === "drugo" || /drugo/i.test(choice.label); });
    var searchText = [area && area.label, area && area.description, module.label, module.description, module.question]
      .concat(fields.map(function (field) { return [field.label, field.help].concat((field.options || []).map(function (option) { return option.label; })).join(" "); })).join(" ");
    return Object.freeze({
      id:flow + ":" + module.id, flow:flow, flowLabel:FLOW_LABELS[flow],
      areaCode:area ? area.code : "skupno", areaLabel:area ? area.label : "Skupno",
      moduleId:module.id, moduleCode:module.code, title:module.label,
      question:module.question || module.label, description:module.description || "",
      answerType:answerType(fields), fields:Object.freeze(fields.slice()), primaryChoices:Object.freeze(choices),
      templateIds:Object.freeze(Array.from(new Set(fields.map(function (field) { return field.ui.templateId; })))),
      hasOther:hasOther, followUps:Object.freeze(hasOther ? [{ when:"other", type:"text", label:"Opišite drugo možnost" }] : []),
      validation:Object.freeze({ requiredFieldIds:Object.freeze(fields.filter(function (field) { return field.required; }).map(function (field) { return field.id; })) }),
      layoutHint:moduleUi.layout, ui:moduleUi, ariaLabel:(module.question || module.label) + " — " + (area ? area.label : FLOW_LABELS[flow]),
      stateMapping:Object.freeze({ storage:"existing-draft", moduleId:module.id }),
      eventMapping:Object.freeze({ action:"open-existing-area", flow:flow, areaCode:area ? area.code : "", moduleId:module.id }),
      source:Object.freeze({ engine:flow === "ponudba" ? "ponudba-moduli-engine.js" : "svetovalec-storitve-engine.js", moduleId:module.id }),
      searchTokens:Object.freeze(Array.from(new Set(tokeni(searchText))))
    });
  }

  var flows = ["ponudba", "narocnina", "pogajanje", "ponudbe", "klic"];
  var catalog = Object.freeze(flows.reduce(function (all, flow) {
    var engine = engineZa(flow);
    return engine ? all.concat(engine.modules.map(function (module) { return kartica(flow, engine, module); })) : all;
  }, []));
  function score(card, queryTokens) {
    return queryTokens.reduce(function (total, queryToken) {
      var exact = card.searchTokens.includes(queryToken);
      var partial = !exact && card.searchTokens.some(function (candidate) { return candidate.indexOf(queryToken) === 0 || queryToken.indexOf(candidate) === 0; });
      return total + (exact ? 4 : partial ? 2 : 0);
    }, 0);
  }
  function detectRelevantCards(text, flow, limit) {
    var queryTokens = tokeni(text);
    if (!queryTokens.length) return [];
    return catalog.filter(function (card) { return card.flow === flow; }).map(function (card) { return { card:card, score:score(card, queryTokens) }; })
      .filter(function (item) { return item.score > 0; }).sort(function (a, b) { return b.score - a.score || a.card.moduleId - b.card.moduleId; })
      .slice(0, Math.max(1, Number(limit) || 6)).map(function (item) { return item.card; });
  }
  function relevantAreas(text, flow, limit) {
    var engine = engineZa(flow);
    if (!engine) return [];
    var groups = [];
    detectRelevantCards(text, flow, 12).forEach(function (card) {
      var existing = groups.find(function (group) { return group.code === card.areaCode; });
      if (existing) { existing.moduleIds.push(card.moduleId); return; }
      var area = engine.areas.find(function (candidate) { return candidate.code === card.areaCode; });
      groups.push({ code:card.areaCode, label:card.areaLabel, description:area ? area.description : card.description,
        moduleIds:[card.moduleId], flow:flow, ariaLabel:"Odpri področje " + card.areaLabel });
    });
    return groups.slice(0, Math.max(1, Number(limit) || 3)).map(function (group) {
      group.moduleIds = Object.freeze(group.moduleIds.slice()); return Object.freeze(group);
    });
  }
  function toggleChoice(selected, value, multiple) {
    var current = Array.isArray(selected) ? selected.slice() : [];
    if (!multiple) return current[0] === value ? [] : [value];
    return current.includes(value) ? current.filter(function (item) { return item !== value; }) : current.concat(value);
  }
  function getCard(flow, moduleId) {
    return catalog.find(function (card) { return card.flow === flow && card.moduleId === Number(moduleId); }) || null;
  }
  function decorateFields(fields) {
    return Object.freeze((fields || []).map(enrichField));
  }
  function matrixReport() {
    var fieldIds = catalog.reduce(function (all, card) { return all.concat(card.fields.map(function (field) { return field.id; })); }, []);
    var missingTemplateBindings = catalog.reduce(function (all, card) { return all.concat(card.fields.filter(function (field) { return !field.ui.templateId || !CANONICAL_TEMPLATE_IDS.includes(field.ui.templateId); }).map(function (field) { return field.id; })); }, []);
    return Object.freeze({ modules:catalog.length, fields:fieldIds.length, reviewedModules:MODULE_UI.size, reviewedFields:FIELD_UI.size,
      missingModules:Object.freeze(catalog.filter(function (card) { return !MODULE_UI.has(card.moduleId); }).map(function (card) { return card.moduleId; })),
      missingFields:Object.freeze(fieldIds.filter(function (id) { return !FIELD_UI.has(Number(id)); })),
      canonicalTemplates:CANONICAL_TEMPLATES.length, approvedTemplates:CANONICAL_TEMPLATES.filter(function (template) { return template.approved; }).length,
      missingTemplateBindings:Object.freeze(missingTemplateBindings) });
  }
  return Object.freeze({ version:VERSION, flows:Object.freeze(flows), catalog:catalog, getEngine:engineZa,
    detectRelevantCards:detectRelevantCards, relevantAreas:relevantAreas, toggleChoice:toggleChoice,
    getCard:getCard, decorateFields:decorateFields, matrixReport:matrixReport, interactionReasons:INTERACTION_REASONS,
    canonicalTemplates:CANONICAL_TEMPLATES, canonicalTemplateIds:CANONICAL_TEMPLATE_IDS, templateByInteraction:TEMPLATE_BY_INTERACTION });
});
