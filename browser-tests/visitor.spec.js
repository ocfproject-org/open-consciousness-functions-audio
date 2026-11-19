const {test, expect} = require('@playwright/test');

test('visitor paths, contribution targets and feedback work at mobile and desktop widths', async ({page}) => {
  for (const width of [320,1280]) {
    await page.setViewportSize({width,height:900});
    await page.goto('/');
    await expect(page.getByRole('heading', {name:'Guided meditations and series',exact:true})).toBeVisible();
    await expect(page.getByText('Planned',{exact:true})).toBeVisible();
    await page.getByRole('link',{name:'See the practice flow'}).click();
    await expect(page.locator('#choose-your-path .practice-path')).toHaveCount(2);
    await expect(page.locator('#choose-your-path')).toContainText('official Human Plus preparation track');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    await page.goto('/get-involved/');
    await expect(page.locator('.feedback-address')).toContainText('feedback');
    await page.getByRole('button',{name:'Show email link'}).focus();
    await page.keyboard.press('Enter');
    const email=page.getByRole('link',{name:'feedback@ocfproject.org',exact:true});
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute('href','mailto:feedback@ocfproject.org');
    await page.goto('/functions/OCF-FND-002/');
    await expect(page.getByRole('link',{name:'Propose an edit to this function’s YAML on GitHub'})).toHaveAttribute('href','https://github.com/ocfproject-org/open-consciousness-functions/edit/main/locales/en-US/OCF-FND-002-Focus.yaml');
  }
});

test('visitor no-JS keeps feedback and text paths usable without dead controls',async({browser})=>{
 const c=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:900}});const p=await c.newPage();
 await p.goto('/get-involved/');await expect(p.locator('.feedback-address')).toBeVisible();await expect(p.locator('[data-feedback-reveal]')).toBeHidden();
 await p.goto('/listening/');await expect(p.locator('.stereo-controls')).toBeHidden();await expect(p.getByText('This interactive test needs JavaScript.',{exact:false})).toBeVisible();await c.close();
});

async function mockAudio(page){
 await page.addInitScript(()=>{
  window.testAudio={contexts:0,pending:[],started:[],stopped:0,closed:0};
  window.AudioContext=class{
   constructor(){window.testAudio.contexts++;this.sampleRate=48000;this.destination={};}
   resume(){return new Promise((resolve,reject)=>window.testAudio.pending.push({resolve,reject}));}
   createBuffer(ch,n,rate){const data=Array.from({length:ch},()=>new Float32Array(n));return {numberOfChannels:ch,length:n,sampleRate:rate,getChannelData:i=>data[i],data};}
   createBufferSource(){const n={connect:x=>{n.connected=x},disconnect(){},start(){window.testAudio.started.push(n)},stop(){window.testAudio.stopped++}};return n;}
   close(){window.testAudio.closed++;return Promise.resolve();}
  };
 });
 await page.goto('/listening/');
}

test('stereo channel buffers are isolated, low-level, faded and cancel stale pending starts',async({page})=>{
 await mockAudio(page);expect(await page.evaluate(()=>testAudio.contexts)).toBe(0);
 await page.getByRole('button',{name:'Play left',exact:true}).click();await page.getByRole('button',{name:'Play right',exact:true}).click();
 await page.evaluate(()=>{testAudio.pending[0].resolve();testAudio.pending[1].resolve()});
 await expect(page.locator('[data-test-status]')).toHaveText('Playing right channel only.');
 const result=await page.evaluate(()=>{const a=testAudio.started;const b=a[0].buffer;return {count:a.length,channels:b.numberOfChannels,length:b.length,rate:b.sampleRate,left:b.data[0].every(x=>x===0),max:Math.max(...b.data[1]),first:b.data[1][0],last:Math.abs(b.data[1][b.length-1]),connected:!!a[0].connected}});
 expect(result).toMatchObject({count:1,channels:2,length:38400,rate:48000,left:true,first:0,last:0,connected:true});expect(result.max).toBeLessThanOrEqual(.040001);expect(result.max).toBeGreaterThan(.039);
 await page.getByRole('button',{name:'Stop test'}).click();await expect(page.locator('[data-test-status]')).toHaveText('Test stopped.');
 await page.getByRole('button',{name:'Play left',exact:true}).click();await page.getByRole('button',{name:'Stop test'}).click();await page.evaluate(()=>testAudio.pending[2].resolve());expect(await page.evaluate(()=>testAudio.started.length)).toBe(1);
 await page.getByRole('button',{name:'Play left',exact:true}).click();await page.evaluate(()=>testAudio.pending[3].resolve());
 expect(await page.evaluate(()=>testAudio.started[1].buffer.data[1].every(x=>x===0))).toBeTruthy();
 await page.evaluate(()=>testAudio.started[1].onended());await expect(page.locator('[data-test-status]')).toHaveText('Test finished. Choose a channel to play again.');
});

test('stereo handles unavailable audio, resume rejection, page exit and restored-page replay',async({page})=>{
 await mockAudio(page);await page.getByRole('button',{name:'Play left',exact:true}).click();await page.evaluate(()=>testAudio.pending[0].reject(new Error('blocked')));await expect(page.locator('[data-test-status]')).toContainText('could not start');
 await page.getByRole('button',{name:'Play left',exact:true}).click();await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));await page.evaluate(()=>testAudio.pending[1].resolve());expect(await page.evaluate(()=>testAudio.started.length)).toBe(0);expect(await page.evaluate(()=>testAudio.closed)).toBe(1);
 await page.getByRole('button',{name:'Play right',exact:true}).click();await page.evaluate(()=>testAudio.pending[2].resolve());expect(await page.evaluate(()=>testAudio.contexts)).toBe(2);await expect(page.locator('[data-test-status]')).toHaveText('Playing right channel only.');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});await expect(page.locator('[data-test-status]')).toHaveText('Test stopped.');
});

test('stereo test degrades explicitly when Web Audio is unsupported',async({page})=>{
 await page.addInitScript(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined});await page.goto('/listening/');await expect(page.getByRole('button',{name:'Play left',exact:true})).toBeDisabled();await expect(page.locator('[data-test-status]')).toContainText('does not support');
});

test('actual Web Audio channel rendering and short user-started playback complete',async({page})=>{
 await page.addInitScript(()=>{
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  const old=C.prototype.createBufferSource;
  C.prototype.createBufferSource=function(){const node=old.call(this);const start=node.start.bind(node);node.start=(...args)=>{window.lastTestBuffer=node.buffer;return start(...args)};return node};
 });
 await page.goto('/listening/');
 for(const [label,silent,active]of[['Play left',1,0],['Play right',0,1]]){
  await page.getByRole('button',{name:label,exact:true}).click();await expect(page.locator('[data-test-status]')).toContainText('Playing');
  const measured=await page.evaluate(async({silent,active})=>{const b=window.lastTestBuffer;const C=window.OfflineAudioContext||window.webkitOfflineAudioContext;const ctx=new C(2,b.length,b.sampleRate);const n=ctx.createBufferSource();n.buffer=b;n.connect(ctx.destination);n.start();const out=await ctx.startRendering();return {silent:out.getChannelData(silent).every(x=>x===0),active:out.getChannelData(active).some(x=>Math.abs(x)>.03)}},{silent,active});
  expect(measured).toEqual({silent:true,active:true});await expect(page.locator('[data-test-status]')).toContainText('Test finished',{timeout:5000});
 }
});


test('new visitor pages preserve accessible structure and theme contrast',async({page})=>{
 for(const route of ['/how-it-works/','/get-involved/'])for(const theme of ['light','dark','black']){
  await page.setViewportSize({width:320,height:900});await page.goto(route);
  await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  const violations=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations);
  expect(violations).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 }
});
