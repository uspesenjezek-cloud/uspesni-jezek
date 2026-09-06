"use strict";

var crypto=require("node:crypto");
var z=require("zod").z;
var capabilities=require("../../app/svetovalec-capability-catalog");
var knowledge=require("../../app/svetovalec-service-knowledge-blocks");
var questionGraph=require("../../app/svetovalec-question-graph");
var lunaPolicy=require("./atena-luna-policy");
var errorKnowledge=require("./atena-luna-error-knowledge");
var structuredContracts=require("./atena-structured-contracts");
var MODEL=lunaPolicy.MODEL;
var MAX_TEXT_LENGTH=lunaPolicy.MAX_SOURCE_TEXT_LENGTH;
var ENGINE_VERSION="atena-svetovalec-luna-block-router-v2";
var CONTRACT_VERSION="svetovalec-intent-contract-v2";
var ACTION_CODES=capabilities.actions.map(function(item){return item.code;});
var PROFILE_IDS=capabilities.profiles.map(function(item){return item.profileId;});
var BLOCK_CODES=knowledge.blocks.map(function(item){return item.promptCode;});
var RESPONSE_ZOD_SCHEMA=structuredContracts.advisorBlockPlanSchema(ACTION_CODES,PROFILE_IDS,BLOCK_CODES);
var RESPONSE_SCHEMA=structuredContracts.compactJsonSchema(z.toJSONSchema(RESPONSE_ZOD_SCHEMA));delete RESPONSE_SCHEMA.$schema;
lunaPolicy.assertPortableResponseSchema(RESPONSE_SCHEMA);

function cleanText(value,max){return String(value==null?"":value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,"").trim().slice(0,max);}
function cleanCompany(value){value=value&&typeof value==="object"?value:{};return {name:cleanText(value.name,120),activities:Array.isArray(value.activities)?value.activities.slice(0,8).map(function(item){return cleanText(item,100);}).filter(Boolean):[],relationship:cleanText(value.relationship,100),collaboration:cleanText(value.collaboration,100)};}
function cleanAttachment(value){if(!value||typeof value!=="object")return null;var size=Number(value.size);return {name:cleanText(value.name,180),type:cleanText(value.type,120),size:Number.isFinite(size)&&size>=0?Math.round(size):0,contentAvailable:false};}
function cleanConversation(value){value=value&&typeof value==="object"?value:{};var answers=Array.isArray(value.answers)?value.answers.slice(0,16):[];return {sessionId:cleanText(value.sessionId,100),revision:Math.max(0,Math.min(100,Number(value.revision)||0)),batchIndex:Math.max(0,Math.min(4,Number(value.batchIndex)||0)),actionCode:cleanText(value.actionCode,40),profileId:Number(value.profileId)||null,answers:answers.map(function(answer){answer=answer&&typeof answer==="object"?answer:{};return {semanticKey:cleanText(answer.semanticKey,80),factKey:cleanText(answer.factKey,80),selectedValues:Array.isArray(answer.selectedValues)?answer.selectedValues.slice(0,4).map(function(item){return cleanText(item,120);}).filter(Boolean):[],ownAnswer:cleanText(answer.ownAnswer,500)};}).filter(function(answer){return answer.semanticKey&&answer.factKey;})};}
function stableId(prefix,value){return prefix+crypto.createHash("sha256").update(ENGINE_VERSION+":"+value).digest("hex").slice(0,16);}
function safeId(value){return String(value).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}

function validatePlan(value,sourceText,conversation){
  var parsed=RESPONSE_ZOD_SCHEMA.safeParse(value);if(!parsed.success)return null;value=parsed.data;
  if(value.profileId!==null){try{knowledge.resolveSelection(value.profileId,value.actionCode,value.blockCodes);}catch(_error){return null;}}
  var evidence=cleanText(value.evidence,180),title=cleanText(value.batchTitle,100),rationale=cleanText(value.rationale,240);if(evidence.length<3||String(sourceText).indexOf(evidence)<0||title.length<3||rationale.length<3)return null;
  if(value.state==="review")return Object.freeze({questionBatch:Object.freeze({source:"local-graph",graphVersion:questionGraph.version,state:"review",actionCode:value.actionCode,profileId:value.profileId,id:stableId("local-review-",title),index:Number(conversation&&conversation.batchIndex)||0,title:title,rationale:rationale,evidence:evidence,interfaceId:"atena:section:svetovalec:review",contextVersion:"atena-interface-context-v3",questions:Object.freeze([])}),blockCodes:Object.freeze([])});
  if(value.profileId===null)return null;var local;try{local=questionGraph.materializeSelection(value.profileId,value.actionCode,value.blockCodes,conversation);}catch(_error){return null;}if(!local.questions.length)return null;
  var batch=Object.freeze({source:"local-graph",graphVersion:questionGraph.version,state:"ask",actionCode:value.actionCode,profileId:value.profileId,id:local.id,index:Number(conversation&&conversation.batchIndex)||0,title:local.title||title,rationale:local.rationale||rationale,evidence:evidence,interfaceId:"atena:section:svetovalec:"+safeId(local.id),contextVersion:"atena-interface-context-v3",questions:Object.freeze(local.questions)});
  return Object.freeze({questionBatch:batch,blockCodes:Object.freeze(value.blockCodes.slice())});
}

function localContinuation(sourceText,conversation){
  var actionCode=conversation.actionCode,profileId=conversation.profileId,batchIndex=conversation.batchIndex;
  if(batchIndex<1||!ACTION_CODES.includes(actionCode)||!PROFILE_IDS.includes(profileId))return null;
  var evidence=cleanText(sourceText,180);
  if(batchIndex>=4)return {selections:[],facts:[],clarification:null,questionBatch:Object.freeze({source:"local-graph",graphVersion:questionGraph.version,state:"review",actionCode:actionCode,profileId:profileId,id:stableId("local-review-",String(profileId)+":"+actionCode),index:batchIndex,title:"Poglejte predogled",rationale:"Zaključeni so vsi lokalni vsebinski sklopi.",evidence:evidence,interfaceId:"atena:section:svetovalec:review",contextVersion:"atena-interface-context-v3",questions:Object.freeze([])}),blockCodes:[],engineVersion:ENGINE_VERSION,contractVersion:CONTRACT_VERSION,model:"local",semanticPlan:{requested:false,attempted:false,source:"local_question_graph",status:"REVIEW_READY",reason:"local_batches_complete",transport:{attempts:0,elapsedMs:0,responseAttempts:0,responseRetries:0},usage:null}};
  var ids=(knowledge.actionBlueprints[actionCode]||[]).slice(0,4),blockCodes=ids.map(function(id){return knowledge.blockById[id].promptCode;}),local=questionGraph.materializeSelection(profileId,actionCode,blockCodes,conversation);
  if(!local||!local.questions||local.questions.length<3||local.questions.length>4)return null;
  return {selections:[],facts:[],clarification:null,questionBatch:Object.freeze({source:"local-graph",graphVersion:questionGraph.version,state:"ask",actionCode:actionCode,profileId:profileId,id:local.id,index:batchIndex,title:local.title,rationale:local.rationale,evidence:evidence,interfaceId:"atena:section:svetovalec:"+safeId(local.id),contextVersion:"atena-interface-context-v3",questions:Object.freeze(local.questions)}),blockCodes:Object.freeze(blockCodes),engineVersion:ENGINE_VERSION,contractVersion:CONTRACT_VERSION,model:"local",semanticPlan:{requested:false,attempted:false,source:"local_question_graph",status:"OK",reason:"local_continuation_materialized",transport:{attempts:0,elapsedMs:0,responseAttempts:0,responseRetries:0},usage:null}};
}

function requestBody(sourceText,context,userId){
  context=context||{};var conversation=cleanConversation(context.conversation),defaults=lunaPolicy.requestDefaults("advisor");
  return Object.assign(defaults,{prompt_cache_key:"atena-advisor:"+ENGINE_VERSION+":"+MODEL,safety_identifier:"advisor-"+crypto.createHash("sha256").update(String(userId||"anonymous")).digest("hex").slice(0,32),
    max_output_tokens:450,
    instructions:["You are Luna, the semantic router for Atena's Slovenian business advisor.",errorKnowledge.promptContext("advisor"),"Infer one actionCode and the best profileId from the complete message. Preserve conditions and fallback actions such as negotiate-or-cancel.","Select only 1-4 allowed blockCodes containing the highest-value missing facts.","Return no questions, labels, answer options, widget IDs, facts, prices, dates or legal conclusions.","The local question graph owns every question, answer hypothesis, consequence and widget.","Use state review with empty blockCodes only when confirmed conversation facts are sufficient.","Evidence is the shortest exact contiguous substring copied from sourceText. Never invent IDs. Return one schema object without commentary."].join(" "),
    input:JSON.stringify({contractVersion:CONTRACT_VERSION,operatingModel:knowledge.compactOperatingModel(),limits:{blockCodes:[1,4],maxBatches:4},activeServiceCode:cleanText(context.activeServiceCode,40)||null,conversation:conversation,company:cleanCompany(context.company),attachment:cleanAttachment(context.attachment),sourceText:sourceText}),
    text:{verbosity:"low",format:{type:"json_schema",name:"svetovalec_block_router_v2",strict:true,schema:RESPONSE_SCHEMA}}
  });
}
function aiError(message,code,retryable){var error=new Error(message);error.code=code;error.status=503;error.retryable=retryable===true;return error;}
async function analyze(text,context,options){
  context=context||{};options=options||{};var source=cleanText(text,MAX_TEXT_LENGTH+1);if(!source||source.length>MAX_TEXT_LENGTH){var inputError=new Error(source?"Opis je predolg.":"Vpišite, kaj potrebujete.");inputError.code="INVALID_TEXT";inputError.status=400;inputError.retryable=false;throw inputError;}
  var conversation=cleanConversation(context.conversation),continuation=localContinuation(source,conversation);if(continuation)return continuation;
  var apiKey=Object.prototype.hasOwnProperty.call(options,"apiKey")?options.apiKey:process.env.OPENAI_API_KEY;if(!apiKey)throw aiError("Luna trenutno ni konfigurirana.","LUNA_NOT_CONFIGURED",false);
  var request=requestBody(source,context,options.userId),profile=lunaPolicy.requestProfile("advisor");
  var transport=await lunaPolicy.requestOpenAi({apiKey:apiKey,body:JSON.stringify(request),fetchImpl:options.fetchImpl,timeoutMs:options.timeoutMs==null?profile.timeoutMaxMs:options.timeoutMs,maxAttempts:options.maxAttempts==null?1:options.maxAttempts,sleepImpl:options.sleepImpl,randomImpl:options.randomImpl});
  var proposal=null;try{proposal=JSON.parse(lunaPolicy.responseText(transport.payload));}catch(_error){proposal=null;}
  var result=validatePlan(proposal,source,context.conversation);if(!result)throw aiError("Lunin načrt ni bil veljaven. Poskusite znova.","LUNA_INVALID_ADVISOR_PLAN",true);
  return {selections:[],facts:[],clarification:null,questionBatch:result.questionBatch,blockCodes:result.blockCodes,engineVersion:ENGINE_VERSION,contractVersion:CONTRACT_VERSION,model:MODEL,semanticPlan:{requested:true,attempted:true,source:"luna_svetovalec_block_router",status:result.questionBatch.state==="review"?"REVIEW_READY":"OK",reason:result.questionBatch.state==="review"?"luna_advisor_review_ready":"luna_advisor_block_plan_applied",transport:{attempts:transport.attempts,elapsedMs:transport.elapsedMs,responseAttempts:1,responseRetries:0},usage:transport.payload&&transport.payload.usage||null}};
}

module.exports={MODEL:MODEL,MAX_TEXT_LENGTH:MAX_TEXT_LENGTH,ENGINE_VERSION:ENGINE_VERSION,CONTRACT_VERSION:CONTRACT_VERSION,RESPONSE_SCHEMA:RESPONSE_SCHEMA,RESPONSE_ZOD_SCHEMA:RESPONSE_ZOD_SCHEMA,requestBody:requestBody,analyze:analyze,_test:{cleanCompany:cleanCompany,cleanAttachment:cleanAttachment,cleanConversation:cleanConversation,validatePlan:validatePlan,localContinuation:localContinuation,knowledge:knowledge,questionGraph:questionGraph}};
