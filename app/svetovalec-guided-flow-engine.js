(function (root, factory) {
  var api;
  if (typeof module === "object" && module.exports) api=factory(require("./svetovalec-capability-catalog"),require("./svetovalec-guided-question-catalog"));
  else api=factory(root&&root.UJSvetovalecCapabilityCatalog,root&&root.UJSvetovalecGuidedQuestionCatalog);
  if(typeof module==="object"&&module.exports) module.exports=api;
  if(root) root.UJSvetovalecGuidedFlowEngine=api;
})(typeof window!=="undefined"?window:null,function(capabilities,catalog){
  "use strict";
  var VERSION="svetovalec-guided-flow-v3";
  function copy(v){return JSON.parse(JSON.stringify(v));}
  function now(){return Date.now();}
  function answerValid(question,answer){
    if(!question||!answer||answer.questionId!==question.id) return false;
    if(answer.source==="free-text") return Boolean(String(answer.rawText||"").trim());
    var value=Array.isArray(answer.value)?answer.value:[];
    if(!value.length) return !question.required;
    if(question.valueType){
      if(value.length!==1)return false;
      var raw=String(value[0]).trim();
      if(question.valueType==="number"||question.valueType==="money"){
        var numeric=Number(raw.replace(",","."));
        return Number.isFinite(numeric)&&numeric>=Number(question.minValue==null?0:question.minValue)&&numeric<=Number(question.maxValue==null?Number.MAX_SAFE_INTEGER:question.maxValue);
      }
      if(question.valueType==="date")return /^\d{4}-\d{2}-\d{2}$/.test(raw);
      return Boolean(raw);
    }
    if(question.kind==="multiple"&&value.length<Number(question.minSelections||1)) return false;
    return value.every(function(id){return question.options.some(function(option){return option.id===String(id);});});
  }
  function answerText(question,answer){if(answer.source==="free-text")return answer.rawText;if(question.valueType){var suffix=question.valueType==="money"?" €":question.valueSuffix?" "+question.valueSuffix:"";return answer.value[0]+suffix;}return answer.value.map(function(id){var option=question.options.find(function(item){return item.id===id;});return option?option.label:id;}).join(", ");}
  function factsFrom(question,answer){var facts={};if(answer.source==="free-text"){facts[question.id+":freeText"]=answer.rawText;return facts;}if(question.valueType){var raw=answer.value[0],value=(question.valueType==="number"||question.valueType==="money")?Number(String(raw).replace(",",".")):raw;facts[question.factKey||question.id]=value;return facts;}answer.value.forEach(function(id){var option=question.options.find(function(item){return item.id===id;});if(!option)return;Object.keys(option.facts||{}).forEach(function(key){var value=option.facts[key];if(Array.isArray(value))facts[key]=(facts[key]||[]).concat(value);else facts[key]=value;});});return facts;}
  function compileAnswers(answers,definition){var out={},facts={};Object.keys(answers||{}).forEach(function(id){var question=definition.byId[id],answer=answers[id];if(!answerValid(question,answer))return;out[id]=answer;Object.assign(facts,factsFrom(question,answer));});return {answers:out,facts:facts};}
  function applyLunaPlan(definition,plan){
    if(!plan||!Array.isArray(plan.questionIds)||!plan.questionIds.length)return definition;
    var ids=plan.questionIds.filter(function(id,index,all){return all.indexOf(id)===index&&definition.byId[id];});
    if(definition.byId["review:confirm"]&&ids.indexOf("review:confirm")<0)ids.push("review:confirm");
    var questions=ids.map(function(id){return definition.byId[id];}),byId=questions.reduce(function(out,item){out[item.id]=item;return out;},{});
    var sections=definition.sections.map(function(section){var questionIds=ids.filter(function(id){return byId[id]&&byId[id].sectionId===section.id;});return Object.assign({},section,{questionIds:questionIds});}).filter(function(section){return section.questionIds.length;});
    return {version:definition.version,questions:questions,sections:sections,byId:byId};
  }
  function resolve(session,preferredId){
    var first=applyLunaPlan(catalog.build(session.semanticSeed,session.answersByQuestionId),session.lunaPlan),compiled=compileAnswers(session.answersByQuestionId,first),definition=applyLunaPlan(catalog.build(session.semanticSeed,compiled.answers),session.lunaPlan);compiled=compileAnswers(compiled.answers,definition);
    session.answersByQuestionId=compiled.answers;session.facts=compiled.facts;session.sections=definition.sections;session.questionIds=definition.questions.map(function(q){return q.id;});session.questionById=definition.byId;
    var missing=session.questionIds.find(function(id){return !compiled.answers[id]&&id!=="review:confirm";}),review=compiled.answers["review:confirm"],requested=preferredId&&session.questionIds.indexOf(preferredId)>=0?preferredId:null;
    session.activeQuestionId=requested||missing||"review:confirm";var activeQuestion=definition.byId[session.activeQuestionId];session.activeSectionId=activeQuestion?activeQuestion.sectionId:definition.sections[definition.sections.length-1].id;
    session.status=!missing&&review&&review.value[0]==="da"?"ready":"draft";session.preview=null;session.updatedAt=now();session.completedSectionIds=definition.sections.filter(function(section){return section.questionIds.every(function(id){return id==="review:confirm"||Boolean(compiled.answers[id]);});}).map(function(section){return section.id;});return session;
  }
  function create(sourceText,lunaPlan){var text=String(sourceText||"").trim();if(!text)return null;var inferred=copy(capabilities.infer(text));if(lunaPlan&&lunaPlan.actionCode)inferred.actionCode=lunaPlan.actionCode;if(lunaPlan&&lunaPlan.profileId){inferred.profileId=Number(lunaPlan.profileId);inferred.profileCandidates=[Number(lunaPlan.profileId)];}if(lunaPlan){inferred.actionConfidence=999;inferred.profileConfidence=lunaPlan.profileId?999:0;}return resolve({version:VERSION,catalogVersion:catalog.version,capabilityVersion:capabilities.version,id:"atena-guided-"+now().toString(36),sourceText:text,semanticSeed:inferred,lunaPlan:lunaPlan?copy(lunaPlan):null,answersByQuestionId:{},facts:{},sections:[],questionIds:[],questionById:{},completedSectionIds:[],activeSectionId:null,activeQuestionId:null,status:"draft",preview:null,orphanedAnswers:[],inputModeByQuestionId:{},updatedAt:now()});}
  function answer(value,questionId,input){
    var session=copy(value),question=session.questionById&&session.questionById[questionId];if(!session||!question)return null;var source=input&&input.source==="free-text"?"free-text":"widget",valueIds=source==="widget"?(Array.isArray(input)?input:Array.isArray(input&&input.value)?input.value:[input&&input.value]).filter(Boolean).map(String):[];
    var next={questionId:question.id,revision:question.revision,kind:question.kind,source:source,value:valueIds,rawText:source==="free-text"?String(input.rawText||"").trim():"",updatedAt:now()};if(!answerValid(question,next))return null;
    var previous=session.answersByQuestionId[question.id],oldFacts=previous?factsFrom(question,previous):{};session.answersByQuestionId[question.id]=next;var changed=JSON.stringify(oldFacts)!==JSON.stringify(factsFrom(question,next)),oldIds=session.questionIds.slice();session=resolve(session);
    if(changed){var still=new Set(session.questionIds);session.orphanedAnswers=(session.orphanedAnswers||[]).concat(oldIds.filter(function(id){return !still.has(id)&&value.answersByQuestionId&&value.answersByQuestionId[id];}).map(function(id){return value.answersByQuestionId[id];}));}
    var index=session.questionIds.indexOf(question.id),nextId=session.questionIds.slice(index+1).find(function(id){return !session.answersByQuestionId[id];});if(nextId)session=resolve(session,nextId);return session;
  }
  function goTo(value,questionId){var session=copy(value);if(!session||session.questionIds.indexOf(questionId)<0)return null;var targetIndex=session.questionIds.indexOf(questionId),firstMissing=session.questionIds.findIndex(function(id){return !session.answersByQuestionId[id];});if(firstMissing>=0&&targetIndex>firstMissing)return null;return resolve(session,questionId);}
  function openFreeText(value,questionId){var session=copy(value);if(!session.questionById[questionId]||!session.questionById[questionId].allowFreeText)return null;session.inputModeByQuestionId[questionId]="free-text";return session;}
  function closeFreeText(value,questionId){var session=copy(value);delete session.inputModeByQuestionId[questionId];return session;}
  function buildPreview(value){var session=copy(value);if(!session||session.status!=="ready")return null;var rows=session.questionIds.filter(function(id){return id!=="review:confirm"&&session.answersByQuestionId[id];}).map(function(id){var question=session.questionById[id],answer=session.answersByQuestionId[id];return {questionId:id,question:question.question,answer:answerText(question,answer),source:answer.source};}),actionCode=session.facts.actionCode||session.semanticSeed.actionCode||"ponudba";session.preview={createdAt:now(),rows:rows,serviceCodes:[actionCode],profileId:session.facts.profileId||session.semanticSeed.profileId||null};session.status="preview";session.updatedAt=now();return session;}
  function backToAnswers(value){var session=copy(value);if(!session||session.status!=="preview")return null;session.status="ready";session.preview=null;session.activeQuestionId="review:confirm";return session;}
  function confirm(value){var session=copy(value);if(!session||session.status!=="preview"||!session.preview)return null;session.status="confirmed";session.updatedAt=now();return session;}
  function restore(raw){var value;try{value=typeof raw==="string"?JSON.parse(raw):copy(raw);}catch(_e){return {status:"rejected",session:null,warnings:["Shranjeni pogovor ni veljaven JSON."]};}if(!value||value.version!==VERSION||!value.sourceText)return {status:"rejected",session:null,warnings:["Shranjeni pogovor uporablja nezdružljivo različico."]};var session=resolve(value,value.activeQuestionId);if(value.status==="preview"&&value.preview){session.preview=value.preview;session.status="preview";}return {status:"restored",session:session,warnings:[]};}
  function completionGate(value){var missing=value.questionIds.filter(function(id){return id!=="review:confirm"&&!value.answersByQuestionId[id];});return {complete:!missing.length,blockers:missing,nextQuestionId:missing[0]||"review:confirm"};}
  return Object.freeze({version:VERSION,create:create,resolve:resolve,answer:answer,goTo:goTo,openFreeText:openFreeText,closeFreeText:closeFreeText,buildPreview:buildPreview,backToAnswers:backToAnswers,confirm:confirm,restore:restore,completionGate:completionGate,serialize:function(value){return JSON.stringify(value);}});
});
