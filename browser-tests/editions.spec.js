const {openPreferences,closePreferences,selectPreference} = require('./preferences');
const {test, expect} = require('@playwright/test');
const key = 'ocf-audio-edition:v1';
let latest, editionCount;
test.beforeEach(async ({request})=>{
  const catalog=await request.get('/catalog.json').then(r=>r.json());
  const release=catalog.releases[0];
  latest=release.version;
  editionCount=[...release.functions,...release.preparations].flatMap(row=>row.sessions).length;
});
async function assertEdition(page, version, selection = version) {
  await expect(page.getByLabel('Audio edition', {exact:true})).toHaveValue(selection);
  expect(await page.evaluate(()=>window.ocfEditions.current())).toBe(version);
  const visible = page.locator('[data-edition-content]:visible');
  expect(await visible.evaluateAll((nodes, selected) => nodes.filter(node => node.dataset.editionContent && node.dataset.editionContent !== selected).length, version)).toBe(0);
}
async function axe(page) {
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  expect(await page.evaluate(async()=> (await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations)).toEqual([]);
}
const routes=['/','/functions/','/downloads/','/functions/OCF-FND-004/','/preparation-learning/','/quick-reference/'];
test('new users see latest only in every view; deliberate historical choice survives navigation and reload',async({page})=>{
  for(const route of routes){
    await page.goto(route); await assertEdition(page,latest,'latest');
    if(route==='/functions/') await expect(page.locator('.session-card:not([data-edition=""]):visible')).toHaveCount(editionCount);
    if(route==='/downloads/') await expect(page.locator('.download-card:visible')).toHaveCount(12);
    if(route.includes('OCF-FND')||route.includes('preparation')) await expect(page.locator('.edition-card:visible')).toHaveCount(1);
  }
  await selectPreference(page,'Audio edition','0.1.0');
  for(const route of routes){
    await page.goto(route);await assertEdition(page,'0.1.0');
    await page.reload();await assertEdition(page,'0.1.0');
    if(route==='/functions/'){
      await expect(page.locator('.session-card:not([data-edition=""]):visible')).toHaveCount(59);
      await page.locator('#search').fill('Relax');await page.locator('#clear-library-filters').click();
      await assertEdition(page,'0.1.0');
      expect(await page.locator('.session-card:not([data-edition=""]):visible').evaluateAll(nodes=>[...new Set(nodes.map(n=>n.dataset.edition))])).toEqual(['0.1.0']);
      await expect(page.locator('#release-extras details:visible')).toHaveCount(1);
    }
    if(route==='/downloads/') await expect(page.locator('.download-card:visible')).toHaveCount(12);
    await axe(page);
  }
});
test('latest and historical preferences remain authoritative on Back and Forward',async({page})=>{
  await page.goto('/functions/');await selectPreference(page,'Audio edition','0.1.0');
  await page.locator('.session-card[data-edition="0.1.0"]').getByRole('link',{name:'Relax',exact:true}).click();
  await assertEdition(page,'0.1.0');await page.goBack();await assertEdition(page,'0.1.0');
  await page.goForward();await assertEdition(page,'0.1.0');
  await selectPreference(page,'Audio edition','latest');
  await page.goBack();await assertEdition(page,latest,'latest');
  await page.goForward();await assertEdition(page,latest,'latest');
  await page.reload();await assertEdition(page,latest,'latest');
});
test('legacy choices migrate once; invalid and unavailable choices fall back to latest',async({page})=>{
  await page.addInitScript(()=>sessionStorage.setItem('ocf-library-filters:/functions/',JSON.stringify({edition:'0.1.0'})));
  await page.goto('/downloads/');await assertEdition(page,'0.1.0');
  await selectPreference(page,'Audio edition','latest');
  await page.goto('/functions/');await assertEdition(page,latest,'latest');
  await page.evaluate(k=>localStorage.setItem(k,JSON.stringify({schema:1,selection:'0.0.0'})),key);
  await page.reload();await assertEdition(page,latest,'latest');
  await page.evaluate(k=>{localStorage.setItem(k,'{bad json');sessionStorage.removeItem(k);sessionStorage.removeItem('ocf-library-filters:/functions/');},key);
  // Corrupt shared data can still safely recover the legacy choice on a new document.
  await page.reload();await assertEdition(page,'0.1.0');
});
test('storage unavailable uses site links and URL to preserve deliberate choice across navigation and reload',async({page})=>{
  await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked')};Storage.prototype.setItem=()=>{throw Error('blocked')};});
  await page.goto('/functions/');await assertEdition(page,latest,'latest');
  await selectPreference(page,'Audio edition','0.1.0');
  await expect(page).toHaveURL(/edition=0.1.0/);
  await page.locator('.session-card[data-edition="0.1.0"]').getByRole('link',{name:'Relax',exact:true}).click();
  await assertEdition(page,'0.1.0');await page.reload();await assertEdition(page,'0.1.0');
  await page.goBack();await assertEdition(page,'0.1.0');await page.goForward();await assertEdition(page,'0.1.0');
  await selectPreference(page,'Audio edition','latest');await page.reload();await assertEdition(page,latest,'latest');
  await page.goBack();await assertEdition(page,latest,'latest');await page.goForward();await assertEdition(page,latest,'latest');
});
test('without JavaScript latest remains uncluttered and historical releases remain linked',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();
  for(const route of ['/functions/OCF-FND-004/','/preparation-learning/','/downloads/']){
    await page.goto(route);
    expect(await page.locator('[data-edition-content]:visible').evaluateAll(nodes=>[...new Set(nodes.map(n=>n.dataset.editionContent))])).toEqual([latest]);
    await expect(page.locator('body > noscript p')).toBeVisible();
    await expect(page.locator('noscript a[href$="/releases"]')).toBeVisible();
  }
  await context.close();
});
test('an active historical function player is retained, not retuned, until explicitly closed',async({page})=>{
  await page.goto('/functions/OCF-FND-004/');await selectPreference(page,'Audio edition','0.1.0');
  const historical=page.locator('.edition-card[data-edition-content="0.1.0"]');const audio=historical.locator('audio');
  const wav=Buffer.alloc(44+8000*30,128);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(8000,28);wav.writeUInt16LE(1,32);wav.writeUInt16LE(8,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
  await audio.evaluate(async(a,src)=>{a.src=src;await a.play();a.dataset.identity='historical';},'data:audio/wav;base64,'+wav.toString('base64'));
  const source=await audio.getAttribute('src');
  await selectPreference(page,'Audio edition','latest');
  await expect(historical).toBeVisible();await expect(audio).toHaveAttribute('src',source);await expect(audio).toHaveAttribute('data-identity','historical');
  expect(await audio.evaluate(a=>a.paused)).toBe(false);
  await historical.getByRole('button',{name:'Close previous edition player'}).click();
  await expect(historical).toBeHidden();expect(await audio.evaluate(a=>a.paused)).toBe(true);
  await expect(page.locator('.edition-card:visible')).toHaveCount(1);
});

test('readable but unwritable persistent storage cannot override the newer session fallback',async({page})=>{
  await page.addInitScript(k=>{
    const write=Storage.prototype.setItem;
    write.call(localStorage,k,JSON.stringify({schema:1,selection:'latest',updatedAt:1}));
    Storage.prototype.setItem=function(key,value){if(this===localStorage)throw Error('quota');return write.call(this,key,value);};
  },key);
  await page.goto('/downloads/');await selectPreference(page,'Audio edition','0.1.0');
  await page.reload();await assertEdition(page,'0.1.0');
  await page.goto('/preparation-learning/');await assertEdition(page,'0.1.0');
  await page.goBack();await assertEdition(page,'0.1.0');
  expect(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).selection,key)).toBe('latest');
  expect(await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)).selection,key)).toBe('0.1.0');
});
test('shared preference synchronizes between open pages without resetting history or release identity',async({page,context})=>{
  await page.goto('/downloads/');const other=await context.newPage();await other.goto('/preparation-learning/');
  await selectPreference(page,'Audio edition','0.1.0');await assertEdition(other,'0.1.0');
  await selectPreference(other,'Audio edition','latest');await assertEdition(page,latest,'latest');
  await other.close();
});
test('Surprise follows the selected edition while ignoring search/category filters',async({page})=>{
  await page.goto('/functions/');
  for(const edition of ['0.1.0','0.2.0']){
    await selectPreference(page,'Audio edition',edition);
    await page.locator('#search').fill('no such function');
    await page.locator('.surprise-session').getByRole('button',{name:'Surprise me',exact:true}).click();
    await expect(page.locator('.surprise-session audio')).toHaveAttribute('data-session-edition',edition);
    await expect(page.locator('.surprise-session audio')).toHaveAttribute('src',new RegExp('/releases/download/'+(edition==='0.1.0'?'audio-0.1.0-a6-20261111':'audio-0.2.0')+'/'));
  }
});

test('the old numeric latest default migrates to following Latest, while new explicit pins remain explicit',async({page})=>{
  await page.addInitScript(edition=>sessionStorage.setItem('ocf-library-filters:/functions/',JSON.stringify({edition})),latest);
  await page.goto('/downloads/');await assertEdition(page,latest,'latest');
  await selectPreference(page,'Audio edition','0.2.0');
  await page.reload();await assertEdition(page,'0.2.0','0.2.0');
});

test('generated pages request content-bound assets instead of cached legacy edition code',async({page})=>{
  let legacyRequested=false;
  await page.route('**/assets/js/app.js',async route=>{legacyRequested=true;await route.fulfill({contentType:'application/javascript',body:'throw new Error("cached legacy code")'});});
  await page.goto('/functions/');await expect(page.locator('.session-card:not([data-edition=""]):visible')).toHaveCount(editionCount);
  await expect(page.locator('script[src*="assets/js/app.js"]')).toHaveAttribute('src',/app\.js\?v=[a-f0-9]{16}$/);
  await expect(page.locator('script[src*="assets/js/editions.js"]')).toHaveAttribute('src',/editions\.js\?v=[a-f0-9]{16}$/);
  expect(legacyRequested).toBe(false);
});
