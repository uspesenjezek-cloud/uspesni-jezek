"use strict";

var crypto = require("node:crypto");
var catalog = require("../../app/svetovalec-atena-engine");
var capabilities = require("../../app/svetovalec-capability-catalog");
var guidedQuestions = require("../../app/svetovalec-guided-question-catalog");
var lunaPolicy = require("./atena-luna-policy");
var MODEL = lunaPolicy.MODEL;
var MAX_TEXT_LENGTH = lunaPolicy.MAX_SOURCE_TEXT_LENGTH;
var ENGINE_VERSION = "atena-svetovalec-luna-v3";
var CONTRACT_VERSION = catalog.contractVersion;
var SERVICE_IDS = catalog.services.map(function (service) { return service.id; });
var AREA_CODES = Array.from(new Set(catalog.services.reduce(function (all, service) { return all.concat(service.areas.map(function (area) { return area.code; })); }, [])));
var MODULE_IDS = Array.from(new Set(catalog.lunaContract().cards.map(function (card) { return card.moduleId; })));
var FIELD_IDS = Array.from(new Set(catalog.lunaContract().cards.reduce(function (all, card) { return all.concat(card.fieldIds); }, [])));
var CLARIFICATION_IDS = catalog.clarificationEngine.ids;
var CLARIFICATION_WIDGET_IDS = catalog.clarificationEngine.widgetIds;
var ACTION_CODES = capabilities.actions.map(function(item){return item.code;});
var PROFILE_IDS = capabilities.profiles.map(function(item){return item.profileId;});
var GUIDED_QUESTION_IDS = guidedQuestions.allQuestionIds;

var RESPONSE_SCHEMA = {
  type:"object", additionalProperties:false, required:["selections","facts","clarification","guidedPlan"], properties:{
    selections:{type:"array",maxItems:3,items:{type:"object",additionalProperties:false,required:["serviceId","areaCode","moduleIds","evidence"],properties:{
      serviceId:{type:"integer",enum:SERVICE_IDS}, areaCode:{type:"string",enum:AREA_CODES},
      moduleIds:{type:"array",minItems:1,maxItems:15,items:{type:"integer",enum:MODULE_IDS}},
      evidence:{type:"string",minLength:1,maxLength:180}
    }}},
    facts:{type:"array",maxItems:50,items:{type:"object",additionalProperties:false,required:["serviceId","fieldId","value","evidence"],properties:{
      serviceId:{type:"integer",enum:SERVICE_IDS},fieldId:{type:"integer",enum:FIELD_IDS},value:{type:"string",minLength:1,maxLength:500},evidence:{type:"string",minLength:1,maxLength:180}
    }}},
    clarification:{anyOf:[
      {type:"object",additionalProperties:false,required:["mode","clarificationId","widgetId","question","evidence"],properties:{
        mode:{type:"string",enum:["widget","conversation"]},
        clarificationId:{anyOf:[{type:"string",enum:CLARIFICATION_IDS},{type:"null"}]},
        widgetId:{anyOf:[{type:"string",enum:CLARIFICATION_WIDGET_IDS},{type:"null"}]},
        question:{anyOf:[{type:"string",minLength:1,maxLength:180},{type:"null"}]},
        evidence:{type:"string",maxLength:180}
      }},
      {type:"null"}
    ]},
    guidedPlan:{anyOf:[
      {type:"object",additionalProperties:false,required:["actionCode","profileId","questionIds","firstQuestionId","evidence"],properties:{
        actionCode:{type:"string",enum:ACTION_CODES},profileId:{anyOf:[{type:"integer",enum:PROFILE_IDS},{type:"null"}]},
        questionIds:{type:"array",minItems:3,maxItems:24,items:{type:"string",enum:GUIDED_QUESTION_IDS}},
        firstQuestionId:{type:"string",enum:GUIDED_QUESTION_IDS},evidence:{type:"string",minLength:1,maxLength:180}
      }},
      {type:"null"}
    ]}
  }
};
lunaPolicy.assertPortableResponseSchema(RESPONSE_SCHEMA);

function cleanText(value, max) { return String(value == null ? "" : value).trim().slice(0, max); }
function cleanCompany(value) {
  value = value && typeof value === "object" ? value : {};
  return {
    name:cleanText(value.name,120),
    activities:Array.isArray(value.activities) ? value.activities.slice(0,12).map(function(item){return cleanText(item,120);}).filter(Boolean) : [],
    role:cleanText(value.role,120), relationship:cleanText(value.relationship,120), collaboration:cleanText(value.collaboration,120), contact:cleanText(value.contact,120)
  };
}
function cleanAttachment(value) {
  if(!value || typeof value!=="object") return null;
  var size=Number(value.size);
  return {name:cleanText(value.name,180),type:cleanText(value.type,120),size:Number.isFinite(size)&&size>=0?Math.round(size):0,contentAvailable:false};
}
function validateGuidedPlan(value,sourceText){
  if(!value||typeof value!=="object")return null;
  var keys=Object.keys(value).sort().join("|"),expected=["actionCode","evidence","firstQuestionId","profileId","questionIds"].sort().join("|");
  if(keys!==expected||!ACTION_CODES.includes(value.actionCode)||!(value.profileId===null||PROFILE_IDS.includes(value.profileId))||!Array.isArray(value.questionIds))return null;
  var ids=value.questionIds.map(String),unique=Array.from(new Set(ids)),evidence=cleanText(value.evidence,180);
  if(ids.length<3||ids.length>24||unique.length!==ids.length||ids[0]!==value.firstQuestionId||ids[ids.length-1]!=="review:confirm"||value.firstQuestionId==="review:confirm"||evidence.length<3||String(sourceText).indexOf(evidence)<0)return null;
  var seed={actionCode:value.actionCode,actionConfidence:999,profileId:value.profileId,profileConfidence:value.profileId?999:0,profileCandidates:value.profileId?[value.profileId]:[]};
  var allowed=new Set(guidedQuestions.allowedQuestionIds(seed));
  if(ids.some(function(id){return !allowed.has(id);}))return null;
  return Object.freeze({source:"luna",actionCode:value.actionCode,profileId:value.profileId,questionIds:Object.freeze(ids),firstQuestionId:value.firstQuestionId,evidence:evidence});
}
function requestBody(sourceText, context, userId) {
  context=context||{};
  var clarificationAnswer=context.clarificationAnswer&&typeof context.clarificationAnswer==="object"
    ? catalog.clarificationEngine.answer(context.clarificationAnswer.clarificationId,Array.isArray(context.clarificationAnswer.optionIds)&&context.clarificationAnswer.optionIds.length?context.clarificationAnswer.optionIds:context.clarificationAnswer.optionId)
    : null;
  var compactCatalog=clarificationAnswer ? catalog.lunaContract({serviceCodes:clarificationAnswer.serviceCodes}) : catalog.lunaContract();
  return Object.assign(lunaPolicy.requestDefaults(),{
    prompt_cache_key:"atena-advisor:"+ENGINE_VERSION+":"+MODEL,
    safety_identifier:"advisor-"+crypto.createHash("sha256").update(String(userId||"anonymous")).digest("hex").slice(0,32),
    reasoning:{effort:"medium"},
    instructions:[
      "You are Luna, the sole semantic interpreter inside Atena's Slovenian advisor entry flow.", lunaPolicy.semanticAuthorityInstructions(),
      "Read the entire description and the complete service, area, module and field catalog before choosing IDs.",
      "Choose one to three distinct service-and-area selections for independent intents. A service may repeat only when the source independently supports different areas. Include every directly supported module in each selected area.",
      "Understand Slovenian, German, colloquial wording, inflection and typos compositionally; examples are not keyword rules.",
      "Every selection and fact evidence must be the shortest exact contiguous substring copied from sourceText. Company and attachment metadata are context only and never evidence.",
      "A filename is never document content. Never infer document meaning from attachment name, MIME type or size.",
      "Return a fact only when its field belongs to the selected service and its value is explicit. All facts are drafts requiring human review.",
      "For a field with allowedValues, value must be exactly one allowedValues.id, never its localized label or a synonym.",
      "Never invent IDs, values, prices, deadlines, consent or external actions. Atena may only navigate to existing review forms.",
      "You decide the guided steps. When the intent is sufficiently clear, return guidedPlan with the smallest ordered set of relevant question IDs from guidedQuestions. Include a conditional follow-up whenever its showWhen predicate could be triggered by an answer to an earlier planned question; the renderer hides it unless that branch is selected. Include review:confirm last. Do not include unrelated service-family questions. firstQuestionId must equal the first questionIds item. The deterministic Nazorjeva engine validates your plan and renders only approved widgets.",
      "If the intended service or material meaning is ambiguous, first choose exactly one matching catalog.clarifications entry and return mode widget with its exact id and widgetId, question null and the shortest exact evidence span. Use mode conversation with both IDs null only when no catalog clarification can safely capture the missing distinction; then ask one concise Slovenian question and include exact evidence when available. Otherwise clarification is null.",
      "Unknown, duplicate, cross-service or cross-area IDs invalidate the complete response."
    ].join(" "),
    input:JSON.stringify({contractVersion:CONTRACT_VERSION,catalog:compactCatalog,guidedQuestions:guidedQuestions.planningManifest(),profiles:capabilities.profiles.map(function(item){return {profileId:item.profileId,label:item.label,familyCode:item.familyCode,description:item.description};}),actions:capabilities.actions.map(function(item){return {code:item.code,label:item.label,intent:item.intent};}),sourceText:sourceText,activeServiceCode:cleanText(context.activeServiceCode,40)||null,clarificationAnswer:clarificationAnswer?{clarificationId:clarificationAnswer.clarificationId,optionId:clarificationAnswer.optionId,optionIds:clarificationAnswer.optionIds,answerText:clarificationAnswer.answerText}:null,company:cleanCompany(context.company),attachment:cleanAttachment(context.attachment)}),
    text:{format:{type:"json_schema",name:"svetovalec_intent_v1",strict:true,schema:RESPONSE_SCHEMA}}
  });
}
function aiError(message,code){var error=new Error(message);error.code=code;error.status=503;error.retryable=true;return error;}
async function analyze(text, context, options) {
  context=context||{}; options=options||{};
  var source=cleanText(text,MAX_TEXT_LENGTH+1);
  if(!source || source.length>MAX_TEXT_LENGTH){var inputError=new Error(source?"Opis je predolg.":"Vpišite, kaj potrebujete.");inputError.code="INVALID_TEXT";inputError.status=400;inputError.retryable=false;throw inputError;}
  var apiKey=Object.prototype.hasOwnProperty.call(options,"apiKey")?options.apiKey:process.env.OPENAI_API_KEY;
  if(!apiKey) throw aiError("Luna trenutno ni konfigurirana.","LUNA_NOT_CONFIGURED");
  var base=requestBody(source,context,options.userId),lastReason="response_invalid",totalAttempts=0,totalElapsedMs=0;
  for(var responseAttempt=1;responseAttempt<=2;responseAttempt+=1){
    var request=Object.assign({},base);
    if(responseAttempt>1) request.instructions += " RESPONSE REPAIR: previous response failed the closed catalog contract ("+lastReason+"). Re-read the unchanged source and emit one complete valid object only.";
    var transport=await lunaPolicy.requestOpenAi({apiKey:apiKey,body:JSON.stringify(request),fetchImpl:options.fetchImpl,timeoutMs:options.timeoutMs,maxAttempts:options.maxAttempts,sleepImpl:options.sleepImpl,randomImpl:options.randomImpl});
    totalAttempts+=transport.attempts;totalElapsedMs+=transport.elapsedMs;
    var proposal=null;try{proposal=JSON.parse(lunaPolicy.responseText(transport.payload));}catch(_error){proposal=null;}
    var core=proposal&&typeof proposal==="object"?{selections:proposal.selections,facts:proposal.facts,clarification:proposal.clarification}:null;
    var result=catalog.validateProposal(core,source),guidedPlan=validateGuidedPlan(proposal&&proposal.guidedPlan,source);
    if(result&&((result.clarification&&proposal.guidedPlan===null)||(!result.clarification&&guidedPlan))) return {selections:result.selections,facts:result.facts,clarification:result.clarification,guidedPlan:guidedPlan,engineVersion:ENGINE_VERSION,contractVersion:CONTRACT_VERSION,model:MODEL,
      semanticPlan:{requested:true,attempted:true,source:"luna_svetovalec_catalog_adapter",status:result.clarification?"CLARIFICATION_REQUIRED":"OK",reason:result.clarification?"luna_advisor_clarification":"luna_advisor_plan_applied",transport:{attempts:totalAttempts,elapsedMs:totalElapsedMs,responseAttempts:responseAttempt,responseRetries:responseAttempt-1},usage:transport.payload&&transport.payload.usage||null}};
    lastReason="catalog_or_evidence_invalid";
  }
  throw aiError("Lunin odgovor ni skladen s svetovalnim katalogom.","LUNA_INVALID_ADVISOR_PLAN");
}

module.exports={MODEL:MODEL,MAX_TEXT_LENGTH:MAX_TEXT_LENGTH,ENGINE_VERSION:ENGINE_VERSION,CONTRACT_VERSION:CONTRACT_VERSION,RESPONSE_SCHEMA:RESPONSE_SCHEMA,requestBody:requestBody,analyze:analyze,_test:{cleanCompany:cleanCompany,cleanAttachment:cleanAttachment,validateProposal:catalog.validateProposal,validateGuidedPlan:validateGuidedPlan,catalog:catalog}};
