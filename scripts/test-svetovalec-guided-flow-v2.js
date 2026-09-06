"use strict";
const assert=require("assert");
const fs=require("fs");
const nazorjeva=require("../NAZORJEVA");
const capabilities=require("../app/svetovalec-capability-catalog");
const questions=require("../app/svetovalec-guided-question-catalog");
const engine=require("../app/svetovalec-guided-flow-engine");

assert.strictEqual(capabilities.actions.length,5,"Manjka katero od petih dejanj.");
assert.strictEqual(capabilities.profiles.length,43,"Katalog mora pokriti vseh 43 profilov.");
assert.strictEqual(capabilities.offerModels.length,15,"Katalog mora ohraniti vseh 15 modelov.");
assert.strictEqual(capabilities.salesChannels.length,12,"Katalog mora ohraniti vseh 12 kanalov.");
assert.strictEqual(capabilities.validate().valid,true,capabilities.validate().errors.join("\n"));
capabilities.profiles.forEach((profile)=>{
  assert(profile.description&&profile.scopeIncluded,"Profil nima širokega opisa: "+profile.profileId);
  assert(profile.deliverableFamilies.length>=4,"Profil nima obsega predaje: "+profile.profileId);
  assert(profile.riskFamilies.length>=3,"Profil nima tveganj: "+profile.profileId);
  assert(profile.evidenceNeeded.length>=3,"Profil nima dokazil: "+profile.profileId);
});

const approved=new Set(nazorjeva.ids);
const telecomInput="pogajajte se za boljšo ceno za mobilnega operaterja";
const telecomSeed=capabilities.infer(telecomInput);
assert.strictEqual(telecomSeed.actionCode,"pogajanje","Pogajalski namen ni bil razbran.");
assert.strictEqual(telecomSeed.profileId,1014,"Mobilni operater ni bil razbran kot mobilna telefonija.");
const telecomStart=engine.create(telecomInput);
assert.strictEqual(telecomStart.activeQuestionId,"telecom:account-type","Prvo vprašanje ni prilagojeno mobilni naročnini.");
const telecomLabels=telecomStart.questionIds.flatMap((id)=>telecomStart.questionById[id].options.map((item)=>item.label));
["Spletna stran, trgovina, domene in gostovanje","SEO, oglasi, družbena omrežja in vsebinski marketing","Grafično oblikovanje in celostna podoba","Pravne storitve in pogodbe"].forEach((label)=>assert(!telecomLabels.includes(label),"Telekom tok vsebuje napačno možnost: "+label));
const ratingDefinition=questions.build(capabilities.infer("Preveri ponudbo za marketing"),{}).byId["domain:current-satisfaction"];
assert.strictEqual(ratingDefinition.widgetId,"drsnik-razpona","Zadovoljstvo 1–5 mora uporabljati slider.");
const scenarios=[
  "Preveri marketinško pogodbo za Google oglase",
  "Preveri naročnino za mobilno telefonijo",
  "Pomagaj mi izpogajati popust za službeni kombi",
  "Najdi mi več ponudb za grafično oblikovanje in logotip",
  "Kliče me prodajalec programske opreme CRM"
];
scenarios.forEach((source)=>{
  let session=engine.create(source);assert(session&&session.sections.length>=4,"Ni večstopenjskega načrta: "+source);
  let guard=0;
  while(session.status==="draft"&&guard++<40){
    const question=session.questionById[session.activeQuestionId];
    assert(question,"Aktivno vprašanje manjka.");assert(approved.has(question.widgetId),"Widget ni v NAZORJEVI: "+question.widgetId);assert.strictEqual(question.allowFreeText!==false||question.id==="review:confirm",true);
    const count=question.kind==="multiple"?Number(question.minSelections||1):1;
    const typedValue=question.valueType==="money"?["49,90"]:question.valueType==="number"?["3"]:question.valueType==="date"?["2027-03-01"]:null;
    session=engine.answer(session,question.id,{source:"widget",value:typedValue||question.options.slice(0,count).map((option)=>option.id)});
    assert(session,"Odgovora ni bilo mogoče shraniti: "+question.id);
  }
  assert.strictEqual(session.status,"ready","Tok se ni zaključil: "+source);
  const preview=engine.buildPreview(session);assert(preview&&preview.preview.rows.length>=8,"Predogled je nepopoln.");
  assert(engine.confirm(preview),"Potrditev ni uspela.");
});

let free=engine.create("Preveri pogodbo za grafično oblikovanje");
const freeQuestionId=free.activeQuestionId;
free=engine.openFreeText(free,freeQuestionId);assert.strictEqual(free.inputModeByQuestionId[freeQuestionId],"free-text");
free=engine.answer(free,freeQuestionId,{source:"free-text",rawText:"Želim pregled pogodbe in pravic do izvornih datotek."});
assert.strictEqual(free.answersByQuestionId[freeQuestionId].source,"free-text");

let dependency=engine.create("Želim pomoč pri odločitvi");
function answerId(session,id,values){return engine.answer(session,id,{source:"widget",value:Array.isArray(values)?values:[values]});}
dependency=answerId(dependency,"intent:action","ponudba");
dependency=answerId(dependency,"intent:profile","1022");
dependency=answerId(dependency,"intent:model","projekt");
dependency=answerId(dependency,"domain:deliverables",["deliverable:0"]);
dependency=answerId(dependency,"domain:success","merljiv-rezultat");
dependency=answerId(dependency,"domain:current-satisfaction","1");
assert(dependency.questionById["improvement:failure"],"Nizko zadovoljstvo ni odprlo pogojnega vprašanja.");
dependency=answerId(dependency,"domain:risks",["risk:0"]);
const preserved=dependency.answersByQuestionId["domain:risks"];
dependency=answerId(dependency,"domain:current-satisfaction","5");
assert(!dependency.questionById["improvement:failure"],"Pogojno vprašanje ni bilo umaknjeno.");
assert.deepStrictEqual(dependency.answersByQuestionId["domain:risks"],preserved,"Nepovezan odgovor je bil neupravičeno izbrisan.");

const serialized=engine.serialize(dependency),restored=engine.restore(serialized);
assert.strictEqual(restored.status,"restored");assert(restored.session.answersByQuestionId["domain:risks"]);
assert.strictEqual(engine.restore('{"version":"old"}').status,"rejected");

let telecom=engine.create(telecomInput);
telecom=answerId(telecom,"telecom:account-type","poslovna");
telecom=answerId(telecom,"telecom:line-count","8");
telecom=answerId(telecom,"telecom:current-price","129,90");
telecom=answerId(telecom,"telecom:current-package",["podatki","roaming-eu"]);
telecom=answerId(telecom,"telecom:binding","aktivna");
assert(telecom.questionById["telecom:binding-end"],"Aktivna vezava ni odprla vprašanja o datumu izteka.");
assert(telecom.questionById["telecom:cancellation-period"],"Aktivna vezava ni odprla vprašanja o odpovednem roku.");
assert.strictEqual(telecom.facts.telecomMonthlyPriceEur,129.9);
assert.strictEqual(telecom.facts.telecomLineCount,8);

const rendererSource=fs.readFileSync(require.resolve("../app/svetovalec-preverba.js"),"utf8");
capabilities.actions.forEach((action)=>capabilities.profiles.forEach((profile)=>{
  const definition=questions.build({actionCode:action.code,actionConfidence:9,profileId:profile.profileId,profileConfidence:9,profileCandidates:[profile.profileId]},{});
  assert(definition.questions.length>=9,"Premalo vprašanj za "+action.code+" / "+profile.code);
  if(profile.familyCode!=="telekom")assert(definition.byId["family:"+profile.familyCode+":focus"],"Manjka družinsko vprašanje za "+profile.familyCode);
  definition.questions.forEach((question)=>{
    assert(approved.has(question.widgetId),"Widget ni odobren: "+question.widgetId);
    assert(rendererSource.includes('"'+question.widgetId+'":'),"Widget nima namenskega rendererja: "+question.widgetId);
    assert(question.interfaceId&&question.fieldInterfaceId&&question.contextVersion,"Vprašanje nima stabilnih ID-jev: "+question.id);
    assert(question.context&&question.context.purpose&&question.context.validation&&question.context.persistence,"Vprašanje nima obširnega konteksta: "+question.id);
  });
}));

const start=process.hrtime.bigint();for(let i=0;i<10000;i++)questions.build(dependency.semanticSeed,dependency.answersByQuestionId);const elapsed=Number(process.hrtime.bigint()-start)/1e6;
assert(elapsed<1500,"10.000 sestav načrta je prepočasnih: "+elapsed.toFixed(1)+" ms");
console.log("Atena guided flow v2 OK",{profiles:43,actions:5,scenarios:scenarios.length,benchmarkMs:Number(elapsed.toFixed(1))});
