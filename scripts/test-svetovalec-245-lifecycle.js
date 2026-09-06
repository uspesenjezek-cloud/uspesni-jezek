"use strict";

const assert=require("node:assert/strict");
const {performance}=require("node:perf_hooks");
const graph=require("../app/svetovalec-question-graph");
const dynamic=require("../app/svetovalec-dynamic-batch-engine");
const market=require("../app/svetovalec-service-market-catalog");
const knowledge=require("../app/svetovalec-service-knowledge-blocks");
const router=require("../api/_lib/svetovalec-luna-block-router");

const ACTIONS=["ponudba","narocnina","pogajanje","ponudbe","klic"];
const durations=[];
function blockCodes(action){return knowledge.actionBlueprints[action].slice(0,4).map((id)=>knowledge.blockById[id].promptCode);}
function batch(local,profileId,action,index){return {source:"local-graph",graphVersion:graph.version,state:"ask",actionCode:action,profileId,id:local.id,index,title:local.title,rationale:local.rationale,evidence:"zahteva",interfaceId:"atena:section:test:"+profileId+":"+action+":"+index,contextVersion:"atena-interface-context-v3",questions:local.questions};}
function inputFor(question,wantedSolution){
  if(question.factKey.endsWith(".solutionType")){const selected=question.options.find((item)=>item.value===wantedSolution);assert(selected,"manjka rešitev "+wantedSolution);return {source:"widget",value:[selected.id]};}
  if(question.factKey==="marketing.channels"){const selected=question.options.find((item)=>item.value===wantedSolution);assert(selected,"manjka marketinški kanal "+wantedSolution);return {source:"widget",value:[selected.id]};}
  if(question.kind==="single")return {source:"widget",value:[question.options[0].id]};
  if(question.kind==="multiple")return {source:"widget",value:[question.options[0].id]};
  if(question.kind==="date")return {source:"widget",value:["2026-09-15"]};
  if(question.kind==="money"||question.kind==="range")return {source:"widget",value:["1000"]};
  if(question.kind==="quantity"){const units=question.answerSpec&&question.answerSpec.units;return {source:"widget",value:units&&units.length?["2",units[0]]:["2"]};}
  return {source:"free-text",rawText:"Potrjen konkreten podatek"};
}
function answerCurrentBatch(session,wantedSolution){
  let guard=0;
  while(session.status==="draft"&&guard++<20){const id=session.activeQuestionId,question=session.questionById[id];assert(question,"aktivno vprašanje");const next=dynamic.answer(session,id,inputFor(question,wantedSolution));assert(next,"odgovor mora biti veljaven: "+id);session=next;}
  assert.equal(session.status,"batch-ready","sklop se mora zaključiti");return session;
}

let flows=0,solutions=0,localContinuations=0;
for(const profile of market.profiles){
  for(const solution of profile.solutionTypes){
    solutions++;
    for(const action of ACTIONS){
      const started=performance.now(),source="preverite poslovno zahtevo";
      const first=graph.materializeSelection(profile.profileId,action,blockCodes(action),{batchIndex:0,answers:[]});
      let session=dynamic.create(source,batch(first,profile.profileId,action,0));
      assert(session);session=answerCurrentBatch(session,solution);
      while(session.batches.length<4){
        const context=router._test.cleanConversation(dynamic.conversationContext(session));
        const continuation=router._test.localContinuation(source,context);
        assert(continuation,"lokalno nadaljevanje");assert.equal(continuation.model,"local");assert.equal(continuation.semanticPlan.attempted,false);
        session=dynamic.setReplanning(session);session=dynamic.appendBatch(session,continuation.questionBatch);assert(session,"dodajanje lokalnega sklopa "+profile.profileId+"/"+solution+"/"+action+"/"+context.batchIndex+" "+continuation.questionBatch.id);
        session=answerCurrentBatch(session,solution);localContinuations++;
      }
      const review=router._test.localContinuation(source,router._test.cleanConversation(dynamic.conversationContext(session)));
      assert.equal(review.questionBatch.state,"review");assert.equal(review.semanticPlan.attempted,false);
      session=dynamic.setReplanning(session);session=dynamic.appendBatch(session,review.questionBatch);assert.equal(session.status,"ready");
      session=dynamic.buildPreview(session);assert.equal(session.status,"preview");assert(session.preview.rows.length>=12&&session.preview.rows.length<=16);
      assert.equal(session.profileId,profile.profileId);assert.equal(session.actionCode,action);flows++;durations.push(performance.now()-started);
    }
  }
}
durations.sort((a,b)=>a-b);const percentile=(p)=>durations[Math.min(durations.length-1,Math.floor(durations.length*p))];
assert.equal(solutions,245);assert.equal(flows,1225);
console.log(JSON.stringify({ok:true,profiles:market.profiles.length,solutions,actions:ACTIONS.length,flows,localContinuations,paidAiCalls:0,markets:market.supportedMarkets,timingsMs:{p50:Number(percentile(.5).toFixed(3)),p95:Number(percentile(.95).toFixed(3)),max:Number(durations.at(-1).toFixed(3))}},null,2));
