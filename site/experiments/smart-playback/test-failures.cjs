const {chromium}=require('@playwright/test'),fs=require('fs'),assert=require('assert/strict');
(async()=>{const [base,out]=process.argv.slice(2),b=await chromium.launch({headless:true});const results=[];
try{
 for(const failure of ['missing','no-range','wrong-type','altered-evidence']){
  const c=await b.newContext(),p=await c.newPage();
  if(failure==='altered-evidence')await p.route('**/evidence.json',r=>r.fulfill({contentType:'application/json',body:'{}'}));
  else await p.route('**/comfort-401a132683e40b34.mp3',r=>r.fulfill({status:failure==='missing'?404:failure==='no-range'?200:206,headers:{'content-type':'text/html','content-range':'bytes 0-4095/55927570'},body:Buffer.alloc(4096)}));
  await p.goto(base+'/experiments/smart-playback/preview.html');await p.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Experiment unavailable'));assert(await p.locator('#controls').evaluate(e=>e.disabled));assert(await p.locator('#original').getAttribute('src'));results.push({failure,rejected:true});await c.close();
 }
 const unsupported=await b.newContext();await unsupported.addInitScript(()=>{window.AudioContext=class{constructor(){throw Error('Synthetic unavailable Web Audio');}};});const u=await unsupported.newPage();await u.goto(base+'/experiments/smart-playback/preview.html');await u.waitForFunction(()=>!document.querySelector('#controls').disabled);await u.locator('#play').click();await u.waitForFunction(()=>document.querySelector('#status').textContent.includes('Synthetic unavailable'));assert(await u.evaluate(()=>!composer.running&&composer.plan.saved===0));results.push({webAudioFailurePausedOriginalAvailable:true});await unsupported.close();
 const c=await b.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true}),p=await c.newPage();await p.goto(base+'/experiments/smart-playback/preview.html');await p.waitForFunction(()=>!document.querySelector('#controls').disabled);
 await p.locator('#relaxation').selectOption('short');await p.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Mode changed'));
 await p.evaluate(()=>{window.realPrepare=composer.prepare.bind(composer);composer.prepare=async(s,g,pos)=>{if(s.n%2===1)await new Promise(r=>setTimeout(r,1300));return realPrepare(s,g,pos);};});
 await p.evaluate(()=>composer.seek(composer.plan.segments[1].start-.3));await p.locator('#play').click();await p.waitForFunction(()=>composer.stats.fallbacks>0,{},{timeout:12000});assert(await p.evaluate(()=>!composer.running&&composer.plan.saved===0));assert.equal(await p.locator('#relaxation').inputValue(),'full');
 await p.evaluate(()=>composer.prepare=realPrepare);await p.locator('#play').click();await p.waitForTimeout(300);assert(await p.evaluate(()=>composer.running));
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await p.waitForTimeout(50);assert(await p.evaluate(()=>!composer.running&&composer.media.every(x=>x.paused)));results.push({lateBufferFullFallback:true,manualResume:true,simulatedVisibility:true});await c.close();
 fs.writeFileSync(out,JSON.stringify(results,null,2));console.log('PASS delivery/failure checks');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
