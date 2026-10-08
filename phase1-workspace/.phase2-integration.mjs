import { createIDosGamesClient } from '@idosgames/core';
import { NoopPlatformAdapter } from '@idosgames/core/platform';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const platform=new NoopPlatformAdapter();platform.getDeviceID=()=>`astanavis-p2-${randomUUID()}`;
const client=createIDosGamesClient({titleID:'1ZPS8DLV-DEV',platform,clientPlatform:'Web',loginViews:'none',throttleMs:0});
const login=await client.auth.loginWithDeviceID();if(!login.ok)throw Error(login.error);
async function rpc(name,args={}){const r=await client.cloudCode.execute(name,args,'Specific',8);if(!r.ok)throw Error(r.error);if(r.data.Error)throw Error(JSON.stringify(r.data.Error));return r.data.FunctionResult;}
async function run(gameId,score){const session=await rpc('astanavisBeginSession',{gameId});await new Promise(r=>setTimeout(r,2200));const first=await rpc('astanavisCompleteSession',{gameId,sessionId:session.sessionId,score});const replay=await rpc('astanavisCompleteSession',{gameId,sessionId:session.sessionId,score});assert.equal(replay.alreadyProcessed,true);return first;}
const first=await run('orb-merge',100000);assert.equal(first.rewards.vis,50);
const second=await run('color-flow',0);assert.equal(second.rewards.vis,20);
const third=await run('cake-sort',1000);assert.equal(third.rewards.vis,30);
await client.user.getUserInventory();console.log(JSON.stringify({first,second,third,vis:client.data.user.getVirtualCurrencyAmount('VIS')}));process.exit(0);
