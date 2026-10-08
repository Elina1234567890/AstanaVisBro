import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const collections=new Map(), receipts=new Set();let vis=1000;
const good=Data=>({Success:true,Data});const key=(c,id)=>c+':'+id;
const server={
 GetDataItem(c,id){const Item=collections.get(key(c,id));return Item?good({Item}):{Success:false,Error:'DATA_ITEM_NOT_FOUND'};},
 CreateDataItem(c,Data,id,OwnerUserID){const itemID=id??'session-'+(collections.size+1);const k=key(c,itemID);if(!collections.has(k))collections.set(k,{ItemID:itemID,OwnerUserID,Data:{...Data}});return good({Item:collections.get(k)});},
 UpdateDataItem(c,id,s){const x=collections.get(key(c,id));Object.assign(x.Data,s.Set);return good({Item:x});},
 ApplyResourceOperation(r){if(!receipts.has(r.Reason)){vis+=r.Operation.Grant.Standard.Entries[0].Amount;receipts.add(r.Reason);}return good({});},
 QueryDataItems(c,q){return good({Items:[...collections.entries()].filter(([k,x])=>k.startsWith(c+':')&&x.Data.status==='pending'&&x.Data.userId==='u').map(([,x])=>x)});}
};
const context=vm.createContext({handlers:{},server});vm.runInContext(fs.readFileSync('src/modules/astanavis-progress/server/balance.js','utf8'),context);
vm.runInContext(fs.readFileSync('src/modules/astanavis-progress/server/handlers.js','utf8'),context);
const user={UserID:'u'};
assert.throws(()=>context.handlers.astanavisBeginSession({gameId:'fake'},user),/INVALID_GAME/);
const s=context.handlers.astanavisBeginSession({gameId:'color-flow'},user);
assert.throws(()=>context.handlers.astanavisCompleteSession({gameId:s.gameId,sessionId:s.sessionId,score:30},user),/INVALID_SESSION_DURATION/);
const session=collections.get(key('astanavis-sessions',s.sessionId));session.Data.startedAt-=2500;
assert.throws(()=>context.handlers.astanavisCompleteSession({gameId:s.gameId,sessionId:s.sessionId,score:Number.MAX_SAFE_INTEGER+1},user),/INVALID_RESULT/);
assert.throws(()=>context.handlers.astanavisCompleteSession({gameId:s.gameId,sessionId:s.sessionId,score:30,visReward:99999},user),/CLIENT_REWARD_FIELDS_NOT_ALLOWED/);
assert.throws(()=>context.handlers.astanavisCompleteSession({gameId:s.gameId,sessionId:s.sessionId,score:30}, {UserID:'other'}),/SESSION_NOT_OWNED/);
const first=context.handlers.astanavisCompleteSession({gameId:s.gameId,sessionId:s.sessionId,score:1000},user);assert.equal(first.rewards.vis,45);assert.equal(first.alreadyProcessed,false);assert.equal(vis,1045);
const replay=context.handlers.astanavisCompleteSession({gameId:s.gameId,sessionId:s.sessionId,score:1000},user);assert.equal(replay.alreadyProcessed,true);assert.equal(vis,1045);
const next=context.handlers.astanavisBeginSession({gameId:'cake-sort'},user);collections.get(key('astanavis-sessions',next.sessionId)).Data.startedAt-=2500;
const second=context.handlers.astanavisCompleteSession({gameId:next.gameId,sessionId:next.sessionId,score:0},user);assert.equal(second.rewards.vis,20);assert.equal(vis,1065);
assert.equal(context.handlers.astanavisRecoverPendingResults({},user).recovered,0);
console.log('PASS: invalid game/score/duration/owner/client reward rejected; first and second sessions reward; same session retry gives no second VIS; recovery scan');
