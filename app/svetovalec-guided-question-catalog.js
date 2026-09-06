(function (root, factory) {
  var api;
  if (typeof module === "object" && module.exports) api = factory(require("./svetovalec-capability-catalog"));
  else api = factory(root && root.UJSvetovalecCapabilityCatalog);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UJSvetovalecGuidedQuestionCatalog = api;
})(typeof window !== "undefined" ? window : null, function (capabilities) {
  "use strict";
  var VERSION="svetovalec-guided-question-catalog-v4";
  function freeze(value){return Object.freeze(value);}
  function option(id,label,facts){return freeze({id:id,label:label,facts:freeze(facts||{})});}
  function q(id,sectionId,kind,widgetId,question,options,config){
    var base={id:id,revision:1,interfaceId:"atena:card:svetovalec:"+id,fieldInterfaceId:"atena:field:svetovalec:"+id+":answer",contextVersion:"atena-interface-context-v2",sectionId:sectionId,kind:kind,widgetId:widgetId,question:question,options:freeze(options||[]),required:true,allowFreeText:true,dependsOn:freeze([])};
    var result=Object.assign(base,config||{});
    result.context=freeze({purpose:question,dataShape:result.valueType||((kind==="multiple")?"enum[]":"enum"),widgetId:widgetId,validation:freeze({required:result.required!==false,minSelections:Number(result.minSelections||0),minValue:result.minValue,maxValue:result.maxValue}),persistence:"guided-session",antiPatterns:freeze(["Ne zamenjaj z generično mrežo gumbov.","Ne izgubi odgovora pri obnovi ali spremembi prejšnjega koraka."])});
    return freeze(result);
  }
  var actionOptions=capabilities.actions.map(function(a){return option(a.code,a.label,{actionCode:a.code});});
  var modelOptions=freeze([
    option("enkratno","Enkratni posel",{model:"enkratno"}),option("projekt","Projekt po meri",{model:"projekt"}),
    option("redno","Redno sodelovanje",{model:"redno"}),option("narocnina","Naročnina ali vezava",{model:"narocnina"})
  ]);
  var SECTIONS=freeze([
    freeze({id:"razumevanje",label:"Kaj res potrebujete",purpose:"Potrdimo namen in predmet, da Atena ne rešuje napačnega problema."}),
    freeze({id:"obseg",label:"Obseg in rezultat",purpose:"Določimo, kaj mora biti narejeno in po čem boste vedeli, da je dobro."}),
    freeze({id:"tveganja",label:"Pogoji in tveganja",purpose:"Odkrijemo stroške, omejitve, lastništvo in varne meje."}),
    freeze({id:"izboljsave",label:"Izboljšave in naslednji korak",purpose:"Izberemo najkoristnejšo izboljšavo in pripravimo dokazljiv naslednji korak."})
  ]);
  var FAMILY_CHECKS=freeze({
    material:{kind:"multiple",widgetId:"izbirnik-oznak",question:"Kaj pri materialu mora biti točno določeno, da bodo ponudbe primerljive?",options:["Kakovost ali razred","Količina in enota","Dobava ali prevzem","Možnost vračila"]},
    orodje:{kind:"multiple",widgetId:"kontrolni-seznam-dokazil",question:"Kaj mora ponudnik dokazati o opremi ali orodju?",options:["Zahtevano zmogljivost","Združljivost z obstoječo opremo","Garancijo","Servis in dobavljivost delov"]},
    najem:{kind:"single",widgetId:"odlocitvena-pot",question:"Kako se mora najem zaključiti?",options:["Prevzem in vračilo na lokaciji","Ponudnik dostavi in odpelje","Možnost podaljšanja","Še ni določeno"]},
    zascita:{kind:"multiple",widgetId:"kontrolni-seznam-dokazil",question:"Katera dokazila morajo spremljati zaščitno opremo?",options:["Zahtevani standard","Izjava o skladnosti","Rok uporabe","Navodila za uporabo in menjavo"]},
    vozila:{kind:"multiple",widgetId:"razvrscanje-prioritet",question:"Razvrstite, kaj je pri vozilu najpomembnejše.",options:["Skupni mesečni strošek","Dobavni rok","Servisni paket","Omejitev kilometrov","Pogoji ob vračilu"],minSelections:2},
    flota:{kind:"multiple",widgetId:"izbirnik-oznak",question:"Kaj mora rešitev za floto spremljati ali upravljati?",options:["Vozila in uporabnike","Porabo in stroške","Kartice ali naprave","Poročila in opozorila","Izvoz podatkov"]},
    energija:{kind:"single",widgetId:"primerjava-moznosti",question:"Na kateri osnovi želite preveriti obljubljeni prihranek?",options:["Po dejanskih preteklih računih","Po izračunu ponudnika","S primerjavo več ponudb","Osnova še ni določena"]},
    it:{kind:"multiple",widgetId:"kontrolni-seznam-dokazil",question:"Kaj mora pri IT-storitvi ostati pod vašim nadzorom?",options:["Lastništvo podatkov","Skrbniški dostopi","Varnostne kopije","Možnost izvoza in migracije","Odziv podpore"]},
    marketing:{kind:"multiple",widgetId:"izbirnik-oznak",question:"Katere rezultate mora ponudnik meriti in prikazati?",options:["Pridobljena povpraševanja","Strošek na rezultat","Porabo oglaševalskega proračuna","Doseg in odziv","Prodajo ali donos"]},
    oblikovanje:{kind:"multiple",widgetId:"kontrolni-seznam-dokazil",question:"Kaj morate po zaključku oblikovanja prejeti?",options:["Končne datoteke za uporabo","Izvorne datoteke","Dogovorjene formate","Pravice uporabe","Število popravkov"]},
    posredniki:{kind:"multiple",widgetId:"matrika-tveganja",question:"Kaj mora pogodba jasno določiti pri kontaktih ali posredovanju?",options:["Kaj šteje kot veljaven kontakt","Kdaj nastane provizija","Kako se rešijo podvojeni kontakti","Kako poteka reklamacija","Ali velja ekskluzivnost"]},
    finance:{kind:"multiple",widgetId:"razvrscanje-prioritet",question:"Razvrstite stroške financiranja, ki jih morate primerjati.",options:["Skupni znesek vračila","Obrestna mera","Vse provizije","Zavarovanja in jamstva","Predčasno poplačilo"],minSelections:2},
    zavarovanje:{kind:"multiple",widgetId:"izbirnik-oznak",question:"Kaj mora biti pri zavarovanju primerjano med ponudbami?",options:["Kritja","Limiti","Franšiza","Izključitve","Postopek prijave škode"]},
    poslovne:{kind:"single",widgetId:"navpicni-izbor",question:"Kako bo ponudnik dokazal, da je storitev uspešno zaključena?",options:["Z merljivim rezultatom","S predano dokumentacijo","S potrjenimi mejniki","Z opravljenimi urami","Še ni dogovorjeno"]},
    skladnost:{kind:"multiple",widgetId:"kontrolni-seznam-dokazil",question:"Kaj mora biti pri pregledu ali skladnosti dokazljivo?",options:["Pooblastilo izvajalca","Obseg pregledane opreme ali lokacij","Veljavnost meritve","Končni zapisnik ali certifikat"]}
  });
  function familyQuestions(profile){
    if(!profile||profile.familyCode==="telekom")return [];
    var definition=FAMILY_CHECKS[profile.familyCode];if(!definition)return [];
    return [q("family:"+profile.familyCode+":focus","obseg",definition.kind,definition.widgetId,definition.question,definition.options.map(function(label,index){var facts={};facts["family:"+profile.familyCode+":focus"]=[label];return option("focus:"+index,label,facts);}),{minSelections:definition.minSelections||1})];
  }
  function profileOptions(seed){
    var ids=(seed.profileCandidates||[]).slice();
    if(seed.profileId && ids.indexOf(seed.profileId)<0) ids.unshift(seed.profileId);
    var rows=ids.map(function(id){return capabilities.byProfileId(id);}).filter(Boolean);
    var primary=capabilities.byProfileId(seed.profileId);
    if(primary&&rows.length<4){
      var adjacent={marketing:["marketing","oblikovanje","it"],oblikovanje:["oblikovanje","marketing"],it:["it","telekom","marketing"],material:["material","orodje","najem"]};
      var families=adjacent[primary.familyCode]||[primary.familyCode];
      families.forEach(function(familyCode){capabilities.profiles.filter(function(row){return row.familyCode===familyCode;}).forEach(function(row){if(rows.length<4&&!rows.some(function(item){return item.profileId===row.profileId;}))rows.push(row);});});
    }
    capabilities.profiles.forEach(function(row){if(!rows.some(function(item){return item.profileId===row.profileId;}))rows.push(row);});
    return rows.map(function(row){return option(String(row.profileId),row.label,{profileId:row.profileId,familyCode:row.familyCode});});
  }
  function domainQuestions(profile){
    var pack=profile || {label:"storitev",deliverableFamilies:["jasen obseg","merljiv rezultat","rok","predaja"],riskFamilies:["nejasna cena","manjkajoč obseg","nejasna odgovornost"],evidenceNeeded:["ponudba","pogodba","pisna potrditev"]};
    var prefix=profile ? "Pri »"+profile.label+"«" : "Pri tej storitvi";
    return [
      q("domain:deliverables","obseg","multiple","izbirnik-oznak",prefix+": kaj mora ponudnik dejansko predati?",pack.deliverableFamilies.map(function(x,i){return option("deliverable:"+i,x,{deliverables:[x]});}),{minSelections:1}),
      q("domain:success","obseg","single","navpicni-izbor","Po čem boste vi presodili, da je rezultat res dober?",[
        option("merljiv-rezultat","Po merljivem rezultatu",{successMetric:"measurable"}),option("dogovorjen-obseg","Po dogovorjenem obsegu",{successMetric:"scope"}),
        option("rok-kakovost","Po roku in kakovosti",{successMetric:"quality-time"}),option("se-ne-vem","Tega še nismo določili",{successMetric:"missing"})
      ]),
      q("domain:current-satisfaction","obseg","rating","drsnik-razpona","Kako zadovoljni ste s tem, kar imate ali vam je bilo ponujeno zdaj?",[
        option("1","1 – zelo nezadovoljni",{satisfaction:1}),option("2","2",{satisfaction:2}),option("3","3",{satisfaction:3}),option("4","4",{satisfaction:4}),option("5","5 – zelo zadovoljni",{satisfaction:5})
      ],{optional:true}),
      q("domain:risks","tveganja","multiple","matrika-tveganja","Kaj vas pri tej odločitvi najbolj skrbi?",pack.riskFamilies.map(function(x,i){return option("risk:"+i,x,{risks:[x]});}),{minSelections:1}),
      q("domain:evidence","tveganja","multiple","kontrolni-seznam-dokazil","Kaj že imate v pisni obliki?",pack.evidenceNeeded.map(function(x,i){return option("evidence:"+i,x,{evidence:[x]});}).concat([option("nic","Ničesar še nimam",{evidenceStatus:"missing"})]),{minSelections:1})
    ];
  }
  function actionQuestions(actionCode){
    if(actionCode==="narocnina") return [
      q("action:duration","tveganja","single","navpicni-izbor","Kako dolgo ste vezani oziroma kako se sodelovanje podaljšuje?",[option("brez-vezave","Brez vezave"),option("dolocen-cas","Za določen čas"),option("samodejno","Samodejno se podaljšuje"),option("nejasno","Ni jasno")]),
      q("action:exit","tveganja","single","odlocitvena-pot","Kaj želite doseči glede naročnine?",[option("obdrzi","Obdržati, če so pogoji dobri"),option("spremeni","Spremeniti paket ali pogoje"),option("odpovej","Varno odpovedati")])
    ];
    if(actionCode==="pogajanje") return [
      q("action:negotiation-goal","tveganja","multiple","pogajalski-prostor","Kaj želite izboljšati?",[option("cena","Ceno"),option("obseg","Več vključenega"),option("rok","Rok ali odzivnost"),option("izstop","Pogoje izstopa")],{minSelections:1}),
      q("action:alternative","tveganja","single","odlocitvena-pot","Kaj boste naredili, če ponudnik ne sprejme vaših ključnih pogojev?",[option("druga-ponudba","Izbral bom drugo ponudbo"),option("omejim-obseg","Omejil bom obseg"),option("ostanem","Vseeno bom nadaljeval"),option("ne-vem","Še ne vem")])
    ];
    if(actionCode==="ponudbe") return [
      q("action:comparison","tveganja","multiple","razvrscanje-prioritet","Po čem naj Atena primerja izvajalce?",[option("cena","Skupna cena"),option("kakovost","Kakovost in reference"),option("rok","Rok izvedbe"),option("pogoji","Pogodbeni pogoji"),option("podpora","Podpora po izvedbi")],{minSelections:2})
    ];
    if(actionCode==="klic") return [
      q("action:call-boundary","tveganja","multiple","kontrolni-seznam-dokazil","Česa med klicem ne želite potrditi brez pisnega dokazila?",[option("cena","Končne cene"),option("vezava","Vezave"),option("narocilo","Naročila"),option("dostopi","Predaje dostopov ali podatkov")],{minSelections:1})
    ];
    return [
      q("action:price-clarity","tveganja","single","cenovni-most","Kako jasna je končna cena?",[option("jasna","Jasna in dokončna"),option("dodatki","Možni so dodatki"),option("poraba","Odvisna je od porabe ali uspeha"),option("nejasna","Ni jasno")])
    ];
  }
  function telecomQuestions(answers){
    var account=answers["telecom:account-type"]&&answers["telecom:account-type"].value&&answers["telecom:account-type"].value[0];
    var binding=answers["telecom:binding"]&&answers["telecom:binding"].value&&answers["telecom:binding"].value[0];
    var rows=[
      q("telecom:account-type","razumevanje","single","dvojni-segment","Za kakšno mobilno naročnino se pogajate?",[
        option("poslovna","Poslovna naročnina",{telecomAccountType:"business"}),option("zasebna","Zasebna naročnina",{telecomAccountType:"private"})
      ]),
      q("telecom:line-count","obseg","number","kolicina-in-enota",account==="poslovna"?"Koliko mobilnih številk vključuje naročnina?":"Koliko mobilnih številk želite vključiti?",[],{valueType:"number",valueSuffix:"številk",factKey:"telecomLineCount",minValue:1,maxValue:500,dependsOn:freeze(["telecom:account-type"])}),
      q("telecom:current-price","obseg","money","natancen-znesek","Koliko trenutno plačujete na mesec?",[],{valueType:"money",factKey:"telecomMonthlyPriceEur",minValue:0,maxValue:100000}),
      q("telecom:current-package","obseg","multiple","izbirnik-oznak","Kaj mora novi ali izboljšani paket vključevati?",[
        option("podatki","Več mobilnih podatkov",{telecomNeeds:["data"]}),option("klici","Neomejeni klici in sporočila",{telecomNeeds:["calls"]}),option("roaming-eu","Gostovanje v EU",{telecomNeeds:["roaming-eu"]}),option("roaming-world","Gostovanje zunaj EU",{telecomNeeds:["roaming-world"]}),option("naprava","Telefon ali napravo",{telecomNeeds:["device"]}),option("podpora","Prednostno podporo",{telecomNeeds:["support"]})
      ],{minSelections:1}),
      q("telecom:binding","tveganja","single","odlocitvena-pot","Kakšna je trenutna vezava?",[
        option("brez","Brez vezave",{telecomBinding:"none"}),option("iztece-kmalu","Izteče v naslednjih 3 mesecih",{telecomBinding:"soon"}),option("aktivna","Vezava še traja",{telecomBinding:"active"}),option("ne-vem","Ne vem",{telecomBinding:"unknown"})
      ]),
      q("telecom:device-included","tveganja","single","da-ne-ne-vem","Ali trenutna cena vključuje telefon ali drugo napravo?",[
        option("da","Da",{telecomDeviceIncluded:true}),option("ne","Ne",{telecomDeviceIncluded:false}),option("ne-vem","Ne vem",{telecomDeviceIncluded:"unknown"})
      ]),
      q("telecom:competition","tveganja","single","primerjava-moznosti","Ali že imate primerljivo ponudbo drugega operaterja?",[
        option("da","Da, imam konkretno ponudbo",{telecomCompetitorOffer:true}),option("okvirno","Poznam le okvirne cene",{telecomCompetitorOffer:"partial"}),option("ne","Ne še",{telecomCompetitorOffer:false})
      ]),
      q("telecom:saving-target","izboljsave","single","ciljni-pas","Kakšen prihranek želite doseči?",[
        option("do-10","Do 10 %",{telecomSavingTarget:"0-10"}),option("10-20","10–20 %",{telecomSavingTarget:"10-20"}),option("nad-20","Več kot 20 %",{telecomSavingTarget:"20+"}),option("vec-vkljucenega","Enaka cena, vendar več vključeno",{telecomSavingTarget:"more-value"})
      ])
    ];
    var bindingDetails=[];
    if(binding==="aktivna"||binding==="iztece-kmalu") bindingDetails.push(q("telecom:binding-end","tveganja","date","datum-z-gotovostjo","Kdaj se vezava izteče?",[],{valueType:"date",factKey:"telecomBindingEnd",dependsOn:freeze(["telecom:binding"])}));
    if(binding==="aktivna"||binding==="iztece-kmalu"||binding==="ne-vem") bindingDetails.push(q("telecom:cancellation-period","tveganja","single","navpicni-izbor","Kakšen je odpovedni rok?",[
      option("do-30","Do 30 dni",{telecomCancellationPeriod:"0-30"}),option("31-90","31–90 dni",{telecomCancellationPeriod:"31-90"}),option("nad-90","Več kot 90 dni",{telecomCancellationPeriod:"90+"}),option("ne-vem","Ne vem",{telecomCancellationPeriod:"unknown"})
    ],{dependsOn:freeze(["telecom:binding"])}));
    if(bindingDetails.length) rows.splice.apply(rows,[5,0].concat(bindingDetails));
    if(binding==="aktivna"||binding==="iztece-kmalu"||binding==="ne-vem") rows.push(q("telecom:exit-readiness","izboljsave","single","odlocitvena-pot","Če operater ne izboljša pogojev, kako pripravljeni ste na menjavo?",[
      option("takoj","Pripravljen sem zamenjati",{telecomSwitchReadiness:"ready"}),option("ob-izteku","Zamenjam ob izteku vezave",{telecomSwitchReadiness:"at-expiry"}),option("le-pogajanje","Za zdaj želim samo pogajanje",{telecomSwitchReadiness:"negotiate-only"})
    ],{dependsOn:freeze(["telecom:binding"])}));
    return rows;
  }
  function build(seed,answers){
    answers=answers||{};
    var actionCode=(answers["intent:action"]&&answers["intent:action"].value&&answers["intent:action"].value[0])||seed.actionCode||"ponudba";
    var selectedProfile=answers["intent:profile"]&&Number(answers["intent:profile"].value&&answers["intent:profile"].value[0]);
    var profile=capabilities.byProfileId(selectedProfile||seed.profileId);
    var strongAction=seed.actionConfidence>=2,strongProfile=seed.profileConfidence>=2;
    var questions=[];
    if(!strongAction) questions.push(q("intent:action","razumevanje","single","mreza-izbir","Kaj želite, da Atena naredi za vas?",actionOptions));
    if(!strongProfile) questions.push(q("intent:profile","razumevanje","single","iskalni-izbirnik","Kaj je predmet ponudbe ali sodelovanja?",profileOptions(seed)));
    if(profile&&profile.familyCode==="telekom") {
      questions=questions.concat(telecomQuestions(answers));
      questions=questions.concat(domainQuestions(profile).filter(function(item){return ["domain:current-satisfaction","domain:risks","domain:evidence"].includes(item.id);}));
    } else {
      questions.push(q("intent:model","razumevanje","single","mreza-izbir","Kakšna je oblika sodelovanja?",modelOptions));
      questions=questions.concat(familyQuestions(profile)).concat(domainQuestions(profile));
    }
    questions=questions.concat(actionQuestions(actionCode));
    var low=answers["domain:current-satisfaction"]&&Number(answers["domain:current-satisfaction"].value&&answers["domain:current-satisfaction"].value[0])<=2;
    if(low) questions.push(q("improvement:failure","izboljsave","multiple","skupine-odstopanj","Kaj je treba pri sedanji rešitvi nujno popraviti?",[
      option("rezultat","Rezultat ni dovolj dober"),option("komunikacija","Komunikacija ali odzivnost"),option("strosek","Stroški"),option("rok","Roki"),option("zaupanje","Zaupanje in dokazila")
    ],{minSelections:1,dependsOn:freeze(["domain:current-satisfaction"])}));
    questions.push(q("improvement:priority","izboljsave","single","navpicni-izbor","Kaj je najpomembnejši naslednji korak?",[
      option("jasen-obseg","Najprej jasen obseg"),option("dokazila","Najprej zbrati dokazila"),option("primerjava","Primerjati druge možnosti"),option("pogajanje","Izboljšati pogoje"),option("odlocitev","Pripraviti odločitev")
    ]));
    questions.push(q("review:confirm","izboljsave","single","sprememba-in-potrditev","Ali naj Atena iz teh odgovorov pripravi predogled?",[option("da","Da, pripravi predogled"),option("nazaj","Ne, želim še popraviti odgovore")],{allowFreeText:false}));
    var activeSections=SECTIONS.map(function(section){return freeze(Object.assign({},section,{questionIds:freeze(questions.filter(function(item){return item.sectionId===section.id;}).map(function(item){return item.id;}))}));}).filter(function(section){return section.questionIds.length;});
    return freeze({version:VERSION,questions:freeze(questions),sections:freeze(activeSections),byId:freeze(questions.reduce(function(out,item){out[item.id]=item;return out;},{}))});
  }
  function planningDefinitions(){
    var out={};
    capabilities.actions.forEach(function(action){capabilities.profiles.forEach(function(profile){
      var seed={actionCode:action.code,actionConfidence:99,profileId:profile.profileId,profileConfidence:99,profileCandidates:[profile.profileId]};
      [{},{"domain:current-satisfaction":{value:["1"]},"telecom:binding":{value:["aktivna"]}}].forEach(function(answers){build(seed,answers).questions.forEach(function(item){if(!out[item.id])out[item.id]=item;});});
    });});
    return Object.keys(out).map(function(id){return out[id];});
  }
  var PLANNING_DEFINITIONS=freeze(planningDefinitions());
  var ALL_QUESTION_IDS=freeze(PLANNING_DEFINITIONS.map(function(item){return item.id;}));
  function plannerBranch(id){
    if(id==="telecom:binding-end")return freeze({questionId:"telecom:binding",optionIds:freeze(["aktivna","iztece-kmalu"])});
    if(id==="telecom:cancellation-period"||id==="telecom:exit-readiness")return freeze({questionId:"telecom:binding",optionIds:freeze(["aktivna","iztece-kmalu","ne-vem"])});
    if(id==="improvement:failure")return freeze({questionId:"domain:current-satisfaction",optionIds:freeze(["1","2"])});
    return null;
  }
  function planningManifest(){return freeze(PLANNING_DEFINITIONS.map(function(item){return freeze({
    id:item.id,sectionId:item.sectionId,kind:item.kind,widgetId:item.widgetId,question:item.question,
    options:freeze((item.options||[]).map(function(entry){return freeze({id:entry.id,label:entry.label});})),
    valueType:item.valueType||null,minValue:item.minValue==null?null:item.minValue,maxValue:item.maxValue==null?null:item.maxValue,
    dependsOn:item.dependsOn,showWhen:plannerBranch(item.id)
  });}));}
  function allowedQuestionIds(seed){
    var answers={"domain:current-satisfaction":{value:["1"]},"telecom:binding":{value:["aktivna"]}};
    return freeze(build(seed,answers).questions.map(function(item){return item.id;}));
  }
  return freeze({version:VERSION,sections:SECTIONS,build:build,planningManifest:planningManifest,allQuestionIds:ALL_QUESTION_IDS,allowedQuestionIds:allowedQuestionIds});
});
