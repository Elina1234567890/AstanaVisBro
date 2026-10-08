import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const collections=new Map(), receipts=new Set();let vis=1000,failAfterGrant=true;
const good=Data=>({Success:true,Data});
const key=(c,id)=>c+':'+id;
const server={
 GetDataItem(c,id){const Item=collections.get(key(c,id));return Item?good({Item}):{Success:false,Error:'DATA_ITEM_NOT_FOUND'};},
 CreateDataItem(c,Data,id,OwnerUserID){const k=key(c,id);if(!collections.has(k))collections.set(k,{ItemID:id,OwnerUserID,Data:{...Data}});return good({Item:collections.get(k)});},
 QueryDataItems(c,q){return good({Items:[...collections.entries()].filter(([k,x])=>k.startsWith(c+':')&&x.Data.status==='pending'&&x.Data.userId==='u').map(([,x])=>x).slice(0,100)});},
 ApplyResourceOperation(r){if(!receipts.has(r.Reason)){vis+=r.Operation.Grant.Standard.Entries[0].Amount;receipts.add(r.Reason);}return good({});},
 UpdateDataItem(c,id,s){if(failAfterGrant){failAfterGrant=false;return {Success:false,Error:'SIMULATED_WRITE_FAILURE'};}Object.assign(collections.get(key(c,id)).Data,s.Set);return good({Item:collections.get(key(c,id))});}
};
const context=vm.createContext({handlers:{},server});vm.runInContext(fs.readFileSync('src/modules/astanavis-progress/server/balance.js','utf8'),context);
vm.runInContext(fs.readFileSync('src/modules/astanavis-progress/server/handlers.js','utf8'),context);
collections.set(key('astanavis-sessions','s'),{ItemID:'s',OwnerUserID:'u',Data:{userId:'u',gameId:'orb-merge',startedAt:Date.now()-3000}});
const input={gameId:'orb-merge',score:100000,sessionId:'s'};
assert.throws(()=>context.handlers.astanavisCompleteSession(input,{UserID:'u'}),/SIMULATED_WRITE_FAILURE/);assert.equal(vis,1120);
const recovered=context.handlers.astanavisRecoverPendingResults({}, {UserID:'u'});assert.equal(vis,1120);assert.equal(recovered.recovered,1);
const replay=context.handlers.astanavisCompleteSession(input,{UserID:'u'});assert.equal(replay.alreadyProcessed,true);assert.equal(replay.rewards.vis,120);assert.equal(vis,1120);
assert.throws(()=>context.handlers.astanavisCompleteSession({...input,score:1},{UserID:'u'}),/RESULT_MISMATCH/);
assert.throws(()=>context.handlers.astanavisCompleteSession({...input,visReward:99999},{UserID:'u'}),/CLIENT_REWARD_FIELDS_NOT_ALLOWED/);
console.log('PASS: cap grant, failure after grant, recovery, replay idempotency, result mismatch and client reward injection');
