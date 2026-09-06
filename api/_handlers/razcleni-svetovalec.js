"use strict";

var crypto=require("node:crypto");
var db=require("../_lib/supabase-server");
var localPreviewAuth=require("../_lib/atena-local-preview-auth");
var lunaPolicy=require("../_lib/atena-luna-policy");
var engine=require("../_lib/svetovalec-luna-block-router");
var ugotovitveEngine=require("../../app/svetovalec-preverba-ugotovitve-engine");
var WINDOW_MS=60000,CACHE_TTL_MS=300000,MAX_REQUESTS=lunaPolicy.REQUESTS_PER_MINUTE;
var runtime=lunaPolicy.ensureIdempotencyRuntime(globalThis.__ujAdvisorAiRuntime||{users:new Map(),cache:new Map(),inflight:new Map()});
globalThis.__ujAdvisorAiRuntime=runtime;

function validRequestId(value){return /^[a-zA-Z0-9][a-zA-Z0-9:_-]{15,99}$/.test(String(value||""));}
function cleanContext(body){
  var attachment=body.attachment&&typeof body.attachment==="object"?{name:String(body.attachment.name||"").slice(0,180),type:String(body.attachment.type||"").slice(0,120),size:Number(body.attachment.size)||0}:null;
  var company=body.company&&typeof body.company==="object"?body.company:{};
  var answer=body.clarificationAnswer&&typeof body.clarificationAnswer==="object"?body.clarificationAnswer:{};
  var optionIds=Array.isArray(answer.optionIds)?answer.optionIds.slice(0,12).map(function(value){return String(value||"").slice(0,80);}).filter(Boolean):[];
  var conversation=body.conversation&&typeof body.conversation==="object"?body.conversation:{};
  var conversationAnswers=Array.isArray(conversation.answers)?conversation.answers.slice(0,16).map(function(entry){
    entry=entry&&typeof entry==="object"?entry:{};
    return {semanticKey:String(entry.semanticKey||"").slice(0,80),factKey:String(entry.factKey||"").slice(0,80),question:String(entry.question||"").slice(0,180),selectedOptionIds:Array.isArray(entry.selectedOptionIds)?entry.selectedOptionIds.slice(0,4).map(function(value){return String(value||"").slice(0,40);}):[],selectedValues:Array.isArray(entry.selectedValues)?entry.selectedValues.slice(0,4).map(function(value){return String(value||"").slice(0,120);}):[],ownAnswer:String(entry.ownAnswer||"").slice(0,500)};
  }).filter(function(entry){return entry.semanticKey&&entry.factKey;}):[];
  return {activeServiceCode:String(body.activeServiceCode||"").slice(0,40),clarificationAnswer:{clarificationId:String(answer.clarificationId||"").slice(0,80),optionId:String(answer.optionId||"").slice(0,80),optionIds:optionIds},conversation:{sessionId:String(conversation.sessionId||"").slice(0,100),revision:Math.max(0,Math.min(100,Number(conversation.revision)||0)),batchIndex:Math.max(0,Math.min(4,Number(conversation.batchIndex)||0)),actionCode:String(conversation.actionCode||"").slice(0,40),profileId:Number(conversation.profileId)||null,answers:conversationAnswers},company:{name:String(company.name||"").slice(0,120),activities:Array.isArray(company.activities)?company.activities.slice(0,12):[],role:String(company.role||"").slice(0,120),relationship:String(company.relationship||"").slice(0,120),collaboration:String(company.collaboration||"").slice(0,120),contact:String(company.contact||"").slice(0,120)},attachment:attachment};
}
function fingerprint(text,context){return crypto.createHash("sha256").update(JSON.stringify([engine.CONTRACT_VERSION,engine.ENGINE_VERSION,text,context])).digest("hex");}
function cleanup(now){runtime.cache.forEach(function(entry,key){if(now-entry.createdAt>CACHE_TTL_MS)runtime.cache.delete(key);});runtime.users.forEach(function(entry,key){if(now-entry.startedAt>WINDOW_MS*2)runtime.users.delete(key);});}

async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST")return res.status(405).json({ok:false,code:"METHOD_NOT_ALLOWED",napaka:"Samo POST."});
  var cfg;try{cfg=db.uporabniskaKonfiguracija();}catch(_error){return res.status(500).json({ok:false,code:"SERVER_CONFIGURATION",napaka:"Strežniška konfiguracija manjka."});}
  var auth=localPreviewAuth.preveri(req)||await db.preveriUporabnika(req,cfg);
  if(!auth.ok)return res.status(auth.status).json({ok:false,code:auth.code||"AUTH_REQUIRED",retryable:auth.retryable===true,napaka:auth.napaka});
  var body=req.body&&typeof req.body==="object"?req.body:{};
  var requestId=String(body.requestId||""),text=String(body.text||"").trim(),context=cleanContext(body);
  if(!validRequestId(requestId)||!text||text.length>engine.MAX_TEXT_LENGTH)return res.status(400).json({ok:false,code:"INVALID_INPUT",napaka:"Preverite opis zahteve."});
  var now=Date.now();cleanup(now);
  var key=engine.CONTRACT_VERSION+":"+engine.ENGINE_VERSION+":"+auth.user.id+":"+requestId,requestFingerprint=fingerprint(text,context);
  var coordinator=lunaPolicy.createDistributedCoordinator({enabled:Boolean(auth.token)&&auth.verification!=="local_preview_loopback",rpc:function(name,payload){return db.pokliciRpcKotUporabnik(cfg,auth.token,name,payload);},key:key,requestId:requestId,kind:"advisor",contractVersion:engine.CONTRACT_VERSION,fingerprint:requestFingerprint});
  var outcome=await lunaPolicy.executeIdempotent(runtime,{key:key,fingerprint:requestFingerprint,coordinator:coordinator,fallbackMessage:"Atena zahteve trenutno ni mogla razumeti.",beforeStart:function(){return lunaPolicy.reserveRateLimit(runtime.users,auth.user.id,now,WINDOW_MS,MAX_REQUESTS)?null:{statusCode:429,payload:{ok:false,code:"RATE_LIMITED",retryable:true,napaka:"Preveč zaporednih zahtev. Poskusite znova čez minuto."}};}},async function(){
    var result=await engine.analyze(text,context,{userId:auth.user.id});
    // Svetovalna plast: čisto dodatna, nedestruktivna analiza nad že izračunanimi
    // dejstvi (result.facts). Ne spreminja in ne nadomešča ničesar zgoraj —
    // glej docs/PREVERBA-PONUDBE-SVETOVALNA-PLAST.md. Frontend polje lahko
    // varno ignorira, dokler prikazna komponenta ni odobrena (NAZORJEVA).
    var svetovalnaPlast=null;
    try{svetovalnaPlast=ugotovitveEngine.izracunajUgotovitve(result.facts||[]);}catch(_svetovalnaNapaka){svetovalnaPlast=null;}
    return {statusCode:200,payload:{ok:true,requestId:requestId,engineVersion:result.engineVersion,contractVersion:result.contractVersion,model:result.model,semanticPlan:result.semanticPlan,selections:result.selections,facts:result.facts,clarification:result.clarification||null,questionBatch:result.questionBatch||null,blockCodes:result.blockCodes||[],svetovalnaPlast:svetovalnaPlast}};
  });
  return res.status(outcome.statusCode).json(outcome.payload);
}

module.exports=handler;
module.exports._test={validRequestId:validRequestId,cleanContext:cleanContext,fingerprint:fingerprint,runtime:runtime};
