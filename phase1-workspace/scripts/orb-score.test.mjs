import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
function loadTS(path, imports={}) {
  const source=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};vm.runInNewContext(source,{exports,require:name=>imports[name],console});return exports;
}
const {ORB_BALANCE}=loadTS('src/modules/mini-game/orbBalance.ts');
const {OrbScore,mergeCause}=loadTS('src/modules/mini-game/orbScore.ts',{'./orbBalance':{ORB_BALANCE}});
const {findMergeGroups}=loadTS('src/modules/mini-game/orbConfig.ts');
for (const [tier,base] of Object.entries(ORB_BALANCE.tierScore)) {
  const score=new OrbScore();const r=score.merge(Number(tier),1,0);
  assert.equal(r.earned,base);assert.equal(r.score,base+(ORB_BALANCE.milestoneScore[tier]??0));
}
for(const count of [3,4,6]) {
 const nodes=Array.from({length:count},(_,i)=>({id:i,tier:1}));
 const edges=Array.from({length:count-1},(_,i)=>({a:i,b:i+1}));
 const groups=findMergeGroups(nodes,edges.concat(edges));
 assert.equal(groups.length,Math.floor(count/3));
 assert.equal(new Set(groups.flatMap(g=>g.ids)).size,groups.length*3);
}
let state=new OrbScore();
assert.equal(state.merge(2,1,0).earned,10);
assert.equal(state.merge(2,1,1500).earned,12,'inclusive combo window');
assert.equal(state.expire(3000),2);
assert.equal(state.expire(3001),0);
assert.equal(state.merge(2,1,3001).earned,10);
state=new OrbScore();
for(let i=0;i<20;i++) { const r=state.merge(5,i+1,i*10);assert.ok(r.multiplier<=3);if(i>5)assert.equal(r.multiplier,3); }
assert.equal(state.merge(5,1,201).multiplier,2,'combo cap');
state=new OrbScore();
for(let i=1;i<=6;i++) assert.equal(state.merge(2,i,i*2000).multiplier,ORB_BALANCE.chain.multipliers[Math.min(i-1,4)]);
state=new OrbScore();
for(let i=0;i<4;i++) state.merge(5,1,i);
assert.equal(state.score,140+168+196+224+150);
assert.equal(state.milestones.size,1);
state=new OrbScore();state.merge(3,1,0);assert.equal(state.merge(3,2,1).earned,38,'round 37.5');
assert.equal(new OrbScore().score,0,'restart');
assert.equal(new OrbScore().milestones.size,0);
const cause=mergeCause([{actionId:1,depth:0},{actionId:0,depth:4}],1);
assert.equal(cause.depth,1);assert.equal(mergeCause([cause],1).depth,2);
assert.equal(mergeCause([cause],2).depth,1,'new shot starts new chain');
const collections=new Map(),receipts=new Set();let vis=0,failAfterGrant=false;
const good=Data=>({Success:true,Data});const key=(c,id)=>c+':'+id;
const server={
 GetDataItem(c,id){const Item=collections.get(key(c,id));return Item?good({Item}):{Success:false,Error:'DATA_ITEM_NOT_FOUND'};},
 CreateDataItem(c,Data,id,OwnerUserID){const k=key(c,id);if(!collections.has(k))collections.set(k,{ItemID:id,OwnerUserID,Data:{...Data}});return good({Item:collections.get(k)});},
 QueryDataItems(){return good({Items:[...collections.values()].filter(x=>x.Data.status==='pending')});},
 ApplyResourceOperation(r){if(!receipts.has(r.Reason)){vis+=r.Operation.Grant.Standard.Entries[0].Amount;receipts.add(r.Reason);}return good({});},
 UpdateDataItem(c,id,s){if(failAfterGrant){failAfterGrant=false;return {Success:false,Error:'SIMULATED_WRITE_FAILURE'};}Object.assign(collections.get(key(c,id)).Data,s.Set);return good({});}
};
const context=vm.createContext({handlers:{},server});
for(const file of ['balance.js','handlers.js'])vm.runInContext(fs.readFileSync('src/modules/astanavis-progress/server/'+file,'utf8'),context);
for(const [score,reward] of [[0,20],[199,20],[200,25],[399,25],[400,30],[1000,45],[2000,70],[4000,120],[100000,120],[Number.MAX_SAFE_INTEGER,120]])assert.equal(context.avReward(score),reward);
function input(id,score=4000){collections.set(key('astanavis-sessions',id),{ItemID:id,OwnerUserID:'u',Data:{userId:'u',gameId:'orb-merge',startedAt:Date.now()-3000}});return {gameId:'orb-merge',score,sessionId:id};}
const result=input('s');const first=context.handlers.astanavisCompleteSession(result,{UserID:'u'});
assert.equal(first.rewards.vis,120);assert.equal(vis,120);
assert.equal(context.handlers.astanavisCompleteSession(result,{UserID:'u'}).alreadyProcessed,true);assert.equal(vis,120);
assert.throws(()=>context.handlers.astanavisCompleteSession({...result,score:1},{UserID:'u'}),/RESULT_MISMATCH/);
assert.throws(()=>context.handlers.astanavisCompleteSession({...result,visReward:999},{UserID:'u'}),/CLIENT_REWARD_FIELDS/);
assert.throws(()=>context.handlers.astanavisCompleteSession(result,{UserID:'other'}),/RESULT_MISMATCH/);
const pending=input('pending');failAfterGrant=true;
assert.throws(()=>context.handlers.astanavisCompleteSession(pending,{UserID:'u'}),/SIMULATED_WRITE_FAILURE/);assert.equal(vis,240);
context.handlers.astanavisRecoverPendingResults({}, {UserID:'u'});assert.equal(vis,240,'recovery never grants twice');
for(const score of [-1,.5,Infinity,NaN,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>context.handlers.astanavisCompleteSession({...result,score},{UserID:'u'}),/INVALID_RESULT/);
const ui=fs.readFileSync('src/modules/mini-game/OrbMerge.tsx','utf8');
assert.ok(ui.includes('client.leaderboard.submitScore(board.LeaderboardID, result.score)'));
assert.ok(ui.includes('new OrbScore()'));
assert.ok(ui.includes('finishGame(scoreRef.current)'));
console.log('PASS: tier table, disjoint triples, same-frame groups, combo boundary/reset/cap, ancestry chain, combined cap, milestones, rounding, restart, VIS boundaries, duplicate session, ownership, injection, recovery, result/leaderboard wiring');
