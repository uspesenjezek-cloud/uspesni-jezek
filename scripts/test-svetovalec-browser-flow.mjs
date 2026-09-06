"use strict";

import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";
import { createRequire } from "node:module";

const require=createRequire(import.meta.url);
const graph=require("../app/svetovalec-question-graph");
const materialized=graph.materialize("pack:contract:timing");
const questions=materialized.questions.map((question)=>graph.dynamicQuestion(question,"local-browser-contract"));
const marketingQuestions=graph.materialize("pack:profile:1022:market-entry").questions.map((question)=>graph.dynamicQuestion(question,"local-browser-marketing"));
const profileQuestions=graph.profileIntake(1001,"local-browser-profile").questions;
const chrome="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser=await puppeteer.launch({executablePath:chrome,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const page=await browser.newPage();
const viewport={width:Number(process.env.SVETOVALEC_VIEWPORT_WIDTH)||390,height:Number(process.env.SVETOVALEC_VIEWPORT_HEIGHT)||844};
await page.setViewport({...viewport,deviceScaleFactor:1});
const pageErrors=[];
page.on("pageerror",(error)=>pageErrors.push(error.message));
await page.evaluateOnNewDocument((mockData)=>{
  localStorage.clear(); sessionStorage.clear();
  window.__svetovalecMockCalls=[];
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const url=typeof input==="string"?input:input.url;
    if(url==="/api/razcleni-svetovalec"){
      const body=JSON.parse(init.body),review=Boolean(body.conversation),profileFlow=body.text.includes("gradbeni material"),marketingFlow=body.text.includes("marketing kanale");
      window.__svetovalecMockCalls.push({text:body.text,review});
      if(review){const response=await nativeFetch(input,init);window.__lastSvetovalecPayload=await response.clone().json();return response;}
      const questionBatch={source:"local-graph",graphVersion:"svetovalec-question-graph-v1",state:"ask",actionCode:profileFlow||marketingFlow?"ponudba":"pogajanje",profileId:profileFlow?1001:1022,id:profileFlow?"browser-profile":marketingFlow?"browser-marketing":"browser-contract",index:0,title:profileFlow?"Gradbeni material":marketingFlow?"Marketing in cilj":"Pogodbeni roki",rationale:"Lokalni registrirani sklop",evidence:profileFlow?"material":marketingFlow?"marketing":"pogodbo",interfaceId:"atena:section:svetovalec:browser-flow",contextVersion:"atena-interface-context-v3",questions:profileFlow?mockData.profileQuestions:marketingFlow?mockData.marketingQuestions:mockData.contractQuestions};
      const payload={ok:true,requestId:body.requestId,engineVersion:"browser-mock",contractVersion:"svetovalec-intent-contract-v2",model:"mock",semanticPlan:{requested:true,attempted:true,source:"browser-mock",status:review?"REVIEW_READY":"OK"},selections:[],facts:[],clarification:null,questionBatch,blockCodes:[]}; window.__lastSvetovalecPayload=payload;
      return new Response(JSON.stringify(payload),{status:200,headers:{"Content-Type":"application/json"}});
    }
    return nativeFetch(input,init);
  };
},{contractQuestions:questions,profileQuestions,marketingQuestions});

try{
  await page.goto("http://127.0.0.1:8001/app/svetovalec-preverba.html?app-preview=1",{waitUntil:"domcontentloaded",timeout:20000});
  await page.waitForSelector("#svetovalec-opis");
  await page.type("#svetovalec-opis","preverite pogodbo za marketing");
  await page.click("[data-zacni-preverbo]");
  try{await page.waitForSelector('[data-atena-question-id="q:contract:has-timing"].is-active-question',{timeout:20000});}
  catch(error){const debug=await page.evaluate(()=>{const data=window.__lastSvetovalecPayload,source="preverite pogodbo za marketing",renderers={"da-ne-ne-vem":1,"datum-z-gotovostjo":1,"kolicina-in-enota":1,"dokazilo":1};return {status:document.querySelector("[data-atena-status]")?.textContent,cards:Array.from(document.querySelectorAll("[data-atena-question-id]")).map((node)=>node.dataset.atenaQuestionId),calls:window.__svetovalecMockCalls,flow:Boolean(window.UJSvetovalecConversationFlow),dynamic:Boolean(window.UJSvetovalecDynamicBatchEngine),contract:window.UJSvetovalecAtenaEngine?.contractVersion,batchChecks:data&&{source:data.questionBatch.source,graph:data.questionBatch.graphVersion,count:data.questionBatch.questions.length,evidence:source.includes(data.questionBatch.evidence),questions:data.questionBatch.questions.map((q)=>({id:q.id,interface:Boolean(q.interfaceId),field:Boolean(q.fieldInterfaceId),context:q.contextVersion,options:Array.isArray(q.options),renderer:Boolean(renderers[q.widgetId]),kind:q.kind,count:q.options?.length}))}};});throw new Error(error.message+" | "+JSON.stringify(debug)+" | pageErrors="+pageErrors.join(" | "));}
  assert.equal(await page.$$eval("[data-atena-question-id]",(nodes)=>nodes.length),1,"sprva mora biti vidno le korensko vprašanje");
  await page.click('[data-atena-question-id="q:contract:has-timing"] [data-option-id="yes"]');
  await page.click('[data-atena-question-id="q:contract:has-timing"] .svetovalec-atena-mini-widget__potrdi');
  try{await page.waitForSelector('[data-atena-question-id="q:contract:notice-period"]',{timeout:5000});}
  catch(error){const debug=await page.evaluate(()=>({status:document.querySelector("[data-atena-status]")?.textContent,cards:Array.from(document.querySelectorAll("[data-atena-question-id]")).map((node)=>({id:node.dataset.atenaQuestionId,active:node.classList.contains("is-active-question"),text:node.textContent})),stored:localStorage.getItem("uj_atena_svetovalec_conversation_flow_v2")}));throw new Error(error.message+" | "+JSON.stringify(debug));}
  assert.deepEqual(await page.$$eval("[data-atena-question-id]",(nodes)=>nodes.map((node)=>node.dataset.atenaQuestionId)),["q:contract:has-timing","q:contract:effective-date","q:contract:notice-period"]);
  assert.equal(await page.$eval('[data-atena-question-id="q:contract:notice-period"] select',(node)=>node.options.length),2,"rok mora ponuditi dneve in mesece");
  await page.click('[data-atena-koraki-krogi] button:first-child');
  await page.click('[data-atena-question-id="q:contract:has-timing"] [data-option-id="unknown"]');
  await page.click('[data-atena-question-id="q:contract:has-timing"] .svetovalec-atena-mini-widget__potrdi');
  try{await page.waitForSelector('[data-atena-question-id="q:contract:evidence"].is-active-question',{timeout:5000});}
  catch(error){const debug=await page.evaluate(()=>({cards:Array.from(document.querySelectorAll("[data-atena-question-id]")).map((node)=>({id:node.dataset.atenaQuestionId,active:node.classList.contains("is-active-question"),pressed:Array.from(node.querySelectorAll("[aria-pressed=true]")).map((button)=>button.dataset.optionId)})),stored:localStorage.getItem("uj_atena_svetovalec_conversation_flow_v2")}));throw new Error(error.message+" | "+JSON.stringify(debug));}
  assert.deepEqual(await page.$$eval("[data-atena-question-id]",(nodes)=>nodes.map((node)=>node.dataset.atenaQuestionId)),["q:contract:has-timing","q:contract:evidence"],"sprememba odgovora mora odstraniti neveljavna podvprašanja");
  const textGeometry=await page.$eval('[data-atena-question-id="q:contract:evidence"]',(card)=>{const grid=card.querySelector(".svetovalec-atena-mini-widget__izbire"),textarea=card.querySelector("textarea"),g=grid.getBoundingClientRect(),t=textarea.getBoundingClientRect();return {ratio:t.width/g.width,height:t.height};});
  assert.ok(textGeometry.ratio>.96,"tekstovno polje mora uporabiti celo širino kartice");
  assert.ok(textGeometry.height<=64,"tekstovno polje mora ostati začetno kompaktno");
  if(process.env.SVETOVALEC_SCREENSHOT_STATE==="contract-text"&&process.env.SVETOVALEC_SCREENSHOT_PATH){
    const card=await page.$('[data-atena-question-id="q:contract:evidence"]');
    await card.evaluate((node)=>node.scrollIntoView({block:"center"}));
    const box=await card.boundingBox();
    await page.screenshot({path:process.env.SVETOVALEC_SCREENSHOT_PATH,clip:{x:Math.max(0,box.x-4),y:Math.max(0,box.y-4),width:Math.min(viewport.width,box.width+8),height:Math.min(viewport.height-8,box.height+8)}});
  }
  await page.goto("http://127.0.0.1:8001/app/svetovalec-preverba.html?app-preview=1&profile-test=1",{waitUntil:"domcontentloaded",timeout:20000});
  await page.waitForSelector("#svetovalec-opis");
  await page.type("#svetovalec-opis","preverite ponudbo za gradbeni material");
  await page.click("[data-zacni-preverbo]");
  await page.waitForSelector('[data-atena-question-id="q:profile:1001:solution"].is-active-question',{timeout:20000});
  assert.equal(await page.$$eval("[data-atena-question-id]",(nodes)=>nodes.length),4,"profilni začetni sklop mora prikazati štiri kartice");
  assert.deepEqual(await page.$$eval('[data-atena-question-id="q:profile:1001:solution"] [data-option-id]',(nodes)=>nodes.map((node)=>node.dataset.optionId)),["konstrukcijski-material","izolacije","suha-gradnja","kritine","agregati"]);
  for(let index=0;index<4;index+=1){
    await page.waitForSelector("[data-atena-question-id].is-active-question [data-option-id]");
    await page.click("[data-atena-question-id].is-active-question [data-option-id]");
    await page.click("[data-atena-question-id].is-active-question .svetovalec-atena-mini-widget__potrdi");
  }
  await page.waitForSelector('[data-atena-question-id="q:fact:family-material-spec"].is-active-question',{timeout:15000});
  const continuation=await page.evaluate(()=>window.__lastSvetovalecPayload);
  assert.equal(continuation.model,"local","drugi sklop mora nastati lokalno brez AI-klica");
  assert.equal(continuation.semanticPlan.attempted,false);
  await page.goto("http://127.0.0.1:8001/app/svetovalec-preverba.html?app-preview=1&marketing-test=1",{waitUntil:"domcontentloaded",timeout:20000});
  await page.waitForSelector("#svetovalec-opis");
  await page.type("#svetovalec-opis","preverite marketing kanale");
  await page.click("[data-zacni-preverbo]");
  await page.waitForSelector('[data-atena-question-id="q:marketing:objective"].is-active-question',{timeout:20000});
  assert.equal(await page.$eval('[data-atena-question-id="q:marketing:objective"]',(node)=>{const own=node.querySelector(".svetovalec-atena-mini-widget__napisi-sam"),confirm=node.querySelector(".svetovalec-atena-mini-widget__potrdi");return Boolean(own&&confirm&&(own.compareDocumentPosition(confirm)&Node.DOCUMENT_POSITION_FOLLOWING));}),true,"»Napiši sam« mora biti pred končnim gumbom »Izberi«");
  assert.equal(await page.$$eval('[data-atena-question-id="q:marketing:channels"] [data-option-id]',(nodes)=>nodes.length),16,"vseh 15 marketinških rešitev in »še ne vem« mora biti vidnih");
  assert.equal(await page.$eval('[data-atena-question-id="q:marketing:channels"]',(node)=>node.dataset.atenaRenderer),"tags");
  assert.equal(await page.$eval('[data-atena-question-id="q:marketing:current-spend"]',(node)=>node.dataset.atenaRenderer),"slider");
  if(process.env.SVETOVALEC_SCREENSHOT_STATE!=="contract-text"&&process.env.SVETOVALEC_SCREENSHOT_PATH){
    await page.click('[data-atena-question-id="q:marketing:objective"] [data-option-id="other"]');
    await page.waitForFunction(()=>!document.querySelector('[data-atena-question-id="q:marketing:objective"] .svetovalec-atena-mini-widget__potrdi').disabled);
    const card=await page.$('[data-atena-question-id="q:marketing:objective"]');
    const own=await card.$(".svetovalec-atena-mini-widget__napisi-sam");
    await own.evaluate((node)=>node.scrollIntoView({block:"center"}));
    const cardBox=await card.boundingBox(),ownBox=await own.boundingBox(),y=Math.max(0,ownBox.y-105);
    await page.screenshot({path:process.env.SVETOVALEC_SCREENSHOT_PATH,clip:{x:Math.max(0,cardBox.x-4),y,width:Math.min(viewport.width,cardBox.width+8),height:Math.min(230,viewport.height-y-8)}});
  }
  assert.equal(pageErrors.length,0,"napake strani: "+pageErrors.join(" | "));
  console.log(JSON.stringify({ok:true,viewport:viewport.width+"x"+viewport.height,contract:{initialQuestions:1,yesQuestions:3,unknownQuestions:2},profile1001:{questions:4,solutions:5,localContinuation:true},marketing:{solutions:15,channelRenderer:"tags",spendRenderer:"slider"},api:"first-call mock; continuation local/no-cost"},null,2));
}finally{
  await browser.close();
}
