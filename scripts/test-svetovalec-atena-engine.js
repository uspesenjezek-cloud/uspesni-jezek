"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const engine=require("../app/svetovalec-atena-engine");
const schema=require("../app/atena-card-schema");
const luna=require("../api/_lib/svetovalec-luna-batch-engine");
const router=require("../api/_lib/svetovalec-luna-block-router");
const handler=require("../api/_handlers/razcleni-svetovalec");
const clarification=require("../app/svetovalec-clarification-engine");

assert.equal(engine.contractVersion,"svetovalec-intent-contract-v1");
assert.equal(engine.services.length,5);
assert.deepEqual(engine.services.map((service)=>service.code),["ponudba","narocnina","pogajanje","ponudbe","klic"]);
assert.equal(engine.idValidation.valid,true);
assert.equal(new Set(engine.interfaces.map((item)=>item.id)).size,engine.interfaces.length);
assert.equal(new Set(engine.interfaces.map((item)=>item.interfaceId)).size,engine.interfaces.length);
assert.ok(engine.interfaces.some((item)=>item.interfaceId==="atena:field:svetovalec:request-description"));
assert.ok(engine.interfaces.some((item)=>item.interfaceId==="atena:control:svetovalec:query"));

const fakeNodes=new Map(engine.interfaces.map((binding)=>[binding.selector,[{dataset:{}}]]));
const stamp=engine.stamp({querySelectorAll:(selector)=>fakeNodes.get(selector)||[]});
assert.equal(stamp.missing,0);
assert.equal(stamp.stamped,engine.interfaces.length);
engine.interfaces.forEach((binding)=>assert.equal(fakeNodes.get(binding.selector)[0].dataset.atenaInterfaceId,binding.interfaceId));

engine.services.forEach((service)=>{
  const area=service.areas[0];
  const source="Želim urediti to potrebo varno in pregledno.";
  const result=engine.validateProposal({selections:[{serviceId:service.id,areaCode:area.code,moduleIds:[area.moduleIds[0]],evidence:"to potrebo"}],facts:[],clarification:null},source);
  assert.ok(result,"veljaven mora biti tok "+service.code);
  assert.equal(result.selections[0].actionId,"atena:action:svetovalec:open-service:"+service.code);
});

const source="Naročnino plačujem 39 evrov mesečno in jo želim odpovedati.";
const subscription=engine.getService("narocnina");
const costArea=subscription.areas.find((area)=>area.code==="stroski");
const costCard=schema.catalog.find((card)=>card.flow==="narocnina"&&costArea.moduleIds.includes(card.moduleId)&&card.fields.length);
const costField=costCard.fields[0];
const valid={selections:[{serviceId:subscription.id,areaCode:costArea.code,moduleIds:[costCard.moduleId],evidence:"39 evrov mesečno"}],facts:[{serviceId:subscription.id,fieldId:costField.id,value:"39 EUR mesečno",evidence:"39 evrov mesečno"}],clarification:null};
assert.ok(engine.validateProposal(valid,source));
assert.equal(engine.validateProposal({...valid,selections:[{...valid.selections[0],serviceId:9999}]},source),null,"neznan serviceId mora pasti");
assert.equal(engine.validateProposal({...valid,selections:[{...valid.selections[0],evidence:"ni v viru"}]},source),null,"nedobesedni dokaz mora pasti");
assert.equal(engine.validateProposal({...valid,selections:[valid.selections[0],valid.selections[0]]},source),null,"podvojen izbor mora pasti");
assert.equal(engine.validateProposal({...valid,facts:[{...valid.facts[0],fieldId:16401}]},source),null,"polje druge storitve mora pasti");
assert.equal(engine.validateProposal({selections:[{serviceId:subscription.id,areaCode:costArea.code,moduleIds:[6104],evidence:"mesečno"}],facts:[{serviceId:subscription.id,fieldId:16108,value:"mesečno",evidence:"mesečno"}],clarification:null},source),null,"prikazna oznaka ne sme nadomestiti kanoničnega option ID-ja");
assert.ok(engine.validateProposal({selections:[{serviceId:subscription.id,areaCode:costArea.code,moduleIds:[6104],evidence:"mesečno"}],facts:[{serviceId:subscription.id,fieldId:16108,value:"mesec",evidence:"mesečno"}],clarification:null},source));
assert.ok(engine.validateProposal({selections:[],facts:[],clarification:"Ali želite preveriti ponudbo ali odpovedati naročnino?"},source));
const structuredSource="Preverite našo marketing pogodbo.";
const structured=engine.validateProposal({selections:[],facts:[],clarification:{mode:"widget",clarificationId:"enkratno-ali-ponavljajoce",widgetId:"dvojni-segment",question:null,evidence:"marketing pogodbo"}},structuredSource);
assert.equal(structured.clarification.clarificationId,"enkratno-ali-ponavljajoce");
assert.equal(structured.clarification.widgetId,"dvojni-segment");
assert.equal(engine.validateProposal({selections:[],facts:[],clarification:{mode:"widget",clarificationId:"enkratno-ali-ponavljajoce",widgetId:"mreza-izbir",question:null,evidence:"marketing pogodbo"}},structuredSource),null,"Luna ne sme zamenjati odobrenega widgeta pojasnila");
assert.equal(engine.validateProposal({selections:[],facts:[],clarification:null},source),null);

const multi=engine.validateProposal({selections:[
  {serviceId:subscription.id,areaCode:costArea.code,moduleIds:[costCard.moduleId],evidence:"39 evrov mesečno"},
  {serviceId:subscription.id,areaCode:"izstop",moduleIds:[6110],evidence:"želim odpovedati"}
],facts:[],clarification:null},source);
assert.equal(multi.selections.length,2,"ista storitev lahko vsebuje dve dokazani področji");

const questionBatch={state:"ask",actionCode:"narocnina",profileId:null,batchTitle:"Pogoji naročnine",rationale:"Najprej določimo najpomembnejše pogoje.",evidence:"Naročnino",questions:[
  {semanticKey:"subscription:goal",factKey:"subscription:goal",purpose:"Določi cilj.",text:"Kaj želite doseči z naročnino?",answerMode:"single",options:[{id:"obdrzi",label:"Obdržati",value:"keep"},{id:"odpovej",label:"Odpovedati",value:"cancel"}],allowOwn:true},
  {semanticKey:"subscription:cost",factKey:"subscription:cost-priority",purpose:"Določi stroškovno skrb.",text:"Kaj vas pri strošku najbolj skrbi?",answerMode:"multiple",options:[{id:"cena",label:"Mesečna cena",value:"monthly-price"},{id:"dodatki",label:"Dodatni stroški",value:"extras"},{id:"podrazitev",label:"Podražitve",value:"price-rise"}],allowOwn:true},
  {semanticKey:"subscription:exit",factKey:"subscription:exit-clarity",purpose:"Preveri izstop.",text:"Kako jasni so pogoji odpovedi?",answerMode:"single",options:[{id:"jasni",label:"Jasni",value:"clear"},{id:"nejasni",label:"Nejasni",value:"unclear"},{id:"ne-vem",label:"Ne vem",value:"unknown"},{id:"spor",label:"So sporni",value:"disputed"}],allowOwn:false}
]};
const normalizedQuestionBatch=luna._test.validateQuestionBatch(questionBatch,source,null);
assert.ok(normalizedQuestionBatch);assert.equal(normalizedQuestionBatch.source,"luna");
assert.deepEqual(normalizedQuestionBatch.questions.map((item)=>item.widgetId),["dvojni-segment","mreza-izbir","mreza-izbir"]);
assert.deepEqual(normalizedQuestionBatch.questions.map((item)=>item.layoutVariant),["choice-2","choice-3","choice-4"]);
assert.equal(luna._test.validateQuestionBatch({...questionBatch,questions:questionBatch.questions.slice(0,2)},source,null),null,"Sklop mora imeti najmanj tri vprašanja.");
assert.equal(luna._test.validateQuestionBatch(questionBatch,source,{batchIndex:1,answers:[{semanticKey:"subscription:goal",factKey:"subscription:goal"}]}),null,"Luna ne sme ponoviti že odgovorjenega semantičnega ključa.");
const reviewBatch=luna._test.validateQuestionBatch({state:"review",actionCode:"narocnina",profileId:null,batchTitle:"Pripravljeno za pregled",rationale:"Zbranih je dovolj podatkov.",evidence:"Naročnino",questions:[]},source,{batchIndex:1,answers:[]});
assert.equal(reviewBatch.state,"review");

const request=luna.requestBody(source,{company:{name:"Primer GmbH"},attachment:{name:"pogodba.pdf",type:"application/pdf",size:1234}},"user-1");
const input=JSON.parse(request.input);
assert.equal(input.attachment.contentAvailable,false);
assert.equal(input.sourceText,source);
assert.equal(input.advisorNeeds.profiles.length,43);assert.equal(input.advisorNeeds.actions.length,5);
assert.deepEqual(input.advisorNeeds.rules.questionsPerBatch,[3,4]);
assert.ok(request.prompt_cache_key.startsWith("atena-advisor:atena-svetovalec-luna-batches-v1:"));
assert.doesNotMatch(request.prompt_cache_key,/user-1|Naročnino|Primer GmbH/);
assert.ok(input.catalog.fields.find((field)=>field.fieldId===16108).allowedValues.some((option)=>option.id==="mesec"));
assert.equal(request.text.format.strict,true);
const answer=clarification.answer("enkratno-ali-ponavljajoce","enkratno");
const compactInput=JSON.parse(luna.requestBody(structuredSource+"\n"+answer.answerText,{clarificationAnswer:answer},"user-1").input);
assert.ok(compactInput.catalog.services.length<input.catalog.services.length,"strukturiran odgovor mora zožiti naslednji Luna katalog");
assert.deepEqual(compactInput.catalog.services.map((item)=>item.code),["ponudba"]);
const multiConcern=clarification.answer("glavna-skrb",["cena","rok","placilo"]);
assert.deepEqual(multiConcern.optionIds,["cena","rok","placilo"]);
assert.equal(multiConcern.optionId,"");
assert.ok(multiConcern.answerText.includes("ceno")&&multiConcern.answerText.includes("rok")&&multiConcern.answerText.includes("plačilne pogoje"));
assert.equal(clarification.byId["glavna-skrb"].selectionMode,"multiple");
assert.equal(clarification.byId["enkratno-ali-ponavljajoce"].selectionMode,"single");
assert.equal(clarification.answer("enkratno-ali-ponavljajoce",["enkratno","ponavljajoce"]),null,"izključujoče vprašanje ne sme sprejeti več odgovorov");
assert.equal(luna._test.validateProposal(valid,source).facts.length,1);

assert.equal(handler._test.validRequestId("advisor:1234567890abcdef"),true);
assert.equal(handler._test.validRequestId("kratko"),false);
let statusCode=0,payload=null;
handler({method:"GET"},{setHeader(){},status(code){statusCode=code;return this;},json(value){payload=value;return value;}}).then(async()=>{
  assert.equal(statusCode,405);assert.equal(payload.code,"METHOD_NOT_ALLOWED");
  const analyzed=await luna.analyze(source,{}, {apiKey:"test",userId:"user-1",maxAttempts:1,fetchImpl:async()=>({ok:true,status:200,headers:{get(){return null;}},json:async()=>({output_text:JSON.stringify({...valid,questionBatch}),usage:{input_tokens:1,output_tokens:1}})})});
  assert.equal(analyzed.selections[0].serviceCode,"narocnina");
  assert.equal(analyzed.facts[0].fieldId,costField.id);

  const db=require("../api/_lib/supabase-server");
  const oldConfig=db.uporabniskaKonfiguracija,oldAuth=db.preveriUporabnika,oldAnalyze=router.analyze,oldPreview=process.env.UJ_LOCAL_PREVIEW_SERVER;
  db.uporabniskaKonfiguracija=()=>({});
  db.preveriUporabnika=async()=>({ok:false,status:401,code:"AUTH_REQUIRED",napaka:"Prijava je obvezna."});
  process.env.UJ_LOCAL_PREVIEW_SERVER="false";
  const invoke=async(req)=>{let code=0,data=null;await handler(req,{setHeader(){},status(value){code=value;return this;},json(value){data=value;return value;}});return {code,data};};
  const denied=await invoke({method:"POST",body:{requestId:"advisor:1234567890abcdef",text:source},headers:{},socket:{remoteAddress:"8.8.8.8"}});
  assert.equal(denied.code,401);assert.equal(denied.data.code,"AUTH_REQUIRED");
  process.env.UJ_LOCAL_PREVIEW_SERVER="true";
  router.analyze=async()=>({engineVersion:router.ENGINE_VERSION,contractVersion:router.CONTRACT_VERSION,model:router.MODEL,semanticPlan:{status:"OK"},selections:[],facts:[],clarification:null,questionBatch:normalizedQuestionBatch,blockCodes:["c3"]});
  const accepted=await invoke({method:"POST",body:{requestId:"advisor:1234567890abcdeg",text:source},headers:{authorization:"Bearer local-preview","x-uj-local-preview":"1"},socket:{remoteAddress:"127.0.0.1"}});
  assert.equal(accepted.code,200);assert.equal(accepted.data.ok,true);assert.deepEqual(accepted.data.selections,[]);
  assert.equal(accepted.data.questionBatch.source,"luna");
  const screenshotRequest="rad bi da nam preverite marketing pogodbo in da najdete kakšne popuste";
  const clarified=await invoke({method:"POST",body:{requestId:"advisor:1234567890abcdeh",text:screenshotRequest},headers:{authorization:"Bearer local-preview","x-uj-local-preview":"1"},socket:{remoteAddress:"127.0.0.1"}});
  assert.equal(clarified.code,200);assert.equal(clarified.data.ok,true);assert.equal(clarified.data.questionBatch.source,"luna");
  const cleanedMulti=handler._test.cleanContext({clarificationAnswer:{clarificationId:"glavna-skrb",optionIds:["cena","rok","placilo"]}});
  assert.deepEqual(cleanedMulti.clarificationAnswer.optionIds,["cena","rok","placilo"]);
  db.uporabniskaKonfiguracija=oldConfig;db.preveriUporabnika=oldAuth;router.analyze=oldAnalyze;
  if(oldPreview===undefined) delete process.env.UJ_LOCAL_PREVIEW_SERVER; else process.env.UJ_LOCAL_PREVIEW_SERVER=oldPreview;
  const root=path.join(__dirname,"..");
  const unified=fs.readFileSync(path.join(root,"api/izvedi-opomin-ukrep.js"),"utf8");
  const vercel=fs.readFileSync(path.join(root,"vercel.json"),"utf8");
  const client=fs.readFileSync(path.join(root,"app/svetovalec-preverba.js"),"utf8");
  const localServer=fs.readFileSync(path.join(root,"scripts/local-server.js"),"utf8");
  assert.match(unified,/advisor-ai/);assert.match(vercel,/razcleni-svetovalec/);assert.match(client,/fetch\("\/api\/razcleni-svetovalec"/);
  assert.match(localServer,/razcleniSvetovalecModul = require\.resolve\("\.\.\/api\/_handlers\/razcleni-svetovalec"\)/);
  assert.match(localServer,/pathname === "\/api\/razcleni-svetovalec"[\s\S]*?izvediLokalniApi\(req, res, razcleniSvetovalecModul\)/);
  ["svetovalec-clarification-engine.js","svetovalec-atena-engine.js","svetovalec-service-knowledge-blocks.js"].forEach((file)=>assert.ok(localServer.includes(file),"lokalni API mora spremljati skupni Atenin modul "+file));
  assert.match(localServer,/datoteka\.startsWith\(apiRoot\) \|\| apiSharedAppFileSet\.has\(datoteka\)/,"osvežitev mora iz cachea odstraniti API in skupne Atenine module");
  assert.doesNotMatch(client,/Primer je pripravljen za naslednji korak/);
  console.log("Svetovalec Atena engine: OK (5 storitev, zaprti ID-ji, evidence in API bridge)");
}).catch((error)=>{console.error(error);process.exitCode=1;});
