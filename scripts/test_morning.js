const assert=require('node:assert/strict');const {webcrypto}=require('node:crypto');globalThis.crypto??=webcrypto;
const model=require('../site/assets/js/morning-state.js');
const {Store,KEY,digest,canonical,parsePersonalBackup,validateRecord}=require('../site/assets/js/learned.js');
class Storage{constructor(){this.map=new Map();this.writes=0;}get length(){return this.map.size;}key(i){return [...this.map.keys()][i];}getItem(k){return this.map.get(k)??null;}setItem(k,v){this.writes++;this.map.set(k,v);}removeItem(k){this.map.delete(k);}}
(async()=>{
 const fields={};for(const [id,role,cue] of [['OCF-CMD-BOD-010-PRIMARY','activation','Plus Food More'],['OCF-CMD-BOD-010-FOOD-LESS','mode','Plus Food Less'],['OCF-CMD-COG-004-RECALL','retrieval','Plus Recall']]){fields[`command.${id}.role`]=role;fields[`command.${id}.spoken_cue`]=cue;}
 const snapshot={schema:1,fields},guide={commit:'c'.repeat(40),locale:'en-US',fingerprint:await digest(snapshot),snapshot};const subjects={'OCF-BOD-010':{title:'Nutricia',guide}};
 assert.equal(model.commands(guide).length,2);assert(!model.commands(guide).some(c=>c.role==='retrieval'));
 const rows=model.commands(guide).map(c=>({id:crypto.randomUUID(),kind:'function',subject:'OCF-BOD-010',command:c.command,guide,origin:'learned'}));
 assert.notEqual(rows[0].command,rows[1].command);await model.verify(rows,subjects,validateRecord);
 // Distinct command identities survive even if their display/spoken cue strings coincide.
 const same=structuredClone(guide);same.snapshot.fields['command.OCF-CMD-BOD-010-FOOD-LESS.spoken_cue']='Plus Food More';assert.equal(model.commands(same).length,2);
 const revised={...rows[0],guide:{...guide,commit:'a'.repeat(40)},origin:'current'};
 assert.equal(model.choiceKey(rows[0]),model.choiceKey(revised));
 assert.notEqual(model.choiceKey(rows[0]),model.choiceKey({...rows[1],guide:same}));
 const changed=structuredClone(revised);changed.guide.snapshot.fields['command.OCF-CMD-BOD-010-PRIMARY.spoken_cue']='Different cue';assert.notEqual(model.choiceKey(rows[0]),model.choiceKey(changed));
 const originals=Object.entries(model.historical).map(([command,entry])=>({id:crypto.randomUUID(),kind:'hplus',command,text:entry.text}));
 const mixed={schema:5,records:[],flags:[],affirmations:{custom:[],favorites:[]},routine:[rows[0],...originals]};
 assert.deepEqual((await parsePersonalBackup(JSON.stringify(mixed),subjects)).routine,mixed.routine);
 assert.equal(model.backupSchema(mixed.routine),5);assert.equal(model.backupSchema(rows),4);
 await assert.rejects(parsePersonalBackup(JSON.stringify({...mixed,schema:4}),subjects));
 for(const bad of [{...originals[0],text:'Plus Clear'},{...originals[0],command:['hplus-off-loading-1988']},{...originals[0],source:'https://example.com'}])await assert.rejects(parsePersonalBackup(JSON.stringify({...mixed,routine:[bad]}),subjects));
 assert.equal((await model.merge(mixed.routine,mixed.routine,subjects,digest,canonical)).length,3);
 const storage=new Storage(),a=new Store(storage,subjects),b=new Store(storage,subjects);assert.deepEqual(a.readRoutine().rows,[]);assert.equal(storage.length,0);a.enable();const epoch=a.config().epoch;
 await a.saveRoutine(rows,a.readRoutine(),epoch);assert.deepEqual(b.readRoutine().rows,rows);
 const stale=a.readRoutine();await b.saveRoutine([...rows].reverse(),b.readRoutine(),epoch);await assert.rejects(a.saveRoutine(rows,stale,epoch),/changed/);
 const custom={id:crypto.randomUUID(),kind:'custom',text:'<img src=x onerror=alert(1)> javascript:alert(1)'};const backup={schema:4,records:[],flags:[],affirmations:{custom:[],favorites:[]},routine:[...rows,custom]};
 const parsed=await parsePersonalBackup(JSON.stringify(backup),subjects);await a.mergePersonal(parsed,epoch);assert.deepEqual(a.readRoutine().rows.map(r=>r.id),[rows[1].id,rows[0].id,custom.id]);
 const before=canonical(a.readRoutine().rows);await a.mergePersonal(parsed,epoch);assert.equal(canonical(a.readRoutine().rows),before);
 const conflict=structuredClone(backup);conflict.routine=[{...custom,text:'Alternative'}];await a.mergePersonal(await parsePersonalBackup(JSON.stringify(conflict),subjects),epoch);assert.equal(a.readRoutine().rows.length,4);await a.mergePersonal(await parsePersonalBackup(JSON.stringify(conflict),subjects),epoch);assert.equal(a.readRoutine().rows.length,4);
 for(const invalid of [[{...custom,text:['bad']}],[{...custom,url:'https://bad'}],[{...rows[0],command:'OCF-CMD-COG-004-RECALL'}],[{...rows[0],guide:{...guide,fingerprint:'0'.repeat(64)}}],Array(51).fill(custom)])await assert.rejects(parsePersonalBackup(JSON.stringify({...backup,routine:invalid}),subjects));
 const saved=a.readRoutine();for(const legacy of [{schema:1,records:[]},{schema:2,records:[],flags:[]},{schema:3,records:[],flags:[],affirmations:{custom:[],favorites:[]}}]){const parsed=await parsePersonalBackup(JSON.stringify(legacy),subjects);assert.equal(parsed.routine,null);await a.mergePersonal(parsed,epoch);assert.deepEqual(a.readRoutine(),saved);}
 // Corrupt routine blocks schema4 before unrelated writes, but not legacy scopes.
 const key=`${KEY}:routine:${epoch}`;storage.setItem(key,'{');const writes=storage.writes;
 await assert.rejects(a.mergePersonal({...parsed,flags:[{subject:'OCF-BOD-010',kind:'favorite'}]},epoch),/unreadable/);assert.equal(storage.writes,writes);assert.equal(storage.getItem(key),'{');
 await a.mergePersonal(await parsePersonalBackup(JSON.stringify({schema:2,records:[],flags:[{subject:'OCF-BOD-010',kind:'favorite'}]}),subjects),epoch);assert.equal(a.readFlags().length,1);assert.equal(storage.getItem(key),'{');
 a.reset();assert.equal(storage.getItem(key),null);a.enable();await assert.rejects(a.saveRoutine(rows,{revision:null,rows:[]},epoch),/changed/);
 const blocked=new Store({getItem(){throw Error('blocked');}},subjects);blocked.enable();await blocked.saveRoutine([custom],blocked.readRoutine(),blocked.config().epoch);assert.equal(blocked.readRoutine().rows.length,1);assert.match(blocked.warning,/only in memory/);
 const quotaStorage=new Storage(),quota=new Store(quotaStorage,subjects);quota.enable();await quota.saveRoutine(rows,quota.readRoutine(),quota.config().epoch);const old=quota.readRoutine();quotaStorage.setItem=()=>{throw Error('quota');};await quota.saveRoutine([...rows,custom],old,quota.config().epoch);assert.equal(quota.readRoutine().rows.length,3);assert.equal(new Store(quotaStorage,subjects).readRoutine().rows.length,2);assert.match(quota.warning,/only in memory/);
 // A cross-tab interruption after unrelated additions is explicit, never reported as full success.
 const partialStore=new Store(new Storage(),subjects);partialStore.enable();const partialEpoch=partialStore.config().epoch;
 const realSave=partialStore.saveRoutine.bind(partialStore);partialStore.saveRoutine=async()=>{throw Error('Concurrent routine changed');};
 await assert.rejects(partialStore.mergePersonal({...parsed,flags:[{subject:'OCF-BOD-010',kind:'favorite'}]},partialEpoch),/Import interrupted after adding 0 learned versions, 1 personal marks/);
 assert.equal(partialStore.lastImportResult.flags,1);assert.equal(partialStore.readFlags().length,1);assert.equal(partialStore.readRoutine().rows.length,0);partialStore.saveRoutine=realSave;
 const twin={...custom,id:crypto.randomUUID()};const twins=await model.merge([], [custom,twin], subjects,digest,canonical);assert.equal(twins.length,2);assert.equal((await model.merge(twins,[custom,twin],subjects,digest,canonical)).length,2);
 const pending=blocked.saveRoutine(rows,blocked.readRoutine(),blocked.config().epoch);blocked.reset();await assert.rejects(pending,/changed/);
 assert(!model.eligible(rows[0],{'OCF-BOD-010':{guide:{snapshot:{schema:1,fields:{}}}}}));
 console.log('Morning: command identities/modes, retrieval exclusion, snapshots, atomic order, conflicts, backups 1–4, corruption preflight, quota and reset passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
