const {test,expect}=require('@playwright/test');
const {openPreferences,closePreferences,selectPreference}=require('./preferences');
const fs=require('node:fs/promises');
async function axe(page){await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});expect(await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations)).toEqual([]);}
test('375px first session explains four steps and duration before one short scroll',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 const media=[];page.on('request',r=>{if(/\.(mp3|flac)(\?|$)/.test(r.url()))media.push(r.url());});
 await page.goto('/start/');
 await expect(page.locator('.start-steps strong')).toHaveText(['Prepare','Choose','Learn','Use']);
 const cta=page.getByRole('link',{name:'Play Preparation Learning (about 28 minutes)',exact:true});
 expect((await cta.boundingBox()).y+(await cta.boundingBox()).height).toBeLessThan(812);
 await expect(page.locator('.start-journey > p').first()).toContainText('guided audio');
 await page.locator('.preparation-exception > summary').click();
 await expect(page.locator('.preparation-exception')).toContainText('Only people who have already learned the official Human Plus preparation track');
 await page.locator('.preparation-exception > summary').click();
 await fs.mkdir('browser-artifacts',{recursive:true});
 for(const theme of ['light','dark']){await page.evaluate(t=>localStorage.setItem('ocf-theme',t),theme);await page.reload();await page.screenshot({path:`browser-artifacts/start-375-${theme}.png`});expect(await cta.evaluate(a=>getComputedStyle(a).color)).not.toBe(await cta.evaluate(a=>getComputedStyle(a).backgroundColor));await axe(page);}
 await cta.click();await expect(page).toHaveURL(/preparation-learning\/#listen$/);
 await expect(page.locator('#listen .ocf-local-player:visible')).toHaveCount(1);
 await expect(page.locator('main')).toContainText('about 28 minutes');
 expect(media).toEqual([]);await axe(page);
});
test('Preferences is one action away, modal, keyboard accessible, and restores focus through Close Escape Back Forward',async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.goto('/start/');
 const trigger=page.locator('.site-header [data-preferences-open]');
 for(let i=0;i<2;i++){
  await trigger.click();await expect(page.getByRole('dialog',{name:'Preferences',exact:true})).toBeVisible();
  await expect(page.locator('[data-preferences-close]')).toBeFocused();
  await axe(page);await page.keyboard.press('Escape');await expect(page.locator('#preferences')).toBeHidden();await expect(trigger).toBeFocused();
 }
 await page.goto('/downloads/');await page.goBack();await expect(page).toHaveURL(/start\/$/);
 await openPreferences(page);await closePreferences(page);await page.goForward();await expect(page).toHaveURL(/downloads\/$/);await expect(page.locator('#preferences')).toBeHidden();
 await openPreferences(page);await page.goBack();await expect(page).toHaveURL(/start\/$/);await expect(page.locator('#preferences')).toBeHidden();
 await page.goForward();await expect(page).toHaveURL(/downloads\/$/);await expect(page.locator('#preferences')).toBeHidden();
 await openPreferences(page);await page.reload();await expect(page.locator('#preferences')).toBeHidden();
 const contextual=page.locator('[data-preferences-open]').nth(1);
 await page.goto('/downloads/');await contextual.click();await closePreferences(page);await expect(contextual).toBeFocused();
});
test('Downloads paginates exact selected edition files and searches titles cues and categories without media requests',async({page})=>{
 const media=[];page.on('request',r=>{if(/\.(mp3|flac)(\?|$)/.test(r.url()))media.push(r.url());});
 await page.goto('/downloads/');
 const cards=page.locator('.download-card:visible');const search=page.locator('#download-search');const more=page.locator('#downloads-more');
 const catalog=await page.request.get('/catalog.json').then(r=>r.json());
 for(const edition of ['0.2.0','0.1.0'])for(const format of ['mp3','flac']){
  await selectPreference(page,'Audio edition',edition);await selectPreference(page,'Audio format',format);await search.fill('');
  await expect(cards).toHaveCount(12);await expect(page.locator('#download-count')).toHaveText(`12 of 59 sessions · ${format.toUpperCase()} · Edition ${edition}`);
  for(const n of [24,36,48,59]){await more.click();await expect(cards).toHaveCount(n);}
  await expect(more).toBeHidden();
  const release=catalog.releases.find(r=>r.version===edition);
  const expected=[...release.preparations,...release.functions].flatMap(f=>f.sessions.flatMap(s=>s.assets.filter(a=>a.format===format).map(a=>a.download_url))).sort();
  expect(await cards.locator('.download-action:visible').evaluateAll(links=>links.map(a=>a.href).sort())).toEqual(expected);
  for(const query of ['Relax','Plus Relax','foundation','not-a-real-function']){
   await search.fill(query);
   const expectedIds=await page.locator(`.download-card[data-edition="${edition}"]`).evaluateAll((nodes,q)=>nodes.filter(n=>n.dataset.downloadSearch.toLowerCase().includes(q.toLowerCase())).slice(0,12).map(n=>n.dataset.functionId),query);
   expect(await cards.evaluateAll(nodes=>nodes.map(n=>n.dataset.functionId))).toEqual(expectedIds);
   if(query==='not-a-real-function')await expect(page.locator('#download-count')).toContainText('No matching downloads');
  }
 }
 await search.fill('Relax');await expect(cards).toHaveCount(1);
 await cards.locator('summary').click();await expect(cards.locator('.download-file-details')).toContainText(/[a-f0-9]{64}/);
 expect(media).toEqual([]);
});
test('Downloads restores query and expanded subset across reload and navigation; preference changes reset subset',async({page})=>{
 await page.goto('/downloads/');await page.locator('#downloads-more').click();await page.reload();await expect(page.locator('.download-card:visible')).toHaveCount(24);
 await page.goto('/start/');await page.goBack();await expect(page.locator('.download-card:visible')).toHaveCount(24);
 await selectPreference(page,'Audio format','flac');await expect(page.locator('.download-card:visible')).toHaveCount(12);
 await page.locator('#download-search').fill('Relax');await page.reload();await expect(page.locator('#download-search')).toHaveValue('Relax');await expect(page.locator('.download-card:visible')).toHaveCount(1);
 await selectPreference(page,'Audio edition','0.1.0');await expect(page.locator('#download-search')).toHaveValue('Relax');await expect(page.locator('.download-card:visible')).toHaveCount(1);
 for(const width of [375,1440]){await page.setViewportSize({width,height:900});await page.locator('#download-search').fill('');await page.screenshot({path:`browser-artifacts/downloads-compact-${width}.png`,fullPage:true});await axe(page);}
});
test('Downloads search and preferences remain usable when all storage is blocked',async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked')};Storage.prototype.setItem=()=>{throw Error('blocked')};});
 await page.goto('/downloads/');await selectPreference(page,'Audio edition','0.1.0');await selectPreference(page,'Audio format','flac');
 await page.locator('#download-search').fill('Relax');await expect(page.locator('.download-card:visible')).toHaveCount(1);
 await page.reload();await expect(page.getByLabel('Audio edition',{exact:true})).toHaveValue('0.1.0');await expect(page.getByLabel('Audio format',{exact:true})).toHaveValue('flac');await expect(page.locator('.download-card:visible')).toHaveCount(12);
 await page.locator('#downloads-more').click();await expect(page.locator('.download-card:visible')).toHaveCount(24);
});
