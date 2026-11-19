const {test, expect}=require('@playwright/test');

test('references stay collapsed, separate from original chains, and expose bounded public page links',async({page})=>{
 await page.goto('/function-chains/#weight-management');
 await expect(page.locator('.chain-original')).toHaveCount(17);
 await expect(page.locator('.chain-original .historical-references')).toHaveCount(0);
 await expect(page.locator('.historical-references')).toHaveCount(6);
 const refs=page.locator('.chain-section').filter({has:page.locator('#weight-management')}).locator('.historical-references');
 await expect(refs).not.toHaveAttribute('open','');
 await refs.locator('summary').focus();await page.keyboard.press('Enter');
 await expect(refs).toContainText('Habit Freedom and optional Detox are OCF additions');
 await expect(refs.locator('a')).toHaveAttribute('href',/archive.org\/download\/.*\.pdf#page=1$/);
 await page.keyboard.press('Enter');await expect(refs).not.toHaveAttribute('open','');
});

test('suggested-use references preserve wording and work without JavaScript',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();
 await page.goto('/functions/OCF-BOD-010/');
 const uses=page.locator('.discovery-details').filter({has:page.locator('summary', {hasText:'Common-use examples'})});
 await uses.locator(':scope > summary').click();
 const refs=uses.locator('.historical-references');await refs.locator('summary').click();
 await expect(refs.locator('li')).toHaveCount(2);await expect(refs).toContainText('OCF additions');
 await expect(uses.locator(':scope > ul')).toContainText('Explore Nutricia and Eat/No Eat together');
 await page.goto('/function-chains/#weight-management');await expect(page.locator('.chain-original')).toHaveCount(17);
 await context.close();
});

test('expanded references fit mobile and desktop and pass axe in light and dark',async({page})=>{
 for(const width of [375,1440])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await page.goto('/function-chains/');
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await page.locator('.historical-references').evaluateAll(items=>items.forEach(x=>x.open=true));
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  expect(await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations)).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#weight-management').scrollIntoViewIfNeeded();
  await page.screenshot({path:`browser-artifacts/references-${width}-${theme}.png`});
 }
});
