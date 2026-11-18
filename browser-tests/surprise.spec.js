const {test, expect} = require('@playwright/test');
const {entries, surprisePool} = require('../site/assets/js/app.js');

async function fixture(page) {
  // Synthetic silence only: never fetch the published recordings in browser tests.
  const wav = Buffer.alloc(44 + 32000, 128);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVE',8);
  wav.write('fmt ',12); wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(8000,24); wav.writeUInt32LE(8000,28); wav.writeUInt16LE(1,32); wav.writeUInt16LE(8,34);
  wav.write('data',36); wav.writeUInt32LE(32000,40);
  await page.route(/https:\/\/.*\.(mp3|flac)(\?.*)?$/, route => route.abort());
  await page.addInitScript(src => {
    Object.defineProperty(HTMLAudioElement.prototype, 'src', {
      configurable:true, get(){return this.getAttribute('src') || '';},
      set(value){this.testOriginalURL=value; this.setAttribute('src',src);}
    });
  }, `data:audio/wav;base64,${wav.toString('base64')}`);
  await page.goto('/functions/');
  await expect(page.getByRole('button',{name:'Surprise me',exact:true})).toBeEnabled();
}
const section = page => page.locator('.surprise-session');
const choose = page => page.getByRole('button',{name:'Surprise me',exact:true});
const hide = page => page.getByRole('checkbox',{name:'Hide session details until I reveal them'});

test('every function once per cycle, persistent history, filters independent, no automatic playback',async({page})=>{
 await fixture(page);
 const catalog=await page.request.get('/browse-catalog.json').then(r=>r.json());
 const pool=surprisePool(entries(catalog));
 const byURL=new Map([...pool].flatMap(([id,editions])=>editions.flatMap(e=>e.assets.filter(a=>a.format==='mp3').map(a=>[a.download_url,id]))));
 await page.locator('#search').fill('no match whatsoever');
 const seen=new Set();
 for(let i=0;i<pool.size;i++){
  if(i===2){await page.reload();await expect(choose(page)).toBeEnabled();}
  await choose(page).click();
  const player=section(page).locator('audio');
  const id=byURL.get(await player.evaluate(a=>a.testOriginalURL));
  expect(id).toBeTruthy(); expect(seen.has(id)).toBe(false); seen.add(id);
  expect(await player.evaluate(a=>a.paused)).toBe(true);
 }
 expect(seen.size).toBe(pool.size);
 await choose(page).click();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ocf-surprise-history:v1')).length)).toBe(1);
});

test('concealment keyboard reveal, pause, ended, replacement and media metadata',async({page})=>{
 await fixture(page); await hide(page).check();
 await choose(page).focus();await page.keyboard.press('Enter');
 const box=section(page), player=box.locator('audio');
 await expect(player).toBeFocused(); await expect(player).toHaveAccessibleName('Listen to your surprise session');
 await expect(box.locator('#surprise-details')).toBeHidden();
 expect(await page.title()).not.toContain('Your surprise session');
 await player.evaluate(a=>a.play());
 await expect.poll(()=>player.evaluate(a=>a.paused)).toBe(false);
 expect(await page.evaluate(()=>navigator.mediaSession?.metadata?.title || 'Your surprise session')).toBe('Your surprise session');
 await player.evaluate(a=>a.pause());await expect(box.locator('[data-playback-status]')).toContainText('Paused');
 await box.getByRole('button',{name:'Show more',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(box.locator('#surprise-details')).toBeVisible();await expect(box.locator('#surprise-details')).toBeFocused();
 const title=await box.locator('h4').textContent();expect(title).not.toBe('Your surprise session');
 await expect(player).toHaveAccessibleName(new RegExp(`^Listen to `));
 expect(await page.evaluate(()=>navigator.mediaSession?.metadata?.title)).toBe(title);
 await choose(page).click();await expect(box.locator('#surprise-details')).toBeHidden();
 expect(await player.evaluate(a=>a.paused)).toBe(true);
 await player.evaluate(async a=>{await a.play(); a.currentTime=3.8;});
 await expect.poll(()=>player.evaluate(a=>a.ended)).toBe(true);
 await expect(box.locator('#surprise-details')).toBeVisible();
 // Playback elsewhere interrupts surprise and clears its metadata.
 await choose(page).click();await player.evaluate(a=>a.play());
 const launch=page.locator('#catalog-results .show-player').first();await launch.click();
 await page.locator('#catalog-results audio').first().evaluate(a=>a.play());
 await expect.poll(()=>player.evaluate(a=>a.paused)).toBe(true);
 expect(await page.evaluate(()=>navigator.mediaSession?.metadata)).toBeNull();
});

test('settings persist; corrupt and unavailable storage; empty pool',async({page})=>{
 await fixture(page);await hide(page).check();await page.reload();await expect(hide(page)).toBeChecked();
 await page.evaluate(()=>localStorage.setItem('ocf-surprise-history:v1','{bad'));
 await choose(page).click();await expect(section(page).locator('audio')).toBeVisible();
 await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('blocked');}}));
 await page.reload();await choose(page).click();const first=await section(page).locator('audio').evaluate(a=>a.testOriginalURL);
 await choose(page).click();expect(await section(page).locator('audio').evaluate(a=>a.testOriginalURL)).not.toBe(first);
 await page.route('**/browse-catalog.json',route=>route.fulfill({json:{schema_version:3,releases:[]}}));
 await page.reload();await expect(choose(page)).toBeDisabled();
 await expect(section(page)).toContainText('No MP3 function sessions are available in edition');
});

test('mobile layout and accessible hidden/revealed states in all themes',async({page})=>{
 await fixture(page); await hide(page).check();await choose(page).click();
 for(const width of [320,375,768,1440]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.setViewportSize({width:320,height:900});
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 for(const theme of ['light','dark','black'])for(const hidden of [true,false]){
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await hide(page).setChecked(hidden);
  const violations=await page.evaluate(async()=> (await axe.run('.surprise-session',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations);
  expect(violations).toEqual([]);
 }
 await section(page).screenshot({path:'browser-artifacts/surprise-mobile.png'});
 await hide(page).check();
 await section(page).screenshot({path:'browser-artifacts/surprise-mobile-concealed.png'});
});

test('simultaneous tabs share selection history and page exit pauses playback',async({page,context})=>{
 await fixture(page);
 const other=await context.newPage();await fixture(other);
 await Promise.all([choose(page).click(),choose(other).click()]);
 const id=async p=>section(p).locator('audio').evaluate(a=>a.testOriginalURL);
 expect(await id(page)).not.toBe(await id(other));
 const player=section(page).locator('audio');await player.evaluate(a=>a.play());
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
 await expect.poll(()=>player.evaluate(a=>a.paused)).toBe(true);
 expect(await page.evaluate(()=>navigator.mediaSession?.metadata)).toBeNull();
});

test('failed audio stays concealed and choosing again clears stale error',async({page})=>{
 await fixture(page);await hide(page).check();await choose(page).click();
 const player=section(page).locator('audio');
 await player.evaluate(a=>a.dispatchEvent(new Event('error')));
 await expect(section(page).locator('[data-playback-status]')).toContainText('choose another session');
 await expect(section(page).locator('#surprise-details')).toBeHidden();
 await choose(page).click();await player.evaluate(a=>a.play());
 await expect(section(page).locator('[data-playback-status]')).not.toContainText('could not');
 await expect(player).toHaveAccessibleName('Listen to your surprise session');
});


test('native player keyboard play and pause keeps details concealed',async({page})=>{
 await fixture(page);await hide(page).check();await choose(page).click();
 const player=section(page).locator('audio');
 await player.focus();await page.keyboard.press('Space');
 await expect.poll(()=>player.evaluate(a=>a.paused)).toBe(false);
 await page.keyboard.press('Space');
 await expect.poll(()=>player.evaluate(a=>a.paused)).toBe(true);
 await expect(section(page).locator('#surprise-details')).toBeHidden();
});
