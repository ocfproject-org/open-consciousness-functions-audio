const assert = require('node:assert/strict');
const {surprisePool, chooseSurprise, createSurpriseHistory} = require('../site/assets/js/app.js');
const item = (id, edition = '1', format = 'mp3') => ({id, edition, assets: [{format, download_url: 'https://example.org/audio.mp3'}]});
const items = [item('a'), item('a', '2'), item('b'), item('c'), item('preparation-learning'), item('guide', '1', 'txt'), {id:'unsafe',assets:[{format:'mp3',download_url:'javascript:alert(1)'}]}];
assert.equal(surprisePool(items).size, 3);
assert.equal(chooseSurprise([], []), null);

let history = [];
for (let cycle = 0; cycle < 3; cycle++) {
  const seen = new Set();
  for (let i = 0; i < 3; i++) {
    const pick = chooseSurprise(items, history, () => 0);
    assert(!seen.has(pick.item.id)); seen.add(pick.item.id); history = pick.history;
  }
  assert.equal(seen.size, 3);
}
// Equal intervals belong to functions, regardless of edition count.
assert.equal(chooseSurprise(items, [], () => .4).item.id, 'b');
assert.equal(chooseSurprise(items, [], () => .8).item.id, 'c');
assert.equal(chooseSurprise(items, [], () => .2).item.edition, '1');
assert.equal(chooseSurprise([item('a'),item('a','2')], [], () => .8).item.edition, '2');
assert.deepEqual(chooseSurprise(items, ['a','removed',7], () => 0).history, ['a','b']);
assert.equal(chooseSurprise(items, {bad:true}, () => 0).history.length, 1);
const saved = new Map(); const storage = {getItem:k=>saved.get(k), setItem:(k,v)=>saved.set(k,v)};
const choose = createSurpriseHistory(()=>storage);
const first = choose(items); const second = createSurpriseHistory(()=>storage)(items);
assert.notEqual(first.id, second.id);
saved.set('ocf-surprise-history:v1', '{corrupt'); assert(choose(items));
saved.set('ocf-surprise-history:v1', 'null'); assert(choose(items));
for (const unavailable of [()=>{throw Error('denied');}, ()=>({getItem:()=> '[]',setItem:()=>{throw Error('quota');}})]) {
 const next = createSurpriseHistory(unavailable); const ids = new Set();
 for(let i=0;i<3;i++) ids.add(next(items).id);
 assert.equal(ids.size,3);
}
assert.equal(chooseSurprise([item('only')], ['only']).item.id,'only');
assert.equal(chooseSurprise([...items,item('new')], ['a','b','c'], () => 0).item.id,'new');
assert.deepEqual(chooseSurprise([item('a'),item('b')], ['a','removed'], () => 0).history,['a','b']);
console.log('surprise selection/history: all assertions passed');
const formats=[item('mp3-only'),item('flac-only','1','flac')];
assert.equal(chooseSurprise(formats,[],()=>0,'flac').item.id,'flac-only');
assert.equal(surprisePool([item('mp3-only')],'flac').size,0);
assert.equal(chooseSurprise([item('mp3-only')],[],()=>0,'flac'),null);
console.log('Explicit format selection never falls back: passed');
