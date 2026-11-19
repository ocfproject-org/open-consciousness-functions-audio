const {test,expect}=require('@playwright/test');
const {openPreferences,closePreferences,selectPreference}=require('./preferences');
const KEY='ocf-learned:v1';
const settings={schema:1,kind:'ocf-site-preferences',theme:'black',edition:'0.1.0',format:'flac'};
async function openBackup(page){await openPreferences(page);const panel=page.locator('.preferences-backup');if(await panel.getAttribute('open')===null)await panel.locator('summary').click();return panel;}
async function load(page,value){const panel=await openBackup(page);await panel.getByLabel('Import site settings',{exact:false}).setInputFiles({name:'settings.json',mimeType:'application/json',buffer:Buffer.from(typeof value==='string'?value:JSON.stringify(value))});return panel;}
test('settings backup previews and confirms three preferences without progress, URLs or transient state',async({page})=>{
 const writes=[];page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
 await page.goto('/functions/OCF-AUT-001/');await expect(page.locator('.personal-settings').filter({hasText:'Private library'})).toBeAttached();
 await page.evaluate(key=>localStorage.setItem('synthetic-private','private URL and playback values'),KEY);
 let panel=await load(page,settings);await expect(panel).toContainText('Preview: theme black');await expect(page.getByLabel('Audio edition',{exact:true})).toHaveValue('latest');
 await panel.getByRole('button',{name:'Cancel settings import'}).click();await expect(page.getByLabel('Audio edition',{exact:true})).toHaveValue('latest');
 panel=await load(page,settings);await panel.getByRole('button',{name:'Confirm settings import'}).click();await expect(page.getByLabel('Audio edition',{exact:true})).toHaveValue('0.1.0');await expect(page.getByLabel('Audio format',{exact:true})).toHaveValue('flac');await expect(page.locator('html')).toHaveAttribute('data-theme','black');expect(await page.evaluate(key=>localStorage.getItem(key),KEY)).toBeNull();
 const waiting=page.waitForEvent('download');await panel.getByRole('button',{name:'Export site settings'}).click();const download=await waiting;const text=await require('node:fs/promises').readFile(await download.path(),'utf8');expect(JSON.parse(text)).toEqual(settings);expect(text).not.toMatch(/private URL|playback|http|record|learned/);
 await closePreferences(page);await page.reload();await openPreferences(page);await expect(page.getByLabel('Audio edition',{exact:true})).toHaveValue('0.1.0');await expect(page.getByLabel('Audio format',{exact:true})).toHaveValue('flac');expect(writes).toEqual([]);
});
test('settings validation is strict; close cancels import; Latest is preserved as a choice',async({page})=>{
 await page.goto('/');
 for(const value of ['{',{...settings,schema:2},{...settings,edition:'9.9.9'},{...settings,format:'wav'},{...settings,tracking:true},{schema:1,records:[]},' '.repeat(16385)]){const panel=await load(page,value);await expect(panel.getByRole('button',{name:'Confirm settings import'})).toBeHidden();await expect(page.getByLabel('Audio edition',{exact:true})).toHaveValue('latest');}
 await load(page,settings);await page.keyboard.press('Escape');const panel=await openBackup(page);await expect(panel.getByRole('button',{name:'Confirm settings import'})).toBeHidden();
 await load(page,{...settings,edition:'latest'});await panel.getByRole('button',{name:'Confirm settings import'}).click();await expect(page.getByLabel('Audio edition',{exact:true})).toHaveValue('latest');
});
test('mobile settings backup stays in Preferences and never appears in the learned popup',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/functions/OCF-AUT-001/');const panel=await load(page,settings);await panel.scrollIntoViewIfNeeded();await page.screenshot({path:'browser-artifacts/integrated-settings-backup-390.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.keyboard.press('Escape');
 await page.locator('.learned-panel').getByRole('button',{name:/^Learned:/}).click();await expect(page.locator('#mark-learned-dialog')).not.toContainText(/Import|Export|backup/);await page.keyboard.press('Escape');await expect(page.locator('.learned-panel').getByRole('button',{name:/^Learned:/})).toBeFocused();
});
test('settings import preserves existing private marks and works with unavailable local storage',async({page,context})=>{
 await page.goto('/functions/OCF-AUT-001/');await expect(page.locator('.personal-settings')).toBeAttached();await openPreferences(page);await page.locator('.personal-settings').getByRole('button',{name:'Enable private tracking'}).click();await closePreferences(page);
 await page.locator('.learned-panel').getByRole('button',{name:/^Favorite:/}).click();await page.locator('.learned-panel').getByRole('button',{name:/^Learned:/}).click();await page.getByRole('button',{name:'Save learned version'}).click();
 const read=()=>page.evaluate(key=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith(key)).map(k=>[k,localStorage[k]])),KEY);const before=await read();const panel=await load(page,settings);await panel.getByRole('button',{name:'Confirm settings import'}).click();expect(await read()).toEqual(before);
 const other=await context.newPage();await other.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('blocked');}}));await other.goto('/');const blocked=await load(other,{...settings,edition:'latest'});await blocked.getByRole('button',{name:'Confirm settings import'}).click();await expect(other.locator('html')).toHaveAttribute('data-theme','black');await expect(other.getByLabel('Audio format',{exact:true})).toHaveValue('flac');await expect(blocked).toContainText('Browser storage availability');await other.close();
});
