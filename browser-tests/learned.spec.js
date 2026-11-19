const {test,expect}=require('@playwright/test');
const {openPreferences,closePreferences,selectPreference}=require('./preferences');
const {createHash}=require('node:crypto');
const {canonical}=require('../site/assets/js/learned.js');
const KEY='ocf-learned:v1', route='/functions/OCF-AUT-001/';
const modal=page=>page.locator('#mark-learned-dialog');
const saved=page=>page.evaluate(key=>Object.keys(localStorage).filter(k=>k.startsWith(`${key}:record:`)).map(k=>JSON.parse(localStorage[k])),KEY);
const flags=page=>page.evaluate(key=>Object.keys(localStorage).filter(k=>k.startsWith(`${key}:flag:`)).map(k=>JSON.parse(localStorage[k])),KEY);
const pageAction=(page,name)=>page.locator('.learned-panel').getByRole('button',{name:new RegExp(`^${name}:`)});
async function ready(page,url=route){await page.goto(url);await expect(page.locator('.personal-settings')).toBeAttached();await expect(page.locator('.personal-settings')).toContainText(/Tracking is off|tracking enabled/);}
async function enable(page){await openPreferences(page);await page.getByRole('button',{name:'Enable private tracking',exact:true}).filter({visible:true}).click();await closePreferences(page);}
async function openLearned(page){await pageAction(page,'Learned').click();await expect(modal(page)).toBeVisible();}
async function save(page,value){if(value!==undefined)await modal(page).getByLabel('Learning target',{exact:true}).selectOption(value);await modal(page).getByRole('button',{name:'Save learned version'}).click();await expect(modal(page)).not.toBeVisible();}
async function backup(page,value){await openPreferences(page);const area=page.locator('.personal-settings');const detail=area.getByText('Backup and reset',{exact:true}).locator('..');if(await detail.getAttribute('open')===null)await detail.locator('summary').click();await area.getByLabel('Import backup', {exact:false}).setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(typeof value==='string'?value:JSON.stringify(value))});}
test('compact independent controls require opt-in; no implicit learned state or network writes',async({page})=>{
 const writes=[];page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
 await ready(page);expect(await saved(page)).toEqual([]);expect(await flags(page)).toEqual([]);
 await expect(pageAction(page,'Favorite')).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('.learned-panel')).not.toContainText('backup');
 await pageAction(page,'Favorite').click();await expect(page.locator('#preferences')).toBeVisible();
 await page.getByRole('button',{name:'Enable private tracking',exact:true}).filter({visible:true}).click();await closePreferences(page);
 await expect(pageAction(page,'Favorite')).toBeFocused();expect(await flags(page)).toEqual([]);
 for(let i=0;i<3;i++){await pageAction(page,'Favorite').click();await expect(pageAction(page,'Favorite')).toHaveAttribute('aria-pressed','true');await pageAction(page,'Favorite').click();await expect(pageAction(page,'Favorite')).toHaveAttribute('aria-pressed','false');}
 await pageAction(page,'To Do').click();await pageAction(page,'Favorite').click();expect(await flags(page)).toHaveLength(2);expect(await saved(page)).toHaveLength(0);
 await openLearned(page);await save(page);expect(await saved(page)).toHaveLength(1);expect(await flags(page)).toHaveLength(2);expect(writes).toEqual([]);
 await expect(pageAction(page,'Learned')).toHaveAttribute('aria-pressed','true');
});
test('popup latest/historical target is explicit, local choice does not change global preference, cancel/Escape restore focus',async({page})=>{
 await ready(page);await enable(page);await openLearned(page);
 await expect(modal(page).getByLabel('Learning target',{exact:true})).toHaveValue('0');
 await expect(modal(page)).toContainText('audio-0.2.0');await expect(modal(page)).toContainText('Website guide c79421a');await expect(modal(page)).toContainText('Recording source 3bcb8c1');
 await modal(page).getByLabel('Learning target',{exact:true}).selectOption('1');await page.keyboard.press('Escape');
 await expect(modal(page)).not.toBeVisible();await expect(pageAction(page,'Learned')).toBeFocused();expect(await saved(page)).toHaveLength(0);
 await openLearned(page);await save(page,'1');expect((await saved(page))[0].recording.tag).toMatch(/^audio-0.1.0/);
 expect(await page.evaluate(()=>window.ocfEditions.current())).toBe('0.2.0');
 await openLearned(page);await expect(modal(page).getByLabel('Learning target',{exact:true})).toHaveValue('0');await modal(page).getByRole('button',{name:'Cancel',exact:true}).click();
 await selectPreference(page,'Audio edition','0.1.0');await openLearned(page);await expect(modal(page).getByLabel('Learning target',{exact:true})).toHaveValue('1');
 await save(page,'0');expect(await page.evaluate(()=>window.ocfEditions.current())).toBe('0.1.0');expect(await saved(page)).toHaveLength(2);
 await page.reload();await openLearned(page);await expect(modal(page).getByLabel('Learning target',{exact:true})).toHaveValue('1');
});
test('saved versions remain readable, show truthful changes and can be removed without changing Favorite/To Do',async({page})=>{
 await ready(page);await enable(page);await pageAction(page,'Favorite').click();await pageAction(page,'To Do').click();await openLearned(page);await save(page,'1');await openLearned(page);await save(page,'0');
 await openLearned(page);await modal(page).getByText('Saved versions and changes',{exact:true}).click();
 const older=modal(page).locator('summary').filter({hasText:'audio-0.1.0'});await older.click();
 await expect(modal(page).getByText('New audio edition available;', {exact:false})).toBeVisible();
 await expect(modal(page).getByRole('link',{name:'Published release notes for audio-0.2.0'})).toBeVisible();
 page.once('dialog',d=>d.accept());await older.locator('..').getByRole('button',{name:'Remove this learned version'}).click();expect(await saved(page)).toHaveLength(1);expect(await flags(page)).toHaveLength(2);
 await modal(page).getByRole('button',{name:'Cancel',exact:true}).click();await expect(pageAction(page,'Learned')).toHaveAttribute('aria-pressed','true');
});
test('Browse and Quick Reference filters/sorts compose with edition and search; order restores',async({page})=>{
 await ready(page);await enable(page);await pageAction(page,'Favorite').click();await openLearned(page);await save(page);
 await ready(page,'/functions/OCF-BOD-002/');await pageAction(page,'To Do').click();
 await ready(page,'/functions/');await expect(page.locator('.session-card')).toHaveCount(118);
 const original=await page.locator('.session-card:visible').evaluateAll(cards=>cards.map(c=>c.dataset.functionId));
 await page.getByLabel('My library',{exact:true}).selectOption('favorite');await expect(page.locator('.session-card:visible')).toHaveCount(1);
 await selectPreference(page,'Audio edition','0.1.0');await expect(page.locator('.session-card:visible')).toHaveAttribute('data-edition','0.1.0');
 await page.locator('#search').fill('no such item');await expect(page.locator('.session-card:visible')).toHaveCount(0);await page.locator('#search').fill('');
 await page.getByLabel('My library',{exact:true}).selectOption('all');await page.getByLabel('Sort personal states',{exact:true}).selectOption('todo');
 await expect(page.locator('.session-card:visible').first()).toHaveAttribute('data-function-id','OCF-BOD-002');
 await page.getByLabel('Sort personal states',{exact:true}).selectOption('default');expect(await page.locator('.session-card:visible').evaluateAll(cards=>cards.map(c=>c.dataset.functionId))).toEqual(original);
 await ready(page,'/quick-reference/');await page.getByLabel('My library',{exact:true}).selectOption('learned');await expect(page.locator('[data-reference-row]:visible')).toHaveCount(1);
 await page.getByLabel('My library',{exact:true}).selectOption('all');await page.getByLabel('Sort personal states',{exact:true}).selectOption('todo');await expect(page.locator('[data-reference-row]').first()).toHaveAttribute('data-learned-id','OCF-BOD-002');
 await page.getByLabel('Search title, ID, cue or description').fill('Plus Automate');await expect(page.locator('[data-reference-row]:visible')).toHaveCount(1);
 expect(page.url()).not.toMatch(/learned|favorite|todo/);
});
test('schema1 imports preserve flags and learned versions; schema4 exports restore all states with strict preview',async({page})=>{
 await ready(page);await enable(page);await pageAction(page,'Favorite').click();await openLearned(page);await save(page);
 const existing=(await saved(page))[0], changed=structuredClone(existing);changed.id='01234567-1234-1234-1234-012345678901';changed.recording=null;
 await backup(page,{schema:1,records:[existing,changed]});await expect(page.locator('.personal-settings')).toContainText('1 new learned versions; 1 already saved');expect(await saved(page)).toHaveLength(1);
 await page.getByRole('button',{name:'Confirm import and merge'}).click();await expect(page.locator('.personal-settings')).toContainText('1 learned versions imported');expect(await saved(page)).toHaveLength(2);expect(await flags(page)).toHaveLength(1);
 for(const input of ['{',{schema:3,records:[],flags:[]},{schema:2,records:[],flags:[{subject:existing.subject,kind:'learned'}]}]){await backup(page,input);await expect(page.locator('.personal-settings')).toContainText('Unsupported or corrupt');expect(await saved(page)).toHaveLength(2);expect(await flags(page)).toHaveLength(1);}
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export private backup'}).click();const download=await downloadPromise;const text=await require('node:fs/promises').readFile(await download.path(),'utf8');const exported=JSON.parse(text);expect(exported.schema).toBe(4);expect(exported.routine).toEqual([]);expect(exported.affirmations).toEqual({custom:[],favorites:[]});expect(exported.records).toHaveLength(2);expect(exported.flags).toHaveLength(1);
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Reset all private tracking'}).click();expect(await saved(page)).toHaveLength(2);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Reset all private tracking'}).click();expect(await saved(page)).toHaveLength(0);expect(await flags(page)).toHaveLength(0);
 await page.getByRole('button',{name:'Enable private tracking',exact:true}).filter({visible:true}).click();await backup(page,exported);await page.getByRole('button',{name:'Confirm import and merge'}).click();await expect(page.locator('.personal-settings')).toContainText('2 learned versions imported');expect(await flags(page)).toHaveLength(1);
});
test('imported guide snapshots render safely and differing immutable recording digests remain unverified',async({page})=>{
 await ready(page);await enable(page);await openLearned(page);await save(page);const old=(await saved(page))[0];
 old.guide.commit='a'.repeat(40);old.guide.snapshot.fields.description='<img src=x onerror="window.BAD=true">';old.guide.fingerprint=createHash('sha256').update(canonical(old.guide.snapshot)).digest('hex');old.recording.master_sha256='0'.repeat(64);
 await backup(page,{schema:1,records:[old]});await page.getByRole('button',{name:'Confirm import and merge'}).click();await expect(page.locator('.personal-settings')).toContainText('1 learned versions imported');await closePreferences(page);
 await openLearned(page);await modal(page).getByText('Saved versions and changes',{exact:true}).click();
 const diff=modal(page).getByText('See differences in tracked public guide fields',{exact:true}).locator('../..');await diff.locator(':scope > summary').click();await diff.locator('details > summary').click();
 await expect(diff).toContainText('<img src=x');expect(await page.evaluate(()=>window.BAD)).toBeUndefined();await expect(diff.locator('img')).toHaveCount(0);await expect(diff).toContainText('not present in the current published catalog');
});
test('blocked storage is memory-only and does not fall back to URLs/sessionStorage/window.name',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('blocked');}}));await ready(page);await enable(page);await pageAction(page,'Favorite').click();await openLearned(page);await save(page);
 await expect(page.locator('.learned-panel')).toContainText('only in memory');expect(await page.evaluate(()=>Object.keys(sessionStorage).some(k=>k.includes('learned')))).toBe(false);expect(await page.evaluate(()=>window.name)).not.toContain('learned');await page.reload();await expect(pageAction(page,'Favorite')).toHaveAttribute('aria-pressed','false');await expect(pageAction(page,'Learned')).toHaveAttribute('aria-pressed','false');
});
test('multi-tab flag changes and reset close stale popup without resurrecting records',async({page,context})=>{
 await ready(page);await enable(page);await pageAction(page,'Favorite').click();const other=await context.newPage();await ready(other);await pageAction(other,'To Do').click();await expect(pageAction(page,'To Do')).toHaveAttribute('aria-pressed','true');await openLearned(page);
 await openPreferences(other);await other.getByText('Backup and reset',{exact:true}).click();other.once('dialog',d=>d.accept());await other.getByRole('button',{name:'Reset all private tracking'}).click();await expect(modal(page)).not.toBeVisible();await expect(pageAction(page,'Favorite')).toHaveAttribute('aria-pressed','false');await expect(pageAction(page,'To Do')).toHaveAttribute('aria-pressed','false');expect(await saved(page)).toHaveLength(0);await other.close();
});
test('guide-only and external Preparation choices remain explicit without assigning an invented edition',async({page})=>{
 await ready(page);await enable(page);await openLearned(page);await save(page,'guide');expect((await saved(page))[0].recording).toBeNull();
 await ready(page,'/preparation-learning/');await openLearned(page);await save(page,'external');let values=await saved(page);const external=values.find(v=>v.subject==='preparation:human-plus');expect(external.external).toEqual({edition:null,date:null});expect(external.guide).toBeNull();expect(external.recording).toBeNull();await expect(pageAction(page,'Learned')).toHaveAttribute('aria-pressed','true');
});
test('keyboard/mobile controls and modal are accessible across themes; screenshots show compact initial state',async({page})=>{
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});await ready(page);await expect(page.locator('.learned-panel')).not.toContainText('What did you learn');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`browser-artifacts/compact-tracker-${width}.png`,fullPage:true});}
 await page.setViewportSize({width:320,height:812});await pageAction(page,'Learned').focus();await page.keyboard.press('Enter');await expect(modal(page)).toBeVisible();
 await modal(page).getByRole('button',{name:'Enable private tracking',exact:true}).click();await save(page);await expect(pageAction(page,'Learned')).toBeFocused();await openLearned(page);
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
 await page.addInitScript(key=>localStorage.setItem(key,JSON.stringify({schema:99,epoch:'bad'})),KEY);await ready(page);await openPreferences(page);await expect(page.locator('.personal-settings')).toContainText('unsupported or corrupt');await page.getByRole('button',{name:'Enable private tracking',exact:true}).filter({visible:true}).click();expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).schema,KEY)).toBe(99);
});
test('historical Browse card targets its own edition and sorting preserves an active player',async({page})=>{
 await ready(page);await enable(page);await pageAction(page,'To Do').click();await ready(page,'/functions/');
 await selectPreference(page,'Audio edition','0.1.0');
 const card=page.locator('.session-card[data-function-id="OCF-AUT-001"][data-edition="0.1.0"]');
 await card.getByRole('button',{name:/^Learned:/}).click();await expect(modal(page).getByLabel('Learning target',{exact:true})).toHaveValue('1');await modal(page).getByRole('button',{name:'Cancel',exact:true}).click();
 await card.getByRole('button',{name:/Show player/}).click();const audio=card.locator('audio');const wav=Buffer.alloc(44+8000*30,128);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(8000,28);wav.writeUInt16LE(1,32);wav.writeUInt16LE(8,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
 await audio.evaluate(async(a,src)=>{a.src=src;await a.play();a.dataset.synthetic='retained';},'data:audio/wav;base64,'+wav.toString('base64'));
 await page.getByLabel('Sort personal states',{exact:true}).selectOption('todo');expect(await audio.evaluate(a=>a.paused)).toBe(false);await expect(audio).toHaveAttribute('data-synthetic','retained');expect(await saved(page)).toHaveLength(0);
 await audio.evaluate(a=>a.pause());await page.goto('/quick-reference/');await page.goBack();await expect(page.locator('.personal-settings')).toBeAttached();expect(await flags(page)).toHaveLength(1);expect(await saved(page)).toHaveLength(0);
});
test('Preferences manages tracking on the home page; compact lists stay usable on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});await ready(page,'/');await enable(page);
 for(const [path,name] of [['/functions/','browse'],['/quick-reference/','reference']]) {
  await ready(page,path);await expect(page.getByLabel('My library',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`browser-artifacts/compact-${name}-390.png`});
 }
 await openPreferences(page);await page.locator('.personal-settings').scrollIntoViewIfNeeded();await page.screenshot({path:'browser-artifacts/compact-preferences-390.png'});await closePreferences(page);
 await ready(page);await openLearned(page);await modal(page).getByLabel('Learning target',{exact:true}).focus();await page.keyboard.press('Tab');await expect(modal(page).getByRole('button',{name:'Cancel',exact:true})).toBeFocused();await page.keyboard.press('Tab');await expect(modal(page).getByRole('button',{name:'Save learned version'})).toBeFocused();await page.keyboard.press('Escape');await expect(pageAction(page,'Learned')).toBeFocused();
});
