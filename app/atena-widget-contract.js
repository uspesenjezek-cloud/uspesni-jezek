(function (root, factory) {
  var api;
  if (typeof module === "object" && module.exports) api = factory(require("./atena-card-templates"), require("./nazorjeva-engine"));
  else api = factory(root && root.UJAtenaCardTemplates, root && root.UJNazorjevaEngine);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UJAtenaWidgetContract = api;
})(typeof window !== "undefined" ? window : null, function (templateLibrary, nazorjevaEngine) {
  "use strict";

  var VERSION = "atena-widget-contract-v3";
  if (!nazorjevaEngine || nazorjevaEngine.version !== "nazorjeva-engine-v1") throw new Error("Atena widget contract: manjka kanonični NAZORJEVA engine.");
  var APPROVED = (templateLibrary && templateLibrary.templates || []).filter(function (item) { return item.approved; });
  var NATIVE_THEME = "Widget ne uporablja lastne produktne palete. Gostitelj poda --obrazec-barva in --obrazec-ozadje; adapter ju pretvori v --card-rgb. Vijolična ostane rezervirana za odvetniški tok.";
  var RESPONSIVE = "Na 390 px se vse kontrole zložijo v eno kolono, razen kratkih 2–4 izbir; na 980 px so dovoljeni pari. Zadetne površine so najmanj 44 px, dolge vrednosti se samodejno prilagodijo brez overflowa.";

  var PROFILES = Object.freeze({
    choice:{ scope:"field", dataShape:"enum", interactions:["choice-segments","choice-grid","choice-list","dropdown","payment-method"], validation:"Vrednost mora biti eden izmed zaprtih ID-jev; »Drugo« zahteva opis.", unsuitable:"Prosto besedilo, natančen znesek ali več hkratnih neodvisnih dejstev." },
    number:{ scope:"field", dataShape:"number-with-unit", interactions:["quantity-unit","duration","duration-pair","money","money-or-percent","rate","availability"], validation:"Končno število, dovoljen razpon in izrecna enota; brez tihega zaokroževanja ali menjave enote.", unsuitable:"Ocena brez naravne merilne enote ali besedilna razlaga." },
    text:{ scope:"field", dataShape:"string-or-string-list", interactions:["short-text","long-text","list-builder"], validation:"Trim, smiselna minimalna vsebina in največja dolžina; seznam ne sme hraniti praznih postavk.", unsuitable:"Zaprta izbira, datum ali znesek, ki potrebuje tipizirano validacijo." },
    date:{ scope:"field", dataShape:"date-or-relative-date", interactions:["date","deadline","schedule","duration"], validation:"Veljaven datum ali eksplicitno označen približen/neznan/relativen rok; vrstni red datumov mora biti smiseln.", unsuitable:"Dogodek brez časovnega pomena ali poljubna opomba." },
    document:{ scope:"field", dataShape:"file-reference[]", interactions:["document-upload"], validation:"Dovoljen tip in velikost, uspešen prenos, stabilen ID datoteke ter zahtevana opomba, kadar jo določa vprašanje.", unsuitable:"Trditev brez dejanskega dokazila ali navadno besedilno vprašanje." },
    multi:{ scope:"module", dataShape:"structured-object", interactions:[], validation:"Vsak sestavni del ima svoj tip; medsebojne vsote, meje, pari ali vrstni red se preverijo kot celota.", unsuitable:"Eno samo preprosto polje; sestavljeni widget bi bil le dekoracija." },
    analysis:{ scope:"module", dataShape:"derived-structured-object", interactions:[], validation:"Vhodne vrednosti morajo biti popolne in iste semantike; izračun je determinističen, izpeljani rezultat pa se ne shranjuje kot nov uporabnikov podatek.", unsuitable:"Zajem novega enega dejstva ali prikaz brez zadostnih vhodnih podatkov." },
    review:{ scope:"review", dataShape:"existing-values-reference", interactions:["confirmation"], validation:"Ne ustvarja novega dejstva; potrdi obstoječe canonical vrednosti ali vrne uporabnika v urejanje.", unsuitable:"Prvi zajem podatka ali nadomestilo za obvezno vprašanje." },
    workflow:{ scope:"module", dataShape:"ordered-rule-or-state[]", interactions:[], validation:"Dovoljena stanja, celoten vrstni red in vse obvezne povezave; poznejši korak ne more obstajati brez predhodnega.", unsuitable:"Nepovezana vprašanja ali okrasna časovnica brez dejanskih stanj." }
  });

  var PROFILE_BY_ID = Object.freeze({
    "da-ne-ne-vem":"choice","stevilcna-lestvica":"number","dvojni-segment":"choice","mreza-izbir":"choice","navpicni-izbor":"choice","spustni-seznam":"choice","besedilni-vnos":"text","natancen-znesek":"number","znesek-ali-odstotek":"number","kolicina-in-enota":"number","drsnik-razpona":"number","datum-z-gotovostjo":"date","termin-in-pogostost":"date","seznam-postavk":"text","dokazilo":"document",
    "razdelitev-proracuna":"multi","primerjava-moznosti":"analysis","casovnica-mejnikov":"workflow","razvrscanje-prioritet":"multi","tedenski-termini":"multi","ocenjevalna-matrika":"analysis","dvojni-razpon":"multi","pogojna-garancija":"multi","mini-koledar":"date","kontrolni-seznam-dokazil":"multi","matrika-tveganja":"analysis","izbirnik-oznak":"multi","placilni-razrez":"multi","trenutno-proti-cilju":"analysis","odlocitvena-pot":"workflow","cenovni-most":"analysis","trend-odzivnosti":"analysis","ciljni-pas":"analysis","ocena-z-negotovostjo":"multi","primerjava-sprememb":"analysis","prekoracitve-praga":"analysis","hierarhicni-izbor":"multi","iskalni-izbirnik":"choice","pravilo-ponavljanja":"workflow","relativni-rok":"date","lokacija-in-doseg":"multi","obrocni-nacrt":"multi","matrika-vkljucenosti":"multi","parna-primerjava":"analysis","pregled-odgovorov":"review","obcutljivost-izida":"analysis","mesalnik-scenarija":"analysis","prag-verjetnosti-zamude":"analysis","toplotni-koledar":"analysis","lijak-izterjave":"analysis","mreza-odvisnosti":"workflow","pogajalski-prostor":"analysis","skupine-odstopanj":"workflow","pasovi-zmogljivosti":"analysis","ujemanje-pogojev-dokazil":"workflow","gradnik-pravila-eskalacije":"workflow","sled-izvora-podatka":"multi","prag-rentabilnosti":"analysis","drevo-pricakovane-vrednosti":"analysis","kaskada-krsitve":"workflow","graficni-cenovni-most":"analysis","sprememba-in-potrditev":"workflow",
    "ugotovitev-preverbe":"analysis"
  });

  var SEMANTICS = Object.freeze({
    "razdelitev-proracuna":["proračun","delež","vsota-100"], "primerjava-moznosti":["primerjava","več-možnosti"], "casovnica-mejnikov":["mejnik","stanje","vrstni-red"], "razvrscanje-prioritet":["prioriteta","vrstni-red"], "tedenski-termini":["tedenski-termin","večizbor"], "ocenjevalna-matrika":["merilo","ocena","povprečje"], "dvojni-razpon":["minimum","maximum","razpon"], "pogojna-garancija":["garancija","pogojna-polja"], "kontrolni-seznam-dokazil":["dokazila","popolnost"], "matrika-tveganja":["verjetnost","vpliv"], "placilni-razrez":["plačilo","faze","vsota-100"], "trenutno-proti-cilju":["trenutno","cilj"], "odlocitvena-pot":["odločitev","naslednji-korak"], "cenovni-most":["cena","spremembe","izračun"], "trend-odzivnosti":["časovna-vrsta","odzivnost"], "ciljni-pas":["dejansko","cilj","status"], "ocena-z-negotovostjo":["minimum","ocena","maximum"], "primerjava-sprememb":["prej","zdaj"], "prekoracitve-praga":["rok","prekoračitev"], "pravilo-ponavljanja":["ponavljanje","interval"], "relativni-rok":["dogodek","odmik"], "obrocni-nacrt":["znesek","obroki"], "matrika-vkljucenosti":["postavka","vključeno"], "pregled-odgovorov":["pregled","potrditev"], "obcutljivost-izida":["dejavniki","vpliv"], "mesalnik-scenarija":["scenarij","izračun"], "prag-verjetnosti-zamude":["zamuda","prag"], "toplotni-koledar":["datum","intenzivnost"], "lijak-izterjave":["faze","znesek"], "mreza-odvisnosti":["odvisnost","vrstni-red"], "pogajalski-prostor":["plačilo","popust"], "skupine-odstopanj":["pogoj","odločitev"], "pasovi-zmogljivosti":["ekipa","zmogljivost"], "ujemanje-pogojev-dokazil":["trditev","dokazilo"], "gradnik-pravila-eskalacije":["pogoji","dejanje"], "sled-izvora-podatka":["vir","starost","potrditev"], "prag-rentabilnosti":["cena","stroški","količina"], "drevo-pricakovane-vrednosti":["ukrep","verjetnost","izplen","strošek"], "kaskada-krsitve":["težava","ukrep","rezerva"], "graficni-cenovni-most":["cena","spremembe","izračun","graf"], "sprememba-in-potrditev":["sprememba","znesek","rok","potrditev"],
    "ugotovitev-preverbe":["ugotovitev","dokaz","potrebnost-ukrepanja"]
  });

  function unique(values) { return Array.from(new Set(values || [])); }
  function contractFor(template) {
    var profileName = PROFILE_BY_ID[template.id] || template.profile;
    var profile = PROFILES[profileName];
    if (!profile) throw new Error("Atena widget contract: manjka profil za " + template.id + ".");
    var declaredSemantics = SEMANTICS[template.id] || template.semanticTags;
    var semantics = declaredSemantics && declaredSemantics.length ? declaredSemantics : [profileName].concat(template.id.split("-")).filter(Boolean);
    var interfaceId = "atena:widget:" + template.id;
    var suitable = "Uporabi samo, ko vprašanje neposredno zajema: " + template.question;
    var monotony = "Dovoljen je za razbitje monotonosti le, če " + (profile.scope === "field" ? "podatkovni tip in interaction ostaneta povsem enaka" : "modul že vsebuje vse zahtevane povezane podatke") + "; sicer je dekoracija in selection ga zavrne.";
    var persistence = "Canonical vrednosti ostanejo v obstoječem osnutku. Widget sme spreminjati le predstavitev in mora uporabiti skupni collect/validate/hydrate tok.";
    var definition = nazorjevaEngine.materializeWidgetDefinition({
      id:template.id, number:template.number, title:template.title, status:"approved",
      identity:{ number:template.number, title:template.title, status:"approved", origin:"NAZORJEVA" },
      intent:{ purpose:String(template.coverage), mentalModel:String(template.question), suitable:suitable, unsuitable:String(profile.unsuitable),
        examples:[template.question, "Realni Atenin primer mora uporabljati isti tip podatka in iste canonical enote kot to vprašanje."], antiPatterns:[profile.unsuitable,"Ne uporabljaj zgolj zaradi vizualne raznolikosti."] },
      data:{ scope:profile.scope, canonicalShape:profile.dataShape, allowedInteractions:profile.interactions, semanticTags:semantics },
      validation:{ required:false, rule:String(profile.validation), conditionalRules:[] },
      ui:{ nativeTheme:NATIVE_THEME, responsive:RESPONSIVE, monotony:monotony },
      persistence:{ storage:"existing-draft", rule:persistence },
      questionBinding:{ question:String(template.question) }
    });
    var context = definition.context;
    return Object.freeze({
      id:template.id, interfaceId:interfaceId, context:context, number:template.number, title:template.title, status:"approved", profile:profileName,
      scope:profile.scope, dataShape:profile.dataShape, allowedInteractions:Object.freeze(profile.interactions.slice()), semanticTags:Object.freeze(semantics.slice()),
      purpose:template.coverage, mentalModel:template.question,
      suitable:suitable,
      examples:definition.intent.examples,
      unsuitable:profile.unsuitable, validation:profile.validation, responsive:RESPONSIVE, nativeTheme:NATIVE_THEME,
      monotony:monotony, persistence:persistence, capability:definition.capability, questionBinding:definition.questionBinding
    });
  }
  var contracts = Object.freeze(APPROVED.map(contractFor));
  var byId = Object.freeze(contracts.reduce(function (all, item) { all[item.id] = item; return all; }, {}));
  var lunaManifest = nazorjevaEngine.buildLunaManifest(contracts);
  if (contracts.length !== APPROVED.length || Object.keys(PROFILE_BY_ID).length < contracts.length || contracts.some(function (item) { return !item.id || !item.validation; })) throw new Error("Atena widget contract mora opisati vse odobrene widgete.");

  function evaluate(templateId, context) {
    var item = byId[templateId];
    context = context || {};
    if (!item) return Object.freeze({ eligible:false, code:"NOT_APPROVED", reason:"Widget ni v odobrenem registru NAZORJEVA." });
    var scope = context.scope || "field";
    if (item.scope !== scope && !(scope === "field" && item.scope === "review" && context.interaction === "confirmation")) return Object.freeze({ eligible:false, code:"SCOPE_MISMATCH", reason:"Widget " + item.id + " je namenjen ravni " + item.scope + ", ne " + scope + "." });
    if (scope === "field" && item.allowedInteractions.length && !item.allowedInteractions.includes(context.interaction)) return Object.freeze({ eligible:false, code:"INTERACTION_MISMATCH", reason:"Widget ne ohrani interakcije " + context.interaction + "." });
    if (context.canonicalShape && item.dataShape !== context.canonicalShape) return Object.freeze({ eligible:false, code:"CANONICAL_SHAPE_MISMATCH", reason:"Widget ne ohrani canonical podatkovne oblike " + context.canonicalShape + "." });
    if (scope !== "field" && item.semanticTags.length) {
      var tags = unique(context.semanticTags);
      var matches = item.semanticTags.filter(function (tag) { return tags.includes(tag); });
      if (!matches.length) return Object.freeze({ eligible:false, code:"SEMANTIC_MISMATCH", reason:"Modul nima nobene zahtevane semantične zmožnosti widgeta." });
    }
    return Object.freeze({ eligible:true, code:"ELIGIBLE", reason:"Pomen, raven in podatkovna oblika ostanejo združljivi." });
  }
  function recommendForField(field) {
    var current = field && field.ui && field.ui.templateId;
    var decision = evaluate(current, { scope:"field", interaction:field && field.ui && field.ui.interaction });
    return Object.freeze({ templateId:decision.eligible ? current : null, changed:false, decision:decision, reason:decision.eligible ? "Obstoječa preslikava je že najmanjša semantično varna izbira." : decision.reason });
  }
  function evaluateLunaProposal(proposal, target) { return nazorjevaEngine.evaluateLunaProposal(proposal, target, byId); }
  return Object.freeze({ version:VERSION, contextVersion:nazorjevaEngine.contextVersion, contracts:contracts, byId:byId, profiles:PROFILES,
    lunaManifest:lunaManifest, lifecycle:nazorjevaEngine.lifecycle, evaluate:evaluate, recommendForField:recommendForField,
    resolveInteraction:nazorjevaEngine.resolveInteraction, bindQuestion:nazorjevaEngine.bindQuestion,
    resolveCollision:nazorjevaEngine.resolveCollision, admitCandidate:nazorjevaEngine.admitCandidate,
    planPromotion:nazorjevaEngine.planPromotion, evaluateLunaProposal:evaluateLunaProposal });
});
