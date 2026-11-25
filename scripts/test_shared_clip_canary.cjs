const {chromium,devices}=require('playwright'), assert=require('node:assert/strict');
const wire=require('./fixtures/smart-play-preview-wire.json');
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
  await p.getByRole('heading',{name:'Browse & Listen',exact:true}).waitFor();
  assert.equal(await p.locator('meta[name=robots]').getAttribute('content'),'noindex,nofollow,noarchive');
  const browse=p.locator('article.session-card[data-function-id="OCF-FND-004"][data-edition="0.3.0"]');
  assert.equal(await p.locator('#edition-filter').inputValue(),'latest');
  assert.equal(await p.locator('#format-filter').inputValue(),'mp3');
  const regularBrowse=await ctx.newPage();
  await regularBrowse.goto(base+'/functions/');
  await regularBrowse.getByRole('heading',{name:'Browse & Listen',exact:true}).waitFor();
  assert.equal(await p.locator('header.site-header').innerText(),await regularBrowse.locator('header.site-header').innerText());
  await regularBrowse.close();
  await browse.getByRole('button',{name:/Show player/}).click();
  await browse.getByRole('button',{name:'Smart Play settings'}).waitFor();
  assert.equal(await browse.getByText('Smart Play bookmarks',{exact:true}).isVisible(),false);
  const prefix=base+path+'functions/';
  const scope=await p.evaluate(async()=>(await navigator.serviceWorker.getRegistration()).scope);
  assert.equal(scope,base+path);
  const gearAligned=async c=>{
   const rect=await c.locator('.ocf-local-player').evaluate(el=>[...el.children].map(x=>x.getBoundingClientRect().toJSON()));
   assert.equal(rect.length,3);
   assert.ok(rect[0].right<=rect[1].left+1&&rect[1].right<=rect[2].left+1);
   assert.ok(rect[2].width>=44&&rect[2].height>=44);
   assert.ok(Math.abs(rect[0].y-rect[2].y)<2);
  };
  await gearAligned(browse);
  const guidePath=await browse.locator('h3 a').getAttribute('href');
  assert.equal(guidePath,path+'functions/OCF-FND-004/');
  await browse.locator('h3 a').click();
  await p.waitForURL(prefix+'OCF-FND-004/');
  const exercised=new Set();
  for(const [fid,choice] of [['OCF-FND-004','reminder'],['OCF-EXP-007','reminder'],['OCF-EXP-007','off']]){
   await p.goto(prefix+fid+'/');
   const title=fid==='OCF-FND-004'?'Relax':'Energy Ball';
   await p.getByRole('heading',{name:title,exact:true,level:1}).waitFor();
   const c=p.locator('section.guide-section:has(> #listening) [data-edition-content="0.3.0"]').first(),a=c.locator('audio').first();
   const production=await ctx.newPage();
   await production.goto(base+'/functions/'+fid+'/');
   const chrome=async page=>page.evaluate(()=>({
     title:document.title, header:document.querySelector('header.site-header').innerText,
     sections:[...document.querySelectorAll('main h2')].map(x=>x.textContent),
     layout:document.querySelector('.docs-layout')?.className,
     css:[...document.querySelectorAll('link[rel="stylesheet"]')].map(x=>new URL(x.href).pathname).filter(x=>x.startsWith('/assets/'))
   }));
   assert.deepEqual(await chrome(p),await chrome(production));
   await production.close();
   await c.getByRole('button',{name:'Smart Play settings'}).waitFor();
   await gearAligned(c);
   if(fid==='OCF-FND-004') assert.equal(await p.locator('[data-edition-content="0.2.0"] .ocf-local-smart-gear').count(),0);
   await c.getByRole('button',{name:'Smart Play settings'}).click();
   const d=p.getByRole('dialog',{name:'Smart Play',exact:true});
   const labels={preparation:'Transmutation Box',relaxation:'Relaxation','resonant-tuning':'Resonant Tuning','energy-ball':'Energy Ball',affirmation:'Affirmation',return:'Waking Return'};
   const expected={};
   for(const item of wire[fid].filter(x=>Object.keys(x.opts).length===1)){
    const [control,value]=Object.entries(item.opts)[0];
    (expected[control]??=[]).push(value);
   }
   for(const [control,options] of Object.entries(expected)){
    const entries=await d.getByLabel(labels[control],{exact:true}).locator('option').evaluateAll(el=>el.map(e=>e.value).filter(Boolean).sort());
    assert.deepEqual(entries,options.sort());
   }
   assert.equal(await d.getByLabel('Guidance',{exact:true}).locator('option[value="full"]').isEnabled(),true);
   assert.equal(await d.getByLabel('Guidance',{exact:true}).locator('option[value="experienced"]').isEnabled(),true);
   await d.getByLabel('Resonant Tuning').selectOption(choice);
   assert.equal(await d.getByLabel('Guidance',{exact:true}).inputValue(),'advanced');
   await d.getByRole('button',{name:'Apply',exact:true}).click();
   await d.waitFor({state:'hidden'});
   assert.ok(await a.evaluate(a=>a.paused));
   await c.getByRole('button',{name:'Play',exact:true}).click();
   await p.waitForFunction(()=>{const a=document.querySelector('audio[data-local-smart]');return !a.paused&&a.currentTime>.06;});
   const src=await a.evaluate(a=>a.currentSrc);
   assert.ok(src.startsWith(base+path+'virtual/audio/'));
   const status=await p.evaluate(async s=>{const r=await fetch(s,{headers:{Range:'bytes=0-3'}});return [r.status,await r.text()]},src);
   assert.deepEqual(status,[206,'fLaC']);
   const marks=c.getByText('Smart Play bookmarks',{exact:true}); await marks.click();
   await c.getByRole('button',{name:/Resonant Tuning ·/}).click();
   await p.waitForFunction(()=>{const a=document.querySelector('audio[data-local-smart]');return !a.seeking&&a.currentTime>450&&!a.paused;});
   assert.equal(await a.evaluate(a=>a.currentSrc),src);
   await c.getByRole('button',{name:'Pause',exact:true}).click();
   await c.getByRole('button',{name:'Smart Play settings'}).click();
   await d.getByRole('button',{name:'Restore all original choices'}).click();
   await d.getByRole('button',{name:'Apply',exact:true}).click();
   await d.waitFor({state:'hidden'});
   assert.equal(await marks.isVisible(),false);
   if (id==='desktop' && !exercised.has(fid)) {
    exercised.add(fid);
    // A real worker Range read, not just an outer 206. Hash exact bytes measured
    // against the native local player for individual choices and mixed selections.
    const match=await p.evaluate(async ({scope,fid,proof})=>{
     for(const item of proof){
      const route=await fetch(scope+'virtual/route/'+fid+'?'+new URLSearchParams(item.opts));
      if(!route.ok)return 'Route status '+route.status;
      const r=await route.json();
      if(Math.round(r.seconds*44100)!==item.frames||r.bookmarks.length!==item.bookmarks.length)return 'Wrong duration or bookmarks';
      for(const [off,n,expected] of item.reads){
       const res=await fetch(r.url,{headers:{Range:'bytes='+off+'-'+(off+n-1)}});
       const b=await res.arrayBuffer();
       if(res.status!==206||b.byteLength!==n)return 'Wrong range length or status';
       const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
       if(digest!==expected)return 'Wrong range digest for '+JSON.stringify(item.opts);
      }
     }
     return 'ok';
    },{scope:path,fid,proof:wire[fid]});
    assert.equal(match,'ok');
   }

  }
  await p.getByRole('button',{name:'Preferences',exact:true}).click();
  await p.locator('#format-filter').selectOption('flac');
  const pd=p.locator('[data-local-smart-preferences]');
  await pd.locator('summary').click();
  await pd.getByLabel('Default guidance').selectOption('advanced');
  await pd.getByLabel('Resonant Tuning').selectOption('reminder');
  await pd.getByRole('button',{name:'Save Smart Play default'}).click();
  const download=p.waitForEvent('download');await pd.getByRole('button',{name:'Export Smart Play settings'}).click();
  assert.equal((await download).suggestedFilename(),'ocf-smart-play-settings.json');
  await p.getByRole('button',{name:'Close preferences',exact:true}).click();
  await p.reload();
  await p.locator('audio[data-local-smart][data-local-smart-active]').waitFor({state:'attached'});
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
