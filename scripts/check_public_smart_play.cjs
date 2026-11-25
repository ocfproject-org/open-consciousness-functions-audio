const assert=require('node:assert/strict'), {chromium,devices}=require('playwright');
// Loopback CI and live use the same native player acceptance test.
(async()=>{
 const url=process.argv[2], b=await chromium.launch(), ids=['OCF-FND-004','OCF-EXP-007','OCF-AUT-001'];
 try {
 for(const [label,opt] of [['desktop',{}],['mobile',devices['Pixel 7']]]){
  const p=await b.newPage(opt);p.setDefaultTimeout(20000);
  await p.goto(url+'/');
  await p.locator('.site-header [data-preferences-open]').click();
  const settings=p.locator('#preferences [data-local-smart-preferences]');
  await settings.locator('summary').click();
  await settings.getByLabel('Default guidance',{exact:true}).selectOption('advanced');
  await settings.getByLabel('Relaxation',{exact:true}).selectOption('short');
  await settings.getByRole('button',{name:'Save Smart Play default'}).click();
  assert.match(await settings.getByRole('status').textContent(),/Default saved/);
  assert.equal(await settings.getByRole('button',{name:'Export Smart Play settings'}).isEnabled(),true);
  await settings.getByRole('button',{name:'Reset Smart Play default'}).click();
  for(const id of ids){
   await p.goto(url+'/functions/'+id+'/');const a=p.locator('audio[data-local-smart]');
   const active=p.getByRole('button',{name:'Smart Play settings',exact:true});
   await active.waitFor();
   assert.equal(await a.evaluate(el=>el.hasAttribute('data-local-smart-active')),false);
   assert.equal(await p.getByText('Smart Play bookmarks',{exact:true}).isVisible(),false);
   await active.click();
   const modal=p.getByRole('dialog',{name:'Smart Play',exact:true});
   await modal.getByLabel('Relaxation',{exact:true}).selectOption('short');
   await modal.getByRole('button',{name:'Apply',exact:true}).click();
   await modal.waitFor({state:'hidden'});
   await p.getByRole('button',{name:'Play',exact:true}).first().click();
   await p.waitForFunction(()=>{const a=document.querySelector('audio[data-local-smart]');return !a.paused&&a.currentTime>0.05;});
   const src=await a.evaluate(el=>el.currentSrc);
   assert.ok(src.includes('/__ocf-smart/audio/'));
   assert.match(await a.evaluate(el=>el.currentSrc),/relaxation=short/);
   await p.getByText('Smart Play bookmarks',{exact:true}).click();
   await p.getByRole('button',{name:/Relaxation ·/}).click();
   await p.waitForFunction(()=>{const a=document.querySelector('audio[data-local-smart]');return !a.paused&&!a.seeking&&a.currentTime>20;});
   console.log(label,id,'original default and selected edited playback passed');
  }
  if(label==='desktop' && process.argv.includes('--all-sessions')){
   const registryForCheck=await p.request.get(url+'/assets/data/smart-play/registry.json').then(r=>r.json());
   const total=await p.evaluate(async()=>{
    const base='/__ocf-smart/', registry=await (await fetch('/assets/data/smart-play/registry.json')).json();
    let ok=0;
    for(const [id,row] of Object.entries(registry.sessions)){
     const c=row.controls.find(x=>x.control==='relaxation');
     if(!Object.hasOwn(c.options,'short')) throw Error(id+' short missing');
     const route=await fetch(base+'route/'+id+'?relaxation=short');
     if(!route.ok)throw Error(id+' route '+route.status);
     const out=await route.json(), head=await fetch(out.url,{method:'HEAD'});
     const bytes=Number(head.headers.get('Content-Length'));
     const at=Math.round(bytes*.53);
     const part=await fetch(out.url,{headers:{Range:'bytes='+at+'-'+(at+511)}});
     if(part.status!==206 || (await part.arrayBuffer()).byteLength!==512)throw Error(id+' range');
     ok++;
    }
    return ok;
   });
   assert.equal(total,Object.keys(registryForCheck.sessions).length);console.log(total,'actual SW range bodies verified with hashed cross-origin source');
  }
  await p.goto(url+'/functions/');
  await p.locator('#search').fill('OCF-FND-004');
  await p.locator('.session-card[data-function-id="OCF-FND-004"]:visible').getByRole('button',{name:/^Show player/}).click();
  await p.locator('.session-card[data-function-id="OCF-FND-004"]:visible').getByRole('button',{name:'Smart Play settings',exact:true}).waitFor();
  await p.goto(url+'/preparation-learning/');
  assert.equal(await p.getByRole('button',{name:'Smart Play settings',exact:true}).count(),0);
  await p.close();
 }
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
