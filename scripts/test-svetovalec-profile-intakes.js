"use strict";

const assert=require("node:assert/strict");
const {performance}=require("node:perf_hooks");
const graph=require("../app/svetovalec-question-graph");
const dynamic=require("../app/svetovalec-dynamic-batch-engine");
const capabilities=require("../app/svetovalec-capability-catalog");
const knowledge=require("../app/svetovalec-service-knowledge-blocks");
const market=require("../app/svetovalec-service-market-catalog");

const ids=new Set(),facts=new Set(),samples=[];
for(const profile of capabilities.profiles.filter((item)=>item.profileId!==1022)){
  const codes=knowledge.profileBlueprints[profile.profileId].blockIds.slice(0,4).map((id)=>knowledge.blockById[id].promptCode);
  const started=performance.now();
  const local=graph.materializeSelection(profile.profileId,"ponudba",codes,{batchIndex:0,answers:[]});
  samples.push(performance.now()-started);
  assert.equal(local.questions.length,4,`${profile.profileId}: začetni sklop`);
  const batch={source:"local-graph",graphVersion:graph.version,state:"ask",actionCode:"ponudba",profileId:profile.profileId,id:local.id,index:0,title:local.title,rationale:local.rationale,evidence:"ponudbo",interfaceId:"atena:section:test:"+profile.profileId,contextVersion:"atena-interface-context-v3",questions:local.questions};
  let session=dynamic.create("preverite ponudbo",batch);
  assert(session,`${profile.profileId}: seja`);
  assert.equal(session.questionIds.length,4);
  const solution=local.questions[0],offer=local.questions[1],stage=local.questions[2],priorities=local.questions[3];
  assert.deepEqual(solution.options.map((item)=>item.value),market.profileById[profile.profileId].solutionTypes);
  assert.ok(solution.options.every((item)=>item.label&&item.label!==item.value),`${profile.profileId}: človeške oznake rešitev`);
  assert.equal(priorities.options.length,4);
  assert.ok(priorities.options.every((item)=>item.label.length>=12),`${profile.profileId}: konkretne prioritete`);
  local.questions.forEach((question)=>{assert(!ids.has(question.id),`podvojen ID ${question.id}`);assert(!facts.has(question.factKey),`podvojen fact ${question.factKey}`);ids.add(question.id);facts.add(question.factKey);assert.deepEqual(question.marketApplicability,["DE","SI"]);});
  session=dynamic.answer(session,solution.id,{source:"widget",value:[solution.options[0].id]});
  session=dynamic.answer(session,offer.id,{source:"widget",value:[offer.options[0].id]});
  session=dynamic.answer(session,stage.id,{source:"widget",value:[stage.options[0].id]});
  session=dynamic.answer(session,priorities.id,{source:"widget",value:priorities.options.slice(0,2).map((item)=>item.id)});
  assert.equal(session.status,"batch-ready",`${profile.profileId}: zaključek sklopa`);
  assert.equal(session.factsByKey[solution.factKey],solution.options[0].value);
  assert.deepEqual(session.factsByKey[priorities.factKey],priorities.options.slice(0,2).map((item)=>item.value));
}

samples.sort((a,b)=>a-b);
const p=(value)=>samples[Math.min(samples.length-1,Math.floor(samples.length*value))];
assert.ok(p(.95)<5,`profilni materializator je prepočasen: ${p(.95)} ms`);
console.log(JSON.stringify({ok:true,profiles:42,questions:ids.size,facts:facts.size,marketCoverage:["DE","SI"],timingsMs:{p50:Number(p(.5).toFixed(4)),p95:Number(p(.95).toFixed(4)),max:Number(samples.at(-1).toFixed(4))}},null,2));
