const {test,expect}=require('@playwright/test');
const {openPreferences,closePreferences}=require('./preferences');
const fs=require('node:fs/promises');
const ready=async(page,route='/affirmations/')=>{await page.goto(route);await expect(page.locator('[data-affirmation-controls]')).toBeVisible();};
const enable=async page=>{await page.locator('[data-affirmation-enable]').click();await expect(page.locator('[data-affirmation-enable]')).toBeHidden();};
const state=page=>page.evaluate(()=>window.ocfPrivateLibrary.store.readAffirmations());
const dialog=page=>page.locator('.affirmation-dialog');
async function add(page,text,{favorite=false,category='calm'}={}){await page.getByRole('button',{name:'Add my own line',exact:true}).click();await dialog(page).getByLabel('My affirmation', {exact:false}).fill(text);await dialog(page).getByLabel('Category',{exact:true}).selectOption(category);await dialog(page).getByLabel('Save straight to My Morning').setChecked(favorite);await dialog(page).getByRole('button',{name:'Save line',exact:true}).click();await expect(dialog(page)).toBeHidden();}
async function backup(page,value){await openPreferences(page);const area=page.locator('.personal-settings');const detail=area.getByText('Backup and reset',{exact:true}).locator('..');if(await detail.getAttribute('open')===null)await detail.locator('summary').click();await area.getByLabel('Import backup',{exact:false}).setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(typeof value==='string'?value:JSON.stringify(value))});}
async function exportPrivate(page){await openPreferences(page);const detail=page.getByText('Backup and reset',{exact:true}).locator('..');if(await detail.getAttribute('open')===null)await detail.locator('summary').click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export private backup',exact:true}).click();return JSON.parse(await fs.readFile(await(await download).path(),'utf8'));}
test('library opt-in, combined search/category, independent hearts and bookmarked Morning reload',async({page})=>{
 const requests=[];page.on('request',r=>requests.push({method:r.method(),url:r.url()}));
 await ready(page);await expect(page.locator('.affirmation-card')).toHaveCount(36);expect(await state(page)).toEqual({custom:[],favorites:[]});
 const first=page.locator('.affirmation-heart').first();await first.click();await expect(first).toHaveAttribute('aria-pressed','false');await expect(page.locator('[data-affirmation-enable]')).toBeFocused();
 await enable(page);for(let i=0;i<3;i++){await first.click();await expect(first).toHaveAttribute('aria-pressed','true');await first.click();await expect(first).toHaveAttribute('aria-pressed','false');}await first.click();
 await page.getByLabel('Search affirmations').fill('small');await page.getByLabel('Filter by category',{exact:true}).selectOption('follow-through');await expect(page.locator('.affirmation-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Clear filters'}).click();await expect(page.locator('.affirmation-card')).toHaveCount(36);
 await page.getByRole('link',{name:'My Morning',exact:true}).filter({visible:true}).last().click();await expect(page.locator('.affirmation-card')).toHaveCount(1);await page.reload();await expect(page.locator('.affirmation-card')).toHaveCount(1);
 expect(new URL(page.url()).pathname).toBe('/my-morning/');expect(new URL(page.url()).search).toBe('');await page.locator('.affirmation-heart').click();await expect(page.locator('[data-affirmation-list]')).toContainText('morning space is empty');
 expect(requests.every(r=>['GET','HEAD'].includes(r.method))).toBe(true);
});
test('custom CRUD, cancel/Escape focus, literal malicious text, historical preferences unchanged',async({page})=>{
 await ready(page);await enable(page);
 const addButton=page.getByRole('button',{name:'Add my own line',exact:true});await addButton.click();await dialog(page).getByLabel('My affirmation',{exact:false}).fill('Unsaved');await page.keyboard.press('Escape');await expect(addButton).toBeFocused();expect((await state(page)).custom).toHaveLength(0);
 await addButton.click();await dialog(page).getByRole('button',{name:'Cancel',exact:true}).click();await expect(addButton).toBeFocused();
 const text='<img src=x onerror="window.BAD=1"> javascript:alert(1)';await add(page,text,{favorite:true});await expect(page.locator('.affirmation-list')).toContainText(text);await expect(page.locator('.affirmation-list img')).toHaveCount(0);expect(await page.evaluate(()=>window.BAD)).toBeUndefined();
 await page.getByRole('button',{name:`Edit: ${text}`,exact:true}).click();await dialog(page).getByLabel('My affirmation',{exact:false}).fill('My revised synthetic line');await dialog(page).getByRole('button',{name:'Save line',exact:true}).click();expect((await state(page)).custom).toHaveLength(1);
 await ready(page,'/my-morning/');await expect(page.locator('.affirmation-card')).toHaveCount(1);await expect(page.locator('.affirmation-list')).toContainText('My revised synthetic line');
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Remove: My revised synthetic line',exact:true}).click();expect((await state(page)).custom).toHaveLength(1);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Remove: My revised synthetic line',exact:true}).click();expect(await state(page)).toEqual({custom:[],favorites:[]});await expect(page.locator('[data-affirmation-status]')).toBeFocused();
 await page.goBack();await expect(page.locator('.affirmation-card')).toHaveCount(36);await page.goForward();await expect(page.locator('[data-affirmation-list]')).toContainText('empty');
});
test('private backup previews custom text, preserves conflicting versions and legacy scopes, settings excludes content',async({page})=>{
 await ready(page);await enable(page);await add(page,'Private synthetic backup line',{favorite:true});await page.locator('.affirmation-heart').first().click();
 const value=await exportPrivate(page);expect(value.schema).toBe(3);expect(value.affirmations.custom).toHaveLength(1);expect(value.affirmations.favorites).toHaveLength(2);
 await page.getByText('Site settings backup',{exact:true}).click();const settingsDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export site settings',exact:true}).click();const settings=await fs.readFile(await(await settingsDownload).path(),'utf8');expect(settings).not.toContain('Private synthetic');expect(Object.keys(JSON.parse(settings)).sort()).toEqual(['edition','format','kind','schema','theme']);
 for(const legacy of [{schema:1,records:[]},{schema:2,records:[],flags:[]}]){await backup(page,legacy);await page.getByRole('button',{name:'Confirm import and merge'}).click();await expect(page.locator('.personal-settings')).toContainText('0 learned versions imported');expect((await state(page)).custom).toHaveLength(1);}
 await backup(page,value);await page.getByRole('button',{name:'Cancel import',exact:true}).click();await expect(page.getByRole('button',{name:'Confirm import and merge'})).toHaveCount(0);
 const changed=structuredClone(value);changed.affirmations.custom[0].text='<a href="javascript:alert(1)">Alternate personal line</a>';
 await backup(page,changed);expect((await state(page)).custom).toHaveLength(1);await page.getByText('Preview personal affirmation text',{exact:true}).click();await expect(page.locator('.personal-settings')).toContainText('Alternate personal line');await expect(page.locator('.personal-settings a[href^="javascript"]')).toHaveCount(0);
 await page.getByRole('button',{name:'Confirm import and merge'}).click();await expect.poll(async()=>(await state(page)).custom.length).toBe(2);
 await backup(page,changed);await page.getByRole('button',{name:'Confirm import and merge'}).click();await expect.poll(async()=>(await state(page)).custom.length).toBe(2);
 for(const bad of ['{',{...value,schema:99},{...value,affirmations:{custom:[],favorites:['custom:unknown']}}]){await backup(page,bad);await expect(page.locator('.personal-settings')).toContainText(/Unsupported or corrupt/);expect((await state(page)).custom).toHaveLength(2);await expect(page.getByRole('button',{name:'Confirm import and merge'})).toHaveCount(0);}
 await closePreferences(page);await ready(page,'/my-morning/');await expect(page.locator('.affirmation-card')).toHaveCount(3);
});
test('cross-tab changes and reset close a stale editor, without restoring removed personal data',async({page,context})=>{
 await ready(page);await enable(page);await add(page,'Cross tab synthetic line',{favorite:true});const other=await context.newPage();await ready(other,'/my-morning/');await expect(other.locator('.affirmation-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Edit: Cross tab synthetic line',exact:true}).click();await other.getByRole('button',{name:'Edit: Cross tab synthetic line',exact:true}).click();await dialog(other).getByLabel('My affirmation',{exact:false}).fill('Changed in another tab');await dialog(other).getByRole('button',{name:'Save line',exact:true}).click();
 await dialog(page).getByLabel('My affirmation',{exact:false}).fill('Stale text');await dialog(page).getByRole('button',{name:'Save line',exact:true}).click();await expect(dialog(page)).toContainText('changed in another tab');expect((await state(page)).custom[0].text).toBe('Changed in another tab');
 await openPreferences(other);await other.getByText('Backup and reset',{exact:true}).click();other.once('dialog',d=>d.accept());await other.getByRole('button',{name:'Reset all private tracking'}).click();await expect(dialog(page)).toBeHidden();expect(await state(page)).toEqual({custom:[],favorites:[]});await page.reload();await expect(page.locator('.affirmation-card')).toHaveCount(36);await other.close();
});
test('blocked storage warns clearly and keeps page-only custom data usable and exportable',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('blocked');}}));await ready(page);await enable(page);await add(page,'Memory-only synthetic line',{favorite:true});await expect(page.locator('[data-affirmation-status]')).toContainText('only in memory');expect((await exportPrivate(page)).affirmations.custom).toHaveLength(1);await closePreferences(page);await page.reload();await expect(page.locator('.affirmation-card')).toHaveCount(36);expect((await state(page)).custom).toHaveLength(0);
});
test('375px and desktop keyboard, readable Morning, reflow and axe; screenshots use only synthetic content',async({page})=>{
 await page.setViewportSize({width:375,height:812});await ready(page);await enable(page);await add(page,'I can take one useful step today.',{favorite:true});
 await page.locator('.affirmation-heart').first().focus();await page.keyboard.press('Space');await expect(page.locator('.affirmation-heart').first()).toHaveAttribute('aria-pressed','true');
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});expect((await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}))).violations).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await page.locator('.affirmation-heart').first().evaluate(n=>n.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:'browser-artifacts/affirmations-library-375.png',fullPage:false});
 await ready(page,'/my-morning/');await expect(page.locator('.affirmation-card')).toHaveCount(2);await expect(page.locator('[data-page-share]')).toHaveCount(0);await page.screenshot({path:'browser-artifacts/affirmations-morning-375.png',fullPage:true});
 await page.getByRole('button',{name:'Add my own line',exact:true}).click();await dialog(page).getByLabel('My affirmation',{exact:false}).fill('A synthetic preview line');await page.screenshot({path:'browser-artifacts/affirmations-editor-375.png'});await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});expect((await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}))).violations).toEqual([]);await page.keyboard.press('Escape');
 await openPreferences(page);await page.getByText('Backup and reset',{exact:true}).click();await page.getByRole('button',{name:'Export private backup',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'browser-artifacts/affirmations-preferences-375.png'});await closePreferences(page);
 await page.setViewportSize({width:1280,height:900});await ready(page);await page.screenshot({path:'browser-artifacts/affirmations-library-desktop.png'});await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});expect((await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}))).violations).toEqual([]);
 for(let i=0;i<3;i++){await openPreferences(page);await page.locator('[data-theme-toggle]').click();await closePreferences(page);expect((await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}))).violations).toEqual([]);}
 await page.setViewportSize({width:320,height:700});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

async function holdConflictDigest(page, marker) {
 await page.evaluate(marker=>{
  const original=crypto.subtle.digest.bind(crypto.subtle);
  window.__importGate={entered:false,finished:false};
  crypto.subtle.digest=async(...args)=>{
   const held=new TextDecoder().decode(args[1]).includes(marker);
   if(held){window.__importGate.entered=true;await new Promise(resolve=>{window.__importGate.release=resolve;});}
   try{return await original(...args);}finally{if(held)window.__importGate.finished=true;}
  };
 },marker);
}
function affirmationBackup(custom,favorites=[]) {return {schema:3,records:[],flags:[],affirmations:{custom,favorites}};}
test('overlapping file selections discard a digest-delayed preview and detached confirmations cannot import another candidate',async({page})=>{
 await ready(page);await enable(page);await add(page,'Original race-test line');const original=(await state(page)).custom[0];
 await holdConflictDigest(page,'Delayed conflict A');
 await backup(page,affirmationBackup([{...original,text:'Delayed conflict A'}],[original.id]));
 await expect.poll(()=>page.evaluate(()=>window.__importGate.entered)).toBe(true);
 await expect(page.getByRole('button',{name:'Confirm import and merge'})).toHaveCount(0);
 const selected={...original,id:'custom:11111111-1111-4111-8111-111111111111',text:'Selected candidate B'};
 await backup(page,affirmationBackup([selected],[selected.id]));await expect(page.getByRole('button',{name:'Confirm import and merge'})).toHaveCount(1);
 await page.evaluate(()=>window.__importGate.release());await expect.poll(()=>page.evaluate(()=>window.__importGate.finished)).toBe(true);
 await expect(page.locator('.personal-settings')).not.toContainText('Delayed conflict A');
 await page.getByText('Preview personal affirmation text',{exact:true}).click();await expect(page.locator('.personal-settings')).toContainText('Selected candidate B');
 await page.getByRole('button',{name:'Confirm import and merge'}).evaluate(button=>{window.__oldImportConfirm=button;});
 const latest={...selected,id:'custom:22222222-2222-4222-8222-222222222222',text:'Latest candidate C'};
 await backup(page,affirmationBackup([latest],[latest.id]));await expect(page.getByRole('button',{name:'Confirm import and merge'})).toHaveCount(1);
 await page.evaluate(()=>window.__oldImportConfirm.click());await expect(page.locator('.personal-settings')).toContainText('file selection changed');
 expect((await state(page)).custom.map(line=>line.text)).toEqual(['Original race-test line']);
 await page.getByRole('button',{name:'Confirm import and merge'}).click();await expect.poll(async()=>(await state(page)).custom.length).toBe(2);
 expect((await state(page)).custom.map(line=>line.text)).toEqual(['Original race-test line','Latest candidate C']);
});
test('cross-tab reset and re-enable invalidate both a digest-delayed selection and an already rendered preview',async({page,context})=>{
 await ready(page);await enable(page);await add(page,'Original reset-test line');const original=(await state(page)).custom[0];
 await holdConflictDigest(page,'Delayed reset conflict');await backup(page,affirmationBackup([{...original,text:'Delayed reset conflict'}],[original.id]));await expect.poll(()=>page.evaluate(()=>window.__importGate.entered)).toBe(true);
 const other=await context.newPage();await ready(other);await openPreferences(other);await other.getByText('Backup and reset',{exact:true}).click();
 async function resetAndEnable(){other.once('dialog',d=>d.accept());await other.getByRole('button',{name:'Reset all private tracking'}).click();await other.locator('.personal-settings').getByRole('button',{name:'Enable private tracking',exact:true}).click();}
 await resetAndEnable();await expect(page.locator('.personal-settings input[type=file]')).toHaveValue('');
 await page.evaluate(()=>window.__importGate.release());await expect.poll(()=>page.evaluate(()=>window.__importGate.finished)).toBe(true);
 await expect(page.getByRole('button',{name:'Confirm import and merge'})).toHaveCount(0);await expect(page.locator('.personal-settings')).not.toContainText('Delayed reset conflict');expect(await state(page)).toEqual({custom:[],favorites:[]});
 await backup(page,affirmationBackup([original],[original.id]));await expect(page.getByRole('button',{name:'Confirm import and merge'})).toHaveCount(1);
 await resetAndEnable();await expect(page.getByRole('button',{name:'Confirm import and merge'})).toHaveCount(0);expect(await state(page)).toEqual({custom:[],favorites:[]});await other.close();
});
test('legacy private backup previews and recovery bypass corrupt affirmation data; schema3 rejects before any writes',async({page})=>{
 await ready(page);await enable(page);
 const corruptKey=await page.evaluate(()=>{const key=`ocf-learned:v1:affirmation:${window.ocfPrivateLibrary.store.config().epoch}:line:bad`;localStorage.setItem(key,'{');return key;});
 const record={id:'33333333-3333-4333-8333-333333333333',subject:'preparation:human-plus',markedAt:'2026-11-19T00:00:00.000Z',guide:null,recording:null,external:{edition:'legacy one',date:null}};
 for(const schema of [1,2]){
  const candidate={schema,records:[{...record,external:{edition:`legacy ${schema}`,date:null}}],...(schema===2?{flags:[{subject:'OCF-AUT-001',kind:'favorite'}]}:{})};
  await backup(page,candidate);await expect(page.getByRole('button',{name:'Confirm import and merge'})).toHaveCount(1);await page.getByRole('button',{name:'Confirm import and merge'}).click();await expect(page.locator('.personal-settings')).toContainText('1 learned versions imported');
 }
 expect(await page.evaluate(()=>window.ocfPrivateLibrary.store.read().then(records=>records.length))).toBe(2);
 const before=await page.evaluate(()=>JSON.stringify({...localStorage}));
 await backup(page,{schema:3,records:[{...record,external:{edition:'must not import',date:null}}],flags:[],affirmations:{custom:[],favorites:[]}});
 await expect(page.locator('.personal-settings')).toContainText('unreadable');await expect(page.getByRole('button',{name:'Confirm import and merge'})).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).toBe(before);expect(await page.evaluate(key=>localStorage.getItem(key),corruptKey)).toBe('{');
});
