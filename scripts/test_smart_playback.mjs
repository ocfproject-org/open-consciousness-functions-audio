import assert from 'node:assert/strict';
import {Composer, makePlan} from '../site/experiments/smart-playback/composer.mjs';
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
 console.log('PASS smart playback plan, media clock, inactive-slot guard, mute/ramp, overlap resume, cancellation and fallback');
} finally {p.destroy();}
