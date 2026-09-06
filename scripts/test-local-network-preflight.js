'use strict';
const assert = require('node:assert/strict');
const {checkNetwork} = require('./local-network-preflight');
(async()=>{
  let requests=[];
  await checkNetwork({jwksUrl:'https://example.test/jwks',fetch:async(url,options)=>{requests.push({url,options});return {ok:url.includes('jwks'),status:url.includes('jwks')?200:404};}});
  assert.equal(requests.length,2);
  assert(requests.every(r=>!r.options.headers && !r.options.body),'No credentials or paid payloads');
  await assert.rejects(checkNetwork({fetch:async()=>{throw Object.assign(new Error('blocked'),{cause:{code:'EACCES'}});}}),/EACCES/);
  await assert.rejects(checkNetwork({fetch:async()=>({ok:false,status:503})}),/HTTP 503/);
  console.log('PASS: reachable, blocked and provider failure; no credentials or paid requests.');
})().catch(e=>{console.error(e);process.exitCode=1;});
