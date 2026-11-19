const {test,expect}=require('@playwright/test');
const {selectPreference}=require('./preferences');
const fs=require('node:fs');
const crypto=require('node:crypto');
const source=fs.readFileSync('docs/website/function-chains.md','utf8');
const originalBlocks=source.split(/^## /m).slice(1).filter(x=>/^.*\n[\s\S]*\n1\. /.test(x));
async function axe(page){await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});expect(await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations)).toEqual([]);}
test('all17original chains retain exact source content, order, cues and anchors',async({page})=>{
 expect(crypto.createHash('sha256').update(source).digest('hex')).toBe('3c7f073d1d7c134f116ac542664b30d4210e2fad79d226113fc85daadba0a8b6');
 await page.goto('/function-chains/');await expect(page.locator('.chain-original')).toHaveCount(17);
 expect(originalBlocks).toHaveLength(17);
 for(let i=0;i<17;i++){
  const original=page.locator('.chain-original').nth(i);const block=originalBlocks[i];
  await expect(original.locator('h2')).toHaveText(block.split('\n')[0]);
  const stepTexts=block.split('\n').filter(x=>/^\d+\. /.test(x)).map(x=>x.replace(/^\d+\. /,'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1'));
  const actual=await original.locator('ol > li').evaluateAll(nodes=>nodes.map(n=>{const c=n.cloneNode(true);c.querySelectorAll('.chain-spoken-cue').forEach(s=>s.remove());return c.textContent.replace(/\s+/g,' ').trim();}));
  expect(actual).toEqual(stepTexts);
  const anchor=await original.locator('h2').getAttribute('id');await expect(page.locator(`.chain-card a[href="#${anchor}"]`)).toHaveCount(2);
 }
 await expect(page.locator('.chain-original .chain-spoken-cue')).toHaveCount(70);
 await expect(page.locator('.chain-directory')).toContainText('optional examples, not required activation sequences');
});
test('goal groups, function search, empty state and clearing affect only discovery cards',async({page})=>{
 await page.goto('/function-chains/');const cards=page.locator('.chain-card:visible');await expect(cards).toHaveCount(17);
 for(const [goal,count] of [['Learning',2],['Daily life',8],['Rest',3],['Reflection',4]]){
  await page.getByLabel('Goal group',{exact:true}).selectOption(goal);await expect(cards).toHaveCount(count);await expect(page.locator('#chain-count')).toHaveText(`${count} of 17 chains`);await expect(page.locator('.chain-original:visible')).toHaveCount(17);
 }
 await page.getByRole('button',{name:'Clear chain filters'}).click();await expect(page.getByLabel('Find a chain or function')).toBeFocused();
 await page.getByLabel('Find a chain or function').fill('nutricia');await expect(cards).toHaveCount(1);await expect(cards.locator('h4')).toHaveText('Weight management');
 await page.getByLabel('Find a chain or function').fill('no matching thing');await expect(cards).toHaveCount(0);await expect(page.locator('#chain-count')).toContainText('No matching chains');await page.getByRole('button',{name:'Clear chain filters'}).click();await expect(cards).toHaveCount(17);
});
test('directory and immediate learning links work with keyboard, historical preferences and deep links',async({page})=>{
 await page.goto('/function-chains/');await selectPreference(page,'Audio edition','0.1.0');await selectPreference(page,'Audio format','flac');
 await page.getByRole('link',{name:'View steps: Sleep preparation',exact:true}).focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(/#sleep-preparation$/);await expect(page.locator('#sleep-preparation')).toBeInViewport();
 const section=page.locator('.chain-section').filter({has:page.locator('#sleep-preparation')});await section.locator('summary').click();await section.getByRole('link',{name:'Use guide: Sleep',exact:true}).click();await expect(page).toHaveURL(/OCF-SLP-002\/#cues$/);await expect(page.getByLabel('Audio edition',{exact:true})).toHaveValue('0.1.0');await expect(page.getByLabel('Audio format',{exact:true})).toHaveValue('flac');
 await page.goBack();await expect(page).toHaveURL(/#sleep-preparation$/);if(!await section.locator('details').getAttribute('open').then(v=>v!==null))await section.locator('summary').click();await section.getByRole('link',{name:'Learn audio: Sleep',exact:true}).click();await expect(page).toHaveURL(/OCF-SLP-002\/#listening$/);
 await page.goto('/practice-chains/?from=directory#weight-management');await expect(page).toHaveURL(/function-chains\/\?from=directory#weight-management$/);await expect(page.locator('#weight-management')).toBeInViewport();
});
test('mobile and desktop directory is accessible in light and dark with no overflow',async({page})=>{
 for(const width of [375,1440])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:812});await page.goto('/function-chains/');await page.evaluate(t=>localStorage.setItem('ocf-theme',t),theme);await page.reload();await page.getByLabel('Goal group',{exact:true}).selectOption('Rest');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await axe(page);await page.locator('.chain-directory').scrollIntoViewIfNeeded();await page.screenshot({path:`browser-artifacts/chains-directory-${width}-${theme}.png`,fullPage:false});
 }
});
test('without JavaScript all directory cards, original sequences and learning links remain available',async({browser})=>{
 const c=await browser.newContext({javaScriptEnabled:false});const page=await c.newPage();await page.goto('/function-chains/#decision');await expect(page.locator('.chain-card')).toHaveCount(17);await expect(page.locator('.chain-original')).toHaveCount(17);await expect(page.locator('.chain-directory-tools')).toBeHidden();
 const section=page.locator('.chain-section').filter({has:page.locator('#decision')});await expect(section).toContainText('Optional variation: add Contemplation (Plus Open) before Manifest for quiet reflection on the choices.');await section.locator('summary').click();await section.getByRole('link',{name:'Use guide: Options'}).click();await expect(page).toHaveURL(/OCF-COG-005\/#cues$/);await c.close();
});
