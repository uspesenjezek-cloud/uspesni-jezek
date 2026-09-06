"use strict";

const assert=require("node:assert/strict");
const engine=require("../app/svetovalec-dynamic-batch-engine");
const graph=require("../app/svetovalec-question-graph");

function question(id,count,mode="single",allowOwn=true){return {id,semanticKey:"need:"+id,factKey:"fact:"+id,revision:1,interfaceId:"atena:card:svetovalec:"+id,fieldInterfaceId:"atena:field:svetovalec:"+id+":answer",contextVersion:"atena-interface-context-v3",sectionId:"batch-1",kind:mode,widgetId:count===2?"dvojni-segment":"mreza-izbir",layoutVariant:"choice-"+count,question:"Vprašanje "+id+"?",purpose:"Namen "+id,options:Array.from({length:count},(_,index)=>({id:"o"+(index+1),label:"Možnost "+(index+1),value:"value-"+(index+1),facts:{}})),required:true,minSelections:1,allowFreeText:allowOwn,dependsOn:[],context:{purpose:"Namen",validation:{required:true}}};}
function batch(id,index,questions){return {source:"luna",state:"ask",actionCode:"ponudba",profileId:1022,id,index,title:"Sklop "+(index+1),rationale:"Koherenten sklop",evidence:"marketing",interfaceId:"atena:section:svetovalec:"+id,contextVersion:"atena-interface-context-v3",questions};}
const first=batch("batch-1",0,[question("q2",2),question("q3",3,"multiple"),question("q4",4)]);
let session=engine.create("Preveri marketing pogodbo",first);
assert.equal(session.status,"draft");
assert.deepEqual(session.questionIds,["q2","q3","q4"]);
session=engine.answer(session,"q2",{source:"widget",value:["o1"]});assert.equal(session.status,"draft","prvo vprašanje ne sme zaključiti sklopa");
session=engine.answer(session,"q3",{source:"widget",value:["o1","o2"]});assert.equal(session.status,"draft","drugo vprašanje ne sme zaključiti sklopa");
session=engine.answer(session,"q4",{source:"widget",value:["o2"]});assert.equal(session.status,"batch-ready","šele zadnji odgovor zaključi sklop");
const context=engine.conversationContext(session);assert.equal(context.answers.length,3);assert.equal(context.batchIndex,1);assert.deepEqual(context.answers[1].selectedValues,["value-1","value-2"]);
session=engine.setReplanning(session);assert.equal(session.status,"replanning");
const second=batch("batch-2",1,[question("q5",2),question("q6",3),question("q7",4)]);second.questions.forEach((item)=>{item.sectionId="batch-2";});
session=engine.appendBatch(session,second);assert.equal(session.status,"draft");assert.equal(session.batches.length,2);assert.equal(session.activeQuestionId,"q5");
session=engine.answer(session,"q5",{source:"free-text",rawText:"Moj lasten odgovor"});assert.equal(session.answersByQuestionId.q5.source,"free-text");
session=engine.answer(session,"q6",{source:"widget",value:["o1"]});session=engine.answer(session,"q7",{source:"widget",value:["o1"]});assert.equal(session.status,"batch-ready");
const beforeSame=engine.serialize(session),sameRevision=session.revision;
session=engine.answer(session,"q2",{source:"widget",value:["o1"]});
assert.equal(session.batches.length,2,"ponovna potrditev iste vrednosti ne sme odstraniti poznejšega sklopa");
assert.equal(session.revision,sameRevision,"ista semantična vrednost ne sme povečati revizije");
assert.deepEqual(session.answersByQuestionId.q5,JSON.parse(beforeSame).answersByQuestionId.q5);
const beforeEditRevision=session.revision;session=engine.answer(session,"q2",{source:"widget",value:["o2"]});assert.equal(session.batches.length,1,"sprememba starega odgovora mora odstraniti poznejše sklope");assert.equal(session.answersByQuestionId.q5,undefined);assert(session.revision>beforeEditRevision);assert.equal(session.status,"batch-ready");
const restored=engine.restore(engine.serialize(session));assert(restored);assert.equal(restored.answersByQuestionId.q2.value[0],"o2");
const review={source:"luna",state:"review",actionCode:"ponudba",profileId:1022,id:"review",index:1,title:"Pripravljeno za pregled",rationale:"Podatkov je dovolj",evidence:"marketing",interfaceId:"atena:section:svetovalec:review",contextVersion:"atena-interface-context-v3",questions:[]};
session=engine.setReplanning(restored);session=engine.appendBatch(session,review);assert.equal(session.status,"ready");
session=engine.buildPreview(session);assert.equal(session.status,"preview");assert.equal(session.preview.rows.length,3);assert.equal(engine.confirm(session).status,"confirmed");
const corrupt=JSON.parse(engine.serialize(engine.backToAnswers(session)));corrupt.answersByQuestionId.q4.value=["bad"];
const recovered=engine.restore(corrupt);assert.equal(recovered.status,"draft","poškodovan ready restore ne sme ostati ready");assert.equal(recovered.preview,null);assert.equal(engine.buildPreview(recovered),null,"nepopoln restore ne sme vreči TypeError");
assert.equal(engine.appendBatch(engine.setReplanning(restored),batch("duplicate",1,[question("q2",2),question("x2",2),question("x3",2)])),null,"ponovljeno vprašanje mora biti zavrnjeno");

assert.equal(engine._test.localizedNumber("1.250,50"),1250.5,"slovenski zapis zneska mora postati kanonično število");
assert.equal(engine._test.validIsoDate("2026-02-29"),false,"neobstoječ datum ne sme biti sprejet");
const contractLocal=graph.materializeSelection(1022,"pogajanje",[],{batchIndex:1,answers:[]});
const contractBatch={source:"local-graph",state:"ask",actionCode:"pogajanje",profileId:1022,id:contractLocal.id,index:1,title:contractLocal.title,rationale:contractLocal.rationale,evidence:"pogodbo",interfaceId:"atena:section:test-contract",contextVersion:"atena-interface-context-v3",questions:contractLocal.questions};
let contractSession=engine.create("Preverite pogodbo",contractBatch);
assert.deepEqual(contractSession.questionIds,["q:contract:has-timing"],"pogojna podvprašanja morajo biti sprva skrita");
contractSession=engine.answer(contractSession,"q:contract:has-timing",{source:"widget",value:["yes"]});
assert.deepEqual(contractSession.questionIds,["q:contract:has-timing","q:contract:effective-date","q:contract:notice-period"]);
contractSession=engine.answer(contractSession,"q:contract:notice-period",{source:"widget",value:["3","months"]});
assert.equal(contractSession.status,"batch-ready","pri vprašanju datum ali rok zadošča vsaj eden");
assert.deepEqual(contractSession.factsByKey["contract.noticePeriod"],{amount:3,unit:"months"});
contractSession=engine.answer(contractSession,"q:contract:has-timing",{source:"widget",value:["unknown"]});
assert.deepEqual(contractSession.questionIds,["q:contract:has-timing","q:contract:evidence"]);
assert.equal(contractSession.answersByQuestionId["q:contract:notice-period"],undefined,"skrit odgovor se mora odstraniti");
contractSession=engine.answer(contractSession,"q:contract:evidence",{source:"free-text",rawText:"Pogodba v priponki"});
assert.equal(contractSession.status,"batch-ready");

console.log("Atena dynamic batches: OK (2/3/4, typed values, local dependencies, cleanup, review)");
