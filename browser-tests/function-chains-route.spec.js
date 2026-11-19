const {openPreferences,closePreferences,selectPreference} = require('./preferences');
const {test,expect}=require('@playwright/test');
async function canonical(page){
 await expect(page).toHaveTitle('Function Chains — OCF');await expect(page.locator('h1')).toHaveText('Function Chains');
 await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://ocfproject.org/function-chains/');
 await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content','https://ocfproject.org/function-chains/');
 await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content','Function Chains — OCF');
 await expect(page.locator('main ol')).toHaveCount(17);
}
test('canonical Function Chains route, metadata, navigation and sitemap use the new name',async({page})=>{
 for(const route of ['/','/start/','/how-it-works/','/functions/OCF-FND-004/','/function-chains/']){
  await page.goto(route);
  await expect(page.locator('a[href*="practice-chains"]')).toHaveCount(0);
  const links=page.locator('nav a[href$="function-chains/"]');expect(await links.count()).toBeGreaterThan(0);
  for(const text of await links.allTextContents())expect(text).toBe('Function Chains');
 }
 await canonical(page);await expect(page.locator('.mobile-nav a[aria-current="page"]')).toHaveText('Function Chains');
 const map=await page.request.get('/sitemap.xml').then(r=>r.text());expect(map).toContain('https://ocfproject.org/function-chains/');expect(map).not.toContain('practice-chains');
});
test('old route preserves exact query and fragment, uses replacement, and keeps stored preferences',async({page})=>{
 await page.goto('/downloads/');await selectPreference(page,'Audio edition','0.1.0');await selectPreference(page,'Audio format','flac');
 const suffix='?from=old%2Flink&repeat=1&repeat=2&function=OCF-FND-004&category=foundation#daily-learning';
 await page.goto('/practice-chains/'+suffix);await expect(page).toHaveURL(new RegExp('/function-chains/\\?from=old%2Flink&repeat=1&repeat=2&function=OCF-FND-004&category=foundation#daily-learning$'));await canonical(page);
 await expect(page.locator('#daily-learning')).toBeInViewport();await expect(page.getByLabel('Audio edition',{exact:true})).toHaveValue('0.1.0');await expect(page.getByLabel('Audio format',{exact:true})).toHaveValue('flac');
 await page.reload();await expect(page).toHaveURL(new RegExp('/function-chains/\\?from=old%2Flink&repeat=1&repeat=2&function=OCF-FND-004&category=foundation#daily-learning$'));
 await page.goBack();await expect(page).toHaveURL(/\/downloads\/$/);await page.goForward();await canonical(page);
});
test('old index and slashless URLs forward anchors and query with storage blocked',async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked')};Storage.prototype.setItem=()=>{throw Error('blocked')};});
 for(const path of ['/practice-chains/index.html','/practice-chains']){
  await page.goto(path+'?edition=0.1.0&format=flac#sleep-preparation');await expect(page).toHaveURL(/\/function-chains\/\?edition=0.1.0&format=flac#sleep-preparation$/);
  await canonical(page);await expect(page.locator('#sleep-preparation')).toBeInViewport();await expect(page.getByLabel('Audio format',{exact:true})).toHaveValue('flac');
 }
});
test('old URL has accessible canonical fallback without JavaScript or if redirect script fails',async({browser,page})=>{
 const context=await browser.newContext({javaScriptEnabled:false});const staticPage=await context.newPage();
 await staticPage.goto('/practice-chains/?from=bookmark#daily-learning');await expect(staticPage).toHaveURL(/\/practice-chains\/\?from=bookmark#daily-learning$/);
 await expect(staticPage.locator('meta[name="robots"]')).toHaveAttribute('content','noindex,follow');await expect(staticPage.locator('link[rel="canonical"]')).toHaveAttribute('href','https://ocfproject.org/function-chains/');
 const link=staticPage.getByRole('link',{name:'Continue to Function Chains'});await expect(link).toBeVisible();await expect(link).toHaveAttribute('href','../function-chains/');await link.click();await canonical(staticPage);await context.close();
 await page.route('**/assets/js/chains-redirect.js*',route=>route.abort());await page.goto('/practice-chains/');await expect(page.getByRole('link',{name:'Continue to Function Chains'})).toBeVisible();
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});expect(await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}})).violations)).toEqual([]);
});
