const {openPreferences,closePreferences,selectPreference} = require('./preferences');
const {test,expect}=require('@playwright/test');
const key='ocf-audio-edition:v1';
const routes=['/','/functions/','/downloads/','/functions/OCF-FND-004/','/preparation-learning/','/quick-reference/'];
async function selected(page,format,edition='0.1.0'){
 await expect(page.getByLabel('Audio format',{exact:true})).toHaveValue(format);
 await expect(page.getByLabel('Audio edition',{exact:true})).toHaveValue(edition);
 expect(await page.locator('[data-format-content]:visible').evaluateAll(nodes=>[...new Set(nodes.map(n=>n.dataset.formatContent))])).not.toContain(format==='mp3'?'flac':'mp3');
}
test('format and edition persist together across every view, reload and Back/Forward',async({page})=>{
 await page.goto('/functions/');await expect(page.getByLabel('Audio format',{exact:true})).toHaveValue('mp3');
 await selectPreference(page,'Audio edition','0.1.0');
 for(const format of ['flac','mp3']){
  await selectPreference(page,'Audio format',format);
  for(const route of routes){await page.goto(route);await selected(page,format);await page.reload();await selected(page,format);}
 }
 await page.goto('/downloads/');await selectPreference(page,'Audio format','flac');
 await page.goto('/preparation-learning/');await page.goBack();await expect(page).toHaveURL(/downloads\/$/);await selected(page,'flac');
 await page.goForward();await expect(page).toHaveURL(/preparation-learning\/$/);await selected(page,'flac');
 await selectPreference(page,'Audio edition','latest');
 await page.goBack();await expect(page).toHaveURL(/downloads\/$/);await selected(page,'flac','latest');
 await selectPreference(page,'Audio format','mp3');await page.goForward();await expect(page).toHaveURL(/preparation-learning\/$/);await selected(page,'mp3','latest');
});
test('legacy edition-only preferences preserve edition and default MP3; invalid formats recover',async({page})=>{
 await page.addInitScript(k=>localStorage.setItem(k,JSON.stringify({schema:1,selection:'0.1.0',updatedAt:1})),key);
 await page.goto('/downloads/');await selected(page,'mp3');
 await selectPreference(page,'Audio format','flac');await page.reload();await selected(page,'flac');
 await page.evaluate(k=>{const v={schema:1,selection:'0.1.0',format:'wav',updatedAt:Date.now()+100};localStorage.setItem(k,JSON.stringify(v));sessionStorage.setItem(k,JSON.stringify(v));},key);
 await page.reload();await selected(page,'mp3');
});
test('blocked storage carries BOTH choices through links/reload/history and latest choice wins',async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked')};Storage.prototype.setItem=()=>{throw Error('blocked')};});
 await page.goto('/functions/');await selectPreference(page,'Audio edition','0.1.0');await selectPreference(page,'Audio format','flac');
 await page.locator('.session-card[data-edition="0.1.0"]').getByRole('link',{name:'Relax',exact:true}).click();
 await selected(page,'flac');await page.reload();await selected(page,'flac');
 await selectPreference(page,'Audio format','mp3');await page.goBack();await selected(page,'mp3');await page.goForward();await selected(page,'mp3');
});
test('Surprise uses exactly chosen format/edition, ignores search and does not retune existing choice',async({page})=>{
 await page.goto('/functions/');const audio=page.locator('.surprise-session audio');
 for(const edition of ['0.1.0','0.2.0'])for(const format of ['flac','mp3']){
  await selectPreference(page,'Audio edition',edition);await selectPreference(page,'Audio format',format);
  await page.locator('#search').fill('no matching function');await page.getByRole('button',{name:'Surprise me',exact:true}).click();
  await expect(audio).toHaveAttribute('data-session-format',format);await expect(audio).toHaveAttribute('data-session-edition',edition);await expect(audio).toHaveAttribute('src',new RegExp('\\.'+format+'$'));
  const src=await audio.getAttribute('src');await selectPreference(page,'Audio format',format==='mp3'?'flac':'mp3');await expect(audio).toHaveAttribute('src',src);await expect(page.locator('#surprise-format')).toHaveText('Player format: '+format.toUpperCase());
 }
});
test('missing chosen format never falls back for Surprise or Browse player',async({page})=>{
 await page.route('**/browse-catalog.json',async route=>{const response=await route.fetch();const catalog=await response.json();for(const release of catalog.releases)for(const group of [...release.functions,...release.preparations])for(const session of group.sessions)session.assets=session.assets.filter(a=>a.format==='mp3');await route.fulfill({json:catalog});});
 await page.goto('/functions/');await selectPreference(page,'Audio format','flac');
 await expect(page.getByRole('button',{name:'Surprise me',exact:true})).toBeDisabled();
 const card=page.locator('.session-card:visible').first();await expect(card.getByRole('button',{name:/Show player/})).toBeDisabled();await expect(card.locator('[data-format-unavailable]')).toContainText('FLAC is not available');
 await expect(page.locator('.surprise-session audio')).toHaveCount(0);
 await selectPreference(page,'Audio format','mp3');await expect(page.getByRole('button',{name:'Surprise me',exact:true})).toBeEnabled();
});
test('used Browse player and selected files retain original format until explicit player switch',async({page})=>{
 await page.goto('/functions/');const card=page.locator('.session-card:visible').filter({has:page.getByRole('link',{name:'Relax',exact:true})});
 await card.getByRole('checkbox',{name:/Select MP3/}).check();await card.getByRole('button',{name:/Show player/}).click();const audio=card.locator('audio');const src=await audio.getAttribute('src');
 await audio.evaluate(a=>{a.dataset.formatUsed='true'});
 await selectPreference(page,'Audio format','flac');await expect(audio).toHaveAttribute('src',src);await expect(audio).toHaveAttribute('data-session-format','mp3');
 await expect(page.locator('#selection-count')).toContainText('1 hidden by filters');await page.locator('#selected-files-summary').click();await expect(page.locator('#selected-files-list')).toContainText('MP3 (hidden by filters)');
 await card.getByRole('button',{name:'Switch player to FLAC'}).click();await expect(audio).toHaveAttribute('src',/\.flac$/);await expect(audio).toHaveAttribute('data-session-format','flac');
 await expect(page.locator('#selected-files-list')).toContainText('MP3 (hidden by filters)');
});
test('function players preserve active audio when format changes; explicit switch uses released FLAC',async({page})=>{
 await page.goto('/functions/OCF-FND-004/');const audio=page.locator('.edition-card:visible audio');const src=await audio.locator('source').getAttribute('src');
 await audio.evaluate(a=>{a.dataset.formatUsed='true'});
 await selectPreference(page,'Audio format','flac');await expect(audio.locator('source')).toHaveAttribute('src',src);
 await page.getByRole('button',{name:'Switch player to FLAC'}).click();await expect(audio.locator('source')).toHaveAttribute('src',/\.flac$/);await expect(audio).toHaveAttribute('data-session-format','flac');
});
test('released Browse artwork is manifest matched, lazy, responsive and reserves geometry on failure',async({page})=>{
 await page.goto('/functions/');const card=page.locator('.session-card:visible').first();const img=card.locator('.browse-artwork img');
 await expect(img).toHaveAttribute('loading','lazy');await expect(img).toHaveAttribute('width','96');await expect(img).toHaveAttribute('height','96');
 const url=await img.getAttribute('src');const catalog=await page.request.get('/catalog.json').then(r=>r.json());expect(catalog.releases.flatMap(r=>r.companions).some(a=>a.format==='png'&&a.download_url===url)).toBe(true);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});const box=await card.locator('.browse-artwork').boundingBox();expect(box.width).toBe(box.height);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await img.evaluate(i=>i.dispatchEvent(new Event('error')));await expect(card.locator('.artwork-fallback')).toBeVisible();const after=await card.locator('.browse-artwork').boundingBox();expect(after.width).toBe(box.width);expect(after.height).toBe(box.height);
 }
});
test('format-specific ZIPs and cross-tab format choice follow the shared preference',async({page,context})=>{
 await page.goto('/functions/');const other=await context.newPage();await other.goto('/downloads/');
 for(const format of ['flac','mp3']){
  await selectPreference(page,'Audio format',format);await expect(other.getByLabel('Audio format',{exact:true})).toHaveValue(format);
  const details=page.locator('#release-extras details:visible');await details.evaluate(d=>d.open=true);
  const urls=await details.locator('a:visible').evaluateAll(nodes=>nodes.map(n=>n.href).filter(u=>u.endsWith('.zip')));expect(urls.length).toBeGreaterThan(0);expect(urls.every(u=>u.includes('---'+format+'---'))).toBe(true);
 }
 await other.close();
});
test('explicit format switch cancels a pending old-format metadata resume callback',async({page})=>{
 await page.goto('/functions/');const card=page.locator('.session-card:visible').first();await card.getByRole('button',{name:/Show player/}).click();const audio=card.locator('audio');
 await audio.evaluate(a=>{a.dataset.ocfResumePosition='42';a.dataset.ocfRestoredBookmarkPending='true';Object.defineProperty(a,'readyState',{get:()=>0,configurable:true});window.resumeWrites=[];Object.defineProperty(a,'currentTime',{get:()=>0,set:v=>window.resumeWrites.push(v),configurable:true});a.dispatchEvent(new Event('play'));});
 await selectPreference(page,'Audio format','flac');await card.getByRole('button',{name:'Switch player to FLAC'}).click();
 await audio.evaluate(a=>a.dispatchEvent(new Event('loadedmetadata')));
 expect(await page.evaluate(()=>window.resumeWrites)).toEqual([]);await expect(audio).not.toHaveAttribute('data-ocf-resume-position');await expect(audio).not.toHaveAttribute('data-ocf-restored-bookmark-pending');
});
test('active synthetic playback remains uninterrupted on format preference change in Browse and guide',async({page})=>{
 const wav=Buffer.alloc(44+8000*30,128);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(8000,28);wav.writeUInt16LE(1,32);wav.writeUInt16LE(8,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
 await page.route(/https:\/\/github.com\/.*\.(mp3|flac)$/,route=>route.fulfill({contentType:'audio/wav',body:wav}));
 for(const route of ['/functions/','/functions/OCF-FND-004/']){
  await page.goto(route);await selectPreference(page,'Audio format','mp3');
  if(route==='/functions/')await page.locator('.session-card:visible').first().getByRole('button',{name:/Show player/}).click();
  const audio=page.locator(route==='/functions/'?'.session-card:visible audio':'.edition-card:visible audio').first();await audio.evaluate(a=>a.play());const source=await audio.evaluate(a=>a.currentSrc);
  await selectPreference(page,'Audio format','flac');expect(await audio.evaluate(a=>a.paused)).toBe(false);expect(await audio.evaluate(a=>a.currentSrc)).toBe(source);
  await page.getByRole('button',{name:'Switch player to FLAC'}).click();await expect(audio).toHaveAttribute('data-session-format','flac');expect(await audio.evaluate(a=>a.paused)).toBe(true);
 }
});
test('missing artwork keeps a stable readable fallback and FLAC view passes accessibility',async({page})=>{
 await page.route('**/browse-catalog.json',async route=>{const response=await route.fetch();const catalog=await response.json();for(const r of catalog.releases)for(const g of [...r.functions,...r.preparations])for(const s of g.sessions)delete s.artwork;await route.fulfill({json:catalog});});
 await page.goto('/functions/');await selectPreference(page,'Audio format','flac');const card=page.locator('.session-card:visible').first();await expect(card.locator('.browse-artwork img')).toHaveCount(0);await expect(card.locator('.artwork-fallback')).toBeVisible();
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});expect(await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations)).toEqual([]);
});

test('Browse artwork is a keyboard-accessible exact Guide link with no playback side effects',async({page})=>{
 const media=[];page.on('request',r=>{if(/\.(mp3|flac)(?:\?|$)/i.test(r.url()))media.push(r.url());});
 for(const edition of ['latest','0.1.0']){
  await page.goto('/functions/');await selectPreference(page,'Audio edition',edition);
  for(const id of ['OCF-FND-004','preparation-learning']){
   const card=page.locator(`.session-card[data-function-id="${id}"]:visible`).first();
   const art=card.locator('a.browse-artwork');
   await expect(art).toHaveAttribute('href',await card.locator('h3 a').getAttribute('href'));
   await expect(art).toHaveAccessibleName(/^(?:Artwork unavailable\. )?Open .+ guide$/);
   await art.focus();await page.keyboard.press('Enter');
   await expect(page).toHaveURL(id==='preparation-learning'?/\/preparation-learning\//:new RegExp(`/functions/${id}/`));
   expect(await page.locator('audio').evaluateAll(nodes=>nodes.every(a=>a.paused))).toBe(true);
   await page.goBack();await expect(page).toHaveURL(/\/functions\//);
  }
 }
 expect(media).toEqual([]);
});
