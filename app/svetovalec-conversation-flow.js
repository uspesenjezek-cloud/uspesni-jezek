(function (root, factory) {
  var api;
  if (typeof module === "object" && module.exports) {
    api = factory(require("./svetovalec-clarification-engine"));
    module.exports = api;
  } else api = factory(root && root.UJSvetovalecClarificationEngine);
  if (root) root.UJSvetovalecConversationFlow = api;
})(typeof window !== "undefined" ? window : null, function (clarifications) {
  "use strict";

  var VERSION = "svetovalec-conversation-flow-v1";
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function validAnswer(answer, expectedId) {
    if (!answer || answer.clarificationId !== expectedId) return null;
    return clarifications.answer(expectedId, Array.isArray(answer.optionIds) && answer.optionIds.length ? answer.optionIds : answer.optionId);
  }
  function rebuild(session, answers, preferredIndex) {
    var valid = [];
    var ids = clarifications.plan(session.initialClarificationId, answers);
    ids.forEach(function (id) {
      var candidate = answers.find(function (entry) { return entry && entry.clarificationId === id; });
      var normalized = validAnswer(candidate, id);
      if (normalized) valid.push(normalized);
    });
    ids = clarifications.plan(session.initialClarificationId, valid);
    valid = valid.filter(function (entry) { return ids.indexOf(entry.clarificationId) >= 0; });
    var firstMissing = ids.findIndex(function (id) { return !valid.some(function (entry) { return entry.clarificationId === id; }); });
    var ready = firstMissing < 0;
    session.planIds = ids.slice();
    session.answers = copy(valid);
    session.activeStepIndex = Math.max(0, Math.min(Number.isInteger(preferredIndex) ? preferredIndex : (ready ? ids.length - 1 : firstMissing), ids.length - 1));
    session.status = ready ? "ready" : "draft";
    session.result = null;
    session.updatedAt = Date.now();
    return session;
  }
  function create(sourceText, initialClarificationId) {
    var id = String(initialClarificationId || "");
    if (!clarifications.byId[id]) return null;
    return rebuild({ version:VERSION, id:"atena-flow-" + Date.now().toString(36), sourceText:String(sourceText || "").trim(), initialClarificationId:id, planIds:[], answers:[], activeStepIndex:0, status:"draft", result:null, updatedAt:Date.now() }, [], 0);
  }
  function answerStep(value, stepIndex, optionIds) {
    var session = copy(value), index = Number(stepIndex);
    if (!session || !Number.isInteger(index) || index < 0 || index >= session.planIds.length) return null;
    var id = session.planIds[index], answer = clarifications.answer(id, optionIds);
    if (!answer) return null;
    var previous = session.answers.find(function (entry) { return entry.clarificationId === id; });
    var changed = !previous || JSON.stringify(previous.optionIds) !== JSON.stringify(answer.optionIds);
    var kept = session.answers.filter(function (entry) {
      var entryIndex = session.planIds.indexOf(entry.clarificationId);
      return entryIndex < index || (!changed && entryIndex > index);
    });
    kept.push(answer);
    return rebuild(session, kept, changed ? index + 1 : undefined);
  }
  function goTo(value, stepIndex) {
    var session = copy(value), index = Number(stepIndex);
    if (!session || !Number.isInteger(index) || index < 0 || index >= session.planIds.length) return null;
    var firstMissing = session.planIds.findIndex(function (id) { return !session.answers.some(function (entry) { return entry.clarificationId === id; }); });
    if (firstMissing >= 0 && index > firstMissing) return null;
    session.activeStepIndex = index;
    if (session.status === "preview") { session.status = "ready"; session.result = null; }
    session.updatedAt = Date.now(); return session;
  }
  function preview(value, result) {
    var session = copy(value);
    var hasResult = result && ((Array.isArray(result.selections) && result.selections.length) || (Array.isArray(result.serviceCodes) && result.serviceCodes.length));
    if (!session || session.status !== "ready" || !hasResult) return null;
    session.status = "preview"; session.result = copy(result); session.activeStepIndex = Math.max(0, session.planIds.length - 1); session.updatedAt = Date.now(); return session;
  }
  function backToAnswers(value) {
    var session = copy(value);
    if (!session || session.status !== "preview") return null;
    session.status = "ready"; session.result = null; session.activeStepIndex = Math.max(0, session.planIds.length - 1); session.updatedAt = Date.now(); return session;
  }
  function confirm(value) {
    var session = copy(value);
    if (!session || session.status !== "preview" || !session.result) return null;
    session.status = "confirmed"; session.updatedAt = Date.now(); return session;
  }
  function restore(raw) {
    var value; try { value = typeof raw === "string" ? JSON.parse(raw) : copy(raw); } catch (_error) { return null; }
    if (!value || value.version !== VERSION || !clarifications.byId[value.initialClarificationId] || !String(value.sourceText || "").trim()) return null;
    var session = rebuild({ version:VERSION, id:String(value.id || "atena-flow-restored"), sourceText:String(value.sourceText), initialClarificationId:value.initialClarificationId, planIds:[], answers:[], activeStepIndex:0, status:"draft", result:null, updatedAt:Date.now() }, Array.isArray(value.answers) ? value.answers : [], Number(value.activeStepIndex));
    if (value.status === "preview" && value.result) return preview(session, value.result) || session;
    return session;
  }
  return Object.freeze({ version:VERSION, create:create, answerStep:answerStep, goTo:goTo, preview:preview, backToAnswers:backToAnswers, confirm:confirm, restore:restore, serialize:function (value) { return JSON.stringify(value); } });
});

/* v2 adapter: stari javni vhod ostane, stanje pa vodi deklarativni motor sklopov. */
(function(root,factory){
  var guided=null,dynamic=null;
  if(typeof module==="object"&&module.exports){guided=require("./svetovalec-guided-flow-engine");dynamic=require("./svetovalec-dynamic-batch-engine");}
  else {guided=root&&root.UJSvetovalecGuidedFlowEngine;dynamic=root&&root.UJSvetovalecDynamicBatchEngine;}
  if(!guided)return;
  var api=factory(guided,dynamic);
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.UJSvetovalecConversationFlow=api;
})(typeof window!=="undefined"?window:null,function(engine,dynamic){
  "use strict";
  function decorate(session){
    if(!session)return null;
    session.planIds=session.questionIds.slice();
    session.activeStepIndex=Math.max(0,session.questionIds.indexOf(session.activeQuestionId));
    session.answers=session.questionIds.map(function(id){
      var a=session.answersByQuestionId[id],q=session.questionById[id];if(!a)return null;
      return {clarificationId:id,questionId:id,optionIds:a.value||[],answerText:a.source==="free-text"?a.rawText:(a.value||[]).map(function(v){var o=q.options.find(function(x){return x.id===v;});return o?o.label:v;}).join(", "),source:a.source,rawText:a.rawText||"",serviceCodes:[]};
    }).filter(Boolean);
    session.result=session.preview?{serviceCodes:session.preview.serviceCodes,selections:session.preview.rows}:null;
    return session;
  }
  return Object.freeze({
    version:dynamic?dynamic.version:engine.version,engine:engine,dynamicEngine:dynamic,
    create:function(text,lunaPlan){return decorate(dynamic&&lunaPlan&&Array.isArray(lunaPlan.questions)?dynamic.create(text,lunaPlan):engine.create(text,lunaPlan));},
    appendBatch:function(value,batch){return decorate(dynamic&&value&&value.version===dynamic.version?dynamic.appendBatch(value,batch):null);},
    setReplanning:function(value){return decorate(dynamic&&value&&value.version===dynamic.version?dynamic.setReplanning(value):null);},
    conversationContext:function(value){return dynamic&&value&&value.version===dynamic.version?dynamic.conversationContext(value):null;},
    answerStep:function(value,index,input){var active=value&&dynamic&&value.version===dynamic.version?dynamic:engine,id=value.questionIds[Number(index)];return decorate(active.answer(value,id,input&&input.source?input:{value:input}));},
    answerQuestion:function(value,id,input){var active=value&&dynamic&&value.version===dynamic.version?dynamic:engine;return decorate(active.answer(value,id,input));},
    goTo:function(value,index){var active=value&&dynamic&&value.version===dynamic.version?dynamic:engine;return decorate(active.goTo(value,value.questionIds[Number(index)]));},
    goToQuestion:function(value,id){var active=value&&dynamic&&value.version===dynamic.version?dynamic:engine;return decorate(active.goTo(value,id));},
    openFreeText:function(value,id){var active=value&&dynamic&&value.version===dynamic.version?dynamic:engine;return decorate(active.openFreeText(value,id));},
    closeFreeText:function(value,id){var active=value&&dynamic&&value.version===dynamic.version?dynamic:engine;return decorate(active.closeFreeText(value,id));},
    preview:function(value){var active=value&&dynamic&&value.version===dynamic.version?dynamic:engine;return decorate(active.buildPreview(value));},
    backToAnswers:function(value){var active=value&&dynamic&&value.version===dynamic.version?dynamic:engine;return decorate(active.backToAnswers(value));},
    confirm:function(value){var active=value&&dynamic&&value.version===dynamic.version?dynamic:engine;return decorate(active.confirm(value));},
    restore:function(raw){var value=null;try{value=typeof raw==="string"?JSON.parse(raw):raw;}catch(_error){}if(dynamic&&value&&value.version===dynamic.version)return decorate(dynamic.restore(value));var restored=engine.restore(raw);return restored&&restored.session?decorate(restored.session):null;},
    serialize:function(value){return JSON.stringify(value);}
  });
});
