const {test,expect}=require('@playwright/test');
const fs=require('node:fs/promises');
const facts=require('../scripts/morning_originals.json');
const model=require('../site/assets/js/morning-state.js');
const {openPreferences,closePreferences}=require('./preferences');
const picker=page=>page.getByRole('combobox',{name:'Choose a function cue'});
const search=page=>page.getByRole('searchbox',{name:'Search function cues'});
const toggle=page=>page.getByRole('checkbox',{name:'Show original Human Plus cues'});
const rows=page=>page.evaluate(()=>window.ocfPrivateLibrary.store.readRoutine().rows);
const label=id=>{const e=model.historical[id];return `${e.title} — ${e.text} (Original Human Plus; ${e.roleLabel}; ${e.evidenceLabel})`;};
async function ready(page){await page.goto('/my-morning/');await page.locator('.routine-editor > summary').click();await expect(toggle(page)).not.toBeChecked();}
async function choose(page,id){await search(page).fill('');const option=picker(page).getByRole('option',{name:label(id),exact:true});await picker(page).selectOption(await option.getAttribute('value'));await expect(page.locator('.routine-choice-info')).toContainText(model.historical[id].roleLabel);await page.getByRole('button',{name:'Add selected cue',exact:true}).click();await expect(search(page)).toBeFocused();}
async function backupArea(page){await openPreferences(page);const details=page.getByText('Backup and reset',{exact:true}).locator('..');if(await details.getAttribute('open')===null)await details.locator('summary').click();return page.locator('.personal-settings');}

test('all 65 originals, roles and evidence are searchable on mobile with keyboard and axe',async({page})=>{
 await page.setViewportSize({width:375,height:900});await ready(page);await expect(picker(page).locator('optgroup[label="Original Human Plus — historical cues"]')).toHaveCount(0);
 const external=[];page.on('request',request=>{if(new URL(request.url()).origin!==new URL(page.url()).origin)external.push(request.url());});
 await toggle(page).focus();await page.keyboard.press('Space');
 const originals=picker(page).locator('optgroup[label="Original Human Plus — historical cues"] option');await expect(originals).toHaveCount(65);
 expect(await originals.allTextContents()).toEqual(facts.rows.map(r=>label(r.id)));
 for(const [query,id] of [['mobius-west','hplus-ocf-cmd-exp-001-legacy-01'],['offloading','hplus-off-loading-1988'],['PLUS-CLOSED','hplus-ocf-cmd-cog-003-closed'],['retrieval','hplus-ocf-cmd-cog-004-recall'],['short fix release','hplus-ocf-cmd-bod-015-legacy-02'],['zoning cancel','hplus-ocf-cmd-exp-002-cancel'],['PLUS-BALANCE-BLOODPRESSURE','hplus-ocf-cmd-bod-007-primary']]){
  await search(page).fill(query);await expect(picker(page).getByRole('option',{name:label(id),exact:true})).toHaveCount(1);
 }
 await search(page).fill('Strong Quick Release');await expect(originals).toHaveCount(0);
 await search(page).fill('project-recorded');await expect(originals).toHaveCount(53);
 await search(page).fill('archive command');await expect(originals).toHaveCount(12);
 await search(page).fill('short fix release');await picker(page).focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 const option=picker(page).getByRole('option',{name:label('hplus-ocf-cmd-bod-015-legacy-02'),exact:true});await picker(page).selectOption(await option.getAttribute('value'));
 await expect(page.locator('.routine-choice-info')).toContainText('Short Fix release');await expect(page.locator('.routine-choice-info')).toContainText('Archive command corroborated');
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});expect(await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(external).toEqual([]);await page.screenshot({path:'browser-artifacts/originals-picker-375.png',fullPage:true});
});

test('distinct original contexts and OCF identities survive saved mixes, toggles and backup merge',async({page})=>{
 await ready(page);await toggle(page).check();
 const ids=['hplus-attention-booklet','hplus-off-loading-1988','hplus-ocf-cmd-fnd-006-primary','hplus-ocf-cmd-bod-015-legacy-02','hplus-ocf-cmd-cog-006-primary','hplus-ocf-cmd-cog-004-recall','hplus-ocf-cmd-bod-010-primary'];
 for(const id of ids){await choose(page,id);await expect(picker(page).getByRole('option',{name:label(id),exact:true})).toHaveCount(0);}
 const ocf=picker(page).locator('option').filter({hasText:'Nutricia — Plus Food More (OCF'});await expect(ocf).toHaveCount(1);await picker(page).selectOption(await ocf.getAttribute('value'));await page.getByRole('button',{name:'Add selected cue',exact:true}).click();await expect.poll(async()=>(await rows(page)).length).toBe(8);
 const before=await rows(page);expect(before.slice(0,7).map(r=>r.command)).toEqual(ids);expect(before.slice(0,2).map(r=>r.text)).toEqual(['Plus Focus','Plus Fade Fade']);expect(before[7].kind).toBe('function');
 await toggle(page).uncheck();expect(await rows(page)).toEqual(before);await page.getByRole('button',{name:'Done',exact:true}).click();await page.reload();expect(await rows(page)).toEqual(before);await page.locator('.routine-editor > summary').click();await expect(toggle(page)).not.toBeChecked();await toggle(page).check();for(const id of ids)await expect(picker(page).getByRole('option',{name:label(id),exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Done',exact:true}).click();await page.locator('.routine-reading .routine-provenance').filter({hasText:'Short Fix'}).locator('summary').click();await expect(page.locator('.routine-reading')).toContainText('Archive command corroborated');await page.locator('.routine-reading .routine-provenance').filter({hasText:'Imprint'}).locator('summary').click();await expect(page.locator('.routine-reading')).toContainText('Project-recorded');
 await page.setViewportSize({width:375,height:900});await page.screenshot({path:'browser-artifacts/originals-mixed-375.png',fullPage:true});
 await backupArea(page);const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'Export private backup',exact:true}).click();const backup=JSON.parse(await fs.readFile(await(await waiting).path(),'utf8'));expect(backup.schema).toBe(5);expect(backup.routine).toEqual(before);await closePreferences(page);
 await page.evaluate(async()=>{const {store,refresh}=window.ocfPrivateLibrary;store.reset();store.enable();await refresh();});
 for(let i=0;i<2;i++){const area=await backupArea(page);await area.getByLabel('Import backup',{exact:false}).setInputFiles({name:'synthetic-originals.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await area.getByRole('button',{name:'Confirm import and merge'}).click();await closePreferences(page);expect(await rows(page)).toEqual(before);}
 expect(await page.evaluate(()=>window.ocfPrivateLibrary.store.readFlags())).toEqual([]);expect(await page.evaluate(()=>window.ocfPrivateLibrary.store.read())).toEqual([]);
});
