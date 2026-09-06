"use strict";
const fs=require("fs");
const path=require("path");
const {chromium}=require("C:/Users/jkjob/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright");
const ROOT=path.resolve(__dirname,"..");
const URL="http://localhost:8001/app/svetovalec-preverba.html?app-preview=1";
const OUT=process.argv[2]?path.resolve(process.argv[2]):path.join(ROOT,"output","playwright");
const SOURCE="pogajajte se za boljšo ceno za mobilnega operaterja";
const MARKETING_SOURCE="pogajajte se za boljše merjenje rezultatov marketinga";
const QUESTION_IDS=["telecom:account-type","telecom:line-count","telecom:current-price","telecom:current-package","telecom:binding","telecom:binding-end","telecom:cancellation-period","telecom:device-included","telecom:competition","telecom:saving-target","action:negotiation-goal","action:alternative","review:confirm"];

function mockResult(body){
  if(String(body.text||"").includes("marketinga"))return {ok:true,requestId:body.requestId,engineVersion:"atena-svetovalec-luna-v3",contractVersion:"svetovalec-intent-contract-v1",model:"mock-luna",semanticPlan:{source:"luna"},selections:[{serviceId:2003,serviceCode:"pogajanje",serviceTitle:"Pogajajte se ali odpovejte",areaCode:"cilj",areaLabel:"Cilj in prioritete",moduleIds:[6201],evidence:"pogajajte",actionId:"atena:action:svetovalec:open-service:pogajanje",requiresHumanReview:true}],facts:[],clarification:null,guidedPlan:{source:"luna",actionCode:"pogajanje",profileId:1022,questionIds:["family:marketing:focus","domain:current-satisfaction","action:negotiation-goal","review:confirm"],firstQuestionId:"family:marketing:focus",evidence:"marketinga"}};
  return {ok:true,requestId:body.requestId,engineVersion:"atena-svetovalec-luna-v3",contractVersion:"svetovalec-intent-contract-v1",model:"mock-luna",semanticPlan:{source:"luna"},selections:[{serviceId:2003,serviceCode:"pogajanje",serviceTitle:"Pogajajte se ali odpovejte",areaCode:"cilj",areaLabel:"Cilj in prioritete",moduleIds:[6201],evidence:"pogajajte",actionId:"atena:action:svetovalec:open-service:pogajanje",requiresHumanReview:true}],facts:[],clarification:null,guidedPlan:{source:"luna",actionCode:"pogajanje",profileId:1014,questionIds:QUESTION_IDS,firstQuestionId:QUESTION_IDS[0],evidence:"mobilnega operaterja"}};
}
async function answerSingle(page,id,optionId){const card=page.locator('[data-atena-question-id="'+id+'"]');await card.waitFor({state:"visible"});await card.locator('[data-option-id="'+optionId+'"]').click();}
async function answerTyped(page,id,value){const card=page.locator('[data-atena-question-id="'+id+'"]');await card.waitFor({state:"visible"});await card.locator("input").fill(value);await card.locator(".svetovalec-atena-mini-widget__potrdi").click();}

async function run(viewport,file,checkStale){
  const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"});
  const page=await browser.newPage({viewport});
  const errors=[],requests=[];
  page.on("console",message=>{if(["error","warning"].includes(message.type())&&!message.text().includes("Failed to load resource"))errors.push(message.type()+": "+message.text());});
  page.on("pageerror",error=>errors.push("pageerror: "+error.message));
  await page.route("**/api/razcleni-svetovalec",async route=>{const body=JSON.parse(route.request().postData()||"{}");requests.push(body);await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(mockResult(body))});});
  await page.goto(URL,{waitUntil:"networkidle"});
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:"networkidle"});
  await page.locator("#svetovalec-opis").fill(SOURCE);
  await page.locator("[data-zacni-preverbo]").click();
  const first=page.locator('[data-atena-question-id="telecom:account-type"]');
  await first.waitFor({state:"visible"});
  if(await first.getAttribute("data-atena-renderer")!=="segments")throw new Error("Luna ni odprla namenskega telekom koraka.");
  const wrong=["Spletna stran, trgovina, domene in gostovanje","SEO, oglasi, družbena omrežja in vsebinski marketing","Grafično oblikovanje in celostna podoba","Pravne storitve in pogodbe"];
  const bodyText=await page.locator("body").innerText();wrong.forEach(text=>{if(bodyText.includes(text))throw new Error("Prikazana je stara napačna možnost: "+text);});
  await answerSingle(page,"telecom:account-type","poslovna");
  await answerTyped(page,"telecom:line-count","3");
  await answerTyped(page,"telecom:current-price","49,90");
  const packageCard=page.locator('[data-atena-question-id="telecom:current-package"]');
  await packageCard.locator('[data-option-id="podatki"]').click();await packageCard.locator('[data-option-id="roaming-eu"]').click();await packageCard.locator(".svetovalec-atena-mini-widget__potrdi").click();
  await answerSingle(page,"telecom:binding","aktivna");
  await answerTyped(page,"telecom:binding-end","2026-12-31");
  await answerSingle(page,"telecom:cancellation-period","do-30");
  await page.locator('[data-atena-question-id="telecom:device-included"]').waitFor({state:"visible"});
  const metrics=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,formCount:document.querySelectorAll("[data-atena-question-id]").length,answered:document.querySelectorAll("[data-atena-question-id].is-answered").length,renderers:Array.from(new Set(Array.from(document.querySelectorAll("[data-atena-renderer]")).map(node=>node.dataset.atenaRenderer))),current:document.querySelector("[data-atena-question-id]:not(.is-answered)")?.dataset.atenaQuestionId,headerActions:Array.from(document.querySelectorAll(".svetovalec-atena-pogovor__glava-akcije > *")).map(node=>node.textContent.trim())}));
  fs.mkdirSync(OUT,{recursive:true});await page.screenshot({path:path.join(OUT,file),fullPage:true});
  if(requests.length!==1)throw new Error("Pri prvem vnosu mora biti natanko en Lunin klic: "+requests.length);
  if(requests[0].text!==SOURCE)throw new Error("Luna ni prejela točnega novega vnosa.");
  if(metrics.scrollWidth>metrics.clientWidth)throw new Error("Horizontalni overflow: "+JSON.stringify(metrics));
  if(metrics.answered<7||metrics.current!=="telecom:device-included")throw new Error("Pogojna telekom veja ni pravilno napredovala: "+JSON.stringify(metrics));
  ["segments","quantity","money","tags","path","date","vertical"].forEach(renderer=>{if(!metrics.renderers.includes(renderer))throw new Error("Manjka renderer "+renderer);});
  if(JSON.stringify(metrics.headerActions)!==JSON.stringify(["Ponastavi","Skrči"]))throw new Error("Glavni dejanji nista pravilno razporejeni.");
  if(checkStale){
    const oldFlowId=await page.evaluate(()=>JSON.parse(localStorage.getItem("uj_atena_svetovalec_conversation_flow_v2")).id);
    const nextSource="pogajajte se za nižjo ceno za mobilnega operaterja za našo ekipo";
    await page.locator("#svetovalec-opis").evaluate((node,value)=>{node.value=value;node.dispatchEvent(new Event("input",{bubbles:true}));},nextSource);
    await page.locator("[data-zacni-preverbo]").evaluate(node=>{node.disabled=false;node.click();});
    await page.waitForFunction(value=>{const raw=localStorage.getItem("uj_atena_svetovalec_conversation_flow_v2");if(!raw)return false;try{return JSON.parse(raw).sourceText===value;}catch(_error){return false;}},nextSource);
    const newFlowId=await page.evaluate(()=>JSON.parse(localStorage.getItem("uj_atena_svetovalec_conversation_flow_v2")).id);
    if(requests.length!==2||oldFlowId===newFlowId)throw new Error("Nov vnos ni zamenjal stare vodene seje.");
  }
  if(errors.length)throw new Error(errors.join("\n"));
  await browser.close();return metrics;
}
async function runMultipleLayout(viewport,file){
  const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"});
  const page=await browser.newPage({viewport});
  await page.route("**/api/razcleni-svetovalec",async route=>{const body=JSON.parse(route.request().postData()||"{}");await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(mockResult(body))});});
  await page.goto(URL,{waitUntil:"networkidle"});await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:"networkidle"});
  await page.locator("#svetovalec-opis").fill(MARKETING_SOURCE);await page.locator("[data-zacni-preverbo]").click();
  const card=page.locator('[data-atena-question-id="family:marketing:focus"]');await card.waitFor({state:"visible"});
  const layout=await card.evaluate(node=>{const choices=node.querySelector(".svetovalec-atena-mini-widget__izbire"),own=node.querySelector(".svetovalec-atena-mini-widget__napisi-sam"),last=Array.from(choices.querySelectorAll("[data-option-id]")).find(item=>item.textContent.includes("Prodajo ali donos")),confirm=node.querySelector(":scope > .svetovalec-atena-mini-widget__potrdi"),a=last.getBoundingClientRect(),b=own.getBoundingClientRect(),c=confirm.getBoundingClientRect();return {ownInside:own.parentElement===choices,sameRow:Math.abs(a.top-b.top)<2,ownRight:b.left>a.left,confirmBelow:c.top>Math.max(a.bottom,b.bottom),overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth};});
  fs.mkdirSync(OUT,{recursive:true});await page.screenshot({path:path.join(OUT,file),fullPage:true});await browser.close();
  if(!layout.ownInside||!layout.sameRow||!layout.ownRight||!layout.confirmBelow||layout.overflow)throw new Error("Večizbirna kartica ni kompaktno zložena: "+JSON.stringify(layout));return layout;
}
(async()=>{if(process.argv.includes("--multiple-layout")){const mobile=await runMultipleLayout({width:390,height:844},"atena-multiple-layout-mobile.png"),desktop=await runMultipleLayout({width:980,height:900},"atena-multiple-layout-desktop.png");console.log(JSON.stringify({mobile,desktop},null,2));return;}const mobile=await run({width:390,height:844},"atena-luna-telekom-v3-mobile.png",true),desktop=await run({width:980,height:900},"atena-luna-telekom-v3-desktop.png",false);console.log(JSON.stringify({mobile,desktop},null,2));})().catch(error=>{console.error(error);process.exitCode=1;});
