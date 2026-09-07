"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../app/pos-terminal');
const source=fs.readFileSync(path.join(__dirname,'../app/pos-terminal.js'),'utf8');
function extract(start,end){const i=source.indexOf(start);assert.ok(i>=0);return source.slice(i,source.indexOf(end,i));}
const refresh=extract('  async function loadTargetedServerState(scopes)','  async function runServerRefreshQueue(');
const apply=extract('  function applyPaymentRefresh(rows)','  function applyDeliveryRefresh(');
async function test(failTable){
 const records=Array.from({length:1001},(_,i)=>({id:'row-'+String(i).padStart(4,'0'),invoice_id:i===1000?'latest':'older',amount_cents:11900,currency:'EUR',status:'succeeded',created_at:'2026-09-08T00:00:00Z'}));
 const ranges=[],orders=[];let delivered=0,eventCount=0,persisted=0;
 const state={invoices:[{id:'latest',serverStored:true,status:'paid',paidCents:11900,totals:{grossCents:11900},payments:[core.paymentFromServer(records[1000])]}],cashCheckouts:[]};
 const before=JSON.stringify(state);
 const from=table=>{
   let low=0,high=999;const sort=[];
   const q={select(){return q},eq(){return q},order(key){sort.push(key);return q},range(a,b){low=a;high=b;ranges.push([table,a,b]);orders.push(sort);return q},then(resolve,reject){return Promise.resolve(table===failTable&&low>=500?{data:null,error:{message:'page two failed'}}:{data:records.slice(low,high+1),error:null}).then(resolve,reject)}};return q;
 };
 const context={backend:{client:{from},userId:'user',ready:true},state,paymentFromServer:core.paymentFromServer,paymentSummary:core.paymentSummary,applyLocalCashCheckouts:core.applyLocalCashCheckouts,fetchAllRows:core.fetchAllRows,applyDeliveryRefresh(rows,events){delivered=rows.length;eventCount=events.length},persist(){persisted++},backendMessage(){},renderHome(){},loadArchiveCapability:async()=>{},query:()=>null,databaseErrorMessage:e=>e.message};
 vm.createContext(context);vm.runInContext(apply+refresh,context);
 await context.loadTargetedServerState({payments:true,deliveries:true});
 orders.forEach(sort=>assert.deepEqual(sort,['created_at','id']));
 if(failTable){assert.equal(JSON.stringify(state),before);assert.equal(delivered,0);assert.equal(eventCount,0);assert.equal(persisted,0);assert.equal(context.backend.ready,false);}
 else {assert.equal(state.invoices[0].paidCents,11900);assert.equal(state.invoices[0].status,'paid');assert.equal(delivered,1001);assert.equal(eventCount,1001);assert.equal(persisted,1);for(const table of ['pos_payments','pos_invoice_deliveries','pos_invoice_delivery_events'])assert.ok(ranges.some(([name,low])=>name===table&&low===1000));}
}
(async()=>{await test();for(const table of ['pos_payments','pos_invoice_deliveries','pos_invoice_delivery_events'])await test(table);console.log('POS targeted refresh: 1001 rows, stable ordering and atomic page-error preservation OK');})().catch(error=>{console.error(error);process.exitCode=1});
