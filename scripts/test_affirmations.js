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
 const tooMany=Array.from({length:model.MAX_CUSTOM+1},()=>({...line,id:`custom:${crypto.randomUUID()}`}));assert.throws(()=>model.validate({custom:tooMany,favorites:[]}));
 const full={custom:tooMany.slice(0,model.MAX_CUSTOM),favorites:[]};await assert.rejects(model.merge(full,{custom:[line],favorites:[]},digest));
 const pending=a.mergePersonal(parsed);b.reset();await assert.rejects(pending,/another tab|Enable/);assert.deepEqual(a.readAffirmations(),model.empty());assert.throws(()=>a.saveCustom(line,null,epoch),/changed/);
 const denied=new Store({getItem(){throw Error('blocked');}},{});denied.enable();denied.saveCustom(line,null,denied.config().epoch);assert.equal(denied.readAffirmations().custom.length,1);assert.match(denied.warning,/only in memory/);
 const limited=new Storage(),quota=new Store(limited,{});quota.enable();quota.saveCustom(line,null,quota.config().epoch);quota.readAffirmations();limited.setItem=()=>{throw Error('full');};quota.saveCustom({...line,id:`custom:${crypto.randomUUID()}`},null,quota.config().epoch);assert.equal(quota.readAffirmations().custom.length,2);assert.match(quota.warning,/only in memory/);assert.equal(new Store(limited,{}).readAffirmations().custom.length,1);
 const malformed=new Storage(),bad=new Store(malformed,{});bad.enable();malformed.setItem(`${KEY}:affirmation:${bad.config().epoch}:line:bad`,'{');assert.deepEqual(bad.readAffirmations(),model.empty());assert.match(bad.warning,/corrupt/);assert.equal(malformed.length,2);assert.throws(()=>bad.saveCustom(line,null,bad.config().epoch),/unreadable/);assert.equal(malformed.length,2);
 // Legacy scopes must import learned data despite unrelated corrupt affirmation storage.
 const subjects={'preparation:human-plus':{},'OCF-TST-001':{}};
 const learned={id:crypto.randomUUID(),subject:'preparation:human-plus',markedAt:new Date().toISOString(),guide:null,recording:null,external:{edition:null,date:null}};
 const damagedStorage=new Storage(),legacyStore=new Store(damagedStorage,subjects);legacyStore.enable();
 const damagedKey=`${KEY}:affirmation:${legacyStore.config().epoch}:line:bad`;damagedStorage.setItem(damagedKey,'{');legacyStore.affirmationsBlocked=true;
 legacyStore.readAffirmations=()=>{throw Error('Legacy import must not inspect affirmations');};
 for(const schema of [1,2]) {
  const record={...learned,id:crypto.randomUUID(),external:{edition:`legacy-${schema}`,date:null}};
  const value={schema,records:[record],...(schema===2?{flags:[{subject:'OCF-TST-001',kind:'favorite'}]}:{})};
  const parsed=await parsePersonalBackup(JSON.stringify(value),subjects);assert.equal(parsed.affirmations,null);
  assert.equal(await legacyStore.mergePersonal(parsed),1);assert.equal(damagedStorage.getItem(damagedKey),'{');
 }
 assert.equal((await legacyStore.read()).length,2);assert.equal(legacyStore.readFlags().length,1);
 const preflightStorage=new Storage(),preflight=new Store(preflightStorage,subjects);preflight.enable();
 preflightStorage.setItem(`${KEY}:affirmation:${preflight.config().epoch}:line:bad`,'{');
 const incoming=await parsePersonalBackup(JSON.stringify({schema:3,records:[learned],flags:[{subject:'OCF-TST-001',kind:'favorite'}],affirmations:{custom:[line],favorites:[line.id]}}),subjects);
 const beforePreflight=preflightStorage.writes;await assert.rejects(preflight.mergePersonal(incoming),/unreadable/);assert.equal(preflightStorage.writes,beforePreflight);assert.equal((await preflight.read()).length,0);assert.equal(preflight.readFlags().length,0);
 const interruptedStorage=new Storage(),interruptedStore=new Store(interruptedStorage,subjects);interruptedStore.enable();
 const originalMerge=interruptedStore.merge.bind(interruptedStore);
 interruptedStore.merge=async(...args)=>{const count=await originalMerge(...args);interruptedStore.saveCustom(line,null,interruptedStore.config().epoch);return count;};
 await assert.rejects(interruptedStore.mergePersonal(incoming),error=>{assert.match(error.message,/Import interrupted after adding 1 learned versions, 1 personal marks/);assert.equal(error.importResult.learned,1);assert.equal(error.importResult.custom,0);return true;});
 assert.equal((await interruptedStore.read()).length,1);assert.equal(interruptedStore.readFlags().length,1);assert.deepEqual(interruptedStore.readAffirmations().custom,[line]);
 // Storage key enumeration order is unspecified and may change after unrelated writes.
 const orderedStorage=new Storage(),orderedStore=new Store(orderedStorage,subjects);orderedStore.enable();
 orderedStore.saveCustom(line,null,orderedStore.config().epoch);orderedStore.saveCustom({...line,id:`custom:${crypto.randomUUID()}`,text:'Another existing line'},null,orderedStore.config().epoch);
 const beforeOrder=JSON.stringify(orderedStore.readAffirmations());const orderedMerge=orderedStore.merge.bind(orderedStore);
 orderedStore.merge=async(...args)=>{const count=await orderedMerge(...args);orderedStorage.map=new Map([...orderedStorage.map].reverse());return count;};
 assert.equal(await orderedStore.mergePersonal({...incoming,affirmations:{custom:[],favorites:[]}}),1);assert.equal(JSON.stringify(orderedStore.readAffirmations()),beforeOrder);
 const quotaImportStorage=new Storage(),quotaSeed=new Store(quotaImportStorage,subjects);quotaSeed.enable();quotaSeed.setFlag('OCF-TST-001','todo',true);const quotaImport=new Store(quotaImportStorage,subjects);quotaImportStorage.setItem=()=>{throw Error('quota');};
 assert.equal(await quotaImport.mergePersonal(incoming),1);assert.deepEqual(quotaImport.lastImportResult,{learned:1,flags:1,custom:1,favorites:1,routine:0,memoryOnly:true});assert.equal((await quotaImport.read()).length,1);assert.equal(quotaImport.readAffirmations().custom.length,1);assert.equal(quotaImport.readFlags().length,2);
 const epochStore=new Store(new Storage(),subjects);epochStore.enable();const oldEpoch=epochStore.config().epoch;epochStore.reset();epochStore.enable();await assert.rejects(epochStore.mergePersonal(incoming,oldEpoch),/changed/);assert.equal((await epochStore.read()).length,0);
 for(const category of [['calm'],{},null,1,true])await assert.rejects(parsePersonalBackup(JSON.stringify({...backup,affirmations:{custom:[{...line,category}],favorites:[]}}),{}));
 await assert.rejects(parsePersonalBackup(JSON.stringify({schema:2,records:[],flags:[{subject:['OCF-TST-001'],kind:'favorite'}]}),subjects));
 await assert.rejects(parsePersonalBackup(JSON.stringify({schema:1,records:[{...learned,subject:['preparation:human-plus']}]}),subjects));
 console.log('Affirmations: bounds, stable merges, legacy preservation, malicious text, concurrent edits/reset and storage failure passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});

// Large collections retain every line and every marker, including storage order reversal.
(async()=>{
 const cats=Object.keys(model.data.categories);
 const rows=Array.from({length:1500},(_,i)=>({id:`custom:10000000-0000-0000-0000-${String(i).padStart(12,'0')}`,text:`Synthetic ${i}: café — naïve “choice” 東京 🌱`,category:cats[i%cats.length]}));
 const storage=new Storage(),store=new Store(storage,{});store.enable();const epoch=store.config().epoch;
 store.saveCustom(rows[1499],null,epoch);store.favoriteAffirmation(rows[1499].id,true,epoch);
 for(const count of [743,751]){
  const backup={schema:3,records:[],flags:[],affirmations:{custom:rows.slice(0,count),favorites:rows.slice(0,count).map(x=>x.id)}};
  const bytes='\ufeff'+JSON.stringify(backup,null,2).replace(/\n/g,'\r\n');
  // UTF-8 BOM and Windows line endings preserve all Unicode.
  const parsed=await parsePersonalBackup(bytes,{});await store.mergePersonal(parsed,epoch);await store.mergePersonal(parsed,epoch);
  assert.equal(store.readAffirmations().custom.length,count+1);assert.equal(store.readAffirmations().favorites.length,count+1);
 }
 const backup={schema:3,records:[],flags:[],affirmations:{custom:rows,favorites:[...rows.map(x=>x.id),...model.starterIds]}};
 await store.mergePersonal(await parsePersonalBackup(JSON.stringify(backup),{}),epoch);
 assert.equal(store.readAffirmations().custom.length,1500);assert.equal(store.readAffirmations().favorites.length,1536);assert.equal(storage.length,3037);
 storage.map=new Map([...storage.map].reverse());const current=store.readAffirmations();assert.equal(current.custom.length,1500);assert.equal(current.favorites.length,1536);assert.equal(store.affirmationsBlocked,false);
 const restored=new Store(new Storage(),{});restored.enable();await restored.mergePersonal(await parsePersonalBackup(JSON.stringify({...backup,affirmations:current}),{}),restored.config().epoch);assert.deepEqual(restored.readAffirmations(),current);
 const oldLine=store.readAffirmations().custom[0];store.saveCustom({...oldLine,text:'Edited synthetic row'},oldLine,epoch);const edited=new Store(storage,{}).readAffirmations();assert.equal(edited.custom.length,1500);assert.equal(edited.favorites.length,1536);assert.equal(edited.custom.find(x=>x.id===oldLine.id).text,'Edited synthetic row');
 const extra={...rows[0],id:'custom:20000000-0000-0000-0000-000000000000'};const writes=storage.writes;
 await assert.rejects(store.mergePersonal(await parsePersonalBackup(JSON.stringify({...backup,affirmations:{custom:[extra],favorites:[]}}),{}),epoch),/capacity/);assert.equal(storage.writes,writes);assert.equal(store.readAffirmations().custom.length,1500);
 await assert.rejects(parsePersonalBackup(' '.repeat(2*1024*1024+1),{}));
 const quotaStorage=new Storage(),quotaStore=new Store(quotaStorage,{});quotaStore.enable();quotaStore.saveCustom(rows[1499],null,quotaStore.config().epoch);const nativeSet=quotaStorage.setItem.bind(quotaStorage);quotaStorage.setItem=(k,v)=>{if(quotaStorage.writes>800)throw Error('quota');nativeSet(k,v);};
 const subset=await parsePersonalBackup(JSON.stringify({...backup,affirmations:{custom:rows.slice(0,751),favorites:rows.slice(0,751).map(x=>x.id)}}),{});await quotaStore.mergePersonal(subset,quotaStore.config().epoch);assert.equal(quotaStore.readAffirmations().custom.length,752);assert.equal(quotaStore.readAffirmations().favorites.length,751);assert.equal(quotaStore.lastImportResult.memoryOnly,true);assert.match(quotaStore.warning,/only in memory/);assert(new Store(quotaStorage,{}).readAffirmations().custom.some(x=>x.id===rows[1499].id));
 console.log('Large collections: 743/751 populated retries, 1500 customs + 1536 favorites, reordered storage, Unicode CRLF, round-trip and capacity preflight passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
