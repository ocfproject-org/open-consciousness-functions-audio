const {test,expect}=require('@playwright/test');

async function clearTarget(page,id){
 const target=page.locator('#'+id);
 await expect(target).toBeInViewport();
 // Preserve the existing anchor offset and ensure no header/overlay covers it.
 await expect.poll(()=>target.evaluate(node=>{
  const rect=node.getBoundingClientRect();
  const padding=parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)||0;
  const hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);
  return rect.top>=padding && rect.bottom<=innerHeight && !!hit && (hit===node||node.contains(hit));
 })).toBe(true);
}
for(const width of [375,1440])for(const reducedMotion of ['no-preference','reduce']){
 test(`chain anchors retain visibility, keyboard focus and history at ${width}px with ${reducedMotion} motion`,async({page})=>{
  await page.setViewportSize({width,height:812});await page.emulateMedia({reducedMotion});
  await page.goto('/function-chains/?from=anchor-check#sleep-preparation');
  await clearTarget(page,'sleep-preparation');
  await page.reload();await clearTarget(page,'sleep-preparation');
  await page.goto('/function-chains/');
  const jump=page.getByRole('link',{name:'View steps: Sleep preparation',exact:true});
  for(let step=0;step<100;step++){
   await page.keyboard.press('Tab');
   if(await jump.evaluate(node=>node===document.activeElement))break;
  }
  await expect(jump).toBeFocused();await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#sleep-preparation$/);await clearTarget(page,'sleep-preparation');
  await page.goto('/function-chains/');
  await jump.click();
  await expect(page).toHaveURL(/#sleep-preparation$/);await clearTarget(page,'sleep-preparation');
  await page.keyboard.press('Tab');
  const section=page.locator('.chain-section').filter({has:page.locator('#sleep-preparation')});
  await expect(section.locator(':focus')).toHaveCount(1);await expect(section.locator(':focus')).toBeInViewport();
  await page.goto('/start/');await page.goBack();
  await expect(page).toHaveURL(/function-chains\/#sleep-preparation$/);await clearTarget(page,'sleep-preparation');
  await page.goForward();await expect(page).toHaveURL(/\/start\/$/);
  await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior)).toBe(reducedMotion==='reduce'?'auto':'smooth');
  await page.goto('/practice-chains/?from=old-check#weight-management');
  await expect(page).toHaveURL(/function-chains\/\?from=old-check#weight-management$/);await clearTarget(page,'weight-management');
 });
}
