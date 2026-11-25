const {test,expect}=require('@playwright/test');
const {openPreferences,closePreferences,selectPreference}=require('./preferences');
const {createHash}=require('node:crypto');
const {canonical}=require('../site/assets/js/learned.js');
const KEY='ocf-learned:v1', route='/functions/OCF-AUT-001/';
let releases;
test.beforeEach(async({request})=>{releases=(await request.get('/catalog.json').then(r=>r.json())).releases;});
const target=page=>modal(page).getByLabel('Learning target',{exact:true});
const historicalValue=page=>target(page).locator('option').filter({hasText:/^audio-0[.]1[.]0(?:-|,)/i}).getAttribute('value');
const modal=page=>page.locator('#mark-learned-dialog');
const saved=page=>page.evaluate(key=>Object.keys(localStorage).filter(k=>k.startsWith(`${key}:record:`)).map(k=>JSON.parse(localStorage[k])),KEY);
const flags=page=>page.evaluate(key=>Object.keys(localStorage).filter(k=>k.startsWith(`${key}:flag:`)).map(k=>JSON.parse(localStorage[k])),KEY);
const pageAction=(page,name)=>page.locator('.learned-panel').getByRole('button',{name:new RegExp(`^${name}:`)});
async function ready(page,url=route){await page.goto(url);await expect(page.locator('.personal-settings')).toBeAttached();}
async function openLearned(page){await pageAction(page,'Learned').click();await expect(modal(page)).toBeVisible();}
async function save(page,value){if(value!==undefined)await modal(page).getByLabel('Learning target',{exact:true}).selectOption(value);await modal(page).getByRole('button',{name:'Save learned version'}).click();await expect(modal(page)).not.toBeVisible();}
async function backup(page,value){await openPreferences(page);const area=page.locator('.personal-settings');const detail=area.getByText('Backup and reset',{exact:true}).locator('..');if(await detail.getAttribute('open')===null)await detail.locator('summary').click();await area.getByLabel('Import backup', {exact:false}).setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(typeof value==='string'?value:JSON.stringify(value))});}
test('compact independent controls save only when used, without an enable step or network writes',async({page})=>{
 const writes=[];page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
 await ready(page);expect(await saved(page)).toEqual([]);expect(await flags(page)).toEqual([]);
 await expect(pageAction(page,'Favorite')).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('.learned-panel')).not.toContainText('backup');
 expect(await page.evaluate(key=>localStorage.getItem(key),KEY)).toBeNull();
 await pageAction(page,'Favorite').click();await expect(page.locator('#preferences')).not.toBeVisible();
 await expect(pageAction(page,'Favorite')).toHaveAttribute('aria-pressed','true');
 await pageAction(page,'Favorite').click();await expect(pageAction(page,'Favorite')).toHaveAttribute('aria-pressed','false');
 for(let i=0;i<3;i++){await pageAction(page,'Favorite').click();await expect(pageAction(page,'Favorite')).toHaveAttribute('aria-pressed','true');await pageAction(page,'Favorite').click();await expect(pageAction(page,'Favorite')).toHaveAttribute('aria-pressed','false');}
 await pageAction(page,'To Do').click();await pageAction(page,'Favorite').click();expect(await flags(page)).toHaveLength(2);expect(await saved(page)).toHaveLength(0);
 await openLearned(page);await save(page);expect(await saved(page)).toHaveLength(1);expect(await flags(page)).toHaveLength(2);expect(writes).toEqual([]);
 await expect(pageAction(page,'Learned')).toHaveAttribute('aria-pressed','true');
});
test('popup latest/historical target is explicit, local choice does not change global preference, cancel/Escape restore focus',async({page})=>{
 await ready(page);await openLearned(page);
 const latest=releases[0], audio=latest.functions.find(f=>f.function_id==='OCF-AUT-001').sessions[0].assets[0];
 const source=audio.provenance.render_source_commit || audio.provenance.source_ocf_commit;
 const old=await historicalValue(page);
 await expect(target(page)).toHaveValue('0');
 await expect(modal(page)).toContainText(latest.tag);const pin=await page.request.get('/source.json').then(r=>r.json());await expect(modal(page)).toContainText('Website guide '+pin.source_commit.slice(0,7));await expect(modal(page)).toContainText('Recording source '+source.slice(0,7));
 await modal(page).getByLabel('Learning target',{exact:true}).selectOption(old);await page.keyboard.press('Escape');
 await expect(modal(page)).not.toBeVisible();await expect(pageAction(page,'Learned')).toBeFocused();expect(await saved(page)).toHaveLength(0);
 await openLearned(page);await save(page,old);expect((await saved(page))[0].recording.tag).toMatch(/^audio-0.1.0/);
 expect(await page.evaluate(()=>window.ocfEditions.current())).toBe(latest.version);
 await openLearned(page);await expect(modal(page).getByLabel('Learning target',{exact:true})).toHaveValue('0');await modal(page).getByRole('button',{name:'Cancel',exact:true}).click();
 await selectPreference(page,'Audio edition','0.1.0');await openLearned(page);await expect(modal(page).getByLabel('Learning target',{exact:true})).toHaveValue(old);
 await save(page,'0');expect(await page.evaluate(()=>window.ocfEditions.current())).toBe('0.1.0');expect(await saved(page)).toHaveLength(2);
 await page.reload();await openLearned(page);await expect(modal(page).getByLabel('Learning target',{exact:true})).toHaveValue(old);
});
test('saved versions remain readable, show truthful changes and can be removed without changing Favorite/To Do',async({page})=>{
 await ready(page);await pageAction(page,'Favorite').click();await pageAction(page,'To Do').click();await openLearned(page);await save(page,await historicalValue(page));await openLearned(page);await save(page,'0');
 await openLearned(page);await modal(page).getByText('Saved versions and changes',{exact:true}).click();
 const older=modal(page).locator('summary').filter({hasText:'audio-0.1.0'});await older.click();
 await expect(modal(page).getByText('New audio edition available;', {exact:false})).toBeVisible();
 await expect(modal(page).getByRole('link',{name:'Published release notes for '+releases[0].tag})).toBeVisible();
 page.once('dialog',d=>d.accept());await older.locator('..').getByRole('button',{name:'Remove this learned version'}).click();expect(await saved(page)).toHaveLength(1);expect(await flags(page)).toHaveLength(2);
 await modal(page).getByRole('button',{name:'Cancel',exact:true}).click();await expect(pageAction(page,'Learned')).toHaveAttribute('aria-pressed','true');
});
test('Browse and Quick Reference filters/sorts compose with edition and search; order restores',async({page})=>{
 await ready(page);await pageAction(page,'Favorite').click();await openLearned(page);await save(page);
 await ready(page,'/functions/OCF-BOD-002/');await pageAction(page,'To Do').click();
 await ready(page,'/functions/');await expect(page.locator('.session-card:not([data-edition=""])')).toHaveCount(releases.reduce((sum, release)=>sum+[...release.functions,...release.preparations].flatMap(row=>row.sessions).length,0));
 await page.getByLabel('My library',{exact:true}).selectOption('favorite');await expect(page.locator('.session-card:visible')).toHaveCount(1);
 await selectPreference(page,'Audio edition','0.1.0');await expect(page.locator('.session-card:visible')).toHaveAttribute('data-edition','0.1.0');
 await page.locator('#search').fill('no such item');await expect(page.locator('.session-card:visible')).toHaveCount(0);await page.locator('#search').fill('');
 await page.getByLabel('My library',{exact:true}).selectOption('all');
 const original=await page.locator('.session-card:visible').evaluateAll(cards=>cards.map(c=>c.dataset.functionId));
 await page.getByLabel('Sort personal states',{exact:true}).selectOption('todo');
 await expect(page.locator('.session-card:visible').first()).toHaveAttribute('data-function-id','OCF-BOD-002');
 await page.getByLabel('Sort personal states',{exact:true}).selectOption('default');expect(await page.locator('.session-card:visible').evaluateAll(cards=>cards.map(c=>c.dataset.functionId))).toEqual(original);
 await ready(page,'/quick-reference/');await page.getByLabel('My library',{exact:true}).selectOption('learned');await expect(page.locator('[data-reference-row]:visible')).toHaveCount(1);
 await page.getByLabel('My library',{exact:true}).selectOption('all');await page.getByLabel('Sort personal states',{exact:true}).selectOption('todo');await expect(page.locator('[data-reference-row]').first()).toHaveAttribute('data-learned-id','OCF-BOD-002');
 await page.getByLabel('Search title, ID, cue or description').fill('Plus Automate');await expect(page.locator('[data-reference-row]:visible')).toHaveCount(1);
 expect(page.url()).not.toMatch(/learned|favorite|todo/);
});
test('schema1 imports preserve flags and learned versions; schema4 exports restore all states with strict preview',async({page})=>{
 await ready(page);await pageAction(page,'Favorite').click();await openLearned(page);await save(page);
 const existing=(await saved(page))[0], changed=structuredClone(existing);changed.id='01234567-1234-1234-1234-012345678901';changed.recording=null;
 await backup(page,{schema:1,records:[existing,changed]});await expect(page.locator('.personal-settings')).toContainText('1 new learned versions; 1 already saved');expect(await saved(page)).toHaveLength(1);
 await page.getByRole('button',{name:'Confirm import and merge'}).click();await expect(page.locator('.personal-settings')).toContainText('1 learned versions imported');expect(await saved(page)).toHaveLength(2);expect(await flags(page)).toHaveLength(1);
 for(const input of ['{',{schema:3,records:[],flags:[]},{schema:2,records:[],flags:[{subject:existing.subject,kind:'learned'}]}]){await backup(page,input);await expect(page.locator('.personal-settings')).toContainText('Unsupported or corrupt');expect(await saved(page)).toHaveLength(2);expect(await flags(page)).toHaveLength(1);}
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export private backup'}).click();const download=await downloadPromise;const text=await require('node:fs/promises').readFile(await download.path(),'utf8');const exported=JSON.parse(text);expect(exported.schema).toBe(4);expect(exported.routine).toEqual([]);expect(exported.affirmations).toEqual({custom:[],favorites:[]});expect(exported.records).toHaveLength(2);expect(exported.flags).toHaveLength(1);
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Clear saved items'}).click();expect(await saved(page)).toHaveLength(2);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Clear saved items'}).click();expect(await saved(page)).toHaveLength(0);expect(await flags(page)).toHaveLength(0);
 await backup(page,exported);await page.getByRole('button',{name:'Confirm import and merge'}).click();await expect(page.locator('.personal-settings')).toContainText('2 learned versions imported');expect(await flags(page)).toHaveLength(1);
});
test('imported guide snapshots render safely and differing immutable recording digests remain unverified',async({page})=>{
 await ready(page);await openLearned(page);await save(page);const old=(await saved(page))[0];
 old.guide.commit='a'.repeat(40);old.guide.snapshot.fields.description='<img src=x onerror="window.BAD=true">';old.guide.fingerprint=createHash('sha256').update(canonical(old.guide.snapshot)).digest('hex');old.recording.master_sha256='0'.repeat(64);
 await backup(page,{schema:1,records:[old]});await page.getByRole('button',{name:'Confirm import and merge'}).click();await expect(page.locator('.personal-settings')).toContainText('1 learned versions imported');await closePreferences(page);
 await openLearned(page);await modal(page).getByText('Saved versions and changes',{exact:true}).click();
 const diff=modal(page).getByText('See differences in tracked public guide fields',{exact:true}).locator('../..');await diff.locator(':scope > summary').click();await diff.locator('details > summary').click();
 await expect(diff).toContainText('<img src=x');expect(await page.evaluate(()=>window.BAD)).toBeUndefined();await expect(diff.locator('img')).toHaveCount(0);await expect(diff).toContainText('not present in the current published catalog');
});
test('blocked storage is memory-only and does not fall back to URLs/sessionStorage/window.name',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('blocked');}}));await ready(page);await pageAction(page,'Favorite').click();await openLearned(page);await save(page);
 await expect(page.locator('.learned-panel')).toContainText('only in memory');expect(await page.evaluate(()=>Object.keys(sessionStorage).some(k=>k.includes('learned')))).toBe(false);expect(await page.evaluate(()=>window.name)).not.toContain('learned');await page.reload();await expect(pageAction(page,'Favorite')).toHaveAttribute('aria-pressed','false');await expect(pageAction(page,'Learned')).toHaveAttribute('aria-pressed','false');
});
test('multi-tab flag changes and reset close stale popup without resurrecting records',async({page,context})=>{
 await ready(page);await pageAction(page,'Favorite').click();const other=await context.newPage();await ready(other);await pageAction(other,'To Do').click();await expect(pageAction(page,'To Do')).toHaveAttribute('aria-pressed','true');await openLearned(page);
 await openPreferences(other);await other.getByText('Backup and reset',{exact:true}).click();other.once('dialog',d=>d.accept());await other.getByRole('button',{name:'Clear saved items'}).click();await expect(modal(page)).not.toBeVisible();await expect(pageAction(page,'Favorite')).toHaveAttribute('aria-pressed','false');await expect(pageAction(page,'To Do')).toHaveAttribute('aria-pressed','false');expect(await saved(page)).toHaveLength(0);await other.close();
});
test('guide-only and external Preparation choices remain explicit without assigning an invented edition',async({page})=>{
 await ready(page);await openLearned(page);await save(page,'guide');expect((await saved(page))[0].recording).toBeNull();
 await ready(page,'/preparation-learning/');await openLearned(page);await save(page,'external');let values=await saved(page);const external=values.find(v=>v.subject==='preparation:human-plus');expect(external.external).toEqual({edition:null,date:null});expect(external.guide).toBeNull();expect(external.recording).toBeNull();await expect(pageAction(page,'Learned')).toHaveAttribute('aria-pressed','true');
});
test('keyboard/mobile controls and modal are accessible across themes; screenshots show compact initial state',async({page})=>{
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});await ready(page);await expect(page.locator('.learned-panel')).not.toContainText('What did you learn');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`browser-artifacts/compact-tracker-${width}.png`,fullPage:true});}
 await page.setViewportSize({width:320,height:812});await pageAction(page,'Learned').focus();await page.keyboard.press('Enter');await expect(modal(page)).toBeVisible();
 await save(page);await expect(pageAction(page,'Learned')).toBeFocused();await openLearned(page);
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 for(const theme of ['light','dark','black']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);const result=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));expect(result.violations).toEqual([]);await modal(page).screenshot({path:`browser-artifacts/compact-learned-${theme}.png`});}
 await page.keyboard.press('Escape');await expect(pageAction(page,'Learned')).toBeFocused();
});
test('popup cancels on history navigation and delayed fetch preserves deliberate user scroll',async({page})=>{
 let release;let gate=new Promise(resolve=>release=resolve);await page.route('**/assets/data/learning.json*',async route=>{await gate;await route.continue();});
 await page.goto('/functions/OCF-SLP-002/#cues',{waitUntil:'domcontentloaded'});await expect(page.locator('#cues')).toBeInViewport();release();await expect(pageAction(page,'Learned')).toBeVisible();await expect(page.locator('#cues')).toBeInViewport();
 gate=new Promise(resolve=>release=resolve);await page.reload({waitUntil:'domcontentloaded'});await page.waitForLoadState('load');await page.keyboard.press('Control+End');await expect(page.locator('#cues')).not.toBeInViewport();release();await expect(pageAction(page,'Learned')).toBeAttached();await expect(page.locator('#cues')).not.toBeInViewport();
 await page.unroute('**/assets/data/learning.json*');await ready(page,route);await openLearned(page);await page.evaluate(()=>dispatchEvent(new PopStateEvent('popstate')));await expect(modal(page)).not.toBeVisible();expect(await saved(page)).toHaveLength(0);
});
test('corrupt old settings remain untouched and require explicit reset',async({page})=>{
 await page.addInitScript(key=>localStorage.setItem(key,JSON.stringify({schema:99,epoch:'bad'})),KEY);await ready(page);await openPreferences(page);await expect(page.locator('.personal-settings')).toContainText('unsupported or corrupt');expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).schema,KEY)).toBe(99);
});
test('historical Browse card targets its own edition and sorting preserves an active player',async({page})=>{
 await ready(page);await pageAction(page,'To Do').click();await ready(page,'/functions/');
 await selectPreference(page,'Audio edition','0.1.0');
 const card=page.locator('.session-card[data-function-id="OCF-AUT-001"][data-edition="0.1.0"]');
 await card.getByRole('button',{name:/^Learned:/}).click();await expect(target(page)).toHaveValue(await historicalValue(page));await modal(page).getByRole('button',{name:'Cancel',exact:true}).click();
 await card.getByRole('button',{name:/Show player/}).click();const audio=card.locator('audio');const wav=Buffer.alloc(44+8000*30,128);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(8000,28);wav.writeUInt16LE(1,32);wav.writeUInt16LE(8,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
 await audio.evaluate(async(a,src)=>{a.src=src;await a.play();a.dataset.synthetic='retained';},'data:audio/wav;base64,'+wav.toString('base64'));
 await page.getByLabel('Sort personal states',{exact:true}).selectOption('todo');expect(await audio.evaluate(a=>a.paused)).toBe(false);await expect(audio).toHaveAttribute('data-synthetic','retained');expect(await saved(page)).toHaveLength(0);
 await audio.evaluate(a=>a.pause());await page.goto('/quick-reference/');await page.goBack();await expect(page.locator('.personal-settings')).toBeAttached();expect(await flags(page)).toHaveLength(1);expect(await saved(page)).toHaveLength(0);
});
test('Preferences manages tracking on the home page; compact lists stay usable on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page,'/');
 for(const [path,name] of [['/functions/','browse'],['/quick-reference/','reference']]) {
  await ready(page,path);await expect(page.getByLabel('My library',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`browser-artifacts/compact-${name}-390.png`});
 }
 await openPreferences(page);await page.locator('.personal-settings').scrollIntoViewIfNeeded();await page.screenshot({path:'browser-artifacts/compact-preferences-390.png'});await closePreferences(page);
 await ready(page);await openLearned(page);await modal(page).getByLabel('Learning target',{exact:true}).focus();await page.keyboard.press('Tab');await expect(modal(page).getByRole('button',{name:'Cancel',exact:true})).toBeFocused();await page.keyboard.press('Tab');await expect(modal(page).getByRole('button',{name:'Save learned version'})).toBeFocused();await page.keyboard.press('Escape');await expect(pageAction(page,'Learned')).toBeFocused();
});

function quietRecording(seconds=2) {
 const rate=8000, pcmBytes=rate*2*seconds, wave=Buffer.alloc(44+pcmBytes);
 wave.write('RIFF',0); wave.writeUInt32LE(36+pcmBytes,4); wave.write('WAVEfmt ',8);
 wave.writeUInt32LE(16,16); wave.writeUInt16LE(1,20); wave.writeUInt16LE(1,22);
 wave.writeUInt32LE(rate,24); wave.writeUInt32LE(rate*2,28);
 wave.writeUInt16LE(2,32); wave.writeUInt16LE(16,34);
 wave.write('data',36); wave.writeUInt32LE(pcmBytes,40);
 return wave;
}
async function fixturePlayback(page, seconds=2) {
 const audio=quietRecording(seconds);
 await page.route(url=>url.hostname==='github.com' && /\.(mp3|flac)$/.test(url.pathname),async intercepted=>{
  const range=/^bytes=(\d+)-(\d*)$/.exec(intercepted.request().headers().range||'');
  if(!range)return intercepted.fulfill({status:200,body:audio,contentType:'audio/wav'});
  const from=Number(range[1]), to=range[2]?Math.min(Number(range[2]),audio.length-1):audio.length-1;
  await intercepted.fulfill({status:206,body:audio.subarray(from,to+1),headers:{
   'content-type':'audio/wav','accept-ranges':'bytes','content-range':`bytes ${from}-${to}/${audio.length}`
  }});
 });
}
async function playAndWaitForNaturalEnd(page, group) {
 const audio=group.locator('audio');
 await group.getByRole('button',{name:'Play',exact:true}).click();
 await expect.poll(()=>audio.evaluate(a=>a.ended)).toBe(true);
}
test('real completed playback saves the exact historical edition without treating a seek-to-end or replays as new records',async({page})=>{
 await fixturePlayback(page);
 await ready(page);
 await selectPreference(page,'Audio edition','0.1.0');
 const group=page.locator('.edition-card[data-edition-content="0.1.0"]:visible').filter({has:page.locator('audio')}).first();
 const audio=group.locator('audio');
 const key=JSON.parse(await audio.getAttribute('data-learned-recording'));
 await audio.evaluate(async a=>{
  a.load();
  if(!a.readyState)await new Promise(resolve=>a.addEventListener('loadedmetadata',resolve,{once:true}));
  a.currentTime=a.duration-0.15;
  await a.play();
  await new Promise(resolve=>a.addEventListener('ended',resolve,{once:true}));
 });
 expect(await saved(page)).toEqual([]);
 await audio.evaluate(a=>{a.currentTime=0;});
 await playAndWaitForNaturalEnd(page,group);
 await expect.poll(()=>saved(page)).toHaveLength(1);
 const [record]=await saved(page);
 expect([record.subject,record.recording.tag,record.recording.edition,record.recording.locale,record.recording.voice]).toEqual(key);
 await expect(pageAction(page,'Learned')).toHaveAttribute('aria-pressed','true');
 await audio.evaluate(a=>{a.currentTime=0;});
 await playAndWaitForNaturalEnd(page,group);
 expect(await saved(page)).toHaveLength(1);
});

test('finished Preparation Learning is less prominent across the site but stays available',async({page})=>{
 await fixturePlayback(page);
 await ready(page,'/start/');
 await expect(page.locator('.primary-action')).toBeVisible();
 await ready(page,'/preparation-learning/');
 const group=page.locator('.edition-card[data-edition-content]:visible').filter({has:page.locator('audio')}).first();
 await playAndWaitForNaturalEnd(page,group);
 await expect.poll(()=>saved(page)).toHaveLength(1);
 expect((await saved(page))[0].subject).toBe('preparation:ocf');
 await expect(pageAction(page,'Learned')).toHaveAttribute('aria-pressed','true');
 for(const route of ['/','/start/','/functions/','/listening/','/downloads/']){
  await ready(page,route);
  await expect(page.locator('html')).toHaveAttribute('data-ocf-preparation-learned','');
  await expect(page.getByRole('link',{name:'Review Preparation Learning',exact:true})).toBeVisible();
  await expect(page.locator('[data-preparation-prominent]:visible')).toHaveCount(0);
 }
 await ready(page,'/functions/');
 const cards=page.locator('.session-card:visible');
 await expect(cards.first()).not.toHaveAttribute('data-function-id','preparation-learning');
 await expect(cards.filter({has:page.getByRole('button',{name:/Learned: OCF Preparation Learning/})})).toHaveCount(1);
 await page.locator('#search').fill('Preparation Learning');
 await expect(cards.first()).toHaveAttribute('data-function-id','preparation-learning');
});

test('Browse & Listen saves the edition of a dynamically opened native player',async({page})=>{
 await fixturePlayback(page);
 await ready(page,'/functions/');
 await page.locator('#search').fill('OCF-AUT-001');
 const card=page.locator('.session-card[data-function-id="OCF-AUT-001"]:visible');
 await card.getByRole('button',{name:/^Show player/}).click();
 const key=JSON.parse(await card.locator('audio').getAttribute('data-learned-recording'));
 await playAndWaitForNaturalEnd(page,card);
 await expect.poll(()=>saved(page)).toHaveLength(1);
 const [record]=await saved(page);
 expect([record.subject,record.recording.tag,record.recording.edition,record.recording.locale,record.recording.voice]).toEqual(key);
 await expect(card.getByRole('button',{name:/^Learned:/})).toHaveAttribute('aria-pressed','true');
});

test('finishing a retained previous player saves the recording actually played',async({page})=>{
 await fixturePlayback(page,8);
 await ready(page);
 await selectPreference(page,'Audio edition','0.1.0');
 const group=page.locator('.edition-card[data-edition-content="0.1.0"]:visible').filter({has:page.locator('audio')}).first();
 const audio=group.locator('audio');
 const key=JSON.parse(await audio.getAttribute('data-learned-recording'));
 await group.getByRole('button',{name:'Play',exact:true}).click();
 await expect.poll(()=>audio.evaluate(a=>!a.paused && a.currentTime>0)).toBe(true);
 const original=await audio.evaluate(a=>a.currentSrc);
 expect(original).toContain('/releases/download/audio-0.1.0');
 await selectPreference(page,'Audio edition','latest');
 await expect(group.getByText('This player belongs to your previous edition.')).toBeVisible();
 expect(await audio.evaluate(a=>a.currentSrc)).toBe(original);
 expect(await page.evaluate(()=>window.ocfEditions.current())).not.toBe('0.1.0');
 await audio.evaluate(a=>{a.playbackRate=4;});
 await expect.poll(()=>audio.evaluate(a=>a.ended)).toBe(true);
 await expect.poll(()=>saved(page)).toHaveLength(1);
 const [record]=await saved(page);
 expect([record.subject,record.recording.tag,record.recording.edition,record.recording.locale,record.recording.voice]).toEqual(key);
});

test('concealed Surprise Me learns the chosen recording only after playback ends',async({page})=>{
 await fixturePlayback(page,4);
 await ready(page,'/functions/');
 const section=page.locator('.surprise-session');
 await section.getByRole('checkbox',{name:'Hide session details until I reveal them'}).check();
 await section.getByRole('button',{name:'Surprise me',exact:true}).click();
 const audio=section.locator('audio');
 const key=JSON.parse(await audio.getAttribute('data-learned-recording'));
 await expect(section.locator('.ocf-local-player')).toHaveAccessibleName('Listen to your surprise session');
 await expect(section.locator('#surprise-details')).toBeHidden();
 expect(await audio.getAttribute('data-session-edition')).toBeNull();
 await section.getByRole('button',{name:'Play',exact:true}).click();
 await expect.poll(()=>audio.evaluate(a=>!a.paused && a.currentTime>0)).toBe(true);
 expect(await saved(page)).toEqual([]);
 expect(await page.evaluate(()=>navigator.mediaSession?.metadata?.title || 'Your surprise session')).toBe('Your surprise session');
 await expect(section.locator('#surprise-details')).toBeHidden();
 await expect.poll(()=>audio.evaluate(a=>a.ended)).toBe(true);
 await expect(section.locator('#surprise-details')).toBeVisible();
 await expect.poll(()=>saved(page)).toHaveLength(1);
 const [record]=await saved(page);
 expect([record.subject,record.recording.tag,record.recording.edition,record.recording.locale,record.recording.voice]).toEqual(key);
});

for (const [kind, entry, subject, choice] of [
 ['OCF Preparation Learning','/start/','preparation:ocf','0'],
 ['official Human Plus preparation','/function-chains/','preparation:human-plus','external'],
]) test(`either prep choice from a contextual prompt stops the sitewide reminders: ${kind}`,async({page})=>{
 await page.setViewportSize({width:390,height:812});
 await ready(page,entry);
 const start=page.getByRole('button',{name:`I completed ${kind}`,exact:true}).first();
 await start.focus(); await page.keyboard.press('Enter');
 await expect(target(page)).toHaveValue(choice);
 await save(page);
 expect((await saved(page)).map(item=>item.subject)).toEqual([subject]);
 await ready(page,'/start/');
 await expect(page.locator('.start-steps li:visible strong')).toHaveText(['Check your audio','Choose','Learn','Use']);
 for (const route of ['/','/start/','/functions/','/listening/','/downloads/','/function-chains/','/preparation-learning/']) {
  await ready(page,route);
  await expect(page.locator('html')).toHaveAttribute('data-ocf-preparation-learned','');
  await expect(page.locator('[data-preparation-prominent]:visible')).toHaveCount(0);
  await expect(page.getByText(/^Start with Preparation Learning, then choose/)).not.toBeVisible();
  await expect(page.getByRole('heading',{name:'Preparation first',exact:true})).not.toBeVisible();
 }
 await ready(page,'/function-chains/#preparation-first');
 await expect(page.locator('#preparation-first')).toHaveCount(1);
 await expect(page.locator('nav li[data-preparation-prominent]:visible')).toHaveCount(0);
 await ready(page,'/preparation-learning/');
 await openLearned(page); await modal(page).getByText('Saved versions and changes',{exact:true}).click();
 await modal(page).locator('details[open] > div > details > summary').click();
 page.once('dialog',dialog=>dialog.accept());
 await modal(page).getByRole('button',{name:/^Remove/}).click();
 await expect.poll(()=>saved(page)).toHaveLength(0);
 await ready(page,'/function-chains/');
 await expect(page.getByRole('heading',{name:'Preparation first',exact:true})).toBeVisible();
});

for (const listened of [true,false]) test(`reload preserves genuine playback coverage, never a seek-only jump (${listened})`,async({page})=>{
 await fixturePlayback(page,5);
 await ready(page);
 const group=page.locator('.edition-card[data-edition-content]:visible').filter({has:page.locator('audio')}).first();
 const audio=group.locator('audio');
 if(listened){
  await group.getByRole('button',{name:'Play',exact:true}).click();
  await expect.poll(()=>audio.evaluate(a=>a.currentTime)).toBeGreaterThan(1.25);
  await group.getByRole('button',{name:'Pause',exact:true}).click();
 }else{
  await audio.evaluate(async a=>{
   a.load();
   if(!a.readyState) await new Promise(resolve=>a.addEventListener('loadedmetadata',resolve,{once:true}));
   a.currentTime=2;
  });
  await expect.poll(()=>audio.evaluate(a=>a.currentTime)).toBeGreaterThan(1.5);
 }
 expect(await saved(page)).toHaveLength(0);
 await page.reload();
 if(listened) {
  await group.getByRole('button',{name:'Play',exact:true}).click();
  await expect.poll(()=>audio.evaluate(a=>a.currentTime),{timeout:1000}).toBeGreaterThan(1.1);
 } else {
  await audio.evaluate(async a=>{
   a.load();
   if(!a.readyState)await new Promise(resolve=>a.addEventListener('loadedmetadata',resolve,{once:true}));
   a.currentTime=a.duration-.15;
   await a.play();
  });
 }
 await expect.poll(()=>audio.evaluate(a=>a.ended)).toBe(true);
 await expect.poll(()=>saved(page)).toHaveLength(listened?1:0);
});

test('the ordinary Smart Play settings player marks a naturally completed edit learned',async({page})=>{
 // Keep the deployed player and its dialogs, but use a short real audio body
 // for this browser test of completion (the FLAC worker has separate tests).
 const id='OCF-FND-004';
 await page.route('**/assets/js/smart-play/bootstrap.js*',route=>route.fulfill({
  contentType:'text/javascript',
  body:`window.ocfPublicSmartEligible=new Set(['${id}']);window.ocfPublicSmartAudio=Promise.resolve('/__ocf-smart/');`,
 }));
 await page.route('**/__ocf-smart/options/**',route=>route.fulfill({
  json:{controls:[{control:'relaxation',name:'Relaxation',original:'full',options:{short:true}}],held:[]},
 }));
 await page.route('**/__ocf-smart/route/**',route=>route.fulfill({
  json:{url:`/__ocf-smart/audio/${id}.flac?relaxation=short&_revision=learning-fixture`,format:'FLAC',seconds:2,bookmarks:[]},
 }));
 await page.route('**/__ocf-smart/audio/**',route=>route.fulfill({
  contentType:'audio/wav',body:quietRecording(2),
 }));
 await ready(page,`/functions/${id}/`);
 const group=page.locator('.edition-card[data-edition-content]:visible').filter({has:page.locator('audio')}).first();
 test.skip(!(await group.locator('audio').getAttribute('data-local-smart')),'The site fixture does not stage Smart Play.');
 await group.getByRole('button',{name:'Smart Play settings',exact:true}).click();
 const settings=page.getByRole('dialog',{name:'Smart Play',exact:true});
 await settings.getByLabel('Relaxation',{exact:true}).selectOption('short');
 await settings.getByRole('button',{name:'Apply',exact:true}).click();
 await expect(settings).not.toBeVisible();
 const audio=group.locator('audio');
 await expect(audio).toHaveAttribute('src',/\/__ocf-smart\/audio\/.*relaxation=short/);
 await playAndWaitForNaturalEnd(page,group);
 await expect.poll(()=>saved(page)).toHaveLength(1);
 const [record]=await saved(page);
 expect(record.subject).toBe(id);
 expect(record.recording.edition).toBe('0.3.0');
});

test('the separate left/right Test Audio is never a meditation completion',async({page})=>{
 await ready(page,'/listening/#stereo-test');
 const testAudio=page.locator('#stereo-test');
 await expect(testAudio.locator('[data-learned-recording]')).toHaveCount(0);
 expect(await saved(page)).toEqual([]);
});
