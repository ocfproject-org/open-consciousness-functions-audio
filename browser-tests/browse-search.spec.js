const {test,expect}=require('@playwright/test');
const {selectPreference}=require('./preferences');
const cards='.session-card:visible';
async function first(page){await expect(page.locator(cards).first().locator('h3')).toHaveText('Manifest');}
async function axe(page){await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});expect(await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations)).toEqual([]);}
test('Browse search ranks names and shorthand cues before descriptions, compacts mobile results and restores panels',async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.goto('/functions/');const search=page.locator('#search');await expect(search).toBeEnabled();await expect(page.locator('.personal-settings')).toBeAttached();
 for(const query of ['Manifest','Plus Manifest','PLUS—MANIFEST','ＭＡＮＩＦＥＳＴ','Manfiest','Man']){await search.fill(query);await first(page);await expect(search).toBeFocused();await expect(search).toHaveValue(query);}
 await search.fill('Manifest');await expect(page.locator(cards).filter({has:page.getByRole('heading',{name:'Options',exact:true})})).toHaveCount(1);
 await expect(page.locator(cards).first().locator('.session-cues')).toContainText('Plus Manifest');await expect(page.locator('.selection-tools')).toBeHidden();await expect(page.locator('.browse-banner')).toBeHidden();await expect(page.locator('.preparation-note')).toBeHidden();await expect(page.locator('#category-filter')).toBeVisible();
 expect((await page.locator(cards).first().boundingBox()).y).toBeLessThan(700);await page.screenshot({path:'browser-artifacts/browse-manifest-375.png'});await axe(page);
 await search.fill('nothing-ever-matches-this');await expect(page.locator(cards)).toHaveCount(0);await expect(page.locator('#catalog-no-results')).toBeVisible();
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();await expect(search).toBeFocused();await expect(page.locator('.selection-tools')).toBeVisible();await expect(page.locator('.preparation-note')).toBeVisible();
});
test('Browse ranked search survives edition/format, reload and Back/Forward with art and private filters intact',async({page})=>{
 await page.goto('/functions/');await expect(page.locator('.personal-settings')).toBeAttached();const search=page.locator('#search');await search.fill('Manifest');
 for(const edition of ['0.1.0','0.2.0'])for(const format of ['flac','mp3']){await selectPreference(page,'Audio edition',edition);await selectPreference(page,'Audio format',format);await first(page);await expect(page.locator(cards).first()).toHaveAttribute('data-edition',edition);await expect(search).toHaveValue('Manifest');}
 await page.getByLabel('Sort personal states',{exact:true}).selectOption('favorite');await first(page);await page.getByLabel('My library',{exact:true}).selectOption('learned');await expect(page.locator(cards)).toHaveCount(0);await page.getByLabel('My library',{exact:true}).selectOption('all');await first(page);
 const art=page.locator(cards).first().locator('a.browse-artwork');await expect(art).toHaveAttribute('href',/OCF-/);await art.click();await expect(page.locator('h1')).toHaveText('Manifest');await page.goBack();await expect(search).toHaveValue('Manifest');await first(page);await page.goForward();await expect(page.locator('h1')).toHaveText('Manifest');await page.goBack();await page.reload();await expect(search).toHaveValue('Manifest');await first(page);
 await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'browser-artifacts/browse-manifest-1280.png'});await axe(page);
});
test('ranked reordering and hidden export panels preserve selection and active audio identity',async({page})=>{
 await page.goto('/functions/');await expect(page.locator('.personal-settings')).toBeAttached();await page.locator('#search').fill('Options');const card=page.locator(cards).filter({has:page.getByRole('heading',{name:'Options',exact:true})});await card.getByRole('button',{name:/Show player/}).click();const audio=card.locator('audio');
 const wav=Buffer.alloc(44+8000*30,128);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(8000,28);wav.writeUInt16LE(1,32);wav.writeUInt16LE(8,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
 await audio.evaluate(async(a,src)=>{a.src=src;await a.play();a.dataset.testIdentity='retained';},'data:audio/wav;base64,'+wav.toString('base64'));
 await page.locator('#search').fill('Manifest');await first(page);expect(await audio.evaluate(a=>a.paused)).toBe(false);await expect(audio).toHaveAttribute('data-test-identity','retained');await expect(card).toBeVisible();await page.locator('#search').fill('');expect(await audio.evaluate(a=>a.paused)).toBe(false);
});
test('relevance outranks personal sorting while favorite filtering and selected files compose',async({page})=>{
 await page.goto('/functions/');await expect(page.locator('.personal-settings')).toBeAttached();await page.locator('#search').fill('Manifest');
 const options=page.locator(cards).filter({has:page.getByRole('heading',{name:'Options',exact:true})});await options.getByRole('button',{name:/^Favorite:/}).click();
 await options.locator('input[data-selected-asset-id]:visible').check();await page.getByLabel('Sort personal states',{exact:true}).selectOption('favorite');await first(page);await page.getByLabel('My library',{exact:true}).selectOption('favorite');await expect(page.locator(cards)).toHaveCount(1);await expect(options).toBeVisible();await page.getByLabel('My library',{exact:true}).selectOption('all');await first(page);
 await page.locator('#search').fill('');await expect(page.locator('#selection-count')).toContainText('1 file');await expect(options.getByRole('button',{name:/^Favorite:/})).toHaveAttribute('aria-pressed','true');
});
test('search ranking works if optional personal tracking fails to load',async({page})=>{
 await page.route('**/assets/js/learned.js*',route=>route.abort());await page.goto('/functions/');await expect(page.locator('#search')).toBeEnabled();await page.locator('#search').fill('Manifest');await first(page);
});
test('Surprise remains independently usable below results and active playback survives search movement',async({page})=>{
 await page.goto('/functions/');await page.getByRole('button',{name:'Surprise me',exact:true}).click();const section=page.locator('.surprise-session'),audio=section.locator('audio');
 const wav=Buffer.alloc(44+8000*30,128);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(8000,28);wav.writeUInt16LE(1,32);wav.writeUInt16LE(8,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
 await audio.evaluate(async(a,src)=>{a.src=src;await a.play();a.dataset.testIdentity='surprise';},'data:audio/wav;base64,'+wav.toString('base64'));
 await page.locator('#search').fill('Manifest');await first(page);await expect(section).toBeVisible();expect(await section.evaluate(s=>Boolean(document.querySelector('#catalog-results').compareDocumentPosition(s)&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);expect(await audio.evaluate(a=>a.paused)).toBe(false);
 await page.locator('#search').fill('');expect(await audio.evaluate(a=>a.paused)).toBe(false);await expect(audio).toHaveAttribute('data-test-identity','surprise');expect(await section.evaluate(s=>s.nextElementSibling.classList.contains('library-tools'))).toBe(true);
});
