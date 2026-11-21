import assert from 'node:assert/strict';
import {Composer, GainEnvelope, makePlan} from '../site/experiments/smart-playback/composer.mjs';
globalThis.document = {hidden:false,addEventListener(){},removeEventListener(){}};
const operations=[];
class Gain {
 constructor(){this.value=0;}
 cancelScheduledValues(t){operations.push(['cancel',t]);}
 cancelAndHoldAtTime(t){operations.push(['hold',t]);}
 setValueAtTime(v,t){this.value=v;operations.push(['set',v,t]);}
 linearRampToValueAtTime(v,t){operations.push(['ramp',v,t]);}
 setValueCurveAtTime(v,t,d){assert(v.every(Number.isFinite));assert(d>0);operations.push(['curve',v[0],v.at(-1),t,d]);}
}
globalThis.AudioContext=class {
 constructor(){this.currentTime=10;this.state='running';this.destination={};}
 createMediaElementSource(){return {connect(){}};}
 createGain(){return {gain:new Gain(),connect(){}};}
 async resume(){} async close(){}
};
function media(){return {paused:true,currentTime:0,readyState:4,seeking:false,load(){},removeAttribute(){},pause(){this.paused=true;},async play(){operations.push(['play']);this.paused=false;}};}
assert.throws(()=>makePlan(10,[{from:NaN,to:3}]));assert.throws(()=>makePlan(10,[{from:3,to:11}]));
const p=new Composer([media(),media()]);
try {
 await p.load('https://example.invalid/fixture.mp3',[{from:5,to:10}]);
 await p.seek(2);await p.play();assert(p.running);assert(p.media[0].currentTime===2);
 assert(operations.findIndex(x=>x[0]==='set'&&x[1]===0)<operations.findIndex(x=>x[0]==='play'));
 p.media[0].currentTime=3;assert.equal(p.current(),3);
 p.ctx.currentTime=30;assert.equal(p.current(),3,'virtual time does not advance when media stalls');
 await assert.rejects(p.prepare({n:2,from:20},p.generation),/active stream/);
 const saved=p.current();await p.pause();assert(!p.running&&p.media.every(x=>x.paused));assert.equal(p.current(),saved);assert(operations.some(x=>x[0]==='hold'));assert(operations.some(x=>x[0]==='ramp'&&x[1]===0));
 await p.seek(4.9);await p.play();assert.equal(p.active(p.t).length,2);assert(operations.filter(x=>x[0]==='curve').length===2);
 await p.pause();const token=p.generation;p.generation++;await assert.rejects(p.ready(p.media[0],token),/Cancelled/);
 p.fallback('synthetic starvation');assert.equal(p.plan.saved,0);assert.equal(p.stats.fallbacks,1);assert(!p.running);
 await p.stopBarrier;
 p.plan=makePlan(1387.357641723356);p.leader=0;p.t=1387.2;p.clockOffset=.5;p.running=true;
 p.media[0].currentTime=1387.3;p.media[0].ended=false;
 await p.tick();assert(p.running,'estimated duration must not truncate the source ending');
 p.media[0].ended=true;await p.tick();assert(!p.running,'natural media end completes playback');
 console.log('PASS smart playback plan, media clock, inactive-slot guard, mute/ramp, overlap resume, cancellation and fallback');
} finally {p.destroy();}


// Reproduce the missing method on Android and hold during lead-in and overlap.
const param=new Gain();
param.cancelAndHoldAtTime=undefined;
const g=new GainEnvelope(param);
g.set(0,30);g.ramp(.4,30.012);g.curve([.4,.7,1],30.012,.2);
assert(Math.abs(g.valueAt(30.006)-.2)<.000001);
assert(Math.abs(g.valueAt(30.062)-.55)<.000001);
g.hold(30.062);
assert(Math.abs(operations.at(-1)[1]-.55)<.000001);
g.ramp(0,30.074);
assert.equal(g.valueAt(31),0);
const priorCreate=AudioContext.prototype.createGain;
AudioContext.prototype.createGain=function(){const node=priorCreate.call(this);node.gain.cancelAndHoldAtTime=undefined;return node};
const compat=new Composer([media(),media()]);
try{
 await compat.load('https://example.invalid/fixture.mp3',[{from:5,to:10}]);
 await compat.seek(4.9); await compat.play(); assert(compat.running);assert(compat.nodes.every(x=>!x.envelope.native));
 compat.ctx.currentTime+=.02;await compat.pause();assert(compat.media.every(x=>x.paused));
 await compat.play();assert(compat.running);assert.equal(compat.stats.fallbacks,0);
 console.log('PASS missing cancelAndHoldAtTime: lead-in, overlap, pause and resume');
}finally{compat.destroy();AudioContext.prototype.createGain=priorCreate;}
