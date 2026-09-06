"use strict";
const assert=require("node:assert/strict");
const flow=require("../app/svetovalec-conversation-flow");
let state=flow.create("Preverite pogodbo za grafično oblikovanje in logotip.");
assert.equal(state.sections.length,4);
assert.equal(state.semanticSeed.profileId,1024);
let guard=0;
while(state.status==="draft"&&guard++<40){
  const q=state.questionById[state.activeQuestionId];
  const count=q.kind==="multiple"?Number(q.minSelections||1):1;
  state=flow.answerQuestion(state,q.id,{source:"widget",value:q.options.slice(0,count).map((option)=>option.id)});
  assert.ok(state,"Odgovora ni bilo mogoče shraniti: "+q.id);
}
assert.equal(state.status,"ready");
const ambiguous=flow.create("Želim pomoč pri odločitvi");
const first=flow.goToQuestion(ambiguous,"intent:action");assert.equal(first.activeQuestionId,"intent:action");
let free=flow.openFreeText(first,"intent:action");assert.equal(free.inputModeByQuestionId["intent:action"],"free-text");
free=flow.answerQuestion(free,"intent:action",{source:"free-text",rawText:"Želim preveriti ponudbo in avtorske pravice."});assert.equal(free.answersByQuestionId["intent:action"].source,"free-text");
let preview=flow.preview(state);assert.equal(preview.status,"preview");assert.ok(preview.result.serviceCodes.length);
assert.equal(flow.backToAnswers(preview).status,"ready");assert.equal(flow.confirm(preview).status,"confirmed");
const restored=flow.restore(flow.serialize(state));assert.equal(restored.status,"ready");assert.deepEqual(restored.answers,state.answers);
assert.equal(flow.restore('{"version":"old"}'),null);
console.log("svetovalec conversation flow v2: ok");
