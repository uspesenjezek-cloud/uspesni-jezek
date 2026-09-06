"use strict";

const assert=require("node:assert/strict");
const {performance}=require("node:perf_hooks");
const router=require("../api/_lib/svetovalec-luna-block-router");

const source="preverite pogodbo za marketing ki jo imam in izpogajajte se za boljše pogoje";
const proposal={state:"ask",actionCode:"pogajanje",profileId:1022,batchTitle:"Marketing pogodba",rationale:"Najprej preverimo ceno, rezultate in varen izstop.",evidence:"marketing",blockCodes:["c3","c6","c5"]};
assert.equal(router.RESPONSE_ZOD_SCHEMA.safeParse(proposal).success,true);
assert.equal(router.RESPONSE_ZOD_SCHEMA.safeParse(Object.assign({},proposal,{blockCodes:["c3","c3"]})).success,false);

const request=router.requestBody(source,{company:{name:"Primer GmbH"}},"user-1");
const serialized=JSON.stringify(request);
const requestBytes=Buffer.byteLength(serialized,"utf8");
const input=JSON.parse(request.input);
assert.ok(requestBytes<12000,"Celotna modelska zahteva mora ostati majhna.");
assert.ok(requestBytes<98272*0.15,"Novi request mora biti vsaj 85 % manjši od starega 98.272-byte requesta.");
assert.equal(request.reasoning.effort,"low");
assert.equal(request.max_output_tokens,450);
assert.equal(input.operatingModel.profiles.length,43);
assert.equal(input.operatingModel.families.marketing[0],"fk");
assert.equal(input.sourceText,source);
assert.equal(input.catalog,undefined,"Veliki katalog se ne sme več pošiljati.");
assert.match(request.instructions,/Return no questions/);
assert.match(request.instructions,/local question graph owns every question/);
assert.equal(router.RESPONSE_SCHEMA.properties.questions,undefined);
assert.ok(request.input.lastIndexOf(source)>request.input.indexOf("operatingModel"),"Dinamični tekst mora biti za stabilnim cache prefixom.");

const validated=router._test.validatePlan(proposal,source,null);
assert.ok(validated);
assert.equal(validated.questionBatch.profileId,1022);
assert.deepEqual(validated.blockCodes,["c3","c6","c5"]);
assert.equal(validated.questionBatch.source,"local-graph");
assert.equal(validated.questionBatch.graphVersion,"svetovalec-question-graph-v1");
assert.deepEqual(validated.questionBatch.questions.map((item)=>item.id),["q:marketing:objective","q:marketing:channels","q:marketing:current-spend","q:marketing:budget"]);
assert.equal(router._test.validatePlan({...proposal,questions:[{text:"Digitalni marketing ali drugo?"}]},source,null),null,"Luna ne sme dodati UI vprašanj.");
assert.equal(router._test.validatePlan({...proposal,blockCodes:["c3","c3"]},source,null),null,"Podvojeni blok mora pasti.");
assert.equal(router._test.validatePlan({...proposal,blockCodes:["c5"],actionCode:"ponudba"},source,null),null,"Blok izstopa ni dovoljen pri navadni ponudbi.");
assert.equal(router._test.validatePlan({...proposal,evidence:"ni v viru"},source,null),null,"Dokaz mora biti exact span.");

let fetchCount=0;
const fetchOk=async()=>{fetchCount+=1;return {ok:true,status:200,headers:{get(){return null;}},json:async()=>({output_text:JSON.stringify(proposal),usage:{input_tokens:2000,output_tokens:300}})};};
(async()=>{
  const result=await router.analyze(source,{}, {apiKey:"test",userId:"user-1",fetchImpl:fetchOk});
  assert.equal(fetchCount,1,"Veljaven načrt mora uporabiti en sam modelski klic.");
  assert.equal(result.semanticPlan.transport.responseRetries,0);
  assert.equal(result.questionBatch.actionCode,"pogajanje");
  assert.deepEqual(result.blockCodes,["c3","c6","c5"]);
  assert.deepEqual(result.selections,[]);

  const local=await router.analyze(source,{conversation:{sessionId:"local-1",revision:5,batchIndex:1,actionCode:"pogajanje",profileId:1022,answers:[]}},{apiKey:null,userId:"user-1",fetchImpl:async()=>{throw new Error("lokalno nadaljevanje ne sme klicati omrežja");}});
  assert.equal(local.model,"local");
  assert.equal(local.semanticPlan.attempted,false);
  assert.equal(local.questionBatch.state,"ask");

  let invalidCalls=0;
  await assert.rejects(()=>router.analyze(source,{}, {apiKey:"test",userId:"user-1",fetchImpl:async()=>{invalidCalls+=1;return {ok:true,status:200,headers:{get(){return null;}},json:async()=>({output_text:"{}"})};}}),(error)=>error.code==="LUNA_INVALID_ADVISOR_PLAN");
  assert.equal(invalidCalls,1,"Neveljaven semantic plan se ne sme samodejno ponoviti z drugim dragim klicem.");

  const samples=[];
  for(let index=0;index<10000;index+=1){const started=performance.now();router._test.validatePlan(proposal,source,null);samples.push(performance.now()-started);}
  samples.sort((a,b)=>a-b);
  const p95=samples[Math.floor(samples.length*0.95)],max=samples[samples.length-1];
  assert.ok(p95<2,`Lokalna validacija je prepočasna: p95=${p95} ms.`);
  console.log(JSON.stringify({ok:true,requestBytes,approximateRequestTokens:Math.ceil(serialized.length/4),reductionVsOldPercent:Number((100-requestBytes/98272*100).toFixed(1)),calls:{success:fetchCount,invalid:invalidCalls},timings:{p95Ms:Number(p95.toFixed(4)),maxMs:Number(max.toFixed(4))}},null,2));
})().catch((error)=>{console.error(error);process.exitCode=1;});
