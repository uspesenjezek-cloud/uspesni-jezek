const assert=require('node:assert/strict');
const store=require('../api/_lib/boniteta-pro-store');
const original=global.fetch;
(async()=>{let count=0;global.fetch=async(url)=>{const u=new URL(url);assert.equal(u.searchParams.get('user_id'),'eq.test-owner');const select=u.searchParams.get('select');if(!select.includes('!boniteta_monitorji_profile_owner_fkey'))return{ok:false,status:300,json:async()=>({code:'PGRST201'})};count++;return{ok:true,status:200,json:async()=>[]};};assert.deepEqual(await store.listProfiles({url:'https://example.test',serviceKey:'test'},'test-owner',true),[]);assert.equal(count,1);console.log('PASS: explicit owner relationship and user filter prevent PGRST201');})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>global.fetch=original);
