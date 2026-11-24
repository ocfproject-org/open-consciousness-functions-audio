const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium, devices} = require('playwright');

const route = '/experiments/continuous-smart-play/';
const root = path.resolve(process.env.SITE_DIR || 'verified-site');
const manifest = JSON.parse(fs.readFileSync(path.join(root,route,'stream.json')));
const media = fs.readFileSync(path.join(root,route,manifest.file));
assert.equal(crypto.createHash('sha256').update(media).digest('hex'), manifest.sha256);
assert.equal(media.length, manifest.bytes);
const allow = new Set(['preview.html','preview.css','preview.js','stream.json',manifest.file].map(n=>route+n));
for (const file of ['editions.js','playback-controls.js']) allow.add('/assets/js/'+file);
const url = process.env.CONTINUOUS_SMART_PLAY_LIVE;
const server = http.createServer((req,res) => {
  if (!allow.has(req.url)) return res.writeHead(404).end();
  const file = req.url.endsWith('.mp3') ? media : fs.readFileSync(path.join(root,req.url));
  const type = {'.mp3':'audio/mpeg','.js':'text/javascript','.json':'application/json','.html':'text/html','.css':'text/css'}[path.extname(req.url)];
  const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
  const a = match ? Number(match[1]) : 0;
  const b = match && match[2] ? Math.min(Number(match[2]),file.length-1) : file.length-1;
  if (a > b || (req.headers.range && !match)) return res.writeHead(416,{'Content-Range':'bytes */'+file.length}).end();
  const h = {'Content-Type':type,'Accept-Ranges':'bytes','Content-Length':b-a+1};
  if (match) h['Content-Range'] = 'bytes '+a+'-'+b+'/'+file.length;
  res.writeHead(match ? 206 : 200,h);
  res.end(req.method==='HEAD'?undefined:file.subarray(a,b+1));
});

(async()=>{
  if (!url) await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base = url || 'http://127.0.0.1:'+server.address().port;
  if (url) assert.equal(url,'https://ocfproject.org');
  const browser = await chromium.launch();
  try {
    for (const [name,options] of [['desktop',{}],['Android emulation',devices['Pixel 7']]]) {
      const c=await browser.newContext(options);
      await c.addInitScript(()=>localStorage.setItem('ocf-audio-edition:v1',JSON.stringify({schema:1,selection:'latest',format:'flac'})));
      const p=await c.newPage(), messages=[];
      p.on('pageerror',e=>messages.push(String(e)));
      const response=await p.goto(base+route+'preview.html');
      assert.equal(response.status(),200);
      assert.match(await p.locator('meta[name=robots]').getAttribute('content'),/noindex/);
      const gear=p.getByRole('button',{name:/Smart Play settings/}), status=p.locator('#media-status'), audio=p.locator('audio');
      await gear.waitFor();
      assert.match(await status.textContent(),/Original recording · FLAC/);
      assert.match(await audio.locator('source').getAttribute('src'),/\.flac$/);
      assert.equal(await p.locator('#bookmarks').isVisible(),false);
      assert.equal(await p.locator('audio').count(),1);
      await gear.click();await p.getByLabel('Resonant Tuning').selectOption('off');
      await p.getByRole('button',{name:'Apply',exact:true}).click();
      await p.waitForFunction(()=>document.querySelector('#media-status').textContent.includes('Resonant Tuning off'));
      assert.match(await status.textContent(),/MP3/);
      assert.equal(await audio.evaluate(a=>a.paused),true);
      assert.equal(await p.locator('#bookmarks').getAttribute('open'),null);
      const samples=await p.evaluate(async({mediaPath,size})=>{
        return Promise.all([0,Math.floor(size/2),size-2].map(async a=>{
          const res=await fetch(mediaPath,{headers:{Range:'bytes='+a+'-'+(a+1)},cache:'no-store'});
          return {a,status:res.status,range:res.headers.get('content-range'),bytes:[...new Uint8Array(await res.arrayBuffer())]};
        }));
      },{mediaPath:route+manifest.file,size:manifest.bytes});
      for (const s of samples) {
        assert.equal(s.status,206);assert.equal(s.range,'bytes '+s.a+'-'+(s.a+1)+'/'+media.length);
        assert.deepEqual(s.bytes,[...media.subarray(s.a,s.a+2)]);
      }
      await p.getByRole('button',{name:'Play',exact:true}).click();
      await p.waitForFunction(()=>{const a=document.querySelector('audio');return !a.paused&&a.currentTime>.1});
      assert.ok(Math.abs(await audio.evaluate(a=>a.duration)-manifest.duration)<.3);
      await p.getByText('Smart Play bookmarks',{exact:true}).click();
      await p.getByRole('button',{name:/Just before/}).click();
      await p.waitForFunction(join=>{const a=document.querySelector('audio');return !a.seeking&&a.currentTime>=join-15.2&&a.currentTime<join-13},manifest.join);
      // Verify the live media clock crosses the edit on the same element and URL.
      await audio.evaluate((a,j)=>{a.currentTime=j-.7},manifest.join);
      await p.waitForFunction(join=>{const a=document.querySelector('audio');return !a.paused&&!a.seeking&&a.currentTime>join+1},manifest.join,{timeout:8000});
      assert.match(await audio.evaluate(a=>a.currentSrc),/energy-ball-tuning-off-[a-f0-9]{16}\.mp3$/);
      await p.getByRole('button',{name:'Pause',exact:true}).click();
      await gear.click();await p.getByLabel('Resonant Tuning').selectOption('original');
      await p.getByRole('button',{name:'Apply',exact:true}).click();
      await p.waitForFunction(()=>document.querySelector('#media-status').textContent.includes('Original recording · FLAC'));
      assert.match(await audio.locator('source').getAttribute('src'),/\.flac$/);
      assert.equal(await audio.evaluate(a=>a.paused),true);
      assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('ocf-audio-edition:v1')).format),'flac');
      assert.deepEqual(messages,[]);
      await c.close();
      console.log(name+': single native edited stream crosses edit, verified ranges, default FLAC preserved.');
    }
  } finally { await browser.close(); if (!url) {server.closeAllConnections();server.close();} }
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
