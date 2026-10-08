import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { findMergeGroups } from './src/modules/mini-game/orbConfig.ts';

const nodes=(count,tier=1,start=1)=>Array.from({length:count},(_,i)=>({id:start+i,tier}));
const chain=(count,start=1)=>Array.from({length:count-1},(_,i)=>({a:start+i,b:start+i+1}));
const ids=(groups)=>groups.map(g=>g.ids);

assert.deepEqual(ids(findMergeGroups(nodes(2),chain(2))),[],'two equal orbs do not merge');
assert.deepEqual(ids(findMergeGroups(nodes(3),chain(3))),[[1,2,3]],'three connected equal-tier orbs merge');
assert.deepEqual(ids(findMergeGroups(nodes(4),chain(4))),[[1,2,3]],'four leave one unmerged');
assert.deepEqual(ids(findMergeGroups(nodes(6),chain(6))),[[1,2,3],[4,5,6]],'six resolve into two disjoint triples');
assert.deepEqual(ids(findMergeGroups([...nodes(3),...nodes(2,2,4)],[...chain(3),...chain(2,4)])),[[1,2,3]],'different tiers never merge');
assert.deepEqual(ids(findMergeGroups(nodes(6),[...chain(6),{a:1,b:2},{a:2,b:3}])),[[1,2,3],[4,5,6]],'duplicate contacts cannot reuse an orb');

// A first triple upgrades to tier 2; joining it with two existing tier-2 orbs forms a chain merge.
const first=findMergeGroups(nodes(3,1),chain(3));
assert.equal(first[0].tier+1,2);
const chainReaction=findMergeGroups(nodes(3,2),chain(3));
assert.deepEqual(ids(chainReaction),[[1,2,3]],'upgraded tier can merge again in the next collision step');

const highTier=findMergeGroups(nodes(3,9),chain(3));
assert.equal(highTier[0].tier+1,10,'high tiers continue through the configured tier table');
assert.deepEqual(findMergeGroups(nodes(3,10),chain(3)),[],'maximum configured tier has no further merge');

// Exercise actual Matter.js contacts, then resolve all simultaneous contacts into disjoint triples.
const engine=Matter.Engine.create({enableSleeping:true});
engine.gravity.y=0;
const bodies=Array.from({length:6},(_,i)=>Matter.Bodies.circle(80+i*24,120,15,{restitution:0}));
Matter.Composite.add(engine.world,bodies);
let collisionEdges=[];
Matter.Events.on(engine,'collisionStart',(event)=>{collisionEdges=event.pairs.map(({bodyA,bodyB})=>({a:bodyA.id,b:bodyB.id}));});
Matter.Engine.update(engine,16);
assert.ok(collisionEdges.length>=3,'Matter reports concurrent orb contacts');
const physicalNodes=bodies.map((body)=>({id:body.id,tier:1}));
const physicalGroups=findMergeGroups(physicalNodes,collisionEdges);
assert.deepEqual(physicalGroups.flatMap(group=>group.ids).sort((a,b)=>a-b),bodies.map(body=>body.id).sort((a,b)=>a-b),'simultaneous Matter contacts use each body once');
assert.equal(new Set(physicalGroups.flatMap(group=>group.ids)).size,6);
Matter.Engine.clear(engine);
console.log('PASS: two, three, four, six, mixed tiers, duplicate contacts, chain reaction, high tier, max tier');
