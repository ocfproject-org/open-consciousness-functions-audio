const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');globalThis.crypto??=webcrypto;
const model=require('../site/assets/js/affirmations-state.js');
const {Store,parsePersonalBackup,digest,KEY}=require('../site/assets/js/learned.js');
class Storage{constructor(){this.map=new Map();this.writes=0;}get length(){return this.map.size;}key(i){return [...this.map.keys()][i];}getItem(k){return this.map.get(k)??null;}setItem(k,v){this.writes++;this.map.set(k,v);}removeItem(k){this.map.delete(k);}}
(async()=>{
 const storage=new Storage(),a=new Store(storage,{}),b=new Store(storage,{});
 const line={id:`custom:${crypto.randomUUID()}`,text:'<img src=x onerror=alert(1)> javascript:alert(1)',category:'calm'};
 assert.equal(model.data.lines.length,36);assert.equal(new Set(model.data.lines.map(l=>l.id)).size,36);
 assert.deepEqual(a.readAffirmations(),model.empty());assert.equal(storage.length,0);assert.throws(()=>a.saveCustom(line,null,null),/changed/);
 a.enable();const epoch=a.config().epoch;a.saveCustom(line,null,epoch);a.favoriteAffirmation(line.id,true,epoch);b.favoriteAffirmation(model.data.lines[0].id,true,epoch);
 assert.equal(a.readAffirmations().favorites.length,2);assert.deepEqual(b.readAffirmations().custom,[line]);
 const backup={schema:3,records:[],flags:[],affirmations:a.readAffirmations()};
 const parsed=await parsePersonalBackup(JSON.stringify(backup),{});await a.mergePersonal(parsed);assert.equal(a.readAffirmations().custom.length,1);
 for(const schema of [1,2]){const beforeWrites=storage.writes;const old={schema,records:[],...(schema===2?{flags:[]}:{} )};await a.mergePersonal(await parsePersonalBackup(JSON.stringify(old),{}));assert.equal(a.readAffirmations().custom.length,1);assert.equal(a.readAffirmations().favorites.length,2);assert.equal(storage.writes,beforeWrites);}
 const changed={...line,text:'An alternative imported line.'};const conflicted={...backup,affirmations:{custom:[changed],favorites:[line.id]}};
 await a.mergePersonal(await parsePersonalBackup(JSON.stringify(conflicted),{}));assert.equal(a.readAffirmations().custom.length,2);assert.equal(a.readAffirmations().favorites.length,3);assert.deepEqual(a.readAffirmations().custom.find(l=>l.id===line.id),line);
 await a.mergePersonal(await parsePersonalBackup(JSON.stringify(conflicted),{}));assert.equal(a.readAffirmations().custom.length,2);
 b.saveCustom({...line,text:'Edited in another tab'},line,epoch);assert.throws(()=>a.saveCustom({...line,text:'Stale edit'},line,epoch),/another tab/);assert.throws(()=>a.removeCustom(line,epoch),/another tab/);
 const before=JSON.stringify(a.readAffirmations());
 for(const value of [null, [], {...backup,schema:4}, {...backup,affirmations:{custom:[{...line,url:'https://example.org'}],favorites:[]}}, {...backup,affirmations:{custom:[{...line,text:'x'.repeat(501)}],favorites:[]}}, {...backup,affirmations:{custom:[{...line,text:'\n'}],favorites:[]}}, {...backup,affirmations:{custom:[{...line,category:'unknown'}],favorites:[]}}, {...backup,affirmations:{custom:[line,line],favorites:[]}}, {...backup,affirmations:{custom:[],favorites:[line.id]}}, {...backup,affirmations:{custom:[],favorites:['starter:unknown:1']}}, {...backup,affirmations:{custom:[],favorites:[model.data.lines[0].id,model.data.lines[0].id]}}]){await assert.rejects(parsePersonalBackup(JSON.stringify(value),{}));assert.equal(JSON.stringify(a.readAffirmations()),before);}
 const tooMany=Array.from({length:201},()=>({...line,id:`custom:${crypto.randomUUID()}`}));assert.throws(()=>model.validate({custom:tooMany,favorites:[]}));
 const full={custom:tooMany.slice(0,200),favorites:[]};await assert.rejects(model.merge(full,{custom:[line],favorites:[]},digest));
 const pending=a.mergePersonal(parsed);b.reset();await assert.rejects(pending,/another tab|Enable/);assert.deepEqual(a.readAffirmations(),model.empty());assert.throws(()=>a.saveCustom(line,null,epoch),/changed/);
 const denied=new Store({getItem(){throw Error('blocked');}},{});denied.enable();denied.saveCustom(line,null,denied.config().epoch);assert.equal(denied.readAffirmations().custom.length,1);assert.match(denied.warning,/only in memory/);
 const limited=new Storage(),quota=new Store(limited,{});quota.enable();quota.saveCustom(line,null,quota.config().epoch);quota.readAffirmations();limited.setItem=()=>{throw Error('full');};quota.saveCustom({...line,id:`custom:${crypto.randomUUID()}`},null,quota.config().epoch);assert.equal(quota.readAffirmations().custom.length,2);assert.match(quota.warning,/only in memory/);assert.equal(new Store(limited,{}).readAffirmations().custom.length,1);
 const malformed=new Storage(),bad=new Store(malformed,{});bad.enable();malformed.setItem(`${KEY}:affirmation:${bad.config().epoch}:line:bad`,'{');assert.deepEqual(bad.readAffirmations(),model.empty());assert.match(bad.warning,/corrupt/);assert.equal(malformed.length,2);assert.throws(()=>bad.saveCustom(line,null,bad.config().epoch),/unreadable/);assert.equal(malformed.length,2);
 console.log('Affirmations: bounds, stable merges, legacy preservation, malicious text, concurrent edits/reset and storage failure passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
