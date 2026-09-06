"use strict";
var assert=require("node:assert/strict"),catalog=require("../app/svetovalec-service-market-catalog");
var result=catalog.validate();assert.equal(result.ok,true,result.errors.join(","));assert.equal(result.profiles,43);assert.deepEqual(catalog.supportedMarkets,["DE","SI"]);
var marketing=catalog.profileById[1022];["physical-print","telephone","local-ooh","trade-fairs-events","radio-tv-video","digital-search","retention-crm"].forEach(function(id){assert.ok(marketing.solutionTypes.includes(id),id);});
catalog.profiles.forEach(function(profile){assert.ok(profile.solutionTypes.length>0,String(profile.profileId));assert.deepEqual(profile.markets,["DE","SI"]);});
console.log(JSON.stringify(result,null,2));
