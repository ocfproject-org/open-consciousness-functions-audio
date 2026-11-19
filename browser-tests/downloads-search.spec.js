const {test, expect} = require('@playwright/test');
const {selectPreference} = require('./preferences');
const cards = '.download-card:visible';
async function first(page, title) { await expect(page.locator(cards).first().locator('h2')).toHaveText(title); }
async function axe(page) { await page.addScriptTag({path: require.resolve('axe-core/axe.min.js')}); expect(await page.evaluate(async () => (await axe.run(document, {runOnly: {type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations)).toEqual([]); }
test('Downloads ranks cues without rewriting input, keeps controls stable and results prominent at 375px', async ({page}) => {
 await page.setViewportSize({width:375,height:812}); await page.emulateMedia({reducedMotion:'reduce'}); await page.goto('/downloads/');
 const input = page.locator('#download-search'), intro = page.locator('[data-download-intro]');
 await input.focus(); const before = await input.boundingBox();
 const requests=[]; page.on('request',r=>requests.push(r.url()));
 const stored = await page.evaluate(()=>JSON.stringify({...localStorage}));
 for (const query of ['M','Man','Manifest','PLUS—MANIFEST','Plus: Manifest','ＭＡＮＩＦＥＳＴ','Manfiest','Manifest','']) {
  await input.fill(query); await expect(input).toBeFocused(); await expect(input).toHaveValue(query);
  expect(Math.abs((await input.boundingBox()).y-before.y)).toBeLessThan(2);
  if(query) { if(query !== 'M') await first(page,'Manifest'); await expect(intro).toBeHidden(); }
  else await expect(intro).toBeVisible();
 }
 await input.pressSequentially('Manifest'); await first(page,'Manifest');
 expect((await page.locator(cards).first().boundingBox()).y).toBeLessThan(650);
 await expect(page.locator(cards).first().locator('.download-cues')).toHaveText('Spoken cue: Plus Manifest');
 await expect(page.locator('#download-count')).toHaveAttribute('role','status');
 expect(await page.locator('#download-count').evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('#download-results')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
 expect(requests).toEqual([]); expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).toBe(stored);
 await page.screenshot({path:'browser-artifacts/downloads-manifest-375.png'}); await axe(page);
 await input.press('Tab'); await expect(page.getByRole('button',{name:'Clear search',exact:true})).toBeFocused(); await page.keyboard.press('Enter');
 await expect(input).toBeFocused(); await expect(input).toHaveValue(''); await expect(intro).toBeVisible();
 await input.fill('nothing-ever-matches-this'); await expect(page.locator(cards)).toHaveCount(0); await expect(page.locator('#download-count')).toContainText('No matching downloads'); await axe(page);
 await input.fill('Manfiest'); await first(page,'Manifest'); await expect(page.locator('#download-count')).toContainText('close title or cue matches');
 await input.fill('Relax'); await first(page,'Relax');
 await input.fill('possibilities'); await first(page,'Options');
 await input.fill('foundation'); expect(await page.locator(cards).count()).toBeGreaterThan(1);
 await input.fill('Manifest'); await input.press('Backspace'); await first(page,'Manifest'); await input.fill(''); await expect(intro).toBeVisible();
});
test('Downloads ranking survives edition/format changes and Back Forward reload with original query',async({page})=>{
 await page.goto('/downloads/'); const input=page.locator('#download-search'); await input.fill('PLUS—MANIFEST');
 for(const edition of ['0.1.0','0.2.0']) for(const format of ['flac','mp3']) {
  await selectPreference(page,'Audio edition',edition); await selectPreference(page,'Audio format',format); await first(page,'Manifest');
  await expect(input).toHaveValue('PLUS—MANIFEST'); await expect(page.locator(cards).first()).toHaveAttribute('data-edition',edition);
  await expect(page.locator(cards).first().locator('.download-action:visible')).toHaveText(`Download ${format.toUpperCase()}`);
 }
 await page.reload(); await expect(input).toHaveValue('PLUS—MANIFEST'); await first(page,'Manifest');
 await page.goto('/start/'); await page.goBack(); await expect(input).toHaveValue('PLUS—MANIFEST'); await first(page,'Manifest');
 await page.goForward(); await expect(page).toHaveURL(/start\/$/); await page.goBack(); await first(page,'Manifest');
 await page.getByRole('button',{name:'Clear search',exact:true}).click(); await page.reload(); await expect(input).toHaveValue(''); await expect(page.locator('[data-download-intro]')).toBeVisible();
});
