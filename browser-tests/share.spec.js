const {test, expect} = require('@playwright/test');
const {publicURL} = require('../site/assets/js/share.js');
const route = '/functions/OCF-AUT-001/';
async function open(page) { await page.goto(route + '?learned=private&filter=secret#private'); await page.getByText('Share this page', {exact:true}).click(); }
test('canonical URL strips all private query and fragment data', () => {
  expect(publicURL('https://ocfproject.org/functions/X/?private=yes#learned')).toBe('https://ocfproject.org/functions/X/');
  for (const url of ['javascript:alert(1)', 'https://example.com/', 'https://me@ocfproject.org/', '/relative']) expect(publicURL(url)).toBeNull();
});
test('explicit copy only; no load-time clipboard or native call; canonical payload', async ({page}) => {
  await page.addInitScript(() => { window.calls=[]; Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async x=>window.calls.push(x)}}); Object.defineProperty(navigator,'share',{value:async x=>window.calls.push(x)}); });
  await open(page); expect(await page.evaluate(()=>window.calls)).toEqual([]);
  await page.getByRole('button',{name:'Copy link',exact:true}).click();
  await expect(page.locator('[data-share-status]')).toHaveText('Link copied.');
  expect(await page.evaluate(()=>window.calls)).toEqual(['https://ocfproject.org'+route]);
  await page.getByRole('button',{name:'Share…',exact:true}).click();
  expect(await page.evaluate(()=>window.calls)).toEqual(['https://ocfproject.org'+route,{url:'https://ocfproject.org'+route}]);
});
test('clipboard failure and unavailable API offer selected manual link', async ({page}) => {
  await page.addInitScript(() => { Object.defineProperty(navigator,'share',{value:undefined}); Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied')}}}); });
  await open(page); await expect(page.locator('[data-share-native]')).toBeHidden();
  await page.getByRole('button',{name:'Copy link',exact:true}).click();
  const input=page.getByLabel('Page link',{exact:true}); await expect(input).toBeFocused(); await expect(input).toHaveValue('https://ocfproject.org'+route);
  expect(await input.evaluate(el=>el.selectionEnd-el.selectionStart)).toBe(('https://ocfproject.org'+route).length);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));
  await page.getByRole('button',{name:'Copy link',exact:true}).click(); await expect(input).toBeFocused();
});
test('native cancellation never triggers clipboard; controls recover',async({page})=>{
  await page.addInitScript(()=>{window.copies=0;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>window.copies++}});Object.defineProperty(navigator,'share',{value:async()=>{throw new DOMException('cancel','AbortError')}});});
  await open(page);await page.getByRole('button',{name:'Share…',exact:true}).click();await expect(page.locator('[data-share-status]')).toHaveText('Sharing cancelled.');expect(await page.evaluate(()=>window.copies)).toBe(0);await expect(page.locator('[data-share-copy]')).toBeEnabled();
});
test('keyboard, mobile layout and no-JS progressive enhancement',async({page,browser})=>{
  await page.setViewportSize({width:375,height:812});await page.goto(route); const summary=page.getByText('Share this page',{exact:true});await summary.focus();await page.keyboard.press('Enter');await expect(page.locator('[data-share-copy]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  const context=await browser.newContext({javaScriptEnabled:false}); const plain=await context.newPage();await plain.goto(new URL(route,page.url()).href);await expect(plain.locator('[data-page-share]')).toBeHidden();await context.close();
});
test('404 has no sharing control',async({page})=>{await page.goto('/404.html');await expect(page.locator('[data-page-share]')).toHaveCount(0);});

test('native errors stay explicit and pending actions cannot dispatch twice',async({page})=>{
 await page.addInitScript(()=>{window.shares=0;window.copies=0;Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>window.copies++}});Object.defineProperty(navigator,'share',{value:()=>{window.shares++;return new Promise((_,reject)=>window.rejectShare=reject)}});});
 await open(page);await page.locator('[data-share-native]').click();await expect(page.locator('[data-share-copy]')).toBeDisabled();
 await page.locator('[data-share-native]').dispatchEvent('click');expect(await page.evaluate(()=>window.shares)).toBe(1);
 await page.evaluate(()=>window.rejectShare(new Error('unavailable')));await expect(page.locator('[data-share-status]')).toHaveText('Sharing is unavailable. Use Copy link instead.');expect(await page.evaluate(()=>window.copies)).toBe(0);await expect(page.locator('[data-share-copy]')).toBeEnabled();
});
test('all public page types expose canonical sharing; mobile manual fallback is accessible',async({page})=>{
 for(const route of ['/', '/functions/', '/function-chains/', '/about/']) {await page.goto(route);await expect(page.locator('[data-page-share]')).toBeVisible();}
 await page.setViewportSize({width:375,height:812});await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:undefined}));await open(page);await page.locator('[data-share-copy]').click();
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});const result=await page.evaluate(()=>axe.run('[data-page-share]',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));expect(result.violations).toEqual([]);
 await page.locator('[data-page-share]').screenshot({path:'browser-artifacts/share-mobile.png'});
});
