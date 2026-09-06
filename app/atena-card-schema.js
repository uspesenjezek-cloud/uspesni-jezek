(function (root, factory) {
  var api;
  if (typeof module === "object" && module.exports) {
    api = factory(require("./ponudba-moduli-engine"), require("./svetovalec-storitve-engine"), require("./atena-card-templates"), require("./atena-widget-contract"), require("./nazorjeva-engine"), require("./atena-card-combinations"));
    module.exports = api;
  } else api = factory(root && root.UJPonudbaModuliEngine, root && root.UJSvetovalecStoritveEngine, root && root.UJAtenaCardTemplates, root && root.UJAtenaWidgetContract, root && root.UJNazorjevaEngine, root && root.UJAtenaCardCombinations);
  if (root) root.UJAtenaCardSchema = api;
})(typeof window !== "undefined" ? window : null, function (ponudbaEngine, storitveEngine, templateLibrary, widgetContract, nazorjevaEngine, kombinacije) {
  "use strict";

  var VERSION = "atena-card-schema-v7";
  var PONUDBA_MANIFEST_VERSION = "ponudba-question-widget-manifest-v1";
  var CANONICAL_TEMPLATES = Object.freeze((templateLibrary && templateLibrary.templates || []).filter(function (template) { return template.approved; }));
  var CANONICAL_TEMPLATE_IDS = Object.freeze(CANONICAL_TEMPLATES.map(function (template) { return template.id; }));
  var CANONICAL_TEMPLATE_BY_ID = new Map(CANONICAL_TEMPLATES.map(function (template) { return [template.id, template]; }));
  if (!widgetContract || widgetContract.contracts.length !== CANONICAL_TEMPLATES.length) throw new Error("Atena UI: manjka strojni contract vseh odobrenih widgetov.");
  var TEMPLATE_BY_INTERACTION = Object.freeze({
    "choice-segments":"da-ne-ne-vem", "choice-grid":"mreza-izbir", "choice-list":"navpicni-izbor",
    "dropdown":"spustni-seznam", "short-text":"besedilni-vnos", "quantity-unit":"kolicina-in-enota",
    "rate":"znesek-ali-odstotek", "deadline":"datum-z-gotovostjo", "duration":"kolicina-in-enota",
    "payment-method":"navpicni-izbor", "schedule":"termin-in-pogostost", "duration-pair":"kolicina-in-enota",
    "availability":"drsnik-razpona", "money":"natancen-znesek", "money-or-percent":"znesek-ali-odstotek",
    "date":"datum-z-gotovostjo", "long-text":"besedilni-vnos", "list-builder":"seznam-postavk",
    "document-upload":"dokazilo", "confirmation":"dvojni-segment"
  });
  if (CANONICAL_TEMPLATES.length !== 62 || CANONICAL_TEMPLATES.some(function (template) { return !template.approved; })) {
    throw new Error("Atena UI: manjka potrjena knjižnica 62 kanoničnih zasnov kartic iz registra NAZORJEVA.");
  }
  var FLOW_LABELS = Object.freeze({
    ponudba:"Preverite ponudbo", narocnina:"Preverite sklenjene pogodbe",
    pogajanje:"Pogajajte se ali odpovejte", ponudbe:"Poiščite mi ponudbe",
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
    "choice-segments":[5003,5004,5005,5006,5602,5102,5206,16113,16320,16413],
    "choice-grid":[5001,16104,16105,16108,16121,16216,16318,16415,16416],
    "choice-list":[5002,16116,16201,16217,16309,16403,16410,16419],
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
    "date":[5301,16117,16123,16210,16211,16311,16312,16404,16417],
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
  var PONUDBA_QUESTION_AUDIT_ROWS = [
    [4009,null,"FIELD_COMPOSITION_EXACT_TYPES",["cena","ddv"],"Natančen znesek in zaprt DDV odgovor sta dve ločeni canonical vrednosti.",["graficni-cenovni-most:zahteva strukturirane odbitke, dodatke in izračun končne vsote"],"Znesek in DDV se zložita navpično.","Kratki polji sta lahko v paru."],
    [4010,null,"FIELD_WIDGET_SINGLE",["cena","ponavljanje"],"Eno polje že neposredno uporablja natančen znesek; sestavljeni widget ne bi dodal podatkovne koristi.",["pravilo-ponavljanja:ni podatka o intervalu ali dnevih"],"En natančen znesek čez polno širino.","En natančen znesek ostane kompakten."],
    [4011,null,"FIELD_WIDGET_SINGLE",["cena","poraba","uspeh"],"Eno polje potrebuje natančno vrednost in osnovo obračuna.",["drsnik-razpona:izgubi zahtevano natančnost"],"Vrednost in osnova se zložita brez horizontalnega premika.","Vrednost in osnova sta v naravnem paru."],
    [4012,null,"FIELD_COMPOSITION_EXACT_TYPES",["cena","dodatki","popust","spremembe"],"Tri besedilne klavzule nimajo dovolj strukturiranih števil za varen cenovni izračun.",["cenovni-most:iz besedila ne sme ugibati števil","graficni-cenovni-most:ni popolne strukturirane vsote"],"Obvezni dodatki so vidni, neobvezni pogoji se razkrijejo.","Sorodne klavzule se berejo v dveh stolpcih, kadar je prostor."],
    [4004,null,"FIELD_WIDGET_SINGLE",["predmet","rezultat"],"En sam večvrstični odgovor o predmetu in pričakovanem rezultatu.",["hierarhicni-izbor:ni zaprte hierarhije postavk"],"Polna širina in samorastoč vnos.","Polna širina ohrani en mentalni model."],
    [4005,"matrika-vkljucenosti","MODULE_STRUCTURED_BENEFIT",["postavka","vključeno"],"Vključeno in izključeno sta komplementarni strani istega pregleda; matrika zmanjša možnost spregledane postavke.",["izbirnik-oznak:ne loči vključenega od doplačila","besedilni-vnos:samostojno ostane field fallback"],"Vrstice se zložijo; posamezna field ID-ja ostaneta ločena.","Sorodni strani sta pregledni druga ob drugi."],
    [4006,null,"FIELD_WIDGET_SINGLE",["količina","enota"],"Količina brez enote ni veljavna; potrjeni stepper ju zajame skupaj.",["stevilcna-lestvica:ni primerna za poljubno natančno količino"],"Stepper in enota ostaneta v eni stabilni vrstici.","Ista kontrola brez dodatne dekoracije."],
    [4007,null,"FIELD_COMPOSITION_EXACT_TYPES",["specifikacija","kakovost","licenca"],"Specifikacija in morebitna licenčna količina sta različna canonical podatka.",["hierarhicni-izbor:ni zaprte drevesne taksonomije"],"Polji se zložita; licenčno polje se pokaže le, ko ga plan zahteva.","Kratka licenčna količina je lahko ob specifikaciji."],
    [4008,null,"FIELD_WIDGET_SINGLE",["obveznost","predpogoj"],"Odgovor je odprt seznam naročnikovih obveznosti.",["mreza-odvisnosti:ni več stanj ali vrstnega reda"],"Samorastoč vnos čez polno širino.","Enako brez umetne mreže."],
    [4019,null,"FIELD_COMPOSITION_DISTINCT_PURPOSES",["prevzem","merila","primerjava"],"Merila prevzema so primarna; primerjava trga je dokumentirano neobvezna podporna presoja in ne podvaja prevzema.",["ocenjevalna-matrika:ni zaprtih meril ali ocen","primerjava-moznosti:ni dveh strukturiranih ponudb"],"Merila prevzema so prva, primerjava ostane sekundarna.","Sekundarno polje ne prevzame hierarhije vprašanja."],
    [4013,"casovnica-mejnikov","MODULE_ORDERED_TIME_BENEFIT",["mejnik","stanje","vrstni-red"],"Začetek in končni rok tvorita resnično urejen časovni par, pri čemer originalna field ID-ja ostaneta vir resnice.",["mini-koledar:prikaže le en datum","relativni-rok:ne pokrije hkrati začetka in zaključka"],"Datuma sta navpična in jasno označena.","Časovni par se lahko bere vodoravno."],
    [4014,null,"FIELD_COMPOSITION_EXACT_TYPES",["plačilo","obrok","mejnik","rok"],"Polja mešajo znesek, odstotek, besedilne mejnike, trajanje in način plačila; noben napredni widget ne sme ugibati pretvorbe.",["placilni-razrez:zahteva strukturirane deleže z nadzorom vsote","obrocni-nacrt:zahteva enake numerične obroke"],"Primarni mejnik in rok ostaneta vidna, dodatki se razkrijejo.","Kratke tipizirane kontrole se lahko parijo."],
    [4015,null,"FIELD_WIDGET_SINGLE",["termin","pogostost"],"Eno polje že podpira prost termin in varne hitre bližnjice.",["tedenski-termini:ni tedenske večizbirne mreže"],"Termin je čez polno širino.","Isti neposredni termin brez dekoracije."],
    [4003,null,"FIELD_COMPOSITION_ORTHOGONAL_AXES",["osnovni-odnos","pogodbeni-režim","najem","obračun"],"Prejšnjih šest možnosti je mešalo tri neodvisne osi. Osnovni odnos ostane ena izbira, naročnina, najem in obračun po porabi pa so ločena kratka podvprašanja.",["navpicni-izbor:en sam izbor izgubi veljavne kombinacije","izbirnik-oznak:ne loči pomena treh osi"],"Štirje segmentni sklopi so v isti kartici in se zložijo navpično brez dodatne strani.","Vsaka os ostane jasno označena; kratke možnosti so hkrati vidne."],
    [4016,"pravilo-ponavljanja","MODULE_ORDERED_RULE_BENEFIT",["ponavljanje","interval"],"Trajanje, vezava in podaljšanje skupaj tvorijo preverljivo pogodbeno pravilo ponavljanja.",["kolicina-in-enota:pokrije le posamezno trajanje","casovnica-mejnikov:ne izrazi avtomatskega podaljšanja"],"Vsak del pravila je v svoji vrstici.","Trajanje in vezava sta lahko v paru, podaljšanje ostane polno."],
    [4017,null,"FIELD_COMPOSITION_EXACT_TYPES",["odpoved","rok","strošek"],"Rok/način odpovedi in strošek izstopa ostajata dve ločeni besedilni klavzuli.",["relativni-rok:trenutni canonical podatek ni tipiziran relativni datum"],"Odpoved je primarna, stroški sekundarni.","Polji sta lahko v naravnem paru."],
    [4018,null,"FIELD_COMPOSITION_DISTINCT_PURPOSES",["sprememba","odgovornost","pravo"],"Enostranske spremembe so glavni mentalni model; odgovornost in pravo sta dokumentirano sekundarni zaščitni klavzuli.",["sprememba-in-potrditev:ni canonical potrditvenega stanja","skupine-odstopanj:ni izbire dejanja za vsak pogoj"],"Glavno polje ostane vidno, sekundarni klavzuli se razkrijeta.","Sekundarni klavzuli se lahko prikažeta v paru."],
    [4020,"pogojna-garancija","MODULE_CONDITIONAL_BENEFIT",["garancija","pogojna-polja"],"Trajanje, kritje, izključitve in prijava tvorijo en garancijski contract; neobvezne izključitve se varno razkrijejo.",["kontrolni-seznam-dokazil:ne zajema trajanja in kritja"],"Vsa polja se zložijo; izključitve so sekundarne.","Trajanje je kompaktno, besedilne klavzule ostanejo široke."],
    [4021,null,"FIELD_COMPOSITION_EXACT_TYPES",["odziv","odprava","razpoložljivost"],"Odzivni čas, servis in razpoložljivost so ločene pogodbene obveznosti; trend ali ciljni pas bi potreboval zgodovinske meritve.",["trend-odzivnosti:ni časovne vrste","ciljni-pas:ni ločenih dejanskih in ciljnih meritev"],"Odzivni par je prvi, dodatna servisna pogoja se razkrijeta.","Kratka razpoložljivost je lahko ob servisnem pogoju."],
    [4001,"odlocitvena-pot","MODULE_CONDITIONAL_BENEFIT",["odločitev","naslednji-korak"],"Vloga ponudnika določi, ali je treba razjasniti status posrednika; obstoječa showWhen relacija ostane avtoriteta.",["mreza-izbir:samostojno ne izrazi pogojnega nadaljevanja"],"Štiri vloge so mreža 2 × 2, nadaljevanje se pokaže samo pri posredniku.","Vloga in pogojni odgovor ostaneta v isti kartici."],
    [4022,"kontrolni-seznam-dokazil","MODULE_STRUCTURED_BENEFIT",["dokazila","popolnost"],"Pravna identiteta je obvezna, reference, dovoljenja, zavarovanje in varnostna dokazila pa tvorijo pregleden seznam popolnosti.",["sled-izvora-podatka:ne preverja nabora različnih dokazil"],"Identiteta je prva, neobvezna dokazila se razkrijejo.","Dokazilne postavke se lahko berejo v dveh stolpcih."],
    [4023,"mreza-odvisnosti","MODULE_ORDERED_RULE_BENEFIT",["odvisnost","vrstni-red"],"Odločitev o podizvajalcih in ključni predpogoji neposredno določajo izvedbeno odvisnost.",["da-ne-ne-vem:pokrije le prvo polje"],"Izbira je prva, odvisnosti sledijo navpično.","Oba koraka ostaneta vizualno povezana."],
    [4024,null,"FIELD_COMPOSITION_DISTINCT_PURPOSES",["podatki","lastništvo","dostop"],"Lastništvo gradiv in obdelava osebnih podatkov sta sorodni, vendar ločeni pravni dejstvi.",["sled-izvora-podatka:sprašuje po viru in starosti, ne po lastništvu"],"Vsako dejstvo ima svoj večvrstični vnos.","Polji sta lahko vzporedni brez združitve vrednosti."],
    [4025,null,"FIELD_WIDGET_SINGLE",["ustna-obljuba","zapis"],"En sam dokazljiv prepis ustne obljube, ki manjka v ponudbi.",["sprememba-in-potrditev:ni podatka o znesku, roku in potrditvi"],"Samorastoč vnos čez polno širino.","Enako, brez okrasnega workflowa."],
    [4026,"ujemanje-pogojev-dokazil","MODULE_ORDERED_RULE_BENEFIT",["trditev","dokazilo"],"Vrsta dokazila in opomba, kaj potrjuje, tvorita neposredno povezavo med pogojem in dokazom.",["dokazilo:pokrije le posamezno datoteko brez povezave do trditve","kontrolni-seznam-dokazil:ne izrazi ujemanja"],"Vrsta in dokument se zložita brez clippinga.","Izbor in dokazilo ostaneta v istem pregledu." ]
  ];
  var PONUDBA_QUESTION_AUDIT = new Map(PONUDBA_QUESTION_AUDIT_ROWS.map(function (row) {
    return [row[0], Object.freeze({ templateId:row[1], reasonCode:row[2], semanticTags:Object.freeze(row[3].slice()), reason:row[4], rejectedAlternatives:Object.freeze(row[5].slice()), mobile:row[6], desktop:row[7] })];
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
  function controlRolesFor(interaction) {
    var roles = {
      "choice-segments":["choice-group"], "choice-grid":["choice-group"], "choice-list":["choice-group"], "payment-method":["choice-group"],
      dropdown:["select"], "short-text":["input"], "long-text":["textarea"], "quantity-unit":["number","unit"], rate:["value","basis"],
      deadline:["value","unknown","approximate"], duration:["number","unit"], schedule:["value","quick-choice"], "duration-pair":["response","resolution"],
      availability:["mode","value"], money:["amount"], "money-or-percent":["amount","unit"], date:["date","precision"],
      "list-builder":["item","add"], "document-upload":["file","note","remove"], confirmation:["confirmation"]
    };
    return roles[interaction] || ["primary"];
  }
  function fieldContext(field, ui, meta) {
    var flow = meta && meta.flow || "unknown";
    var module = meta && meta.module || { id:field.moduleId, code:"", label:"Neznani modul", question:"" };
    var area = meta && meta.area || null;
    var relationIds = ui.showWhen ? ["show-" + field.id + "-when-" + ui.showWhen.fieldId] : [];
    var ids = nazorjevaEngine.stableIds(flow, module.id, field.id, field.options || ui.options || [], relationIds, controlRolesFor(ui.interaction));
    var allowedValues = Object.freeze(ids.options.map(function (option) { return Object.freeze({ id:option.id, label:option.label, interfaceId:option.interfaceId }); }));
    var showWhen = ui.showWhen ? Object.freeze({ fieldId:Number(ui.showWhen.fieldId), values:Object.freeze((ui.showWhen.values || []).map(String)), relationId:ids.relations[0].interfaceId }) : null;
    var definicijaKombinacije = kombinacije && typeof kombinacije.preberi === "function" ? kombinacije.preberi(module.kombinacijaId) : null;
    var reaktivnoPolje = Boolean(definicijaKombinacije && definicijaKombinacije.ponovitev.fields.some(function (polje) { return Number(polje.fieldId) === Number(field.id); }));
    return Object.freeze({
      version:nazorjevaEngine.contextVersion, interfaceId:ids.field, cardId:ids.card,
      identity:Object.freeze({ flow:flow, moduleId:Number(module.id), moduleCode:String(module.code || ""), fieldId:Number(field.id), fieldCode:String(field.code || ""), label:String(field.label || "") }),
      intent:Object.freeze({ question:String(module.question || module.label || ""), module:String(module.label || ""), area:area ? String(area.label || "") : "Skupno", purpose:String(field.help || field.label || ""), antiPattern:"Ne uporabljaj za drug canonical tip ali zgolj za vizualno raznolikost." }),
      canonical:Object.freeze({ type:String(field.type || "text"), storageKey:String(field.id), allowedValues:allowedValues, valueRule:"Renderer mora vrniti isto canonical obliko, ki jo uporablja obstoječi osnutek." }),
      validation:Object.freeze({ required:Boolean(field.required), showWhen:showWhen, rule:field.required ? "Vidno polje mora imeti veljavno canonical vrednost pred nadaljevanjem." : "Prazna vrednost je dovoljena, kadar polje ni pogojno aktivirano." }),
      ui:Object.freeze({ interaction:String(ui.interaction), templateId:String(ui.templateId), selectionReason:String(ui.reason), layout:String(meta && meta.layout || "stacked"), nativeColorTokens:nazorjevaEngine.nativeColorTokens, responsive:"390×844 brez overflowa; 980×900 lahko uporabi vsebinsko naraven par.", autoFit:"Omejena besedila in številke se prilagodijo v živo brez spremembe geometrije.", controlInterfaceIds:Object.freeze(ids.controls.map(function (item) { return item.interfaceId; })), optionInterfaceIds:Object.freeze(ids.options.map(function (item) { return item.interfaceId; })) }),
      controls:ids.controls, options:ids.options, relations:ids.relations,
      questionBinding:Object.freeze({ version:nazorjevaEngine.questionBindingVersion, adaptive:Object.freeze(["question","label","help","placeholder","exampleLabel"]), locked:Object.freeze(["interfaceId","canonical.type","canonical.allowedValues[].id","validation.required","validation.showWhen","persistence.storage"]), question:String(module.question || module.label || ""), label:String(field.label || "") }),
      persistence:Object.freeze({ storage:reaktivnoPolje ? "reactive-draft" : "existing-draft", moduleId:Number(module.id), fieldId:Number(field.id), combinationId:reaktivnoPolje ? module.kombinacijaId : null, scope:reaktivnoPolje ? "runtime-instance" : "field", hiddenRule:"Skrito pogojno polje se ne zbira in ne prepisuje canonical osnutka." }),
      source:Object.freeze({ engine:meta && meta.sourceEngine || "unknown", moduleId:Number(module.id), fieldId:Number(field.id) })
    });
  }
  function enrichField(field, meta) {
    var ui = FIELD_UI.get(Number(field.id));
    if (!ui) throw new Error("Atena UI: manjka vsebinska presoja za polje " + field.id + " (" + field.label + ").");
    var selection = widgetContract.recommendForField({ ui:ui });
    if (!selection.templateId) throw new Error("Atena UI: contract je zavrnil polje " + field.id + " (" + field.label + ").");
    var context = fieldContext(field, ui, meta || {});
    return Object.freeze(Object.assign({}, field, { interfaceId:context.interfaceId, context:context,
      ui:Object.freeze(Object.assign({}, ui, { interfaceId:context.interfaceId, contextVersion:context.version, selection:selection })) }));
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
  function questionWidgetSelection(flow, module, fields) {
    var audit = flow === "ponudba" ? PONUDBA_QUESTION_AUDIT.get(Number(module.id)) : null;
    var fieldBindings = Object.freeze(fields.map(function (field) { return Object.freeze({ interfaceId:field.interfaceId, fieldId:Number(field.id), templateId:field.ui.templateId, interaction:field.ui.interaction, canonicalType:String(field.type), required:Boolean(field.required), showWhen:field.context.validation.showWhen || null }); }));
    var displayTemplateId = audit && audit.templateId || (fields[0] && fields[0].ui.templateId) || "besedilni-vnos";
    var displayTemplate = CANONICAL_TEMPLATE_BY_ID.get(displayTemplateId);
    if (!displayTemplate) throw new Error("Atena UI: vprašanje " + module.id + " nima odobrene predstavitvene kartice.");
    var presentation = Object.freeze({ templateId:displayTemplate.id, interfaceId:"atena:widget:" + displayTemplate.id, number:Number(displayTemplate.number), title:String(displayTemplate.title), theme:String(displayTemplate.theme), rgb:String(displayTemplate.rgb) });
    if (!audit) return Object.freeze({ mode:"field-composition", templateId:null, interfaceId:null, reasonCode:"FLOW_FIELD_COMPOSITION", reason:"Vprašanje uporablja eksplicitne field-level widgete brez nove module-level predstavitve.", rejectedAlternatives:Object.freeze([]), semanticTags:Object.freeze([]), fieldBindings:fieldBindings, presentation:presentation, mobile:"Polja se zložijo brez overflowa.", desktop:"Sorodna kratka polja se lahko parijo." });
    if (!audit.templateId) return Object.freeze(Object.assign({}, audit, { mode:"field-composition", interfaceId:null, fieldBindings:fieldBindings, presentation:presentation, capabilityMatch:Object.freeze({ eligible:true, code:audit.reasonCode, scope:"field", canonicalShape:"field-contract[]" }) }));
    var widget = widgetContract.byId[audit.templateId];
    if (!widget) throw new Error("Atena UI: ponudbeni modul " + module.id + " kaže na neodobren widget " + audit.templateId + ".");
    var decision = widgetContract.evaluate(audit.templateId, { scope:widget.scope, canonicalShape:widget.dataShape, semanticTags:audit.semanticTags });
    if (!decision.eligible) throw new Error("Atena UI: ponudbeni modul " + module.id + " nima varne module preslikave: " + decision.code + ".");
    return Object.freeze(Object.assign({}, audit, { mode:"module-widget", interfaceId:widget.interfaceId, fieldBindings:fieldBindings, presentation:presentation, capabilityMatch:Object.freeze({ eligible:true, code:decision.code, scope:widget.scope, canonicalShape:widget.dataShape, semanticTags:widget.semanticTags }) }));
  }
  function kartica(flow, engine, module) {
    var area = areaZaModul(engine, module.id);
    var moduleUi = MODULE_UI.get(Number(module.id));
    var kombinacijaId = typeof module.kombinacijaId === "string" && module.kombinacijaId.trim() ? module.kombinacijaId.trim() : null;
    if (!moduleUi) throw new Error("Atena UI: manjka vsebinska presoja za modul " + module.id + " (" + module.label + ").");
    var sourceEngine = flow === "ponudba" ? "ponudba-moduli-engine.js" : "svetovalec-storitve-engine.js";
    var fields = engine.fields.filter(function (field) { return field.moduleId === module.id; }).map(function (field) { return enrichField(field, { flow:flow, module:module, area:area, layout:moduleUi.layout, sourceEngine:sourceEngine }); });
    var questionWidget = questionWidgetSelection(flow, module, fields);
    var choices = fields.reduce(function (all, field) { return all.concat((field.options || []).map(function (option) {
      return Object.freeze({ id:option.id, label:option.label, fieldId:field.id });
    })); }, []);
    var hasOther = choices.some(function (choice) { return choice.id === "drugo" || /drugo/i.test(choice.label); });
    var searchText = [area && area.label, area && area.description, module.label, module.description, module.question]
      .concat(fields.map(function (field) { return [field.label, field.help].concat((field.options || []).map(function (option) { return option.label; })).join(" "); })).join(" ");
    var cardIds = nazorjevaEngine.stableIds(flow, module.id);
    var interfaceId = cardIds.card;
    var cardContext = Object.freeze({ version:nazorjevaEngine.contextVersion, interfaceId:interfaceId,
      identity:Object.freeze({ flow:flow, moduleId:Number(module.id), moduleCode:String(module.code || ""), title:String(module.label || "") }),
      intent:Object.freeze({ question:String(module.question || module.label || ""), description:String(module.description || ""), area:area ? String(area.label || "") : "Skupno" }),
      data:Object.freeze({ answerType:answerType(fields), fieldInterfaceIds:Object.freeze(fields.map(function (field) { return field.interfaceId; })), controlInterfaceIds:Object.freeze(fields.reduce(function (all, field) { return all.concat(field.context.ui.controlInterfaceIds); }, [])), optionInterfaceIds:Object.freeze(fields.reduce(function (all, field) { return all.concat(field.context.ui.optionInterfaceIds); }, [])), relationInterfaceIds:Object.freeze(fields.reduce(function (all, field) { return all.concat(field.context.relations.map(function (relation) { return relation.interfaceId; })); }, [])) }),
      validation:Object.freeze({ requiredFieldIds:Object.freeze(fields.filter(function (field) { return field.required; }).map(function (field) { return Number(field.id); })), rule:"Kartica lahko napreduje šele, ko so vsa vidna obvezna polja veljavna." }),
      ui:Object.freeze({ layout:moduleUi.layout, templateIds:Object.freeze(Array.from(new Set(fields.map(function (field) { return field.ui.templateId; })))), questionWidget:questionWidget, nativeColorTokens:Object.freeze(["--obrazec-barva","--obrazec-ozadje","--card-rgb"]) }),
      persistence:Object.freeze({ storage:kombinacijaId ? "reactive-draft" : "existing-draft", moduleId:Number(module.id), combinationId:kombinacijaId, rule:kombinacijaId ? "Reaktivne vrednosti so namespaced v ponudbaOsnutek.reaktivniSklopi; agregati se ne shranjujejo." : "Kartica ne uvaja vzporednega stanja ali drugega shranjevanja." }),
      source:Object.freeze({ engine:sourceEngine, moduleId:Number(module.id) }) });
    var card = {
      id:flow + ":" + module.id, interfaceId:interfaceId, context:cardContext, flow:flow, flowLabel:FLOW_LABELS[flow],
      areaCode:area ? area.code : "skupno", areaLabel:area ? area.label : "Skupno",
      moduleId:module.id, moduleCode:module.code, title:module.label,
      question:module.question || module.label, description:module.description || "",
      answerType:answerType(fields), fields:Object.freeze(fields.slice()), primaryChoices:Object.freeze(choices),
      templateIds:Object.freeze(Array.from(new Set(fields.map(function (field) { return field.ui.templateId; })))),
      hasOther:hasOther, followUps:Object.freeze(hasOther ? [{ when:"other", type:"text", label:"Opišite drugo možnost" }] : []),
      validation:Object.freeze({ requiredFieldIds:Object.freeze(fields.filter(function (field) { return field.required; }).map(function (field) { return field.id; })) }),
      layoutHint:moduleUi.layout, ui:moduleUi, questionWidget:questionWidget, ariaLabel:(module.question || module.label) + " — " + (area ? area.label : FLOW_LABELS[flow]),
      stateMapping:Object.freeze(kombinacijaId
        ? { storage:"reactive-draft", moduleId:module.id, combinationId:kombinacijaId }
        : { storage:"existing-draft", moduleId:module.id }),
      eventMapping:Object.freeze({ action:"open-existing-area", flow:flow, areaCode:area ? area.code : "", moduleId:module.id }),
      source:Object.freeze({ engine:sourceEngine, moduleId:module.id }),
      searchTokens:Object.freeze(Array.from(new Set(tokeni(searchText))))
    };
    if (kombinacijaId) card.kombinacijaId = kombinacijaId;
    return Object.freeze(card);
  }

  var flows = ["ponudba", "narocnina", "pogajanje", "ponudbe", "klic"];
  var catalog = Object.freeze(flows.reduce(function (all, flow) {
    var engine = engineZa(flow);
    return engine ? all.concat(engine.modules.map(function (module) { return kartica(flow, engine, module); })) : all;
  }, []));
  var ponudbaCategoryModuleIds = Object.freeze((ponudbaEngine && ponudbaEngine.areas || []).reduce(function (all, area) { return all.concat(area.moduleIds); }, []));
  var ponudbaQuestionCards = Object.freeze(catalog.filter(function (card) { return card.flow === "ponudba" && ponudbaCategoryModuleIds.includes(card.moduleId); }));
  if (ponudbaQuestionCards.length !== 25 || PONUDBA_QUESTION_AUDIT.size !== ponudbaQuestionCards.length || ponudbaQuestionCards.some(function (card) { return !PONUDBA_QUESTION_AUDIT.has(card.moduleId); })) {
    throw new Error("Atena UI: ponudbeni vprašalni audit mora brez vrzeli pokriti vseh 25 kategorijskih modulov.");
  }
  var ponudbaQuestionManifest = Object.freeze({
    version:PONUDBA_MANIFEST_VERSION, contextVersion:nazorjevaEngine.contextVersion, authority:"proposal-only",
    decisionBoundary:"Luna predlaga samo z evidence spani; deterministični resolver preveri approved status, scope, canonical shape, semantiko, interaction in vse stabilne ID-je.",
    counts:Object.freeze({ categories:6, questions:ponudbaQuestionCards.length, fields:ponudbaQuestionCards.reduce(function (total, card) { return total + card.fields.length; }, 0), controls:ponudbaQuestionCards.reduce(function (total, card) { return total + card.fields.reduce(function (sum, field) { return sum + field.context.controls.length; }, 0); }, 0), options:ponudbaQuestionCards.reduce(function (total, card) { return total + card.fields.reduce(function (sum, field) { return sum + field.context.options.length; }, 0); }, 0), relations:ponudbaQuestionCards.reduce(function (total, card) { return total + card.fields.reduce(function (sum, field) { return sum + field.context.relations.length; }, 0); }, 0) }),
    categories:Object.freeze((ponudbaEngine && ponudbaEngine.areas || []).map(function (area) { return Object.freeze({ code:area.code, label:area.label, description:area.description, moduleIds:Object.freeze(area.moduleIds.slice()) }); })),
    questions:Object.freeze(ponudbaQuestionCards.map(function (card) { return Object.freeze({
      interfaceId:card.interfaceId, moduleId:card.moduleId, moduleCode:card.moduleCode, category:card.areaCode, title:card.title, question:card.question, description:card.description,
      widget:card.questionWidget, requiredFieldIds:card.context.validation.requiredFieldIds, persistence:card.context.persistence,
      fields:Object.freeze(card.fields.map(function (field) { return Object.freeze({ interfaceId:field.interfaceId, fieldId:field.id, code:field.code, label:field.label, help:field.help, canonical:field.context.canonical, validation:field.context.validation, ui:field.ui, persistence:field.context.persistence, controls:field.context.controls, options:field.context.options, relations:field.context.relations }); }))
    }); }))
  });
  function exactProposalKeys(value) {
    var expected = ["contextVersion","evidenceSpans","interaction","interfaceId","widgetId"];
    if (!value || Object.prototype.toString.call(value) !== "[object Object]") return false;
    var actual = Object.keys(value).sort();
    return actual.length === expected.length && actual.every(function (key, index) { return key === expected[index]; });
  }
  function resolvePonudbaQuestionProposal(proposal, sourceText) {
    if (!exactProposalKeys(proposal)) return Object.freeze({ accepted:false, code:"QUESTION_PROPOSAL_SHAPE_INVALID" });
    if (proposal.contextVersion !== nazorjevaEngine.contextVersion) return Object.freeze({ accepted:false, code:"CONTEXT_VERSION_STALE", expected:nazorjevaEngine.contextVersion, actual:proposal.contextVersion || null });
    if (typeof sourceText !== "string" || !sourceText.trim()) return Object.freeze({ accepted:false, code:"SOURCE_TEXT_REQUIRED" });
    var evidence = Array.isArray(proposal.evidenceSpans) ? proposal.evidenceSpans : [];
    if (!evidence.length || evidence.some(function (span) { return typeof span !== "string" || !span.trim() || sourceText.indexOf(span) < 0; })) return Object.freeze({ accepted:false, code:"LUNA_EVIDENCE_REQUIRED" });
    var card = ponudbaQuestionCards.find(function (item) { return item.interfaceId === String(proposal.interfaceId); });
    var field = null;
    if (!card) ponudbaQuestionCards.some(function (item) { field = item.fields.find(function (candidate) { return candidate.interfaceId === String(proposal.interfaceId); }) || null; if (field) card = item; return Boolean(field); });
    if (!card) return Object.freeze({ accepted:false, code:"QUESTION_INTERFACE_ID_UNKNOWN", interfaceId:String(proposal.interfaceId || "") });
    if (!field && card.questionWidget.mode !== "module-widget") return Object.freeze({ accepted:false, code:"MODULE_FIELD_COMPOSITION_REQUIRED", interfaceId:card.interfaceId, fieldBindings:card.questionWidget.fieldBindings });
    var canonicalWidgetId = field ? field.ui.templateId : card.questionWidget.templateId;
    var canonicalWidget = widgetContract.byId[canonicalWidgetId];
    if (!canonicalWidget || canonicalWidget.status !== "approved") return Object.freeze({ accepted:false, code:"CANONICAL_WIDGET_NOT_APPROVED", widgetId:canonicalWidgetId || null });
    var target = field ? { scope:"field", canonicalShape:canonicalWidget.dataShape, semanticTags:canonicalWidget.semanticTags, interaction:field.ui.interaction } : { scope:canonicalWidget.scope, canonicalShape:canonicalWidget.dataShape, semanticTags:card.questionWidget.semanticTags, composite:true, fieldCount:card.fields.length, dataType:canonicalWidget.dataShape };
    var decision = widgetContract.evaluateLunaProposal({ widgetId:String(proposal.widgetId || ""), interaction:proposal.interaction || null, evidenceSpans:evidence }, target);
    if (!decision.accepted) return Object.freeze(Object.assign({}, decision, { interfaceId:String(proposal.interfaceId), canonicalWidgetId:canonicalWidgetId }));
    return Object.freeze({ accepted:true, code:String(proposal.widgetId) === canonicalWidgetId ? "QUESTION_WIDGET_CONFIRMED" : "QUESTION_WIDGET_TRANSFORMED", interfaceId:String(proposal.interfaceId), cardInterfaceId:card.interfaceId, fieldInterfaceId:field ? field.interfaceId : null, proposedWidgetId:String(proposal.widgetId), widgetId:canonicalWidgetId, interaction:field ? field.ui.interaction : null, evidenceSpans:Object.freeze(evidence.slice()), fieldBindings:card.questionWidget.fieldBindings, preserves:Object.freeze(["interfaceId","canonical","required","conditional","optionIds","controlIds","relationIds","existing-draft"]) });
  }
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
    return Object.freeze((fields || []).map(function (field) { return enrichField(field, { module:{ id:field.moduleId, code:"", label:"Neznani modul", question:"" } }); }));
  }
  var cardContracts = Object.freeze(catalog.map(function (card) { return card.context; }));
  var fieldContracts = Object.freeze(catalog.reduce(function (all, card) { return all.concat(card.fields.map(function (field) { return field.context; })); }, []));
  var controlContracts = Object.freeze(fieldContracts.reduce(function (all, field) { return all.concat(field.controls || []); }, []));
  var optionContracts = Object.freeze(fieldContracts.reduce(function (all, field) { return all.concat(field.options || []); }, []));
  var relationContracts = Object.freeze(fieldContracts.reduce(function (all, field) { return all.concat(field.relations || []); }, []));
  var idValidation = nazorjevaEngine.validateIdRegistry(widgetContract.contracts.concat(cardContracts, fieldContracts, controlContracts, optionContracts, relationContracts));
  function getFieldContract(interfaceId) { return fieldContracts.find(function (item) { return item.interfaceId === String(interfaceId); }) || null; }
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
    canonicalTemplates:CANONICAL_TEMPLATES, canonicalTemplateIds:CANONICAL_TEMPLATE_IDS, templateByInteraction:TEMPLATE_BY_INTERACTION,
    widgetContracts:widgetContract.contracts, evaluateWidget:widgetContract.evaluate,
    ponudbaQuestionManifest:ponudbaQuestionManifest, resolvePonudbaQuestionProposal:resolvePonudbaQuestionProposal,
    cardContracts:cardContracts, fieldContracts:fieldContracts, controlContracts:controlContracts, optionContracts:optionContracts,
    relationContracts:relationContracts, idValidation:idValidation, getFieldContract:getFieldContract });
});
