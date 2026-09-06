"use strict";
var assert=require("node:assert/strict");
var graph=require("../app/svetovalec-question-graph");

var validation=graph.validate();assert.equal(validation.ok,true,validation.errors.join(", "));assert.equal(validation.profiles,43);
var contract=graph.materialize("pack:contract:timing");assert.equal(contract.questions.length,4);
var yes=graph.applyAnswer({answers:{},activeQuestionIds:[]},"q:contract:has-timing","yes");
assert.deepEqual(yes.state.activeQuestionIds.sort(),["q:contract:effective-date","q:contract:notice-period"].sort());
assert.throws(function(){graph.normalize("q:contract:effective-date","jutri");},/YYYY-MM-DD/);
assert.equal(graph.normalize("q:contract:effective-date","2026-09-02"),"2026-09-02");
yes=graph.applyAnswer(yes.state,"q:contract:effective-date","2026-01-15");
yes=graph.applyAnswer(yes.state,"q:contract:notice-period",{amount:3,unit:"months"});
var no=graph.applyAnswer(yes.state,"q:contract:has-timing","no");
assert.equal(no.state.answers["q:contract:effective-date"],undefined);
assert.equal(no.state.answers["q:contract:notice-period"],undefined);
var same=graph.applyAnswer(no.state,"q:contract:has-timing","no");assert.equal(same.changed,false);

assert.throws(function(){graph.normalize("q:marketing:channels",["none","search"]);},/izključujoča/);
assert.deepEqual(graph.normalize("q:marketing:channels",["search","telephone","search"]),["search","telephone"]);
assert.equal(graph.normalize("q:marketing:current-spend",1500),1500);
assert.equal(graph.normalize("q:marketing:current-spend","unknown"),"unknown");
assert.throws(function(){graph.normalize("q:marketing:current-spend",20000);},/razpona/);
assert.deepEqual(graph.normalize("q:marketing:budget",{amount:"2400",vatMode:"excluded",period:"month"}),{amount:2400,currency:"EUR",vatMode:"excluded",period:"month"});
assert.deepEqual(graph.normalize("q:marketing:budget",{amount:"1.250,50",vatMode:"included",period:"month"}),{amount:1250.5,currency:"EUR",vatMode:"included",period:"month"});

var marketing=graph.materialize("pack:profile:1022:market-entry");assert.equal(marketing.questions.length,4);
var channels=marketing.questions.find(function(q){return q.id==="q:marketing:channels";});
["search","social","content","display","marketplaces","print","telephone","ooh","events","broadcast","partners","pr","field","promo","crm"].forEach(function(id){assert.ok(channels.answer.options.some(function(o){return o.id===id;}),id);});
var selected=graph.applyAnswer({answers:{},activeQuestionIds:[]},"q:marketing:channels",["telephone","events"]);
assert.deepEqual(selected.state.answers["q:marketing:channels"].value,["telephone","events"]);
var marketingControl=graph.materializeSelection(1022,"ponudba",["c0"],{batchIndex:1,answers:[{factKey:"marketing.channels",selectedValues:["telephone","events"]}]});
assert.deepEqual(marketingControl.questions.map(function(question){return question.factKey;}),["marketing.audiences","marketing.markets","marketing.measurementAccess","marketing.assetOwnership"]);
assert.equal(marketingControl.title,"Občinstvo, trg in nadzor");
assert.ok(marketingControl.questions.every(function(question){return question.options.length>=4;}));
var marketingChannels=graph.materializeSelection(1022,"ponudba",["c0"],{batchIndex:2,answers:[{factKey:"marketing.channels",selectedValues:["telephone","trade-fairs-events"]}]});
assert.equal(marketingChannels.title,"Izbrani marketinški kanali");
assert.ok(marketingChannels.questions[0].options.some(function(option){return option.label==="Ciljni seznam";}));
assert.ok(marketingChannels.questions[0].options.some(function(option){return option.label==="Tiskovine ali materiali";}));
var marketingUnknown=graph.materializeSelection(1022,"ponudba",["c0"],{batchIndex:2,answers:[{factKey:"marketing.channels",selectedValues:["unknown"]}]});
assert.equal(marketingUnknown.title,"Izbor marketinških kanalov");

var knowledge=require("../app/svetovalec-service-knowledge-blocks"),capabilities=require("../app/svetovalec-capability-catalog");
capabilities.profiles.forEach(function(profile){
  var codes=knowledge.profileBlueprints[profile.profileId].blockIds.slice(0,4).map(function(id){return knowledge.blockById[id].promptCode;});
  var local=graph.materializeSelection(profile.profileId,"ponudba",codes,{batchIndex:0,answers:[]});
  assert.ok(local.questions.length>=3&&local.questions.length<=4,"profil "+profile.profileId+" mora dobiti 3–4 lokalna vprašanja");
  local.questions.forEach(function(question){assert.ok(question.id&&question.factKey&&question.widgetId,"profil "+profile.profileId+" ima nepopolno vprašanje");});
  if(profile.profileId!==1022){
    assert.equal(local.questions.length,4,"profil "+profile.profileId+" mora imeti štiri začetne kartice");
    var solution=local.questions.find(function(question){return question.factKey==="profile."+profile.profileId+".solutionType";});
    assert.ok(solution,"profil "+profile.profileId+" nima kartice vrste rešitve");
    assert.deepEqual(solution.options.map(function(item){return item.value;}),require("../app/svetovalec-service-market-catalog").profileById[profile.profileId].solutionTypes);
    assert.deepEqual(solution.marketApplicability,["DE","SI"]);
    assert.ok(local.questions.every(function(question){return question.marketApplicability.join(",")==="DE,SI";}));
  }
});

var samples=[];for(var i=0;i<10000;i++){var started=process.hrtime.bigint();graph.evaluate("q:marketing:channels",[i%2?"digital":"telephone"]);samples.push(Number(process.hrtime.bigint()-started)/1e6);}samples.sort(function(a,b){return a-b;});
function pct(p){return samples[Math.min(samples.length-1,Math.floor(samples.length*p))];}
console.log(JSON.stringify({ok:true,profiles:validation.profiles,questions:validation.questions,packs:validation.packs,benchmarkMs:{p50:pct(.5),p95:pct(.95),max:samples[samples.length-1]}},null,2));
