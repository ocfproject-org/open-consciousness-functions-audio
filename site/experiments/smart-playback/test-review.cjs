const {chromium}=require('@playwright/test'), assert=require('assert/strict'), fs=require('fs'), path=require('path');
(async()=>{
 const [base,out]=process.argv.slice(2); fs.mkdirSync(out,{recursive:true});
 const {validateEvidence}=await import('./review.mjs'),{makePlan}=await import('./composer.mjs');
 const evidence=JSON.parse(fs.readFileSync(path.join(__dirname,'evidence.json')));validateEvidence(evidence);
 for(const mutate of [x=>x.source_sha256='0'.repeat(64),x=>x.cuts[0].to=700,x=>x.controls.return=true,x=>x.cuts.pop(),x=>x.crossfade_seconds=1]){const x=structuredClone(evidence);mutate(x);assert.throws(()=>validateEvidence(x));}
 assert(Math.abs(makePlan(evidence.decoded_seconds,evidence.cuts).saved-242.919818)<1e-6);
 const browser=await chromium.launch({headless:true}),results=[];
 try{for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:375,height:812}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});
  await context.addInitScript({path:require.resolve('axe-core/axe.min.js')});
  // Mobile viewport emulation alone does not model the missing AudioParam API
  // seen on the reported Android device. Remove it before any playback exists.
  if(mobile)await context.addInitScript(()=>Object.defineProperty(AudioParam.prototype,'cancelAndHoldAtTime',{value:undefined,configurable:true}));
  const page=await context.newPage(),writes=[];page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.method());});
  await page.goto(base+'/experiments/smart-playback/preview.html');await page.waitForFunction(()=>!document.querySelector('#controls').disabled);
  assert.equal(await page.locator('input[type=file]').count(),0);assert.equal(await page.locator('#relaxation').inputValue(),'full');
  assert(await page.evaluate(()=>!composer.running&&composer.media.every(x=>x.paused)));
  assert(await page.locator('#preparation').isDisabled());assert(await page.locator('#return').isDisabled());
  assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex,nofollow');
  await page.locator('#relaxation').selectOption('short');await page.waitForFunction(()=>document.querySelector('#status').textContent==='Mode changed; playback paused.');
  assert.equal(await page.evaluate(()=>composer.plan.segments.length),10);
  await page.evaluate(()=>composer.seek(191));await page.locator('#play').focus();await page.keyboard.press('Enter');await page.waitForTimeout(1800);
  assert(await page.evaluate(()=>composer.running&&composer.current()>192&&composer.stats.fallbacks===0));
  assert.equal(await page.evaluate(()=>composer.nodes.every(x=>x.envelope.native)),!mobile);
  await page.locator('#pause').click();const t=await page.evaluate(()=>composer.current());await page.waitForTimeout(150);assert(Math.abs(await page.evaluate(()=>composer.current())-t)<.02);
  await page.locator('#play').click();await page.waitForTimeout(300);assert(await page.evaluate(()=>composer.running));await page.locator('#pause').click();
  await page.locator('#relaxation').selectOption('full');await page.waitForFunction(()=>!composer.running&&composer.plan.saved===0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const axe=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(x=>x.id));assert.deepEqual(axe,[]);assert.deepEqual(writes,[]);assert.equal(await page.evaluate(()=>localStorage.length),0);
  await page.screenshot({path:path.join(out,mobile?'mobile.png':'desktop.png'),fullPage:true});await page.reload();await page.waitForFunction(()=>!document.querySelector('#controls').disabled);assert.equal(await page.locator('#relaxation').inputValue(),'full');assert(await page.evaluate(()=>!composer.running));
  results.push({mobile,axe,networkWrites:writes,streaming:true,noFilePicker:true,defaultFull:true,reloadPaused:true});await context.close();
 }fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log('PASS streaming UI',results.length);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
