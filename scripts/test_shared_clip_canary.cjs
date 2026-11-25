const {chromium,devices}=require('playwright'), assert=require('node:assert/strict');
(async()=>{
 const base=process.argv[2], path='/experiments/shared-clips-test/';
 const browser=await chromium.launch();
 try{
 for(const [id,opts] of [['desktop',{}],['mobile',devices['Pixel 7']]]){
  const ctx=await browser.newContext(opts), p=await ctx.newPage();p.setDefaultTimeout(20000);
  const errors=[];p.on('pageerror',e=>errors.push(String(e)));
  const normal=await ctx.newPage();
  await normal.goto(base+'/functions/OCF-FND-004/');
  await normal.getByRole('button',{name:'Preferences',exact:true}).first().click();
  await normal.locator('#edition-filter').selectOption('0.2.0');
  await normal.locator('#format-filter').selectOption('flac');
  await normal.getByRole('button',{name:'Close preferences',exact:true}).click();
  const baseline=await normal.evaluate(()=>{
    const v={'ocf-audio-edition:v1':'{"schema":1,"selection":"0.2.1","format":"flac"}',
      'ocf.private-batch.smart-play-defaults.v1':'{"mode":"advanced","choices":{"relaxation":"short"}}'};
    const actual=localStorage.getItem('ocf-audio-edition:v1'), state=JSON.parse(actual);
    if(state.selection!=='0.2.0'||state.format!=='flac')throw Error('Production baseline differs');
    v['ocf-audio-edition:v1']=actual;
    localStorage.setItem('ocf.private-batch.smart-play-defaults.v1',v['ocf.private-batch.smart-play-defaults.v1']);
    window.storageEvents=[];window.addEventListener('storage',e=>window.storageEvents.push(e.key));
    return v;
  });
  assert.equal((await p.goto(base+path)).status(),200);
  assert.equal(await p.locator('audio').count(),2);
  assert.equal(await p.getByRole('button',{name:'Smart Play settings'}).count(),0);
  await p.getByRole('button',{name:'Enable Smart Play for this test'}).click();
  await p.getByText('Shared-clip test is ready.').waitFor();
  const scope=await p.evaluate(async()=>(await navigator.serviceWorker.getRegistration()).scope);
  assert.equal(scope,base+path);
  for(const [sel,choice] of [['#relax','reminder'],['#energy','reminder'],['#energy','off']]){
   const c=p.locator(sel),a=c.locator('audio');
   await c.getByRole('button',{name:'Smart Play settings'}).click();
   const d=p.getByRole('dialog',{name:'Smart Play',exact:true});
   await d.getByLabel('Resonant Tuning').selectOption(choice);
   await d.getByRole('button',{name:'Apply',exact:true}).click();
   await d.waitFor({state:'hidden'});
   assert.ok(await a.evaluate(a=>a.paused));
   await c.getByRole('button',{name:'Play',exact:true}).click();
   await p.waitForFunction(sel=>{const a=document.querySelector(sel+' audio');return !a.paused&&a.currentTime>.06;},sel);
   const src=await a.evaluate(a=>a.currentSrc);
   assert.ok(src.startsWith(base+path+'virtual/audio/'));
   const status=await p.evaluate(async s=>{const r=await fetch(s,{headers:{Range:'bytes=0-3'}});return [r.status,await r.text()]},src);
   assert.deepEqual(status,[206,'fLaC']);
   const marks=c.getByText('Smart Play bookmarks',{exact:true}); await marks.click();
   await c.getByRole('button',{name:/Resonant Tuning ·/}).click();
   await p.waitForFunction(sel=>{const a=document.querySelector(sel+' audio');return !a.seeking&&a.currentTime>450&&!a.paused;},sel);
   assert.equal(await a.evaluate(a=>a.currentSrc),src);
   await c.getByRole('button',{name:'Pause',exact:true}).click();
   await c.getByRole('button',{name:'Smart Play settings'}).click();
   await d.getByRole('button',{name:'Restore all original choices'}).click();
   await d.getByRole('button',{name:'Apply',exact:true}).click();
   await d.waitFor({state:'hidden'});
   assert.equal(await marks.isVisible(),false);
  }
  await p.getByRole('button',{name:'Preferences',exact:true}).click();
  const pd=p.locator('[data-local-smart-preferences]');
  await pd.locator('summary').click();
  await pd.getByLabel('Default guidance').selectOption('advanced');
  await pd.getByLabel('Resonant Tuning').selectOption('reminder');
  await pd.getByRole('button',{name:'Save Smart Play default'}).click();
  const download=p.waitForEvent('download');await pd.getByRole('button',{name:'Export Smart Play settings'}).click();
  assert.equal((await download).suggestedFilename(),'ocf-smart-play-settings.json');
  const live=await normal.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(baseline));
  assert.deepEqual(live,baseline);
  assert.equal(await normal.evaluate(()=>navigator.serviceWorker.controller),null);
  assert.equal(await normal.locator('#edition-filter').inputValue(),'0.2.0');
  assert.equal(await normal.locator('#format-filter').inputValue(),'flac');
  await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();if(r)await r.unregister();});
  await p.goto(base+'/');assert.equal(await p.evaluate(()=>navigator.serviceWorker.controller),null);
  assert.deepEqual(await p.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(baseline)),baseline);
  assert.equal(await normal.evaluate(keys=>storageEvents.some(k=>keys.includes(k)),Object.keys(baseline)),false);
  assert.deepEqual(errors,[]);console.log(id,'worker isolated; 3 routes play and seek from real ranges; Original restored; production preferences unchanged through storage, export and unregister');
  await ctx.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
